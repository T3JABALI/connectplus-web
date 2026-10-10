-- Money is stored as integer cents (KSh x 100). Phones are stored as 2547XXXXXXXX.

CREATE TABLE users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL UNIQUE,
  name        text,
  ref_code    text NOT NULL UNIQUE,
  referred_by uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_referred_by_idx ON users (referred_by);

CREATE TABLE otp_codes (
  id          bigserial PRIMARY KEY,
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX otp_codes_phone_idx ON otp_codes (phone, created_at DESC);

CREATE TABLE offers (
  id            text PRIMARY KEY,
  cat           text NOT NULL CHECK (cat IN ('data', 'sms', 'min', 'special')),
  net           text NOT NULL DEFAULT 'safaricom',
  size          text NOT NULL,
  title         text NOT NULL,
  valid         text NOT NULL,
  price_cents   integer NOT NULL CHECK (price_cents > 0),
  color         text NOT NULL DEFAULT '#1565e8',
  provider_code text,             -- the product code your bundle provider expects
  active        boolean NOT NULL DEFAULT true,
  sort          integer NOT NULL DEFAULT 0
);

CREATE TABLE orders (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref                 text NOT NULL UNIQUE,
  user_id             uuid REFERENCES users(id),     -- null for guest purchases
  offer_id            text NOT NULL REFERENCES offers(id),
  title               text NOT NULL,                 -- snapshot at purchase time
  net                 text NOT NULL,
  price_cents         integer NOT NULL,
  recipient_phone     text NOT NULL,
  payer_phone         text NOT NULL,
  status              text NOT NULL DEFAULT 'pending_payment' CHECK (status IN (
                        'pending_payment', 'paid', 'delivering', 'delivered',
                        'payment_failed', 'delivery_failed', 'needs_review', 'cancelled')),
  failure_reason      text,
  merchant_request_id text,
  checkout_request_id text UNIQUE,
  mpesa_receipt       text,
  provider_ref        text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  paid_at             timestamptz,
  delivery_started_at timestamptz,
  delivered_at        timestamptz
);
CREATE UNIQUE INDEX orders_receipt_uniq ON orders (mpesa_receipt) WHERE mpesa_receipt IS NOT NULL;
CREATE INDEX orders_user_idx   ON orders (user_id, created_at DESC);
CREATE INDEX orders_status_idx ON orders (status, created_at);
CREATE INDEX orders_payer_idx  ON orders (payer_phone, created_at DESC);

CREATE TABLE withdrawals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id),
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  phone        text NOT NULL,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  mpesa_ref    text,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX withdrawals_status_idx ON withdrawals (status, created_at);

-- Every commission credit and withdrawal debit is a row here. A balance is always a SUM of this table.
CREATE TABLE ledger (
  id            bigserial PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES users(id),
  order_id      uuid REFERENCES orders(id),
  withdrawal_id uuid REFERENCES withdrawals(id),
  kind          text NOT NULL CHECK (kind IN ('self', 'referral', 'withdrawal', 'withdrawal_reversal', 'adjustment')),
  amount_cents  integer NOT NULL CHECK (amount_cents <> 0),
  description   text NOT NULL,
  available_at  timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);
-- These two indexes make double-crediting impossible, even if code runs twice.
CREATE UNIQUE INDEX ledger_order_kind_uniq      ON ledger (order_id, kind)      WHERE kind IN ('self', 'referral');
CREATE UNIQUE INDEX ledger_withdrawal_kind_uniq ON ledger (withdrawal_id, kind) WHERE withdrawal_id IS NOT NULL;
CREATE INDEX ledger_user_idx ON ledger (user_id, created_at DESC);
