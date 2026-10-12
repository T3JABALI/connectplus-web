import crypto from 'node:crypto';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { ledgerFilters, orderFilters, toCsv } from '../lib/adminQuery.js';
import { toLocal } from '../lib/phone.js';

/* ----------------------------------------------------------------- audit */

// Records what an admin did. A failure here is logged but never blocks the action itself.
export async function audit(req, action, targetType, targetId, details = {}) {
  try {
    await query(
      `INSERT INTO admin_audit (admin_user_id, via, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.admin?.userId ?? null, req.admin?.via ?? 'unknown', action, targetType ?? null,
        targetId != null ? String(targetId) : null, JSON.stringify(details)]
    );
  } catch (e) {
    console.error('Audit log failed:', e.message);
  }
}

export async function listAudit() {
  const { rows } = await query(
    `SELECT a.*, u.phone AS admin_phone FROM admin_audit a
       LEFT JOIN users u ON u.id = a.admin_user_id ORDER BY a.id DESC LIMIT 100`
  );
  return rows.map((a) => ({
    id: String(a.id),
    at: a.created_at.toISOString(),
    admin: a.admin_phone ? toLocal(a.admin_phone) : a.via === 'api-key' ? 'API key' : 'Unknown',
    via: a.via,
    action: a.action,
    targetType: a.target_type,
    targetId: a.target_id,
    details: a.details
  }));
}

/* ----------------------------------------------------------------- stats */

const TODAY = `(date_trunc('day', now() AT TIME ZONE 'Africa/Nairobi') AT TIME ZONE 'Africa/Nairobi')`;

export async function getStats() {
  const { rows: [o] } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'delivered')       AS completed,
      COUNT(*) FILTER (WHERE status = 'pending_payment') AS awaiting,
      COUNT(*) FILTER (WHERE status = 'payment_failed')  AS failed,
      COUNT(*) FILTER (WHERE status IN ('needs_review', 'delivery_failed')) AS review,
      COALESCE(SUM(price_cents) FILTER (WHERE status = 'delivered'), 0) AS rev_all,
      COALESCE(SUM(price_cents) FILTER (WHERE status = 'delivered' AND paid_at >= ${TODAY}), 0) AS rev_today,
      COALESCE(SUM(price_cents) FILTER (WHERE status = 'delivered' AND paid_at >= ${TODAY} - interval '6 days'), 0) AS rev_week
    FROM orders`);
  const { rows: [w] } = await query(`
    SELECT COUNT(*) FILTER (WHERE status = 'pending') AS pending_n,
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'pending'), 0)  AS pending_sum,
           COALESCE(SUM(amount_cents) FILTER (WHERE status = 'approved'), 0) AS paid_sum
      FROM withdrawals`);
  const { rows: [m] } = await query(`
    SELECT (SELECT COUNT(*) FROM users) AS total,
           (SELECT COALESCE(SUM(amount_cents), 0) FROM ledger) AS owed`);
  const { rows: days } = await query(`
    SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(SUM(o.price_cents), 0) AS revenue, COUNT(o.id) AS orders
      FROM generate_series((now() AT TIME ZONE 'Africa/Nairobi')::date - 6, (now() AT TIME ZONE 'Africa/Nairobi')::date, interval '1 day') d
      LEFT JOIN orders o ON o.status = 'delivered' AND (o.paid_at AT TIME ZONE 'Africa/Nairobi')::date = d::date
     GROUP BY d ORDER BY d`);
  return {
    revenue: { today: o.rev_today / 100, week: o.rev_week / 100, all: o.rev_all / 100 },
    orders: { completed: o.completed, awaitingPayment: o.awaiting, failed: o.failed, needsReview: o.review },
    withdrawals: { pendingCount: w.pending_n, pendingAmount: w.pending_sum / 100, paidAmount: w.paid_sum / 100 },
    members: { total: m.total, balancesOwed: m.owed / 100 },
    daily: days.map((d) => ({ day: d.day, revenue: d.revenue / 100, orders: d.orders }))
  };
}

/* ---------------------------------------------------------------- orders */

const shapeOrder = (o) => ({
  id: o.id,
  ref: o.ref,
  createdAt: o.created_at.toISOString(),
  paidAt: o.paid_at ? o.paid_at.toISOString() : null,
  title: o.title,
  price: o.price_cents / 100,
  status: o.status,
  recipient: toLocal(o.recipient_phone),
  payer: toLocal(o.payer_phone),
  account: o.account_phone ? toLocal(o.account_phone) : null,
  mpesaReceipt: o.mpesa_receipt,
  reason: o.failure_reason
});

const ORDER_FROM = 'FROM orders o LEFT JOIN users u ON u.id = o.user_id';

export async function listOrders(f) {
  const { where, params } = orderFilters(f);
  const { rows: [c] } = await query(`SELECT COUNT(*) AS n ${ORDER_FROM} ${where}`, params);
  const { rows } = await query(
    `SELECT o.*, u.phone AS account_phone ${ORDER_FROM} ${where}
      ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize]
  );
  return { items: rows.map(shapeOrder), total: c.n, page: f.page, pageSize: f.pageSize };
}

export async function exportOrdersCsv(f) {
  const { where, params } = orderFilters(f);
  const { rows } = await query(
    `SELECT o.*, u.phone AS account_phone ${ORDER_FROM} ${where} ORDER BY o.created_at DESC LIMIT 50000`,
    params
  );
  const headers = ['Reference', 'Created', 'Paid', 'Offer', 'Amount (KES)', 'Status', 'Payer', 'Recipient', 'Account', 'M-Pesa receipt', 'Note'];
  return toCsv(headers, rows.map(shapeOrder).map((o) => [
    o.ref, o.createdAt, o.paidAt, o.title, o.price, o.status, o.payer, o.recipient, o.account || 'Guest', o.mpesaReceipt, o.reason
  ]));
}

/* ---------------------------------------------------------------- ledger */

export async function listLedger(f) {
  const { where, params } = ledgerFilters(f);
  const from = `FROM ledger l JOIN users u ON u.id = l.user_id LEFT JOIN orders o ON o.id = l.order_id`;
  const { rows: [c] } = await query(`SELECT COUNT(*) AS n ${from} ${where}`, params);
  const { rows } = await query(
    `SELECT l.*, u.phone AS account_phone, o.ref AS order_ref ${from} ${where}
      ORDER BY l.created_at DESC, l.id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
    [...params, f.pageSize, (f.page - 1) * f.pageSize]
  );
  const now = Date.now();
  return {
    items: rows.map((l) => ({
      id: String(l.id),
      at: l.created_at.toISOString(),
      kind: l.kind,
      amount: l.amount_cents / 100,
      description: l.description,
      account: toLocal(l.account_phone),
      orderRef: l.order_ref,
      onHold: l.available_at.getTime() > now
    })),
    total: c.n, page: f.page, pageSize: f.pageSize
  };
}

/* ---------------------------------------------------------------- offers */

const shapeOffer = (o, priceClash = false) => ({
  id: o.id, cat: o.cat, net: o.net, size: o.size, title: o.title, valid: o.valid,
  price: o.price_cents / 100, color: o.color, sort: o.sort, active: o.active, priceClash
});

export async function listOffers() {
  const { rows } = await query('SELECT * FROM offers ORDER BY sort, id');
  const counts = new Map();
  for (const o of rows) if (o.active) counts.set(o.price_cents, (counts.get(o.price_cents) || 0) + 1);
  return rows.map((o) => shapeOffer(o, o.active && counts.get(o.price_cents) > 1));
}

// Your USSD automation tells bundles apart by the amount paid, so two active offers must not share a price.
async function assertNoPriceClash(priceCents, exceptId) {
  const { rows: [c] } = await query(
    'SELECT title FROM offers WHERE active AND price_cents = $1 AND id <> $2 LIMIT 1',
    [priceCents, exceptId || '']
  );
  if (c) {
    throw new HttpError(409, `"${c.title}" already costs KSh ${priceCents / 100}. Your USSD automation tells bundles apart by the amount paid, so each active offer needs its own price.`);
  }
}

export async function createOffer(d) {
  const priceCents = d.price * 100;
  if (d.active) await assertNoPriceClash(priceCents);
  const id = 'o' + crypto.randomBytes(4).toString('hex');
  const { rows: [o] } = await query(
    `INSERT INTO offers (id, cat, size, title, valid, price_cents, color, sort, active)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [id, d.cat, d.size, d.title, d.valid, priceCents, d.color, d.sort, d.active]
  );
  return shapeOffer(o);
}

export async function updateOffer(id, patch) {
  const { rows: [cur] } = await query('SELECT * FROM offers WHERE id = $1', [id]);
  if (!cur) throw new HttpError(404, 'Offer not found.');
  const priceCents = patch.price !== undefined ? patch.price * 100 : cur.price_cents;
  const active = patch.active ?? cur.active;
  // Only block changes that CREATE a clash. Existing clashes are shown as warnings instead.
  if (active && (priceCents !== cur.price_cents || !cur.active)) await assertNoPriceClash(priceCents, id);
  const { rows: [o] } = await query(
    `UPDATE offers SET cat = $2, size = $3, title = $4, valid = $5, price_cents = $6, color = $7, sort = $8, active = $9
      WHERE id = $1 RETURNING *`,
    [id, patch.cat ?? cur.cat, patch.size ?? cur.size, patch.title ?? cur.title, patch.valid ?? cur.valid,
      priceCents, patch.color ?? cur.color, patch.sort ?? cur.sort, active]
  );
  return { before: shapeOffer(cur), after: shapeOffer(o) };
}
