// Design Law Notifications list (inbox-and-money PNG 15/16).
// Flow: live-query the user’s notifications → filter by tab → mark read / clear → empty or list UI.
// Used by trainer + client Settings / home bell when the shell opens this screen.
// Firebase projectId stays anatrox-auth. Firestore field letters stay frozen.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../app-start/cloudConnection';
import { useTheme } from '../look-and-feel/lightDarkMode';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import HardShadow from '../look-and-feel/HardShadow';
import NbIconChip from '../look-and-feel/NbIconChip';
import { borderRadius, nb } from '../look-and-feel/colorPalette';
import { SHELL_SAFE_AREA_EDGES } from '../navigation/bottomMenuSpacing';

// ===== NAMED CONSTANTS =====

// Manipulate here: tab ids must match tabForNotificationType return values.
const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'messages', label: 'Messages' },
  { id: 'files', label: 'Files' },
];

// Firestore collection name — letters frozen.
const NOTIFICATIONS_COLLECTION = 'notifications';

// Manipulate here: raise to show a longer inbox; lower for a lighter first paint.
const LIST_LIMIT = 80;

const HANDOFF_SCHEDULE = require('../assets/icons/handoff/schedule.png');
const HANDOFF_WORKOUT = require('../assets/icons/handoff/workout.png');
const HANDOFF_PROGRESS = require('../assets/icons/handoff/progress.png');

const DEFAULT_OWNER_FIELD = 'trainerUid';
const DEFAULT_BODY_COPY = 'Tap to open.';
const EMPTY_TITLE = 'No notifications yet';
const EMPTY_SUBTITLE = 'Session invites, messages, and shared files show up here.';
const FOOTER_HINT = 'Tap the × to clear a notification.';
const ENABLED_BANNER_COPY = 'Notifications are enabled.';
const MARK_ALL_READ_LABEL = 'Mark all read';

const ICON_CHIP_CYCLE = 6;

// ===== HELPER FUNCTIONS =====
// Small UI (layout — no hooks)

/**
 * Four filter chips under the header. Selected chip uses fill + on-fill ink.
 */
function FilterTabs({ selectedTabId, onSelectTab, colors }) {
  return (
    <View style={[styles.seg, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
      {FILTER_TABS.map((tab) => {
        const tabIsSelected = tab.id === selectedTabId;
        const chipBackground = tabIsSelected ? colors.nbFill : 'transparent';
        const labelColor = tabIsSelected ? colors.nbOnFill : colors.nbInk;
        const chipBorderColor = colors.nbBorder;

        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={[
              styles.segChip,
              {
                backgroundColor: chipBackground,
                borderColor: chipBorderColor,
              },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: labelColor }}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * One notification row: unread dot, icon chip, title/body, when, clear ×.
 */
function NotificationRow({ row, colors, onClear, isLastRow }) {
  const showBottomBorder = !isLastRow;
  const rowHasUnreadDot = !row.read;
  const iconSource = iconSourceForNotificationType(row.type);
  const iconIndex = row._iconIndex % ICON_CHIP_CYCLE;
  const titleText = titleTextForNotification(row);
  const bodyText = bodyTextForNotification(row);
  const whenText = formatNotificationWhen(row._date);

  const rowStyle = [styles.row];
  if (showBottomBorder) {
    rowStyle.push({
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.nbBorder,
    });
  }

  return (
    <View style={rowStyle}>
      <View style={styles.unreadCol}>
        {rowHasUnreadDot ? (
          <View style={[styles.unreadDot, { backgroundColor: colors.nbFill }]} />
        ) : null}
      </View>

      <NbIconChip source={iconSource} index={iconIndex} size={40} />

      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '900', color: colors.nbInk }} numberOfLines={1}>
          {titleText}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted }} numberOfLines={2}>
          {bodyText}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.nbMuted }}>{whenText}</Text>
        <TouchableOpacity
          onPress={() => onClear(row)}
          hitSlop={8}
          accessibilityLabel="Clear notification"
        >
          <Ionicons name="close" size={16} color={colors.nbMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * One Today / Earlier card: section title + HardShadow list of rows.
 */
function NotificationSectionCard({ section, colors, onClearRow }) {
  const sectionTitleStyle = {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.nbMuted,
  };

  const cardInnerStyle = {
    borderWidth: nb.borderWidth,
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    borderRadius: 10,
    overflow: 'hidden',
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={sectionTitleStyle}>{section.title}</Text>
      <HardShadow offset={nb.shadowOffsetCard} radius={10}>
        <View style={cardInnerStyle}>
          {section.data.map((row, rowIndex) => {
            const isLastRow = rowIndex === section.data.length - 1;
            return (
              <NotificationRow
                key={row.id}
                row={row}
                colors={colors}
                onClear={onClearRow}
                isLastRow={isLastRow}
              />
            );
          })}
        </View>
      </HardShadow>
    </View>
  );
}

/**
 * Pure layout for the notifications screen — no hooks, no Firestore.
 */
function NotificationsScreenLayout({
  colors,
  onBack,
  showEnabledBanner,
  selectedTabId,
  onSelectTab,
  onMarkAllRead,
  isLoading,
  listIsEmpty,
  listSections,
  onClearRow,
}) {
  const screenBackgroundStyle = { flex: 1, backgroundColor: colors.nbBackground };
  const contentGutterStyle = { paddingHorizontal: nb.screenGutter, marginTop: -8 };
  const markAllRowStyle = { alignItems: 'flex-end', marginBottom: 10 };

  const markAllButtonStyle = {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    justifyContent: 'center',
  };

  const enabledBannerOuterStyle = { marginBottom: 12 };
  const enabledBannerInnerStyle = {
    borderWidth: nb.borderWidth,
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  };
  const enabledCheckCircleStyle = {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.nbFill,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const emptyWrapStyle = [styles.center, { paddingHorizontal: 28 }];
  const emptyTitleStyle = {
    fontSize: 18,
    fontWeight: '900',
    color: colors.nbInk,
    textAlign: 'center',
  };
  const emptySubtitleStyle = {
    fontSize: 14,
    fontWeight: '600',
    color: colors.nbMuted,
    textAlign: 'center',
    marginTop: 8,
  };

  const listContentStyle = { padding: nb.screenGutter, paddingBottom: 40, gap: 14 };
  const footerHintStyle = {
    fontSize: 12,
    fontWeight: '600',
    color: colors.nbMuted,
    marginTop: 4,
  };

  const showSpinner = isLoading;
  const showEmptyState = !isLoading && listIsEmpty;
  const showNotificationList = !isLoading && !listIsEmpty;

  return (
    <SafeAreaView style={screenBackgroundStyle} edges={SHELL_SAFE_AREA_EDGES}>
      <View style={styles.headerRow}>
        <NbPageHeader title="Notifications" onBack={onBack} />
      </View>

      <View style={contentGutterStyle}>
        <View style={markAllRowStyle}>
          <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
            <TouchableOpacity onPress={onMarkAllRead} style={markAllButtonStyle}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.nbInk }}>
                {MARK_ALL_READ_LABEL}
              </Text>
            </TouchableOpacity>
          </HardShadow>
        </View>

        {showEnabledBanner ? (
          <HardShadow offset={nb.shadowOffsetCard} radius={10} style={enabledBannerOuterStyle}>
            <View style={enabledBannerInnerStyle}>
              <View style={enabledCheckCircleStyle}>
                <Ionicons name="checkmark" size={16} color={colors.nbOnFill} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.nbInk }}>
                {ENABLED_BANNER_COPY}
              </Text>
            </View>
          </HardShadow>
        ) : null}

        <FilterTabs
          selectedTabId={selectedTabId}
          onSelectTab={onSelectTab}
          colors={colors}
        />
      </View>

      {showSpinner ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.nbInk} />
        </View>
      ) : null}

      {showEmptyState ? (
        <View style={emptyWrapStyle}>
          <Text style={emptyTitleStyle}>{EMPTY_TITLE}</Text>
          <Text style={emptySubtitleStyle}>{EMPTY_SUBTITLE}</Text>
        </View>
      ) : null}

      {showNotificationList ? (
        <FlatList
          data={listSections}
          keyExtractor={(section) => section.key}
          contentContainerStyle={listContentStyle}
          ListFooterComponent={<Text style={footerHintStyle}>{FOOTER_HINT}</Text>}
          renderItem={({ item: section }) => (
            <NotificationSectionCard
              section={section}
              colors={colors}
              onClearRow={onClearRow}
            />
          )}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Live notifications inbox for the signed-in user (trainer or client owner field).
 * Flow: 1. subscribe  2. filter by tab  3. group Today/Earlier  4. mark read / clear  5. layout
 * @param {{ onBack?: Function, roleField?: 'trainerUid'|'clientUid' }} props
 */
export default function NotificationsScreen({ onBack, roleField }) {
  const { colors } = useTheme();

  // Signed-in user id; owner field picks trainerUid vs clientUid on each doc.
  const signedInUserId = auth.currentUser?.uid;
  const ownerFieldName = roleField || DEFAULT_OWNER_FIELD;

  const [notificationRows, setNotificationRows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTabId, setSelectedTabId] = useState('all');
  const [showEnabledBanner] = useState(true);

  // 1. Live-subscribe to this user’s notifications; unsubscribe on leave or id change.
  // vocab: onSnapshot = Firestore live listener; cleanup must unsubscribe.
  useEffect(() => {
    const cannotQuery = !signedInUserId || !db;
    if (cannotQuery) {
      setNotificationRows([]);
      setIsLoading(false);
      return undefined;
    }

    setIsLoading(true);
    const notificationsQuery = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where(ownerFieldName, '==', signedInUserId),
      orderBy('timestamp', 'desc'),
      limit(LIST_LIMIT),
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const nextRows = rowsFromFirestoreSnapshot(snapshot);
        setNotificationRows(nextRows);
        setIsLoading(false);
      },
      () => {
        setNotificationRows([]);
        setIsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [signedInUserId, ownerFieldName]);

  // 2. Keep only rows that match the selected filter tab.
  const filteredRows = useMemo(() => {
    return rowsMatchingFilterTab(notificationRows, selectedTabId);
  }, [notificationRows, selectedTabId]);

  // 3. Split filtered rows into Today vs Earlier.
  const rowGroups = useMemo(() => {
    return groupRowsIntoTodayAndEarlier(filteredRows);
  }, [filteredRows]);

  // 4. Mark every unread row as read in Firestore.
  const markAllRead = useCallback(async () => {
    await markUnreadRowsAsRead(notificationRows);
  }, [notificationRows]);

  // 5. Clear one row (delete; if delete fails, mark read instead).
  const clearOne = useCallback(async (row) => {
    await clearOrMarkReadOneRow(row);
  }, []);

  // 6. Build FlatList sections from the Today / Earlier groups.
  const listSections = useMemo(() => {
    return sectionsFromTodayAndEarlierGroups(rowGroups);
  }, [rowGroups]);

  const listIsEmpty = filteredRows.length === 0;

  return (
    <NotificationsScreenLayout
      colors={colors}
      onBack={onBack}
      showEnabledBanner={showEnabledBanner}
      selectedTabId={selectedTabId}
      onSelectTab={setSelectedTabId}
      onMarkAllRead={markAllRead}
      isLoading={isLoading}
      listIsEmpty={listIsEmpty}
      listSections={listSections}
      onClearRow={clearOne}
    />
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Turn a Firestore timestamp (or Date) into a JS Date, or null.
 * vocab: timestampField.toDate = Firestore Timestamp helper.
 */
function parseNotificationDate(timestampField) {
  if (timestampField && typeof timestampField.toDate === 'function') {
    return timestampField.toDate();
  }
  if (timestampField instanceof Date) {
    return timestampField;
  }
  return null;
}

/**
 * Short “when” label: time if today, weekday short if earlier.
 */
function formatNotificationWhen(date) {
  if (!date) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateIsTodayOrLater = date >= startOfToday;

  if (dateIsTodayOrLater) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

/**
 * True when the date falls on the device’s calendar today.
 */
function dateIsOnDeviceToday(date) {
  if (!date) {
    return false;
  }

  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  const sameMonth = date.getMonth() === now.getMonth();
  const sameDay = date.getDate() === now.getDate();
  return sameYear && sameMonth && sameDay;
}

/**
 * Map a notification type string to a filter tab id.
 */
function tabForNotificationType(notificationType) {
  const typeLower = String(notificationType || '').toLowerCase();

  const looksLikeSession =
    typeLower.includes('session') ||
    typeLower.includes('schedule') ||
    typeLower.includes('book');
  if (looksLikeSession) {
    return 'sessions';
  }

  const looksLikeMessage =
    typeLower.includes('message') || typeLower.includes('chat');
  if (looksLikeMessage) {
    return 'messages';
  }

  const looksLikeFile =
    typeLower.includes('file') ||
    typeLower.includes('note') ||
    typeLower.includes('share') ||
    typeLower.includes('document');
  if (looksLikeFile) {
    return 'files';
  }

  return 'all';
}

function iconSourceForNotificationType(notificationType) {
  const tabId = tabForNotificationType(notificationType);
  if (tabId === 'sessions') {
    return HANDOFF_SCHEDULE;
  }
  if (tabId === 'files') {
    return HANDOFF_WORKOUT;
  }
  return HANDOFF_PROGRESS;
}

function titleTextForNotification(row) {
  if (row.label) {
    return String(row.label);
  }
  const typeWords = String(row.type || 'update').replace(/_/g, ' ');
  const firstLetter = typeWords.charAt(0).toUpperCase();
  const restOfWords = typeWords.slice(1);
  return firstLetter + restOfWords;
}

function bodyTextForNotification(row) {
  if (row.value != null && String(row.value).trim()) {
    return String(row.value);
  }
  if (row.body) {
    return String(row.body);
  }
  return DEFAULT_BODY_COPY;
}

function rowsMatchingFilterTab(rows, selectedTabId) {
  if (selectedTabId === 'all') {
    return rows;
  }

  const matchingRows = [];
  let rowIndex = 0;
  while (rowIndex < rows.length) {
    const row = rows[rowIndex];
    const rowTabId = tabForNotificationType(row.type);
    if (rowTabId === selectedTabId) {
      matchingRows.push(row);
    }
    rowIndex += 1;
  }
  return matchingRows;
}

function groupRowsIntoTodayAndEarlier(rows) {
  const todayRows = [];
  const earlierRows = [];

  let rowIndex = 0;
  while (rowIndex < rows.length) {
    const row = rows[rowIndex];
    if (dateIsOnDeviceToday(row._date)) {
      todayRows.push(row);
    } else {
      earlierRows.push(row);
    }
    rowIndex += 1;
  }

  return { today: todayRows, earlier: earlierRows };
}

function rowsFromFirestoreSnapshot(snapshot) {
  const nextRows = [];
  let listIndex = 0;

  snapshot.forEach((notificationDoc) => {
    const data = notificationDoc.data() || {};
    nextRows.push({
      id: notificationDoc.id,
      ...data,
      _date: parseNotificationDate(data.timestamp),
      _iconIndex: listIndex,
    });
    listIndex += 1;
  });

  return nextRows;
}

function sectionsFromTodayAndEarlierGroups(groups) {
  const allSections = [
    { key: 'today', title: 'Today', data: groups.today },
    { key: 'earlier', title: 'Earlier', data: groups.earlier },
  ];

  const nonEmptySections = [];
  let sectionIndex = 0;
  while (sectionIndex < allSections.length) {
    const section = allSections[sectionIndex];
    if (section.data.length > 0) {
      nonEmptySections.push(section);
    }
    sectionIndex += 1;
  }
  return nonEmptySections;
}

/**
 * Mark every unread row as read. Promise.all lives here (not in the screen recipe).
 */
async function markUnreadRowsAsRead(rows) {
  const unreadRows = [];
  let rowIndex = 0;
  while (rowIndex < rows.length) {
    const row = rows[rowIndex];
    if (!row.read) {
      unreadRows.push(row);
    }
    rowIndex += 1;
  }

  const writePromises = unreadRows.map((row) =>
    updateDoc(doc(db, NOTIFICATIONS_COLLECTION, row.id), { read: true }).catch(() => {}),
  );
  await Promise.all(writePromises);
}

/**
 * Prefer delete; if delete fails, fall back to marking the row read.
 */
async function clearOrMarkReadOneRow(row) {
  try {
    await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, row.id));
    return;
  } catch (_deleteError) {
    // fall through to mark-read
  }

  try {
    await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, row.id), { read: true });
  } catch (_updateError) {
    // silent — inbox will keep the row until next successful write
  }
}

const styles = StyleSheet.create({
  headerRow: {},
  seg: {
    flexDirection: 'row',
    borderWidth: nb.borderWidth,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 8,
  },
  segChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: nb.borderWidth,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    minHeight: 72,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  unreadCol: { width: 10, alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
});
