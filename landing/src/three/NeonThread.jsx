import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { QuadraticBezierLine } from '@react-three/drei';
import { QuadraticBezierCurve3, Vector3, AdditiveBlending } from 'three';
import { accentColor } from './accent';

// A thin neon curve between two points (messaging / plans / payments /
// tool-call threads), with an optional bright pulse traveling along it to
// suggest live data flow rather than a static wire.
export function NeonThread({
  start,
  end,
  mid,
  color = 'cyan',
  lineWidth = 1.4,
  opacity = 0.8,
  pulse = true,
  pulseSpeed = 0.35,
  pulseOffset = 0,
}) {
  const hex = accentColor(color);
  const pulseRef = useRef(null);

  const curve = useMemo(() => {
    const s = new Vector3(...start);
    const e = new Vector3(...end);
    const m = mid
      ? new Vector3(...mid)
      : new Vector3((s.x + e.x) / 2, Math.max(s.y, e.y) + 1.4, (s.z + e.z) / 2);
    return new QuadraticBezierCurve3(s, m, e);
  }, [start, end, mid]);

  useFrame(({ clock }) => {
    if (!pulse || !pulseRef.current) return;
    const t = (clock.elapsedTime * pulseSpeed + pulseOffset) % 1;
    const p = curve.getPoint(t);
    pulseRef.current.position.copy(p);
    const fade = Math.sin(t * Math.PI);
    pulseRef.current.material.opacity = fade;
  });

  return (
    <group>
      <QuadraticBezierLine
        start={curve.v0}
        end={curve.v2}
        mid={curve.v1}
        color={hex}
        lineWidth={lineWidth}
        transparent
        opacity={opacity}
        toneMapped={false}
      />
      {pulse && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[0.09, 12, 12]} />
          <meshBasicMaterial color={hex} transparent blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      )}
    </group>
  );
}
