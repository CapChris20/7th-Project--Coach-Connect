// Dark mesh background: obsidian base plus three corner blurs, one SVG for every platform.
// Flow: paint the obsidian fill → stack indigo, violet, and slate washes → render children on top.
// Used by dark screens that sit glass cards on the liquid background.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';
import { Liquid } from './glassSettings';

// ===== NAMED CONSTANTS =====

// Manipulate here: each corner's first stop is the hot color. Later stops fade it out before the edge.
const DARK_CORNER_BLURS = [
  {
    gradientId: 'indigo',
    centerX: '0%',
    centerY: '0%',
    radius: '70%',
    color: '#2E5BFF',
    stops: [
      { offset: '0%', opacity: '0.42' },
      { offset: '55%', opacity: '0.12' },
      { offset: '100%', opacity: '0' },
    ],
  },
  {
    gradientId: 'violet',
    centerX: '100%',
    centerY: '0%',
    radius: '75%',
    color: '#6D28D9',
    stops: [
      { offset: '0%', opacity: '0.40' },
      { offset: '60%', opacity: '0.12' },
      { offset: '100%', opacity: '0' },
    ],
  },
  {
    gradientId: 'slate',
    centerX: '100%',
    centerY: '100%',
    radius: '80%',
    color: '#64748B',
    stops: [
      { offset: '0%', opacity: '0.28' },
      { offset: '60%', opacity: '0.10' },
      { offset: '100%', opacity: '0' },
    ],
  },
];

// ===== HELPER FUNCTIONS =====

// vocab: RadialGradient = a circular fade. The same id is what the full-screen rects paint with url(#id).
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
 * Full-screen dark mesh. Children sit above the SVG so the washes never block taps.
 * @param {{ children?: import('react').ReactNode }} props
 * @returns {import('react').ReactElement}
 */
export default function GlassBackgroundDark({ children }) {
  return (
    <View style={styles.root}>
      <Svg style={StyleSheet.absoluteFillObject} width="100%" height="100%">
        <Defs>
          {DARK_CORNER_BLURS.map((blur) => (
            <CornerBlur key={blur.gradientId} {...blur} />
          ))}
        </Defs>

        <Rect x="0" y="0" width="100%" height="100%" fill={Liquid.colors.obsidian} />
        {DARK_CORNER_BLURS.map((blur) => (
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
    backgroundColor: Liquid.colors.obsidian,
  },
});
