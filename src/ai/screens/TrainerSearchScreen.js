import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, Modal, Animated, Dimensions,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { db } from '../../app/config';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import BottomNavBar from '../../navigation/BottomNavBar';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

const C = {
  bgDark: '#0A0A0A',
  bgLight: '#FFFFFF',
  panelDark: '#0E0E0E',
  panelLight: '#F9FAFB',
  cardDark: 'rgba(255,255,255,0.04)',
  cardLight: '#FFFFFF',
  cardBorderDark: 'rgba(255,255,255,0.08)',
  cardBorderLight: '#E2E8F0',
  inputDark: '#141414',
  inputLight: '#F3F4F6',
  inputBorderDark: 'rgba(255,255,255,0.1)',
  inputBorderLight: '#CBD5F5',
  glassPillDark: 'rgba(255,255,255,0.06)',
  glassPillLight: 'rgba(15,23,42,0.04)',
  skeletonDark: 'rgba(255,255,255,0.08)',
  skeletonLight: '#E5E7EB',
  textDark: '#FFFFFF',
  textLight: '#0F172A',
  mutedDark: 'rgba(255,255,255,0.5)',
  mutedLight: '#64748B',
  pink: '#FF6B9D',
  purple: '#C084FC',
  cyan: '#64D2FF',
  orange: '#F97316',
  emerald: '#10B981',
  dividerDark: 'rgba(255,255,255,0.08)',
  dividerLight: '#E5E7EB',
};

const CARD_GRADIENTS = [
  ['#1a2a3a', '#2d1f4e'],   // navy → dark purple
  ['#2a1a2e', '#3d1a2a'],   // dark purple → dark rose
  ['#0f2a2a', '#1a2a3a'],   // dark teal → navy
  ['#1f1a3a', '#2a1a3a'],   // indigo → violet
];

const SORT_OPTIONS = ['Newest', 'Price: Low', 'Price: High', 'Top Rated'];
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

const SkeletonCard = ({ isDark }) => (
  <View style={[s.card, { width: CARD_WIDTH, backgroundColor: isDark ? C.cardDark : C.cardLight, borderColor: isDark ? C.cardBorderDark : C.cardBorderLight }]}>
    <View style={[s.cardPhoto, { backgroundColor: isDark ? C.skeletonDark : C.skeletonLight }]} />
    <View style={s.cardBody}>
      <View style={[s.skeletonLine, { width: '75%', height: 11 }]} />
      <View style={[s.skeletonLine, { width: '50%', height: 9 }]} />
      <View style={[s.skeletonLine, { width: '65%', height: 9 }]} />
      <View style={[s.skeletonLine, { width: '40%', height: 9 }]} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <View style={[s.skeletonLine, { width: 48, height: 14, borderRadius: 20 }]} />
        <View style={[s.skeletonLine, { width: 44, height: 11 }]} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
        <View style={[s.skeletonLine, { flex: 1, height: 32, borderRadius: 10 }]} />
        <View style={[s.skeletonLine, { flex: 1, height: 32, borderRadius: 10 }]} />
      </View>
    </View>
  </View>
);

const getTrainerPrice = (t) => t.price != null ? t.price : (t.pricing?.perMonth ?? t.rate ?? null);

const TrainerCard = ({ trainer, index, onViewProfile, onRequestTrainer, isDark }) => {
  const gradient = CARD_GRADIENTS[index % CARD_GRADIENTS.length];
  const price = getTrainerPrice(trainer);
  const cardBg = isDark ? C.cardDark : C.cardLight;
  const cardBorder = isDark ? C.cardBorderDark : C.cardBorderLight;
  const photoUri =
    trainer.photoURL ||
    trainer.photoUrl ||
    trainer.profilePhoto ||
    trainer.profile_photo ||
    trainer.profile_picture ||
    trainer.avatarUrl ||
    null;
  const initials = (trainer.displayName || trainer.name || '??')
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const isAvailable = trainer.available !== false && trainer.availability !== 'Waitlist';
  const specialtyRaw = trainer.specialty || (trainer.specialties && trainer.specialties[0]) || '';

  return (
    <TouchableOpacity
      style={[
        s.card,
        {
          width: CARD_WIDTH,
          backgroundColor: cardBg,
          borderColor: cardBorder,
        },
      ]}
      onPress={() => onViewProfile(trainer)}
      activeOpacity={0.88}
    >
      {photoUri ? (
        <View style={s.cardPhoto}>
          <Image
            source={{ uri: photoUri }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
        </View>
      ) : isDark ? (
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.cardPhoto}
        >
          <Text style={s.cardInitials}>{initials}</Text>
        </LinearGradient>
      ) : (
        <View style={[s.cardPhoto, { backgroundColor: '#F1F5F9' }]}>
          <Text style={[s.cardInitials, { color: '#0F172A' }]}>{initials}</Text>
        </View>
      )}
      <View style={s.cardBody}>
        <Text style={[s.cardName, { color: isDark ? C.textDark : C.textLight }]} numberOfLines={1}>{trainer.displayName || trainer.name || 'Unknown'}</Text>
        <Text style={[s.cardSpecialty, { color: isDark ? C.mutedDark : C.mutedLight }]} numberOfLines={1}>{formatLabel(specialtyRaw)}</Text>
        {trainer.reviewCount > 0 && trainer.rating != null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Ionicons name="star" size={11} color={C.orange} />
            <Text style={{ marginLeft: 4, fontSize: 11, color: isDark ? C.mutedDark : C.mutedLight }}>
              {trainer.rating.toFixed(1)} ({trainer.reviewCount})
            </Text>
          </View>
        ) : null}
        {trainer.location || trainer.isRemote || trainer.sessionType ? (
          <View style={s.cardLocation}>
            <Ionicons name="location-outline" size={11} color={isDark ? C.mutedDark : C.mutedLight} />
            <Text style={[s.cardLocationText, { color: isDark ? C.mutedDark : C.mutedLight }]} numberOfLines={1}>
              {(trainer.isRemote || trainer.sessionType === 'Remote')
                ? 'Remote'
                : trainer.sessionType === 'Both'
                  ? `${trainer.location || ''}${trainer.location ? ' · Remote' : 'Remote'}`
                  : (trainer.location || '')}
            </Text>
          </View>
        ) : null}
        <View style={s.cardMeta}>
          <View style={[s.availBadge, { backgroundColor: isAvailable ? 'rgba(16,185,129,0.15)' : 'rgba(249,115,22,0.15)' }]}>
            <Text style={[s.availText, { color: isAvailable ? C.emerald : C.orange }]}>
              {isAvailable ? 'Available' : (trainer.availability || 'Waitlist')}
            </Text>
          </View>
          {trainer.sessionType && (
            <View style={{
              marginLeft: 6,
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor:
                trainer.sessionType === 'Remote'
                  ? 'rgba(100,210,255,0.12)'
                  : trainer.sessionType === 'In-person'
                  ? 'rgba(192,132,252,0.12)'
                  : 'rgba(249,115,22,0.12)',
            }}>
              <Text style={{
                fontSize: 10,
                fontWeight: '600',
                color:
                  trainer.sessionType === 'Remote'
                    ? C.cyan
                    : trainer.sessionType === 'In-person'
                    ? C.purple
                    : C.orange,
              }}>
                {trainer.sessionType}
              </Text>
            </View>
          )}
          {price != null ? (
            <Text style={[s.priceText, { color: C.pink }]}>${price}<Text style={[s.priceSub, { color: isDark ? C.mutedDark : C.mutedLight }]}>/mo</Text></Text>
          ) : null}
        </View>
        <View style={s.cardButtons}>
          <TouchableOpacity style={[s.viewProfileBtn, { borderColor: C.pink }]} onPress={() => onViewProfile(trainer)} activeOpacity={0.8}>
            <Text style={[s.viewProfileText, { color: C.pink }]}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.requestBtn} onPress={() => onRequestTrainer(trainer)} activeOpacity={0.85}>
            <LinearGradient colors={[C.purple, C.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.requestBtnGradient}>
              <Text style={s.requestText}>Request</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const FilterSidebar = ({ isOpen, onClose, onApplyFilters, currentFilters, isDark }) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [local, setLocal] = useState(currentFilters);

  useEffect(() => { setLocal(currentFilters); }, [currentFilters]);
  const toggleArr = (key, val) =>
    setLocal(p => ({
      ...p,
      [key]: p[key].includes(val) ? p[key].filter(v => v !== val) : [...p[key], val],
    }));
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 0 : SCREEN_WIDTH,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);

  const panelBg = isDark ? C.panelDark : C.panelLight;
  const dividerColor = isDark ? C.dividerDark : C.dividerLight;
  const titleColor = isDark ? C.textDark : C.textLight;
  const textMuted = isDark ? C.mutedDark : C.mutedLight;
  const chipBorder = isDark ? C.cardBorderDark : C.cardBorderLight;

  return (
    <Modal visible={isOpen} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[s.sidebar, { backgroundColor: panelBg, borderLeftColor: chipBorder, transform: [{ translateX: slideAnim }] }]}>
        <View style={s.sidebarHeader}>
          <Text style={[s.sidebarTitle, { color: titleColor }]}>Filters</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.7}>
            <Ionicons name="close" size={18} color={textMuted} />
          </TouchableOpacity>
        </View>

        <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false}>
          <View style={[s.filterGroup, { borderBottomColor: dividerColor }]}>
            <Text style={[s.filterGroupTitle, { color: titleColor }]}>Sort By</Text>
            <View style={s.chipRow}>
              {SORT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    s.filterChip,
                    { borderColor: chipBorder },
                    local.sortBy === opt && s.filterChipActive,
                  ]}
                  onPress={() => setLocal(p => ({ ...p, sortBy: opt }))}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipText, { color: textMuted }, local.sortBy === opt && s.filterChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[s.filterGroup, { borderBottomColor: dividerColor }]}>
            <Text style={[s.filterGroupTitle, { color: titleColor }]}>Minimum Rating</Text>
            <View style={s.chipRow}>
              {RATING_OPTIONS.map(r => (
                <TouchableOpacity
                  key={r}
                  style={[
                    s.filterChip,
                    { borderColor: chipBorder },
                    local.minRating === r && s.filterChipActive,
                  ]}
                  onPress={() => setLocal(p => ({ ...p, minRating: p.minRating === r ? 0 : r }))}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipText, { color: textMuted }, local.minRating === r && s.filterChipTextActive]}>★ {r}+</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[s.filterGroup, { borderBottomColor: dividerColor }]}>
            <Text style={[s.filterGroupTitle, { color: titleColor }]}>Specialty</Text>
            <View style={s.chipRow}>
              {SPECIALTY_OPTIONS.map(sp => (
                <TouchableOpacity
                  key={sp}
                  style={[
                    s.filterChip,
                    { borderColor: chipBorder },
                    local.specialties.includes(sp) && s.filterChipActive,
                  ]}
                  onPress={() => toggleArr('specialties', sp)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipText, { color: textMuted }, local.specialties.includes(sp) && s.filterChipTextActive]}>{sp}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[s.filterGroup, { borderBottomColor: dividerColor }]}>
            <Text style={[s.filterGroupTitle, { color: titleColor }]}>Experience</Text>
            <View style={s.chipRow}>
              {EXPERIENCE_OPTIONS.map(exp => (
                <TouchableOpacity
                  key={exp}
                  style={[
                    s.filterChip,
                    { borderColor: chipBorder },
                    local.experience.includes(exp) && s.filterChipActive,
                  ]}
                  onPress={() => toggleArr('experience', exp)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipText, { color: textMuted }, local.experience.includes(exp) && s.filterChipTextActive]}>{exp}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[s.filterGroup, { borderBottomColor: dividerColor }]}>
            <Text style={[s.filterGroupTitle, { color: titleColor }]}>Availability</Text>
            <View style={s.toggleRow}>
              <Text style={s.toggleLabel}>Available Only</Text>
              <TouchableOpacity
                onPress={() => setLocal(p => ({ ...p, availableOnly: !p.availableOnly }))}
                activeOpacity={0.8}
                style={[s.toggle, { backgroundColor: local.availableOnly ? C.pink : 'rgba(255,255,255,0.12)' }]}
              >
                <Animated.View style={[s.toggleThumb, { transform: [{ translateX: local.availableOnly ? 20 : 2 }] }]} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={[s.filterGroup, { borderBottomColor: dividerColor }]}>
            <Text style={[s.filterGroupTitle, { color: titleColor }]}>Price Range</Text>
            <View style={s.priceRow}>
              <TextInput
                style={[s.priceInput, { flex: 1 }]}
                placeholder="Min $/mo"
                placeholderTextColor={textMuted}
                value={local.minPrice}
                onChangeText={v => setLocal(p => ({ ...p, minPrice: v }))}
                keyboardType="numeric"
              />
              <TextInput
                style={[s.priceInput, { flex: 1 }]}
                placeholder="Max $/mo"
                placeholderTextColor={textMuted}
                value={local.maxPrice}
                onChangeText={v => setLocal(p => ({ ...p, maxPrice: v }))}
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={s.filterGroup}>
            <Text style={[s.filterGroupTitle, { color: titleColor }]}>Session Type</Text>
            <View style={s.chipRow}>
              {SESSION_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    s.filterChip,
                    { borderColor: chipBorder },
                    local.sessionType === opt && s.filterChipActive,
                  ]}
                  onPress={() => setLocal(p => ({ ...p, sessionType: opt }))}
                  activeOpacity={0.8}
                >
                  <Text style={[s.filterChipText, { color: textMuted }, local.sessionType === opt && s.filterChipTextActive]}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={{ height: 20 }} />
        </ScrollView>

        <View style={[s.sidebarFooter, { borderTopColor: dividerColor }]}>
          <TouchableOpacity
            style={{ width: '100%' }}
            onPress={() => { onApplyFilters(local); onClose(); }}
            activeOpacity={0.88}
          >
            <LinearGradient colors={[C.purple, C.pink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.applyBtn}>
              <Text style={s.applyBtnText}>Apply Filters</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
};

const TrainerSearchScreen = ({
  onClose,
  onViewProfile,
  onSelectTrainer,
  onProfilePress,
  onSettingsPress,
  isDark = true,
  onHomePress,
  onPlusPress,
  onVoicePress,
  onNutritionPress,
  onWorkoutPress,
  onMessagesPress,
}) => {
  const [trainers, setTrainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [search, setSearch] = useState('');

  const bgColor = isDark ? C.bgDark : C.bgLight;
  const cardBg = isDark ? C.cardDark : C.cardLight;
  const cardBorder = isDark ? C.cardBorderDark : C.cardBorderLight;
  const textPrimary = isDark ? C.textDark : C.textLight;
  const textMuted = isDark ? C.mutedDark : C.mutedLight;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let data = [];
        try {
          const trainersRef = collection(db, 'trainers');
          const snap = await getDocs(trainersRef);
          snap.docs.forEach(d => data.push({ id: d.id, ...d.data() }));
        } catch (err) {
          console.warn('trainers collection failed, falling back to users:', err?.message);
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('role', '==', 'trainer'));
          const snap = await getDocs(q);
          snap.docs.forEach(d => data.push({ id: d.id, ...d.data() }));
        }
        // Enrich with users/{uid} fields (photoURL, displayName) when trainers collection is missing them
        data = await Promise.all(
          data.map(async (t) => {
            const existingPhoto =
              t?.photoURL ||
              t?.photoUrl ||
              t?.profilePhoto ||
              t?.profile_photo ||
              t?.profile_picture ||
              t?.avatarUrl ||
              null;
            if (existingPhoto && (t?.displayName || t?.name)) return { ...t, photoURL: t.photoURL || existingPhoto };
            try {
              const us = await getDoc(doc(db, 'users', t.id));
              if (!us.exists()) return t;
              const ud = us.data() || {};
              return {
                ...t,
                photoURL: t.photoURL || existingPhoto || ud.photoURL || null,
                displayName: t.displayName || ud.displayName || ud.name || t.name || null,
                name: t.name || ud.name || ud.displayName || null,
              };
            } catch (_) {
              return t;
            }
          })
        );

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
      const q = search.toLowerCase();
      results = results.filter(t => {
        const name = (t.displayName || t.name || '').toLowerCase();
        const specialty = (t.specialty || '').toLowerCase();
        const specsArray = (t.specialties || t.specializations || t.categories || []).map(sp => String(sp).toLowerCase());
        return (
          name.includes(q) ||
          specialty.includes(q) ||
          specsArray.join(' ').includes(q)
        );
      });
    }
    if (filters.availableOnly) {
      results = results.filter(t => t.available !== false && t.availability !== 'Waitlist');
    }
    if (filters.minPrice) {
      results = results.filter(t => (getTrainerPrice(t) || 0) >= Number(filters.minPrice));
    }
    if (filters.maxPrice) {
      results = results.filter(t => (getTrainerPrice(t) || 0) <= Number(filters.maxPrice));
    }
    if (filters.sessionType === 'Remote') {
      results = results.filter(t => t.isRemote || t.sessionType === 'Remote');
    } else if (filters.sessionType === 'In-Person') {
      results = results.filter(t => !t.isRemote && t.sessionType !== 'Remote');
    }
    if (filters.minRating > 0) {
      results = results.filter(t => (t.rating || 0) >= filters.minRating);
    }
    if (filters.specialties.length > 0) {
      results = results.filter(t => {
        const trainerSpecs = [
          ...(t.specialties || []),
          ...(t.specializations || []),
          ...(t.categories || []),
          t.specialty || '',
        ].map(s => String(s).toLowerCase());
        return filters.specialties.some(sp =>
          trainerSpecs.some(ts => ts.includes(sp.toLowerCase()))
        );
      });
    }
    if (filters.experience.length > 0) {
      results = results.filter(t => {
        const expLabel = formatExperience(t.experienceRange || t.yearsExperience);
        if (!expLabel) return false;
        return filters.experience.includes(expLabel);
      });
    }
    if (filters.sortBy === 'Price: Low') results.sort((a, b) => (getTrainerPrice(a) || 0) - (getTrainerPrice(b) || 0));
    else if (filters.sortBy === 'Price: High') results.sort((a, b) => (getTrainerPrice(b) || 0) - (getTrainerPrice(a) || 0));
    else if (filters.sortBy === 'Top Rated') results.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return results;
  }, [trainers, filters, search]);

  const activeFilterCount = (filters.availableOnly ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0) +
    (filters.sessionType !== 'Both' ? 1 : 0) +
    (filters.sortBy !== 'Newest' ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.specialties.length > 0 ? 1 : 0) +
    (filters.experience.length > 0 ? 1 : 0);

  const handleViewProfile = (trainer) => {
    if (onViewProfile) onViewProfile(trainer);
  };

  const handleRequest = (trainer) => {
    if (onViewProfile) onViewProfile(trainer);
    else if (onSelectTrainer) onSelectTrainer(trainer);
  };

  return (
    <SafeAreaView style={[s.safe, { backgroundColor: bgColor }]}>
      <View
        style={[
          s.searchBar,
          {
            backgroundColor: isDark ? C.inputDark : C.inputLight,
            borderColor: isDark ? C.inputBorderDark : C.inputBorderLight,
          },
        ]}
      >
        <Ionicons name="search-outline" size={16} color={textMuted} />
        <TextInput
          style={[s.searchInput, { color: textPrimary }]}
          placeholder="Search trainers..."
          placeholderTextColor={textMuted}
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.7}>
            <Ionicons name="close-circle" size={15} color={textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setShowFilters(true)}
            activeOpacity={0.7}
            style={s.headerIconBtn}
          >
            <Ionicons name="options-outline" size={17} color={textMuted} />
            {activeFilterCount > 0 && (
              <View style={s.filterDot}><Text style={s.filterDotText}>{activeFilterCount}</Text></View>
            )}
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} isDark={isDark} />)}
        </ScrollView>
      ) : filtered.length === 0 ? (
        <View style={s.emptyState}>
          <Ionicons name="person-add-outline" size={52} color={C.muted} />
          <Text style={s.emptyTitle}>No trainers found</Text>
          <Text style={s.emptySubtitle}>Try adjusting your filters or check back later.</Text>
          <TouchableOpacity style={s.clearFiltersBtn} onPress={() => setFilters(INITIAL_FILTERS)} activeOpacity={0.8}>
            <Text style={s.clearFiltersBtnText}>Clear Filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.grid} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.map((trainer, i) => (
            <TrainerCard
              key={trainer.id}
              trainer={trainer}
              index={i}
              isDark={isDark}
              onViewProfile={handleViewProfile}
              onRequestTrainer={handleRequest}
            />
          ))}
          <View style={{ height: 32, width: '100%' }} />
        </ScrollView>
      )}

      <FilterSidebar
        isOpen={showFilters}
        onClose={() => setShowFilters(false)}
        onApplyFilters={setFilters}
        currentFilters={filters}
        isDark={isDark}
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
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  safe: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#FFFFFF', paddingVertical: 0 },
  headerIconBtn: { padding: 6, position: 'relative' },
  filterDot: { position: 'absolute', top: 2, right: 2, width: 15, height: 15, borderRadius: 8, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  filterDotText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  grid: { paddingHorizontal: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 4 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.cardBorder, borderRadius: 16, overflow: 'hidden' },
  cardPhoto: { height: 110, alignItems: 'center', justifyContent: 'center' },
  cardInitials: { fontSize: 26, fontWeight: '800', color: 'rgba(255,255,255,0.9)', letterSpacing: 1 },
  cardBody: { padding: 10, gap: 3 },
  cardName: { fontSize: 13, fontWeight: '700', color: C.text },
  cardSpecialty: { fontSize: 11, color: C.muted },
  cardRating: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  cardRatingText: { fontSize: 11, fontWeight: '600', color: C.text },
  cardReviewCount: { fontSize: 11, color: C.muted },
  cardLocation: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  cardLocationText: { fontSize: 11, color: C.muted, flex: 1 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  availBadge: { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 20 },
  availText: { fontSize: 10, fontWeight: '700' },
  priceText: { fontSize: 13, fontWeight: '700', color: C.pink },
  priceSub: { fontSize: 9, fontWeight: '400', color: C.muted },
  cardButtons: { flexDirection: 'row', gap: 6, marginTop: 8 },
  viewProfileBtn: { flex: 1, height: 32, borderRadius: 10, borderWidth: 1, borderColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  viewProfileText: { fontSize: 11, fontWeight: '600', color: C.pink },
  requestBtn: { flex: 1, height: 32, borderRadius: 10, overflow: 'hidden' },
  requestBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  requestText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  skeletonLine: { backgroundColor: C.skeleton, borderRadius: 6 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: C.text },
  emptySubtitle: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 20 },
  clearFiltersBtn: { marginTop: 8, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 14, borderWidth: 1, borderColor: C.pink },
  clearFiltersBtnText: { fontSize: 14, fontWeight: '600', color: C.pink },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sidebar: { position: 'absolute', top: 0, right: 0, bottom: 0, width: SCREEN_WIDTH * 0.82, backgroundColor: C.panel, borderLeftWidth: 1, borderLeftColor: C.cardBorder },
  sidebarHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.divider },
  sidebarTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  closeBtn: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.glassPill, borderWidth: 1, borderColor: C.cardBorder, alignItems: 'center', justifyContent: 'center' },
  filterGroup: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.divider },
  filterGroupTitle: { fontSize: 13, fontWeight: '600', color: C.text, marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: 'transparent' },
  filterChipActive: { backgroundColor: C.pink, borderColor: C.pink },
  filterChipText: { fontSize: 12, fontWeight: '500', color: C.muted },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 13, color: C.text },
  toggle: { width: 51, height: 31, borderRadius: 16, justifyContent: 'center' },
  toggleThumb: { position: 'absolute', width: 27, height: 27, borderRadius: 14, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } },
  priceRow: { flexDirection: 'row', gap: 12 },
  priceInput: { backgroundColor: C.input, borderWidth: 1, borderColor: C.inputBorder, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: C.text },
  sidebarFooter: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 36, borderTopWidth: 1, borderTopColor: C.divider },
  applyBtn: { borderRadius: 16, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});

export default TrainerSearchScreen;
