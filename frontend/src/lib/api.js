// Real API client. Endpoints match the contract in README.md.
import { API_URL } from '../config';
import { getToken } from './token';

async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check your internet connection and try again.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Something went wrong. Try again.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const realApi = {
  config: () => request('/config'),
  offers: () => request('/offers'),
  publicStats: () => request('/stats/public'),
  requestOtp: (phone) => request('/auth/request-otp', { method: 'POST', body: { phone } }),
  verifyOtp: (phone, code, ref) => request('/auth/verify-otp', { method: 'POST', body: { phone, code, ref } }),
  register: (phone, password, ref) => request('/auth/register', { method: 'POST', body: { phone, password, ref } }),
  login: (phone, password) => request('/auth/login', { method: 'POST', body: { phone, password } }),
  me: () => request('/me'),
  createOrder: (payload) => request('/orders', { method: 'POST', body: payload }),
  getOrder: (id) => request(`/orders/${id}`),
  orders: () => request('/orders'),
  commissions: () => request('/commissions'),
  referrals: () => request('/referrals'),
  withdraw: (payload) => request('/withdrawals', { method: 'POST', body: payload })
};
