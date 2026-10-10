import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib';
import { USE_MOCK } from '../config';
import { useAuth } from '../context/AuthContext.jsx';
import { getRef } from '../lib/referral';
import { getSavedPhone, normPhone, pretty, savePhone } from '../lib/format';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { account, login } = useAuth();
  const [step, setStep] = useState('phone'); // phone | code
  const [phone, setPhone] = useState(pretty(location.state?.phone || getSavedPhone()));
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const dest = location.state?.from || '/dashboard';
  const invited = !!getRef();

  useEffect(() => { if (account) navigate(dest, { replace: true }); }, [account, dest, navigate]);

  async function sendCode(e) {
    e?.preventDefault();
    const p = normPhone(phone);
    if (!p) return setErr('Enter a valid Kenyan number, like 0712 345 678.');
    setErr(''); setBusy(true);
    try {
      await api.requestOtp(p);
      savePhone(p);
      setStep('code');
    } catch (ex) { setErr(ex.message); } finally { setBusy(false); }
  }

  async function verify(e) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setErr('Enter the 6-digit code we sent you.');
    setErr(''); setBusy(true);
    try {
      await login(normPhone(phone), code);
    } catch (ex) { setErr(ex.message); setBusy(false); }
  }

  return (
    <div className="wrap">
      <div className="card authcard">
        {step === 'phone' ? (
          <form onSubmit={sendCode} noValidate style={{ display: 'grid', gap: 14 }}>
            <h1>Log in or sign up</h1>
            <p className="muted">{invited ? 'A friend invited you. ' : ''}Enter your phone number and we will text you a code. No password needed.</p>
            <label className="f">Phone number
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="07XX XXX XXX" autoFocus />
            </label>
            <p className="fe" role="alert">{err}</p>
            <button type="submit" className="btn primary block" disabled={busy}>{busy ? 'Sending code…' : 'Send code'}</button>
          </form>
        ) : (
          <form onSubmit={verify} noValidate style={{ display: 'grid', gap: 14 }}>
            <h1>Enter your code</h1>
            <p className="muted">We sent a 6-digit code to {pretty(normPhone(phone))}.</p>
            <label className="f">Code
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" autoFocus />
            </label>
            {USE_MOCK && <p className="proto" style={{ textAlign: 'left' }}>Prototype mode: use code 123456.</p>}
            <p className="fe" role="alert">{err}</p>
            <button type="submit" className="btn primary block" disabled={busy}>{busy ? 'Checking…' : 'Log in'}</button>
            <div className="btnrow">
              <button type="button" className="linkbtn" onClick={() => { setStep('phone'); setCode(''); setErr(''); }}>Change number</button>
              <button type="button" className="linkbtn" onClick={sendCode}>Send a new code</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
