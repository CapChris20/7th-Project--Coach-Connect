// Design Law week-summary card — narrative + “From your trainer” pill (progress PNG).
// Flow: prefer coach note → else auto summary → hide when empty. No gradient borders.
// Used by WeeklyReportBody near the top of the client report.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import NbPill from '../../look-and-feel/NbPill';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const COACH_SOURCE = 'coach';

// ===== HELPER FUNCTIONS =====

function summaryText(week) {
  const note = week?.trainerInsights?.trainerNote;
  if (note?.text) return String(note.text).trim();
  if (week?.summary) return String(week.summary).trim();
  if (week?.signOff) return String(week.signOff).trim();
  return '';
}

function isFromTrainer(week) {
  const note = week?.trainerInsights?.trainerNote;
  if (note?.source === COACH_SOURCE) return true;
  if (week?.signOff) return true;
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ week: object }} props
 */
export function TrainerTipsForWeek({ week }) {
  const { colors } = useTheme();
  const text = summaryText(week);
  if (!text) return null;

  const fromTrainer = isFromTrainer(week);

  return (
    <View style={styles.wrap}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View
          style={[
            styles.card,
            { borderColor: colors.border, backgroundColor: colors.surfacePrimary },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.eyebrow, { color: colors.textMuted }]}>Week summary</Text>
            {fromTrainer ? <NbPill variant="plain">From your trainer</NbPill> : null}
          </View>
          <Text style={[styles.body, { color: colors.textPrimary }]}>{text}</Text>
        </View>
      </HardShadow>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: nb.screenGutter,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: nb.cardPadding,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
});
