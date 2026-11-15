// Lets a shared screen say navigate('settings') without knowing which shell is mounted.
// Flow: pick client or trainer shell context → build a navigate(keyword) function → open the matching panel.
// Used by: Settings and other screens reused in both shells when no navigation prop is passed in.
// Read order: constants → exported recipes → keyword table PLUMBING.

import { useContext, useMemo } from 'react';
import { ClientOpenScreenTracker } from '../client-app/navigation/ClientOpenScreenTracker';
import { TrainerOpenScreenTracker } from '../trainer-app/navigation/TrainerOpenScreenTracker';

// ===== NAMED CONSTANTS =====

// Manipulate here: keyword strings callers pass into navigate(...). Letters are frozen for existing call sites.
const SCREEN_HOME = 'home';
const SCREEN_PROFILE = 'profile';
const SCREEN_PROFILE_LEGACY = 'ViewMyMyProfileScreen';
const SCREEN_SETTINGS = 'settings';
const SCREEN_SETTINGS_LEGACY = 'SettingsScreen';
const SCREEN_HELP_FAQ = 'helpFaq';
const SCREEN_TERMS = 'terms';
const SCREEN_PRIVACY = 'privacy';
const SCREEN_CONTACT_SUPPORT = 'contactSupport';
const SCREEN_BUG_REPORT = 'bugReport';
const SCREEN_PRIVACY_DATA_RIGHTS = 'privacyDataRights';
const SCREEN_NUTRITION = 'nutrition';
const SCREEN_WORKOUT = 'workout';
const SCREEN_MESSAGES = 'messages';
const SCREEN_CREATE = 'create';
const SCREEN_VOICE = 'voice';
const SCREEN_AI_CHAT = 'aiChat';
const SCREEN_PAYMENTS = 'payments';
const SCREEN_EARNINGS_LEGACY = 'EarningsScreen';
const SCREEN_DASHBOARD_BILLING = 'dashboardBilling';
const SCREEN_COACHING_PAYMENT = 'coachingPayment';

// ===== HELPER FUNCTIONS =====
// (keyword table helpers live under PLUMBING)

// ===== MAIN FUNCTION =====

/**
 * Build a navigate(screenKeyword) function from a mounted shell context.
 * Returns null when nothing is mounted; callers should no-op.
 * @param {object|null|undefined} shellContext
 * @returns {Function|null}
 */
export function buildNavigateFromShell(shellContext) {
  // 1. No shell → caller gets null and should skip navigation.
  if (!shellContext) return null;

  // 2. Some shells already expose one onNavigate — hand it back unchanged.
  const shellAlreadyHasNavigate = typeof shellContext.onNavigate === 'function';
  if (shellAlreadyHasNavigate) return shellContext.onNavigate;

  // 3. Otherwise wrap our keyword table around this shell instance.
  return function navigateByScreenKeyword(screenKeyword) {
    runScreenKeywordOnShell(shellContext, screenKeyword);
  };
}

/**
 * Hook: prefer a parent-passed navigate, else build one from whichever shell context is live.
 * Hook order frozen: client context → trainer context → useMemo.
 * @param {Function|undefined} navigateFromParent
 * @returns {Function|null}
 */
export function useShellNavigate(navigateFromParent) {
  // vocab: useContext = read the nearest provider value for that tracker (client or trainer shell)
  const clientShell = useContext(ClientOpenScreenTracker);
  const trainerShell = useContext(TrainerOpenScreenTracker);
  const activeShell = clientShell || trainerShell;

  // vocab: useMemo = keep the same function identity unless shell or parent override changes
  return useMemo(() => {
    const parentPassedANavigate = typeof navigateFromParent === 'function';
    if (parentPassedANavigate) return navigateFromParent;
    return buildNavigateFromShell(activeShell);
  }, [navigateFromParent, activeShell]);
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Call a shell method if it exists (plain if, no optional call).
 * @param {Function|undefined|null} maybeFn
 */
function callIfPresent(maybeFn) {
  if (!maybeFn) return;
  maybeFn();
}

/**
 * Close whatever panel is open by returning to home, then open the next panel.
 * Order matters: home first, or the new panel sits on a stale screen and bounces back.
 * @param {object} shellContext
 * @param {Function} [openNextPanel]
 */
function goHomeThenOpenNextPanel(shellContext, openNextPanel) {
  callIfPresent(shellContext.handleHomePress);
  callIfPresent(openNextPanel);
}

/**
 * Settings-family destinations pop one level instead of going all the way home.
 * @param {object} shellContext
 * @param {Function} [openNextPanel]
 */
function popSettingsStackThenOpen(shellContext, openNextPanel) {
  callIfPresent(shellContext.rootGoBack);
  callIfPresent(openNextPanel);
}

/**
 * Newer shells expose handleOpenConversations(); older ones only have the two setters.
 * @param {object} shellContext
 */
function openMessagesPanelInShell(shellContext) {
  callIfPresent(shellContext.handleHomePress);

  const hasConversationsHandler = typeof shellContext.handleOpenConversations === 'function';
  if (hasConversationsHandler) {
    shellContext.handleOpenConversations();
    return;
  }

  const hideTrainerMessaging = shellContext.setShowTrainerMessaging;
  if (hideTrainerMessaging) {
    hideTrainerMessaging(false);
  }
  const showConversationsList = shellContext.setShowConversationsList;
  if (showConversationsList) {
    showConversationsList(true);
  }
}

/**
 * Workout panel: prefer openWorkout, fall back to openWorkoutPlan when the first is missing
 * or returns null/undefined (prefer openWorkout, else openWorkoutPlan).
 * @param {object} shellContext
 */
function openWorkoutPanelInShell(shellContext) {
  const openWorkout = shellContext.openWorkout;
  let firstResult = undefined;
  if (openWorkout) {
    firstResult = openWorkout();
  }
  if (firstResult != null) return;

  const openWorkoutPlan = shellContext.openWorkoutPlan;
  if (openWorkoutPlan) {
    openWorkoutPlan();
  }
}

/**
 * AI / voice chat: prefer openAIChatHome, fall back to openVoiceAI.
 * @param {object} shellContext
 */
function openAiOrVoicePanelInShell(shellContext) {
  goHomeThenOpenNextPanel(shellContext, () => {
    const openAiChatHome = shellContext.openAIChatHome;
    let firstResult = undefined;
    if (openAiChatHome) {
      firstResult = openAiChatHome();
    }
    if (firstResult != null) return;

    const openVoiceAi = shellContext.openVoiceAI;
    if (openVoiceAi) {
      openVoiceAi();
    }
  });
}

/**
 * One keyword → one shell opener. Built once so the dispatcher is a table lookup, not a long if-chain.
 * Manipulate here: add a destination by putting a new SCREEN_* key here (and a constant above).
 */
function buildKeywordOpenerTable() {
  const openProfile = (shellContext) =>
    goHomeThenOpenNextPanel(shellContext, () => callIfPresent(shellContext.openProfile));
  const openSettings = (shellContext) =>
    goHomeThenOpenNextPanel(shellContext, () => callIfPresent(shellContext.openSettings));
  const openHelpFaq = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openHelpFAQ));
  const openTerms = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openTerms));
  const openPrivacy = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openPrivacy));
  const openContactSupport = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openContactSupport));
  const openBugReport = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openBugReport));
  const openPrivacyDataRights = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openPrivacyDataRights));
  const openNutrition = (shellContext) =>
    goHomeThenOpenNextPanel(shellContext, () => callIfPresent(shellContext.openNutrition));
  const openPayments = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openPayments));
  const openCoachingPayment = (shellContext) =>
    popSettingsStackThenOpen(shellContext, () => callIfPresent(shellContext.openCoachingPayment));
  const openCreateFilePopup = (shellContext) => {
    const showAddFilePopup = shellContext.setShowAddFilePopup;
    if (showAddFilePopup) {
      showAddFilePopup(true);
    }
  };
  const openHome = (shellContext) => {
    callIfPresent(shellContext.handleHomePress);
  };

  return {
    [SCREEN_HOME]: openHome,
    [SCREEN_PROFILE]: openProfile,
    [SCREEN_PROFILE_LEGACY]: openProfile,
    [SCREEN_SETTINGS]: openSettings,
    [SCREEN_SETTINGS_LEGACY]: openSettings,
    [SCREEN_HELP_FAQ]: openHelpFaq,
    [SCREEN_TERMS]: openTerms,
    [SCREEN_PRIVACY]: openPrivacy,
    [SCREEN_CONTACT_SUPPORT]: openContactSupport,
    [SCREEN_BUG_REPORT]: openBugReport,
    [SCREEN_PRIVACY_DATA_RIGHTS]: openPrivacyDataRights,
    [SCREEN_NUTRITION]: openNutrition,
    [SCREEN_WORKOUT]: openWorkoutPanelInShell,
    [SCREEN_MESSAGES]: openMessagesPanelInShell,
    [SCREEN_CREATE]: openCreateFilePopup,
    [SCREEN_VOICE]: openAiOrVoicePanelInShell,
    [SCREEN_AI_CHAT]: openAiOrVoicePanelInShell,
    [SCREEN_PAYMENTS]: openPayments,
    [SCREEN_EARNINGS_LEGACY]: openPayments,
    [SCREEN_DASHBOARD_BILLING]: openCoachingPayment,
    [SCREEN_COACHING_PAYMENT]: openCoachingPayment,
  };
}

const KEYWORD_OPENER_BY_SCREEN = buildKeywordOpenerTable();

/**
 * Look up the keyword in the table and run that opener. Unknown keywords are a quiet no-op.
 * @param {object} shellContext
 * @param {string} screenKeyword
 */
function runScreenKeywordOnShell(shellContext, screenKeyword) {
  if (!screenKeyword) return;

  const openThisScreen = KEYWORD_OPENER_BY_SCREEN[screenKeyword];
  if (!openThisScreen) return;

  openThisScreen(shellContext);
}
