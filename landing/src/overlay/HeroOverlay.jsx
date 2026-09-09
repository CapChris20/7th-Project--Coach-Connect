import { useScrollFade } from '../hooks/useScrollFade';
import { ACTS } from '../config/acts';
import { CtaButtons } from './CtaButtons';

const arrival = ACTS.find((a) => a.id === 'arrival');
const heroRange = [0, arrival.range[1] * 0.62];

// The entire first viewport. Hero budget is deliberately strict: brand,
// one headline, one support line, one CTA group — nothing else competes
// with the glass phone + logo materializing behind it.
export function HeroOverlay() {
  const ref = useScrollFade(heroRange, { fadeIn: 0, fadeOut: 0.55, rise: 16 });

  return (
    <div ref={ref} className="panel hero-panel">
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
      <CtaButtons />
    </div>
  );
}
