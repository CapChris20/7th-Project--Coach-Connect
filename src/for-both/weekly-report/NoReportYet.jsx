// Empty weekly-report state — dashed card when no weeklySummaries exist yet.
// Flow: client gets CTA path; trainer gets “Not ready” pill; footnote under the card.
// Used by WeeklyReportScreen. No gradient borders (Design Law empty = dashed only).

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NbIconChip from '../../look-and-feel/NbIconChip';
import NbButton from '../../look-and-feel/NbButton';
import NbPill from '../../look-and-feel/NbPill';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import { useTheme } from '../weekly-report/reportColorSettings';

// ===== NAMED CONSTANTS =====

const WEEK_ICON = require('../../assets/icons/handoff/week.png');

const CLIENT_TITLE = 'No weekly report yet';
const CLIENT_COPY = 'Your first recap appears after you log check-ins across a week.';
const CLIENT_FOOTNOTE = 'Reports auto-build every week from your logged data.';
const CLIENT_CTA = "Log today's check-in";

const TRAINER_TITLE = 'Report not ready yet';
const TRAINER_COPY = 'Reports appear after check-ins and the weekly summary job.';
const TRAINER_FOOTNOTE =
  'Recap appears here after your weekly summary runs. Keep logging daily for sharper trends next week.';

// Manipulate here: dashed empty outline thickness (Design Law empty = dashed)
const DASH_BORDER_WIDTH = nb.borderWidth;

// Accent slot for the week handoff chip (matches progress PNG empty state)
const WEEK_CHIP_ACCENT_INDEX = 2;
const WEEK_CHIP_SIZE = 52;

// ===== MAIN FUNCTION =====

/**
 * Empty weekly report shell (client CTA or trainer “Not ready”).
 * Flow: 1. theme  2. footnote  3. dashed card style  4. inner card  5. layout
 * @param {{ isClientSelfView?: boolean, onLogCheckIn?: Function }} props
 */
export function NoReportYet({ isClientSelfView = false, onLogCheckIn }) {
  // vocab: useTheme = report light/dark tokens from reportColorSettings
  const { colors } = useTheme();

  // 1. Footnote copy — client vs trainer message lives in constants above.
  let footnoteText = TRAINER_FOOTNOTE;
  if (isClientSelfView) {
    footnoteText = CLIENT_FOOTNOTE;
  }

  // 2. Dashed card shell: surface + border tokens; client centers, trainer is a row.
  const dashedLayoutStyle = isClientSelfView
    ? styles.dashedClient
    : styles.dashedTrainer;
  const dashedCardStyle = [
    styles.dashed,
    {
      borderColor: colors.border,
      backgroundColor: colors.surfacePrimary,
    },
    dashedLayoutStyle,
  ];

  // 3. Name the inner card before JSX so we never nest client/trainer ternaries in the tree.
  let emptyCardInside = (
    <TrainerEmptyCard colors={colors} />
  );
  if (isClientSelfView) {
    emptyCardInside = (
      <ClientEmptyCard colors={colors} onLogCheckIn={onLogCheckIn} />
    );
  }

  const footnoteStyle = [styles.footnote, { color: colors.textMuted }];

  // 4. Root: dashed card + footnote under it.
  return (
    <View style={styles.root}>
      <View style={dashedCardStyle}>{emptyCardInside}</View>
      <Text style={footnoteStyle}>{footnoteText}</Text>
    </View>
  );
}

// ===== HELPER FUNCTIONS =====

/**
 * Client empty: week chip + centered copy + real NbButton or lookalike when no handler.
 */
function ClientEmptyCard({ colors, onLogCheckIn }) {
  const checkInHandlerIsReady = typeof onLogCheckIn === 'function';

  // Name the CTA node first — real button when parent wired a handler, else a non-press fake.
  let checkInCallToAction = (
    <FakeCheckInButton colors={colors} />
  );
  if (checkInHandlerIsReady) {
    checkInCallToAction = (
      <NbButton variant="fill" onPress={onLogCheckIn} style={styles.cta}>
        {CLIENT_CTA}
      </NbButton>
    );
  }

  return (
    <>
      <NbIconChip
        source={WEEK_ICON}
        index={WEEK_CHIP_ACCENT_INDEX}
        size={WEEK_CHIP_SIZE}
        colors={accentGradients[WEEK_CHIP_ACCENT_INDEX]}
      />
      <Text style={[styles.title, { color: colors.textPrimary }]}>{CLIENT_TITLE}</Text>
      <Text style={[styles.copy, { color: colors.textMuted }]}>{CLIENT_COPY}</Text>
      {checkInCallToAction}
    </>
  );
}

/**
 * Trainer empty: left copy + “Not ready” pill (no CTA — trainer cannot log for the client here).
 */
function TrainerEmptyCard({ colors }) {
  return (
    <View style={styles.trainerRow}>
      <View style={styles.trainerCopy}>
        <Text style={[styles.titleLeft, { color: colors.textPrimary }]}>{TRAINER_TITLE}</Text>
        <Text style={[styles.copyLeft, { color: colors.textMuted }]}>{TRAINER_COPY}</Text>
      </View>
      <NbPill variant="plain">Not ready</NbPill>
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Same look as the fill CTA when onLogCheckIn was not passed (preview / incomplete wiring).
 * Not pressable — keeps layout stable without inventing a no-op handler.
 */
function FakeCheckInButton({ colors }) {
  return (
    <View
      style={[
        styles.ctaFake,
        { backgroundColor: colors.fill, borderColor: colors.border },
      ]}
    >
      <Text style={[styles.ctaFakeText, { color: colors.onFill }]}>{CLIENT_CTA}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingHorizontal: nb.screenGutter,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  dashed: {
    borderWidth: DASH_BORDER_WIDTH,
    borderStyle: 'dashed',
    borderRadius: borderRadius.nbCard,
    padding: spacing.md + 2,
  },
  dashedClient: {
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  dashedTrainer: {
    gap: spacing.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  titleLeft: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  copy: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    textAlign: 'center',
  },
  copyLeft: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 4,
  },
  cta: {
    alignSelf: 'stretch',
    marginTop: spacing.sm,
  },
  ctaFake: {
    marginTop: spacing.sm,
    minHeight: nb.buttonMinHeight,
    borderRadius: borderRadius.nbButton,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: nb.chipPadding,
  },
  ctaFakeText: {
    fontSize: 16,
    fontWeight: '900',
  },
  trainerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trainerCopy: {
    flex: 1,
    minWidth: 0,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
  },
});
