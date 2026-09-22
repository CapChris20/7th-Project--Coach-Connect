import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GRADIENTS, useTheme } from '../theme/WeeklyReportThemeContext';
import { GradientBorder } from './GradientBorder';

const STEPS = [
  { icon: 'moon-outline', text: 'Log daily check-ins — sleep, water, steps, and wellness' },
  { icon: 'barbell-outline', text: 'Complete workouts so training days show up here' },
  { icon: 'calendar-outline', text: 'Reports auto-build every week from your logged data' },
];

export function WeeklyReportEmptyState({ isClientSelfView = false }) {
  const { colors, mode } = useTheme();
  const innerBg = mode === 'dark' ? 'rgba(14,14,22,0.98)' : '#ffffff';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {mode === 'dark' ? (
        <>
          <View style={[styles.orb, styles.orbTop]}>
            <LinearGradient colors={['#ff1493', 'transparent']} style={StyleSheet.absoluteFill} />
          </View>
          <View style={[styles.orb, styles.orbBottom]}>
            <LinearGradient colors={['#00bfff', 'transparent']} style={StyleSheet.absoluteFill} />
          </View>
        </>
      ) : null}

      <GradientBorder colors={GRADIENTS.g4} borderWidth={1.75} radius={28} innerBackground={innerBg} style={styles.card}>
        <LinearGradient
          colors={[`${GRADIENTS.g4[0]}20`, `${GRADIENTS.g4[1]}10`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView intensity={mode === 'dark' ? 28 : 12} tint={colors.blurTint} style={StyleSheet.absoluteFill} />

        <View style={styles.cardBody}>
          <LinearGradient colors={GRADIENTS.g3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={34} color="#1a1a1a" />
          </LinearGradient>

          <Text style={[styles.title, { color: colors.textPrimary }]}>No weekly report yet</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {isClientSelfView
              ? 'Your first recap appears after you log check-ins across a week.'
              : 'This client has no saved weekly summaries yet. Once they log consistently, the report fills in automatically.'}
          </Text>

          <View style={styles.steps}>
            {STEPS.map((step) => (
              <View key={step.text} style={styles.stepRow}>
                <LinearGradient colors={GRADIENTS.g4} style={styles.stepIcon}>
                  <Ionicons name={step.icon} size={16} color="#1a1a1a" />
                </LinearGradient>
                <Text style={[styles.stepText, { color: colors.textSecondary }]}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </GradientBorder>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingBottom: 40,
  },
  orb: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    opacity: 0.16,
    overflow: 'hidden',
  },
  orbTop: { top: -120, right: -80 },
  orbBottom: { bottom: -140, left: -100, opacity: 0.1 },
  card: {
    width: '100%',
  },
  cardBody: {
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 8,
  },
  steps: {
    width: '100%',
    gap: 12,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
