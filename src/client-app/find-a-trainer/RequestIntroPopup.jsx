// Optional intro message sheet before a connection request is sent (PNG 15).
// Flow: bottom HardShadow sheet → optional draft → Cancel or Continue → Close on backdrop.
// Used by SearchTrainersScreen connect flow. Busy disables every tap so a double-send cannot fire.
//
// vocab: HardShadow sheet = Design Law bottom modal with 3px border + grabber (not centered NbCard)

import React, { useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import NbButton from '../../look-and-feel/NbButton';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const FALLBACK_COACH_NAME = 'your coach';
const KEYBOARD_PAD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : undefined;
const MIN_BOTTOM_PAD = 16;

// Manipulate here: goal / level chips shown under the note (display only — request payload unchanged)
const DEFAULT_GOAL_CHIP = 'Build Muscle';
const DEFAULT_LEVEL_CHIP = 'Intermediate';

// ===== HELPER FUNCTIONS =====

/**
 * First name only, so the title stays short.
 * @param {string} trainerName
 * @returns {string}
 */
function firstNameForTitle(trainerName) {
  const trimmedName = String(trainerName || FALLBACK_COACH_NAME).trim();
  return trimmedName.split(/\s+/)[0] || FALLBACK_COACH_NAME;
}

// ===== MAIN FUNCTION =====

/**
 * Optional intro message before a connection request is sent — PNG 15 bottom sheet.
 * @param {object} props
 */
export default function RequestIntroPopup({
  visible,
  trainerName,
  messageDraft,
  onChangeMessage,
  onSkip,
  onSendMessage,
  onClose,
  busy = false,
  goalLabel = DEFAULT_GOAL_CHIP,
  levelLabel = DEFAULT_LEVEL_CHIP,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const firstName = useMemo(() => firstNameForTitle(trainerName), [trainerName]);
  const closeUnlessBusy = busy ? undefined : onClose;
  // Cancel closes the sheet. Continue sends (onSendMessage). onSkip kept for older callers who wired Skip→send.
  const cancelUnlessBusy = busy ? undefined : onClose;
  const continueUnlessBusy = busy ? undefined : (onSendMessage || onSkip);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={closeUnlessBusy}>
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_PAD_BEHAVIOR}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={closeUnlessBusy} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.nbSurface,
                borderColor: colors.nbBorder,
                paddingBottom: Math.max(insets.bottom, MIN_BOTTOM_PAD),
              },
            ]}
          >
            <View style={styles.handle}>
              <View style={[styles.handleBar, { backgroundColor: colors.nbBorder }]} />
            </View>

            <Text style={[styles.title, { color: colors.nbInk }]}>
              Say hello to {firstName}
            </Text>
            <Text style={[styles.subtitle, { color: colors.nbMuted }]}>
              A short note helps {firstName} say yes. They see your goal and level.
            </Text>

            {/* Goal + level chips (display context for the trainer) */}
            <View style={[styles.chipBox, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
              <LinearGradient
                colors={accentGradients[0]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.contextChip, { borderColor: colors.nbBorder }]}
              >
                <Text style={[styles.contextChipText, { color: colors.nbInk }]} numberOfLines={1}>
                  {goalLabel}
                </Text>
              </LinearGradient>
              <View
                style={[
                  styles.contextChip,
                  { borderColor: colors.nbBorder, backgroundColor: colors.nbSoft || colors.nbSurfaceChip || colors.nbSurface },
                ]}
              >
                <Text style={[styles.contextChipText, { color: colors.nbInk }]} numberOfLines={1}>
                  {levelLabel}
                </Text>
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>MESSAGE</Text>
            <TextInput
              value={messageDraft}
              onChangeText={onChangeMessage}
              placeholder={`Hi ${firstName}, I want to…`}
              placeholderTextColor={colors.nbMuted}
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!busy}
              style={[
                styles.input,
                {
                  backgroundColor: colors.nbSurface,
                  borderColor: colors.nbBorder,
                  color: colors.nbInk,
                },
              ]}
            />

            <View style={styles.actions}>
              <NbButton variant="plain" onPress={cancelUnlessBusy} disabled={busy} style={styles.actionBtn}>
                Cancel
              </NbButton>
              <NbButton variant="fill" onPress={continueUnlessBusy} disabled={busy} style={styles.actionBtnWide}>
                Continue
              </NbButton>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: borderRadius.nbSheet,
    borderTopRightRadius: borderRadius.nbSheet,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    paddingHorizontal: spacing.lg,
    maxHeight: '88%',
  },
  handle: {
    alignItems: 'center',
    paddingTop: spacing.sm + 4,
    paddingBottom: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  title: {
    fontSize: 24,
    fontFamily: 'SpaceGrotesk_700Bold',
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  chipBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    marginBottom: spacing.md,
  },
  contextChip: {
    borderWidth: nb.borderWidthPill,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  contextChipText: {
    fontSize: 13,
    fontFamily: 'SpaceGrotesk_700Bold',
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  input: {
    borderRadius: borderRadius.nbInput,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    minHeight: 110,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: spacing.sm,
  },
  actionBtn: { flex: 1 },
  actionBtnWide: { flex: 1.4 },
});
