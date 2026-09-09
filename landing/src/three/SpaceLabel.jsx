import { Html } from '@react-three/drei';
import { accentColor } from './accent';

// Text that lives *in* the 3D world (attached to a mesh/position, scaling
// and parallaxing with camera distance) rather than pinned to the screen —
// used for the ambient hero quote, crystal labels, and satellite callouts.
export function SpaceLabel({
  children,
  color = 'cyan',
  size = 15,
  weight = 600,
  tracking = '0.02em',
  opacity = 0.85,
  distanceFactor = 10,
  transform = true,
  center = true,
  className,
  style,
  ...props
}) {
  return (
    <Html
      transform={transform}
      center={center}
      distanceFactor={distanceFactor}
      occlude={false}
      {...props}
    >
      <div
        className={className}
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: size,
          fontWeight: weight,
          letterSpacing: tracking,
          color: accentColor(color),
          opacity,
          whiteSpace: 'nowrap',
          textShadow: `0 0 18px ${accentColor(color)}66`,
          userSelect: 'none',
          pointerEvents: 'none',
          ...style,
        }}
      >
        {children}
      </div>
    </Html>
  );
}
