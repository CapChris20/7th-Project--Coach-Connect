import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GRADIENTS, useTheme } from '../theme/WeeklyReportThemeContext';
import { GradientBorder } from './GradientBorder';
import { InsightItem } from './InsightItem';
import { curateCoachingPoints } from '../data/curateCoachingPoints';

function CoachingBlock({ variant, items, colors, mode }) {
  const isPro = variant === 'pro';
  const label = isPro ? 'PROS' : 'CONS';
  const title = isPro ? 'What went well' : 'What to improve';

  if (!items.length) return null;

  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Text style={[styles.blockLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>

      {items.map((text, i) => (
        <InsightItem key={`${variant}-${i}`} index={i + 1} text={text} variant={variant} />
      ))}
    </View>
  );
}

export function CoachingProsConsSection({ week, animationKey }) {
  const { colors, mode } = useTheme();
  const pros = curateCoachingPoints(week.pros || [], 5);
  const cons = curateCoachingPoints(week.cons || [], 5);
  const innerBg = mode === 'dark' ? 'rgba(16,16,26,0.95)' : 'rgba(255,255,255,0.98)';

  if (!pros.length && !cons.length) return null;

  return (
    <View key={animationKey} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>COACHING REVIEW</Text>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pros & cons</Text>
      </View>

      <GradientBorder colors={GRADIENTS.g4} borderWidth={1.5} radius={24} innerBackground={innerBg}>
        <View
          style={[
            styles.shell,
            {
              backgroundColor: mode === 'dark' ? 'rgba(20,20,30,0.55)' : 'rgba(255,255,255,0.7)',
            },
          ]}
        >
          <BlurView intensity={25} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[`${GRADIENTS.g4[0]}18`, `${GRADIENTS.g4[1]}08`, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <CoachingBlock variant="pro" items={pros} colors={colors} mode={mode} />
          <CoachingBlock variant="con" items={cons} colors={colors} mode={mode} />
        </View>
      </GradientBorder>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: 20,
    marginTop: 32,
  },
  sectionHeader: {
    marginBottom: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  shell: {
    padding: 16,
    overflow: 'hidden',
    gap: 20,
  },
  block: {
    gap: 8,
  },
  blockHeader: {
    marginLeft: 2,
    marginBottom: 4,
    gap: 2,
  },
  blockLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  blockTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
