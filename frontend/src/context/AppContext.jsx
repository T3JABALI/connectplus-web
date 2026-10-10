import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';
import PurchaseModal from '../components/PurchaseModal.jsx';
import WithdrawModal from '../components/WithdrawModal.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

// Holds the app-wide purchase modal, withdrawal modal and toast message.
export function AppProvider({ children }) {
  const [offer, setOffer] = useState(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [msg, setMsg] = useState('');
  const timer = useRef(null);

  const toast = useCallback((m) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(''), 2400);
  }, []);

  const value = useMemo(
    () => ({ buy: setOffer, withdraw: () => setWithdrawOpen(true), toast }),
    [toast]
  );

  return (
    <AppCtx.Provider value={value}>
      {children}
      {offer && (
        <Modal onClose={() => setOffer(null)}>
          <PurchaseModal key={offer.id} offer={offer} onClose={() => setOffer(null)} />
        </Modal>
      )}
      {withdrawOpen && (
        <Modal onClose={() => setWithdrawOpen(false)}>
          <WithdrawModal onClose={() => setWithdrawOpen(false)} />
        </Modal>
      )}
      <div className={'toast' + (msg ? ' on' : '')} role="status" aria-live="polite">{msg}</div>
    </AppCtx.Provider>
  );
}
