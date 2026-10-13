import { Router } from 'express';
import { config } from '../config.js';
import { query } from '../db.js';

const router = Router();

router.get('/', (req, res) => {
  res.json({ name: 'ConnectPlus API', status: 'ok' });
});
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
// Public, privacy-safe totals for the live stats band. No phone numbers, no money amounts.
// Cached for a minute so a busy page cannot hammer the database.
let statsCache = { at: 0, data: null };

async function publicStats() {
  if (statsCache.data && Date.now() - statsCache.at < 60000) return statsCache.data;
  const { rows: [o] } = await query(`
    SELECT COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
           COUNT(*) FILTER (WHERE status = 'delivered'
             AND paid_at >= (date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi') AT TIME ZONE 'Africa/Nairobi')) AS today
      FROM orders`);
  const { rows: [m] } = await query('SELECT COUNT(*) AS members FROM users');
  const { rows: [p] } = await query(`
    SELECT title FROM orders WHERE status = 'delivered' AND paid_at >= now() - interval '30 days'
     GROUP BY title ORDER BY COUNT(*) DESC, title LIMIT 1`);
  statsCache = {
    at: Date.now(),
    data: { bundlesDelivered: o.delivered, deliveredToday: o.today, members: m.members, popular: p ? p.title : null }
  };
  return statsCache.data;
}

router.get('/stats/public', async (req, res) => {
  res.set('Cache-Control', 'public, max-age=30');
  res.json(await publicStats());
});

export default router;
