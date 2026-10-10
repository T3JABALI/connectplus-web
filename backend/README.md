# ConnectPlus API

Node.js + Express + PostgreSQL backend for the ConnectPlus web app. It implements the API contract
in the frontend README, so the React app works against it by setting `VITE_API_URL`.

## What it does

- Phone login with SMS codes (no passwords). First login creates the account and records who referred it.
- Public offers list and a guest-friendly checkout.
- M-Pesa STK Push payments, confirmed by Safaricom's callback and double-checked with a status query.
- Automatic bundle delivery through a provider adapter, only after payment is confirmed.
- Commission ledger: your own purchases and your referrals' purchases, with a hold period and a withdrawal queue.
- Admin endpoints to approve or decline withdrawals and to fix orders that were paid but not delivered.

## Run locally

You need Node 20+ and a PostgreSQL database.

```bash
createdb connectplus            # or use any Postgres you have
cp .env.example .env            # then edit DATABASE_URL and JWT_SECRET
npm install
npm run dev                     # migrations run automatically on start
```

Defaults in `.env.example` are safe for local work: payments and delivery are simulated
(`MPESA_MODE=mock`, `DELIVERY_PROVIDER=mock`), login codes print in the terminal, and
`DEV_FIXED_OTP=123456` makes every code 123456. Point the frontend at it with
`VITE_API_URL=http://localhost:3000` in the frontend's `.env.local`.

The server refuses to start in production if any of those development shortcuts are still on.

## How a purchase flows

1. `POST /orders` saves the order as `pending_payment` (price comes from the database, never the browser) and sends the M-Pesa prompt.
2. The customer enters their PIN. Safaricom calls `POST /mpesa/callback/<secret>`.
3. The server asks Safaricom to confirm that payment, then marks the order `paid`.
4. The worker delivers the bundle through your provider and marks it `delivered`.
5. In the same database transaction as step 4, commission rows are written to the ledger.
6. The frontend polls `GET /orders/:id` and shows the result.

Safety properties worth knowing:
- Callbacks can arrive twice or not at all. Processing is idempotent, and a reconciler asks Safaricom about quiet payments every 10 seconds.
- Unique database indexes make double-crediting commission impossible.
- If the server dies mid-delivery, the order goes to `delivery_failed` for a human to check. It is never retried automatically, because the bundle might already have been sent.
- A paid order is never moved back to failed by a late failure message.

## Order statuses

| Internal | Shown to the customer as |
|---|---|
| pending_payment | pending |
| paid, delivering, delivery_failed, needs_review | paid (processing) |
| delivered | delivered |
| payment_failed | failed |
| cancelled | cancelled |

Customers are only told "you were not charged" for `payment_failed`.

## Before you can take real payments

### 1. M-Pesa (Safaricom Daraja)
1. Create an account at the Daraja developer portal, create an app, and note the consumer key and secret.
2. For testing, set `MPESA_MODE=sandbox` and use the sandbox shortcode and passkey the portal shows. Safaricom must be able to reach your callback, so deploy first (or use a tunnel like ngrok) and set `PUBLIC_URL` to the public https address.
3. Set `MPESA_CALLBACK_SECRET` to a long random string. It becomes part of the callback URL.
4. For live payments you need a Paybill or Till and to complete Safaricom's go-live process in the portal. Then set `MPESA_MODE=production` with your live credentials. For a Till set `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline` and `MPESA_PARTY_B` to the till number.

### 2. Bundle delivery provider
`src/services/delivery.js` has a mock and an `http` template. **The template is a guess at a typical reseller API.** Open your provider's documentation and change the request body and the success check to match. Then:
- Fill in `provider_code` on each row of the `offers` table with the provider's product code.
- Set `DELIVERY_PROVIDER=http`, `DELIVERY_API_URL`, `DELIVERY_API_KEY`.
- Check that your provider ignores a repeated request with the same reference. The order ref is sent for exactly this.

### 3. SMS for login codes
Set `SMS_PROVIDER=africastalking` with `AT_USERNAME`, `AT_API_KEY` and optionally `AT_SENDER_ID`. Use `AT_SANDBOX=true` while testing. Check Africa's Talking's current docs, since the request in `src/services/sms.js` is written from memory of their API. Any other provider can be added in that one file.

### 4. Offers and prices
`migrations/002_seed_offers.sql` has the placeholder Safaricom offers. Edit the prices before the first deploy, or update the `offers` table afterwards.

## Deploy to Render

1. Create a **PostgreSQL** database on Render. Copy its **Internal Database URL**.
2. Create a **Web Service** from your GitHub repo in the same region. Build command `npm install`, start command `npm start`, health check path `/health`.
3. Use a paid instance. Render's free web services sleep when idle, which would make you miss M-Pesa callbacks and stop the background worker. Free databases have also been time-limited, so check Render's current terms before relying on one.
4. Add environment variables (see `.env.example`):
   - `NODE_ENV=production`
   - `DATABASE_URL` = the internal URL (leave `DATABASE_SSL` unset; set it to `true` only if you use the external URL)
   - `JWT_SECRET`, `ADMIN_API_KEY`, `MPESA_CALLBACK_SECRET` = long random strings
   - `CORS_ORIGINS` = your Vercel URL, e.g. `https://connectplus.vercel.app`
   - `PUBLIC_URL` = this service's own https URL
   - all M-Pesa, SMS and delivery variables from the sections above
   - `COMMISSION_HOLD_HOURS` (24 recommended in production)
5. Put the service URL in Vercel as `VITE_API_URL` and redeploy the frontend.

For a staging copy, use `NODE_ENV=staging` so the production safety checks do not block mock or sandbox settings.

## Admin

Send your `ADMIN_API_KEY` in an `x-admin-key` header.

```bash
H="x-admin-key: YOUR_KEY"; API=https://your-api.onrender.com

# Withdrawals waiting for you. Send the money from the M-Pesa app, then mark it paid.
curl -H "$H" "$API/admin/withdrawals?status=pending"
curl -X POST -H "$H" -H "Content-Type: application/json" -d '{"mpesaRef":"QWE123ABCD"}' "$API/admin/withdrawals/<id>/approve"
curl -X POST -H "$H" -H "Content-Type: application/json" -d '{"note":"Wrong number"}'   "$API/admin/withdrawals/<id>/reject"

# Orders that were paid but not delivered
curl -H "$H" "$API/admin/orders/attention"
curl -X POST -H "$H" "$API/admin/orders/<id>/retry"            # only after checking the provider did NOT send it
curl -X POST -H "$H" "$API/admin/orders/<id>/mark-delivered"   # after you delivered it yourself; credits commission
```

Check `/admin/orders/attention` daily at first. Every row there is a customer who paid and is waiting.

## Not built yet

- Automatic M-Pesa payouts (B2C). Withdrawals are approved by hand, which is the safer way to start.
- Refunds for orders that cannot be delivered. Do these from the M-Pesa portal for now.
- An admin web page. The endpoints above are the foundation for one.
- Automated tests.

## Layout

```
migrations/        SQL schema and seed offers (run automatically on start)
src/server.js      boot: migrate, listen, start worker
src/app.js         Express setup, CORS, rate limits, error handling
src/config.js      environment variables and startup safety checks
src/routes/        public, auth, me (profile, commissions, referrals), orders, withdrawals, mpesa, admin
src/services/      accounts (login), orders (payment + delivery + commission), ledger, mpesa, sms, delivery
src/worker.js      reconciles payments, recovers stuck deliveries, delivers paid orders
```
