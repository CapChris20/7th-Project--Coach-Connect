import React from 'react';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ProfileCardIcon from '../../shared/components/icons/ProfileCardIcon';
import PremiumSectionHeader from '../../shared/components/PremiumSectionHeader';
import { profileCardIconWrapStyle } from '../../shared/workout-profile/profileCardIcons';
import { filterProfileCardSections, getProfileCardSectionLabels } from '../../shared/workout-profile/shouldShowProfileCard';
import {
  LOVABLE_ACCENTS,
  displayForFieldKey,
  formatProfileHeightDisplay,
} from '../plan-generator/workoutOnboardingFormConfig';

export default function WorkoutProfilePillGrid({
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

  const SIDE_PAD = 20;
  const GRID_GAP = 14;
  const screenW = Dimensions.get('window')?.width || 390;
  const usableW = Math.max(280, screenW - SIDE_PAD * 2);
  const gridCardW = Math.floor((usableW - GRID_GAP) / 2);

  const heightText = formatProfileHeightDisplay(onboardingData?.height);
  const weightText =
    onboardingData?.weight != null && onboardingData?.weight !== '' ? `${onboardingData.weight} lbs` : '—';
  const ageText =
    onboardingData?.age != null && onboardingData?.age !== '' ? String(onboardingData.age) : '—';
  const genderText = onboardingData?.gender ? String(onboardingData.gender) : '—';

  const journeyPreviewRaw = String(onboardingData?.situationDescription || '')
    .replace(/\s+/g, ' ')
    .trim();
  const journeyPreview = journeyPreviewRaw.length ? journeyPreviewRaw : 'Tap to add your journey text…';

  const dfk = (key) => displayForFieldKey(key, onboardingData);

  const sections = [
    {
      title: 'Personal Info',
      items: [
        { id: 'age', label: 'Age', helper: 'personal info', icon: 'person-outline', value: ageText, editKey: 'personalInfo' },
        { id: 'gender', label: 'Gender', helper: 'profile', icon: 'person-outline', value: genderText, editKey: 'personalInfo' },
        { id: 'height', label: 'Height', helper: 'personal info', icon: 'stats-chart-outline', value: heightText, editKey: 'personalInfo' },
        { id: 'weight', label: 'Weight', helper: 'current weight', icon: 'stats-chart-outline', value: weightText, editKey: 'personalInfo' },
      ],
    },
    {
      title: 'Training Setup',
      items: [
        { id: 'fitnessLevel', label: 'Level', helper: 'training status', icon: 'flame-outline', value: dfk('fitnessLevel'), editKey: 'fitnessLevel' },
        { id: 'goal', label: 'Goal', helper: 'primary goal', icon: 'trophy-outline', value: dfk('goal'), editKey: 'goal' },
        { id: 'equipment', label: 'Equipment', helper: 'available tools', icon: 'barbell-outline', value: dfk('equipment'), editKey: 'equipment' },
        { id: 'frequency', label: 'Frequency', helper: 'weekly sessions', icon: 'calendar-outline', value: dfk('frequency'), editKey: 'frequency' },
        { id: 'trainingEnvironment', label: 'Environment', helper: 'training place', icon: 'navigate-outline', value: dfk('trainingEnvironment'), editKey: 'trainingEnvironment' },
        { id: 'preferredWorkoutTime', label: 'Workout time', helper: 'preferred time', icon: 'time-outline', value: dfk('preferredWorkoutTime'), editKey: 'preferredWorkoutTime' },
      ],
    },
    {
      title: 'Recovery & Extras',
      items: [
        { id: 'exercisesDislike', label: 'Prefer', helper: 'exercise preferences', icon: 'heart-outline', value: dfk('exercisesDislike'), editKey: 'exercisesDislike' },
        { id: 'injuries', label: 'Injuries', helper: 'limitations', icon: 'heart-outline', value: dfk('injuries'), editKey: 'injuries' },
        { id: 'supplements', label: 'Supplements', helper: 'currently taking', icon: 'star-outline', value: dfk('supplementsCurrentlyTaking'), editKey: 'supplementsCurrentlyTaking' },
        { id: 'stress', label: 'Stress', helper: 'current level', icon: 'water-outline', value: dfk('currentStressLevel'), editKey: 'currentStressLevel' },
        { id: 'sleep', label: 'Sleep', helper: 'sleep quality', icon: 'moon-outline', value: dfk('sleepQuality'), editKey: 'sleepQuality' },
        { id: 'energy', label: 'Energy', helper: 'daily energy', icon: 'battery-charging-outline', value: dfk('energyLevels'), editKey: 'energyLevels' },
        { id: 'hydration', label: 'Hydration', helper: 'water habits', icon: 'water-outline', value: dfk('hydrationHabits'), editKey: 'hydrationHabits', fullWidth: true },
        { id: 'journey', label: 'My Journey', helper: 'tap to expand', icon: 'document-text-outline', value: journeyPreview, editKey: 'situationDescription', wide: true },
      ],
    },
  ];

  const visibleSections = filterProfileCardSections(sections, onboardingData);

  const SectionHeader = ({ text }) => (
    <PremiumSectionHeader text={text} isDark={isDark} />
  );

  const PillCard = ({ item }) => {
    const isJourney = item.wide === true;
    const isFullWidth = item.fullWidth === true || isJourney;
    const cellStyle = isFullWidth ? { width: usableW, alignSelf: 'center' } : { width: gridCardW };
    const cardBg = isDark ? '#13131A' : '#FFFFFF';
    const isEditable = !isCoachViewingClientProfile;
    const pillColors = ['#6D28D9', '#C2410C'];
    const pillText = isEditable ? 'Tap to edit' : 'Read only';
    const pillTextColor = '#FFFFFF';

    if (isJourney) {
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
                  <ProfileCardIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', letterSpacing: 0.8, color: lovableMuted, textTransform: 'uppercase' }}>
                    {item.label}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: lovableText, marginTop: 8 }} numberOfLines={2}>
                    {item.value}
                  </Text>
                  <LinearGradient
                    colors={isEditable ? pillColors : ['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
                  >
                    <Text style={{ color: pillTextColor, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 }}>
                      {pillText}
                    </Text>
                  </LinearGradient>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    }

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
              <ProfileCardIcon itemId={item.id} onboardingData={onboardingData} fallbackIcon={item.icon} />
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
              colors={isEditable ? pillColors : ['rgba(148,163,184,0.45)', 'rgba(148,163,184,0.35)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }}
            >
              <Text style={{ color: pillTextColor, fontSize: 11, fontWeight: '900', letterSpacing: 0.2 }}>
                {pillText}
              </Text>
            </LinearGradient>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  let globalIdx = 0;

  return (
    <>
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
            colors={['#9333EA', '#DB2777']}
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

      {visibleSections.length === 0 ? (
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
      ) : (
        <View style={{ paddingBottom: 10 }}>
          {visibleSections.map((sec) => (
            <View key={sec.title}>
              <SectionHeader text={sec.title} />
              {(() => {
                const normal = [];
                const fullWidth = [];
                const wide = [];
                for (const it of sec.items) {
                  if (it.wide) wide.push(it);
                  else if (it.fullWidth) fullWidth.push(it);
                  else normal.push(it);
                }
                const rows = [];
                for (let i = 0; i < normal.length; i += 2) rows.push(normal.slice(i, i + 2));

                return (
                  <View style={{ width: usableW, alignSelf: 'center' }}>
                    {rows.map((pair, rowIdx) => (
                      <View
                        key={`${sec.title}-row-${rowIdx}`}
                        style={{
                          flexDirection: 'row',
                          width: usableW,
                          alignSelf: 'center',
                          justifyContent: pair.length === 2 ? 'space-between' : 'center',
                          marginBottom: GRID_GAP,
                        }}
                      >
                        {pair.map((it) => {
                          globalIdx += 1;
                          return <PillCard key={it.id} item={it} accent={LOVABLE_ACCENTS[(globalIdx - 1) % LOVABLE_ACCENTS.length]} />;
                        })}
                      </View>
                    ))}
                    {fullWidth.map((it) => {
                      globalIdx += 1;
                      return <PillCard key={it.id} item={it} accent={LOVABLE_ACCENTS[(globalIdx - 1) % LOVABLE_ACCENTS.length]} />;
                    })}
                    {wide.map((it) => {
                      globalIdx += 1;
                      return <PillCard key={it.id} item={it} accent={LOVABLE_ACCENTS[(globalIdx - 1) % LOVABLE_ACCENTS.length]} />;
                    })}
                  </View>
                );
              })()}
            </View>
          ))}
        </View>
      )}
    </>
  );
}
