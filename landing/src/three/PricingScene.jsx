import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { ActGroup } from './ActGroup';
import { PremiumGlassMaterial } from './materials';
import { SpaceLabel } from './SpaceLabel';
import { PRICING_BENEFITS } from '../config/acts';

export function PricingScene({ act }) {
  const monolithRef = useRef(null);

  useFrame(({ clock }) => {
    if (!monolithRef.current) return;
    monolithRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.12;
  });

  return (
    <ActGroup act={act} buffer={0.04}>
      <group position={[0, 0.2, 0]}>
        <RoundedBox ref={monolithRef} args={[1.6, 4.2, 0.35]} radius={0.14} smoothness={6}>
          <PremiumGlassMaterial color="cyan" thickness={1.8} />
        </RoundedBox>

        <SpaceLabel position={[0, 1.8, 0.5]} color="cyanLight" size={15} weight={700} distanceFactor={7}>
          COACH CONNECT PRO
        </SpaceLabel>

        {PRICING_BENEFITS.map((b, i) => (
          <SpaceLabel
            key={b.label}
            position={[0, 0.7 - i * 0.42, 0.5]}
            color={b.color}
            size={11.5}
            distanceFactor={7}
            opacity={0.85}
          >
            · {b.label.toUpperCase()}
          </SpaceLabel>
        ))}
      </group>

      <pointLight position={[1.5, 1, 2]} color="#64d2ff" intensity={6} distance={10} />
      <pointLight position={[-1.5, -1, 1]} color="#c084fc" intensity={5} distance={10} />
    </ActGroup>
  );
}
