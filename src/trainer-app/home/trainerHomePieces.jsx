// Shared trainer-home UI pieces: empty-state Lotties, color helpers, cards used by TrainerHomeContent.
// Flow: pick a Lottie/caption → paint accent colors → render dashboard cards.
// Used by TrainerHomeContent and related trainer home popups.
//
// vocab: NbCard / NbButton / NbAvatar = neobrutalist shells; GlassCard export kept as NbCard wrapper for callers.

import React, { useState, useMemo, useCallback, createContext, useContext, useEffect, useRef } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
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
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import { deleteNotesAndFilesItem } from '../../for-both/files-and-notes/saveNotesAndFiles';
import {
  isImageFile as isNotesImageFile,
  isVideoFile as isNotesVideoFile,
  isPdfFile as isNotesPdfFile,
  getEmbedViewerUri,
} from '../../helpers/whichViewerForFile';
import { useTheme as useGlobalTheme } from '../../look-and-feel/lightDarkMode';
import { lightColors, darkColors, gradients, nb, borderRadius, spacing } from '../../look-and-feel/colorPalette';
import { ChevronRight } from 'lucide-react-native';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';

// ===== NAMED CONSTANTS =====

const ICON_NOTES_DOC = require('../../assets/icons/handoff/checkin.png');
const ICON_NOTES_SHEET = require('../../assets/icons/handoff/week.png');
const ICON_NOTES_MEDIA = require('../../assets/icons/handoff/picture.png');

// Manipulate here: how many notes/files rows show under the pills before “Open all”
const NOTES_INLINE_LIMIT = 4;

const LOTTIE_WELLNESS_SORENESS_EMPTY = require('../../assets/sad reaction.json');
const LOTTIE_WELLNESS_ENERGY_EMPTY = require('../../assets/Run Hamster... run.json');
const LOTTIE_WELLNESS_STRESS_EMPTY = require('../../assets/Stressed Employee At Work.json');
const LOTTIE_STEPS_EMPTY = require('../../for-both/assets/Walking steps.json');
const LOTTIE_MOOD_EMPTY = require('../../for-both/assets/Happy SUN.json');
const LOTTIE_FOOD_AROUND_CITY = require('../../assets/animations/legacy/food around the city.json');

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Accent letters kept for barrel exports — chrome prefers nb ink/orange/cyan (never pink borders)
const PURPLE = '#64D2FF';
const PINK = '#F97316';
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
const S_P = '#FB7185';
const S_K = '#E8799A';
const S_O = lightColors.accent;
const S_C = '#0D9488';
// Daily metric big numbers — distinct combos; avoid one hue for all
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

// Card borders — Design Law: black/white/gray + orange accents only (never pink chrome)
const CARD_BORDER_PINK_ORANGE = 'rgba(249,115,22,0.28)';
const CARD_BORDER_PURPLE_CYAN = 'rgba(6,182,212,0.28)';
const CARD_BORDER_PROGRESS = 'rgba(100,210,255,0.22)';
const CARD_BORDER_NUTRITION = 'rgba(6,182,212,0.24)';
const CARD_BORDER_CALENDAR = 'rgba(249,115,22,0.22)';
const CARD_BORDER_NOTES = 'rgba(0,0,0,0.18)';
const CARD_BORDER_DEFAULT = 'rgba(255,255,255,0.1)';
const CARD_SHADOW_NEUTRAL = 'rgba(0,0,0,0.22)';

// Design Law segment tabs — full keys in state, short labels in the strip (Notes never clips).
const TABS = ['Progress', 'Nutrition', 'Sessions', 'Notes & Files'];
const TAB_LABELS = {
  Progress: 'Progress',
  Nutrition: 'Nutrition',
  Sessions: 'Sessions',
  'Notes & Files': 'Notes',
};

// ===== HELPER FUNCTIONS =====

/**
 * Lottie JSON for an empty dashboard metric by type key.
 * Lookup map keeps nesting shallow (no switch ladder).
 */
function getTrainerDashboardLottieSource(lottieType) {
  const sourceByType = {
    steps: LOTTIE_STEPS_EMPTY,
    water: require('../../assets/animations/legacy/glass water.json'),
    sleep: require('../../assets/animations/legacy/sleep.json'),
    boxer: require('../../assets/animations/legacy/boxer lottie.json'),
    nutrition_empty: require('../../assets/animations/legacy/Food squeeze_With Burger and hot dog.json'),
    food: require('../../assets/animations/legacy/Food squeeze_With Burger and hot dog.json'),
    soreness: LOTTIE_WELLNESS_SORENESS_EMPTY,
    energy: LOTTIE_WELLNESS_ENERGY_EMPTY,
    stress: LOTTIE_WELLNESS_STRESS_EMPTY,
    mood: LOTTIE_MOOD_EMPTY,
  };
  return sourceByType[lottieType] || null;
}

/**
 * Caption under an empty-state Lottie for that metric type.
 */
function getTrainerDashboardLottieCaption(lottieType) {
  const captionByType = {
    steps: 'Steps not logged yet',
    water: 'Water not logged yet',
    sleep: 'Sleep not logged yet',
    boxer: 'No workout logged yet',
    nutrition_empty: 'No nutrition data for this client yet',
    food: 'No meals logged yet',
    soreness: 'Soreness not logged yet',
    energy: 'Energy not logged yet',
    stress: 'Stress not logged yet',
    mood: 'Mood not logged yet',
  };
  return captionByType[lottieType] || null;
}

/**
 * Turn a hex like #64D2FF into "100, 210, 255" for rgba() strings.
 * Bad input falls back to a safe RGB triple.
 */
function hexToRgbTriple(hex) {
  const hexDigits = String(hex || '').replace('#', '').trim();
  if (hexDigits.length !== 6) return '255, 107, 157';

  const red = parseInt(hexDigits.slice(0, 2), 16);
  const green = parseInt(hexDigits.slice(2, 4), 16);
  const blue = parseInt(hexDigits.slice(4, 6), 16);
  const channelIsBad = [red, green, blue].some((channel) => Number.isNaN(channel));
  if (channelIsBad) return '10, 10, 10';

  return `${red}, ${green}, ${blue}`;
}

/**
 * Two-letter initials from a display name (avatar fallback).
 * @param {string} name
 * @returns {string}
 */
const getClientInitials = (name) => {
  if (!name || typeof name !== 'string') return '?';
  const words = name.split(' ');
  const firstLetters = [];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    if (word[0]) firstLetters.push(word[0]);
  }
  const joined = firstLetters.join('').toUpperCase();
  return joined.substring(0, 2) || '?';
};

/**
 * Roster / cards: show feet/inches; plain numbers are treated as total inches (legacy onboarding).
 * @param {*} heightValue
 * @returns {string|null}
 */
const formatClientHeightDisplay = (heightValue) => {
  if (heightValue == null || heightValue === '') return null;

  // Object shape from newer onboarding: { feet, inches }
  if (typeof heightValue === 'object' && heightValue && heightValue.feet != null) {
    const inch = Number(heightValue.inches) || 0;
    return `${heightValue.feet}'${inch}"`;
  }

  // Legacy: total inches as a number or numeric string.
  let totalInches;
  if (typeof heightValue === 'number') {
    totalInches = heightValue;
  } else {
    totalInches = Number(String(heightValue).replace(/[^0-9.]/g, ''));
  }

  const looksLikeTotalInches =
    Number.isFinite(totalInches) && totalInches >= 36 && totalInches <= 96;
  if (looksLikeTotalInches) {
    const total = Math.round(totalInches);
    return `${Math.floor(total / 12)}'${total % 12}"`;
  }

  if (typeof heightValue === 'string' && heightValue.trim()) {
    return heightValue.trim();
  }
  return null;
};

/**
 * Raw goal string from the many client goal fields (primaryGoal / goal / goals[0]).
 */
const resolveClientGoalRaw = (client) => {
  // Same precedence as before: primaryGoal → goal → goals[0] or goals string → ''.
  if (!client) {
    return '';
  }
  if (client.primaryGoal) {
    return String(client.primaryGoal).replace(/_/g, ' ').trim();
  }
  if (client.goal) {
    return String(client.goal).replace(/_/g, ' ').trim();
  }
  if (Array.isArray(client.goals) && client.goals.length > 0) {
    return String(client.goals[0] || '').replace(/_/g, ' ').trim();
  }
  if (client.goals) {
    return String(client.goals).replace(/_/g, ' ').trim();
  }
  return '';
};

/**
 * One-line “goal · age · weight · height” under a client name.
 * @param {object} client
 * @returns {string}
 */
const getClientSubtext = (client) => {
  const parts = [];
  const goalLabel = resolveClientGoalRaw(client);
  if (goalLabel) parts.push(goalLabel);
  if (client.age) parts.push(`${client.age}y`);
  if (client.weight) parts.push(`${client.weight} lbs`);
  const heightLabel = formatClientHeightDisplay(client.height);
  if (heightLabel) parts.push(heightLabel);
  if (parts.length) return parts.join(' · ');
  return '—';
};

/**
 * Structured fields for roster “profile” cards (not the old one-line chip).
 * @param {object} client
 * @returns {{ goal: string|null, age: string|null, weight: string|null, height: string|null }}
 */
const getClientRosterStats = (client) => {
  const rawGoal = resolveClientGoalRaw(client);
  let goal = null;
  if (rawGoal.length > 0) {
    goal = rawGoal.replace(/\b\w/g, (character) => character.toUpperCase());
  }

  let age = null;
  if (client.age != null && client.age !== '') {
    age = String(client.age);
  }

  let weight = null;
  if (client.weight != null && client.weight !== '') {
    weight = String(client.weight);
  }

  return {
    goal,
    age,
    weight,
    height: formatClientHeightDisplay(client.height),
  };
};

/**
 * Pick the empty-state Lottie type from a category card title.
 */
function lottieTypeForCategoryTitle(categoryTitle) {
  const titleLower = String(categoryTitle || '').toLowerCase();
  if (titleLower.includes('soreness')) return 'soreness';
  if (titleLower.includes('energy')) return 'energy';
  if (titleLower.includes('stress')) return 'stress';
  if (titleLower.includes('mood')) return 'mood';
  if (titleLower.includes('steps')) return 'steps';
  if (titleLower.includes('sleep')) return 'sleep';
  if (titleLower.includes('water')) return 'water';
  if (titleLower.includes('workout') || titleLower.includes('training')) return 'boxer';
  return null;
}

/**
 * Caption under a filled metric value (not the empty Lottie caption).
 */
function filledCategoryCaption(categoryTitle) {
  const titleLower = String(categoryTitle || '').toLowerCase();
  if (titleLower.includes('energy')) return 'Energy level';
  if (titleLower.includes('steps')) return 'Steps today';
  if (titleLower.includes('body fat')) return 'Body fat';
  if (titleLower.includes('soreness')) return 'Soreness level';
  if (titleLower.includes('stress')) return 'Stress level';
  if (titleLower.includes('mood')) return 'Mood';
  if (titleLower.includes('sleep')) return 'Sleep hours';
  if (titleLower.includes('water')) return 'Water intake';
  if (titleLower.includes('workout') || titleLower.includes('training')) return 'Workout';
  return categoryTitle;
}

/**
 * Icon source for one inline notes/files preview row.
 */
function iconForNotesRow(row, index) {
  const rowType = row && row.type;
  if (rowType === 'spreadsheet') return ICON_NOTES_SHEET;
  const isMedia =
    rowType === 'image' ||
    rowType === 'video' ||
    isNotesImageFile(row) ||
    isNotesVideoFile(row);
  if (isMedia) return ICON_NOTES_MEDIA;
  if (index % 2 === 0) return ICON_NOTES_DOC;
  return ICON_NOTES_SHEET;
}

/**
 * Subtitle under a notes/files preview row title.
 */
function subtitleForNotesRow(row, clientName) {
  const rowType = row && row.type;
  if (rowType === 'document') return 'Document · shared by you';
  if (rowType === 'spreadsheet') return 'Spreadsheet · shared by you';
  let addedBy = 'client';
  if (row && row.addedBy) {
    addedBy = row.addedBy;
  }
  const addedByClient = addedBy === 'client';
  if (addedByClient) {
    if (clientName) return `Uploaded by ${clientName}`;
    return 'Uploaded by client';
  }
  return 'Shared by you';
}

function extractNoteBody(row) {
  if (!row) return '';
  const noteSource = row.content || row.text || row.body || '';
  return String(noteSource).trim();
}

/**
 * First client text note in the notesAndFiles list (for the home preview card).
 */
function findFirstClientNote(items) {
  if (!Array.isArray(items)) return null;
  for (let index = 0; index < items.length; index += 1) {
    const row = items[index];
    const rowType = row && row.type;
    const rowKind = row && row.kind;
    const rowUrl = row && row.url;
    const looksLikeNote = rowType === 'note' || rowKind === 'note' || !rowUrl;
    const noteBody = extractNoteBody(row);
    if (looksLikeNote && noteBody) {
      return row;
    }
  }
  return null;
}

// ===== THEME CONTEXT =====

const TrainerStylesContext = createContext();

const TrainerStylesProvider = ({ children }) => {
  const { isDark } = useGlobalTheme();
  return (
    <TrainerStylesContext.Provider value={{ isDark }}>
      {children}
    </TrainerStylesContext.Provider>
  );
};

/**
 * Prefer local trainer theme context; fall back to the global light/dark hook.
 */
const useTrainerTheme = () => {
  const trainerThemeFromContext = useContext(TrainerStylesContext);
  const { isDark: globalIsDark } = useGlobalTheme();
  if (trainerThemeFromContext) {
    return trainerThemeFromContext;
  }
  return { isDark: globalIsDark };
};

// ===== SHARED CHROME =====

/**
 * GlassCard export name kept for Progress/Nutrition callers; now an NbCard shell.
 * borderVariant is ignored (nb uses one border token); isDark comes from NbCard's color scheme.
 */
const GlassCard = ({ children, style, isDark: _isDark, borderVariant: _borderVariant }) => (
  <NbCard style={style}>{children}</NbCard>
);

const ColorText = ({ children, style, colors = ACCENT }) => (
  <BaseColorText style={style} colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
    {children}
  </BaseColorText>
);

/**
 * Hero banner: welcome message + logo gradient + daily quote pill.
 */
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

/**
 * Semi-circle progress for nutrition macros (protein / carbs / fat).
 */
const ArcProgress = ({ value, goal, label, color, isDark, unit = 'g' }) => {
  let percentFilled = 0;
  if (goal > 0) {
    percentFilled = Math.min((value / goal) * 100, 100);
  }

  // Manipulate here: arc radius / stroke width for the SVG ring
  const radius = 36;
  const circumference = Math.PI * radius;
  const offset = circumference - (percentFilled / 100) * circumference;
  const palette = isDark ? darkColors : lightColors;
  const trackStroke = isDark ? 'rgba(243,238,255,0.16)' : 'rgba(10,10,15,0.12)';
  const valueLabel = `${value}${unit}`;

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
      <Text style={{ color: palette.nbInk, fontSize: 18, fontFamily: 'SpaceGrotesk_700Bold', marginTop: -6 }}>
        {valueLabel}
      </Text>
      <Text
        style={{
          color: palette.nbMuted,
          fontSize: 12,
          marginTop: 2,
          textTransform: 'uppercase',
          letterSpacing: 0.1,
        }}
      >
        {label}
      </Text>
    </NbCard>
  );
};

/**
 * Bordered card — Design rule: no gradient card borders; NbCard is the single thick outline.
 */
const BorderedCard = ({ children, style, borderRadius: radiusProp, bordered: _bordered, isDark: _isDark }) => (
  <NbCard style={[style, radiusProp != null ? { borderRadius: radiusProp } : null]}>
    {children}
  </NbCard>
);

/**
 * Four-segment tab strip under the selected client (Progress / Nutrition / Sessions / Notes).
 */
const TabPills = ({ activeTab, onTabChange, isDark }) => {
  const palette = isDark ? darkColors : lightColors;
  const tabElements = [];

  for (let index = 0; index < TABS.length; index += 1) {
    const tab = TABS[index];
    const isActive = tab === activeTab;
    const label = TAB_LABELS[tab] || tab;
    const leftBorderWidth = index === 0 ? 0 : nb.borderWidth;
    let backgroundColor = 'transparent';
    let textColor = palette.nbInk;
    if (isActive) {
      backgroundColor = palette.nbFill;
      textColor = palette.nbOnFill;
    }

    tabElements.push(
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
          backgroundColor,
          borderLeftWidth: leftBorderWidth,
          borderLeftColor: palette.nbBorder,
        }}
      >
        <Text
          style={{
            color: textColor,
            fontSize: 13,
            fontWeight: '800',
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </TouchableOpacity>,
    );
  }

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
      {tabElements}
    </View>
  );
};

/**
 * Lottie or icon badge at the top of a premium empty state.
 */
function premiumEmptyStateMedia({ lottieSource, lottieSize, icon, palette }) {
  if (lottieSource) {
    return (
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
    );
  }
  return (
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
  );
}

/**
 * Optional checklist under the empty-state subtitle.
 */
function premiumEmptyStateHintsBlock(hints, palette) {
  if (!hints.length) {
    return null;
  }
  const hintRows = [];
  for (let index = 0; index < hints.length; index += 1) {
    const line = hints[index];
    hintRows.push(
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
      </View>,
    );
  }
  return <View style={{ marginTop: 18, alignSelf: 'stretch', gap: spacing.sm }}>{hintRows}</View>;
}

/**
 * Premium empty state for a whole tab (Lottie or icon + title + optional hint rows).
 */
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
  const mediaElement = premiumEmptyStateMedia({ lottieSource, lottieSize, icon, palette });
  const hintsBlock = premiumEmptyStateHintsBlock(hints, palette);

  return (
    <NbCard style={{ paddingVertical: 28, paddingHorizontal: 22, alignItems: 'center' }}>
      {mediaElement}
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
      {hintsBlock}
    </NbCard>
  );
};

/**
 * Compact empty state for one metric card (Lottie or icon + optional CTA).
 */
const EmptyState = ({ icon, message, ctaLabel, onCta, isDark, lottieType, compact }) => {
  const palette = isDark ? darkColors : lightColors;
  const lottieSource = lottieType ? getTrainerDashboardLottieSource(lottieType) : null;
  const lottieCaption = lottieType ? getTrainerDashboardLottieCaption(lottieType) : null;

  // Manipulate here: compact padding for dense Progress grids
  const pad = compact ? 20 : 32;
  const gap = compact ? 8 : 12;
  const iconWrap = compact ? 44 : 52;
  const showLottie = !!(lottieType && lottieSource);
  const showMessageUnderIcon = !lottieType || !!message;

  let captionUnderLottie = message;
  if (lottieCaption != null) {
    captionUnderLottie = lottieCaption;
  }

  let mediaBlock;
  if (showLottie) {
    mediaBlock = (
      <>
        <LottieView source={lottieSource} autoPlay loop style={{ width: 100, height: 100 }} />
        <Text style={{ color: palette.nbMuted, fontSize: 14, textAlign: 'center', fontFamily: 'Inter_400Regular' }}>
          {captionUnderLottie}
        </Text>
      </>
    );
  } else {
    mediaBlock = (
      <View
        style={{
          width: iconWrap,
          height: iconWrap,
          borderRadius: iconWrap / 2,
          borderWidth: nb.borderWidth,
          borderColor: palette.nbBorder,
          backgroundColor: palette.nbSurfaceChip,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={icon} size={compact ? 20 : 24} color={palette.nbMuted} />
      </View>
    );
  }

  let messageElement = null;
  if (showMessageUnderIcon) {
    messageElement = (
      <Text
        style={{
          color: palette.nbMuted,
          fontSize: compact ? 13 : 14,
          textAlign: 'center',
          lineHeight: compact ? 19 : 20,
          fontFamily: 'Inter_400Regular',
        }}
      >
        {message}
      </Text>
    );
  }

  let ctaElement = null;
  if (ctaLabel && onCta) {
    ctaElement = (
      <NbButton variant="brand" sm onPress={onCta}>
        {ctaLabel}
      </NbButton>
    );
  }

  return (
    <NbCard style={{ padding: pad, alignItems: 'center', gap }}>
      {mediaBlock}
      {messageElement}
      {ctaElement}
    </NbCard>
  );
};

/**
 * Single metric card — shows a value or a Lottie empty state.
 */
const CategoryCard = ({ title, value, unit, isDark, emptyLabel, gradient }) => {
  const palette = isDark ? darkColors : lightColors;
  const hasValue = value != null && value !== '';
  const lottieType = lottieTypeForCategoryTitle(title);
  const lottieSource = lottieType ? getTrainerDashboardLottieSource(lottieType) : null;
  const valueCaption = hasValue ? filledCategoryCaption(title) : null;
  const emptyCaption =
    (lottieType && getTrainerDashboardLottieCaption(lottieType)) || emptyLabel || 'No data';
  const gradientColors = gradient || gradients.brand.colors;

  let body;
  if (hasValue) {
    let unitElement = null;
    if (unit) {
      unitElement = <Text style={{ color: palette.nbMuted, fontSize: 12, marginTop: 2 }}>{unit}</Text>;
    }
    body = (
      <>
        <ColorText
          colors={gradientColors}
          style={{ fontSize: 28, fontWeight: '800', fontFamily: 'SpaceGrotesk_700Bold' }}
        >
          {value}
        </ColorText>
        {unitElement}
        <Text style={{ color: palette.nbMuted, fontSize: 12, marginTop: 2, fontStyle: 'italic' }}>
          {valueCaption}
        </Text>
      </>
    );
  } else if (lottieType && lottieSource) {
    body = (
      <View style={{ alignItems: 'center' }}>
        <LottieView source={lottieSource} autoPlay loop style={{ width: 100, height: 100 }} />
        <Text style={{ color: palette.nbMuted, fontSize: 13, fontStyle: 'italic', marginTop: 8 }}>
          {emptyCaption}
        </Text>
      </View>
    );
  } else {
    body = (
      <View style={{ alignItems: 'center' }}>
        <Text style={{ color: palette.nbMuted, fontSize: 13, fontStyle: 'italic' }}>
          {emptyLabel || 'No data'}
        </Text>
      </View>
    );
  }

  return <NbCard style={{ padding: spacing.md, alignItems: 'center' }}>{body}</NbCard>;
};

// ===== MAIN FUNCTION =====
// Notes & Files hero + workspace is the heaviest story in this file; smaller chrome lives above.

/**
 * Compact preview list under the Notes & Files hero (or empty copy when none).
 */
function buildNotesPreviewBody(previewRows, palette, clientName, openItem) {
  if (previewRows.length === 0) {
    return (
      <View style={{ paddingVertical: 16, gap: 6 }}>
        <Text style={{ color: palette.nbInk, fontSize: 16, fontWeight: '900' }}>No files yet</Text>
        <Text style={{ color: palette.nbMuted, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
          Notes and files you share with {clientName || 'this client'} show up here.
        </Text>
      </View>
    );
  }

  const previewRowElements = [];
  for (let index = 0; index < previewRows.length; index += 1) {
    const row = previewRows[index];
    const rowKey = row.id || row.documentId || `notes-${index}`;
    const bottomBorderWidth = index === previewRows.length - 1 ? 0 : 2;
    previewRowElements.push(
      <TouchableOpacity
        key={rowKey}
        onPress={() => openItem(row)}
        activeOpacity={0.88}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 56,
          paddingVertical: 10,
          borderBottomWidth: bottomBorderWidth,
          borderBottomColor: palette.nbBorder,
        }}
      >
        <NbIconChip source={iconForNotesRow(row, index)} index={index} size={40} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: palette.nbInk, fontSize: 16, fontWeight: '800' }} numberOfLines={1}>
            {row.name || row.title || 'Untitled'}
          </Text>
          <Text style={{ color: palette.nbMuted, fontSize: 13, fontWeight: '600', marginTop: 2 }} numberOfLines={1}>
            {subtitleForNotesRow(row, clientName)}
          </Text>
        </View>
        <ChevronRight size={18} color={palette.nbInk} strokeWidth={3} />
      </TouchableOpacity>,
    );
  }
  return previewRowElements;
}

/**
 * Optional “Note from {client}” card under the preview list.
 */
function buildClientNoteCard(clientNote, noteFromLabel, palette) {
  if (!clientNote) {
    return null;
  }
  const noteBodyText = String(clientNote.content || clientNote.text || clientNote.body);
  return (
    <View
      style={{
        borderWidth: nb.borderWidth,
        borderColor: palette.nbBorder,
        borderRadius: 10,
        padding: 14,
        backgroundColor: palette.nbSurface,
      }}
    >
      <Text
        style={{
          color: palette.nbMuted,
          fontSize: 11,
          fontWeight: '800',
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {noteFromLabel}
      </Text>
      <Text style={{ color: palette.nbInk, fontSize: 14, fontWeight: '600', lineHeight: 20 }}>
        {noteBodyText}
      </Text>
    </View>
  );
}

/**
 * Count unread client-uploaded files for the eyebrow (“· N new”).
 */
function countUnreadClientUploads(items) {
  let newCount = 0;
  for (let index = 0; index < items.length; index += 1) {
    const row = items[index];
    const addedByClient = (row.addedBy || 'client') === 'client';
    const isUnread = row.isRead !== true;
    if (addedByClient && isUnread) {
      newCount += 1;
    }
  }
  return newCount;
}

/**
 * Hero card → full-screen workspace (matches client home Notes & Files flow).
 * Hook order frozen: workspace → add modal → media → embed → notice → openItem → delete.
 */
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
  onOpenSpreadsheetEditor,
  onOpenShareModal,
}) => {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [mediaViewer, setMediaViewer] = useState({ visible: false, url: null, kind: 'image', name: null });
  const [embedViewer, setEmbedViewer] = useState({ visible: false, uri: null, title: null });
  // vocab: notice = NbNoticeSheet payload — Design Law sheets instead of Alert.alert
  const [notice, setNotice] = useState(null);

  let items = [];
  if (clientData && clientData.notesAndFiles) {
    items = clientData.notesAndFiles;
  }
  const trainerDocs = Array.isArray(trainerDocuments) ? trainerDocuments : [];
  const fileCount = items.length + trainerDocs.length;
  const newCount = countUnreadClientUploads(items);

  const palette = isDark ? darkColors : lightColors;
  const sheetBg = palette.nbBackground;
  const headerColor = palette.nbInk;

  /**
   * Open one notes/files row in the right viewer.
   * Flow: 1. spreadsheet  2. rich doc  3. image/video  4. pdf  5. generic embed
   */
  const openItem = useCallback((fileRow) => {
    if (!fileRow) return;

    const isSpreadsheet = fileRow.type === 'spreadsheet';
    const isDoc = fileRow.type === 'document';

    // 1. Spreadsheet document → in-app SpreadsheetEditor or file viewer.
    if (isSpreadsheet) {
      if (onOpenSpreadsheetEditor && (fileRow.documentId || !fileRow.url)) {
        onOpenSpreadsheetEditor(fileRow);
        return;
      }
      if (setSpreadsheetViewer && fileRow.url) {
        setSpreadsheetViewer({ visible: true, url: fileRow.url, name: fileRow.name || 'Spreadsheet' });
        return;
      }
    }

    // 2. Rich-text document → parent DocumentEditor.
    if (isDoc && onOpenDocumentEditor) {
      onOpenDocumentEditor(fileRow);
      return;
    }

    // 3. Image / video → PhotoVideoViewer.
    if (fileRow.url && isNotesImageFile(fileRow)) {
      setMediaViewer({
        visible: true,
        url: fileRow.url,
        kind: 'image',
        name: fileRow.name || fileRow.title || 'Photo',
      });
      return;
    }
    if (fileRow.url && isNotesVideoFile(fileRow)) {
      setMediaViewer({
        visible: true,
        url: fileRow.url,
        kind: 'video',
        name: fileRow.name || fileRow.title || 'Video',
      });
      return;
    }

    // 4. PDF → parent pdf viewer.
    if (fileRow.url && isNotesPdfFile(fileRow, fileRow.url)) {
      setPdfViewer({ visible: true, url: fileRow.url, name: fileRow.name || 'Document' });
      return;
    }

    // 5. Anything else with a URL → WebPageViewer embed.
    if (fileRow.url) {
      setEmbedViewer({
        visible: true,
        uri: getEmbedViewerUri(fileRow, fileRow.url),
        title: fileRow.name || fileRow.title || 'Document',
      });
    }
  }, [onOpenDocumentEditor, onOpenSpreadsheetEditor, setPdfViewer, setSpreadsheetViewer]);

  /**
   * Delete a trainer-owned notes/files row, then refetch.
   * Flow: 1. guard  2. Firestore delete  3. refetch or notice
   */
  const deleteTrainerFile = useCallback(async (file) => {
    // 1. Only trainer-added rows with an id can be deleted from here.
    if (!clientId || !file || !file.id || file.addedBy !== 'trainer') return;

    try {
      // 2. Remove the row from the client’s notesAndFiles collection.
      await deleteNotesAndFilesItem(clientId, file);
      // 3. Refresh the parent list.
      if (onRefetchNotesAndFiles) {
        onRefetchNotesAndFiles();
      }
    } catch (deleteError) {
      console.error('Trainer delete notes/file failed:', deleteError);
      let deleteMessage = 'Please try again.';
      if (deleteError && deleteError.message) {
        deleteMessage = deleteError.message;
      }
      setNotice({ title: 'Could not delete', message: deleteMessage });
    }
  }, [clientId, onRefetchNotesAndFiles]);

  // Design Law ct:f — compact inline rows under the pills (full workspace still available).
  const previewRows = [...items, ...trainerDocs].slice(0, NOTES_INLINE_LIMIT);
  const clientNote = findFirstClientNote(items);

  // Named locals for the hero JSX.
  let eyebrowText = `Shared with ${clientName || 'client'}`;
  if (newCount > 0) {
    eyebrowText = `${eyebrowText} · ${newCount} new`;
  }
  const openAllLabel = fileCount > 0 ? `Open all (${fileCount})` : 'Open notes & files';
  const noteFromLabel = clientName ? `Note from ${clientName}` : 'Note from client';
  const noticeIsVisible = !!notice;
  const previewBody = buildNotesPreviewBody(previewRows, palette, clientName, openItem);
  const clientNoteCard = buildClientNoteCard(clientNote, noteFromLabel, palette);

  return (
    <>
      <View style={{ gap: 16, paddingTop: 4 }}>
        <Text
          style={{
            color: palette.nbMuted,
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 0.7,
            textTransform: 'uppercase',
          }}
        >
          {eyebrowText}
        </Text>
        <NbCard style={{ paddingVertical: 4, paddingHorizontal: 12 }}>{previewBody}</NbCard>
        {clientNoteCard}
        <NbButton variant="ghost" onPress={() => setWorkspaceOpen(true)}>
          {openAllLabel}
        </NbButton>
        <NbButton variant="fill" onPress={() => setShowAddModal(true)}>
          Add note or file
        </NbButton>
      </View>

      <Modal
        visible={workspaceOpen}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setWorkspaceOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: sheetBg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
            <TouchableOpacity
              onPress={() => setWorkspaceOpen(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={26} color={headerColor} />
            </TouchableOpacity>
            <Text style={{ flex: 1, fontSize: 20, fontWeight: '900', color: headerColor, letterSpacing: -0.35 }}>
              Notes & Files
            </Text>
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
              onShareItem={(shareItem) => {
                if (!shareItem || !shareItem.url) return;
                let shareTitle = 'File';
                if (shareItem.name) shareTitle = shareItem.name;
                else if (shareItem.title) shareTitle = shareItem.title;
                Share.share({ message: `${shareTitle}\n${shareItem.url}` }).catch(() => {});
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
        onAdded={() => {
          if (onRefetchNotesAndFiles) {
            onRefetchNotesAndFiles();
          }
          setShowAddModal(false);
        }}
        isDark={isDark}
        clientId={clientId}
        addedBy="trainer"
        onNewDocument={() => {
          if (onOpenDocumentEditor) {
            onOpenDocumentEditor({});
          }
        }}
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
      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={() => setNotice(null)}
        title={notice && notice.title ? notice.title : ''}
        message={notice ? notice.message : undefined}
        confirmLabel="OK"
      />
    </>
  );
};

// ===== PLUMBING — skip unless debugging =====

// SVG path data for the lightweight Icon helper (not Lucide — path strings).
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

function fallbackIconLetter(name) {
  if (typeof name === 'string' && name.length > 0) {
    return name.charAt(0);
  }
  return '?';
}

/**
 * Lightweight SVG icon from ICON_PATHS. Missing name → first letter fallback.
 * Function declaration so it is available to EmptyState above (hoisted).
 */
function Icon({ name, size = 18, color = '#fff' }) {
  const paths = ICON_PATHS[name];
  if (!paths) {
    const fallbackLetter = fallbackIconLetter(name);
    return <Text style={{ fontSize: size, color }}>{fallbackLetter}</Text>;
  }

  const pathList = Array.isArray(paths) ? paths : [paths];
  const pathElements = [];
  for (let index = 0; index < pathList.length; index += 1) {
    pathElements.push(<Path key={index} d={pathList[index]} />);
  }

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {pathElements}
    </Svg>
  );
}

// ===== EXPORTS =====

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
