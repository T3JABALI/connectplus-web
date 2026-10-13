// In-browser fake backend so the UI works before the real API exists.
// Login code is always 123456. Data lives in localStorage and resets if you clear site data.
import { getToken } from './token';

const KEY = 'cp_mock_v1';
const CONFIG = { selfRate: 0.02, refRate: 0.05, minWithdraw: 100 };

// Sample catalogue. Replace with your real prices (the real backend will serve /offers).
const OFFERS = [
  { id: 'd1', cat: 'data', net: 'safaricom', size: '1GB', title: '1GB Data', valid: 'for 24 hours', price: 50, color: '#16a34a' },
  { id: 'd2', cat: 'data', net: 'safaricom', size: '250MB', title: '250MB Data', valid: 'for 24 hours', price: 20, color: '#1565e8' },
  { id: 'd3', cat: 'data', net: 'safaricom', size: '400MB', title: '400MB Data', valid: 'for 7 days', price: 49, color: '#7c3aed' },
  { id: 'd4', cat: 'data', net: 'safaricom', size: '1.5GB', title: '1.5GB Data', valid: 'for 3 hours', price: 50, color: '#f97316' },
  { id: 'd5', cat: 'data', net: 'safaricom', size: '1.25GB', title: '1.25GB Data', valid: 'until midnight', price: 55, color: '#e11d74' },
  { id: 's1', cat: 'sms', net: 'safaricom', size: '200', title: '200 SMS', valid: 'for 24 hours', price: 10, color: '#1565e8' },
  { id: 's2', cat: 'sms', net: 'safaricom', size: '1000', title: '1,000 SMS', valid: 'for 7 days', price: 30, color: '#7c3aed' },
  { id: 'm1', cat: 'min', net: 'safaricom', size: '50 min', title: '50 Minutes', valid: 'until midnight', price: 51, color: '#f97316' },
  { id: 'm2', cat: 'min', net: 'safaricom', size: '100 min', title: '100 Minutes', valid: 'for 7 days', price: 99, color: '#e11d74' },
  { id: 'x1', cat: 'special', net: 'safaricom', size: '3GB + SMS', title: 'Weekend Combo', valid: 'Sat to Sun', price: 100, color: '#e11d74' }
];

const daysAgo = (d) => new Date(Date.now() - d * 864e5).toISOString();
const seedOrder = (ref, offerId, days, recipient) => {
  const o = OFFERS.find((x) => x.id === offerId);
  return { id: 'seed_' + ref, ref, offerId, title: o.title, net: o.net, recipientPhone: recipient,
    payerPhone: recipient, price: o.price, status: 'delivered', createdAt: daysAgo(days), seed: true };
};

const seed = () => ({
  user: null,
  account: { balance: 120, totalEarned: 120, orderCount: 12 },
  orders: [
    seedOrder('CP-81F3KD', 'd1', 1, '0712345678'),
    seedOrder('CP-77A2QW', 's2', 3, '0712345678'),
    seedOrder('CP-70ZP4M', 'm1', 6, '0722111222'),
    seedOrder('CP-6QX19T', 'd3', 9, '0712345678')
  ],
  ledger: [
    { id: 'l1', description: 'Referral purchase – 0733 *** 410', amount: 2.5, createdAt: daysAgo(1) },
    { id: 'l2', description: 'Referral purchase – 0701 *** 982', amount: 5, createdAt: daysAgo(4) },
    { id: 'l3', description: 'Referral purchase – 0733 *** 410', amount: 2.5, createdAt: daysAgo(8) }
  ],
  referrals: [
    { id: 'r1', maskedPhone: '0733 *** 410', joinedAt: daysAgo(210), orders: 9, earned: 30 },
    { id: 'r2', maskedPhone: '0701 *** 982', joinedAt: daysAgo(180), orders: 7, earned: 25 },
    { id: 'r3', maskedPhone: '0745 *** 077', joinedAt: daysAgo(170), orders: 5, earned: 20 },
    { id: 'r4', maskedPhone: '0722 *** 305', joinedAt: daysAgo(140), orders: 4, earned: 15 },
    { id: 'r5', maskedPhone: '0799 *** 128', joinedAt: daysAgo(110), orders: 3, earned: 12 },
    { id: 'r6', maskedPhone: '0710 *** 664', joinedAt: daysAgo(80), orders: 2, earned: 10 },
    { id: 'r7', maskedPhone: '0768 *** 201', joinedAt: daysAgo(50), orders: 1, earned: 8 },
    { id: 'r8', maskedPhone: '0740 *** 950', joinedAt: daysAgo(5), orders: 0, earned: 0 }
  ]
});

let db = null;
function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)); } catch { db = null; }
  if (!db) db = seed();
  return db;
}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } };
const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; return e; };
const round2 = (n) => Math.round(n * 100) / 100;
const authed = () => {
  const d = load();
  if (!getToken() || !d.user) throw fail('Log in to continue.', 401);
  return d;
};

export const mockApi = {
  async config() { await delay(80); return CONFIG; },
  async offers() { await delay(150); return OFFERS; },

  async requestOtp() { await delay(); return { ok: true }; },
  async verifyOtp(phone, code) {
    await delay();
    if (code !== '123456') throw fail('That code is not right. Check it and try again.');
    const d = load();
    if (!d.user || d.user.phone !== phone) {
      d.user = { phone, name: 'Jane Wanjiku', since: '2025-03-01T00:00:00.000Z', refCode: '7X9A2' };
    }
    persist();
    return { token: 'mock-token', user: d.user };
  },

  async me() {
    await delay(120);
    const d = authed();
    return { user: d.user, stats: { ...d.account, referralCount: d.referrals.length } };
  },

  async createOrder({ offerId, payerPhone }) {
    await delay(400);
    const offer = OFFERS.find((o) => o.id === offerId);
    if (!offer) throw fail('That offer is no longer available.');
    const d = load();
    const order = {
      id: 'ord_' + Math.random().toString(36).slice(2, 10),
      ref: 'CP-' + Math.random().toString(36).slice(2, 8).toUpperCase(),
      offerId, title: offer.title, net: offer.net, recipientPhone: payerPhone, price: offer.price,
      status: 'pending', createdAt: new Date().toISOString(),
      owner: getToken() && d.user ? d.user.phone : null
    };
    d.orders.unshift(order);
    persist();
    return { id: order.id, ref: order.ref, status: order.status };
  },

  // Simulates the payment + delivery pipeline: pending, then delivered after ~3 seconds.
  async getOrder(id) {
    await delay(120);
    const d = load();
    const o = d.orders.find((x) => x.id === id);
    if (!o) throw fail('Order not found.', 404);
    if (o.status === 'pending' && Date.now() - new Date(o.createdAt).getTime() > 3000) {
      o.status = 'delivered';
      if (o.owner) {
        const com = round2(o.price * CONFIG.selfRate);
        o.commission = com;
        d.account.balance = round2(d.account.balance + com);
        d.account.totalEarned = round2(d.account.totalEarned + com);
        d.account.orderCount += 1;
        d.ledger.unshift({ id: 'l' + Date.now(), description: `Your purchase – ${o.title}`, amount: com, createdAt: new Date().toISOString() });
      }
      persist();
    }
    return { ...o };
  },

  async orders() {
    await delay(150);
    const d = authed();
    return d.orders.filter((o) => o.seed || o.owner === d.user.phone);
  },
  async commissions() { await delay(150); return authed().ledger; },
  async referrals() { await delay(150); return authed().referrals; },

  async withdraw({ amount, phone }) {
    await delay(400);
    const d = authed();
    if (amount < CONFIG.minWithdraw) throw fail(`The minimum withdrawal is KSh ${CONFIG.minWithdraw}.`);
    if (amount > d.account.balance) throw fail('You do not have enough commission for that amount.');
    d.account.balance = round2(d.account.balance - amount);
    d.ledger.unshift({ id: 'w' + Date.now(), description: `Withdrawal to ${phone} (pending approval)`, amount: -amount, createdAt: new Date().toISOString() });
    persist();
    return { ok: true };
  }
};
