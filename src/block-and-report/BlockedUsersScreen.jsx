// Settings sub-panel: list people you’ve blocked and unblock them.
// Flow: Settings row opens this overlay → listMyBlocks → unblockUser → refresh.
// Used by: SettingsScreen (local overlay — no shell route required).

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../look-and-feel/lightDarkMode';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import NbCard from '../look-and-feel/NbCard';
import { SHELL_SAFE_AREA_EDGES } from '../navigation/bottomMenuSpacing';
import { listMyBlocks, unblockUser } from './blockUser';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const EMPTY_ICON_SIZE = 36;

// ===== HELPER FUNCTIONS =====

/**
 * Prefer the saved display name; fall back to the blocked uid or the row id.
 * @param {object} item
 * @returns {string}
 */
function blockedUserLabel(item) {
  return item.displayName || item.blockedUid || item.id;
}

function BlockedUserRow({ item, colors, busyId, onUnblock }) {
  const label = blockedUserLabel(item);
  const isUnblocking = busyId === item.id;
  const showsStoredId = Boolean(item.displayName);

  return (
    <View style={styles.row}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.name, { color: colors.nbInk }]} numberOfLines={1}>
          {label}
        </Text>
        {showsStoredId ? (
          <Text style={[styles.sub, { color: colors.nbMuted }]} numberOfLines={1}>
            {item.blockedUid || item.id}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => onUnblock(item.id, item.displayName)}
        disabled={isUnblocking}
        style={[
          styles.unblockBtn,
          {
            borderColor: colors.nbBorder,
            backgroundColor: colors.nbSurface,
            shadowColor: colors.nbShadow,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Unblock ${label}`}
        activeOpacity={0.85}
      >
        {isUnblocking ? (
          <ActivityIndicator size="small" color={colors.nbInk} />
        ) : (
          <Text style={[styles.unblockText, { color: colors.nbInk }]}>Unblock</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function BlockedUsersBody({ colors, isLoading, rows, busyId, onUnblock }) {
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.nbInk} />
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.center}>
        <Ionicons name="shield-checkmark-outline" size={EMPTY_ICON_SIZE} color={colors.nbMuted} />
        <Text style={[styles.empty, { color: colors.nbMuted }]}>
          No blocked users. When you block someone from chat or a trainer profile, they show up here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
      <NbCard style={styles.listCard}>
        {rows.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <View style={[styles.sep, { backgroundColor: colors.nbBorder }]} /> : null}
            <BlockedUserRow item={item} colors={colors} busyId={busyId} onUnblock={onUnblock} />
          </View>
        ))}
      </NbCard>
    </ScrollView>
  );
}

function BlockedUsersLayout({ colors, isLoading, rows, busyId, onClose, onUnblock }) {
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader title="Blocked users" onBack={onClose} />
      <BlockedUsersBody
        colors={colors}
        isLoading={isLoading}
        rows={rows}
        busyId={busyId}
        onUnblock={onUnblock}
      />
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Overlay list of blocked users with an Unblock button on each row.
 * @param {{ onClose: Function }} props
 */
export default function BlockedUsersScreen({ onClose }) {
  const { colors } = useTheme();
  const uid = getAuth()?.currentUser?.uid || null;
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    if (!uid) {
      setRows([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const list = await listMyBlocks(uid);
      setRows(list);
    } catch (error) {
      Alert.alert('Blocked users', error?.message || 'Could not load blocked users.');
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onUnblock = (blockedUid, displayName) => {
    const prompt = displayName ? `Unblock ${displayName}?` : 'Unblock this user?';
    Alert.alert('Unblock?', prompt, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          setBusyId(blockedUid);
          try {
            await unblockUser(uid, blockedUid);
            await refresh();
          } catch (error) {
            Alert.alert('Unblock failed', error?.message || 'Try again.');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <BlockedUsersLayout
      colors={colors}
      isLoading={isLoading}
      rows={rows}
      busyId={busyId}
      onClose={onClose}
      onUnblock={onUnblock}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  listPad: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 40 },
  listCard: { paddingVertical: spacing.xs, paddingHorizontal: 0 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    gap: 12,
    minHeight: nb.minTouchTarget,
  },
  name: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2 },
  // Manipulate here: Unblock chip border / hard shadow
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    minWidth: 84,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  unblockText: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 13 },
  sep: { height: nb.borderWidthDivider, marginHorizontal: spacing.md },
});
