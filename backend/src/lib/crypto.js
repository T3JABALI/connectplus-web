import crypto from 'node:crypto';

export const randomOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
export const hmac = (secret, value) => crypto.createHmac('sha256', secret).update(value).digest('hex');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// No 0/O/1/I so codes are easy to read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const randomString = (n) => Array.from({ length: n }, () => ALPHABET[crypto.randomInt(0, ALPHABET.length)]).join('');
