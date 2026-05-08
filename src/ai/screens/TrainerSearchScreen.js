import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Modal,
  Animated,
  Dimensions,
  Image,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { db, storage } from '../../app/config';
import { trainerPhotoUri, resolveTrainerPhotoWithStorageFallback } from '../../shared/utils/trainerProfileMedia';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import BottomNavBar from '../../navigation/BottomNavBar';
import TrainerRequestConfirmModal from '../../marketplace/components/TrainerRequestConfirmModal';
import { useTheme } from '../../shared/ui/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

/** No in-app review surface yet — hide ratings/reviews and related filters (Firestore may still have legacy/seeded values). */
const MARKETPLACE_SHOW_REVIEWS = false;

const BORDER_COLORS = ['pink', 'cyan', 'orange', 'purple'];
const COLOR_MAP = {
  pink: { border: '#FF6B9D', gradient: ['#FF6B9D', '#C084FC'] },
  cyan: { border: '#64D2FF', gradient: ['#64D2FF', '#C084FC'] },
  orange: { border: '#F97316', gradient: ['#F97316', '#FF6B9D'] },
  purple: { border: '#C084FC', gradient: ['#C084FC', '#64D2FF'] },
};

const C = {
  bgDark: '#0A0A0F',
  bgLight: '#F5F5F5',
  panelDark: '#0A0A0F',
  panelLight: '#F5F5F5',
  cardDark: '#13131A',
  cardLight: '#FFFFFF',
  cardBorderDark: 'rgba(255,255,255,0.1)',
  cardBorderLight: 'rgba(10,10,15,0.1)',
  inputDark: 'rgba(255,255,255,0.05)',
  inputLight: 'rgba(0,0,0,0.05)',
  glassPillDark: 'rgba(255,255,255,0.06)',
  glassPillLight: 'rgba(15,23,42,0.04)',
  skeletonDark: 'rgba(255,255,255,0.08)',
  skeletonLight: '#E5E7EB',
  textDark: '#FFFFFF',
  textLight: '#0A0A0F',
  mutedDark: 'rgba(255,255,255,0.55)',
  mutedLight: 'rgba(10,10,15,0.6)',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
  dividerDark: 'rgba(255,255,255,0.1)',
  dividerLight: 'rgba(10,10,15,0.1)',
};

const SORT_OPTIONS = MARKETPLACE_SHOW_REVIEWS
  ? ['Newest', 'Price: Low', 'Price: High', 'Top Rated']
  : ['Newest', 'Price: Low', 'Price: High'];
const SESSION_OPTIONS = ['Remote', 'In-Person', 'Both'];
const SPECIALTY_OPTIONS = ['Strength', 'Bodybuilding', 'HIIT', 'Cardio', 'Yoga', 'Pilates', 'CrossFit', 'Nutrition', 'Rehab', 'Sports', 'Weight Loss', 'Mobility'];
const EXPERIENCE_OPTIONS = ['1-2 years', '3-5 years', '5-8 years', '8+ years'];
const RATING_OPTIONS = [3.0, 3.5, 4.0, 4.5];

const INITIAL_FILTERS = {
  sortBy: 'Newest',
  availableOnly: false,
  minPrice: '',
  maxPrice: '',
  sessionType: 'Both',
  minRating: 0,
  specialties: [],
  experience: [],
};

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
  return String(val)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const getTrainerPrice = (t) => (t.price != null ? t.price : (t.pricing?.perMonth ?? t.rate ?? null));

function trainerReviewCount(t) {
  const n = t?.reviews ?? t?.reviewCount;
  return typeof n === 'number' ? n : Number(n) || 0;
}

function trainerRating(t) {
  const r = t?.rating;
  if (r == null || r === '') return null;
  const n = typeof r === 'number' ? r : Number(r);
  return Number.isFinite(n) ? n : null;
}

/** Firestore seeds `rating: 0` for new trainers — treat as “no rating yet”. */
function hasDisplayableRating(t) {
  const r = trainerRating(t);
  return r != null && r > 0;
}

function hasDisplayableReviews(t) {
  return trainerReviewCount(t) > 0;
}

function hasDisplayablePrice(t) {
  const p = getTrainerPrice(t);
  if (p == null || p === '') return false;
  const n = Number(p);
  return Number.isFinite(n) && n > 0;
}

function trainerLocationLabel(t) {
  const loc = t?.location != null ? String(t.location).trim() : '';
  const remote = !!(t?.isRemote || t?.sessionType === 'Remote');
  const st = t?.sessionType;
  const both = st === 'Both' || st === 'Hybrid';
  if (both && loc) return `${loc} · Remote`;
  if (both && !loc) return 'Hybrid';
  if (remote && loc) return `${loc} · Remote`;
  if (remote) return 'Remote';
  if (loc) return loc;
  return null;
}

function AvatarCircle({ uri, initial, gradientColors, borderColor, isDark, size = 90 }) {
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => {
    setImgFailed(false);
  }, [uri]);
  const innerRadius = size / 2 - 3;
  const showImage = uri && !imgFailed;

  return (
    <LinearGradient colors={gradientColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.avatarGradient, { width: size, height: size, borderRadius: size / 2 }]}>
      <View
        style={[
          styles.avatarInner,
          {
            width: innerRadius * 2,
            height: innerRadius * 2,
            borderRadius: innerRadius,
            backgroundColor: isDark ? C.cardDark : C.cardLight,
            borderColor,
            overflow: 'hidden',
          },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Text
            style={[
              styles.avatarInitial,
              { fontSize: Math.round(size * 0.38), color: isDark ? '#FFFFFF' : C.textLight },
            ]}
          >
            {initial}
          </Text>
        )}
      </View>
    </LinearGradient>
  );
}

const SkeletonCard = ({ isDark }) => {
  const colorData = COLOR_MAP.pink;
  return (
    <View
      style={[
        styles.card,
        {
          width: CARD_WIDTH,
          backgroundColor: isDark ? C.cardDark : C.cardLight,
          borderColor: colorData.border,
        },
      ]}
    >
      <View style={[styles.avatarGradient, { opacity: 0.35 }]}>
        <View style={[styles.avatarInner, { backgroundColor: isDark ? C.cardDark : C.cardLight }]} />
      </View>
      <View style={[styles.skeletonLine, { width: '70%', marginTop: 4 }]} />
      <View style={[styles.skeletonLine, { width: '50%', height: 8 }]} />
      <View style={[styles.skeletonLine, { width: '60%', height: 8 }]} />
    </View>
  );
};

function TrainerCard({ trainer, colorIndex, onViewProfile, onRequestTrainer, isDark }) {
  const color = BORDER_COLORS[colorIndex % BORDER_COLORS.length];
  const colorData = COLOR_MAP[color];
  const name = trainer.displayName || trainer.name || 'Trainer';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const photoUri = trainerPhotoUri(trainer);
  const specialtyRaw = trainer.specialty || (trainer.specialties && trainer.specialties[0]) || '';
  const specialtyLabel = formatLabel(specialtyRaw).trim();
  const showRatingBadge = MARKETPLACE_SHOW_REVIEWS && hasDisplayableRating(trainer);
  const showReviews = MARKETPLACE_SHOW_REVIEWS && hasDisplayableReviews(trainer);
  const showPrice = hasDisplayablePrice(trainer);
  const loc = trainerLocationLabel(trainer);
  const rVal = trainerRating(trainer);

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: colorData.border,
          backgroundColor: isDark ? C.cardDark : C.cardLight,
          width: CARD_WIDTH,
          shadowColor: colorData.border,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isDark ? 0.45 : 0.25,
          shadowRadius: 10,
          elevation: 6,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.92} onPress={() => onViewProfile(trainer, colorIndex)} style={{ width: '100%', alignItems: 'center' }}>
        {showRatingBadge ? (
          <View
            style={[
              styles.ratingBadge,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' },
            ]}
          >
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={[styles.ratingBadgeText, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>
              {rVal != null ? rVal.toFixed(1) : ''}
            </Text>
          </View>
        ) : null}

        <AvatarCircle
          key={`${trainer.id}-${photoUri || 'none'}`}
          uri={photoUri}
          initial={initial}
          gradientColors={colorData.gradient}
          borderColor={colorData.border}
          isDark={isDark}
          size={90}
        />

        <Text style={[styles.cardName, { color: isDark ? C.textDark : C.textLight }]} numberOfLines={1}>
          {name}
        </Text>

        {specialtyLabel ? (
          <View style={[styles.specialtyPill, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <Text style={[styles.specialtyPillText, { color: isDark ? '#AAA' : '#666' }]} numberOfLines={1}>
              {specialtyLabel.toUpperCase()}
            </Text>
          </View>
        ) : null}

        {loc ? (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={11} color={isDark ? C.mutedDark : C.mutedLight} />
            <Text style={[styles.locationText, { color: isDark ? C.mutedDark : C.mutedLight }]} numberOfLines={1}>
              {loc}
            </Text>
          </View>
        ) : null}

        {showReviews ? (
          <Text style={[styles.reviewsHint, { color: isDark ? C.mutedDark : C.mutedLight }]}>
            {trainerReviewCount(trainer)} reviews
          </Text>
        ) : null}

        {showPrice ? (
          <Text style={[styles.price, { color: isDark ? C.textDark : C.textLight }]}>
            ${getTrainerPrice(trainer)}
            <Text style={[styles.priceUnit, { color: isDark ? C.mutedDark : C.mutedLight }]}>/mo</Text>
          </Text>
        ) : null}
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => onViewProfile(trainer, colorIndex)}
        style={[
          styles.viewButton,
          {
            borderColor: colorData.border,
            backgroundColor: isDark ? 'transparent' : 'rgba(0,0,0,0.02)',
          },
        ]}
      >
        <Text style={[styles.viewButtonText, { color: isDark ? C.textDark : C.textLight }]}>View Profile</Text>
      </TouchableOpacity>

      <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.requestGradient}>
        <TouchableOpacity activeOpacity={0.85} onPress={() => onRequestTrainer(trainer)} style={styles.requestButton}>
          <Text style={styles.requestButtonText}>Request</Text>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const FilterSidebar = ({ isOpen, onClose, onApplyFilters, currentFilters, isDark }) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [local, setLocal] = useState(currentFilters);

  useEffect(() => {
    setLocal(currentFilters);
  }, [currentFilters]);

  const toggleArr = (key, val) =>
    setLocal((p) => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter((v) => v !== val) : [...p[key], val],
    }));

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : SCREEN_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isOpen, slideAnim]);

  const bgColor = isDark ? C.panelDark : C.panelLight;
  const borderColor = isDark ? C.dividerDark : C.dividerLight;
  const textColor = isDark ? C.textDark : C.textLight;
  const mutedColor = isDark ? C.mutedDark : C.mutedLight;
  const chipBorder = isDark ? C.cardBorderDark : C.cardBorderLight;

  return (
    <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.filterOverlay}>
        <TouchableOpacity style={styles.filterBackdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.filterSheet,
            {
              backgroundColor: bgColor,
              width: SCREEN_WIDTH * 0.82,
              transform: [{ translateX: slideAnim }],
            },
          ]}
        >
          <View style={[styles.filterHeader, { borderBottomColor: borderColor }]}>
            <Text style={[styles.filterTitle, { color: textColor }]}>Filters</Text>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: mutedColor }]}>Sort By</Text>
              <View style={styles.chipRow}>
                {SORT_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.filterChip, { borderColor: chipBorder }, local.sortBy === opt && styles.filterChipActive]}
                    onPress={() => setLocal((p) => ({ ...p, sortBy: opt }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterChipText, { color: mutedColor }, local.sortBy === opt && styles.filterChipTextActive]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {MARKETPLACE_SHOW_REVIEWS ? (
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: mutedColor }]}>Minimum Rating</Text>
              <View style={styles.chipRow}>
                {RATING_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.filterChip, { borderColor: chipBorder }, local.minRating === r && styles.filterChipActive]}
                    onPress={() => setLocal((p) => ({ ...p, minRating: p.minRating === r ? 0 : r }))}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.filterChipText, { color: mutedColor }, local.minRating === r && styles.filterChipTextActive]}>
                      ★ {r}+
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            ) : null}

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: mutedColor }]}>Specialty</Text>
              <View style={styles.chipRow}>
                {SPECIALTY_OPTIONS.map((sp) => (
                  <TouchableOpacity
                    key={sp}
                    style={[
                      styles.filterChip,
                      { borderColor: chipBorder },
                      local.specialties.includes(sp) && styles.filterChipActive,
                    ]}
                    onPress={() => toggleArr('specialties', sp)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: mutedColor },
                        local.specialties.includes(sp) && styles.filterChipTextActive,
                      ]}
                    >
                      {sp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: mutedColor }]}>Experience</Text>
              <View style={styles.chipRow}>
                {EXPERIENCE_OPTIONS.map((exp) => (
                  <TouchableOpacity
                    key={exp}
                    style={[
                      styles.filterChip,
                      { borderColor: chipBorder },
                      local.experience.includes(exp) && styles.filterChipActive,
                    ]}
                    onPress={() => toggleArr('experience', exp)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: mutedColor },
                        local.experience.includes(exp) && styles.filterChipTextActive,
                      ]}
                    >
                      {exp}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: mutedColor }]}>Availability</Text>
              <View style={styles.toggleRow}>
                <Text style={[styles.toggleLabel, { color: textColor }]}>Available Only</Text>
                <TouchableOpacity
                  onPress={() => setLocal((p) => ({ ...p, availableOnly: !p.availableOnly }))}
                  activeOpacity={0.9}
                  style={[
                    styles.toggleTrack,
                    { backgroundColor: local.availableOnly ? C.pink : isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' },
                  ]}
                >
                  <View style={[styles.toggleThumb, { marginLeft: local.availableOnly ? 22 : 2 }]} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: mutedColor }]}>Price Range</Text>
              <View style={styles.priceRow}>
                <TextInput
                  style={[
                    styles.priceInput,
                    { color: textColor, borderColor: chipBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
                  ]}
                  placeholder="Min $/mo"
                  placeholderTextColor={mutedColor}
                  value={local.minPrice}
                  onChangeText={(v) => setLocal((p) => ({ ...p, minPrice: v }))}
                  keyboardType="numeric"
                />
                <TextInput
                  style={[
                    styles.priceInput,
                    { color: textColor, borderColor: chipBorder, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' },
                  ]}
                  placeholder="Max $/mo"
                  placeholderTextColor={mutedColor}
                  value={local.maxPrice}
                  onChangeText={(v) => setLocal((p) => ({ ...p, maxPrice: v }))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={[styles.filterSection, { marginBottom: 24 }]}>
              <Text style={[styles.filterLabel, { color: mutedColor }]}>Session Type</Text>
              <View style={styles.chipRow}>
                {SESSION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    style={[styles.filterChip, { borderColor: chipBorder }, local.sessionType === opt && styles.filterChipActive]}
                    onPress={() => setLocal((p) => ({ ...p, sessionType: opt }))}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: mutedColor },
                        local.sessionType === opt && styles.filterChipTextActive,
                      ]}
                    >
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>

          <View style={[styles.filterActions, { borderTopColor: borderColor }]}>
            <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.applyGradient}>
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => {
                  onApplyFilters(local);
                  onClose();
                }}
                style={styles.applyButton}
              >
                <Text style={styles.applyButtonText}>Apply Filters</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

function specialtyIconKey(raw) {
  const s = String(raw || '').toLowerCase();
  if (s.includes('strength') || s.includes('power')) return 'barbell-outline';
  if (s.includes('yoga') || s.includes('mobility')) return 'body-outline';
  if (s.includes('cardio') || s.includes('hiit')) return 'flash-outline';
  if (s.includes('nutrition')) return 'nutrition-outline';
  if (s.includes('rehab')) return 'medical-outline';
  if (s.includes('cross')) return 'barbell-outline';
  if (s.includes('body')) return 'fitness-outline';
  return 'ribbon-outline';
}

function TrainerProfileSheet({ trainer, colorIndex, visible, onClose, onRequest, isDark, requesting }) {
  if (!trainer) return null;

  const color = BORDER_COLORS[(colorIndex ?? 0) % BORDER_COLORS.length];
  const colorData = COLOR_MAP[color];
  const name = trainer.displayName || trainer.name || 'Trainer';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const photoUri = trainerPhotoUri(trainer);
  const specialtyList = Array.isArray(trainer.specialties)
    ? trainer.specialties
    : Array.isArray(trainer.specializations)
      ? trainer.specializations
      : [];
  const certifications = Array.isArray(trainer.certifications) ? trainer.certifications : [];
  const bio = String(trainer.bio || trainer.about || trainer.description || '').trim();
  const displayRating = MARKETPLACE_SHOW_REVIEWS && hasDisplayableRating(trainer);
  const displayReviews = MARKETPLACE_SHOW_REVIEWS && hasDisplayableReviews(trainer);
  const displayPrice = hasDisplayablePrice(trainer);
  const loc = trainerLocationLabel(trainer);
  const rVal = trainerRating(trainer);
  const nReviews = trainerReviewCount(trainer);

  const pillLabels = [...specialtyList.map((s) => String(s).trim()).filter(Boolean)];
  if (trainer.specialty && String(trainer.specialty).trim()) {
    const s = String(trainer.specialty).trim();
    if (!pillLabels.some((p) => p.toLowerCase() === s.toLowerCase())) pillLabels.push(s);
  }

  const textColor = isDark ? C.textDark : C.textLight;
  const mutedColor = isDark ? C.mutedDark : C.mutedLight;
  const borderSoft = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(10,10,15,0.08)';
  const glassFill = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)';
  const sheetGrad = isDark ? ['#050508', '#0B0B12', '#0F0A14'] : ['#FAFAFD', '#F2F0F8', '#EDE8F5'];

  const kickerFor = (label) => (
    <View style={styles.profileSectionLabelRow}>
      <LinearGradient
        colors={[colorData.border, '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.profileSectionAccent}
      />
      <Text style={[styles.profileSectionKicker, { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(10,10,15,0.45)' }]}>{label}</Text>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.profileRoot}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <LinearGradient colors={sheetGrad} style={StyleSheet.absoluteFill} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />
        <View style={[styles.profileTopBar, { borderBottomColor: borderSoft }]}>
          <TouchableOpacity onPress={onClose} style={styles.profileBack} hitSlop={12}>
            <View style={[styles.profileBackChip, { borderColor: borderSoft, backgroundColor: glassFill }]}>
              <Ionicons name="chevron-back" size={22} color={textColor} />
            </View>
          </TouchableOpacity>
          <View style={styles.profileTopCenter}>
            <Text style={[styles.profileTopKicker, { color: mutedColor }]}>MARKETPLACE</Text>
            <Text style={[styles.profileTopTitle, { color: textColor }]}>Coach profile</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 130 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.profileHero}>
            <View style={{ marginBottom: 16 }}>
              <AvatarCircle
                key={`p-${trainer.id}-${photoUri || 'none'}`}
                uri={photoUri}
                initial={initial}
                gradientColors={colorData.gradient}
                borderColor={colorData.border}
                isDark={isDark}
                size={148}
              />
            </View>
            <Text style={[styles.profileName, { color: textColor }]}>{name}</Text>
            {pillLabels.length > 0 ? (
              <View style={styles.profilePills}>
                {pillLabels.map((s, idx) => (
                  <LinearGradient
                    key={`${s}-${idx}`}
                    colors={[`${colorData.border}55`, 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.profilePillGrad, { borderColor: `${colorData.border}99` }]}
                  >
                    <Text style={[styles.profilePillText, { color: isDark ? '#fff' : '#0A0A0F' }]}>{formatLabel(s).toUpperCase()}</Text>
                  </LinearGradient>
                ))}
              </View>
            ) : null}
            {loc ? (
              <View style={[styles.profileLocChip, { borderColor: borderSoft, backgroundColor: glassFill }]}>
                <Ionicons name="location-outline" size={15} color={colorData.border} />
                <Text style={[styles.profileLocText, { color: mutedColor }]}>{loc}</Text>
              </View>
            ) : null}
            {displayRating || displayReviews ? (
              <View style={styles.profileStarsRow}>
                {displayRating ? <Ionicons name="star" size={16} color="#F97316" /> : null}
                {displayRating ? (
                  <Text style={[styles.profileRatingNum, { color: textColor }]}>{rVal != null ? rVal.toFixed(1) : ''}</Text>
                ) : null}
                {displayReviews ? (
                  <Text style={[styles.profileRatingSuffix, { color: mutedColor }]}>
                    {displayRating ? `(${nReviews} reviews)` : `${nReviews} reviews`}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {bio ? (
            <View style={[styles.profilePremiumCard, { borderColor: borderSoft, backgroundColor: glassFill }]}>
              {kickerFor('About')}
              <Text style={[styles.profileBio, { color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(10,10,15,0.72)' }]}>{bio}</Text>
              {certifications.length > 0 ? (
                <View style={styles.certRow}>
                  {certifications.map((cert) => (
                    <View
                      key={String(cert)}
                      style={[
                        styles.certBadge,
                        {
                          borderColor: `${colorData.border}80`,
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(192,132,252,0.08)',
                        },
                      ]}
                    >
                      <Ionicons name="ribbon-outline" size={11} color={colorData.border} style={{ marginRight: 4 }} />
                      <Text style={[styles.certBadgeText, { color: colorData.border }]}>{cert}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {(() => {
            const listSpecs =
              specialtyList.length > 0 ? specialtyList : trainer.specialty ? [trainer.specialty] : [];
            if (!listSpecs.length) return null;
            return (
              <View style={[styles.profilePremiumCard, { borderColor: borderSoft, backgroundColor: glassFill }]}>
                {kickerFor('Specialties')}
                <View style={styles.specGrid}>
                  {listSpecs.map((s) => {
                    const icon = specialtyIconKey(s);
                    return (
                      <View
                        key={String(s)}
                        style={[styles.specTile, { borderColor: borderSoft, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.9)' }]}
                      >
                        <LinearGradient colors={[colorData.gradient[0] + '33', 'transparent']} style={styles.specTileIconBg}>
                          <Ionicons name={icon} size={22} color={colorData.border} />
                        </LinearGradient>
                        <Text style={[styles.specTileLabel, { color: textColor }]}>{formatLabel(String(s))}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })()}

          {displayPrice ? (
            <View style={styles.profilePricingWrap}>
              {kickerFor('Investment')}
              <LinearGradient
                colors={['#FF6B9D', '#64D2FF', '#C084FC', '#FF6B9D']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.pricingRing}
              >
                <View style={[styles.pricingInner, { backgroundColor: isDark ? '#08080E' : '#FFFFFF' }]}>
                  <Text style={[styles.pricingKicker, { color: mutedColor }]}>STARTING AT</Text>
                  <Text style={[styles.pricingAmount, { color: textColor }]}>
                    ${getTrainerPrice(trainer)}
                    <Text style={[styles.pricingUnit, { color: mutedColor }]}>/mo</Text>
                  </Text>
                  <Text style={[styles.pricingSub, { color: mutedColor }]}>
                    Coaching, programming, and check-ins — tailored to you.
                  </Text>
                </View>
              </LinearGradient>
            </View>
          ) : null}
        </ScrollView>

        <BlurView intensity={isDark ? 28 : 48} tint={isDark ? 'dark' : 'light'} style={styles.profileFooterBlur}>
          <View style={[styles.profileFooterInner, { borderTopColor: borderSoft }]}>
            <LinearGradient
              colors={['#FF6B9D', '#C084FC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.profileRequestGradient}
            >
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={onRequest}
                disabled={requesting}
                style={[styles.profileRequestBtn, requesting && { opacity: 0.72 }]}
              >
                {requesting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.profileRequestText}>Connect with {name.split(' ')[0]}</Text>
                    <Ionicons name="arrow-forward-circle" size={22} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </BlurView>
      </SafeAreaView>
    </Modal>
  );
}

const TrainerSearchScreen = ({
  onClose,
  onViewProfile,
  onRequestTrainer,
  onSelectTrainer,
  onProfilePress,
  onSettingsPress: _onSettingsPress,
  isDark: isDarkProp,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
}) => {
  const { isDark: themeIsDark } = useTheme();
  const isDark = typeof isDarkProp === 'boolean' ? isDarkProp : themeIsDark;

  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [search, setSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState(null);
  const [profileColorIndex, setProfileColorIndex] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [requestConfirmTrainer, setRequestConfirmTrainer] = useState(null);
  const [requestToast, setRequestToast] = useState('');

  useEffect(() => {
    if (!requestToast) return undefined;
    const t = setTimeout(() => setRequestToast(''), 2800);
    return () => clearTimeout(t);
  }, [requestToast]);

  const bgColor = isDark ? C.bgDark : C.bgLight;
  const textPrimary = isDark ? C.textDark : C.textLight;
  const textMuted = isDark ? C.mutedDark : C.mutedLight;
  const inputBorder = isDark ? C.cardBorderDark : C.cardBorderLight;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let data = [];
        try {
          const trainersRef = collection(db, 'trainers');
          const snap = await getDocs(trainersRef);
          snap.docs.forEach((d) => data.push({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn('trainers collection failed, falling back to users:', err?.message);
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('role', '==', 'trainer'));
          const snap = await getDocs(q);
          snap.docs.forEach((d) => data.push({ id: d.id, ...d.data() }));
        }
        data = await Promise.all(
          data.map(async (t) => {
            let merged = { ...t };
            try {
              const us = await getDoc(doc(db, 'users', t.id));
              if (us.exists()) {
                const ud = us.data() || {};
                const fromUser =
                  ud.photoURL || ud.photoUrl || ud.profilePhoto || ud.avatarUrl || ud.photo || null;
                const picked =
                  trainerPhotoUri(merged) ||
                  (fromUser ? String(fromUser).trim() : null) ||
                  merged.photoURL ||
                  merged.photoUrl ||
                  null;
                merged = {
                  ...merged,
                  photoURL: picked || null,
                  displayName: merged.displayName || ud.displayName || ud.name || merged.name || null,
                  name: merged.name || ud.name || ud.displayName || merged.displayName || null,
                };
              }
            } catch (_) {
              /* keep trainer doc as-is */
            }
            const normalizedUrl = trainerPhotoUri(merged);
            if (normalizedUrl && !merged.photoURL) merged = { ...merged, photoURL: normalizedUrl };
            return merged;
          })
        );

        data = await Promise.all(data.map((t) => resolveTrainerPhotoWithStorageFallback(t, storage)));

        data.sort((a, b) => {
          const nameA = (a.name || a.displayName || '').toLowerCase();
          const nameB = (b.name || b.displayName || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setTrainers(data);
      } catch (e) {
        console.error('TrainerSearchScreen load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let results = [...trainers];
    if (search) {
      const qx = search.toLowerCase();
      results = results.filter((t) => {
        const name = (t.displayName || t.name || '').toLowerCase();
        const specialty = (t.specialty || '').toLowerCase();
        const specsArray = (t.specialties || t.specializations || t.categories || []).map((sp) => String(sp).toLowerCase());
        return name.includes(qx) || specialty.includes(qx) || specsArray.join(' ').includes(qx);
      });
    }
    if (filters.availableOnly) {
      results = results.filter((t) => t.available !== false && t.availability !== 'Waitlist');
    }
    if (filters.minPrice) {
      results = results.filter((t) => {
        const p = Number(getTrainerPrice(t));
        return Number.isFinite(p) && p >= Number(filters.minPrice);
      });
    }
    if (filters.maxPrice) {
      results = results.filter((t) => {
        const p = Number(getTrainerPrice(t));
        return Number.isFinite(p) && p <= Number(filters.maxPrice);
      });
    }
    if (filters.sessionType === 'Remote') {
      results = results.filter((t) => t.isRemote || t.sessionType === 'Remote');
    } else if (filters.sessionType === 'In-Person') {
      results = results.filter((t) => !t.isRemote && t.sessionType !== 'Remote');
    }
    if (MARKETPLACE_SHOW_REVIEWS && filters.minRating > 0) {
      results = results.filter(
        (t) => hasDisplayableRating(t) && (trainerRating(t) || 0) >= filters.minRating
      );
    }
    if (filters.specialties.length > 0) {
      results = results.filter((t) => {
        const trainerSpecs = [
          ...(t.specialties || []),
          ...(t.specializations || []),
          ...(t.categories || []),
          t.specialty || '',
        ].map((s) => String(s).toLowerCase());
        return filters.specialties.some((sp) => trainerSpecs.some((ts) => ts.includes(sp.toLowerCase())));
      });
    }
    if (filters.experience.length > 0) {
      results = results.filter((t) => {
        const expLabel = formatExperience(t.experienceRange || t.yearsExperience);
        if (!expLabel) return false;
        return filters.experience.includes(expLabel);
      });
    }
    if (filters.sortBy === 'Price: Low') {
      results.sort((a, b) => {
        const pa = hasDisplayablePrice(a) ? Number(getTrainerPrice(a)) : Infinity;
        const pb = hasDisplayablePrice(b) ? Number(getTrainerPrice(b)) : Infinity;
        return pa - pb;
      });
    } else if (filters.sortBy === 'Price: High') {
      results.sort((a, b) => {
        const pa = hasDisplayablePrice(a) ? Number(getTrainerPrice(a)) : -Infinity;
        const pb = hasDisplayablePrice(b) ? Number(getTrainerPrice(b)) : -Infinity;
        return pb - pa;
      });
    }
    if (MARKETPLACE_SHOW_REVIEWS && filters.sortBy === 'Top Rated') {
      results.sort((a, b) => {
        const ar = hasDisplayableRating(a) ? trainerRating(a) : -1;
        const br = hasDisplayableRating(b) ? trainerRating(b) : -1;
        return br - ar;
      });
    }
    return results;
  }, [trainers, filters, search]);

  const activeFilterCount =
    (filters.availableOnly ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0) +
    (filters.sessionType !== 'Both' ? 1 : 0) +
    (filters.sortBy !== 'Newest' ? 1 : 0) +
    (MARKETPLACE_SHOW_REVIEWS && filters.minRating > 0 ? 1 : 0) +
    (filters.specialties.length > 0 ? 1 : 0) +
    (filters.experience.length > 0 ? 1 : 0);

  const openProfile = (trainer, colorIndex) => {
    setProfileTrainer(trainer);
    setProfileColorIndex(typeof colorIndex === 'number' ? colorIndex : 0);
    setProfileOpen(true);
  };

  const closeProfile = () => {
    setProfileOpen(false);
    setProfileTrainer(null);
  };

  const openRequestConfirm = (trainer) => {
    if (trainer) setRequestConfirmTrainer(trainer);
  };

  const closeRequestConfirm = () => {
    if (!requesting) setRequestConfirmTrainer(null);
  };

  const runRequest = async (trainer) => {
    if (!trainer) return;
    if (onRequestTrainer) {
      setRequesting(true);
      try {
        await onRequestTrainer(trainer);
        closeProfile();
        setRequestConfirmTrainer(null);
        const nm = trainer.displayName || trainer.name || 'your coach';
        setRequestToast(`Request sent to ${nm}! They'll respond soon.`);
      } catch (e) {
        console.error('Trainer request failed:', e);
        Alert.alert('Request failed', e?.message || 'Please try again.');
      } finally {
        setRequesting(false);
      }
      return;
    }
    if (onSelectTrainer) onSelectTrainer(trainer);
    else if (onViewProfile) onViewProfile(trainer);
  };

  const confirmSendRequest = () => {
    if (requestConfirmTrainer) runRequest(requestConfirmTrainer);
  };

  const searchStrip = (
    <View style={[styles.stickyHeader, { backgroundColor: bgColor, borderBottomColor: inputBorder }]}>
      <View style={styles.searchRow}>
        <View style={[styles.searchField, { backgroundColor: isDark ? C.inputDark : C.inputLight, borderColor: inputBorder }]}>
          <Ionicons name="search" size={16} color={textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search trainers..."
            placeholderTextColor={textMuted}
            style={[styles.searchInput, { color: textPrimary }]}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          onPress={() => setShowFilters(true)}
          style={[styles.filterPill, { backgroundColor: isDark ? C.inputDark : C.inputLight, borderColor: inputBorder }]}
          activeOpacity={0.85}
        >
          <Ionicons name="options-outline" size={16} color={textPrimary} />
          <Text style={[styles.filterPillLabel, { color: textPrimary }]}>Filter</Text>
          {activeFilterCount > 0 ? (
            <View style={styles.filterCountDot}>
              <Text style={styles.filterCountText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={[styles.safe, { backgroundColor: bgColor }]}>
      {loading ? (
        <>
          {searchStrip}
          <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} isDark={isDark} />
            ))}
          </ScrollView>
        </>
      ) : filtered.length === 0 ? (
        <>
          {searchStrip}
          <View style={styles.emptyState}>
            <Ionicons name="person-add-outline" size={52} color={textMuted} />
            <Text style={[styles.emptyTitle, { color: textPrimary }]}>No trainers found</Text>
            <Text style={[styles.emptySubtitle, { color: textMuted }]}>Try adjusting your filters or check back later.</Text>
            <TouchableOpacity style={[styles.clearBtn, { borderColor: C.pink }]} onPress={() => setFilters(INITIAL_FILTERS)} activeOpacity={0.88}>
              <Text style={[styles.clearBtnText, { color: C.pink }]}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <ScrollView
          stickyHeaderIndices={[0]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {searchStrip}
          <View style={styles.grid}>
            {filtered.map((trainer, i) => (
              <TrainerCard
                key={trainer.id}
                trainer={trainer}
                colorIndex={i}
                isDark={isDark}
                onViewProfile={openProfile}
                onRequestTrainer={openRequestConfirm}
              />
            ))}
          </View>
        </ScrollView>
      )}

      <FilterSidebar
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onApplyFilters={setFilters}
        currentFilters={filters}
        isDark={isDark}
      />

      <TrainerProfileSheet
        trainer={profileTrainer}
        colorIndex={profileColorIndex}
        visible={profileOpen && !!profileTrainer}
        onClose={closeProfile}
        onRequest={() => profileTrainer && openRequestConfirm(profileTrainer)}
        isDark={isDark}
        requesting={requesting}
      />

      <TrainerRequestConfirmModal
        visible={!!requestConfirmTrainer}
        trainer={requestConfirmTrainer}
        onCancel={closeRequestConfirm}
        onConfirm={confirmSendRequest}
        isDark={isDark}
        busy={requesting}
      />

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

      {requestToast ? (
        <View style={styles.requestToastWrap} pointerEvents="none">
          <View
            style={[
              styles.requestToastInner,
              {
                backgroundColor: isDark ? 'rgba(18,18,24,0.96)' : 'rgba(255,255,255,0.96)',
                borderColor: isDark ? 'rgba(255,107,157,0.35)' : 'rgba(255,107,157,0.4)',
              },
            ]}
          >
            <Text style={[styles.requestToastText, { color: isDark ? '#FFFFFF' : '#0A0A0F' }]}>{requestToast}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  stickyHeader: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  screenTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '900',
  },
  titleActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '500', paddingVertical: 0 },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
  },
  filterPillLabel: { fontSize: 13, fontWeight: '700' },
  filterCountDot: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FF6B9D',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  grid: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingTop: 16,
    rowGap: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 2.5,
    padding: 14,
    alignItems: 'center',
    overflow: 'visible',
    marginBottom: 0,
  },
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    zIndex: 2,
  },
  ratingBadgeText: { fontSize: 9, fontWeight: '700' },
  avatarGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    padding: 2.5,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 42,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: { fontWeight: '900' },
  cardName: { fontSize: 14, fontWeight: '900', marginBottom: 4 },
  specialtyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 6,
    maxWidth: '100%',
  },
  specialtyPillText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4, gap: 3, maxWidth: '100%' },
  locationText: { fontSize: 10, fontWeight: '600', flex: 1 },
  reviewsHint: { fontSize: 9, fontWeight: '600', marginBottom: 4 },
  price: { fontSize: 14, fontWeight: '900', marginBottom: 10 },
  priceUnit: { fontSize: 10, fontWeight: '600' },
  viewButton: {
    width: '100%',
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  viewButtonText: { fontSize: 12, fontWeight: '700' },
  requestGradient: { width: '100%', height: 40, borderRadius: 12, overflow: 'hidden' },
  requestButton: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  requestButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  skeletonLine: {
    height: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(128,128,128,0.25)',
    marginBottom: 6,
    alignSelf: 'center',
  },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
  clearBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 14, borderWidth: 1 },
  clearBtnText: { fontSize: 14, fontWeight: '700' },
  filterOverlay: { flex: 1, flexDirection: 'row' },
  filterBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  filterSheet: {
    alignSelf: 'stretch',
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    flexDirection: 'column',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  filterTitle: { fontSize: 16, fontWeight: '900' },
  filterScroll: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  filterSection: { marginBottom: 18 },
  filterLabel: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  filterChipActive: { backgroundColor: '#FF6B9D', borderColor: '#FF6B9D' },
  filterChipText: { fontSize: 12, fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, fontWeight: '600' },
  toggleTrack: {
    width: 51,
    height: 30,
    borderRadius: 16,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
  },
  priceRow: { flexDirection: 'row', gap: 10 },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  filterActions: { padding: 16, borderTopWidth: 1 },
  applyGradient: { borderRadius: 12, overflow: 'hidden' },
  applyButton: { height: 48, justifyContent: 'center', alignItems: 'center' },
  applyButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  profileRoot: { flex: 1 },
  profileTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 4,
  },
  profileBack: { padding: 4, width: 44, alignItems: 'flex-start' },
  profileBackChip: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileTopCenter: { alignItems: 'center', flex: 1 },
  profileTopKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 2 },
  profileTopTitle: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  profileHero: { alignItems: 'center', paddingTop: 12, paddingBottom: 8, paddingHorizontal: 16 },
  profileName: { fontSize: 26, fontWeight: '900', marginBottom: 12, textAlign: 'center', letterSpacing: -0.6 },
  profilePills: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 12 },
  profilePillGrad: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  profilePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  profileLocChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
    marginTop: 4,
  },
  profileLocText: { fontSize: 13, fontWeight: '600' },
  profileStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  profileRatingNum: { fontSize: 14, fontWeight: '800' },
  profileRatingSuffix: { fontSize: 12, fontWeight: '600' },
  profileSectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  profileSectionAccent: { width: 3, height: 16, borderRadius: 2 },
  profileSectionKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  profilePremiumCard: {
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
  },
  profileBio: { fontSize: 15, fontWeight: '500', lineHeight: 24 },
  certRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  certBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
  },
  certBadgeText: { fontSize: 11, fontWeight: '700' },
  specGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  specTile: {
    flexGrow: 1,
    flexBasis: '44%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    minWidth: 140,
  },
  specTileIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  specTileLabel: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  profilePricingWrap: { marginHorizontal: 16, marginTop: 10, marginBottom: 8 },
  pricingRing: { borderRadius: 22, padding: 2.5 },
  pricingInner: { borderRadius: 20, padding: 20 },
  pricingKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 6 },
  pricingAmount: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8 },
  pricingUnit: { fontSize: 16, fontWeight: '700' },
  pricingSub: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 10 },
  profileFooterBlur: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
  },
  profileFooterInner: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  profileRequestGradient: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 10,
  },
  profileRequestBtn: {
    minHeight: 56,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  profileRequestText: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.2 },
  requestToastWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 96,
    alignItems: 'center',
    zIndex: 9999,
  },
  requestToastInner: {
    maxWidth: '92%',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
  },
  requestToastText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 21,
  },
});

export default TrainerSearchScreen;
