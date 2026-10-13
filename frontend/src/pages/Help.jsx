import { Whatsapp } from '../components/icons.jsx';
import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from '../config';
import { pretty } from '../lib/format';

// 0787421618 -> 254787421618, the form WhatsApp and phone links need
const intl = (p) => '254' + String(p).replace(/\s/g, '').replace(/^0/, '');

const FAQ = [
  ['How fast will I get my bundle?', 'Usually within seconds of approving the M-Pesa prompt. If it takes longer than 10 minutes, contact support with your order reference.'],
  ['Which network do you support?', 'We currently sell Safaricom bundles only. Make sure the number you pay with is on Safaricom.'],
  ['I paid but did not get my bundle.', 'Open My dashboard, find the order and note its reference. Then message support. We will deliver the bundle or refund you.'],
  ['How do I earn commission?', 'You earn a percentage whenever you buy, and when a friend who joined with your referral link buys. The Referral program page shows the current rates.'],
  ['How do I withdraw my commission?', 'Go to My dashboard, choose Request withdrawal, and enter the amount. Withdrawals are approved manually and sent to the M-Pesa number you registered with.']
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
          <p className="muted" style={{ margin: '6px 0 14px' }}>Message us on WhatsApp or give us a call.</p>
          <div className="btnrow">
            <a
              className="btn green"
              target="_blank"
              rel="noopener noreferrer"
              href={`https://wa.me/${intl(SUPPORT_WHATSAPP)}?text=${encodeURIComponent('Hi ConnectPlus, I need help with an order.')}`}
            >
              <Whatsapp /> WhatsApp {pretty(SUPPORT_WHATSAPP)}
            </a>
            <a className="btn ghost" href={`tel:+${intl(SUPPORT_PHONE)}`}>Call {pretty(SUPPORT_PHONE)}</a>
          </div>
        </section>
      </div>
    </div>
  );
}
