import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib';
import { useAuth } from '../context/AuthContext.jsx';
import { useApp } from '../context/AppContext.jsx';
import { useConfig } from '../lib/hooks';
import { Cart, Gift, Phone, Users, User, Whatsapp, Wifi } from './icons.jsx';
  import { NETS, fmtDate, fmtYear, kes, kesInt, pct, pretty } from '../lib/format';

export function AccountCard() {
  const { account } = useAuth();
  const { withdraw } = useApp();
  if (!account) return null;
  const { user, stats } = account;
  return (
    <section className="card acct" aria-label="Your account">
      <div className="who">
        <span className="avatar" aria-hidden="true"><User size={28} /></span>
        <div><b>Hello, {user.name || pretty(user.phone)}</b><span>Member since {fmtYear(user.since)}</span></div>
      </div>
      <div className="bal">
        <div className="row">
          <div><small>Available commission</small><div className="amt">{kes(stats.balance)}</div></div>
          <button type="button" className="btn green" onClick={withdraw}>Request withdrawal</button>
        </div>
        <div className="mini">
          <div><small>Total referrals</small><b>{stats.referralCount}</b></div>
          <div><small>Successful orders</small><b>{stats.orderCount}</b></div>
          <div><small>Total earned</small><b>{kes(stats.totalEarned)}</b></div>
        </div>
      </div>
    </section>
  );
}

export function ReferralCard() {
  const { account } = useAuth();
  const { toast } = useApp();
  const cfg = useConfig();
  if (!account) return null;
  const link = `${window.location.origin}/ref/${account.user.refCode}`;
  const text = `Get cheap data, SMS and minutes on ConnectPlus. Sign up with my link: ${link}`;

  async function copy() {
    try { await navigator.clipboard.writeText(link); toast('Link copied'); }
    catch { toast('Press and hold the link to copy it'); }
  }
  async function share() {
    if (navigator.share) { try { await navigator.share({ title: 'ConnectPlus', text, url: link }); } catch { /* cancelled */ } }
    else copy();
  }

  return (
    <section className="card" aria-label="Your referral link">
      <h3 className="t">Your referral link</h3>
      <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>Share it. You earn {Math.round(cfg.refRate * 100)}% when your friends buy.</p>
      <div className="reflink">
        <input value={link} readOnly aria-label="Referral link" onFocus={(e) => e.target.select()} />
        <button type="button" className="btn ghost" style={{ padding: '7px 12px' }} onClick={copy}>Copy</button>
      </div>
      <div className="btnrow">
        <a className="btn green" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(text)}`}>
          <Whatsapp /> Share on WhatsApp
        </a>
        <button type="button" className="btn ghost" onClick={share}>More</button>
      </div>
    </section>
  );
}

export function RecentOrders() {
  const { account } = useAuth();
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    let on = true;
    api.orders().then((o) => on && setOrders(o.slice(0, 3))).catch(() => on && setOrders([]));
    return () => { on = false; };
  }, [account]);
  return (
    <section className="card">
      <div className="head" style={{ margin: 0 }}>
        <h3 className="t">Recent orders</h3>
        <Link className="linkbtn" to="/dashboard">View all</Link>
      </div>
      {orders === null ? <p className="muted" style={{ marginTop: 10 }}>Loading…</p>
        : orders.length === 0 ? <div className="empty" style={{ marginTop: 10 }}>No orders yet. Pick a bundle to get started.</div>
        : (
          <div className="list">
            {orders.map((o) => (
              <div className="li" key={o.id}>
                <div><b>{o.title}</b><small>{NETS[o.net]} · {fmtDate(o.createdAt)}</small></div>
                <b>{kesInt(o.price)}</b>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

export function GuestCard() {
  const cfg = useConfig();
  return (
    <section className="card">
      <h3 className="t">Earn while you connect</h3>
      <p className="muted" style={{ margin: '6px 0 14px', fontSize: 14 }}>
        Log in with your phone number to earn {pct(cfg.selfRate)} on your own purchases and {pct(cfg.refRate)} on your friends'.
      </p>
      <Link to="/login" className="btn primary block">Log in or sign up</Link>
    </section>
  );
}

export function ReferBanner() {
  return (
    <section className="card banner">
      <div className="gift" aria-hidden="true"><Gift /></div>
      <div>
        <h3>Refer and earn more</h3>
        <p>Bring your friends on board and earn on every purchase they make.</p>
        <Link to="/referral" className="btn">Learn more</Link>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ['#16a34a', <Cart key="a" />, 'Choose an offer', 'Pick a data, SMS or minutes bundle.'],
    ['#1565e8', <Phone key="b" />, 'Pay with M-Pesa', 'Approve the prompt on your phone.'],
    ['#7c3aed', <Wifi key="c" />, 'Get your bundle', 'It arrives on your phone in seconds.'],
    ['#f59e0b', <Users key="d" />, 'Earn commission', "Earn on your purchases and your friends'."]
  ];
  return (
    <section className="card">
      <h2>How it works</h2>
      <p className="muted">Get connected and start earning in 4 simple steps.</p>
      <div className="steps">
        {steps.map((s, i) => (
          <div className="step" key={s[2]}>
            <span className="ic" style={{ background: s[0] }}>{s[1]}</span>
            <div><h4>{i + 1}. {s[2]}</h4><p>{s[3]}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
