import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError } from '../errors.js';
import { passwordSchema } from '../lib/password.js';
import { parse, phoneSchema, z } from '../lib/validate.js';
import { login, register, requestOtp, shapeUser, verifyOtp } from '../services/accounts.js';

const router = Router();

// Per-IP limit is generous because many Kenyan mobile users share one IP. The real protection
// against password guessing is the per-account lockout inside login().
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' }
});

router.post('/register', authLimiter, async (req, res) => {
  const { phone, password, ref } = parse(
    z.object({ phone: phoneSchema, password: passwordSchema, ref: z.string().max(20).optional() }),
    req.body
  );
  const { token, user } = await register(phone, password, ref);
  res.status(201).json({ token, user: shapeUser(user) });
});

router.post('/login', authLimiter, async (req, res) => {
  const { phone, password } = parse(
    z.object({ phone: phoneSchema, password: z.string({ required_error: 'Enter your password.' }).min(1, 'Enter your password.').max(128) }),
    req.body
  );
  const { token, user } = await login(phone, password);
  res.json({ token, user: shapeUser(user) });
});

/* ---- SMS code login: off unless OTP_LOGIN_ENABLED=true. It costs money per text, so it stays closed. ---- */

function otpOnly(req, res, next) {
  if (process.env.OTP_LOGIN_ENABLED !== 'true') throw new HttpError(404, 'Not found.');
  next();
}

router.post('/request-otp', otpOnly, authLimiter, async (req, res) => {
  const { phone } = parse(z.object({ phone: phoneSchema }), req.body);
  await requestOtp(phone);
  res.json({ ok: true });
});

router.post('/verify-otp', otpOnly, authLimiter, async (req, res) => {
  const { phone, code, ref } = parse(
    z.object({
      phone: phoneSchema,
      code: z.string({ required_error: 'Enter the 6-digit code we sent you.' }).regex(/^\d{6}$/, 'Enter the 6-digit code we sent you.'),
      ref: z.string().max(20).optional()
    }),
    req.body
  );
  const { token, user } = await verifyOtp(phone, code, ref);
  res.json({ token, user: shapeUser(user) });
});

export default router;
