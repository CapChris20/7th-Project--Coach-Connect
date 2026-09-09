import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CatmullRomCurve3, Vector3, AdditiveBlending } from 'three';
import { ActGroup } from './ActGroup';
import { CheapGlassMaterial } from './materials';
import { SpaceLabel } from './SpaceLabel';
import { accentColor } from './accent';

const CARD_COUNT = 5;

function ClientCardStack() {
  const spinRef = useRef(null);

  useFrame(({ clock }) => {
    if (spinRef.current) spinRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.12) * 0.08;
  });

  return (
    <group position={[-1.2, 0.3, 0.4]} rotation={[0, 0.35, 0]}>
      <group ref={spinRef}>
        {new Array(CARD_COUNT).fill(0).map((_, i) => (
          <RoundedBox
            key={i}
            args={[1.7, 2.2, 0.06]}
            radius={0.1}
            position={[i * 0.32, i * -0.16, -i * 0.5]}
          >
            <CheapGlassMaterial color={i % 2 === 0 ? 'purple' : 'orange'} opacity={0.24} emissiveIntensity={0.4} />
          </RoundedBox>
        ))}
      </group>
      <SpaceLabel position={[0.5, -1.7, 0]} color="purple" size={12}>
        CLIENT CRM
      </SpaceLabel>
    </group>
  );
}

function PlanRibbon({ points, color, offset = 0 }) {
  const matRef = useRef(null);
  const curve = useMemo(() => new CatmullRomCurve3(points.map((p) => new Vector3(...p))), [points]);
  const geometry = useMemo(() => [curve, 80, 0.025, 8, false], [curve]);

  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.5 + Math.sin(clock.elapsedTime * 0.6 + offset) * 0.2;
    }
  });

  return (
    <mesh>
      <tubeGeometry args={geometry} />
      <meshBasicMaterial
        ref={matRef}
        color={accentColor(color)}
        transparent
        opacity={0.6}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

const CLIENT_NODE = [3.0, 0.6, 1.4];
const TRAINER_VAULT = [-2.4, -0.2, -0.6];
const PLATFORM_NODE = [-0.6, -1.6, 1.2];

function MoneyFlow() {
  const mainCurve = useMemo(
    () => new CatmullRomCurve3([new Vector3(...CLIENT_NODE), new Vector3(0, 0.4, 0.6), new Vector3(...TRAINER_VAULT)]),
    []
  );
  const shardCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(0.2, 0.2, 0.3),
        new Vector3(-0.4, -0.9, 0.7),
        new Vector3(...PLATFORM_NODE),
      ]),
    []
  );

  const mainParticles = useRef([]);
  const shardParticles = useRef([]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    mainParticles.current.forEach((m, i) => {
      if (!m) return;
      const local = ((t * 0.18 + i / 4) % 1);
      const p = mainCurve.getPoint(local);
      m.position.copy(p);
      m.material.opacity = Math.sin(local * Math.PI);
    });
    shardParticles.current.forEach((m, i) => {
      if (!m) return;
      const local = ((t * 0.18 + i / 2 + 0.15) % 1);
      const p = shardCurve.getPoint(local);
      m.position.copy(p);
      m.material.opacity = Math.sin(local * Math.PI) * 0.8;
    });
  });

  return (
    <group>
      {new Array(4).fill(0).map((_, i) => (
        <mesh key={i} ref={(el) => (mainParticles.current[i] = el)}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshBasicMaterial color={accentColor('green')} transparent blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
      {new Array(2).fill(0).map((_, i) => (
        <mesh key={i} ref={(el) => (shardParticles.current[i] = el)}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshBasicMaterial color={accentColor('orange')} transparent blending={AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}

      <SpaceLabel position={CLIENT_NODE} color="green" size={11} distanceFactor={8}>
        CLIENT PAYS
      </SpaceLabel>
      <SpaceLabel position={TRAINER_VAULT} color="green" size={12} distanceFactor={8}>
        YOU KEEP 90%
      </SpaceLabel>
      <SpaceLabel position={PLATFORM_NODE} color="orange" size={10} distanceFactor={8} opacity={0.55}>
        PLATFORM 10%
      </SpaceLabel>
    </group>
  );
}

export function TrainerLaneScene({ act }) {
  return (
    <ActGroup act={act} buffer={0.045}>
      <ClientCardStack />
      <MoneyFlow />
      <PlanRibbon
        points={[
          [-3.2, 1.4, -1.5],
          [-2.0, 1.8, -0.8],
          [-1.2, 1.5, 0.3],
          [-2.4, 1.1, 1.2],
        ]}
        color="orange"
      />
      <PlanRibbon
        points={[
          [-3.4, 0.9, -1.8],
          [-2.4, 1.3, -1.0],
          [-1.6, 1.0, 0.0],
          [-2.6, 0.6, 0.9],
        ]}
        color="purple"
        offset={1.2}
      />
      <pointLight position={[-2, 1, 1]} color="#c084fc" intensity={5} distance={10} />
      <pointLight position={[2, 0, -1]} color="#f97316" intensity={5} distance={10} />
    </ActGroup>
  );
}
