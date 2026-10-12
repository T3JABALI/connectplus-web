import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib';
import { getToken, setToken } from '../lib/token';
import { clearRef, getRef } from '../lib/referral';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [account, setAccount] = useState(null); // { user, stats } or null when logged out
  const [loading, setLoading] = useState(!!getToken());

  const refresh = useCallback(async () => {
    if (!getToken()) { setAccount(null); setLoading(false); return; }
    try {
      setAccount(await api.me());
    } catch (e) {
      if (e.status === 401) setToken(null);
      setAccount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const login = useCallback(async (phone, password) => {
    const res = await api.login(phone, password);
    setToken(res.token);
    await refresh();
  }, [refresh]);

  const register = useCallback(async (phone, password) => {
    const res = await api.register(phone, password, getRef());
    setToken(res.token);
    clearRef();
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => { setToken(null); setAccount(null); }, []);

  const value = useMemo(
    () => ({ account, loading, refresh, login, register, logout }),
    [account, loading, refresh, login, register, logout]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
