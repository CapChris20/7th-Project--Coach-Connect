// Design Law past-chats drawer: New chat, search, Today/Yesterday/Earlier, swipe to delete.
// Flow: filter by search → group → tap to open or swipe left to delete.
// Used by: CoachConversationScreen and CoachHomeScreen. PNG: screens/ai-coach/13–14.
// Read order: constants → search/drawer helpers → row/panel subcomponents → PastChatsPanel main → styles.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { lightColors, darkColors, spacing, borderRadius, nb } from '../../look-and-feel/colorPalette';
import NbButton from '../../look-and-feel/NbButton';
import NbEmptyState from '../../look-and-feel/NbEmptyState';
import HardShadow from '../../look-and-feel/HardShadow';
import {
  formatSessionDisplayTitle,
  groupSessionsForSidebar,
} from './chatHistoryList';

// ===== NAMED CONSTANTS =====

const WINDOW_WIDTH = Dimensions.get('window').width;
// Manipulate here: 300 is the max drawer width; 0.82 is how much of a phone screen it may use.
const SIDEBAR_MAX_WIDTH = 300;
const SIDEBAR_WIDTH_FRACTION = 0.82;
export const COACH_SIDEBAR_WIDTH = Math.min(SIDEBAR_MAX_WIDTH, WINDOW_WIDTH * SIDEBAR_WIDTH_FRACTION);
// Manipulate here: collapsed rail width when the docked sidebar is shut.
export const COACH_SIDEBAR_RAIL = 52;

// Manipulate here: phones narrower than this get the overlay drawer instead of an inline dock.
const NARROW_WINDOW_WIDTH = 768;
// Manipulate here: how long the drawer slides in, in milliseconds.
const DRAWER_SLIDE_MS = 260;
const DRAWER_ELEVATION = 24;
// Manipulate here: scrim behind overlay drawer — 0.50 is how dark the main screen gets.
const OVERLAY_SCRIM_COLOR = 'rgba(0,0,0,0.50)';
// Manipulate here: how faded a pressed session row looks (1 = full, lower = more dim).
const SESSION_ROW_PRESSED_OPACITY = 0.88;
const SESSION_ROW_IDLE_OPACITY = 1;
const CLOSE_ICON_SHADOW_OFFSET = 3;
const CLOSE_ICON_ELEVATION = 3;
const GROUP_BOTTOM_GAP_EXTRA = 4;
const HEADER_TOP_PAD_EXTRA = 10;
const RAIL_TOP_PAD_EXTRA = 8;
const SEARCH_BOTTOM_GAP_EXTRA = 2;
const GROUP_LABEL_SIDE_PAD_EXTRA = 2;
const SESSION_TITLE_FONT_SIZE = 15;
const SESSION_COUNT_FONT_SIZE = 13;
const SESSION_COUNT_TOP_GAP = 3;
const PAST_CHATS_TITLE_SIZE = 22;
const PAST_CHATS_TITLE_LETTER_SPACING = -0.4;
const SWIPE_HINT_FONT_SIZE = 13;
const EMPTY_ICON_SIZE = 28;
const SEARCH_ICON_SIZE = 16;
const CLOSE_ICON_SIZE = 20;
const RAIL_CHAT_ICON_SIZE = 20;
const RAIL_ADD_ICON_SIZE = 22;
const RAIL_CHEVRON_SIZE = 16;
const MODE_OVERLAY = 'overlay';
const MODE_DOCKED = 'docked';

// ===== HELPER FUNCTIONS =====

function buildSearchableHaystack(session) {
  const titlePart = session.title || '';
  const lastUserPart = session.lastUserMessage || '';
  const lastAssistantPart = session.lastAssistantMessage || '';
  const datePart = session.date || '';
  const parts = [titlePart, lastUserPart, lastAssistantPart, datePart];
  const nonEmptyParts = [];
  for (let index = 0; index < parts.length; index += 1) {
    if (parts[index]) nonEmptyParts.push(parts[index]);
  }
  return nonEmptyParts.join(' ').toLowerCase();
}

function sessionsMatchingSearch(sessions, searchQuery) {
  const searchNeedle = searchQuery.trim().toLowerCase();
  if (!searchNeedle) return sessions;

  const matches = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    const haystack = buildSearchableHaystack(session);
    if (haystack.includes(searchNeedle)) matches.push(session);
  }
  return matches;
}

function overlayIsOpen(mode, open, collapsed, isNarrow) {
  if (mode === MODE_OVERLAY) return open;
  return mode === MODE_DOCKED && !collapsed && isNarrow;
}

function drawerSlideTarget(open, mode, collapsed) {
  const drawerOpen = open || (mode === MODE_DOCKED && !collapsed);
  if (drawerOpen) return 0;
  return -COACH_SIDEBAR_WIDTH;
}

function drawerContentVisible(mode, open, collapsed) {
  if (mode === MODE_OVERLAY) return open;
  return !collapsed;
}

function drawerShadowStyle(colors) {
  // Hard nb shadow — no soft blur, no purple glow (docs/design/DESIGN.md).
  if (Platform.OS === 'ios') {
    return {
      shadowColor: colors.nbShadow,
      shadowOpacity: 1,
      shadowRadius: 0,
      shadowOffset: { width: nb.shadowOffset, height: 0 },
    };
  }
  return { elevation: DRAWER_ELEVATION };
}

function messageCountFromSession(session) {
  if (!session) return 0;
  if (session.messageCount == null) return 0;
  return Number(session.messageCount);
}

function sessionRowCountLabel(session) {
  const messageCount = messageCountFromSession(session);
  const hasPositiveCount = Number.isFinite(messageCount) && messageCount > 0;
  if (!hasPositiveCount) {
    if (session && session.date) return session.date;
    return '';
  }

  if (messageCount === 1) return '1 message';
  return `${messageCount} messages`;
}

function closeIconButtonStyle(colors) {
  return {
    backgroundColor: colors.nbSurface,
    borderColor: colors.nbBorder,
    borderWidth: nb.borderWidth,
    shadowColor: colors.nbShadow,
    shadowOffset: { width: CLOSE_ICON_SHADOW_OFFSET, height: CLOSE_ICON_SHADOW_OFFSET },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: CLOSE_ICON_ELEVATION,
  };
}

function sessionKeyForRow(session) {
  return session.sessionId || session.id;
}

function themeColorsForPanel(isDark) {
  if (isDark) return darkColors;
  return lightColors;
}

function windowIsNarrow() {
  return WINDOW_WIDTH < NARROW_WINDOW_WIDTH;
}

function shouldShowExpandedInline(mode, collapsed, isNarrowWindow) {
  return mode === MODE_DOCKED && !collapsed && !isNarrowWindow;
}

// vocab: Swipeable = react-native-gesture-handler row that reveals a delete action under a swipe.
function SessionRow({
  session,
  isActive,
  colors,
  onPress,
  onDelete,
  isLast,
}) {
  const swipeRef = useRef(null);
  const countLabel = sessionRowCountLabel(session);
  const rowTitle = formatSessionDisplayTitle(session.title);
  const rowBackground = isActive ? colors.nbSoft : colors.nbSurface;
  const bottomBorderWidth = isLast ? 0 : 2;

  const handleSwipeDelete = () => {
    if (swipeRef.current && typeof swipeRef.current.close === 'function') {
      swipeRef.current.close();
    }
    if (typeof onDelete === 'function') {
      onDelete(session);
    }
  };

  const renderRightActions = () => (
    <TouchableOpacity
      onPress={handleSwipeDelete}
      activeOpacity={0.85}
      style={[styles.deleteAction, { backgroundColor: colors.nbFill }]}
    >
      <Text style={[styles.deleteLabel, { color: colors.nbOnFill }]}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => {
          const rowOpacity = pressed ? SESSION_ROW_PRESSED_OPACITY : SESSION_ROW_IDLE_OPACITY;
          return [
            styles.sessionRow,
            {
              backgroundColor: rowBackground,
              borderBottomColor: colors.nbBorder,
              borderBottomWidth: bottomBorderWidth,
              opacity: rowOpacity,
            },
          ];
        }}
      >
        <View style={styles.sessionRowTextWrap}>
          <Text
            style={{
              color: colors.nbInk,
              fontSize: SESSION_TITLE_FONT_SIZE,
              fontWeight: '800',
            }}
            numberOfLines={2}
          >
            {rowTitle}
          </Text>
          <Text
            style={{
              color: colors.nbMuted,
              fontSize: SESSION_COUNT_FONT_SIZE,
              fontWeight: '500',
              marginTop: SESSION_COUNT_TOP_GAP,
            }}
          >
            {countLabel}
          </Text>
        </View>
      </Pressable>
    </Swipeable>
  );
}

function EmptyHistory({ colors }) {
  return (
    <NbEmptyState
      title="No history yet"
      subtitle="Start a conversation — your chats will appear here."
      iconChildren={<Ionicons name="time-outline" size={EMPTY_ICON_SIZE} color={colors.nbInk} />}
      iconIndex={2}
    />
  );
}

function NoSearchMatches({ colors }) {
  return (
    <NbEmptyState
      title="No matches"
      subtitle="Try a different search term."
      iconChildren={<Ionicons name="search-outline" size={EMPTY_ICON_SIZE} color={colors.nbInk} />}
      iconIndex={4}
    />
  );
}

function SessionGroupBlock({
  group,
  activeSessionId,
  colors,
  onSessionPress,
  onDeleteSession,
}) {
  const groupBottomMargin = spacing.md + GROUP_BOTTOM_GAP_EXTRA;
  const rowNodes = [];

  for (let rowIndex = 0; rowIndex < group.items.length; rowIndex += 1) {
    const session = group.items[rowIndex];
    const sessionKey = sessionKeyForRow(session);
    const isActive = sessionKey === activeSessionId;
    const isLastRow = rowIndex === group.items.length - 1;

    rowNodes.push(
      <SessionRow
        key={session.id}
        session={session}
        isActive={isActive}
        colors={colors}
        onPress={() => {
          if (typeof onSessionPress === 'function') onSessionPress(session);
        }}
        onDelete={onDeleteSession}
        isLast={isLastRow}
      />,
    );
  }

  return (
    <View key={group.key} style={{ marginBottom: groupBottomMargin }}>
      <Text
        style={[
          styles.groupLabel,
          {
            color: colors.nbMuted,
            fontFamily: 'SpaceGrotesk_700Bold',
          },
        ]}
      >
        {group.label}
      </Text>
      {rowNodes}
    </View>
  );
}

function SessionGroups({
  sessions,
  filteredSessions,
  activeSessionId,
  colors,
  onSessionPress,
  onDeleteSession,
}) {
  if (sessions.length === 0) return <EmptyHistory colors={colors} />;
  if (filteredSessions.length === 0) return <NoSearchMatches colors={colors} />;

  const groups = groupSessionsForSidebar(filteredSessions);
  const groupNodes = [];

  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    groupNodes.push(
      <SessionGroupBlock
        key={group.key}
        group={group}
        activeSessionId={activeSessionId}
        colors={colors}
        onSessionPress={onSessionPress}
        onDeleteSession={onDeleteSession}
      />,
    );
  }

  return groupNodes;
}

function insetTopPadding(insets) {
  if (insets && insets.top) return insets.top;
  return 0;
}

function insetBottomPadding(insets) {
  if (insets && insets.bottom) return insets.bottom;
  return 0;
}

function PastChatsHeader({ colors, insets, showClose, onClose }) {
  const headerPaddingTop = insetTopPadding(insets) + HEADER_TOP_PAD_EXTRA;

  let closeButton = null;
  if (showClose) {
    closeButton = (
      <TouchableOpacity
        onPress={onClose}
        hitSlop={8}
        style={[styles.iconBtn, closeIconButtonStyle(colors)]}
        accessibilityLabel="Close past chats"
      >
        <Ionicons name="close" size={CLOSE_ICON_SIZE} color={colors.nbInk} />
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={{
        paddingTop: headerPaddingTop,
        paddingHorizontal: spacing.md,
        paddingBottom: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text
        style={{
          color: colors.nbInk,
          fontSize: PAST_CHATS_TITLE_SIZE,
          fontWeight: '900',
          letterSpacing: PAST_CHATS_TITLE_LETTER_SPACING,
          flex: 1,
        }}
      >
        Past chats
      </Text>
      {closeButton}
    </View>
  );
}

function PastChatsSearchBox({ colors, searchQuery, onSearchChange }) {
  const handleClearSearch = () => {
    onSearchChange('');
  };

  const showClearButton = Boolean(searchQuery);
  let clearButton = null;
  if (showClearButton) {
    clearButton = (
      <TouchableOpacity onPress={handleClearSearch} hitSlop={8}>
        <Ionicons name="close-circle" size={SEARCH_ICON_SIZE} color={colors.nbMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm + SEARCH_BOTTOM_GAP_EXTRA }}>
      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbInput}>
        <View
          style={[
            styles.searchWrap,
            {
              borderColor: colors.nbBorder,
              backgroundColor: colors.nbSurface,
              borderWidth: nb.borderWidth,
            },
          ]}
        >
          <Ionicons name="search-outline" size={SEARCH_ICON_SIZE} color={colors.nbMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search your chats"
            placeholderTextColor={colors.nbMuted}
            style={[styles.searchInput, { color: colors.nbInk }]}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {clearButton}
        </View>
      </HardShadow>
    </View>
  );
}

function SidebarPanel({
  sessions,
  filteredSessions,
  activeSessionId,
  searchQuery,
  onSearchChange,
  onSessionPress,
  onDeleteSession,
  onNewChat,
  onClose,
  colors,
  insets,
  showClose = true,
}) {
  const scrollBottomPadding = spacing.lg + insetBottomPadding(insets);

  return (
    <View style={{ flex: 1 }}>
      <PastChatsHeader colors={colors} insets={insets} showClose={showClose} onClose={onClose} />

      <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
        <NbButton variant="fill" onPress={onNewChat} style={{ width: '100%' }}>
          + New chat
        </NbButton>
      </View>

      <PastChatsSearchBox
        colors={colors}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.md,
          paddingBottom: scrollBottomPadding,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SessionGroups
          sessions={sessions}
          filteredSessions={filteredSessions}
          activeSessionId={activeSessionId}
          colors={colors}
          onSessionPress={onSessionPress}
          onDeleteSession={onDeleteSession}
        />
        <Text
          style={{
            marginTop: spacing.lg,
            textAlign: 'center',
            color: colors.nbMuted,
            fontSize: SWIPE_HINT_FONT_SIZE,
            fontWeight: '500',
          }}
        >
          Swipe a chat left to delete it.
        </Text>
      </ScrollView>
    </View>
  );
}

function CollapsedChatRail({ colors, insets, onToggleCollapse, onNewChat }) {
  const railPaddingTop = insetTopPadding(insets) + RAIL_TOP_PAD_EXTRA;

  return (
    <View
      style={[
        styles.rail,
        {
          width: COACH_SIDEBAR_RAIL,
          backgroundColor: colors.nbBackground,
          borderRightColor: colors.nbBorder,
          borderRightWidth: nb.borderWidth,
          paddingTop: railPaddingTop,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onToggleCollapse}
        style={[
          styles.railBtn,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
            borderWidth: nb.borderWidth,
          },
        ]}
        accessibilityLabel="Open chat history"
      >
        <Ionicons name="chatbubbles-outline" size={RAIL_CHAT_ICON_SIZE} color={colors.nbInk} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onNewChat}
        style={[
          styles.railBtn,
          {
            backgroundColor: colors.nbSurface,
            borderColor: colors.nbBorder,
            borderWidth: nb.borderWidth,
            marginTop: spacing.sm,
          },
        ]}
        accessibilityLabel="New conversation"
      >
        <Ionicons name="add-outline" size={RAIL_ADD_ICON_SIZE} color={colors.nbInk} />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity onPress={onToggleCollapse} style={styles.railBtn} accessibilityLabel="Expand sidebar">
        <Ionicons name="chevron-forward" size={RAIL_CHEVRON_SIZE} color={colors.nbMuted} />
      </TouchableOpacity>
    </View>
  );
}

function DockedExpandedSidebar({ colors, panelProps, onToggleCollapse }) {
  return (
    <View
      style={{
        width: COACH_SIDEBAR_WIDTH,
        backgroundColor: colors.nbBackground,
        borderRightWidth: nb.borderWidth,
        borderRightColor: colors.nbBorder,
      }}
    >
      <SidebarPanel {...panelProps} showClose={false} onClose={onToggleCollapse} />
    </View>
  );
}

function OverlayPastChatsDrawer({
  colors,
  panelProps,
  slideAnim,
  closeDrawer,
}) {
  const drawerShadow = drawerShadowStyle(colors);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, { backgroundColor: OVERLAY_SCRIM_COLOR }]}
          activeOpacity={1}
          onPress={closeDrawer}
          accessibilityLabel="Close chat history"
        />
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: COACH_SIDEBAR_WIDTH,
            transform: [{ translateX: slideAnim }],
            backgroundColor: colors.nbBackground,
            borderRightWidth: nb.borderWidth,
            borderRightColor: colors.nbBorder,
            zIndex: 2,
            ...drawerShadow,
          }}
        >
          <SidebarPanel {...panelProps} />
        </Animated.View>
      </View>
    </Modal>
  );
}

function PastChatsPanelLayout({
  mode,
  collapsed,
  showExpandedInline,
  showOverlay,
  open,
  onToggleCollapse,
  onClose,
  colors,
  insets,
  panelProps,
  slideAnim,
}) {
  // Docked + collapsed → thin rail with open / new-chat shortcuts.
  if (mode === MODE_DOCKED && collapsed) {
    return (
      <CollapsedChatRail
        colors={colors}
        insets={insets}
        onToggleCollapse={onToggleCollapse}
        onNewChat={panelProps.onNewChat}
      />
    );
  }

  // Wide docked window → inline sidebar (no modal).
  if (showExpandedInline) {
    return (
      <DockedExpandedSidebar
        colors={colors}
        panelProps={panelProps}
        onToggleCollapse={onToggleCollapse}
      />
    );
  }

  // Overlay only when the drawer should be visible.
  if (!showOverlay) return null;
  if (!drawerContentVisible(mode, open, collapsed)) return null;

  const closeDrawer = onClose || onToggleCollapse;

  return (
    <OverlayPastChatsDrawer
      colors={colors}
      panelProps={panelProps}
      slideAnim={slideAnim}
      closeDrawer={closeDrawer}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Collapsible chat history — docked rail, inline panel, or overlay drawer.
 * Hooks stay in this order: search box, slide animation, filtered list, then the slide effect.
 * @param {{ mode?: string, open?: boolean, collapsed?: boolean, onToggleCollapse?: Function, onClose?: Function, sessions?: Array, activeSessionId?: string, onSessionPress?: Function, onDeleteSession?: Function, onNewChat?: Function, isDark?: boolean, insets?: object }} props
 */
export default function PastChatsPanel({
  mode = MODE_OVERLAY,
  open = false,
  collapsed = true,
  onToggleCollapse,
  onClose,
  sessions = [],
  activeSessionId,
  onSessionPress,
  onDeleteSession,
  onNewChat,
  isDark = true,
  insets,
}) {
  // Prefer the parent isDark prop so coach chrome matches ThemeProvider (not only OS scheme).
  const colors = themeColorsForPanel(isDark);

  // Hook order frozen: search → slide ref → filtered memo → slide effect.
  const [searchQuery, setSearchQuery] = useState('');
  const slideAnim = useRef(new Animated.Value(-COACH_SIDEBAR_WIDTH)).current;

  // 1. Decide which chrome to show: collapsed rail, inline dock, or overlay drawer.
  const isNarrowWindow = windowIsNarrow();
  const showExpandedInline = shouldShowExpandedInline(mode, collapsed, isNarrowWindow);
  const showOverlay = overlayIsOpen(mode, open, collapsed, isNarrowWindow);

  // 2. Filter the live session list by the search box.
  const filteredSessions = useMemo(
    () => sessionsMatchingSearch(sessions, searchQuery),
    [sessions, searchQuery],
  );

  // 3. When the overlay is up, slide the drawer to open (0) or closed (−width).
  // vocab: useNativeDriver = slide runs on the native thread so JS stays responsive.
  // vocab: Animated.timing = animate a value over DRAWER_SLIDE_MS milliseconds.
  useEffect(() => {
    if (!showOverlay) return;
    Animated.timing(slideAnim, {
      toValue: drawerSlideTarget(open, mode, collapsed),
      duration: DRAWER_SLIDE_MS,
      useNativeDriver: true,
    }).start();
  }, [showOverlay, open, collapsed, mode, slideAnim]);

  // 4. Bundle props the shared SidebarPanel needs in every layout branch.
  const panelProps = {
    sessions,
    filteredSessions,
    activeSessionId,
    searchQuery,
    onSearchChange: setSearchQuery,
    onSessionPress,
    onDeleteSession,
    onNewChat,
    onClose: onClose || onToggleCollapse,
    colors,
    insets,
  };

  // 5. Hand layout + chrome choice to the pure layout helper (no hooks there).
  return (
    <PastChatsPanelLayout
      mode={mode}
      collapsed={collapsed}
      showExpandedInline={showExpandedInline}
      showOverlay={showOverlay}
      open={open}
      onToggleCollapse={onToggleCollapse}
      onClose={onClose}
      colors={colors}
      insets={insets}
      panelProps={panelProps}
      slideAnim={slideAnim}
    />
  );
}

const styles = StyleSheet.create({
  rail: {
    alignItems: 'center',
    paddingHorizontal: spacing.xs + 2,
    paddingBottom: spacing.md,
  },
  railBtn: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.nbCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.nbInput,
    paddingHorizontal: spacing.sm + 2,
    minHeight: 48,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    paddingVertical: 0,
  },
  groupLabel: {
    fontSize: 10,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: spacing.xs + GROUP_LABEL_SIDE_PAD_EXTRA,
    paddingHorizontal: spacing.xs + GROUP_LABEL_SIDE_PAD_EXTRA,
  },
  sessionRow: {
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sessionRowTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.sm + 2,
  },
  deleteBtn: { padding: 4 },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    marginVertical: 0,
  },
  deleteLabel: {
    fontSize: 13,
    fontWeight: '900',
  },
  emptyCard: {
    marginTop: spacing.lg + 4,
    padding: spacing.md + 2,
    borderRadius: borderRadius.nbCard,
    alignItems: 'center',
  },
});
