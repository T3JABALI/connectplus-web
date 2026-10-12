-- Password login. Existing accounts keep working only after an admin sets a password for them.
ALTER TABLE users
  ADD COLUMN password_hash  text,
  ADD COLUMN failed_logins  integer NOT NULL DEFAULT 0,
  ADD COLUMN locked_until   timestamptz;
