// Design Law certification upload sheet for trainer Edit profile.
// Flow: open sheet → pick file → upload + optional AI verify → parent refreshes list.
// Used by MyProfileScreen “Add Certification” (replaces bare inline button-only chrome).
//
// vocab: DocumentPicker = system file picker; uploadTrainerCertificationSheet writes Storage + user doc
// Manipulate here: helper copy, max size messaging (enforced in pick helper)

import React from 'react';
import { ActivityIndicator, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const TITLE = 'Add certification';
const BODY =
  'Upload a PDF or photo of your cert. We check images automatically when we can; PDFs go to manual review.';

// ===== MAIN =====

/**
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

  return (
    <NbSheet visible={visible} onClose={onClose} title={TITLE}>
      <View style={styles.body}>
        <View
          style={[
            styles.iconBox,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurfaceChip },
          ]}
        >
          <Ionicons name="cloud-upload-outline" size={28} color={colors.nbInk} />
        </View>
        <Text style={[styles.copy, { color: colors.nbMuted }]}>{BODY}</Text>

        {uploading ? (
          <View style={styles.progressBlock}>
            <Text style={[styles.progressLabel, { color: colors.nbMuted }]}>
              {`Uploading… ${Math.max(0, Math.min(100, progress))}%`}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.nbBorder }]}>
              <View
                style={[
                  styles.fill,
                  {
                    width: `${Math.max(4, Math.min(100, progress))}%`,
                    backgroundColor: colors.nbFill,
                  },
                ]}
              />
            </View>
            <ActivityIndicator color={colors.nbInk} style={{ marginTop: 8 }} />
          </View>
        ) : (
          <View style={styles.row}>
            <NbButton variant="plain" onPress={onClose} style={styles.half}>
              Cancel
            </NbButton>
            <NbButton variant="fill" onPress={onPickUpload} style={styles.half}>
              Choose file
            </NbButton>
          </View>
        )}
      </View>
    </NbSheet>
  );
}

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
});
