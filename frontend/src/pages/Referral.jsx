import { useEffect, useState } from 'react';
import { api } from '../lib';
import { ReferralCard } from '../components/Cards.jsx';
import { useConfig } from '../lib/hooks';
import { fmtMonth, kes, kesInt, pct } from '../lib/format';

export default function Referral() {
  const cfg = useConfig();
  const [refs, setRefs] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let on = true;
    api.referrals().then((r) => on && setRefs(r)).catch((e) => on && setError(e.message));
    return () => { on = false; };
  }, []);

  return (
    <div className="wrap">
      <div className="pageh"><h1>Referral program</h1><p>Invite friends. Earn every time they buy a bundle.</p></div>
      <div className="two" style={{ margin: '18px 0 22px' }}>
        <ReferralCard />
        <section className="card">
          <h3 className="t">How you earn</h3>
          <div className="rules">
            <div className="rule"><span className="big">{pct(cfg.refRate)}%</span><p><b>On your friends' purchases</b>Earned every time someone who joined with your link buys a bundle.</p></div>
            <div className="rule"><span className="big">{pct(cfg.selfRate)}%</span><p><b>On your own purchases</b>Earned each time you buy from your account.</p></div>
            <div className="rule"><span className="big">{kesInt(cfg.minWithdraw)}</span><p><b>Minimum withdrawal</b>Paid out to your M-Pesa number once approved.</p></div>
          </div>
        </section>
      </div>
      <section className="card" style={{ marginBottom: 40 }}>
        <h2>Your referrals</h2>
        <p className="muted" style={{ marginBottom: 10 }}>Phone numbers are partly hidden to protect your friends' privacy.</p>
        {error ? <div className="empty">{error}</div> : refs === null ? <p className="muted">Loading…</p> : refs.length === 0 ? (
          <div className="empty">No referrals yet. Share your link on WhatsApp to get started.</div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Friend</th><th>Joined</th><th className="num">Orders</th><th className="num">You earned</th></tr></thead>
              <tbody>
                {refs.map((r) => (
                  <tr key={r.id}>
                    <td>{r.maskedPhone}{r.orders === 0 && <> <span className="tag wait">No purchase yet</span></>}</td>
                    <td>{fmtMonth(r.joinedAt)}</td>
                    <td className="num">{r.orders}</td>
                    <td className="num">{kes(r.earned)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
