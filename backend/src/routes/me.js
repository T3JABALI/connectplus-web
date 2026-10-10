import { Router } from 'express';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { toLocal, mask } from '../lib/phone.js';
import { requireAuth } from '../middleware/auth.js';
import { shapeUser } from '../services/accounts.js';
import { getStats } from '../services/ledger.js';

const router = Router();
router.get('/me', requireAuth, async (req, res) => {
  const { rows: [u] } = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (!u) throw new HttpError(401, 'Your session has expired. Log in again.');
  res.json({ user: shapeUser(u), stats: await getStats(u.id) });
});

router.get('/commissions', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT id, description, amount_cents, created_at FROM ledger
      WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 100`,
    [req.userId]
  );
  res.json(rows.map((l) => ({
    id: String(l.id), description: l.description, amount: l.amount_cents / 100, createdAt: l.created_at.toISOString()
  })));
});

router.get('/referrals', requireAuth, async (req, res) => {
  const { rows } = await query(
    `SELECT u.id, u.phone, u.created_at,
            (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'delivered') AS orders,
            (SELECT COALESCE(SUM(l.amount_cents), 0) FROM ledger l JOIN orders o ON o.id = l.order_id
              WHERE l.user_id = $1 AND l.kind = 'referral' AND o.user_id = u.id) AS earned
       FROM users u WHERE u.referred_by = $1 ORDER BY u.created_at DESC`,
    [req.userId]
  );
  res.json(rows.map((r) => ({
    id: r.id, maskedPhone: mask(r.phone), joinedAt: r.created_at.toISOString(), orders: r.orders, earned: r.earned / 100
  })));
});

export default router;
