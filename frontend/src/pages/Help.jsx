import { Whatsapp } from '../components/icons.jsx';
import { SUPPORT_PHONE } from '../config';

const FAQ = [
  ['Which network do you support?', 'We currently sell Safaricom bundles only. Make sure the number you send the bundle to is on Safaricom.'],
  ['How do I buy a bundle?', 'Go to Buy bundles, select a bundle and pay with M-Pesa. Your bundle will be delivered instantly.'],
  ['I paid but did not get my bundle.', 'Open My dashboard, find the order and note its reference. Then message support. We will deliver the bundle or refund you.'],
  ['How do I earn commission?', 'Share your referral link. When a friend buys through it, you earn a percentage of their purchase. You also earn a smaller amount on your own purchases.'],
  ['How do I withdraw my commission?', 'Go to My dashboard, choose Request withdrawal, and enter the amount and your M-Pesa number. Withdrawals are approved manually and sent to M-Pesa.']
];

export default function Help() {
  return (
    <div className="wrap">
      <div className="pageh"><h1>Help</h1><p>Quick answers, and how to reach us.</p></div>
      <div className="two" style={{ margin: '18px 0 40px' }}>
        <section className="card">
          <h2 style={{ marginBottom: 6 }}>Common questions</h2>
          {FAQ.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </section>
        <section className="card" style={{ alignSelf: 'start' }}>
          <h2>Talk to us</h2>
          <p className="muted" style={{ margin: '6px 0 14px' }}>Support is available 24/7.</p>
          <div className="btnrow">
            <a className="btn green" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent('Hi ConnectPlus, I need help with an order.')}`}><Whatsapp /> WhatsApp us</a>
            <a className="btn ghost" href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}>Call {SUPPORT_PHONE}</a>
          </div>
        </section>
      </div>
    </div>
  );
}
