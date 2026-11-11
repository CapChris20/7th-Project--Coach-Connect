// Neobrutalist card wrapper for coach reply bubbles.
// Flow: NbCard with thick border and hard shadow → children.
// Used by: coach reply bubbles and message cards.
//
// vocab: NbCard = neobrutalist card component with thick outline and hard offset shadow

import React from 'react';
import { View } from 'react-native';
import NbCard from '../../look-and-feel/NbCard';

/**
 * Neobrutalist card wrapper for coach replies.
 * @param {{ children?: import('react').ReactNode, style?: object, innerStyle?: object, contentStyle?: object, borderColors?: string[], borderRadius?: number, padding?: number, isDark?: boolean, heroFill?: boolean, noShadow?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export default function CoachGlassCard({
  children,
  style,
  innerStyle,
  contentStyle,
  borderColors, // Ignored (kept for backwards compat)
  borderRadius, // Ignored (NbCard uses design system radius)
  padding, // Ignored (kept for backwards compat)
  isDark = true, // Ignored (NbCard handles theme internally)
  heroFill = false, // Ignored (kept for backwards compat)
  noShadow = false,
}) {
  return (
    <NbCard style={[style, innerStyle]} noShadow={noShadow}>
      <View style={contentStyle}>{children}</View>
    </NbCard>
  );
}
