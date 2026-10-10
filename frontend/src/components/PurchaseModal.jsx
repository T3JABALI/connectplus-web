import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib';
import { useAuth } from '../context/AuthContext.jsx';
import { Check } from './icons.jsx';
import { NETS, kes, kesInt, normPhone, pretty, getSavedPhone, savePhone } from '../lib/format';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function PurchaseModal({ offer, onClose }) {
  const { account, refresh } = useAuth();
  const initial = pretty(account?.user.phone || getSavedPhone());
  const [step, setStep] = useState('form'); // form | waiting | done | failed | timeout
  const [to, setTo] = useState(initial);
  const [pay, setPay] = useState(initial);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState(null);
  const [payer, setPayer] = useState('');
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    return () => { stopped.current = true; };
  }, []);

  async function poll(id) {
    const deadline = Date.now() + 90000;
    while (!stopped.current && Date.now() < deadline) {
      await sleep(2000);
      try {
        const o = await api.getOrder(id);
        if (stopped.current) return;
        if (o.status === 'delivered') { setOrder(o); setStep('done'); refresh(); return; }
        if (o.status === 'failed' || o.status === 'cancelled') { setOrder(o); setStep('failed'); return; }
      } catch { /* keep polling through brief network errors */ }
    }
    if (!stopped.current) setStep('timeout');
  }

  async function submit(e) {
    e.preventDefault();
    const recipientPhone = normPhone(to);
    const payerPhone = normPhone(pay);
    if (!recipientPhone) return setErr('Enter a valid number to receive the bundle, like 0712 345 678.');
    if (!payerPhone) return setErr('Enter a valid M-Pesa number, like 0712 345 678.');
    setErr(''); setBusy(true);
    try {
      const created = await api.createOrder({ offerId: offer.id, recipientPhone, payerPhone });
      savePhone(recipientPhone);
      setPayer(payerPhone);
      setOrder(created);
      setStep('waiting');
      poll(created.id);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  if (step === 'waiting') {
    return (
      <>
        <h2 id="dlgTitle" className="center">Check your phone</h2>
        <div className="spin" aria-hidden="true" />
        <p className="center">
          We sent an M-Pesa prompt to <b>{pretty(payer)}</b>. Enter your PIN to pay <b>{kesInt(offer.price)}</b>.
        </p>
        <p className="proto">If you already paid, your bundle will still be delivered. Check My dashboard for the order.</p>
        <button type="button" className="btn ghost" onClick={onClose}>Close</button>
      </>
    );
  }

  if (step === 'done') {
    return (
      <>
        <div className="tick"><Check /></div>
        <h2 id="dlgTitle" className="center">Bundle sent</h2>
        <p className="center"><b>{offer.title}</b> is on its way to <b>{pretty(order.recipientPhone)}</b>.</p>
        <div className="summary"><span className="muted">Order reference</span><b>{order.ref}</b></div>
        {account && order.commission > 0 && (
          <div className="summary"><span className="muted">Commission earned</span><b style={{ color: 'var(--green)' }}>+{kes(order.commission)}</b></div>
        )}
        {!account && (
          <p className="center muted" style={{ fontSize: 13 }}>
            <Link to="/login" onClick={onClose}>Log in</Link> on your next purchase to earn commission.
          </p>
        )}
        <div className="btnrow">
          <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Done</button>
          {account && <Link to="/dashboard" className="btn primary" style={{ flex: 1 }} onClick={onClose}>View my orders</Link>}
        </div>
      </>
    );
  }

  if (step === 'failed' || step === 'timeout') {
    return (
      <>
        <h2 id="dlgTitle">{step === 'failed' ? 'Payment did not go through' : 'Still waiting for payment'}</h2>
        <p>
          {step === 'failed'
            ? 'M-Pesa did not complete the payment, so you have not been charged. You can try again.'
            : 'We have not received your M-Pesa payment yet. If you paid, your bundle will arrive shortly. Keep your order reference.'}
        </p>
        {order?.ref && <div className="summary"><span className="muted">Order reference</span><b>{order.ref}</b></div>}
        <button type="button" className="btn primary" onClick={onClose}>Close</button>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      <h2 id="dlgTitle">Confirm your purchase</h2>
      <div className="summary">
        <div><b>{offer.title}</b><div className="muted" style={{ fontSize: 13 }}>{NETS[offer.net]} · Valid {offer.valid}</div></div>
        <b>{kesInt(offer.price)}</b>
      </div>
      <label className="f">Send bundle to
        <input value={to} onChange={(e) => setTo(e.target.value)} inputMode="tel" placeholder="07XX XXX XXX" />
        <small>The {NETS[offer.net]} number that receives the bundle.</small>
      </label>
      <label className="f">Pay with M-Pesa number
        <input value={pay} onChange={(e) => setPay(e.target.value)} inputMode="tel" placeholder="07XX XXX XXX" />
        <small>You will get a prompt on this number.</small>
      </label>
      <p className="fe" role="alert">{err}</p>
      <div className="btnrow">
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn green" style={{ flex: 2 }} disabled={busy}>
          {busy ? 'Starting payment…' : `Pay ${kesInt(offer.price)} with M-Pesa`}
        </button>
      </div>
    </form>
  );
}
