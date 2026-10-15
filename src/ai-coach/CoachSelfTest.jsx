// Dev screen that runs canned prompts against the AI Coach and grades the replies.
// Flow: load the 7-day snapshot → pick a tab → send each prompt → show pass / warn / fail.
// Used from the trainer/dev tools. Not part of the client chat.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { loadCoachContextEnhanced as loadCoachContext } from '../ai-coach/coach-knowledge/loadYourWeekForCoach';
import { sendToAI } from '../ai-coach/conversation/sendMessageToCoach';
import { shouldRouteToPerplexity } from './internet-lookup/internetLookupRules';
import { TOOL_NAME_ALIASES } from '../ai-coach/coach-actions/carryOutAction';
import TopHeader from '../for-both/loading-and-header/TopHeader';

// ===== NAMED CONSTANTS =====

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
    { name: 'generateDeload', prompt: 'I have been training hard for 6 weeks, think I should deload?' },
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
  generateDeload: ['generateDeloadWeek', 'generateDeload'],
  updateGoal: ['updateGoal'],
  notifyTrainer: ['notifyTrainer'],
};

const STATUS_PASS = 'pass';
const STATUS_FAIL = 'fail';
const STATUS_WARN = 'warn';
const STATUS_ERROR = 'error';
const TAB_CONTEXT = 'context';
const TAB_TOOLS = 'tools';
const TAB_PERPLEXITY = 'perplexity';
const DEFAULT_TRAINER_NAME = 'Coach';
const PREVIEW_MESSAGE_CHARS = 120;
const MINIMUM_REPLY_CHARS = 10;
// Manipulate here: pause between prompts so the suite does not hammer the coach API.
const TEST_PAUSE_MS = 1000;
const SIGN_IN_ERROR = 'Sign in to run tests';
const CONTEXT_LOAD_ERROR = 'Failed to load context — check Firebase / server';
const CONTEXT_MISSING_MESSAGE = 'Context not loaded';

const STATUS_COLORS = {
  [STATUS_PASS]: COLORS.green,
  [STATUS_FAIL]: COLORS.red,
  [STATUS_WARN]: COLORS.orange,
};

const STATUS_ICONS = {
  [STATUS_PASS]: 'check-circle',
  [STATUS_FAIL]: 'close-circle',
  [STATUS_WARN]: 'alert-circle',
};

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string}
 */
function truncateText(text, maxChars = 100) {
  const fullText = String(text || '');
  if (fullText.length <= maxChars) return fullText;
  return `${fullText.slice(0, maxChars)}…`;
}

/**
 * @param {string} testName
 * @returns {string[]}
 */
function expectedToolNames(testName) {
  return TOOL_EXPECTATIONS[testName] || [TOOL_NAME_ALIASES[testName] || testName];
}

/**
 * @param {string} testName
 * @param {object} toolCall
 * @returns {boolean}
 */
function toolMatchesExpectation(testName, toolCall) {
  if (!toolCall?.name) return false;
  const expected = expectedToolNames(testName);
  return expected.includes(toolCall.name);
}

/**
 * Fail already stays fail. Otherwise take the milder next status (warn).
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {string}
 */
function worseStatus(currentStatus, nextStatus) {
  if (currentStatus === STATUS_FAIL) return STATUS_FAIL;
  return nextStatus;
}

/**
 * @param {object} testItem
 * @returns {object}
 */
function missingContextResult(testItem) {
  return {
    ...testItem,
    status: STATUS_ERROR,
    message: CONTEXT_MISSING_MESSAGE,
    validations: [CONTEXT_MISSING_MESSAGE],
  };
}

/**
 * @param {object} testItem
 * @param {*} error
 * @returns {object}
 */
function testErrorResult(testItem, error) {
  return {
    ...testItem,
    status: STATUS_ERROR,
    message: error?.message || String(error),
    validations: [error?.message || String(error)],
  };
}

/**
 * @param {object} response
 * @returns {{ status: string, validations: string[] }}
 */
function gradeReplyLengthAndSuccess(response) {
  if (!response?.success) {
    return { status: STATUS_FAIL, validations: [response?.error || 'API call failed'] };
  }
  if (!response.message || response.message.length < MINIMUM_REPLY_CHARS) {
    return { status: STATUS_FAIL, validations: ['Response too short'] };
  }
  return { status: STATUS_PASS, validations: [] };
}

/**
 * @param {string} testName
 * @param {object} response
 * @param {string} status
 * @param {string[]} validations
 * @returns {string}
 */
function addToolValidations(testName, response, status, validations) {
  if (!response.toolCall) {
    validations.push('No tool call detected (expected for tool tests)');
    return worseStatus(status, STATUS_WARN);
  }
  if (!toolMatchesExpectation(testName, response.toolCall)) {
    validations.push(
      `Tool was ${response.toolCall.name}; expected one of: ${(TOOL_EXPECTATIONS[testName] || [testName]).join(', ')}`,
    );
    return worseStatus(status, STATUS_WARN);
  }
  return status;
}

/**
 * @param {boolean} isPerplexityRoute
 * @param {object} response
 * @param {string} status
 * @param {string[]} validations
 * @returns {string}
 */
function addPerplexityValidations(isPerplexityRoute, response, status, validations) {
  let nextStatus = status;
  if (!isPerplexityRoute) {
    nextStatus = worseStatus(nextStatus, STATUS_WARN);
    validations.push('Perplexity route heuristic did not match prompt');
  }
  if (response.source !== 'perplexity' && response.searchedWeb !== true) {
    nextStatus = worseStatus(nextStatus, STATUS_WARN);
    validations.push(
      `Expected Perplexity (source=perplexity); got source=${response.source || 'unknown'}`,
    );
  }
  return nextStatus;
}

/**
 * @param {object} testItem
 * @param {object} response
 * @param {boolean} isPerplexityRoute
 * @param {string} activeTab
 * @returns {object}
 */
function gradeOneTest(testItem, response, isPerplexityRoute, activeTab) {
  const graded = gradeReplyLengthAndSuccess(response);
  let status = graded.status;
  const validations = graded.validations;

  if (activeTab === TAB_TOOLS) {
    status = addToolValidations(testItem.name, response, status, validations);
  }
  if (activeTab === TAB_PERPLEXITY) {
    status = addPerplexityValidations(isPerplexityRoute, response, status, validations);
  }

  return {
    ...testItem,
    status,
    message: truncateText(response.message, PREVIEW_MESSAGE_CHARS),
    fullResponse: response.message,
    toolCall: response.toolCall,
    source: response.source,
    searchedWeb: response.searchedWeb,
    isPerplexityRoute,
    validations,
  };
}

/**
 * @returns {Promise<void>}
 */
function pauseBetweenTests() {
  return new Promise((resolve) => setTimeout(resolve, TEST_PAUSE_MS));
}

/**
 * @param {string} status
 * @returns {string}
 */
function statusColor(status) {
  return STATUS_COLORS[status] || COLORS.textSecondary;
}

/**
 * @param {string} status
 * @returns {string}
 */
function statusIcon(status) {
  return STATUS_ICONS[status] || 'help-circle';
}

/**
 * @param {Array} testResults
 * @returns {{ passCount: number, failCount: number, warnCount: number }}
 */
function countResultsByStatus(testResults) {
  let passCount = 0;
  let failCount = 0;
  let warnCount = 0;
  for (const result of testResults) {
    if (result.status === STATUS_PASS) passCount += 1;
    if (result.status === STATUS_FAIL || result.status === STATUS_ERROR) failCount += 1;
    if (result.status === STATUS_WARN) warnCount += 1;
  }
  return { passCount, failCount, warnCount };
}

function LoadingContextLine({ contextLoading }) {
  if (!contextLoading) return null;
  return <Text style={styles.contextInfo}>Loading 7-day context…</Text>;
}

function ContextErrorLine({ contextError }) {
  if (!contextError) return null;
  return <Text style={styles.error}>{contextError}</Text>;
}

function LoadedContextLine({ context, contextLoading }) {
  if (!context || contextLoading) return null;
  const contextSummary = `Context: ${context.userName} · ${context.goal} · ${context.nutritionDaysLogged}/7 nutrition days`;
  return <Text style={styles.contextInfo}>{contextSummary}</Text>;
}

function RunTestsLabel({ running, tabTestCount }) {
  if (running) return <ActivityIndicator color={COLORS.textPrimary} />;
  return (
    <>
      <MaterialCommunityIcons
        name="play"
        size={20}
        color={COLORS.textPrimary}
        style={{ marginRight: 8 }}
      />
      <Text style={styles.runButtonText}>Run {tabTestCount} tests</Text>
    </>
  );
}

function CoachSelfTestLayout({
  testResults,
  activeTab,
  insets,
  onBack,
  trainerName,
  contextLoading,
  contextError,
  context,
  loadContext,
  setActiveTab,
  setTestResults,
  running,
  runAllTests,
}) {
  const { passCount, failCount, warnCount } = countResultsByStatus(testResults);
  const tabTests = TEST_SUITES[activeTab] || [];
  const footerPad = Math.max(insets.bottom, 12);
  const canRunTests = Boolean(context) && !running && !contextLoading;
  const showSummary = testResults.length > 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TopHeader title="AI Coach Tests" isDark onBack={onBack} />

      <View style={styles.header}>
        <Text style={styles.title}>AI Coach Test Suite</Text>
        <Text style={styles.subtitle}>Trainer: {trainerName}</Text>
        <LoadingContextLine contextLoading={contextLoading} />
        <ContextErrorLine contextError={contextError} />
        <LoadedContextLine context={context} contextLoading={contextLoading} />
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

      {showSummary && (
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
            style={[styles.resultCard, { borderLeftColor: statusColor(result.status) }]}
          >
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName}>{result.name}</Text>
                <Text style={styles.resultPrompt}>&ldquo;{result.prompt}&rdquo;</Text>
              </View>
              <MaterialCommunityIcons
                name={statusIcon(result.status)}
                size={24}
                color={statusColor(result.status)}
              />
            </View>

            {result.message ? <Text style={styles.resultMessage}>{result.message}</Text> : null}

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

      <View style={[styles.footer, { paddingBottom: footerPad }]}>
        <TouchableOpacity
          style={[styles.runButton, !canRunTests && styles.runButtonDisabled]}
          onPress={runAllTests}
          disabled={!canRunTests}
        >
          <RunTestsLabel running={running} tabTestCount={tabTests.length} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Runs the canned coach prompts for one signed-in user and grades each reply.
 * @param {{ userId?: string, userProfile?: object, trainerName?: string, onBack?: Function }} props
 */
export default function CoachSelfTest({
  userId,
  userProfile = {},
  trainerName = DEFAULT_TRAINER_NAME,
  onBack,
}) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(TAB_CONTEXT);
  const [testResults, setTestResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [context, setContext] = useState(null);
  const [contextError, setContextError] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);

  const loadContext = useCallback(async () => {
    // 1. Tests need a signed-in user.
    if (!userId) {
      setContextError(SIGN_IN_ERROR);
      setContextLoading(false);
      return;
    }

    // 2. Load the 7-day coach snapshot this suite grades against.
    setContextLoading(true);
    setContextError(null);
    try {
      const weekContext = await loadCoachContext(userId, userProfile);
      if (weekContext) {
        setContext(weekContext);
      } else {
        setContextError(CONTEXT_LOAD_ERROR);
      }
    } catch (error) {
      setContextError(error?.message || String(error));
    } finally {
      setContextLoading(false);
    }
  }, [userId, userProfile]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const runSingleTest = async (testItem) => {
    try {
      // 1. Need week context first — a missing snapshot is an error, not a fail.
      if (!context) return missingContextResult(testItem);

      // 2. Ask the coach the canned prompt.
      const isPerplexityRoute = shouldRouteToPerplexity(testItem.prompt);
      const response = await sendToAI(testItem.prompt, context, userId, userProfile);

      // 3. Grade length, then the tool / Perplexity extras for that tab.
      return gradeOneTest(testItem, response, isPerplexityRoute, activeTab);
    } catch (error) {
      return testErrorResult(testItem, error);
    }
  };

  const runAllTests = async () => {
    if (!context || running) return;

    // 1. Clear last run and lock the button.
    setRunning(true);
    setTestResults([]);

    // 2. Run each prompt in this tab, pausing so we do not hammer the API.
    const tests = TEST_SUITES[activeTab] || [];
    const results = [];
    for (const testItem of tests) {
      const result = await runSingleTest(testItem);
      results.push(result);
      setTestResults([...results]);
      await pauseBetweenTests();
    }

    // 3. Unlock the button.
    setRunning(false);
  };

  return (
    <CoachSelfTestLayout
      testResults={testResults}
      activeTab={activeTab}
      insets={insets}
      onBack={onBack}
      trainerName={trainerName}
      contextLoading={contextLoading}
      contextError={contextError}
      context={context}
      loadContext={loadContext}
      setActiveTab={setActiveTab}
      setTestResults={setTestResults}
      running={running}
      runAllTests={runAllTests}
    />
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
