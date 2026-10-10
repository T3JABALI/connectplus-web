// Phones are stored as 2547XXXXXXXX (what M-Pesa needs) and shown as 07XXXXXXXX (what Kenyans expect).
export function normalizePhone(v) {
  const d = String(v ?? '').replace(/[\s\-()]/g, '');
  const m = d.match(/^(?:\+?254|0)?([71]\d{8})$/);
  return m ? '254' + m[1] : null;
}
export const toLocal = (p) => (p ? '0' + p.slice(3) : p);
export const mask = (p) => {
  const l = toLocal(p);
  return `${l.slice(0, 4)} *** ${l.slice(7)}`;
};
