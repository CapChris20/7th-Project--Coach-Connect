import { ACTS, DIFFERENTIATORS, PRICING_BENEFITS } from '../config/acts';
import logoUrl from '../assets/coach-connect-mark.jpg';

const actById = Object.fromEntries(ACTS.map((a) => [a.id, a]));

// Static poster fallback for reduced-motion, low-GPU, and small touch
// devices — same brand, copy, and palette as the 3D experience, laid out
// as an ordinary scrolling page with no WebGL cost.
export function FallbackLanding() {
  return (
    <main className="fallback">
      <section className="fallback-hero">
        <img src={logoUrl} alt="Coach Connect" className="fallback-logo" />
        <p className="brand-wordmark">
          <span className="brand-line brand-coach">COACH</span>
          <span className="brand-line brand-connect">CONNECT</span>
        </p>
        <h1 className="heading hero-heading">
          Find your coach. Run your business. One app.
        </h1>
        <p className="support hero-support">
          Trainers and clients finally share the same system — plans, nutrition,
          messaging, payments, and optional AI tools.
        </p>
        <div className="cta-group">
          <button type="button" className="btn btn-primary">
            Get Started
          </button>
          <button type="button" className="btn btn-secondary">
            I&rsquo;m a Trainer
          </button>
        </div>
      </section>

      {['connection', 'client-lane', 'trainer-lane'].map((id) => {
        const act = actById[id];
        return (
          <section key={id} className="fallback-section">
            {act.overlay.kicker && <p className="kicker">{act.overlay.kicker}</p>}
            <h2 className="heading">{act.overlay.heading}</h2>
            {act.overlay.support && <p className="support">{act.overlay.support}</p>}
          </section>
        );
      })}

      <section className="fallback-section">
        <p className="kicker">{actById.differentiators.overlay.kicker}</p>
        <h2 className="heading">{actById.differentiators.overlay.heading}</h2>
        <ul className="fallback-list">
          {DIFFERENTIATORS.map((d) => (
            <li key={d.id}>
              <strong>{d.label}</strong> — {d.detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="fallback-section fallback-pricing">
        <p className="kicker">{actById.pricing.overlay.kicker}</p>
        <h2 className="heading pricing-heading">{actById.pricing.overlay.heading}</h2>
        <p className="support">{actById.pricing.overlay.support}</p>
        <ul className="fallback-benefits">
          {PRICING_BENEFITS.map((b) => (
            <li key={b.label}>{b.label}</li>
          ))}
        </ul>
        <p className="fine-print">
          Clients use Coach Connect free. They pay their coach directly in-app
          via Stripe — trainers keep 90%.
        </p>
        <div className="cta-group">
          <button type="button" className="btn btn-primary">
            Start free trial
          </button>
        </div>
      </section>

      <section className="fallback-section fallback-cta">
        <h2 className="heading cta-heading">{actById.cta.overlay.heading}</h2>
        <p className="support">{actById.cta.overlay.support}</p>
        <div className="cta-group">
          <button type="button" className="btn btn-primary">
            Get Started
          </button>
          <button type="button" className="btn btn-secondary">
            I&rsquo;m a Trainer
          </button>
        </div>
        <footer className="legal-footer">
          <span>&copy; {new Date().getFullYear()} Coach Connect</span>
          <span aria-hidden="true">&middot;</span>
          <a href="#privacy">Privacy</a>
          <span aria-hidden="true">&middot;</span>
          <a href="#terms">Terms</a>
        </footer>
      </section>
    </main>
  );
}
