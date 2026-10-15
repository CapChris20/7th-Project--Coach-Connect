// Gradient border frame for coach reply bubbles (dashboard-style glass card).
// Flow: outer LinearGradient as rim → inset fill → optional dark hero wash → children.
// Used by coach reply bubbles and hero-style cards.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AI_COACH_UI } from '../coachColors';

// ===== NAMED CONSTANTS =====

// Manipulate here: padding is visible border thickness; radius is outer corner.
const OUTER_CORNER_RADIUS_DEFAULT = 16;
const GRADIENT_BORDER_THICKNESS_DEFAULT = 1.5;

const LIGHT_MODE_FILL = '#FFFFFF';
const LIGHT_MODE_HAIRLINE = 'rgba(0,0,0,0.06)';

const GRADIENT_TOP_LEFT = { x: 0, y: 0 };
const GRADIENT_BOTTOM_RIGHT = { x: 1, y: 1 };
const HERO_WASH_TOP = { x: 0, y: 0 };
const HERO_WASH_BOTTOM = { x: 0, y: 1 };

// ===== HELPER FUNCTIONS =====

function computeInnerCornerRadius(outerRadius, borderThickness) {
  return Math.max(0, outerRadius - borderThickness);
}

function solidFillForTheme(isDark) {
  if (isDark) return AI_COACH_UI.surface;
  return LIGHT_MODE_FILL;
}

function hairlineForTheme(isDark) {
  if (isDark) return AI_COACH_UI.borderHairline;
  return LIGHT_MODE_HAIRLINE;
}

function needsHeroBackgroundWash(heroFill, isDark) {
  return Boolean(heroFill && isDark);
}

function buildInnerViewStyle(innerRadius, isDark, extraInnerStyle) {
  return [
    {
      borderRadius: innerRadius,
      backgroundColor: solidFillForTheme(isDark),
      borderWidth: 1,
      borderColor: hairlineForTheme(isDark),
      overflow: 'hidden',
    },
    extraInnerStyle,
  ];
}

function CoachCardHeroWash({ showHeroWash, isDark }) {
  if (!showHeroWash || !isDark) return null;
  return (
    <LinearGradient
      colors={AI_COACH_UI.heroInner}
      start={HERO_WASH_TOP}
      end={HERO_WASH_BOTTOM}
      style={StyleSheet.absoluteFillObject}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Glass card wrapper with gradient border and optional hero fill.
 * @param {{ children?: import('react').ReactNode, style?: object, innerStyle?: object, contentStyle?: object, borderColors?: string[], borderRadius?: number, padding?: number, isDark?: boolean, heroFill?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function CoachGlassCard({
  children,
  style,
  innerStyle,
  contentStyle,
  borderColors = AI_COACH_UI.gradient.borderWarm,
  borderRadius = OUTER_CORNER_RADIUS_DEFAULT,
  padding = GRADIENT_BORDER_THICKNESS_DEFAULT,
  isDark = true,
  heroFill = false,
}) {
  const innerRadius = computeInnerCornerRadius(borderRadius, padding);
  const showHeroWash = needsHeroBackgroundWash(heroFill, isDark);

  return (
    <LinearGradient
      colors={borderColors}
      start={GRADIENT_TOP_LEFT}
      end={GRADIENT_BOTTOM_RIGHT}
      style={[{ borderRadius, padding }, style]}
    >
      <View style={buildInnerViewStyle(innerRadius, isDark, innerStyle)}>
        <CoachCardHeroWash showHeroWash={showHeroWash} isDark={isDark} />
        <View style={contentStyle}>{children}</View>
      </View>
    </LinearGradient>
  );
}
