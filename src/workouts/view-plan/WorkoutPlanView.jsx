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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
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

// ===== NAMED CONSTANTS =====

const DEFAULT_PLAN_WEEKS = 4;
const DEFAULT_FOCUS = 'Complete muscle building program';
const DEFAULT_HERO_TITLE = 'Your Workout Plan';
const SAVE_GRADIENT = ['#BE185D', '#C2410C'];
const SAVED_GRADIENT = ['#10B981', '#059669'];

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

function planViewerPalette(isDark) {
  if (isDark) {
    return {
      background: '#0A0A0F',
      surface: '#13131A',
      text: '#FFFFFF',
      muted: 'rgba(255,255,255,0.55)',
    };
  }
  return {
    background: '#F5F5F5',
    surface: '#FFFFFF',
    text: '#0A0A0F',
    muted: 'rgba(10,10,15,0.6)',
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

function EmptyPlanScreen({ styles, palette, onBack }) {
  return (
    <View style={[styles.container, { flex: 1, backgroundColor: palette.background }]}>
      <View style={{ flex: 1 }}>
        <View style={[planViewerRefStyles.emptyContainer, { backgroundColor: palette.surface }]}>
          <Ionicons name="fitness" size={48} color={PLAN_BUILDER_COLORS.cyan} />
          <Text style={[planViewerRefStyles.emptyTitle, { color: palette.text }]}>No Plan Yet</Text>
          <Text style={[planViewerRefStyles.emptyMessage, { color: palette.muted }]}>
            Generate a workout plan from the home screen
          </Text>
          <TouchableOpacity
            onPress={() => onBack?.()}
            style={[planViewerRefStyles.emptyButton, { backgroundColor: PLAN_BUILDER_COLORS.cyan }]}
          >
            <Text style={planViewerRefStyles.emptyButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
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
  const gradientColors = addedToCollection ? SAVED_GRADIENT : SAVE_GRADIENT;
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
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name={iconName} size={18} color="#FFFFFF" />
          )}
          <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>{label}</Text>
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
  isDark,
  onBack,
  onNavigate,
  onProfilePress,
  onSettingsPress,
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
  const pdfUrl = generatedPlan?.url || pdfDownloadUrl || collectionViewingPlan?.url || null;
  const structuredRaw = generatedPlan?.structuredPlan || tryParseJsonObject(generatedPlan?.planText);
  const structured = normalizeStructuredPlanForViewer(structuredRaw);
  const overviewText = overviewTextFromPlan(generatedPlan, structured, structuredRaw);
  const planViewerWeeks = weeksRemainingFromPlan(structuredRaw, structured);
  const planViewerFocus = focusFromPlan(structuredRaw, structured);
  const planHeroTitle = heroTitleFromPlan(structuredRaw, structured, generatedPlan);

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

  const palette = planViewerPalette(isDark);

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
    return <EmptyPlanScreen styles={styles} palette={palette} onBack={onBack} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.background }}>
      <View style={{ flex: 1 }}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <TopHeader
          title="Weekly Plan"
          skipTopSafeInset
          onBack={() => handlePlanHeaderBack({ planSubViewBackRef, readOnly, onBack, setShowFullPlan })}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
          showHeaderActions
        />
        <MyWorkoutPlanScreen
          route={{
            params: {
              workoutPlan: workoutPlanRows,
              overview: overviewText,
              isDarkOverride: isDark,
              weeksRemaining: planViewerWeeks,
              focusSummary: planViewerFocus,
              planHeroTitle: planHeroTitle,
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
