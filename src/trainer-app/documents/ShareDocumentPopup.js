// Share a trainer document with clients — Design Law bottom sheet (PNG 19–20).
// Flow: open → load trainer clients → toggle checkboxes → “Share with N clients” writes sharedWith.
// Used by: document editor + spreadsheet editor share actions.
// vocab: NbSheet = Design Law bottom sheet; checkbox = solid nbFill when selected (not a switch)
// KEEP: setDocumentSharedWith Firebase keys; projectId stays anatrox-auth.

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

// ===== HELPER FUNCTIONS =====

function selectedMapFromIds(initialSharedWith) {
  const selectedById = {};
  (initialSharedWith || []).forEach((id) => {
    selectedById[id] = true;
  });
  return selectedById;
}

function initialsFromName(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/);
  if (parts.length > 1) {
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase();
  }
  return (parts[0][0] || '?').toUpperCase();
}

function clientDisplayName(client) {
  return client.name || client.displayName || CLIENT_NAME_DEFAULT;
}

function clientPhotoUri(client) {
  return client.photoURL || client.profilePhoto;
}

/** Goal line under the name — matches PNG subtitle (“Build Muscle”). */
function clientGoalLabel(client) {
  const raw =
    client?.primaryGoal ||
    client?.goal ||
    (Array.isArray(client?.goals) ? client.goals[0] : client?.goals) ||
    client?.clientGoals ||
    '';
  const cleaned = String(raw).replace(/_/g, ' ').trim();
  if (!cleaned) return FALLBACK_GOAL;
  return cleaned.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function selectedClientIds(clients, selected) {
  return clients.filter((client) => selected[client.id]).map((client) => client.id);
}

function shareCountLabel(count) {
  if (count <= 0) return 'Share with 0 clients';
  if (count === 1) return 'Share with 1 client';
  return `Share with ${count} clients`;
}

async function saveSharingSettings({ trainerId, documentId, clientIds, onSaved, onClose, setSaving }) {
  if (!trainerId || !documentId) return;
  setSaving(true);
  try {
    await setDocumentSharedWith(trainerId, documentId, clientIds);
    onSaved?.();
    onClose();
  } catch (error) {
    console.warn('Share document error:', error);
  } finally {
    setSaving(false);
  }
}

/**
 * One client row: avatar, name, goal, Design Law checkbox.
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
  const displayName = clientDisplayName(client);
  const photoUri = clientPhotoUri(client);
  const goal = clientGoalLabel(client);

  return (
    <Pressable
      onPress={() => onToggle(client.id, !isSelected)}
      style={[
        styles.shareRow,
        !isLast && { borderBottomWidth: nb.borderWidthDivider, borderBottomColor: borderColor },
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`Select ${displayName}`}
    >
      <NbAvatar
        source={photoUri}
        initials={initialsFromName(displayName)}
        size={44}
        style={[styles.rowAvatar, { borderColor }]}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: ink }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.rowGoal, { color: muted }]} numberOfLines={1}>
          {goal}
        </Text>
      </View>
      <View
        style={[
          styles.checkbox,
          {
            borderColor,
            backgroundColor: isSelected ? fill : 'transparent',
          },
        ]}
      >
        {isSelected ? (
          <Ionicons name="checkmark" size={18} color={onFill} />
        ) : null}
      </View>
    </Pressable>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Bottom sheet to choose which clients can see a trainer document.
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
  const colorScheme = useColorScheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState({});

  useEffect(() => {
    if (!visible || !trainerId) {
      setClients([]);
      setSelected({});
      return;
    }
    setLoading(true);
    getTrainerClients(trainerId)
      .then((list) => {
        setClients(list || []);
        setSelected(selectedMapFromIds(initialSharedWith));
      })
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, [visible, trainerId, documentId, initialSharedWith]);

  const handleToggle = (clientId, value) => {
    setSelected((previousSelected) => ({ ...previousSelected, [clientId]: value }));
  };

  const selectedIds = useMemo(
    () => selectedClientIds(clients, selected),
    [clients, selected],
  );

  const handleConfirm = async () => {
    await saveSharingSettings({
      trainerId,
      documentId,
      clientIds: selectedIds,
      onSaved,
      onClose,
      setSaving,
    });
  };

  const titleForCopy = String(documentTitle || '').trim() || DEFAULT_DOC_TITLE;
  const subtitle = `Choose who gets ${titleForCopy} in their Notes & Files.`;

  return (
    <NbSheet visible={visible} onClose={onClose} title={SHEET_TITLE}>
      <Text style={[styles.subtitle, { color: colors.nbMuted }]}>{subtitle}</Text>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.nbInk} />
        </View>
      ) : (
        <>
          {clients.length === 0 ? (
            <Text style={[styles.emptyCopy, { color: colors.nbMuted }]}>
              {EMPTY_CLIENTS_COPY}
            </Text>
          ) : (
            <View
              style={[
                styles.listCard,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
              ]}
            >
              {clients.map((client, index) => (
                <ClientShareRow
                  key={client.id}
                  client={client}
                  isSelected={!!selected[client.id]}
                  onToggle={handleToggle}
                  borderColor={colors.nbBorder}
                  ink={colors.nbInk}
                  muted={colors.nbMuted}
                  fill={colors.nbFill}
                  onFill={colors.nbOnFill}
                  isLast={index === clients.length - 1}
                />
              ))}
            </View>
          )}

          <View style={styles.footerRow}>
            <NbButton variant="plain" onPress={onClose} style={styles.half}>
              Cancel
            </NbButton>
            <NbButton
              variant="fill"
              onPress={handleConfirm}
              disabled={saving || clients.length === 0}
              style={styles.primary}
            >
              {saving ? 'Sharing…' : shareCountLabel(selectedIds.length)}
            </NbButton>
          </View>
        </>
      )}
    </NbSheet>
  );
}

const styles = StyleSheet.create({
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
