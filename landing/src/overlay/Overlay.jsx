import { ACTS } from '../config/acts';
import { HeroOverlay } from './HeroOverlay';
import { ActPanel } from './ActPanel';
import { PricingPanel } from './PricingPanel';
import { CtaPanel } from './CtaPanel';
import { HudChrome } from './HudChrome';

const actById = Object.fromEntries(ACTS.map((a) => [a.id, a]));

export function Overlay() {
  return (
    <div className="overlay-root">
      <HudChrome />
      <HeroOverlay />
      <ActPanel act={actById.connection} side="left" />
      <ActPanel act={actById['client-lane']} side="left" />
      <ActPanel act={actById['trainer-lane']} side="left" />
      <ActPanel act={actById.differentiators} side="left" />
      <PricingPanel act={actById.pricing} />
      <CtaPanel act={actById.cta} />
    </div>
  );
}
