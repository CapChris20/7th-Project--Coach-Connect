import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, ActivityIndicator, Image,
  Animated, Dimensions, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, getDoc, doc, query, where } from 'firebase/firestore';
import { auth, db } from '../../app/config';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import ReviewSubmitSheet from '../../shared/components/ReviewSubmitSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const C = {
  bg: '#0A0A0F',
  card: 'rgba(255,255,255,0.05)',
  cardBorder: 'rgba(255,255,255,0.08)',
  glassPill: 'rgba(255,255,255,0.06)',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.60)',
  textMuted: 'rgba(255,255,255,0.40)',
  textOverline: 'rgba(255,255,255,0.45)',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#06B6D4',
  orange: '#F97316',
  emerald: '#10B981',
  green: '#22c55e',
  blue: '#3b82f6',
  divider: 'rgba(255,255,255,0.08)',
};

// Gradient borders for cards (design system palette)
const CARD_GRADIENTS = [
  [C.pink, C.purple],      // Pink → Purple
  [C.cyan, C.pink],        // Cyan → Pink
  [C.purple, C.orange],    // Purple → Orange
  [C.orange, C.pink],      // Orange → Pink
  [C.cyan, C.orange],      // Cyan → Orange
  [C.emerald, C.cyan],     // Emerald → Cyan
];

// Feature icons for "What You Get" section
const FEATURES = [
  { icon: 'fitness', label: 'Custom Workouts', color: C.pink },
  { icon: 'nutrition', label: 'Nutrition Plans', color: C.purple },
  { icon: 'chatbubbles', label: 'Direct Chat', color: C.cyan },
  { icon: 'calendar', label: 'Session Booking', color: C.orange },
  { icon: 'bar-chart', label: 'Progress Tracking', color: C.emerald },
  { icon: 'videocam', label: 'Video Calls', color: C.blue },
];

// Glass morphism card with gradient border
function GradientBorderCard({ colors, children, style }) {
  return (
    <View style={[s.gradientBorderWrapper, style]}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.gradientBorder}
      >
        <View style={s.gradientInner}>
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

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
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Animation refs
  const statsAnimations = useRef([...FEATURES].map(() => new Animated.Value(0))).current;
  const reviewFadeAnim = useRef(new Animated.Value(0)).current;

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
        if (mounted) {
          setReviews(list);
          Animated.timing(reviewFadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }).start();
        }

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

  const canShowReviewButton = currentUserId && currentUserId !== trainerId && hasRelationship;
  const gradient = trainer.gradientColors || CARD_GRADIENTS[trainerIndex % CARD_GRADIENTS.length];
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* ===== HERO SECTION ===== */}
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
            <Text style={s.heroName}>
              {trainer.displayName || trainer.name || 'Unknown'}
            </Text>
            {trainer.specialty ? (
              <Text style={s.heroSpecialty}>
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

        {/* ===== QUICK STATS (3 gradient cards) ===== */}
        <View style={s.statsWrapper}>
          <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'space-between' }}>
            {/* Stats Card 1: Rating */}
            {reviewCount > 0 ? (
              <GradientBorderCard
                colors={CARD_GRADIENTS[0]}
                style={{ flex: 1 }}
              >
                <View style={s.statCardContent}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={s.statCardValue}>{ratingValue.toFixed(1)}</Text>
                    <Ionicons name="star" size={16} color={C.orange} />
                  </View>
                  <Text style={s.statCardLabel}>Rating</Text>
                </View>
              </GradientBorderCard>
            ) : null}

            {/* Stats Card 2: Experience */}
            {experienceLabel ? (
              <GradientBorderCard
                colors={CARD_GRADIENTS[1]}
                style={{ flex: 1 }}
              >
                <View style={s.statCardContent}>
                  <Text style={s.statCardValue}>{experienceLabel.split(' ')[0]}</Text>
                  <Text style={s.statCardLabel}>Experience</Text>
                </View>
              </GradientBorderCard>
            ) : null}

            {/* Stats Card 3: Price */}
            {price != null ? (
              <GradientBorderCard
                colors={CARD_GRADIENTS[2]}
                style={{ flex: 1 }}
              >
                <View style={s.statCardContent}>
                  <Text style={s.statCardValue}>${price}</Text>
                  <Text style={s.statCardLabel}>Per Month</Text>
                </View>
              </GradientBorderCard>
            ) : null}
          </View>
        </View>

        <View style={s.content}>
          {/* ===== ABOUT SECTION ===== */}
          {(trainer.bio || trainer.trainerProfileBio || trainer.trainingPhilosophy) ? (
            <GradientBorderCard colors={CARD_GRADIENTS[3]}>
              <Text style={s.sectionTitle}>About</Text>
              <Text style={s.sectionBody}>
                {trainer.bio || trainer.trainerProfileBio || trainer.trainingPhilosophy}
              </Text>
            </GradientBorderCard>
          ) : null}

          {/* ===== WHAT YOU GET ===== */}
          <GradientBorderCard colors={CARD_GRADIENTS[4]}>
            <Text style={s.sectionTitle}>What You Get</Text>
            <View style={s.featuresGrid}>
              {FEATURES.map((feature, idx) => (
                <View key={feature.label} style={s.featureItem}>
                  <View style={[s.featureIcon, { backgroundColor: `${feature.color}22` }]}>
                    <Ionicons name={feature.icon} size={20} color={feature.color} />
                  </View>
                  <Text style={s.featureLabel}>{feature.label}</Text>
                </View>
              ))}
            </View>
          </GradientBorderCard>

          {/* ===== SPECIALTIES & TAGS ===== */}
          {specialties.length > 0 ? (
            <GradientBorderCard colors={CARD_GRADIENTS[5]}>
              <Text style={s.sectionTitle}>Specialties</Text>
              <View style={s.pillRow}>
                {specialties.map(sp => (
                  <View key={sp} style={[s.pill, { backgroundColor: C.glassPill, borderWidth: 1, borderColor: 'rgba(192,132,252,0.3)' }]}>
                    <Text style={[s.pillText, { color: C.purple }]}>{formatLabel(sp)}</Text>
                  </View>
                ))}
              </View>
            </GradientBorderCard>
          ) : null}

          {certifications.length > 0 ? (
            <GradientBorderCard colors={CARD_GRADIENTS[0]}>
              <Text style={s.sectionTitle}>Certifications</Text>
              <View style={s.pillRow}>
                {certifications.map(cert => (
                  <View key={cert} style={[s.pill, { backgroundColor: C.glassPill, borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)' }]}>
                    <Text style={[s.pillText, { color: C.cyan }]}>{formatLabel(cert)}</Text>
                  </View>
                ))}
              </View>
            </GradientBorderCard>
          ) : null}

          {/* ===== REVIEWS SECTION ===== */}
          <GradientBorderCard colors={CARD_GRADIENTS[1]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: reviewCount > 0 ? 16 : 0 }}>
              <Text style={s.sectionTitle}>Reviews</Text>
              {canShowReviewButton && (
                <TouchableOpacity
                  onPress={() => setShowReviewSheet(true)}
                  style={s.reviewButtonSmall}
                >
                  <Text style={s.reviewButtonSmallText}>
                    {existingReview ? 'Edit' : 'Leave Review'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {reviewsLoading ? (
              <ActivityIndicator size="small" color={C.pink} style={{ paddingVertical: 16 }} />
            ) : reviewCount > 0 ? (
              <Animated.View style={{ opacity: reviewFadeAnim }}>
                {/* Rating Summary */}
                <View style={s.ratingSummary}>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                    <Text style={s.ratingNumber}>{ratingValue.toFixed(1)}</Text>
                    <View style={{ flexDirection: 'row', gap: 2 }}>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Ionicons key={i} name="star" size={14} color={i <= Math.round(ratingValue) ? C.orange : 'rgba(255,255,255,0.2)'} />
                      ))}
                    </View>
                  </View>
                  <Text style={s.reviewCountText}>Based on {reviewCount} reviews</Text>
                </View>

                {/* Review Cards */}
                {displayedReviews.map((rev, idx) => {
                  const expanded = expandedReviewId === rev.id;
                  const hasMore = rev.text && rev.text.length > 100;
                  const displayText = hasMore && !expanded ? rev.text.slice(0, 100) + '...' : (rev.text || '');
                  const ts = rev.updatedAt?.toDate?.() ?? rev.createdAt?.toDate?.() ?? null;
                  const dateStr = ts ? `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][ts.getMonth()]} ${ts.getFullYear()}` : '';
                  const borderColor = CARD_GRADIENTS[idx % CARD_GRADIENTS.length][0];
                  
                  return (
                    <View key={rev.id} style={[s.reviewCard, { borderLeftColor: borderColor, borderLeftWidth: 3 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={s.reviewerName}>{rev.clientFirstName || 'Client'}</Text>
                        <Text style={s.reviewDate}>{dateStr}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 2, marginBottom: 8 }}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Ionicons key={i} name="star" size={12} color={i <= (rev.rating || 0) ? C.orange : 'rgba(255,255,255,0.2)'} />
                        ))}
                      </View>
                      {displayText ? (
                        <>
                          <Text style={s.reviewText} numberOfLines={expanded ? undefined : 3}>
                            "{displayText}"
                          </Text>
                          {hasMore && (
                            <TouchableOpacity onPress={() => setExpandedReviewId(expanded ? null : rev.id)} style={{ marginTop: 8 }}>
                              <Text style={s.readMoreText}>{expanded ? 'Show less' : 'Read more'}</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      ) : null}
                    </View>
                  );
                })}

                {/* See All Reviews Link */}
                {reviews.length > 3 && !showAllReviews && (
                  <TouchableOpacity onPress={() => setShowAllReviews(true)} style={s.seeAllReviews}>
                    <Text style={s.seeAllReviewsText}>See all {reviewCount} reviews →</Text>
                  </TouchableOpacity>
                )}
              </Animated.View>
            ) : (
              <View style={s.emptyState}>
                <Ionicons name="star-outline" size={40} color="rgba(255,255,255,0.3)" />
                <Text style={s.emptyStateText}>No reviews yet</Text>
              </View>
            )}
          </GradientBorderCard>

          {/* ===== PRICING SECTION ===== */}
          {price != null ? (
            <GradientBorderCard colors={[C.pink, C.purple]}>
              <View style={s.pricingContent}>
                <View>
                  <Text style={s.priceLabel}>Monthly Rate</Text>
                  <Text style={s.priceValue}>${price}/mo</Text>
                </View>
              </View>
              
              <View style={s.pricingFeatures}>
                <View style={s.priceFeature}>
                  <Ionicons name="checkmark-circle" size={16} color={C.green} />
                  <Text style={s.priceFeatureText}>Custom Workouts</Text>
                </View>
                <View style={s.priceFeature}>
                  <Ionicons name="checkmark-circle" size={16} color={C.green} />
                  <Text style={s.priceFeatureText}>Nutrition Guidance</Text>
                </View>
                <View style={s.priceFeature}>
                  <Ionicons name="checkmark-circle" size={16} color={C.green} />
                  <Text style={s.priceFeatureText}>Direct Messaging</Text>
                </View>
              </View>

              <View style={s.trialCallout}>
                <Ionicons name="gift" size={18} color={C.pink} />
                <Text style={s.trialText}>FREE 3-5 day trial — no card required</Text>
              </View>
            </GradientBorderCard>
          ) : null}

          {/* ===== LOCATION & INFO ===== */}
          {trainer.location || trainer.isRemote ? (
            <View style={s.socialProof}>
              <View style={s.socialProofItem}>
                <Ionicons name="checkmark-circle" size={16} color={C.cyan} />
                <Text style={s.socialProofText}>Verified on CoachConnect</Text>
              </View>
              <View style={s.socialProofItem}>
                <Ionicons name="time" size={16} color={C.cyan} />
                <Text style={s.socialProofText}>Responds within 2 hours</Text>
              </View>
              <View style={s.socialProofItem}>
                <Ionicons name="calendar" size={16} color={C.cyan} />
                <Text style={s.socialProofText}>Member since June 2024</Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ===== CTA BUTTONS ===== */}
      <View style={s.ctaContainer}>
        <TouchableOpacity
          onPress={() => onConnect ? onConnect(trainer) : undefined}
          activeOpacity={0.88}
          disabled={connecting}
          style={{ flex: 1, borderRadius: 14, overflow: 'hidden', marginRight: 8 }}
        >
          <LinearGradient
            colors={[C.purple, C.pink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaButtonSecondary}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                <Text style={s.ctaButtonText}>Message</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleConnect(trainer)}
          activeOpacity={0.88}
          disabled={connecting}
          style={{ flex: 1, borderRadius: 14, overflow: 'hidden', marginLeft: 8 }}
        >
          <LinearGradient
            colors={[C.pink, C.orange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaButtonPrimary}
          >
            {connecting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="flash" size={18} color="#fff" />
                <Text style={s.ctaButtonText}>
                  Connect with {(trainer.displayName || trainer.name || 'Coach').trim().split(/\s+/)[0]}
                </Text>
              </>
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
  // ===== HERO SECTION =====
  hero: { paddingBottom: 28 },
  heroBody: { alignItems: 'center', paddingTop: 4 },
  avatar: { 
    width: 80, 
    height: 80, 
    borderRadius: 40, 
    backgroundColor: 'rgba(0,0,0,0.2)', 
    borderWidth: 2, 
    borderColor: 'rgba(255,255,255,0.25)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: 12 
  },
  avatarInitials: { fontSize: 28, fontWeight: '800', color: '#FFFFFF', letterSpacing: 1 },
  heroName: { fontSize: 28, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSpecialty: { fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  badgeRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  // ===== GRADIENT BORDER CARDS =====
  gradientBorderWrapper: { marginHorizontal: 16, marginVertical: 8 },
  gradientBorder: { borderRadius: 24, padding: 1.5 },
  gradientInner: { 
    borderRadius: 22, 
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 20,
  },

  // ===== STATS SECTION =====
  statsWrapper: { paddingHorizontal: 16, marginTop: -18, zIndex: 10, marginBottom: 8 },
  statCardContent: { alignItems: 'center', gap: 4 },
  statCardValue: { fontSize: 20, fontWeight: '700', color: C.text },
  statCardLabel: { fontSize: 10, color: C.textMuted, textAlign: 'center', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },

  // ===== CONTENT SECTIONS =====
  content: { paddingTop: 4 },
  sectionTitle: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: C.text, 
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: { fontSize: 13, color: C.textSecondary, lineHeight: 21 },

  // ===== FEATURES GRID =====
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureItem: {
    width: '31%',
    alignItems: 'center',
    gap: 8,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSecondary,
    textAlign: 'center',
  },

  // ===== SPECIALTIES / PILLS =====
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { backgroundColor: C.glassPill, borderRadius: 20, paddingVertical: 6, paddingHorizontal: 12 },
  pillText: { fontSize: 11, fontWeight: '500', color: C.textSecondary },

  // ===== REVIEWS SECTION =====
  reviewButtonSmall: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255,107,157,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.3)',
  },
  reviewButtonSmallText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.pink,
  },

  ratingSummary: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  ratingNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: C.text,
  },
  reviewCountText: {
    fontSize: 12,
    color: C.textMuted,
    marginTop: 4,
  },

  reviewCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  reviewerName: {
    fontSize: 13,
    fontWeight: '600',
    color: C.text,
  },
  reviewDate: {
    fontSize: 11,
    color: C.textMuted,
  },
  reviewText: {
    fontSize: 12,
    color: C.textSecondary,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  readMoreText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.pink,
  },

  seeAllReviews: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  seeAllReviewsText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.pink,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyStateText: {
    fontSize: 14,
    color: C.textMuted,
    marginTop: 8,
  },

  // ===== PRICING SECTION =====
  pricingContent: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.divider,
  },
  priceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: C.text,
  },

  pricingFeatures: {
    gap: 8,
    marginBottom: 12,
  },
  priceFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  priceFeatureText: {
    fontSize: 13,
    color: C.textSecondary,
  },

  trialCallout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,107,157,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.2)',
  },
  trialText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.pink,
    flex: 1,
  },

  // ===== SOCIAL PROOF =====
  socialProof: {
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  socialProofItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  socialProofText: {
    fontSize: 12,
    color: C.textMuted,
  },

  // ===== CTA BUTTONS =====
  ctaContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: 'rgba(10,10,15,0.95)',
    borderTopWidth: 1,
    borderTopColor: C.divider,
  },
  ctaButtonSecondary: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaButtonPrimary: {
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  ctaButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});

export default TrainerProfileScreen;
