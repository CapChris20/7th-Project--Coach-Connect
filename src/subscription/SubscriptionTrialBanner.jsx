import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatTrialCountdown } from './subscriptionState';
import { useSubscription } from './SubscriptionProvider';

const ACCENT_PINK = '#BE185D';
const ACCENT_ORANGE = '#C2410C';

export default function SubscriptionTrialBanner() {
  const { accessState } = useSubscription();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (accessState.access !== 'free_trial') return undefined;
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, [accessState.access]);

  if (accessState.access !== 'free_trial') return null;

  const countdown = accessState.trialEndsAt
    ? formatTrialCountdown(accessState.trialEndsAt.getTime() - now)
    : 'Free trial active';

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={[ACCENT_PINK, ACCENT_ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.banner}>
        <Ionicons name="sparkles" size={16} color="#FFF" />
        <Text style={styles.text}>{countdown}</Text>
        <Text style={styles.sub}>Full Pro access</Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: { color: '#FFF', fontWeight: '700', fontSize: 13, flex: 1 },
  sub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600' },
});
