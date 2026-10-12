import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import { fmtDate, kes, pretty } from '../../lib/format';
import { ErrorBox, Pager } from './parts.jsx';

const ORDER_STATUS = {
  delivered: ['ok', 'Completed'],
  pending_payment: ['wait', 'Awaiting payment'],
  payment_failed: ['bad', 'Payment failed'],
  needs_review: ['bad', 'Needs review'],
  cancelled: ['bad', 'Cancelled'],
  paid: ['wait', 'Paid'],
  delivering: ['wait', 'Processing'],
  delivery_failed: ['bad', 'Needs review']
};
const KIND = {
  self: 'Own purchase',
  referral: 'Referral',
  withdrawal: 'Withdrawal',
  withdrawal_reversal: 'Withdrawal returned',
  adjustment: 'Adjustment'
};
const EMPTY = { status: '', kind: '', q: '', from: '', to: '' };

export default function Transactions({ preset }) {
  const [view, setView] = useState('orders'); // orders | ledger
  const [draft, setDraft] = useState({ ...EMPTY, ...(preset || {}) });
  const [applied, setApplied] = useState({ ...EMPTY, ...(preset || {}), page: 1 });
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let on = true;
    setData(null);
    setErr('');
    const common = { q: applied.q, from: applied.from, to: applied.to, page: applied.page };
    const request = view === 'orders'
      ? adminApi.orders({ ...common, status: applied.status })
      : adminApi.ledger({ ...common, kind: applied.kind });
    request.then((r) => on && setData(r)).catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, [view, applied, reload]);

  const set = (key) => (e) => setDraft((d) => ({ ...d, [key]: e.target.value }));

  function apply(e) {
    e.preventDefault();
    setApplied({ ...draft, page: 1 });
  }
  function reset() {
    setDraft(EMPTY);
    setApplied({ ...EMPTY, page: 1 });
  }
  function switchView(next) {
    setView(next);
    setApplied((a) => ({ ...a, page: 1 }));
  }

  async function exportCsv() {
    setBusy(true);
    setErr('');
    try {
      await adminApi.downloadOrdersCsv({ status: applied.status, q: applied.q, from: applied.from, to: applied.to });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function accept(o) {
    const ok = window.confirm(`Mark ${o.ref} as completed and credit commission?\n\nOnly do this after checking the payment in your M-Pesa statement.`);
    if (!ok) return;
    try {
      await adminApi.acceptOrder(o.id);
      setReload((n) => n + 1);
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <section className="card">
      <div className="head">
        <div className="tabs" role="group" aria-label="Transaction type">
          <button type="button" aria-pressed={view === 'orders'} onClick={() => switchView('orders')}>Orders and payments</button>
          <button type="button" aria-pressed={view === 'ledger'} onClick={() => switchView('ledger')}>Commission ledger</button>
        </div>
        {view === 'orders' && (
          <button type="button" className="btn ghost" onClick={exportCsv} disabled={busy}>
            {busy ? 'Preparing…' : 'Download CSV'}
          </button>
        )}
      </div>

      <form className="filters" onSubmit={apply}>
        <label className="f">Search
          <input value={draft.q} onChange={set('q')} placeholder={view === 'orders' ? 'Reference, phone or M-Pesa code' : 'Phone or order reference'} />
        </label>
        {view === 'orders' ? (
          <label className="f">Status
            <select value={draft.status} onChange={set('status')}>
              <option value="">All</option>
              <option value="delivered">Completed</option>
              <option value="pending_payment">Awaiting payment</option>
              <option value="payment_failed">Payment failed</option>
              <option value="needs_review">Needs review</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
        ) : (
          <label className="f">Type
            <select value={draft.kind} onChange={set('kind')}>
              <option value="">All</option>
              {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        )}
        <label className="f">From<input type="date" value={draft.from} onChange={set('from')} /></label>
        <label className="f">To<input type="date" value={draft.to} onChange={set('to')} /></label>
        <div className="btnrow">
          <button type="submit" className="btn primary">Apply</button>
          <button type="button" className="btn ghost" onClick={reset}>Reset</button>
        </div>
      </form>

      <ErrorBox message={err} />

      {!data && !err ? <p className="muted">Loading…</p> : null}

      {data && view === 'orders' && (
        <div className="tablewrap">
          <table className="wide">
            <thead>
              <tr><th>Time</th><th>Reference</th><th>Offer</th><th>Account</th><th className="num">Amount</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {data.items.map((o) => {
                const [cls, label] = ORDER_STATUS[o.status] || ['wait', o.status];
                return (
                  <tr key={o.id}>
                    <td>{fmtDate(o.createdAt)}</td>
                    <td><b>{o.ref}</b>{o.mpesaReceipt ? <span className="sub-line">M-Pesa {o.mpesaReceipt}</span> : null}</td>
                    <td>{o.title}<span className="sub-line">to {pretty(o.recipient)}</span></td>
                    <td>{o.account ? pretty(o.account) : 'Guest'}<span className="sub-line">paid by {pretty(o.payer)}</span></td>
                    <td className="num">{kes(o.price)}</td>
                    <td>
                      <span className={`tag ${cls}`}>{label}</span>
                      {o.reason && o.status !== 'delivered' ? <span className="sub-line">{o.reason}</span> : null}
                    </td>
                    <td>
                      {o.status === 'needs_review' && (
                        <button type="button" className="btn ghost" onClick={() => accept(o)}>Accept</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.items.length === 0 && <div className="empty">No orders match these filters.</div>}
        </div>
      )}

      {data && view === 'ledger' && (
        <div className="tablewrap">
          <table className="wide">
            <thead>
              <tr><th>Time</th><th>Account</th><th>Type</th><th>Description</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {data.items.map((l) => (
                <tr key={l.id}>
                  <td>{fmtDate(l.at)}</td>
                  <td>{pretty(l.account)}</td>
                  <td>{KIND[l.kind] || l.kind}{l.onHold ? <span className="sub-line">on hold</span> : null}</td>
                  <td>{l.description}{l.orderRef ? <span className="sub-line">order {l.orderRef}</span> : null}</td>
                  <td className="num" style={{ color: l.amount < 0 ? '#dc2626' : 'var(--green)' }}>
                    {l.amount < 0 ? '−' : '+'}{kes(Math.abs(l.amount))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.items.length === 0 && <div className="empty">No entries match these filters.</div>}
        </div>
      )}

      {data && (
        <Pager page={data.page} pageSize={data.pageSize} total={data.total}
          onPage={(p) => setApplied((a) => ({ ...a, page: p }))} />
      )}
    </section>
  );
}
