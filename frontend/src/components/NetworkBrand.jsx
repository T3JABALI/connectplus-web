import { useState } from 'react';
import { NETWORK_LOGO, NETWORK_MOTTO } from '../config.js';

// Shows the network's logo and motto. If the logo file is missing, the name is shown as text instead.
export default function NetworkBrand() {
  const [broken, setBroken] = useState(false);

  return (
    <div className="net-brand">
      <span className="net-label">Works on</span>
      {broken || !NETWORK_LOGO ? (
        <b className="net-name">Safaricom</b>
      ) : (
        <span className="net-logo-box">
          <img src={NETWORK_LOGO} alt="Safaricom" onError={() => setBroken(true)} />
        </span>
      )}
      {NETWORK_MOTTO ? <em className="net-motto">{NETWORK_MOTTO}</em> : null}
    </div>
    );
}