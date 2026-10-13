import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getRef } from '../lib/referral';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { account, login, register } = useAuth();
  const [mode, setMode] = useState(location.state?.mode || (getRef() ? 'register' : 'login'));
  const [phone, setPhone] = useState(pretty(location.state?.phone || getSavedPhone()));
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const invited = !!getRef();
  const isRegister = mode === 'register';

  useEffect(() => {
    if (!account) return;
    const fallback = account.user.isAdmin ? '/admin' : '/dashboard';
    navigate(location.state?.from || fallback, { replace: true });
  }, [account, location.state, navigate]);

  function switchMode(next) {
    setMode(next);
    setErr('');
    setPassword('');
    setConfirm('');
  }

  async function submit(e) {
    e.preventDefault();
    const p = normPhone(phone);
    if (!p) return setErr('Enter a valid Kenyan number, like 0712 345 678.');
    if (!password) return setErr(isRegister ? 'Create a password.' : 'Enter your password.');
    if (isRegister) {
      if (password.length < 8) return setErr('Use at least 8 characters for your password.');
      if (password !== confirm) return setErr('The two passwords do not match.');
    }
    setErr('');
    setBusy(true);
    try {
      savePhone(p);
      if (isRegister) await register(p, password);
      else await login(p, password);
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  }

  const pwType = show ? 'text' : 'password';

  return (
    <div className="wrap">
      <div className="card authcard">
        <div className="tabs" role="group" aria-label="Log in or create an account" style={{ marginBottom: 16 }}>
          <button type="button" aria-pressed={!isRegister} onClick={() => switchMode('login')}>Log in</button>
          <button type="button" aria-pressed={isRegister} onClick={() => switchMode('register')}>Create account</button>
        </div>

        <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 14 }}>
          <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="muted">
            {isRegister
              ? `${invited ? 'A friend invited you. ' : ''}Use your phone number and choose a password.`
              : 'Log in with your phone number and password.'}
          </p>

          <label className="f">Phone number
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="username" placeholder="07XX XXX XXX" autoFocus />
          </label>

          <label className="f">{isRegister ? 'Create password' : 'Password'}
            <input type={pwType} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={isRegister ? 'new-password' : 'current-password'} />
            {isRegister && <small>At least 8 characters.</small>}
          </label>

          {isRegister && (
            <label className="f">Confirm password
              <input type={pwType} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </label>
          )}

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
          </label>

          <p className="fe" role="alert">{err}</p>
          <button type="submit" className="btn primary block" disabled={busy}>
            {busy ? 'Please wait…' : isRegister ? 'Create account' : 'Log in'}
          </button>

          {!isRegister && (
            <p className="muted" style={{ fontSize: 13 }}>
              Forgot your password? <Link to="/help">Contact support</Link> and we will reset it for you.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
