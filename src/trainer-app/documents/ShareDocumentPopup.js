// Share a trainer document with clients — Design Law bottom sheet (PNG 19–20).
// Flow: open sheet → load trainer clients → toggle checkboxes → confirm writes sharedWith on the doc.
// Used by: DocumentEditor and spreadsheet editor share actions.
// vocab: NbSheet = Design Law bottom sheet; checkbox = nbFill when selected (not a switch).
// KEEP: setDocumentSharedWith Firestore keys; Firebase projectId stays anatrox-auth.

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTrainerClients } from '../my-trainees/traineeList';
import { setDocumentSharedWith } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { lightColors, darkColors, nb, spacing, borderRadius } from '../../look-and-feel/colorPalette';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import NbAvatar from '../../look-and-feel/NbAvatar';

// ===== NAMED CONSTANTS =====

const CLIENT_NAME_DEFAULT = 'Client';
const SHEET_TITLE = 'Share document';
const EMPTY_CLIENTS_COPY = 'No clients yet.';
const FALLBACK_GOAL = 'Client';
const DEFAULT_DOC_TITLE = 'this document';
const AVATAR_SIZE = 44;
const CHECKMARK_ICON_SIZE = 18;
const SHARING_IN_PROGRESS_LABEL = 'Sharing…';

// ===== HELPER FUNCTIONS =====

/**
 * First goal string from a client row (array or plain string).
 * @param {object} client
 * @returns {*}
 */
function firstGoalFromClient(client) {
  if (!client) {
    return undefined;
  }
  if (Array.isArray(client.goals)) {
    return client.goals[0];
  }
  return client.goals;
}

/**
 * Build { [clientId]: true } from the ids already stored on the document.
 * Starting from the saved list means reopening the sheet keeps prior shares checked.
 * @param {string[]} sharedClientIds
 * @returns {Object.<string, boolean>}
 */
function selectionMapFromSharedIds(sharedClientIds) {
  const selectedByClientId = {};
  const idList = sharedClientIds || [];
  for (let i = 0; i < idList.length; i += 1) {
    const clientId = idList[i];
    selectedByClientId[clientId] = true;
  }
  return selectedByClientId;
}

/**
 * One or two letters for the avatar when the client has no photo.
 * @param {string} name
 * @returns {string}
 */
function initialsFromClientName(name) {
  if (!name) return '?';
  const nameParts = String(name).trim().split(/\s+/);
  const hasTwoParts = nameParts.length > 1;
  if (hasTwoParts) {
    const firstLetter = nameParts[0][0] || '';
    const secondLetter = nameParts[1][0] || '';
    return `${firstLetter}${secondLetter}`.toUpperCase();
  }
  const onlyLetter = nameParts[0][0] || '?';
  return onlyLetter.toUpperCase();
}

/**
 * Prefer name, then displayName, then the generic "Client" label.
 * @param {object} client
 * @returns {string}
 */
function displayNameForClient(client) {
  return client.name || client.displayName || CLIENT_NAME_DEFAULT;
}

/**
 * Photo URI from either photoURL or profilePhoto (both appear in trainee payloads).
 * @param {object} client
 * @returns {string|undefined}
 */
function photoUriForClient(client) {
  return client.photoURL || client.profilePhoto;
}

/**
 * Goal subtitle under the name — matches PNG (“Build Muscle”).
 * Underscores become spaces; each word is title-cased.
 * @param {object} client
 * @returns {string}
 */
function goalLabelForClient(client) {
  const goalsArrayFirst =
    firstGoalFromClient(client);
  const rawGoal =
    client?.primaryGoal ||
    client?.goal ||
    goalsArrayFirst ||
    client?.clientGoals ||
    '';
  const cleanedGoal = String(rawGoal).replace(/_/g, ' ').trim();
  if (!cleanedGoal) return FALLBACK_GOAL;
  // vocab: \b\w = first letter of each word — title-case for the row subtitle.
  return cleanedGoal.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * Ids of clients whose checkbox is currently on.
 * @param {object[]} clientList
 * @param {Object.<string, boolean>} selectedByClientId
 * @returns {string[]}
 */
function idsOfSelectedClients(clientList, selectedByClientId) {
  const selectedIds = [];
  for (let i = 0; i < clientList.length; i += 1) {
    const client = clientList[i];
    if (selectedByClientId[client.id]) {
      selectedIds.push(client.id);
    }
  }
  return selectedIds;
}

/**
 * Confirm button copy — pluralizes from the selected count.
 * @param {number} selectedCount
 * @returns {string}
 */
function confirmButtonLabel(selectedCount) {
  if (selectedCount <= 0) return 'Share with 0 clients';
  if (selectedCount === 1) return 'Share with 1 client';
  return `Share with ${selectedCount} clients`;
}

/**
 * Write sharedWith to Firestore, then close and notify the parent.
 * Failures log only — the sheet stays open so the trainer can retry.
 * Flow: 1. need both ids  2. set saving  3. write  4. notify + close  5. clear saving
 * @param {object} args
 * @returns {Promise<void>}
 */
async function persistSharedClientIds({
  trainerId,
  documentId,
  clientIds,
  onSaved,
  onClose,
  setSaving,
}) {
  // 1. Missing ids = nothing to write; leave the sheet alone.
  if (!trainerId || !documentId) return;

  // 2. Lock the confirm button while Firestore runs.
  setSaving(true);
  try {
    // 3. KEEP: setDocumentSharedWith field letters must stay as the helper defines them.
    await setDocumentSharedWith(trainerId, documentId, clientIds);
    // 4. Parent refreshes its local sharedWith list, then we dismiss.
    if (typeof onSaved === 'function') {
      onSaved();
    }
    onClose();
  } catch (error) {
    console.warn('Share document error:', error);
  } finally {
    // 5. Always unlock so a failed write can be retried.
    setSaving(false);
  }
}

/**
 * One client row: avatar, name, goal, Design Law checkbox.
 * @param {object} props
 */
function ClientShareRow({
  client,
  isSelected,
  onToggle,
  borderColor,
  ink,
  muted,
  fill,
  onFill,
  isLast,
}) {
  const clientName = displayNameForClient(client);
  const clientPhoto = photoUriForClient(client);
  const clientGoal = goalLabelForClient(client);
  const clientInitials = initialsFromClientName(clientName);
  const checkboxFill = isSelected ? fill : 'transparent';
  const rowDividerStyle = isLast
    ? null
    : { borderBottomWidth: nb.borderWidthDivider, borderBottomColor: borderColor };

  const handleRowPress = () => {
    onToggle(client.id, !isSelected);
  };

  return (
    <Pressable
      onPress={handleRowPress}
      style={[sheetStyles.shareRow, rowDividerStyle]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`Select ${clientName}`}
    >
      <NbAvatar
        source={clientPhoto}
        initials={clientInitials}
        size={AVATAR_SIZE}
        style={[sheetStyles.rowAvatar, { borderColor }]}
      />
      <View style={sheetStyles.rowText}>
        <Text style={[sheetStyles.rowName, { color: ink }]} numberOfLines={1}>
          {clientName}
        </Text>
        <Text style={[sheetStyles.rowGoal, { color: muted }]} numberOfLines={1}>
          {clientGoal}
        </Text>
      </View>
      <View
        style={[
          sheetStyles.checkbox,
          {
            borderColor,
            backgroundColor: checkboxFill,
          },
        ]}
      >
        {isSelected ? (
          <Ionicons name="checkmark" size={CHECKMARK_ICON_SIZE} color={onFill} />
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * List card of every trainee, or the empty-state line when the trainer has none.
 * @param {object} props
 */
function ShareClientList({
  clientList,
  selectedByClientId,
  onToggle,
  colors,
}) {
  const hasNoClients = clientList.length === 0;
  if (hasNoClients) {
    return (
      <Text style={[sheetStyles.emptyCopy, { color: colors.nbMuted }]}>
        {EMPTY_CLIENTS_COPY}
      </Text>
    );
  }

  const listCardChrome = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
  };
  const lastIndex = clientList.length - 1;

  return (
    <View style={[sheetStyles.listCard, listCardChrome]}>
      {clientList.map((client, index) => (
        <ClientShareRow
          key={client.id}
          client={client}
          isSelected={!!selectedByClientId[client.id]}
          onToggle={onToggle}
          borderColor={colors.nbBorder}
          ink={colors.nbInk}
          muted={colors.nbMuted}
          fill={colors.nbFill}
          onFill={colors.nbOnFill}
          isLast={index === lastIndex}
        />
      ))}
    </View>
  );
}

/**
 * Cancel + confirm footer under the client list.
 * @param {object} props
 */
function ShareFooterButtons({
  onClose,
  onConfirm,
  primaryButtonLabel,
  savingShare,
  hasNoClients,
}) {
  const confirmIsDisabled = savingShare || hasNoClients;
  return (
    <View style={sheetStyles.footerRow}>
      <NbButton variant="plain" onPress={onClose} style={sheetStyles.half}>
        Cancel
      </NbButton>
      <NbButton
        variant="fill"
        onPress={onConfirm}
        disabled={confirmIsDisabled}
        style={sheetStyles.primary}
      >
        {primaryButtonLabel}
      </NbButton>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet to choose which clients can see a trainer document.
 * Flow: 1. theme  2. load clients when open  3. toggle  4. confirm write  5. render sheet
 * @param {object} props
 */
export default function ShareDocumentPopup({
  visible,
  onClose,
  trainerId,
  documentId,
  documentTitle,
  initialSharedWith = [],
  isDark: isDarkProp,
  onSaved,
}) {
  // 1. Theme — prop wins; otherwise follow the OS color scheme.
  const colorScheme = useColorScheme();
  const isDarkFromProp = typeof isDarkProp === 'boolean';
  const isDark = isDarkFromProp ? isDarkProp : colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  // Hook order frozen: clientList → loadingClients → savingShare → selectedByClientId.
  const [clientList, setClientList] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [savingShare, setSavingShare] = useState(false);
  const [selectedByClientId, setSelectedByClientId] = useState({});

  // 2. When the sheet opens, fetch clients and pre-check anyone already shared.
  useEffect(() => {
    const sheetIsClosedOrMissingTrainer = !visible || !trainerId;
    if (sheetIsClosedOrMissingTrainer) {
      setClientList([]);
      setSelectedByClientId({});
      return;
    }

    setLoadingClients(true);
    getTrainerClients(trainerId)
      .then((list) => {
        const safeList = list || [];
        setClientList(safeList);
        setSelectedByClientId(selectionMapFromSharedIds(initialSharedWith));
      })
      .catch(() => {
        setClientList([]);
      })
      .finally(() => {
        setLoadingClients(false);
      });
  }, [visible, trainerId, documentId, initialSharedWith]);

  // 3. Flip one client’s checkbox without touching the others.
  const toggleClientSelection = (clientId, shouldSelect) => {
    setSelectedByClientId((previous) => ({
      ...previous,
      [clientId]: shouldSelect,
    }));
  };

  const selectedClientIds = useMemo(
    () => idsOfSelectedClients(clientList, selectedByClientId),
    [clientList, selectedByClientId],
  );

  // 4. Confirm → write sharedWith, refresh parent, close sheet.
  const confirmShareWithClients = async () => {
    await persistSharedClientIds({
      trainerId,
      documentId,
      clientIds: selectedClientIds,
      onSaved,
      onClose,
      setSaving: setSavingShare,
    });
  };

  // 5. Copy + body state for the sheet render.
  const trimmedDocumentTitle = String(documentTitle || '').trim();
  const documentNameForCopy = trimmedDocumentTitle || DEFAULT_DOC_TITLE;
  const sheetSubtitle = `Choose who gets ${documentNameForCopy} in their Notes & Files.`;
  const selectedCount = selectedClientIds.length;
  const primaryButtonLabel = savingShare
    ? SHARING_IN_PROGRESS_LABEL
    : confirmButtonLabel(selectedCount);
  const hasNoClients = clientList.length === 0;

  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      <Text style={[sheetStyles.subtitle, { color: colors.nbMuted }]}>{sheetSubtitle}</Text>

      {loadingClients ? (
        <View style={sheetStyles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.nbInk} />
        </View>
      ) : (
        <>
          <ShareClientList
            clientList={clientList}
            selectedByClientId={selectedByClientId}
            onToggle={toggleClientSelection}
            colors={colors}
          />
          <ShareFooterButtons
            onClose={onClose}
            onConfirm={confirmShareWithClients}
            primaryButtonLabel={primaryButtonLabel}
            savingShare={savingShare}
            hasNoClients={hasNoClients}
          />
        </>
      )}
    </NbSheet>
  );
}

// ===== PLUMBING — skip unless debugging =====

const sheetStyles = StyleSheet.create({
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyCopy: {
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 24,
  },
  listCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: 14,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    minHeight: nb.minTouchTarget + 8,
    gap: 12,
  },
  rowAvatar: {
    marginRight: 0,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '800',
  },
  rowGoal: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  // Manipulate here: checkbox size (PNG square with 3px border)
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.sm,
  },
  half: { flex: 1 },
  primary: { flex: 1.4 },
});
