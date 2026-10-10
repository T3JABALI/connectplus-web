import { config } from '../config.js';
import { query, tx } from '../db.js';
import { HttpError } from '../errors.js';
import { toLocal } from '../lib/phone.js';

// balance = commission whose hold period has passed (what can be withdrawn now)
// totalEarned = every commission ever credited, including ones still on hold
export async function getStats(userId) {
  const { rows: [b] } = await query(
    `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE available_at <= now()), 0) AS available,
            COALESCE(SUM(amount_cents) FILTER (WHERE kind IN ('self', 'referral')), 0) AS earned
       FROM ledger WHERE user_id = $1`,
    [userId]
  );
  const { rows: [c] } = await query(
    `SELECT (SELECT COUNT(*) FROM orders WHERE user_id = $1 AND status = 'delivered') AS orders,
            (SELECT COUNT(*) FROM users  WHERE referred_by = $1) AS refs`,
    [userId]
  );
  return { balance: b.available / 100, totalEarned: b.earned / 100, orderCount: c.orders, referralCount: c.refs };
}

export async function createWithdrawal(userId, amountCents, phone) {
  if (amountCents < config.minWithdrawKes * 100) {
    throw new HttpError(400, `The minimum withdrawal is KSh ${config.minWithdrawKes}.`);
  }
  return tx(async (c) => {
    // Lock this user's row so two withdrawals cannot both pass the balance check.
    await c.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const { rows: [b] } = await c.query(
      `SELECT COALESCE(SUM(amount_cents) FILTER (WHERE available_at <= now()), 0) AS available FROM ledger WHERE user_id = $1`,
      [userId]
    );
    if (amountCents > b.available) {
      throw new HttpError(400, 'You do not have enough available commission for that amount.');
    }
    const { rows: [w] } = await c.query(
      `INSERT INTO withdrawals (user_id, amount_cents, phone) VALUES ($1, $2, $3) RETURNING id`,
      [userId, amountCents, phone]
    );
    await c.query(
      `INSERT INTO ledger (user_id, withdrawal_id, kind, amount_cents, description)
       VALUES ($1, $2, 'withdrawal', $3, $4)`,
      [userId, w.id, -amountCents, `Withdrawal to ${toLocal(phone)} (pending approval)`]
    );
    return w.id;
  });
}

export async function approveWithdrawal(id, mpesaRef) {
  const r = await query(
    `UPDATE withdrawals SET status = 'approved', mpesa_ref = $2, processed_at = now()
      WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, mpesaRef || null]
  );
  if (!r.rowCount) throw new HttpError(409, 'That withdrawal is not pending.');
  await query(
    `UPDATE ledger SET description = $2 WHERE withdrawal_id = $1 AND kind = 'withdrawal'`,
    [id, `Withdrawal to ${toLocal(r.rows[0].phone)} (paid)`]
  );
  return r.rows[0];
}

export async function rejectWithdrawal(id, note) {
  return tx(async (c) => {
    const r = await c.query(
      `UPDATE withdrawals SET status = 'rejected', note = $2, processed_at = now()
        WHERE id = $1 AND status = 'pending' RETURNING *`,
      [id, note || null]
    );
    if (!r.rowCount) throw new HttpError(409, 'That withdrawal is not pending.');
    const w = r.rows[0];
    // Give the money back. The unique index guarantees this happens at most once.
    await c.query(
      `INSERT INTO ledger (user_id, withdrawal_id, kind, amount_cents, description)
       VALUES ($1, $2, 'withdrawal_reversal', $3, 'Withdrawal declined. Amount returned to your balance.')
       ON CONFLICT DO NOTHING`,
      [w.user_id, w.id, w.amount_cents]
    );
    return w;
  });
}
