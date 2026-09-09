import { useEffect, useRef } from 'react';
import { onScrollFrame } from '../lib/scrollDriver';
import { useScrollFade } from '../hooks/useScrollFade';
import { scrollToProgress } from '../lib/scrollTo';
import { ACTS } from '../config/acts';

function ProgressBar() {
  const ref = useRef(null);
  useEffect(
    () =>
      onScrollFrame((p) => {
        if (ref.current) ref.current.style.transform = `scaleX(${p})`;
      }),
    []
  );
  return (
    <div className="progress-track">
      <div ref={ref} className="progress-fill" />
    </div>
  );
}

function NavRail() {
  const dotsRef = useRef([]);

  useEffect(
    () =>
      onScrollFrame((p) => {
        ACTS.forEach((act, i) => {
          const dot = dotsRef.current[i];
          if (!dot) return;
          const active = p >= act.range[0] && p < act.range[1];
          dot.dataset.active = active ? 'true' : 'false';
        });
      }),
    []
  );

  return (
    <nav className="nav-rail" aria-label="Section navigation">
      {ACTS.map((act, i) => (
        <button
          key={act.id}
          ref={(el) => (dotsRef.current[i] = el)}
          type="button"
          className="nav-dot"
          aria-label={act.id}
          onClick={() => scrollToProgress(act.range[0] + 0.01)}
        />
      ))}
    </nav>
  );
}

// Chrome that appears once the hero has scrolled by — a top progress line
// and a wayfinding rail of dots. Deliberately absent from the first
// viewport so it never competes with the hero budget.
export function HudChrome() {
  const arrivalEnd = ACTS[0].range[1];
  const ref = useScrollFade([arrivalEnd * 0.75, 1], { fadeIn: 0.4, fadeOut: 0, rise: 0 });

  return (
    <div ref={ref} className="hud-chrome">
      <ProgressBar />
      <NavRail />
    </div>
  );
}
