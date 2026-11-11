// Past-chat sidebar (neobrutalist design): collapsed rail, docked panel, or overlay drawer.
// Flow: filter by search → group Today / This Week / Earlier → tap to open or swipe to delete.
// Used by: CoachConversationScreen and CoachHomeScreen.
//
// vocab: NbCard = neobrutalist card for list rows
// vocab: NbListRow = neobrutalist list row with title, subtitle, and accessory
// vocab: neobrutalist = thick borders, hard shadows, no blur

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
import { useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { lightColors, darkColors, spacing, borderRadius, nb } from '../../look-and-feel/colorPalette';
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

// ===== HELPER FUNCTIONS =====

function sessionsMatchingSearch(sessions, searchQuery) {
  const searchNeedle = searchQuery.trim().toLowerCase();
  if (!searchNeedle) return sessions;
  const matches = [];
  for (const session of sessions) {
    const hay = [session.title, session.lastUserMessage, session.lastAssistantMessage, session.date]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (hay.includes(searchNeedle)) matches.push(session);
  }
  return matches;
}

function SessionRowDivider({ isLast, colors }) {
  if (isLast) return null;
  return <View style={[styles.rowDivider, { backgroundColor: colors.nbBorder, opacity: 0.2 }]} />;
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

  const renderRightActions = () => (
    <TouchableOpacity
      onPress={() => {
        swipeRef.current?.close();
        onDelete?.(session);
      }}
      activeOpacity={0.85}
      style={[styles.deleteAction, { backgroundColor: colors.error || '#DC2626' }]}
    >
      <Ionicons name="trash-outline" size={18} color="#FFFFFF" />
      <Text style={styles.deleteLabel}>Delete</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.sessionRow,
          {
            backgroundColor: isActive ? 'rgba(255, 107, 157, 0.1)' : colors.nbSurface,
            borderColor: isActive ? '#FF6B9D' : colors.nbBorder,
            borderWidth: nb.borderWidth,
            borderRadius: borderRadius.nbCard,
            marginBottom: spacing.xs,
          },
          pressed && !isActive && { opacity: 0.85 },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{
              color: colors.nbInk,
              fontSize: 14,
              fontFamily: 'SpaceGrotesk_700Bold',
            }}
            numberOfLines={2}
          >
            {formatSessionDisplayTitle(session.title)}
          </Text>
          <Text
            style={{
              color: colors.nbMuted,
              fontSize: 11,
              fontFamily: 'Inter_400Regular',
              marginTop: 3,
            }}
          >
            {session.date}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => onDelete?.(session)}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityLabel="Delete conversation"
        >
          <Ionicons name="trash-outline" size={15} color={colors.nbMuted} />
        </TouchableOpacity>
      </Pressable>
      <SessionRowDivider isLast={isLast} colors={colors} />
    </Swipeable>
  );
}

function EmptyHistory({ colors }) {
  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
          borderWidth: nb.borderWidth,
        },
      ]}
    >
      <Ionicons name="time-outline" size={24} color={colors.nbMuted} style={{ marginBottom: 8 }} />
      <Text style={{ color: colors.nbInk, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>
        No history yet
      </Text>
      <Text
        style={{
          color: colors.nbMuted,
          fontSize: 13,
          fontFamily: 'Inter_400Regular',
          marginTop: 6,
          lineHeight: 18,
        }}
      >
        Start a conversation — your chats will appear here.
      </Text>
    </View>
  );
}

function NoSearchMatches({ colors }) {
  return (
    <View
      style={[
        styles.emptyCard,
        {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
          borderWidth: nb.borderWidth,
        },
      ]}
    >
      <Text style={{ color: colors.nbInk, fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold' }}>No matches</Text>
      <Text
        style={{
          color: colors.nbMuted,
          fontSize: 12,
          fontFamily: 'Inter_400Regular',
          marginTop: 4,
        }}
      >
        Try a different search term.
      </Text>
    </View>
  );
}

function SessionGroups({
  sessions,
  filteredSessions,
  groups,
  activeSessionId,
  colors,
  onSessionPress,
  onDeleteSession,
}) {
  if (sessions.length === 0) return <EmptyHistory colors={colors} />;
  if (filteredSessions.length === 0) return <NoSearchMatches colors={colors} />;
  return groups.map((group) => (
    <View key={group.key} style={{ marginBottom: spacing.md + 4 }}>
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
      {group.items.map((session, rowIndex) => (
        <SessionRow
          key={session.id}
          session={session}
          isActive={(session.sessionId || session.id) === activeSessionId}
          colors={colors}
          onPress={() => onSessionPress?.(session)}
          onDelete={onDeleteSession}
          isLast={rowIndex === group.items.length - 1}
        />
      ))}
    </View>
  ));
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
  const groups = groupSessionsForSidebar(filteredSessions);

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          paddingTop: (insets?.top || 0) + 10,
          paddingHorizontal: spacing.md,
          paddingBottom: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottomWidth: nb.borderWidth,
          borderBottomColor: colors.nbBorder,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={{
              color: colors.nbMuted,
              fontSize: 10,
              fontFamily: 'SpaceGrotesk_700Bold',
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            AI Coach
          </Text>
          <Text
            style={{
              color: colors.nbInk,
              fontSize: 18,
              fontFamily: 'SpaceGrotesk_700Bold',
              marginTop: 2,
            }}
          >
            Chat History
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.xs + 2 }}>
          <TouchableOpacity
            onPress={onNewChat}
            hitSlop={8}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.nbSurface,
                borderColor: colors.nbBorder,
                borderWidth: nb.borderWidth,
              },
            ]}
            accessibilityLabel="New conversation"
          >
            <Ionicons name="create-outline" size={18} color="#FF6B9D" />
          </TouchableOpacity>
          {showClose ? (
            <TouchableOpacity
              onPress={onClose}
              hitSlop={8}
              style={[
                styles.iconBtn,
                {
                  backgroundColor: colors.nbSurface,
                  borderColor: colors.nbBorder,
                  borderWidth: nb.borderWidth,
                },
              ]}
            >
              <Ionicons name="close" size={18} color={colors.nbInk} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: spacing.md, marginTop: spacing.md, marginBottom: spacing.sm + 2 }}>
        <View
          style={[
            styles.searchWrap,
            {
              backgroundColor: colors.nbSurface,
              borderColor: colors.nbBorder,
              borderWidth: nb.borderWidth,
            },
          ]}
        >
          <Ionicons name="search-outline" size={16} color={colors.nbMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search conversations…"
            placeholderTextColor={colors.nbMuted}
            style={[styles.searchInput, { color: colors.nbInk }]}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.nbMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: spacing.sm + 2,
          paddingBottom: spacing.lg + (insets?.bottom || 0),
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SessionGroups
          sessions={sessions}
          filteredSessions={filteredSessions}
          groups={groups}
          activeSessionId={activeSessionId}
          colors={colors}
          onSessionPress={onSessionPress}
          onDeleteSession={onDeleteSession}
        />
      </ScrollView>
    </View>
  );
}


function overlayIsOpen(mode, open, collapsed, isNarrow) {
  if (mode === 'overlay') return open;
  return mode === 'docked' && !collapsed && isNarrow;
}

function drawerSlideTarget(open, mode, collapsed) {
  const drawerOpen = open || (mode === 'docked' && !collapsed);
  if (drawerOpen) return 0;
  return -COACH_SIDEBAR_WIDTH;
}

function drawerContentVisible(mode, open, collapsed) {
  if (mode === 'overlay') return open;
  return !collapsed;
}

function drawerShadowStyle() {
  if (Platform.OS === 'ios') {
    return { shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 4, height: 0 } };
  }
  return { elevation: DRAWER_ELEVATION };
}

function CollapsedChatRail({ colors, insets, onToggleCollapse, onNewChat }) {
  return (
    <View
      style={[
        styles.rail,
        {
          width: COACH_SIDEBAR_RAIL,
          backgroundColor: colors.nbBackground,
          borderRightColor: colors.nbBorder,
          borderRightWidth: nb.borderWidth,
          paddingTop: (insets?.top || 0) + 8,
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
        <Ionicons name="chatbubbles-outline" size={20} color="#FF6B9D" />
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
        <Ionicons name="add-outline" size={22} color={colors.nbInk} />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        onPress={onToggleCollapse}
        style={styles.railBtn}
        accessibilityLabel="Expand sidebar"
      >
        <Ionicons name="chevron-forward" size={16} color={colors.nbMuted} />
      </TouchableOpacity>
    </View>
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
  if (mode === 'docked' && collapsed) {
    return (
      <CollapsedChatRail
        colors={colors}
        insets={insets}
        onToggleCollapse={onToggleCollapse}
        onNewChat={panelProps.onNewChat}
      />
    );
  }

  if (showExpandedInline) {
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

  if (!showOverlay) return null;
  if (!drawerContentVisible(mode, open, collapsed)) return null;

  const closeDrawer = onClose || onToggleCollapse;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeDrawer}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.58)' }]}
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
            ...drawerShadowStyle(),
          }}
        >
          <SidebarPanel {...panelProps} />
        </Animated.View>
      </View>
    </Modal>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Collapsible chat history — docked rail, inline panel, or overlay drawer.
 * Hooks stay in this order: search box, slide animation, filtered list, then the slide effect.
 * @param {{ mode?: string, open?: boolean, collapsed?: boolean, onToggleCollapse?: Function, onClose?: Function, sessions?: Array, activeSessionId?: string, onSessionPress?: Function, onDeleteSession?: Function, onNewChat?: Function, isDark?: boolean, insets?: object }} props
 */
export default function PastChatsPanel({
  mode = 'overlay',
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
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const [searchQuery, setSearchQuery] = useState('');
  const slideAnim = useRef(new Animated.Value(-COACH_SIDEBAR_WIDTH)).current;
  const isNarrow = WINDOW_WIDTH < NARROW_WINDOW_WIDTH;
  const showExpandedInline = mode === 'docked' && !collapsed && !isNarrow;
  const showOverlay = overlayIsOpen(mode, open, collapsed, isNarrow);

  const filteredSessions = useMemo(
    () => sessionsMatchingSearch(sessions, searchQuery),
    [sessions, searchQuery],
  );

  useEffect(() => {
    if (!showOverlay) return;
    Animated.timing(slideAnim, {
      toValue: drawerSlideTarget(open, mode, collapsed),
      duration: DRAWER_SLIDE_MS,
      useNativeDriver: true,
    }).start();
  }, [showOverlay, open, collapsed, mode, slideAnim]);

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
    width: 34,
    height: 34,
    borderRadius: borderRadius.nbCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.nbCard,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
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
    marginBottom: spacing.xs + 2,
    paddingHorizontal: spacing.xs + 2,
  },
  sessionRow: {
    paddingVertical: spacing.sm + 3,
    paddingHorizontal: spacing.sm + 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: spacing.sm + 2,
  },
  deleteBtn: { padding: 4 },
  deleteAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    marginVertical: 4,
    borderRadius: borderRadius.nbCard,
    marginRight: 4,
  },
  deleteLabel: {
    color: '#FFF',
    fontSize: 10,
    fontFamily: 'SpaceGrotesk_700Bold',
    marginTop: 2,
  },
  emptyCard: {
    marginTop: spacing.lg + 4,
    padding: spacing.md + 2,
    borderRadius: borderRadius.nbCard,
    alignItems: 'center',
  },
});
