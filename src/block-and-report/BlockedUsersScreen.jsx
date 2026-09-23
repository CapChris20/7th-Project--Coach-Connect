// Settings sub-panel: list people you’ve blocked and unblock them.
// Flow: Settings row opens this overlay → listMyBlocks → unblockUser → refresh.
// Used by: SettingsScreen (local overlay — no shell route required).
// Key exports: BlockedUsersScreen

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

export default function BlockedUsersScreen({ onClose }) {
  const { colors, isDark } = useTheme();
  const uid = getAuth()?.currentUser?.uid || null;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    if (!uid) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await listMyBlocks(uid);
      setRows(list);
    } catch (e) {
      Alert.alert('Blocked users', e?.message || 'Could not load blocked users.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const onUnblock = (blockedUid, displayName) => {
    Alert.alert(
      'Unblock?',
      displayName ? `Unblock ${displayName}?` : 'Unblock this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            setBusyId(blockedUid);
            try {
              await unblockUser(uid, blockedUid);
              await refresh();
            } catch (e) {
              Alert.alert('Unblock failed', e?.message || 'Try again.');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <TopHeader title="Blocked users" skipTopSafeInset onBack={onClose} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#BE185D" />
        </View>
      ) : rows.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="shield-checkmark-outline"
            size={36}
            color={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(10,10,15,0.35)'}
          />
          <Text style={[styles.empty, { color: colors.textSecondary }]}>
            No blocked users. When you block someone from chat or a trainer profile, they show up
            here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: colors.border }]} />
          )}
          renderItem={({ item }) => {
            const label = item.displayName || item.blockedUid || item.id;
            const working = busyId === item.id;
            return (
              <View style={[styles.row, { backgroundColor: colors.surface }]}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {label}
                  </Text>
                  {item.displayName ? (
                    <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                      {item.blockedUid || item.id}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  onPress={() => onUnblock(item.id, item.displayName)}
                  disabled={working}
                  style={styles.unblockBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${label}`}
                >
                  {working ? (
                    <ActivityIndicator size="small" color="#BE185D" />
                  ) : (
                    <Text style={styles.unblockText}>Unblock</Text>
                  )}
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
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
