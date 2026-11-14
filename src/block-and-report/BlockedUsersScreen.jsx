// Design Law blocked-users list — header, cards (avatar · copy · Unblock), notice sheet.
// Flow: Settings modal → listMyBlocks → confirm unblock → unblockUser → refresh list.
// Used by: SettingsScreen overlay. Row shape matches blockUser.js Firestore writes.

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import { SHELL_SAFE_AREA_EDGES } from '../navigation/bottomMenuSpacing';
import { listMyBlocks, unblockUser } from './blockUser';
import { nb, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: empty-state shield icon size (Design Law uses ~36).
const EMPTY_STATE_ICON_SIZE = 36;
const AVATAR_SIZE = 44;
const EMPTY_STATE_COPY =
  'No blocked users. When you block someone from chat or a trainer profile, they show up here.';
const HELPER_FOOTER_COPY =
  'Blocked people cannot message you or see your profile. You can unblock anyone here.';
const GENERIC_BLOCKED_SUBTITLE = 'Blocked from messaging and profile';
const UNBLOCK_BUSY_LABEL = '…';
const UNBLOCK_LABEL = 'Unblock';
const PAGE_TITLE = 'Blocked users';
const UNBLOCK_CONFIRM_TITLE = 'Unblock?';
const UNBLOCK_FAILED_TITLE = 'Unblock failed';
const DEFAULT_UNBLOCK_CONFIRM = 'Unblock this user?';
const NOTICE_OK_LABEL = 'OK';
const LOAD_FAILED_FALLBACK = 'Could not load blocked users.';
const UNBLOCK_FAILED_FALLBACK = 'Try again.';

// ===== HELPER FUNCTIONS =====

function signedInUserIdFromAuth() {
  const authHandle = getAuth();
  if (!authHandle) {
    return null;
  }
  const currentUser = authHandle.currentUser;
  if (!currentUser) {
    return null;
  }
  if (!currentUser.uid) {
    return null;
  }
  return currentUser.uid;
}

function messageFromError(error, fallbackText) {
  if (error && error.message) {
    return error.message;
  }
  return fallbackText;
}

// Title line: saved display name, else uid, else row id.
function titleForBlockedRow(blockedRow) {
  if (blockedRow.displayName) {
    return blockedRow.displayName;
  }
  if (blockedRow.blockedUid) {
    return blockedRow.blockedUid;
  }
  return blockedRow.id;
}

function firstLettersFromNameParts(nameParts) {
  const firstLetters = [];
  for (let index = 0; index < nameParts.length; index += 1) {
    const part = nameParts[index];
    if (part && part[0]) {
      firstLetters.push(part[0]);
    }
  }
  return firstLetters;
}

// Two-letter initials for NbAvatar when there is no profile photo.
function avatarInitialsFromTitle(titleText) {
  const trimmedTitle = String(titleText || '').trim();
  if (!trimmedTitle) {
    return '?';
  }
  const nameParts = trimmedTitle.split(/\s+/);
  const firstLetters = firstLettersFromNameParts(nameParts);
  const upToTwo = firstLetters.slice(0, 2);
  return upToTwo.join('').toUpperCase();
}

function joinDateAndReason(blockedRow) {
  const parts = [];
  if (blockedRow.blockedAtLabel) {
    parts.push(blockedRow.blockedAtLabel);
  }
  if (blockedRow.reason) {
    parts.push(blockedRow.reason);
  }
  if (parts.length === 0) {
    return '';
  }
  return parts.join(' · ');
}

// Subtitle: "blockedAt · reason" when present, else uid or generic blocked copy.
function subtitleForBlockedRow(blockedRow) {
  const dateAndReason = joinDateAndReason(blockedRow);
  if (dateAndReason) {
    return dateAndReason;
  }
  if (blockedRow.displayName) {
    if (blockedRow.blockedUid) {
      return String(blockedRow.blockedUid);
    }
    return String(blockedRow.id);
  }
  return GENERIC_BLOCKED_SUBTITLE;
}

function unblockButtonLabel(unblockInProgress) {
  if (unblockInProgress) {
    return UNBLOCK_BUSY_LABEL;
  }
  return UNBLOCK_LABEL;
}

function unblockConfirmMessage(displayName) {
  if (displayName) {
    return `Unblock ${displayName}?`;
  }
  return DEFAULT_UNBLOCK_CONFIRM;
}

function BlockedUserCard({ item, colors, busyId, onUnblock }) {
  const cardTitle = titleForBlockedRow(item);
  const cardSubtitle = subtitleForBlockedRow(item);
  const avatarInitials = avatarInitialsFromTitle(cardTitle);
  const unblockInProgress = busyId === item.id;
  const buttonLabel = unblockButtonLabel(unblockInProgress);

  function handleUnblockPress() {
    onUnblock(item.id, item.displayName);
  }

  return (
    <NbCard style={styles.userCard}>
      <View style={styles.row}>
        <NbAvatar initials={avatarInitials} size={AVATAR_SIZE} />
        <View style={styles.copy}>
          <Text style={[styles.name, { color: colors.nbInk }]} numberOfLines={1}>
            {cardTitle}
          </Text>
          <Text style={[styles.sub, { color: colors.nbMuted }]} numberOfLines={2}>
            {cardSubtitle}
          </Text>
        </View>
        <View style={styles.unblockWrap}>
          <NbButton
            variant="ghost"
            sm
            onPress={handleUnblockPress}
            disabled={unblockInProgress}
          >
            {buttonLabel}
          </NbButton>
        </View>
      </View>
    </NbCard>
  );
}

function LoadingBlockedList({ colors }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.nbInk} />
    </View>
  );
}

function EmptyBlockedList({ colors }) {
  return (
    <View style={styles.center}>
      <Ionicons
        name="shield-checkmark-outline"
        size={EMPTY_STATE_ICON_SIZE}
        color={colors.nbMuted}
      />
      <Text style={[styles.empty, { color: colors.nbMuted }]}>{EMPTY_STATE_COPY}</Text>
    </View>
  );
}

function buildBlockedUserCardList(rows, colors, busyId, onUnblock) {
  const cards = [];
  for (let index = 0; index < rows.length; index += 1) {
    const blockedRow = rows[index];
    cards.push(
      <BlockedUserCard
        key={blockedRow.id}
        item={blockedRow}
        colors={colors}
        busyId={busyId}
        onUnblock={onUnblock}
      />,
    );
  }
  return cards;
}

function BlockedUsersList({ colors, rows, busyId, onUnblock }) {
  const cardList = buildBlockedUserCardList(rows, colors, busyId, onUnblock);

  return (
    <ScrollView contentContainerStyle={styles.listPad} showsVerticalScrollIndicator={false}>
      {cardList}
      <Text style={[styles.helper, { color: colors.nbMuted }]}>{HELPER_FOOTER_COPY}</Text>
    </ScrollView>
  );
}

function BlockedUsersBody({ colors, isLoading, rows, busyId, onUnblock }) {
  if (isLoading) {
    return <LoadingBlockedList colors={colors} />;
  }
  if (rows.length === 0) {
    return <EmptyBlockedList colors={colors} />;
  }
  return (
    <BlockedUsersList
      colors={colors}
      rows={rows}
      busyId={busyId}
      onUnblock={onUnblock}
    />
  );
}

function noticeTitleText(notice) {
  if (!notice) {
    return '';
  }
  if (notice.title) {
    return notice.title;
  }
  return '';
}

function noticeMessageText(notice) {
  if (!notice) {
    return undefined;
  }
  return notice.message;
}

function noticeConfirmLabelText(notice) {
  if (!notice) {
    return NOTICE_OK_LABEL;
  }
  if (notice.confirmLabel) {
    return notice.confirmLabel;
  }
  return NOTICE_OK_LABEL;
}

function noticeCancelLabelText(notice) {
  if (!notice) {
    return undefined;
  }
  return notice.cancelLabel;
}

function noticeConfirmHandler(notice) {
  if (!notice) {
    return undefined;
  }
  return notice.onConfirm;
}

function noticeIsDestructiveFlag(notice) {
  if (!notice) {
    return false;
  }
  return !!notice.destructive;
}

function BlockedUsersLayout({
  colors,
  isLoading,
  rows,
  busyId,
  onClose,
  onUnblock,
  notice,
  onDismissNotice,
}) {
  const noticeIsVisible = !!notice;
  const noticeTitle = noticeTitleText(notice);
  const noticeMessage = noticeMessageText(notice);
  const noticeConfirmLabel = noticeConfirmLabelText(notice);
  const noticeCancelLabel = noticeCancelLabelText(notice);
  const noticeOnConfirm = noticeConfirmHandler(notice);
  const noticeIsDestructive = noticeIsDestructiveFlag(notice);

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.nbBackground }]}
      edges={SHELL_SAFE_AREA_EDGES}
    >
      <NbPageHeader title={PAGE_TITLE} onBack={onClose} />
      <BlockedUsersBody
        colors={colors}
        isLoading={isLoading}
        rows={rows}
        busyId={busyId}
        onUnblock={onUnblock}
      />
      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={onDismissNotice}
        title={noticeTitle}
        message={noticeMessage}
        confirmLabel={noticeConfirmLabel}
        cancelLabel={noticeCancelLabel}
        onConfirm={noticeOnConfirm}
        destructive={noticeIsDestructive}
      />
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Settings → Blocked users list with confirm-to-unblock.
 * Hooks stay in this order: theme, uid, rows, loading, busy id, notice.
 */
export default function BlockedUsersScreen({ onClose }) {
  const { colors } = useTheme();
  const signedInUserId = signedInUserIdFromAuth();

  const [blockedRows, setBlockedRows] = useState([]);
  const [listIsLoading, setListIsLoading] = useState(true);
  const [unblockingRowId, setUnblockingRowId] = useState(null);
  const [noticeSheet, setNoticeSheet] = useState(null);

  const openNoticeSheet = (title, message, extraFields = {}) => {
    setNoticeSheet({ title, message, ...extraFields });
  };

  const closeNoticeSheet = () => {
    setNoticeSheet(null);
  };

  // 1. Pull blocked rows from Firestore for the signed-in user.
  const refreshBlockedList = useCallback(async () => {
    if (!signedInUserId) {
      setBlockedRows([]);
      setListIsLoading(false);
      return;
    }

    setListIsLoading(true);
    try {
      const rowsFromFirestore = await listMyBlocks(signedInUserId);
      setBlockedRows(rowsFromFirestore);
    } catch (loadError) {
      openNoticeSheet(PAGE_TITLE, messageFromError(loadError, LOAD_FAILED_FALLBACK));
      setBlockedRows([]);
    } finally {
      setListIsLoading(false);
    }
  }, [signedInUserId]);

  useEffect(() => {
    refreshBlockedList();
  }, [refreshBlockedList]);

  // 2. Confirm → unblock in Firestore → refresh so the card disappears.
  const handleUnblockPress = (blockedUid, displayName) => {
    const confirmMessage = unblockConfirmMessage(displayName);

    openNoticeSheet(UNBLOCK_CONFIRM_TITLE, confirmMessage, {
      cancelLabel: 'Cancel',
      confirmLabel: UNBLOCK_LABEL,
      onConfirm: async () => {
        setUnblockingRowId(blockedUid);
        try {
          await unblockUser(signedInUserId, blockedUid);
          await refreshBlockedList();
        } catch (unblockError) {
          openNoticeSheet(
            UNBLOCK_FAILED_TITLE,
            messageFromError(unblockError, UNBLOCK_FAILED_FALLBACK),
          );
        } finally {
          setUnblockingRowId(null);
        }
      },
    });
  };

  return (
    <BlockedUsersLayout
      colors={colors}
      isLoading={listIsLoading}
      rows={blockedRows}
      busyId={unblockingRowId}
      onClose={onClose}
      onUnblock={handleUnblockPress}
      notice={noticeSheet}
      onDismissNotice={closeNoticeSheet}
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
