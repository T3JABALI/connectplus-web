export const NETS = { safaricom: 'Safaricom' };
export const CATS = { data: 'Data bundles', sms: 'SMS', min: 'Minutes', special: 'Special offers' };

export const kes = (n) =>
  'KSh ' + Number(n).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const kesInt = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');
  // 0.025 -> "2.5%", 0.02 -> "2%"
  export const pct = (rate) => `${Number((rate * 100).toFixed(2))}%`;

// Accepts 07XX, 01XX, 2547XX and +2547XX. Returns 07XXXXXXXX or null.
export function normPhone(v) {
  const d = String(v || '').replace(/[\s\-()]/g, '');
  const m = d.match(/^(?:\+?254|0)?([71]\d{8})$/);
  return m ? '0' + m[1] : null;
}
export const pretty = (p) => (p ? String(p).replace(/^(\d{4})(\d{3})(\d{3})$/, '$1 $2 $3') : '');

export const fmtDate = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
export const fmtMonth = (iso) => new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
export const fmtYear = (iso) => new Date(iso).getFullYear();

const PK = 'cp_phone';
export const getSavedPhone = () => { try { return localStorage.getItem(PK) || ''; } catch { return ''; } };
export const savePhone = (p) => { try { localStorage.setItem(PK, p); } catch { /* ignore */ } };
