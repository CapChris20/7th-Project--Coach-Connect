// Neobrutalist card shell around coach reply bubbles (and any message card that wants the same chrome).
// Flow: stack outer + inner style props → hand them to NbCard → wrap children in a content View.
// Used by coach reply bubbles and conversation message cards.
// Read order: constants → helper → CoachGlassCard main.

import React from 'react';
import { View } from 'react-native';
import NbCard from '../../look-and-feel/NbCard';

// ===== NAMED CONSTANTS =====

// Legacy glass-era prop names stay on the API so old call sites still compile.
// NbCard owns radius, padding, and theme — those props are accepted and unused below.

// ===== HELPER FUNCTIONS =====

/**
 * Stack the outer card style and the optional inner style into one array NbCard accepts.
 * @param {object|undefined} outerStyle
 * @param {object|undefined} innerStyle
 * @returns {Array}
 */
function stackOuterAndInnerStyles(outerStyle, innerStyle) {
  return [outerStyle, innerStyle];
}

// ===== MAIN FUNCTION =====

/**
 * Neobrutalist card wrapper for coach replies.
 * Old glass-era props (borderColors, borderRadius, padding, isDark, heroFill) are accepted
 * but ignored — NbCard reads Design Law tokens instead.
 * @param {{ children?: import('react').ReactNode, style?: object, innerStyle?: object, contentStyle?: object, borderColors?: string[], borderRadius?: number, padding?: number, isDark?: boolean, heroFill?: boolean, noShadow?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function CoachGlassCard({
  children,
  style,
  innerStyle,
  contentStyle,
  borderColors,
  borderRadius,
  padding,
  isDark = true,
  heroFill = false,
  noShadow = false,
}) {
  // 1. Keep the old prop names so call sites do not break — NbCard ignores them.
  void borderColors;
  void borderRadius;
  void padding;
  void isDark;
  void heroFill;

  // 2. Combine style + innerStyle the way NbCard expects (array of style objects).
  const cardStyleStack = stackOuterAndInnerStyles(style, innerStyle);

  // 3. Render NbCard, then put children in a View so contentStyle still applies.
  return (
    <NbCard style={cardStyleStack} noShadow={noShadow}>
      <View style={contentStyle}>{children}</View>
    </NbCard>
  );
}
