// InboxScreen — Design Law thread list (NbCard rows, search, unread fill badges).
// Flow: load unread + conversations → filter/search → open thread or start coach chat.
// Used by trainer/client shells; Firebase paths stay under conversations + users.
// Read order: constants → row/empty UI → InboxScreen → PLUMBING helpers + styles.

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../look-and-feel/lightDarkMode';
import NbCard from '../look-and-feel/NbCard';
import NbAvatar from '../look-and-feel/NbAvatar';
import NbButton from '../look-and-feel/NbButton';
import NbNoticeSheet from '../look-and-feel/NbNoticeSheet';
import HardShadow from '../look-and-feel/HardShadow';
import { nb, borderRadius } from '../look-and-feel/colorPalette';
import { auth, db } from '../app-start/cloudConnection';
import {
  subscribeToConversations,
  subscribeToUnreadByConversation,
  fetchMoreConversations,
} from '../ai-coach/past-chats/loadOlderChats';
import { getTrainerClients, createOrUpdateClient } from '../trainer-app/my-trainees/traineeList';
import { getOrCreateConversation, markMessagesAsRead } from '../ai-coach/coach-actions/alertTrainer';
import { doc, getDoc } from 'firebase/firestore';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { NbSkeletonMessageRow } from '../look-and-feel/NbSkeleton';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { blockedList } from '../block-and-report/blockedList';

// ===== NAMED CONSTANTS =====

// Manipulate here: relative-time buckets for the thread timestamp column.
const MS_PER_MINUTE = 60000;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;
const MINUTES_PER_MONTH_APPROX = 43200;

// Manipulate here: bottom shell clearance, delayed coach-thread ensure, unread UI re-check.
const SHELL_BOTTOM_NAV_INSET = 24;
const ENSURE_CLIENT_CONVERSATION_DELAY_MS = 1000;
const UNREAD_COUNT_RECHECK_MS = 500;

const DEFAULT_AVATAR_SIZE = 48;
const UNREAD_BADGE_CAP = 99;
const SKELETON_ROW_COUNT = 5;

// ===== HELPER FUNCTIONS =====
// Row / empty UI (pure layout — no hooks)

function threadInitialsFromName(displayName) {
  const nameParts = (displayName || '?').split(' ');
  let letters = '';
  for (let partIndex = 0; partIndex < nameParts.length; partIndex += 1) {
    const part = nameParts[partIndex];
    if (!part) continue;
    letters += part[0];
  }
  return letters.slice(0, 2).toUpperCase();
}

function InboxEmptyPanel({
  listError,
  conversations,
  filteredConversations,
  isTrainer,
  startingChat,
  ink,
  muted,
  onRetry,
  onMessageCoach,
}) {
  const trainerFilteredAllAway =
    !listError &&
    conversations.length > 0 &&
    filteredConversations.length === 0 &&
    isTrainer;

  if (listError) {
    return (
      <View style={screenStyles.emptyWrap}>
        <View
          style={[
            screenStyles.emptyIconBox,
            {
              borderColor: 'rgba(239,68,68,0.35)',
              backgroundColor: 'rgba(239,68,68,0.08)',
            },
          ]}
        >
          <Ionicons name="cloud-offline-outline" size={34} color="#f87171" />
        </View>
        <Text style={[screenStyles.emptyTitle, { color: ink }]}>Couldn't load messages</Text>
        <Text style={[screenStyles.emptySubtitle, { color: muted }]}>
          Check your connection, then try again.
        </Text>
        <NbButton variant="fill" onPress={onRetry} style={{ marginTop: 20 }}>
          Retry
        </NbButton>
      </View>
    );
  }

  if (trainerFilteredAllAway) {
    return (
      <View style={screenStyles.emptyWrap}>
        <Text style={[screenStyles.emptyTitle, { color: ink }]}>No client chats yet</Text>
        <Text style={[screenStyles.emptySubtitle, { color: muted }]}>
          Conversations with people who aren't in your client list are hidden here.
        </Text>
      </View>
    );
  }

  const emptySubtitleForRole = isTrainer
    ? 'Message a client from your roster, or add someone new from a chat.'
    : 'Say hi to your coach — your thread will show up here.';
  const coachButtonLabel = startingChat ? 'Opening…' : 'Message your coach';
  const showMessageCoachButton = !isTrainer;

  return (
    <View style={screenStyles.emptyWrap}>
      <Text style={[screenStyles.emptyTitle, { color: ink }]}>No conversations yet</Text>
      <Text style={[screenStyles.emptySubtitle, { color: muted }]}>{emptySubtitleForRole}</Text>
      {showMessageCoachButton ? (
        <NbButton
          variant="fill"
          onPress={onMessageCoach}
          disabled={startingChat}
          style={{ marginTop: 20 }}
        >
          {coachButtonLabel}
        </NbButton>
      ) : null}
    </View>
  );
}

function InboxThreadRow({
  conversation,
  rowIndex,
  rowTotal,
  currentUserId,
  participantNames,
  participantData,
  unreadByConversationId,
  isTrainer,
  trainerClients,
  addingClient,
  colors,
  ink,
  muted,
  onOpenThread,
  onAddAsClient,
}) {
  if (!conversation) {
    return null;
  }
  if (!conversation.participants) {
    return null;
  }

  const otherParticipantId = findOtherParticipantId(conversation, currentUserId);
  if (!otherParticipantId) {
    return null;
  }

  const displayName = participantNames[otherParticipantId] || 'User';
  const otherProfile = participantData[otherParticipantId] || {};
  const previewLine = previewTextFromConversation(conversation);
  const timestampLabel =
    formatRelativeTimestamp(conversation.lastMessageTime) ||
    formatRelativeTimestamp(conversation.updatedAt) ||
    null;
  const alreadyOnRoster =
    isTrainer && trainerClients.some((client) => client.id === otherParticipantId);
  const addInFlight = addingClient[otherParticipantId];
  // vocab/symbol: ?? = use right side only when left is null/undefined
  const unreadCount = unreadByConversationId[conversation.id] ?? 0;
  const unreadLabel = unreadCount > UNREAD_BADGE_CAP ? '99+' : unreadCount;
  const showRowDivider = rowIndex < rowTotal - 1;
  const previewInk = unreadCount > 0 ? ink : muted;
  const previewWeight = unreadCount > 0 ? '700' : '500';
  const nameWeight = unreadCount > 0 ? '900' : '800';
  const showUnreadBadge = unreadCount > 0;
  const showAddAsClientButton = isTrainer && !alreadyOnRoster;
  const rowDividerStyle = showRowDivider
    ? { borderBottomWidth: nb.borderWidth, borderBottomColor: colors.nbBorder }
    : null;

  return (
    <TouchableOpacity
      onPress={() => onOpenThread(conversation, otherParticipantId, otherProfile)}
      activeOpacity={0.88}
      style={[rowStyles.threadRow, rowDividerStyle]}
    >
      <NbAvatar
        size={DEFAULT_AVATAR_SIZE}
        initials={threadInitialsFromName(displayName)}
        source={otherProfile.photoURL || undefined}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[rowStyles.name, { color: ink, fontWeight: nameWeight }]} numberOfLines={1}>
            {displayName}
          </Text>
          {timestampLabel ? (
            <Text style={[rowStyles.timestamp, { color: muted }]}>{timestampLabel}</Text>
          ) : null}
        </View>
        <Text
          style={[rowStyles.preview, { color: previewInk, fontWeight: previewWeight }]}
          numberOfLines={1}
        >
          {previewLine}
        </Text>
      </View>
      {showUnreadBadge ? (
        <View
          style={[
            rowStyles.unreadBadge,
            { backgroundColor: colors.nbFill, borderColor: colors.nbBorder },
          ]}
        >
          <Text style={[rowStyles.unreadText, { color: colors.nbOnFill }]}>{unreadLabel}</Text>
        </View>
      ) : null}
      {showAddAsClientButton ? (
        <TouchableOpacity
          onPress={(pressEvent) => onAddAsClient(otherParticipantId, otherProfile, pressEvent)}
          disabled={!!addInFlight}
          style={[
            screenStyles.addBtn,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
        >
          {addInFlight ? (
            <ActivityIndicator size="small" color={ink} />
          ) : (
            <Text style={[screenStyles.addBtnText, { color: ink }]}>+ Add</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </TouchableOpacity>
  );
}

function renderSkeletonRows(skeletonKeys) {
  const skeletonRows = [];
  for (let skeletonIndex = 0; skeletonIndex < skeletonKeys.length; skeletonIndex += 1) {
    const keyNumber = skeletonKeys[skeletonIndex];
    skeletonRows.push(<NbSkeletonMessageRow key={`skel-${keyNumber}`} />);
  }
  return skeletonRows;
}

function renderThreadRows(filteredConversations, threadProps) {
  const threadRows = [];
  for (let index = 0; index < filteredConversations.length; index += 1) {
    const conversation = filteredConversations[index];
    threadRows.push(
      <InboxThreadRow
        key={conversation.id}
        conversation={conversation}
        rowIndex={index}
        rowTotal={filteredConversations.length}
        currentUserId={threadProps.currentUserId}
        participantNames={threadProps.participantNames}
        participantData={threadProps.participantData}
        unreadByConversationId={threadProps.unreadByConversationId}
        isTrainer={threadProps.isTrainer}
        trainerClients={threadProps.trainerClients}
        addingClient={threadProps.addingClient}
        colors={threadProps.colors}
        ink={threadProps.ink}
        muted={threadProps.muted}
        onOpenThread={threadProps.onOpenThread}
        onAddAsClient={threadProps.onAddAsClient}
      />,
    );
  }
  return threadRows;
}

/**
 * Choose skeleton / empty / thread list without nesting if/else-if in InboxScreen.
 * Early returns keep depth at 1.
 */
function pickInboxListBody({
  showLoadingSkeleton,
  showEmptyPanel,
  skeletonKeys,
  listError,
  conversations,
  filteredConversations,
  isTrainer,
  startingChat,
  ink,
  muted,
  onRetry,
  onMessageCoach,
  listScrollBottomPad,
  currentUserId,
  participantNames,
  participantData,
  unreadByConversationId,
  trainerClients,
  addingClient,
  colors,
  onOpenThread,
  onAddAsClient,
  loadEarlierControl,
}) {
  if (showLoadingSkeleton) {
    const skeletonRows = renderSkeletonRows(skeletonKeys);
    return (
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <HardShadow>
          <NbCard style={screenStyles.listCard}>{skeletonRows}</NbCard>
        </HardShadow>
      </View>
    );
  }

  if (showEmptyPanel) {
    return (
      <InboxEmptyPanel
        listError={listError}
        conversations={conversations}
        filteredConversations={filteredConversations}
        isTrainer={isTrainer}
        startingChat={startingChat}
        ink={ink}
        muted={muted}
        onRetry={onRetry}
        onMessageCoach={onMessageCoach}
      />
    );
  }

  const threadRows = renderThreadRows(filteredConversations, {
    currentUserId,
    participantNames,
    participantData,
    unreadByConversationId,
    isTrainer,
    trainerClients,
    addingClient,
    colors,
    ink,
    muted,
    onOpenThread,
    onAddAsClient,
  });

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: listScrollBottomPad,
        flexGrow: 1,
      }}
      {...FORM_SCROLL_PROPS}
    >
      <HardShadow>
        <NbCard style={screenStyles.listCard}>{threadRows}</NbCard>
      </HardShadow>
      {loadEarlierControl}
    </ScrollView>
  );
}

function isClientAlreadyOnRoster(existingClients, clientId) {
  const list = existingClients || [];
  for (let clientIndex = 0; clientIndex < list.length; clientIndex += 1) {
    if (list[clientIndex].id === clientId) {
      return true;
    }
  }
  return false;
}

// ===== MAIN FUNCTION =====

/**
 * Conversations list — live Firebase threads with trainer/client filtering and unread badges.
 * @param {{ onSelectConversation?: Function, onClose?: Function, onProfilePress?: Function, onSettingsPress?: Function, embedInLayout?: boolean, selectedClientId?: string }} props
 */
export default function InboxScreen({
  onSelectConversation,
  onClose,
  onProfilePress,
  onSettingsPress,
  embedInLayout,
  selectedClientId,
}) {
  // vocab: useTheme = Design Law light/dark color bag (nbInk, nbFill, …)
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const embedTopPad = embedInLayout ? Math.max(insets.top, 8) : 0;
  // Shell BottomMenuBar stays visible on the conversations list — reserve it.
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_NAV_INSET);
  const embedBottomPad = embedInLayout ? shellBottomPad : 0;
  const ink = colors.nbInk;
  const muted = colors.nbMuted;

  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [participantNames, setParticipantNames] = useState({});
  const [participantData, setParticipantData] = useState({});
  const [unreadByConversationId, setUnreadByConversationId] = useState({});
  const [isTrainer, setIsTrainer] = useState(false);
  const [trainerClients, setTrainerClients] = useState([]);
  const [addingClient, setAddingClient] = useState({});
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [loadingMoreConversations, setLoadingMoreConversations] = useState(false);
  const [listError, setListError] = useState(null);
  const [listRefreshKey, setListRefreshKey] = useState(0);
  const [startingChat, setStartingChat] = useState(false);
  // vocab: notice = NbNoticeSheet payload — Design Law sheet instead of Alert.alert
  const [notice, setNotice] = useState(null);
  const showNotice = (title, message) => setNotice({ title, message });
  const lastConversationDocRef = useRef(null);
  const currentUser = auth.currentUser;

  let currentUserId = null;
  if (currentUser) {
    currentUserId = currentUser.uid;
  }
  const { blockedIds } = blockedList(currentUserId);

  // Live unread badge map keyed by conversation id.
  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribeUnread = subscribeToUnreadByConversation(
      currentUserId,
      (unreadCountsByConversationId) => {
        console.log('🔔 Unread counts updated:', unreadCountsByConversationId);
        setUnreadByConversationId(unreadCountsByConversationId || {});
      },
    );
    return () => unsubscribeUnread();
  }, [currentUserId]);

  // Detect trainer role and load roster (flat helper — no nested if/try depth).
  useEffect(() => {
    if (!currentUser || !db) return;
    const runRoleCheck = async () => {
      try {
        const result = await loadTrainerRoleAndClients(currentUser.uid);
        setIsTrainer(result.isUserTrainer);
        if (result.isUserTrainer) {
          setTrainerClients(result.clients);
        }
      } catch (error) {
        console.error('Error checking trainer role:', error);
      }
    };
    runRoleCheck();
  }, [currentUser]);

  // Real-time conversation list (+ retry bump via listRefreshKey).
  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    setListError(null);
    const unsubscribeConversations = subscribeToConversations(
      currentUser.uid,
      ({
        conversations: conversationList,
        participantNames: namesByUserId,
        participantData: profilesByUserId,
        lastDoc,
        hasMore,
        error,
      }) => {
        setConversations(conversationList || []);
        setParticipantNames(namesByUserId || {});
        setParticipantData(profilesByUserId || {});
        lastConversationDocRef.current = lastDoc ?? null;
        setHasMoreConversations(Boolean(hasMore));
        setListError(error || null);
        setLoading(false);
      },
    );
    return () => unsubscribeConversations();
  }, [currentUser, listRefreshKey]);

  const filteredConversations = useMemo(
    () =>
      filterInboxConversations({
        conversations,
        currentUserId,
        blockedIds,
        selectedClientId,
        isTrainer,
        trainerClients,
        searchQuery,
        participantNames,
      }),
    [
      conversations,
      isTrainer,
      trainerClients,
      currentUserId,
      selectedClientId,
      blockedIds,
      searchQuery,
      participantNames,
    ],
  );

  // Clients only: after a short delay, open/create the assigned-trainer thread.
  useEffect(() => {
    if (!currentUser || isTrainer) return;
    const timer = setTimeout(() => {
      ensureAssignedTrainerConversation(currentUser.uid).catch((error) => {
        console.error('Error ensuring client conversation:', error);
      });
    }, ENSURE_CLIENT_CONVERSATION_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentUser, isTrainer]);

  const handleAddAsClient = async (clientId, clientData, event) => {
    // 1. Keep the row tap from firing when the trainer hits + Add.
    if (event && event.stopPropagation) {
      event.stopPropagation();
    }
    if (!currentUser || !isTrainer) {
      return;
    }

    setAddingClient((previous) => ({ ...previous, [clientId]: true }));

    try {
      // 2. Bail when they are already on the roster.
      const existingClients = await getTrainerClients(currentUser.uid);
      const alreadyClient = isClientAlreadyOnRoster(existingClients, clientId);
      if (alreadyClient) {
        showNotice('Info', 'This person is already your client');
        setAddingClient((previous) => ({ ...previous, [clientId]: false }));
        return;
      }

      // 3. Load full Firestore profile and attach as a client.
      const userSnap = await getDoc(doc(db, 'users', clientId));
      const fullUserData = userSnap.exists() ? userSnap.data() : null;
      if (!fullUserData) {
        showNotice('Error', 'Could not load user data');
        setAddingClient((previous) => ({ ...previous, [clientId]: false }));
        return;
      }

      await createOrUpdateClient(
        clientId,
        currentUser.uid,
        buildClientPayloadFromUserData(fullUserData),
      );
      const updatedClients = await getTrainerClients(currentUser.uid);
      setTrainerClients(updatedClients);
      showNotice('Success', 'Client added successfully!');
    } catch (error) {
      console.error('Error adding client:', error);
      let errorMessage = 'Failed to add client.';
      if (error && error.message) {
        errorMessage = error.message;
      }
      showNotice('Error', errorMessage);
    } finally {
      setAddingClient((previous) => ({ ...previous, [clientId]: false }));
    }
  };

  const handleMessageCoach = async () => {
    if (!currentUserId || startingChat) {
      return;
    }

    setStartingChat(true);
    try {
      // 1. Resolve assigned trainer id from the signed-in user doc.
      const userSnap = await getDoc(doc(db, 'users', currentUserId));
      const userData = userSnap.exists() ? userSnap.data() : null;
      const trainerId = userData ? userData.trainerId : null;
      if (!trainerId) {
        showNotice('No coach yet', 'Find a trainer in the app to start messaging.');
        return;
      }

      // 2. Open or create the thread, then hand off to the parent navigator.
      const conversationId = await getOrCreateConversation(currentUserId, trainerId);
      const conversationSnap = await getDoc(doc(db, 'conversations', conversationId));
      const trainerSnap = await getDoc(doc(db, 'users', trainerId));
      const trainerData = trainerSnap.exists() ? trainerSnap.data() : {};

      let conversationForNav;
      if (conversationSnap.exists()) {
        conversationForNav = { id: conversationId, ...conversationSnap.data() };
      } else {
        conversationForNav = {
          id: conversationId,
          participants: [currentUserId, trainerId],
        };
      }

      if (onSelectConversation) {
        onSelectConversation(conversationForNav, { id: trainerId, ...trainerData });
      }
    } catch (error) {
      console.error('handleMessageCoach failed:', error);
      let errorMessage = 'Please try again.';
      if (error && error.message) {
        errorMessage = error.message;
      }
      showNotice('Could not open chat', errorMessage);
    } finally {
      setStartingChat(false);
    }
  };

  const openThread = async (conversation, otherId, otherData) => {
    try {
      await markConversationReadAndClearBadge(
        conversation.id,
        auth.currentUser.uid,
        unreadByConversationId,
        setUnreadByConversationId,
      );
    } catch (error) {
      console.error('❌ Error marking messages as read:', error);
    }
    if (onSelectConversation) {
      onSelectConversation(conversation, { id: otherId, ...otherData });
    }
  };

  const loadMoreConversations = async () => {
    if (!currentUserId || loadingMoreConversations || !lastConversationDocRef.current) {
      return;
    }

    setLoadingMoreConversations(true);
    try {
      // 1. Fetch the next page after the last cursor doc.
      const page = await fetchMoreConversations(
        currentUserId,
        lastConversationDocRef.current,
      );
      if (page.lastDoc) {
        lastConversationDocRef.current = page.lastDoc;
      }
      setHasMoreConversations(page.hasMore);

      // 2. Merge page rows into the list by conversation id (no duplicates).
      const pageConversations = page.conversations;
      if (pageConversations && pageConversations.length) {
        setConversations((previousList) =>
          mergeConversationPages(previousList, pageConversations),
        );
      }
    } catch (error) {
      console.error('fetchMoreConversations failed:', error);
    } finally {
      setLoadingMoreConversations(false);
    }
  };

  // ----- Named UI pieces (decisions before JSX) -----
  const messagesTitle = isTrainer ? 'Messages' : 'Message your coach';
  const showEmbeddedHeader = !!embedInLayout;
  const showStandaloneBack = !embedInLayout && !!onClose;
  const showTrainerSearch = isTrainer;
  const showLoadEarlier = hasMoreConversations;
  const showLoadingSkeleton = loading;
  const showEmptyPanel = !loading && filteredConversations.length === 0;
  const listScrollBottomPad = embedInLayout ? embedBottomPad : 48;
  const loadEarlierLabel = loadingMoreConversations ? 'Loading…' : 'Load earlier messages';
  const skeletonKeys = [0, 1, 2, 3, 4].slice(0, SKELETON_ROW_COUNT);

  const pageHeader = (
    <View style={screenStyles.header}>
      <Text style={[screenStyles.headerTitle, { color: ink }]}>{messagesTitle}</Text>
      {isTrainer ? (
        <HardShadow offset={nb.shadowOffset} radius={borderRadius.nbButton}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="New message"
            onPress={() => {}}
            style={[
              screenStyles.sqBtn,
              { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
            ]}
          >
            <Ionicons name="add" size={24} color={ink} />
          </TouchableOpacity>
        </HardShadow>
      ) : (
        <View style={{ width: nb.minTouchTarget }} />
      )}
    </View>
  );

  const searchBlock = showTrainerSearch ? (
    <TextInput
      value={searchQuery}
      onChangeText={setSearchQuery}
      placeholder="Search clients"
      placeholderTextColor={muted}
      accessibilityLabel="Search clients"
      style={[
        screenStyles.searchField,
        {
          borderColor: colors.nbBorder,
          backgroundColor: colors.nbSurface,
          color: ink,
        },
      ]}
    />
  ) : null;

  const loadEarlierControl = showLoadEarlier ? (
    <View style={screenStyles.loadMoreWrap}>
      <NbButton
        variant="ghost"
        onPress={loadMoreConversations}
        disabled={loadingMoreConversations}
      >
        {loadEarlierLabel}
      </NbButton>
    </View>
  ) : null;

  // Pick list body without nested if/else-if (Variation 3 max depth).
  const listBody = pickInboxListBody({
    showLoadingSkeleton,
    showEmptyPanel,
    skeletonKeys,
    listError,
    conversations,
    filteredConversations,
    isTrainer,
    startingChat,
    ink,
    muted,
    onRetry: () => setListRefreshKey((key) => key + 1),
    onMessageCoach: handleMessageCoach,
    listScrollBottomPad,
    currentUserId,
    participantNames,
    participantData,
    unreadByConversationId,
    trainerClients,
    addingClient,
    colors,
    onOpenThread: openThread,
    onAddAsClient: handleAddAsClient,
    loadEarlierControl,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.nbBackground }}>
      {showEmbeddedHeader ? (
        <TopHeader
          skipTopSafeInset
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      ) : null}
      {showStandaloneBack ? (
        <View style={{ paddingHorizontal: 16, paddingTop: embedTopPad + 8 }}>
          <HardShadow offset={nb.shadowOffset} radius={borderRadius.nbButton}>
            <TouchableOpacity
              onPress={onClose}
              style={[
                screenStyles.sqBtn,
                { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
              ]}
            >
              <Ionicons name="chevron-back" size={22} color={ink} />
            </TouchableOpacity>
          </HardShadow>
        </View>
      ) : null}
      {pageHeader}
      {searchBlock}
      {listBody}
      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={noticeTitleText(notice)}
        message={noticeMessageText(notice)}
        confirmLabel="OK"
      />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging =====

function noticeTitleText(notice) {
  if (!notice) return '';
  if (!notice.title) return '';
  return notice.title;
}

function noticeMessageText(notice) {
  if (!notice) return undefined;
  return notice.message;
}

/**
 * Turn a Firestore timestamp (or Date-ish value) into a short relative label.
 * vocab: toDate = Firestore Timestamp helper that returns a JS Date
 */
function formatRelativeTimestamp(timestamp) {
  if (!timestamp) return null;

  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    if (isNaN(date.getTime())) return null;

    const now = new Date();
    const diffMs = now - date;
    const minutesAgo = Math.floor(diffMs / MS_PER_MINUTE);

    if (minutesAgo < 1) return 'Just now';
    if (minutesAgo < MINUTES_PER_HOUR) return `${minutesAgo} min`;
    if (minutesAgo < MINUTES_PER_DAY) {
      return `${Math.floor(minutesAgo / MINUTES_PER_HOUR)} h`;
    }
    if (minutesAgo < MINUTES_PER_MONTH_APPROX) {
      return `${Math.floor(minutesAgo / MINUTES_PER_DAY)}d ago`;
    }
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch (error) {
    return null;
  }
}

/** Preview line under the name — string, { text }, or String(fallback). */
function previewTextFromConversation(conversation) {
  if (!conversation) return 'No messages yet';
  const lastMessage = conversation.lastMessage;
  if (!lastMessage) return 'No messages yet';
  if (typeof lastMessage === 'string') return lastMessage;
  if (typeof lastMessage === 'object' && lastMessage.text) {
    return String(lastMessage.text);
  }
  return String(lastMessage);
}

/** Sort key for a thread — prefer updatedAt millis when present. */
function conversationSortTime(conversation) {
  if (!conversation) return 0;
  const updatedAt = conversation.updatedAt;
  if (!updatedAt) return 0;
  if (typeof updatedAt.toMillis === 'function') {
    return updatedAt.toMillis();
  }
  return updatedAt;
}

function findOtherParticipantId(thread, currentUserId) {
  if (!thread) return undefined;
  if (!thread.participants) return undefined;

  for (let index = 0; index < thread.participants.length; index += 1) {
    const participantId = thread.participants[index];
    if (participantId && participantId !== currentUserId) {
      return participantId;
    }
  }
  return undefined;
}

// One row per other participant — hide blocked, non-roster, and wrong selected client; optional search.
function filterInboxConversations({
  conversations,
  currentUserId,
  blockedIds,
  selectedClientId,
  isTrainer,
  trainerClients,
  searchQuery,
  participantNames,
}) {
  if (!conversations.length) {
    return [];
  }

  const clientIds = new Set();
  const roster = trainerClients || [];
  for (let clientIndex = 0; clientIndex < roster.length; clientIndex += 1) {
    clientIds.add(roster[clientIndex].id);
  }
  const newestByOtherUser = new Map();

  for (const thread of conversations) {
    const otherId = findOtherParticipantId(thread, currentUserId);
    if (!otherId) {
      continue;
    }
    if (blockedIds && blockedIds.has(otherId)) {
      continue;
    }
    if (selectedClientId && otherId !== selectedClientId) {
      continue;
    }
    if (isTrainer && clientIds.size > 0 && !clientIds.has(otherId)) {
      continue;
    }

    const sortTime = conversationSortTime(thread);
    const previous = newestByOtherUser.get(otherId);
    const thisThreadIsNewer = !previous || sortTime > previous.time;
    if (thisThreadIsNewer) {
      newestByOtherUser.set(otherId, { thread, time: sortTime });
    }
  }

  const newestEntries = Array.from(newestByOtherUser.values());
  const sortedNewestFirst = [];
  for (let entryIndex = 0; entryIndex < newestEntries.length; entryIndex += 1) {
    sortedNewestFirst.push(newestEntries[entryIndex].thread);
  }
  sortedNewestFirst.sort(
    (left, right) => conversationSortTime(right) - conversationSortTime(left),
  );

  const trimmedSearch = String(searchQuery || '').trim().toLowerCase();
  if (!trimmedSearch) {
    return sortedNewestFirst;
  }

  const matchedThreads = [];
  for (let threadIndex = 0; threadIndex < sortedNewestFirst.length; threadIndex += 1) {
    const thread = sortedNewestFirst[threadIndex];
    const otherId = findOtherParticipantId(thread, currentUserId);
    const displayName = (participantNames[otherId] || '').toLowerCase();
    const previewLine = previewTextFromConversation(thread).toLowerCase();
    if (displayName.includes(trimmedSearch) || previewLine.includes(trimmedSearch)) {
      matchedThreads.push(thread);
    }
  }
  return matchedThreads;
}

async function loadTrainerRoleAndClients(userId) {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) {
    return { isUserTrainer: false, clients: [] };
  }

  const userData = userSnap.data();
  const isUserTrainer = userData.role === 'trainer';
  if (!isUserTrainer) {
    return { isUserTrainer: false, clients: [] };
  }

  const clients = await getTrainerClients(userId);
  return { isUserTrainer: true, clients };
}

async function ensureAssignedTrainerConversation(userId) {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return;

  const userData = userSnap.data();
  let assignedTrainerId = null;
  if (userData) {
    assignedTrainerId = userData.trainerId;
  }
  if (!assignedTrainerId) return;

  await getOrCreateConversation(userId, assignedTrainerId);
}

function buildClientPayloadFromUserData(fullUserData) {
  const clientName =
    fullUserData.name ||
    `${fullUserData.firstName || ''} ${fullUserData.lastName || ''}`.trim() ||
    fullUserData.displayName ||
    'Client';
  return {
    name: clientName,
    email: fullUserData.email || '',
    photoURL: fullUserData.photoURL || null,
    height: fullUserData.height || null,
    weight: fullUserData.weight || null,
    age: fullUserData.age || null,
    gender: fullUserData.gender || null,
    goals: fullUserData.primaryGoal || fullUserData.goals || '',
    fitnessLevel: fullUserData.fitnessLevel || null,
    equipmentAccess: fullUserData.equipmentAccess || [],
    daysPerWeek: fullUserData.daysPerWeek || null,
    injuries: fullUserData.injuries || null,
    phone: fullUserData.phone || null,
    bio: fullUserData.bio || null,
    role: fullUserData.role || 'client',
    createdAt: fullUserData.createdAt || null,
  };
}

async function markConversationReadAndClearBadge(
  conversationId,
  userId,
  unreadByConversationId,
  setUnreadByConversationId,
) {
  console.log('🔕 Marking messages as read for conversation:', conversationId);
  await markMessagesAsRead(conversationId, userId);
  console.log('✅ Messages marked as read, forcing unread count refresh');

  const clearedOnce = { ...unreadByConversationId };
  clearedOnce[conversationId] = 0;
  console.log('🔄 Immediately setting unread count to 0 for:', conversationId);
  setUnreadByConversationId(clearedOnce);

  // Manipulate here: UNREAD_COUNT_RECHECK_MS — second local clear after listener settle.
  setTimeout(() => {
    const clearedAgain = { ...unreadByConversationId };
    clearedAgain[conversationId] = 0;
    console.log('🔄 Double-checking unread count is 0 for:', conversationId);
    setUnreadByConversationId(clearedAgain);
  }, UNREAD_COUNT_RECHECK_MS);
}

function mergeConversationPages(previousList, pageConversations) {
  const byId = new Map();
  const existingList = previousList || [];
  for (let existingIndex = 0; existingIndex < existingList.length; existingIndex += 1) {
    const existing = existingList[existingIndex];
    byId.set(existing.id, existing);
  }
  for (const pageConversation of pageConversations) {
    byId.set(pageConversation.id, pageConversation);
  }
  return [...byId.values()];
}

const rowStyles = StyleSheet.create({
  unreadBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 7,
  },
  unreadText: { fontSize: 13, fontWeight: '900' },
  name: { fontSize: 16, fontWeight: '800', flex: 1 },
  timestamp: { fontSize: 12, fontWeight: '800', marginLeft: 8, flexShrink: 0 },
  preview: { fontSize: 14, marginTop: 2, lineHeight: 18 },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    minHeight: nb.minTouchTarget + 12,
  },
});

const screenStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', flex: 1 },
  searchField: {
    marginHorizontal: 16,
    marginBottom: 12,
    minHeight: 48,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbInput || 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '700',
  },
  sqBtn: {
    width: nb.minTouchTarget,
    height: nb.minTouchTarget,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: { marginHorizontal: 16, paddingVertical: 4, paddingHorizontal: 14 },
  loadMoreWrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: borderRadius.nbChip,
    borderWidth: nb.borderWidth,
    marginLeft: 8,
  },
  addBtnText: { fontSize: 12, fontWeight: '700' },
  clientBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  clientBadgeText: { color: '#22C55E', fontSize: 12, fontWeight: '700' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
  },
  emptyIconBox: {
    width: 76,
    height: 76,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  emptyCta: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 200,
    alignItems: 'center',
  },
  emptyCtaText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
