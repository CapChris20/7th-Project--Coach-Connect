import { scrollToProgress } from '../lib/scrollTo';
import { ACTS } from '../config/acts';

const pricingAct = ACTS.find((a) => a.id === 'pricing');
const trainerAct = ACTS.find((a) => a.id === 'trainer-lane');

export function CtaButtons({ align = 'flex-start' }) {
  return (
    <div className="cta-group" style={{ justifyContent: align }}>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => scrollToProgress(pricingAct.range[0] + 0.02)}
      >
        Get Started
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        onClick={() => scrollToProgress(trainerAct.range[0] + 0.02)}
      >
        I&rsquo;m a Trainer
      </button>
    </div>
  );
}
