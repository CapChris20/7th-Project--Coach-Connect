// Trainer inbox of "a client wants to work with you" cards (not the Messages tab).
// Flow: load pending cards → tap a row → TrainerListingPopup to accept or reject → refresh the list.
// Used by the trainer shell. Cards keep the keys from pendingRequestCount / getTrainerPendingRequests.

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomMenuSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { auth } from '../../app-start/cloudConnection';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import { pendingRequestCount } from './pendingRequestCount';
import TrainerListingPopup from '../home/TrainerListingPopup';
import { clientRequestTypeLabel } from '../../ai-coach/coach-actions/alertTrainer';

// ===== NAMED CONSTANTS =====

const GRADIENT_AVATAR = ['#7c3aed', '#ec4899'];
const EMPTY_ACCENT_GRADIENT = ['#fb7185', '#a78bfa'];
const EMPTY_ICON_GRADIENT = ['#7C3AED', '#EC4899'];
const UNKNOWN_INITIAL = '?';
const INITIALS_MAX_CHARS = 2;
const LIST_BOTTOM_INSET = 32;
const CLIENT_NAME_FALLBACK = 'No goals';
const EXPERIENCE_FALLBACK = '—';

// ===== HELPER FUNCTIONS =====

/**
 * First letters of the given name, uppercased, max two characters. "?" when the name is missing.
 * @param {string} clientName
 * @returns {string}
 */
function clientInitials(clientName) {
  return (clientName || UNKNOWN_INITIAL)
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .substring(0, INITIALS_MAX_CHARS);
}

/**
 * Card keys callers read: clientName, requestTitle, requestType, message, clientGoals, clientExperienceLevel.
 * Prefer the typed message; otherwise show goals · experience so a blank request still has a preview.
 * @param {object} requestItem
 * @returns {string}
 */
function requestPreviewText(requestItem) {
  if (requestItem.message) return requestItem.message;
  const goals = requestItem.clientGoals || CLIENT_NAME_FALLBACK;
  const experience = requestItem.clientExperienceLevel || EXPERIENCE_FALLBACK;
  return `${goals} · ${experience}`;
}

function requestTypeLine(requestItem) {
  return requestItem.requestTitle || clientRequestTypeLabel(requestItem.requestType);
}

function inboxPalette(isDark) {
  if (isDark) {
    return {
      screenBackground: '#0a0a1a',
      textColor: '#ffffff',
      mutedColor: 'rgba(255,255,255,0.55)',
      cardBackground: 'rgba(255,255,255,0.06)',
      nameColor: '#fff',
      typeColor: '#C084FC',
      previewColor: 'rgba(255,255,255,0.6)',
      loadingColor: 'rgba(255,255,255,0.6)',
      emptyCardBackground: 'rgba(12,12,18,0.96)',
      emptyCardBorder: 'rgba(255,255,255,0.1)',
    };
  }
  return {
    screenBackground: '#f5f3ff',
    textColor: '#1a0a2e',
    mutedColor: 'rgba(26,10,46,0.55)',
    cardBackground: 'rgba(0,0,0,0.04)',
    nameColor: '#1e293b',
    typeColor: '#7c3aed',
    previewColor: '#64748b',
    loadingColor: '#64748b',
    emptyCardBackground: 'rgba(255,255,255,0.98)',
    emptyCardBorder: 'rgba(15,23,42,0.1)',
  };
}

/**
 * One pending-request row. `item.id` is the list key the parent FlatList already uses.
 * @param {object} props
 */
function RequestCard({ item, palette, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => onPress(item)}
      style={[styles.requestCard, { backgroundColor: palette.cardBackground }]}
    >
      <LinearGradient colors={GRADIENT_AVATAR} style={styles.avatar}>
        <Text style={styles.avatarText}>{clientInitials(item.clientName)}</Text>
      </LinearGradient>
      <View style={styles.requestContent}>
        <Text style={[styles.requestName, { color: palette.nameColor }]}>{item.clientName}</Text>
        <Text style={[styles.requestType, { color: palette.typeColor }]}>{requestTypeLine(item)}</Text>
        <Text style={[styles.requestPreview, { color: palette.previewColor }]} numberOfLines={2}>
          {requestPreviewText(item)}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

function LoadingRequests({ palette }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#7c3aed" />
      <Text style={[styles.loadingText, { color: palette.loadingColor }]}>Loading requests...</Text>
    </View>
  );
}

function RequestsError({ error, palette, onRetry }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function EmptyInboxCard({ palette }) {
  return (
    <View style={styles.emptyWrap}>
      <View
        style={[
          styles.emptyCardShell,
          {
            backgroundColor: palette.emptyCardBackground,
            borderColor: palette.emptyCardBorder,
          },
          Platform.select({
            ios: {
              shadowColor: '#6366f1',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.14,
              shadowRadius: 12,
            },
            android: { elevation: 8 },
          }),
        ]}
      >
        <LinearGradient
          colors={EMPTY_ACCENT_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyTopAccent}
        />
        <View style={[styles.emptyInner, { borderColor: 'transparent' }]}>
          <LinearGradient colors={EMPTY_ICON_GRADIENT} style={styles.emptyIconGrad}>
            <Ionicons name="mail-open-outline" size={30} color="#FFFFFF" />
          </LinearGradient>
          <Text style={[styles.emptyKicker, { color: palette.mutedColor }]}>INBOX</Text>
          <Text style={[styles.emptyTitle, { color: palette.textColor }]}>You are all caught up</Text>
          <Text style={[styles.emptySubtext, { color: palette.mutedColor }]}>
            Connection requests, workout plan asks, and other client requests from the app show up here — not in Messages. Open a row to acknowledge or accept.
          </Text>
        </View>
      </View>
    </View>
  );
}

function RequestsListBody({ loading, error, requests, palette, listBottomPad, refresh, onSelectRequest }) {
  if (loading) return <LoadingRequests palette={palette} />;
  if (error) return <RequestsError error={error} palette={palette} onRetry={refresh} />;
  if (requests.length === 0) return <EmptyInboxCard palette={palette} />;
  return (
    <FlatList
      data={requests}
      renderItem={({ item }) => (
        <RequestCard item={item} palette={palette} onPress={onSelectRequest} />
      )}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.listContent, { paddingBottom: listBottomPad }]}
      {...FORM_SCROLL_PROPS}
    />
  );
}

function RequestsScreenChrome({ embedInLayout, palette, screenHeader, children }) {
  const containerStyle = [styles.container, { backgroundColor: palette.screenBackground }];
  if (embedInLayout) {
    return (
      <View style={[containerStyle, { flex: 1 }]}>
        {screenHeader}
        {children}
      </View>
    );
  }
  return (
    <SafeAreaView style={containerStyle} edges={SHELL_SAFE_AREA_EDGES}>
      {screenHeader}
      {children}
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer pending-request inbox. Accept/reject lives in TrainerListingPopup.
 * @param {object} props
 */
export default function NewTraineeRequestsScreen({
  onClose,
  onProfilePress,
  onSettingsPress,
  onClientAdded,
  embedInLayout,
}) {
  const { isDark } = useTheme();
  const listBottomPad = useShellBottomNavInset(LIST_BOTTOM_INSET);
  const trainerUid = auth.currentUser?.uid;
  const { requests, loading, error, refresh } = pendingRequestCount(trainerUid);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const palette = inboxPalette(isDark);

  const syncListWithParent = useCallback(async () => {
    setSelectedRequest(null);
    await refresh();
    await onClientAdded?.();
  }, [refresh, onClientAdded]);

  const handleClientAdded = async () => {
    await syncListWithParent();
  };

  const screenHeader = (
    <TopHeader
      title="Client Requests"
      isDark={isDark}
      skipTopSafeInset
      onBack={onClose}
      onProfilePress={onProfilePress}
      onSettingsPress={onSettingsPress}
    />
  );

  return (
    <RequestsScreenChrome embedInLayout={embedInLayout} palette={palette} screenHeader={screenHeader}>
      <RequestsListBody
        loading={loading}
        error={error}
        requests={requests}
        palette={palette}
        listBottomPad={listBottomPad}
        refresh={refresh}
        onSelectRequest={setSelectedRequest}
      />
      <TrainerListingPopup
        visible={!!selectedRequest}
        clientRequest={selectedRequest}
        trainerUid={trainerUid}
        onClose={() => setSelectedRequest(null)}
        onClientAdded={handleClientAdded}
        onRequestRejected={syncListWithParent}
      />
    </RequestsScreenChrome>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 36,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { fontSize: 14, textAlign: 'center', marginBottom: 16 },
  retryButton: { paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#7c3aed', borderRadius: 12 },
  retryText: { color: '#fff', fontWeight: '600' },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  emptyCardShell: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
  },
  emptyTopAccent: {
    height: 4,
    width: '100%',
  },
  emptyInner: {
    paddingHorizontal: 22,
    paddingVertical: 26,
    alignItems: 'center',
    borderTopWidth: 0,
  },
  emptyIconGrad: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyKicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  emptyTitle: { fontSize: 20, fontWeight: '900', marginBottom: 10, textAlign: 'center', letterSpacing: -0.35 },
  emptySubtext: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21, maxWidth: 320 },
  listContent: { padding: 16 },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  requestContent: { flex: 1, marginLeft: 12, minWidth: 0 },
  requestName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  requestType: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 },
  requestPreview: { fontSize: 13 },
  chevron: { fontSize: 20, color: 'rgba(255,255,255,0.5)', marginLeft: 8 },
});
