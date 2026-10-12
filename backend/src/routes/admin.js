import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { passwordSchema } from '../lib/password.js';
import { toLocal } from '../lib/phone.js';
import { parse, phoneSchema, z } from '../lib/validate.js';
import { requireAdmin, requireAdminKey } from '../middleware/auth.js';
import { adminSetPassword } from '../services/accounts.js';
import * as svc from '../services/admin.js';
import { approveWithdrawal, rejectWithdrawal } from '../services/ledger.js';
import { approveReviewedOrder } from '../services/orders.js';

const router = Router();

const idParam = (req) => parse(z.object({ id: z.string().uuid('Invalid id.') }), { id: req.params.id }).id;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must look like 2026-10-31.').optional();
const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
};
const orderQuery = z.object({ status: z.string().max(20).optional(), q: z.string().max(40).optional(), from: date, to: date, ...paging });
const ledgerQuery = z.object({ kind: z.string().max(30).optional(), q: z.string().max(40).optional(), from: date, to: date, ...paging });

/* ---- Granting admin rights works with the API key only, never from a dashboard login ---- */

router.post('/users/set-admin', requireAdminKey, async (req, res) => {
  const { phone, admin } = parse(z.object({ phone: phoneSchema, admin: z.boolean() }), req.body);
  const r = await query('UPDATE users SET is_admin = $2 WHERE phone = $1', [phone, admin]);
  if (!r.rowCount) throw new HttpError(404, 'No account with that phone number. They must register on the site first.');
  await svc.audit(req, admin ? 'grant_admin' : 'revoke_admin', 'user', toLocal(phone));
  res.json({ ok: true });
});

router.use(requireAdmin);

router.get('/me', (req, res) => {
  res.json({ via: req.admin.via, phone: req.admin.phone ? toLocal(req.admin.phone) : null });
});

router.get('/stats', async (req, res) => {
  res.json(await svc.getStats());
});

/* ---- Transactions ---- */

router.get('/orders', async (req, res) => {
  res.json(await svc.listOrders(parse(orderQuery, req.query)));
});

router.get('/ledger', async (req, res) => {
  res.json(await svc.listLedger(parse(ledgerQuery, req.query)));
});

router.get('/export/orders.csv', async (req, res) => {
  const f = parse(orderQuery, req.query);
  const csv = await svc.exportOrdersCsv(f);
  await svc.audit(req, 'export_orders', 'orders', null, { status: f.status, q: f.q, from: f.from, to: f.to });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="connectplus-orders.csv"' });
  res.send(csv);
});

// Orders held back because something looked wrong (amount mismatch, duplicate receipt).
router.get('/orders/attention', async (req, res) => {
  const { rows } = await query(`SELECT * FROM orders WHERE status = 'needs_review' ORDER BY created_at LIMIT 200`);
  res.json(rows.map((o) => ({
    id: o.id, ref: o.ref, status: o.status, reason: o.failure_reason, title: o.title,
    price: o.price_cents / 100, recipient: toLocal(o.recipient_phone), payer: toLocal(o.payer_phone),
    mpesaReceipt: o.mpesa_receipt, createdAt: o.created_at.toISOString()
  })));
});

// Accept an order you have checked by hand. It is marked complete and commission is credited.
router.post('/orders/:id/accept', async (req, res) => {
  const id = idParam(req);
  await approveReviewedOrder(id);
  await svc.audit(req, 'order_accepted', 'order', id);
  res.json({ ok: true });
});

/* ---- Withdrawals: you send the money from your M-Pesa app, then mark it paid here ---- */

router.get('/withdrawals', async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const { rows } = await query(
    `SELECT w.*, u.phone AS user_phone FROM withdrawals w JOIN users u ON u.id = w.user_id
      WHERE w.status = $1 ORDER BY w.created_at ${status === 'pending' ? 'ASC' : 'DESC'} LIMIT 200`,
    [status]
  );
  res.json(rows.map((w) => ({
    id: w.id, status: w.status, amount: w.amount_cents / 100, payTo: toLocal(w.phone),
    account: toLocal(w.user_phone), mpesaRef: w.mpesa_ref, note: w.note,
    createdAt: w.created_at.toISOString(), processedAt: w.processed_at?.toISOString() ?? null
  })));
});

router.post('/withdrawals/:id/approve', async (req, res) => {
  const { mpesaRef } = parse(z.object({ mpesaRef: z.string().trim().max(40).optional() }), req.body);
  const w = await approveWithdrawal(idParam(req), mpesaRef);
  await svc.audit(req, 'withdrawal_paid', 'withdrawal', w.id, { amount: w.amount_cents / 100, payTo: toLocal(w.phone), mpesaRef: mpesaRef || null });
  res.json({ ok: true });
});

router.post('/withdrawals/:id/reject', async (req, res) => {
  const { note } = parse(z.object({ note: z.string().trim().max(200).optional() }), req.body);
  const w = await rejectWithdrawal(idParam(req), note);
  await svc.audit(req, 'withdrawal_declined', 'withdrawal', w.id, { amount: w.amount_cents / 100, payTo: toLocal(w.phone), note: note || null });
  res.json({ ok: true });
});

/* ---- Offers ---- */

const offerFields = {
  cat: z.enum(['data', 'sms', 'min', 'special'], { errorMap: () => ({ message: 'Choose a category.' }) }),
  size: z.string({ required_error: 'Enter the size.' }).trim().min(1, 'Enter the size, like 1GB.').max(20, 'Size is too long.'),
  title: z.string({ required_error: 'Enter a title.' }).trim().min(1, 'Enter a title.').max(60, 'Title is too long.'),
  valid: z.string({ required_error: 'Enter the validity.' }).trim().min(1, 'Enter the validity, like for 24 hours.').max(40, 'Validity text is too long.'),
  price: z.number({ required_error: 'Enter a price.', invalid_type_error: 'Price must be a number.' })
    .int('Price must be a whole number of shillings.').min(1, 'Price must be at least KSh 1.').max(150000, 'Price is too high.'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Pick a valid colour.'),
  sort: z.number().int().min(0).max(100000),
  active: z.boolean()
};
const createOfferSchema = z.object({
  ...offerFields,
  color: offerFields.color.default('#1565e8'),
  sort: offerFields.sort.default(0),
  active: offerFields.active.default(true)
});
const patchOfferSchema = z.object(offerFields).partial().refine((o) => Object.keys(o).length > 0, { message: 'Nothing to change.' });

router.get('/offers', async (req, res) => {
  res.json(await svc.listOffers());
});

router.post('/offers', async (req, res) => {
  const offer = await svc.createOffer(parse(createOfferSchema, req.body));
  await svc.audit(req, 'offer_created', 'offer', offer.id, offer);
  res.status(201).json(offer);
});

router.patch('/offers/:id', async (req, res) => {
  const id = parse(z.object({ id: z.string().min(1).max(40) }), { id: req.params.id }).id;
  const { before, after } = await svc.updateOffer(id, parse(patchOfferSchema, req.body));
  await svc.audit(req, 'offer_updated', 'offer', id, { before, after });
  res.json(after);
});

/* ---- Activity log ---- */

router.get('/audit', async (req, res) => {
  res.json(await svc.listAudit());
});

/* ---- Customers who forgot their password (there is no SMS reset) ---- */

router.post('/users/reset-password', async (req, res) => {
  const { phone, newPassword } = parse(z.object({ phone: phoneSchema, newPassword: passwordSchema }), req.body);
  await adminSetPassword(phone, newPassword);
  await svc.audit(req, 'password_reset', 'user', toLocal(phone));
  res.json({ ok: true });
});

export default router;
