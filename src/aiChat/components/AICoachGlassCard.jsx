import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AI_COACH_UI } from '../aiCoachUiTokens';

/**
 * Premium glass card — gradient border + dark inner fill (matches dashboard heroes).
 */
export default function AICoachGlassCard({
  children,
  style,
  innerStyle,
  contentStyle,
  borderColors = AI_COACH_UI.gradient.borderWarm,
  borderRadius = 16,
  padding = 1.5,
  isDark = true,
  heroFill = false,
}) {
  const innerRadius = Math.max(0, borderRadius - padding);
  const innerBg = isDark ? AI_COACH_UI.surface : '#FFFFFF';

  return (
    <LinearGradient
      colors={borderColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius, padding }, style]}
    >
      <View
        style={[
          {
            borderRadius: innerRadius,
            backgroundColor: innerBg,
            borderWidth: 1,
            borderColor: isDark ? AI_COACH_UI.borderHairline : 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          },
          innerStyle,
        ]}
      >
        {heroFill && isDark ? (
          <LinearGradient
            colors={AI_COACH_UI.heroInner}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        <View style={contentStyle}>{children}</View>
      </View>
    </LinearGradient>
  );
}
