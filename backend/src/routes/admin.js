import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { toLocal } from '../lib/phone.js';
import { parse, z } from '../lib/validate.js';
import { requireAdmin } from '../middleware/auth.js';
import { approveWithdrawal, rejectWithdrawal } from '../services/ledger.js';
import { completeDelivery, kickDeliveries } from '../services/orders.js';

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

/* ---- orders that need a human: paid but not delivered ---- */

router.get('/orders/attention', async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM orders WHERE status IN ('delivery_failed', 'needs_review') ORDER BY created_at LIMIT 200`
  );
  res.json(rows.map((o) => ({
    id: o.id, ref: o.ref, status: o.status, reason: o.failure_reason, title: o.title,
    price: o.price_cents / 100, recipient: toLocal(o.recipient_phone), payer: toLocal(o.payer_phone),
    mpesaReceipt: o.mpesa_receipt, paidAt: o.paid_at?.toISOString() ?? null
  })));
});

// Try delivering again. Only do this after checking with your provider that the bundle was NOT sent.
router.post('/orders/:id/retry', async (req, res) => {
  const r = await query(`UPDATE orders SET status = 'paid' WHERE id = $1 AND status = 'delivery_failed'`, [idParam(req)]);
  if (!r.rowCount) throw new HttpError(409, 'Only orders with a failed delivery can be retried.');
  kickDeliveries();
  res.json({ ok: true });
});

// Use after you delivered the bundle yourself. Records it and credits commission.
router.post('/orders/:id/mark-delivered', async (req, res) => {
  const id = idParam(req);
  const r = await query(
    `UPDATE orders SET status = 'delivering', delivery_started_at = now()
      WHERE id = $1 AND status IN ('delivery_failed', 'needs_review')`, [id]
  );
  if (!r.rowCount) throw new HttpError(409, 'That order is not waiting for attention.');
  await completeDelivery(id, 'manual');
  res.json({ ok: true });
});

export default router;
