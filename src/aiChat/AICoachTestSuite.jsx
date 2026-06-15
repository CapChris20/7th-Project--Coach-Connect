/**
 * AICoach Test Suite
 *
 * Purpose: Tests for AICoach Test Suite.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/aiChat
 * Key exports: AICoachTestSuite
 *
 * @file-header
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadCoachContext } from '../ai/context/CoachContextProvider';
import { resetAiCoachDailyUsage, sendToAI } from '../ai/chat-api/aiCoachServerService';
import { shouldRouteToPerplexity } from '../ai/perplexityService';
import { executeCoachTool, TOOL_NAME_ALIASES } from '../ai/tools/executeCoachTool';
import CoachConnectHeader from '../shared/components/CoachConnectHeader';

const COLORS = {
  bg: '#0A0A0F',
  cardBg: '#141419',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.65)',
  pink: '#FF6B9D',
  orange: '#F97316',
  green: '#10B981',
  red: '#FF6B6B',
};

const TEST_SUITES = {
  context: [
    { name: 'Context Aggregation', prompt: 'What are my macros looking like this week?' },
    { name: 'Sleep Data', prompt: 'How has my sleep been?' },
    { name: 'Workout Count', prompt: 'How many workouts did I do this week?' },
    { name: 'Streak Info', prompt: "What's my current streak?" },
  ],
  tools: [
    { name: 'updateWorkout', prompt: 'My shoulder hurts on overhead press, can you swap it?' },
    { name: 'adjustMacros', prompt: "I'm always hungry, can you bump up my carbs?" },
    { name: 'logNutrition', prompt: 'I just ate chicken and rice, like 6oz chicken and a cup of rice' },
    { name: 'bookSession', prompt: 'I want to schedule a session with my trainer for Thursday at 6 PM' },
    { name: 'openWorkoutPlan', prompt: 'Open my current workout plan and tell me what is on today\'s session' },
    { name: 'updateGoal', prompt: 'I hit my weight loss target, should I bulk now?' },
    { name: 'notifyTrainer', prompt: 'My knee has been killing me, let my trainer know' },
  ],
  perplexity: [
    { name: 'TRT Question', prompt: "What's the deal with TRT? Should I try it?" },
    { name: 'Testosterone', prompt: 'Is testosterone replacement therapy safe for fitness?' },
    { name: 'HGH Research', prompt: 'Tell me about HGH and how it affects training' },
    { name: 'Steroid Cycle', prompt: "What's the latest research on hormone levels and recovery?" },
  ],
  realWorld: [
    {
      name: 'Low Progress',
      prompt:
        'I have been logging consistently but still not seeing progress. What should I change?',
    },
    {
      name: 'Fatigue Risk',
      prompt: 'My sleep sucks, volume is high, and I am tired. What do you recommend?',
    },
    {
      name: 'Low Adherence',
      prompt:
        'Only logged nutrition 2 days this week. Help me figure out why I am struggling to stick to it.',
    },
    {
      name: 'Injury Concern',
      prompt:
        'I hit a PR on squats yesterday but my knee felt weird. Should I deload or keep pushing?',
    },
    {
      name: 'Getting Back',
      prompt: "Haven't worked out in 4 days. Give me a plan to get back on track.",
    },
  ],
};

const TOOL_EXPECTATIONS = {
  updateWorkout: ['updateWorkout'],
  adjustMacros: ['adjustMacroTargets', 'adjustMacros'],
  logNutrition: ['logNutrition'],
  bookSession: ['bookSession'],
  openWorkoutPlan: ['openWorkoutPlan'],
  updateGoal: ['updateGoal'],
  notifyTrainer: ['notifyTrainer'],
};

const LOG = '[AICoachTestSuite]';

function logTest(event, payload) {
  try {
    console.log(`${LOG} ${event}`, typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2));
  } catch (_) {
    console.log(`${LOG} ${event}`, payload);
  }
}

function toolMatchesExpectation(testName, toolCall) {
  if (!toolCall?.name) return false;
  const expected = TOOL_EXPECTATIONS[testName] || [TOOL_NAME_ALIASES[testName] || testName];
  return expected.includes(toolCall.name);
}

export default function AICoachTestSuite({
  userId,
  userProfile = {},
  trainerName = 'Coach',
  onBack,
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('context');
  const [testResults, setTestResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [context, setContext] = useState(null);
  const [contextError, setContextError] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);

  const loadContext = useCallback(async () => {
    if (!userId) {
      setContextError('Sign in to run tests');
      setContextLoading(false);
      return;
    }
    setContextLoading(true);
    setContextError(null);
    try {
      const ctx = await loadCoachContext(userId, userProfile);
      if (ctx) {
        setContext(ctx);
        logTest('CONTEXT_LOADED', {
          userId,
          source: ctx.source,
          userName: ctx.userName,
          goal: ctx.goal,
          nutritionDaysLogged: ctx.nutritionDaysLogged,
          workoutsLogged: ctx.workoutsLogged,
          avgCals: ctx.avgCals,
          avgSleep: ctx.avgSleep,
          targetCals: ctx.targetCals,
          fullContext: ctx,
        });
      } else {
        setContextError('Failed to load context — check Firebase / server');
        logTest('CONTEXT_FAILED', { userId, reason: 'null context' });
      }
    } catch (error) {
      setContextError(error?.message || String(error));
      logTest('CONTEXT_ERROR', { userId, error: error?.message || String(error) });
    } finally {
      setContextLoading(false);
    }
  }, [userId, userProfile]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const runSingleTest = async (testItem, tab) => {
    const startedAt = Date.now();
    logTest('TEST_START', { tab, name: testItem.name, prompt: testItem.prompt });

    try {
      if (!context) {
        const out = {
          ...testItem,
          status: 'error',
          message: 'Context not loaded',
          validations: ['Context not loaded'],
        };
        logTest('TEST_END', { ...out, durationMs: Date.now() - startedAt });
        return out;
      }

      if (__DEV__) {
        await resetAiCoachDailyUsage();
      }

      const isPerplexityRoute = shouldRouteToPerplexity(testItem.prompt);
      logTest('TEST_SEND', {
        tab,
        name: testItem.name,
        prompt: testItem.prompt,
        isPerplexityRoute,
        contextSnapshot: {
          nutritionDaysLogged: context.nutritionDaysLogged,
          workoutsLogged: context.workoutsLogged,
          avgCals: context.avgCals,
          avgSleep: context.avgSleep,
          goal: context.goal,
        },
      });

      const webMode = tab === 'perplexity' ? 'auto' : 'off';
      const response = await sendToAI(testItem.prompt, context, userId, userProfile, {
        testSuite: true,
        web: webMode,
      });

      logTest('TEST_RESPONSE_RAW', {
        tab,
        name: testItem.name,
        success: response?.success,
        source: response?.source,
        apiUrl: response?.apiUrl || response?.raw?._apiUrl,
        searchedWeb: response?.searchedWeb,
        usedWeeklyContext: response?.usedWeeklyContext,
        toolCall: response?.toolCall,
        toolCalls: response?.toolCalls,
        error: response?.error,
        message: response?.message,
        fullResponse: response?.message,
        raw: response?.raw,
      });

      let status = 'pass';
      const validations = [];

      if (response?.source === 'guardrail') {
        status = 'fail';
        validations.push('Blocked by server guardrail (not real AI) — restart npm run server');
      } else if (!response?.success) {
        status = 'fail';
        validations.push(response?.error || 'API call failed');
      } else if (!response.message || response.message.length < 10) {
        status = 'fail';
        validations.push('Response too short');
      } else if (
        response.message?.includes('Daily AI Coach limit') ||
        response.message?.includes('fitness coach — I can only help')
      ) {
        status = 'fail';
        validations.push('Not a real coach reply (limit or guardrail)');
      }

      if (tab === 'tools') {
        if (!response.toolCall) {
          status = status === 'fail' ? 'fail' : 'warn';
          validations.push('No tool call detected (expected for tool tests)');
        } else {
          if (!toolMatchesExpectation(testItem.name, response.toolCall)) {
            status = status === 'fail' ? 'fail' : 'warn';
            validations.push(
              `Tool was ${response.toolCall.name}; expected one of: ${(TOOL_EXPECTATIONS[testItem.name] || [testItem.name]).join(', ')}`
            );
          }
          try {
            const exec = await executeCoachTool({
              userId,
              trainerId: userProfile?.trainerId || userProfile?.trainer?.id || null,
              toolCall: response.toolCall,
            });
            if (exec.success) {
              validations.push(`Applied to Firestore: ${exec.message}`);
            } else {
              status = 'fail';
              validations.push(`Tool execution failed: ${exec.message}`);
            }
          } catch (execErr) {
            status = 'fail';
            validations.push(`Tool execution error: ${execErr?.message || execErr}`);
          }
        }
      }

      if (tab === 'perplexity') {
        if (!isPerplexityRoute) {
          status = status === 'fail' ? 'fail' : 'warn';
          validations.push('Perplexity route heuristic did not match prompt');
        }
        if (response.source !== 'perplexity' && response.searchedWeb !== true) {
          status = status === 'fail' ? 'fail' : 'warn';
          validations.push(
            `Expected Perplexity (source=perplexity); got source=${response.source || 'unknown'}`
          );
        }
      }

      const out = {
        ...testItem,
        status,
        message: response.message || '',
        fullResponse: response.message,
        toolCall: response.toolCall,
        toolCalls: response.toolCalls,
        source: response.source,
        searchedWeb: response.searchedWeb,
        usedWeeklyContext: response.usedWeeklyContext,
        isPerplexityRoute,
        validations,
        raw: response.raw,
        success: response.success,
        error: response.error,
        durationMs: Date.now() - startedAt,
      };
      logTest('TEST_END', out);
      return out;
    } catch (error) {
      const out = {
        ...testItem,
        status: 'error',
        message: error?.message || String(error),
        validations: [error?.message || String(error)],
        durationMs: Date.now() - startedAt,
      };
      logTest('TEST_ERROR', out);
      return out;
    }
  };

  const runAllTests = async () => {
    if (!context || running) return;
    setRunning(true);
    setTestResults([]);

    const tests = TEST_SUITES[activeTab] || [];
    const results = [];
    const runStartedAt = Date.now();

    const reset = await resetAiCoachDailyUsage();
    logTest('RESET_USAGE', reset);

    logTest('RUN_START', {
      tab: activeTab,
      testCount: tests.length,
      userId,
      usageReset: reset,
      contextSummary: {
        nutritionDaysLogged: context.nutritionDaysLogged,
        workoutsLogged: context.workoutsLogged,
        avgCals: context.avgCals,
        goal: context.goal,
      },
    });

    for (const test of tests) {
      const result = await runSingleTest(test, activeTab);
      results.push(result);
      setTestResults([...results]);
    }

    const summary = {
      tab: activeTab,
      pass: results.filter((r) => r.status === 'pass').length,
      warn: results.filter((r) => r.status === 'warn').length,
      fail: results.filter((r) => r.status === 'fail' || r.status === 'error').length,
      durationMs: Date.now() - runStartedAt,
      results,
    };
    logTest('RUN_COMPLETE', summary);
    console.log(`${LOG} COPY_PASTE_REPORT\n${JSON.stringify(summary, null, 2)}`);

    setRunning(false);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass':
        return COLORS.green;
      case 'fail':
        return COLORS.red;
      case 'warn':
        return COLORS.orange;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pass':
        return 'check-circle';
      case 'fail':
        return 'close-circle';
      case 'warn':
        return 'alert-circle';
      default:
        return 'help-circle';
    }
  };

  const passCount = testResults.filter((r) => r.status === 'pass').length;
  const failCount = testResults.filter((r) => r.status === 'fail' || r.status === 'error').length;
  const warnCount = testResults.filter((r) => r.status === 'warn').length;
  const tabTests = TEST_SUITES[activeTab] || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <CoachConnectHeader title="AI Coach Tests" isDark onBack={onBack} />

      <View style={styles.header}>
        <Text style={styles.title}>AI Coach Test Suite</Text>
        <Text style={styles.subtitle}>Trainer: {trainerName}</Text>
        {contextLoading && (
          <Text style={styles.contextInfo}>Loading 7-day context…</Text>
        )}
        {contextError && <Text style={styles.error}>{contextError}</Text>}
        {context && !contextLoading && (
          <Text style={styles.contextInfo}>
            Context: {context.userName} · {context.goal} · {context.nutritionDaysLogged}/7 nutrition
            days
          </Text>
        )}
        <TouchableOpacity onPress={loadContext} style={styles.reloadContext} disabled={contextLoading}>
          <MaterialCommunityIcons name="refresh" size={16} color={COLORS.pink} />
          <Text style={styles.reloadText}>Reload context</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {Object.keys(TEST_SUITES).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => {
              setActiveTab(tab);
              setTestResults([]);
            }}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {testResults.length > 0 && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="check-circle" size={20} color={COLORS.green} />
            <Text style={styles.summaryText}>{passCount} passed</Text>
          </View>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="alert-circle" size={20} color={COLORS.orange} />
            <Text style={styles.summaryText}>{warnCount} warned</Text>
          </View>
          <View style={styles.summaryItem}>
            <MaterialCommunityIcons name="close-circle" size={20} color={COLORS.red} />
            <Text style={styles.summaryText}>{failCount} failed</Text>
          </View>
        </View>
      )}

      <ScrollView style={styles.results} contentContainerStyle={{ paddingBottom: 24 }}>
        {testResults.map((result, idx) => (
          <View
            key={`${result.name}-${idx}`}
            style={[styles.resultCard, { borderLeftColor: getStatusColor(result.status) }]}
          >
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultPrompt}>&ldquo;{result.prompt}&rdquo;</Text>
              </View>
              <MaterialCommunityIcons
                name={getStatusIcon(result.status)}
                size={24}
                color={getStatusColor(result.status)}
              />
            </View>

            {result.message ? (
              <Text style={styles.resultMessage} selectable>
                {result.message}
              </Text>
            ) : null}
            {result.durationMs != null ? (
              <Text style={styles.metaText}>{result.durationMs}ms · source: {result.source || '—'}</Text>
            ) : null}

            {result.toolCall ? (
              <View style={styles.toolCallBox}>
                <Text style={styles.toolCallLabel}>Tool call detected</Text>
                <Text style={styles.toolCallName}>{result.toolCall.name}</Text>
              </View>
            ) : null}

            {(result.source === 'perplexity' || result.searchedWeb) && (
              <View style={styles.perplexityBox}>
                <MaterialCommunityIcons name="web" size={14} color={COLORS.pink} />
                <Text style={styles.perplexityText}>
                  Web search ({result.source || 'perplexity'})
                </Text>
              </View>
            )}

            {result.validations?.length > 0 && (
              <View style={styles.validations}>
                {result.validations.map((validation, vIdx) => (
                  <Text key={vIdx} style={styles.validationText}>
                    • {validation}
                  </Text>
                ))}
              </View>
            )}
          </View>
        ))}

        {running && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={COLORS.pink} />
            <Text style={styles.loadingText}>Running tests…</Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <TouchableOpacity
          style={[styles.runButton, (running || !context || contextLoading) && styles.runButtonDisabled]}
          onPress={runAllTests}
          disabled={running || !context || contextLoading}
        >
          {running ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons
                name="play"
                size={20}
                color={COLORS.textPrimary}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.runButtonText}>Run {tabTests.length} tests</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  contextInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  error: {
    fontSize: 12,
    color: COLORS.red,
    marginTop: 4,
  },
  reloadContext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  reloadText: {
    fontSize: 12,
    color: COLORS.pink,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: COLORS.cardBg,
  },
  activeTab: {
    backgroundColor: COLORS.pink,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  activeTabText: {
    color: COLORS.textPrimary,
  },
  summary: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 16,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  summaryText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  results: {
    flex: 1,
    padding: 16,
  },
  resultCard: {
    backgroundColor: COLORS.cardBg,
    borderLeftWidth: 4,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  resultPrompt: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },
  resultMessage: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  toolCallBox: {
    backgroundColor: 'rgba(255,107,157,0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  toolCallLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  toolCallName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.pink,
  },
  perplexityBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(96,165,250,0.1)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  perplexityText: {
    fontSize: 12,
    color: COLORS.pink,
    fontWeight: '600',
  },
  validations: {
    gap: 4,
  },
  validationText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  metaText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 6,
    opacity: 0.8,
  },
  loadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  runButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.pink,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  runButtonDisabled: {
    opacity: 0.5,
  },
  runButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
});
