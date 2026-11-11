// Progress ring with a gradient stroke and room in the middle for a number.
// Flow: draw the gray track circle → draw the gradient arc for the progress → put the children in the center.
// Used for the daily calorie ring and any other "how much of the goal" display.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '../lightDarkMode';
import { getNbColors } from './nbTokens';

// ===== NAMED CONSTANTS =====

const VIEW_BOX_SIZE = 120;
const CENTER = VIEW_BOX_SIZE / 2;
const RADIUS = 44;
const STROKE_WIDTH = 14;
const FULL_TURN_START_ANGLE = -90;

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {number} props.progress A number from 0 to 1.
 * @param {number} [props.size] Width and height in points.
 * @param {string[]} props.accent Gradient pair for the arc.
 * @param {string} props.gradientId Unique id for the gradient, since several rings can share a screen.
 * @param {React.ReactNode} [props.children] Shown in the center.
 * @returns {JSX.Element}
 */
export function NbRing({ progress, size = 120, accent, gradientId, children }) {
  // 1. Colors for the current theme.
  const { isDark } = useTheme();
  const colors = getNbColors(isDark);

  // 2. The arc is a full circle with most of its dash hidden.
  const circumference = 2 * Math.PI * RADIUS;
  const keptProgress = Math.max(0, Math.min(1, progress));
  const hiddenLength = circumference * (1 - keptProgress);

  // 3. Track, arc, then the center content.
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox={`0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={accent[0]} />
            <Stop offset="1" stopColor={accent[1]} />
          </LinearGradient>
        </Defs>
        <Circle cx={CENTER} cy={CENTER} r={RADIUS} stroke={colors.gray} strokeWidth={STROKE_WIDTH} fill="none" />
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={`url(#${gradientId})`}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={hiddenLength}
          transform={`rotate(${FULL_TURN_START_ANGLE} ${CENTER} ${CENTER})`}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

export default NbRing;

const styles = StyleSheet.create({
  center: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
});
