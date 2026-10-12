import { useEffect, useState } from 'react';
import { adminApi } from '../../lib/adminApi';
import { CATS, kesInt } from '../../lib/format';
import { ErrorBox } from './parts.jsx';

const BLANK = { cat: 'data', size: '', title: '', valid: '', price: '', color: '#1565e8', sort: 0, active: true };

export default function Offers() {
  const [offers, setOffers] = useState(null);
  const [err, setErr] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null); // null | 'new' | offer id
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let on = true;
    adminApi.offers().then((r) => on && setOffers(r)).catch((e) => on && setErr(e.message));
    return () => { on = false; };
  }, [reload]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function startNew() {
    const next = offers && offers.length ? Math.max(...offers.map((o) => o.sort)) + 10 : 10;
    setForm({ ...BLANK, sort: next });
    setEditing('new');
    setErr('');
  }

  function startEdit(o) {
    setForm({ cat: o.cat, size: o.size, title: o.title, valid: o.valid, price: String(o.price), color: o.color, sort: o.sort, active: o.active });
    setEditing(o.id);
    setErr('');
  }

  async function save(e) {
    e.preventDefault();
    const price = Number(form.price);
    if (!Number.isInteger(price) || price < 1) return setErr('Price must be a whole number of shillings.');
    const body = {
      cat: form.cat, size: form.size.trim(), title: form.title.trim(), valid: form.valid.trim(),
      price, color: form.color, sort: Number(form.sort) || 0, active: form.active
    };
    setSaving(true);
    setErr('');
    try {
      if (editing === 'new') await adminApi.createOffer(body);
      else await adminApi.updateOffer(editing, body);
      setEditing(null);
      setReload((n) => n + 1);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggle(o) {
    setErr('');
    try {
      await adminApi.updateOffer(o.id, { active: !o.active });
      setReload((n) => n + 1);
    } catch (ex) {
      setErr(ex.message);
    }
  }

  return (
    <section className="card">
      <div className="head">
        <div>
          <h2>Offers</h2>
          <p className="muted">Changes show on the site within a minute. Orders already placed keep the price they were bought at.</p>
        </div>
        {editing === null && <button type="button" className="btn primary" onClick={startNew}>Add offer</button>}
      </div>

      {editing !== null && (
        <form onSubmit={save} noValidate>
          <h3 className="t" style={{ marginBottom: 12 }}>{editing === 'new' ? 'New offer' : 'Edit offer'}</h3>
          <div className="offer-form">
            <label className="f">Title<input value={form.title} onChange={set('title')} placeholder="1GB Data" maxLength={60} /></label>
            <label className="f">Size<input value={form.size} onChange={set('size')} placeholder="1GB" maxLength={20} /></label>
            <label className="f">Valid<input value={form.valid} onChange={set('valid')} placeholder="for 24 hours" maxLength={40} /></label>
            <label className="f">Price (KSh)<input value={form.price} onChange={set('price')} inputMode="numeric" placeholder="50" /></label>
            <label className="f">Category
              <select value={form.cat} onChange={set('cat')}>
                {Object.entries(CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="f">Order on site<input value={form.sort} onChange={set('sort')} inputMode="numeric" /></label>
            <label className="f">Badge colour<input type="color" value={form.color} onChange={set('color')} style={{ padding: 4, height: 44 }} /></label>
            <label className="f">Shown on site
              <span style={{ display: 'flex', gap: 8, alignItems: 'center', height: 44 }}>
                <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active
              </span>
            </label>
          </div>
          <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
            Your USSD automation tells bundles apart by the amount paid, so every active offer needs its own price.
          </p>
          <ErrorBox message={err} />
          <div className="btnrow" style={{ marginBottom: 18 }}>
            <button type="submit" className="btn green" disabled={saving}>{saving ? 'Saving…' : 'Save offer'}</button>
            <button type="button" className="btn ghost" disabled={saving} onClick={() => { setEditing(null); setErr(''); }}>Cancel</button>
          </div>
        </form>
      )}

      {editing === null && <ErrorBox message={err} />}
      {offers === null && !err ? <p className="muted">Loading…</p> : null}

      {offers && (
        <div className="tablewrap">
          <table className="wide">
            <thead>
              <tr><th>Offer</th><th>Category</th><th className="num">Price</th><th>Valid</th><th>Order</th><th>Active</th><th /></tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} style={o.active ? undefined : { opacity: 0.55 }}>
                  <td>
                    <span className="swatch" style={{ background: o.color }} aria-hidden="true" /> <b>{o.title}</b>
                    <span className="sub-line">{o.size}</span>
                    {o.priceClash ? <span className="tag bad" style={{ marginTop: 4, display: 'inline-block' }}>Same price as another active offer</span> : null}
                  </td>
                  <td>{CATS[o.cat]}</td>
                  <td className="num">{kesInt(o.price)}</td>
                  <td>{o.valid}</td>
                  <td>{o.sort}</td>
                  <td>
                    <input type="checkbox" checked={o.active} onChange={() => toggle(o)} aria-label={`${o.title} active`} />
                  </td>
                  <td><button type="button" className="btn ghost" onClick={() => startEdit(o)}>Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {offers.length === 0 && <div className="empty">No offers yet. Add your first one.</div>}
        </div>
      )}
    </section>
  );
}
