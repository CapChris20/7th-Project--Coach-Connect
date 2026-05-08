import React, { useMemo } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';

const ACCENTS = {
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
  emerald: '#10B981',
};

function initialsFromName(name) {
  const s = String(name || '').trim();
  if (!s) return 'CC';
  return s
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function pill(label, accent, isDark) {
  return (
    <View
      style={[
        styles.pill,
        {
          borderColor: `${accent}55`,
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
        },
      ]}
    >
      <Text style={[styles.pillText, { color: accent }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export default function TrainerProfileCardModal({
  visible,
  trainer,
  onClose,
  onMessage,
  onRequestTrainer,
  accent = 'purple',
}) {
  const { isDark } = useTheme();
  const a = ACCENTS[accent] || ACCENTS.purple;

  const name = String(trainer?.displayName || trainer?.name || 'Trainer').trim();
  const headline = String(trainer?.specialty || trainer?.headline || '').trim();
  const location = String(trainer?.location || (trainer?.isRemote ? 'Remote' : '') || 'Remote').trim();
  const bio = String(trainer?.bio || trainer?.about || trainer?.description || '').trim();
  const specialties = Array.isArray(trainer?.specialties)
    ? trainer.specialties
    : Array.isArray(trainer?.specializations)
      ? trainer.specializations
      : [];
  const certifications = Array.isArray(trainer?.certifications) ? trainer.certifications : [];
  const rating = typeof trainer?.rating === 'number' ? trainer.rating : trainer?.rating ? Number(trainer.rating) : null;
  const clientCount =
    typeof trainer?.clientCount === 'number'
      ? trainer.clientCount
      : typeof trainer?.clients === 'number'
        ? trainer.clients
        : null;
  const years = typeof trainer?.experienceYears === 'number' ? trainer.experienceYears : null;

  const avatarUri = trainer?.photoURL || trainer?.avatarUrl || null;
  const initials = useMemo(() => initialsFromName(name), [name]);

  const primaryCta = typeof onMessage === 'function' ? onMessage : undefined;
  const secondaryCta = typeof onRequestTrainer === 'function' ? onRequestTrainer : undefined;

  return (
    <Modal visible={!!visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: isDark ? '#0B0B12' : '#FFFFFF' }]}>
          <View style={styles.topRow}>
            <Text style={[styles.title, { color: isDark ? '#fff' : '#0B0B12' }]}>Trainer Profile</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.6)'} />
            </TouchableOpacity>
          </View>

          <LinearGradient
            pointerEvents="none"
            colors={[`${a}26`, 'transparent']}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.heroGlow}
          />

          <View style={styles.heroRow}>
            <LinearGradient colors={[a, '#FF6B9D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatarRing}>
              <View style={[styles.avatarInner, { backgroundColor: isDark ? '#0B0B12' : '#FFFFFF' }]}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: a }]}>{initials}</Text>
                )}
              </View>
            </LinearGradient>

            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.name, { color: isDark ? '#fff' : '#0B0B12' }]} numberOfLines={2}>
                {name}
              </Text>
              {!!headline && (
                <Text style={[styles.headline, { color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.55)' }]} numberOfLines={2}>
                  {headline}
                </Text>
              )}
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)'} />
                <Text style={[styles.metaText, { color: isDark ? 'rgba(255,255,255,0.60)' : 'rgba(0,0,0,0.50)' }]} numberOfLines={1}>
                  {location}
                </Text>
              </View>

              <View style={styles.statsRow}>
                {rating ? pill(`★ ${rating.toFixed(1)}`, a, isDark) : null}
                {clientCount ? pill(`${clientCount} clients`, a, isDark) : null}
                {years ? pill(`${years}+ yrs`, a, isDark) : null}
              </View>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
            {(specialties?.length || 0) > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.7)' }]}>
                  Specialties
                </Text>
                <View style={styles.chipsRow}>
                  {specialties.slice(0, 10).map((s, idx) => (
                    <View key={`${s}_${idx}`} style={[styles.chip, { borderColor: `${a}40`, backgroundColor: `${a}12` }]}>
                      <Text style={[styles.chipText, { color: isDark ? '#fff' : '#0B0B12' }]} numberOfLines={1}>
                        {String(s)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {(certifications?.length || 0) > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.7)' }]}>
                  Certifications
                </Text>
                <View style={{ gap: 8 }}>
                  {certifications.slice(0, 8).map((c, idx) => (
                    <View key={`${c}_${idx}`} style={[styles.rowItem, { borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                      <Ionicons name="ribbon-outline" size={16} color={a} />
                      <Text style={[styles.rowItemText, { color: isDark ? 'rgba(255,255,255,0.80)' : 'rgba(0,0,0,0.65)' }]} numberOfLines={2}>
                        {String(c)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: isDark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.7)' }]}>
                About
              </Text>
              <Text style={[styles.body, { color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.55)' }]}>
                {bio || 'This coach hasn’t added a bio yet.'}
              </Text>
            </View>
          </ScrollView>

          <View style={styles.ctaRow}>
            <TouchableOpacity
              disabled={!secondaryCta}
              onPress={secondaryCta}
              activeOpacity={0.9}
              style={[
                styles.secondaryBtn,
                {
                  opacity: secondaryCta ? 1 : 0.6,
                  borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                },
              ]}
            >
              <Ionicons name="person-add-outline" size={18} color={isDark ? '#fff' : '#0B0B12'} />
              <Text style={[styles.secondaryText, { color: isDark ? '#fff' : '#0B0B12' }]}>Request Trainer</Text>
            </TouchableOpacity>

            <TouchableOpacity
              disabled={!primaryCta}
              onPress={primaryCta}
              activeOpacity={0.9}
              style={styles.primaryBtnWrap}
            >
              <LinearGradient colors={[a, '#FF6B9D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryBtn}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
                <Text style={styles.primaryText}>Message</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    maxHeight: '86%',
    overflow: 'hidden',
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '900', letterSpacing: 0.2 },
  closeBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 12, zIndex: 5 },
  heroGlow: { ...StyleSheet.absoluteFillObject },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 12, marginBottom: 12 },
  avatarRing: { width: 74, height: 74, borderRadius: 37, padding: 2 },
  avatarInner: { flex: 1, borderRadius: 35, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitials: { fontSize: 18, fontWeight: '900' },
  name: { fontSize: 18, fontWeight: '900', letterSpacing: -0.2 },
  headline: { marginTop: 4, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  metaRow: { marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, fontWeight: '700' },
  statsRow: { marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '900' },
  section: { marginTop: 10 },
  sectionTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 10 },
  body: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: '800' },
  rowItem: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1 },
  rowItemText: { flex: 1, fontSize: 13, fontWeight: '700', lineHeight: 18 },
  ctaRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  secondaryBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryText: { fontSize: 13, fontWeight: '900' },
  primaryBtnWrap: { flex: 1 },
  primaryBtn: { height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});

