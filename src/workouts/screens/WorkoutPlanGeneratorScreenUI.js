import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';
import { generateWorkoutPlanWithClaude, loadOnboardingAndPlanArtifacts } from './workout';

/**
 * UI wrapper for workout plan generation.
 * Rendering of plans is intentionally NOT handled here.
 */
export default function WorkoutPlanGeneratorScreenUI({
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

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { onboardingData: data, plan } = await loadOnboardingAndPlanArtifacts({ userId, propPlan });
        if (!mounted) return;
        setOnboardingData(data || null);
        setGeneratedPlan(plan || propPlan || null);
      } catch (e) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load data.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [userId, propPlan]);

  const bg = isDark ? '#0A0A0F' : '#F5F5F5';
  const surface = isDark ? '#13131A' : '#FFFFFF';
  const text = isDark ? '#FFFFFF' : '#0A0A0F';
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)';

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={{ color: text, marginTop: 10 }}>Loading…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: bg, padding: 16 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <View style={{ flex: 1, backgroundColor: surface, borderRadius: 16, padding: 16, justifyContent: 'center' }}>
            <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>Error</Text>
            <Text style={{ color: muted, marginTop: 8 }}>{error}</Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: bg, padding: 16 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={onBack} style={{ width: 44, height: 44, justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color={text} />
          </TouchableOpacity>
          <Text style={{ color: text, fontWeight: '800', fontSize: 16 }}>Workout Plan</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={{ flex: 1, backgroundColor: surface, borderRadius: 16, padding: 16, marginTop: 12 }}>
          <Text style={{ color: text, fontWeight: '800', fontSize: 18 }}>Generation</Text>
          <Text style={{ color: muted, marginTop: 8, lineHeight: 18 }}>
            This screen is a minimal wrapper. Your plan viewer UI is being rebuilt separately.
          </Text>

          {generatedPlan ? (
            <Text style={{ color: muted, marginTop: 12 }}>
              Plan saved {generatedPlan?.generatedAt ? `(${new Date(generatedPlan.generatedAt).toLocaleDateString()})` : ''}.
            </Text>
          ) : (
            <Text style={{ color: muted, marginTop: 12 }}>No plan saved yet.</Text>
          )}

          {!readOnly ? (
            <TouchableOpacity
              onPress={async () => {
                if (!onboardingData) {
                  Alert.alert('Missing data', 'Onboarding data is required to generate a plan.');
                  return;
                }
                setIsGenerating(true);
                setError(null);
                try {
                  const plan = await generateWorkoutPlanWithClaude({ onboardingData, userId });
                  setGeneratedPlan(plan);
                  Alert.alert('Success', 'Plan generated and saved.');
                } catch (e) {
                  Alert.alert('Generation failed', e?.message || 'Failed to generate workout plan.');
                } finally {
                  setIsGenerating(false);
                }
              }}
              disabled={isGenerating}
              style={{
                marginTop: 18,
                height: 48,
                borderRadius: 14,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#FF6B9D',
                opacity: isGenerating ? 0.7 : 1,
              }}
            >
              {isGenerating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>Generate New Plan</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

