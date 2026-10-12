import { Router } from 'express';
import { query } from '../db.js';
import { approveReviewedOrder } from '../services/orders.js';
import { toLocal } from '../lib/phone.js';
import { passwordSchema } from '../lib/password.js';
import { parse, phoneSchema, z } from '../lib/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { approveWithdrawal, rejectWithdrawal } from '../services/ledger.js';
import { adminSetPassword } from '../services/accounts.js';

const router = Router();
router.use(requireAdmin);

const idParam = (req) => parse(z.object({ id: z.string().uuid('Invalid id.') }), { id: req.params.id }).id;

/* ---- withdrawals: you send the money by hand (M-Pesa app), then mark it approved ---- */

router.get('/withdrawals', async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const { rows } = await query(
    `SELECT w.*, u.phone AS user_phone FROM withdrawals w JOIN users u ON u.id = w.user_id
      WHERE w.status = $1 ORDER BY w.created_at LIMIT 200`,
    [status]
  );
  res.json(rows.map((w) => ({
    id: w.id, status: w.status, amount: w.amount_cents / 100, payTo: toLocal(w.phone),
    account: toLocal(w.user_phone), mpesaRef: w.mpesa_ref, note: w.note,
    createdAt: w.created_at.toISOString(), processedAt: w.processed_at?.toISOString() ?? null
  })));
});

router.post('/withdrawals/:id/approve', async (req, res) => {
  const { mpesaRef } = parse(z.object({ mpesaRef: z.string().max(40).optional() }), req.body);
  await approveWithdrawal(idParam(req), mpesaRef);
  res.json({ ok: true });
});

router.post('/withdrawals/:id/reject', async (req, res) => {
  const { note } = parse(z.object({ note: z.string().max(200).optional() }), req.body);
  await rejectWithdrawal(idParam(req), note);
  res.json({ ok: true });
});
router.post('/users/reset-password', async (req, res) => {
  const { phone, newPassword } = parse(z.object({ phone: phoneSchema, newPassword: passwordSchema }), req.body);
  await adminSetPassword(phone, newPassword);
  res.json({ ok: true });
});
/* ---- orders that need a human: payments held because something looked wrong ---- */

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
  await approveReviewedOrder(idParam(req));
  res.json({ ok: true });
});

export default router;
