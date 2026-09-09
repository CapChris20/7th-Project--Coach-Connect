import { useScrollFade } from '../hooks/useScrollFade';

export function PricingPanel({ act }) {
  const ref = useScrollFade(act.range);
  const { kicker, heading, support } = act.overlay;

  return (
    <div ref={ref} className="panel act-panel act-panel-left pricing-panel">
      {kicker && <p className="kicker">{kicker}</p>}
      {heading && <h2 className="heading pricing-heading">{heading}</h2>}
      {support && <p className="support">{support}</p>}
      <p className="fine-print">
        Clients use Coach Connect free. They pay their coach directly in-app via
        Stripe — trainers keep 90%.
      </p>
      <div className="cta-group">
        <button type="button" className="btn btn-primary">
          Start free trial
        </button>
      </div>
    </div>
  );
}
