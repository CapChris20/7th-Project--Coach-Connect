// Past-chat sidebar: collapsed rail, docked panel, or overlay drawer.
// Flow: filter by search → group Today / This Week / Earlier → tap to open or swipe to delete.
// Used by CoachConversationScreen and CoachHomeScreen.

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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { AI_COACH_UI } from '../coachColors';
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

const BORDER_SUBTLE = ['rgba(157,23,77,0.42)', 'rgba(154,52,18,0.36)'];
// Manipulate here: phones narrower than this get the overlay drawer instead of an inline dock.
const NARROW_WINDOW_WIDTH = 768;
// Manipulate here: how long the drawer slides in, in milliseconds.
const DRAWER_SLIDE_MS = 260;
const DRAWER_ELEVATION = 24;

const TOKENS = {
  dark: {
    panelBg: '#0C0C14',
    border: AI_COACH_UI.borderHairline,
    textPrimary: '#FFFFFF',
    textMuted: 'rgba(255,255,255,0.45)',
    meta: 'rgba(255,255,255,0.42)',
    hover: 'rgba(255,255,255,0.06)',
    active: 'rgba(255,107,157,0.14)',
    activeBorder: 'rgba(255,107,157,0.35)',
    accent: AI_COACH_UI.pink,
    inputBg: 'rgba(255,255,255,0.06)',
    railBg: '#08080E',
  },
  light: {
    panelBg: '#F5F5F7',
    border: 'rgba(0,0,0,0.1)',
    textPrimary: '#0A0A0F',
    textMuted: 'rgba(0,0,0,0.4)',
    meta: 'rgba(10,10,15,0.45)',
    hover: 'rgba(0,0,0,0.04)',
    active: 'rgba(190,24,93,0.10)',
    activeBorder: 'rgba(190,24,93,0.28)',
    accent: '#BE185D',
    inputBg: 'rgba(0,0,0,0.04)',
    railBg: '#FFFFFF',
  },
};

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

function rowDividerColor(isDark) {
  if (isDark) return 'rgba(255,255,255,0.06)';
  return 'rgba(0,0,0,0.06)';
}

function SessionRowDivider({ isLast, isDark }) {
  if (isLast) return null;
  return <View style={[styles.rowDivider, { backgroundColor: rowDividerColor(isDark) }]} />;
}

// vocab: Swipeable = react-native-gesture-handler row that reveals a delete action under a swipe.
function SessionRow({
  session,
  isActive,
  isDark,
  panelColors,
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
      style={styles.deleteAction}
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
          isActive && { backgroundColor: panelColors.active, borderColor: panelColors.activeBorder, borderWidth: 1, borderRadius: 12 },
          pressed && !isActive && { backgroundColor: panelColors.hover },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: panelColors.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
            {formatSessionDisplayTitle(session.title)}
          </Text>
          <Text style={{ color: panelColors.meta, fontSize: 11, marginTop: 3 }}>{session.date}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onDelete?.(session)}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityLabel="Delete conversation"
        >
          <Ionicons name="trash-outline" size={15} color={panelColors.meta} style={{ opacity: 0.55 }} />
        </TouchableOpacity>
      </Pressable>
      <SessionRowDivider isLast={isLast} isDark={isDark} />
    </Swipeable>
  );
}

function EmptyHistory({ panelColors }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: panelColors.inputBg, borderColor: panelColors.border }]}>
      <Ionicons name="time-outline" size={24} color={panelColors.textMuted} style={{ marginBottom: 8 }} />
      <Text style={{ color: panelColors.textPrimary, fontSize: 15, fontWeight: '700' }}>No history yet</Text>
      <Text style={{ color: panelColors.meta, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
        Start a conversation — your chats will appear here.
      </Text>
    </View>
  );
}

function NoSearchMatches({ panelColors }) {
  return (
    <View style={[styles.emptyCard, { backgroundColor: panelColors.inputBg, borderColor: panelColors.border }]}>
      <Text style={{ color: panelColors.textPrimary, fontSize: 14, fontWeight: '600' }}>No matches</Text>
      <Text style={{ color: panelColors.meta, fontSize: 12, marginTop: 4 }}>Try a different search term.</Text>
    </View>
  );
}

function SessionGroups({
  sessions,
  filteredSessions,
  groups,
  activeSessionId,
  isDark,
  panelColors,
  onSessionPress,
  onDeleteSession,
}) {
  if (sessions.length === 0) return <EmptyHistory panelColors={panelColors} />;
  if (filteredSessions.length === 0) return <NoSearchMatches panelColors={panelColors} />;
  return groups.map((group) => (
    <View key={group.key} style={{ marginBottom: 16 }}>
      <Text style={[styles.groupLabel, { color: panelColors.textMuted }]}>{group.label}</Text>
      {group.items.map((session, rowIndex) => (
        <SessionRow
          key={session.id}
          session={session}
          isActive={(session.sessionId || session.id) === activeSessionId}
          isDark={isDark}
          panelColors={panelColors}
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
  isDark,
  panelColors,
  insets,
  showClose = true,
}) {
  const groups = groupSessionsForSidebar(filteredSessions);

  return (
    <View style={{ flex: 1 }}>
      <LinearGradient colors={BORDER_SUBTLE} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 2 }} />
      <View
        style={{
          paddingTop: (insets?.top || 0) + 10,
          paddingHorizontal: 14,
          paddingBottom: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: panelColors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
            AI Coach
          </Text>
          <Text style={{ color: panelColors.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 2 }}>Chat History</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            onPress={onNewChat}
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: panelColors.inputBg }]}
            accessibilityLabel="New conversation"
          >
            <Ionicons name="create-outline" size={18} color={panelColors.accent} />
          </TouchableOpacity>
          {showClose ? (
            <TouchableOpacity onPress={onClose} hitSlop={8} style={[styles.iconBtn, { backgroundColor: panelColors.inputBg }]}>
              <Ionicons name="close" size={18} color={panelColors.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 14, marginBottom: 10 }}>
        <View style={[styles.searchWrap, { backgroundColor: panelColors.inputBg, borderColor: panelColors.border }]}>
          <Ionicons name="search-outline" size={16} color={panelColors.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search conversations…"
            placeholderTextColor={panelColors.textMuted}
            style={[styles.searchInput, { color: panelColors.textPrimary }]}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={panelColors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 20 + (insets?.bottom || 0) }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SessionGroups
          sessions={sessions}
          filteredSessions={filteredSessions}
          groups={groups}
          activeSessionId={activeSessionId}
          isDark={isDark}
          panelColors={panelColors}
          onSessionPress={onSessionPress}
          onDeleteSession={onDeleteSession}
        />
      </ScrollView>
    </View>
  );
}

function panelColorsForTheme(isDark) {
  if (isDark) return TOKENS.dark;
  return TOKENS.light;
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

function CollapsedChatRail({ panelColors, insets, onToggleCollapse, onNewChat }) {
  return (
    <View
      style={[
        styles.rail,
        {
          width: COACH_SIDEBAR_RAIL,
          backgroundColor: panelColors.railBg,
          borderRightColor: panelColors.border,
          paddingTop: (insets?.top || 0) + 8,
        },
      ]}
    >
      <TouchableOpacity
        onPress={onToggleCollapse}
        style={[styles.railBtn, { backgroundColor: panelColors.inputBg }]}
        accessibilityLabel="Open chat history"
      >
        <Ionicons name="chatbubbles-outline" size={20} color={panelColors.accent} />
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onNewChat}
        style={[styles.railBtn, { backgroundColor: panelColors.inputBg, marginTop: 8 }]}
        accessibilityLabel="New conversation"
      >
        <Ionicons name="add-outline" size={22} color={panelColors.textMuted} />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        onPress={onToggleCollapse}
        style={styles.railBtn}
        accessibilityLabel="Expand sidebar"
      >
        <Ionicons name="chevron-forward" size={16} color={panelColors.textMuted} />
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
  panelColors,
  insets,
  panelProps,
  slideAnim,
}) {
  if (mode === 'docked' && collapsed) {
    return (
      <CollapsedChatRail
        panelColors={panelColors}
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
          backgroundColor: panelColors.panelBg,
          borderRightWidth: 1,
          borderRightColor: panelColors.border,
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
            backgroundColor: panelColors.panelBg,
            borderRightWidth: 1,
            borderRightColor: panelColors.border,
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
  const panelColors = panelColorsForTheme(isDark);
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
    isDark,
    panelColors,
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
      panelColors={panelColors}
      insets={insets}
      panelProps={panelProps}
      slideAnim={slideAnim}
    />
  );
}

const styles = StyleSheet.create({
  rail: {
    borderRightWidth: 1,
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingBottom: 12,
  },
  railBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    marginBottom: 6,
    paddingHorizontal: 6,
  },
  sessionRow: {
    paddingVertical: 11,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 10,
  },
  deleteBtn: { padding: 4 },
  deleteAction: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 76,
    marginVertical: 4,
    borderRadius: 12,
    marginRight: 4,
  },
  deleteLabel: { color: '#FFF', fontSize: 10, fontWeight: '700', marginTop: 2 },
  emptyCard: {
    marginTop: 28,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
});
