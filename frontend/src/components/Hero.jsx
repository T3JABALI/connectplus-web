import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { getSavedPhone, normPhone, pretty, savePhone } from '../lib/format';

export default function Hero() {
  const { account } = useAuth();
  const { toast } = useApp();
  const navigate = useNavigate();
  const [phone, setPhone] = useState(pretty(account?.user.phone || getSavedPhone()));
  const [err, setErr] = useState('');

  function submit(e) {
    e.preventDefault();
    const p = normPhone(phone);
    if (!p) return setErr('Enter a valid Kenyan number, like 0712 345 678.');
    setErr('');
    savePhone(p);
    if (account) {
      toast(`Pick a bundle for ${pretty(p)}.`);
      document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigate('/login', { state: { phone: p } });
    }
  }

  return (
    <section className="hero">
      <div className="wrap">
        <div>
          <p className="kicker">Data, SMS and minutes</p>
          <h1>Stay connected <span>anywhere, anytime</span></h1>
          <p className="lead">Affordable Safaricom data bundles, SMS and airtime. Fast, secure and convenient.</p>
          <form className="getstarted" onSubmit={submit} noValidate>
            <label className="sr" htmlFor="gsPhone">Your phone number</label>
            <input id="gsPhone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="Enter your phone number (e.g. 07XXXXXXXX)" />
            <button className="btn green" type="submit">Get started</button>
          </form>
          <p className="err" role="alert">{err}</p>
        </div>
        <div className="art" aria-hidden="true">
          <svg viewBox="0 0 200 330" width="160">
            <defs><linearGradient id="phoneGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1e6bff" /><stop offset="1" stopColor="#0a2a7a" /></linearGradient></defs>
            <rect x="10" y="6" width="170" height="318" rx="30" fill="#0b1633" stroke="#33518f" strokeWidth="3" />
            <rect x="20" y="16" width="150" height="298" rx="22" fill="url(#phoneGrad)" />
            <rect x="72" y="22" width="46" height="9" rx="4.5" fill="#0b1633" />
            <g fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round"><path d="M45 128a64 64 0 0 1 100 0" /><path d="M62 154a40 40 0 0 1 66 0" /><path d="M80 180a16 16 0 0 1 30 0" /></g>
            <circle cx="95" cy="204" r="7" fill="#fff" />
          </svg>
          <div className="pill d">Data bundles</div>
          <div className="pill s">SMS</div>
          <div className="pill m">Minutes</div>
        </div>
      </div>
    </section>
  );
}
