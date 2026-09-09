import { MeshTransmissionMaterial } from '@react-three/drei';
import { DoubleSide } from 'three';
import { accentColor } from './accent';

// Cheap glass — used for repeated elements (constellation nodes, CRM cards,
// crystals) where a real transmission render pass per-instance would be
// too costly. Reads as frosted glass under the neon lightformers + bloom.
export function CheapGlassMaterial({ color = 'cyan', opacity = 0.34, emissiveIntensity = 1.3 }) {
  const hex = accentColor(color);
  return (
    <meshPhysicalMaterial
      color={hex}
      transparent
      opacity={opacity}
      roughness={0.25}
      metalness={0.1}
      emissive={hex}
      emissiveIntensity={emissiveIntensity}
      side={DoubleSide}
      depthWrite={false}
    />
  );
}

// Premium real-transmission glass — reserved for hero "moment" objects
// (the phone, the pricing monolith) since each instance costs its own
// render pass.
export function PremiumGlassMaterial({ color = 'cyan', thickness = 1.2 }) {
  const hex = accentColor(color);
  return (
    <MeshTransmissionMaterial
      color={hex}
      thickness={thickness}
      roughness={0.06}
      transmission={1}
      ior={1.15}
      chromaticAberration={0.04}
      anisotropy={0.15}
      distortion={0.15}
      distortionScale={0.2}
      temporalDistortion={0.1}
      backside
      backsideThickness={0.4}
      envMapIntensity={1.4}
    />
  );
}
