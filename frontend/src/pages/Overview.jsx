import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import { kes } from '../../lib/format';
import { ErrorBox } from './parts.jsx';

function Stat({ label, value, sub, onClick, warn }) {
  const body = (
    <>
      <small>{label}</small>
      <b>{value}</b>
      {sub ? <span className="sub-line">{sub}</span> : null}
    </>
  );
  const cls = 'stat' + (warn ? ' warn' : '');
  return onClick ? <button type="button" className={cls} onClick={onClick}>{body}</button> : <div className={cls}>{body}</div>;
}

export default function Overview({ go }) {
  const [s, setS] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let on = true;
    adminApi.stats().then((r) => on && setS(r)).catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, []);

  if (err) return <ErrorBox message={err} />;
  if (!s) return <p className="muted">Loading…</p>;

  const max = Math.max(1, ...s.daily.map((d) => d.revenue));

  return (
    <div className="stack">
      <section className="stat-grid" aria-label="Sales">
        <Stat label="Sales today" value={kes(s.revenue.today)} />
        <Stat label="Last 7 days" value={kes(s.revenue.week)} />
        <Stat label="All time" value={kes(s.revenue.all)} sub={`${s.orders.completed.toLocaleString('en-KE')} completed orders`} />
        <Stat label="Members" value={s.members.total.toLocaleString('en-KE')} />
      </section>

      <section className="stat-grid" aria-label="Needs attention">
        <Stat
          label="Withdrawals waiting"
          value={s.withdrawals.pendingCount}
          sub={s.withdrawals.pendingCount ? `${kes(s.withdrawals.pendingAmount)} to pay out` : 'Nothing waiting'}
          warn={s.withdrawals.pendingCount > 0}
          onClick={() => go('withdrawals')}
        />
        <Stat
          label="Orders needing review"
          value={s.orders.needsReview}
          sub="Payment held for a check"
          warn={s.orders.needsReview > 0}
          onClick={() => go('transactions', { status: 'needs_review' })}
        />
        <Stat
          label="Awaiting payment"
          value={s.orders.awaitingPayment}
          onClick={() => go('transactions', { status: 'pending_payment' })}
        />
        <Stat
          label="Failed payments"
          value={s.orders.failed}
          onClick={() => go('transactions', { status: 'payment_failed' })}
        />
      </section>

      <section className="stat-grid" aria-label="Commission">
        <Stat label="Owed to members" value={kes(s.members.balancesOwed)} sub="Commission balances, after pending withdrawals" />
        <Stat label="Paid out so far" value={kes(s.withdrawals.paidAmount)} sub="Withdrawals marked paid" />
      </section>

      <section className="card">
        <h2>Last 7 days</h2>
        <p className="muted">Completed sales per day (Nairobi time).</p>
        <div className="bars">
          {s.daily.map((d) => (
            <div className="bar" key={d.day} title={`${d.day}: ${kes(d.revenue)} from ${d.orders} orders`}>
              <span>{d.revenue > 0 ? Math.round(d.revenue).toLocaleString('en-KE') : ''}</span>
              <i style={{ height: `${Math.max(2, (d.revenue / max) * 100)}%` }} />
              <span>{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
