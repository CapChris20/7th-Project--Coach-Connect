// Gradient-bordered card for coach replies. The outer gradient is the border; the inner view is the fill.
// Flow: pad a gradient → inset a rounded fill → optionally wash the dark hero → place children.
// Used by coach reply bubbles that need the same frame as the dashboard heroes.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AI_COACH_UI } from '../coachColors';

// ===== NAMED CONSTANTS =====

// Manipulate here: radius is the outer corner. Padding is the visible border thickness (the gradient shows through it).
const DEFAULT_BORDER_RADIUS = 16;
const DEFAULT_EDGE_PADDING = 1.5;

const LIGHT_INNER_FILL = '#FFFFFF';
const LIGHT_HAIRLINE_COLOR = 'rgba(0,0,0,0.06)';

// Diagonal border, top-to-bottom hero wash. Separate pairs so the border and the fill do not share a direction.
const BORDER_GRADIENT_START = { x: 0, y: 0 };
const BORDER_GRADIENT_END = { x: 1, y: 1 };
const HERO_FILL_START = { x: 0, y: 0 };
const HERO_FILL_END = { x: 0, y: 1 };

// ===== HELPER FUNCTIONS =====

// The inner corner is tighter by the border thickness so the fill meets the gradient edge without a gap.
function innerCornerRadius(borderRadius, edgePadding) {
  return Math.max(0, borderRadius - edgePadding);
}

function innerFillColor(isDark) {
  if (isDark) return AI_COACH_UI.surface;
  return LIGHT_INNER_FILL;
}

function hairlineColor(isDark) {
  if (isDark) return AI_COACH_UI.borderHairline;
  return LIGHT_HAIRLINE_COLOR;
}

// The hero wash is a dark-only extra. Light cards stay a flat white fill.
function shouldShowHeroWash(heroFill, isDark) {
  return heroFill && isDark;
}

function innerCardStyle(innerRadius, isDark, innerStyle) {
  return [
    {
      borderRadius: innerRadius,
      backgroundColor: innerFillColor(isDark),
      borderWidth: 1,
      borderColor: hairlineColor(isDark),
      overflow: 'hidden',
    },
    innerStyle,
  ];
}

// ===== MAIN FUNCTION =====

/**
 * Glass card: gradient ring, solid inner fill, optional dark hero wash behind the content.
 * @param {{ children?: import('react').ReactNode, style?: object, innerStyle?: object, contentStyle?: object, borderColors?: string[], borderRadius?: number, padding?: number, isDark?: boolean, heroFill?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function CoachGlassCard({
  children,
  style,
  innerStyle,
  contentStyle,
  borderColors = AI_COACH_UI.gradient.borderWarm,
  borderRadius = DEFAULT_BORDER_RADIUS,
  padding = DEFAULT_EDGE_PADDING,
  isDark = true,
  heroFill = false,
}) {
  const innerRadius = innerCornerRadius(borderRadius, padding);

  return (
    <LinearGradient
      colors={borderColors}
      start={BORDER_GRADIENT_START}
      end={BORDER_GRADIENT_END}
      style={[{ borderRadius, padding }, style]}
    >
      <View style={innerCardStyle(innerRadius, isDark, innerStyle)}>
        {shouldShowHeroWash(heroFill, isDark) ? (
          <LinearGradient
            colors={AI_COACH_UI.heroInner}
            start={HERO_FILL_START}
            end={HERO_FILL_END}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <View style={contentStyle}>{children}</View>
      </View>
    </LinearGradient>
  );
}
