import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Color, ShaderMaterial, DoubleSide } from 'three';
import { scrollState } from '../lib/scrollDriver';
import { ACTS } from '../config/acts';
import { palette } from '../config/palette';

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uClient;   // 0..1 client-lane emphasis
  uniform float uTrainer;  // 0..1 trainer-lane emphasis
  uniform vec3 uVoid;
  uniform vec3 uPink;
  uniform vec3 uPurple;
  uniform vec3 uCyan;
  uniform vec3 uOrange;

  float blob(vec2 uv, vec2 center, float radius) {
    float d = length(uv - center);
    return smoothstep(radius, 0.0, d);
  }

  void main() {
    vec2 uv = vUv;
    vec3 col = uVoid;

    vec2 c1 = vec2(0.3 + 0.06 * sin(uTime * 0.05), 0.55 + 0.05 * cos(uTime * 0.07));
    vec2 c2 = vec2(0.7 + 0.05 * cos(uTime * 0.04), 0.4 + 0.06 * sin(uTime * 0.06));
    vec2 c3 = vec2(0.5 + 0.08 * sin(uTime * 0.03 + 1.5), 0.7 + 0.04 * cos(uTime * 0.05));

    float b1 = blob(uv, c1, 0.6) * (0.55 + 0.35 * uTrainer);
    float b2 = blob(uv, c2, 0.55) * (0.5 + 0.4 * uClient);
    float b3 = blob(uv, c3, 0.5) * 0.4;

    col = mix(col, uPurple, b1 * 0.85);
    col = mix(col, uOrange, b1 * uTrainer * 0.6);
    col = mix(col, uPink, b2 * uClient * 0.75);
    col = mix(col, uCyan, b2 * 0.55);
    col = mix(col, uPurple, b3 * 0.45);

    float vignette = smoothstep(1.0, 0.15, length(uv - 0.5));
    col *= mix(0.75, 1.0, vignette);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function AuroraBackdrop() {
  const meshRef = useRef(null);
  const { camera } = useThree();

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        side: DoubleSide,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uClient: { value: 0 },
          uTrainer: { value: 0 },
          uVoid: { value: new Color(palette.void) },
          uPink: { value: new Color(palette.pink) },
          uPurple: { value: new Color(palette.purple) },
          uCyan: { value: new Color(palette.cyan) },
          uOrange: { value: new Color(palette.orange) },
        },
      }),
    []
  );

  const clientRange = ACTS.find((a) => a.id === 'client-lane').range;
  const trainerRange = ACTS.find((a) => a.id === 'trainer-lane').range;

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
    const p = scrollState.progress;

    // Acts as a skybox: always centered on the camera's view axis so
    // lateral dolly moves (client/trainer lane x-offsets) never push it
    // out of frame or reveal it edge-on.
    if (meshRef.current) {
      meshRef.current.position.set(camera.position.x, camera.position.y, camera.position.z - 130);
    }

    const clientTarget =
      p >= clientRange[0] - 0.08 && p <= clientRange[1] + 0.05 ? 1 : 0;
    const trainerTarget =
      p >= trainerRange[0] - 0.05 && p <= trainerRange[1] + 0.05 ? 1 : 0;

    material.uniforms.uClient.value +=
      (clientTarget - material.uniforms.uClient.value) * Math.min(1, delta * 2);
    material.uniforms.uTrainer.value +=
      (trainerTarget - material.uniforms.uTrainer.value) * Math.min(1, delta * 2);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -140]} material={material} renderOrder={-10}>
      <planeGeometry args={[220, 160, 1, 1]} />
    </mesh>
  );
}
