// Design Law remove-trainer sheet — reason chips, “What changes”, Keep / Remove.
// Flow: pick why → Remove calls removeTrainerClientLink → parent refreshes → close.
// Used from client Settings / home card and trainer client detail. Firebase projectId stays anatrox-auth.

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

const REASONS = [
  'Not seeing results',
  'Poor communication',
  'Too expensive',
  'Scheduling issues',
  'Found a different trainer',
  'Other',
];

// ===== HELPER FUNCTIONS =====

function nextSelectedReasons(currentReasons, reasonLabel) {
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
    throw new Error('Cloud Functions not initialized');
  }
  const removeLinkCall = httpsCallable(functions, 'removeTrainerClientLink');
  return removeLinkCall({
    trainerId,
    clientId,
    reasons,
    otherText,
    removedBy,
  });
}

function keepLabel(removedBy, displayName) {
  if (removedBy === 'client') {
    return displayName ? `Keep ${displayName.split(' ')[0]}` : 'Keep trainer';
  }
  return displayName ? `Keep ${displayName.split(' ')[0]}` : 'Keep client';
}

function removeTitle(removedBy, displayName) {
  if (removedBy === 'client') {
    return displayName
      ? `Remove ${displayName.split(' ')[0]} as your trainer?`
      : 'Remove your trainer?';
  }
  return displayName ? `Remove ${displayName.split(' ')[0]} as a client?` : 'Remove this client?';
}

// ===== MAIN FUNCTION =====

/**
 * Single Design Law sheet (not the old 3-step purple wizard).
 * @param {object} props
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

  const toggleReason = (reasonLabel) => {
    setSelectedReasons((currentReasons) => nextSelectedReasons(currentReasons, reasonLabel));
  };

  const handleRemoval = async () => {
    if (!trainerId || !clientId || !canRemove) return;
    setRemovalError(null);
    setIsRemoving(true);
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
      setRemovalError('Something went wrong. Please try again.');
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder,
              paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.sm,
            },
          ]}
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
            {/* Design Law accent pill — small gradient OK; no purple borders */}
            <NbPill variant="energy">Ends coaching</NbPill>

            <Text style={[styles.title, { color: colors.nbInk }]}>
              {removeTitle(removedBy, displayName)}
            </Text>
            <Text style={[styles.sub, { color: colors.nbMuted }]}>
              Why are you leaving? This helps other clients and {displayName || 'them'}.
            </Text>

            <View style={styles.chipWrap}>
              {REASONS.map((reasonLabel) => {
                const selected = selectedReasons.includes(reasonLabel);
                return (
                  <Pressable
                    key={reasonLabel}
                    onPress={() => toggleReason(reasonLabel)}
                    style={[
                      styles.chip,
                      {
                        borderColor: colors.nbBorder,
                        backgroundColor: selected ? colors.nbFill : colors.nbSurface,
                        shadowColor: colors.nbShadow,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: selected ? colors.nbOnFill : colors.nbInk },
                      ]}
                    >
                      {reasonLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedReasons.includes('Other') ? (
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

            <NbCard style={styles.changesCard}>
              <Text style={[styles.changesTitle, { color: colors.nbInk }]}>What changes</Text>
              <Text style={[styles.changesBody, { color: colors.nbMuted }]}>
                Your plans stay on your phone. {displayName || 'They'} stop seeing new logs. Billing
                for future sessions stops.
              </Text>
            </NbCard>

            {removalError ? (
              <Text style={[styles.errorText, { color: colors.nbInk }]}>{removalError}</Text>
            ) : null}

            <View style={styles.actions}>
              <View style={styles.actionFlex}>
                <NbButton variant="ghost" onPress={onClose} disabled={isRemoving}>
                  {keepLabel(removedBy, displayName)}
                </NbButton>
              </View>
              <View style={styles.actionFlex}>
                <NbButton variant="fill" onPress={handleRemoval} disabled={!canRemove}>
                  {isRemoving
                    ? 'Removing…'
                    : removedBy === 'client'
                      ? 'Remove trainer'
                      : 'Remove client'}
                </NbButton>
              </View>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
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
