import { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { onScrollFrame, scrollState } from '../lib/scrollDriver';

function isInRange(act, buffer) {
  const p = scrollState.progress;
  return p >= act.range[0] - buffer && p <= act.range[1] + buffer;
}

// Positions a group at its act's world coordinates and *unmounts* it
// entirely once scroll progress is well outside its range. Toggling
// Object3D.visible isn't enough here: drei's <Html> labels portal into
// the DOM independently of the mesh tree, so a hidden-but-mounted group
// still leaves its labels showing — a real unmount is what removes them
// (and, as a bonus, stops paying for glass/transmission passes offscreen).
export function ActGroup({ act, buffer = 0.12, children, ...props }) {
  const [mounted, setMounted] = useState(() => isInRange(act, buffer));

  useEffect(
    () =>
      onScrollFrame(() => {
        const next = isInRange(act, buffer);
        setMounted((prev) => (prev !== next ? next : prev));
      }),
    [act, buffer]
  );

  if (!mounted) return null;

  return (
    <group position={act.group} {...props}>
      {children}
    </group>
  );
}

export function useActLocalT(act) {
  const ref = useRef(0);
  useFrame(() => {
    const [start, end] = act.range;
    ref.current = Math.min(1, Math.max(0, (scrollState.progress - start) / (end - start)));
  });
  return ref;
}
