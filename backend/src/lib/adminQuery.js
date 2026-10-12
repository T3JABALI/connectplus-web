// Pure helpers that build the SQL filters and CSV for the admin lists. No database access here.

const ORDER_STATUSES = ['pending_payment', 'paid', 'delivering', 'delivered', 'payment_failed', 'delivery_failed', 'needs_review', 'cancelled'];
const LEDGER_KINDS = ['self', 'referral', 'withdrawal', 'withdrawal_reversal', 'adjustment'];
const NAIROBI = "'Africa/Nairobi'";

const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');

function builder() {
  const parts = [];
  const params = [];
  const p = (value) => { params.push(value); return '$' + params.length; };
  return { parts, params, p, where: () => (parts.length ? 'WHERE ' + parts.join(' AND ') : '') };
}

// from/to are YYYY-MM-DD in Nairobi time. "to" includes the whole day.
function dateRange(b, column, from, to) {
  if (from) b.parts.push(`${column} >= (${b.p(from)}::date)::timestamp AT TIME ZONE ${NAIROBI}`);
  if (to) b.parts.push(`${column} < ((${b.p(to)}::date) + 1)::timestamp AT TIME ZONE ${NAIROBI}`);
}

// Phones are stored as 2547XXXXXXXX, but admins type 07XX. Accept both.
function phoneDigits(raw) {
  const d = raw.replace(/[\s\-+]/g, '');
  if (!/^\d+$/.test(d)) return '';
  return d.startsWith('0') ? '254' + d.slice(1) : d;
}

// Orders table is aliased "o", users is "u".
export function orderFilters({ status, q, from, to } = {}) {
  const b = builder();
  if (status && ORDER_STATUSES.includes(status)) b.parts.push(`o.status = ${b.p(status)}`);
  dateRange(b, 'o.created_at', from, to);
  const raw = String(q || '').trim().slice(0, 40);
  if (raw) {
    const text = b.p('%' + escapeLike(raw) + '%');
    const clauses = [`o.ref ILIKE ${text}`, `o.mpesa_receipt ILIKE ${text}`];
    const digits = phoneDigits(raw);
    if (digits) {
      const phone = b.p('%' + escapeLike(digits) + '%');
      clauses.push(`o.recipient_phone LIKE ${phone}`, `o.payer_phone LIKE ${phone}`, `u.phone LIKE ${phone}`);
    }
    b.parts.push('(' + clauses.join(' OR ') + ')');
  }
  return { where: b.where(), params: b.params };
}

// Ledger is "l", users "u", orders "o".
export function ledgerFilters({ kind, q, from, to } = {}) {
  const b = builder();
  if (kind && LEDGER_KINDS.includes(kind)) b.parts.push(`l.kind = ${b.p(kind)}`);
  dateRange(b, 'l.created_at', from, to);
  const raw = String(q || '').trim().slice(0, 40);
  if (raw) {
    const text = b.p('%' + escapeLike(raw) + '%');
    const clauses = [`o.ref ILIKE ${text}`, `l.description ILIKE ${text}`];
    const digits = phoneDigits(raw);
    if (digits) clauses.push(`u.phone LIKE ${b.p('%' + escapeLike(digits) + '%')}`);
    b.parts.push('(' + clauses.join(' OR ') + ')');
  }
  return { where: b.where(), params: b.params };
}

// One CSV cell. Values that start with = + - @ are prefixed so Excel cannot run them as a formula.
export function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvCell).join(',')];
  for (const r of rows) lines.push(r.map(csvCell).join(','));
  return '\uFEFF' + lines.join('\r\n') + '\r\n'; // BOM so Excel reads the file as UTF-8
}
