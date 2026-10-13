import { useEffect, useState } from 'react';
import { api } from '../lib';

const REFRESH_MS = 60000;
const n = (v) => Number(v || 0).toLocaleString('en-KE');

// A stat is shown only once its real number is worth showing. Change these whenever you like.
const MIN_DELIVERED = 50;
const MIN_TODAY = 5;
const MIN_MEMBERS = 100;

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

  const stats = [];
  if (Number(s.bundlesDelivered) >= MIN_DELIVERED) stats.push({ label: 'Bundles delivered', value: n(s.bundlesDelivered) });
  if (Number(s.deliveredToday) >= MIN_TODAY) stats.push({ label: 'Delivered today', value: n(s.deliveredToday) });
  if (Number(s.members) >= MIN_MEMBERS) stats.push({ label: 'Members', value: n(s.members) });
  // "Most popular" means little until there is real volume behind it.
  if (s.popular && Number(s.bundlesDelivered) >= MIN_DELIVERED) {
    stats.push({ label: 'Most popular this month', value: s.popular, small: true });
  }

  if (!stats.length) return null; // too early to show numbers: hide the band

  return (
    <section className="live" aria-label="Live usage">
      <div className="wrap">
        <h2><span className="live-dot" aria-hidden="true" />Live on ConnectPlus</h2>
        <div className="live-grid">
          {stats.map((x) => (
            <div className="live-stat" key={x.label}>
              <b className={x.small ? 'small' : undefined}>{x.value}</b>
              <span>{x.label}</span>
            </div>
          ))}
        </div>
        <p className="live-note">Real numbers from our system, refreshed every minute. Every bundle is delivered on Safaricom.</p>
      </div>
    </section>
  );
}