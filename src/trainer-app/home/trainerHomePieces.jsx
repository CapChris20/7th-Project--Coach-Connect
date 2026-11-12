// Shared trainer-home UI pieces: empty-state Lotties, color helpers, cards used by TrainerHomeContent.
// Flow: pick a Lottie/caption → paint accent colors → render dashboard cards.
// Used by TrainerHomeContent and related trainer home popups.
//
// vocab: NbCard / NbButton / NbAvatar = neobrutalist shells; GlassCard export kept as NbCard wrapper for callers.

import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import BaseColorText from '../../look-and-feel/ColorText';
import Svg, { Path } from 'react-native-svg';
import LottieView from 'lottie-react-native';
import HomeTopBannerBase from '../../for-both/home-cards/HomeTopBanner';
import FilesSection from '../../for-both/files-and-notes/viewers/FilesSection';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
import PhotoVideoViewer from '../../for-both/files-and-notes/viewers/PhotoVideoViewer';
import WebPageViewer from '../../for-both/files-and-notes/viewers/WebPageViewer';
import { deleteNotesAndFilesItem } from '../../for-both/files-and-notes/saveNotesAndFiles';
import {
  isImageFile as isNotesImageFile,
  isVideoFile as isNotesVideoFile,
  isPdfFile as isNotesPdfFile,
  getEmbedViewerUri,
} from '../../helpers/whichViewerForFile';
import { Dimensions } from 'react-native';
import { useTheme as useGlobalTheme } from '../../look-and-feel/lightDarkMode';
import { lightColors, darkColors, gradients, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';
import { ChevronRight } from 'lucide-react-native';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';

const ICON_NOTES_DOC = require('../../assets/icons/handoff/checkin.png');
const ICON_NOTES_SHEET = require('../../assets/icons/handoff/week.png');
const ICON_NOTES_MEDIA = require('../../assets/icons/handoff/picture.png');
const NOTES_INLINE_LIMIT = 4;

// ===== NAMED CONSTANTS =====

const LOTTIE_WELLNESS_SORENESS_EMPTY = require('../../assets/sad reaction.json');
const LOTTIE_WELLNESS_ENERGY_EMPTY = require('../../assets/Run Hamster... run.json');
const LOTTIE_WELLNESS_STRESS_EMPTY = require('../../assets/Stressed Employee At Work.json');
const LOTTIE_STEPS_EMPTY = require('../../for-both/assets/Walking steps.json');
const LOTTIE_MOOD_EMPTY = require('../../for-both/assets/Happy SUN.json');
const LOTTIE_FOOD_AROUND_CITY = require('../../assets/animations/legacy/food around the city.json');

// ===== HELPER FUNCTIONS =====

function getTrainerDashboardLottieSource(lottieType) {
  switch (lottieType) {
    case 'steps':
      return LOTTIE_STEPS_EMPTY;
    case 'water':
      return require('../../assets/animations/legacy/glass water.json');
    case 'sleep':
      return require('../../assets/animations/legacy/sleep.json');
    case 'boxer':
      return require('../../assets/animations/legacy/boxer lottie.json');
    case 'nutrition_empty':
    case 'food':
      return require('../../assets/animations/legacy/Food squeeze_With Burger and hot dog.json');
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
  const hexDigits = String(hex || '').replace('#', '').trim();
  if (hexDigits.length !== 6) return '255, 107, 157';
  const red = parseInt(hexDigits.slice(0, 2), 16);
  const green = parseInt(hexDigits.slice(2, 4), 16);
  const blue = parseInt(hexDigits.slice(4, 6), 16);
  if ([red, green, blue].some((channel) => Number.isNaN(channel))) return '255, 107, 157';
  return `${red}, ${green}, ${blue}`;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
// YOUR COLOR SYSTEM: #E25588 #FF6B9D #F97316 #06B6D4 — different combo per section
// ─────────────────────────────────────────────
const PURPLE = '#E25588';
const PINK = lightColors.primary;
const ORANGE = '#F97316';
const CYAN = '#06B6D4';

const GRADIENT_BG_DARK = [darkColors.nbBackground, darkColors.nbSurface, darkColors.nbBackground];
const GRADIENT_BG_LIGHT = [lightColors.nbBackground, lightColors.nbSurface, lightColors.nbBackground];

// Brand / status gradients from the shared nb palette (DESIGN.md)
const GRADIENT_HERO = gradients.brand.colors;
const GRADIENT_AVATAR = gradients.brand.colors;
const GRADIENT_USERNAME = gradients.title.light.colors;
const GRADIENT_TABS = gradients.ink.colors;
const GRADIENT_BORDER_CARD = gradients.brand.colors;
const GRADIENT_WEIGHT = gradients.brand.colors;
const GRADIENT_SLEEP = gradients.sleep.colors;
const GRADIENT_WATER = gradients.water.colors;
const GRADIENT_WORKOUT = gradients.energy.colors;
const GRADIENT_CTA = gradients.brand.colors;
const GRADIENT_CALENDAR = gradients.ink.colors;
const GRADIENT_NOTES = gradients.soft.colors;

const ACCENT = GRADIENT_CTA;
const BORDER_GRADIENT = GRADIENT_BORDER_CARD;

// Single colors for arcs / icons / badge
const GRADIENT_NUTRITION_PROTEIN = PURPLE;
const GRADIENT_NUTRITION_CARBS = CYAN;
const GRADIENT_NUTRITION_FAT = PINK;
const BADGE_COLOR = PINK;
const ICON_ACCENT = PURPLE;

// Progress tab VALUE text only — soft combos (not neon), one per card
const S_P = '#FB7185';   // soft purple
const S_K = '#E8799A';   // soft pink
const S_O = lightColors.accent;   // soft orange
const S_C = '#0D9488';   // soft teal
// Daily metric big numbers — distinct combos (dark pink / dark orange / gray); avoid one hue for all
const D_PINK_DEEP = '#9F1239';
const D_PINK_MID = lightColors.primaryDark;
const D_ORANGE_DEEP = '#9A3412';
const D_ORANGE_SOFT = lightColors.accent;
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
// GLASS CARD — kept export name for Progress/Nutrition callers; now an NbCard shell.
// borderVariant is ignored (nb uses one border token); isDark comes from NbCard's color scheme.
// ─────────────────────────────────────────────
const GlassCard = ({ children, style, isDark: _isDark, borderVariant: _borderVariant }) => (
  <NbCard style={style}>{children}</NbCard>
);

// ─────────────────────────────────────────────
// GRADIENT TEXT
// ─────────────────────────────────────────────
const ColorText = ({ children, style, colors = ACCENT }) => (
  <BaseColorText style={style} colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
    {children}
  </BaseColorText>
);

// Hero banner: Welcome message + logo gradient + daily quote pill.
const HomeTopBanner = ({ isDark, timeOfDay, userName, textColor, userId }) => (
  <HomeTopBannerBase
    isDark={isDark}
    userId={userId}
    userName={userName}
    greetingPeriod={timeOfDay}
    textColor={textColor}
    showLiveClock
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
  const palette = isDark ? darkColors : lightColors;
  const trackStroke = isDark ? 'rgba(243,238,255,0.16)' : 'rgba(10,10,15,0.12)';
  return (
    <NbCard style={{ alignItems: 'center', padding: 12 }}>
      <Svg width={90} height={55} viewBox="0 0 90 55">
        <Path d="M 9 50 A 36 36 0 0 1 81 50" fill="none" stroke={trackStroke} strokeWidth={6} strokeLinecap="round" />
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
      <Text style={{ color: palette.nbInk, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginTop: -6 }}>{value}{unit}</Text>
      <Text style={{ color: palette.nbMuted, fontSize: 12, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.1 }}>{label}</Text>
    </NbCard>
  );
};

// ─────────────────────────────────────────────
// BORDERED CARD (gradient border)
// ─────────────────────────────────────────────
const BorderedCard = ({ children, style, borderRadius: radiusProp, bordered: _bordered, isDark: _isDark }) => (
  // Design rule: no gradient card borders — NbCard is the single thick outline.
  <NbCard style={[style, radiusProp != null ? { borderRadius: radiusProp } : null]}>
    {children}
  </NbCard>
);

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
  const totalInches = typeof h === 'number' ? h : Number(String(h).replace(/[^0-9.]/g, ''));
  if (Number.isFinite(totalInches) && totalInches >= 36 && totalInches <= 96) {
    const total = Math.round(totalInches);
    return `${Math.floor(total / 12)}'${total % 12}"`;
  }
  return typeof h === 'string' && h.trim() ? h.trim() : null;
};

const resolveClientGoalRaw = (client) => {
  const raw =
    client?.primaryGoal ||
    client?.goal ||
    (Array.isArray(client?.goals) ? client.goals[0] : client?.goals) ||
    '';
  return String(raw).replace(/_/g, ' ').trim();
};

const getClientSubtext = (client) => {
  const parts = [];
  const goalLabel = resolveClientGoalRaw(client);
  if (goalLabel) parts.push(goalLabel);
  if (client.age) parts.push(`${client.age}y`);
  if (client.weight) parts.push(`${client.weight} lbs`);
  const heightLabel = formatClientHeightDisplay(client.height);
  if (heightLabel) parts.push(heightLabel);
  return parts.length ? parts.join(' · ') : '—';
};

/** Structured fields for roster “profile” cards (not the old one-line chip). */
const getClientRosterStats = (client) => {
  const rawGoal = resolveClientGoalRaw(client);
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
  const palette = isDark ? darkColors : lightColors;

  return (
    <NbCard style={{ paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center' }}>
      {lottieSource ? (
        <View
          style={{
            width: lottieSize,
            height: lottieSize,
            marginBottom: spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LottieView source={lottieSource} autoPlay loop style={{ width: '100%', height: '100%' }} />
        </View>
      ) : (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: borderRadius.nbHero,
            borderWidth: nb.borderWidth,
            borderColor: palette.nbBorder,
            backgroundColor: palette.nbSurfaceChip,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: spacing.md,
          }}
        >
          <Ionicons name={icon} size={28} color={palette.nbInk} />
        </View>
      )}

      <Text
        style={{
          color: palette.nbInk,
          fontSize: 17,
          fontFamily: 'SpaceGrotesk_700Bold',
          letterSpacing: -0.3,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: palette.nbMuted,
          fontSize: 13,
          fontFamily: 'Inter_500Medium',
          lineHeight: 19,
          textAlign: 'center',
          marginTop: spacing.sm,
          maxWidth: 280,
        }}
      >
        {subtitle}
      </Text>

      {hints.length > 0 ? (
        <View style={{ marginTop: 18, alignSelf: 'stretch', gap: spacing.sm }}>
          {hints.map((line) => (
            <View key={line} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  borderWidth: nb.borderWidth,
                  borderColor: palette.nbBorder,
                  backgroundColor: palette.nbSurfaceChip,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={12} color={palette.nbInk} />
              </View>
              <Text style={{ flex: 1, color: palette.nbMuted, fontSize: 12, fontFamily: 'Inter_600SemiBold', lineHeight: 16 }}>
                {line}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </NbCard>
  );
};

// ─────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────
const EmptyState = ({ icon, message, ctaLabel, onCta, isDark, lottieType, compact }) => {
  const palette = isDark ? darkColors : lightColors;
  const lottieSource = lottieType ? getTrainerDashboardLottieSource(lottieType) : null;
  const lottieCaption = lottieType ? getTrainerDashboardLottieCaption(lottieType) : null;
  const pad = compact ? 20 : 32;
  const gap = compact ? 8 : 12;
  const iconWrap = compact ? 44 : 52;

  return (
    <NbCard style={{ padding: pad, alignItems: 'center', gap }}>
      {lottieType && lottieSource ? (
        <>
          <LottieView
            source={lottieSource}
            autoPlay
            loop
            style={{ width: 100, height: 100 }}
          />
          <Text style={{ color: palette.nbMuted, fontSize: 14, textAlign: 'center', fontFamily: 'Inter_400Regular' }}>
            {lottieCaption ?? message}
          </Text>
        </>
      ) : (
        <View style={{
          width: iconWrap,
          height: iconWrap,
          borderRadius: iconWrap / 2,
          borderWidth: nb.borderWidth,
          borderColor: palette.nbBorder,
          backgroundColor: palette.nbSurfaceChip,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Icon name={icon} size={compact ? 20 : 24} color={palette.nbMuted} />
        </View>
      )}
      {(!lottieType || message) && (
        <Text style={{ color: palette.nbMuted, fontSize: compact ? 13 : 14, textAlign: 'center', lineHeight: compact ? 19 : 20, fontFamily: 'Inter_400Regular' }}>{message}</Text>
      )}
      {ctaLabel && onCta ? (
        <NbButton variant="brand" sm onPress={onCta}>
          {ctaLabel}
        </NbButton>
      ) : null}
    </NbCard>
  );
};

// ─────────────────────────────────────────────
// CATEGORY CARD — single metric, optional (only render if has value or show —)
// ─────────────────────────────────────────────
const CategoryCard = ({ title, value, unit, isDark, emptyLabel, gradient }) => {
  const palette = isDark ? darkColors : lightColors;
  const hasVal = value != null && value !== '';
  
  const getLottieForCategory = (categoryTitle) => {
    const titleLower = categoryTitle.toLowerCase();
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
    <NbCard style={{ padding: spacing.md, alignItems: 'center' }}>
      {hasVal ? (
        <>
          <ColorText colors={gradient || gradients.brand.colors} style={{ fontSize: 28, fontWeight: '800', fontFamily: 'SpaceGrotesk_700Bold' }}>{value}</ColorText>
          {unit ? <Text style={{ color: palette.nbMuted, fontSize: 12, marginTop: 2 }}>{unit}</Text> : null}
          <Text style={{ color: palette.nbMuted, fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>{getDisplayLabel()}</Text>
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
              <Text style={{ color: palette.nbMuted, fontSize: 13, fontStyle: 'italic', marginTop: 8 }}>
                {getTrainerDashboardLottieCaption(lottieType) ?? emptyLabel ?? 'No data'}
              </Text>
            </>
          ) : (
            <Text style={{ color: palette.nbMuted, fontSize: 13, fontStyle: 'italic' }}>{emptyLabel || 'No data'}</Text>
          )}
        </View>
      )}
    </NbCard>
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
  const palette = isDark ? darkColors : lightColors;
  const sheetBg = palette.nbBackground;
  const headerColor = palette.nbInk;

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

  // Design Law ct:f — compact inline rows under the pills (full workspace still available).
  const trainerDocs = Array.isArray(trainerDocuments) ? trainerDocuments : [];
  const previewRows = [...items, ...trainerDocs].slice(0, NOTES_INLINE_LIMIT);
  const clientNote = items.find(
    (row) =>
      (row?.type === 'note' || row?.kind === 'note' || !row?.url) &&
      String(row?.content || row?.text || row?.body || '').trim(),
  );

  const iconForNotesRow = (row, index) => {
    if (row?.type === 'spreadsheet') return ICON_NOTES_SHEET;
    if (row?.type === 'image' || row?.type === 'video' || isNotesImageFile(row) || isNotesVideoFile(row)) {
      return ICON_NOTES_MEDIA;
    }
    return index % 2 === 0 ? ICON_NOTES_DOC : ICON_NOTES_SHEET;
  };

  const subtitleForNotesRow = (row) => {
    if (row?.type === 'document') return 'Document · shared by you';
    if (row?.type === 'spreadsheet') return 'Spreadsheet · shared by you';
    if ((row?.addedBy || 'client') === 'client') {
      return clientName ? `Uploaded by ${clientName}` : 'Uploaded by client';
    }
    return 'Shared by you';
  };

  return (
    <>
      <View style={{ gap: 16, paddingTop: 4 }}>
        <NbCard style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
          {previewRows.length === 0 ? (
            <View style={{ paddingVertical: 16, gap: 6 }}>
              <Text style={{ color: palette.nbInk, fontSize: 16, fontWeight: '900' }}>No files yet</Text>
              <Text style={{ color: palette.nbMuted, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                Notes and files you share with {clientName || 'this client'} show up here.
              </Text>
            </View>
          ) : (
            previewRows.map((row, index) => (
              <TouchableOpacity
                key={row.id || row.documentId || `notes-${index}`}
                onPress={() => openItem(row)}
                activeOpacity={0.88}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  minHeight: 56,
                  paddingVertical: 10,
                  borderBottomWidth: index === previewRows.length - 1 ? 0 : 2,
                  borderBottomColor: palette.nbBorder,
                }}
              >
                <NbIconChip source={iconForNotesRow(row, index)} index={index} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: palette.nbInk, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
                    {row.name || row.title || 'Untitled'}
                  </Text>
                  <Text style={{ color: palette.nbMuted, fontSize: 13, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
                    {subtitleForNotesRow(row)}
                  </Text>
                </View>
                <ChevronRight size={18} color={palette.nbInk} strokeWidth={3} />
              </TouchableOpacity>
            ))
          )}
        </NbCard>

        {clientNote ? (
          <View
            style={{
              borderWidth: nb.borderWidth,
              borderColor: palette.nbBorder,
              borderRadius: 10,
              padding: 14,
              backgroundColor: palette.nbSurface,
            }}
          >
            <Text style={{ color: palette.nbInk, fontSize: 15, fontWeight: '900', marginBottom: 6 }}>
              {clientName ? `Note from ${clientName}` : 'Note from client'}
            </Text>
            <Text style={{ color: palette.nbMuted, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>
              {String(clientNote.content || clientNote.text || clientNote.body)}
            </Text>
          </View>
        ) : null}

        <NbButton variant="ghost" onPress={() => setWorkspaceOpen(true)}>
          {fileCount > 0 ? `Open all (${fileCount})` : 'Open notes & files'}
        </NbButton>
        <NbButton variant="fill" onPress={() => setShowAddModal(true)}>
          Add note or file
        </NbButton>
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
            <FilesSection
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

      <AddFilePopup
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
      <PhotoVideoViewer
        visible={mediaViewer.visible}
        url={mediaViewer.url}
        kind={mediaViewer.kind}
        name={mediaViewer.name}
        isDark={isDark}
        onClose={() => setMediaViewer({ visible: false, url: null, kind: 'image', name: null })}
      />
      <WebPageViewer
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
// Internal keys stay full; Design Law segment shows short “Notes” so labels never clip.
const TABS = ['Progress', 'Nutrition', 'Sessions', 'Notes & Files'];
const TAB_LABELS = {
  Progress: 'Progress',
  Nutrition: 'Nutrition',
  Sessions: 'Sessions',
  'Notes & Files': 'Notes',
};

const TabPills = ({ activeTab, onTabChange, isDark }) => {
  const palette = isDark ? darkColors : lightColors;
  return (
    <View
      style={{
        flexDirection: 'row',
        borderWidth: nb.borderWidth,
        borderColor: palette.nbBorder,
        borderRadius: borderRadius.nbChip,
        backgroundColor: palette.nbSurface,
        marginBottom: 12,
        overflow: 'hidden',
        minHeight: nb.minTouchTarget,
      }}
    >
      {TABS.map((tab, index) => {
        const isActive = tab === activeTab;
        const label = TAB_LABELS[tab] || tab;
        return (
          <TouchableOpacity
            key={tab}
            onPress={() => onTabChange(tab)}
            activeOpacity={0.88}
            style={{
              flex: 1,
              minHeight: nb.minTouchTarget,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 6,
              backgroundColor: isActive ? palette.nbFill : 'transparent',
              borderLeftWidth: index === 0 ? 0 : nb.borderWidth,
              borderLeftColor: palette.nbBorder,
            }}
          >
            <Text
              style={{
                color: isActive ? palette.nbOnFill : palette.nbInk,
                fontSize: 13,
                fontWeight: '800',
              }}
              numberOfLines={1}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ===== MAIN FUNCTION =====

// Barrel of trainer-home pieces and tokens — names frozen for TrainerHomeContent imports.
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
  ColorText,
  HomeTopBanner,
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
