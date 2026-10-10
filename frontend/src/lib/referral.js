const KEY = 'cp_ref';
export const storeRef = (code) => { try { localStorage.setItem(KEY, code); } catch { /* ignore */ } };
export const getRef = () => { try { return localStorage.getItem(KEY) || undefined; } catch { return undefined; } };
export const clearRef = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } };
