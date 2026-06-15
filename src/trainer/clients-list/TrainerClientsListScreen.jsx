/**
 * Trainer Clients List Screen
 *
 * Purpose: UI screen or component: Trainer Clients List Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
/** Trainer — full client roster list */
import React, { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../app/config';
import { GestureHandlerRootView, Swipeable } from 'react-native-gesture-handler';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import {
  getClientInitials,
  getClientRosterStats,
} from '../dashboard/trainerDashboardUi';

const CLIENT_LIST_DELETE_GRADIENT = ['#BE185D', '#C2410C'];
const ROSTER_LIST_AVATAR_GRADIENT = ['#9F1239', '#C2410C'];
const ROSTER_LIST_RIM_GRADIENT = ['#BE185D', '#C2410C'];
const SWIPE_DELETE_WIDTH = 88;
const DELETE_ICON_PINK = '#FF6B9D';

const ClientsListScreen = ({
  clients,
  trainerId,
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
  isDark = true,
}) => {
  const [deletePending, setDeletePending] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const swipeRefs = useRef(new Map());

  const textColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const titleColor = textColor;
  const emptyColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';
  const mutedColor = emptyColor;
  const innerCardBg = isDark ? '#0f0f16' : '#FAFAFC';
  const modalOverlay = 'rgba(0,0,0,0.55)';
  const modalCardBg = isDark ? '#141419' : '#FFFFFF';
  const modalText = isDark ? '#FFFFFF' : '#0A0A0F';
  const modalMuted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(10,10,15,0.65)';

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
      Alert.alert('Unavailable', 'Cloud Functions are not configured.');
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
        Alert.alert('Client removed', `${displayName} is no longer on your roster.`);
    } catch (e) {
      const msg = e?.message || e?.code || 'Could not remove this client. Try again.';
      Alert.alert('Remove failed', String(msg));
    } finally {
      setRemoveBusy(false);
    }
  }, [cancelRemove, deletePending, onClientRemoved, trainerId]);

  const renderRightActions = useCallback(
    (client) => (
      <View
        style={{
          width: SWIPE_DELETE_WIDTH,
          marginBottom: 12,
          justifyContent: 'stretch',
        }}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => openRemoveSheet(client)}
          style={{
            flex: 1,
            backgroundColor: '#BE185D',
            borderTopRightRadius: 14,
            borderBottomRightRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 6,
          }}
        >
          <Ionicons name="trash-outline" size={24} color="#FFFFFF" />
          <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800', marginTop: 4 }}>Remove</Text>
        </TouchableOpacity>
      </View>
    ),
    [openRemoveSheet],
  );

  const removeModal = (
    <Modal visible={!!deletePending} transparent animationType="fade" onRequestClose={cancelRemove}>
      <Pressable style={{ flex: 1, backgroundColor: modalOverlay, justifyContent: 'center', padding: 24 }} onPress={cancelRemove}>
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={{
            borderRadius: 16,
            padding: 20,
            backgroundColor: modalCardBg,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          }}
        >
          <Text style={{ color: modalText, fontSize: 18, fontWeight: '900', marginBottom: 10 }}>Remove client?</Text>
          <Text style={{ color: modalMuted, fontSize: 14, lineHeight: 20, marginBottom: 20 }}>
            {deletePending?.name} will lose access to plans you assigned through Coach Connect. This cannot be undone from the app.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'flex-end' }}>
            <TouchableOpacity
              onPress={cancelRemove}
              disabled={removeBusy}
              style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, opacity: removeBusy ? 0.5 : 1 }}
            >
              <Text style={{ color: modalMuted, fontSize: 15, fontWeight: '700' }}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={confirmRemove}
              disabled={removeBusy}
              style={{
                paddingVertical: 12,
                paddingHorizontal: 18,
                borderRadius: 12,
                backgroundColor: DELETE_ICON_PINK,
                minWidth: 100,
                alignItems: 'center',
                opacity: removeBusy ? 0.75 : 1,
              }}
            >
              {removeBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>Remove</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const listContent = clients.length === 0 ? (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingBottom: 24 }}>
      <View
        style={[
          {
            width: '100%',
            maxWidth: 360,
            borderRadius: 22,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
            backgroundColor: isDark ? 'rgba(12,12,18,0.96)' : 'rgba(255,255,255,0.98)',
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
          colors={ROSTER_LIST_RIM_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ height: 4, width: '100%' }}
        />
        <View style={{ paddingHorizontal: 22, paddingVertical: 28, alignItems: 'center' }}>
          <LinearGradient colors={ROSTER_LIST_AVATAR_GRADIENT} style={{ width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="people-outline" size={28} color="#FFFFFF" />
          </LinearGradient>
          <Text style={{ color: titleColor, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 18, letterSpacing: -0.3 }}>
            No clients yet
          </Text>
          <Text style={{ color: emptyColor, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 }}>
            When someone connects or you accept a request, they show up here.
          </Text>
          {typeof onOpenClientRequests === 'function' ? (
            <TouchableOpacity
              onPress={onOpenClientRequests}
              activeOpacity={0.9}
              style={{ marginTop: 20, borderRadius: 14, overflow: 'hidden', alignSelf: 'stretch' }}
            >
              <LinearGradient
                colors={CLIENT_LIST_DELETE_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 14, paddingHorizontal: 22, alignItems: 'center' }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>View client requests</Text>
              </LinearGradient>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  ) : (
    <ScrollView
      contentContainerStyle={{ paddingTop: 8, paddingBottom: 120, paddingHorizontal: 16 }}
      showsVerticalScrollIndicator={false}
      nestedScrollEnabled
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 2 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.1,
            color: mutedColor,
            textTransform: 'uppercase',
          }}
        >
          Your roster
        </Text>
        <View
          style={{
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 999,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)',
          }}
        >
          <Text style={{ fontSize: 10, fontWeight: '800', color: mutedColor }}>{clients.length} active</Text>
        </View>
      </View>
      <Text style={{ color: mutedColor, fontSize: 12, marginBottom: 14, paddingHorizontal: 2 }}>
        Tap a client to open their dashboard · swipe left or tap trash to remove
      </Text>
      {(clients || []).map((client) => {
        const displayName = client.name || client.displayName || 'Client';
        const stats = getClientRosterStats(client);
        const initials = getClientInitials(displayName);
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
            <View style={{ marginBottom: 12 }}>
              <View
                style={{
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.1)',
                  overflow: 'hidden',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.92)',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.88}
                  onPress={() => onSelectClient(client.id)}
                  style={{
                    borderRadius: 18,
                    backgroundColor: innerCardBg,
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 14,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <LinearGradient
                      colors={ROSTER_LIST_AVATAR_GRADIENT}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 18,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 }}>{initials}</Text>
                    </LinearGradient>
                    <View style={{ flex: 1, marginLeft: 14, minWidth: 0, paddingRight: 36 }}>
                      <Text style={{ color: textColor, fontSize: 18, fontWeight: '900', letterSpacing: -0.3 }} numberOfLines={1}>
                        {displayName}
                      </Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                        {stats.goal ? (
                          <View
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 999,
                              backgroundColor: isDark ? 'rgba(157, 23, 57, 0.22)' : 'rgba(190, 24, 93, 0.1)',
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(234, 88, 12, 0.28)' : 'rgba(194, 65, 12, 0.22)',
                              marginRight: 8,
                              marginBottom: 4,
                            }}
                          >
                            <Text style={{ color: isDark ? 'rgba(254, 205, 211, 0.92)' : '#9F1239', fontSize: 11, fontWeight: '800' }} numberOfLines={1}>
                              {stats.goal}
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '600', marginBottom: 4 }}>{getClientSubtext(client)}</Text>
                        )}
                      </View>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', marginTop: 14 }}>
                    {[
                      { key: 'age', cap: 'Age', val: stats.age ? `${stats.age} yrs` : '—' },
                      { key: 'wt', cap: 'Weight', val: stats.weight ? `${stats.weight} lbs` : '—' },
                      { key: 'ht', cap: 'Height', val: stats.height || '—' },
                    ].map((cell, idx) => (
                      <View
                        key={cell.key}
                        style={{
                          flex: 1,
                          borderRadius: 14,
                          paddingVertical: 10,
                          paddingHorizontal: 8,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)',
                          borderWidth: 1,
                          borderColor: isDark ? 'rgba(244, 114, 182, 0.12)' : 'rgba(194, 65, 12, 0.1)',
                          alignItems: 'center',
                          marginRight: idx < 2 ? 10 : 0,
                        }}
                      >
                        <Text
                          style={{
                            color: isDark ? 'rgba(244, 182, 196, 0.88)' : 'rgba(136, 19, 55, 0.78)',
                            fontSize: 11,
                            fontWeight: '800',
                            letterSpacing: 1,
                            textTransform: 'uppercase',
                          }}
                        >
                          {cell.cap}
                        </Text>
                        <Text
                          style={{
                            color: isDark ? 'rgba(255, 247, 247, 0.96)' : '#0f172a',
                            fontSize: 15,
                            fontWeight: '800',
                            marginTop: 4,
                            letterSpacing: -0.2,
                          }}
                          numberOfLines={1}
                        >
                          {cell.val}
                        </Text>
                      </View>
                    ))}
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => openRemoveSheet(client)}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  accessibilityLabel={`Remove ${displayName}`}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isDark ? 'rgba(190, 24, 93, 0.18)' : 'rgba(190, 24, 93, 0.08)',
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(244, 114, 182, 0.22)' : 'rgba(190, 24, 93, 0.15)',
                  }}
                >
                  <Ionicons name="trash-outline" size={17} color={DELETE_ICON_PINK} />
                </TouchableOpacity>
              </View>
            </View>
          </Swipeable>
        );
      })}
      {hasMore && typeof onLoadMore === 'function' ? (
        <TouchableOpacity
          onPress={onLoadMore}
          disabled={loadingMore}
          accessibilityRole="button"
          accessibilityLabel="Load more clients"
          style={{
            alignSelf: 'center',
            marginTop: 16,
            marginBottom: 8,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 14,
            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)',
            borderWidth: 1,
            borderColor: isDark ? 'rgba(244, 114, 182, 0.2)' : 'rgba(194, 65, 12, 0.12)',
          }}
        >
          {loadingMore ? (
            <ActivityIndicator size="small" color={isDark ? '#F472B6' : '#BE185D'} />
          ) : (
            <Text style={{ color: mutedColor, fontSize: 14, fontWeight: '700' }}>Load more clients</Text>
          )}
        </TouchableOpacity>
      ) : null}
    </ScrollView>
  );

  if (embedInLayout) {
    return (
      <View style={{ flex: 1 }}>
        {listContent}
        {removeModal}
      </View>
    );
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
      <LinearGradient colors={isDark ? GRADIENT_BG_DARK : GRADIENT_BG_LIGHT} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <CoachConnectHeader
            title="Clients"
            skipTopSafeInset
            onBack={onBack}
            onProfilePress={onProfilePress}
            onSettingsPress={onSettingsPress}
          />
          {listContent}
          <BottomNavBar
            onHomePress={onHomePress}
            onPlusPress={onPlusPress}
            onVoicePress={onVoicePress}
            onNutritionPress={onNutritionPress}
            onWorkoutPress={onWorkoutPress}
            onMessagesPress={onMessagesPress}
          />
          {removeModal}
        </SafeAreaView>
      </LinearGradient>
    </AppNavigationProvider>
  );
};

// ─────────────────────────────────────────────
// DASHBOARD CONTENT
// ─────────────────────────────────────────────

export default ClientsListScreen;
