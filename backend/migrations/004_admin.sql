-- Admin dashboard: who is an admin, a record of everything admins do, and indexes for fast searching.
ALTER TABLE users ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

CREATE TABLE admin_audit (
  id            bigserial PRIMARY KEY,
  admin_user_id uuid REFERENCES users(id),     -- null when the action used the API key
  via           text NOT NULL,                 -- 'dashboard' or 'api-key'
  action        text NOT NULL,
  target_type   text,
  target_id     text,
  details       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX admin_audit_created_idx ON admin_audit (created_at DESC);
CREATE INDEX orders_created_idx ON orders (created_at DESC);
CREATE INDEX ledger_created_idx ON ledger (created_at DESC);
