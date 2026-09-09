import { Sparkles, Environment, Lightformer } from '@react-three/drei';
import { AuroraBackdrop } from './AuroraBackdrop';
import { palette } from '../config/palette';

export function Void() {
  return (
    <>
      <color attach="background" args={[palette.void]} />
      <fogExp2 attach="fog" args={[palette.void, 0.014]} />

      <AuroraBackdrop />

      <Sparkles
        count={140}
        scale={[60, 30, 140]}
        size={2.4}
        speed={0.15}
        opacity={0.35}
        color={palette.cyanLight}
        position={[0, 2, -40]}
      />
      <Sparkles
        count={90}
        scale={[40, 20, 100]}
        size={1.4}
        speed={0.08}
        opacity={0.25}
        color={palette.pink}
        position={[0, -2, -60]}
      />

      <ambientLight intensity={0.7} color="#ffffff" />
      <hemisphereLight args={[palette.cyanLight, palette.purple, 0.55]} />

      <Environment resolution={64}>
        <group rotation={[0, 0.5, 0]}>
          <Lightformer
            intensity={2.5}
            color={palette.pink}
            position={[6, 3, 4]}
            scale={[4, 8, 1]}
          />
          <Lightformer
            intensity={2.5}
            color={palette.cyanLight}
            position={[-6, 2, 4]}
            scale={[4, 8, 1]}
          />
          <Lightformer
            intensity={2}
            color={palette.purple}
            position={[0, 6, -4]}
            scale={[10, 3, 1]}
          />
          <Lightformer
            intensity={1.5}
            color="#ffffff"
            position={[0, -4, 6]}
            scale={[8, 4, 1]}
          />
        </group>
      </Environment>
    </>
  );
}
