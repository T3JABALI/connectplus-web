import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { query } from '../db.js';
import { HttpError } from '../errors.js';
import { safeEqual } from '../lib/crypto.js';

const readToken = (req) => {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
};

export function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Log in to continue.');
  try {
    req.userId = jwt.verify(token, config.jwtSecret).sub;
  } catch {
    throw new HttpError(401, 'Your session has expired. Log in again.');
  }
  next();
}

// For routes guests can use. A bad or expired token is treated as "no login", not an error.
export function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (token) {
    try { req.userId = jwt.verify(token, config.jwtSecret).sub; } catch { /* treat as guest */ }
  }
  next();
}

function keyMatches(req) {
  const key = req.headers['x-admin-key'];
  return !!(key && config.adminKey && safeEqual(key, config.adminKey));
}

// Admin access: either the secret API key (for scripts) or a logged-in account marked as admin.
// Admin status is read from the database on every request, so removing it takes effect at once.
export async function requireAdmin(req, res, next) {
  if (req.headers['x-admin-key']) {
    if (!keyMatches(req)) throw new HttpError(401, 'Invalid admin key.');
    req.admin = { userId: null, phone: null, via: 'api-key' };
    return next();
  }
  const token = readToken(req);
  if (!token) throw new HttpError(401, 'Log in to continue.');
  let sub;
  try {
    sub = jwt.verify(token, config.jwtSecret).sub;
  } catch {
    throw new HttpError(401, 'Your session has expired. Log in again.');
  }
  const { rows: [u] } = await query('SELECT id, phone, is_admin FROM users WHERE id = $1', [sub]);
  if (!u || !u.is_admin) throw new HttpError(403, 'This account does not have admin access.');
  req.admin = { userId: u.id, phone: u.phone, via: 'dashboard' };
  next();
}

// Only the API key, never a dashboard login. Used for granting admin rights.
export function requireAdminKey(req, res, next) {
  if (!config.adminKey) throw new HttpError(403, 'Admin access is not enabled.');
  if (!keyMatches(req)) throw new HttpError(401, 'Invalid admin key.');
  req.admin = { userId: null, phone: null, via: 'api-key' };
  next();
}
