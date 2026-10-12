import './admin.css';
import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { USE_MOCK } from '../config.js';
import { useAuth } from '../context/AuthContext.jsx';
import { adminApi } from '../lib/adminApi.js';
import { pretty } from '../lib/format.js';
import Audit from './Audit.jsx';
import Offers from './Offers.jsx';
import Overview from './Overview.jsx';
import Transactions from './Transactions.jsx';
import Withdrawals from './Withdrawals.jsx';

const TABS = [
  ['overview', 'Overview'],
  ['transactions', 'Transactions'],
  ['withdrawals', 'Withdrawals'],
  ['offers', 'Offers'],
  ['audit', 'Activity']
];

export default function Admin() {
  const { account, loading } = useAuth();
  const [access, setAccess] = useState('checking'); // checking | ok | denied | error
  const [who, setWho] = useState(null);
  const [tab, setTab] = useState('overview');
  const [preset, setPreset] = useState(null);

  useEffect(() => {
    if (!account) return undefined;
    let on = true;
    adminApi.me()
      .then((r) => { if (on) { setWho(r); setAccess('ok'); } })
      .catch((e) => { if (on) setAccess(e.status === 401 || e.status === 403 ? 'denied' : 'error'); });
    return () => { on = false; };
  }, [account]);

  function go(next, presetFilters = null) {
    setPreset(presetFilters);
    setTab(next);
  }

  if (USE_MOCK) {
    return (
      <div className="wrap"><div className="card authcard">
        <h1>Admin needs the real backend</h1>
        <p className="muted" style={{ marginTop: 8 }}>Set VITE_API_URL so the site talks to your server, then open this page again.</p>
      </div></div>
    );
  }
  if (loading) return <div className="wrap"><p className="muted" style={{ padding: '40px 0' }}>Loading…</p></div>;
  if (!account) return <Navigate to="/login" replace state={{ from: '/admin' }} />;
  if (access === 'checking') return <div className="wrap"><p className="muted" style={{ padding: '40px 0' }}>Checking access…</p></div>;

  if (access !== 'ok') {
    return (
      <div className="wrap"><div className="card authcard">
        <h1>{access === 'denied' ? 'No admin access' : 'Could not load admin'}</h1>
        <p className="muted" style={{ margin: '8px 0 18px' }}>
          {access === 'denied'
            ? 'This account is not an admin. Log in with an admin account to continue.'
            : 'We could not reach the server. Check your connection and try again.'}
        </p>
        <Link to="/" className="btn primary">Go to home</Link>
      </div></div>
    );
  }

  return (
    <div className="wrap admin">
      <div className="pageh">
        <h1>Admin</h1>
        <p>{who.phone ? `Signed in as ${pretty(who.phone)}` : 'Signed in with the admin key'}</p>
      </div>

      <div className="tabs admin-tabs" role="group" aria-label="Admin sections">
        {TABS.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => go(k)}>{label}</button>
        ))}
      </div>

      <div className="admin-body">
        {tab === 'overview' && <Overview go={go} />}
        {tab === 'transactions' && <Transactions key={JSON.stringify(preset)} preset={preset} />}
        {tab === 'withdrawals' && <Withdrawals />}
        {tab === 'offers' && <Offers />}
        {tab === 'audit' && <Audit />}
      </div>
    </div>
  );
}




