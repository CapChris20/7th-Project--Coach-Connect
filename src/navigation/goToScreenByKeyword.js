// Lets a screen say navigate('settings') without knowing whether it lives in the client or trainer shell.
// Flow: read whichever shell context is mounted → turn a plain screen keyword into the shell's own open*/handle* call.
// Used by: shared screens reused in both shells that cannot rely on a navigation prop being passed in.

import { useContext, useMemo } from 'react';
import { ClientOpenScreenTracker } from '../client-app/navigation/ClientOpenScreenTracker';
import { TrainerOpenScreenTracker } from '../trainer-app/navigation/TrainerOpenScreenTracker';

// ===== NAMED CONSTANTS =====

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

/**
 * Close the open panel, then open the next one. Order matters — home first, or the new panel
 * would sit on a stale screen and then bounce back.
 * @param {object} shell
 * @param {Function} [openScreen]
 */
function goHomeThenOpen(shell, openScreen) {
  shell.handleHomePress?.();
  openScreen?.();
}

/**
 * Settings-family destinations pop the settings stack instead of going all the way home.
 * @param {object} shell
 * @param {Function} [openScreen]
 */
function popSettingsThenOpen(shell, openScreen) {
  shell.rootGoBack?.();
  openScreen?.();
}

/**
 * Newer shells expose handleOpenConversations(); older ones only have the two setters.
 * @param {object} shell
 */
function openMessagesInShell(shell) {
  shell.handleHomePress?.();
  if (typeof shell.handleOpenConversations === 'function') {
    shell.handleOpenConversations();
  } else {
    shell.setShowTrainerMessaging?.(false);
    shell.setShowConversationsList?.(true);
  }
}

/**
 * Dispatch one keyword to the matching shell method. Unknown keywords are a quiet no-op.
 * vocab/symbol: shell.openProfile?.() = call it only if that shell defines it.
 * Manipulate here: adding a destination = add an `if (screenKeyword === ...)` block.
 * @param {object} shell
 * @param {string} screenKeyword
 */
function dispatchScreenKeyword(shell, screenKeyword) {
  if (!screenKeyword) return;

  if (screenKeyword === SCREEN_HOME) {
    shell.handleHomePress?.();
    return;
  }

  if (screenKeyword === SCREEN_PROFILE || screenKeyword === SCREEN_PROFILE_LEGACY) {
    goHomeThenOpen(shell, () => shell.openProfile?.());
    return;
  }
  if (screenKeyword === SCREEN_SETTINGS || screenKeyword === SCREEN_SETTINGS_LEGACY) {
    goHomeThenOpen(shell, () => shell.openSettings?.());
    return;
  }

  if (screenKeyword === SCREEN_HELP_FAQ) {
    popSettingsThenOpen(shell, () => shell.openHelpFAQ?.());
    return;
  }
  if (screenKeyword === SCREEN_TERMS) {
    popSettingsThenOpen(shell, () => shell.openTerms?.());
    return;
  }
  if (screenKeyword === SCREEN_PRIVACY) {
    popSettingsThenOpen(shell, () => shell.openPrivacy?.());
    return;
  }
  if (screenKeyword === SCREEN_CONTACT_SUPPORT) {
    popSettingsThenOpen(shell, () => shell.openContactSupport?.());
    return;
  }
  if (screenKeyword === SCREEN_BUG_REPORT) {
    popSettingsThenOpen(shell, () => shell.openBugReport?.());
    return;
  }

  if (screenKeyword === SCREEN_NUTRITION) {
    goHomeThenOpen(shell, () => shell.openNutrition?.());
    return;
  }

  // Workout has two possible shell method names. ?? uses the result of the first call:
  // missing method → undefined → run the fallback.
  if (screenKeyword === SCREEN_WORKOUT) {
    shell.openWorkout?.() ?? shell.openWorkoutPlan?.();
    return;
  }

  if (screenKeyword === SCREEN_MESSAGES) {
    openMessagesInShell(shell);
    return;
  }

  if (screenKeyword === SCREEN_CREATE) {
    shell.setShowAddFilePopup?.(true);
    return;
  }

  if (screenKeyword === SCREEN_VOICE || screenKeyword === SCREEN_AI_CHAT) {
    goHomeThenOpen(shell, () => {
      shell.openAIChatHome?.() ?? shell.openVoiceAI?.();
    });
    return;
  }

  if (screenKeyword === SCREEN_PAYMENTS || screenKeyword === SCREEN_EARNINGS_LEGACY) {
    popSettingsThenOpen(shell, () => shell.openPayments?.());
    return;
  }
  if (screenKeyword === SCREEN_DASHBOARD_BILLING || screenKeyword === SCREEN_COACHING_PAYMENT) {
    popSettingsThenOpen(shell, () => shell.openCoachingPayment?.());
    return;
  }
}

// ===== MAIN FUNCTION =====

/**
 * Builds the navigate(screen) function for one shell.
 * vocab: "shell" = ClientAppStart / TrainerAppStart, which often toggles booleans instead of pushing routes.
 * @param {object|null} shell
 * @returns {Function|null}
 */
export function buildNavigateFromShell(shell) {
  if (!shell) return null;
  if (typeof shell.onNavigate === 'function') return shell.onNavigate;
  return (screenKeyword) => dispatchScreenKeyword(shell, screenKeyword);
}

/**
 * Hook version for components: the best available navigate function.
 * An explicitly passed navigate prop always wins so a parent can override routing for one screen.
 * vocab: useMemo = cache this value; a new function identity every render would retrigger child effects.
 * @param {Function} [propNavigate]
 * @returns {Function|null}
 */
export function useShellNavigate(propNavigate) {
  const clientShell = useContext(ClientOpenScreenTracker);
  const trainerShell = useContext(TrainerOpenScreenTracker);
  const shell = clientShell || trainerShell;

  return useMemo(() => {
    if (typeof propNavigate === 'function') return propNavigate;
    return buildNavigateFromShell(shell);
  }, [propNavigate, shell]);
}
