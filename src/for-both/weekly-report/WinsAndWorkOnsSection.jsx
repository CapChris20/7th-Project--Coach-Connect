// Weekly report "pros & cons" block: what went well and what to improve.
// Flow: pick the top tips → if none, hide the section → otherwise paint the glass card with both lists.
// Used by: WeeklyReportBody after the week's food/workout stats.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { GRADIENTS, useTheme } from '../weekly-report/reportColorSettings';
import { ColorBorder } from './ColorBorder';
import { TipRow } from './TipRow';
import { pickBestTips } from '../weekly-report/pickBestTips';

// ===== NAMED CONSTANTS =====

const MAX_TIPS_PER_BLOCK = 5;
const PRO_VARIANT = 'pro';
const CON_VARIANT = 'con';
const DARK_MODE = 'dark';
const DARK_INNER_BACKGROUND = 'rgba(16,16,26,0.95)';
const LIGHT_INNER_BACKGROUND = 'rgba(255,255,255,0.98)';
const DARK_SHELL_BACKGROUND = 'rgba(20,20,30,0.55)';
const LIGHT_SHELL_BACKGROUND = 'rgba(255,255,255,0.7)';
const BLUR_INTENSITY = 25;
const REVIEW_BORDER_WIDTH = 1.5;
const REVIEW_CARD_RADIUS = 24;
const GRADIENT_START = { x: 0, y: 0 };
const GRADIENT_END = { x: 1, y: 1 };

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} mode
 * @returns {boolean}
 */
function isDarkMode(mode) {
  return mode === DARK_MODE;
}

/**
 * One labeled list (PROS or CONS). Hidden when that list is empty so we don't show a header with no rows.
 * `mode` is accepted because the parent always passes theme mode, matching the original call.
 * @param {{ variant: string, items: string[], colors: object, mode: string }} props
 */
function CoachingBlock({ variant, items, colors, mode }) {
  const isPro = variant === PRO_VARIANT;
  const label = isPro ? 'PROS' : 'CONS';
  const title = isPro ? 'What went well' : 'What to improve';

  if (!items.length) return null;

  return (
    <View style={styles.block}>
      <View style={styles.blockHeader}>
        <Text style={[styles.blockLabel, { color: colors.textMuted }]}>{label}</Text>
        <Text style={[styles.blockTitle, { color: colors.textPrimary }]}>{title}</Text>
      </View>

      {items.map((text, tipIndex) => (
        <TipRow key={`${variant}-${tipIndex}`} index={tipIndex + 1} text={text} variant={variant} />
      ))}
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Coaching review card for one week. Hidden when both lists are empty.
 * @param {{ week: { pros?: Array, cons?: Array }, animationKey?: string|number }} props
 */
export function WinsAndWorkOnsSection({ week, animationKey }) {
  const { colors, mode } = useTheme();
  const pros = pickBestTips(week.pros || [], MAX_TIPS_PER_BLOCK);
  const cons = pickBestTips(week.cons || [], MAX_TIPS_PER_BLOCK);
  const innerBackground = isDarkMode(mode) ? DARK_INNER_BACKGROUND : LIGHT_INNER_BACKGROUND;
  const shellBackground = isDarkMode(mode) ? DARK_SHELL_BACKGROUND : LIGHT_SHELL_BACKGROUND;

  if (!pros.length && !cons.length) return null;

  return (
    <View key={animationKey} style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>COACHING REVIEW</Text>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Pros & cons</Text>
      </View>

      <ColorBorder
        colors={GRADIENTS.g4}
        borderWidth={REVIEW_BORDER_WIDTH}
        radius={REVIEW_CARD_RADIUS}
        innerBackground={innerBackground}
      >
        <View
          style={[
            styles.shell,
            {
              backgroundColor: shellBackground,
            },
          ]}
        >
          <BlurView intensity={BLUR_INTENSITY} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[`${GRADIENTS.g4[0]}18`, `${GRADIENTS.g4[1]}08`, 'transparent']}
            start={GRADIENT_START}
            end={GRADIENT_END}
            style={StyleSheet.absoluteFill}
          />
          <CoachingBlock variant={PRO_VARIANT} items={pros} colors={colors} mode={mode} />
          <CoachingBlock variant={CON_VARIANT} items={cons} colors={colors} mode={mode} />
        </View>
      </ColorBorder>
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
