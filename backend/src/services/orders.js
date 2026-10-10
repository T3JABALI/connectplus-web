import { config } from '../config.js';
import { query, tx } from '../db.js';
import { HttpError } from '../errors.js';
import { randomString } from '../lib/crypto.js';
import { mask, toLocal } from '../lib/phone.js';
import { deliverBundle } from './delivery.js';
import { stkPush, stkQuery } from './mpesa.js';

// Internal statuses are detailed. The frontend only needs five, and must never tell a customer
// "you were not charged" when the money was in fact taken, so every paid state maps to "paid".
const PUBLIC_STATUS = {
  pending_payment: 'pending',
  paid: 'paid',
  delivering: 'paid',
  delivery_failed: 'paid',
  needs_review: 'paid',
  delivered: 'delivered',
  payment_failed: 'failed',
  cancelled: 'cancelled'
};

export function shapeOrder(o, commissionCents = 0) {
  return {
    id: o.id,
    ref: o.ref,
    title: o.title,
    net: o.net,
    recipientPhone: toLocal(o.recipient_phone),
    price: o.price_cents / 100,
    status: PUBLIC_STATUS[o.status],
    createdAt: o.created_at.toISOString(),
    ...(commissionCents > 0 ? { commission: commissionCents / 100 } : {})
  };
}

/* ------------------------------------------------------------------ create */

export async function createOrder({ offerId, recipientPhone, payerPhone, userId }) {
  const { rows: [offer] } = await query('SELECT * FROM offers WHERE id = $1 AND active', [offerId]);
  if (!offer) throw new HttpError(404, 'That offer is no longer available.');

  // Stop people using us to spam payment prompts to someone else's phone.
  const { rows: [g] } = await query(
    `SELECT COUNT(*) FILTER (WHERE created_at > now() - interval '60 seconds') AS last_minute, COUNT(*) AS last_hour
       FROM orders WHERE payer_phone = $1 AND created_at > now() - interval '1 hour'`,
    [payerPhone]
  );
  if (g.last_minute > 0) throw new HttpError(429, 'Please wait a minute before sending another payment request to this number.');
  if (g.last_hour >= 10) throw new HttpError(429, 'Too many payment requests for this number. Try again later.');

  let order = null;
  for (let i = 0; i < 5 && !order; i++) {
    try {
      // The price always comes from the offers table, never from the browser.
      const r = await query(
        `INSERT INTO orders (ref, user_id, offer_id, title, net, price_cents, recipient_phone, payer_phone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        ['CP-' + randomString(6), userId || null, offer.id, offer.title, offer.net, offer.price_cents, recipientPhone, payerPhone]
      );
      order = r.rows[0];
    } catch (e) {
      if (e.code !== '23505') throw e; // duplicate ref: try another
    }
  }
  if (!order) throw new HttpError(500, 'Something went wrong. Try again.');

  try {
    const r = await stkPush({
      phone: payerPhone,
      amountKes: offer.price_cents / 100,
      reference: order.ref,
      description: 'Bundle'
    });
    await query('UPDATE orders SET merchant_request_id = $2, checkout_request_id = $3 WHERE id = $1',
      [order.id, r.merchantRequestId, r.checkoutRequestId]);

    if (config.mpesa.mode === 'mock') {
      // Development only: pretend the customer paid after 3 seconds.
      setTimeout(() => {
        applyPaymentResult({
          checkoutRequestId: r.checkoutRequestId,
          resultCode: 0,
          resultDesc: 'Mock payment',
          receipt: 'MOCK' + randomString(7),
          amountKes: offer.price_cents / 100
        }).catch((e) => console.error('Mock payment failed:', e.message));
      }, 3000);
    }
  } catch (e) {
    console.error('STK push failed for', order.ref, '-', e.message);
    await query(`UPDATE orders SET status = 'payment_failed', failure_reason = 'stk_push_failed' WHERE id = $1 AND status = 'pending_payment'`, [order.id]);
    throw new HttpError(502, 'We could not start the M-Pesa payment. Try again in a moment.');
  }

  return { id: order.id, ref: order.ref, status: 'pending' };
}

/* --------------------------------------------------------- payment result */

// Called by the M-Pesa callback, by the reconciler, and by the mock. Safe to call more than once.
export async function applyPaymentResult({ checkoutRequestId, resultCode, resultDesc, receipt, amountKes }) {
  let nowPaid = false;

  await tx(async (c) => {
    const { rows: [o] } = await c.query('SELECT * FROM orders WHERE checkout_request_id = $1 FOR UPDATE', [checkoutRequestId]);
    if (!o) {
      console.warn('Payment result for an unknown checkout id:', checkoutRequestId);
      return;
    }

    if (Number(resultCode) === 0) {
      // A late success may still arrive for an order we gave up on, so payment_failed is allowed here.
      if (!['pending_payment', 'payment_failed'].includes(o.status)) return;

      if (amountKes !== undefined && Math.round(Number(amountKes) * 100) !== o.price_cents) {
        await c.query(`UPDATE orders SET status = 'needs_review', failure_reason = $2 WHERE id = $1`,
          [o.id, `amount_mismatch: received ${amountKes}, expected ${o.price_cents / 100}`]);
        console.error('Amount mismatch on order', o.ref);
        return;
      }
      if (receipt) {
        const dup = await c.query('SELECT 1 FROM orders WHERE mpesa_receipt = $1 AND id <> $2', [receipt, o.id]);
        if (dup.rowCount) {
          await c.query(`UPDATE orders SET status = 'needs_review', failure_reason = 'duplicate_receipt' WHERE id = $1`, [o.id]);
          console.error('Duplicate M-Pesa receipt on order', o.ref);
          return;
        }
      }
      await c.query(
        `UPDATE orders SET status = 'paid', paid_at = now(), mpesa_receipt = $2, failure_reason = NULL WHERE id = $1`,
        [o.id, receipt || null]
      );
      nowPaid = true;
    } else if (o.status === 'pending_payment') {
      await c.query(`UPDATE orders SET status = 'payment_failed', failure_reason = $2 WHERE id = $1`,
        [o.id, String(resultDesc || 'payment_failed').slice(0, 200)]);
    }
    // A paid or delivered order is never moved backwards by a failure message.
  });

  if (nowPaid) kickDeliveries();
}

// Handles the JSON Safaricom posts to our callback URL.
export async function handleMpesaCallback(body) {
  const cb = body?.Body?.stkCallback;
  if (!cb || !cb.CheckoutRequestID) return;
  const items = Object.fromEntries((cb.CallbackMetadata?.Item || []).map((i) => [i.Name, i.Value]));
  const resultCode = Number(cb.ResultCode);

  if (resultCode === 0 && config.mpesa.verifyCallbacks) {
    // Do not trust the callback alone. Ask Safaricom directly before we release a bundle.
    const q = await stkQuery(cb.CheckoutRequestID);
    if (q.pending || q.resultCode !== 0) {
      console.warn('Success callback could not be confirmed yet for', cb.CheckoutRequestID, '- reconciler will retry');
      return;
    }
  }
  await applyPaymentResult({
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode,
    resultDesc: cb.ResultDesc,
    receipt: items.MpesaReceiptNumber,
    amountKes: items.Amount
  });
}

/* --------------------------------------------------------------- delivery */

let deliveringNow = false;

export function kickDeliveries() {
  setImmediate(() => processDeliveries().catch((e) => console.error('Delivery run failed:', e.message)));
}

export async function processDeliveries() {
  if (deliveringNow) return;
  deliveringNow = true;
  try {
    for (;;) {
      // Claiming moves the order to "delivering" in one step, so no other process can pick it up too.
      const { rows } = await query(
        `UPDATE orders SET status = 'delivering', delivery_started_at = now()
          WHERE id IN (SELECT id FROM orders WHERE status = 'paid' ORDER BY paid_at LIMIT 5 FOR UPDATE SKIP LOCKED)
          RETURNING *`
      );
      if (!rows.length) break;
      for (const o of rows) await deliverOne(o);
    }
  } finally {
    deliveringNow = false;
  }
}

async function deliverOne(o) {
  let result;
  try {
    const { rows: [offer] } = await query('SELECT * FROM offers WHERE id = $1', [o.offer_id]);
    result = await deliverBundle({ order: o, offer });
  } catch (e) {
    console.error('Delivery failed for', o.ref, '-', e.message);
    await query(`UPDATE orders SET status = 'delivery_failed', failure_reason = $2 WHERE id = $1 AND status = 'delivering'`,
      [o.id, String(e.message).slice(0, 300)]);
    return;
  }
  try {
    await completeDelivery(o.id, result.providerRef);
  } catch (e) {
    // The bundle WAS sent but we could not record it. Never retry automatically or it would be sent twice.
    console.error('Delivered but not recorded for', o.ref, '-', e.message);
    await query(`UPDATE orders SET status = 'needs_review', failure_reason = 'delivered_but_not_recorded' WHERE id = $1`, [o.id]).catch(() => {});
  }
}

// Marks the order delivered and credits commission, all in one transaction.
export async function completeDelivery(orderId, providerRef) {
  return tx(async (c) => {
    const { rows: [o] } = await c.query(
      `UPDATE orders SET status = 'delivered', delivered_at = now(), provider_ref = $2, failure_reason = NULL
        WHERE id = $1 AND status = 'delivering' RETURNING *`,
      [orderId, providerRef]
    );
    if (!o || !o.user_id) return; // guest orders earn nothing

    const hold = config.commissionHoldHours;
    const credit = (userId, kind, cents, description) => c.query(
      `INSERT INTO ledger (user_id, order_id, kind, amount_cents, description, available_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(hours => $6::int))
       ON CONFLICT DO NOTHING`,
      [userId, o.id, kind, cents, description, hold]
    );

    const own = Math.round(o.price_cents * config.selfRate);
    if (own > 0) await credit(o.user_id, 'self', own, `Your purchase – ${o.title}`);

    const { rows: [buyer] } = await c.query('SELECT phone, referred_by FROM users WHERE id = $1', [o.user_id]);
    if (buyer?.referred_by) {
      const refCents = Math.round(o.price_cents * config.refRate);
      if (refCents > 0) await credit(buyer.referred_by, 'referral', refCents, `Referral purchase – ${mask(buyer.phone)}`);
    }
  });
}

/* ---------------------------------------------------- background clean-up */

// Callbacks can be lost. Ask Safaricom about payments that have been quiet for a while.
export async function reconcilePayments() {
  if (config.mpesa.mode !== 'mock') {
    const { rows } = await query(
      `SELECT checkout_request_id FROM orders
        WHERE status = 'pending_payment' AND checkout_request_id IS NOT NULL
          AND created_at < now() - interval '60 seconds' AND created_at > now() - interval '15 minutes'
        ORDER BY created_at LIMIT 10`
    );
    for (const o of rows) {
      try {
        const q = await stkQuery(o.checkout_request_id);
        if (q.pending) continue;
        await applyPaymentResult({ checkoutRequestId: o.checkout_request_id, resultCode: q.resultCode, resultDesc: q.resultDesc });
      } catch (e) {
        console.error('Reconcile failed for', o.checkout_request_id, '-', e.message);
      }
    }
  }
  // No answer after 15 minutes: stop waiting. A late success is still accepted by applyPaymentResult.
  await query(`UPDATE orders SET status = 'payment_failed', failure_reason = 'no_confirmation'
                WHERE status = 'pending_payment' AND created_at < now() - interval '15 minutes'`);
}

// An order stuck in "delivering" means the server stopped mid-delivery. We cannot know if the
// bundle was sent, so it goes to a human instead of being retried.
export async function recoverStaleDeliveries() {
  await query(`UPDATE orders SET status = 'delivery_failed', failure_reason = 'stuck_delivering_check_provider'
                WHERE status = 'delivering' AND delivery_started_at < now() - interval '10 minutes'`);
}
