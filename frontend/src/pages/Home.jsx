import { useState } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero.jsx';
import { CategoryTabs, OfferGrid } from '../components/Offers.jsx';
import { AccountCard, GuestCard, HowItWorks, RecentOrders, ReferBanner, ReferralCard } from '../components/Cards.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useOffers } from '../lib/hooks';
import { CATS } from '../lib/format';

export default function Home() {
  const { account } = useAuth();
  const { offers, loading, error } = useOffers();
  const [cat, setCat] = useState('data');
  const shown = offers.filter((o) => o.cat === cat).slice(0, 5);

  return (
    <>
      <Hero />
      <div className="wrap layout">
        <div className="stack">
          <section className="card" id="offers">
            <div className="head">
              <div>
                <h2>Popular offers</h2>
                <p className="muted">Choose your preferred bundle and get connected instantly.</p>
              </div>
              <CategoryTabs value={cat} onChange={setCat} />
            </div>
            <OfferGrid offers={shown} loading={loading} error={error} />
            <div className="more">
              <Link className="linkbtn" to={`/buy?cat=${cat}`}>See all {CATS[cat].toLowerCase()}</Link>
            </div>
          </section>
          <HowItWorks />
        </div>
        <aside className="stack" aria-label="Your account summary">
          {account ? (<><AccountCard /><ReferralCard /><RecentOrders /></>) : <GuestCard />}
          <ReferBanner />
        </aside>
      </div>
    </>
  );
}
