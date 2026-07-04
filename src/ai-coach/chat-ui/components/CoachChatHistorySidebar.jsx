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
import { AI_COACH_UI } from '../aiCoachUiTokens';
import {
  formatSessionDisplayTitle,
  groupSessionsForSidebar,
} from '../hooks/useCoachChatSessions';

const { width: SW } = Dimensions.get('window');
export const COACH_SIDEBAR_WIDTH = Math.min(300, SW * 0.82);
export const COACH_SIDEBAR_RAIL = 52;

const BORDER_SUBTLE = ['rgba(157,23,77,0.42)', 'rgba(154,52,18,0.36)'];

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

function SessionRow({
  session,
  isActive,
  isDark,
  t,
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
          isActive && { backgroundColor: t.active, borderColor: t.activeBorder, borderWidth: 1, borderRadius: 12 },
          pressed && !isActive && { backgroundColor: t.hover },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: '600' }} numberOfLines={2}>
            {formatSessionDisplayTitle(session.title)}
          </Text>
          <Text style={{ color: t.meta, fontSize: 11, marginTop: 3 }}>{session.date}</Text>
        </View>
        <TouchableOpacity
          onPress={() => onDelete?.(session)}
          hitSlop={8}
          style={styles.deleteBtn}
          accessibilityLabel="Delete conversation"
        >
          <Ionicons name="trash-outline" size={15} color={t.meta} style={{ opacity: 0.55 }} />
        </TouchableOpacity>
      </Pressable>
      {!isLast ? <View style={[styles.rowDivider, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }]} /> : null}
    </Swipeable>
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
  isDark,
  t,
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
          <Text style={{ color: t.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
            AI Coach
          </Text>
          <Text style={{ color: t.textPrimary, fontSize: 18, fontWeight: '800', marginTop: 2 }}>Chat History</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            onPress={onNewChat}
            hitSlop={8}
            style={[styles.iconBtn, { backgroundColor: t.inputBg }]}
            accessibilityLabel="New conversation"
          >
            <Ionicons name="create-outline" size={18} color={t.accent} />
          </TouchableOpacity>
          {showClose ? (
            <TouchableOpacity onPress={onClose} hitSlop={8} style={[styles.iconBtn, { backgroundColor: t.inputBg }]}>
              <Ionicons name="close" size={18} color={t.textPrimary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={{ paddingHorizontal: 14, marginBottom: 10 }}>
        <View style={[styles.searchWrap, { backgroundColor: t.inputBg, borderColor: t.border }]}>
          <Ionicons name="search-outline" size={16} color={t.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={onSearchChange}
            placeholder="Search conversations…"
            placeholderTextColor={t.textMuted}
            style={[styles.searchInput, { color: t.textPrimary }]}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => onSearchChange('')} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={t.textMuted} />
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
        {sessions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: t.inputBg, borderColor: t.border }]}>
            <Ionicons name="time-outline" size={24} color={t.textMuted} style={{ marginBottom: 8 }} />
            <Text style={{ color: t.textPrimary, fontSize: 15, fontWeight: '700' }}>No history yet</Text>
            <Text style={{ color: t.meta, fontSize: 13, marginTop: 6, lineHeight: 18 }}>
              Start a conversation — your chats will appear here.
            </Text>
          </View>
        ) : filteredSessions.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: t.inputBg, borderColor: t.border }]}>
            <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: '600' }}>No matches</Text>
            <Text style={{ color: t.meta, fontSize: 12, marginTop: 4 }}>Try a different search term.</Text>
          </View>
        ) : (
          groups.map((group) => (
            <View key={group.key} style={{ marginBottom: 16 }}>
              <Text style={[styles.groupLabel, { color: t.textMuted }]}>{group.label}</Text>
              {group.items.map((s, i) => (
                <SessionRow
                  key={s.id}
                  session={s}
                  isActive={(s.sessionId || s.id) === activeSessionId}
                  isDark={isDark}
                  t={t}
                  onPress={() => onSessionPress?.(s)}
                  onDelete={onDeleteSession}
                  isLast={i === group.items.length - 1}
                />
              ))}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** Collapsible chat history — docked rail, inline panel, or overlay drawer. */
export default function CoachChatHistorySidebar({
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
  const t = isDark ? TOKENS.dark : TOKENS.light;
  const [searchQuery, setSearchQuery] = useState('');
  const slideAnim = useRef(new Animated.Value(-COACH_SIDEBAR_WIDTH)).current;
  const isNarrow = SW < 768;
  const showExpandedInline = mode === 'docked' && !collapsed && !isNarrow;
  const showOverlay = mode === 'overlay' ? open : mode === 'docked' && !collapsed && isNarrow;

  const filteredSessions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => {
      const hay = [s.title, s.lastUserMessage, s.lastAssistantMessage, s.date]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sessions, searchQuery]);

  useEffect(() => {
    if (!showOverlay) return;
    Animated.timing(slideAnim, {
      toValue: open || (mode === 'docked' && !collapsed) ? 0 : -COACH_SIDEBAR_WIDTH,
      duration: 260,
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
    t,
    insets,
  };

  if (mode === 'docked' && collapsed) {
    return (
      <View
        style={[
          styles.rail,
          {
            width: COACH_SIDEBAR_RAIL,
            backgroundColor: t.railBg,
            borderRightColor: t.border,
            paddingTop: (insets?.top || 0) + 8,
          },
        ]}
      >
        <TouchableOpacity
          onPress={onToggleCollapse}
          style={[styles.railBtn, { backgroundColor: t.inputBg }]}
          accessibilityLabel="Open chat history"
        >
          <Ionicons name="chatbubbles-outline" size={20} color={t.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onNewChat}
          style={[styles.railBtn, { backgroundColor: t.inputBg, marginTop: 8 }]}
          accessibilityLabel="New conversation"
        >
          <Ionicons name="add-outline" size={22} color={t.textMuted} />
        </TouchableOpacity>
        <View style={{ flex: 1 }} />
        <TouchableOpacity
          onPress={onToggleCollapse}
          style={styles.railBtn}
          accessibilityLabel="Expand sidebar"
        >
          <Ionicons name="chevron-forward" size={16} color={t.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  if (showExpandedInline) {
    return (
      <View
        style={{
          width: COACH_SIDEBAR_WIDTH,
          backgroundColor: t.panelBg,
          borderRightWidth: 1,
          borderRightColor: t.border,
        }}
      >
        <SidebarPanel {...panelProps} showClose={false} onClose={onToggleCollapse} />
      </View>
    );
  }

  if (!showOverlay) return null;

  const visible = mode === 'overlay' ? open : !collapsed;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose || onToggleCollapse}>
      <View style={{ flex: 1 }}>
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.58)' }]}
          activeOpacity={1}
          onPress={onClose || onToggleCollapse}
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
            backgroundColor: t.panelBg,
            borderRightWidth: 1,
            borderRightColor: t.border,
            zIndex: 2,
            ...(Platform.OS === 'ios'
              ? { shadowColor: '#000', shadowOpacity: 0.32, shadowRadius: 14, shadowOffset: { width: 4, height: 0 } }
              : { elevation: 24 }),
          }}
        >
          <SidebarPanel {...panelProps} />
        </Animated.View>
      </View>
    </Modal>
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
