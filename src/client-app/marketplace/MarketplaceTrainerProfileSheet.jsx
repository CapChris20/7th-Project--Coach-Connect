/**
 * Marketplace Trainer Profile Sheet
 *
 * Purpose: UI screen or component: Marketplace Trainer Profile Sheet. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/marketplace
 * Key exports: TrainerProfileSheet
 *
 * @file-header
 */
import React from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BRAND,
  getTheme,
  gradGradient,
  trainerFirstName,
  getTrainerPrice,
  normalizeTrainer,
  MP_FONT,
} from '../marketplaceFilters';
import {
  GlassCard,
  PrimaryButton,
  SecondaryButton,
  SectionLabel,
  GradientText,
} from './MarketplaceUI';
import { trainerPhotoUri } from '../../shared-utils/getTrainerProfileMedia';

const PROFILE_FOOTER_H = 88;

const FEATURES = [
  { label: 'Custom workouts', icon: 'barbell-outline', color: BRAND.pink },
  { label: 'Direct messaging', icon: 'chatbubbles-outline', color: BRAND.purple },
  { label: 'Progress tracking', icon: 'trending-up-outline', color: BRAND.cyan },
  { label: 'Session booking', icon: 'calendar-outline', color: BRAND.orange },
];

function InfoPill({ icon, label, t, active }) {
  return (
    <View
      style={[
        s.infoPill,
        active
          ? { borderColor: `${BRAND.orange}66`, backgroundColor: `${BRAND.pink}28` }
          : { borderColor: `${BRAND.purple}55`, backgroundColor: `${BRAND.purple}12` },
      ]}
    >
      <Ionicons name={icon} size={12} color={active ? BRAND.cyan : BRAND.purple} />
      <Text style={[s.infoPillText, { color: t.foreground }]}>{label}</Text>
    </View>
  );
}

export function TrainerProfileSheet({
  trainer,
  visible,
  onClose,
  onConnect,
  onRequest,
  isDark = true,
  requesting = false,
  variant = 'marketplace',
  onMessage,
  embedded = false,
}) {
  const insets = useSafeAreaInsets();
  if (!trainer || (!embedded && !visible)) return null;
  if (embedded && !visible) return null;

  const display = trainer._firebase || trainer.initials ? trainer : normalizeTrainer(trainer, 0);
  const t = getTheme(isDark);
  const isConnected = variant === 'connected';
  const firstName = trainerFirstName(display.name || display.displayName);
  const avatarColors = gradGradient(display.grad);
  const photoUri = display.photoURL || trainerPhotoUri(display._firebase || display);
  const price = getTrainerPrice(display._firebase || display) ?? display.price;
  const showPrice = price != null && Number(price) > 0;
  const handleMessage = onMessage;
  const handleConnect = onConnect || onRequest;
  const scrollBottomPad = PROFILE_FOOTER_H + (embedded ? 88 : insets.bottom) + 24;

  const footer = (
    <View
      style={[
        s.profileFooter,
        {
          borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : t.border,
          backgroundColor: isDark ? t.card : t.background,
          paddingBottom: embedded ? 12 : 12 + insets.bottom,
        },
      ]}
    >
      {isConnected && typeof handleMessage === 'function' ? (
        <PrimaryButton onPress={handleMessage} style={{ flex: 1 }} disabled={requesting} icon="chatbubble-outline">
          Message
        </PrimaryButton>
      ) : (
        <>
          <SecondaryButton
            onPress={() => handleMessage?.(display)}
            style={{ flex: 1 }}
            textColor={t.foreground}
            disabled={requesting || !handleMessage}
            icon="chatbubble-outline"
            isDark={isDark}
          >
            Message
          </SecondaryButton>
          <PrimaryButton
            onPress={() => !requesting && handleConnect?.(display)}
            style={{ flex: 1.15 }}
            disabled={requesting}
            icon="flash-outline"
          >
            Connect with {firstName}
          </PrimaryButton>
        </>
      )}
    </View>
  );

  const body = (
    <View style={[s.root, { backgroundColor: t.background }]}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={[s.scrollContent, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.profileHero}>
          {photoUri ? (
            <LinearGradient colors={avatarColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.avatarRing}>
              <Image source={{ uri: photoUri }} style={s.avatarXlImg} />
            </LinearGradient>
          ) : (
            <LinearGradient
              colors={avatarColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.avatarBox}
            >
              <Text style={s.avatarXlText}>{display.initials}</Text>
            </LinearGradient>
          )}

          <Text style={[s.profileName, { color: t.foreground }]}>
            {display.name || display.displayName}
          </Text>

          <View style={s.locRow}>
            <Ionicons name="location-outline" size={14} color={t.mutedForeground} />
            <Text style={{ color: t.mutedForeground, fontSize: 14, fontWeight: '500' }}>
              {display.location || '—'}  •  {display.mode || 'Remote'}
            </Text>
          </View>

          <View style={[s.pillWrap, { marginTop: 14 }]}>
            {display.verified !== false ? (
              <InfoPill icon="shield-checkmark" label="Verified" t={t} active />
            ) : null}
            <InfoPill
              icon="time-outline"
              label={`Responds ${display.responds || 'within 2 hours'}`}
              t={t}
            />
          </View>
        </View>

        <View style={s.statRow}>
          <GlassCard isDark={isDark} style={s.statCardWrap} contentStyle={s.statCard}>
            <Text style={[s.statVal, { color: BRAND.purple }]}>{display.years || '—'}</Text>
            <Text style={[s.statLabel, { color: t.mutedForeground }]}>Years coaching</Text>
          </GlassCard>
          <GlassCard isDark={isDark} style={s.statCardWrap} contentStyle={s.statCard}>
            <Text style={[s.statVal, { color: BRAND.cyan }]}>{(display.specialties || []).length}</Text>
            <Text style={[s.statLabel, { color: t.mutedForeground }]}>Specialties</Text>
          </GlassCard>
        </View>

        <GlassCard t={t} isDark={isDark}>
          <SectionLabel>About</SectionLabel>
          <Text style={{ color: t.foreground, lineHeight: 22, marginTop: 10, fontSize: 15, fontWeight: '500' }}>
            {display.bio || 'No bio yet.'}
          </Text>
        </GlassCard>

        <GlassCard t={t} isDark={isDark}>
          <SectionLabel>Specialties</SectionLabel>
          <View style={s.specGrid}>
            {(display.specialties || []).map((spec, idx) => {
              const c = [BRAND.pink, BRAND.orange, BRAND.cyan, BRAND.purple][idx % 4];
              return (
                <View key={spec} style={[s.specTile, { borderColor: t.border, backgroundColor: t.muted }]}>
                  <LinearGradient colors={[c, `${c}88`]} style={s.specIcon}>
                    <Ionicons name="fitness-outline" size={18} color="#fff" />
                  </LinearGradient>
                  <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 13 }}>{spec}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard t={t} isDark={isDark}>
          <SectionLabel>What you get</SectionLabel>
          <View style={s.specGrid}>
            {FEATURES.map((f) => (
              <View key={f.label} style={[s.specTile, { borderColor: t.border, backgroundColor: t.muted }]}>
                <LinearGradient colors={[f.color, `${f.color}99`]} style={s.specIcon}>
                  <Ionicons name={f.icon} size={18} color="#fff" />
                </LinearGradient>
                <Text style={{ color: t.foreground, fontWeight: '700', fontSize: 13 }}>{f.label}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        {showPrice ? (
          <GlassCard t={t} isDark={isDark}>
            <SectionLabel>Investment</SectionLabel>
            <View style={s.priceRow}>
              <GradientText style={s.priceGradient}>${price}</GradientText>
              <Text style={{ color: t.mutedForeground, fontSize: 17, fontWeight: '600' }}>/mo</Text>
            </View>
            <Text style={{ color: t.mutedForeground, marginTop: 10, lineHeight: 21, fontSize: 14 }}>
              Personalized programming, weekly check-ins, unlimited messaging.
            </Text>
            <LinearGradient
              colors={[`${BRAND.pink}33`, `${BRAND.purple}22`]}
              style={[s.trialBox, { borderColor: `${BRAND.purple}55` }]}
            >
              <Text style={{ color: t.foreground, fontWeight: '800', textAlign: 'center', fontSize: 14 }}>
                FREE {display.trialDays ?? 5}-day trial · no card required
              </Text>
            </LinearGradient>
          </GlassCard>
        ) : null}
      </ScrollView>

      {footer}
    </View>
  );

  if (embedded) return body;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.modalShell}>
        <View style={s.profileTop}>
          <Pressable onPress={onClose} style={[s.modalBackBtn, { borderColor: t.border }]}>
            <Ionicons name="chevron-back" size={22} color={t.foreground} />
          </Pressable>
        </View>
        {body}
      </View>
    </Modal>
  );
}

export default TrainerProfileSheet;

const s = StyleSheet.create({
  root: { flex: 1 },
  modalShell: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, gap: 14, paddingTop: 4 },
  profileTop: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8 },
  modalBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHero: { alignItems: 'center', paddingBottom: 16, paddingTop: 4 },
  avatarBox: {
    width: 112,
    height: 112,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: {
    width: 118,
    height: 118,
    borderRadius: 30,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarXlImg: { width: 112, height: 112, borderRadius: 27 },
  avatarXlText: { color: '#fff', fontSize: 38, fontWeight: '800' },
  profileName: {
    fontSize: 30,
    fontFamily: MP_FONT.displayBold,
    marginTop: 18,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  pillWrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  infoPillText: { fontSize: 11, fontWeight: '700' },
  statRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  statCardWrap: { flex: 1, marginBottom: 0 },
  statCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  statVal: { fontSize: 34, fontFamily: MP_FONT.displayBold, marginBottom: 4, textAlign: 'center' },
  statLabel: { fontSize: 12, fontFamily: MP_FONT.bodySemi, textAlign: 'center' },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  specTile: {
    width: '47%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  specIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', marginTop: 10, gap: 4 },
  priceGradient: { fontSize: 42, fontFamily: MP_FONT.displayBold },
  trialBox: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 14 },
  profileFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
});
