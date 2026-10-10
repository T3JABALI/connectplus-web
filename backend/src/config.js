import 'dotenv/config';

const env = process.env;
const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const isProd = env.NODE_ENV === 'production';
const origins = (env.CORS_ORIGINS || '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean);

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  port: num(env.PORT, 3000),
  databaseUrl: env.DATABASE_URL,
  databaseSsl: env.DATABASE_SSL === 'true',
  jwtSecret: env.JWT_SECRET,
  adminKey: env.ADMIN_API_KEY,
  corsOrigins: origins.length || isProd ? origins : ['http://localhost:5173'],
  publicUrl: (env.PUBLIC_URL || '').replace(/\/$/, ''),

  selfRate: num(env.SELF_COMMISSION_RATE, 0.02),
  refRate: num(env.REF_COMMISSION_RATE, 0.05),
  minWithdrawKes: num(env.MIN_WITHDRAWAL_KES, 100),
  commissionHoldHours: Math.round(num(env.COMMISSION_HOLD_HOURS, 24)),

  otp: { ttlMinutes: 5, maxAttempts: 5, maxPerWindow: 3, windowMinutes: 10, devFixedCode: env.DEV_FIXED_OTP || '' },
  sms: {
    provider: env.SMS_PROVIDER || 'console',
    atUsername: env.AT_USERNAME,
    atApiKey: env.AT_API_KEY,
    atSenderId: env.AT_SENDER_ID,
    atSandbox: env.AT_SANDBOX === 'true'
  },
  mpesa: {
    mode: env.MPESA_MODE || 'mock',
    consumerKey: env.MPESA_CONSUMER_KEY,
    consumerSecret: env.MPESA_CONSUMER_SECRET,
    shortcode: env.MPESA_SHORTCODE,
    passkey: env.MPESA_PASSKEY,
    transactionType: env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
    partyB: env.MPESA_PARTY_B || env.MPESA_SHORTCODE,
    callbackSecret: env.MPESA_CALLBACK_SECRET,
    verifyCallbacks: env.MPESA_VERIFY_CALLBACKS !== 'false'
  },
  delivery: { provider: env.DELIVERY_PROVIDER || 'mock', apiUrl: env.DELIVERY_API_URL, apiKey: env.DELIVERY_API_KEY },

  autoMigrate: env.AUTO_MIGRATE !== 'false',
  runWorker: env.RUN_WORKER !== 'false'
};

function validateConfig() {
  const errs = [];
  const m = config.mpesa;
  if (!config.databaseUrl) errs.push('DATABASE_URL is required.');
  if (!config.jwtSecret || config.jwtSecret.length < 32) errs.push('JWT_SECRET must be at least 32 characters.');

  if (!['mock', 'sandbox', 'production'].includes(m.mode)) errs.push('MPESA_MODE must be mock, sandbox or production.');
  if (m.mode !== 'mock') {
    const need = { MPESA_CONSUMER_KEY: m.consumerKey, MPESA_CONSUMER_SECRET: m.consumerSecret, MPESA_SHORTCODE: m.shortcode, MPESA_PASSKEY: m.passkey, PUBLIC_URL: config.publicUrl };
    for (const [k, v] of Object.entries(need)) if (!v) errs.push(`${k} is required when MPESA_MODE is ${m.mode}.`);
    if (!m.callbackSecret || m.callbackSecret.length < 20) errs.push('MPESA_CALLBACK_SECRET must be at least 20 characters.');
  }

  if (!['console', 'africastalking'].includes(config.sms.provider)) errs.push('SMS_PROVIDER must be console or africastalking.');
  if (config.sms.provider === 'africastalking' && (!config.sms.atUsername || !config.sms.atApiKey)) errs.push('AT_USERNAME and AT_API_KEY are required for africastalking.');

  if (!['mock', 'http'].includes(config.delivery.provider)) errs.push('DELIVERY_PROVIDER must be mock or http.');
  if (config.delivery.provider === 'http' && (!config.delivery.apiUrl || !config.delivery.apiKey)) errs.push('DELIVERY_API_URL and DELIVERY_API_KEY are required for the http provider.');

  if (isProd) {
    if (!config.adminKey || config.adminKey.length < 24) errs.push('ADMIN_API_KEY must be at least 24 characters in production.');
    if (!config.corsOrigins.length) errs.push('CORS_ORIGINS is required in production.');
    if (m.mode === 'mock') errs.push('MPESA_MODE=mock is not allowed in production.');
    if (config.sms.provider === 'console') errs.push('SMS_PROVIDER=console is not allowed in production (it prints login codes).');
    if (config.delivery.provider === 'mock') errs.push('DELIVERY_PROVIDER=mock is not allowed in production.');
    if (config.otp.devFixedCode) errs.push('DEV_FIXED_OTP must not be set in production.');
  }

  if (errs.length) {
    console.error('Configuration problems:\n- ' + errs.join('\n- '));
    process.exit(1);
  }
}
validateConfig();
