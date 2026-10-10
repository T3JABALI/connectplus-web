import { Router } from 'express';
import { config } from '../config.js';
import { safeEqual } from '../lib/crypto.js';
import { handleMpesaCallback } from '../services/orders.js';

const router = Router();

// Safaricom does not sign callbacks, so the URL itself carries a secret. A wrong secret gets a 404.
router.post('/callback/:secret', (req, res) => {
  if (!config.mpesa.callbackSecret || !safeEqual(req.params.secret, config.mpesa.callbackSecret)) {
    return res.status(404).end();
  }
  // Answer straight away so Safaricom does not retry, then process.
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  handleMpesaCallback(req.body).catch((e) => console.error('M-Pesa callback error:', e.message));
});

export default router;
