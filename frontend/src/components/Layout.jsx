import { useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Cart, User, WifiLogo } from './icons.jsx';
import { pretty } from '../lib/format';


const LINKS = [
  ['/', 'Home', true],
  ['/buy', 'Buy bundles'],
  ['/dashboard', 'My dashboard'],
  ['/referral', 'Referral program'],
  ['/help', 'Help'],
];

function Header() {
  const { account, logout } = useAuth();
  const isAdmin = !!account?.user.isAdmin;
  const dashboardPath = isAdmin ? '/admin' : '/dashboard';
  return (
    <header className="top">
      <div className="wrap">
        <Link to="/" className="logo" aria-label="ConnectPlus home">
          <WifiLogo />
          <span><b>ConnectPlus</b><small>Data, SMS and minutes</small></span>
        </Link>
        <nav aria-label="Main">
          {LINKS.map(([to, label, end]) => (
           <NavLink key={to} to={to === '/dashboard' ? dashboardPath : to} end={end}>{label}</NavLink>
          ))}
        </nav>
        {account ? (
          <>
            <Link to={dashboardPath} className="me" aria-label="Open my dashboard">
              <span className="avatar"><User /></span>
              <div><b>{account.user.name || pretty(account.user.phone)}</b><small>{isAdmin ? 'Admin' : 'Member'}</small></div>
            </Link>
            <button type="button" className="btn ghost hide-sm" onClick={logout}>Log out</button>
          </>
        ) : (
          <Link to="/login" className="btn primary">Log in</Link>
        )}
      </div>
    </header>
  );
  
}

function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="item"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg><div><b>Secure payments</b>Pay with M-Pesa. Your transactions are protected.</div></div>
        <div className="item"><svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg><div><b>Instant delivery</b>Your bundle arrives within seconds.</div></div>
        <div className="item"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg><div><b>24/7 support</b>We're here to help any time.</div></div>
        <div className="nets"><span style={{ fontWeight: 500, color: '#9fb3d9' }}>Works on</span><span className="s">Safaricom</span></div>
      </div>
    </footer>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <Header />
      <main><Outlet /></main>
      <Footer />
    </>
  );
}


