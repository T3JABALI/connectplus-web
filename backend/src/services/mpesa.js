import { config } from '../config.js';

const BASE = { sandbox: 'https://sandbox.safaricom.co.ke', production: 'https://api.safaricom.co.ke' };
const base = () => BASE[config.mpesa.mode];

let tokenCache = { token: null, expiresAt: 0 };

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  const { consumerKey, consumerSecret } = config.mpesa;
  const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64') },
    signal: AbortSignal.timeout(15000)
  });
  if (!res.ok) throw new Error(`Daraja auth failed with HTTP ${res.status}`);
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000 };
  return tokenCache.token;
}

// Daraja wants YYYYMMDDHHmmss. Nairobi time is UTC+3.
const timestamp = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);
const password = (ts) => Buffer.from(`${config.mpesa.shortcode}${config.mpesa.passkey}${ts}`).toString('base64');

async function post(path, body) {
  const token = await getToken();
  const res = await fetch(base() + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// Sends the payment prompt to the customer's phone. phone is 2547XXXXXXXX.
export async function stkPush({ phone, amountKes, reference, description }) {
  if (config.mpesa.mode === 'mock') {
    const id = Math.random().toString(36).slice(2, 12);
    return { merchantRequestId: 'mock-m-' + id, checkoutRequestId: 'mock-c-' + id };
  }
  const m = config.mpesa;
  const ts = timestamp();
  console.log('STK settings:', JSON.stringify({ mode: m.mode, shortcode: m.shortcode, partyB: m.partyB, type: m.transactionType }));
  const { ok, data } = await post('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: m.shortcode,
    Password: password(ts),
    Timestamp: ts,
    TransactionType: m.transactionType,
    Amount: Math.round(amountKes),
    PartyA: phone,
    PartyB: m.partyB,
    PhoneNumber: phone,
    CallBackURL: `${config.publicUrl}/mpesa/callback/${m.callbackSecret}`,
    AccountReference: String(reference).slice(0, 12),
    TransactionDesc: String(description).slice(0, 13)
  });
  if (!ok || String(data.ResponseCode) !== '0') {
    throw new Error(data.errorMessage || data.ResponseDescription || `Daraja STK push failed (HTTP ${ok ? 200 : 'error'})`);
  }
  return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID };
}

// Asks Safaricom what happened to a payment. { pending: true } means "no final answer yet".
export async function stkQuery(checkoutRequestId) {
  const m = config.mpesa;
  const ts = timestamp();
  const { ok, data } = await post('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: m.shortcode,
    Password: password(ts),
    Timestamp: ts,
    CheckoutRequestID: checkoutRequestId
  });
  // While a payment is still being processed Daraja answers with an error, not a result.
  if (!ok || data.ResultCode === undefined) return { pending: true };
  return { pending: false, resultCode: Number(data.ResultCode), resultDesc: data.ResultDesc };
}