// Minimal wrapper for "generate my workout plan": load usage + saved plan, then one generate button.
// Flow: load monthly usage → load onboarding + saved plan → show status → tap Generate → Claude call → alert.
// Used by: client navigation when the dedicated generator screen is opened. The full plan viewer lives elsewhere.

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import {
  generateWorkoutPlanWithClaude,
  loadOnboardingAndPlanArtifacts,
  loadWorkoutGenerationUsage,
} from '../create-plan/CreateWorkoutPlanScreen';
import NbCard from '../../look-and-feel/NbCard';
import NbButton from '../../look-and-feel/NbButton';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import { lightColors, darkColors, gradients } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Must match the server / create-plan error code when the monthly cap is hit
const WORKOUT_MONTHLY_LIMIT_ERROR_CODE = 'monthly_limit_reached';

const MISSING_ONBOARDING_TITLE = 'Missing data';
const MISSING_ONBOARDING_MESSAGE = 'Onboarding data is required to generate a plan.';
const GENERATE_SUCCESS_TITLE = 'Success';
const GENERATE_SUCCESS_MESSAGE = 'Plan generated and saved.';
const GENERATE_FAIL_TITLE = 'Generation failed';
const GENERATE_FAIL_FALLBACK = 'Failed to generate workout plan.';
const MONTHLY_LIMIT_TITLE = 'Monthly limit reached';
const LOAD_FAIL_FALLBACK = 'Failed to load data.';
const NOTICE_CONFIRM_DEFAULT = 'OK';
const BACK_ICON_SIZE = 24;
const BACK_HIT_SIZE = 44;

// ===== HELPER FUNCTIONS =====

/**
 * Pull Nb background / ink / muted from whatever the caller passed historically.
 * Legacy call passes the theme `isDark` flag — keep that door so colors behave the same as before.
 */
function screenPalette(themeDarkFlag) {
  return {
    screenBackground: themeDarkFlag.nbBackground,
    surface: themeDarkFlag.nbSurface,
    textColor: themeDarkFlag.nbInk,
    muted: themeDarkFlag.nbMuted,
  };
}

/**
 * Map a monthly-limit error payload into the genUsage state shape the UI reads.
 * Object keys (generations_used / generations_limit / resets_at) are frozen for callers.
 */
function usageStateFromLimitPayload(limitPayload) {
  return {
    generations_used: limitPayload.used,
    generations_limit: limitPayload.limit,
    resets_at: limitPayload.resets_at,
  };
}

/**
 * One-line status under "Generation": no plan yet, plan with no date, or plan + saved date.
 */
function savedPlanStatusCaption(generatedPlan) {
  if (!generatedPlan) {
    return 'No plan saved yet.';
  }
  if (!generatedPlan?.generatedAt) {
    return 'Plan saved .';
  }
  const savedDate = new Date(generatedPlan.generatedAt).toLocaleDateString();
  return `Plan saved (${savedDate}).`;
}

/**
 * After Claude succeeds: refresh usage if the plan carried it, then store the plan.
 */
function applySuccessfulGeneration(plan, setGenUsage, setGeneratedPlan) {
  if (plan?.usage) {
    setGenUsage(plan.usage);
  }
  setGeneratedPlan(plan);
}

/**
 * Turn a generate failure into a notice sheet. Monthly-limit errors also refresh usage.
 */
function showGenerationFailureNotice(error, setGenUsage, showNotice) {
  const hitMonthlyLimit = error?.code === WORKOUT_MONTHLY_LIMIT_ERROR_CODE;
  if (hitMonthlyLimit) {
    if (error.limitPayload) {
      setGenUsage(usageStateFromLimitPayload(error.limitPayload));
    }
    showNotice(MONTHLY_LIMIT_TITLE, error.message);
    return;
  }

  const failMessage = error?.message || GENERATE_FAIL_FALLBACK;
  showNotice(GENERATE_FAIL_TITLE, failMessage);
}

/**
 * Tap Generate: refuse without onboarding → call Claude → success notice or failure notice.
 * Flow: 1. need onboarding  2. busy + clear error  3. Claude  4. apply + success  5. catch notice  6. clear busy
 */
async function runGeneratePlanTap({
  onboardingData,
  userId,
  setIsGenerating,
  setError,
  setGenUsage,
  setGeneratedPlan,
  showNotice,
}) {
  // 1. Refuse when onboarding never loaded — Claude needs those answers
  if (!onboardingData) {
    showNotice(MISSING_ONBOARDING_TITLE, MISSING_ONBOARDING_MESSAGE);
    return;
  }

  // 2. Lock the button and clear a stale load error
  setIsGenerating(true);
  setError(null);

  try {
    // 3. Ask Claude (CreateWorkoutPlanScreen owns the API + save)
    const plan = await generateWorkoutPlanWithClaude({ onboardingData, userId });

    // 4. Store the plan (and usage if the response carried it), then toast success
    applySuccessfulGeneration(plan, setGenUsage, setGeneratedPlan);
    showNotice(GENERATE_SUCCESS_TITLE, GENERATE_SUCCESS_MESSAGE);
  } catch (error) {
    // 5. Monthly cap or generic failure → notice sheet
    showGenerationFailureNotice(error, setGenUsage, showNotice);
  } finally {
    // 6. Always unlock the button
    setIsGenerating(false);
  }
}

// ===== IN-FILE UI PIECES =====

function GenerateScreenLoading({ screenBackground, textColor }) {
  const loadingWrapStyle = {
    flex: 1,
    backgroundColor: screenBackground,
    justifyContent: 'center',
    alignItems: 'center',
  };
  const loadingLabelStyle = {
    color: textColor,
    fontFamily: 'Inter_400Regular',
    marginTop: 10,
  };

  return (
    <View style={loadingWrapStyle}>
      <ActivityIndicator size="large" color={gradients.brand.colors[0]} />
      <Text style={loadingLabelStyle}>Loading…</Text>
    </View>
  );
}

function GenerateScreenLoadError({ screenBackground, textColor, muted, error, onBack }) {
  const errorScreenStyle = { flex: 1, backgroundColor: screenBackground, padding: 16 };
  const backHitStyle = { width: BACK_HIT_SIZE, height: BACK_HIT_SIZE, justifyContent: 'center' };
  const errorTitleStyle = {
    color: textColor,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
  };
  const errorBodyStyle = {
    color: muted,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
  };

  return (
    <View style={errorScreenStyle}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity onPress={onBack} style={backHitStyle}>
          <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={textColor} />
        </TouchableOpacity>
        <NbCard style={{ flex: 1, padding: 16, justifyContent: 'center' }}>
          <Text style={errorTitleStyle}>Error</Text>
          <Text style={errorBodyStyle}>{error}</Text>
        </NbCard>
      </SafeAreaView>
    </View>
  );
}

function MonthlyUsageLine({ genUsage, muted }) {
  if (!genUsage) {
    return null;
  }

  const usageLineStyle = {
    color: muted,
    marginTop: 14,
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  };
  const usageLineText = `${genUsage.generations_used} of ${genUsage.generations_limit} plans used this month`;

  return <Text style={usageLineStyle}>{usageLineText}</Text>;
}

function GenerateNewPlanButton({ isGenerating, onPress }) {
  // Manipulate here: busy label while Claude is running
  let buttonLabel = 'Generate New Plan';
  if (isGenerating) {
    buttonLabel = 'Generating...';
  }

  return (
    <View style={{ marginTop: 18 }}>
      <NbButton variant="brand" onPress={onPress} disabled={isGenerating}>
        {buttonLabel}
      </NbButton>
    </View>
  );
}

function GenerateScreenHeader({ textColor, onBack }) {
  const rowStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  };
  const backHitStyle = { width: BACK_HIT_SIZE, height: BACK_HIT_SIZE, justifyContent: 'center' };
  const titleStyle = {
    color: textColor,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
  };

  return (
    <View style={rowStyle}>
      <TouchableOpacity onPress={onBack} style={backHitStyle}>
        <Ionicons name="chevron-back" size={BACK_ICON_SIZE} color={textColor} />
      </TouchableOpacity>
      <Text style={titleStyle}>Workout Plan</Text>
      <View style={{ width: BACK_HIT_SIZE }} />
    </View>
  );
}

// ===== MAIN SCREEN =====

/**
 * Dedicated "generate my workout plan" screen (minimal wrapper; viewer UI is elsewhere).
 * Hook order is frozen: theme → scheme → loading → onboarding → plan → generating → error → usage → notice.
 */
export default function GenerateMyWorkoutPlanScreen({
  userId,
  onBack,
  onNavigate,
  onProfilePress,
  onSettingsPress,
  plan: propPlan,
  readOnly = false,
  hideBottomNav = false,
  route,
}) {
  // vocab: useTheme = app light/dark bag; isDark is the legacy flag screenPalette still reads
  const theme = useTheme();
  const { isDark } = theme;
  // vocab: useColorScheme = device scheme (kept for parity with older chrome; palette uses isDark)
  const colorScheme = useColorScheme();
  let colors = lightColors;
  if (colorScheme === 'dark') {
    colors = darkColors;
  }

  // Hook order frozen — do not reorder these useState calls
  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState(null);
  const [generatedPlan, setGeneratedPlan] = useState(propPlan || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [genUsage, setGenUsage] = useState(null);
  const [notice, setNotice] = useState(null);

  // vocab: showNotice = thin wrapper that opens NbNoticeSheet via notice state
  const showNotice = (title, message, extras = {}) => setNotice({ title, message, ...extras });

  // Load monthly usage whenever the signed-in user id changes
  useEffect(() => {
    let isStillMounted = true;

    (async () => {
      const trimmedUserId = userId && String(userId).trim();
      if (!trimmedUserId) {
        return;
      }
      const usage = await loadWorkoutGenerationUsage(trimmedUserId);
      if (isStillMounted) {
        setGenUsage(usage);
      }
    })();

    return () => {
      isStillMounted = false;
    };
  }, [userId]);

  // Load onboarding answers + any saved plan (or the plan passed in as a prop)
  useEffect(() => {
    let isStillMounted = true;

    (async () => {
      try {
        const { onboardingData: loadedOnboarding, plan: loadedPlan } =
          await loadOnboardingAndPlanArtifacts({ userId, propPlan });
        if (!isStillMounted) {
          return;
        }
        setOnboardingData(loadedOnboarding || null);
        setGeneratedPlan(loadedPlan || propPlan || null);
      } catch (loadError) {
        if (!isStillMounted) {
          return;
        }
        setError(loadError?.message || LOAD_FAIL_FALLBACK);
      } finally {
        if (isStillMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isStillMounted = false;
    };
  }, [userId, propPlan]);

  const palette = screenPalette(isDark);
  const { screenBackground, surface, textColor, muted } = palette;

  // Early exits before the main card — loading spinner, then load-error card
  if (loading) {
    return <GenerateScreenLoading screenBackground={screenBackground} textColor={textColor} />;
  }

  if (error) {
    return (
      <GenerateScreenLoadError
        screenBackground={screenBackground}
        surface={surface}
        textColor={textColor}
        muted={muted}
        error={error}
        onBack={onBack}
      />
    );
  }

  // Name the decision before JSX — status line + read-only gate
  const planStatusLine = savedPlanStatusCaption(generatedPlan);
  const canShowGenerateControls = !readOnly;
  const noticeIsVisible = !!notice;
  const noticeTitle = notice?.title || '';
  const noticeMessage = notice?.message;
  const noticeConfirmLabel = notice?.confirmLabel || NOTICE_CONFIRM_DEFAULT;
  const noticeCancelLabel = notice?.cancelLabel;
  const noticeConfirmHandler = notice?.onConfirm;

  /**
   * Generate button press → runGeneratePlanTap recipe.
   * Flow: 1. hand state setters + showNotice to the async helper
   */
  const handleGeneratePress = () => {
    // 1. Kick off Claude with the current onboarding + user id
    runGeneratePlanTap({
      onboardingData,
      userId,
      setIsGenerating,
      setError,
      setGenUsage,
      setGeneratedPlan,
      showNotice,
    });
  };

  const closeNoticeSheet = () => setNotice(null);
  const screenWrapStyle = { flex: 1, backgroundColor: screenBackground, padding: 16 };
  const generationTitleStyle = {
    color: textColor,
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 18,
  };
  const generationBlurbStyle = {
    color: muted,
    fontFamily: 'Inter_400Regular',
    marginTop: 8,
    lineHeight: 18,
  };
  const planStatusStyle = {
    color: muted,
    fontFamily: 'Inter_400Regular',
    marginTop: 12,
  };

  return (
    <View style={screenWrapStyle}>
      <SafeAreaView style={{ flex: 1 }}>
        <GenerateScreenHeader textColor={textColor} onBack={onBack} />

        <NbCard style={{ flex: 1, padding: 16, marginTop: 12 }}>
          <Text style={generationTitleStyle}>Generation</Text>
          <Text style={generationBlurbStyle}>
            This screen is a minimal wrapper. Your plan viewer UI is being rebuilt separately.
          </Text>

          <Text style={planStatusStyle}>{planStatusLine}</Text>

          {canShowGenerateControls ? (
            <>
              <MonthlyUsageLine genUsage={genUsage} muted={muted} />
              <GenerateNewPlanButton isGenerating={isGenerating} onPress={handleGeneratePress} />
            </>
          ) : null}
        </NbCard>

        <NbNoticeSheet
          visible={noticeIsVisible}
          onClose={closeNoticeSheet}
          title={noticeTitle}
          message={noticeMessage}
          confirmLabel={noticeConfirmLabel}
          cancelLabel={noticeCancelLabel}
          onConfirm={noticeConfirmHandler}
        />
      </SafeAreaView>
    </View>
  );
}
