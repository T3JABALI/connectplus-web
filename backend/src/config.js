import 'dotenv/config';

const env = process.env;

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));
const isProd = env.NODE_ENV === 'production';
const origins = (env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const TRANSACTION_TYPES = ['CustomerBuyGoodsOnline', 'CustomerPayBillOnline'];

// Till (Buy Goods) is the default. For a Till, MPESA_SHORTCODE is the store /
// head-office number and MPESA_PARTY_B is the till number. Only a Paybill may
// fall back to using the shortcode as PartyB.
const mpesaType = env.MPESA_TRANSACTION_TYPE || 'CustomerBuyGoodsOnline';
const mpesaPartyB =
  env.MPESA_PARTY_B || (mpesaType === 'CustomerPayBillOnline' ? env.MPESA_SHORTCODE : undefined);

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

  otp: {
    ttlMinutes: 5,
    maxAttempts: 5,
    maxPerWindow: 3,
    windowMinutes: 10,
    devFixedCode: env.DEV_FIXED_OTP || ''
  },

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
    transactionType: mpesaType,
    partyB: mpesaPartyB,
    callbackSecret: env.MPESA_CALLBACK_SECRET,
    verifyCallbacks: env.MPESA_VERIFY_CALLBACKS !== 'false'
  },

  autoMigrate: env.AUTO_MIGRATE !== 'false',
  runWorker: env.RUN_WORKER !== 'false'
};

function validateConfig() {
  const errs = [];
  const warns = [];
  const m = config.mpesa;

  // --- core ---
  if (!config.databaseUrl) errs.push('DATABASE_URL is required.');
  if (!config.jwtSecret || config.jwtSecret.length < 32) errs.push('JWT_SECRET must be at least 32 characters.');
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) errs.push('PORT must be a valid port number.');

  // --- commission / withdrawal numbers (num() returns NaN on bad input) ---
  for (const [k, v] of Object.entries({ SELF_COMMISSION_RATE: config.selfRate, REF_COMMISSION_RATE: config.refRate })) {
    if (!Number.isFinite(v) || v < 0 || v > 1) errs.push(`${k} must be a number between 0 and 1 (e.g. 0.05 for 5%).`);
  }
  if (!Number.isFinite(config.minWithdrawKes) || config.minWithdrawKes <= 0) errs.push('MIN_WITHDRAWAL_KES must be a positive number.');
  if (!Number.isFinite(config.commissionHoldHours) || config.commissionHoldHours < 0) errs.push('COMMISSION_HOLD_HOURS must be 0 or more.');

  // --- M-Pesa ---
  if (!['mock', 'sandbox', 'production'].includes(m.mode)) errs.push('MPESA_MODE must be mock, sandbox or production.');

  if (m.mode !== 'mock') {
    const need = {
      MPESA_CONSUMER_KEY: m.consumerKey,
      MPESA_CONSUMER_SECRET: m.consumerSecret,
      MPESA_SHORTCODE: m.shortcode,
      MPESA_PASSKEY: m.passkey,
      PUBLIC_URL: config.publicUrl
    };
    for (const [k, v] of Object.entries(need)) if (!v) errs.push(`${k} is required when MPESA_MODE is ${m.mode}.`);

    if (!m.callbackSecret || m.callbackSecret.length < 20) errs.push('MPESA_CALLBACK_SECRET must be at least 20 characters.');

    if (!TRANSACTION_TYPES.includes(m.transactionType)) {
      errs.push(`MPESA_TRANSACTION_TYPE must be one of: ${TRANSACTION_TYPES.join(', ')}.`);
    }
    if (m.shortcode && !/^\d{5,7}$/.test(m.shortcode)) errs.push('MPESA_SHORTCODE must be 5-7 digits.');
    if (m.transactionType === 'CustomerBuyGoodsOnline' && !m.partyB) {
      errs.push('MPESA_PARTY_B (your till number) is required when MPESA_TRANSACTION_TYPE is CustomerBuyGoodsOnline.');
    }
    if (m.partyB && !/^\d{5,7}$/.test(m.partyB)) errs.push('MPESA_PARTY_B must be 5-7 digits.');
    if (m.transactionType === 'CustomerBuyGoodsOnline' && m.partyB && m.partyB === m.shortcode) {
      warns.push('MPESA_PARTY_B equals MPESA_SHORTCODE. For a Till these are normally different (store number vs till number). Check this is intended.');
    }

    if (m.mode === 'production' && config.publicUrl && !config.publicUrl.startsWith('https://')) {
      errs.push('PUBLIC_URL must start with https:// in production (Daraja requires an HTTPS callback).');
    }
  }

  // --- SMS ---
  if (!['console', 'africastalking'].includes(config.sms.provider)) errs.push('SMS_PROVIDER must be console or africastalking.');
  if (config.sms.provider === 'africastalking' && (!config.sms.atUsername || !config.sms.atApiKey)) {
    errs.push('AT_USERNAME and AT_API_KEY are required for africastalking.');
  }

  // --- production-only rules ---
  if (isProd) {
    if (!config.adminKey || config.adminKey.length < 24) errs.push('ADMIN_API_KEY must be at least 24 characters in production.');
    if (!config.corsOrigins.length) errs.push('CORS_ORIGINS is required in production.');
    if (m.mode === 'mock') errs.push('MPESA_MODE=mock is not allowed in production.');
    if (m.mode === 'sandbox') warns.push('MPESA_MODE=sandbox in production: no real money will move.');
    if (config.sms.provider === 'console') errs.push('SMS_PROVIDER=console is not allowed in production (it prints login codes).');
    if (config.sms.atSandbox) warns.push('AT_SANDBOX=true in production: SMS codes will not reach real phones.');
    if (config.otp.devFixedCode) errs.push('DEV_FIXED_OTP must not be set in production.');
    if (!m.verifyCallbacks) warns.push('MPESA_VERIFY_CALLBACKS=false in production: callbacks will not be verified with Safaricom.');
  }

  if (warns.length) console.warn('Configuration warnings:\n- ' + warns.join('\n- '));

  if (errs.length) {
    console.error('Configuration problems:\n- ' + errs.join('\n- '));
    process.exit(1);
  }
}

validateConfig();