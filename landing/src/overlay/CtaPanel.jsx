import { useScrollFade } from '../hooks/useScrollFade';
import { CtaButtons } from './CtaButtons';

export function CtaPanel({ act }) {
  const ref = useScrollFade(act.range, { fadeOut: 0, rise: 16 });
  const { heading, support } = act.overlay;

  return (
    <div ref={ref} className="panel act-panel act-panel-center cta-panel">
      <h2 className="heading cta-heading">{heading}</h2>
      <p className="support">{support}</p>
      <CtaButtons align="center" />
      <footer className="legal-footer">
        <span>&copy; {new Date().getFullYear()} Coach Connect</span>
        <span aria-hidden="true">&middot;</span>
        <a href="#privacy">Privacy</a>
        <span aria-hidden="true">&middot;</span>
        <a href="#terms">Terms</a>
      </footer>
    </div>
  );
}
