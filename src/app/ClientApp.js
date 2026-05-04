/**
 * ClientApp - Client-specific application interface with integrated home screen
 * 
 * Responsibilities:
 * - Client dashboard rendering
 * - Client screen navigation and state management
 * - Client-specific data loading (conversations, trainer info, workouts, nutrition)
 * - Real-time conversation updates
 * - Premium home screen UI (iOS 18 Bento Box Design)
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  Image,
  Linking,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';

import { Feather, Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Video } from 'expo-video';
import LottieView from 'lottie-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { auth, db, functions } from './config';
import { calculateBMR, calculateTDEE } from './calculations';
import { getDateKey } from './dateKey';

import { subscribeToUnreadCount } from '../ai/services/conversationService';
import { getOrCreateConversation, sendClientRequest } from '../ai/services/trainerMessaging';
import AIChatHomeScreen from '../aiChat/screens/AIChatHomeScreen';
import AIChatScreen from '../aiChat/screens/AIChatScreen';
import TrainerProfileScreen from '../ai/screens/TrainerProfileScreen';
import TrainerSearchScreen from '../ai/screens/TrainerSearchScreen';
import MyDashboardScreen from '../client/screens/MyDashboardScreen';
import SettingsScreen from '../client/screens/SettingsScreen';
import { AppNavigationProvider } from '../navigation/AppNavigationContext';
import BottomNavBar from '../navigation/BottomNavBar';
import { calculateMacroTotals, getDailyGoals, getFoodLogsForDate } from '../nutrition/services/nutritionService';
import MealPlanHomeScreen from '../nutrition/screens/MealPlanHomeScreen';
import NutritionContainer from '../nutrition/screens/NutritionContainer';
import ProfileScreen from '../profile/screens/ProfileScreen';
import AddNotesFilesModal from '../shared/components/AddNotesFilesModal';
import AppLoadingScreen from '../shared/components/AppLoadingScreen';
import CoachConnectHeader from '../shared/components/AnatroxHeader';
import DailyQuoteCard, { DailyQuotePill } from '../shared/components/DailyQuoteCard';
import DocumentViewerModal from '../shared/components/DocumentViewerModal';
import EmbedWebViewModal from '../shared/components/EmbedWebViewModal';
import FileGalleryGrid, { FILE_GALLERY_THEME_COLORS } from '../shared/components/FileGalleryGrid';
import MediaViewerModal from '../shared/components/MediaViewerModal';
import PdfViewerModal from '../shared/components/PdfViewerModal';
import RemoveTrainerSheet from '../shared/components/RemoveTrainerSheet';
import ReviewSubmitSheet from '../shared/components/ReviewSubmitSheet';
import { SessionMeetingCard } from '../shared/components/SessionMeetingCard';
import SpreadsheetViewerModal from '../shared/components/SpreadsheetViewerModal';
import TrainerSharedFilesModal from '../shared/components/TrainerSharedFilesModal';
import {
  persistPushTokensForUid,
  setNotificationTapHandler,
  flushInitialNotificationResponse,
  subscribePushTokenRefreshOnResume,
} from '../shared/services/notificationsService';
import { postRemotePushNotify } from '../shared/services/pushNotifyApi';
import { deleteNotesAndFilesItem, getNotesAndFiles } from '../shared/services/notesAndFilesService';
import { useTheme } from '../shared/ui/ThemeContext';
import {
  getEmbedViewerUri,
  isImageFile as isNotesImageFile,
  isPdfFile as isNotesPdfFile,
  isVideoFile as isNotesVideoFile,
} from '../shared/utils/notesFileView';
import ConversationsListScreen from '../trainer/screens/ConversationsListScreen';
import PhotoGalleryScreen from '../trainer/screens/PhotoGalleryScreen';
import TrainerMessagingScreen from '../trainer/screens/TrainerMessagingScreen';
import AIWorkoutPlansScreen from '../trainer/screens/AIWorkoutPlansScreen';
import { fetchWorkoutHistory, getActiveWorkout } from '../workouts/services/workoutService';
import WorkoutPlanGeneratorScreen from '../workouts/screens/workout';

import { clearAllUserData } from '../utils/dataCacheCleanup';

const CARD_GAP = 16;
/** Kept for any layout/style references; prefer useWindowDimensions() inside components for live width. */
const { width: SCREEN_WIDTH } = Dimensions.get('window');
/** Horizontal padding inside home stat ScrollViews — keep in sync with `styles.statsRowContent.paddingHorizontal` (20×2). */
const STATS_ROW_PAD_H = 40;
/** Gap between cards in stat rows — keep in sync with `styles.statsRowContent.gap`. */
const STATS_ROW_CARD_GAP = 12;

// Import macro icons
const ProteinIcon = require('../assets/icons/Protein.png');
const CarbsIcon = require('../assets/icons/Carbs.png');
const FatsIcon = require('../assets/icons/Fats.png');

// Wellness row empty-state Lotties
const LOTTIE_SORENESS_EMPTY = require('../assets/sad reaction.json');
const LOTTIE_ENERGY_EMPTY = require('../assets/Run Hamster... run.json');
const LOTTIE_STRESS_EMPTY = require('../assets/Stressed Employee At Work.json');
const WORKOUT_EMPTY_ICON = require('../assets/icons/workout.png');

// Builds light/dark style tokens from `isDark` (theme state). 
const getPremiumTheme = (isDark, colors) => {
  const text = isDark ? '#FFFFFF' : 'rgba(15,23,42,0.92)';
  const subtext = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.58)';
  const label = isDark ? 'rgba(255,255,255,0.50)' : 'hsla(222, 47.40%, 11.20%, 0.45)';
  const icon = isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.55)';

  return {
    blurTint: isDark ? 'dark' : 'light',
    cardBg: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.72)',
    cardBgStrong: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.86)',
    border: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
    borderSubtle: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    text,
    subtext,
    label,
    icon,
    background: isDark ? '#0A0A0F' : (colors?.background ?? '#F2F2F7'),
  };
};

// Shared UI helpers: app accent color + number clamping + hex→rgba conversion for opacity-based styling.
const ACCENT_COLOR = '#7C3AED';
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const hexToRgba = (hex, alpha) => {
  if (typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const int = parseInt(full, 16);
  if (Number.isNaN(int) || full.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

const formatGoalLabel = (primaryGoal) => {
  if (!primaryGoal) return 'Active Goal';
  const g = String(primaryGoal);
  if (g === 'lose_fat') return 'Lose Fat';
  if (g === 'build_muscle') return 'Build Muscle';
  if (g === 'athletic_performance') return 'Athletic';
  return g
    .replace(/_/g, ' ')
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

// Display name for today's workout card — use actual workout name (e.g. "Chest Day"), not generic "Workout"
const inferWorkoutType = (todayWorkout) => {
  const name = todayWorkout?.name || todayWorkout?.workoutName;
  if (!name) return null;
  const trimmed = String(name).trim();
  if (!trimmed) return null;
  // Title-case: first letter of each word uppercase
  const titleCase = trimmed.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return titleCase;
};

const LiquidGlassStatCard = ({ isDark, colors, children, style, centerContent }) => {
  const surface = colors?.surface;
  const border = colors?.border;
  const shadow = colors?.black;
  const bg = isDark ? hexToRgba(surface, 0.35) : hexToRgba(surface, 0.75);
  const bd = isDark ? hexToRgba(border, 0.6) : hexToRgba(border, 0.75);

  return (
    <View style={[styles.statCardShadow, { shadowColor: shadow }, style]}>
      <BlurView intensity={28} tint={isDark ? 'dark' : 'light'} style={styles.statCardBlur}>
        <View
          style={[
            styles.statCardInner,
            centerContent && styles.statCardInnerCentered,
            {
              backgroundColor: bg,
              borderColor: bd,
            },
          ]}
        >
          {children}
        </View>
      </BlurView>
    </View>
  );
};

// Circle progress ui components for nutrition stats on client home screen  
const CircularProgress = ({ progress = 0, size = 72, strokeWidth = 8, trackColor, progressColor }) => {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const p = clamp(progress, 0, 1);
  const dashOffset = c * (1 - p);

  // the geometry of the circle progress bar
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={progressColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={dashOffset}
        strokeLinecap="round"
        rotation={-90}
        originX={size / 2}
        originY={size / 2}
      />
    </Svg>
  );
};

// Home stat cards — solid value colors (better contrast than gradient-filled glyphs)
const HOME_STAT_WORKOUT = '#E879F9';
const HOME_STAT_WATER = '#22D3EE';
/** Dark burnt-orange / retro (sleep hours on home stat card) */
const HOME_STAT_SLEEP = '#C4621A';
const HOME_STAT_SORENESS = '#F472B6';
const HOME_STAT_ENERGY = '#FBBF24';
const HOME_STAT_STRESS = '#FB7185';

const FightyBouncyCardWrap = ({ index = 0, width, children, onPress, activeOpacity = 0.9, disableAnimations = false }) => {
  const press = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    if (disableAnimations) return;
    shimmer.setValue(-1);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(650 + index * 120),
        Animated.timing(shimmer, { toValue: 1, duration: 520, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(1100),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [disableAnimations, index, shimmer]);

  const onPressIn = () => {
    if (disableAnimations) return;
    Animated.timing(press, { toValue: 1, duration: 70, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  };
  const onPressOut = () => {
    if (disableAnimations) return;
    Animated.spring(press, { toValue: 0, speed: 28, bounciness: 16, useNativeDriver: true }).start();
  };

  const shimmerWidth = Math.max(90, Math.round((width ?? 160) * 0.55));
  const shimmerX = shimmer.interpolate({
    inputRange: [-1, 1],
    outputRange: [-(width ?? 160), width ?? 160],
  });
  const shimmerOpacity = shimmer.interpolate({
    inputRange: [-1, -0.25, 0, 0.25, 1],
    outputRange: [0, 0.0, 0.28, 0.0, 0],
  });

  return (
    disableAnimations ? (
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress}>
        <View style={{ width: '100%' }}>{children}</View>
      </TouchableOpacity>
    ) : (
    <Animated.View
      style={{
        transform: [
          { scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 0.975] }) },
          { rotateZ: press.interpolate({ inputRange: [0, 1], outputRange: ['0deg', index % 2 === 0 ? '-1.2deg' : '1.2deg'] }) },
          { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
        ],
      }}
    >
      <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress} onPressIn={onPressIn} onPressOut={onPressOut}>
        <View style={{ width: '100%' }}>
          {children}
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -18,
              bottom: -18,
              left: '50%',
              marginLeft: -Math.round(shimmerWidth / 2),
              width: shimmerWidth,
              opacity: shimmerOpacity,
              transform: [{ translateX: shimmerX }, { rotateZ: '14deg' }],
            }}
          >
            <LinearGradient
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ flex: 1, borderRadius: 22 }}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Animated.View>
    )
  );
};

// First row: day of workout (ex: Chest Day) / water / sleep — logo-aligned gradient, slightly softened (no grey)
const TopStatsRow = ({
  isDark,
  themeMode,
  colors,
  todayWorkout,
  dashboardWorkoutSummary,
  waterIntake,
  sleepHours,
  primaryGoal,
  goalProgress,
  onPlanWorkout,
}) => {
  const { width: windowWidth } = useWindowDimensions();
  // Live window width (not module-level Dimensions) — fixes Expo Go on device where initial width is wrong and cards look full-width.
  const cardWidth = Math.max(
    132,
    Math.floor((windowWidth - STATS_ROW_PAD_H - STATS_ROW_CARD_GAP) / 2),
  );
  const accent = ACCENT_COLOR;
  const primary = colors?.primary ?? accent;
  let workoutType = null;
  if (todayWorkout) {
    workoutType = inferWorkoutType(todayWorkout);
  } else if (dashboardWorkoutSummary) {
    const summary = String(dashboardWorkoutSummary).trim();
    workoutType = summary.includes('\n') ? summary.split('\n')[0].trim() : summary;
    if (workoutType) workoutType = workoutType.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  let displayWorkoutType = workoutType;
  if (workoutType) {
    const parts = String(workoutType).split(/\s+/);
    if (parts.length >= 2) {
      const [first, ...rest] = parts;
      displayWorkoutType = `${first}\n${rest.join(' ')}`;
    }
  }
  const isRestDay = workoutType === 'Rest Day';

  const border = colors?.border ?? (isDark ? '#38383A' : '#E5E5E7');
  const track = hexToRgba(border, isDark ? 0.5 : 0.55);

  const waterVal = typeof waterIntake === 'number' ? waterIntake : null;
  const waterGoal = 8;
  const waterPct = waterVal === null ? 0 : clamp(waterVal / waterGoal, 0, 1);

  const sleepVal = typeof sleepHours === 'number' ? sleepHours : null;

  const goalLabel = formatGoalLabel(primaryGoal);
  const gp = typeof goalProgress === 'number' ? clamp(goalProgress, 0, 1) : null;

  const kickerColor = isDark ? 'rgba(255,255,255,0.72)' : (colors?.textSecondary ?? '#6B7280');
  const footnoteColor = isDark ? 'rgba(255,255,255,0.58)' : (colors?.textSecondary ?? '#6B7280');

  return (
    <View style={styles.statsRowWrap}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.statsRowContent}
        decelerationRate="fast"
      >
        {/* Card 1 — Workout */}
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={0} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: cardWidth }}>
              <Text style={[styles.statKicker, { color: kickerColor }]}>TODAY'S WORKOUT</Text>
              {displayWorkoutType ? (
                <View style={styles.statGradientBlock}>
                  <Text
                    style={[styles.statGradientNumber, styles.statGradientWorkoutText, { color: HOME_STAT_WORKOUT, fontWeight: '800' }]}
                    numberOfLines={2}
                  >
                    {displayWorkoutType}
                  </Text>
                  <Text style={[styles.statGradientLabel, { color: footnoteColor }]}>today's workout</Text>
                </View>
              ) : (
                <View style={styles.statEmpty}>
                  <LottieView
                    source={require('../assets/Lotties for Anatrox/boxer lottie.json')}
                    autoPlay
                    loop
                    style={styles.statEmptyLottie}
                  />
                  <Text style={[styles.statEmptyText, { color: colors?.textSecondary }]}>No workout planned yet</Text>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        {/* Card 2 — Water */}
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={1} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: cardWidth }}>
              <Text style={[styles.statKicker, { color: kickerColor }]}>WATER INTAKE</Text>
              {waterVal !== null ? (
                <View style={styles.statGradientBlock}>
                  <Text style={[styles.statGradientNumber, { color: HOME_STAT_WATER, fontWeight: '800' }]}>{waterVal}</Text>
                  <Text style={[styles.statGradientLabel, { color: footnoteColor }]}>oz water</Text>
                </View>
              ) : (
                <View style={styles.statEmpty}>
                  <LottieView
                    source={require('../assets/Lotties for Anatrox/glass water.json')}
                    autoPlay
                    loop
                    style={styles.statEmptyLottie}
                  />
                  <Text style={[styles.statEmptyText, { color: colors?.textSecondary }]}>Log Water Intake in Dashboard</Text>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        {/* Card 3 — Sleep */}
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={2} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: cardWidth }}>
              <Text style={[styles.statKicker, { color: kickerColor }]}>SLEEP</Text>
              {sleepVal !== null ? (
                <View style={styles.statGradientBlock}>
                  <Text style={[styles.statGradientNumber, { color: HOME_STAT_SLEEP, fontWeight: '800' }]}>{sleepVal}</Text>
                  <Text style={[styles.statGradientLabel, { color: footnoteColor }]}>hours of sleep</Text>
                </View>
              ) : (
                <View style={styles.statEmpty}>
                  <LottieView
                    source={require('../assets/Lotties for Anatrox/sleep.json')}
                    autoPlay
                    loop
                    style={styles.statEmptyLottie}
                  />
                  <Text style={[styles.statEmptyText, { color: colors?.textSecondary }]}>Log Sleep in Dashboard</Text>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        
      </ScrollView>
    </View>
  );
};

// Second row: Soreness, Energy Level, Stress Level — smaller type, teal/indigo color combo
const wellnessKicker = {
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 0.6,
  textAlign: 'center',
  width: '100%',
};
const wellnessNumber = {
  fontSize: 30,
  fontWeight: '800',
  lineHeight: 34,
  textAlign: 'center',
};
const wellnessLabel = { fontSize: 12, fontWeight: '600', marginTop: 2, textAlign: 'center' };
const wellnessEmptyText = { fontSize: 11, fontWeight: '600', textAlign: 'center' };

const WellnessStatsRow = ({ isDark, colors, soreness, energyLevel, stressLevel }) => {
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.max(
    132,
    Math.floor((windowWidth - STATS_ROW_PAD_H - STATS_ROW_CARD_GAP) / 2),
  );
  const kickerColor = isDark ? 'rgba(255,255,255,0.72)' : (colors?.textSecondary ?? '#6B7280');
  const footnoteColor = isDark ? 'rgba(255,255,255,0.58)' : (colors?.textSecondary ?? '#6B7280');
  const formatRating = (v) => {
    if (v == null || v === '') return null;
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return v;
    const labels = ['None', 'Low', 'Medium', 'High', 'Very high'];
    return labels[n] != null ? labels[n] : `${n}/5`;
  };

  return (
    <View style={styles.statsRowWrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRowContent} decelerationRate="fast">
        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={0} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: '100%' }} centerContent>
              <Text style={[wellnessKicker, { color: kickerColor }]}>SORENESS</Text>
              {soreness != null && soreness !== '' ? (
                <View style={styles.statWellnessValueBlock}>
                  <Text style={[wellnessNumber, { color: HOME_STAT_SORENESS }]}>{formatRating(soreness) || soreness}</Text>
                  <Text style={[wellnessLabel, { color: footnoteColor }]}>muscle soreness</Text>
                </View>
              ) : (
                <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_SORENESS_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <Text style={[wellnessEmptyText, { color: colors?.textSecondary }]}>Log in Dashboard</Text>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={1} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: '100%' }} centerContent>
              <Text style={[wellnessKicker, { color: kickerColor }]}>ENERGY LEVEL</Text>
              {energyLevel != null && energyLevel !== '' ? (
                <View style={styles.statWellnessValueBlock}>
                  <Text style={[wellnessNumber, { color: HOME_STAT_ENERGY }]}>{formatRating(energyLevel) || energyLevel}</Text>
                  <Text style={[wellnessLabel, { color: footnoteColor }]}>today</Text>
                </View>
              ) : (
                <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_ENERGY_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <Text style={[wellnessEmptyText, { color: colors?.textSecondary }]}>Log in Dashboard</Text>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>

        <View style={{ width: cardWidth }}>
          <FightyBouncyCardWrap index={2} width={cardWidth} disableAnimations>
            <LiquidGlassStatCard isDark={isDark} colors={colors} style={{ width: '100%' }} centerContent>
              <Text style={[wellnessKicker, { color: kickerColor }]}>STRESS LEVEL</Text>
              {stressLevel != null && stressLevel !== '' ? (
                <View style={styles.statWellnessValueBlock}>
                  <Text style={[wellnessNumber, { color: HOME_STAT_STRESS }]}>{formatRating(stressLevel) || stressLevel}</Text>
                  <Text style={[wellnessLabel, { color: footnoteColor }]}>today</Text>
                </View>
              ) : (
                <View style={styles.statWellnessEmpty}>
                  <LottieView source={LOTTIE_STRESS_EMPTY} autoPlay loop style={styles.wellnessEmptyLottie} />
                  <Text style={[wellnessEmptyText, { color: colors?.textSecondary }]}>Log in Dashboard</Text>
                </View>
              )}
            </LiquidGlassStatCard>
          </FightyBouncyCardWrap>
        </View>
      </ScrollView>
    </View>
  );
};

// UI Components from Ui.jsx
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
};


const AuroraHeroBanner = ({ isDark, userId, userName = 'User' }) => {
  const { width } = useWindowDimensions();
  const isWide = width >= 600;
  // Slightly smaller so the quote + next content is visible on first load
  const titleSize = isWide ? 38 : 34;
  // Inline layout: keep Lottie looking normal, but still fit the right column.
  const lottieSize = Math.min(isWide ? 150 : 130, Math.max(96, Math.round((width - 32) * 0.36)));
  const bg = isDark ? 'rgba(11,11,18,0.92)' : 'rgba(255,255,255,0.70)';
  const borderGradient = isDark
    ? ['rgba(255,107,157,0.65)', 'rgba(192,132,252,0.55)', 'rgba(6,182,212,0.35)']
    : ['#FF6B9D', '#C084FC'];
  const cardShadow = isDark ? '#000000' : '#FF6B9D';
  const firstName = String(userName || 'User').trim().split(/\s+/)[0] || 'User';

  return (
    <View
      style={[
        styles.heroOuter,
        {
          shadowColor: cardShadow,
          borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,107,157,0.18)',
          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'transparent',
        },
      ]}
    >
      <LinearGradient
        colors={borderGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroBorderGradient}
      >
        <View style={[styles.heroInner, { backgroundColor: bg }]}>
          {/* Greeting moved inside hero card */}
          <View style={{ marginBottom: 4, alignItems: 'center' }}>
            <Text style={[styles.greetingTitle, { color: isDark ? '#FFFFFF' : '#111827', textAlign: 'center' }]}>
              Good {getGreeting()},{' '}
              <Text style={{ color: '#FF6B9D', fontWeight: '800' }}>{firstName}!</Text>
            </Text>
          </View>

          <View
            style={[
              styles.heroContentRow,
              { flexDirection: isWide ? 'row' : 'column', gap: isWide ? 28 : 18 },
            ]}
          >
          {/* Left (text) */}
          <View style={[styles.heroLeft, { flex: isWide ? 0.6 : 1 }]}>
            <View style={styles.welcomeWrap}>
              <Text style={[styles.welcomeKicker, { color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(10,10,15,0.65)' }]}>
                WELCOME TO
              </Text>
              <LinearGradient
                colors={['#FF6B9D', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.welcomeUnderline}
              />
            </View>

            <Text style={[styles.heroTitle, { fontSize: titleSize, color: '#FF6B9D' }]}>
              Coach Connect
            </Text>

            <Text
              style={[
                styles.heroTagline,
                { color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.55)' },
              ]}
            >
              YOUR TRAINER-CLIENT RELATIONSHIP GETS BETTER WITH CC
            </Text>
          </View>

          {/* Right (Lottie) */}
          <View style={[styles.heroRight, { flex: isWide ? 0.4 : 1 }]}>
            {/* Inline: Lottie (left) + Daily Quote pill (right) */}
            <View style={styles.heroRightInlineRow}>
              <LottieView
                source={require('../assets/icons/weightlifting-competition.json')}
                autoPlay
                loop
                style={{ width: lottieSize, height: lottieSize }}
              />

              <View style={styles.heroInlineQuoteWrap}>
                <LinearGradient
                  colors={['#FF6B9D', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroInlineQuoteBorder}
                >
                  <DailyQuotePill userId={userId} isDarkOverride={isDark} maxLines={3} />
                </LinearGradient>
              </View>
            </View>
          </View>
          </View>

          {/* Quote pill moved inline next to Lottie */}
        </View>
      </LinearGradient>
    </View>
  );
};

const GreetingSection = ({ userName = "User", theme, isDark }) => {
  const dark = isDark ?? (theme === 'dark');
  return (
    <View style={styles.greetingSection}>
      {/* Keep greeting logic — just style/layout changes */}
      <View style={styles.greetingLineWrap}>
        <Text style={[styles.greetingTitle, { color: dark ? '#FFFFFF' : '#111827' }]}>
          Good {getGreeting()},
        </Text>
        <MaskedView
          style={{ marginLeft: 6 }}
          maskElement={<Text style={[styles.greetingTitle, { color: dark ? '#FFFFFF' : '#111827' }]}>{userName}!</Text>}
        >
          <LinearGradient colors={['#FF6B9D', '#C084FC']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Text style={[styles.greetingTitle, { opacity: 0 }]}>{userName}!</Text>
          </LinearGradient>
        </MaskedView>
      </View>
    </View>
  );
};

const NewCalendar = ({ theme }) => {
  const isDark = theme === 'dark';
  const getWeekDays = () => {
    const today = new Date();
    const currentDay = today.getDay();
    const diff = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
    const monday = new Date(today.setDate(diff));
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDays.push(date);
    }
    return weekDays;
  };

  const weekDays = getWeekDays();
  const today = getDateKey();

  return (
    <View style={styles.calendarContainer}>
      <LinearGradient
        colors={['#FF6B9D', '#F97316']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientCardBorder}
      >
        <View style={[styles.weekCalendar, !isDark && styles.lightCard]}>
          <View style={styles.weekHeader}>
            <Text style={[styles.weekHeaderText, !isDark && styles.lightText]}>This Week</Text>
          </View>
          <View style={styles.weekDays}>
            {weekDays.map((day, index) => {
              const dayStr = day.toISOString().split('T')[0];
              const isToday = dayStr === today;
              const dayName = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index];
              
              return (
                <TouchableOpacity 
                  key={index} 
                  style={[
                    styles.weekDay, 
                    isToday && styles.weekDayToday,
                    !isDark && styles.lightWeekDay
                  ]}
                >
                  <Text style={[styles.weekDayName, !isDark && styles.lightMutedText]}>
                    {dayName}
                  </Text>
                  <Text style={[
                    styles.weekDayNumber, 
                    isToday && styles.weekDayNumberToday,
                    !isDark && styles.lightText
                  ]}>
                    {day.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

// Trainer button: Find a coach / trainer marketplace 
const TrainerButton = ({ label, onPress, notificationCount = 0, theme = 'dark' }) => {
  const isDark = theme === 'dark';
  return (
    <View style={styles.trainerButtonContainer}>
      <LinearGradient
        colors={['#FF6B9D', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 24,
          padding: 2,
          overflow: 'hidden',
          shadowColor: '#FF6B9D',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.28,
          shadowRadius: 12,
          elevation: 5,
        }}
      >
        <View
          style={{
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
            borderRadius: 22,
            paddingVertical: 18,
            paddingHorizontal: 18,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              fontWeight: '800',
              color: '#FF6B9D',
              letterSpacing: 2,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Trainer Marketplace
          </Text>

          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              lineHeight: 21,
              marginBottom: 14,
              color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(15, 23, 42, 0.78)',
            }}
          >
            Find the right coach and get custom plans, support, and accountability.
          </Text>

          <LinearGradient
            colors={['#FF6B9D', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: 20, overflow: 'hidden' }}
          >
            <TouchableOpacity
              onPress={onPress}
              activeOpacity={0.85}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 18,
                alignItems: 'center',
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <Ionicons name="search" size={20} color="#FFFFFF" />
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#FFFFFF' }}>{label}</Text>
                {notificationCount > 0 ? (
                  <View
                    style={{
                      marginLeft: 2,
                      minWidth: 22,
                      height: 22,
                      paddingHorizontal: 6,
                      borderRadius: 11,
                      backgroundColor: 'rgba(255,255,255,0.22)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </Text>
                  </View>
                ) : null}
                <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </LinearGradient>
    </View>
  );
};

// Training agenda: Today's workouts list with checkboxes and structured exercises.
const TrainingAgenda = ({ theme, workouts = [], onPlanWorkout, onToggleWorkout }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#FFFFFF' : '#111827';
  const mutedColor = isDark ? '#B0B0B0' : 'rgba(17,24,39,0.6)';
  const subtleBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';
  const subtleFill = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
  const agendaBgColors = isDark ? ['#1A1F2E', '#0F1419'] : ['#FFFFFF', '#F3F4F6'];
  const agendaTextureColors = isDark
    ? ['rgba(255,255,255,0.07)', 'rgba(255,255,255,0)', 'rgba(192,132,252,0.08)']
    : ['rgba(0,0,0,0.03)', 'rgba(0,0,0,0)', 'rgba(192,132,252,0.10)'];

  const w0 = (workouts || [])[0] || null;
  const rawTitle = String(w0?.name || w0?.workoutName || 'Training Agenda').trim();

  const exercises = (() => {
    if (!w0) return [];
    if (Array.isArray(w0.exercises)) return w0.exercises.filter(Boolean).map((x) => String(x));
    if (typeof w0.exercises === 'string' && w0.exercises.trim()) {
      // Attempt to split "Exercise — 3x10" lines if present
      return w0.exercises
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  })();

  const exerciseCount = exercises.length;
  const estMinutes = (() => {
    if (!exerciseCount) return 0;
    // Premium-feeling estimate without overthinking it.
    const base = 20;
    const perExercise = 12;
    return clamp(base + exerciseCount * perExercise, 25, 75);
  })();

  const titleIconName = (() => {
    const t = rawTitle.toLowerCase();
    if (t.includes('arm')) return 'fitness-outline';
    if (t.includes('leg')) return 'walk-outline';
    if (t.includes('chest')) return 'barbell-outline';
    if (t.includes('back')) return 'body-outline';
    if (t.includes('rest')) return 'leaf-outline';
    return 'flash-outline';
  })();

  const nowTime = useRef(new Date()).current;
  const timestamp = nowTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Animations: card entrance + cascade items
  const enter = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef([]).current;
  const shownExercises = exercises.slice(0, 8);
  while (itemAnims.length < shownExercises.length) itemAnims.push(new Animated.Value(0));

  useEffect(() => {
    enter.setValue(0);
    itemAnims.forEach((v) => v.setValue(0));

    Animated.timing(enter, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    if (shownExercises.length) {
      Animated.stagger(
        100,
        shownExercises.map((_, i) =>
          Animated.timing(itemAnims[i], {
            toValue: 1,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ),
      ).start();
    }
  }, [enter, exercises.length]);

  return (
    <View style={styles.agendaContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText]}>Training Agenda Today</Text>
      <LinearGradient
        colors={['#E91E63', '#FF6B9D', '#C084FC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.agendaGradientBorder}
      >
        <Animated.View
          style={[
            styles.agendaCardInner,
            {
              opacity: enter,
              transform: [
                {
                  translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }),
                },
              ],
            },
          ]}
        >
          {/* Left accent rail */}
          <LinearGradient
            colors={['#E91E63', '#FF6B9D']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.agendaLeftRail}
          />

          {/* Rich background */}
          <LinearGradient
            colors={agendaBgColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.agendaBg}
          >
            {/* Subtle texture */}
            <LinearGradient
              colors={agendaTextureColors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.agendaTexture}
            />

            <View style={styles.agendaPad}>
              <View style={styles.agendaHeaderRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.agendaSubtitle, { color: mutedColor }]}>TODAY'S FOCUS</Text>
                  <View style={styles.agendaTitleRow}>
                    <View
                      style={[
                        styles.agendaTitleIconWrap,
                        { backgroundColor: subtleFill, borderColor: subtleBorder },
                      ]}
                    >
                      <Ionicons name={titleIconName} size={16} color={textColor} />
                    </View>
                    <Text style={[styles.agendaTitle, { color: textColor }]} numberOfLines={1}>
                      {rawTitle || 'Training Agenda'}
                    </Text>
                  </View>
                </View>

                <View style={[styles.agendaBadge, { backgroundColor: subtleFill, borderColor: subtleBorder }]}>
                  <Text style={[styles.agendaBadgeText, { color: textColor }]}>
                    {exerciseCount || 0} {exerciseCount === 1 ? 'exercise' : 'exercises'}
                  </Text>
                </View>
              </View>

              {exerciseCount === 0 ? (
                <View style={{ paddingTop: 14, paddingBottom: 6 }}>
                  <Text style={[styles.agendaEmptyPremium, { color: mutedColor }]}>
                    No exercises logged yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.agendaExercisesWrap}>
                  {shownExercises.map((line, i) => {
                    // Accept "Exercise — sets", or "Exercise (sets)", or plain "Exercise"
                    const dashIdx = line.search(/\s[-–—]\s/);
                    const parenIdx = line.indexOf('(');
                    let name = line;
                    let sets = '';
                    if (dashIdx > -1) {
                      name = line.slice(0, dashIdx).trim();
                      sets = line.slice(dashIdx + 1).trim();
                    } else if (parenIdx > -1) {
                      name = line.slice(0, parenIdx).trim();
                      sets = line.slice(parenIdx).trim().replace(/^\(/, '').replace(/\)$/, '').trim();
                    }
                    return (
                      <Animated.View
                        key={`${line}_${i}`}
                        style={{
                          opacity: itemAnims[i],
                          transform: [
                            {
                              translateY: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [6, 0] }),
                            },
                          ],
                        }}
                      >
                        <View style={styles.agendaExerciseRowPremium}>
                          <LinearGradient
                            colors={['rgba(233,30,99,0.9)', 'rgba(255,107,157,0.85)', 'rgba(192,132,252,0.85)']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={styles.agendaDot}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.agendaExerciseName, { color: textColor }]} numberOfLines={1}>
                              {name}
                            </Text>
                            {sets ? (
                              <Text style={[styles.agendaExerciseSets, { color: mutedColor }]} numberOfLines={2}>
                                {sets}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>
              )}

              {/* Footer */}
              <View style={styles.agendaFooterRow}>
                <Text style={[styles.agendaDuration, { color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(17,24,39,0.72)' }]}>
                  {estMinutes ? `Est. ${estMinutes} min` : 'Est. —'}
                </Text>
                <Text style={[styles.agendaTimestamp, { color: mutedColor }]}>{timestamp}</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

// Nutrition card: Daily macros + calories progress bar + action button for meal logging.
const NutritionCard = ({ theme, consumed = 0, goal = 2500, macros = null, additionalNutrients = null, onAddMeal, nutritionGoals = null, compact = true }) => {
  const isDark = theme === 'dark';
  
  // Combine all nutrients for arc progress display
  const allNutrients = [];
  
  // Add main macros with actual goals if available
  if (macros) {
    allNutrients.push(...(macros || []).map(m => {
      // Extract numeric value from string like "25g"
      const numericValue = parseFloat(m.value.replace(/[^\d.]/g, ''));
      return {
        ...m,
        value: numericValue,
        goal: m.label === 'Protein' ? (nutritionGoals?.proteinTarget || 150) : 
              m.label === 'Carbs' ? (nutritionGoals?.carbsTarget || 250) : 
              (nutritionGoals?.fatTarget || 70),
        color: m.label === 'Protein' ? '#EC4899' : m.label === 'Carbs' ? '#F97316' : '#06B6D4',
        unit: 'g'
      };
    }));
  }
  
  // Add additional nutrients with evidence-based goals
  if (additionalNutrients) {
    additionalNutrients.forEach(n => {
      let nutrientGoal = 25; // Default goal
      let nutrientColor = '#22C55E'; // Default green
      
      if (n.label === 'Fiber') {
        nutrientGoal = 25; // Daily fiber goal (25g for women, 38g for men, using average)
        nutrientColor = '#22C55E'; // Green
      } else if (n.label === 'Sugar') {
        nutrientGoal = 50; // Added sugar limit (50g per WHO recommendation)
        nutrientColor = '#F97316'; // Orange
      } else if (n.label === 'Sodium') {
        nutrientGoal = 2300; // Daily sodium limit (2300mg per FDA)
        nutrientColor = '#06B6D4'; // Cyan
      } else if (n.label === 'Potassium') {
        nutrientGoal = 3500; // Daily potassium goal (3500mg per NIH)
        nutrientColor = '#C084FC'; // Purple
      }
      
      // Extract numeric value from string like "25g" or "2300mg"
      const numericValue = parseFloat(n.value.replace(/[^\d.]/g, ''));
      const unit = n.value.includes('mg') ? 'mg' : 'g';
      
      allNutrients.push({
        label: n.label,
        value: numericValue,
        goal: nutrientGoal,
        color: nutrientColor,
        unit: unit,
        icon: n.icon // Keep icon for fallback display
      });
    });
  }
  
  const pct = goal > 0 ? Math.min(100, (consumed / goal) * 100) : 0;
  const hasLoggedNutrition =
    Math.round(Number(consumed) || 0) > 0 ||
    (allNutrients || []).some((n) => Number(n.value) > 0);

  const textPrimary = isDark ? '#FFFFFF' : '#1a1040';
  const textMuted = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(26,16,64,0.6)';
  const trackColor = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  // Arc progress — one circle with value in center, label below
  const ClientArcProgress = ({ value, goal, label, color, unit }) => {
    const progress = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
    // Compact for home feed (reduces overall card height).
    const size = compact ? 78 : 72;
    const strokeWidth = compact ? 7 : 6;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const dashOffset = circumference * (1 - progress / 100);
    return (
      <View style={styles.nutritionCircleWrap}>
        <View style={{ width: size, height: size }}>
          <View style={{ transform: [{ rotate: '-90deg' }] }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
              <Circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="none" strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={dashOffset} strokeLinecap="round" />
            </Svg>
          </View>
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={[styles.nutritionCircleValue, { color: textPrimary }]}>{Math.round(value)}{unit}</Text>
          </View>
        </View>
        <Text style={[styles.nutritionCircleLabel, { color: textMuted, marginTop: 6 }]}>{label}</Text>
      </View>
    );
  };

  // 2x2 grid: row0 = Protein, Carbs; row1 = Fats, Calories
  const caloriesProgress = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;

  const nutrientsWithData = (allNutrients || []).filter((n) => Number(n.value) > 0);
  const compactRings =
    nutrientsWithData.length > 0
      ? nutrientsWithData.slice(0, 3)
      : Math.round(Number(consumed) || 0) > 0
        ? [{ value: Math.round(consumed), goal, label: 'Calories', color: '#8B5CF6', unit: '' }]
        : [];

  return (
    <View style={styles.nutritionContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText]}>Nutrition Today</Text>
      <View style={styles.nutritionGradientBorder}>
        <LinearGradient
          colors={['#E91E63', '#FF6B9D', '#C084FC']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.nutritionCard, !isDark && styles.nutritionCardLight]}>
        {!hasLoggedNutrition ? (
          <View style={{ alignItems: 'center', paddingVertical: 8, paddingHorizontal: 8 }}>
            <LottieView
              source={require('../assets/Lotties for Anatrox/Food squeeze_With Burger and hot dog.json')}
              autoPlay
              loop
              style={{ width: compact ? 150 : 160, height: compact ? 150 : 160 }}
            />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '800',
                color: textPrimary,
                textAlign: 'center',
                marginTop: 4,
                letterSpacing: -0.2,
              }}
            >
              No meals logged yet
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '600',
                color: textMuted,
                textAlign: 'center',
                marginTop: 6,
                lineHeight: 18,
                paddingHorizontal: 12,
              }}
            >
              Log food in Nutrition and your macros will show up here with the rings.
            </Text>
            {onAddMeal ? (
              <TouchableOpacity activeOpacity={0.88} onPress={onAddMeal} style={{ marginTop: 14 }}>
                <LinearGradient
                  colors={['#FF6B9D', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 22,
                    paddingVertical: 12,
                    borderRadius: 20,
                  }}
                >
                  <Ionicons name="nutrition-outline" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '800' }}>Log nutrition</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            {compact ? (
              <View style={styles.nutritionCompactCirclesRow}>
                {compactRings.map((n) => (
                  <View key={n.label} style={styles.nutritionCompactCircleCell}>
                    <ClientArcProgress value={n.value} goal={n.goal} label={n.label} color={n.color} unit={n.unit} />
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.nutritionGrid2x2}>
                {(nutrientsWithData.length > 0 ? nutrientsWithData.slice(0, 3) : []).map((n) => (
                  <View key={n.label} style={styles.nutritionGridCell}>
                    <ClientArcProgress value={n.value} goal={n.goal} label={n.label} color={n.color} unit={n.unit} />
                  </View>
                ))}
                {Math.round(Number(consumed) || 0) > 0 ? (
                  <View style={styles.nutritionGridCell}>
                    <ClientArcProgress value={Math.round(consumed)} goal={goal} label="Calories" color="#8B5CF6" unit="" />
                  </View>
                ) : null}
              </View>
            )}
            <View style={styles.caloriesSection}>
              <View style={styles.caloriesInfo}>
                <Text style={[styles.caloriesLabel, { color: textMuted }]}>Calories</Text>
                <Text style={[styles.caloriesValue, { color: textPrimary }]}>{Math.round(consumed)} / {goal} kcal</Text>
              </View>
              <View style={[styles.progressBarBackground, !isDark && { backgroundColor: '#E5E7EB' }]}>
                <View style={[styles.progressBar, { width: `${Math.min(pct, 100)}%`, backgroundColor: isDark ? '#8B5CF6' : '#7C3AED' }]} />
              </View>
            </View>
          </>
        )}
        </View>
      </View>
    </View>
  );
};

const NotesFiles = ({ theme, items = [], onOpenFile }) => {
  const isDark = theme === 'dark';
  const textColor = isDark ? '#fff' : '#1a1040';
  const mutedColor = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,16,64,0.6)';
  const fromYou = (items || []).filter((x) => (x.addedBy || 'client') === 'client');
  const fromTrainer = (items || []).filter((x) => x.addedBy === 'trainer' || (x.type === 'document' && x.trainerId));
  const hasAny = items.length > 0;

  const openUrl = (url, file) => {
    if (onOpenFile) onOpenFile(url, file);
    else if (url) Linking.openURL(url).catch(() => {});
  };

  const formatDate = (d) => {
    if (!d) return '';
    const t = d instanceof Date ? d : new Date(d);
    return t.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const fileIcon = (file) => {
    if (file.type === 'spreadsheet') return 'grid-outline';
    if (file.type === 'document' || (file.documentId && file.trainerId)) return 'document-outline';
    if (file.type === 'pdf') return 'document-text-outline';
    if (file.type === 'photo') return 'image-outline';
    return 'attach-outline';
  };

  const fileTypeLabel = (file) => {
    if (file.type === 'spreadsheet') return 'Spreadsheet';
    if (file.type === 'document' || (file.documentId && file.trainerId)) return 'Document';
    if (file.type === 'pdf') return 'PDF';
    if (file.type === 'photo') return 'Image';
    return 'File';
  };

  const fileTypeLabelColor = (file) => {
    if (file.type === 'spreadsheet') return '#10B981';
    if (file.type === 'document' || (file.documentId && file.trainerId)) return '#64D2FF';
    return '#8A8A8A';
  };

  const renderBlock = (list, sectionTitle) => {
    const notes = (list || []).filter((x) => x.type === 'note');
    const photos = (list || []).filter((x) => x.type === 'photo');
    const videos = (list || []).filter((x) => x.type === 'video');
    const docs = (list || []).filter((x) => x.type === 'pdf' || x.type === 'doc');
    const spreadsheets = (list || []).filter((x) => x.type === 'spreadsheet');
    const trainerDocs = (list || []).filter((x) => x.type === 'document' || (x.documentId && x.trainerId));
    const allFiles = [...docs, ...spreadsheets, ...trainerDocs];
    if (list.length === 0) return null;
    return (
      <View key={sectionTitle} style={styles.notesSection}>
        <Text style={[styles.notesCategoryTitle, { color: mutedColor }]}>{sectionTitle}</Text>
        {notes.length > 0 && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Notes</Text>
            {(notes || []).map((n, i) => (
              <View key={n.id || i} style={[styles.notesNoteCard, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}>
                <Text style={[styles.notesNoteText, { color: textColor }]}>{n.content}</Text>
                <Text style={[styles.notesNoteDate, { color: mutedColor }]}>{formatDate(n.createdAt)}</Text>
              </View>
            ))}
          </>
        )}
        {(photos.length > 0 || videos.length > 0) && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Photos & Videos</Text>
            <View style={styles.notesMediaGrid}>
              {(photos || []).map((p, i) => (
                <TouchableOpacity key={p.id || i} onPress={() => p.url && openUrl(p.url, p)} style={styles.notesMediaCard} activeOpacity={0.8}>
                  <Image source={{ uri: p.url }} style={[styles.notesMediaThumb, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]} />
                  <Text style={[styles.notesMediaLabel, { color: mutedColor }]} numberOfLines={1}>{p.name || 'Photo'}</Text>
                </TouchableOpacity>
              ))}
              {(videos || []).map((v, i) => (
                <TouchableOpacity key={v.id || i} onPress={() => v.url && openUrl(v.url, v)} style={styles.notesMediaCard} activeOpacity={0.8}>
                  <View style={[styles.notesMediaThumb, styles.notesVideoPlaceholder, { borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }]}>
                    <Feather name="video" size={24} color={isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'} />
                  </View>
                  <Text style={[styles.notesMediaLabel, { color: mutedColor }]} numberOfLines={1}>{v.name || 'Video'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        {allFiles.length > 0 && (
          <>
            <Text style={[styles.notesSectionTitle, { color: mutedColor }]}>Files</Text>
            {(allFiles || []).map((f, i) => (
              <TouchableOpacity
                key={f.id || i}
                onPress={() => {
                  if (f.type === 'document' || (f.documentId && f.trainerId)) {
                    if (onOpenFile) onOpenFile(null, f);
                  } else if (f.url) {
                    openUrl(f.url, f);
                  }
                }}
                style={[styles.notesDocRow, { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
                activeOpacity={0.8}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={fileIcon(f)} size={22} color={textColor} />
                </View>
                <View style={styles.notesFileInfo}>
                  <Text style={[styles.notesDocName, { color: textColor }]} numberOfLines={1}>{f.name || f.title || 'File'}</Text>
                  <Text style={[styles.notesFileMeta, { color: mutedColor }]}>{formatDate(f.createdAt)} · <Text style={{ color: fileTypeLabelColor(f), fontWeight: '600' }}>{fileTypeLabel(f)}</Text></Text>
                </View>
                {f.type !== 'document' && f.type !== 'spreadsheet' && <Feather name="external-link" size={18} color={mutedColor} />}
                {(f.type === 'document' || f.type === 'spreadsheet' || (f.documentId && f.trainerId)) && <Ionicons name="chevron-forward" size={20} color={mutedColor} />}
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>
    );
  };

  return (
    <View style={styles.notesContainer}>
      <Text style={[styles.sectionTitle, !isDark && styles.lightText]}>Notes & Files</Text>
      <LinearGradient
        colors={['#C084FC', '#FF6B9D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.notesGradientBorder}
      >
        <View style={[styles.notesCardInner, isDark ? styles.notesCardDark : styles.notesCardLight]}>
          {!hasAny ? (
            <View style={styles.notesEmptyContent}>
              <Feather name="file-plus" size={40} color={mutedColor} />
              <Text style={[styles.notesEmptyText, { color: mutedColor }]}>You have no notes or files yet.</Text>
              <Text style={[styles.notesEmptySubtext, { color: mutedColor }]}>Tap the + button to add photos, videos, notes, or PDFs. Documents shared by your trainer appear under From trainer.</Text>
            </View>
          ) : (
            <View style={styles.notesContent}>
              {renderBlock(fromYou, 'From you')}
              {renderBlock(fromTrainer, 'From trainer')}
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

// Helper functions
const calculateCalorieGoal = (primaryGoal, weight, height, age, gender, daysPerWeek) => {
  if (!weight || !height || !age || !gender) return 2000;
  const weightKg = weight / 2.20462;
  const heightCm = height * 2.54;
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  let activityLevel = 'sedentary';
  if (daysPerWeek >= 6) activityLevel = 'very_active';
  else if (daysPerWeek >= 4) activityLevel = 'active';
  else if (daysPerWeek >= 3) activityLevel = 'moderate';
  else if (daysPerWeek >= 1) activityLevel = 'light';
  const tdee = calculateTDEE(bmr, activityLevel);
  switch (primaryGoal) {
    case 'lose_fat': return Math.round(tdee - 500);
    case 'build_muscle': return Math.round(tdee + 300);
    case 'athletic_performance': return Math.round(tdee + 500);
    default: return Math.round(tdee);
  }
};

const calculateStreak = (completedWorkouts) => {
  if (!completedWorkouts || completedWorkouts.length === 0) return 0;
  const sorted = [...completedWorkouts].sort((a, b) => {
    const aDate = a.completedAt?.toDate?.() || new Date(a.completedAt);
    const bDate = b.completedAt?.toDate?.() || new Date(b.completedAt);
    return bDate - aDate;
  });
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const workoutsByDate = {};
  sorted.forEach(workout => {
    const workoutDate = workout.completedAt?.toDate?.() || new Date(workout.completedAt);
    workoutDate.setHours(0, 0, 0, 0);
    const dateKey = workoutDate.toISOString().split('T')[0];
    if (!workoutsByDate[dateKey]) workoutsByDate[dateKey] = true;
  });
  let currentDate = new Date(today);
  while (workoutsByDate[currentDate.toISOString().split('T')[0]]) {
    streak++;
    currentDate.setDate(currentDate.getDate() - 1);
  }
  return streak;
};

// Main Component
export default function ClientApp({ user, userData, onRefetchUserData }) {
  const { colors, spacing, isDark, themeMode } = useTheme();
  const t = getPremiumTheme(isDark, colors);

  // Navigation state
  const [showTrainerMessaging, setShowTrainerMessaging] = useState(false);
  const [showConversationsList, setShowConversationsList] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWorkoutPlanGenerator, setShowWorkoutPlanGenerator] = useState(false);
  const [showWorkoutOnboarding, setShowWorkoutOnboarding] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null);
  const [showTrainerProfile, setShowTrainerProfile] = useState(false);
  const [profileTrainer, setProfileTrainer] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [trainerData, setTrainerData] = useState(null);
  const [trainerLinkError, setTrainerLinkError] = useState(false);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [showTrainerSearch, setShowTrainerSearch] = useState(false);
  const [showMyDashboard, setShowMyDashboard] = useState(false);
  const [showAddNotesFilesModal, setShowAddNotesFilesModal] = useState(false);
  const [showTrainerSharedFilesModal, setShowTrainerSharedFilesModal] = useState(false);
  const [notesAndFiles, setNotesAndFiles] = useState([]);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [documentViewer, setDocumentViewer] = useState({ visible: false, trainerId: null, documentId: null, title: null });
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedWebViewer, setEmbedWebViewer] = useState({ visible: false, uri: null, title: null });
  const [pendingSessions, setPendingSessions] = useState([]);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [showAIWorkouts, setShowAIWorkouts] = useState(false);
  const [showPlanViewer, setShowPlanViewer] = useState(false);
  const [viewingPlan, setViewingPlan] = useState(null);
  const [day6Client, setDay6Client] = useState(null); // { id, name }
  const [showRemoveTrainerSheet, setShowRemoveTrainerSheet] = useState(false);
  const [reviewPromptTrainer, setReviewPromptTrainer] = useState(null);
  const [showReviewSheetForPrompt, setShowReviewSheetForPrompt] = useState(false);
  /** null = closed, 'home' = AI hub, object = active thread { prefill?, sessionId? } */
  const [aiChatState, setAiChatState] = useState(null);
  const openAIChatHome = useCallback(() => setAiChatState('home'), []);

  // Home screen data state
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState(null);
  const [todayWorkout, setTodayWorkout] = useState(null);
  const [caloriesConsumed, setCaloriesConsumed] = useState(0);
  const [caloriesBurned, setCaloriesBurned] = useState(0);
  const [calorieGoal, setCalorieGoal] = useState(2000);
  const [nutritionGoals, setNutritionGoals] = useState(null);
  const [streak, setStreak] = useState(0);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [programCount, setProgramCount] = useState(0);
  const [upcomingItems, setUpcomingItems] = useState([]);
  const [userWeight, setUserWeight] = useState(null);
  const [macroTotals, setMacroTotals] = useState({ protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0 });
  const [waterIntake, setWaterIntake] = useState(null);
  const [sleepHours, setSleepHours] = useState(null);
  const [soreness, setSoreness] = useState(null);
  const [energyLevel, setEnergyLevel] = useState(null);
  const [stressLevel, setStressLevel] = useState(null);
  const [goalProgress, setGoalProgress] = useState(null);
  const [dashboardWorkoutSummary, setDashboardWorkoutSummary] = useState(null);
  const [loadingStartTime, setLoadingStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const isFetching = useRef(false); // Prevent duplicate calls

  // Clear cache and reset state when user changes
  useEffect(() => {
    if (!user?.uid) return;
    
    console.log(`🔄 ClientApp: User changed to ${user.uid} - resetting state`);
    
    // Reset all user-specific state
    setTrainerData(null);
    setOnboardingData(null);
    setTodayWorkout(null);
    setCaloriesConsumed(0);
    setCaloriesBurned(0);
    setCalorieGoal(2000);
    setNutritionGoals(null);
    setStreak(0);
    setWorkoutCount(0);
    setClientCount(0);
    setProgramCount(0);
    setUpcomingItems([]);
    setUserWeight(null);
    setMacroTotals({ protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0, potassium: 0 });
    setWaterIntake(null);
    setSleepHours(null);
    setSoreness(null);
    setEnergyLevel(null);
    setStressLevel(null);
    setGoalProgress(null);
    setDashboardWorkoutSummary(null);
    setNotesAndFiles([]);
    
    // Clear any cached data
    clearAllUserData().catch(e => {
      console.log('⚠️ Failed to clear cache in ClientApp:', e.message);
    });
  }, [user?.uid]);

  // Subscribe to unread message count
  useEffect(() => {
    if (!user || !user.uid) return;

    const unsubscribe = subscribeToUnreadCount(user.uid, (count) => {
      setUnreadMessageCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  // P1#3: Reconcile trainerId - discover accepted, clear if rejected
  useEffect(() => {
    if (!user?.uid || !db || userData?.role !== 'client') return;

    const reconcileTrainerId = async () => {
      try {
        const clientUid = user.uid;

        // Case 1: Has trainerId - verify link exists, clear if rejected, or re-create via Cloud Function
        if (userData.trainerId) {
          const linkDoc = await getDoc(doc(db, `trainer_clients/${userData.trainerId}/clients/${clientUid}`));
          if (linkDoc.exists()) {
            // Link exists - load trainer data
            const trainerDoc = await getDoc(doc(db, 'users', userData.trainerId));
            if (trainerDoc.exists()) {
              setTrainerData({ id: trainerDoc.id, ...trainerDoc.data() });
            }
            setTrainerLinkError(false);
            return;
          }
          // Link doesn't exist - check if rejected
          const conversationId = `conv_${clientUid}_${userData.trainerId}`;
          const messagesRef = collection(db, 'messages');
          const msgQuery = query(
            messagesRef,
            where('conversationId', '==', conversationId),
            where('senderId', '==', clientUid),
            where('status', '==', 'rejected'),
            limit(1)
          );
          const msgSnap = await getDocs(msgQuery);
          if (!msgSnap.empty) {
            const status = msgSnap.docs[0].data().status;
            if (status === 'rejected') {
              await updateDoc(doc(db, 'users', clientUid), { trainerId: deleteField(), trainerName: deleteField(), trainerAssignedAt: deleteField() });
              setTrainerData(null);
              setTrainerLinkError(false);
              onRefetchUserData?.();
            }
            return;
          }
          // Link doesn't exist and no rejected status - attempt to re-create via Cloud Function
          if (functions) {
            try {
              const linkClient = httpsCallable(functions, 'linkClientWithTrainerCode');
              await linkClient({ clientId: clientUid, trainerId: userData.trainerId });
              const trainerDoc = await getDoc(doc(db, 'users', userData.trainerId));
              if (trainerDoc.exists()) {
                setTrainerData({ id: trainerDoc.id, ...trainerDoc.data() });
              }
              setTrainerLinkError(false);
            } catch (linkErr) {
              await updateDoc(doc(db, 'users', clientUid), { trainerId: deleteField(), trainerName: deleteField(), trainerAssignedAt: deleteField() });
              setTrainerData(null);
              setTrainerLinkError(true);
              onRefetchUserData?.();
            }
          } else {
            setTrainerLinkError(true);
          }
          return;
        }

        // Case 2: No trainerId - discover if trainer accepted (trainer_clients exists)
        const convsRef = collection(db, 'conversations');
        const convQuery = query(convsRef, where('participants', 'array-contains', clientUid));
        const convSnap = await getDocs(convQuery);
        for (const convDoc of convSnap.docs) {
          const participants = convDoc.data().participants || [];
          const trainerUid = participants.find((p) => p !== clientUid);
          if (!trainerUid) continue;
          const linkDoc = await getDoc(doc(db, `trainer_clients/${trainerUid}/clients/${clientUid}`));
          if (linkDoc.exists()) {
            const trainerDoc = await getDoc(doc(db, 'users', trainerUid));
            const trainerData = trainerDoc.exists() ? trainerDoc.data() : {};
            await updateDoc(doc(db, 'users', clientUid), {
              trainerId: trainerUid,
              trainerName: trainerData.name || trainerData.displayName || 'Trainer',
              trainerAssignedAt: serverTimestamp(),
            });
            setTrainerData({ id: trainerUid, ...trainerData });
            onRefetchUserData?.();
            break;
          }
        }
      } catch (error) {
        console.error('Reconcile trainerId:', error);
      }
    };

    reconcileTrainerId();
  }, [user?.uid, userData?.trainerId, userData?.role, onRefetchUserData]);

  // Fetch home screen data
  useEffect(() => {
    const startTime = Date.now();
    console.log(`🚀 Starting data fetch for user: ${user?.uid} at ${new Date().toISOString()}`);
    
    // Prevent duplicate calls
    if (isFetching.current) {
      console.log(`⚠️ Already fetching data, skipping... (${(Date.now() - startTime)}ms)`);
      return;
    }
    
    const fetchData = async () => {
      isFetching.current = true;
      
      if (!user?.uid || !db) {
        console.log(`❌ No user or db, setting loading false (${(Date.now() - startTime)}ms)`);
        setLoading(false);
        isFetching.current = false;
        return;
      }

      // Force loading to complete after 10 seconds as backup
      const timeout = setTimeout(() => {
        console.log(`⏰ TIMEOUT: Forcing loading to complete due to timeout (${(Date.now() - startTime)}ms)`);
        setLoading(false);
      }, 10000);

      try {
        console.log(`📥 Setting loading to true (${(Date.now() - startTime)}ms)`);
        setLoadingStartTime(Date.now());
        setLoading(true);
        
        // RESTORE: Get user data first (most important)
        console.log(`👤 Fetching user data... (${(Date.now() - startTime)}ms)`);
        console.log(`🔍 Firebase check - db exists: ${!!db}, user.uid: ${user?.uid}`);
        
        let userDoc;
        try {
          const userRef = doc(db, 'users', user.uid);
          console.log(`📍 User ref path: ${userRef.path}`);
          
          userDoc = await Promise.race([
            getDoc(userRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error('User data timeout')), 8000))
          ]);
          console.log(`✅ User data fetched in ${Date.now() - startTime}ms`);
        } catch (error) {
          console.error(`❌ User data fetch failed: ${error.message}`);
          console.error(`🔍 Error details:`, {
            errorMessage: error.message,
            errorCode: error.code,
            errorStack: error.stack?.substring(0, 200),
            dbExists: !!db,
            userUid: user?.uid,
            timestamp: new Date().toISOString()
          });
          // Continue with empty user data rather than failing completely
          // Keep snapshot-like shape so downstream code can safely call exists()/data().
          userDoc = {
            exists: () => false,
            data: () => null,
          };
        }
        
        // Process user data (even if failed, set defaults to prevent infinite loading)
        if (userDoc && userDoc.exists()) {
          const userDocData = userDoc.data();
          setOnboardingData(userDocData);
          setUserWeight(userDocData.weight);
          setGoalProgress(typeof userDocData.goalProgress === 'number' ? userDocData.goalProgress : null);
          
          const storedCalories = userDocData.calorieTarget ?? userDocData.calorie_target ?? userDocData.nutrition?.calories;
          if (typeof storedCalories === 'number' && storedCalories > 0) {
            setCalorieGoal(Math.round(storedCalories));
          }
          console.log(`✅ User data processed (${(Date.now() - startTime)}ms)`);
        } else {
          console.log(`⚠️ No user data found, using defaults (${(Date.now() - startTime)}ms)`);
          // Set default values to prevent UI issues
          setOnboardingData({});
          setUserWeight(null);
          setGoalProgress(null);
          setCalorieGoal(2000); // Default calorie goal
        }

        // RESTORE: Get nutrition goals
        console.log(`🥗 Fetching nutrition goals... (${(Date.now() - startTime)}ms)`);
        try {
          const goalsDoc = await Promise.race([
            getDoc(doc(db, 'nutrition_goals', user.uid)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Nutrition goals timeout')), 5000))
          ]);
          
          if (goalsDoc.exists()) {
            const goalsData = goalsDoc.data();
            if (typeof goalsData?.calories === 'number' && goalsData.calories > 0) {
              setCalorieGoal(Math.round(goalsData.calories));
            }
            console.log(`✅ Nutrition goals processed (${(Date.now() - startTime)}ms)`);
          }
        } catch (e) {
          console.log(`⚠️ Nutrition goals failed, continuing...`);
        }

        // RESTORE: Get daily tracking data (TODAY only — after midnight, start fresh)
        console.log(`📊 Fetching daily tracking data... (${(Date.now() - startTime)}ms)`);
        try {
          const todayKey = getDateKey();
          const trackingDoc = await Promise.race([
            getDoc(doc(db, 'users', user.uid, 'daily_tracking', todayKey)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Daily tracking timeout')), 5000))
          ]);
          
          if (trackingDoc.exists()) {
            const trackingData = trackingDoc.data();
            setWaterIntake(typeof trackingData.waterIntake === 'number' ? trackingData.waterIntake : null);
            setSleepHours(typeof trackingData.sleepHours === 'number' ? trackingData.sleepHours : null);
            if (trackingData.workoutSummary) {
              setDashboardWorkoutSummary(trackingData.workoutSummary);
            }
            if (trackingData.workoutName) {
              setTodayWorkout({
                name: trackingData.workoutName,
                exercises: trackingData.workoutExercises || [],
              });
            }
            console.log(`✅ Today's tracking data processed (${(Date.now() - startTime)}ms)`);
          } else {
            // No data today -> keep values empty until user logs new entries.
            setWaterIntake(null);
            setSleepHours(null);
            setDashboardWorkoutSummary(null);
            setTodayWorkout(null);
          }
        } catch (e) {
          console.log(`⚠️ Daily tracking failed, continuing...`);
        }

        // RESTORE: Get daily logs
        console.log(`📋 Fetching daily logs... (${(Date.now() - startTime)}ms)`);
        try {
          const logsDoc = await Promise.race([
            getDoc(doc(db, 'users', user.uid, 'dailyLogs', getDateKey())),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Daily logs timeout')), 5000))
          ]);
          
          if (logsDoc.exists()) {
            const logsData = logsDoc.data();
            if (logsData.dashboard_soreness != null && logsData.dashboard_soreness !== '') setSoreness(String(logsData.dashboard_soreness));
            if (logsData.dashboard_energy != null && logsData.dashboard_energy !== '') setEnergyLevel(String(logsData.dashboard_energy));
            if (logsData.dashboard_stress != null && logsData.dashboard_stress !== '') setStressLevel(String(logsData.dashboard_stress));
            console.log(`✅ Daily logs processed (${(Date.now() - startTime)}ms)`);
          }
        } catch (e) {
          console.log(`⚠️ Daily logs failed, continuing...`);
        }

        // RESTORE: Get nutrition logs
        console.log(`🍎 Fetching nutrition logs... (${(Date.now() - startTime)}ms)`);
        try {
          const nutritionLogs = await Promise.race([
            getFoodLogsForDate(user.uid, getDateKey()),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Nutrition logs timeout')), 6000))
          ]);
          
          const totals = calculateMacroTotals(nutritionLogs);
          setCaloriesConsumed(totals.calories || 0);
          setMacroTotals({
            protein: totals.protein || 0,
            carbs: totals.carbs || 0,
            fats: totals.fat || 0 // Fix: nutrition service returns 'fat' not 'fats'
          });
          console.log(`✅ Nutrition logs processed (${(Date.now() - startTime)}ms)`);
          console.log(`🍎 Macro totals - Protein: ${totals.protein}g, Carbs: ${totals.carbs}g, Fat: ${totals.fat}g`);
        } catch (e) {
          console.log(`⚠️ Nutrition logs failed, continuing...`);
        }

        // Get nutrition goals for proper progress calculation
        console.log(`🎯 Fetching nutrition goals... (${(Date.now() - startTime)}ms)`);
        try {
          const goals = await getDailyGoals(user.uid);
          setNutritionGoals(goals);
          console.log(`✅ Nutrition goals loaded:`, goals);
          console.log(`🎯 Goals breakdown - Protein: ${goals.proteinTarget}g, Carbs: ${goals.carbsTarget}g, Fat: ${goals.fatTarget}g`);
        } catch (e) {
          console.log(`⚠️ Nutrition goals failed, using defaults...`);
          const defaultGoals = { proteinTarget: 150, carbsTarget: 220, fatTarget: 70 };
          setNutritionGoals(defaultGoals);
          console.log(`🎯 Using default goals - Protein: ${defaultGoals.proteinTarget}g, Carbs: ${defaultGoals.carbsTarget}g, Fat: ${defaultGoals.fatTarget}g`);
        }

        // RESTORE: Get workout history
        console.log(`💪 Fetching workout history... (${(Date.now() - startTime)}ms)`);
        try {
          const completedWorkouts = await Promise.race([
            fetchWorkoutHistory(user.uid, 20),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Workout history timeout')), 6000))
          ]);
          
          const workouts = completedWorkouts;
          const calculatedStreak = calculateStreak(workouts);
          setStreak(calculatedStreak);
          setWorkoutCount(workouts.length);

          const todayWorkouts = workouts.filter(w => {
            const workoutDate = w.completedAt?.toDate?.() || new Date(w.completedAt);
            return workoutDate.toISOString().split('T')[0] === getDateKey();
          });
          
          const burned = todayWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
          setCaloriesBurned(burned);
          console.log(`✅ Workout history processed (${(Date.now() - startTime)}ms)`);
        } catch (e) {
          console.log(`⚠️ Workout history failed, continuing...`);
        }

        // RESTORE: Get active workout
        console.log(`🎯 Fetching active workout... (${(Date.now() - startTime)}ms)`);
        try {
          const activeWorkout = await getActiveWorkout(user.uid);
          if (activeWorkout) {
            setTodayWorkout({
              name: activeWorkout.workoutName || 'Active Workout',
              exercises: activeWorkout.exercises?.length || 0,
              duration: activeWorkout.duration || 0,
              progress: 0,
            });
            console.log(`✅ Active workout processed (${(Date.now() - startTime)}ms)`);
          }
        } catch (e) {
          console.log(`⚠️ Active workout failed, continuing...`);
        }

        console.log(`⚡ All dashboard data loaded successfully`);
        
      } catch (error) {
        console.error(`❌ Error fetching data: ${error.message} (${(Date.now() - startTime)}ms)`);
      } finally {
        const totalTime = Date.now() - startTime;
        console.log(`🏁 Setting loading to false - TOTAL TIME: ${totalTime}ms`);
        clearTimeout(timeout);
        setLoading(false);
        isFetching.current = false;
      }
    };
    
    fetchData();
  }, [user?.uid, db]);

  const refetchNutritionData = useCallback(async () => {
    if (!user?.uid || !db) return;
    try {
      const todayKey = getDateKey();
      const nutritionLogs = await getFoodLogsForDate(user.uid, todayKey);
      const totals = calculateMacroTotals(nutritionLogs);
      setCaloriesConsumed(totals.calories || 0);
      setMacroTotals({
        protein: totals.protein || 0,
        carbs: totals.carbs || 0,
        fats: totals.fat || 0, // Fix: nutrition service returns 'fat' not 'fats'
      });
    } catch (e) {
      console.error('Refetch nutrition:', e);
    }
  }, [user?.uid]);

  // Stopwatch timer for loading screen
  useEffect(() => {
    let interval;
    if (loading && loadingStartTime) {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - loadingStartTime) / 1000));
      }, 100);
    } else {
      setElapsedTime(0);
      setLoadingStartTime(null);
    }
    
    return () => clearInterval(interval);
  }, [loading, loadingStartTime]);

  // When returning from dashboard, refetch soreness/energy/stress so the wellness row updates
  // When returning from dashboard we previously refetched soreness/energy/stress.
  // The dashboard is now always visible, so the wellness row is kept in sync via direct metric updates.

  useEffect(() => {
    if (!user?.uid) return undefined;
    persistPushTokensForUid(user.uid, { skipIfDisabled: true });
    const unsubResume = subscribePushTokenRefreshOnResume(user.uid, () => true);
    return unsubResume;
  }, [user?.uid]);

  const clientNotifTapRef = useRef(async () => {});

  useEffect(() => {
    clientNotifTapRef.current = async (data) => {
      try {
        if (!user?.uid || !data || typeof data !== 'object') return;
        const type = data.type;
        if (type === 'session_scheduled') {
          setShowNutrition(false);
          setShowMyDashboard(false);
          setShowProfile(false);
          setShowSettings(false);
          setAiChatState(null);
          return;
        }
        if (type === 'session_reminder' || type === 'session_update') {
          setShowNutrition(false);
          setShowProfile(false);
          setShowSettings(false);
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          setShowMyDashboard(true);
          return;
        }
        if (type === 'nutrition_reminder') {
          setShowProfile(false);
          setShowSettings(false);
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          setShowMyDashboard(false);
          setShowNutrition(true);
          return;
        }
        if (type === 'notes_shared') {
          setShowProfile(false);
          setShowSettings(false);
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(false);
          setShowNutrition(false);
          setShowMyDashboard(true);
          setShowTrainerSharedFilesModal(true);
          return;
        }
        if (type !== 'message') {
          setShowNutrition(false);
          setShowMyDashboard(false);
          setShowProfile(false);
          setShowSettings(false);
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(true);
          return;
        }
        const conversationId = data.conversationId;
        if (!conversationId || typeof conversationId !== 'string') {
          setShowNutrition(false);
          setShowMyDashboard(false);
          setShowProfile(false);
          setShowSettings(false);
          setAiChatState(null);
          setShowTrainerMessaging(false);
          setShowConversationsList(true);
          return;
        }
        const convSnap = await getDoc(doc(db, 'conversations', conversationId));
        if (!convSnap.exists()) {
          setShowConversationsList(true);
          return;
        }
        const convData = convSnap.data();
        const participants = convData?.participants || [];
        const otherId = participants.find((p) => p !== user.uid);
        let otherParticipant = otherId ? { id: otherId } : null;
        if (otherId) {
          try {
            const uSnap = await getDoc(doc(db, 'users', otherId));
            if (uSnap.exists()) otherParticipant = { id: uSnap.id, ...uSnap.data() };
          } catch (_) {
            /* keep minimal otherParticipant */
          }
        }
        setShowNutrition(false);
        setShowMyDashboard(false);
        setShowProfile(false);
        setShowSettings(false);
        setAiChatState(null);
        setShowConversationsList(false);
        setSelectedConversation({ id: conversationId, ...convData });
        setSelectedTrainer(otherParticipant);
        setShowTrainerMessaging(true);
      } catch (e) {
        setShowConversationsList(true);
      }
    };
  }, [user?.uid]);

  useEffect(() => {
    setNotificationTapHandler((d) => {
      clientNotifTapRef.current?.(d);
    });
    return () => setNotificationTapHandler(null);
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    return flushInitialNotificationResponse(650);
  }, [user?.uid]);

  // Notes & Files — same subcollection as trainer; realtime listener so uploads & trainer shares show immediately
  useEffect(() => {
    if (!user?.uid || !db) {
      setNotesAndFiles([]);
      return;
    }
    const notesRef = collection(db, 'users', user.uid, 'notes_and_files');
    const unsubscribe = onSnapshot(
      notesRef,
      async () => {
        try {
          const list = await getNotesAndFiles(user.uid);
          setNotesAndFiles(list);
        } catch {
          setNotesAndFiles([]);
        }
      },
      (err) => console.error('Client notes_and_files listener:', err),
    );
    return () => {
      try {
        unsubscribe();
      } catch (_) {}
    };
  }, [user?.uid]);

  // Session invites (client): show upcoming pending sessions with accept/decline.
  useEffect(() => {
    if (!user?.uid || !db) {
      setPendingSessions([]);
      return;
    }
    const trainerUid = trainerData?.id || trainerData?.uid || null;
    if (!trainerUid) {
      setPendingSessions([]);
      return;
    }
    const todayKey = getDateKey();
    const sessionsRef = collection(db, `trainer_clients/${trainerUid}/sessions`);
    const primaryQuery = query(
      sessionsRef,
      where('clientId', '==', user.uid),
      where('status', '==', 'pending'),
      where('date', '>=', todayKey),
      limit(5),
    );
    const applySnap = (snap) => {
      const next = [];
      snap.forEach((d) => next.push({ id: d.id, ...d.data() }));
      next.sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)));
      setPendingSessions(next);
    };

    let fallbackUnsub = null;
    const unsub = onSnapshot(
      primaryQuery,
      (snap) => {
        applySnap(snap);
      },
      (err) => {
        console.error('Client pending sessions listener:', err);
        const msg = String(err?.message || '');
        const needsIndex =
          err?.code === 'failed-precondition' ||
          msg.toLowerCase().includes('requires an index') ||
          msg.toLowerCase().includes('create_composite');

        // Fallback: use a simpler query (no composite index) and filter client-side.
        // This keeps the UI working immediately, even if the composite index isn’t created yet.
        if (needsIndex) {
          try {
            const fallbackQuery = query(
              sessionsRef,
              where('clientId', '==', user.uid),
              limit(15),
            );
            fallbackUnsub = onSnapshot(
              fallbackQuery,
              (snap) => {
                const all = [];
                snap.forEach((d) => all.push({ id: d.id, ...d.data() }));
                const filtered = all
                  .filter((s) => (s.status || 'pending') === 'pending' && String(s.date || '') >= String(todayKey))
                  .sort((a, b) => (String(a.date) + String(a.time)).localeCompare(String(b.date) + String(b.time)))
                  .slice(0, 5);
                setPendingSessions(filtered);
              },
              (e2) => {
                console.error('Client pending sessions fallback listener:', e2);
                setPendingSessions([]);
              },
            );
            return;
          } catch (e) {
            // continue to empty
          }
        }

        setPendingSessions([]);
      },
    );
    return () => {
      try { unsub(); } catch (_) {}
      try { fallbackUnsub?.(); } catch (_) {}
    };
  }, [user?.uid, trainerData?.id]);

  const respondToSession = useCallback(async ({ sessionId, status }) => {
    const trainerUid = trainerData?.id || trainerData?.uid || null;
    if (!trainerUid || !sessionId) return;
    try {
      await updateDoc(doc(db, `trainer_clients/${trainerUid}/sessions/${sessionId}`), {
        status,
        respondedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      const clientUid = user?.uid;
      if (clientUid) {
        let clientName = user?.displayName || 'Client';
        try {
          const us = await getDoc(doc(db, 'users', clientUid));
          if (us.exists()) {
            const d = us.data();
            clientName = d?.firstName || d?.name || d?.displayName || clientName;
          }
        } catch (_) {}
        const verb =
          status === 'accepted' ? 'accepted' : status === 'declined' ? 'declined' : 'updated';
        void postRemotePushNotify({
          recipientId: trainerUid,
          senderName: clientName,
          messageText: `${clientName} ${verb} a session.`,
          senderId: clientUid,
          messageId: sessionId,
          notificationType: 'session_response',
        });
      }
    } catch (e) {
      console.error('Respond to session failed:', e);
      Alert.alert('Could not update', e?.message || 'Please try again.');
    }
  }, [trainerData?.id, trainerData?.uid, user?.uid, user?.displayName]);

  const refreshNotesAndFiles = () => {
    if (user?.uid) getNotesAndFiles(user.uid).then(setNotesAndFiles).catch(() => {});
  };

  const trainerSharedFiles = useMemo(
    () =>
      (notesAndFiles || []).filter(
        (x) => x.addedBy === 'trainer' || (x.type === 'document' && x.trainerId),
      ),
    [notesAndFiles],
  );

  /** Client uploads (plus button) — same Firestore list; previously hidden because home only showed trainer rows */
  const myOwnFiles = useMemo(
    () =>
      (notesAndFiles || []).filter((x) => {
        if (x.type === 'note') return false;
        return (
          (x.addedBy || 'client') === 'client' &&
          !(x.type === 'document' && x.trainerId && x.documentId)
        );
      }),
    [notesAndFiles],
  );

  const [deletingMyFiles, setDeletingMyFiles] = useState(false);

  const deleteSingleMyFile = useCallback(async (file) => {
    if (!user?.uid || !file?.id) return;
    if ((file.addedBy || 'client') !== 'client') return;
    setDeletingMyFiles(true);
    try {
      await deleteNotesAndFilesItem(user.uid, file);
      refreshNotesAndFiles();
    } catch (e) {
      console.error('Delete notes/file failed:', e);
      Alert.alert('Could not delete', e?.message || 'Please try again.');
    } finally {
      setDeletingMyFiles(false);
    }
  }, [user?.uid, refreshNotesAndFiles]);

  const deleteAllMyFiles = useCallback(async () => {
    if (!user?.uid) return;
    const list = (myOwnFiles || []).filter((f) => (f.addedBy || 'client') === 'client' && f?.id);
    if (list.length === 0) return;
    setDeletingMyFiles(true);
    try {
      // Sequential to avoid hammering Storage/Firestore on large sets.
      for (const f of list) {
        // eslint-disable-next-line no-await-in-loop
        await deleteNotesAndFilesItem(user.uid, f);
      }
      refreshNotesAndFiles();
    } catch (e) {
      console.error('Delete all notes/files failed:', e);
      Alert.alert('Could not delete all', e?.message || 'Some files may not have been deleted. Try again.');
      refreshNotesAndFiles();
    } finally {
      setDeletingMyFiles(false);
    }
  }, [user?.uid, myOwnFiles, refreshNotesAndFiles]);

  const openNotesFile = useCallback((file) => {
    if (file?.type === 'spreadsheet' && file.url) {
      setSpreadsheetViewer({ visible: true, url: file.url, name: file?.name || 'Spreadsheet' });
      return;
    }
    if (file?.type === 'document' || (file?.documentId && file?.trainerId)) {
      setDocumentViewer({
        visible: true,
        trainerId: file.trainerId,
        documentId: file.documentId,
        title: file.title || 'Document',
      });
      return;
    }
    if (file?.url && isNotesImageFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'image', name: file?.name || file?.title || 'Photo' });
      return;
    }
    if (file?.url && isNotesVideoFile(file)) {
      setMediaViewer({ visible: true, url: file.url, kind: 'video', name: file?.name || file?.title || 'Video' });
      return;
    }
    if (file?.url && isNotesPdfFile(file, file.url)) {
      setPdfViewer({ visible: true, url: file.url, name: file?.name || 'Document' });
      return;
    }
    if (file?.url) {
      setEmbedWebViewer({
        visible: true,
        uri: getEmbedViewerUri(file, file.url),
        title: file.name || file.title || 'Document',
      });
    }
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    refreshNotesAndFiles();
    setRefreshing(false);
  };

  // Navigation handlers
  const handleOpenConversations = () => {
    setShowConversationsList(true);
  };

  const handleSelectConversation = (conversation, otherParticipant) => {
    setSelectedConversation(conversation);
    setSelectedTrainer(otherParticipant && typeof otherParticipant === 'object' ? otherParticipant : { id: otherParticipant });
    setShowConversationsList(false);
    setShowTrainerMessaging(true);
  };

  const handleCloseMessaging = () => {
    setShowNutrition(false);
    setShowMyDashboard(false);
    setSelectedConversation(null);
  };

  const handleCloseConversationsList = () => {
    setShowConversationsList(false);
  };

  const handleFindTrainers = () => {
    setShowTrainerSearch(true);
  };

  const handleHomePress = () => {
    setAiChatState(null);
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowProfile(false);
    setShowSettings(false);
    setShowWorkoutPlanGenerator(false);
    setShowWorkoutOnboarding(false);
    setShowNutrition(false);
    setShowMyDashboard(false);
    setSelectedConversation(null);
    setShowPlanViewer(false);
    setViewingPlan(null);
  };

  const openWorkout = () => {
    setShowTrainerMessaging(false);
    setShowConversationsList(false);
    setShowProfile(false);
    setShowSettings(false);
    setShowNutrition(false);
    setShowMyDashboard(false);
    setSelectedConversation(null);
    setShowWorkoutOnboarding(false);
    setShowWorkoutPlanGenerator(true);
  };

  const handleStartWorkout = () => {
    openWorkout();
  };

  const handleAddWorkout = () => {
    openWorkout();
  };

  const onNavigate = (screen) => {
    if (!screen) return;
    if (screen === 'home') {
      handleHomePress();
      return;
    }
    if (screen === 'profile' || screen === 'ProfileScreen') {
      handleHomePress();
      setShowProfile(true);
      return;
    }
    if (screen === 'settings' || screen === 'SettingsScreen') {
      handleHomePress();
      setShowSettings(true);
      return;
    }
        if (screen === 'nutrition') {
      handleHomePress();
      setShowNutrition(true);
      return;
    }
    if (screen === 'workout') {
      openWorkout();
      return;
    }
    if (screen === 'messages') {
      handleHomePress();
      handleOpenConversations();
      return;
    }
    if (screen === 'create') {
      setShowAddNotesFilesModal(true);
      return;
    }
    if (screen === 'voice' || screen === 'aiChat') {
      handleHomePress();
      setAiChatState('home');
      return;
    }
  };

  const handleViewClients = () => {
    // Navigate to clients view
    handleOpenConversations();
  };

  const addNotesFilesModalEl = (
    <AddNotesFilesModal
      visible={showAddNotesFilesModal}
      onClose={() => setShowAddNotesFilesModal(false)}
      onAdded={refreshNotesAndFiles}
      isDark={isDark}
    />
  );

  const navProviderProps = {
    onProfilePress: () => setShowProfile(true),
    onSettingsPress: () => setShowSettings(true),
    onHomePress: handleHomePress,
    onPlusPress: () => setShowAddNotesFilesModal(true),
    onVoicePress: openAIChatHome,
    onNutritionPress: () => setShowNutrition(true),
    onWorkoutPress: openWorkout,
    onMessagesPress: handleOpenConversations,
  };

  // Screen navigation checks (messages screens render inside main layout so header/navbar stay visible)
  if (showProfile) {
    return (
      <AppNavigationProvider {...navProviderProps}>
        <>
          <ProfileScreen
            onBack={() => setShowProfile(false)}
            userRole="Client"
            userData={userData}
            onboardingData={onboardingData}
            onNavigate={onNavigate}
          />
          {addNotesFilesModalEl}
        </>
      </AppNavigationProvider>
    );
  }

  if (showSettings) {
    return (
      <AppNavigationProvider {...navProviderProps}>
        <>
          <SettingsScreen
            user={user}
            onClose={() => setShowSettings(false)}
            onNavigate={onNavigate}
          />
          {addNotesFilesModalEl}
        </>
      </AppNavigationProvider>
    );
  }

  if (showWorkoutPlanGenerator) {
    return (
      <>
        <WorkoutPlanGeneratorScreen
          userId={user?.uid}
          onBack={() => setShowWorkoutPlanGenerator(false)}
          onPlanGenerated={() => setShowWorkoutPlanGenerator(false)}
          onProfilePress={() => setShowProfile(true)}
          onSettingsPress={() => setShowSettings(true)}
          onNavigate={onNavigate}
        />
        {addNotesFilesModalEl}
      </>
    );
  }

  if (showPlanViewer && viewingPlan) {
    return (
      <>
        <WorkoutPlanGeneratorScreen
          userId={user?.uid}
          plan={viewingPlan}
          readOnly={true}
          hideBottomNav={false}
          onBack={() => {
            setShowPlanViewer(false);
            setViewingPlan(null);
            setShowAIWorkouts(true);
          }}
          onProfilePress={() => setShowProfile(true)}
          onSettingsPress={() => setShowSettings(true)}
          onNavigate={onNavigate}
        />
        {addNotesFilesModalEl}
      </>
    );
  }

  if (showPhotoGallery && day6Client?.id) {
    return (
      <>
        <SafeAreaView style={[styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight]}>
          <View style={{ flex: 1 }}>
            <PhotoGalleryScreen
              route={{ params: { clientId: day6Client.id, clientName: day6Client.name } }}
              navigation={{ goBack: () => setShowPhotoGallery(false) }}
            />
          </View>
          <BottomNavBar
            onHomePress={() => {
              setShowPhotoGallery(false);
              handleHomePress();
            }}
            onPlusPress={() => setShowAddNotesFilesModal(true)}
            onVoicePress={openAIChatHome}
            onNutritionPress={() => {
              setShowPhotoGallery(false);
              setShowNutrition(true);
            }}
            onWorkoutPress={() => {
              setShowPhotoGallery(false);
              openWorkout();
            }}
            onMessagesPress={() => {
              setShowPhotoGallery(false);
              handleOpenConversations();
            }}
            onProfilePress={() => setShowProfile(true)}
            activeTabKey="home"
          />
        </SafeAreaView>
        {addNotesFilesModalEl}
      </>
    );
  }

  if (showAIWorkouts && day6Client?.id) {
    return (
      <>
        <SafeAreaView style={[styles.safeArea, isDark ? styles.safeAreaDark : styles.safeAreaLight]}>
          <View style={{ flex: 1 }}>
            <AIWorkoutPlansScreen
              client={day6Client}
              onBack={() => setShowAIWorkouts(false)}
              viewerRole="client"
              onViewPlan={(plan) => {
                setViewingPlan(plan);
                setShowAIWorkouts(false);
                setShowPlanViewer(true);
              }}
              route={{ params: { clientId: day6Client.id, clientName: day6Client.name } }}
              navigation={{ goBack: () => setShowAIWorkouts(false) }}
            />
          </View>
          <BottomNavBar
            onHomePress={() => {
              setShowAIWorkouts(false);
              handleHomePress();
            }}
            onPlusPress={() => setShowAddNotesFilesModal(true)}
            onVoicePress={openAIChatHome}
            onNutritionPress={() => {
              setShowAIWorkouts(false);
              setShowNutrition(true);
            }}
            onWorkoutPress={() => {
              setShowAIWorkouts(false);
              openWorkout();
            }}
            onMessagesPress={() => {
              setShowAIWorkouts(false);
              handleOpenConversations();
            }}
            onProfilePress={() => setShowProfile(true)}
            activeTabKey="workout"
          />
        </SafeAreaView>
        {addNotesFilesModalEl}
      </>
    );
  }

  if (showTrainerSearch) {
    return (
      <>
        <SafeAreaView
          style={[
            styles.safeArea,
            isDark ? styles.safeAreaDark : styles.safeAreaLight,
          ]}
        >
          <CoachConnectHeader
            title="Find a Trainer"
            isDark={isDark}
            onBack={() => setShowTrainerSearch(false)}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
          />
          <TrainerSearchScreen
            onViewProfile={(trainer) => {
              setProfileTrainer(trainer);
              setShowTrainerSearch(false);
              setShowTrainerProfile(true);
            }}
            onSelectTrainer={(trainer, conversationId) => {
              setSelectedTrainer(trainer);
              setSelectedConversation({ id: conversationId });
              setShowTrainerSearch(false);
              setShowTrainerMessaging(true);
            }}
            onClose={() => setShowTrainerSearch(false)}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
            isDark={isDark}
            onHomePress={handleHomePress}
            onPlusPress={() => setShowAddNotesFilesModal(true)}
            onVoicePress={openAIChatHome}
            onNutritionPress={() => setShowNutrition(true)}
            onWorkoutPress={openWorkout}
            onMessagesPress={handleOpenConversations}
          />
        </SafeAreaView>
        {addNotesFilesModalEl}
      </>
    );
  }

  if (showTrainerProfile) return (
    <>
    <SafeAreaView
      style={[
        styles.safeArea,
        isDark ? styles.safeAreaDark : styles.safeAreaLight,
      ]}
    >
      <CoachConnectHeader
        title={profileTrainer?.displayName || profileTrainer?.name || 'Trainer'}
        isDark={isDark}
        onBack={() => {
          setShowTrainerProfile(false);
          setShowTrainerSearch(true);
        }}
        onProfilePress={() => setShowProfile(true)}
        onSettingsPress={() => setShowSettings(true)}
      />
      <TrainerProfileScreen
        trainer={profileTrainer}
        onBack={() => {
          setShowTrainerProfile(false);
          setShowTrainerSearch(true);
        }}
        onConnect={async (trainer) => {
          try {
            const conversationId = await getOrCreateConversation(auth.currentUser.uid, trainer.id);
            await sendClientRequest(
              conversationId,
              auth.currentUser.uid,
              `Hi! I'd like to work with you as my trainer.`,
              { clientName: auth.currentUser.displayName || '', trainerId: trainer.id }
            );
            setSelectedTrainer(trainer);
            setSelectedConversation({ id: conversationId });
            setShowTrainerProfile(false);
            setShowTrainerMessaging(true);
          } catch (e) {
            console.error('Connect error:', e);
          }
        }}
        isDark={isDark}
        onProfilePress={() => setShowProfile(true)}
        onSettingsPress={() => setShowSettings(true)}
        onHomePress={handleHomePress}
        onPlusPress={() => setShowAddNotesFilesModal(true)}
        onVoicePress={openAIChatHome}
        onNutritionPress={() => setShowNutrition(true)}
        onWorkoutPress={openWorkout}
        onMessagesPress={handleOpenConversations}
        onReviewSubmitComplete={() => {}}
      />
    </SafeAreaView>
    {addNotesFilesModalEl}
    </>
  );

  if (showNutrition) {
    return (
      <AppNavigationProvider {...navProviderProps}>
        <>
          <NutritionContainer
            onBack={() => {
              setShowNutrition(false);
              refetchNutritionData();
            }}
            onNutritionDataChanged={refetchNutritionData}
            onProfilePress={() => setShowProfile(true)}
            onSettingsPress={() => setShowSettings(true)}
            onHomePress={handleHomePress}
            onPlusPress={() => setShowAddNotesFilesModal(true)}
            onVoicePress={openAIChatHome}
            onNutritionPress={() => setShowNutrition(true)}
            onWorkoutPress={openWorkout}
            onMessagesPress={handleOpenConversations}
          />
          <AddNotesFilesModal
            visible={showAddNotesFilesModal}
            onClose={() => setShowAddNotesFilesModal(false)}
            onAdded={refreshNotesAndFiles}
            isDark={isDark}
          />
        </>
      </AppNavigationProvider>
    );
  }

  // Main home screen render — use shared app loading screen (same as AuthGate / entire app)
  if (loading) {
    return <AppLoadingScreen message="Loading your data..." isDark={isDark} />;
  }

  const aiChatNavHandlers = {
    onHomePress: () => {
      setAiChatState(null);
      handleHomePress();
    },
    onPlusPress: () => setShowAddNotesFilesModal(true),
    onVoicePress: openAIChatHome,
    onNutritionPress: () => {
      setAiChatState(null);
      setShowNutrition(true);
    },
    onWorkoutPress: () => {
      setAiChatState(null);
      openWorkout();
    },
    onMessagesPress: () => {
      setAiChatState(null);
      handleOpenConversations();
    },
    onProfilePress: () => {
      setAiChatState(null);
      setShowProfile(true);
    },
    onSettingsPress: () => {
      setAiChatState(null);
      setShowSettings(true);
    },
  };

  if (aiChatState === 'home') {
    return (
      <AppNavigationProvider {...navProviderProps}>
        <>
          <AIChatHomeScreen
            userId={user?.uid}
            onStartChat={({ prefill } = {}) => setAiChatState({ prefill })}
            onSessionPress={(s) => setAiChatState({ sessionId: s.sessionId || s.id })}
            onAttachPress={() => {}}
            {...aiChatNavHandlers}
          />
          <AddNotesFilesModal
            visible={showAddNotesFilesModal}
            onClose={() => setShowAddNotesFilesModal(false)}
            onAdded={refreshNotesAndFiles}
            isDark={isDark}
          />
        </>
      </AppNavigationProvider>
    );
  }

  if (aiChatState != null && typeof aiChatState === 'object') {
    return (
      <AppNavigationProvider {...navProviderProps}>
        <>
          <AIChatScreen
            key={JSON.stringify({
              sid: aiChatState.sessionId ?? null,
              pf: aiChatState.prefill ?? null,
            })}
            userId={user?.uid}
            userProfile={userData}
            prefill={aiChatState.prefill}
            sessionId={aiChatState.sessionId}
            onBack={() => setAiChatState('home')}
            openAttachmentsOnMount={false}
            {...aiChatNavHandlers}
          />
          <AddNotesFilesModal
            visible={showAddNotesFilesModal}
            onClose={() => setShowAddNotesFilesModal(false)}
            onAdded={refreshNotesAndFiles}
            isDark={isDark}
          />
        </>
      </AppNavigationProvider>
    );
  }

  const userName = userData?.firstName || user?.displayName || onboardingData?.name || 'User';
  const userRole = userData?.role || 'client';
  const hasTrainer = !!trainerData;

  // Prepare workout data for TrainingAgenda
  const agendaWorkouts = todayWorkout
    ? [
        {
          name: todayWorkout.name,
          exercises: Array.isArray(todayWorkout.exercises)
            ? todayWorkout.exercises
                .map((ex) => {
                  if (typeof ex === 'string') return ex;
                  const label = ex?.name || ex?.exerciseName || '';
                  if (!label) return '';
                  if (Array.isArray(ex.sets) && ex.sets.length > 0) {
                    const setsSummary = ex.sets
                      .map((s) => {
                        const reps = s.reps != null ? s.reps : '';
                        const weight = s.weight != null ? s.weight : '';
                        if (reps && weight) return `${reps}×${weight}`;
                        if (reps) return `${reps} reps`;
                        if (weight) return `${weight}`;
                        return '';
                      })
                      .filter(Boolean)
                      .join(', ');
                    return setsSummary
                      ? `${label} (${setsSummary})`
                      : label;
                  }
                  return label;
                })
                .filter(Boolean)
            : todayWorkout.exercises,
          sets: null,
          reps: 0,
          workoutName: todayWorkout.name,
        },
      ]
    : dashboardWorkoutSummary
    ? [
        {
          name: dashboardWorkoutSummary,
          exercises: null,
          sets: null,
          reps: null,
          workoutName: dashboardWorkoutSummary,
        },
      ]
    : [];

  // Prepare macro data for NutritionCard
  const nutritionMacros = [
    { icon: require('../assets/icons/Protein.png'), label: "Protein", value: `${Math.round(macroTotals.protein)}g` },
    { icon: require('../assets/icons/Carbs.png'), label: "Carbs", value: `${Math.round(macroTotals.carbs)}g` },
    { icon: require('../assets/icons/Fats.png'), label: "Fats", value: `${Math.round(macroTotals.fats || 0)}g` },
  ];

  console.log(`📊 Nutrition macros being passed to card:`, nutritionMacros.map(m => ({ label: m.label, value: m.value })));
  console.log(`🎯 Current nutrition goals:`, nutritionGoals);

  // Prepare additional nutrition data (only show if data exists)
  const additionalNutrients = [];
  
  if (macroTotals.fiber > 0) {
    additionalNutrients.push({ 
      icon: "🌾", 
      label: "Fiber", 
      value: `${Math.round(macroTotals.fiber)}g` 
    });
  }
  
  if (macroTotals.sugar > 0) {
    additionalNutrients.push({ 
      icon: "🍯", 
      label: "Sugar", 
      value: `${Math.round(macroTotals.sugar)}g` 
    });
  }
  
  if (macroTotals.sodium > 0) {
    additionalNutrients.push({ 
      icon: "🧂", 
      label: "Sodium", 
      value: `${Math.round(macroTotals.sodium)}mg` 
    });
  }
  
  if (macroTotals.potassium > 0) {
    additionalNutrients.push({ 
      icon: "🥔", 
      label: "Potassium", 
      value: `${Math.round(macroTotals.potassium)}mg` 
    });
  }

  return (
    <AppNavigationProvider
      onProfilePress={() => setShowProfile(true)}
      onSettingsPress={() => setShowSettings(true)}
      onHomePress={handleHomePress}
      onPlusPress={() => setShowAddNotesFilesModal(true)}
      onVoicePress={openAIChatHome}
      onNutritionPress={() => setShowNutrition(true)}
      onWorkoutPress={openWorkout}
      onMessagesPress={handleOpenConversations}
    >
    <SafeAreaView style={[styles.safeArea, !isDark ? styles.safeAreaLight : styles.safeAreaDark]}>
      <StatusBar barStyle={!isDark ? 'dark-content' : 'light-content'} />
      
      <CoachConnectHeader
        isDark={isDark}
        onProfilePress={() => setShowProfile(true)}
        onSettingsPress={() => setShowSettings(true)}
      />

      {reviewPromptTrainer && (
        <View style={{
          backgroundColor: 'rgba(255,107,157,0.1)',
          borderColor: 'rgba(255,107,157,0.25)',
          borderWidth: 1,
          borderRadius: 12,
          padding: 14,
          flexDirection: 'row',
          alignItems: 'center',
          marginHorizontal: 16,
          marginTop: 16,
        }}>
          <Ionicons name="star-outline" size={18} color="#FF6B9D" />
          <Text style={{ flex: 1, marginLeft: 10, fontSize: 13, color: '#fff' }}>
            How was your experience with {reviewPromptTrainer.name}?{' '}
            <Text style={{ color: '#FF6B9D', fontWeight: 'bold' }} onPress={() => setShowReviewSheetForPrompt(true)}>Leave a review</Text>
          </Text>
          <TouchableOpacity onPress={() => setReviewPromptTrainer(null)}>
            <Ionicons name="close" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      )}

      {showTrainerMessaging ? (
        <TrainerMessagingScreen
          embedInLayout
          trainer={selectedTrainer}
          conversation={selectedConversation}
          onClose={handleCloseMessaging}
          onProfilePress={() => setShowProfile(true)}
          onSettingsPress={() => setShowSettings(true)}
        />
      ) : showConversationsList ? (
        <ConversationsListScreen
          embedInLayout
          onSelectConversation={handleSelectConversation}
          onClose={handleCloseConversationsList}
          onProfilePress={() => setShowProfile(true)}
          onSettingsPress={() => setShowSettings(true)}
        />
      ) : showMyDashboard ? (
        <MyDashboardScreen
          embedInLayout
          trainer={trainerData}
          unreadMessageCount={unreadMessageCount}
          onOpenRemoveTrainer={trainerData ? () => setShowRemoveTrainerSheet(true) : undefined}
          streak={streak}
          todayCalories={caloriesConsumed}
          waterOz={waterIntake}
          sleepHoursValue={sleepHours}
          onMetricsChange={async (patch) => {
            // Wellness ratings: saved to dailyLogs inside My Dashboard; sync home row immediately
            if (patch.soreness != null && patch.soreness !== '') {
              setSoreness(String(patch.soreness));
            }
            if (patch.energyLevel != null && patch.energyLevel !== '') {
              setEnergyLevel(String(patch.energyLevel));
            }
            if (patch.stressLevel != null && patch.stressLevel !== '') {
              setStressLevel(String(patch.stressLevel));
            }

            // Save to Firebase first so data persists
            try {
              const updateData = {};
              
              if (typeof patch.waterIntake === 'number') {
                updateData.waterIntake = patch.waterIntake;
                setWaterIntake(patch.waterIntake);
              }
              if (typeof patch.sleepHours === 'number') {
                updateData.sleepHours = patch.sleepHours;
                setSleepHours(patch.sleepHours);
              }
              if (patch.workoutSummary != null) {
                updateData.workoutSummary = patch.workoutSummary;
                setDashboardWorkoutSummary(patch.workoutSummary);
              }
              if (patch.workoutName != null || (Array.isArray(patch.workoutExercises) && patch.workoutExercises.length > 0)) {
                updateData.workoutName = patch.workoutName;
                updateData.workoutExercises = patch.workoutExercises;
                setTodayWorkout({
                  name: patch.workoutName || '',
                  exercises: Array.isArray(patch.workoutExercises) ? patch.workoutExercises : [],
                });
              }
              
              // Save to daily tracking + mirror into dailyLogs so My Dashboard reloads reliably
              if (Object.keys(updateData).length > 0) {
                const todayKey = getDateKey();
                await setDoc(
                  doc(db, 'users', user.uid, 'daily_tracking', todayKey),
                  { ...updateData, updatedAt: serverTimestamp() },
                  { merge: true },
                );
                const logsPatch = {};
                if (typeof patch.waterIntake === 'number') {
                  logsPatch.dashboard_water = String(patch.waterIntake);
                }
                if (typeof patch.sleepHours === 'number') {
                  logsPatch.dashboard_sleep = String(patch.sleepHours);
                }
                if (patch.workoutSummary != null) {
                  logsPatch.dashboard_workouts = patch.workoutSummary;
                }
                if (patch.workoutName != null) {
                  logsPatch.dashboard_workout_name = patch.workoutName;
                }
                if (Array.isArray(patch.workoutExercises) && patch.workoutExercises.length > 0) {
                  logsPatch.workoutLog = patch.workoutExercises.map((ex) => ({
                    exerciseName: ex.name || ex.exerciseName || '',
                    sets: Array.isArray(ex.sets)
                      ? ex.sets.map((s) => ({
                          reps: parseInt(s.reps, 10) || 0,
                          weight: parseFloat(s.weight) || 0,
                        }))
                      : [],
                  }));
                }
                if (Object.keys(logsPatch).length > 0) {
                  await setDoc(
                    doc(db, 'users', user.uid, 'dailyLogs', todayKey),
                    { ...logsPatch, updatedAt: serverTimestamp() },
                    { merge: true },
                  );
                }
                console.log('✅ Trainer metrics saved to Firebase:', updateData);
              }
            } catch (error) {
              console.error('❌ Failed to save trainer metrics:', error);
            }
          }}
          onPressMessage={handleOpenConversations}
          trainerClientId={user?.uid}
          trainerClientName={userData?.firstName || user?.displayName || 'You'}
          onOpenPhotoGallery={() => {
            setDay6Client({ id: user?.uid, name: userData?.firstName || user?.displayName || 'You' });
            setShowPhotoGallery(true);
          }}
          onOpenAIWorkouts={() => {
            setDay6Client({ id: user?.uid, name: userData?.firstName || user?.displayName || 'You' });
            setShowAIWorkouts(true);
          }}
        />
      ) : (
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 130, paddingTop: 6 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={!isDark ? '#000' : '#fff'} />}
        showsVerticalScrollIndicator={false}
      >
        <AuroraHeroBanner isDark={isDark} userId={auth?.currentUser?.uid} userName={userName} />
        {userRole !== 'trainer' && (
          <>
            <View style={{ marginVertical: 10, paddingHorizontal: 16 }}>
              {/* Outer gradient border container */}
              <LinearGradient
                colors={['#FF6B9D', '#C084FC']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 24,
                  padding: 2,
                  overflow: 'hidden',
                  // Add subtle shadow
                  shadowColor: '#FF6B9D',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.3,
                  shadowRadius: 12,
                  elevation: 5,
                }}
              >
                {/* Inner semi-transparent card */}
                <View
                  style={{
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.95)',
                    borderRadius: 22,
                      paddingVertical: 12,
                      paddingHorizontal: 12,
                  }}
                >
                  {/* Section label */}
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: '700',
                      color: '#FF6B9D',
                      letterSpacing: 2,
                      textTransform: 'uppercase',
                        marginBottom: 2,
                    }}
                  >
                  Your Complete Dashboard
                  </Text>

                  {/* Description text */}
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '600',
                      color: isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(17, 24, 39, 0.72)',
                      marginBottom: 6,
                      lineHeight: 18,
                      fontSize: 13,
                      textAlign: 'center',
                    }}
                  >
                    Log. View Workouts. Stats. Progress. All in One
                  </Text>

                  {/* Main Dashboard button (inside the card) */}
                  <View
                    style={{
                      alignSelf: 'center',
                      width: '76%',
                      position: 'relative',
                    }}
                  >
                    {unreadMessageCount > 0 && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -6,
                          right: 4,
                          zIndex: 10,
                          backgroundColor: '#FF3B30',
                          borderRadius: 11,
                          minWidth: 22,
                          height: 22,
                          paddingHorizontal: 6,
                          justifyContent: 'center',
                          alignItems: 'center',
                          borderWidth: 2,
                          borderColor: isDark ? '#0A0A0F' : '#FFFFFF',
                        }}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>
                          {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                        </Text>
                      </View>
                    )}
                    <LinearGradient
                      colors={['#FF6B9D', '#C084FC']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        borderRadius: 20,
                        overflow: 'hidden',
                      }}
                    >
                      <TouchableOpacity
                        onPress={() => setShowMyDashboard(true)}
                        activeOpacity={0.85}
                        style={{
                          paddingVertical: 8,
                          paddingHorizontal: 12,
                          alignItems: 'center',
                        }}
                      >
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 10,
                          }}
                        >
                          <Ionicons name="grid" size={20} color="#FFFFFF" />
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: '700',
                              color: '#FFFFFF',
                            }}
                          >
                            View Full Dashboard
                          </Text>
                          <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                        </View>
                      </TouchableOpacity>
                    </LinearGradient>
                  </View>
                </View>
              </LinearGradient>
            </View>
          </>
        )}
        <TopStatsRow
          isDark={isDark}
          themeMode={themeMode}
          colors={colors}
          todayWorkout={todayWorkout}
          waterIntake={waterIntake}
          sleepHours={sleepHours}
          primaryGoal={onboardingData?.primaryGoal}
          goalProgress={goalProgress}
          onPlanWorkout={handleAddWorkout}
        />
        {/* Weekly calendar removed */}
        {userRole !== 'trainer' && (
          <>
            {!hasTrainer && (
              <TrainerButton
                label="Find a trainer"
                onPress={() => setShowTrainerSearch(true)}
                notificationCount={0}
                theme={isDark ? 'dark' : 'light'}
              />
            )}
          </>
        )}
        {userRole !== 'trainer' && (
          <WellnessStatsRow
            isDark={isDark}
            colors={colors}
            soreness={soreness}
            energyLevel={energyLevel}
            stressLevel={stressLevel}
          />
        )}

        <TrainingAgenda 
          theme={isDark ? 'dark' : 'light'} 
          workouts={agendaWorkouts}
          onPlanWorkout={handleAddWorkout}
          onToggleWorkout={(workout, index) => handleStartWorkout()}
        />
        <NutritionCard 
          theme={isDark ? 'dark' : 'light'}
          consumed={caloriesConsumed}
          goal={calorieGoal}
          macros={nutritionMacros}
          additionalNutrients={additionalNutrients}
          onAddMeal={() => setShowNutrition(true)}
          nutritionGoals={nutritionGoals}
          compact
        />
        {myOwnFiles.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 16 }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: isDark ? '#FFFFFF' : 'rgba(17, 24, 39, 0.78)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            Your files
          </Text>
          <LinearGradient
            colors={['#06B6D4', '#8B5CF6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ borderRadius: 20, padding: 2, overflow: 'hidden' }}
          >
            <View
              style={{
                backgroundColor: isDark
                  ? FILE_GALLERY_THEME_COLORS.dark.surface
                  : FILE_GALLERY_THEME_COLORS.light.surface,
                borderRadius: 18,
                paddingVertical: 16,
                paddingHorizontal: 16,
              }}
            >
              <FileGalleryGrid
                isDark={isDark}
                files={myOwnFiles}
                onPressItem={openNotesFile}
                holdToDelete
                holdDurationMs={900}
                onLongPressItem={(file) => {
                  if (deletingMyFiles) return;
                  deleteSingleMyFile(file);
                }}
              />
            </View>
          </LinearGradient>
        </View>
        )}

        {pendingSessions.length > 0 && (
        <View style={{ paddingHorizontal: 16, marginTop: 10, marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)',
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="calendar" size={22} color="#C084FC" />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '800',
                  letterSpacing: 1.4,
                  color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(17, 24, 39, 0.55)',
                  textTransform: 'uppercase',
                }}
              >
                From your coach
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 16,
                  fontWeight: '800',
                  color: isDark ? '#fff' : '#0F172A',
                  letterSpacing: -0.3,
                }}
              >
                Session invites
              </Text>
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 12,
                  fontWeight: '600',
                  color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(15,23,42,0.55)',
                }}
              >
                Lock in a time or pass — your call.
              </Text>
            </View>
          </View>

          {pendingSessions.map((s) => (
            <SessionMeetingCard
              key={s.id}
              mode="invite"
              isDark={isDark}
              coachName={trainerData?.displayName || trainerData?.name || 'Your coach'}
              session={s}
              onRespond={respondToSession}
            />
          ))}
        </View>
        )}

        <View style={{ paddingHorizontal: 16, marginVertical: 24 }}>
          <Text style={{
            fontSize: 10,
            fontWeight: '700',
            color: isDark ? '#FFFFFF' : 'rgba(17, 24, 39, 0.78)',
            letterSpacing: 2,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}>
            Trainer Shared
          </Text>

          <LinearGradient
            colors={['#FF6B9D', '#C084FC']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              borderRadius: 20,
              padding: 2,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                backgroundColor: isDark
                  ? FILE_GALLERY_THEME_COLORS.dark.surface
                  : FILE_GALLERY_THEME_COLORS.light.surface,
                borderRadius: 18,
                paddingVertical: 16,
                paddingHorizontal: 16,
              }}
            >
              <FileGalleryGrid
                isDark={isDark}
                files={trainerSharedFiles}
                onPressItem={openNotesFile}
                footerLink={
                  trainerSharedFiles.length > 0
                    ? {
                        label: 'View all shared files',
                        onPress: () => setShowTrainerSharedFilesModal(true),
                      }
                    : undefined
                }
              />
            </View>
          </LinearGradient>
        </View>
      </ScrollView>
      )}

      <TrainerSharedFilesModal
        visible={showTrainerSharedFilesModal}
        onClose={() => setShowTrainerSharedFilesModal(false)}
        isDark={isDark}
        files={trainerSharedFiles}
        onPressItem={(file) => {
          setShowTrainerSharedFilesModal(false);
          openNotesFile(file);
        }}
      />
      <AddNotesFilesModal
        visible={showAddNotesFilesModal}
        onClose={() => setShowAddNotesFilesModal(false)}
        onAdded={refreshNotesAndFiles}
        isDark={isDark}
      />
      <PdfViewerModal
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={() => setPdfViewer({ visible: false, url: null, name: null })}
      />
      <SpreadsheetViewerModal
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      />
      <DocumentViewerModal
        visible={documentViewer.visible}
        trainerId={documentViewer.trainerId}
        documentId={documentViewer.documentId}
        title={documentViewer.title}
        isDark={isDark}
        onClose={() => setDocumentViewer({ visible: false, trainerId: null, documentId: null, title: null })}
      />
      <MediaViewerModal
        visible={mediaViewer.visible}
        url={mediaViewer.url}
        kind={mediaViewer.kind}
        name={mediaViewer.name}
        isDark={isDark}
        onClose={() => setMediaViewer({ visible: false, url: null, kind: 'image', name: null })}
      />
      <EmbedWebViewModal
        visible={embedWebViewer.visible}
        uri={embedWebViewer.uri}
        title={embedWebViewer.title}
        isDark={isDark}
        onClose={() => setEmbedWebViewer({ visible: false, uri: null, title: null })}
      />
      <RemoveTrainerSheet
        visible={showRemoveTrainerSheet}
        onClose={() => setShowRemoveTrainerSheet(false)}
        onRemovalComplete={() => {
          if (trainerData) {
            setReviewPromptTrainer({ id: trainerData.id, name: trainerData.displayName || trainerData.name || 'Your trainer' });
          }
          setTrainerData(null);
          setShowRemoveTrainerSheet(false);
        }}
        trainerName={trainerData?.displayName || trainerData?.name}
        clientName={user?.displayName || userData?.firstName}
        removedBy="client"
        trainerId={trainerData?.id}
        clientId={user?.uid}
      />
      {reviewPromptTrainer && (
        <ReviewSubmitSheet
          visible={showReviewSheetForPrompt}
          onClose={() => setShowReviewSheetForPrompt(false)}
          onSubmitComplete={() => {
            setShowReviewSheetForPrompt(false);
            setReviewPromptTrainer(null);
          }}
          trainerName={reviewPromptTrainer.name}
          trainerId={reviewPromptTrainer.id}
          clientId={user?.uid}
          clientFirstName={userData?.firstName || user?.displayName?.split(' ')[0]}
          existingReview={null}
        />
      )}
      <BottomNavBar
        onHomePress={handleHomePress}
        onPlusPress={() => setShowAddNotesFilesModal(true)}
        onVoicePress={openAIChatHome}
        onNutritionPress={() => setShowNutrition(true)}
        onWorkoutPress={openWorkout}
        onMessagesPress={handleOpenConversations}
        onProfilePress={() => setShowProfile(true)}
        activeTabKey="home"
      />
    </SafeAreaView>
    </AppNavigationProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  safeAreaLight: {
    backgroundColor: '#FFFFFF',
  },
  safeAreaDark: {
    backgroundColor: '#0A0A0A',
  },
  scrollView: {
    flex: 1,
  },
  // ─────────────────────────────────────────────
  // HERO (Client + Trainer top-of-app)
  // ─────────────────────────────────────────────
  heroOuter: {
    marginHorizontal: 22,
    marginTop: 0,
    marginBottom: 6,
    borderRadius: 24,
    borderWidth: 1,
    backgroundColor: 'transparent',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 10,
  },
  heroBorderGradient: {
    borderRadius: 24,
    padding: 2,
  },
  heroInner: {
    borderRadius: 23,
    overflow: 'hidden',
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  heroContentRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: {
    alignItems: 'center',
  },
  welcomeWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  welcomeKicker: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  welcomeUnderline: {
    marginTop: 6,
    width: 72,
    height: 3,
    borderRadius: 99,
    opacity: 0.9,
  },
  heroTitle: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  heroTagline: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 1.5,
  },
  heroRight: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroRightInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: '100%',
  },
  heroInlineQuoteWrap: {
    flex: 1,
    marginLeft: 12,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  heroInlineQuoteBorder: {
    borderRadius: 28,
    padding: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  heroQuotePillWrap: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroQuotePillBorder: {
    borderRadius: 28,
    padding: 1,
    alignSelf: 'center',
    width: '92%',
    maxWidth: 360,
  },
  auroraBorder: {
    height: 160,
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.25)',
    backgroundColor: 'transparent',
  },
  auroraContainer: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
  },
  logoCardInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.08)',
    borderRadius: 16,
  },
  logoMark: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 16,
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 3,
    color: '#FFFFFF',
  },
  logoSubtitle: {
    marginTop: 6,
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  headerIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 16,
    position: 'relative',
  },
  themeToggleText: {
    fontSize: 20,
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    marginTop: 16,
    fontFamily: 'System',
  },
  lottieAnimation: {
    width: '100%',
    height: '100%',
  },
  lightText: {
    color: '#000000',
  },
  darkText: {
    color: '#FFFFFF',
  },
  lightMutedText: {
    color: '#6B7280',
  },
  cardShadowWrap: {
    borderRadius: 12,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 14,
    backgroundColor: 'transparent',
  },
  cardShadowWrapLight: {
    shadowColor: '#5E5CE6',
    shadowOpacity: 0.18,
  },
  lightCard: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  photoScrollView: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addPhotoButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  addPhotoButtonLight: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  addPhotoText: {
    marginTop: 8,
    fontSize: 12,
    color: '#9CA3AF',
  },
  videoRailContainer: {
    height: 180,
    backgroundColor: '#0A0A0A',
    overflow: 'visible',
  },
  videoRailContainerLight: {
    backgroundColor: '#FFFFFF',
  },
  videoRailContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  videoRailItem: {
    width: 120,
    height: 160,
    marginRight: 12,
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  videoRailVideo: {
    width: '100%',
    height: '100%',
  },
  videoRailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  statsRowWrap: {
    paddingTop: 2,
  },
  statsRowContent: {
    paddingHorizontal: 20,
    paddingBottom: 6,
    gap: 12,
  },
  statCardShadow: {
    borderRadius: 24,
    marginRight: 12,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.22,
    shadowRadius: 22,
    elevation: 10,
    overflow: 'visible',
  },
  statCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
    width: '100%',
    alignSelf: 'stretch',
  },
  statCardInner: {
    borderRadius: 24,
    padding: 14,
    borderWidth: 1,
    minHeight: 150,
    width: '100%',
    alignSelf: 'stretch',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  /** Wellness row: stack title + value as one centered group (no space-between gap). */
  statCardInnerCentered: {
    justifyContent: 'center',
    gap: 10,
  },
  statWellnessValueBlock: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  statWellnessEmpty: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    paddingVertical: 4,
  },
  statKicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textAlign: 'center',
    width: '100%',
  },
  statBig: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 10,
    lineHeight: 26,
  },
  statEmpty: {
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  statEmptyLottie: {
    width: 120,
    height: 120,
  },
  wellnessEmptyLottie: {
    width: 80,
    height: 80,
  },
  statEmptyText: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  statGradientBlock: {
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    alignSelf: 'stretch',
  },
  statGradientNumberWrap: {
    paddingVertical: 4,
  },
  statGradientNumber: {
    fontSize: 48,
    fontWeight: '800',
    lineHeight: 54,
    textAlign: 'center',
  },
  statGradientLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
  statGradientWorkoutText: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '800',
    textAlign: 'center',
  },
  statCtaBtn: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  statCtaText: {
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.2,
  },
  waterRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  waterMeta: {
    marginLeft: 12,
  },
  waterNumber: {
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  waterUnit: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '700',
  },
  sleepWrap: {
    marginTop: 12,
  },
  sleepTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepNumber: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  sleepMoon: {
    marginLeft: 8,
    fontSize: 20,
    fontWeight: '800',
  },
  sleepUnit: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  goalWrap: {
    marginTop: 12,
  },
  goalLabel: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  goalBarTrack: {
    marginTop: 10,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
  },
  goalBarFill: {
    height: '100%',
    borderRadius: 999,
  },
  goalPct: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
  },
  goalEmpty: {
    marginTop: 12,
    flex: 1,
    justifyContent: 'center',
  },
  goalOutlineBtn: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  goalOutlineText: {
    fontSize: 12,
    fontWeight: '800',
  },
  greetingSection: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    overflow: 'visible',
    alignItems: 'center',
  },
  greetingLineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  greetingTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  greetingCardOuter: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingQuoteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderWidth: 1,
  },
  greetingQuoteCardDark: {
    backgroundColor: '#050509',
    borderColor: '#27272f',
  },
  greetingQuoteCardLight: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  greetingQuote: {
    flex: 1,
    paddingRight: 16,
  },
  greetingQuoteText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#E5E7EB',
    lineHeight: 26,
  },
  greetingQuoteAuthor: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  greetingLottieWrap: {
    width: 96,
    height: 96,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  greetingLottie: {
    width: '100%',
    height: '100%',
  },
  welcomeCard: {
    width: 140,
    minHeight: 74,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  welcomeCardLight: {
    borderColor: 'rgba(0, 0, 0, 0.08)',
  },
  welcomeText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.92)',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  welcomeTextLight: {
    color: 'rgba(15, 23, 42, 0.9)',
  },
  lottieWrap: {
    width: 140,
    height: 140,
    marginLeft: 16,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottieWrapLight: {
    // keep neutral in light mode; no override needed
  },
  calendarContainer: {
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  gradientCardBorder: {
    borderRadius: 16,
    padding: 1.5,
  },
  weekCalendar: {
    backgroundColor: '#020617',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#4B5563',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  weekHeader: {
    marginBottom: 12,
  },
  weekHeaderText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  weekDays: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  weekDay: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    minWidth: 40,
  },
  weekDayToday: {
    backgroundColor: '#BF5AF2',
  },
  weekDayName: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  weekDayNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  weekDayNumberToday: {
    color: 'white',
  },
  lightWeekDay: {
    backgroundColor: '#F3F4F6',
  },
  trainerButtonContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: 'center',
  },
  trainerButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 999,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
  },
  trainerButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  trainerButtonTextLight: {
    color: 'black',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  notificationBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  notificationBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  agendaContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  agendaGradientBorder: {
    borderRadius: 16,
    padding: 2,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' && {
      shadowColor: '#a855f7',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    }),
    elevation: 4,
  },
  agendaCardInner: {
    borderRadius: 14,
    overflow: 'hidden',
    // Inner wrapper for animated card; background is handled by gradients inside.
    padding: 0,
  },
  agendaLeftRail: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    zIndex: 4,
  },
  agendaBg: {
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 120,
  },
  agendaTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.55,
  },
  agendaPad: {
    padding: 20,
  },
  agendaHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  agendaSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: '#B0B0B0',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  agendaTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  agendaTitleRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  agendaTitleIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  agendaBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  agendaBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  agendaExercisesWrap: {
    marginTop: 16,
    gap: 12,
  },
  agendaExerciseRowPremium: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  agendaDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  agendaExerciseName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  agendaExerciseSets: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '400',
    color: '#B0B0B0',
  },
  agendaFooterRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  agendaDuration: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
  },
  agendaTimestamp: {
    fontSize: 11,
    fontWeight: '400',
    color: '#B0B0B0',
  },
  agendaEmptyPremium: {
    fontSize: 13,
    fontWeight: '600',
  },
  agendaCardDark: {
    backgroundColor: 'rgba(31, 41, 55, 0.95)',
    borderWidth: 0,
  },
  agendaCardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 0,
  },
  agendaEmptyContent: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 14,
  },
  agendaEmptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  agendaEmptyButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  agendaEmptyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  agendaWorkoutBlock: {
    marginBottom: 16,
  },
  agendaWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingRight: 8,
  },
  agendaWorkoutTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  agendaExercisesList: {
    paddingLeft: 32,
    paddingTop: 4,
    gap: 6,
  },
  agendaExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  agendaExerciseNum: {
    fontSize: 12,
    width: 20,
    fontWeight: '600',
  },
  agendaExerciseText: {
    fontSize: 13,
    flex: 1,
  },
  agendaCard: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4B5563',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 10,
  },
  agendaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#4B5563',
  },
  agendaItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6B7280',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  checkedBox: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  workoutName: {
    fontSize: 14,
    color: 'white',
  },
  workoutNameChecked: {
    textDecorationLine: 'line-through',
    color: '#9CA3AF',
  },
  workoutSets: {
    fontSize: 12,
    color: '#9CA3AF',
    fontFamily: 'monospace',
  },
  nutritionContainer: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  nutritionGradientBorder: {
    borderRadius: 16,
    padding: 2,
    overflow: 'hidden',
  },
  nutritionCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    padding: 14,
  },
  nutritionCardLight: {
    backgroundColor: '#F3F4F6',
    borderColor: 'rgba(255,107,157,0.25)',
  },
  nutritionGrid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  nutritionGridCell: {
    width: '50%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  nutritionCompactCirclesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 6,
  },
  nutritionCompactCircleCell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nutritionCircleWrap: {
    alignItems: 'center',
    position: 'relative',
  },
  nutritionCircleCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nutritionCircleValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  nutritionCircleLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  macrosGrid: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  macroItem: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  macroIcon: {
    width: 55,
    height: 55,
    resizeMode: 'contain',
  },
  macroLabel: {
    fontSize: 16,
    textShadowColor: 'cyan',
    color: '#9CA3AF',
    marginTop: 2,
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
    marginTop: 1,
  },
  additionalNutrientsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  additionalNutrientItem: {
    alignItems: 'center',
    width: '22%',
    minWidth: 60,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  additionalNutrientIcon: {
    fontSize: 16,
    marginBottom: 2,
  },
  additionalNutrientLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 1,
    textAlign: 'center',
  },
  additionalNutrientValue: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    marginTop: 1,
    textAlign: 'center',
  },
  caloriesSection: {
    marginBottom: 8,
  },
  caloriesInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  caloriesLabel: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  caloriesValue: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#374151',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  journalLink: {
    fontSize: 13,
    color: '#BF5AF2',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  notesContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    paddingBottom: 100,
  },
  notesGradientBorder: {
    borderRadius: 16,
    padding: 2,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' && { shadowColor: '#a855f7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 }),
    elevation: 4,
  },
  notesCardInner: {
    borderRadius: 14,
    overflow: 'hidden',
    padding: 16,
  },
  notesCardDark: {
    backgroundColor: 'rgba(20, 25, 40, 0.95)',
  },
  notesCardLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  notesEmptyContent: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 14,
  },
  notesEmptyText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  notesEmptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  notesContent: { gap: 28 },
  notesSection: { gap: 14 },
  notesCategoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  notesSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  notesNoteCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  notesNoteText: { fontSize: 15, lineHeight: 22 },
  notesNoteDate: { fontSize: 12, fontWeight: '500' },
  notesMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  notesMediaCard: {
    width: '31%',
    alignItems: 'center',
    gap: 6,
  },
  notesMediaThumb: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  notesVideoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  notesMediaLabel: { fontSize: 12, fontWeight: '500' },
  notesDocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  notesDocName: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  notesFileInfo: { flex: 1, justifyContent: 'center', minWidth: 0 },
  notesFileMeta: { fontSize: 12, fontWeight: '500', color: 'rgba(255,255,255,0.5)' },
  notesCard: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  notesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  fileItem: {
    alignItems: 'center',
  },
  centerNavItem: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#374151',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fileLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 8,
  },
  emptyStateContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateText: {
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
  },
  emptyStateButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  emptyStateButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  glassCard: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  glassCardBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    pointerEvents: 'none',
  },
  heroCardContainer: {
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
  },
  heroGradientBorder: {
    borderRadius: 24,
    padding: 1,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'System',
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    alignSelf: 'flex-start',
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6C5CE7',
    letterSpacing: 0.3,
    fontFamily: 'System',
  },
  heroWorkoutName: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'System',
  },
  heroSubtitle: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 20,
    lineHeight: 20,
    fontFamily: 'System',
  },
  heroStats: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 20,
  },
  heroStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroStatText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'System',
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: '#6C5CE7',
  },
  heroButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  caloriesCard: {
    marginBottom: CARD_GAP,
  },
  caloriesContent: {
    padding: 24,
  },
  caloriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  caloriesHeroLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1,
    marginBottom: 8,
    fontFamily: 'System',
  },
  caloriesHeroValue: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'System',
    letterSpacing: -0.5,
  },
  caloriesGoal: {
    fontSize: 20,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  caloriesFooter: {
    flexDirection: 'row',
    gap: 20,
  },
  caloriesStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  caloriesStatText: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  smallStatCard: {
    // Inherits from GlassCard
  },
  smallStatContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  smallStatIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallStatIconImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  smallStatValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'System',
  },
  smallStatLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: CARD_GAP,
  },
  gridCard: {
    // Inherits from GlassCard
  },
  gridContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  gridIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  gridIconImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  gridTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'System',
  },
  gridSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    fontFamily: 'System',
  },
  upcomingSection: {
    marginBottom: 24,
  },
  upcomingContainer: {
    padding: 4,
  },
  upcomingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  upcomingIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  upcomingContent: {
    flex: 1,
  },
  upcomingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'System',
  },
  upcomingTime: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  emptyState: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  emptyStateText: {
    fontSize: 14,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingLeft: 4,
  },
  sectionAccent: {
    width: 2,
    height: 16,
    backgroundColor: '#8B7FFF',
    marginRight: 8,
    borderRadius: 1,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'System',
  },
  discoverSection: {
    marginBottom: 24,
  },
  discoverGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: CARD_GAP,
  },
  discoverCard: {
    // Inherits from GlassCard
  },
  discoverContent: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  discoverIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  discoverIconImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  discoverTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    textAlign: 'center',
    fontFamily: 'System',
  },
  discoverSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    fontFamily: 'System',
  },
  findTrainersSection: {
    marginBottom: 24,
  },
  findTrainersContent: {
    padding: 20,
  },
  findTrainersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  findTrainersIcon: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  findTrainersTextContainer: {
    flex: 1,
  },
  findTrainersTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'System',
  },
  findTrainersSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  searchBarContainer: {
    marginTop: 8,
  },
  searchBarGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(108, 92, 231, 0.3)',
  },
  searchBarPlaceholder: {
    fontSize: 15,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  crmCard: {
    // Inherits from GlassCard
  },
  crmContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    height: '100%',
  },
  crmIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(108, 92, 231, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  crmTextContainer: {
    flex: 1,
  },
  crmTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'System',
  },
  crmSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  // Skeleton loading styles
  skeletonBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    opacity: 0.7,
  },
  skeletonCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    opacity: 0.7,
  },
});
