// Onboarding snapshot cards on the workout plan builder: age, gear, sleep, journey, and the rest.
// Flow: build every section → hide unanswered fields → lay out two cards per row → tap opens the editor.
// Used by the create-plan screen. Field keys (editKey / id) stay as whichProfileCardsToShow already knows them.

import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
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

// ===== NAMED CONSTANTS =====

const PROFILE_TAGS_SIDE_PAD = 20;
const PROFILE_TAGS_GRID_GAP = 14;
const FALLBACK_SCREEN_WIDTH = 390;
const MIN_USABLE_WIDTH = 280;
const PROFILE_TAG_EMPTY_VALUE = '—';
const JOURNEY_PLACEHOLDER = 'Tap to add your journey text…';
const PILL_EDITABLE_COLORS = ['#6D28D9', '#C2410C'];
const PILL_READONLY_COLORS = ['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)'];
const SECTION_PILL_COLORS = ['#9333EA', '#DB2777'];
const PILL_TEXT_COLOR = '#FFFFFF';

// ===== HELPER FUNCTIONS =====

/**
 * Two cards per row, with leftover space as padding. Tiny phones still get a readable card.
 * @returns {{ usableW: number, gridCardW: number }}
 */
function profileGridMetrics() {
  const screenW = Dimensions.get('window')?.width || FALLBACK_SCREEN_WIDTH;
  const usableW = Math.max(MIN_USABLE_WIDTH, screenW - PROFILE_TAGS_SIDE_PAD * 2);
  const gridCardW = Math.floor((usableW - PROFILE_TAGS_GRID_GAP) / 2);
  return { usableW, gridCardW };
}

/**
 * @param {*} weight
 * @returns {string}
 */
function formatWeightText(weight) {
  if (weight != null && weight !== '') return `${weight} lbs`;
  return PROFILE_TAG_EMPTY_VALUE;
}

/**
 * @param {*} age
 * @returns {string}
 */
function formatAgeText(age) {
  if (age != null && age !== '') return String(age);
  return PROFILE_TAG_EMPTY_VALUE;
}

/**
 * @param {object} onboardingData
 * @returns {string}
 */
function journeyPreviewText(onboardingData) {
  const journeyPreviewRaw = String(onboardingData?.situationDescription || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (journeyPreviewRaw.length) return journeyPreviewRaw;
  return JOURNEY_PLACEHOLDER;
}

/**
 * Every card the profile can show. filterProfileCardSections hides ones the client never answered.
 * @param {object} onboardingData
 * @returns {object[]}
 */
function buildProfileSections(onboardingData) {
  const displayForKey = (key) => displayForFieldKey(key, onboardingData);
  return [
    {
      title: 'Personal Info',
      items: [
        { id: 'age', label: 'Age', helper: 'personal info', icon: 'person-outline', value: formatAgeText(onboardingData?.age), editKey: 'personalInfo' },
        { id: 'gender', label: 'Gender', helper: 'profile', icon: 'person-outline', value: onboardingData?.gender ? String(onboardingData.gender) : PROFILE_TAG_EMPTY_VALUE, editKey: 'personalInfo' },
        { id: 'height', label: 'Height', helper: 'personal info', icon: 'stats-chart-outline', value: formatProfileHeightDisplay(onboardingData?.height), editKey: 'personalInfo' },
        { id: 'weight', label: 'Weight', helper: 'current weight', icon: 'stats-chart-outline', value: formatWeightText(onboardingData?.weight), editKey: 'personalInfo' },
      ],
    },
    {
      title: 'Training Setup',
      items: [
        { id: 'fitnessLevel', label: 'Level', helper: 'training status', icon: 'flame-outline', value: displayForKey('fitnessLevel'), editKey: 'fitnessLevel' },
        { id: 'goal', label: 'Goal', helper: 'primary goal', icon: 'trophy-outline', value: displayForKey('goal'), editKey: 'goal' },
        { id: 'equipment', label: 'Equipment', helper: 'available tools', icon: 'barbell-outline', value: displayForKey('equipment'), editKey: 'equipment' },
        { id: 'frequency', label: 'Frequency', helper: 'weekly sessions', icon: 'calendar-outline', value: displayForKey('frequency'), editKey: 'frequency' },
        { id: 'trainingEnvironment', label: 'Environment', helper: 'training place', icon: 'navigate-outline', value: displayForKey('trainingEnvironment'), editKey: 'trainingEnvironment' },
        { id: 'preferredWorkoutTime', label: 'Workout time', helper: 'preferred time', icon: 'time-outline', value: displayForKey('preferredWorkoutTime'), editKey: 'preferredWorkoutTime' },
      ],
    },
    {
      title: 'Recovery & Extras',
      items: [
        { id: 'exercisesDislike', label: 'Prefer', helper: 'exercise preferences', icon: 'heart-outline', value: displayForKey('exercisesDislike'), editKey: 'exercisesDislike' },
        { id: 'injuries', label: 'Injuries', helper: 'limitations', icon: 'heart-outline', value: displayForKey('injuries'), editKey: 'injuries' },
        { id: 'supplements', label: 'Supplements', helper: 'currently taking', icon: 'star-outline', value: displayForKey('supplementsCurrentlyTaking'), editKey: 'supplementsCurrentlyTaking' },
        { id: 'stress', label: 'Stress', helper: 'current level', icon: 'water-outline', value: displayForKey('currentStressLevel'), editKey: 'currentStressLevel' },
        { id: 'sleep', label: 'Sleep', helper: 'sleep quality', icon: 'moon-outline', value: displayForKey('sleepQuality'), editKey: 'sleepQuality' },
        { id: 'energy', label: 'Energy', helper: 'daily energy', icon: 'battery-charging-outline', value: displayForKey('energyLevels'), editKey: 'energyLevels' },
        { id: 'hydration', label: 'Hydration', helper: 'water habits', icon: 'water-outline', value: displayForKey('hydrationHabits'), editKey: 'hydrationHabits', fullWidth: true },
        { id: 'journey', label: 'My Journey', helper: 'tap to expand', icon: 'document-text-outline', value: journeyPreviewText(onboardingData), editKey: 'situationDescription', wide: true },
      ],
    },
  ];
}

/**
 * Wide/full-width cards sit under the two-column rows so the journey block can span the screen.
 * @param {object[]} items
 * @returns {{ pairs: object[][], fullWidth: object[], wide: object[] }}
 */
function splitSectionItems(items) {
  const normal = [];
  const fullWidth = [];
  const wide = [];
  for (const item of items) {
    pushItemByLayout(item, normal, fullWidth, wide);
  }
  const pairs = [];
  for (let i = 0; i < normal.length; i += 2) pairs.push(normal.slice(i, i + 2));
  return { pairs, fullWidth, wide };
}

/**
 * @param {object} item
 * @param {object[]} normal
 * @param {object[]} fullWidth
 * @param {object[]} wide
 */
function pushItemByLayout(item, normal, fullWidth, wide) {
  if (item.wide) {
    wide.push(item);
    return;
  }
  if (item.fullWidth) {
    fullWidth.push(item);
    return;
  }
  normal.push(item);
}

function EditPill({ isEditable }) {
  const pillColors = isEditable ? PILL_EDITABLE_COLORS : PILL_READONLY_COLORS;
  const pillText = isEditable ? 'Tap to edit' : 'Read only';
  return (
    <LinearGradient
      colors={pillColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={{ alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
    >
      <Text style={{ color: PILL_TEXT_COLOR, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 }}>
        {pillText}
      </Text>
    </LinearGradient>
  );
}

function JourneyCard({ item, cellStyle, cardBg, planBuilderDivider, isDark, onboardingData, lovableMuted, lovableText, isEditable, onEditField }) {
  return (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.9}
      onPress={() => onEditField(item.editKey)}
      disabled={!isEditable}
      style={[cellStyle, { marginTop: 10, marginBottom: 6 }]}
    >
      <View
        style={{
          borderRadius: 22,
          borderWidth: 1,
          borderColor: planBuilderDivider,
          backgroundColor: cardBg,
        }}
      >
        <View style={{ padding: 16, minHeight: 172, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1, flexDirection: 'row' }}>
            <View style={profileCardIconWrapStyle(isDark)}>
              <ProfileIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: lovableMuted, textTransform: 'uppercase' }}>
                {item.label}
              </Text>
              <Text style={{ fontSize: 14, fontWeight: '800', color: lovableText, marginTop: 8 }} numberOfLines={2}>
                {item.value}
              </Text>
              <EditPill isEditable={isEditable} />
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StandardPillCard({ item, cellStyle, cardBg, planBuilderDivider, isDark, onboardingData, lovableMuted, lovableText, lovableSubtle, isEditable, onEditField }) {
  return (
    <TouchableOpacity
      key={item.id}
      activeOpacity={0.9}
      onPress={() => onEditField(item.editKey)}
      disabled={!isEditable}
      style={[cellStyle, { marginBottom: 14 }]}
    >
      <View
        style={{
          borderRadius: 22,
          borderWidth: 1,
          borderColor: planBuilderDivider,
          backgroundColor: cardBg,
          paddingHorizontal: 16,
          paddingVertical: 16,
          minHeight: 138,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={{ width: '100%', alignItems: 'center' }}>
          <View style={profileCardIconWrapStyle(isDark)}>
            <ProfileIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
          </View>
          <Text style={{ marginTop: 12, fontSize: 9, fontWeight: '800', letterSpacing: 0.9, color: lovableMuted, textTransform: 'uppercase', textAlign: 'center' }}>
            {item.label}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 17, fontWeight: '900', color: lovableText, textAlign: 'center' }} numberOfLines={2}>
            {item.value}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 11, fontWeight: '600', color: lovableSubtle, textAlign: 'center' }} numberOfLines={1}>
            {item.helper}
          </Text>
          <LinearGradient
            colors={isEditable ? PILL_EDITABLE_COLORS : PILL_READONLY_COLORS}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
          >
            <Text style={{ color: PILL_TEXT_COLOR, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 }}>
              {isEditable ? 'Tap to edit' : 'Read only'}
            </Text>
          </LinearGradient>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function PillCard({ item, layout, theme, onEditField }) {
  const isJourney = item.wide === true;
  const isFullWidth = item.fullWidth === true || isJourney;
  const cellStyle = isFullWidth ? { width: layout.usableW, alignSelf: 'center' } : { width: layout.gridCardW };
  const cardBg = theme.isDark ? '#13131A' : '#FFFFFF';
  const isEditable = !theme.isCoachViewingClientProfile;
  const shared = {
    item,
    cellStyle,
    cardBg,
    planBuilderDivider: theme.planBuilderDivider,
    isDark: theme.isDark,
    onboardingData: theme.onboardingData,
    lovableMuted: theme.lovableMuted,
    lovableText: theme.lovableText,
    isEditable,
    onEditField,
  };
  if (isJourney) return <JourneyCard {...shared} />;
  return <StandardPillCard {...shared} lovableSubtle={theme.lovableSubtle} />;
}

function SnapshotHeader({ isDark, lovableText, lovableMuted, isCoachViewingClientProfile, profileCardSectionLabels, profileCardPillText, planBuilderDivider }) {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, alignItems: 'center' }}>
      <Text
        style={{
          fontSize: 10,
          fontWeight: '900',
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: isDark ? 'rgba(233,213,255,0.72)' : 'rgba(109,40,217,0.75)',
          textAlign: 'center',
        }}
      >
        Onboarding snapshot
      </Text>
      <Text style={{ fontSize: 22, fontWeight: '900', color: lovableText, marginTop: 6, textAlign: 'center', letterSpacing: -0.3 }}>
        Profile Cards
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: '600',
          color: lovableMuted,
          lineHeight: 19,
          textAlign: 'center',
          marginTop: 8,
          maxWidth: 320,
        }}
      >
        {isCoachViewingClientProfile
          ? 'Only fields they answered during onboarding appear below.'
          : 'Only your onboarding answers appear here — tap a card to edit.'}
      </Text>
      {profileCardSectionLabels.length > 0 ? (
        <LinearGradient
          colors={SECTION_PILL_COLORS}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 999, padding: 1, marginTop: 14 }}
        >
          <View
            style={{
              borderRadius: 999,
              paddingHorizontal: 16,
              paddingVertical: 8,
              backgroundColor: isDark ? 'rgba(10,8,18,0.96)' : 'rgba(255,255,255,0.98)',
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: '800',
                color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)',
                letterSpacing: 0.3,
                textAlign: 'center',
              }}
            >
              {profileCardPillText}
            </Text>
          </View>
        </LinearGradient>
      ) : null}
      <View style={{ marginTop: 18, width: '100%', height: StyleSheet.hairlineWidth, backgroundColor: planBuilderDivider }} />
    </View>
  );
}

function EmptyOnboardingState({ isDark, lovableMuted, lovableText }) {
  return (
    <View
      style={{
        marginTop: 8,
        marginBottom: 16,
        paddingVertical: 28,
        paddingHorizontal: 20,
        alignItems: 'center',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.03)',
      }}
    >
      <Ionicons name="document-text-outline" size={28} color={lovableMuted} />
      <Text style={{ color: lovableText, fontSize: 16, fontWeight: '800', marginTop: 12, textAlign: 'center' }}>
        No onboarding answers yet
      </Text>
      <Text style={{ color: lovableMuted, fontSize: 13, lineHeight: 18, marginTop: 6, textAlign: 'center', maxWidth: 280 }}>
        Cards appear here only for fields this client completed during onboarding.
      </Text>
    </View>
  );
}

function SectionGrid({ section, layout, theme, onEditField, nextAccentIndex }) {
  const { pairs, fullWidth, wide } = splitSectionItems(section.items);
  let accentIndex = nextAccentIndex;
  const renderCard = (item) => {
    accentIndex += 1;
    return (
      <PillCard
        key={item.id}
        item={item}
        accent={LOVABLE_ACCENTS[(accentIndex - 1) % LOVABLE_ACCENTS.length]}
        layout={layout}
        theme={theme}
        onEditField={onEditField}
      />
    );
  };
  return {
    node: (
      <View style={{ width: layout.usableW, alignSelf: 'center' }}>
        {pairs.map((pair, rowIdx) => (
          <View
            key={`${section.title}-row-${rowIdx}`}
            style={{
              flexDirection: 'row',
              width: layout.usableW,
              alignSelf: 'center',
              justifyContent: pair.length === 2 ? 'space-between' : 'center',
              marginBottom: PROFILE_TAGS_GRID_GAP,
            }}
          >
            {pair.map((item) => renderCard(item))}
          </View>
        ))}
        {fullWidth.map((item) => renderCard(item))}
        {wide.map((item) => renderCard(item))}
      </View>
    ),
    nextAccentIndex: accentIndex,
  };
}

// ===== MAIN FUNCTION =====

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
  const profileCardSectionLabels = getProfileCardSectionLabels(onboardingData);
  const profileCardPillText =
    profileCardSectionLabels.length > 0
      ? profileCardSectionLabels.join(' · ')
      : 'Onboarding answers';

  const layout = profileGridMetrics();
  const visibleSections = filterProfileCardSections(buildProfileSections(onboardingData), onboardingData);
  const theme = {
    isDark,
    isCoachViewingClientProfile,
    planBuilderDivider,
    onboardingData,
    lovableMuted,
    lovableText,
    lovableSubtle,
  };

  let globalIdx = 0;

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

      {visibleSections.length === 0 ? (
        <EmptyOnboardingState isDark={isDark} lovableMuted={lovableMuted} lovableText={lovableText} />
      ) : (
        <View style={{ paddingBottom: 10 }}>
          {visibleSections.map((section) => {
            const grid = SectionGrid({
              section,
              layout,
              theme,
              onEditField,
              nextAccentIndex: globalIdx,
            });
            globalIdx = grid.nextAccentIndex;
            return (
              <View key={section.title}>
                <SectionTitle text={section.title} isDark={isDark} />
                {grid.node}
              </View>
            );
          })}
        </View>
      )}
    </>
  );
}
