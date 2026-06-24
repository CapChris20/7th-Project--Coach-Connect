import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TRAINER_SUBSCRIPTION_PRICE_LABEL } from './constants';
import { useSubscription } from './SubscriptionProvider';

const ACCENT_PINK = '#BE185D';
const ACCENT_ORANGE = '#C2410C';
const BG = '#050508';

export default function SubscriptionExpiredScreen({ onOpenSettings }) {
  const { actionLoading, lastError, clearError, startFreeTrial, restorePurchases } = useSubscription();

  const handleResubscribe = async () => {
    clearError();
    await startFreeTrial();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#120810', BG]} style={StyleSheet.absoluteFill} />
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="lock-closed" size={36} color="#F9A8D4" />
        </View>
        <Text style={styles.title}>Subscription expired</Text>
        <Text style={styles.body}>
          Renew Coach Connect Pro ({TRAINER_SUBSCRIPTION_PRICE_LABEL}) to keep managing clients, AI tools, and your
          dashboard.
        </Text>

        {lastError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{lastError.message}</Text>
            {lastError.type === 'network' ? (
              <TouchableOpacity onPress={handleResubscribe}>
                <Text style={styles.link}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            {lastError.type === 'verification' ? (
              <TouchableOpacity onPress={() => Linking.openURL('mailto:coachconnect0@gmail.com')}>
                <Text style={styles.link}>Contact support</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity onPress={handleResubscribe} disabled={actionLoading} style={styles.ctaWrap}>
          <LinearGradient colors={[ACCENT_PINK, ACCENT_ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            {actionLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>RE-SUBSCRIBE</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity onPress={restorePurchases} disabled={actionLoading} style={styles.secondaryBtn}>
          <Text style={styles.secondaryText}>Restore purchases</Text>
        </TouchableOpacity>

        {typeof onOpenSettings === 'function' ? (
          <TouchableOpacity onPress={onOpenSettings}>
            <Text style={styles.settingsLink}>Open settings</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', marginBottom: 10 },
  body: { color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 24, marginBottom: 24 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: '#FCA5A5', fontSize: 14 },
  link: { color: '#F9A8D4', fontWeight: '700', marginTop: 8 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  cta: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFF', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  secondaryBtn: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { color: 'rgba(255,255,255,0.75)', fontWeight: '600' },
  settingsLink: { color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 16 },
});
