// Design Law “Why are you reporting?” sheet (settings PNG 29).
// Flow: pick reason → optional Also block → Cancel / Send report → parent submits + blocks.
// Used by ChatScreen and TrainerProfilePopup (replaces native ActionSheet reason picker).
//
// vocab: REPORT_REASONS ids stay the Firestore keys; labels are PNG copy
// Manipulate here: ALSO_BLOCK copy, button labels

import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import NbSheet from '../look-and-feel/NbSheet';
import NbButton from '../look-and-feel/NbButton';
import NbSwitch from '../look-and-feel/NbSwitch';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { nb, spacing } from '../look-and-feel/colorPalette';
import { REPORT_REASONS } from './reportReasons';

// ===== NAMED CONSTANTS =====

const TITLE = 'Why are you reporting?';
const ALSO_BLOCK_TITLE = 'Also block this person';
const ALSO_BLOCK_SUB = 'They will not be able to message you.';

// ===== MAIN =====

/**
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onSubmit: Function, // ({ reasonId: string, alsoBlock: boolean }) => void|Promise
 *   peerName?: string,
 *   busy?: boolean,
 *   defaultAlsoBlock?: boolean,
 * }} props
 */
export default function ReportOrBlockSheet({
  visible,
  onClose,
  onSubmit,
  peerName: _peerName,
  busy = false,
  defaultAlsoBlock = true,
}) {
  const { colors } = useTheme();
  const [reasonId, setReasonId] = useState(REPORT_REASONS[0]?.id || 'harassment');
  const [alsoBlock, setAlsoBlock] = useState(defaultAlsoBlock);

  useEffect(() => {
    if (!visible) return;
    setReasonId(REPORT_REASONS[0]?.id || 'harassment');
    setAlsoBlock(defaultAlsoBlock);
  }, [visible, defaultAlsoBlock]);

  return (
    <NbSheet visible={visible} onClose={onClose} title={TITLE}>
      <View style={styles.body}>
        {REPORT_REASONS.map((reason) => {
          const selected = reason.id === reasonId;
          return (
            <Pressable
              key={reason.id}
              onPress={() => setReasonId(reason.id)}
              style={styles.reasonRow}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: colors.nbBorder },
                ]}
              >
                {selected ? (
                  <View style={[styles.radioInner, { backgroundColor: colors.nbFill }]} />
                ) : null}
              </View>
              <Text style={[styles.reasonLabel, { color: colors.nbInk }]}>{reason.label}</Text>
            </Pressable>
          );
        })}

        <View
          style={[
            styles.blockCard,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          <View style={styles.blockText}>
            <Text style={[styles.blockTitle, { color: colors.nbInk }]}>{ALSO_BLOCK_TITLE}</Text>
            <Text style={[styles.blockSub, { color: colors.nbMuted }]}>{ALSO_BLOCK_SUB}</Text>
          </View>
          <NbSwitch value={alsoBlock} onValueChange={setAlsoBlock} />
        </View>

        <View style={styles.actions}>
          <NbButton variant="plain" onPress={onClose} style={styles.half} disabled={busy}>
            Cancel
          </NbButton>
          <NbButton
            variant="fill"
            style={styles.half}
            disabled={busy || !reasonId}
            onPress={() => onSubmit?.({ reasonId, alsoBlock })}
          >
            {busy ? 'Sending…' : 'Send report'}
          </NbButton>
        </View>
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
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 44,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  reasonLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
  },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    padding: 14,
  },
  blockText: { flex: 1, minWidth: 0 },
  blockTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  blockSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  half: { flex: 1 },
});
