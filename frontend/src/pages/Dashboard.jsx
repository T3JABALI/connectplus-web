import { useEffect, useState } from 'react';
import { api } from '../lib';
import { useAuth } from '../context/AuthContext.jsx';
import { AccountCard, ReferralCard } from '../components/Cards.jsx';
import { NETS, fmtDate, kes, kesInt, pretty } from '../lib/format';

const STATUS = {
  delivered: ['ok', 'Delivered'],
  paid: ['wait', 'Processing'],
  pending: ['wait', 'Waiting for payment'],
  failed: ['bad', 'Failed'],
  cancelled: ['bad', 'Cancelled']
};

export default function Dashboard() {
  const { account, logout } = useAuth();
  const [orders, setOrders] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let on = true;
    Promise.all([api.orders(), api.commissions()])
      .then(([o, l]) => { if (on) { setOrders(o); setLedger(l); setError(''); } })
      .catch((e) => on && setError(e.message));
    return () => { on = false; };
  }, [account]);

  return (
    <div className="wrap">
      <div className="pageh head" style={{ alignItems: 'flex-end' }}>
        <div><h1>My dashboard</h1><p>Your orders and commission in one place.</p></div>
        <button type="button" className="btn ghost" onClick={logout}>Log out</button>
      </div>
      <div className="layout" style={{ paddingTop: 18 }}>
        <div className="stack">
          {error && <div className="empty">{error}</div>}
          <section className="card">
            <h2>Order history</h2>
            <p className="muted" style={{ marginBottom: 10 }}>Keep the reference if you need help with an order.</p>
            {orders === null ? <p className="muted">Loading…</p> : orders.length === 0 ? (
              <div className="empty">No orders yet. Pick a bundle to get started.</div>
            ) : (
              <div className="tablewrap">
                <table>
                  <thead><tr><th>Reference</th><th>Bundle</th><th>Sent to</th><th>Date</th><th className="num">Price</th><th>Status</th></tr></thead>
                  <tbody>
                    {orders.map((o) => {
                      const [cls, label] = STATUS[o.status] || STATUS.pending;
                      return (
                        <tr key={o.id}>
                          <td><b>{o.ref}</b></td>
                          <td>{o.title}<br /><span className={`net ${o.net}`}>{NETS[o.net]}</span></td>
                          <td>{pretty(o.recipientPhone)}</td>
                          <td>{fmtDate(o.createdAt)}</td>
                          <td className="num">{kesInt(o.price)}</td>
                          <td><span className={`tag ${cls}`}>{label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section className="card">
            <h2>Commission history</h2>
            <p className="muted">Every credit and withdrawal, newest first.</p>
            {ledger === null ? <p className="muted">Loading…</p> : ledger.length === 0 ? (
              <div className="empty" style={{ marginTop: 10 }}>No commission yet. Share your link to start earning.</div>
            ) : (
              <div className="list">
                {ledger.map((l) => (
                  <div className="li" key={l.id}>
                    <div>{l.description}<small>{fmtDate(l.createdAt)}</small></div>
                    <b style={{ color: l.amount < 0 ? '#dc2626' : 'var(--green)' }}>{l.amount < 0 ? '−' : '+'}{kes(Math.abs(l.amount))}</b>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside className="stack"><AccountCard /><ReferralCard /></aside>
      </div>
    </div>
  );
}
