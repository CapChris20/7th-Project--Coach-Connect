// Full-screen workout-plan viewer: loading, error, empty, or the weekly plan + optional PDF.
// Flow: normalize structured JSON → pick rows from route / planText / days → one of four screens.
// Used by the workout-plan flow. Chrome (header, bottom nav, save-to-library) stays in this file.

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
import { lightColors, darkColors, gradients, nb, spacing, accentGradients } from '../../look-and-feel/colorPalette';
import HardShadow from '../../look-and-feel/HardShadow';
import NbButton from '../../look-and-feel/NbButton';
import NbIconChip from '../../look-and-feel/NbIconChip';

const HANDOFF_WORKOUT = require('../../assets/icons/handoff/workout.png');
const HANDOFF_JOURNEY = require('../../assets/icons/handoff/journey.png');

// ===== NAMED CONSTANTS =====

const DEFAULT_PLAN_WEEKS = 4;
const DEFAULT_FOCUS = 'Complete muscle building program';
const DEFAULT_HERO_TITLE = 'Your Workout Plan';

// ===== HELPER FUNCTIONS =====

function trimmedText(value) {
  if (!value) return '';
  return String(value).trim();
}

function overviewTextFromPlan(generatedPlan, structured, structuredRaw) {
  return (
    trimmedText(structured?.overview) ||
    trimmedText(structuredRaw?.overview) ||
    trimmedText(generatedPlan?.planOverview) ||
    ''
  );
}

function weeksRemainingFromPlan(structuredRaw, structured) {
  const weeksValue = Number(
    structuredRaw?.weeksRemaining ?? structuredRaw?.durationWeeks ?? structured?.weeksRemaining,
  );
  if (Number.isFinite(weeksValue) && weeksValue > 0) return Math.floor(weeksValue);
  return DEFAULT_PLAN_WEEKS;
}

function focusFromPlan(structuredRaw, structured) {
  return (
    trimmedText(structuredRaw?.programFocus ?? structuredRaw?.focus ?? structured?.focus) ||
    DEFAULT_FOCUS
  );
}

function heroTitleFromPlan(structuredRaw, structured, generatedPlan) {
  return (
    trimmedText(structuredRaw?.planTitle ?? structured?.planTitle ?? generatedPlan?.planTitle) ||
    DEFAULT_HERO_TITLE
  );
}

/** Notes-tab fields from structured / legacy markdown keys — do not invent Firebase schema. */
function notesFieldsFromPlan(structuredRaw, structured) {
  return {
    timeline:
      trimmedText(structuredRaw?.timeline) ||
      trimmedText(structuredRaw?.expectedTimeline) ||
      trimmedText(structured?.timeline) ||
      '',
    importantNotes:
      trimmedText(structuredRaw?.importantNotes) ||
      trimmedText(structuredRaw?.notes) ||
      trimmedText(structuredRaw?.generalNotes) ||
      trimmedText(structured?.notes) ||
      '',
    nutritionGuidance:
      trimmedText(structuredRaw?.nutritionGuidance) ||
      trimmedText(structuredRaw?.nutrition) ||
      trimmedText(structuredRaw?.nutritionNotes) ||
      trimmedText(structured?.nutrition) ||
      '',
  };
}

function normalizedPlanRows(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  return items.map((item, index) => normalizeRouteWorkoutPlanItem(item, index)).filter(Boolean);
}

/**
 * Row source order must stay: route param → structured.workoutPlan → structured.plan → day map.
 * The first non-empty normalized list wins so an old route payload is not overwritten by JSON.
 * @param {object} args
 * @returns {Array}
 */
function workoutPlanRowsFromSources({ routeWorkoutPlan, structuredRaw, structured }) {
  const fromRoute = normalizedPlanRows(routeWorkoutPlan);
  if (fromRoute.length > 0) return fromRoute;
  const fromWorkoutPlan = normalizedPlanRows(structuredRaw?.workoutPlan);
  if (fromWorkoutPlan.length > 0) return fromWorkoutPlan;
  const fromPlan = normalizedPlanRows(structuredRaw?.plan);
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
    workoutPlanRows.length === 0 && hasPlanText && !structuredPlanHasViewerContent(structured) && !looksLikeJson;
  const viewerStructureError =
    (hasRouteWorkoutPlanParam && (!Array.isArray(routeWorkoutPlan) || routeWorkoutPlan.length === 0)) ||
    (workoutPlanRows.length === 0 && (!hasPlanText || looksLikeJson));
  const viewerEmpty = workoutPlanRows.length === 0 && !showMarkdownBody && !viewerStructureError;
  return { showMarkdownBody, viewerStructureError, viewerEmpty };
}

function GeneratingPlanScreen({ styles, palette, onBack, renderWorkoutChromeHeader }) {
  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      {renderWorkoutChromeHeader({ onBack: () => onBack?.() })}
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }}>
        <ActivityIndicator size="large" color={PLAN_BUILDER_COLORS.pink} />
        <Text style={[planViewerRefStyles.loaderText, { color: palette.text, textAlign: 'center' }]}>
          Building your workout plan…
        </Text>
        <Text style={[planViewerRefStyles.loaderText, { color: palette.muted, fontSize: 14, marginTop: 10, textAlign: 'center' }]}>
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
        <Text style={[planViewerRefStyles.loaderText, { color: palette.text }]}>Loading your workout plan...</Text>
      </View>
    </View>
  );
}

function PlanStructureErrorScreen({ styles, palette, hasRouteWorkoutPlanParam, onBack }) {
  const message = hasRouteWorkoutPlanParam
    ? 'Invalid workout plan structure received'
    : 'No workout plan provided';
  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      <View style={{ flex: 1 }}>
        <View style={planViewerRefStyles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={48} color={PLAN_BUILDER_COLORS.pink} />
          <Text style={[planViewerRefStyles.errorTitle, { color: palette.text }]}>Error</Text>
          <Text style={[planViewerRefStyles.errorMessage, { color: palette.muted }]}>{message}</Text>
          <TouchableOpacity
            onPress={() => onBack?.()}
            style={[planViewerRefStyles.errorButton, { backgroundColor: PLAN_BUILDER_COLORS.pink }]}
          >
            <Text style={planViewerRefStyles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

/** empty-vs-data PNG 05 — Design Law empty “My workout plan” shell. */
function EmptyPlanScreen({ styles, palette, onBack, onNavigate }) {
  // vocab: onNavigate keys match BottomMenuBar / shell (“create” opens plan builder)
  const buildWithAi = () => {
    if (typeof onNavigate === 'function') onNavigate('create');
    else onBack?.();
  };
  const askTrainer = () => {
    if (typeof onNavigate === 'function') onNavigate('messages');
    else onBack?.();
  };
  const browseVideos = () => {
    if (typeof onNavigate === 'function') onNavigate('workout');
    else onBack?.();
  };

  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      <View style={{ flex: 1, paddingHorizontal: nb.screenGutter, paddingTop: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => onBack?.()}
            style={{
              width: 44,
              height: 44,
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
            <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>My workout plan</Text>
            <Text style={{ fontSize: 14, fontWeight: '600', color: palette.muted, marginTop: 2 }}>No plan yet</Text>
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
          <NbIconChip source={HANDOFF_WORKOUT} index={0} size={56} />
          <Text style={{ fontSize: 22, fontWeight: '900', color: palette.text }}>No plan saved yet.</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: palette.muted, lineHeight: 20 }}>
            Build one from your profile with AI, or ask your trainer to write it.
          </Text>
          <NbButton variant="fill" onPress={buildWithAi}>
            Build with AI
          </NbButton>
          <NbButton variant="ghost" onPress={askTrainer}>
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
            <Text style={{ fontSize: 15, fontWeight: '900', color: palette.text }}>3 AI plans a month</Text>
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
            onPress={browseVideos}
            activeOpacity={0.88}
            style={{
              borderWidth: nb.borderWidth,
              borderColor: palette.text,
              borderRadius: 10,
              padding: 12,
              minHeight: 64,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              backgroundColor: palette.surface,
            }}
          >
            <NbIconChip source={HANDOFF_JOURNEY} index={1} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '900', color: palette.text }}>Browse exercise videos</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: palette.muted }}>Works without a plan</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.muted} />
          </TouchableOpacity>
        </HardShadow>
      </View>
      <WorkoutPlanBottomNav onNavigate={onNavigate} onBack={onBack} />
    </View>
  );
}

function handlePlanHeaderBack({ planSubViewBackRef, readOnly, onBack, setShowFullPlan }) {
  if (planSubViewBackRef.current?.()) return;
  if (readOnly) {
    onBack?.();
    return;
  }
  setShowFullPlan(false);
}

function SaveToLibraryButton({
  readOnly,
  generatedPlan,
  addedToCollection,
  savingToCollection,
  handleAddToCollection,
}) {
  if (readOnly || !generatedPlan) return null;
  const gradientColors = addedToCollection ? gradients.energy.colors : gradients.ink.colors;
  const label = addedToCollection ? 'Saved to Library' : 'Save to Library';
  const iconName = addedToCollection ? 'checkmark-circle' : 'bookmark-outline';
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handleAddToCollection}
        disabled={addedToCollection || savingToCollection}
        style={{ borderRadius: 16, overflow: 'hidden', opacity: addedToCollection ? 0.7 : 1 }}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderRadius: 16 }}
        >
          {savingToCollection ? (
            <ActivityIndicator size="small" color={lightColors.white} />
          ) : (
            <Ionicons name={iconName} size={18} color={lightColors.white} />
          )}
          <Text style={{ color: lightColors.white, fontSize: 15, fontFamily: 'SpaceGrotesk_700Bold' }}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function WorkoutPlanBottomNav({ onNavigate, onBack }) {
  return (
    <ShellBottomNavAnchor>
      <BottomMenuBar
        onHomePress={() => (onNavigate ? onNavigate('home') : onBack?.())}
        onProfilePress={() => onNavigate && onNavigate('profile')}
        onPlusPress={() => onNavigate && onNavigate('create')}
        onVoicePress={() => onNavigate && onNavigate('voice')}
        onNutritionPress={() => onNavigate && onNavigate('nutrition')}
        onWorkoutPress={() => onNavigate && onNavigate('workout')}
        onMessagesPress={() => onNavigate && onNavigate('messages')}
        activeTabKey="workout"
      />
    </ShellBottomNavAnchor>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Weekly plan viewer. Early returns cover generating / bad structure / empty before the live plan UI.
 * @param {object} props
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
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  const isDark = colorScheme === 'dark';
  const pdfUrl = generatedPlan?.url || pdfDownloadUrl || collectionViewingPlan?.url || null;
  const structuredRaw = generatedPlan?.structuredPlan || tryParseJsonObject(generatedPlan?.planText);
  const structured = normalizeStructuredPlanForViewer(structuredRaw);
  const overviewText = overviewTextFromPlan(generatedPlan, structured, structuredRaw);
  const planViewerWeeks = weeksRemainingFromPlan(structuredRaw, structured);
  const planViewerFocus = focusFromPlan(structuredRaw, structured);
  const planHeroTitle = heroTitleFromPlan(structuredRaw, structured, generatedPlan);
  const notesFields = notesFieldsFromPlan(structuredRaw, structured);

  const routeWorkoutPlan = route?.params?.workoutPlan;
  const hasRouteWorkoutPlanParam = !!(route?.params && Object.prototype.hasOwnProperty.call(route.params, 'workoutPlan'));
  const workoutPlanRows = workoutPlanRowsFromSources({ routeWorkoutPlan, structuredRaw, structured });
  const planTextRaw = generatedPlan?.planText;
  const { viewerStructureError, viewerEmpty } = viewerDisplayFlags({
    routeWorkoutPlan,
    hasRouteWorkoutPlanParam,
    workoutPlanRows,
    planTextRaw,
    structured,
  });

  const palette = planViewerPalette(colors);

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

  if (viewerEmpty) {
    return <EmptyPlanScreen styles={styles} palette={palette} onBack={onBack} onNavigate={onNavigate} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        {/* Design Law header lives inside MyWorkoutPlanScreen — no TopHeader chrome */}
        <MyWorkoutPlanScreen
          onBack={() => handlePlanHeaderBack({ planSubViewBackRef, readOnly, onBack, setShowFullPlan })}
          onStartSession={(day) => {
            if (typeof onStartSession !== 'function' || !day || day.rest) return;
            const focusBits = String(day.focus || '').split(/\s*·\s*/).filter(Boolean);
            onStartSession({
              workoutName: focusBits[0] || String(day.day || day.short || 'Workout').trim() || 'Workout',
              exercises: Array.isArray(day.exercises) ? day.exercises : [],
            });
          }}
          route={{
            params: {
              workoutPlan: workoutPlanRows,
              overview: overviewText,
              isDarkOverride: isDark,
              weeksRemaining: planViewerWeeks,
              focusSummary: planViewerFocus,
              planHeroTitle: planHeroTitle,
              timeline: notesFields.timeline,
              importantNotes: notesFields.importantNotes,
              nutritionGuidance: notesFields.nutritionGuidance,
              onViewPdf: () => setShowPdfViewer?.(true),
              subViewBackRef: planSubViewBackRef,
              onSubViewActiveChange: (active) => {
                planSubViewActiveRef.current = !!active;
              },
              reserveShellBottomNav: true,
            },
          }}
        />
        <PlanPdfViewer
          visible={showPdfViewer}
          pdfLocalUri={pdfLocalUri}
          pdfDownloadUrl={collectionViewingPlan ? collectionViewingPlan.url : pdfDownloadUrl}
          planTitle={collectionViewingPlan ? collectionViewingPlan.planTitle : planTitleForPdf}
          isDark={isDark}
          onClose={() => {
            setShowPdfViewer(false);
            setCollectionViewingPlan(null);
          }}
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
