import { useState } from 'react';
import { api } from '../lib';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfig } from '../lib/hooks';
import { Check } from './icons.jsx';
import { kes, kesInt, normPhone, pretty } from '../lib/format';

export default function WithdrawModal({ onClose }) {
  const { account, refresh } = useAuth();
  const cfg = useConfig();
  const balance = account?.stats.balance ?? 0;
  const [amount, setAmount] = useState('');
  const [phone, setPhone] = useState(pretty(account?.user.phone));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  async function submit(e) {
    e.preventDefault();
    const a = parseFloat(amount);
    const ph = normPhone(phone);
    if (Number.isNaN(a)) return setErr('Enter the amount you want to withdraw.');
    if (a < cfg.minWithdraw) return setErr(`The minimum withdrawal is ${kesInt(cfg.minWithdraw)}.`);
    if (a > balance) return setErr(`You only have ${kes(balance)} available.`);
    if (!ph) return setErr('Enter a valid M-Pesa number, like 0712 345 678.');
    setErr(''); setBusy(true);
    try {
      await api.withdraw({ amount: a, phone: ph });
      await refresh();
      setDone({ a, ph });
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <div className="tick"><Check /></div>
        <h2 id="dlgTitle" className="center">Request received</h2>
        <p className="center">We will send <b>{kes(done.a)}</b> to <b>{pretty(done.ph)}</b> once it is approved.</p>
        <button type="button" className="btn primary" onClick={onClose}>Done</button>
      </>
    );
  }

  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
      <h2 id="dlgTitle">Request withdrawal</h2>
      <div className="summary"><span className="muted">Available commission</span><b>{kes(balance)}</b></div>
      <label className="f">Amount (KSh)
        <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={`Minimum ${cfg.minWithdraw}`} />
      </label>
      <label className="f">M-Pesa number to receive it
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="07XX XXX XXX" />
      </label>
      <p className="fe" role="alert">{err}</p>
      <div className="btnrow">
        <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
        <button type="submit" className="btn green" style={{ flex: 2 }} disabled={busy}>{busy ? 'Sending request…' : 'Request withdrawal'}</button>
      </div>
      <p className="proto">Withdrawals are reviewed and sent to M-Pesa after approval.</p>
    </form>
  );
}
