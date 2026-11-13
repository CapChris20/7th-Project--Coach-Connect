// Design Law Notifications list (inbox-and-money PNG 15/16).
// Flow: query users’ notifications → filter tabs → mark read / swipe-clear → optional empty shell.
// Used by trainer + client Settings / home bell when the shell opens this screen.

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

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'messages', label: 'Messages' },
  { id: 'files', label: 'Files' },
];
const NOTIFICATIONS_COLLECTION = 'notifications';
const LIST_LIMIT = 80;
const HANDOFF_SCHEDULE = require('../assets/icons/handoff/schedule.png');
const HANDOFF_WORKOUT = require('../assets/icons/handoff/workout.png');
const HANDOFF_PROGRESS = require('../assets/icons/handoff/progress.png');

// ===== HELPER FUNCTIONS =====

function parseNotifDate(raw) {
  if (raw?.toDate) return raw.toDate();
  if (raw instanceof Date) return raw;
  return null;
}

function formatNotifWhen(date) {
  if (!date) return '';
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startToday) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function isToday(date) {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function tabForType(type) {
  const t = String(type || '').toLowerCase();
  if (t.includes('session') || t.includes('schedule') || t.includes('book')) return 'sessions';
  if (t.includes('message') || t.includes('chat')) return 'messages';
  if (t.includes('file') || t.includes('note') || t.includes('share') || t.includes('document')) {
    return 'files';
  }
  return 'all';
}

function iconForType(type) {
  const tab = tabForType(type);
  if (tab === 'sessions') return HANDOFF_SCHEDULE;
  if (tab === 'files') return HANDOFF_WORKOUT;
  return HANDOFF_PROGRESS;
}

function titleForNotif(row) {
  if (row.label) return String(row.label);
  const t = String(row.type || 'update').replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function bodyForNotif(row) {
  if (row.value != null && String(row.value).trim()) return String(row.value);
  if (row.body) return String(row.body);
  return 'Tap to open.';
}

function groupRows(rows) {
  const today = [];
  const earlier = [];
  rows.forEach((row) => {
    if (isToday(row._date)) today.push(row);
    else earlier.push(row);
  });
  return { today, earlier };
}

// ===== SMALL UI =====

function FilterTabs({ tabId, onChange, colors }) {
  return (
    <View style={[styles.seg, { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface }]}>
      {TABS.map((tab) => {
        const on = tab.id === tabId;
        return (
          <TouchableOpacity
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={[
              styles.segChip,
              {
                backgroundColor: on ? colors.nbFill : 'transparent',
                borderColor: colors.nbBorder,
              },
            ]}
          >
            <Text style={{ fontSize: 12, fontWeight: '900', color: on ? colors.nbOnFill : colors.nbInk }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function NotifRow({ row, colors, onClear, isLast }) {
  return (
    <View
      style={[
        styles.row,
        !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.nbBorder },
      ]}
    >
      <View style={styles.unreadCol}>
        {!row.read ? <View style={[styles.unreadDot, { backgroundColor: colors.nbFill }]} /> : null}
      </View>
      <NbIconChip source={iconForType(row.type)} index={row._iconIndex % 6} size={40} />
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text style={{ fontSize: 15, fontWeight: '900', color: colors.nbInk }} numberOfLines={1}>
          {titleForNotif(row)}
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.nbMuted }} numberOfLines={2}>
          {bodyForNotif(row)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.nbMuted }}>
          {formatNotifWhen(row._date)}
        </Text>
        <TouchableOpacity onPress={() => onClear(row)} hitSlop={8} accessibilityLabel="Clear notification">
          <Ionicons name="close" size={16} color={colors.nbMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {{ onBack?: Function, roleField?: 'trainerUid'|'clientUid' }} props
 */
export default function NotificationsScreen({ onBack, roleField }) {
  const { colors } = useTheme();
  const uid = auth.currentUser?.uid;
  const field = roleField || 'trainerUid';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tabId, setTabId] = useState('all');
  const [enabledHint] = useState(true);

  useEffect(() => {
    if (!uid || !db) {
      setRows([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    const q = query(
      collection(db, NOTIFICATIONS_COLLECTION),
      where(field, '==', uid),
      orderBy('timestamp', 'desc'),
      limit(LIST_LIMIT),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = [];
        snap.forEach((d, idx) => {
          const data = d.data() || {};
          next.push({
            id: d.id,
            ...data,
            _date: parseNotifDate(data.timestamp),
            _iconIndex: idx,
          });
        });
        setRows(next);
        setLoading(false);
      },
      () => {
        setRows([]);
        setLoading(false);
      },
    );
    return () => unsub();
  }, [uid, field]);

  const filtered = useMemo(() => {
    if (tabId === 'all') return rows;
    return rows.filter((r) => tabForType(r.type) === tabId);
  }, [rows, tabId]);

  const groups = useMemo(() => groupRows(filtered), [filtered]);

  const markAllRead = useCallback(async () => {
    const unread = rows.filter((r) => !r.read);
    await Promise.all(
      unread.map((r) => updateDoc(doc(db, NOTIFICATIONS_COLLECTION, r.id), { read: true }).catch(() => {})),
    );
  }, [rows]);

  const clearOne = useCallback(async (row) => {
    try {
      await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, row.id));
    } catch (_) {
      try {
        await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, row.id), { read: true });
      } catch (__) {}
    }
  }, []);

  const sections = [
    { key: 'today', title: 'Today', data: groups.today },
    { key: 'earlier', title: 'Earlier', data: groups.earlier },
  ].filter((s) => s.data.length > 0);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.nbBackground }} edges={SHELL_SAFE_AREA_EDGES}>
      <View style={styles.headerRow}>
        <NbPageHeader title="Notifications" onBack={onBack} />
      </View>
      <View style={{ paddingHorizontal: nb.screenGutter, marginTop: -8 }}>
        <View style={{ alignItems: 'flex-end', marginBottom: 10 }}>
          <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbChip}>
            <TouchableOpacity
              onPress={markAllRead}
              style={{
                minHeight: 40,
                paddingHorizontal: 12,
                borderRadius: borderRadius.nbChip,
                borderWidth: nb.borderWidth,
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.nbInk }}>Mark all read</Text>
            </TouchableOpacity>
          </HardShadow>
        </View>

        {enabledHint ? (
          <HardShadow offset={nb.shadowOffsetCard} radius={10} style={{ marginBottom: 12 }}>
            <View
              style={{
                borderWidth: nb.borderWidth,
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                borderRadius: 10,
                padding: 12,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: colors.nbFill,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={16} color={colors.nbOnFill} />
              </View>
              <Text style={{ flex: 1, fontSize: 14, fontWeight: '700', color: colors.nbInk }}>
                Notifications are enabled.
              </Text>
            </View>
          </HardShadow>
        ) : null}

        <FilterTabs tabId={tabId} onChange={setTabId} colors={colors} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.nbInk} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={[styles.center, { paddingHorizontal: 28 }]}>
          <Text style={{ fontSize: 18, fontWeight: '900', color: colors.nbInk, textAlign: 'center' }}>
            No notifications yet
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.nbMuted, textAlign: 'center', marginTop: 8 }}>
            Session invites, messages, and shared files show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={sections}
          keyExtractor={(s) => s.key}
          contentContainerStyle={{ padding: nb.screenGutter, paddingBottom: 40, gap: 14 }}
          ListFooterComponent={
            <Text style={{ fontSize: 12, fontWeight: '600', color: colors.nbMuted, marginTop: 4 }}>
              Tap the × to clear a notification.
            </Text>
          }
          renderItem={({ item: section }) => (
            <View style={{ gap: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '900',
                  letterSpacing: 1.1,
                  textTransform: 'uppercase',
                  color: colors.nbMuted,
                }}
              >
                {section.title}
              </Text>
              <HardShadow offset={nb.shadowOffsetCard} radius={10}>
                <View
                  style={{
                    borderWidth: nb.borderWidth,
                    borderColor: colors.nbBorder,
                    backgroundColor: colors.nbSurface,
                    borderRadius: 10,
                    overflow: 'hidden',
                  }}
                >
                  {section.data.map((row, idx) => (
                    <NotifRow
                      key={row.id}
                      row={row}
                      colors={colors}
                      onClear={clearOne}
                      isLast={idx === section.data.length - 1}
                    />
                  ))}
                </View>
              </HardShadow>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
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
