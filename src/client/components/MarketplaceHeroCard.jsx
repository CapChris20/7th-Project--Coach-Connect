import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

/** Cohesive accent rim (pink → purple). Not full-spectrum / rainbow. */
const ACCENT_BORDER_GRADIENT = ['#FF6B9D', '#E879C8', '#C084FC', '#A855F7', '#FF6B9D'];

const CHECK_COLORS = ['#FF6B9D', '#64D2FF', '#F97316', '#C084FC'];

const BENEFITS = [
  'Custom Workout Plans',
  'Live Coaching Support',
  'Real-Time Progress Tracking',
  'Message & Schedule Sessions',
];

/**
 * Premium hero for the trainer marketplace on the client home screen.
 */
export default function MarketplaceHeroCard({ onPress, notificationCount = 0, isDark = true /* design is dark-first */ }) {
  const innerBg = isDark ? '#0A0A0F' : '#F8F9FC';
  const headlineColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const subColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.62)';
  const benefitTextColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,15,0.85)';
  const labelColor = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)';

  return (
    <View style={styles.outer} accessibilityRole="summary" accessibilityLabel="Trainer marketplace">
      <LinearGradient
        colors={ACCENT_BORDER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderRing, isDark ? styles.borderRingShadowDark : styles.borderRingShadowLight]}
      >
        <View style={[styles.innerCard, { backgroundColor: innerBg }]}>
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.innerWash,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'transparent' },
            ]}
            pointerEvents="none"
          />
          <View style={styles.content}>
            <Text style={[styles.label, { color: labelColor }]}>Trainer Marketplace</Text>

            <Text style={[styles.headline, { color: headlineColor }]}>Find Your Perfect Coach</Text>

            <Text style={[styles.subhead, { color: subColor }]}>
              Search the marketplace, compare trainers, and connect with the coach who fits your goals and style.
            </Text>

            <View style={styles.benefits}>
              {BENEFITS.map((line, i) => (
                <View key={line} style={styles.benefitRow}>
                  <Ionicons name="checkmark-circle" size={18} color={CHECK_COLORS[i % CHECK_COLORS.length]} style={styles.checkIcon} />
                  <Text style={[styles.benefitText, { color: benefitTextColor }]}>{line}</Text>
                </View>
              ))}
            </View>

            <LinearGradient
              colors={['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={styles.ctaTouchable} accessibilityRole="button" accessibilityLabel="Browse trainers">
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <Text style={styles.ctaText}>Browse Trainers</Text>
                {notificationCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{notificationCount > 99 ? '99+' : notificationCount}</Text>
                  </View>
                ) : null}
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  borderRing: {
    borderRadius: 24,
    padding: 2.5,
  },
  borderRingShadowDark: {
    shadowColor: '#C084FC',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 8,
  },
  borderRingShadowLight: {
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  innerCard: {
    borderRadius: 21,
    overflow: 'hidden',
  },
  innerWash: {
    zIndex: 0,
  },
  content: {
    padding: 20,
    gap: 14,
    zIndex: 1,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  subhead: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  benefits: {
    gap: 8,
    marginTop: 2,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    marginTop: 1,
  },
  benefitText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  ctaGradient: {
    borderRadius: 16,
    marginTop: 4,
    overflow: 'hidden',
  },
  ctaTouchable: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
});
