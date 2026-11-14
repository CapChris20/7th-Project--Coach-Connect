// Design Law “Why are you reporting?” bottom sheet (settings flow PNG 29).
// Flow: pick a reason (radio) → optional Also block toggle → Cancel or Send report → parent submits.
// Used by: ChatScreen and TrainerProfilePopup instead of the native reason ActionSheet on Android.

import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet, Pressable } from 'react-native';
import NbSheet from '../look-and-feel/NbSheet';
import NbButton from '../look-and-feel/NbButton';
import NbSwitch from '../look-and-feel/NbSwitch';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { nb, spacing } from '../look-and-feel/colorPalette';
import { REPORT_REASONS } from './reportReasons';

// ===== NAMED CONSTANTS =====

const SHEET_TITLE = 'Why are you reporting?';
const ALSO_BLOCK_TITLE = 'Also block this person';
const ALSO_BLOCK_SUBTITLE = 'They will not be able to message you.';
const CANCEL_LABEL = 'Cancel';
const SEND_LABEL = 'Send report';
const SENDING_LABEL = 'Sending…';
const FALLBACK_REASON_ID = 'harassment';

// ===== HELPER FUNCTIONS =====

function firstReportReasonId() {
  if (REPORT_REASONS.length === 0) {
    return FALLBACK_REASON_ID;
  }
  const firstReason = REPORT_REASONS[0];
  if (!firstReason) {
    return FALLBACK_REASON_ID;
  }
  if (!firstReason.id) {
    return FALLBACK_REASON_ID;
  }
  return firstReason.id;
}

function labelForSendButton(busy) {
  if (busy) {
    return SENDING_LABEL;
  }
  return SEND_LABEL;
}

function sendReportToParent(onSubmit, selectedReasonId, alsoBlockPeer) {
  if (!selectedReasonId) {
    return;
  }
  if (!onSubmit) {
    return;
  }
  onSubmit({ reasonId: selectedReasonId, alsoBlock: alsoBlockPeer });
}

function buildReasonRadioRows(selectedReasonId, colors, onSelectReason) {
  const reasonRows = [];
  for (let index = 0; index < REPORT_REASONS.length; index += 1) {
    const reason = REPORT_REASONS[index];
    const isSelected = reason.id === selectedReasonId;
    reasonRows.push(
      <ReportReasonRow
        key={reason.id}
        reason={reason}
        isSelected={isSelected}
        inkColor={colors.nbInk}
        borderColor={colors.nbBorder}
        fillColor={colors.nbFill}
        onSelect={onSelectReason}
      />,
    );
  }
  return reasonRows;
}

// ===== SMALL UI PIECES =====

function ReportReasonRow({ reason, isSelected, inkColor, borderColor, fillColor, onSelect }) {
  const radioOuterStyle = [styles.radioOuter, { borderColor }];
  const reasonLabelStyle = [styles.reasonLabel, { color: inkColor }];

  let filledDot = null;
  if (isSelected) {
    filledDot = <View style={[styles.radioInner, { backgroundColor: fillColor }]} />;
  }

  function handlePress() {
    onSelect(reason.id);
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.reasonRow}
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={radioOuterStyle}>{filledDot}</View>
      <Text style={reasonLabelStyle}>{reason.label}</Text>
    </Pressable>
  );
}

function AlsoBlockCard({ colors, alsoBlockPeer, onAlsoBlockChange }) {
  const cardStyle = [
    styles.blockCard,
    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
  ];
  const titleStyle = [styles.blockTitle, { color: colors.nbInk }];
  const subtitleStyle = [styles.blockSub, { color: colors.nbMuted }];

  return (
    <View style={cardStyle}>
      <View style={styles.blockText}>
        <Text style={titleStyle}>{ALSO_BLOCK_TITLE}</Text>
        <Text style={subtitleStyle}>{ALSO_BLOCK_SUBTITLE}</Text>
      </View>
      <NbSwitch value={alsoBlockPeer} onValueChange={onAlsoBlockChange} />
    </View>
  );
}

function ReportSheetActions({ busy, sendIsDisabled, onCancel, onSend }) {
  const sendButtonLabel = labelForSendButton(busy);

  return (
    <View style={styles.actions}>
      <NbButton variant="plain" onPress={onCancel} style={styles.half} disabled={busy}>
        {CANCEL_LABEL}
      </NbButton>
      <NbButton
        variant="fill"
        style={styles.half}
        disabled={sendIsDisabled}
        onPress={onSend}
      >
        {sendButtonLabel}
      </NbButton>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet: pick why you are reporting, optionally also block, then Send.
 * Parent owns the real Firestore report + block writes via onSubmit.
 * @param {{
 *   visible: boolean,
 *   onClose: Function,
 *   onSubmit: Function,
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

  const startingReasonId = firstReportReasonId();
  const [selectedReasonId, setSelectedReasonId] = useState(startingReasonId);
  const [alsoBlockPeer, setAlsoBlockPeer] = useState(defaultAlsoBlock);

  useEffect(() => {
    if (!visible) {
      return;
    }
    setSelectedReasonId(firstReportReasonId());
    setAlsoBlockPeer(defaultAlsoBlock);
  }, [visible, defaultAlsoBlock]);

  // 1. Hand reason + also-block to the parent when Send is pressed.
  function handleSendReportPress() {
    sendReportToParent(onSubmit, selectedReasonId, alsoBlockPeer);
  }

  // 2. Name the send-button rules before JSX.
  const sendIsDisabled = busy || !selectedReasonId;
  const reasonRadioRows = buildReasonRadioRows(
    selectedReasonId,
    colors,
    setSelectedReasonId,
  );

  // 3. Paint reason radios → Also block card → Cancel / Send.
  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      <View style={styles.body}>
        {reasonRadioRows}

        <AlsoBlockCard
          colors={colors}
          alsoBlockPeer={alsoBlockPeer}
          onAlsoBlockChange={setAlsoBlockPeer}
        />

        <ReportSheetActions
          busy={busy}
          sendIsDisabled={sendIsDisabled}
          onCancel={onClose}
          onSend={handleSendReportPress}
        />
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
