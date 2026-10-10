import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';

const router = Router();

router.get('/health', async (req, res) => {
  await query('SELECT 1');
  res.json({ ok: true });
});

router.get('/config', (req, res) => {
  res.json({ selfRate: config.selfRate, refRate: config.refRate, minWithdraw: config.minWithdrawKes });
});

router.get('/offers', async (req, res) => {
  const { rows } = await query('SELECT * FROM offers WHERE active ORDER BY sort, id');
  res.set('Cache-Control', 'public, max-age=60');
  res.json(rows.map((o) => ({
    id: o.id, cat: o.cat, net: o.net, size: o.size, title: o.title,
    valid: o.valid, price: o.price_cents / 100, color: o.color
  })));
});

export default router;
