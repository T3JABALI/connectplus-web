import { useEffect, useState } from 'react';
import { adminApi } from '../lib/adminApi.js';
import { fmtDate, kes, pretty } from '../lib/format.js';
import { ErrorBox } from './parts.jsx';

const TABS = [['pending', 'Waiting'], ['approved', 'Paid'], ['rejected', 'Declined']];

export default function Withdrawals() {
  const [status, setStatus] = useState('pending');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);
  const [acting, setActing] = useState(null); // { id, type: 'pay' | 'decline' }
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let on = true;
    setRows(null);
    adminApi.withdrawals(status)
      .then((r) => { if (on) { setRows(r); setErr(''); } })
      .catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, [status, reload]);

  function start(id, type) {
    setActing({ id, type });
    setText('');
    setErr('');
  }

  async function confirm() {
    setBusy(true);
    setErr('');
    try {
      if (acting.type === 'pay') await adminApi.payWithdrawal(acting.id, text.trim());
      else await adminApi.declineWithdrawal(acting.id, text.trim());
      setActing(null);
      setText('');
      setReload((n) => n + 1);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="head">
        <div>
          <h2>Withdrawals</h2>
          <p className="muted">Send the money from your M-Pesa app first, then mark it paid here.</p>
        </div>
        <div className="tabs" role="group" aria-label="Withdrawal status">
          {TABS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={status === k} onClick={() => { setStatus(k); setActing(null); }}>{label}</button>
          ))}
        </div>
      </div>

      <ErrorBox message={err} />
      {rows === null && !err ? <p className="muted">Loading…</p> : null}

      {rows && rows.length === 0 && (
        <div className="empty">{status === 'pending' ? 'No withdrawals waiting. All caught up.' : 'Nothing here yet.'}</div>
      )}

      {rows && rows.length > 0 && (
        <div className="tablewrap">
          <table className="wide">
            <thead>
              <tr>
                <th>Requested</th><th>Account</th><th>Pay to</th><th className="num">Amount</th>
                <th>{status === 'pending' ? 'Action' : 'Details'}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <FragmentRows key={w.id} w={w} status={status} acting={acting} text={text}
                  setText={setText} busy={busy} start={start} cancel={() => setActing(null)} confirm={confirm} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function FragmentRows({ w, status, acting, text, setText, busy, start, cancel, confirm }) {
  const open = acting && acting.id === w.id;
  return (
    <>
      <tr>
        <td>{fmtDate(w.createdAt)}</td>
        <td>{pretty(w.account)}</td>
        <td>
          {pretty(w.payTo)}
          {w.payTo !== w.account ? <span className="sub-line" style={{ color: '#b45309' }}>Different from account number</span> : null}
        </td>
        <td className="num"><b>{kes(w.amount)}</b></td>
        <td>
          {status === 'pending' ? (
            <div className="btnrow">
              <button type="button" className="btn green" onClick={() => start(w.id, 'pay')}>Mark paid</button>
              <button type="button" className="btn ghost" onClick={() => start(w.id, 'decline')}>Decline</button>
            </div>
          ) : (
            <>
              {w.processedAt ? `${status === 'approved' ? 'Paid' : 'Declined'} ${fmtDate(w.processedAt)}` : ''}
              {w.mpesaRef ? <span className="sub-line">M-Pesa {w.mpesaRef}</span> : null}
              {w.note ? <span className="sub-line">{w.note}</span> : null}
            </>
          )}
        </td>
      </tr>
      {open && (
        <tr className="row-form">
          <td colSpan={5}>
            <div className="filters" style={{ margin: 0 }}>
              <label className="f" style={{ maxWidth: 360 }}>
                {acting.type === 'pay' ? 'M-Pesa confirmation code (optional)' : 'Reason for declining (optional)'}
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={acting.type === 'pay' ? 40 : 200} autoFocus />
              </label>
              <div className="btnrow">
                <button type="button" className={acting.type === 'pay' ? 'btn green' : 'btn primary'} disabled={busy} onClick={confirm}>
                  {busy ? 'Saving…' : acting.type === 'pay' ? `Confirm ${kes(w.amount)} was sent` : 'Decline and return to balance'}
                </button>
                <button type="button" className="btn ghost" disabled={busy} onClick={cancel}>Cancel</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}


