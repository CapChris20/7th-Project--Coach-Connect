// Settings sub-panel: list people you’ve blocked and unblock them.
// Flow: Settings row opens this overlay → listMyBlocks → unblockUser → refresh.
// Used by: SettingsScreen (local overlay — no shell route required).

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../look-and-feel/lightDarkMode';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { SHELL_SAFE_AREA_EDGES } from '../navigation/bottomMenuSpacing';
import { listMyBlocks, unblockUser } from './blockUser';

// ===== NAMED CONSTANTS =====

const ACCENT = '#BE185D';
const EMPTY_ICON_SIZE = 36;
const EMPTY_ICON_DARK = 'rgba(255,255,255,0.35)';
const EMPTY_ICON_LIGHT = 'rgba(10,10,15,0.35)';

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
    <View style={[styles.row, { backgroundColor: colors.surface }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        {showsStoredId ? (
          <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.blockedUid || item.id}
          </Text>
        ) : null}
      </View>
      <TouchableOpacity
        onPress={() => onUnblock(item.id, item.displayName)}
        disabled={isUnblocking}
        style={styles.unblockBtn}
        accessibilityRole="button"
        accessibilityLabel={`Unblock ${label}`}
      >
        {isUnblocking ? (
          <ActivityIndicator size="small" color={ACCENT} />
        ) : (
          <Text style={styles.unblockText}>Unblock</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

function BlockedUsersBody({ colors, isDark, isLoading, rows, busyId, onUnblock }) {
  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (rows.length === 0) {
    const emptyIconColor = isDark ? EMPTY_ICON_DARK : EMPTY_ICON_LIGHT;
    return (
      <View style={styles.center}>
        <Ionicons name="shield-checkmark-outline" size={EMPTY_ICON_SIZE} color={emptyIconColor} />
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          No blocked users. When you block someone from chat or a trainer profile, they show up
          here.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={rows}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      ItemSeparatorComponent={() => (
        <View style={[styles.sep, { backgroundColor: colors.border }]} />
      )}
      renderItem={({ item }) => (
        <BlockedUserRow item={item} colors={colors} busyId={busyId} onUnblock={onUnblock} />
      )}
    />
  );
}

function BlockedUsersLayout({ colors, isDark, isLoading, rows, busyId, onClose, onUnblock }) {
  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <TopHeader title="Blocked users" skipTopSafeInset onBack={onClose} />
      <BlockedUsersBody
        colors={colors}
        isDark={isDark}
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
  const { colors, isDark } = useTheme();
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
      isDark={isDark}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    gap: 12,
  },
  empty: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    gap: 12,
  },
  name: { fontSize: 16, fontWeight: '700' },
  sub: { fontSize: 12, marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(190,24,93,0.45)',
    minWidth: 84,
    alignItems: 'center',
  },
  unblockText: { color: '#BE185D', fontWeight: '700', fontSize: 13 },
  sep: { height: StyleSheet.hairlineWidth, marginVertical: 8 },
});
