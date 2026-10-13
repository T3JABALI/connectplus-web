import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { parse, phoneSchema, z } from '../lib/validate.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { createOrder, shapeOrder } from '../services/orders.js';

const router = Router();

const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many purchase attempts. Try again later.' }
});

router.post('/', orderLimiter, optionalAuth, async (req, res) => {
  const { offerId, payerPhone } = parse(
    z.object({
      offerId: z.string({ required_error: 'Choose a bundle.' }).min(1).max(40),
      payerPhone: phoneSchema
    }),
    req.body
  );
  // Bundles always go to the number that pays. Zod drops unknown fields, so a
  // recipientPhone sent by a client is ignored.
  const result = await createOrder({ offerId, recipientPhone: payerPhone, payerPhone, userId: req.userId });
  res.status(201).json(result);
});

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await query('SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.userId]);
  res.json(rows.map((o) => shapeOrder(o)));
});

// Public on purpose: guests poll this after paying. The order id is a random UUID, so it
// works like a private link.
router.get('/:id', async (req, res) => {
  if (!z.string().uuid().safeParse(req.params.id).success) throw new HttpError(404, 'Order not found.');
  const { rows: [o] } = await query('SELECT * FROM orders WHERE id = $1', [req.params.id]);
  if (!o) throw new HttpError(404, 'Order not found.');
  let commission = 0;
  if (o.user_id && o.status === 'delivered') {
    const { rows: [l] } = await query(`SELECT amount_cents FROM ledger WHERE order_id = $1 AND kind = 'self'`, [o.id]);
    commission = l ? l.amount_cents : 0;
  }
  res.json(shapeOrder(o, commission));
});

export default router;
