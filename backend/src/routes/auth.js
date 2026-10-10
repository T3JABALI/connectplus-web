import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { parse, phoneSchema, z } from '../lib/validate.js';
import { requestOtp, shapeUser, verifyOtp } from '../services/accounts.js';

const router = Router();

// Per-IP limit is generous because many Kenyan mobile users share one IP. The real
// protection is the per-phone limit inside requestOtp().
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' }
});

router.post('/request-otp', otpLimiter, async (req, res) => {
  const { phone } = parse(z.object({ phone: phoneSchema }), req.body);
  await requestOtp(phone);
  res.json({ ok: true });
});

router.post('/verify-otp', otpLimiter, async (req, res) => {
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
