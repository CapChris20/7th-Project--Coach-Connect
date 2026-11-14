// Design Law Clients roster (trainees PNG 01–04 + empty 02 + toast 19).
// Flow: search + filter chips → request row → client rows → RemoveClientSheet → cloud unlink.
// Used by trainer Clients tab (TrainerMainScreen embed) and standalone shell.
//
// vocab: RemoveClientSheet = PNG Unlinks confirm (not the reason-picker RemoveTrainerPopup)
// vocab: httpsCallable = Firebase callable Cloud Function wrapper
// Manipulate here: FILTER_CHIPS labels, status badge heuristics, toast durations

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor, FORM_SCROLL_PROPS, useShellBottomNavInset, useShellTopPad } from '../../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../app-start/cloudConnection';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { getClientInitials, getClientRosterStats, getClientSubtext } from '../home/trainerHomePieces';
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
const FILTER_CHIPS = [{
  id: FILTER_ALL,
  label: 'All'
}, {
  id: FILTER_NEEDS,
  label: 'Needs attention'
}, {
  id: FILTER_TRAINING,
  label: 'Training'
}, {
  id: FILTER_RECOVERY,
  label: 'Recovery'
}];
const TOAST_SHORT_MS = 2500;
const TOAST_LONG_MS = 4200;
const DAYS_SINCE_LOG_NEEDS_ATTENTION = 3;
const MAX_REQUEST_NAMES_IN_SUBTITLE = 3;
const COUNT_BADGE_CAP = 9;

// ===== HELPER FUNCTIONS =====

/**
 * Coerce any value to a trimmed string (empty when missing).
 * @param {*} value
 * @returns {string}
 */
function asTrimmedString(value) {
  return asTrimmedString(value);
}
function clientPhase(client) {
  const rawPhase = String((client == null ? void 0 : client.phase) || (client == null ? void 0 : client.status) || (client == null ? void 0 : client.trainingPhase) || 'training').toLowerCase().trim();
  if (rawPhase.includes('recover')) return FILTER_RECOVERY;
  return FILTER_TRAINING;
}

/**
 * Prefer real daily-log hints when present; otherwise light heuristic for PNG-shaped chips.
 */
function attentionBadge(client) {
  if (client == null ? void 0 : client.loggedToday) {
    return {
      label: 'Logged today',
      dashed: true
    };
  }
  if ((client == null ? void 0 : client.daysSinceLog) != null && Number(client.daysSinceLog) >= DAYS_SINCE_LOG_NEEDS_ATTENTION) {
    return {
      label: `No log in ${client.daysSinceLog} days`,
      dashed: false
    };
  }
  if ((client == null ? void 0 : client.sleepAvg) != null) {
    return {
      label: `Sleep avg ${Number(client.sleepAvg).toFixed(1)} h`,
      dashed: false
    };
  }
  if ((client == null ? void 0 : client.soreness) != null) {
    return {
      label: `Soreness ${client.soreness} of 8`,
      dashed: false
    };
  }
  const stats = getClientRosterStats(client);
  if (stats.goal) return {
    label: stats.goal,
    dashed: false
  };
  return {
    label: 'On roster',
    dashed: true
  };
}
function formatInviteDisplay(code) {
  if (!code) return 'COACH-····';
  const cleaned = String(code).replace(/-/g, '').slice(0, 4).toUpperCase();
  return `COACH-${cleaned}`;
}
function matchesSearch(client, searchLower) {
  if (!searchLower) return true;
  const name = String((client == null ? void 0 : client.name) || (client == null ? void 0 : client.displayName) || '').toLowerCase();
  return name.includes(searchLower);
}
function clientNeedsAttention(client) {
  if (client == null ? void 0 : client.needsAttention) return true;
  if ((client == null ? void 0 : client.daysSinceLog) != null && client.daysSinceLog >= DAYS_SINCE_LOG_NEEDS_ATTENTION) {
    return true;
  }
  return false;
}
function matchesFilter(client, filterId) {
  if (filterId === FILTER_ALL) return true;
  const phase = clientPhase(client);
  if (filterId === FILTER_TRAINING) return phase === FILTER_TRAINING;
  if (filterId === FILTER_RECOVERY) return phase === FILTER_RECOVERY;
  if (filterId === FILTER_NEEDS) return clientNeedsAttention(client);
  return true;
}
function scheduleToastClear(setToast, milliseconds) {
  setTimeout(() => setToast(null), milliseconds);
}
function buildRequestSubtitle(pendingRequestNames, pendingRequestCount) {
  if (pendingRequestNames == null ? void 0 : pendingRequestNames.length) {
    return pendingRequestNames.slice(0, MAX_REQUEST_NAMES_IN_SUBTITLE).join(', ');
  }
  if (pendingRequestCount > 0) return `${pendingRequestCount} waiting`;
  return 'Open inbox';
}
function countBadgeText(pendingRequestCount) {
  if (pendingRequestCount > COUNT_BADGE_CAP) return '9+';
  return String(pendingRequestCount);
}
function firstNameFromDisplay(displayName) {
  return displayName.split(/\s+/)[0];
}
function NavSquare({
  onPress,
  children,
  colors
}) {
  return <HardShadow offset={nb.shadowOffsetSmall} radius={12}>
      <TouchableOpacity onPress={onPress} style={[styles.navSquare, {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface
    }]} accessibilityRole="button" activeOpacity={0.85}>
        {children}
      </TouchableOpacity>
    </HardShadow>;
}
function RosterToastBanner({
  toast,
  colors
}) {
  if (!toast) return null;
  return <View style={[styles.toast, {
    backgroundColor: colors.nbFill,
    borderColor: colors.nbBorder,
    shadowColor: colors.nbShadow
  }]}>
      <Text style={[styles.toastTitle, {
      color: colors.nbOnFill
    }]}>{toast.title}</Text>
      <Text style={[styles.toastBody, {
      color: colors.nbOnFill
    }]}>{toast.body}</Text>
    </View>;
}
function SwipeRemoveAction({
  client,
  colors,
  onOpenRemove
}) {
  return <View style={styles.swipeWrap}>
      <TouchableOpacity activeOpacity={0.85} onPress={() => onOpenRemove(client)} style={[styles.swipeDelete, {
      backgroundColor: colors.nbFill
    }]}>
        <Ionicons name="trash-outline" size={22} color={colors.nbOnFill} />
        <Text style={[styles.swipeDeleteText, {
        color: colors.nbOnFill
      }]}>Remove</Text>
      </TouchableOpacity>
    </View>;
}
function TraineeRosterRow({
  client,
  index,
  rowCount,
  colors,
  onSelectClient,
  onOpenRemove,
  renderRightActions,
  swipeRefs
}) {
  const displayName = client.name || client.displayName || 'Client';
  const initials = getClientInitials(displayName);
  const subtext = getClientSubtext(client);
  const badge = attentionBadge(client);
  const phase = clientPhase(client);
  let phaseLabel = 'Training';
  if (phase === FILTER_RECOVERY) {
    phaseLabel = 'Recovery';
  }
  const phaseSelected = phase === FILTER_TRAINING;
  const showRowDivider = index < rowCount - 1;
  let badgeBackground = colors.nbSurfaceChip || colors.nbBackground;
  let badgeBorderStyle = 'solid';
  if (badge.dashed) {
    badgeBackground = 'transparent';
    badgeBorderStyle = 'dashed';
  }
  let rowDividerStyle = null;
  if (showRowDivider) {
    rowDividerStyle = {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.nbBorder
    };
  }
  function rememberSwipeRef(swipeRef) {
    if (swipeRef) {
      swipeRefs.current.set(client.id, swipeRef);
      return;
    }
    swipeRefs.current.delete(client.id);
  }
  return <Swipeable ref={rememberSwipeRef} friction={2} overshootRight={false} renderRightActions={() => renderRightActions(client)}>
      <TouchableOpacity activeOpacity={0.88} onPress={() => onSelectClient == null ? void 0 : onSelectClient(client.id)} onLongPress={() => onOpenRemove(client)} style={[styles.clientRow, rowDividerStyle]}>
        <NbAvatar initials={initials} size={48} />
        <View style={styles.clientMain}>
          <Text style={[styles.clientName, {
          color: colors.nbInk
        }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.clientSub, {
          color: colors.nbMuted
        }]} numberOfLines={1}>
            {subtext}
          </Text>
          <View style={[styles.statusBadge, {
          borderColor: colors.nbBorder,
          backgroundColor: badgeBackground,
          borderStyle: badgeBorderStyle
        }]}>
            <Text style={[styles.statusBadgeText, {
            color: colors.nbInk
          }]}>{badge.label}</Text>
          </View>
        </View>
        <NbChip selected={phaseSelected} variant={phaseSelected ? 'default' : 'outline'}>
          {phaseLabel}
        </NbChip>
      </TouchableOpacity>
    </Swipeable>;
}
function EmptyRosterCard({
  colors,
  inviteCode,
  onCopyInvite,
  onOpenClientRequests
}) {
  const showInvite = Boolean(inviteCode);
  const showRequestsFallback = !showInvite && typeof onOpenClientRequests === 'function';
  return <NbCard style={[styles.emptyCard, {
    borderStyle: 'dashed'
  }]}>
      <NbIconChip source={ICON_CLIENTS} index={2} size={56} />
      <Text style={[styles.emptyTitle, {
      color: colors.nbInk
    }]}>No clients yet</Text>
      <Text style={[styles.emptyBody, {
      color: colors.nbMuted
    }]}>
        Clients you already train join with your invite code. New clients find you in the marketplace.
      </Text>
      {showInvite ? <>
          <View style={[styles.inviteBox, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSurface
      }]}>
            <Text style={[styles.inviteCode, {
          color: colors.nbInk
        }]}>
              {formatInviteDisplay(inviteCode)}
            </Text>
          </View>
          <NbButton variant="fill" onPress={onCopyInvite} style={styles.copyBtn}>
            Copy code
          </NbButton>
        </> : null}
      {showRequestsFallback ? <NbButton variant="fill" onPress={onOpenClientRequests} style={styles.copyBtn}>
          View client requests
        </NbButton> : null}
    </NbCard>;
}
function ClientRequestsRow({
  colors,
  requestSubtitle,
  pendingRequestCount,
  onOpenClientRequests
}) {
  const showCountBadge = pendingRequestCount > 0;
  return <HardShadow offset={nb.shadowOffsetCard} radius={16}>
      <TouchableOpacity onPress={onOpenClientRequests} activeOpacity={0.88} style={[styles.requestsRow, {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface
    }]}>
        <NbIconChip source={ICON_CLIENTS} index={2} size={44} />
        <View style={styles.requestsText}>
          <Text style={[styles.requestsTitle, {
          color: colors.nbInk
        }]}>
            View client requests
          </Text>
          <Text style={[styles.requestsSub, {
          color: colors.nbMuted
        }]} numberOfLines={1}>
            {requestSubtitle}
          </Text>
        </View>
        {showCountBadge ? <View style={[styles.countBadge, {
        backgroundColor: colors.nbFill
      }]}>
            <Text style={[styles.countBadgeText, {
          color: colors.nbOnFill
        }]}>
              {countBadgeText(pendingRequestCount)}
            </Text>
          </View> : null}
      </TouchableOpacity>
    </HardShadow>;
}

// ===== MAIN FUNCTION =====

/**
 * Trainer Clients roster — search, filter, remove via cloud unlink.
 * Export default name ClientsListScreen is frozen for TrainerMainScreen embed.
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
  isDark: _isDarkIgnored = true
}) => {
  const {
    colors
  } = useTheme();
  const shellTopPad = useShellTopPad(spacing.sm);
  const scrollBottomPad = useShellBottomNavInset(SHELL_NAV_INSET_FALLBACK);
  const [search, setSearch] = useState('');
  const [filterId, setFilterId] = useState(FILTER_ALL);
  const [deletePending, setDeletePending] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const swipeRefs = useRef(new Map());
  const openRemoveSheet = useCallback(client => {
    var _optFn, _optObj;
    // 1. Close any open swipe row for this client.
    (_optFn = (_optObj = swipeRefs.current.get(client.id)) == null ? void 0 : _optObj.close) == null ? void 0 : _optFn();
    // 2. Seed the confirm sheet with id + display name.
    setDeletePending({
      id: client.id,
      name: String(client.name || client.displayName || 'Client').trim() || 'Client'
    });
  }, []);
  const cancelRemove = useCallback(() => {
    setDeletePending(null);
    setRemoveBusy(false);
  }, []);
  const confirmRemove = useCallback(async () => {
    // 1. Need a pending client and a trainer id.
    if (!(deletePending == null ? void 0 : deletePending.id) || !trainerId) return;

    // 2. Cloud Functions must be wired — otherwise toast and stop.
    if (!functions) {
      setToast({
        title: 'Unavailable',
        body: 'Cloud Functions are not configured.'
      });
      scheduleToastClear(setToast, TOAST_LONG_MS);
      return;
    }
    const clientId = deletePending.id;
    const displayName = deletePending.name;

    // 3. Call removeTrainerClientLink (reasons empty — PNG unlink sheet, not reason picker).
    setRemoveBusy(true);
    try {
      const removeLink = httpsCallable(functions, 'removeTrainerClientLink');
      await removeLink({
        trainerId,
        clientId,
        reasons: [],
        otherText: null,
        removedBy: 'trainer'
      });
      cancelRemove();
      onClientRemoved == null ? void 0 : onClientRemoved(clientId);
      setToast({
        title: 'Client removed',
        body: `${firstNameFromDisplay(displayName)} is no longer on your roster. You can invite them again with your code.`
      });
      scheduleToastClear(setToast, TOAST_LONG_MS);
    } catch (removeError) {
      const errorMessage = (removeError == null ? void 0 : removeError.message) || (removeError == null ? void 0 : removeError.code) || 'Could not remove this client. Try again.';
      setToast({
        title: 'Remove failed',
        body: String(errorMessage)
      });
      scheduleToastClear(setToast, TOAST_LONG_MS);
    } finally {
      setRemoveBusy(false);
    }
  }, [cancelRemove, deletePending, onClientRemoved, trainerId]);
  const filteredClients = useMemo(() => {
    const searchLower = search.trim().toLowerCase();
    const list = clients || [];
    return list.filter(client => matchesSearch(client, searchLower) && matchesFilter(client, filterId));
  }, [clients, filterId, search]);
  const requestSubtitle = useMemo(() => buildRequestSubtitle(pendingRequestNames, pendingRequestCount), [pendingRequestCount, pendingRequestNames]);
  const copyInvite = useCallback(async () => {
    // 1. Nothing to copy without an invite code.
    if (!inviteCode) return;
    // 2. Write to the clipboard and toast success / failure.
    try {
      await Clipboard.setStringAsync(String(inviteCode));
      setToast({
        title: 'Copied',
        body: formatInviteDisplay(inviteCode)
      });
      scheduleToastClear(setToast, TOAST_SHORT_MS);
    } catch (_copyError) {
      setToast({
        title: 'Copy failed',
        body: 'Could not copy invite code.'
      });
      scheduleToastClear(setToast, TOAST_SHORT_MS);
    }
  }, [inviteCode]);
  const renderRightActions = useCallback(client => <SwipeRemoveAction client={client} colors={colors} onOpenRemove={openRemoveSheet} />, [colors, openRemoveSheet]);
  function openAddOrRequests() {
    if (typeof onOpenClientRequests === 'function') {
      onOpenClientRequests();
      return;
    }
    onPlusPress == null ? void 0 : onPlusPress();
  }
  const showHeaderAdd = typeof onOpenClientRequests === 'function' || typeof onPlusPress === 'function';
  const showRequestsRow = typeof onOpenClientRequests === 'function';
  const rosterIsEmpty = (clients || []).length === 0;
  const showFilterRow = !rosterIsEmpty;
  const showLoadMore = hasMore && typeof onLoadMore === 'function';
  let loadMoreLabel = 'Load more clients';
  if (loadingMore) {
    loadMoreLabel = 'Loading…';
  }
  const noFilterMatch = filteredClients.length === 0 && !rosterIsEmpty;
  let headerPadStyle = null;
  if (!embedInLayout) {
    headerPadStyle = {
      paddingTop: shellTopPad
    };
  }
  const header = <View style={[styles.headerRow, headerPadStyle]}>
      <Text style={[styles.screenTitle, {
      color: colors.nbInk
    }]}>Clients</Text>
      {showHeaderAdd ? <NavSquare colors={colors} onPress={openAddOrRequests}>
          <Ionicons name="add" size={24} color={colors.nbInk} />
        </NavSquare> : null}
    </View>;
  const searchField = <View style={[styles.searchWrap, {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface
  }]}>
      <Ionicons name="search" size={18} color={colors.nbMuted} />
      <TextInput value={search} onChangeText={setSearch} placeholder="Search clients" placeholderTextColor={colors.nbMuted} style={[styles.searchInput, {
      color: colors.nbInk
    }]} autoCorrect={false} autoCapitalize="none" />
    </View>;
  let requestsRow = null;
  if (showRequestsRow) {
    requestsRow = <ClientRequestsRow colors={colors} requestSubtitle={requestSubtitle} pendingRequestCount={pendingRequestCount} onOpenClientRequests={onOpenClientRequests} />;
  }
  const filterRow = <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterStrip}>
      {FILTER_CHIPS.map(chip => <NbChip key={chip.id} selected={filterId === chip.id} onPress={() => setFilterId(chip.id)}>
          {chip.label}
        </NbChip>)}
    </ScrollView>;
  let listCard;
  if (rosterIsEmpty) {
    listCard = <EmptyRosterCard colors={colors} inviteCode={inviteCode} onCopyInvite={copyInvite} onOpenClientRequests={onOpenClientRequests} />;
  } else {
    listCard = <HardShadow offset={nb.shadowOffsetCard} radius={16}>
        <View style={[styles.listCard, {
        borderColor: colors.nbBorder,
        backgroundColor: colors.nbSurface
      }]}>
          {noFilterMatch ? <Text style={[styles.noMatch, {
          color: colors.nbMuted
        }]}>No clients match.</Text> : filteredClients.map((client, index) => <TraineeRosterRow key={client.id} client={client} index={index} rowCount={filteredClients.length} colors={colors} onSelectClient={onSelectClient} onOpenRemove={openRemoveSheet} renderRightActions={renderRightActions} swipeRefs={swipeRefs} />)}
          {showLoadMore ? <View style={styles.loadMoreWrap}>
              <NbButton variant="ghost" onPress={onLoadMore} disabled={loadingMore}>
                {loadMoreLabel}
              </NbButton>
            </View> : null}
        </View>
      </HardShadow>;
  }
  const toastEl = <RosterToastBanner toast={toast} colors={colors} />;
  const body = <GestureHandlerRootView style={{
    flex: 1
  }}>
      {header}
      <ScrollView contentContainerStyle={[styles.scroll, {
      paddingBottom: scrollBottomPad
    }]} {...FORM_SCROLL_PROPS} keyboardShouldPersistTaps="handled">
        {searchField}
        {requestsRow}
        {showFilterRow ? filterRow : null}
        {listCard}
      </ScrollView>
      {toastEl}
      <RemoveClientSheet visible={!!deletePending} onClose={cancelRemove} onConfirm={confirmRemove} clientName={deletePending == null ? void 0 : deletePending.name} busy={removeBusy} />
    </GestureHandlerRootView>;
  if (embedInLayout) {
    return <View style={{
      flex: 1,
      backgroundColor: colors.nbBackground
    }}>{body}</View>;
  }
  return <AppNavigationProvider onProfilePress={onProfilePress} onSettingsPress={onSettingsPress} onHomePress={onHomePress} onPlusPress={onPlusPress} onVoicePress={onVoicePress} onNutritionPress={onNutritionPress} onWorkoutPress={onWorkoutPress} onMessagesPress={onMessagesPress}>
      <SafeAreaView style={{
      flex: 1,
      backgroundColor: colors.nbBackground
    }} edges={SHELL_SAFE_AREA_EDGES}>
        {body}
        <ShellBottomNavAnchor>
          <BottomMenuBar onHomePress={onHomePress} onPlusPress={onPlusPress} onVoicePress={onVoicePress} onNutritionPress={onNutritionPress} onWorkoutPress={onWorkoutPress} onMessagesPress={onMessagesPress} />
        </ShellBottomNavAnchor>
      </SafeAreaView>
    </AppNavigationProvider>;
};
export default ClientsListScreen;
const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 12
  },
  screenTitle: {
    flex: 1,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 28,
    letterSpacing: -0.4
  },
  navSquare: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.md
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 48
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8
  },
  requestsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 16,
    padding: 12
  },
  requestsText: {
    flex: 1,
    minWidth: 0
  },
  requestsTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15
  },
  requestsSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    marginTop: 2
  },
  countBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  countBadgeText: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 13
  },
  filterStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2
  },
  listCard: {
    borderWidth: nb.borderWidth,
    borderRadius: 16,
    overflow: 'hidden'
  },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14
  },
  clientMain: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  clientName: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.2
  },
  clientSub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12
  },
  statusBadge: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidth,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 2
  },
  statusBadgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11
  },
  loadMoreWrap: {
    padding: 12
  },
  noMatch: {
    padding: 20,
    textAlign: 'center',
    fontFamily: 'Inter_500Medium'
  },
  emptyCard: {
    paddingVertical: 28,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 12
  },
  emptyTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    textAlign: 'center'
  },
  emptyBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center'
  },
  inviteBox: {
    borderWidth: nb.borderWidth,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignSelf: 'stretch',
    alignItems: 'center'
  },
  inviteCode: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    letterSpacing: 1
  },
  copyBtn: {
    alignSelf: 'stretch',
    marginTop: 4
  },
  swipeWrap: {
    width: SWIPE_DELETE_WIDTH,
    justifyContent: 'stretch'
  },
  swipeDelete: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6
  },
  swipeDeleteText: {
    fontSize: 11,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 4
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
    shadowOffset: {
      width: nb.shadowOffsetSmall,
      height: nb.shadowOffsetSmall
    },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    zIndex: 20
  },
  toastTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 15
  },
  toastBody: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.9
  }
});
