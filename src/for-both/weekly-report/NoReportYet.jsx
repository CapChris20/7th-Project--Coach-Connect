// Design Law empty weekly report — dashed card + icon chip (progress / trainees PNGs).
// Flow: client gets check-in CTA; trainer gets “Not ready” pill. No gradient borders.
// Used by WeeklyReportScreen when no weeklySummaries exist.

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
const DASH_BORDER = nb.borderWidth;

// ===== MAIN FUNCTION =====

/**
 * @param {{ isClientSelfView?: boolean, onLogCheckIn?: Function }} props
 */
export function NoReportYet({ isClientSelfView = false, onLogCheckIn }) {
  const { colors } = useTheme();
  const title = isClientSelfView ? CLIENT_TITLE : TRAINER_TITLE;
  const copy = isClientSelfView ? CLIENT_COPY : TRAINER_COPY;
  const footnote = isClientSelfView ? CLIENT_FOOTNOTE : TRAINER_FOOTNOTE;

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.dashed,
          {
            borderColor: colors.border,
            backgroundColor: colors.surfacePrimary,
          },
          isClientSelfView ? styles.dashedClient : styles.dashedTrainer,
        ]}
      >
        {isClientSelfView ? (
          <>
            <NbIconChip source={WEEK_ICON} index={2} size={52} colors={accentGradients[2]} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
            <Text style={[styles.copy, { color: colors.textMuted }]}>{copy}</Text>
            {typeof onLogCheckIn === 'function' ? (
              <NbButton variant="fill" onPress={onLogCheckIn} style={styles.cta}>
                {CLIENT_CTA}
              </NbButton>
            ) : (
              <View
                style={[
                  styles.ctaFake,
                  { backgroundColor: colors.fill, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.ctaFakeText, { color: colors.onFill }]}>{CLIENT_CTA}</Text>
              </View>
            )}
          </>
        ) : (
          <View style={styles.trainerRow}>
            <View style={styles.trainerCopy}>
              <Text style={[styles.titleLeft, { color: colors.textPrimary }]}>{title}</Text>
              <Text style={[styles.copyLeft, { color: colors.textMuted }]}>{copy}</Text>
            </View>
            <NbPill variant="plain">Not ready</NbPill>
          </View>
        )}
      </View>

      <Text style={[styles.footnote, { color: colors.textMuted }]}>{footnote}</Text>
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
    borderWidth: DASH_BORDER,
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
