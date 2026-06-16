import React from 'react';
import {
  ActivityIndicator,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import PlanViewerScreen from '../../client/screens/PlanViewerScreen';
import WorkoutPlanPdfViewerModal from './WorkoutPlanPdfViewerModal';
import { planViewerRefStyles } from './workoutPlanUiComponents';
import {
  tryParseJsonObject,
  normalizeStructuredPlanForViewer,
  structuredPlanHasViewerContent,
  normalizeRouteWorkoutPlanItem,
  mapStructuredDaysToPlanViewerRows,
  PLAN_BUILDER_COLORS,
} from '../plan-generator/workoutPlanParsing';

export default function WorkoutPlanResult({
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
  const overviewText =
    (structured?.overview && String(structured.overview).trim()) ||
    (structuredRaw?.overview && String(structuredRaw.overview).trim()) ||
    (generatedPlan?.planOverview && String(generatedPlan.planOverview).trim()) ||
    '';

  const planViewerWeeks = (() => {
    const n = Number(structuredRaw?.weeksRemaining ?? structuredRaw?.durationWeeks ?? structured?.weeksRemaining);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 4;
  })();
  const planViewerFocus =
    String(structuredRaw?.programFocus ?? structuredRaw?.focus ?? structured?.focus ?? '').trim() ||
    'Complete muscle building program';
  const planHeroTitle =
    String(structuredRaw?.planTitle ?? structured?.planTitle ?? generatedPlan?.planTitle ?? '').trim() ||
    'Your Workout Plan';

  const routeWorkoutPlan = route?.params?.workoutPlan;
  const hasRouteWorkoutPlanParam = !!(route?.params && Object.prototype.hasOwnProperty.call(route.params, 'workoutPlan'));
  const workoutPlanRows = (() => {
    if (Array.isArray(routeWorkoutPlan) && routeWorkoutPlan.length > 0) {
      const normalized = routeWorkoutPlan
        .map((item, i) => normalizeRouteWorkoutPlanItem(item, i))
        .filter(Boolean);
      if (normalized.length > 0) return normalized;
    }
    if (Array.isArray(structuredRaw?.workoutPlan) && structuredRaw.workoutPlan.length > 0) {
      const normalized = structuredRaw.workoutPlan
        .map((item, i) => normalizeRouteWorkoutPlanItem(item, i))
        .filter(Boolean);
      if (normalized.length > 0) return normalized;
    }
    if (Array.isArray(structuredRaw?.plan) && structuredRaw.plan.length > 0) {
      const normalized = structuredRaw.plan
        .map((item, i) => normalizeRouteWorkoutPlanItem(item, i))
        .filter(Boolean);
      if (normalized.length > 0) return normalized;
    }
    return mapStructuredDaysToPlanViewerRows(structured);
  })();

  const planTextRaw = generatedPlan?.planText;
  const hasPlanText = !!(planTextRaw && String(planTextRaw).trim());
  const looksLikeJson = /^\s*[\[{]/.test(String(planTextRaw || ''));
  const showMarkdownBody =
    workoutPlanRows.length === 0 && hasPlanText && !structuredPlanHasViewerContent(structured) && !looksLikeJson;
  const viewerStructureError =
    (hasRouteWorkoutPlanParam && (!Array.isArray(routeWorkoutPlan) || routeWorkoutPlan.length === 0)) ||
    (workoutPlanRows.length === 0 && (!hasPlanText || looksLikeJson));
  const viewerEmpty = workoutPlanRows.length === 0 && !showMarkdownBody && !viewerStructureError;

  const pvBg = isDark ? '#0A0A0F' : '#F5F5F5';
  const surface = isDark ? '#13131A' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#0A0A0F';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.6)';

  if (isGenerating && readOnly) {
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
        {renderWorkoutChromeHeader({ onBack: () => onBack?.() })}
        <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }} edges={['top']}>
          <ActivityIndicator size="large" color={PLAN_BUILDER_COLORS.pink} />
          <Text style={[planViewerRefStyles.loaderText, { color: text, textAlign: 'center' }]}>
            Building your workout plan…
          </Text>
          <Text style={[planViewerRefStyles.loaderText, { color: muted, fontSize: 14, marginTop: 10, textAlign: 'center' }]}>
            You can go back — we will notify you when your plan is ready.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  if (viewerStructureError) {
    if (readOnly && !viewerErrorDelayElapsed) {
      return (
        <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
          <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }} edges={['top']}>
            <ActivityIndicator size="large" color={PLAN_BUILDER_COLORS.pink} />
            <Text style={[planViewerRefStyles.loaderText, { color: text }]}>Loading your workout plan...</Text>
          </SafeAreaView>
        </View>
      );
    }
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={planViewerRefStyles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={48} color={PLAN_BUILDER_COLORS.pink} />
            <Text style={[planViewerRefStyles.errorTitle, { color: text }]}>Error</Text>
            <Text style={[planViewerRefStyles.errorMessage, { color: muted }]}>
              {hasRouteWorkoutPlanParam ? 'Invalid workout plan structure received' : 'No workout plan provided'}
            </Text>
            <TouchableOpacity
              onPress={() => onBack?.()}
              style={[planViewerRefStyles.errorButton, { backgroundColor: PLAN_BUILDER_COLORS.pink }]}
            >
              <Text style={planViewerRefStyles.errorButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (viewerEmpty) {
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: pvBg }]}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={[planViewerRefStyles.emptyContainer, { backgroundColor: surface }]}>
            <Ionicons name="fitness" size={48} color={PLAN_BUILDER_COLORS.cyan} />
            <Text style={[planViewerRefStyles.emptyTitle, { color: text }]}>No Plan Yet</Text>
            <Text style={[planViewerRefStyles.emptyMessage, { color: muted }]}>
              Generate a workout plan from the home screen
            </Text>
            <TouchableOpacity
              onPress={() => onBack?.()}
              style={[planViewerRefStyles.emptyButton, { backgroundColor: PLAN_BUILDER_COLORS.cyan }]}
            >
              <Text style={planViewerRefStyles.emptyButtonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: pvBg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
        <CoachConnectHeader
          title="Weekly Plan"
          skipTopSafeInset
          onBack={() => {
            if (planSubViewBackRef.current?.()) return;
            if (readOnly) {
              onBack?.();
            } else {
              setShowFullPlan(false);
            }
          }}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
          showHeaderActions
        />
        <PlanViewerScreen
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
            },
          }}
        />
        <WorkoutPlanPdfViewerModal
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
        {!readOnly && generatedPlan ? (
          <View style={{ paddingHorizontal: 16, paddingVertical: 10 }}>
            <TouchableOpacity
              activeOpacity={0.88}
              onPress={handleAddToCollection}
              disabled={addedToCollection || savingToCollection}
              style={{ borderRadius: 16, overflow: 'hidden', opacity: addedToCollection ? 0.7 : 1 }}
            >
              <LinearGradient
                colors={addedToCollection ? ['#10B981', '#059669'] : ['#BE185D', '#C2410C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, borderRadius: 16 }}
              >
                {savingToCollection ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name={addedToCollection ? 'checkmark-circle' : 'bookmark-outline'} size={18} color="#FFFFFF" />
                )}
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '800' }}>
                  {addedToCollection ? 'Saved to Library' : 'Save to Library'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : null}
      </SafeAreaView>
      <BottomNavBar
        onHomePress={() => (onNavigate ? onNavigate('home') : onBack?.())}
        onProfilePress={() => onNavigate && onNavigate('profile')}
        onPlusPress={() => onNavigate && onNavigate('create')}
        onVoicePress={() => onNavigate && onNavigate('voice')}
        onNutritionPress={() => onNavigate && onNavigate('nutrition')}
        onWorkoutPress={() => onNavigate && onNavigate('workout')}
        onMessagesPress={() => onNavigate && onNavigate('messages')}
        activeTabKey="workout"
      />
    </View>
  );
}
