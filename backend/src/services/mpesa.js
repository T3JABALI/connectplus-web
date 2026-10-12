import { config } from '../config.js';

const BASE = {
  sandbox: 'https://sandbox.safaricom.co.ke',
  production: 'https://api.safaricom.co.ke'
};

const isMock = () => config.mpesa.mode === 'mock';

const base = () => {
  const url = BASE[config.mpesa.mode];
  if (!url) throw new Error(`Unsupported M-Pesa mode: ${config.mpesa.mode}`);
  return url;
};

let tokenCache = { token: null, expiresAt: 0 };
let tokenPromise = null; // shares one in-flight token request

async function getToken() {
  if (tokenCache.token && Date.now() < tokenCache.expiresAt) return tokenCache.token;
  if (tokenPromise) return tokenPromise;

  tokenPromise = (async () => {
    try {
      const { consumerKey, consumerSecret } = config.mpesa;
      const res = await fetch(`${base()}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
        },
        signal: AbortSignal.timeout(15000)
      });
      if (!res.ok) throw new Error(`Daraja auth failed with HTTP ${res.status}`);
      const data = await res.json();
      tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000
      };
      return tokenCache.token;
    } finally {
      tokenPromise = null;
    }
  })();

  return tokenPromise;
}

// Daraja wants YYYYMMDDHHmmss in Nairobi time (UTC+3).
const timestamp = () =>
  new Date(Date.now() + 3 * 3600 * 1000).toISOString().replace(/[-:T]/g, '').slice(0, 14);

const password = (ts) =>
  Buffer.from(`${config.mpesa.shortcode}${config.mpesa.passkey}${ts}`).toString('base64');

async function post(path, body, canRetry = true) {
  const token = await getToken();
  const res = await fetch(base() + path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000)
  });

  // Token rejected early: drop it and retry once with a fresh one.
  if (res.status === 401 && canRetry) {
    tokenCache = { token: null, expiresAt: 0 };
    return post(path, body, false);
  }

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// Sends the payment prompt to the customer's phone. phone is 2547XXXXXXXX / 2541XXXXXXXX.
export async function stkPush({ phone, amountKes, reference, description }) {
  if (isMock()) {
    const id = Math.random().toString(36).slice(2, 12);
    return { merchantRequestId: 'mock-m-' + id, checkoutRequestId: 'mock-c-' + id };
  }

  if (!/^254[17]\d{8}$/.test(String(phone))) throw new Error('Invalid phone number format');
  const amount = Math.round(Number(amountKes));
  if (!Number.isFinite(amount) || amount < 1) throw new Error('Invalid amount');

  const m = config.mpesa;
  const ts = timestamp();

  const { ok, status, data } = await post('/mpesa/stkpush/v1/processrequest', {
    BusinessShortCode: m.shortcode,
    Password: password(ts),
    Timestamp: ts,
    TransactionType: m.transactionType,
    Amount: amount,
    PartyA: phone,
    PartyB: m.partyB,
    PhoneNumber: phone,
    CallBackURL: `${config.publicUrl}/mpesa/callback/${m.callbackSecret}`,
    AccountReference: String(reference).slice(0, 12),
    TransactionDesc: String(description).slice(0, 13)
  });

  if (!ok || String(data.ResponseCode) !== '0') {
    // Log the real reason (never the passkey/secret) so failures can be diagnosed.
    console.error('STK push rejected:', JSON.stringify({
      status,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
      responseCode: data.ResponseCode,
      responseDescription: data.ResponseDescription
    }));
    throw new Error(
      data.errorMessage || data.ResponseDescription || `Daraja STK push failed (HTTP ${status})`
    );
  }

  return { merchantRequestId: data.MerchantRequestID, checkoutRequestId: data.CheckoutRequestID };
}

// Asks Safaricom what happened to a payment.
// { pending: true } = no final answer yet. Real errors throw: the caller should
// log them and stop polling after a time limit instead of looping forever.
export async function stkQuery(checkoutRequestId) {
  if (isMock()) {
    return { pending: false, resultCode: 0, resultDesc: 'Mock payment successful' };
  }

  const m = config.mpesa;
  const ts = timestamp();
  const { status, data } = await post('/mpesa/stkpushquery/v1/query', {
    BusinessShortCode: m.shortcode,
    Password: password(ts),
    Timestamp: ts,
    CheckoutRequestID: checkoutRequestId
  });

  if (data.ResultCode !== undefined) {
    return { pending: false, resultCode: Number(data.ResultCode), resultDesc: data.ResultDesc };
  }

  // Daraja's "still being processed" answer.
  if (data.errorCode === '500.001.1001') return { pending: true };

  console.error('STK query error:', JSON.stringify({
    status, errorCode: data.errorCode, errorMessage: data.errorMessage
  }));
  throw new Error(data.errorMessage || `Daraja STK query failed (HTTP ${status})`);
}