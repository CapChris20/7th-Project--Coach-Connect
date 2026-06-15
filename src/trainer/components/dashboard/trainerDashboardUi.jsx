/**
 * trainer Dashboard Ui
 *
 * Purpose: trainer Dashboard Ui — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather, Ionicons } from '@expo/vector-icons';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Path } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import BlurBackdropPlate from '../../../shared/ui/BlurBackdropPlate';
import { DailyQuotePill } from '../../../shared/components/DailyQuoteCard';
import AuroraHeroBannerBase from '../../../shared/components/AuroraHeroBanner';
import FilesNotesHeroCard from '../../../client/components/FilesNotesHeroCard';
import FilesNotesSectionPremium from '../../../shared/components/FilesNotesSectionPremium';
import AddNotesFilesModal from '../../../shared/components/AddNotesFilesModal';
import MediaViewerModal from '../../../shared/components/MediaViewerModal';
import EmbedWebViewModal from '../../../shared/components/EmbedWebViewModal';
import { deleteNotesAndFilesItem } from '../../../shared/notes-files/manageNotesAndFiles';
import {
  isImageFile as isNotesImageFile,
  isVideoFile as isNotesVideoFile,
  isPdfFile as isNotesPdfFile,
  getEmbedViewerUri,
} from '../../../shared/utils/getFileViewType';
import { Dimensions } from 'react-native';
import { useTheme as useGlobalTheme } from '../../../shared/ui/ThemeContext';

const LOTTIE_WELLNESS_SORENESS_EMPTY = require('../../../assets/sad reaction.json');
const LOTTIE_WELLNESS_ENERGY_EMPTY = require('../../../assets/Run Hamster... run.json');
const LOTTIE_WELLNESS_STRESS_EMPTY = require('../../../assets/Stressed Employee At Work.json');
const LOTTIE_STEPS_EMPTY = require('../../../shared/assets/Walking steps.json');
const LOTTIE_MOOD_EMPTY = require('../../../shared/assets/Happy SUN.json');
const LOTTIE_FOOD_AROUND_CITY = require('../../../assets/Lotties for Anatrox/food around the city.json');

function getTrainerDashboardLottieSource(lottieType) {
  switch (lottieType) {
    case 'steps':
      return LOTTIE_STEPS_EMPTY;
    case 'water':
      return require('../../../assets/Lotties for Anatrox/glass water.json');
    case 'sleep':
      return require('../../../assets/Lotties for Anatrox/sleep.json');
    case 'boxer':
      return require('../../../assets/Lotties for Anatrox/boxer lottie.json');
    case 'nutrition_empty':
    case 'food':
      return require('../../../assets/Lotties for Anatrox/Food squeeze_With Burger and hot dog.json');
    case 'soreness':
      return LOTTIE_WELLNESS_SORENESS_EMPTY;
    case 'energy':
      return LOTTIE_WELLNESS_ENERGY_EMPTY;
    case 'stress':
      return LOTTIE_WELLNESS_STRESS_EMPTY;
    case 'mood':
      return LOTTIE_MOOD_EMPTY;
    default:
      return null;
  }
}

function getTrainerDashboardLottieCaption(lottieType) {
  switch (lottieType) {
    case 'steps':
      return 'Steps not logged yet';
    case 'water':
      return 'Water not logged yet';
    case 'sleep':
      return 'Sleep not logged yet';
    case 'boxer':
      return 'No workout logged yet';
    case 'nutrition_empty':
      return 'No nutrition data for this client yet';
    case 'food':
      return 'No meals logged yet';
    case 'soreness':
      return 'Soreness not logged yet';
    case 'energy':
      return 'Energy not logged yet';
    case 'stress':
      return 'Stress not logged yet';
    case 'mood':
      return 'Mood not logged yet';
    default:
      return null;
  }
}

function hexToRgbTriple(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return '255, 107, 157';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '255, 107, 157';
  return `${r}, ${g}, ${b}`;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
// YOUR COLOR SYSTEM: #C084FC #FF6B9D #F97316 #06B6D4 — different combo per section
// ─────────────────────────────────────────────
const PURPLE = '#C084FC';
const PINK = '#FF6B9D';
const ORANGE = '#F97316';
const CYAN = '#06B6D4';

const GRADIENT_BG_DARK = ['#0c0c0e', '#0f0f12', '#0c0c0e'];
const GRADIENT_BG_LIGHT = ['#f5f5f7', '#f0f0f2', '#ebebed'];

// Each section gets its own 2-color combo from your palette
const GRADIENT_HERO = [PURPLE, PINK];
const GRADIENT_AVATAR = [PURPLE, CYAN];
const GRADIENT_USERNAME = [PURPLE, PINK];
const GRADIENT_TABS = [S_P, S_K];
const GRADIENT_BORDER_CARD = [PINK, ORANGE];   // hot pink + orange border
const GRADIENT_WEIGHT = [PURPLE, PINK];
const GRADIENT_SLEEP = [CYAN, PURPLE];
const GRADIENT_WATER = [CYAN, ORANGE];
const GRADIENT_WORKOUT = [ORANGE, PINK];
const GRADIENT_CTA = [PURPLE, PINK];           // buttons, Client Requests badge
const GRADIENT_CALENDAR = [PURPLE, CYAN];
const GRADIENT_NOTES = [PINK, ORANGE];

const ACCENT = GRADIENT_CTA;                    // default where no specific combo
const BORDER_GRADIENT = GRADIENT_BORDER_CARD;

// Single colors for arcs / icons / badge
const GRADIENT_NUTRITION_PROTEIN = PURPLE;
const GRADIENT_NUTRITION_CARBS = CYAN;
const GRADIENT_NUTRITION_FAT = PINK;
const BADGE_COLOR = PINK;
const ICON_ACCENT = PURPLE;

// Progress tab VALUE text only — soft combos (not neon), one per card
const S_P = '#A78BFA';   // soft purple
const S_K = '#E8799A';   // soft pink
const S_O = '#FB923C';   // soft orange
const S_C = '#0D9488';   // soft teal
// Daily metric big numbers — distinct combos (dark pink / dark orange / gray); avoid one hue for all
const D_PINK_DEEP = '#9F1239';
const D_PINK_MID = '#BE185D';
const D_ORANGE_DEEP = '#9A3412';
const D_ORANGE_SOFT = '#FB923C';
const D_GRAY_DEEP = '#1F2937';
const D_GRAY_MID = '#6B7280';
const PROGRESS_VALUE_WEIGHT = [S_P, S_K];
const PROGRESS_VALUE_SLEEP = [S_C, S_P];
const PROGRESS_VALUE_WATER = [S_C, S_O];
const PROGRESS_VALUE_WORKOUT = [S_O, S_K];
const PROGRESS_VALUE_ENERGY = [D_PINK_DEEP, D_PINK_MID];
const PROGRESS_VALUE_STRESS = [D_GRAY_DEEP, D_GRAY_MID];
const PROGRESS_VALUE_MOOD = [D_ORANGE_DEEP, D_ORANGE_SOFT];
const PROGRESS_VALUE_SORENESS = [D_PINK_MID, D_ORANGE_DEEP];
const PROGRESS_VALUE_STEPS = [D_GRAY_MID, S_P];
const PROGRESS_VALUE_BODYFAT = [S_P, S_K];
const PROGRESS_VALUE_DAY = [S_P, S_C];

// Card borders — different combo per section (not one neon purple everywhere)
const CARD_BORDER_PINK_ORANGE = 'rgba(255,107,157,0.32)';   // client selector
const CARD_BORDER_PURPLE_CYAN = 'rgba(6,182,212,0.28)';    // tab pills inactive
const CARD_BORDER_PROGRESS = 'rgba(192,132,252,0.22)';     // Progress tab cards
const CARD_BORDER_NUTRITION = 'rgba(6,182,212,0.24)';      // Nutrition tab cards
const CARD_BORDER_CALENDAR = 'rgba(249,115,22,0.22)';      // Calendar tab cards
const CARD_BORDER_NOTES = 'rgba(255,107,157,0.26)';        // Notes & Files tab cards
const CARD_BORDER_DEFAULT = 'rgba(255,255,255,0.1)';       // neutral, not neon
const CARD_SHADOW_NEUTRAL = 'rgba(0,0,0,0.22)';            // neutral shadow, not purple

// ─────────────────────────────────────────────
// ICON PATHS
// ─────────────────────────────────────────────
const ICON_PATHS = {
  Sun: ["M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"],
  Moon: ["M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"],
  User: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  ChevronDown: ["m6 9 6 6 6-6"],
  ChevronLeft: ["m15 18-6-6 6-6"],
  ChevronRight: ["m9 18 6-6-6-6"],
  UserPlus: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M16 11h6m-3-3v6"],
  MessageSquare: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  Dumbbell: ["M6.5 6.5h11", "M6.5 17.5h11", "M6.5 6.5v11", "M17.5 6.5v11"],
  Utensils: ["M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2", "M7 2v20", "M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3"],
  CalendarPlus: ["M21 13V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8", "M16 19v6", "M19 22v-6"],
  FolderOpen: ["m6 14 1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.93 6A2 2 0 0 1 18 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9L9.6 12a2 2 0 0 0 1.69.9H18"],
  Upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  PenSquare: ["M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7", "M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"],
  Flame: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"],
  Pill: ["m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"],
  Wheat: ["M2 22 16 8", "M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"],
  Beef: ["M18.372 5.272c.35 0 .628.279.628.628v.628c0 .35-.279.628-.628.628H5.628A.628.628 0 0 1 5 6.528v-.628c0-.35.279-.628.628-.628h12.744Z"],
  Droplets: ["M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"],
  Home: ["m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"],
  Plus: ["M5 12h14", "M12 5v14"],
  Image: ["M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"],
  FileText: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  Download: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M7 10l5 5 5-5", "M12 15V3"],
  Bell: ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"],
  Sparkles: [
    "M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z",
    "M5 14l0.8 2.2L8 17l-2.2 0.8L5 20l-0.8-2.2L2 17l2.2-0.8L5 14z",
    "M19 13l0.9 2.4L22 16l-2.1 0.6L19 19l-0.9-2.4L16 16l2.1-0.6L19 13z",
  ],
  MoonAlt: ["M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 21 12.79z"],
  Droplet: ["M12 2C9 6 6 9.5 6 13a6 6 0 0 0 12 0c0-3.5-3-7-6-11z"],
  Zap: ["M13 2L3 14h7l-1 8 10-12h-7l1-8z"],
  Footsteps: [
    "M8.5 3.5c-1.5 0-2.5 1.2-2.5 2.7 0 1.3 0.7 2.3 1.6 3.7 0.3 0.5 0.6 1 0.9 1.6",
    "M9 13a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
    "M15.5 7.5c-1.5 0-2.5 1.2-2.5 2.7 0 1.3 0.7 2.3 1.6 3.7 0.3 0.5 0.6 1 0.9 1.6",
    "M16 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z",
  ],
};

// Icon component: Renders SVG icons from ICON_PATHS.
const Icon = ({ name, size = 18, color = "#fff" }) => {
  const paths = ICON_PATHS[name];
  if (!paths) return <Text style={{ fontSize: size, color }}>{name?.charAt(0) || "?"}</Text>;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {(Array.isArray(paths) ? paths : [paths]).map((d, i) => <Path key={i} d={d} />)}
    </Svg>
  );
};

// ─────────────────────────────────────────────
// THEME CONTEXT
// ─────────────────────────────────────────────
const TrainerStylesContext = createContext();
const TrainerStylesProvider = ({ children }) => {
  const { isDark } = useGlobalTheme();
  return (
    <TrainerStylesContext.Provider value={{ isDark }}>
      {children}
    </TrainerStylesContext.Provider>
  );
};
const useTrainerTheme = () => {
  const ctx = useContext(TrainerStylesContext);
  const { isDark: globalIsDark } = useGlobalTheme();
  return ctx ?? { isDark: globalIsDark };
};

// ─────────────────────────────────────────────
// GLASS CARD — optional borderVariant: 'progress' | 'nutrition' | 'calendar' | 'notes' (different combo per section)
// ─────────────────────────────────────────────
const CARD_BORDER_BY_VARIANT = {
  progress: CARD_BORDER_PROGRESS,
  nutrition: CARD_BORDER_NUTRITION,
  calendar: CARD_BORDER_CALENDAR,
  notes: CARD_BORDER_NOTES,
};
const GlassCard = ({ children, style, isDark, borderVariant }) => {
  const borderColor = borderVariant ? CARD_BORDER_BY_VARIANT[borderVariant] : CARD_BORDER_DEFAULT;
  const cardStyle = [
    {
      borderRadius: 20,
      borderWidth: 1,
      overflow: 'hidden',
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.7)',
      borderColor: style?.borderColor ?? borderColor,
      ...(Platform.OS === 'ios' && {
        shadowColor: CARD_SHADOW_NEUTRAL,
        shadowRadius: 12,
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 4 },
      }),
    },
    style,
  ];
  if (Platform.OS === 'ios') {
    return (
      <BlurBackdropPlate intensity={20} tint={isDark ? 'dark' : 'light'} style={cardStyle}>
        {children}
      </BlurBackdropPlate>
    );
  }
  return <View style={cardStyle}>{children}</View>;
};

// ─────────────────────────────────────────────
// GRADIENT TEXT
// ─────────────────────────────────────────────
const GradientText = ({ children, style, colors = ACCENT }) => (
  <MaskedView maskElement={<Text style={[style, { backgroundColor: 'transparent' }]}>{children}</Text>}>
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
      <Text style={[style, { opacity: 0 }]}>{children}</Text>
    </LinearGradient>
  </MaskedView>
);

// Hero banner: Welcome message + logo gradient + daily quote pill.
const AuroraHeroBanner = ({ isDark, timeOfDay, userName, textColor, userId }) => (
  <AuroraHeroBannerBase
    isDark={isDark}
    userId={userId}
    userName={userName}
    greetingPeriod={timeOfDay}
    textColor={textColor}
    showLiveClock={false}
    layout="trainer"
  />
);

// ─────────────────────────────────────────────
// ARC PROGRESS SVG
// ─────────────────────────────────────────────
const ArcProgress = ({ value, goal, label, color, isDark, unit = "g" }) => {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
  const radius = 36;
  const circumference = Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  return (
    <GlassCard isDark={isDark} style={{ alignItems: 'center', padding: 12 }}>
      <Svg width={90} height={55} viewBox="0 0 90 55">
        <Path d="M 9 50 A 36 36 0 0 1 81 50" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} strokeLinecap="round" />
        <Path
          d="M 9 50 A 36 36 0 0 1 81 50"
          fill="none"
          stroke={color}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </Svg>
      <Text style={{ color: textColor, fontSize: 18, fontWeight: '700', marginTop: -6 }}>{value}{unit}</Text>
      <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2 }}>{label}</Text>
    </GlassCard>
  );
};

// ─────────────────────────────────────────────
// BORDERED CARD (gradient border)
// ─────────────────────────────────────────────
const BorderedCard = ({ children, style, borderRadius = 20, bordered = false, isDark }) => {
  const innerBg = isDark ? '#0d1117' : '#f1f5f9';
  if (!bordered) {
    return (
      <GlassCard isDark={isDark} style={[style, { borderRadius }]}>
        {children}
      </GlassCard>
    );
  }
  return (
    <View style={[style, { borderRadius, padding: 2, overflow: 'hidden' }]}>
      <LinearGradient colors={BORDER_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <View style={{ flex: 1, borderRadius: borderRadius - 2, backgroundColor: innerBg, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const getClientInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2) || '?';
};

/** Roster / cards: show feet/inches; treat plain numbers as total inches (legacy onboarding). */
const formatClientHeightDisplay = (h) => {
  if (h == null || h === '') return null;
  if (typeof h === 'object' && h?.feet != null) {
    const inch = Number(h.inches) || 0;
    return `${h.feet}'${inch}"`;
  }
  const n = typeof h === 'number' ? h : Number(String(h).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(n) && n >= 36 && n <= 96) {
    const total = Math.round(n);
    return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  return typeof h === 'string' && h.trim() ? h.trim() : null;
};

const getClientSubtext = (client) => {
  const parts = [];
  if (client.goals || client.primaryGoal) parts.push((client.goals || client.primaryGoal || '').replace(/_/g, ' '));
  if (client.age) parts.push(`${client.age}y`);
  if (client.weight) parts.push(`${client.weight} lbs`);
  const heightLabel = formatClientHeightDisplay(client.height);
  if (heightLabel) parts.push(heightLabel);
  return parts.length ? parts.join(' · ') : '—';
};

/** Structured fields for roster “profile” cards (not the old one-line chip). */
const getClientRosterStats = (client) => {
  const rawGoal = (client.goals || client.primaryGoal || '').replace(/_/g, ' ').trim();
  const goal =
    rawGoal.length > 0
      ? rawGoal.replace(/\b\w/g, (c) => c.toUpperCase())
      : null;
  return {
    goal,
    age: client.age != null && client.age !== '' ? String(client.age) : null,
    weight: client.weight != null && client.weight !== '' ? String(client.weight) : null,
    height: formatClientHeightDisplay(client.height),
  };
};

// ─────────────────────────────────────────────
// PREMIUM TAB EMPTY STATE
// ─────────────────────────────────────────────
const PremiumTabEmptyState = ({
  isDark,
  icon = 'ellipse-outline',
  lottieSource = null,
  lottieSize = 100,
  title,
  subtitle,
  hints = [],
}) => {
  const headlineColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const subColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(10,10,15,0.55)';
  const hintColor = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(10,10,15,0.5)';
  const innerBg = isDark ? '#0A0812' : '#FFFFFF';
  const iconInnerBg = isDark ? 'rgba(14,12,22,0.98)' : 'rgba(255,255,255,0.98)';
  const iconColor = isDark ? '#E9D5FF' : '#7C3AED';
  const border = ['#9333EA', '#DB2777'];
  const bg = isDark ? ['#12081f', '#08050f'] : ['#F3F0FA', '#FFFFFF'];

  return (
    <LinearGradient
      colors={border}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 20,
        padding: 2,
        ...(Platform.OS === 'ios'
          ? { shadowColor: '#9333EA', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 14 }
          : { elevation: 5 }),
      }}
    >
      <View style={{ borderRadius: 18, overflow: 'hidden', backgroundColor: innerBg }}>
        <LinearGradient colors={bg} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
          <LinearGradient colors={border} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 3, width: '100%' }} />
          <View style={{ paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center' }}>
            {lottieSource ? (
              <View
                style={{
                  width: lottieSize,
                  height: lottieSize,
                  marginBottom: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LottieView source={lottieSource} autoPlay loop style={{ width: '100%', height: '100%' }} />
              </View>
            ) : (
              <LinearGradient colors={border} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 64, height: 64, borderRadius: 20, padding: 2, marginBottom: 16 }}>
                <View style={{ flex: 1, borderRadius: 18, backgroundColor: iconInnerBg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={icon} size={28} color={iconColor} />
                </View>
              </LinearGradient>
            )}

            <Text style={{ color: headlineColor, fontSize: 17, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center' }}>
              {title}
            </Text>
            <Text style={{ color: subColor, fontSize: 13, fontWeight: '500', lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 280 }}>
              {subtitle}
            </Text>

            {hints.length > 0 ? (
              <View style={{ marginTop: 18, alignSelf: 'stretch', gap: 8 }}>
                {hints.map((line) => (
                  <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: isDark ? 'rgba(147,51,234,0.2)' : 'rgba(124,58,237,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="checkmark" size={12} color={isDark ? '#DDD6FE' : '#7C3AED'} />
                    </View>
                    <Text style={{ flex: 1, color: hintColor, fontSize: 12, fontWeight: '600', lineHeight: 16 }}>{line}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
};

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────
const EmptyState = ({ icon, message, ctaLabel, onCta, isDark, lottieType, compact }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const lottieSource = lottieType ? getTrainerDashboardLottieSource(lottieType) : null;
  const lottieCaption = lottieType ? getTrainerDashboardLottieCaption(lottieType) : null;
  const pad = compact ? 20 : 32;
  const gap = compact ? 8 : 12;
  const iconWrap = compact ? 44 : 52;

  return (
    <GlassCard isDark={isDark} style={{ padding: pad, alignItems: 'center', gap }}>
      {lottieType && lottieSource ? (
        <>
          <LottieView
            source={lottieSource}
            autoPlay
            loop
            style={{ width: 100, height: 100 }}
          />
          <Text style={{ color: mutedColor, fontSize: 14, textAlign: 'center' }}>
            {lottieCaption ?? message}
          </Text>
        </>
      ) : (
        <View style={{
          width: iconWrap, height: iconWrap, borderRadius: iconWrap / 2,
          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,58,237,0.08)',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name={icon} size={compact ? 20 : 24} color={mutedColor} />
        </View>
      )}
      {(!lottieType || message) && (
        <Text style={{ color: mutedColor, fontSize: compact ? 13 : 14, textAlign: 'center', lineHeight: compact ? 19 : 20 }}>{message}</Text>
      )}
      {ctaLabel && onCta && (
        <TouchableOpacity onPress={onCta} activeOpacity={0.8}>
          <LinearGradient colors={GRADIENT_CTA} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}>
            <Icon name={icon} size={15} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{ctaLabel}</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}
    </GlassCard>
  );
};

// ─────────────────────────────────────────────
// CATEGORY CARD — single metric, optional (only render if has value or show —)
// ─────────────────────────────────────────────
const CategoryCard = ({ title, value, unit, isDark, emptyLabel, gradient }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';
  const hasVal = value != null && value !== '';
  
  const getLottieForCategory = (title) => {
    const titleLower = title.toLowerCase();
    if (titleLower.includes('soreness')) return 'soreness';
    if (titleLower.includes('energy')) return 'energy';
    if (titleLower.includes('stress')) return 'stress';
    if (titleLower.includes('mood')) return 'mood';
    if (titleLower.includes('steps')) return 'steps';
    if (titleLower.includes('sleep')) return 'sleep';
    if (titleLower.includes('water')) return 'water';
    if (titleLower.includes('workout') || titleLower.includes('training')) return 'boxer';
    return null;
  };
  
  const lottieType = getLottieForCategory(title);
  const lottieSource = lottieType ? getTrainerDashboardLottieSource(lottieType) : null;
  
  // Always show descriptive label when there's a value
  const getDisplayLabel = () => {
    if (!hasVal) return null;
    const titleLower = title.toLowerCase();
    if (titleLower.includes('energy')) return 'Energy level';
    if (titleLower.includes('steps')) return 'Steps today';
    if (titleLower.includes('body fat')) return 'Body fat';
    if (titleLower.includes('soreness')) return 'Soreness level';
    if (titleLower.includes('stress')) return 'Stress level';
    if (titleLower.includes('mood')) return 'Mood';
    if (titleLower.includes('sleep')) return 'Sleep hours';
    if (titleLower.includes('water')) return 'Water intake';
    if (titleLower.includes('workout') || titleLower.includes('training')) return 'Workout';
    return title;
  };
  
  return (
    <GlassCard isDark={isDark} style={{ padding: 16, alignItems: 'center' }}>
      {hasVal ? (
        <>
          <GradientText colors={gradient} style={{ fontSize: 28, fontWeight: '800' }}>{value}</GradientText>
          {unit ? <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2 }}>{unit}</Text> : null}
          <Text style={{ color: mutedColor, fontSize: 10, marginTop: 2, fontStyle: 'italic' }}>{getDisplayLabel()}</Text>
        </>
      ) : (
        <View style={{ alignItems: 'center' }}>
          {lottieType && lottieSource ? (
            <>
              <LottieView
                source={lottieSource}
                autoPlay
                loop
                style={{ width: 100, height: 100 }}
              />
              <Text style={{ color: mutedColor, fontSize: 13, fontStyle: 'italic', marginTop: 8 }}>
                {getTrainerDashboardLottieCaption(lottieType) ?? emptyLabel ?? 'No data'}
              </Text>
            </>
          ) : (
            <Text style={{ color: mutedColor, fontSize: 13, fontStyle: 'italic' }}>{emptyLabel || 'No data'}</Text>
          )}
        </View>
      )}
    </GlassCard>
  );
};

/** Hero card → full-screen workspace (matches client home Notes & Files flow). */
const TrainerNotesFilesHeroAndWorkspace = ({
  isDark,
  clientName,
  clientData,
  trainerDocuments,
  clientId,
  trainerId,
  onRefetchNotesAndFiles,
  pdfViewer,
  setPdfViewer,
  spreadsheetViewer,
  setSpreadsheetViewer,
  onRefetchTrainerDocuments,
  onOpenDocumentEditor,
  onOpenShareModal,
  onOpenSpreadsheetEditor,
  onImportSpreadsheet,
}) => {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedViewer, setEmbedViewer] = useState({ visible: false, uri: null, title: null });

  const items = clientData?.notesAndFiles || [];
  const fileCount = items.length + (Array.isArray(trainerDocuments) ? trainerDocuments.length : 0);
  const newCount = items.filter((x) => (x.addedBy || 'client') === 'client' && x.isRead !== true).length;
  const sheetBg = isDark ? '#0A0A0F' : '#F7F7FA';
  const headerColor = isDark ? '#ffffff' : '#1A1A2E';

  const openItem = useCallback((f) => {
    if (!f) return;
    const isSpreadsheet = f.type === 'spreadsheet';
    const isDoc = f.type === 'document';
    const isTrainerSpreadsheet = isSpreadsheet && f.documentId;
    if (isTrainerSpreadsheet && onOpenSpreadsheetEditor) {
      onOpenSpreadsheetEditor(f);
      return;
    }
    if (isSpreadsheet && f.url) {
      setSpreadsheetViewer?.({ visible: true, url: f.url, name: f.name || 'Spreadsheet' });
      return;
    }
    if (isDoc && onOpenDocumentEditor) {
      onOpenDocumentEditor(f);
      return;
    }
    if (f.url && isNotesImageFile(f)) {
      setMediaViewer({ visible: true, url: f.url, kind: 'image', name: f.name || f.title || 'Photo' });
      return;
    }
    if (f.url && isNotesVideoFile(f)) {
      setMediaViewer({ visible: true, url: f.url, kind: 'video', name: f.name || f.title || 'Video' });
      return;
    }
    if (f.url && isNotesPdfFile(f, f.url)) {
      setPdfViewer({ visible: true, url: f.url, name: f.name || 'Document' });
      return;
    }
    if (f.url) {
      setEmbedViewer({ visible: true, uri: getEmbedViewerUri(f, f.url), title: f.name || f.title || 'Document' });
    }
  }, [onOpenDocumentEditor, onOpenSpreadsheetEditor, setPdfViewer, setSpreadsheetViewer]);

  const deleteTrainerFile = useCallback(async (file) => {
    if (!clientId || !file?.id || file.addedBy !== 'trainer') return;
    try {
      await deleteNotesAndFilesItem(clientId, file);
      onRefetchNotesAndFiles?.();
    } catch (e) {
      console.error('Trainer delete notes/file failed:', e);
      Alert.alert('Could not delete', e?.message || 'Please try again.');
    }
  }, [clientId, onRefetchNotesAndFiles]);

  return (
    <>
      <View style={{ marginHorizontal: -16 }}>
        <FilesNotesHeroCard
          isDark={isDark}
          fileCount={fileCount}
          newCount={newCount}
          headerLabel="Client workspace"
          headline={clientName ? `Notes & files · ${clientName}` : 'Client notes & files'}
          subhead="Uploads, coaching notes, and documents — the same library your client sees in the app."
          ctaLabel="Open notes & files"
          statSingular="item"
          statPlural="items"
          statSharedSuffix="in workspace"
          onPress={() => setWorkspaceOpen(true)}
        />
      </View>
      <Modal visible={workspaceOpen} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setWorkspaceOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: sheetBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            <TouchableOpacity onPress={() => setWorkspaceOpen(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={26} color={headerColor} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: headerColor, letterSpacing: -0.35 }}>Notes & Files</Text>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 56 }}
          >
            <FilesNotesSectionPremium
              audience="trainer"
              clientName={clientName}
              items={items}
              trainerDocuments={trainerDocuments}
              isDark={isDark}
              onOpenItem={openItem}
              onDownloadItem={openItem}
              onShareItem={(x) => {
                if (!x?.url) return;
                Share.share({ message: `${x?.name || x?.title || 'File'}\n${x.url}` }).catch(() => {});
              }}
              onDeleteItem={deleteTrainerFile}
              onUploadPress={() => setShowAddModal(true)}
              uploadLabel="Add note or file"
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <AddNotesFilesModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => { onRefetchNotesAndFiles?.(); setShowAddModal(false); }}
        isDark={isDark}
        clientId={clientId}
        addedBy="trainer"
        onNewDocument={() => onOpenDocumentEditor?.({})}
        onNewSpreadsheet={() => onOpenDocumentEditor?.({ type: 'spreadsheet' })}
        onImportSpreadsheet={() => onOpenDocumentEditor?.({ type: 'spreadsheet' })}
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
        visible={embedViewer.visible}
        uri={embedViewer.uri}
        title={embedViewer.title}
        isDark={isDark}
        onClose={() => setEmbedViewer({ visible: false, uri: null, title: null })}
      />
    </>
  );
};

// ─────────────────────────────────────────────
// TAB PILLS
// ─────────────────────────────────────────────
const TABS = ['Progress', 'Nutrition', 'Sessions', 'Notes & Files'];

const TabPills = ({ activeTab, onTabChange, isDark }) => {
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(10,10,15,0.55)';
  const activeTextColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const cardBorder = isDark ? CARD_BORDER_PURPLE_CYAN : 'rgba(10,10,15,0.10)';
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
      {TABS.map((tab) => {
        const isActive = tab === activeTab;
        if (isActive) {
          return (
            <TouchableOpacity
              key={tab}
              style={{
                flex: 1,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.06)',
              }}
              onPress={() => onTabChange(tab)}
              activeOpacity={0.9}
            >
              <Text
                style={{ color: activeTextColor, fontSize: 11, fontWeight: '800' }}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          );
        }
        return (
          <TouchableOpacity
            key={tab}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: cardBg, borderColor: cardBorder }}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.8}
          >
            <Text style={{ color: mutedColor, fontSize: 11, fontWeight: '600' }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{tab}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export {
  SCREEN_WIDTH,
  PURPLE,
  PINK,
  ORANGE,
  CYAN,
  ICON_ACCENT,
  ACCENT,
  GRADIENT_CTA,
  GRADIENT_BORDER_CARD,
  GRADIENT_TABS,
  CARD_BORDER_PURPLE_CYAN,
  CARD_BORDER_PROGRESS,
  CARD_BORDER_NUTRITION,
  CARD_BORDER_CALENDAR,
  CARD_BORDER_NOTES,
  CARD_BORDER_PINK_ORANGE,
  PROGRESS_VALUE_WEIGHT,
  PROGRESS_VALUE_SLEEP,
  PROGRESS_VALUE_WATER,
  PROGRESS_VALUE_WORKOUT,
  PROGRESS_VALUE_ENERGY,
  PROGRESS_VALUE_STRESS,
  PROGRESS_VALUE_MOOD,
  PROGRESS_VALUE_SORENESS,
  PROGRESS_VALUE_STEPS,
  PROGRESS_VALUE_BODYFAT,
  PROGRESS_VALUE_DAY,
  hexToRgbTriple,
  GRADIENT_NUTRITION_PROTEIN,
  GRADIENT_NUTRITION_CARBS,
  GRADIENT_NUTRITION_FAT,
  GRADIENT_CALENDAR,
  GRADIENT_NOTES,
  GRADIENT_HERO,
  GRADIENT_AVATAR,
  GRADIENT_USERNAME,
  GRADIENT_BG_DARK,
  GRADIENT_BG_LIGHT,
  Icon,
  TrainerStylesContext,
  TrainerStylesProvider,
  useTrainerTheme,
  GlassCard,
  GradientText,
  AuroraHeroBanner,
  ArcProgress,
  BorderedCard,
  getClientInitials,
  formatClientHeightDisplay,
  getClientSubtext,
  getClientRosterStats,
  PremiumTabEmptyState,
  EmptyState,
  CategoryCard,
  getTrainerDashboardLottieSource,
  getTrainerDashboardLottieCaption,
  LOTTIE_FOOD_AROUND_CITY,
  TrainerNotesFilesHeroAndWorkspace,
  TABS,
  TabPills,
};
