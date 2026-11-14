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
 * Close whatever panel is open by returning to home, then open the next panel.
 * Order matters: home first, or the new panel sits on a stale screen and bounces back.
 * @param {object} shellContext
 * @param {Function} [openNextPanel]
 */
function goHomeThenOpenNextPanel(shellContext, openNextPanel) {
  var _optCallObj, _optCallFn;
  (_optCallObj = shellContext, _optCallFn = _optCallObj.handleHomePress) == null ? void 0 : _optCallFn.call(_optCallObj);
  openNextPanel == null ? void 0 : openNextPanel();
}

/**
 * Settings-family destinations pop one level instead of going all the way home.
 * @param {object} shellContext
 * @param {Function} [openNextPanel]
 */
function popSettingsStackThenOpen(shellContext, openNextPanel) {
  var _optCallObj2, _optCallFn2;
  (_optCallObj2 = shellContext, _optCallFn2 = _optCallObj2.rootGoBack) == null ? void 0 : _optCallFn2.call(_optCallObj2);
  openNextPanel == null ? void 0 : openNextPanel();
}

/**
 * Newer shells expose handleOpenConversations(); older ones only have the two setters.
 * @param {object} shellContext
 */
function openMessagesPanelInShell(shellContext) {
  var _optCallObj3, _optCallFn3, _optCallObj4, _optCallFn4, _optCallObj5, _optCallFn5;
  (_optCallObj3 = shellContext, _optCallFn3 = _optCallObj3.handleHomePress) == null ? void 0 : _optCallFn3.call(_optCallObj3);
  const hasConversationsHandler = typeof shellContext.handleOpenConversations === 'function';
  if (hasConversationsHandler) {
    shellContext.handleOpenConversations();
    return;
  }
  (_optCallObj4 = shellContext, _optCallFn4 = _optCallObj4.setShowTrainerMessaging) == null ? void 0 : _optCallFn4.call(_optCallObj4, false);
  (_optCallObj5 = shellContext, _optCallFn5 = _optCallObj5.setShowConversationsList) == null ? void 0 : _optCallFn5.call(_optCallObj5, true);
}

/**
 * Workout panel: prefer openWorkout, fall back to openWorkoutPlan when the first is missing.
 * vocab/symbol: ?? = use the right side only when the left is null/undefined (missing method → undefined)
 * @param {object} shellContext
 */
function openWorkoutPanelInShell(shellContext) {
  var _optCallObj6, _optCallFn6, _optCallObj7, _optCallFn7;
  ((_optCallObj6 = shellContext, _optCallFn6 = _optCallObj6.openWorkout) == null ? void 0 : _optCallFn6.call(_optCallObj6)) ?? ((_optCallObj7 = shellContext, _optCallFn7 = _optCallObj7.openWorkoutPlan) == null ? void 0 : _optCallFn7.call(_optCallObj7));
}

/**
 * AI / voice chat: prefer openAIChatHome, fall back to openVoiceAI.
 * @param {object} shellContext
 */
function openAiOrVoicePanelInShell(shellContext) {
  goHomeThenOpenNextPanel(shellContext, () => {
    var _optCallObj8, _optCallFn8, _optCallObj9, _optCallFn9;
    ((_optCallObj8 = shellContext, _optCallFn8 = _optCallObj8.openAIChatHome) == null ? void 0 : _optCallFn8.call(_optCallObj8)) ?? ((_optCallObj9 = shellContext, _optCallFn9 = _optCallObj9.openVoiceAI) == null ? void 0 : _optCallFn9.call(_optCallObj9));
  });
}

/**
 * One keyword → one shell opener. Built once so the dispatcher is a table lookup, not a long if-chain.
 * Manipulate here: add a destination by putting a new SCREEN_* key here (and a constant above).
 */
function buildKeywordOpenerTable() {
  const openProfile = shellContext => goHomeThenOpenNextPanel(shellContext, () => {
    var _optCallObj0, _optCallFn0;
    return (_optCallObj0 = shellContext, _optCallFn0 = _optCallObj0.openProfile) == null ? void 0 : _optCallFn0.call(_optCallObj0);
  });
  const openSettings = shellContext => goHomeThenOpenNextPanel(shellContext, () => {
    var _optCallObj1, _optCallFn1;
    return (_optCallObj1 = shellContext, _optCallFn1 = _optCallObj1.openSettings) == null ? void 0 : _optCallFn1.call(_optCallObj1);
  });
  const openHelpFaq = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj10, _optCallFn10;
    return (_optCallObj10 = shellContext, _optCallFn10 = _optCallObj10.openHelpFAQ) == null ? void 0 : _optCallFn10.call(_optCallObj10);
  });
  const openTerms = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj11, _optCallFn11;
    return (_optCallObj11 = shellContext, _optCallFn11 = _optCallObj11.openTerms) == null ? void 0 : _optCallFn11.call(_optCallObj11);
  });
  const openPrivacy = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj12, _optCallFn12;
    return (_optCallObj12 = shellContext, _optCallFn12 = _optCallObj12.openPrivacy) == null ? void 0 : _optCallFn12.call(_optCallObj12);
  });
  const openContactSupport = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj13, _optCallFn13;
    return (_optCallObj13 = shellContext, _optCallFn13 = _optCallObj13.openContactSupport) == null ? void 0 : _optCallFn13.call(_optCallObj13);
  });
  const openBugReport = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj14, _optCallFn14;
    return (_optCallObj14 = shellContext, _optCallFn14 = _optCallObj14.openBugReport) == null ? void 0 : _optCallFn14.call(_optCallObj14);
  });
  const openPrivacyDataRights = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj15, _optCallFn15;
    return (_optCallObj15 = shellContext, _optCallFn15 = _optCallObj15.openPrivacyDataRights) == null ? void 0 : _optCallFn15.call(_optCallObj15);
  });
  const openNutrition = shellContext => goHomeThenOpenNextPanel(shellContext, () => {
    var _optCallObj16, _optCallFn16;
    return (_optCallObj16 = shellContext, _optCallFn16 = _optCallObj16.openNutrition) == null ? void 0 : _optCallFn16.call(_optCallObj16);
  });
  const openPayments = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj17, _optCallFn17;
    return (_optCallObj17 = shellContext, _optCallFn17 = _optCallObj17.openPayments) == null ? void 0 : _optCallFn17.call(_optCallObj17);
  });
  const openCoachingPayment = shellContext => popSettingsStackThenOpen(shellContext, () => {
    var _optCallObj18, _optCallFn18;
    return (_optCallObj18 = shellContext, _optCallFn18 = _optCallObj18.openCoachingPayment) == null ? void 0 : _optCallFn18.call(_optCallObj18);
  });
  const openCreateFilePopup = shellContext => {
    var _optCallObj19, _optCallFn19;
    (_optCallObj19 = shellContext, _optCallFn19 = _optCallObj19.setShowAddFilePopup) == null ? void 0 : _optCallFn19.call(_optCallObj19, true);
  };
  const openHome = shellContext => {
    var _optCallObj20, _optCallFn20;
    (_optCallObj20 = shellContext, _optCallFn20 = _optCallObj20.handleHomePress) == null ? void 0 : _optCallFn20.call(_optCallObj20);
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
    [SCREEN_COACHING_PAYMENT]: openCoachingPayment
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
