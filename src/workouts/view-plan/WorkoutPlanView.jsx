// Full-screen workout-plan viewer: loading, error, empty, or the weekly plan + optional PDF.
// Flow: normalize structured JSON → pick rows from route / planText / days → one of four screens.
// Used by the workout-plan flow. Chrome (header, bottom nav, save-to-library) stays in this file.
// Read order: constants → layout screens → main → PLUMBING (row normalize / palette / back).

import React from 'react';
import {
  ActivityIndicator,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import MyWorkoutPlanScreen from '../../client-app/workout-plans/MyWorkoutPlanScreen';
import PlanPdfViewer from './PlanPdfViewer';
import { planViewerRefStyles } from './planViewPieces';
import {
  tryParseJsonObject,
  normalizeStructuredPlanForViewer,
  structuredPlanHasViewerContent,
  normalizeRouteWorkoutPlanItem,
  mapStructuredDaysToPlanViewerRows,
  PLAN_BUILDER_COLORS,
} from '../create-plan/readPlanText';
import {
  lightColors,
  darkColors,
  gradients,
  nb,
  spacing,
  accentGradients,
} from '../../look-and-feel/colorPalette';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';

const HANDOFF_WORKOUT = require('../../assets/icons/handoff/workout.png');
const HANDOFF_JOURNEY = require('../../assets/icons/handoff/journey.png');

// ===== NAMED CONSTANTS =====

// Manipulate here: default weeks label when Firestore did not store durationWeeks.
const DEFAULT_PLAN_WEEKS = 4;
const DEFAULT_FOCUS = 'Complete muscle building program';
const DEFAULT_HERO_TITLE = 'Your Workout Plan';
const BACK_CHIP_SIZE = 44;
const EMPTY_ICON_CHIP_SIZE = 56;
const JOURNEY_ICON_CHIP_SIZE = 44;
const EMPTY_ROW_MIN_HEIGHT = 64;

// ===== HELPER FUNCTIONS =====

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  return maybeFunction(...args);
}

function GeneratingPlanScreen({ styles, palette, onBack, renderWorkoutChromeHeader }) {
  const goBack = () => callIfFunction(onBack);
  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      {renderWorkoutChromeHeader({ onBack: goBack })}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <ActivityIndicator size="large" color={PLAN_BUILDER_COLORS.pink} />
        <Text style={[planViewerRefStyles.loaderText, { color: palette.text, textAlign: 'center' }]}>
          Building your workout plan…
        </Text>
        <Text
          style={[
            planViewerRefStyles.loaderText,
            { color: palette.muted, fontSize: 14, marginTop: 10, textAlign: 'center' },
          ]}
        >
          You can go back — we will notify you when your plan is ready.
        </Text>
      </View>
    </View>
  );
}

function PlanStructureLoadingScreen({ styles, palette }) {
  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={PLAN_BUILDER_COLORS.pink} />
        <Text style={[planViewerRefStyles.loaderText, { color: palette.text }]}>
          Loading your workout plan...
        </Text>
      </View>
    </View>
  );
}

function PlanStructureErrorScreen({ styles, palette, hasRouteWorkoutPlanParam, onBack }) {
  let errorMessage = 'No workout plan provided';
  if (hasRouteWorkoutPlanParam) {
    errorMessage = 'Invalid workout plan structure received';
  }

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      <View style={{ flex: 1 }}>
        <View style={planViewerRefStyles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color={PLAN_BUILDER_COLORS.pink} />
          <Text style={[planViewerRefStyles.errorTitle, { color: palette.text }]}>Error</Text>
          <Text style={[planViewerRefStyles.errorMessage, { color: palette.muted }]}>
            {errorMessage}
          </Text>
          <TouchableOpacity
            onPress={() => callIfFunction(onBack)}
            style={[planViewerRefStyles.errorButton, { backgroundColor: PLAN_BUILDER_COLORS.pink }]}
          >
            <Text style={planViewerRefStyles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/**
 * empty-vs-data PNG 05 — Design Law empty “My workout plan” shell.
 */
function EmptyPlanScreen({ styles, palette, onBack, onNavigate }) {
  const openPlanBuilder = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('create');
      return;
    }
    callIfFunction(onBack);
  };
  const openTrainerMessages = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('messages');
      return;
    }
    callIfFunction(onBack);
  };
  const openWorkoutVideos = () => {
    if (typeof onNavigate === 'function') {
      onNavigate('workout');
      return;
    }
    callIfFunction(onBack);
  };

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      <View style={{ flex: 1, paddingHorizontal: nb.screenGutter, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => callIfFunction(onBack)}
            style={{
              width: BACK_CHIP_SIZE,
              height: BACK_CHIP_SIZE,
              borderRadius: 12,
              borderWidth: nb.borderWidth,
              borderColor: palette.text,
              backgroundColor: palette.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={22} color={palette.text} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>
              My workout plan
            </Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.muted, marginTop: 2 }}>
              No plan yet
            </Text>
          </View>
        </View>

        <View
          style={{
            borderWidth: nb.borderWidth,
            borderStyle: 'dashed',
            borderColor: palette.text,
            borderRadius: 12,
            padding: 16,
            gap: 12,
            backgroundColor: palette.surface,
            marginBottom: spacing.md,
          }}
        >
          <NbIconChip source={HANDOFF_WORKOUT} index={0} size={EMPTY_ICON_CHIP_SIZE} />
          <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>
            No plan saved yet.
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 }}>
            Build one from your profile with AI, or ask your trainer to write it.
          </Text>
          <NbButton variant="fill" onPress={openPlanBuilder}>
            Build with AI
          </NbButton>
          <NbButton variant="ghost" onPress={openTrainerMessages}>
            Ask my trainer
          </NbButton>
        </View>

        <View
          style={{
            borderWidth: nb.borderWidth,
            borderColor: palette.text,
            borderRadius: 10,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            backgroundColor: palette.surface,
            marginBottom: 12,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '900', color: palette.text }}>
              3 AI plans a month
            </Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: palette.muted, marginTop: 2 }}>
              You have used 0 so far
            </Text>
          </View>
          <View
            style={{
              overflow: 'hidden',
              borderWidth: nb.borderWidth,
              borderColor: palette.text,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <LinearGradient
              colors={accentGradients[2]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
            />
            <Text style={{ fontSize: 12, fontWeight: '900', color: lightColors.nbInk }}>3 left</Text>
          </View>
        </View>

        <HardShadow offset={nb.shadowOffsetSmall} radius={10}>
          <TouchableOpacity
            onPress={openWorkoutVideos}
            activeOpacity={0.88}
            style={{
              borderWidth: nb.borderWidth,
              borderColor: palette.text,
              borderRadius: 10,
              padding: 12,
              minHeight: EMPTY_ROW_MIN_HEIGHT,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: palette.surface,
            }}
          >
            <NbIconChip source={HANDOFF_JOURNEY} index={1} size={JOURNEY_ICON_CHIP_SIZE} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: palette.text }}>
                Browse exercise videos
              </Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.muted }}>
                Works without a plan
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          </TouchableOpacity>
        </HardShadow>
      </View>
      <WorkoutPlanBottomNav onNavigate={onNavigate} onBack={onBack} />
    </View>
  );
}

function SaveToLibraryButton({
  readOnly,
  generatedPlan,
  addedToCollection,
  savingToCollection,
  handleAddToCollection,
}) {
  if (readOnly || !generatedPlan) return null;

  let gradientColors = gradients.ink.colors;
  let buttonLabel = 'Save to Library';
  let iconName = 'bookmark-outline';
  let buttonOpacity = 1;
  if (addedToCollection) {
    gradientColors = gradients.energy.colors;
    buttonLabel = 'Saved to Library';
    iconName = 'checkmark-circle';
    buttonOpacity = 0.7;
  }

  let leadingIcon;
  if (savingToCollection) {
    leadingIcon = <ActivityIndicator size="small" color={lightColors.white} />;
  } else {
    leadingIcon = <Ionicons name={iconName} size={18} color={lightColors.white} />;
  }

  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handleAddToCollection}
        disabled={addedToCollection || savingToCollection}
        style={{ borderRadius: 16, overflow: 'hidden', opacity: buttonOpacity }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            paddingVertical: 14,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            borderRadius: 16,
          }}
        >
          {leadingIcon}
          <Text
            style={{
              color: lightColors.white,
              fontSize: 15,
              fontFamily: 'SpaceGrotesk_700Bold',
            }}
          >
            {buttonLabel}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function WorkoutPlanBottomNav({ onNavigate, onBack }) {
  const goHome = () => {
    if (onNavigate) {
      onNavigate('home');
      return;
    }
    callIfFunction(onBack);
  };
  const goProfile = () => {
    if (onNavigate) onNavigate('profile');
  };
  const goCreate = () => {
    if (onNavigate) onNavigate('create');
  };
  const goVoice = () => {
    if (onNavigate) onNavigate('voice');
  };
  const goNutrition = () => {
    if (onNavigate) onNavigate('nutrition');
  };
  const goWorkout = () => {
    if (onNavigate) onNavigate('workout');
  };
  const goMessages = () => {
    if (onNavigate) onNavigate('messages');
  };

  return (
    <ShellBottomNavAnchor>
      <BottomMenuBar
        onHomePress={goHome}
        onProfilePress={goProfile}
        onPlusPress={goCreate}
        onVoicePress={goVoice}
        onNutritionPress={goNutrition}
        onWorkoutPress={goWorkout}
        onMessagesPress={goMessages}
        activeTabKey="workout"
      />
    </ShellBottomNavAnchor>
  );
}

/**
 * Session payload for "Start" on a non-rest day.
 */
function sessionPayloadFromDay(day) {
  const focusBits = String(day.focus || '')
    .split(/\s*·\s*/)
    .filter(Boolean);
  let workoutName = 'Workout';
  if (focusBits[0]) {
    workoutName = focusBits[0];
  } else {
    const dayLabel = String(day.day || day.short || 'Workout').trim();
    if (dayLabel) workoutName = dayLabel;
  }
  const exercises = Array.isArray(day.exercises) ? day.exercises : [];
  return { workoutName, exercises };
}

// ===== MAIN FUNCTION =====

/**
 * Weekly plan viewer. Early returns cover generating / bad structure / empty before the live plan UI.
 * Hook order: useColorScheme only — do not reorder or add hooks above it without checking callers.
 */
export default function WorkoutPlanView({
  generatedPlan,
  readOnly,
  route,
  isGenerating,
  viewerErrorDelayElapsed,
  isDark: deprecatedIsDark,
  onBack,
  onNavigate,
  onProfilePress,
  onSettingsPress,
  onStartSession,
  setShowFullPlan,
  planSubViewBackRef,
  planSubViewActiveRef,
  showPdfViewer,
  pdfLocalUri,
  pdfDownloadUrl,
  collectionViewingPlan,
  planTitleForPdf,
  setShowPdfViewer,
  setCollectionViewingPlan,
  addedToCollection,
  savingToCollection,
  handleAddToCollection,
  renderWorkoutChromeHeader,
  styles,
}) {
  const colorScheme = useColorScheme();
  const themeColors = colorScheme === 'dark' ? darkColors : lightColors;
  const isDarkMode = colorScheme === 'dark';
  const palette = planViewerPalette(themeColors);

  // 1. Parse structured plan text (JSON in planText or structuredPlan on the doc).
  const structuredRaw = structuredRawFromPlan(generatedPlan);
  const structured = normalizeStructuredPlanForViewer(structuredRaw);

  // 2. Derive hero copy, weeks, focus, and notes-tab fields for MyWorkoutPlanScreen.
  const overviewText = overviewTextFromPlan(generatedPlan, structured, structuredRaw);
  const planViewerWeeks = weeksRemainingFromPlan(structuredRaw, structured);
  const planViewerFocus = focusFromPlan(structuredRaw, structured);
  const planHeroTitle = heroTitleFromPlan(structuredRaw, structured, generatedPlan);
  const notesFields = notesFieldsFromPlan(structuredRaw, structured);

  // 3. Build day rows — route param wins over embedded JSON.
  const routeParams = route && route.params ? route.params : null;
  const routeWorkoutPlan = routeParams ? routeParams.workoutPlan : undefined;
  const hasRouteWorkoutPlanParam = !!(
    routeParams && Object.prototype.hasOwnProperty.call(routeParams, 'workoutPlan')
  );
  const workoutPlanRows = workoutPlanRowsFromSources({
    routeWorkoutPlan,
    structuredRaw,
    structured,
  });
  const planTextRaw = generatedPlan ? generatedPlan.planText : undefined;
  const { viewerStructureError, viewerEmpty } = viewerDisplayFlags({
    routeWorkoutPlan,
    hasRouteWorkoutPlanParam,
    workoutPlanRows,
    planTextRaw,
    structured,
  });

  // 4. AI still generating (read-only mode) → spinner with back affordance.
  if (isGenerating && readOnly) {
    return (
      <GeneratingPlanScreen
        styles={styles}
        palette={palette}
        onBack={onBack}
        renderWorkoutChromeHeader={renderWorkoutChromeHeader}
      />
    );
  }

  // 5. Bad structure while read-only — brief loading beat, then hard error screen.
  if (viewerStructureError && readOnly && !viewerErrorDelayElapsed) {
    return <PlanStructureLoadingScreen styles={styles} palette={palette} />;
  }
  if (viewerStructureError) {
    return (
      <PlanStructureErrorScreen
        styles={styles}
        palette={palette}
        hasRouteWorkoutPlanParam={hasRouteWorkoutPlanParam}
        onBack={onBack}
      />
    );
  }

  // 6. Nothing to show → Design Law empty shell.
  if (viewerEmpty) {
    return (
      <EmptyPlanScreen
        styles={styles}
        palette={palette}
        onBack={onBack}
        onNavigate={onNavigate}
      />
    );
  }

  const onPlanHeaderBack = () =>
    handlePlanHeaderBack({ planSubViewBackRef, readOnly, onBack, setShowFullPlan });

  const onStartWorkoutSession = (day) => {
    if (typeof onStartSession !== 'function' || !day || day.rest) return;
    onStartSession(sessionPayloadFromDay(day));
  };

  let pdfDownloadUrlForViewer = pdfDownloadUrl;
  if (collectionViewingPlan) {
    pdfDownloadUrlForViewer = collectionViewingPlan.url;
  }
  let pdfTitleForViewer = planTitleForPdf;
  if (collectionViewingPlan) {
    pdfTitleForViewer = collectionViewingPlan.planTitle;
  }

  const statusBarStyle = isDarkMode ? 'light-content' : 'dark-content';

  const closePdfViewer = () => {
    setShowPdfViewer(false);
    setCollectionViewingPlan(null);
  };

  const onSubViewActiveChange = (active) => {
    planSubViewActiveRef.current = !!active;
  };

  const openPdfViewer = () => {
    callIfFunction(setShowPdfViewer, true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1 }}>
        <StatusBar barStyle={statusBarStyle} />
        <MyWorkoutPlanScreen
          onBack={onPlanHeaderBack}
          onStartSession={onStartWorkoutSession}
          route={{
            params: {
              workoutPlan: workoutPlanRows,
              overview: overviewText,
              isDarkOverride: isDarkMode,
              weeksRemaining: planViewerWeeks,
              focusSummary: planViewerFocus,
              planHeroTitle: planHeroTitle,
              timeline: notesFields.timeline,
              importantNotes: notesFields.importantNotes,
              nutritionGuidance: notesFields.nutritionGuidance,
              onViewPdf: openPdfViewer,
              subViewBackRef: planSubViewBackRef,
              onSubViewActiveChange,
              reserveShellBottomNav: true,
            },
          }}
        />
        <PlanPdfViewer
          visible={showPdfViewer}
          pdfLocalUri={pdfLocalUri}
          pdfDownloadUrl={pdfDownloadUrlForViewer}
          planTitle={pdfTitleForViewer}
          isDark={isDarkMode}
          onClose={closePdfViewer}
        />
        <SaveToLibraryButton
          readOnly={readOnly}
          generatedPlan={generatedPlan}
          addedToCollection={addedToCollection}
          savingToCollection={savingToCollection}
          handleAddToCollection={handleAddToCollection}
        />
      </View>
      <WorkoutPlanBottomNav onNavigate={onNavigate} onBack={onBack} />
    </View>
  );
}

// ===== PLUMBING — skip unless debugging (row normalization, palette, header back stack) =====

function trimmedText(value) {
  if (!value) return '';
  return String(value).trim();
}

function structuredRawFromPlan(generatedPlan) {
  if (!generatedPlan) {
    return tryParseJsonObject(undefined);
  }
  if (generatedPlan.structuredPlan) {
    return generatedPlan.structuredPlan;
  }
  return tryParseJsonObject(generatedPlan.planText);
}

function overviewTextFromPlan(generatedPlan, structured, structuredRaw) {
  const fromStructured = structured ? trimmedText(structured.overview) : '';
  if (fromStructured) return fromStructured;
  const fromRaw = structuredRaw ? trimmedText(structuredRaw.overview) : '';
  if (fromRaw) return fromRaw;
  const fromGenerated = generatedPlan ? trimmedText(generatedPlan.planOverview) : '';
  return fromGenerated || '';
}

function weeksCandidateFromPlan(structuredRaw, structured) {
  if (structuredRaw && structuredRaw.weeksRemaining != null) {
    return structuredRaw.weeksRemaining;
  }
  if (structuredRaw && structuredRaw.durationWeeks != null) {
    return structuredRaw.durationWeeks;
  }
  if (structured && structured.weeksRemaining != null) {
    return structured.weeksRemaining;
  }
  return null;
}

function weeksRemainingFromPlan(structuredRaw, structured) {
  const weeksCandidate = weeksCandidateFromPlan(structuredRaw, structured);
  const weeksValue = Number(weeksCandidate);
  if (Number.isFinite(weeksValue) && weeksValue > 0) return Math.floor(weeksValue);
  return DEFAULT_PLAN_WEEKS;
}

function focusCandidateFromPlan(structuredRaw, structured) {
  if (structuredRaw && structuredRaw.programFocus) {
    return structuredRaw.programFocus;
  }
  if (structuredRaw && structuredRaw.focus) {
    return structuredRaw.focus;
  }
  if (structured && structured.focus) {
    return structured.focus;
  }
  return '';
}

function focusFromPlan(structuredRaw, structured) {
  return trimmedText(focusCandidateFromPlan(structuredRaw, structured)) || DEFAULT_FOCUS;
}

function heroTitleCandidateFromPlan(structuredRaw, structured, generatedPlan) {
  if (structuredRaw && structuredRaw.planTitle) {
    return structuredRaw.planTitle;
  }
  if (structured && structured.planTitle) {
    return structured.planTitle;
  }
  if (generatedPlan && generatedPlan.planTitle) {
    return generatedPlan.planTitle;
  }
  return '';
}

function heroTitleFromPlan(structuredRaw, structured, generatedPlan) {
  return trimmedText(heroTitleCandidateFromPlan(structuredRaw, structured, generatedPlan)) || DEFAULT_HERO_TITLE;
}

/**
 * Notes-tab fields from structured / legacy markdown keys — do not invent Firebase schema.
 */
function notesFieldsFromPlan(structuredRaw, structured) {
  const timeline =
    pickFirstTrimmed(
      structuredRaw && structuredRaw.timeline,
      structuredRaw && structuredRaw.expectedTimeline,
      structured && structured.timeline,
    ) || '';
  const importantNotes =
    pickFirstTrimmed(
      structuredRaw && structuredRaw.importantNotes,
      structuredRaw && structuredRaw.notes,
      structuredRaw && structuredRaw.generalNotes,
      structured && structured.notes,
    ) || '';
  const nutritionGuidance =
    pickFirstTrimmed(
      structuredRaw && structuredRaw.nutritionGuidance,
      structuredRaw && structuredRaw.nutrition,
      structuredRaw && structuredRaw.nutritionNotes,
      structured && structured.nutrition,
    ) || '';
  return { timeline, importantNotes, nutritionGuidance };
}

function pickFirstTrimmed(...candidates) {
  for (let index = 0; index < candidates.length; index += 1) {
    const trimmed = trimmedText(candidates[index]);
    if (trimmed) return trimmed;
  }
  return '';
}

function normalizedPlanRows(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const rows = [];
  for (let index = 0; index < items.length; index += 1) {
    const normalized = normalizeRouteWorkoutPlanItem(items[index], index);
    if (normalized) rows.push(normalized);
  }
  return rows;
}

/**
 * Row source order must stay: route param → structured.workoutPlan → structured.plan → day map.
 */
function workoutPlanRowsFromSources({ routeWorkoutPlan, structuredRaw, structured }) {
  const fromRoute = normalizedPlanRows(routeWorkoutPlan);
  if (fromRoute.length > 0) return fromRoute;

  const rawWorkoutPlan = structuredRaw ? structuredRaw.workoutPlan : null;
  const fromWorkoutPlan = normalizedPlanRows(rawWorkoutPlan);
  if (fromWorkoutPlan.length > 0) return fromWorkoutPlan;

  const rawPlan = structuredRaw ? structuredRaw.plan : null;
  const fromPlan = normalizedPlanRows(rawPlan);
  if (fromPlan.length > 0) return fromPlan;

  return mapStructuredDaysToPlanViewerRows(structured);
}

function planViewerPalette(colors) {
  return {
    background: colors.nbBackground,
    surface: colors.nbSurface,
    text: colors.nbInk,
    muted: colors.nbMuted,
  };
}

function viewerDisplayFlags({
  routeWorkoutPlan,
  hasRouteWorkoutPlanParam,
  workoutPlanRows,
  planTextRaw,
  structured,
}) {
  const hasPlanText = !!(planTextRaw && String(planTextRaw).trim());
  const looksLikeJson = /^\s*[\[{]/.test(String(planTextRaw || ''));
  const showMarkdownBody =
    workoutPlanRows.length === 0 &&
    hasPlanText &&
    !structuredPlanHasViewerContent(structured) &&
    !looksLikeJson;

  const routePlanIsEmptyArray =
    hasRouteWorkoutPlanParam &&
    (!Array.isArray(routeWorkoutPlan) || routeWorkoutPlan.length === 0);
  const rowsMissingAndTextIsJsonOrEmpty =
    workoutPlanRows.length === 0 && (!hasPlanText || looksLikeJson);

  const viewerStructureError = routePlanIsEmptyArray || rowsMissingAndTextIsJsonOrEmpty;
  const viewerEmpty =
    workoutPlanRows.length === 0 && !showMarkdownBody && !viewerStructureError;

  return { showMarkdownBody, viewerStructureError, viewerEmpty };
}

function handlePlanHeaderBack({ planSubViewBackRef, readOnly, onBack, setShowFullPlan }) {
  const subViewBack = planSubViewBackRef.current;
  if (typeof subViewBack === 'function') {
    const handled = subViewBack();
    if (handled) return;
  }
  if (readOnly) {
    callIfFunction(onBack);
    return;
  }
  setShowFullPlan(false);
}
