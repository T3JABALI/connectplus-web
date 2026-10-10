import { useEffect, useState } from 'react';
import { api } from './index';

const DEFAULT_CFG = { selfRate: 0.02, refRate: 0.05, minWithdraw: 100 };

export function useConfig() {
  const [cfg, setCfg] = useState(DEFAULT_CFG);
  useEffect(() => {
    let on = true;
    api.config().then((c) => on && setCfg(c)).catch(() => {});
    return () => { on = false; };
  }, []);
  return cfg;
}

export function useOffers() {
  const [state, setState] = useState({ offers: [], loading: true, error: '' });
  useEffect(() => {
    let on = true;
    api.offers()
      .then((offers) => on && setState({ offers, loading: false, error: '' }))
      .catch((e) => on && setState({ offers: [], loading: false, error: e.message }));
    return () => { on = false; };
  }, []);
  return state;
}
