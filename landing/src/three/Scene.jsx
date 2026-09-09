import { Suspense } from 'react';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { ACTS } from '../config/acts';
import { Void } from './Void';
import { CameraRig } from './CameraRig';
import { ArrivalScene } from './ArrivalScene';
import { ConnectionScene } from './ConnectionScene';
import { ClientLaneScene } from './ClientLaneScene';
import { TrainerLaneScene } from './TrainerLaneScene';
import { DifferentiatorsScene } from './DifferentiatorsScene';
import { PricingScene } from './PricingScene';
import { CtaScene } from './CtaScene';

const actById = Object.fromEntries(ACTS.map((a) => [a.id, a]));

export function Scene() {
  return (
    <>
      <CameraRig />
      <Void />

      <Suspense fallback={null}>
        <ArrivalScene act={actById.arrival} />
        <ConnectionScene act={actById.connection} />
        <ClientLaneScene act={actById['client-lane']} />
        <TrainerLaneScene act={actById['trainer-lane']} />
        <DifferentiatorsScene act={actById.differentiators} />
        <PricingScene act={actById.pricing} />
        <CtaScene act={actById.cta} />
      </Suspense>

      <EffectComposer multisampling={0}>
        <Bloom
          mipmapBlur
          luminanceThreshold={0.22}
          luminanceSmoothing={0.85}
          intensity={0.65}
          radius={0.8}
        />
        <Vignette eskil={false} offset={0.2} darkness={0.45} />
      </EffectComposer>
    </>
  );
}
