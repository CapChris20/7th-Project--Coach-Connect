// Dev screen that runs canned prompts against the AI Coach and grades the replies.
// Flow: load the 7-day snapshot → pick a suite tab → send each prompt → show pass / warn / fail.
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
import { lightColors, darkColors } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Solid nb chrome for the self-test sheet — no glass hairlines / indigo pink.
// Manipulate here: accent colors for pass/warn/fail chips on this dark test sheet only.
const SHEET_COLORS = {
  sheetBackground: lightColors.nbInk,
  cardBackground: darkColors.nbSurface,
  textPrimary: lightColors.white,
  textSecondary: darkColors.nbMuted,
  accentPink: '#FB923C',
  accentOrange: '#F97316',
  accentGreen: '#10B981',
  accentRed: '#FF6B6B',
};

// vocab: each suite is a list of { name, prompt } the Run button walks in order.
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

// Which tool name(s) count as a pass for each tools-suite row.
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
// Manipulate here: how many reply characters show in the result card preview.
const PREVIEW_MESSAGE_CHARS = 120;
// Manipulate here: replies shorter than this fail the length check.
const MINIMUM_REPLY_CHARS = 10;
// Manipulate here: pause between prompts so the suite does not hammer the coach API.
const TEST_PAUSE_MS = 1000;
const SIGN_IN_ERROR = 'Sign in to run tests';
const CONTEXT_LOAD_ERROR = 'Failed to load context — check Firebase / server';
const CONTEXT_MISSING_MESSAGE = 'Context not loaded';
const FOOTER_SAFE_PAD_MIN = 12;
const RESULTS_SCROLL_BOTTOM_PAD = 24;

const STATUS_COLORS = {
  [STATUS_PASS]: SHEET_COLORS.accentGreen,
  [STATUS_FAIL]: SHEET_COLORS.accentRed,
  [STATUS_WARN]: SHEET_COLORS.accentOrange,
};

const STATUS_ICONS = {
  [STATUS_PASS]: 'check-circle',
  [STATUS_FAIL]: 'close-circle',
  [STATUS_WARN]: 'alert-circle',
};

// ===== HELPER FUNCTIONS =====

/**
 * Shorten a reply so the result card stays skim-friendly.
 * @param {string} text
 * @param {number} [maxChars]
 * @returns {string}
 */
function cutTextToMaxChars(text, maxChars = 100) {
  const fullText = String(text || '');
  if (fullText.length <= maxChars) return fullText;
  return `${fullText.slice(0, maxChars)}…`;
}

/**
 * Names that count as a correct tool for this test row.
 * Falls back to TOOL_NAME_ALIASES, then the row name itself.
 * @param {string} testName
 * @returns {string[]}
 */
function expectedToolNames(testName) {
  const fromExpectations = TOOL_EXPECTATIONS[testName];
  if (fromExpectations) return fromExpectations;

  const aliasName = TOOL_NAME_ALIASES[testName];
  if (aliasName) return [aliasName];

  return [testName];
}

/**
 * True when the coach’s toolCall.name is one of the names we accept for this row.
 * @param {string} testName
 * @param {object} toolCall
 * @returns {boolean}
 */
function toolMatchesExpectation(testName, toolCall) {
  // No tool name means there is nothing to grade against the expected list.
  let toolCallName = null;
  if (toolCall != null) {
    toolCallName = toolCall.name;
  }
  if (!toolCallName) return false;
  const expectedNames = expectedToolNames(testName);
  return expectedNames.includes(toolCallName);
}

/**
 * Fail already stays fail. Otherwise take the milder next status (usually warn).
 * @param {string} currentStatus
 * @param {string} nextStatus
 * @returns {string}
 */
function worseStatus(currentStatus, nextStatus) {
  if (currentStatus === STATUS_FAIL) return STATUS_FAIL;
  return nextStatus;
}

/**
 * Result shape when the 7-day snapshot never loaded.
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
 * Result shape when sendToAI threw.
 * @param {object} testItem
 * @param {*} error
 * @returns {object}
 */
function testErrorResult(testItem, error) {
  let errorMessage = String(error);
  if (error != null && error.message) {
    errorMessage = error.message;
  }
  return {
    ...testItem,
    status: STATUS_ERROR,
    message: errorMessage,
    validations: [errorMessage],
  };
}

/**
 * First gate: API success + reply long enough to be a real answer.
 * @param {object} response
 * @returns {{ status: string, validations: string[] }}
 */
function gradeReplyLengthAndSuccess(response) {
  let responseSucceeded = false;
  let failReason = 'API call failed';
  let replyText = '';
  if (response != null) {
    responseSucceeded = Boolean(response.success);
    if (response.error) {
      failReason = response.error;
    }
    replyText = response.message || '';
  }

  if (!responseSucceeded) {
    return { status: STATUS_FAIL, validations: [failReason] };
  }

  const replyIsTooShort = replyText.length < MINIMUM_REPLY_CHARS;
  if (replyIsTooShort) {
    return { status: STATUS_FAIL, validations: ['Response too short'] };
  }

  return { status: STATUS_PASS, validations: [] };
}

/**
 * Tools suite: warn when the tool is missing or the wrong name.
 * Mutates validations in place; returns the (possibly worse) status.
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

  const toolNameMatches = toolMatchesExpectation(testName, response.toolCall);
  if (!toolNameMatches) {
    const expectedList = (TOOL_EXPECTATIONS[testName] || [testName]).join(', ');
    validations.push(
      `Tool was ${response.toolCall.name}; expected one of: ${expectedList}`,
    );
    return worseStatus(status, STATUS_WARN);
  }

  return status;
}

/**
 * Perplexity suite: warn when the heuristic or the reply source is wrong.
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

  const usedPerplexitySource = response.source === 'perplexity';
  const searchedTheWeb = response.searchedWeb === true;
  const looksLikeWebAnswer = usedPerplexitySource || searchedTheWeb;

  if (!looksLikeWebAnswer) {
    nextStatus = worseStatus(nextStatus, STATUS_WARN);
    validations.push(
      `Expected Perplexity (source=perplexity); got source=${response.source || 'unknown'}`,
    );
  }

  return nextStatus;
}

/**
 * Grade one canned prompt after sendToAI returns.
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
    message: cutTextToMaxChars(response.message, PREVIEW_MESSAGE_CHARS),
    fullResponse: response.message,
    toolCall: response.toolCall,
    source: response.source,
    searchedWeb: response.searchedWeb,
    isPerplexityRoute,
    validations,
  };
}

/**
 * Wait between prompts so we do not hammer the coach API.
 * @returns {Promise<void>}
 */
function pauseBetweenTests() {
  return new Promise((resolve) => setTimeout(resolve, TEST_PAUSE_MS));
}

/**
 * Border / icon color for a graded result status.
 * @param {string} status
 * @returns {string}
 */
function statusColor(status) {
  return STATUS_COLORS[status] || SHEET_COLORS.textSecondary;
}

/**
 * MaterialCommunityIcons name for a graded result status.
 * @param {string} status
 * @returns {string}
 */
function statusIcon(status) {
  return STATUS_ICONS[status] || 'help-circle';
}

/**
 * Tally pass / fail / warn for the summary strip.
 * Errors count with fails.
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

function listSuiteTabNames() {
  return Object.keys(TEST_SUITES);
}

function testsForActiveTab(activeTab) {
  return TEST_SUITES[activeTab] || [];
}

// ===== PURE LAYOUT (no hooks) =====

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

  // Named local so JSX does not bury the template string.
  const contextSummary = `Context: ${context.userName} · ${context.goal} · ${context.nutritionDaysLogged}/7 nutrition days`;
  return <Text style={styles.contextInfo}>{contextSummary}</Text>;
}

function RunTestsLabel({ running, tabTestCount }) {
  if (running) {
    return <ActivityIndicator color={SHEET_COLORS.textPrimary} />;
  }

  return (
    <>
      <MaterialCommunityIcons
        name="play"
        size={20}
        color={SHEET_COLORS.textPrimary}
        style={styles.runButtonIcon}
      />
      <Text style={styles.runButtonText}>Run {tabTestCount} tests</Text>
    </>
  );
}

function SuiteTabButton({ tabName, isActive, onSelectTab }) {
  const tabStyle = isActive ? [styles.tab, styles.activeTab] : styles.tab;
  const tabTextStyle = isActive
    ? [styles.tabText, styles.activeTabText]
    : styles.tabText;

  return (
    <TouchableOpacity style={tabStyle} onPress={onSelectTab}>
      <Text style={tabTextStyle}>{tabName}</Text>
    </TouchableOpacity>
  );
}

function SuiteTabBar({ activeTab, onPickTab }) {
  const tabNames = listSuiteTabNames();
  const tabButtons = [];
  for (let index = 0; index < tabNames.length; index += 1) {
    const tabName = tabNames[index];
    tabButtons.push(
      <SuiteTabButton
        key={tabName}
        tabName={tabName}
        isActive={activeTab === tabName}
        onSelectTab={() => onPickTab(tabName)}
      />,
    );
  }

  return <View style={styles.tabs}>{tabButtons}</View>;
}

function PassFailSummaryStrip({ passCount, failCount, warnCount }) {
  return (
    <View style={styles.summary}>
      <View style={styles.summaryItem}>
        <MaterialCommunityIcons name="check-circle" size={20} color={SHEET_COLORS.accentGreen} />
        <Text style={styles.summaryText}>{passCount} passed</Text>
      </View>
      <View style={styles.summaryItem}>
        <MaterialCommunityIcons name="alert-circle" size={20} color={SHEET_COLORS.accentOrange} />
        <Text style={styles.summaryText}>{warnCount} warned</Text>
      </View>
      <View style={styles.summaryItem}>
        <MaterialCommunityIcons name="close-circle" size={20} color={SHEET_COLORS.accentRed} />
        <Text style={styles.summaryText}>{failCount} failed</Text>
      </View>
    </View>
  );
}

function ToolCallDetectedBox({ toolCall }) {
  if (!toolCall) return null;

  return (
    <View style={styles.toolCallBox}>
      <Text style={styles.toolCallLabel}>Tool call detected</Text>
      <Text style={styles.toolCallName}>{toolCall.name}</Text>
    </View>
  );
}

function WebSearchBadge({ source, searchedWeb }) {
  const usedWebSearch = source === 'perplexity' || searchedWeb;
  if (!usedWebSearch) return null;

  const sourceLabel = source || 'perplexity';

  return (
    <View style={styles.perplexityBox}>
      <MaterialCommunityIcons name="web" size={14} color={SHEET_COLORS.accentPink} />
      <Text style={styles.perplexityText}>Web search ({sourceLabel})</Text>
    </View>
  );
}

function ValidationBulletList({ validations }) {
  if (validations == null || validations.length === 0) return null;

  const bulletLines = [];
  for (let validationIndex = 0; validationIndex < validations.length; validationIndex += 1) {
    const validation = validations[validationIndex];
    bulletLines.push(
      <Text key={validationIndex} style={styles.validationText}>
        • {validation}
      </Text>,
    );
  }

  return <View style={styles.validations}>{bulletLines}</View>;
}

function OneTestResultCard({ result, resultIndex }) {
  const borderColor = statusColor(result.status);
  const iconName = statusIcon(result.status);
  const iconColor = statusColor(result.status);
  const cardKey = `${result.name}-${resultIndex}`;

  return (
    <View key={cardKey} style={[styles.resultCard, { borderLeftColor: borderColor }]}>
      <View style={styles.resultHeader}>
        <View style={styles.resultTitleBlock}>
          <Text style={styles.resultName}>{result.name}</Text>
          <Text style={styles.resultPrompt}>&ldquo;{result.prompt}&rdquo;</Text>
        </View>
        <MaterialCommunityIcons name={iconName} size={24} color={iconColor} />
      </View>

      {result.message ? <Text style={styles.resultMessage}>{result.message}</Text> : null}

      <ToolCallDetectedBox toolCall={result.toolCall} />
      <WebSearchBadge source={result.source} searchedWeb={result.searchedWeb} />
      <ValidationBulletList validations={result.validations} />
    </View>
  );
}

function RunningTestsSpinner() {
  return (
    <View style={styles.loadingBox}>
      <ActivityIndicator size="large" color={SHEET_COLORS.accentPink} />
      <Text style={styles.loadingText}>Running tests…</Text>
    </View>
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
  const tabTests = testsForActiveTab(activeTab);
  const footerPad = Math.max(insets.bottom, FOOTER_SAFE_PAD_MIN);
  const canRunTests = Boolean(context) && !running && !contextLoading;
  const showSummary = testResults.length > 0;
  const runButtonStyle = canRunTests
    ? styles.runButton
    : [styles.runButton, styles.runButtonDisabled];

  function pickSuiteTab(tabName) {
    setActiveTab(tabName);
    setTestResults([]);
  }

  const resultCards = [];
  for (let resultIndex = 0; resultIndex < testResults.length; resultIndex += 1) {
    const result = testResults[resultIndex];
    resultCards.push(
      <OneTestResultCard
        key={`${result.name}-${resultIndex}`}
        result={result}
        resultIndex={resultIndex}
      />,
    );
  }

  let summaryStrip = null;
  if (showSummary) {
    summaryStrip = (
      <PassFailSummaryStrip
        passCount={passCount}
        failCount={failCount}
        warnCount={warnCount}
      />
    );
  }

  let runningSpinner = null;
  if (running) {
    runningSpinner = <RunningTestsSpinner />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <TopHeader title="AI Coach Tests" isDark onBack={onBack} />

      <View style={styles.header}>
        <Text style={styles.title}>AI Coach Test Suite</Text>
        <Text style={styles.subtitle}>Trainer: {trainerName}</Text>
        <LoadingContextLine contextLoading={contextLoading} />
        <ContextErrorLine contextError={contextError} />
        <LoadedContextLine context={context} contextLoading={contextLoading} />
        <TouchableOpacity
          onPress={loadContext}
          style={styles.reloadContext}
          disabled={contextLoading}
        >
          <MaterialCommunityIcons name="refresh" size={16} color={SHEET_COLORS.accentPink} />
          <Text style={styles.reloadText}>Reload context</Text>
        </TouchableOpacity>
      </View>

      <SuiteTabBar activeTab={activeTab} onPickTab={pickSuiteTab} />

      {summaryStrip}

      <ScrollView
        style={styles.results}
        contentContainerStyle={styles.resultsContent}
      >
        {resultCards}
        {runningSpinner}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPad }]}>
        <TouchableOpacity
          style={runButtonStyle}
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
 * Hook order frozen: insets → tab → results → running → context → error → loading.
 * @param {{ userId?: string, userProfile?: object, trainerName?: string, onBack?: Function }} props
 */
export default function CoachSelfTest({
  userId,
  userProfile = {},
  trainerName = DEFAULT_TRAINER_NAME,
  onBack,
}) {
  // vocab: useSafeAreaInsets = notch / home-indicator padding from the device
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState(TAB_CONTEXT);
  const [testResults, setTestResults] = useState([]);
  const [running, setRunning] = useState(false);
  const [context, setContext] = useState(null);
  const [contextError, setContextError] = useState(null);
  const [contextLoading, setContextLoading] = useState(true);

  // vocab: useCallback keeps loadContext stable so the mount effect does not loop
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
      let loadErrorMessage = String(error);
      if (error != null && error.message) {
        loadErrorMessage = error.message;
      }
      setContextError(loadErrorMessage);
    } finally {
      setContextLoading(false);
    }
  }, [userId, userProfile]);

  // vocab: useEffect — run loadContext once the callback identity settles / changes
  useEffect(() => {
    loadContext();
  }, [loadContext]);

  /**
   * Send one canned prompt and return a graded result object.
   */
  async function runSingleTest(testItem) {
    try {
      // 1. Need week context first — a missing snapshot is an error, not a fail.
      if (!context) return missingContextResult(testItem);

      // 2. Ask the coach the canned prompt.
      // vocab: shouldRouteToPerplexity = local heuristic; sendToAI still decides the real source
      const isPerplexityRoute = shouldRouteToPerplexity(testItem.prompt);
      const response = await sendToAI(testItem.prompt, context, userId, userProfile);

      // 3. Grade length, then the tool / Perplexity extras for that tab.
      return gradeOneTest(testItem, response, isPerplexityRoute, activeTab);
    } catch (error) {
      return testErrorResult(testItem, error);
    }
  }

  /**
   * Walk every prompt in the active suite, updating the list as each finishes.
   */
  async function runAllTests() {
    if (!context || running) return;

    // 1. Clear last run and lock the button.
    setRunning(true);
    setTestResults([]);

    // 2. Run each prompt in this tab, pausing so we do not hammer the API.
    const tests = testsForActiveTab(activeTab);
    const results = [];
    for (let testIndex = 0; testIndex < tests.length; testIndex += 1) {
      const result = await runSingleTest(tests[testIndex]);
      results.push(result);
      // Spread a new array so React sees a new reference each step.
      setTestResults([...results]);
      await pauseBetweenTests();
    }

    // 3. Unlock the button.
    setRunning(false);
  }

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

// ===== PLUMBING — skip unless debugging =====

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SHEET_COLORS.sheetBackground,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: darkColors.nbBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: SHEET_COLORS.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: SHEET_COLORS.textSecondary,
    marginBottom: 6,
  },
  contextInfo: {
    fontSize: 12,
    color: SHEET_COLORS.textSecondary,
    fontWeight: '600',
  },
  error: {
    fontSize: 12,
    color: SHEET_COLORS.accentRed,
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
    color: SHEET_COLORS.accentPink,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: darkColors.nbBorder,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: SHEET_COLORS.cardBackground,
  },
  activeTab: {
    backgroundColor: SHEET_COLORS.accentPink,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: SHEET_COLORS.textSecondary,
    textTransform: 'capitalize',
  },
  activeTabText: {
    color: SHEET_COLORS.textPrimary,
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
    color: SHEET_COLORS.textSecondary,
  },
  results: {
    flex: 1,
    padding: 16,
  },
  resultsContent: {
    paddingBottom: RESULTS_SCROLL_BOTTOM_PAD,
  },
  resultCard: {
    backgroundColor: SHEET_COLORS.cardBackground,
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
  resultTitleBlock: {
    flex: 1,
  },
  resultName: {
    fontSize: 14,
    fontWeight: '700',
    color: SHEET_COLORS.textPrimary,
    marginBottom: 4,
  },
  resultPrompt: {
    fontSize: 12,
    color: SHEET_COLORS.textSecondary,
    fontStyle: 'italic',
  },
  resultMessage: {
    fontSize: 13,
    color: SHEET_COLORS.textSecondary,
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
    color: SHEET_COLORS.textSecondary,
    marginBottom: 4,
  },
  toolCallName: {
    fontSize: 13,
    fontWeight: '700',
    color: SHEET_COLORS.accentPink,
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
    color: SHEET_COLORS.accentPink,
    fontWeight: '600',
  },
  validations: {
    gap: 4,
  },
  validationText: {
    fontSize: 11,
    color: SHEET_COLORS.textSecondary,
  },
  loadingBox: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    color: SHEET_COLORS.textSecondary,
    marginTop: 12,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: darkColors.nbBorder,
  },
  runButton: {
    flexDirection: 'row',
    backgroundColor: SHEET_COLORS.accentPink,
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  runButtonDisabled: {
    opacity: 0.5,
  },
  runButtonIcon: {
    marginRight: 8,
  },
  runButtonText: {
    color: SHEET_COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
});
