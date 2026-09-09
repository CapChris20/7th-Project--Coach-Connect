import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from 'three';
import { ActGroup } from './ActGroup';
import { CheapGlassMaterial } from './materials';
import { NeonThread } from './NeonThread';
import { SpaceLabel } from './SpaceLabel';

// Shifted right of world-origin so the orbit composition clears the
// left-aligned text panel instead of sitting behind it.
const CLIENT_POS = [-0.6, 0.35, 1.0];
const TRAINER_POS = [5.6, -0.25, -0.8];

export function ConnectionScene({ act }) {
  const nucleusRef = useRef(null);
  const clientRef = useRef(null);
  const trainerRef = useRef(null);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (nucleusRef.current) nucleusRef.current.rotation.y = t * 0.25;
    if (clientRef.current) clientRef.current.position.y = CLIENT_POS[1] + Math.sin(t * 0.5) * 0.12;
    if (trainerRef.current)
      trainerRef.current.position.y = TRAINER_POS[1] + Math.cos(t * 0.45) * 0.12;
  });

  const nucleusPos = [2.5, 0.05, 0.1];

  return (
    <ActGroup act={act} buffer={0.04}>
      <mesh ref={nucleusRef} position={nucleusPos}>
        <icosahedronGeometry args={[0.42, 1]} />
        <meshBasicMaterial
          color="#ffffff"
          wireframe
          transparent
          opacity={0.6}
          toneMapped={false}
        />
      </mesh>
      <mesh position={nucleusPos}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshBasicMaterial color="#c084fc" blending={AdditiveBlending} toneMapped={false} />
      </mesh>
      <pointLight position={nucleusPos} color="#c084fc" intensity={8} distance={16} />

      <mesh ref={clientRef} position={CLIENT_POS}>
        <sphereGeometry args={[0.62, 32, 32]} />
        <CheapGlassMaterial color="pink" opacity={0.28} emissiveIntensity={0.5} />
      </mesh>
      <SpaceLabel position={[CLIENT_POS[0], CLIENT_POS[1] - 1.15, CLIENT_POS[2]]} color="pink" size={13}>
        CLIENT
      </SpaceLabel>

      <mesh ref={trainerRef} position={TRAINER_POS}>
        <sphereGeometry args={[0.62, 32, 32]} />
        <CheapGlassMaterial color="purple" opacity={0.28} emissiveIntensity={0.5} />
      </mesh>
      <SpaceLabel position={[TRAINER_POS[0], TRAINER_POS[1] - 1.15, TRAINER_POS[2]]} color="purple" size={13}>
        TRAINER
      </SpaceLabel>

      <NeonThread
        start={CLIENT_POS}
        end={TRAINER_POS}
        mid={[nucleusPos[0], 1.15, 1.2]}
        color="cyan"
        pulseSpeed={0.22}
        pulseOffset={0}
      />
      <NeonThread
        start={CLIENT_POS}
        end={TRAINER_POS}
        mid={[nucleusPos[0], 0.15, -0.6]}
        color="purple"
        pulseSpeed={0.17}
        pulseOffset={0.33}
      />
      <NeonThread
        start={CLIENT_POS}
        end={TRAINER_POS}
        mid={[nucleusPos[0], -0.95, 0.4]}
        color="green"
        pulseSpeed={0.26}
        pulseOffset={0.66}
      />
    </ActGroup>
  );
}
