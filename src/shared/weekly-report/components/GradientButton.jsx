import React from 'react';
import { Text, StyleSheet, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/WeeklyReportThemeContext';

export function GradientButton({
  label,
  icon,
  colors,
  onPress,
  variant = 'primary',
  testID,
  style,
}) {
  const { colors: themeColors, mode } = useTheme();

  const handle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  if (variant === 'outline') {
    return (
      <Pressable
        testID={testID}
        onPress={handle}
        style={({ pressed }) => [style, { opacity: pressed ? 0.85 : 1 }]}
      >
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.outlineBorder}>
          <View
            style={[
              styles.outlineInner,
              { backgroundColor: mode === 'dark' ? '#0a0a0f' : '#f4f4f6' },
            ]}
          >
            {icon ? <Ionicons name={icon} size={16} color={themeColors.textPrimary} /> : null}
            <Text style={[styles.outlineText, { color: themeColors.textPrimary }]}>{label}</Text>
          </View>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={handle}
      style={({ pressed }) => [style, { opacity: pressed ? 0.9 : 1 }]}
    >
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primary}>
        {icon ? <Ionicons name={icon} size={18} color="#fff" /> : null}
        <Text style={styles.primaryText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#ff1493',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  outlineBorder: {
    height: 56,
    borderRadius: 18,
    padding: 1.5,
  },
  outlineInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16.5,
  },
  outlineText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
