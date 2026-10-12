import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { z } from './validate.js';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

// Stored as scrypt$<salt>$<hash>. A fresh random salt per password, never the password itself.
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

export const passwordSchema = z
  .string({ required_error: 'Enter a password.', invalid_type_error: 'Enter a password.' })
  .min(8, 'Use at least 8 characters for your password.')
  .max(128, 'Your password is too long. Use 128 characters or fewer.');
