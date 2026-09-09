import { useEffect, useRef } from 'react';
import { onScrollFrame } from '../lib/scrollDriver';

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Imperatively fades/translates a DOM panel in and out across an act's scroll
// range, without ever triggering a React re-render on scroll (style + pointer
// events are written straight to the node from the shared rAF driver).
export function useScrollFade(range, { fadeIn = 0.22, fadeOut = 0.22, rise = 24 } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const [start, end] = range;
    const span = end - start;
    const fadeInEnd = start + span * fadeIn;
    const fadeOutStart = end - span * fadeOut;

    const apply = (progress) => {
      const node = ref.current;
      if (!node) return;

      let opacity = 0;
      if (progress < start || progress > end) {
        opacity = 0;
      } else if (progress < fadeInEnd) {
        opacity = smoothstep(start, fadeInEnd, progress);
      } else if (progress > fadeOutStart) {
        opacity = 1 - smoothstep(fadeOutStart, end, progress);
      } else {
        opacity = 1;
      }

      const translate = rise * (1 - opacity);
      node.style.opacity = opacity.toFixed(4);
      node.style.transform = `translate3d(0, ${translate.toFixed(2)}px, 0)`;
      node.style.pointerEvents = opacity > 0.6 ? 'auto' : 'none';
      node.style.visibility = opacity < 0.005 ? 'hidden' : 'visible';
    };

    return onScrollFrame(apply);
  }, [range, fadeIn, fadeOut, rise]);

  return ref;
}
