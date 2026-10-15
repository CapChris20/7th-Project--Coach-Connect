// Empty weekly-report card when nobody has logged a week yet.
// Flow: paint the background → show the "no report" card → list the three things that fill it in.
// Used by the client and trainer weekly report screens.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GRADIENTS, useTheme } from '../weekly-report/reportColorSettings';
import { ColorBorder } from './ColorBorder';

// ===== NAMED CONSTANTS =====

const DARK_MODE = 'dark';
const DARK_CARD_COLOR = 'rgba(14,14,22,0.98)';
const LIGHT_CARD_COLOR = '#ffffff';
const DARK_BLUR_INTENSITY = 28;
const LIGHT_BLUR_INTENSITY = 12;
const ICON_COLOR = '#1a1a1a';
const CLIENT_EMPTY_COPY = 'Your first recap appears after you log check-ins across a week.';
const TRAINER_EMPTY_COPY =
  'This client has no saved weekly summaries yet. Once they log consistently, the report fills in automatically.';

const STEPS = [
  { icon: 'moon-outline', text: 'Log daily check-ins — sleep, water, steps, and wellness' },
  { icon: 'barbell-outline', text: 'Complete workouts so training days show up here' },
  { icon: 'calendar-outline', text: 'Reports auto-build every week from your logged data' },
];

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * @param {{ isClientSelfView?: boolean }} props
 * @returns {import('react').ReactElement}
 */
export function NoReportYet({ isClientSelfView = false }) {
  const { colors, mode } = useTheme();
  const isDarkMode = mode === DARK_MODE;
  const innerBackground = isDarkMode ? DARK_CARD_COLOR : LIGHT_CARD_COLOR;
  const blurIntensity = isDarkMode ? DARK_BLUR_INTENSITY : LIGHT_BLUR_INTENSITY;
  const emptyCopy = isClientSelfView ? CLIENT_EMPTY_COPY : TRAINER_EMPTY_COPY;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={colors.backgroundGradient}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />

      {isDarkMode ? (
        <>
          <View style={[styles.orb, styles.orbTop]}>
            <LinearGradient colors={['#ff1493', 'transparent']} style={StyleSheet.absoluteFill} />
          </View>
          <View style={[styles.orb, styles.orbBottom]}>
            <LinearGradient colors={['#00bfff', 'transparent']} style={StyleSheet.absoluteFill} />
          </View>
        </>
      ) : null}

      <ColorBorder colors={GRADIENTS.g4} borderWidth={1.75} radius={28} innerBackground={innerBackground} style={styles.card}>
        <LinearGradient
          colors={[`${GRADIENTS.g4[0]}20`, `${GRADIENTS.g4[1]}10`, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <BlurView intensity={blurIntensity} tint={colors.blurTint} style={StyleSheet.absoluteFill} />

        <View style={styles.cardBody}>
          <LinearGradient colors={GRADIENTS.g3} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroIcon}>
            <Ionicons name="document-text-outline" size={34} color={ICON_COLOR} />
          </LinearGradient>

          <Text style={[styles.title, { color: colors.textPrimary }]}>No weekly report yet</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{emptyCopy}</Text>

          <View style={styles.steps}>
            {STEPS.map((step) => (
              <View key={step.text} style={styles.stepRow}>
                <LinearGradient colors={GRADIENTS.g4} style={styles.stepIcon}>
                  <Ionicons name={step.icon} size={16} color={ICON_COLOR} />
                </LinearGradient>
                <Text style={[styles.stepText, { color: colors.textSecondary }]}>{step.text}</Text>
              </View>
            ))}
          </View>
        </View>
      </ColorBorder>
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
