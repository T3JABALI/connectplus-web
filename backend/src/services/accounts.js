import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { hmac, randomOtp, randomString, safeEqual } from '../lib/crypto.js';
import { hashPassword, verifyPassword } from '../lib/password.js';
import { toLocal } from '../lib/phone.js';
import { sendSms } from './sms.js';

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const WRONG_LOGIN = 'Wrong phone number or password.';

export const shapeUser = (u) => ({
  phone: toLocal(u.phone),
  name: u.name,
  since: u.created_at.toISOString(),
  refCode: u.ref_code
});

export const issueToken = (user) => jwt.sign({}, config.jwtSecret, { subject: user.id, expiresIn: '30d' });

const codeHash = (phone, code) => hmac(config.jwtSecret, `${phone}:${code}`);

// Creates an account. Returns { user, created: false } if the phone is already registered.
// The referrer is recorded here, once, at signup.
async function createUser(phone, refCode, passwordHash) {
  let referrerId = null;
  if (refCode) {
    const r = (await query('SELECT id FROM users WHERE ref_code = $1', [String(refCode).toUpperCase()])).rows[0];
    referrerId = r ? r.id : null;
  }
  for (let i = 0; i < 5; i++) {
    try {
      const { rows: [user] } = await query(
        'INSERT INTO users (phone, ref_code, referred_by, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
        [phone, randomString(6), referrerId, passwordHash]
      );
      return { user, created: true };
    } catch (e) {
      if (e.code !== '23505') throw e;
      // Either the phone is taken, or the random ref code collided (retry with a new one).
      const existing = (await query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
      if (existing) return { user: existing, created: false };
    }
  }
  throw new HttpError(500, 'Something went wrong. Try again.');
}

/* ---------------------------------------------------------- password login */

export async function register(phone, password, refCode) {
  const taken = new HttpError(409, 'This number is already registered. Log in instead.');
  const existing = (await query('SELECT id FROM users WHERE phone = $1', [phone])).rows[0];
  if (existing) throw taken;

  const { user, created } = await createUser(phone, refCode, await hashPassword(password));
  if (!created) throw taken;
  return { token: issueToken(user), user };
}

let dummyHash;
// Wrong-number and wrong-password take about the same time, so timing does not reveal which numbers exist.
async function burnTime(password) {
  dummyHash ??= await hashPassword('not-a-real-password');
  await verifyPassword(password, dummyHash);
}

export async function login(phone, password) {
  const user = (await query('SELECT * FROM users WHERE phone = $1', [phone])).rows[0];
  if (!user || !user.password_hash) {
    await burnTime(password);
    throw new HttpError(401, WRONG_LOGIN);
  }

  if (user.locked_until && user.locked_until > new Date()) {
    const mins = Math.ceil((user.locked_until.getTime() - Date.now()) / 60000);
    throw new HttpError(429, `Too many wrong attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`);
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    // After 5 wrong passwords the account is locked for 15 minutes, which stops password guessing.
    await query(
      `UPDATE users SET
         locked_until  = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3::int) ELSE locked_until END,
         failed_logins = CASE WHEN failed_logins + 1 >= $2 THEN 0 ELSE failed_logins + 1 END
       WHERE id = $1`,
      [user.id, MAX_FAILED_LOGINS, LOCK_MINUTES]
    );
    throw new HttpError(401, WRONG_LOGIN);
  }

  if (user.failed_logins > 0 || user.locked_until) {
    await query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [user.id]);
  }
  return { token: issueToken(user), user };
}

// Admin only: set a new password for a customer who forgot theirs (there is no SMS reset).
export async function adminSetPassword(phone, newPassword) {
  const hash = await hashPassword(newPassword);
  const r = await query(
    'UPDATE users SET password_hash = $2, failed_logins = 0, locked_until = NULL WHERE phone = $1',
    [phone, hash]
  );
  if (!r.rowCount) throw new HttpError(404, 'No account with that phone number.');
}

/* ------------------------------------------- SMS code login (kept, disabled by default) */

export async function requestOtp(phone) {
  console.log('request-otp: received');
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
  if (!user) user = (await createUser(phone, refCode, null)).user;
  return { token: issueToken(user), user };
}
