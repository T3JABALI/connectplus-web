// Calls the /admin endpoints. Uses the normal login token; the server checks the account is an admin.
import { API_URL } from '../config';
import { getToken } from './token';
const qs = (o) =>
  new URLSearchParams(
    Object.entries(o).filter(([, v]) => v !== '' && v != null).map(([k, v]) => [k, String(v)])
  ).toString();

function authHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function send(path, options) {
  try {
    return await fetch(API_URL + path, options);
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection and try again.');
  }
}

async function request(path, { method = 'GET', body } = {}) {
  const res = await send(path, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

async function downloadOrdersCsv(params) {
  const res = await send('/admin/export/orders.csv?' + qs(params), { headers: authHeaders() });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Could not export the orders.');
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `connectplus-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const adminApi = {
  me: () => request('/admin/me'),
  stats: () => request('/admin/stats'),
  orders: (p) => request('/admin/orders?' + qs(p)),
  ledger: (p) => request('/admin/ledger?' + qs(p)),
  acceptOrder: (id) => request(`/admin/orders/${id}/accept`, { method: 'POST' }),
  withdrawals: (status) => request('/admin/withdrawals?' + qs({ status })),
  payWithdrawal: (id, mpesaRef) => request(`/admin/withdrawals/${id}/approve`, { method: 'POST', body: mpesaRef ? { mpesaRef } : {} }),
  declineWithdrawal: (id, note) => request(`/admin/withdrawals/${id}/reject`, { method: 'POST', body: note ? { note } : {} }),
  offers: () => request('/admin/offers'),
  createOffer: (body) => request('/admin/offers', { method: 'POST', body }),
  updateOffer: (id, body) => request(`/admin/offers/${id}`, { method: 'PATCH', body }),
  deleteOffer: (id) => request(`/admin/offers/${id}`, { method: 'DELETE' }),
  audit: () => request('/admin/audit'),
  downloadOrdersCsv
};
