import { useApp } from '../context/AppContext.jsx';
import { CATS, NETS, kesInt } from '../lib/format';

export function CategoryTabs({ value, onChange }) {
  return (
    <div className="tabs" role="group" aria-label="Offer type">
      {Object.entries(CATS).map(([k, v]) => (
        <button key={k} type="button" aria-pressed={k === value} onClick={() => onChange(k)}>{v}</button>
      ))}
    </div>
  );
}

export function OfferCard({ offer }) {
  const { buy } = useApp();
  return (
    <article className="offer">
      <span className="size" style={{ '--c': offer.color }}>{offer.size}</span>
      <h3>{offer.title}</h3>
      <div className="meta">
        <span className={`net ${offer.net}`}>{NETS[offer.net]}</span>
        <span>Valid {offer.valid}</span>
      </div>
      <div className="price">{kesInt(offer.price)}</div>
      <button
        type="button"
        className="btn primary block"
        onClick={() => buy(offer)}
        aria-label={`Buy ${offer.title} on ${NETS[offer.net]} for ${kesInt(offer.price)}`}
      >Buy now</button>
    </article>
  );
}

export function OfferGrid({ offers, loading, error, emptyText }) {
  if (loading) return <div className="empty">Loading offers…</div>;
  if (error) return <div className="empty">We could not load the offers. Check your connection and refresh the page.</div>;
  if (!offers.length) return <div className="empty">{emptyText || 'No offers here yet.'}</div>;
  return <div className="offers">{offers.map((o) => <OfferCard key={o.id} offer={o} />)}</div>;
}
