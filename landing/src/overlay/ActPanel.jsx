import { useScrollFade } from '../hooks/useScrollFade';

export function ActPanel({ act, side = 'left', children }) {
  const ref = useScrollFade(act.range);
  const { kicker, heading, support } = act.overlay;

  return (
    <div ref={ref} className={`panel act-panel act-panel-${side}`}>
      {kicker && <p className="kicker">{kicker}</p>}
      {heading && <h2 className="heading">{heading}</h2>}
      {support && <p className="support">{support}</p>}
      {children}
    </div>
  );
}
