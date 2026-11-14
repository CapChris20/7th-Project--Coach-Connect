// Pros, cons, and focus coaching cards for the weekly report scroll.
// Flow: pickBestTips caps each list → HardShadow cards with bullet or TipRow chrome.
// Used under the daily breakdown in WeeklyReportBody (after sleep chart). Gold body file stays untouched.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from './reportColorSettings';
import { TipRow } from './TipRow';
import { pickBestTips } from './pickBestTips';

// ===== NAMED CONSTANTS =====

// Manipulate here: how many lines fit on Design Law progress PNG cards without crowding
const MAX_TIPS_PER_CARD = 5;
const BULLET_DOT_SIZE = 14;
const PROS_CARD_TITLE = 'Pros and wins';
const CONS_CARD_TITLE = 'Cons and areas to improve';
const FOCUS_CARD_TITLE = 'What to focus on';

// ===== HELPER FUNCTIONS =====

/** Uppercase muted label above each card (matches other report section eyebrows). */
function SectionEyebrow({ children, colors }) {
  const eyebrowColor = colors.textMuted;
  return <Text style={[styles.eyebrow, { color: eyebrowColor }]}>{children}</Text>;
}

/**
 * Hollow or filled square dot beside a pro/con sentence.
 * PNG uses shape (filled vs hollow), not green/red color coding.
 */
function TipBulletDot({ colors, useFilledDot }) {
  const dotBorderColor = colors.border;
  let dotBackgroundColor = 'transparent';
  if (useFilledDot) {
    dotBackgroundColor = colors.fill;
  }

  return (
    <View
      style={[
        styles.bullet,
        {
          borderColor: dotBorderColor,
          backgroundColor: dotBackgroundColor,
        },
      ]}
    />
  );
}

function BulletTipLine({ lineText, useFilledDots, colors }) {
  const lineTextColor = colors.textPrimary;

  return (
    <View style={styles.bulletRow}>
      <TipBulletDot colors={colors} useFilledDot={useFilledDots} />
      <Text style={[styles.bulletText, { color: lineTextColor }]}>{lineText}</Text>
    </View>
  );
}

/**
 * Pros or cons list inside HardShadow.
 * Wins (filled dots) also use the soft fill card background from Design Law.
 */
function ProsOrConsCard({ title, tipLines, useFilledDots, colors }) {
  if (!tipLines.length) return null;

  const cardBorderColor = colors.border;
  let cardBackgroundColor = colors.surfacePrimary;
  if (useFilledDots) {
    cardBackgroundColor = colors.soft;
  }

  const bulletRows = [];
  for (let lineIndex = 0; lineIndex < tipLines.length; lineIndex += 1) {
    bulletRows.push(
      <BulletTipLine
        key={`${title}-${lineIndex}`}
        lineText={tipLines[lineIndex]}
        useFilledDots={useFilledDots}
        colors={colors}
      />,
    );
  }

  return (
    <View style={styles.block}>
      <SectionEyebrow colors={colors}>{title}</SectionEyebrow>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            { borderColor: cardBorderColor, backgroundColor: cardBackgroundColor },
          ]}
        >
          {bulletRows}
        </View>
      </HardShadow>
    </View>
  );
}

/** Numbered focus tips — TipRow supplies gradient handoff chips per Design Law. */
function FocusTipsCard({ tipLines, colors }) {
  if (!tipLines.length) return null;

  const cardBorderColor = colors.border;
  const cardBackgroundColor = colors.surfacePrimary;

  const tipRows = [];
  for (let lineIndex = 0; lineIndex < tipLines.length; lineIndex += 1) {
    // TipRow expects a 1-based index so slot 0 maps from parent index 1
    const oneBasedTipIndex = lineIndex + 1;
    tipRows.push(
      <TipRow
        key={`focus-${lineIndex}`}
        index={oneBasedTipIndex}
        text={tipLines[lineIndex]}
      />,
    );
  }

  return (
    <View style={styles.block}>
      <SectionEyebrow colors={colors}>{FOCUS_CARD_TITLE}</SectionEyebrow>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            styles.focusCard,
            { borderColor: cardBorderColor, backgroundColor: cardBackgroundColor },
          ]}
        >
          {tipRows}
        </View>
      </HardShadow>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Stacked pros / cons / focus cards for one week object.
 * `animationKey` lets the parent remount this block when the week picker changes.
 * @param {{ week: { pros?: Array, cons?: Array, focus?: Array }, animationKey?: string|number }} props
 */
export function WinsAndWorkOnsSection({ week, animationKey }) {
  // vocab: useTheme = report tokens for card border / soft fill / text
  const { colors } = useTheme();

  // 1. Trim each coaching stream to the card limit and drop filler (pickBestTips scoring).
  const prosTipLines = pickBestTips(week.pros || [], MAX_TIPS_PER_CARD);
  const consTipLines = pickBestTips(week.cons || [], MAX_TIPS_PER_CARD);
  const focusTipLines = pickBestTips(week.focus || [], MAX_TIPS_PER_CARD);

  // 2. Nothing to show — skip the whole section so the scroll does not leave a gap.
  const hasPros = prosTipLines.length > 0;
  const hasCons = consTipLines.length > 0;
  const hasFocus = focusTipLines.length > 0;
  const hasAnyTips = hasPros || hasCons || hasFocus;
  if (!hasAnyTips) return null;

  // 3. Three stacked cards; key remounts children when the selected week changes.
  return (
    <View key={animationKey} style={styles.section}>
      <ProsOrConsCard
        title={PROS_CARD_TITLE}
        tipLines={prosTipLines}
        useFilledDots
        colors={colors}
      />
      <ProsOrConsCard
        title={CONS_CARD_TITLE}
        tipLines={consTipLines}
        useFilledDots={false}
        colors={colors}
      />
      <FocusTipsCard tipLines={focusTipLines} colors={colors} />
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
  // Manipulate here: solid dot = wins, hollow = cons (matches progress PNG)
  bullet: {
    width: BULLET_DOT_SIZE,
    height: BULLET_DOT_SIZE,
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
