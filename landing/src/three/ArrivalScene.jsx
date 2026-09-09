import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, RoundedBox } from '@react-three/drei';
import { AdditiveBlending } from 'three';
import { ActGroup } from './ActGroup';
import { PremiumGlassMaterial } from './materials';
import { SpaceLabel } from './SpaceLabel';
import { scrollState } from '../lib/scrollDriver';
import logoUrl from '../assets/coach-connect-mark.jpg';

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function LogoMark({ act }) {
  const texture = useTexture(logoUrl);
  const meshRef = useRef(null);

  useFrame(({ clock }) => {
    const [start, end] = act.range;
    const p = scrollState.progress;
    const local = (p - start) / (end - start);

    const fadeIn = smoothstep((local - 0.05) / 0.3);
    const fadeOut = 1 - smoothstep((local - 0.75) / 0.25);
    const opacity = Math.max(0, Math.min(fadeIn, fadeOut));

    if (meshRef.current) {
      meshRef.current.material.opacity = opacity * 1.1;
      const breathe = 1 + Math.sin(clock.elapsedTime * 0.6) * 0.02;
      meshRef.current.scale.setScalar((0.55 + fadeIn * 0.05) * breathe);
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0.4]}>
      <planeGeometry args={[3.6, 3.6]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0}
        blending={AdditiveBlending}
        toneMapped={false}
        depthWrite={false}
      />
    </mesh>
  );
}

export function ArrivalScene({ act }) {
  const phoneRef = useRef(null);

  useFrame(({ clock }) => {
    if (!phoneRef.current) return;
    phoneRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.18) * 0.22;
    phoneRef.current.rotation.x = Math.cos(clock.elapsedTime * 0.14) * 0.05;
    phoneRef.current.position.y = Math.sin(clock.elapsedTime * 0.35) * 0.12;
  });

  return (
    <ActGroup act={act} buffer={0.05}>
      <group ref={phoneRef}>
        <RoundedBox args={[2.3, 4.7, 0.22]} radius={0.32} smoothness={6}>
          <PremiumGlassMaterial color="purple" thickness={1.4} />
        </RoundedBox>
        <LogoMark act={act} />
      </group>

      <SpaceLabel
        position={[-4.6, 1.6, -2.5]}
        rotation={[0, 0.3, 0]}
        color="pink"
        size={13}
        weight={500}
        opacity={0.55}
        distanceFactor={9}
      >
        ONE DAY OR DAY ONE.
      </SpaceLabel>

      <pointLight position={[3, 2, 3]} color="#ff6b9d" intensity={8} distance={12} />
      <pointLight position={[-3, -1, 2]} color="#64d2ff" intensity={6} distance={12} />
    </ActGroup>
  );
}
