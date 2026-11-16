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

// Manipulate here: accentGradients slot per row icon chip (Design Law palette order)
const ACCENT_SLOT_AGE = 0;
const ACCENT_SLOT_HEIGHT = 3;
const ACCENT_SLOT_GOAL = 6;
const ACCENT_SLOT_LEVEL = 1;
const ACCENT_SLOT_FREQUENCY = 4;
const ACCENT_SLOT_ENVIRONMENT = 7;
const ACCENT_SLOT_EQUIPMENT = 2;

// Manipulate here: PNG 13 row order — Age → … → Hydration
const NEW_PLAN_ROWS = [
  {
    id: 'age',
    label: 'Age',
    helper: 'personal info',
    editKey: 'personalInfo',
    icon: require('../../assets/icons/handoff/age.png'),
    accentIndex: ACCENT_SLOT_AGE,
    valueFrom: (data) => {
      const ageMissing = data?.age == null || data?.age === '';
      if (ageMissing) return '—';
      return String(data.age);
    },
  },
  {
    id: 'height',
    label: 'Height',
    helper: 'personal info',
    editKey: 'personalInfo',
    icon: require('../../assets/icons/handoff/height.png'),
    accentIndex: ACCENT_SLOT_HEIGHT,
    valueFrom: (data) => formatProfileHeightDisplay(data?.height),
  },
  {
    id: 'goal',
    label: 'Goal',
    helper: 'primary goal',
    editKey: 'goal',
    icon: require('../../assets/icons/handoff/journey.png'),
    accentIndex: ACCENT_SLOT_GOAL,
    valueFrom: (data) => displayForFieldKey('goal', data),
  },
  {
    id: 'level',
    label: 'Level',
    helper: 'training status',
    editKey: 'fitnessLevel',
    icon: require('../../assets/icons/handoff/inter.png'),
    accentIndex: ACCENT_SLOT_LEVEL,
    valueFrom: (data) => displayForFieldKey('fitnessLevel', data),
  },
  {
    id: 'frequency',
    label: 'Frequency',
    helper: 'weekly sessions',
    editKey: 'frequency',
    icon: require('../../assets/icons/handoff/week.png'),
    accentIndex: ACCENT_SLOT_FREQUENCY,
    valueFrom: (data) => frequencyValueForNewPlanRow(data),
  },
  {
    id: 'environment',
    label: 'Environment',
    helper: 'training place',
    editKey: 'trainingEnvironment',
    icon: require('../../assets/icons/handoff/gym.png'),
    accentIndex: ACCENT_SLOT_ENVIRONMENT,
    valueFrom: (data) => displayForFieldKey('trainingEnvironment', data),
  },
  {
    id: 'equipment',
    label: 'Equipment',
    helper: 'available tools',
    editKey: 'equipment',
    icon: require('../../assets/icons/handoff/dumbbells.png'),
    accentIndex: ACCENT_SLOT_EQUIPMENT,
    valueFrom: (data) => equipmentValueForNewPlanRow(data),
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
    valueFrom: (data) => hydrationValueForNewPlanRow(data),
  },
];


const ICON_CHIP_SIZE = 40;
const EMPTY_VALUE_DASH = '—';
const TRAINER_INITIALS_FALLBACK = 'T';
const CHEVRON_SIZE = 18;

// ===== HELPER FUNCTIONS =====

/**
 * Frequency row: drop "per week" so the trailing value stays short on the list card.
 */
function frequencyValueForNewPlanRow(onboardingData) {
  const frequencyText = displayForFieldKey('frequency', onboardingData);
  const shortened = String(frequencyText || EMPTY_VALUE_DASH)
    .replace(/\s*per\s*week/i, '')
    .trim();
  return shortened || EMPTY_VALUE_DASH;
}

/**
 * Equipment row: show "N selected" when the client picked a list; else the field display string.
 */
function equipmentValueForNewPlanRow(onboardingData) {
  const equipmentList = onboardingData ? onboardingData.equipmentAccess : null;
  const hasSelectedGear = Array.isArray(equipmentList) && equipmentList.length > 0;
  if (hasSelectedGear) {
    return `${equipmentList.length} selected`;
  }
  return displayForFieldKey('equipment', onboardingData);
}

/**
 * Hydration row: shorten cups/day copy and inequality words for the trailing value.
 */
function hydrationValueForNewPlanRow(onboardingData) {
  const hydrationText = displayForFieldKey('hydrationHabits', onboardingData);
  return String(hydrationText || EMPTY_VALUE_DASH)
    .replace(/cups\/day/gi, 'cups')
    .replace(/–/g, '-')
    .replace(/Less than/i, '<')
    .replace(/More than/i, '>')
    .trim();
}

/**
 * Level row icon: beginner / advanced art when the text matches; else intermediate handoff art.
 */
function fitnessLevelIconSource(onboardingData) {
  const levelText = String((onboardingData && onboardingData.fitnessLevel) || '').toLowerCase();
  if (levelText.includes('begin')) {
    return require('../../assets/icons/handoff/beginner.png');
  }
  if (levelText.includes('adv')) {
    return require('../../assets/icons/handoff/adv.png');
  }
  return require('../../assets/icons/handoff/inter.png');
}

/**
 * Turn NEW_PLAN_ROWS defs into display rows with resolved icon + value for this onboarding snapshot.
 */
function buildProfileRowsForDisplay(onboardingData) {
  const displayRows = [];
  for (const rowDef of NEW_PLAN_ROWS) {
    const isLevelRow = rowDef.id === 'level';
    let iconSource = rowDef.icon;
    if (isLevelRow) {
      iconSource = fitnessLevelIconSource(onboardingData);
    }
    displayRows.push({
      ...rowDef,
      iconSource,
      value: rowDef.valueFrom(onboardingData),
    });
  }
  return displayRows;
}

/**
 * Two-letter initials from a trainer display name (fallback "T").
 */
function trainerInitialsFromName(trainerDisplayName) {
  const words = String(trainerDisplayName || TRAINER_INITIALS_FALLBACK).split(/\s+/);
  const firstLetters = [];
  for (const word of words) {
    if (word[0]) {
      firstLetters.push(word[0]);
    }
  }
  const twoLetters = firstLetters.join('').slice(0, 2).toUpperCase();
  if (twoLetters) {
    return twoLetters;
  }
  return TRAINER_INITIALS_FALLBACK;
}

/**
 * NbPill label for plans left this month.
 */
function remainingPlansPillLabel(plansRemaining) {
  if (plansRemaining <= 0) {
    return '0 left';
  }
  return `${plansRemaining} left`;
}

// ===== IN-FILE UI — PROFILE ROW =====

function NewPlanProfileFactRow({
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
  const canPress = !readOnly && typeof onPress === 'function';
  const accentColors = accentGradients[accentIndex % accentGradients.length];
  const displayValue = value || EMPTY_VALUE_DASH;

  const rowStyle = [styles.row];
  if (!isLast) {
    rowStyle.push({
      borderBottomWidth: nb.borderWidthDivider,
      borderBottomColor: colors.nbBorder,
    });
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!canPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      style={rowStyle}
    >
      <NbIconChip
        source={iconSource}
        size={ICON_CHIP_SIZE}
        index={accentIndex}
        colors={accentColors}
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
        {displayValue}
      </Text>
      <Ionicons name="chevron-forward" size={CHEVRON_SIZE} color={colors.nbMuted} />
    </TouchableOpacity>
  );
}

// ===== IN-FILE UI — TRAINER TAB =====

function TrainerIdentityCard({ colors, trainerDisplayName, trainerInitials }) {
  const cardSurfaceStyle = [
    styles.trainerCard,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const avatarStyle = [
    styles.trainerAvatar,
    { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
  ];
  const nameLine = trainerDisplayName || 'Your trainer';

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
      <View style={cardSurfaceStyle}>
        <View style={avatarStyle}>
          <Text style={[styles.trainerInitials, { color: colors.nbInk }]}>{trainerInitials}</Text>
        </View>
        <View style={styles.trainerNameColumn}>
          <Text style={[styles.trainerName, { color: colors.nbInk }]} numberOfLines={1}>
            {nameLine}
          </Text>
          <Text style={[styles.trainerSub, { color: colors.nbMuted }]}>Your trainer</Text>
        </View>
      </View>
    </HardShadow>
  );
}

function NeedTrainerFirstCard({ colors, onEnableAi, onGoHome }) {
  const cardStyle = [
    styles.trainerCard,
    {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder,
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  ];
  const canEnableAi = typeof onEnableAi === 'function';
  const canGoHome = typeof onGoHome === 'function';

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={{ marginTop: 16 }}>
      <View style={cardStyle}>
        <Text style={[styles.sectionTitle, { color: colors.nbInk, fontSize: 18 }]}>
          You need a trainer first
        </Text>
        <Text style={[styles.sectionSub, { color: colors.nbMuted, marginTop: 8 }]}>
          Connect with a trainer to receive custom workout plans, or enable AI features in Settings.
        </Text>
        <View style={styles.needTrainerActions}>
          {canEnableAi ? (
            <NbButton variant="fill" onPress={onEnableAi}>
              Enable AI Features
            </NbButton>
          ) : null}
          {canGoHome ? (
            <NbButton variant="plain" onPress={onGoHome}>
              Go Home
            </NbButton>
          ) : null}
        </View>
      </View>
    </HardShadow>
  );
}

function TrainerRequestForm({
  colors,
  requestText,
  onChangeRequestText,
  sendingRequest,
  isCoachViewingClientProfile,
  onSendTrainerRequest,
}) {
  const inputIsEditable = !isCoachViewingClientProfile;
  const sendIsDisabled = sendingRequest || isCoachViewingClientProfile;
  // Manipulate here: busy label while the request POST is in flight
  const sendButtonLabel = sendingRequest ? 'Sending…' : 'Send request';
  const inputStyle = [
    styles.requestInput,
    {
      color: colors.nbInk,
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder,
    },
  ];

  return (
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
          editable={inputIsEditable}
          style={inputStyle}
        />
      </HardShadow>
      <NbButton
        variant="fill"
        onPress={onSendTrainerRequest}
        disabled={sendIsDisabled}
        style={{ marginTop: 14 }}
      >
        {sendButtonLabel}
      </NbButton>
      <Text style={[styles.leaveHint, { color: colors.nbMuted, marginTop: 12 }]}>
        Clients send plan requests from their account. Your trainer builds it and it lands in Saved plans.
      </Text>
    </>
  );
}

function NewPlanTrainerTab({
  colors,
  trainerDisplayName,
  hasTrainer,
  requestText,
  onChangeRequestText,
  sendingRequest,
  isCoachViewingClientProfile,
  onSendTrainerRequest,
  onEnableAi,
  onGoHome,
}) {
  const trainerInitials = trainerInitialsFromName(trainerDisplayName);

  return (
    <View style={styles.trainerBlock}>
      <TrainerIdentityCard
        colors={colors}
        trainerDisplayName={trainerDisplayName}
        trainerInitials={trainerInitials}
      />

      {!hasTrainer ? (
        <NeedTrainerFirstCard colors={colors} onEnableAi={onEnableAi} onGoHome={onGoHome} />
      ) : (
        <TrainerRequestForm
          colors={colors}
          requestText={requestText}
          onChangeRequestText={onChangeRequestText}
          sendingRequest={sendingRequest}
          isCoachViewingClientProfile={isCoachViewingClientProfile}
          onSendTrainerRequest={onSendTrainerRequest}
        />
      )}
    </View>
  );
}

// ===== IN-FILE UI — AI TAB =====

function AiSettingsLoading({ colors }) {
  return (
    <View style={styles.aiBlock}>
      <Text style={[styles.sectionSub, { color: colors.nbMuted }]}>Loading AI settings…</Text>
    </View>
  );
}

function AiIsOffCard({ colors, onEnableAi }) {
  const cardStyle = [
    styles.trainerCard,
    {
      backgroundColor: colors.nbSurface,
      borderColor: colors.nbBorder,
      flexDirection: 'column',
      alignItems: 'stretch',
    },
  ];
  const canOpenSettings = typeof onEnableAi === 'function';

  return (
    <View style={styles.aiBlock}>
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
        <View style={cardStyle}>
          <Text style={[styles.sectionTitle, { color: colors.nbInk, fontSize: 18 }]}>AI is off</Text>
          <Text style={[styles.sectionSub, { color: colors.nbMuted, marginTop: 8 }]}>
            Turn on AI features in Settings, or switch to Ask my trainer.
          </Text>
          {canOpenSettings ? (
            <NbButton variant="fill" onPress={onEnableAi} style={{ marginTop: 14 }}>
              Open Settings
            </NbButton>
          ) : null}
        </View>
      </HardShadow>
    </View>
  );
}

function GenerationErrorBanner({ colors, generationError, onRetryGenerate }) {
  const bannerStyle = [
    styles.errorBanner,
    { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
  ];

  return (
    <View style={bannerStyle}>
      <Text style={[styles.errorText, { color: colors.nbInk }]}>{generationError}</Text>
      <TouchableOpacity onPress={onRetryGenerate} hitSlop={8}>
        <Text style={[styles.retryText, { color: colors.nbInk }]}>Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function MonthlyUsageBanner({
  colors,
  plansUsedThisMonth,
  planGenerationLimit,
  resetLabel,
  leftPillLabel,
}) {
  const usageCardStyle = [
    styles.usageCard,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const usageTitleText = `${plansUsedThisMonth} of ${planGenerationLimit} plans used this month`;

  return (
    <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={{ marginTop: 16 }}>
      <View style={usageCardStyle}>
        <View style={styles.usageCopyColumn}>
          <Text style={[styles.usageTitle, { color: colors.nbInk }]}>{usageTitleText}</Text>
          <Text style={[styles.usageSub, { color: colors.nbMuted }]}>Resets on {resetLabel}</Text>
        </View>
        <NbPill variant="brand">{leftPillLabel}</NbPill>
      </View>
    </HardShadow>
  );
}

function GeneratePlanActions({
  hasGeneratedPlan,
  isGenerating,
  aiOn,
  onGenerate,
  onOpenPlan,
  onRegenerate,
}) {
  // Manipulate here: busy labels while Claude is running
  const regenerateLabel = isGenerating ? 'Generating…' : 'Generate New';
  const firstGenerateLabel = isGenerating ? 'Generating…' : 'Generate plan';
  const firstGenerateDisabled = isGenerating || !aiOn;

  if (hasGeneratedPlan) {
    return (
      <View style={styles.twoButtonRow}>
        <NbButton variant="fill" onPress={onOpenPlan} style={{ flex: 1 }}>
          Open Plan
        </NbButton>
        <NbButton variant="plain" onPress={onRegenerate} disabled={isGenerating} style={{ flex: 1 }}>
          {regenerateLabel}
        </NbButton>
      </View>
    );
  }

  return (
    <NbButton variant="fill" onPress={onGenerate} disabled={firstGenerateDisabled}>
      {firstGenerateLabel}
    </NbButton>
  );
}

function NewPlanAiTab({
  colors,
  aiPrefReady,
  aiOn,
  profileRows,
  canEdit,
  onEditField,
  generationError,
  onRetryGenerate,
  isCoachViewingClientProfile,
  plansUsedThisMonth,
  planGenerationLimit,
  resetLabel,
  plansRemaining,
  hasGeneratedPlan,
  isGenerating,
  onGenerate,
  onOpenPlan,
  onRegenerate,
  onEnableAi,
}) {
  const leftPillLabel = remainingPlansPillLabel(plansRemaining);

  // Pref not loaded yet → short loading line (PNG waits on Settings flag)
  if (!aiPrefReady) {
    return <AiSettingsLoading colors={colors} />;
  }

  // AI off → Settings CTA (or switch segment to trainer)
  if (!aiOn) {
    return <AiIsOffCard colors={colors} onEnableAi={onEnableAi} />;
  }

  /**
   * Open the field editor for one list row.
   * Flow: 1. refuse when read-only  2. hand editKey to parent
   */
  const openFieldEditor = (editKey) => {
    // 1. Coach viewing / read-only → do nothing
    if (!canEdit) {
      return;
    }
    // 2. Parent opens EditModalForm for that onboarding key
    onEditField?.(editKey);
  };

  const listCardStyle = [
    styles.listCard,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const lastRowIndex = profileRows.length - 1;
  const showUsageBanner = !isCoachViewingClientProfile;

  return (
    <View style={styles.aiBlock}>
      <Text style={[styles.sectionTitle, { color: colors.nbInk }]}>Built from your profile</Text>
      <Text style={[styles.sectionSub, { color: colors.nbMuted }]}>
        Tap anything that looks wrong and fix it before you generate.
      </Text>

      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard} style={{ marginTop: 14 }}>
        <View style={listCardStyle}>
          {profileRows.map((row, index) => (
            <NewPlanProfileFactRow
              key={row.id}
              label={row.label}
              helper={row.helper}
              value={row.value}
              iconSource={row.iconSource}
              accentIndex={row.accentIndex}
              isLast={index === lastRowIndex}
              colors={colors}
              readOnly={!canEdit}
              onPress={() => openFieldEditor(row.editKey)}
            />
          ))}
        </View>
      </HardShadow>

      {generationError ? (
        <GenerationErrorBanner
          colors={colors}
          generationError={generationError}
          onRetryGenerate={onRetryGenerate}
        />
      ) : null}

      {showUsageBanner ? (
        <MonthlyUsageBanner
          colors={colors}
          plansUsedThisMonth={plansUsedThisMonth}
          planGenerationLimit={planGenerationLimit}
          resetLabel={resetLabel}
          leftPillLabel={leftPillLabel}
        />
      ) : null}

      <View style={{ marginTop: 14 }}>
        <GeneratePlanActions
          hasGeneratedPlan={hasGeneratedPlan}
          isGenerating={isGenerating}
          aiOn={aiOn}
          onGenerate={onGenerate}
          onOpenPlan={onOpenPlan}
          onRegenerate={onRegenerate}
        />
      </View>
    </View>
  );
}

// ===== IN-FILE UI — SOURCE SELECTOR =====

function PlanSourceOptionCard({
  isSelected,
  iconName,
  title,
  colors,
  onPress,
}) {
  const cardBackground = isSelected ? colors.nbFill : colors.nbSurface;
  const textColor = isSelected ? colors.nbOnFill : colors.nbInk;
  const iconColor = isSelected ? colors.nbOnFill : colors.nbInk;

  const cardStyle = [
    styles.sourceCard,
    {
      backgroundColor: cardBackground,
      borderColor: colors.nbBorder,
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <HardShadow
        radius={borderRadius.nbCard}
        offset={isSelected ? nb.shadowOffsetSmall : 0}
        style={{ width: '100%' }}
      >
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={onPress}
          style={cardStyle}
        >
          <Ionicons name={iconName} size={16} color={iconColor} style={{ marginRight: 6 }} />
          <Text style={[styles.sourceCardLabel, { color: textColor }]}>{title}</Text>
        </TouchableOpacity>
      </HardShadow>
    </View>
  );
}

function PlanSourceModeSelector({ sourceTab, onSourceTabChange, colors }) {
  const isAiSelected = sourceTab === 'ai';
  const isTrainerSelected = sourceTab === 'trainer';

  const selectAi = () => onSourceTabChange?.('ai');
  const selectTrainer = () => onSourceTabChange?.('trainer');

  return (
    <View style={styles.sourceSelectorRow}>
      <PlanSourceOptionCard
        isSelected={isAiSelected}
        iconName="sparkles"
        title="Build with AI"
        colors={colors}
        onPress={selectAi}
      />
      <PlanSourceOptionCard
        isSelected={isTrainerSelected}
        iconName="chatbubble-ellipses-outline"
        title="Ask my trainer"
        colors={colors}
        onPress={selectTrainer}
      />
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * New-plan body: AI profile list or ask-trainer form behind NbSegmented.
 * Parent owns generate / edit / send-request; this panel only paints Design Law chrome.
 */
export default function NewPlanPanel({
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
  // vocab: useTheme = Design Law color bag for the active light/dark mode
  const { colors } = useTheme();

  // vocab: useMemo = rebuild profile rows only when onboardingData identity changes
  const profileRows = useMemo(
    () => buildProfileRowsForDisplay(onboardingData),
    [onboardingData],
  );

  // Name the decisions before JSX
  const canEditProfileRows = !readOnly && !isCoachViewingClientProfile;
  const showTrainerTab = sourceTab === 'trainer';
  const scrollContentStyle = [styles.scroll, contentContainerStyle];

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={scrollContentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <PlanSourceModeSelector
        sourceTab={sourceTab}
        onSourceTabChange={onSourceTabChange}
        colors={colors}
      />

      {showTrainerTab ? (
        <NewPlanTrainerTab
          colors={colors}
          trainerDisplayName={trainerDisplayName}
          hasTrainer={hasTrainer}
          requestText={requestText}
          onChangeRequestText={onChangeRequestText}
          sendingRequest={sendingRequest}
          isCoachViewingClientProfile={isCoachViewingClientProfile}
          onSendTrainerRequest={onSendTrainerRequest}
          onEnableAi={onEnableAi}
          onGoHome={onGoHome}
        />
      ) : (
        <NewPlanAiTab
          colors={colors}
          aiPrefReady={aiPrefReady}
          aiOn={aiOn}
          profileRows={profileRows}
          canEdit={canEditProfileRows}
          onEditField={onEditField}
          generationError={generationError}
          onRetryGenerate={onRetryGenerate}
          isCoachViewingClientProfile={isCoachViewingClientProfile}
          plansUsedThisMonth={plansUsedThisMonth}
          planGenerationLimit={planGenerationLimit}
          resetLabel={resetLabel}
          plansRemaining={plansRemaining}
          hasGeneratedPlan={hasGeneratedPlan}
          isGenerating={isGenerating}
          onGenerate={onGenerate}
          onOpenPlan={onOpenPlan}
          onRegenerate={onRegenerate}
          onEnableAi={onEnableAi}
        />
      )}
    </ScrollView>
  );
}

// ===== STYLES =====

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 0,
  },
  sourceSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
    marginTop: 2,
  },
  sourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    paddingHorizontal: 10,
  },
  sourceCardLabel: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
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
  usageCopyColumn: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
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
  trainerNameColumn: {
    flex: 1,
    minWidth: 0,
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
  needTrainerActions: {
    marginTop: 14,
    gap: 10,
  },
  twoButtonRow: {
    flexDirection: 'row',
    gap: 10,
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
