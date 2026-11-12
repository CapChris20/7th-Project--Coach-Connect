// Design Law Blocked users — NbPageHeader, per-person cards with avatar + Unblock.
// Flow: Settings opens overlay → listMyBlocks → unblockUser → refresh.
// Used by: SettingsScreen modal. Block list keys stay as blockUser.js writes them.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAuth } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../look-and-feel/lightDarkMode';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import NbCard from '../look-and-feel/NbCard';
import NbAvatar from '../look-and-feel/NbAvatar';
import NbButton from '../look-and-feel/NbButton';
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

/** Initials for NbAvatar when there is no photo. */
function initialsFromLabel(label) {
  const nameText = String(label || '').trim();
  if (!nameText) return '?';
  return nameText
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * One blocked person as their own Design Law card (avatar · copy · Unblock).
 */
function BlockedUserCard({ item, colors, busyId, onUnblock }) {
  const label = blockedUserLabel(item);
  const isUnblocking = busyId === item.id;
  const reasonLine = [item.blockedAtLabel, item.reason].filter(Boolean).join(' · ');
  const subtitle =
    reasonLine ||
    (item.displayName ? String(item.blockedUid || item.id) : 'Blocked from messaging and profile');

  return (
    <NbCard style={styles.userCard}>
      <View style={styles.row}>
        <NbAvatar initials={initialsFromLabel(label)} size={44} />
        <View style={styles.copy}>
          <Text style={[styles.name, { color: colors.nbInk }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={[styles.sub, { color: colors.nbMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.unblockWrap}>
          <NbButton
            variant="ghost"
            sm
            onPress={() => onUnblock(item.id, item.displayName)}
            disabled={isUnblocking}
          >
            {isUnblocking ? '…' : 'Unblock'}
          </NbButton>
        </View>
      </View>
    </NbCard>
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
      {rows.map((item) => (
        <BlockedUserCard
          key={item.id}
          item={item}
          colors={colors}
          busyId={busyId}
          onUnblock={onUnblock}
        />
      ))}
      <Text style={[styles.helper, { color: colors.nbMuted }]}>
        Blocked people cannot message you or see your profile. You can unblock anyone here.
      </Text>
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
 * Overlay list of blocked users with an Unblock button on each card.
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
  userCard: { marginBottom: spacing.md, padding: spacing.md },
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
    gap: 12,
    minHeight: nb.minTouchTarget,
  },
  copy: { flex: 1, minWidth: 0 },
  name: { fontFamily: 'SpaceGrotesk_700Bold', fontSize: 16 },
  sub: { fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 2, lineHeight: 16 },
  unblockWrap: { maxWidth: 110 },
  helper: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
});
