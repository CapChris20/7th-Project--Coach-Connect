import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { auth, db } from '../../app/config';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import ReviewSubmitSheet from '../../shared/components/ReviewSubmitSheet';

const C = {
  bg: '#0A0A0A',
  card: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
  glassPill: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.5)',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
  emerald: '#10B981',
  divider: 'rgba(255,255,255,0.08)',
};

const CARD_GRADIENTS = [
  [C.cyan, C.purple],
  [C.pink, C.orange],
  [C.emerald, C.cyan],
  [C.purple, C.pink],
  ['#3b82f6', '#a855f7'],
  ['#22c55e', '#06b6d4'],
];

const formatExperience = (val) => {
  if (!val) return null;
  const map = {
    less_than_1: '<1 year',
    '1_2': '1-2 years',
    '3_5': '3-5 years',
    '5_8': '5-8 years',
    '6_10': '5-8 years',
    '8_plus': '8+ years',
    '10_plus': '8+ years',
  };
  return map[val] || val;
};

const formatLabel = (val) => {
  if (!val) return '';
  const str = String(val);
  return str
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

const TrainerProfileScreen = ({
  trainer,
  trainerIndex = 0,
  onBack,
  onConnect,
  onRequestTrainer,
  connecting = false,
  isDark = true,
  onProfilePress,
  onSettingsPress,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
  onReviewSubmitComplete,
}) => {
  const trainerId = trainer?.id;
  const currentUserId = auth?.currentUser?.uid;

  const [reviews, setReviews] = useState([]);
  const [hasRelationship, setHasRelationship] = useState(false);
  const [existingReview, setExistingReview] = useState(null);
  const [showReviewSheet, setShowReviewSheet] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState(null);
  const [reviewsLoading, setReviewsLoading] = useState(true);

  useEffect(() => {
    if (!trainerId || !db) {
      setReviews([]);
      setHasRelationship(false);
      setExistingReview(null);
      setReviewsLoading(false);
      return;
    }
    let mounted = true;
    (async () => {
      try {
        if (currentUserId) {
          const linkRef = doc(db, 'trainer_client_links', `${trainerId}_${currentUserId}`);
          const linkSnap = await getDoc(linkRef);
          if (mounted) setHasRelationship(!!linkSnap?.exists?.());
        }
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('trainerId', '==', trainerId)
        );
        const reviewsSnap = await getDocs(reviewsQuery);
        const list = reviewsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = a.updatedAt?.toMillis?.() ?? a.updatedAt ?? 0;
          const tb = b.updatedAt?.toMillis?.() ?? b.updatedAt ?? 0;
          return tb - ta;
        });
        if (mounted) setReviews(list);

        if (currentUserId) {
          const reviewId = `${trainerId}_${currentUserId}`;
          const myReview = list.find((r) => r.id === reviewId);
          if (mounted) setExistingReview(myReview ? { id: myReview.id, rating: myReview.rating, text: myReview.text, createdAt: myReview.createdAt } : null);
        }
      } catch (e) {
        if (mounted) setReviews([]);
      } finally {
        if (mounted) setReviewsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [trainerId, currentUserId]);

  if (!trainer) return null;
  const initials = (trainer.displayName || trainer.name || '??')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isAvailable = trainer.available !== false && trainer.availability !== 'Waitlist';
  const specialties = trainer.specialties || trainer.specializations || trainer.categories || [];
  const certifications = trainer.certifications || [];
  const tags = trainer.tags || [];
  const handleConnect = onConnect || onRequestTrainer || (() => {});
  const price = trainer.price != null ? trainer.price : (trainer.pricing?.perMonth ?? trainer.rate ?? null);
  const experienceLabel = formatExperience(trainer.experienceRange || trainer.yearsExperience);
  const reviewCount = trainer.reviewCount ?? reviews.length;
  const ratingValue = trainer.rating != null ? Number(trainer.rating) : (reviews.length ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length : 0);

  const bgColor = isDark ? C.bg : '#FFFFFF';
  const cardBg = isDark ? C.card : '#FFFFFF';
  const cardBorder = isDark ? C.cardBorder : '#E2E8F0';
  const textPrimary = isDark ? C.text : '#0F172A';
  const textMuted = isDark ? C.muted : '#64748B';

  const canShowReviewButton = currentUserId && currentUserId !== trainerId && hasRelationship;
  const gradient = trainer.gradientColors || CARD_GRADIENTS[trainerIndex % CARD_GRADIENTS.length];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: bgColor }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >

        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroBody}>
            <View style={[s.avatar, { overflow: 'hidden' }]}>
              {trainer.photoURL ? (
                <Image source={{ uri: trainer.photoURL }} style={{ width: 80, height: 80 }} />
              ) : (
                <Text style={[s.avatarInitials, { color: '#FFFFFF' }]}>{initials}</Text>
              )}
            </View>
            <Text style={[s.heroName, { color: '#FFFFFF' }]}>
              {trainer.displayName || trainer.name || 'Unknown'}
            </Text>
            {trainer.specialty ? (
              <Text style={[s.heroSpecialty, { color: 'rgba(255,255,255,0.85)' }]}>
                {formatLabel(trainer.specialty)}
              </Text>
            ) : null}
            <View style={s.badgeRow}>
              <View style={[s.badge, { backgroundColor: isAvailable ? 'rgba(16,185,129,0.25)' : 'rgba(249,115,22,0.25)' }]}>
                <Text style={[s.badgeText, { color: isAvailable ? C.emerald : C.orange }]}>
                  {isAvailable ? 'Available' : (trainer.availability || 'Waitlist')}
                </Text>
              </View>
              {trainer.isRemote ? (
                <View style={[s.badge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                  <Ionicons name="videocam-outline" size={11} color="rgba(255,255,255,0.8)" style={{ marginRight: 3 }} />
                  <Text style={[s.badgeText, { color: 'rgba(255,255,255,0.8)' }]}>Remote</Text>
                </View>
              ) : null}
            </View>
          </View>
        </LinearGradient>

        <View style={s.statsWrapper}>
          <View style={[s.statsCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* Ratings intentionally hidden until real review system is wired */}
            {experienceLabel ? (
              <>
                <View style={s.statItem}>
                  <Text style={[s.statValue, { color: textPrimary }]}>{experienceLabel}</Text>
                  <Text style={[s.statLabel, { color: textMuted }]}>Experience</Text>
                </View>
                <View style={s.statDivider} />
              </>
            ) : null}
            {price != null ? (
              <View style={s.statItem}>
                <Text style={[s.statValue, { color: C.pink }]}>${price}</Text>
                <Text style={[s.statLabel, { color: textMuted }]}>Per month</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={s.content}>
          {(trainer.location) ? (
            <View style={[s.section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={s.detailRow}>
                {trainer.location ? (
                  <View style={s.detailItem}>
                    <View style={s.detailIcon}><Ionicons name="location-outline" size={18} color={C.pink} /></View>
                    <View>
                      <Text style={[s.detailLabel, { color: textMuted }]}>Location</Text>
                      <Text style={[s.detailValue, { color: textPrimary }]}>
                        {trainer.isRemote ? 'Remote Sessions' : trainer.location}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {(trainer.bio || trainer.trainingPhilosophy) ? (
            <View style={[s.section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>About</Text>
              <Text style={[s.sectionBody, { color: textMuted }]}>{trainer.bio || trainer.trainingPhilosophy}</Text>
            </View>
          ) : null}

          <View style={[s.section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: reviewCount > 0 ? 12 : 0 }}>
              <Text style={[s.sectionTitle, { color: textPrimary, marginBottom: 0 }]}>Reviews</Text>
              {canShowReviewButton && (
                <TouchableOpacity
                  onPress={() => setShowReviewSheet(true)}
                  style={{
                    height: 36,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: C.pink,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: C.pink }}>
                    {existingReview ? 'Edit Review' : 'Leave a Review'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            {reviewsLoading ? (
              <ActivityIndicator size="small" color={C.pink} style={{ paddingVertical: 16 }} />
            ) : reviewCount > 0 ? (
              <>
                <View style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 36, fontWeight: '700', color: textPrimary }}>{ratingValue.toFixed(1)}</Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons key={i} name="star" size={16} color={C.orange} />
                      ))}
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, color: textMuted, marginTop: 4 }}>Based on {reviewCount} reviews</Text>
                </View>
                {reviews.map((rev) => {
                  const expanded = expandedReviewId === rev.id;
                  const hasMore = rev.text && rev.text.length > 100;
                  const displayText = hasMore && !expanded ? rev.text.slice(0, 100) + '...' : (rev.text || '');
                  const ts = rev.updatedAt?.toDate?.() ?? rev.createdAt?.toDate?.() ?? null;
                  const dateStr = ts ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][ts.getMonth()]} ${ts.getFullYear()}` : '';
                  return (
                    <View key={rev.id} style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: textPrimary }}>{rev.clientFirstName || 'Client'}</Text>
                        <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{dateStr}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 2, marginTop: 4 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons key={i} name="star" size={13} color={i <= (rev.rating || 0) ? C.orange : 'rgba(255,255,255,0.2)'} />
                        ))}
                      </View>
                      {displayText ? (
                        <>
                          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 6 }} numberOfLines={expanded ? undefined : 3}>
                            {displayText}
                          </Text>
                          {hasMore && (
                            <TouchableOpacity onPress={() => setExpandedReviewId(expanded ? null : rev.id)} style={{ marginTop: 4 }}>
                              <Text style={{ fontSize: 12, fontWeight: '600', color: C.pink }}>{expanded ? 'Show less' : 'Read more'}</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : null}
                    </View>
                  );
                })}
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                <Ionicons name="star-outline" size={40} color="rgba(255,255,255,0.3)" />
                <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>No reviews yet</Text>
              </View>
            )}
          </View>

          {specialties.length > 0 ? (
            <View style={[s.section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>Specialties</Text>
              <View style={s.pillRow}>
                {specialties.map(sp => (
                  <View key={sp} style={[s.pill, s.pillPurple]}>
                    <Text style={[s.pillText, { color: C.purple }]}>{formatLabel(sp)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {certifications.length > 0 ? (
            <View style={[s.section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>Certifications</Text>
              <View style={s.pillRow}>
                {certifications.map(cert => (
                  <View key={cert} style={[s.pill, s.pillCyan]}>
                    <Text style={[s.pillText, { color: C.cyan }]}>{formatLabel(cert)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {tags.length > 0 ? (
            <View style={[s.section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <View style={s.pillRow}>
                {tags.map(tag => (
                  <View key={tag} style={s.pill}>
                    <Text style={[s.pillText, { color: textMuted }]}>{formatLabel(tag)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {trainer.credentials ? (
            <View style={[s.section, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Text style={[s.sectionTitle, { color: textPrimary }]}>Credentials</Text>
              <Text style={[s.sectionBody, { color: textMuted }]}>{trainer.credentials}</Text>
            </View>
          ) : null}
        </View>

      </ScrollView>

      <View style={s.cta}>
        <TouchableOpacity
          onPress={() => handleConnect(trainer)}
          activeOpacity={0.88}
          disabled={connecting}
          style={{ borderRadius: 16, overflow: 'hidden' }}
        >
          <LinearGradient
            colors={[C.purple, C.pink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaBtn}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={s.ctaBtnText}>
                {price ? `Request Trainer — $${price}/mo` : 'Request Trainer'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {(onHomePress || onPlusPress || onMessagesPress) && (
        <BottomNavBar
          onHomePress={onHomePress}
          onPlusPress={onPlusPress}
          onVoicePress={onVoicePress}
          onNutritionPress={onNutritionPress}
          onWorkoutPress={onWorkoutPress}
          onMessagesPress={onMessagesPress}
          onProfilePress={onProfilePress}
        />
      )}

      <ReviewSubmitSheet
        visible={showReviewSheet}
        onClose={() => setShowReviewSheet(false)}
        onSubmitComplete={() => {
          setShowReviewSheet(false);
          onReviewSubmitComplete?.();
        }}
        trainerName={trainer.displayName || trainer.name}
        trainerId={trainerId}
        clientId={currentUserId}
        clientFirstName={auth?.currentUser?.displayName?.split(' ')[0] || null}
        existingReview={existingReview}
      />
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  hero: { paddingBottom: 28 },
  heroBody: { alignItems: 'center', paddingTop: 4 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  heroName: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  heroSpecialty: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  statsWrapper: { paddingHorizontal: 16, marginTop: -18, zIndex: 10 },
  statsCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 17, fontWeight: '700', color: C.text },
  statLabel: { fontSize: 10, color: C.muted, textAlign: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: C.divider },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  section: { backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 18, padding: 16 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: C.text, marginBottom: 10 },
  sectionBody: { fontSize: 13, color: C.muted, lineHeight: 21 },
  detailRow: { gap: 14 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontSize: 11, color: C.muted },
  detailValue: { fontSize: 13, fontWeight: '600', color: C.text, marginTop: 1 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: C.glassPill, borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  pillPurple: { backgroundColor: 'rgba(192,132,252,0.15)', borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)' },
  pillCyan: { backgroundColor: 'rgba(100,210,255,0.12)', borderWidth: 1, borderColor: 'rgba(100,210,255,0.3)' },
  pillText: { fontSize: 11, fontWeight: '500', color: C.muted },
  cta: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    backgroundColor: 'rgba(10,10,10,0.95)',
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  ctaBtn: { borderRadius: 16, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  ctaBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default TrainerProfileScreen;
