import { useEffect, useState } from 'react';

function detectTier() {
  if (typeof window === 'undefined') return 'full';

  const prefersReducedMotion = window.matchMedia?.(
    '(prefers-reduced-motion: reduce)'
  ).matches;
  if (prefersReducedMotion) return 'reduced';

  const isNarrow = window.innerWidth < 760;
  const isCoarsePointer = window.matchMedia?.('(pointer: coarse)').matches;
  if (isNarrow && isCoarsePointer) return 'reduced';

  let webglOk = false;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl');
    webglOk = !!gl;
  } catch {
    webglOk = false;
  }
  if (!webglOk) return 'reduced';

  const lowCores = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
  if (lowCores && isCoarsePointer) return 'reduced';

  return 'full';
}

// Gates whether the full WebGL scroll experience mounts at all. Anything
// that can't comfortably run it (reduced-motion preference, small/coarse
// touch devices, low core count, no WebGL) gets the static poster fallback.
export function useDeviceTier() {
  const [tier, setTier] = useState(() => detectTier());

  useEffect(() => {
    setTier(detectTier());
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onChange = () => setTier(detectTier());
    mq?.addEventListener?.('change', onChange);
    return () => mq?.removeEventListener?.('change', onChange);
  }, []);

  return tier;
}
