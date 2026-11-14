// Design Law remove-trainer sheet — reason chips, “What changes”, Keep / Remove.
// Flow: pick why → Remove calls removeTrainerClientLink → parent refreshes → close.
// Used from client Settings / home card and trainer client detail. Firebase projectId stays anatrox-auth.
// Read order: constants → chip layout → RemoveTrainerPopup → PLUMBING (copy + cloud call).

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../app-start/cloudConnection';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbButton from '../../look-and-feel/NbButton';
import NbCard from '../../look-and-feel/NbCard';
import NbPill from '../../look-and-feel/NbPill';
import { nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: reason chips shown on the sheet (order = display order)
const REASONS = [
  'Not seeing results',
  'Poor communication',
  'Too expensive',
  'Scheduling issues',
  'Found a different trainer',
  'Other',
];

const OTHER_REASON_LABEL = 'Other';
const REMOVAL_GENERIC_ERROR = 'Something went wrong. Please try again.';
const CLOUD_FN_NOT_READY = 'Cloud Functions not initialized';
const REMOVE_TRAINER_CLIENT_LINK_FN = 'removeTrainerClientLink';
const ENDS_COACHING_PILL = 'Ends coaching';

// ===== HELPER FUNCTIONS =====

function RemoveReasonChip({ reasonLabel, selected, colors, onToggle }) {
  let chipBackground = colors.nbSurface;
  let labelColor = colors.nbInk;
  if (selected) {
    chipBackground = colors.nbFill;
    labelColor = colors.nbOnFill;
  }

  return (
    <Pressable
      onPress={() => onToggle(reasonLabel)}
      style={[
        styles.chip,
        {
          borderColor: colors.nbBorder,
          backgroundColor: chipBackground,
          shadowColor: colors.nbShadow,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, { color: labelColor }]}>{reasonLabel}</Text>
    </Pressable>
  );
}

function ReasonChipRow({ selectedReasons, colors, onToggleReason }) {
  return (
    <View style={styles.chipWrap}>
      {REASONS.map((reasonLabel) => (
        <RemoveReasonChip
          key={reasonLabel}
          reasonLabel={reasonLabel}
          selected={selectedReasons.includes(reasonLabel)}
          colors={colors}
          onToggle={onToggleReason}
        />
      ))}
    </View>
  );
}

function WhatChangesCard({ colors, displayName }) {
  const whoStopsSeeingLogs = displayName || 'They';

  return (
    <NbCard style={styles.changesCard}>
      <Text style={[styles.changesTitle, { color: colors.nbInk }]}>What changes</Text>
      <Text style={[styles.changesBody, { color: colors.nbMuted }]}>
        Your plans stay on your phone. {whoStopsSeeingLogs} stop seeing new logs. Billing
        for future sessions stops.
      </Text>
    </NbCard>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Single Design Law sheet (not the old 3-step purple wizard).
 * Hook order stays: theme → insets → selectedReasons → otherText → isRemoving → removalError → reset effect.
 */
export default function RemoveTrainerPopup({
  visible,
  onClose,
  onRemovalComplete,
  trainerName,
  clientName,
  removedBy,
  trainerId,
  clientId,
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [otherText, setOtherText] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalError, setRemovalError] = useState(null);

  // Reset form when the sheet closes so the next open starts blank.
  useEffect(() => {
    if (!visible) {
      setSelectedReasons([]);
      setOtherText('');
      setIsRemoving(false);
      setRemovalError(null);
    }
  }, [visible]);

  const displayName = removedBy === 'client' ? trainerName : clientName;
  const canRemove = selectedReasons.length > 0 && !isRemoving;
  const sheetBottomPadding = Math.max(insets.bottom, spacing.md) + spacing.sm;
  const showOtherField = selectedReasons.includes(OTHER_REASON_LABEL);
  const removeButtonWords = labelForRemoveButton(removedBy, isRemoving);
  const keepButtonWords = keepRelationshipLabel(removedBy, displayName);
  const sheetTitle = removeSheetTitle(removedBy, displayName);
  const whyLeavingLine = `Why are you leaving? This helps other clients and ${displayName || 'them'}.`;
  const sheetSurfaceStyle = {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
    paddingBottom: sheetBottomPadding,
  };

  const toggleReason = (reasonLabel) => {
    setSelectedReasons((currentReasons) => toggleReasonInList(currentReasons, reasonLabel));
  };

  const handleRemoval = async () => {
    // 1. Bail when ids or reasons are missing.
    if (!trainerId || !clientId || !canRemove) return;

    // 2. Call the cloud function, then let the parent refresh.
    setRemovalError(null);
    setIsRemoving(true);
    await runRemovalThenClose({
      trainerId,
      clientId,
      selectedReasons,
      otherText,
      removedBy,
      onRemovalComplete,
      onClose,
      setRemovalError,
      setIsRemoving,
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[styles.sheet, sheetSurfaceStyle]}
          onPress={(event) => event.stopPropagation?.()}
        >
          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: colors.nbBorder }]} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollPad}
          >
            <NbPill variant="energy">{ENDS_COACHING_PILL}</NbPill>

            <Text style={[styles.title, { color: colors.nbInk }]}>{sheetTitle}</Text>
            <Text style={[styles.sub, { color: colors.nbMuted }]}>{whyLeavingLine}</Text>

            <ReasonChipRow
              selectedReasons={selectedReasons}
              colors={colors}
              onToggleReason={toggleReason}
            />

            {showOtherField ? (
              <TextInput
                placeholder="Tell us more (optional)"
                placeholderTextColor={colors.nbMuted}
                value={otherText}
                onChangeText={setOtherText}
                style={[
                  styles.otherInput,
                  {
                    backgroundColor: colors.nbBackground,
                    borderColor: colors.nbBorder,
                    color: colors.nbInk,
                    shadowColor: colors.nbShadow,
                  },
                ]}
              />
            ) : null}

            <WhatChangesCard colors={colors} displayName={displayName} />

            {removalError ? (
              <Text style={[styles.errorText, { color: colors.nbInk }]}>{removalError}</Text>
            ) : null}

            <View style={styles.actions}>
              <View style={styles.actionFlex}>
                <NbButton variant="ghost" onPress={onClose} disabled={isRemoving}>
                  {keepButtonWords}
                </NbButton>
              </View>
              <View style={styles.actionFlex}>
                <NbButton variant="fill" onPress={handleRemoval} disabled={!canRemove}>
                  {removeButtonWords}
                </NbButton>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ===== PLUMBING — skip unless debugging copy strings or the cloud call =====

async function runRemovalThenClose({
  trainerId,
  clientId,
  selectedReasons,
  otherText,
  removedBy,
  onRemovalComplete,
  onClose,
  setRemovalError,
  setIsRemoving,
}) {
  try {
    await callRemoveTrainerClientLink({
      trainerId,
      clientId,
      reasons: selectedReasons,
      otherText: otherText || null,
      removedBy,
    });
    onRemovalComplete?.();
    onClose?.();
  } catch (caughtError) {
    console.error('RemoveTrainerPopup removal error:', caughtError);
    setRemovalError(REMOVAL_GENERIC_ERROR);
  } finally {
    setIsRemoving(false);
  }
}

function firstNameFromDisplayName(displayName) {
  if (!displayName) return '';
  return displayName.split(' ')[0];
}

function keepRelationshipLabel(removedBy, displayName) {
  const firstName = firstNameFromDisplayName(displayName);
  if (removedBy === 'client') {
    return firstName ? `Keep ${firstName}` : 'Keep trainer';
  }
  return firstName ? `Keep ${firstName}` : 'Keep client';
}

function removeSheetTitle(removedBy, displayName) {
  const firstName = firstNameFromDisplayName(displayName);
  if (removedBy === 'client') {
    return firstName ? `Remove ${firstName} as your trainer?` : 'Remove your trainer?';
  }
  return firstName ? `Remove ${firstName} as a client?` : 'Remove this client?';
}

function labelForRemoveButton(removedBy, isRemoving) {
  if (isRemoving) return 'Removing…';
  if (removedBy === 'client') return 'Remove trainer';
  return 'Remove client';
}

function toggleReasonInList(currentReasons, reasonLabel) {
  if (currentReasons.includes(reasonLabel)) {
    return currentReasons.filter((label) => label !== reasonLabel);
  }
  return [...currentReasons, reasonLabel];
}

/**
 * Cloud Function that ends the trainer–client link. Same argument keys as before.
 * vocab: httpsCallable = Firebase callable. Server name stays removeTrainerClientLink.
 * @param {{ trainerId: string, clientId: string, reasons: string[], otherText: string|null, removedBy: string }} args
 * @returns {Promise<unknown>}
 */
async function callRemoveTrainerClientLink({ trainerId, clientId, reasons, otherText, removedBy }) {
  if (!functions) {
    throw new Error(CLOUD_FN_NOT_READY);
  }
  const removeLinkCall = httpsCallable(functions, REMOVE_TRAINER_CLIENT_LINK_FN);
  return removeLinkCall({
    trainerId,
    clientId,
    reasons,
    otherText,
    removedBy,
  });
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: nb.borderWidth,
    borderLeftWidth: nb.borderWidth,
    borderRightWidth: nb.borderWidth,
    paddingTop: spacing.sm,
  },
  handleWrap: { alignItems: 'center', marginBottom: spacing.sm },
  handle: { width: 40, height: 4, borderRadius: 999 },
  scrollPad: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  title: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  sub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: spacing.md,
  },
  // Manipulate here: reason chip padding / hard shadow
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    minHeight: 40,
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  chipText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  otherInput: {
    fontFamily: 'Inter_400Regular',
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  changesCard: {
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  changesTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
    marginBottom: 6,
  },
  changesBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
  },
  errorText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionFlex: { flex: 1 },
});
