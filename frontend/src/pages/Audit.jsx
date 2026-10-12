import { useEffect, useState } from 'react';
import { adminApi } from '../lib/adminApi.js';
import { fmtDate, pretty } from '../lib/format.js';
import { ErrorBox } from './parts.jsx';

const ACTIONS = {
  withdrawal_paid: 'Marked withdrawal paid',
  withdrawal_declined: 'Declined withdrawal',
  order_accepted: 'Accepted held order',
  offer_created: 'Added offer',
  offer_updated: 'Changed offer',
  export_orders: 'Downloaded orders CSV',
  password_reset: 'Reset a password',
  grant_admin: 'Made someone an admin',
  revoke_admin: 'Removed admin access'
};

function summary(details) {
  if (!details || typeof details !== 'object') return '';
  if (details.before && details.after) {
    const changed = Object.keys(details.after).filter((k) => details.before[k] !== details.after[k] && k !== 'priceClash');
    return changed.map((k) => `${k}: ${details.before[k]} → ${details.after[k]}`).join(', ');
  }
  const text = Object.entries(details).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}: ${v}`).join(', ');
  return text.length > 140 ? text.slice(0, 140) + '…' : text;
}

export default function Audit() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let on = true;
    adminApi.audit().then((r) => on && setRows(r)).catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, []);

  return (
    <section className="card">
      <h2>Activity</h2>
      <p className="muted" style={{ marginBottom: 12 }}>The last 100 things admins did, newest first.</p>
      <ErrorBox message={err} />
      {rows === null && !err ? <p className="muted">Loading…</p> : null}
      {rows && rows.length === 0 && <div className="empty">Nothing yet.</div>}
      {rows && rows.length > 0 && (
        <div className="tablewrap">
          <table className="wide">
            <thead><tr><th>Time</th><th>Who</th><th>Action</th><th>Details</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDate(a.at)}</td>
                  <td>{a.admin === 'API key' || a.admin === 'Unknown' ? a.admin : pretty(a.admin)}</td>
                  <td>{ACTIONS[a.action] || a.action}{a.targetId ? <span className="sub-line">{a.targetType} {a.targetId}</span> : null}</td>
                  <td>{summary(a.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}


