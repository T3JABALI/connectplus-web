import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { config } from './config.js';
import { HttpError } from './errors.js';
import adminRoutes from './routes/admin.js';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import mpesaRoutes from './routes/mpesa.js';
import orderRoutes from './routes/orders.js';
import publicRoutes from './routes/public.js';
import withdrawalRoutes from './routes/withdrawals.js';

const app = express();
app.set('trust proxy', 1); // Render sits behind one proxy
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({
  origin(origin, cb) {
    // No Origin header means a server-to-server call (like M-Pesa), which CORS does not apply to.
    cb(null, !origin || config.corsOrigins.includes(origin));
  },
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600
}));
app.use(express.json({ limit: '50kb' }));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down and try again.' }
}));

app.use('/', publicRoutes);
app.use('/auth', authRoutes);
app.use('/', meRoutes);
app.use('/orders', orderRoutes);
app.use('/withdrawals', withdrawalRoutes);
app.use('/mpesa', mpesaRoutes);
app.use('/admin', adminRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid request.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large.' });
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong. Try again.' });
});

export default app;
