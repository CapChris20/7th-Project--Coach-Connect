// Design Law “New plan” body (workouts PNG 13–16): AI list rows or ask-trainer form.
// Flow: NbSegmented → profile HardShadow list / trainer request → usage banner + Generate.
// Building state is BuildingYourPlanView (PNG 15). Parent owns edit/generate/send-request.

import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NbSegmented from '../../look-and-feel/NbSegmented';
import NbButton from '../../look-and-feel/NbButton';
import NbPill from '../../look-and-feel/NbPill';
import NbIconChip from '../../look-and-feel/NbIconChip';
import HardShadow from '../../look-and-feel/HardShadow';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { accentGradients, borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';
import {
  displayForFieldKey,
  formatProfileHeightDisplay,
} from './planQuestionLabels';

// ===== NAMED CONSTANTS =====

// Manipulate here: PNG 13 row order — Age → … → Hydration
const NEW_PLAN_ROWS = [
  {
    id: 'age',
    label: 'Age',
    helper: 'personal info',
    editKey: 'personalInfo',
    icon: require('../../assets/icons/handoff/age.png'),
    accentIndex: 0,
    valueFrom: (data) =>
      data?.age != null && data?.age !== '' ? String(data.age) : '—',
  },
  {
    id: 'height',
    label: 'Height',
    helper: 'personal info',
    editKey: 'personalInfo',
    icon: require('../../assets/icons/handoff/height.png'),
    accentIndex: 3,
    valueFrom: (data) => formatProfileHeightDisplay(data?.height),
  },
  {
    id: 'goal',
    label: 'Goal',
    helper: 'primary goal',
    editKey: 'goal',
    icon: require('../../assets/icons/handoff/journey.png'),
    accentIndex: 6,
    valueFrom: (data) => displayForFieldKey('goal', data),
  },
  {
    id: 'level',
    label: 'Level',
    helper: 'training status',
    editKey: 'fitnessLevel',
    icon: require('../../assets/icons/handoff/inter.png'),
    accentIndex: 1,
    valueFrom: (data) => displayForFieldKey('fitnessLevel', data),
  },
  {
    id: 'frequency',
    label: 'Frequency',
    helper: 'weekly sessions',
    editKey: 'frequency',
    icon: require('../../assets/icons/handoff/week.png'),
    accentIndex: 4,
    valueFrom: (data) => {
      const raw = displayForFieldKey('frequency', data);
      // Shorten “4 days per week” → “4 days” to match PNG sample
      return String(raw || '—').replace(/\s*per\s*week/i, '').trim() || '—';
    },
  },
  {
    id: 'environment',
    label: 'Environment',
    helper: 'training place',
    editKey: 'trainingEnvironment',
    icon: require('../../assets/icons/handoff/gym.png'),
    accentIndex: 7,
    valueFrom: (data) => displayForFieldKey('trainingEnvironment', data),
  },
  {
    id: 'equipment',
    label: 'Equipment',
    helper: 'available tools',
    editKey: 'equipment',
    icon: require('../../assets/icons/handoff/dumbbells.png'),
    accentIndex: 2,
    valueFrom: (data) => {
      const list = data?.equipmentAccess;
      if (Array.isArray(list) && list.length > 0) {
        return `${list.length} selected`;
      }
      return displayForFieldKey('equipment', data);
    },
  },
  {
    id: 'injuries',
    label: 'Injuries',
    helper: 'limitations',
    editKey: 'injuries',
    icon: require('../../assets/icons/handoff/injury.png'),
    accentIndex: 5,
    valueFrom: (data) => displayForFieldKey('injuries', data),
  },
  {
    id: 'energy',
    label: 'Energy',
    helper: 'daily energy',
    editKey: 'energyLevels',
    icon: require('../../assets/icons/handoff/energy.png'),
    accentIndex: 8,
    valueFrom: (data) => displayForFieldKey('energyLevels', data),
  },
  {
    id: 'hydration',
    label: 'Hydration',
    helper: 'water habits',
    editKey: 'hydrationHabits',
    icon: require('../../assets/icons/handoff/hydration.png'),
    accentIndex: 10,
    valueFrom: (data) => {
      const raw = displayForFieldKey('hydrationHabits', data);
      // PNG sample: “4-8 cups”
      return String(raw || '—')
        .replace(/cups\/day/gi, 'cups')
        .replace(/–/g, '-')
        .replace(/Less than/i, '<')
        .replace(/More than/i, '>')
        .trim();
    },
  },
];

const SEGMENTS = [
  { id: 'ai', label: 'Build with AI' },
  { id: 'trainer', label: 'Ask my trainer' },
];

const ICON_CHIP_SIZE = 40;

// ===== HELPER FUNCTIONS =====

function levelIconSource(onboardingData) {
  const level = String(onboardingData?.fitnessLevel || '').toLowerCase();
  if (level.includes('begin')) return require('../../assets/icons/handoff/beginner.png');
  if (level.includes('adv')) return require('../../assets/icons/handoff/adv.png');
  return require('../../assets/icons/handoff/inter.png');
}

/**
 * One PNG list row: gradient icon chip | label+helper | value | chevron.
 */
function ProfileFactRow({
  label,
  helper,
  value,
  iconSource,
  accentIndex,
  isLast,
  colors,
  onPress,
  readOnly,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={readOnly || typeof onPress !== 'function'}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={[
        styles.row,
        !isLast && {
          borderBottomWidth: nb.borderWidthDivider,
          borderBottomColor: colors.nbBorder,
        },
      ]}
    >
      <NbIconChip
        source={iconSource}
        size={ICON_CHIP_SIZE}
        index={accentIndex}
        colors={accentGradients[accentIndex % accentGradients.length]}
      />
      <View style={styles.rowGrow}>
        <Text style={[styles.rowLabel, { color: colors.nbInk }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.rowHelper, { color: colors.nbMuted }]} numberOfLines={1}>
          {helper}
        </Text>
      </View>
      <Text style={[styles.rowValue, { color: colors.nbInk }]} numberOfLines={1}>
        {value || '—'}
      </Text>
      <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * @param {object} props
 * @param {'ai'|'trainer'} props.sourceTab
 * @param {Function} props.onSourceTabChange
 * @param {object} props.onboardingData
 * @param {boolean} props.isDark
 * @param {boolean} props.readOnly
 * @param {boolean} props.isCoachViewingClientProfile
 * @param {string} [props.trainerDisplayName]
 * @param {string} props.requestText
 * @param {Function} props.onChangeRequestText
 * @param {boolean} props.sendingRequest
 * @param {boolean} props.hasTrainer
 * @param {Function} props.onSendTrainerRequest
 * @param {Function} props.onEnableAi
 * @param {Function} props.onGoHome
 * @param {boolean} props.aiOn
 * @param {boolean} props.aiPrefReady
 * @param {Function} props.onEditField — (editKey) => void
 * @param {number} props.plansUsedThisMonth
 * @param {number} props.planGenerationLimit
 * @param {number} props.plansRemaining
 * @param {string} props.resetLabel
 * @param {boolean} props.isGenerating
 * @param {boolean} props.hasGeneratedPlan
 * @param {Function} props.onGenerate
 * @param {Function} props.onOpenPlan
 * @param {Function} props.onRegenerate
 * @param {string|null} props.generationError
 * @param {Function} props.onRetryGenerate
 * @param {object} [props.contentContainerStyle]
 */
export default function NewPlanDesignLawPanel({
  sourceTab,
  onSourceTabChange,
  onboardingData,
  readOnly = false,
  isCoachViewingClientProfile = false,
  trainerDisplayName = 'Your trainer',
  requestText,
  onChangeRequestText,
  sendingRequest = false,
  hasTrainer = false,
  onSendTrainerRequest,
  onEnableAi,
  onGoHome,
  aiOn = true,
  aiPrefReady = true,
  onEditField,
  plansUsedThisMonth = 0,
  planGenerationLimit = 3,
  plansRemaining = 0,
  resetLabel = 'next month',
  isGenerating = false,
  hasGeneratedPlan = false,
  onGenerate,
  onOpenPlan,
  onRegenerate,
  generationError = null,
  onRetryGenerate,
  contentContainerStyle,
}) {
  const { colors } = useTheme();

  const rows = useMemo(() => {
    return NEW_PLAN_ROWS.map((row) => {
      const iconSource =
        row.id === 'level' ? levelIconSource(onboardingData) : row.icon;
      return {
        ...row,
        iconSource,
        value: row.valueFrom(onboardingData),
      };
    });
  }, [onboardingData]);

  const leftLabel = plansRemaining <= 0 ? '0 left' : `${plansRemaining} left`;
  const canEdit = !readOnly && !isCoachViewingClientProfile;

  const openField = (editKey) => {
    if (!canEdit) return;
    onEditField?.(editKey);
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={[styles.scroll, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* PNG: Build with AI | Ask my trainer — selected cell = solid fill */}
      <NbSegmented
        segments={SEGMENTS}
        selected={sourceTab}
        onSelect={onSourceTabChange}
        style={styles.segmented}
      />

      {sourceTab === 'trainer' ? (
        <View style={styles.trainerBlock}>
          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
            <View
              style={[
                styles.trainerCard,
                { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
              ]}
            >
              <View
                style={[
                  styles.trainerAvatar,
                  { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
                ]}
              >
                <Text style={[styles.trainerInitials, { color: colors.nbInk }]}>
                  {String(trainerDisplayName || 'T')
                    .split(/\s+/)
                    .map((w) => w[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase() || 'T'}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.trainerName, { color: colors.nbInk }]} numberOfLines={1}>
                  {trainerDisplayName || 'Your trainer'}
                </Text>
                <Text style={[styles.trainerSub, { color: colors.nbMuted }]}>Your trainer</Text>
              </View>
            </View>
          </HardShadow>

          {!hasTrainer ? (
            <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={{ marginTop: 16 }}>
              <View
                style={[
                  styles.trainerCard,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder, flexDirection: 'column', alignItems: 'stretch' },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.nbInk, fontSize: 18 }]}>
                  You need a trainer first
                </Text>
                <Text style={[styles.sectionSub, { color: colors.nbMuted, marginTop: 8 }]}>
                  Connect with a trainer to receive custom workout plans, or enable AI features in Settings.
                </Text>
                <View style={{ marginTop: 14, gap: 10 }}>
                  {typeof onEnableAi === 'function' ? (
                    <NbButton variant="fill" onPress={onEnableAi}>
                      Enable AI Features
                    </NbButton>
                  ) : null}
                  {typeof onGoHome === 'function' ? (
                    <NbButton variant="plain" onPress={onGoHome}>
                      Go Home
                    </NbButton>
                  ) : null}
                </View>
              </View>
            </HardShadow>
          ) : (
            <>
              <Text style={[styles.fieldLabel, { color: colors.nbMuted }]}>
                WHAT KIND OF PLAN DO YOU WANT?
              </Text>
              <HardShadow radius={borderRadius.nbInput} offset={nb.shadowOffsetSmall}>
                <TextInput
                  value={requestText}
                  onChangeText={onChangeRequestText}
                  placeholder="Tell your trainer what you want…"
                  placeholderTextColor={colors.nbMuted}
                  multiline
                  editable={!isCoachViewingClientProfile}
                  style={[
                    styles.requestInput,
                    {
                      color: colors.nbInk,
                      backgroundColor: colors.nbSurface,
                      borderColor: colors.nbBorder,
                    },
                  ]}
                />
              </HardShadow>
              <NbButton
                variant="fill"
                onPress={onSendTrainerRequest}
                disabled={sendingRequest || isCoachViewingClientProfile}
                style={{ marginTop: 14 }}
              >
                {sendingRequest ? 'Sending…' : 'Send request'}
              </NbButton>
              <Text style={[styles.leaveHint, { color: colors.nbMuted, marginTop: 12 }]}>
                Clients send plan requests from their account. Your trainer builds it and it lands in Saved plans.
              </Text>
            </>
          )}
        </View>
      ) : (
        <View style={styles.aiBlock}>
          {!aiPrefReady ? (
            <Text style={[styles.sectionSub, { color: colors.nbMuted }]}>Loading AI settings…</Text>
          ) : !aiOn ? (
            <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
              <View
                style={[
                  styles.trainerCard,
                  {
                    backgroundColor: colors.nbSurface,
                    borderColor: colors.nbBorder,
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  },
                ]}
              >
                <Text style={[styles.sectionTitle, { color: colors.nbInk, fontSize: 18 }]}>
                  AI is off
                </Text>
                <Text style={[styles.sectionSub, { color: colors.nbMuted, marginTop: 8 }]}>
                  Turn on AI features in Settings, or switch to Ask my trainer.
                </Text>
                {typeof onEnableAi === 'function' ? (
                  <NbButton variant="fill" onPress={onEnableAi} style={{ marginTop: 14 }}>
                    Open Settings
                  </NbButton>
                ) : null}
              </View>
            </HardShadow>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.nbInk }]}>Built from your profile</Text>
              <Text style={[styles.sectionSub, { color: colors.nbMuted }]}>
                Tap anything that looks wrong and fix it before you generate.
              </Text>

              {/* Single HardShadow card — list of fact rows (NOT 2-col cards) */}
              <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={{ marginTop: 14 }}>
                <View
                  style={[
                    styles.listCard,
                    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                  ]}
                >
                  {rows.map((row, index) => (
                    <ProfileFactRow
                      key={row.id}
                      label={row.label}
                      helper={row.helper}
                      value={row.value}
                      iconSource={row.iconSource}
                      accentIndex={row.accentIndex}
                      isLast={index === rows.length - 1}
                      colors={colors}
                      readOnly={!canEdit}
                      onPress={() => openField(row.editKey)}
                    />
                  ))}
                </View>
              </HardShadow>

              {generationError ? (
                <View
                  style={[
                    styles.errorBanner,
                    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
                  ]}
                >
                  <Text style={[styles.errorText, { color: colors.nbInk }]}>{generationError}</Text>
                  <TouchableOpacity onPress={onRetryGenerate} hitSlop={8}>
                    <Text style={[styles.retryText, { color: colors.nbInk }]}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : null}

              {!isCoachViewingClientProfile ? (
                <HardShadow
                  radius={borderRadius.nbCard}
                  offset={nb.shadowOffsetCard}
                  style={{ marginTop: 16 }}
                >
                  <View
                    style={[
                      styles.usageCard,
                      { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                    ]}
                  >
                    <View style={{ flex: 1, minWidth: 0, paddingRight: 10 }}>
                      <Text style={[styles.usageTitle, { color: colors.nbInk }]}>
                        {plansUsedThisMonth} of {planGenerationLimit} plans used this month
                      </Text>
                      <Text style={[styles.usageSub, { color: colors.nbMuted }]}>
                        Resets on {resetLabel}
                      </Text>
                    </View>
                    <NbPill variant="brand">{leftLabel}</NbPill>
                  </View>
                </HardShadow>
              ) : null}

              <View style={{ marginTop: 14 }}>
                {hasGeneratedPlan ? (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <NbButton variant="fill" onPress={onOpenPlan} style={{ flex: 1 }}>
                      Open Plan
                    </NbButton>
                    <NbButton
                      variant="plain"
                      onPress={onRegenerate}
                      disabled={isGenerating}
                      style={{ flex: 1 }}
                    >
                      {isGenerating ? 'Generating…' : 'Generate New'}
                    </NbButton>
                  </View>
                ) : (
                  <NbButton variant="fill" onPress={onGenerate} disabled={isGenerating || !aiOn}>
                    {isGenerating ? 'Generating…' : 'Generate plan'}
                  </NbButton>
                )}
              </View>
            </>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 0,
  },
  segmented: {
    marginBottom: 16,
  },
  aiBlock: {
    flexGrow: 1,
  },
  trainerBlock: {
    flexGrow: 1,
  },
  sectionTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  sectionSub: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginTop: 6,
  },
  listCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  rowGrow: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  rowHelper: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '800',
    maxWidth: '36%',
    textAlign: 'right',
  },
  usageCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usageTitle: {
    fontSize: 14,
    fontWeight: '900',
  },
  usageSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  trainerCard: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trainerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainerInitials: {
    fontSize: 14,
    fontWeight: '900',
  },
  trainerName: {
    fontSize: 16,
    fontWeight: '900',
  },
  trainerSub: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 8,
  },
  requestInput: {
    minHeight: 120,
    borderRadius: borderRadius.nbInput,
    borderWidth: nb.borderWidth,
    padding: 14,
    textAlignVertical: 'top',
    fontSize: 15,
    fontWeight: '500',
  },
  leaveHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  errorBanner: {
    marginTop: 14,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
  },
  retryText: {
    fontSize: 13,
    fontWeight: '900',
  },
});
