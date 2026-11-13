// Design Law Clients roster (trainees PNG 01–04 + empty 02 + toast 19).
// Flow: search + filter chips → request row → client rows → RemoveClientSheet → cloud unlink.
// Used by trainer Clients tab (TrainerMainScreen embed) and standalone shell.
//
// vocab: RemoveClientSheet = PNG Unlinks confirm (not the reason-picker RemoveTrainerPopup)
// Manipulate here: FILTER_CHIPS labels, status badge heuristics

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  SHELL_SAFE_AREA_EDGES,
  ShellBottomNavAnchor,
  FORM_SCROLL_PROPS,
  useShellBottomNavInset,
  useShellTopPad,
} from '../../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../app-start/cloudConnection';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import {
  getClientInitials,
  getClientRosterStats,
  getClientSubtext,
} from '../home/trainerHomePieces';
import RemoveClientSheet from './RemoveClientSheet';
import NbCard from '../../look-and-feel/NbCard';
import NbAvatar from '../../look-and-feel/NbAvatar';
import NbButton from '../../look-and-feel/NbButton';
import NbChip from '../../look-and-feel/NbChip';
import NbIconChip from '../../look-and-feel/NbIconChip';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { nb, spacing } from '../../look-and-feel/colorPalette';
import { AppNavigationProvider } from '../../navigation/whichScreenIsOpen';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET_FALLBACK = 24;
const SWIPE_DELETE_WIDTH = 88;
const ICON_CLIENTS = require('../../assets/icons/handoff/checkin.png');
const FILTER_ALL = 'all';
const FILTER_NEEDS = 'needs';
const FILTER_TRAINING = 'training';
const FILTER_RECOVERY = 'recovery';
const FILTER_CHIPS = [
  { id: FILTER_ALL, label: 'All' },
  { id: FILTER_NEEDS, label: 'Needs attention' },
  { id: FILTER_TRAINING, label: 'Training' },
  { id: FILTER_RECOVERY, label: 'Recovery' },
];

// ===== HELPERS =====

function clientPhase(client) {
  const raw = String(client?.phase || client?.status || client?.trainingPhase || 'training')
    .toLowerCase()
    .trim();
  if (raw.includes('recover')) return FILTER_RECOVERY;
  return FILTER_TRAINING;
}

function attentionBadge(client) {
  // Prefer real daily-log hints when present; otherwise light heuristic for PNG-shaped chips
  if (client?.loggedToday) return { label: 'Logged today', dashed: true };
  if (client?.daysSinceLog != null && Number(client.daysSinceLog) >= 3) {
    return { label: `No log in ${client.daysSinceLog} days`, dashed: false };
  }
  if (client?.sleepAvg != null) {
    return { label: `Sleep avg ${Number(client.sleepAvg).toFixed(1)} h`, dashed: false };
  }
  if (client?.soreness != null) {
    return { label: `Soreness ${client.soreness} of 8`, dashed: false };
  }
  const stats = getClientRosterStats(client);
  if (stats.goal) return { label: stats.goal, dashed: false };
  return { label: 'On roster', dashed: true };
}

function formatInviteDisplay(code) {
  if (!code) return 'COACH-····';
  const cleaned = String(code).replace(/-/g, '').slice(0, 4).toUpperCase();
  return `COACH-${cleaned}`;
}

function matchesSearch(client, query) {
  if (!query) return true;
  const name = String(client?.name || client?.displayName || '').toLowerCase();
  return name.includes(query);
}

function matchesFilter(client, filterId) {
  if (filterId === FILTER_ALL) return true;
  const phase = clientPhase(client);
  if (filterId === FILTER_TRAINING) return phase === FILTER_TRAINING;
  if (filterId === FILTER_RECOVERY) return phase === FILTER_RECOVERY;
  if (filterId === FILTER_NEEDS) {
    return !!(client?.needsAttention || (client?.daysSinceLog != null && client.daysSinceLog >= 3));
  }
  return true;
}

function NavSquare({ onPress, children, colors }) {
  return (
    <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.navSquare,
          { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
        ]}
        accessibilityRole="button"
        activeOpacity={0.85}
      >
        {children}
      </TouchableOpacity>
    </HardShadow>
  );
}

// ===== MAIN =====

/**
 * Trainer roster list — Design Law Clients screen.
 */
const ClientsListScreen = ({
  clients,
  trainerId,
  inviteCode = null,
  pendingRequestNames = [],
  pendingRequestCount = 0,
  hasMore = false,
  loadingMore = false,
  onLoadMore,
  embedInLayout = false,
  onBack,
  onSelectClient,
  onClientRemoved,
  onOpenClientRequests,
  onProfilePress,
  onSettingsPress,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  isDark: _isDarkIgnored = true,
}) => {
  const { colors } = useTheme();
  const shellTopPad = useShellTopPad(spacing.sm);
  const scrollBottomPad = useShellBottomNavInset(SHELL_NAV_INSET_FALLBACK);
  const [search, setSearch] = useState('');
  const [filterId, setFilterId] = useState(FILTER_ALL);
  const [deletePending, setDeletePending] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const swipeRefs = useRef(new Map());

  const openRemoveSheet = useCallback((client) => {
    swipeRefs.current.get(client.id)?.close?.();
    setDeletePending({
      id: client.id,
      name: String(client.name || client.displayName || 'Client').trim() || 'Client',
    });
  }, []);

  const cancelRemove = useCallback(() => {
    setDeletePending(null);
    setRemoveBusy(false);
  }, []);

  const confirmRemove = useCallback(async () => {
    if (!deletePending?.id || !trainerId) return;
    if (!functions) {
      setToast({ title: 'Unavailable', body: 'Cloud Functions are not configured.' });
      setTimeout(() => setToast(null), 4200);
      return;
    }
    const clientId = deletePending.id;
    const displayName = deletePending.name;
    setRemoveBusy(true);
    try {
      const fn = httpsCallable(functions, 'removeTrainerClientLink');
      await fn({
        trainerId,
        clientId,
        reasons: [],
        otherText: null,
        removedBy: 'trainer',
      });
      cancelRemove();
      onClientRemoved?.(clientId);
      setToast({
        title: 'Client removed',
        body: `${displayName.split(/\s+/)[0]} is no longer on your roster. You can invite them again with your code.`,
      });
      setTimeout(() => setToast(null), 4200);
    } catch (e) {
      const msg = e?.message || e?.code || 'Could not remove this client. Try again.';
      setToast({ title: 'Remove failed', body: String(msg) });
      setTimeout(() => setToast(null), 4200);
    } finally {
      setRemoveBusy(false);
    }
  }, [cancelRemove, deletePending, onClientRemoved, trainerId]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (clients || []).filter(
      (c) => matchesSearch(c, q) && matchesFilter(c, filterId),
    );
  }, [clients, filterId, search]);

  const requestSubtitle = useMemo(() => {
    if (pendingRequestNames?.length) return pendingRequestNames.slice(0, 3).join(', ');
    if (pendingRequestCount > 0) return `${pendingRequestCount} waiting`;
    return 'Open inbox';
  }, [pendingRequestCount, pendingRequestNames]);

  const copyInvite = useCallback(async () => {
    if (!inviteCode) return;
    try {
      await Clipboard.setStringAsync(String(inviteCode));
      setToast({ title: 'Copied', body: formatInviteDisplay(inviteCode) });
      setTimeout(() => setToast(null), 2500);
    } catch (_e) {
      setToast({ title: 'Copy failed', body: 'Could not copy invite code.' });
      setTimeout(() => setToast(null), 2500);
    }
  }, [inviteCode]);

  const renderRightActions = useCallback(
    (client) => (
      <View style={styles.swipeWrap}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openRemoveSheet(client)}
          style={[styles.swipeDelete, { backgroundColor: colors.nbFill }]}
        >
          <Ionicons name="trash-outline" size={22} color={colors.nbOnFill} />
          <Text style={[styles.swipeDeleteText, { color: colors.nbOnFill }]}>Remove</Text>
        </TouchableOpacity>
      </View>
    ),
    [colors.nbFill, colors.nbOnFill, openRemoveSheet],
  );

  const header = (
    <View style={[styles.headerRow, !embedInLayout && { paddingTop: shellTopPad }]}>
      <Text style={[styles.screenTitle, { color: colors.nbInk }]}>Clients</Text>
      {typeof onOpenClientRequests === 'function' || typeof onPlusPress === 'function' ? (
        <NavSquare
          colors={colors}
          onPress={() => {
            if (typeof onOpenClientRequests === 'function') onOpenClientRequests();
            else onPlusPress?.();
          }}
        >
          <Ionicons name="add" size={24} color={colors.nbInk} />
        </NavSquare>
      ) : null}
    </View>
  );

  const searchField = (
    <View
      style={[
        styles.searchWrap,
        { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
      ]}
    >
      <Ionicons name="search" size={18} color={colors.nbMuted} />
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search clients"
        placeholderTextColor={colors.nbMuted}
        style={[styles.searchInput, { color: colors.nbInk }]}
        autoCorrect={false}
        autoCapitalize="none"
      />
    </View>
  );

  const requestsRow =
    typeof onOpenClientRequests === 'function' ? (
      <HardShadow offset={nb.shadowOffsetCard} radius={16}>
        <TouchableOpacity
          onPress={onOpenClientRequests}
          activeOpacity={0.88}
          style={[
            styles.requestsRow,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          <NbIconChip source={ICON_CLIENTS} index={2} size={44} />
          <View style={styles.requestsText}>
            <Text style={[styles.requestsTitle, { color: colors.nbInk }]}>
              View client requests
            </Text>
            <Text style={[styles.requestsSub, { color: colors.nbMuted }]} numberOfLines={1}>
              {requestSubtitle}
            </Text>
          </View>
          {pendingRequestCount > 0 ? (
            <View style={[styles.countBadge, { backgroundColor: colors.nbFill }]}>
              <Text style={[styles.countBadgeText, { color: colors.nbOnFill }]}>
                {pendingRequestCount > 9 ? '9+' : String(pendingRequestCount)}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </HardShadow>
    ) : null;

  const filterRow = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterStrip}
    >
      {FILTER_CHIPS.map((chip) => (
        <NbChip
          key={chip.id}
          selected={filterId === chip.id}
          onPress={() => setFilterId(chip.id)}
        >
          {chip.label}
        </NbChip>
      ))}
    </ScrollView>
  );

  const emptyState = (
    <NbCard style={[styles.emptyCard, { borderStyle: 'dashed' }]}>
      <NbIconChip source={ICON_CLIENTS} index={2} size={56} />
      <Text style={[styles.emptyTitle, { color: colors.nbInk }]}>No clients yet</Text>
      <Text style={[styles.emptyBody, { color: colors.nbMuted }]}>
        Clients you already train join with your invite code. New clients find you in the marketplace.
      </Text>
      {inviteCode ? (
        <>
          <View
            style={[
              styles.inviteBox,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
            ]}
          >
            <Text style={[styles.inviteCode, { color: colors.nbInk }]}>
              {formatInviteDisplay(inviteCode)}
            </Text>
          </View>
          <NbButton variant="fill" onPress={copyInvite} style={styles.copyBtn}>
            Copy code
          </NbButton>
        </>
      ) : typeof onOpenClientRequests === 'function' ? (
        <NbButton variant="fill" onPress={onOpenClientRequests} style={styles.copyBtn}>
          View client requests
        </NbButton>
      ) : null}
    </NbCard>
  );

  const listCard =
    filteredClients.length === 0 && (clients || []).length === 0 ? (
      emptyState
    ) : (
      <HardShadow offset={nb.shadowOffsetCard} radius={16}>
        <View
          style={[
            styles.listCard,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          {filteredClients.length === 0 ? (
            <Text style={[styles.noMatch, { color: colors.nbMuted }]}>No clients match.</Text>
          ) : (
            filteredClients.map((client, index) => {
              const displayName = client.name || client.displayName || 'Client';
              const initials = getClientInitials(displayName);
              const sub = getClientSubtext(client);
              const badge = attentionBadge(client);
              const phase = clientPhase(client);
              const phaseLabel = phase === FILTER_RECOVERY ? 'Recovery' : 'Training';
              const phaseSelected = phase === FILTER_TRAINING;
              return (
                <Swipeable
                  key={client.id}
                  ref={(r) => {
                    if (r) swipeRefs.current.set(client.id, r);
                    else swipeRefs.current.delete(client.id);
                  }}
                  friction={2}
                  overshootRight={false}
                  renderRightActions={() => renderRightActions(client)}
                >
                  <TouchableOpacity
                    activeOpacity={0.88}
                    onPress={() => onSelectClient?.(client.id)}
                    onLongPress={() => openRemoveSheet(client)}
                    style={[
                      styles.clientRow,
                      index < filteredClients.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.nbBorder,
                      },
                    ]}
                  >
                    <NbAvatar initials={initials} size={48} />
                    <View style={styles.clientMain}>
                      <Text style={[styles.clientName, { color: colors.nbInk }]} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <Text style={[styles.clientSub, { color: colors.nbMuted }]} numberOfLines={1}>
                        {sub}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          {
                            borderColor: colors.nbBorder,
                            backgroundColor: badge.dashed
                              ? 'transparent'
                              : colors.nbSurfaceChip || colors.nbBackground,
                            borderStyle: badge.dashed ? 'dashed' : 'solid',
                          },
                        ]}
                      >
                        <Text style={[styles.statusBadgeText, { color: colors.nbInk }]}>
                          {badge.label}
                        </Text>
                      </View>
                    </View>
                    <NbChip selected={phaseSelected} variant={phaseSelected ? 'default' : 'outline'}>
                      {phaseLabel}
                    </NbChip>
                  </TouchableOpacity>
                </Swipeable>
              );
            })
          )}
          {hasMore && typeof onLoadMore === 'function' ? (
            <View style={styles.loadMoreWrap}>
              <NbButton variant="ghost" onPress={onLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Load more clients'}
              </NbButton>
            </View>
          ) : null}
        </View>
      </HardShadow>
    );

  const toastEl = toast ? (
    <View
      style={[
        styles.toast,
        { backgroundColor: colors.nbFill, borderColor: colors.nbBorder, shadowColor: colors.nbShadow },
      ]}
    >
      <Text style={[styles.toastTitle, { color: colors.nbOnFill }]}>{toast.title}</Text>
      <Text style={[styles.toastBody, { color: colors.nbOnFill }]}>{toast.body}</Text>
    </View>
  ) : null;

  const body = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
        keyboardShouldPersistTaps="handled"
      >
        {searchField}
        {requestsRow}
        {(clients || []).length > 0 ? filterRow : null}
        {listCard}
      </ScrollView>
      {toastEl}
      <RemoveClientSheet
        visible={!!deletePending}
        onClose={cancelRemove}
        onConfirm={confirmRemove}
        clientName={deletePending?.name}
        busy={removeBusy}
      />
    </GestureHandlerRootView>
  );

  if (embedInLayout) {
    return <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>{body}</View>;
  }

  return (
    <AppNavigationProvider
      onProfilePress={onProfilePress}
      onSettingsPress={onSettingsPress}
      onHomePress={onHomePress}
      onPlusPress={onPlusPress}
      onVoicePress={onVoicePress}
      onNutritionPress={onNutritionPress}
      onWorkoutPress={onWorkoutPress}
      onMessagesPress={onMessagesPress}
    >
      <SafeAreaView
        style={{ flex: 1, backgroundColor: colors.nbBackground }}
        edges={SHELL_SAFE_AREA_EDGES}
      >
        {body}
        <ShellBottomNavAnchor>
          <BottomMenuBar
            onHomePress={onHomePress}
            onPlusPress={onPlusPress}
            onVoicePress={onVoicePress}
            onNutritionPress={onNutritionPress}
            onWorkoutPress={onWorkoutPress}
            onMessagesPress={onMessagesPress}
          />
        </ShellBottomNavAnchor>
      </SafeAreaView>
    </AppNavigationProvider>
  );
};

export default ClientsListScreen;

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12,
  },
  screenTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.4,
  },
  navSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  requestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 16,
    padding: 12,
  },
  requestsText: { flex: 1, minWidth: 0 },
  requestsTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  requestsSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2,
  },
  countBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13,
  },
  filterStrip: { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  listCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 16,
    overflow: 'hidden',
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  clientMain: { flex: 1, minWidth: 0, gap: 4 },
  clientName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  clientSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2,
  },
  statusBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
  },
  loadMoreWrap: { padding: 12 },
  noMatch: {
    padding: 20,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium',
  },
  emptyCard: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  inviteBox: {
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  inviteCode: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    letterSpacing: 1,
  },
  copyBtn: { alignSelf: 'stretch', marginTop: 4 },
  swipeWrap: {
    width: SWIPE_DELETE_WIDTH,
    justifyContent: 'stretch',
  },
  swipeDelete: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  swipeDeleteText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 4,
  },
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    top: 8,
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    padding: 14,
    gap: 4,
    shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    zIndex: 20,
  },
  toastTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15,
  },
  toastBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9,
  },
});
