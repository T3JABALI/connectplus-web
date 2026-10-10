import jwt from 'jsonwebtoken';
import { config } from '../config.js';
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

export function requireAdmin(req, res, next) {
  if (!config.adminKey) throw new HttpError(403, 'Admin access is not enabled.');
  const key = req.headers['x-admin-key'];
  if (!key || !safeEqual(key, config.adminKey)) throw new HttpError(401, 'Invalid admin key.');
  next();
}
