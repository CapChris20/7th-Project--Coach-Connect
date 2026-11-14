// Onboarding snapshot cards on the workout plan builder: age, gear, sleep, journey, and the rest.
// Flow: build every section → hide unanswered fields → lay out two cards per row → tap opens the editor.
// Used by the create-plan screen. Field keys (editKey / id) stay as whichProfileCardsToShow already knows them.

import React from 'react';
import { Dimensions, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ProfileIcon from '../../for-both/icons/ProfileIcon';
import SectionTitle from '../../for-both/home-cards/SectionTitle';
import { profileCardIconWrapStyle } from '../../for-both/profileCardIconSizes';
import { filterProfileCardSections, getProfileCardSectionLabels } from '../../for-both/whichProfileCardsToShow';
import {
  LOVABLE_ACCENTS,
  displayForFieldKey,
  formatProfileHeightDisplay,
} from '../create-plan/planQuestionLabels';
import NbCard from '../../look-and-feel/NbCard';
import { lightColors, darkColors, gradients, nb } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: horizontal padding for the two-column grid
const PROFILE_TAGS_SIDE_PAD = 20;
const PROFILE_TAGS_GRID_GAP = 14;
const FALLBACK_SCREEN_WIDTH = 390;
const MIN_USABLE_WIDTH = 280;
const PROFILE_TAG_EMPTY_VALUE = '—';
const JOURNEY_PLACEHOLDER = 'Tap to add your journey text…';
const SNAPSHOT_HINT_CLIENT =
  'Only your onboarding answers appear here — tap a card to edit.';
const SNAPSHOT_HINT_COACH =
  'Only fields they answered during onboarding appear below.';
const DEFAULT_PILL_TEXT = 'Onboarding answers';
const EMPTY_STATE_ICON_SIZE = 28;

// ===== GRID + DISPLAY HELPERS =====

/**
 * Two-column card widths from the current window width.
 */
function profileGridMetrics() {
  // vocab: Dimensions.get('window') = live screen size (not the full device including status bar)
  const screenWidth = Dimensions.get('window')?.width || FALLBACK_SCREEN_WIDTH;
  const usableWidth = Math.max(MIN_USABLE_WIDTH, screenWidth - PROFILE_TAGS_SIDE_PAD * 2);
  const gridCardWidth = Math.floor((usableWidth - PROFILE_TAGS_GRID_GAP) / 2);
  return { usableW: usableWidth, gridCardW: gridCardWidth };
}

/**
 * Weight card text: "N lbs" or the empty dash.
 */
function formatWeightText(weight) {
  const hasWeight = weight != null && weight !== '';
  if (hasWeight) {
    return `${weight} lbs`;
  }
  return PROFILE_TAG_EMPTY_VALUE;
}

/**
 * Age card text: string age or the empty dash.
 */
function formatAgeText(age) {
  const hasAge = age != null && age !== '';
  if (hasAge) {
    return String(age);
  }
  return PROFILE_TAG_EMPTY_VALUE;
}

/**
 * Journey card preview: collapse whitespace; placeholder when the client left it blank.
 */
function journeyPreviewText(onboardingData) {
  const journeyPreviewRaw = String(onboardingData?.situationDescription || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (journeyPreviewRaw.length) {
    return journeyPreviewRaw;
  }
  return JOURNEY_PLACEHOLDER;
}

/**
 * Full section tree for the snapshot. Field id / editKey letters are frozen for the filter + editor.
 */
function buildProfileSections(onboardingData) {
  const displayForKey = (key) => displayForFieldKey(key, onboardingData);

  const personalInfoItems = [
    {
      id: 'age',
      label: 'Age',
      helper: 'personal info',
      icon: 'person-outline',
      value: formatAgeText(onboardingData?.age),
      editKey: 'personalInfo',
    },
    {
      id: 'gender',
      label: 'Gender',
      helper: 'profile',
      icon: 'person-outline',
      value: onboardingData?.gender ? String(onboardingData.gender) : PROFILE_TAG_EMPTY_VALUE,
      editKey: 'personalInfo',
    },
    {
      id: 'height',
      label: 'Height',
      helper: 'personal info',
      icon: 'stats-chart-outline',
      value: formatProfileHeightDisplay(onboardingData?.height),
      editKey: 'personalInfo',
    },
    {
      id: 'weight',
      label: 'Weight',
      helper: 'current weight',
      icon: 'stats-chart-outline',
      value: formatWeightText(onboardingData?.weight),
      editKey: 'personalInfo',
    },
  ];

  const trainingSetupItems = [
    {
      id: 'fitnessLevel',
      label: 'Level',
      helper: 'training status',
      icon: 'flame-outline',
      value: displayForKey('fitnessLevel'),
      editKey: 'fitnessLevel',
    },
    {
      id: 'goal',
      label: 'Goal',
      helper: 'primary goal',
      icon: 'trophy-outline',
      value: displayForKey('goal'),
      editKey: 'goal',
    },
    {
      id: 'equipment',
      label: 'Equipment',
      helper: 'available tools',
      icon: 'barbell-outline',
      value: displayForKey('equipment'),
      editKey: 'equipment',
    },
    {
      id: 'frequency',
      label: 'Frequency',
      helper: 'weekly sessions',
      icon: 'calendar-outline',
      value: displayForKey('frequency'),
      editKey: 'frequency',
    },
    {
      id: 'trainingEnvironment',
      label: 'Environment',
      helper: 'training place',
      icon: 'navigate-outline',
      value: displayForKey('trainingEnvironment'),
      editKey: 'trainingEnvironment',
    },
    {
      id: 'preferredWorkoutTime',
      label: 'Workout time',
      helper: 'preferred time',
      icon: 'time-outline',
      value: displayForKey('preferredWorkoutTime'),
      editKey: 'preferredWorkoutTime',
    },
  ];

  const recoveryAndExtrasItems = [
    {
      id: 'exercisesDislike',
      label: 'Prefer',
      helper: 'exercise preferences',
      icon: 'heart-outline',
      value: displayForKey('exercisesDislike'),
      editKey: 'exercisesDislike',
    },
    {
      id: 'injuries',
      label: 'Injuries',
      helper: 'limitations',
      icon: 'heart-outline',
      value: displayForKey('injuries'),
      editKey: 'injuries',
    },
    {
      id: 'supplements',
      label: 'Supplements',
      helper: 'currently taking',
      icon: 'star-outline',
      value: displayForKey('supplementsCurrentlyTaking'),
      editKey: 'supplementsCurrentlyTaking',
    },
    {
      id: 'stress',
      label: 'Stress',
      helper: 'current level',
      icon: 'water-outline',
      value: displayForKey('currentStressLevel'),
      editKey: 'currentStressLevel',
    },
    {
      id: 'sleep',
      label: 'Sleep',
      helper: 'sleep quality',
      icon: 'moon-outline',
      value: displayForKey('sleepQuality'),
      editKey: 'sleepQuality',
    },
    {
      id: 'energy',
      label: 'Energy',
      helper: 'daily energy',
      icon: 'battery-charging-outline',
      value: displayForKey('energyLevels'),
      editKey: 'energyLevels',
    },
    {
      id: 'hydration',
      label: 'Hydration',
      helper: 'water habits',
      icon: 'water-outline',
      value: displayForKey('hydrationHabits'),
      editKey: 'hydrationHabits',
      fullWidth: true,
    },
    {
      id: 'journey',
      label: 'My Journey',
      helper: 'tap to expand',
      icon: 'document-text-outline',
      value: journeyPreviewText(onboardingData),
      editKey: 'situationDescription',
      wide: true,
    },
  ];

  return [
    { title: 'Personal Info', items: personalInfoItems },
    { title: 'Training Setup', items: trainingSetupItems },
    { title: 'Recovery & Extras', items: recoveryAndExtrasItems },
  ];
}

/**
 * Bucket one item into wide / fullWidth / normal lists (layout flags on the item).
 */
function pushItemByLayout(item, normalItems, fullWidthItems, wideItems) {
  if (item.wide) {
    wideItems.push(item);
    return;
  }
  if (item.fullWidth) {
    fullWidthItems.push(item);
    return;
  }
  normalItems.push(item);
}

/**
 * Split a section’s items into two-card pairs plus full-width and wide stacks.
 */
function splitSectionItems(items) {
  const normalItems = [];
  const fullWidthItems = [];
  const wideItems = [];

  for (const item of items) {
    pushItemByLayout(item, normalItems, fullWidthItems, wideItems);
  }

  const pairs = [];
  for (let rowStart = 0; rowStart < normalItems.length; rowStart += 2) {
    pairs.push(normalItems.slice(rowStart, rowStart + 2));
  }

  return { pairs, fullWidth: fullWidthItems, wide: wideItems };
}

function themeColorsFromDeviceScheme(colorScheme) {
  if (colorScheme === 'dark') {
    return darkColors;
  }
  return lightColors;
}

function editPillGradientColors(isEditable, mutedColor) {
  if (isEditable) {
    return gradients.ink.colors;
  }
  return [mutedColor, mutedColor];
}

function editPillLabel(isEditable) {
  if (isEditable) {
    return 'Tap to edit';
  }
  return 'Read only';
}

// ===== CARD PIECES (in-file UI) =====

function EditPill({ isEditable }) {
  // EditPill uses light/dark muted pair when read-only (matches legacy chrome)
  const pillColors = isEditable
    ? gradients.ink.colors
    : [lightColors.nbMuted, darkColors.nbMuted];
  const pillText = editPillLabel(isEditable);

  return (
    <LinearGradient
      colors={pillColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
    >
      <Text style={{ color: lightColors.white, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.2 }}>
        {pillText}
      </Text>
    </LinearGradient>
  );
}

function JourneyCard({
  item,
  cellStyle,
  cardBg: deprecatedCardBg,
  planBuilderDivider: deprecatedDivider,
  isDark: deprecatedIsDark,
  onboardingData,
  lovableMuted,
  lovableText,
  isEditable,
  onEditField,
}) {
  // vocab: useColorScheme = device light/dark; chrome ignores deprecated isDark/cardBg props
  const colorScheme = useColorScheme();
  const colors = themeColorsFromDeviceScheme(colorScheme);
  const isDarkScheme = colorScheme === 'dark';
  const iconWrapStyle = profileCardIconWrapStyle(isDarkScheme);
  const openThisField = () => onEditField(item.editKey);
  const cellWithMargins = [cellStyle, { marginTop: 10, marginBottom: 6 }];

  return (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.9}
      onPress={openThisField}
      disabled={!isEditable}
      style={cellWithMargins}
    >
      <NbCard style={{ padding: 16, minHeight: 172 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={iconWrapStyle}>
              <ProfileIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: 'SpaceGrotesk_700Bold',
                  letterSpacing: 0.8,
                  color: colors.nbMuted,
                  textTransform: 'uppercase',
                }}
              >
                {item.label}
              </Text>
              <Text
                style={{ fontSize: 14, fontFamily: 'SpaceGrotesk_700Bold', color: colors.nbInk, marginTop: 8 }}
                numberOfLines={2}
              >
                {item.value}
              </Text>
              <EditPill isEditable={isEditable} />
            </View>
          </View>
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

function StandardPillCard({
  item,
  cellStyle,
  cardBg: deprecatedCardBg,
  planBuilderDivider: deprecatedDivider,
  isDark: deprecatedIsDark,
  onboardingData,
  lovableMuted,
  lovableText,
  lovableSubtle,
  isEditable,
  onEditField,
}) {
  const colorScheme = useColorScheme();
  const colors = themeColorsFromDeviceScheme(colorScheme);
  const isDarkScheme = colorScheme === 'dark';
  const iconWrapStyle = profileCardIconWrapStyle(isDarkScheme);
  const pillColors = editPillGradientColors(isEditable, colors.nbMuted);
  const pillText = editPillLabel(isEditable);
  const openThisField = () => onEditField(item.editKey);
  const cellWithMargins = [cellStyle, { marginBottom: 14 }];

  return (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.9}
      onPress={openThisField}
      disabled={!isEditable}
      style={cellWithMargins}
    >
      <NbCard
        style={{
          paddingHorizontal: 16,
          paddingVertical: 16,
          minHeight: 138,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: '100%', alignItems: 'center' }}>
          <View style={iconWrapStyle}>
            <ProfileIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
          </View>
          <Text
            style={{
              marginTop: 12,
              fontSize: 12,
              fontFamily: 'SpaceGrotesk_700Bold',
              letterSpacing: 0.9,
              color: colors.nbMuted,
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {item.label}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 17,
              fontFamily: 'SpaceGrotesk_700Bold',
              color: colors.nbInk,
              textAlign: 'center',
            }}
            numberOfLines={2}
          >
            {item.value}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontSize: 11,
              fontFamily: 'Inter_500Medium',
              color: colors.nbMuted,
              textAlign: 'center',
            }}
            numberOfLines={1}
          >
            {item.helper}
          </Text>
          <LinearGradient
            colors={pillColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
          >
            <Text style={{ color: lightColors.white, fontSize: 11, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 0.2 }}>
              {pillText}
            </Text>
          </LinearGradient>
        </View>
      </NbCard>
    </TouchableOpacity>
  );
}

/**
 * Pick journey vs standard card and size the cell (full width vs grid half).
 */
function PillCard({ item, layout, theme, onEditField }) {
  const isJourneyCard = item.wide === true;
  const isFullWidth = item.fullWidth === true || isJourneyCard;

  let cellStyle = { width: layout.gridCardW };
  if (isFullWidth) {
    cellStyle = { width: layout.usableW, alignSelf: 'center' };
  }

  const isEditable = !theme.isCoachViewingClientProfile;

  // Legacy cardBg / divider / isDark stay on the shared props bag for older card signatures
  const sharedCardProps = {
    item,
    cellStyle,
    cardBg: theme.isDark ? '#13131A' : lightColors.white,
    planBuilderDivider: theme.planBuilderDivider,
    isDark: theme.isDark,
    onboardingData: theme.onboardingData,
    lovableMuted: theme.lovableMuted,
    lovableText: theme.lovableText,
    isEditable,
    onEditField,
  };

  if (isJourneyCard) {
    return <JourneyCard {...sharedCardProps} />;
  }

  return <StandardPillCard {...sharedCardProps} lovableSubtle={theme.lovableSubtle} />;
}

function SnapshotHeader({
  isDark: deprecatedIsDark,
  lovableText,
  lovableMuted,
  isCoachViewingClientProfile,
  profileCardSectionLabels,
  profileCardPillText,
  planBuilderDivider: deprecatedDivider,
}) {
  const colorScheme = useColorScheme();
  const colors = themeColorsFromDeviceScheme(colorScheme);

  let snapshotHint = SNAPSHOT_HINT_CLIENT;
  if (isCoachViewingClientProfile) {
    snapshotHint = SNAPSHOT_HINT_COACH;
  }

  const hasSectionLabels = profileCardSectionLabels.length > 0;

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'SpaceGrotesk_700Bold',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: colors.nbMuted,
          textAlign: 'center',
        }}
      >
        Onboarding snapshot
      </Text>
      <Text
        style={{
          fontSize: 22,
          fontFamily: 'SpaceGrotesk_700Bold',
          color: colors.nbInk,
          marginTop: 6,
          textAlign: 'center',
          letterSpacing: -0.3,
        }}
      >
        Profile Cards
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Inter_500Medium',
          color: colors.nbMuted,
          lineHeight: 19,
          textAlign: 'center',
          marginTop: 8,
          maxWidth: 320,
        }}
      >
        {snapshotHint}
      </Text>
      {hasSectionLabels ? (
        <LinearGradient
          colors={gradients.ink.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 999, padding: 1, marginTop: 14 }}
        >
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: colors.nbSurface,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontFamily: 'SpaceGrotesk_700Bold',
                color: colors.nbInk,
                letterSpacing: 0.3,
                textAlign: 'center',
              }}
            >
              {profileCardPillText}
            </Text>
          </View>
        </LinearGradient>
      ) : null}
      <View style={{ marginTop: 18, width: '100%', height: nb.borderWidth, backgroundColor: colors.nbBorder }} />
    </View>
  );
}

function EmptyOnboardingState({ isDark: deprecatedIsDark, lovableMuted, lovableText }) {
  const colorScheme = useColorScheme();
  const colors = themeColorsFromDeviceScheme(colorScheme);

  return (
    <NbCard
      style={{
        marginTop: 8,
        marginBottom: 16,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
      }}
    >
      <Ionicons name="document-text-outline" size={EMPTY_STATE_ICON_SIZE} color={colors.nbMuted} />
      <Text style={{ color: colors.nbInk, fontSize: 16, fontFamily: 'SpaceGrotesk_700Bold', marginTop: 12, textAlign: 'center' }}>
        No onboarding answers yet
      </Text>
      <Text
        style={{
          color: colors.nbMuted,
          fontSize: 13,
          fontFamily: 'Inter_400Regular',
          lineHeight: 18,
          marginTop: 6,
          textAlign: 'center',
          maxWidth: 280,
        }}
      >
        Cards appear here only for fields this client completed during onboarding.
      </Text>
    </NbCard>
  );
}

/**
 * Paint one section’s pairs + full-width + wide cards.
 * Returns { node, nextAccentIndex } so the parent can keep LOVABLE_ACCENTS walking across sections.
 * (accent is still passed into PillCard for parity even though the card chrome uses theme tokens.)
 */
function SectionGrid({ section, layout, theme, onEditField, nextAccentIndex }) {
  const { pairs, fullWidth, wide } = splitSectionItems(section.items);
  let accentIndex = nextAccentIndex;

  const renderOneCard = (item) => {
    accentIndex += 1;
    const accent = LOVABLE_ACCENTS[(accentIndex - 1) % LOVABLE_ACCENTS.length];
    return (
      <PillCard
        key={item.id}
        item={item}
        accent={accent}
        layout={layout}
        theme={theme}
        onEditField={onEditField}
      />
    );
  };

  const pairRows = [];
  for (let rowIdx = 0; rowIdx < pairs.length; rowIdx += 1) {
    const pair = pairs[rowIdx];
    let rowJustify = 'center';
  if (pair.length === 2) {
    rowJustify = 'space-between';
  }
    pairRows.push(
      <View
        key={`${section.title}-row-${rowIdx}`}
        style={{
          flexDirection: 'row',
          width: layout.usableW,
          alignSelf: 'center',
          justifyContent: rowJustify,
          marginBottom: PROFILE_TAGS_GRID_GAP,
        }}
      >
        {pair.map((item) => renderOneCard(item))}
      </View>,
    );
  }

  const fullWidthCards = fullWidth.map((item) => renderOneCard(item));
  const wideCards = wide.map((item) => renderOneCard(item));

  return {
    node: (
      <View style={{ width: layout.usableW, alignSelf: 'center' }}>
        {pairRows}
        {fullWidthCards}
        {wideCards}
      </View>
    ),
    nextAccentIndex: accentIndex,
  };
}

// ===== MAIN COMPONENT =====

/**
 * Onboarding snapshot grid for the workout plan builder.
 * Flow: 1. pill labels  2. layout + filter  3. header  4. empty or section grids
 */
export default function WorkoutProfileTags({
  onboardingData,
  isDark,
  isCoachViewingClientProfile,
  planBuilderDivider,
  lovableText,
  lovableMuted,
  lovableSubtle,
  onEditField,
}) {
  // 1. Header pill text — which onboarding sections actually have answers
  const profileCardSectionLabels = getProfileCardSectionLabels(onboardingData);
  let profileCardPillText = DEFAULT_PILL_TEXT;
  if (profileCardSectionLabels.length > 0) {
    profileCardPillText = profileCardSectionLabels.join(' · ');
  }

  // 2. Layout metrics and which section rows survive the unanswered-field filter
  const layout = profileGridMetrics();
  const allSections = buildProfileSections(onboardingData);
  const visibleSections = filterProfileCardSections(allSections, onboardingData);
  const hasNoVisibleCards = visibleSections.length === 0;

  const theme = {
    isDark,
    isCoachViewingClientProfile,
    planBuilderDivider,
    onboardingData,
    lovableMuted,
    lovableText,
    lovableSubtle,
  };

  // 3. Paint sections; accent index walks across the whole list for LOVABLE_ACCENTS rotation
  let accentIndexAfterLastSection = 0;
  const sectionBlocks = [];
  for (const section of visibleSections) {
    const grid = SectionGrid({
      section,
      layout,
      theme,
      onEditField,
      nextAccentIndex: accentIndexAfterLastSection,
    });
    accentIndexAfterLastSection = grid.nextAccentIndex;
    sectionBlocks.push(
      <View key={section.title}>
        <SectionTitle text={section.title} isDark={isDark} />
        {grid.node}
      </View>,
    );
  }

  // 4. Header always; empty state or the section list
  return (
    <>
      <SnapshotHeader
        isDark={isDark}
        lovableText={lovableText}
        lovableMuted={lovableMuted}
        isCoachViewingClientProfile={isCoachViewingClientProfile}
        profileCardSectionLabels={profileCardSectionLabels}
        profileCardPillText={profileCardPillText}
        planBuilderDivider={planBuilderDivider}
      />

      {hasNoVisibleCards ? (
        <EmptyOnboardingState isDark={isDark} lovableMuted={lovableMuted} lovableText={lovableText} />
      ) : (
        <View style={{ paddingBottom: 10 }}>{sectionBlocks}</View>
      )}
    </>
  );
}
