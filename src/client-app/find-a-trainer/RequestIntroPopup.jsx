// Optional intro message sheet before a connection request is sent (PNG 15).
// Flow: bottom sheet → optional draft → Cancel or Continue → Close on backdrop.
// Used by SearchTrainersScreen connect flow. Busy disables every tap so a double-send cannot fire.

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
const MESSAGE_MAX_LENGTH = 500;
const MESSAGE_LINE_COUNT = 4;

// Manipulate here: goal / level chips shown under the note (display only — request payload unchanged)
const DEFAULT_GOAL_CHIP = 'Build Muscle';
const DEFAULT_LEVEL_CHIP = 'Intermediate';

// ===== HELPER FUNCTIONS =====

function coachFirstNameForTitle(trainerName) {
  const trimmedName = String(trainerName || FALLBACK_COACH_NAME).trim();
  const nameParts = trimmedName.split(/\s+/);
  if (nameParts[0]) {
    return nameParts[0];
  }
  return FALLBACK_COACH_NAME;
}

function messagePlaceholderForCoach(firstName) {
  return `Hi ${firstName}, I want to…`;
}

function levelChipBackgroundColor(colors) {
  if (colors.nbSoft) {
    return colors.nbSoft;
  }
  if (colors.nbSurfaceChip) {
    return colors.nbSurfaceChip;
  }
  return colors.nbSurface;
}

function handlersWhileNotBusy(busy, onClose, onSendMessage, onSkip) {
  if (busy) {
    return {
      closeUnlessBusy: undefined,
      continueUnlessBusy: undefined,
      canEditMessage: false,
    };
  }

  let continueUnlessBusy = onSkip;
  if (onSendMessage) {
    continueUnlessBusy = onSendMessage;
  }

  return {
    closeUnlessBusy: onClose,
    continueUnlessBusy,
    canEditMessage: true,
  };
}

// ===== SMALL UI PIECES =====

function GoalLevelChipRow({ goalLabel, levelLabel, colors }) {
  const levelChipBackground = levelChipBackgroundColor(colors);

  return (
    <View
      style={[
        styles.chipBox,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
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
          { borderColor: colors.nbBorder, backgroundColor: levelChipBackground },
        ]}
      >
        <Text style={[styles.contextChipText, { color: colors.nbInk }]} numberOfLines={1}>
          {levelLabel}
        </Text>
      </View>
    </View>
  );
}

function IntroSheetBody({
  colors,
  sheetBottomPad,
  firstName,
  goalLabel,
  levelLabel,
  messageDraft,
  onChangeMessage,
  messagePlaceholder,
  canEditMessage,
  closeUnlessBusy,
  continueUnlessBusy,
  busy,
}) {
  const sheetChrome = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
    paddingBottom: sheetBottomPad,
  };

  const inputChrome = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
    color: colors.nbInk,
  };

  return (
    <View style={[styles.sheet, sheetChrome]}>
      <View style={styles.handle}>
        <View style={[styles.handleBar, { backgroundColor: colors.nbBorder }]} />
      </View>

      <Text style={[styles.title, { color: colors.nbInk }]}>
        Say hello to {firstName}
      </Text>
      <Text style={[styles.subtitle, { color: colors.nbMuted }]}>
        A short note helps {firstName} say yes. They see your goal and level.
      </Text>

      <GoalLevelChipRow goalLabel={goalLabel} levelLabel={levelLabel} colors={colors} />

      <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>MESSAGE</Text>
      <TextInput
        value={messageDraft}
        onChangeText={onChangeMessage}
        placeholder={messagePlaceholder}
        placeholderTextColor={colors.nbMuted}
        multiline
        numberOfLines={MESSAGE_LINE_COUNT}
        maxLength={MESSAGE_MAX_LENGTH}
        editable={canEditMessage}
        style={[styles.input, inputChrome]}
      />

      <View style={styles.actions}>
        <NbButton
          variant="plain"
          onPress={closeUnlessBusy}
          disabled={busy}
          style={styles.actionBtn}
        >
          Cancel
        </NbButton>
        <NbButton
          variant="fill"
          onPress={continueUnlessBusy}
          disabled={busy}
          style={styles.actionBtnWide}
        >
          Continue
        </NbButton>
      </View>
    </View>
  );
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
  // 1. Theme + home-indicator insets.
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // 2. Short coach name for title + placeholder.
  // Hook order frozen — keep useMemo here.
  const firstName = useMemo(() => coachFirstNameForTitle(trainerName), [trainerName]);
  const sheetBottomPad = Math.max(insets.bottom, MIN_BOTTOM_PAD);
  const messagePlaceholder = messagePlaceholderForCoach(firstName);

  // 3. Busy blocks backdrop + buttons; Continue still wires through onSendMessage (or legacy onSkip).
  const tapHandlers = handlersWhileNotBusy(busy, onClose, onSendMessage, onSkip);
  const closeUnlessBusy = tapHandlers.closeUnlessBusy;
  const continueUnlessBusy = tapHandlers.continueUnlessBusy;
  const canEditMessage = tapHandlers.canEditMessage;

  // 4. Bottom sheet with optional note — payload keys stay on the parent send handler.
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={closeUnlessBusy}
    >
      <KeyboardAvoidingView style={styles.flex} behavior={KEYBOARD_PAD_BEHAVIOR}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={closeUnlessBusy} />
          <IntroSheetBody
            colors={colors}
            sheetBottomPad={sheetBottomPad}
            firstName={firstName}
            goalLabel={goalLabel}
            levelLabel={levelLabel}
            messageDraft={messageDraft}
            onChangeMessage={onChangeMessage}
            messagePlaceholder={messagePlaceholder}
            canEditMessage={canEditMessage}
            closeUnlessBusy={closeUnlessBusy}
            continueUnlessBusy={continueUnlessBusy}
            busy={busy}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
