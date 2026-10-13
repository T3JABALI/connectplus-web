import { useEffect, useState } from 'react';
import { api } from '../lib';

const REFRESH_MS = 60000;
const n = (v) => Number(v).toLocaleString('en-KE');

// Real usage numbers from the server, refreshed every minute while the page is open.
export default function LiveStats() {
  const [s, setS] = useState(null);

  useEffect(() => {
    if (!api.publicStats) return undefined; // the built-in test mode has no live data
    let on = true;
    const load = () => api.publicStats().then((r) => on && setS(r)).catch(() => {});
    load();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
    return () => { on = false; clearInterval(timer); };
  }, []);

  if (!s) return null; // nothing to show yet, or the server is unreachable

  return (
    <section className="live" aria-label="Live usage">
      <div className="wrap">
        <h2><span className="live-dot" aria-hidden="true" />Live on ConnectPlus</h2>
        <div className="live-grid">
          <div className="live-stat"><b>{n(s.bundlesDelivered)}</b><span>Bundles delivered</span></div>
          <div className="live-stat"><b>{n(s.deliveredToday)}</b><span>Delivered today</span></div>
          <div className="live-stat"><b>{n(s.members)}</b><span>Members</span></div>
          <div className="live-stat"><b className="small">{s.popular || '—'}</b><span>Most popular this month</span></div>
        </div>
        <p className="live-note">Real numbers from our system, refreshed every minute. Every bundle is delivered on Safaricom.</p>
      </div>
    </section>
  );
}
