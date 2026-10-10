import { useSearchParams } from 'react-router-dom';
import { CategoryTabs, OfferGrid } from '../components/Offers.jsx';
import { useOffers } from '../lib/hooks';
import { CATS } from '../lib/format';

export default function Buy() {
  const [params, setParams] = useSearchParams();
  const { offers, loading, error } = useOffers();
  const cat = CATS[params.get('cat')] ? params.get('cat') : 'data';
  

  const set = (key, value) => {
    const p = new URLSearchParams(params);
    p.set(key, value);
    setParams(p, { replace: true });
  };

  const list = offers.filter((o) => o.cat === cat);
  return (
    <div className="wrap">
      <div className="pageh"><h1>Buy bundles</h1><p>Pick a network and a bundle. Delivery takes seconds after you pay.</p></div>
      <section className="card" style={{ margin: '18px 0 40px' }}>
        <div className="head" style={{ marginBottom: 12 }}>
          <CategoryTabs value={cat} onChange={(v) => set('cat', v)} />
        </div>
        
        <OfferGrid
          offers={list}
          loading={loading}
          error={error}
          emptyText={`No ${CATS[cat].toLowerCase()} available right now.`}
        />
      </section>
    </div>
  );
}
