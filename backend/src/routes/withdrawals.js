import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { parse, phoneSchema, z } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { createWithdrawal } from '../services/ledger.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const { amount, phone } = parse(
    z.object({
      amount: z.number({ required_error: 'Enter the amount you want to withdraw.', invalid_type_error: 'Enter a valid amount.' })
        .positive('Enter a valid amount.').finite(),
      phone: phoneSchema
    }),
    req.body
  );
  const cents = Math.round(amount * 100);
  if (Math.abs(cents - amount * 100) > 1e-6) throw new HttpError(400, 'The amount can have at most 2 decimal places.');

  // Accounts are not verified by SMS, so money can only go to the number the account was created with.
  const { rows: [u] } = await query('SELECT phone FROM users WHERE id = $1', [req.userId]);
  if (!u) throw new HttpError(401, 'Your session has expired. Log in again.');
  if (u.phone !== phone) throw new HttpError(400, 'Withdrawals can only be sent to the number you registered with.');

  await createWithdrawal(req.userId, cents, phone);
  res.status(201).json({ ok: true });
});

export default router;
