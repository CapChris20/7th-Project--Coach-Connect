// Design Law certification upload sheet for trainer Edit profile.
// Flow: open sheet → pick file → upload + optional AI verify → parent refreshes list.
// Used by MyProfileScreen “Add Certification” (replaces bare inline button-only chrome).

import React from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const SHEET_TITLE = 'Add certification';
const SHEET_BODY =
  'Upload a PDF or photo of your cert. We check images automatically when we can; PDFs go to manual review.';
// Manipulate here: progress bar never collapses to 0-width while upload is running
const PROGRESS_MIN_WIDTH_PERCENT = 4;
const PROGRESS_MAX_PERCENT = 100;
const UPLOAD_ICON_NAME = 'cloud-upload-outline';
const UPLOAD_ICON_SIZE = 28;

// ===== HELPER FUNCTIONS =====

function clampUploadPercent(percentValue) {
  const asNumber = Number(percentValue);
  if (!Number.isFinite(asNumber)) return 0;
  if (asNumber < 0) return 0;
  if (asNumber > PROGRESS_MAX_PERCENT) return PROGRESS_MAX_PERCENT;
  return asNumber;
}

function barWidthPercentFromProgress(progressPercent) {
  const safePercent = clampUploadPercent(progressPercent);
  if (safePercent < PROGRESS_MIN_WIDTH_PERCENT) return PROGRESS_MIN_WIDTH_PERCENT;
  return safePercent;
}

function UploadProgressPanel({ progressPercent, inkColor, mutedColor, borderColor, fillColor }) {
  const safePercent = clampUploadPercent(progressPercent);
  const barWidthPercent = barWidthPercentFromProgress(progressPercent);
  const progressLabel = `Uploading… ${safePercent}%`;

  return (
    <View style={styles.progressBlock}>
      <Text style={[styles.progressLabel, { color: mutedColor }]}>{progressLabel}</Text>
      <View style={[styles.track, { backgroundColor: borderColor }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${barWidthPercent}%`,
              backgroundColor: fillColor,
            },
          ]}
        />
      </View>
      <ActivityIndicator color={inkColor} style={styles.progressSpinner} />
    </View>
  );
}

function UploadIdleActions({ onClose, onPickUpload }) {
  return (
    <View style={styles.row}>
      <NbButton variant="plain" onPress={onClose} style={styles.half}>
        Cancel
      </NbButton>
      <NbButton variant="fill" onPress={onPickUpload} style={styles.half}>
        Choose file
      </NbButton>
    </View>
  );
}

function UploadSheetIntro({ borderColor, chipBackground, inkColor, mutedColor }) {
  return (
    <>
      <View
        style={[
          styles.iconBox,
          { borderColor, backgroundColor: chipBackground },
        ]}
      >
        <Ionicons name={UPLOAD_ICON_NAME} size={UPLOAD_ICON_SIZE} color={inkColor} />
      </View>
      <Text style={[styles.copy, { color: mutedColor }]}>{SHEET_BODY}</Text>
    </>
  );
}

function bodyActionsForUploadState({
  showUploadProgress,
  onClose,
  onPickUpload,
  progressPercent,
  colors,
}) {
  if (showUploadProgress) {
    return (
      <UploadProgressPanel
        progressPercent={progressPercent}
        inkColor={colors.nbInk}
        mutedColor={colors.nbMuted}
        borderColor={colors.nbBorder}
        fillColor={colors.nbFill}
      />
    );
  }
  return <UploadIdleActions onClose={onClose} onPickUpload={onPickUpload} />;
}

// ===== MAIN FUNCTION =====

/**
 * Certification upload sheet — file picker CTA and upload progress UI.
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onPickUpload: Function,
 *   uploading?: boolean,
 *   progress?: number,
 * }} props
 */
export default function CertificationUploadSheet({
  visible,
  onClose,
  onPickUpload,
  uploading = false,
  progress = 0,
}) {
  const { colors } = useTheme();

  // 1. Decide progress panel vs Cancel / Choose file row.
  const showUploadProgress = uploading === true;
  const bodyActions = bodyActionsForUploadState({
    showUploadProgress,
    onClose,
    onPickUpload,
    progressPercent: progress,
    colors,
  });

  // 2. Sheet chrome + intro + body actions.
  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      <View style={styles.body}>
        <UploadSheetIntro
          borderColor={colors.nbBorder}
          chipBackground={colors.nbSurfaceChip}
          inkColor={colors.nbInk}
          mutedColor={colors.nbMuted}
        />
        {bodyActions}
      </View>
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: 14,
  },
  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
  },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  progressBlock: { gap: 8 },
  progressLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  progressSpinner: { marginTop: 8 },
});
