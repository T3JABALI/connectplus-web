# ConnectPlus web (frontend)

React + Vite single-page app for selling data, SMS and minutes, with commission and referrals.
Backend (Node.js on Render, PostgreSQL) comes next. Until then the app runs on a built-in mock API.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

With no `VITE_API_URL` set, the app uses the mock API in `src/lib/mockApi.js`:
- Log in with any valid Kenyan number and the code `123456`.
- A purchase "delivers" about 3 seconds after you start it.
- Data is kept in your browser's localStorage.

## Project layout

```
src/
  config.js            API URL, mock switch, support phone
  lib/
    api.js             real API client (fetch)
    mockApi.js         fake backend used when no API URL is set
    index.js           exports `api` (real or mock)
    format.js          money, phone and date helpers
    hooks.js           useOffers, useConfig
  context/
    AuthContext.jsx    login session (token + /me)
    AppContext.jsx     purchase modal, withdraw modal, toast
  components/          Layout, Hero, Offers, Cards, modals, icons
  pages/               Home, Buy, Dashboard, Referral, Help, Login, RefCapture, NotFound
```

## Deploy the frontend to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: New Project, import the repo. Framework preset: Vite (build `npm run build`, output `dist`).
3. Add environment variable `VITE_API_URL` = your Render backend URL (no trailing slash).
4. Deploy. `vercel.json` already rewrites all routes to `index.html` so links like `/ref/7X9A2` work.

Your backend must allow your Vercel domain in CORS and accept the `Authorization` header.

## API contract the backend must follow

All bodies are JSON. Errors return a non-2xx status and `{ "error": "Message shown to the user" }`.
Authenticated routes expect `Authorization: Bearer <token>`.
Money is in KSh. Store it as integer cents in PostgreSQL and convert at the API edge.

| Method | Path | Auth | Body / notes | Returns |
|---|---|---|---|---|
| GET | `/config` | no | | `{ selfRate, refRate, minWithdraw }` |
| GET | `/offers` | no | | `[{ id, cat, net, size, title, valid, price, color }]`. `cat`: data, sms, min, special. `net`: safaricom, airtel, telkom |
| POST | `/auth/request-otp` | no | `{ phone }` (07XXXXXXXX) | `{ ok: true }`. Rate-limit this. |
| POST | `/auth/verify-otp` | no | `{ phone, code, ref? }`. Creates the account on first login and records the referrer from `ref` | `{ token, user }` |
| GET | `/me` | yes | | `{ user: { phone, name, since, refCode }, stats: { balance, totalEarned, orderCount, referralCount } }` |
| POST | `/orders` | optional | `{ offerId, recipientPhone, payerPhone }`. Starts M-Pesa STK Push. Attach the order to the user if a token is sent | `{ id, ref, status: "pending" }` |
| GET | `/orders/:id` | no | `id` must be an unguessable UUID. The frontend polls this every 2s for up to 90s | `{ id, ref, title, net, recipientPhone, price, status, createdAt, commission? }`. `status`: pending, paid, delivered, failed, cancelled |
| GET | `/orders` | yes | the user's orders, newest first | array of the order shape above |
| GET | `/commissions` | yes | ledger, newest first | `[{ id, description, amount, createdAt }]`. Debits are negative |
| GET | `/referrals` | yes | | `[{ id, maskedPhone, joinedAt, orders, earned }]` |
| POST | `/withdrawals` | yes | `{ amount, phone }`. Validate minimum and balance again on the server | `{ ok: true }` |

Backend rules the frontend assumes (do not trust the browser for any of these):
- Deliver a bundle only after the M-Pesa callback confirms payment.
- Credit commission once per delivered order, as a ledger row, never by editing a balance directly.
- Recompute balance and rates on the server. The numbers the frontend shows are display only.

## Switching from mock to real

1. Deploy the backend to Render.
2. Set `VITE_API_URL` locally in `.env.local` to test, and in Vercel for production.
3. Remove nothing else. The mock stays in the code but is not used when `VITE_API_URL` is set.
