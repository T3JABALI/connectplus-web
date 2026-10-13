import { useEffect, useRef, useState } from "react";

// Edit these numbers/labels to update the section
const STATS = [
  {
    target: 5000,
    suffix: "+",
    label: "Happy users",
    color: "#1456d9",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
        <circle cx="10" cy="7" r="4" />
        <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    target: 5000,
    suffix: "+",
    label: "Offers delivered",
    color: "#16a34a",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
    ),
  },
];

function Counter({ target, suffix }) {
  const ref = useRef(null);
  const [text, setText] = useState("0");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf;
    const run = () => {
      const start = performance.now();
      const dur = 1800;
      const tick = (now) => {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        const val = Math.floor(target * eased).toLocaleString();
        setText(p === 1 ? val + suffix : val);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          run();
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, suffix]);

  return (
    <div className="cp-stat-num" ref={ref}>
      {text}
    </div>
  );
}

export default function LiveStats() {
  return (
    <section className="cp-stats">
      <style>{`
        .cp-stats {
          background: #fff;
          border-radius: 24px;
          padding: 32px 33px;
          box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
          margin: 35px auto;
          max-width: 1165px;
        }
        .cp-stats h2 { font-size: 1.9rem; font-weight: 700; color: #0b1530; margin: 0 0 4px; }
        .cp-stats-sub { color: #5b6478; font-size: 1.1rem; margin: 0 0 28px; }
        .cp-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 24px; }
        .cp-stat { display: flex; align-items: center; gap: 16px; }
        .cp-stat-icon { width: 78px; height: 78px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .cp-stat-icon svg { width: 36px; height: 36px; stroke: #fff; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .cp-stat-num { font-size: 2.4rem; font-weight: 800; color: #0b1530; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .cp-stat-label { color: #5b6478; font-size: 1.05rem; margin-top: 2px; }
      `}</style>

      <h2>Trusted by Kenyans every day</h2>
      <p className="cp-stats-sub">Our growing community in numbers.</p>

      <div className="cp-stats-grid">
        {STATS.map((s) => (
          <div className="cp-stat" key={s.label}>
            <div className="cp-stat-icon" style={{ background: s.color }}>
              {s.icon}
            </div>
            <div>
              <Counter target={s.target} suffix={s.suffix} />
              <div className="cp-stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
