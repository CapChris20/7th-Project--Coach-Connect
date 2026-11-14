// Week summary card — short narrative blurb with an optional “From your trainer” pill.
// Flow: pick best copy (coach note → auto summary → sign-off) → hide if empty → card chrome.
// Used near the top of WeeklyReportBody on the client report.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import HardShadow from '../../look-and-feel/HardShadow';
import NbPill from '../../look-and-feel/NbPill';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

// vocab: trainerNote.source === 'coach' means a human coach typed the note in-app
const TRAINER_NOTE_SOURCE_COACH = 'coach';
const WEEK_SUMMARY_EYEBROW = 'Week summary';
const FROM_TRAINER_PILL_LABEL = 'From your trainer';

// ===== HELPER FUNCTIONS =====

function textTrimmedOrEmpty(maybeText) {
  if (maybeText == null) return '';
  return String(maybeText).trim();
}

/**
 * First non-empty source wins: human coach note, then week.summary, then sign-off.
 * Empty string means the card should not render at all.
 */
function pickWeekSummaryParagraph(week) {
  const trainerInsights = week && week.trainerInsights;
  const trainerNote = trainerInsights && trainerInsights.trainerNote;
  const coachNoteText = textTrimmedOrEmpty(trainerNote && trainerNote.text);
  if (coachNoteText) return coachNoteText;

  const autoWeekSummary = textTrimmedOrEmpty(week && week.summary);
  if (autoWeekSummary) return autoWeekSummary;

  const signOffText = textTrimmedOrEmpty(week && week.signOff);
  if (signOffText) return signOffText;

  return '';
}

/**
 * Show the pill when a coach authored the note, or when sign-off text is present
 * (sign-off is treated as trainer-authored copy even without a source flag).
 */
function shouldShowFromTrainerPill(week) {
  const trainerInsights = week && week.trainerInsights;
  const trainerNote = trainerInsights && trainerInsights.trainerNote;
  const noteSource = trainerNote && trainerNote.source;
  if (noteSource === TRAINER_NOTE_SOURCE_COACH) return true;

  const hasSignOff = Boolean(week && week.signOff);
  if (hasSignOff) return true;

  return false;
}

function WeekSummaryCardChrome({ colors, showTrainerPill, summaryCopy }) {
  const cardBorderColor = colors.border;
  const cardBackgroundColor = colors.surfacePrimary;
  const eyebrowColor = colors.textMuted;
  const bodyTextColor = colors.textPrimary;

  return (
    <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
      <View
        style={[
          styles.card,
          { borderColor: cardBorderColor, backgroundColor: cardBackgroundColor },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.eyebrow, { color: eyebrowColor }]}>
            {WEEK_SUMMARY_EYEBROW}
          </Text>
          {showTrainerPill ? (
            <NbPill variant="plain">{FROM_TRAINER_PILL_LABEL}</NbPill>
          ) : null}
        </View>
        <Text style={[styles.body, { color: bodyTextColor }]}>{summaryCopy}</Text>
      </View>
    </HardShadow>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Narrative week-summary card. Returns null when every copy source is blank.
 * @param {{ week: object }} props
 */
export function TrainerTipsForWeek({ week }) {
  // vocab: useTheme = shared report light/dark tokens (not a separate ThemeProvider)
  const { colors } = useTheme();

  // 1. Resolve the paragraph we will show (first non-empty source wins).
  const summaryCopy = pickWeekSummaryParagraph(week);
  if (!summaryCopy) return null;

  // 2. Decide whether the “From your trainer” pill belongs on this card.
  const showTrainerPill = shouldShowFromTrainerPill(week);

  // 3. Outline + hard shadow card — Design Law, no gradient border.
  return (
    <View style={styles.wrap}>
      <WeekSummaryCardChrome
        colors={colors}
        showTrainerPill={showTrainerPill}
        summaryCopy={summaryCopy}
      />
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
