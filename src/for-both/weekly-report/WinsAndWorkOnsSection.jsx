// Design Law pros / cons / focus — solid vs hollow bullets (progress PNG, no color coding).
// Flow: pickBestTips → HardShadow cards → TipRow for focus. Used under daily breakdown.
// Used by: WeeklyReportBody after the sleep chart / day list.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';
import { TipRow } from './TipRow';
import { pickBestTips } from '../weekly-report/pickBestTips';

// ===== NAMED CONSTANTS =====

const MAX_TIPS_PER_BLOCK = 5;
const BULLET = 14;

// ===== HELPER FUNCTIONS =====

function Eyebrow({ children, colors }) {
  return <Text style={[styles.eyebrow, { color: colors.textMuted }]}>{children}</Text>;
}

function BulletCard({ title, items, filled, colors }) {
  if (!items.length) return null;
  return (
    <View style={styles.block}>
      <Eyebrow colors={colors}>{title}</Eyebrow>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            {
              borderColor: colors.border,
              backgroundColor: filled ? colors.soft : colors.surfacePrimary,
            },
          ]}
        >
          {items.map((text, tipIndex) => (
            <View key={`${title}-${tipIndex}`} style={styles.bulletRow}>
              <View
                style={[
                  styles.bullet,
                  {
                    borderColor: colors.border,
                    backgroundColor: filled ? colors.fill : 'transparent',
                  },
                ]}
              />
              <Text style={[styles.bulletText, { color: colors.textPrimary }]}>{text}</Text>
            </View>
          ))}
        </View>
      </HardShadow>
    </View>
  );
}

function FocusCard({ items, colors }) {
  if (!items.length) return null;
  return (
    <View style={styles.block}>
      <Eyebrow colors={colors}>What to focus on</Eyebrow>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            styles.focusCard,
            { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
          ]}
        >
          {items.map((text, tipIndex) => (
            <TipRow key={`focus-${tipIndex}`} index={tipIndex + 1} text={text} />
          ))}
        </View>
      </HardShadow>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ week: { pros?: Array, cons?: Array, focus?: Array }, animationKey?: string|number }} props
 */
export function WinsAndWorkOnsSection({ week, animationKey }) {
  const { colors } = useTheme();
  const pros = pickBestTips(week.pros || [], MAX_TIPS_PER_BLOCK);
  const cons = pickBestTips(week.cons || [], MAX_TIPS_PER_BLOCK);
  const focus = pickBestTips(week.focus || [], MAX_TIPS_PER_BLOCK);

  if (!pros.length && !cons.length && !focus.length) return null;

  return (
    <View key={animationKey} style={styles.section}>
      <BulletCard title="Pros and wins" items={pros} filled colors={colors} />
      <BulletCard title="Cons and areas to improve" items={cons} filled={false} colors={colors} />
      <FocusCard items={focus} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: nb.screenGutter,
    marginTop: spacing.lg,
    gap: spacing.lg,
  },
  block: {
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: nb.cardPadding,
    gap: spacing.sm + 2,
  },
  focusCard: {
    gap: spacing.md,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 2,
  },
  // Manipulate here: solid = wins, hollow = cons (PNG differs without color)
  bullet: {
    width: BULLET,
    height: BULLET,
    borderRadius: 3,
    borderWidth: nb.borderWidth,
    marginTop: 3,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
});
