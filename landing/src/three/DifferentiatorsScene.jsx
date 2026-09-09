import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ActGroup } from './ActGroup';
import { CheapGlassMaterial } from './materials';
import { SpaceLabel } from './SpaceLabel';
import { DIFFERENTIATORS } from '../config/acts';

function Crystal({ item, index, total }) {
  // Position and spin are tracked on separate refs: the label sits on the
  // (non-spinning) position group so it stays upright and readable instead
  // of tumbling with the crystal's own rotation.
  const groupRef = useRef(null);
  const meshRef = useRef(null);
  const angleOffset = (index / total) * Math.PI * 2;
  const radius = 3.4;

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.12 + angleOffset;
    if (groupRef.current) {
      groupRef.current.position.set(Math.cos(t) * radius, Math.sin(t * 1.3) * 0.6, Math.sin(t) * radius * 0.6);
    }
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.4;
      meshRef.current.rotation.x = clock.elapsedTime * 0.25;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh ref={meshRef}>
        <octahedronGeometry args={[0.42, 0]} />
        <CheapGlassMaterial color={item.color} opacity={0.32} emissiveIntensity={0.7} />
      </mesh>
      <SpaceLabel position={[0, -0.75, 0]} color={item.color} size={11.5} distanceFactor={9}>
        {item.label.toUpperCase()}
      </SpaceLabel>
    </group>
  );
}

function GhostCompetitor({ position, scale }) {
  return (
    <mesh position={position} scale={scale}>
      <icosahedronGeometry args={[1, 0]} />
      <meshBasicMaterial color="#3a3a44" transparent opacity={0.08} wireframe />
    </mesh>
  );
}

export function DifferentiatorsScene({ act }) {
  const ghosts = useMemo(
    () => [
      { position: [-6, 1, -6], scale: 1.4 },
      { position: [6.5, -1.5, -4], scale: 1.1 },
      { position: [0, 2.5, -8], scale: 1.8 },
    ],
    []
  );

  return (
    <ActGroup act={act} buffer={0.04}>
      {DIFFERENTIATORS.map((d, i) => (
        <Crystal key={d.id} item={d} index={i} total={DIFFERENTIATORS.length} />
      ))}
      {ghosts.map((g, i) => (
        <GhostCompetitor key={i} {...g} />
      ))}
      <pointLight position={[0, 3, 2]} color="#ffffff" intensity={3} distance={12} />
    </ActGroup>
  );
}
