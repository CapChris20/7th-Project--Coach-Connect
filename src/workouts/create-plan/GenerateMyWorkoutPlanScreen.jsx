// Minimal wrapper for "generate my workout plan": load usage + saved plan, then one generate button.
// Flow: load monthly usage → load onboarding + saved plan → show status → tap Generate → Claude call → alert.
// Used by: client navigation when the dedicated generator screen is opened. The full plan viewer lives elsewhere.

import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { generateWorkoutPlanWithClaude, loadOnboardingAndPlanArtifacts, loadWorkoutGenerationUsage } from '../create-plan/CreateWorkoutPlanScreen';

// ===== NAMED CONSTANTS =====

const ACCENT_PINK = '#FF6B9D';
const SCREEN_DARK = '#0A0A0F';
const SCREEN_LIGHT = '#F5F5F5';
const SURFACE_DARK = '#13131A';
const SURFACE_LIGHT = '#FFFFFF';
const TEXT_DARK = '#FFFFFF';
const TEXT_LIGHT = '#0A0A0F';
const MUTED_DARK = 'rgba(255,255,255,0.6)';
const MUTED_LIGHT = 'rgba(0,0,0,0.55)';
const BUTTON_LABEL_COLOR = '#fff';

const MONTHLY_LIMIT_CODE = 'monthly_limit_reached';

const MISSING_ONBOARDING_TITLE = 'Missing data';
const MISSING_ONBOARDING_MESSAGE = 'Onboarding data is required to generate a plan.';
const GENERATE_SUCCESS_TITLE = 'Success';
const GENERATE_SUCCESS_MESSAGE = 'Plan generated and saved.';
const GENERATE_FAIL_TITLE = 'Generation failed';
const GENERATE_FAIL_FALLBACK = 'Failed to generate workout plan.';
const MONTHLY_LIMIT_TITLE = 'Monthly limit reached';
const LOAD_FAIL_FALLBACK = 'Failed to load data.';

// ===== HELPER FUNCTIONS =====

function screenPalette(isDark) {
  return {
    screenBackground: isDark ? SCREEN_DARK : SCREEN_LIGHT,
    surface: isDark ? SURFACE_DARK : SURFACE_LIGHT,
    textColor: isDark ? TEXT_DARK : TEXT_LIGHT,
    muted: isDark ? MUTED_DARK : MUTED_LIGHT,
  };
}

function usageFromLimitPayload(limitPayload) {
  return {
    generations_used: limitPayload.used,
    generations_limit: limitPayload.limit,
    resets_at: limitPayload.resets_at,
  };
}

function applyGeneratedPlan(plan, setGenUsage, setGeneratedPlan) {
  if (plan?.usage) setGenUsage(plan.usage);
  setGeneratedPlan(plan);
}

function applyGenerationFailure(error, setGenUsage) {
  if (error?.code === MONTHLY_LIMIT_CODE) {
    if (error.limitPayload) setGenUsage(usageFromLimitPayload(error.limitPayload));
    Alert.alert(MONTHLY_LIMIT_TITLE, error.message);
    return;
  }
  Alert.alert(GENERATE_FAIL_TITLE, error?.message || GENERATE_FAIL_FALLBACK);
}

async function generatePlanForUser({ onboardingData, userId, setIsGenerating, setError, setGenUsage, setGeneratedPlan }) {
  if (!onboardingData) {
    Alert.alert(MISSING_ONBOARDING_TITLE, MISSING_ONBOARDING_MESSAGE);
    return;
  }
  setIsGenerating(true);
  setError(null);
  try {
    const plan = await generateWorkoutPlanWithClaude({ onboardingData, userId });
    applyGeneratedPlan(plan, setGenUsage, setGeneratedPlan);
    Alert.alert(GENERATE_SUCCESS_TITLE, GENERATE_SUCCESS_MESSAGE);
  } catch (error) {
    applyGenerationFailure(error, setGenUsage);
  } finally {
    setIsGenerating(false);
  }
}

function savedPlanCaption(generatedPlan) {
  if (!generatedPlan) return 'No plan saved yet.';
  if (!generatedPlan?.generatedAt) return 'Plan saved .';
  return `Plan saved (${new Date(generatedPlan.generatedAt).toLocaleDateString()}).`;
}

function LoadingBody({ screenBackground, textColor }) {
  return (
    <View style={{ flex: 1, backgroundColor: screenBackground, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={ACCENT_PINK} />
      <Text style={{ color: textColor, marginTop: 10 }}>Loading…</Text>
    </View>
  );
}

function ErrorBody({ screenBackground, surface, textColor, muted, error, onBack }) {
  return (
    <View style={{ flex: 1, backgroundColor: screenBackground, padding: 16 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1, backgroundColor: surface, borderRadius: 16, padding: 16, justifyContent: 'center' }}>
          <Text style={{ color: textColor, fontWeight: '800', fontSize: 18 }}>Error</Text>
          <Text style={{ color: muted, marginTop: 8 }}>{error}</Text>
        </View>
      </SafeAreaView>
    </View>
  );
}

function UsageLine({ genUsage, muted }) {
  if (!genUsage) return null;
  return (
    <Text style={{ color: muted, marginTop: 14, fontSize: 13, fontWeight: '600' }}>
      {genUsage.generations_used} of {genUsage.generations_limit} plans used this month
    </Text>
  );
}

function GeneratePlanButton({ isGenerating, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isGenerating}
      style={{
        marginTop: 18,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: ACCENT_PINK,
        opacity: isGenerating ? 0.7 : 1,
      }}
    >
      {isGenerating ? (
        <ActivityIndicator color={BUTTON_LABEL_COLOR} />
      ) : (
        <Text style={{ color: BUTTON_LABEL_COLOR, fontWeight: '800' }}>Generate New Plan</Text>
      )}
    </TouchableOpacity>
  );
}

// ===== MAIN FUNCTION =====

/**
 * UI wrapper for workout plan generation. Rendering of plans is intentionally NOT handled here.
 * @param {object} props
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
  const theme = useTheme();
  const { isDark } = theme;

  const [loading, setLoading] = useState(true);
  const [onboardingData, setOnboardingData] = useState(null);
  const [generatedPlan, setGeneratedPlan] = useState(propPlan || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [genUsage, setGenUsage] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const uid = userId && String(userId).trim();
      if (!uid) return;
      const usage = await loadWorkoutGenerationUsage(uid);
      if (mounted) setGenUsage(usage);
    })();
    return () => {
      mounted = false;
    };
  }, [userId]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { onboardingData: data, plan } = await loadOnboardingAndPlanArtifacts({ userId, propPlan });
        if (!mounted) return;
        setOnboardingData(data || null);
        setGeneratedPlan(plan || propPlan || null);
      } catch (loadError) {
        if (!mounted) return;
        setError(loadError?.message || LOAD_FAIL_FALLBACK);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, propPlan]);

  const palette = screenPalette(isDark);
  const { screenBackground, surface, textColor, muted } = palette;

  if (loading) {
    return <LoadingBody screenBackground={screenBackground} textColor={textColor} />;
  }

  if (error) {
    return (
      <ErrorBody
        screenBackground={screenBackground}
        surface={surface}
        textColor={textColor}
        muted={muted}
        error={error}
        onBack={onBack}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: screenBackground, padding: 16 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={{ color: textColor, fontWeight: '800', fontSize: 16 }}>Workout Plan</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1, backgroundColor: surface, borderRadius: 16, padding: 16, marginTop: 12 }}>
          <Text style={{ color: textColor, fontWeight: '800', fontSize: 18 }}>Generation</Text>
          <Text style={{ color: muted, marginTop: 8, lineHeight: 18 }}>
            This screen is a minimal wrapper. Your plan viewer UI is being rebuilt separately.
          </Text>

          <Text style={{ color: muted, marginTop: 12 }}>
            {savedPlanCaption(generatedPlan)}
          </Text>

          {!readOnly ? (
            <>
              <UsageLine genUsage={genUsage} muted={muted} />
              <GeneratePlanButton
                isGenerating={isGenerating}
                onPress={() => generatePlanForUser({
                  onboardingData,
                  userId,
                  setIsGenerating,
                  setError,
                  setGenUsage,
                  setGeneratedPlan,
                })}
              />
            </>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}
