import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  TRAINER_SUBSCRIPTION_BENEFITS,
  TRAINER_SUBSCRIPTION_LEGAL,
  TRAINER_SUBSCRIPTION_PRICE_LABEL,
  TRAINER_SUBSCRIPTION_TRIAL_LABEL,
} from './constants';
import { useSubscription } from './SubscriptionProvider';

const ACCENT_PINK = '#BE185D';
const ACCENT_ORANGE = '#C2410C';
const BG = '#050508';
const SURFACE = 'rgba(255,255,255,0.06)';
const BORDER = 'rgba(255,255,255,0.1)';

function BenefitRow({ text }) {
  return (
    <View style={styles.benefitRow}>
      <Ionicons name="checkmark-circle" size={20} color="#34D399" />
      <Text style={styles.benefitText}>{text}</Text>
    </View>
  );
}

export default function TrainerSubscriptionPaywallScreen({ onOpenSettings }) {
  const {
    actionLoading,
    lastError,
    clearError,
    startFreeTrial,
    storeProduct,
    connected,
  } = useSubscription();

  const priceLine =
    storeProduct?.displayPrice != null
      ? `${storeProduct.displayPrice}/month | ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`
      : `${TRAINER_SUBSCRIPTION_PRICE_LABEL} | ${TRAINER_SUBSCRIPTION_TRIAL_LABEL}`;

  const handleCta = async () => {
    clearError();
    await startFreeTrial();
  };

  const handleContactSupport = () => {
    if (typeof onOpenSettings === 'function') {
      onOpenSettings();
      return;
    }
    Linking.openURL('mailto:coachconnect0@gmail.com?subject=Subscription%20verification%20issue');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <LinearGradient colors={['#120810', BG, '#0A0608']} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.badge}>
          <LinearGradient colors={[ACCENT_PINK, ACCENT_ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badgeGrad}>
            <Text style={styles.badgeText}>COACH CONNECT PRO</Text>
          </LinearGradient>
        </View>

        <Text style={styles.title}>Grow your coaching business</Text>
        <Text style={styles.priceLine}>{priceLine}</Text>

        <View style={styles.card}>
          {TRAINER_SUBSCRIPTION_BENEFITS.map((benefit) => (
            <BenefitRow key={benefit} text={benefit} />
          ))}
        </View>

        {lastError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{lastError.message}</Text>
            {lastError.type === 'network' ? (
              <TouchableOpacity onPress={handleCta} style={styles.retryBtn}>
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            ) : null}
            {lastError.type === 'verification' ? (
              <TouchableOpacity onPress={handleContactSupport} style={styles.retryBtn}>
                <Text style={styles.retryText}>Contact support</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <TouchableOpacity
          onPress={handleCta}
          disabled={actionLoading || (Platform.OS === 'ios' && !connected)}
          activeOpacity={0.9}
          style={styles.ctaWrap}
        >
          <LinearGradient colors={[ACCENT_PINK, ACCENT_ORANGE]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.cta}>
            {actionLoading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.ctaText}>START FREE TRIAL</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <Text style={styles.legal}>{TRAINER_SUBSCRIPTION_LEGAL}</Text>

        {typeof onOpenSettings === 'function' ? (
          <TouchableOpacity onPress={onOpenSettings} style={styles.settingsLink}>
            <Text style={styles.settingsLinkText}>Settings</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  badge: { alignSelf: 'flex-start', marginBottom: 16, borderRadius: 999, overflow: 'hidden' },
  badgeGrad: { paddingHorizontal: 14, paddingVertical: 6 },
  badgeText: { color: '#FFF', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: {
    color: '#FFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  priceLine: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 24,
  },
  card: {
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 18,
    marginBottom: 24,
    gap: 14,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  benefitText: { color: '#F3F4F6', fontSize: 16, fontWeight: '600', flex: 1 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: '#FCA5A5', fontSize: 14, lineHeight: 20 },
  retryBtn: { marginTop: 10, alignSelf: 'flex-start' },
  retryText: { color: '#F9A8D4', fontWeight: '700', fontSize: 14 },
  ctaWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 14 },
  cta: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  ctaText: { color: '#FFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.6 },
  legal: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  settingsLink: { marginTop: 20, alignSelf: 'center' },
  settingsLinkText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600' },
});
