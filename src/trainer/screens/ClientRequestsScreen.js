import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth } from '../../app/config';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import { useTrainerPendingRequests } from '../hooks/useTrainerPendingRequests';
import TrainerMarketplaceModal from '../components/TrainerMarketplaceModal';
import { clientRequestTypeLabel } from '../../ai/services/trainerMessaging';

const GRADIENT_AVATAR = ['#7c3aed', '#ec4899'];

export default function ClientRequestsScreen({ onClose, onProfilePress, onSettingsPress, onClientAdded, embedInLayout }) {
  const { isDark } = useTheme();
  const trainerUid = auth.currentUser?.uid;
  const { requests, loading, error, refresh } = useTrainerPendingRequests(trainerUid);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(26,10,46,0.55)';

  const syncListWithParent = useCallback(async () => {
    setSelectedRequest(null);
    await refresh();
    await onClientAdded?.();
  }, [refresh, onClientAdded]);

  const handleClientAdded = async () => {
    await syncListWithParent();
  };

  const renderRequestItem = ({ item }) => {
    const initials = (item.clientName || '?')
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setSelectedRequest(item)}
        style={[styles.requestCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
      >
        <LinearGradient colors={GRADIENT_AVATAR} style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
        <View style={styles.requestContent}>
          <Text style={[styles.requestName, { color: isDark ? '#fff' : '#1e293b' }]}>{item.clientName}</Text>
          <Text style={[styles.requestType, { color: isDark ? '#C084FC' : '#7c3aed' }]}>
            {item.requestTitle || clientRequestTypeLabel(item.requestType)}
          </Text>
          <Text style={[styles.requestPreview, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }]} numberOfLines={2}>
            {item.message || `${item.clientGoals || 'No goals'} · ${item.clientExperienceLevel || '—'}`}
          </Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const content = (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <View style={styles.backCircle}>
            <Ionicons name="chevron-back" size={24} color="rgba(255,255,255,0.75)" />
          </View>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1e293b' }]}>Client Requests</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#7c3aed" />
          <Text style={[styles.loadingText, { color: isDark ? 'rgba(255,255,255,0.6)' : '#64748b' }]}>
            Loading requests...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.errorText, { color: '#ef4444' }]}>{error}</Text>
          <TouchableOpacity onPress={refresh} style={styles.retryButton}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : requests.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View
            style={[
              styles.emptyCardShell,
              {
                backgroundColor: isDark ? 'rgba(12,12,18,0.96)' : 'rgba(255,255,255,0.98)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
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
              colors={['#fb7185', '#a78bfa']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.emptyTopAccent}
            />
            <View style={[styles.emptyInner, { borderColor: 'transparent' }]}>
              <LinearGradient colors={['#7C3AED', '#EC4899']} style={styles.emptyIconGrad}>
                <Ionicons name="mail-open-outline" size={30} color="#FFFFFF" />
              </LinearGradient>
              <Text style={[styles.emptyKicker, { color: mutedColor }]}>INBOX</Text>
              <Text style={[styles.emptyTitle, { color: textColor }]}>You are all caught up</Text>
              <Text style={[styles.emptySubtext, { color: mutedColor }]}>
                Connection requests, workout plan asks, and other client requests from the app show up here — not in Messages. Open a row to acknowledge or accept.
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <FlatList
          data={requests}
          renderItem={renderRequestItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TrainerMarketplaceModal
        visible={!!selectedRequest}
        clientRequest={selectedRequest}
        trainerUid={trainerUid}
        onClose={() => setSelectedRequest(null)}
        onClientAdded={handleClientAdded}
        onRequestRejected={syncListWithParent}
      />
    </>
  );

  if (embedInLayout) {
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: isDark ? '#0a0a1a' : '#f5f3ff' }]}>
        {content}
      </View>
    );
  }
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#0a0a1a' : '#f5f3ff' }]}>
      <CoachConnectHeader
        title="Client Requests"
        isDark={isDark}
        skipTopSafeInset
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />
      {content}
    </SafeAreaView>
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
  listContent: { padding: 16, paddingBottom: 40 },
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
