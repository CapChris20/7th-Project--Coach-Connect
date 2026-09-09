import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D, Color, AdditiveBlending } from 'three';
import { ActGroup } from './ActGroup';
import { CheapGlassMaterial } from './materials';
import { SpaceLabel } from './SpaceLabel';
import { accentColor } from './accent';
import { CLIENT_SATELLITES } from '../config/acts';

const dummy = new Object3D();
const NODE_COUNT = 18;

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function Constellation() {
  const meshRef = useRef(null);
  const groupRef = useRef(null);

  const nodes = useMemo(() => {
    const rand = seededRandom(42);
    return new Array(NODE_COUNT).fill(0).map(() => {
      const radius = 2.0 + rand() * 2.2;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 2 - 1);
      return {
        pos: [
          radius * Math.sin(phi) * Math.cos(theta),
          radius * Math.cos(phi) * 0.6,
          radius * Math.sin(phi) * Math.sin(theta) * 0.8,
        ],
        scale: 0.5 + rand() * 0.6,
        color: rand() > 0.5 ? accentColor('pink') : accentColor('cyanLight'),
        speed: 0.2 + rand() * 0.3,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (groupRef.current) groupRef.current.rotation.y = clock.elapsedTime * 0.05;
    if (!meshRef.current) return;
    nodes.forEach((n, i) => {
      const bob = Math.sin(clock.elapsedTime * n.speed + i) * 0.15;
      dummy.position.set(n.pos[0], n.pos[1] + bob, n.pos[2]);
      dummy.scale.setScalar(n.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      meshRef.current.setColorAt(i, new Color(n.color));
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <group ref={groupRef} position={[0, 0.6, 0]}>
      <instancedMesh ref={meshRef} args={[null, null, NODE_COUNT]}>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshBasicMaterial
          transparent
          opacity={0.85}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </instancedMesh>
    </group>
  );
}

function SatelliteOrb({ satellite, position }) {
  const [hovered, setHovered] = useState(false);
  const ref = useRef(null);

  useFrame(({ clock }) => {
    if (!ref.current) return;
    const target = hovered ? 1.35 : 1;
    ref.current.scale.lerp({ x: target, y: target, z: target }, 0.1);
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 0.4 + position[0]) * 0.14;
  });

  return (
    <group position={position}>
      <mesh
        ref={ref}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[0.42, 32, 32]} />
        <CheapGlassMaterial
          color={satellite.color}
          opacity={hovered ? 0.4 : 0.26}
          emissiveIntensity={hovered ? 0.9 : 0.5}
        />
      </mesh>
      <SpaceLabel position={[0, -0.75, 0]} color={satellite.color} size={11} opacity={hovered ? 1 : 0.7}>
        {satellite.label.toUpperCase()}
      </SpaceLabel>
    </group>
  );
}

function AICompanionOrb() {
  const coreRef = useRef(null);
  const sparksRef = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (coreRef.current) {
      coreRef.current.scale.setScalar(1 + Math.sin(t * 1.4) * 0.06);
      coreRef.current.rotation.y = t * 0.3;
    }
    sparksRef.current.forEach((s, i) => {
      if (!s) return;
      const angle = t * (0.8 + i * 0.15) + i * 2.4;
      const radius = 0.85 + Math.sin(t * 0.6 + i) * 0.08;
      s.position.set(Math.cos(angle) * radius, Math.sin(t * 0.7 + i) * 0.3, Math.sin(angle) * radius);
    });
  });

  return (
    <group position={[0, 2.6, -2.2]}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.55, 32, 32]} />
        <CheapGlassMaterial color="purple" opacity={0.35} emissiveIntensity={0.9} />
      </mesh>
      {new Array(6).fill(0).map((_, i) => (
        <mesh key={i} ref={(el) => (sparksRef.current[i] = el)}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial
            color={accentColor('cyanLight')}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}
      <SpaceLabel position={[0, -0.95, 0]} color="purple" size={12}>
        AI COACH
      </SpaceLabel>
    </group>
  );
}

export function ClientLaneScene({ act }) {
  return (
    <ActGroup act={act} buffer={0.045}>
      <Constellation />
      <AICompanionOrb />
      {CLIENT_SATELLITES.filter((s) => s.id !== 'ai-coach').map((s, i) => {
        const angle = (i / (CLIENT_SATELLITES.length - 1)) * Math.PI * 1.4 - 0.7;
        const radius = 3.6;
        return (
          <SatelliteOrb
            key={s.id}
            satellite={s}
            position={[Math.cos(angle) * radius, -0.6 + Math.sin(angle) * 0.6, Math.sin(angle) * radius * 0.7 - 1]}
          />
        );
      })}
      <pointLight position={[2, 2, 2]} color="#ff6b9d" intensity={5} distance={10} />
      <pointLight position={[-2, 1, -1]} color="#64d2ff" intensity={5} distance={10} />
    </ActGroup>
  );
}
