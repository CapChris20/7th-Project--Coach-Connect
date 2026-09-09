import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import { easing } from 'maath';
import { ACTS } from '../config/acts';
import { scrollState } from '../lib/scrollDriver';

function smoothstep(t) {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export function CameraRig() {
  const { camera } = useThree();

  const keyframes = useMemo(
    () =>
      ACTS.map((act) => ({
        t: (act.range[0] + act.range[1]) / 2,
        pos: new Vector3(...act.camera.pos),
        look: new Vector3(...act.camera.look),
        fov: act.camera.fov,
      })),
    []
  );

  const targetPos = useRef(new Vector3().copy(keyframes[0].pos));
  const targetLook = useRef(new Vector3().copy(keyframes[0].look));
  const currentLook = useRef(new Vector3().copy(keyframes[0].look));
  const targetFov = useRef(keyframes[0].fov);

  useFrame((_, delta) => {
    const p = scrollState.progress;

    let k0 = keyframes[0];
    let k1 = keyframes[keyframes.length - 1];
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (p >= keyframes[i].t && p <= keyframes[i + 1].t) {
        k0 = keyframes[i];
        k1 = keyframes[i + 1];
        break;
      }
      if (p < keyframes[0].t) {
        k0 = keyframes[0];
        k1 = keyframes[0];
        break;
      }
      if (p > keyframes[keyframes.length - 1].t) {
        k0 = keyframes[keyframes.length - 1];
        k1 = keyframes[keyframes.length - 1];
      }
    }

    const span = k1.t - k0.t;
    const u = span > 0 ? smoothstep((p - k0.t) / span) : 0;

    targetPos.current.lerpVectors(k0.pos, k1.pos, u);
    targetLook.current.lerpVectors(k0.look, k1.look, u);
    targetFov.current = k0.fov + (k1.fov - k0.fov) * u;

    easing.damp3(camera.position, targetPos.current, 0.6, delta);
    easing.damp3(currentLook.current, targetLook.current, 0.6, delta);
    camera.lookAt(currentLook.current);

    if (Math.abs(camera.fov - targetFov.current) > 0.01) {
      easing.damp(camera, 'fov', targetFov.current, 0.6, delta);
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
