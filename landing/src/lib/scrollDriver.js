import { ACTS } from '../config/acts';

// Plain mutable state read directly inside R3F's useFrame hot path —
// deliberately outside React/zustand so camera updates never trigger re-renders.
export const scrollState = {
  progress: 0,
  activeIndex: 0,
};

const frameListeners = new Set();
const actChangeListeners = new Set();

export function onScrollFrame(cb) {
  frameListeners.add(cb);
  return () => frameListeners.delete(cb);
}

export function onActChange(cb) {
  actChangeListeners.add(cb);
  return () => actChangeListeners.delete(cb);
}

function findActiveIndex(progress) {
  for (let i = 0; i < ACTS.length; i++) {
    const [start, end] = ACTS[i].range;
    if (progress >= start && progress < end) return i;
  }
  return ACTS.length - 1;
}

let started = false;
let rafId = null;

export function startScrollDriver() {
  if (started) return () => {};
  started = true;

  const tick = () => {
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, Math.max(0, scrollTop / max)) : 0;

    scrollState.progress = progress;
    document.documentElement.style.setProperty('--scroll', progress.toFixed(5));

    const nextIndex = findActiveIndex(progress);
    if (nextIndex !== scrollState.activeIndex) {
      scrollState.activeIndex = nextIndex;
      const act = ACTS[nextIndex];
      document.body.dataset.theme = act.theme;
      actChangeListeners.forEach((cb) => cb(nextIndex, act));
    }

    frameListeners.forEach((cb) => cb(progress));
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return () => {
    started = false;
    if (rafId) cancelAnimationFrame(rafId);
  };
}
