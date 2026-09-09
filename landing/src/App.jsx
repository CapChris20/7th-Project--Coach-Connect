import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { ACESFilmicToneMapping } from 'three';
import { Scene } from './three/Scene';
import { Overlay } from './overlay/Overlay';
import { FallbackLanding } from './fallback/FallbackLanding';
import { useDeviceTier } from './hooks/useDeviceTier';
import { startScrollDriver } from './lib/scrollDriver';
import { TRACK_VH } from './config/acts';

function Experience() {
  useEffect(() => startScrollDriver(), []);

  return (
    <>
      <div className="scroll-track" style={{ height: `${TRACK_VH}vh` }} aria-hidden="true" />
      <div className="canvas-stage">
        <Canvas
          gl={{ antialias: true, toneMapping: ACESFilmicToneMapping, powerPreference: 'high-performance' }}
          dpr={[1, 1.75]}
          camera={{ fov: 45, near: 0.1, far: 300, position: [0, 0.3, 9] }}
        >
          <Scene />
        </Canvas>
      </div>
      <Overlay />
    </>
  );
}

export default function App() {
  const tier = useDeviceTier();

  if (tier === 'reduced') {
    return <FallbackLanding />;
  }

  return <Experience />;
}
