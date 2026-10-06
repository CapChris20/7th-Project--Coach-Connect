// Light paper background with three soft corner washes behind frosted glass.
// Flow: paint the paper color → stack the cyan, violet, and pink blurs → render children on top.
// Used by light-mode screens that sit glass cards on a pastel mesh.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

// ===== NAMED CONSTANTS =====

// Manipulate here: this hex is both the SVG base and the View behind it, so a gap never flashes another color.
const PAPER_COLOR = '#F6F7FB';

// Each blur is one radial gradient pinned to a corner. Opacities stay strings so the SVG props match the design.
// Manipulate here: raise the first stop's opacity for a stronger corner, or shrink radius to pull the wash inward.
const LIGHT_CORNER_BLURS = [
  {
    gradientId: 'cyan',
    centerX: '0%',
    centerY: '0%',
    radius: '70%',
    color: '#4DD2FF',
    stops: [
      { offset: '0%', opacity: '0.28' },
      { offset: '60%', opacity: '0.10' },
      { offset: '100%', opacity: '0' },
    ],
  },
  {
    gradientId: 'violet',
    centerX: '100%',
    centerY: '0%',
    radius: '75%',
    color: '#A78BFA',
    stops: [
      { offset: '0%', opacity: '0.26' },
      { offset: '62%', opacity: '0.10' },
      { offset: '100%', opacity: '0' },
    ],
  },
  {
    gradientId: 'pink',
    centerX: '100%',
    centerY: '100%',
    radius: '80%',
    color: '#FF5BD6',
    stops: [
      { offset: '0%', opacity: '0.18' },
      { offset: '62%', opacity: '0.08' },
      { offset: '100%', opacity: '0' },
    ],
  },
];

// ===== HELPER FUNCTIONS =====

// vocab: RadialGradient = a circular fade. cx/cy pin the hot center; r is how far the color reaches.
function CornerBlur({ gradientId, centerX, centerY, radius, color, stops }) {
  return (
    <RadialGradient id={gradientId} cx={centerX} cy={centerY} r={radius}>
      {stops.map((stop) => (
        <Stop
          key={`${gradientId}-${stop.offset}`}
          offset={stop.offset}
          stopColor={color}
          stopOpacity={stop.opacity}
        />
      ))}
    </RadialGradient>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen light mesh. Children sit above the SVG so glass cards stay tappable.
 * @param {{ children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export default function GlassBackgroundLight({ children }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          {LIGHT_CORNER_BLURS.map((blur) => (
            <CornerBlur key={blur.gradientId} {...blur} />
          ))}
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill={PAPER_COLOR} />
        {LIGHT_CORNER_BLURS.map((blur) => (
          <Rect
            key={blur.gradientId}
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill={`url(#${blur.gradientId})`}
          />
        ))}
      </Svg>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAPER_COLOR,
  },
});
