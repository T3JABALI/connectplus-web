import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { hmac, randomOtp, randomString, safeEqual } from '../lib/crypto.js';
import { toLocal } from '../lib/phone.js';
import { sendSms } from './sms.js';

export async function requestOtp(phone) {
  console.log('request-otp: received');
export const shapeUser = (u) => ({
  phone: toLocal(u.phone),
  name: u.name,
  since: u.created_at.toISOString(),
  refCode: u.ref_code
});

const codeHash = (phone, code) => hmac(config.jwtSecret, `${phone}:${code}`);

export async function requestOtp(phone) {
  const { otp } = config;
  const { rows: [recent] } = await query(
    `SELECT COUNT(*) AS n FROM otp_codes WHERE phone = $1 AND created_at > now() - make_interval(mins => $2::int)`,
    [phone, otp.windowMinutes]
  );
  if (recent.n >= otp.maxPerWindow) {
    throw new HttpError(429, 'Too many codes requested. Wait a few minutes and try again.');
  }
  const code = otp.devFixedCode || randomOtp();
  await query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at) VALUES ($1, $2, now() + make_interval(mins => $3::int))`,
    [phone, codeHash(phone, code), otp.ttlMinutes]
  );
    console.log('request-otp: code saved, sending SMS via', config.sms.provider);
  
  try {
    await sendSms(phone, `Your ConnectPlus code is ${code}. It expires in ${otp.ttlMinutes} minutes. Do not share it.`);
  } catch (e) {
    console.error('Sending login code failed:', e.message);
    throw new HttpError(502, 'We could not send the code. Try again in a moment.');
  }
}

export async function verifyOtp(phone, code, refCode) {
  const { otp } = config;
  const { rows: [row] } = await query(
    `SELECT * FROM otp_codes WHERE phone = $1 AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (!row || row.expires_at < new Date()) throw new HttpError(400, 'That code has expired. Request a new one.');
  if (row.attempts >= otp.maxAttempts) throw new HttpError(429, 'Too many wrong attempts. Request a new code.');

  if (!safeEqual(row.code_hash, codeHash(phone, code))) {
    await query('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    throw new HttpError(400, 'That code is not right. Check it and try again.');
  }
  const used = await query('UPDATE otp_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL', [row.id]);
  if (!used.rowCount) throw new HttpError(400, 'That code has expired. Request a new one.');

  let user = (await query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
  if (!user) {
    // First login creates the account. The referrer is only recorded here, once, at signup.
    let referrerId = null;
    if (refCode) {
      const r = (await query('SELECT id FROM users WHERE ref_code = $1', [String(refCode).toUpperCase()])).rows[0];
      referrerId = r ? r.id : null;
    }
    for (let i = 0; i < 5 && !user; i++) {
      try {
        user = (await query(
          'INSERT INTO users (phone, ref_code, referred_by) VALUES ($1, $2, $3) RETURNING *',
          [phone, randomString(6), referrerId]
        )).rows[0];
      } catch (e) {
        if (e.code !== '23505') throw e;
        // Either the ref code collided (retry) or the account was created a moment ago (reuse it).
        user = (await query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
      }
    }
    if (!user) throw new HttpError(500, 'Something went wrong. Try again.');
  }

  const token = jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: '30d' });
  return { token, user };
}
