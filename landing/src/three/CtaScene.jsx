import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture, RoundedBox } from '@react-three/drei';
import { AdditiveBlending } from 'three';
import { ActGroup } from './ActGroup';
import { PremiumGlassMaterial } from './materials';
import logoUrl from '../assets/coach-connect-mark.jpg';

export function CtaScene({ act }) {
  const groupRef = useRef(null);
  const texture = useTexture(logoUrl);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.15) * 0.15;
    groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.3) * 0.08;
  });

  return (
    <ActGroup act={act} buffer={0.045}>
      <group ref={groupRef} scale={0.75}>
        <RoundedBox args={[2.3, 4.7, 0.22]} radius={0.32} smoothness={6}>
          <PremiumGlassMaterial color="pink" thickness={1.4} />
        </RoundedBox>
        <mesh position={[0, 0, 0.4]} scale={0.55}>
          <planeGeometry args={[3.6, 3.6]} />
          <meshBasicMaterial
            map={texture}
            transparent
            opacity={0.9}
            blending={AdditiveBlending}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      </group>

      <pointLight position={[2, 1, 3]} color="#ff6b9d" intensity={7} distance={12} />
      <pointLight position={[-2, -1, 2]} color="#f97316" intensity={5} distance={12} />
    </ActGroup>
  );
}
