// Lets a screen say navigate('settings') without knowing whether it lives in the client or trainer shell.
// Flow: read whichever shell context is mounted → turn a plain screen keyword into the shell's own open*/handle* call.
// Used by shared screens/components that are reused in both shells and can't rely on a navigation prop being passed in.
// Key exports: buildNavigateFromShell, useShellNavigate

import { useContext, useMemo } from 'react';
import { ClientOpenScreenTracker } from '../client-app/navigation/ClientOpenScreenTracker';
import { TrainerOpenScreenTracker } from '../trainer-app/navigation/TrainerOpenScreenTracker';

// Builds the navigate(screen) function for one shell.
// vocab: "shell" = the app-level container (ClientAppStart / TrainerAppStart) that owns which panel is showing.
// These shells don't push React Navigation screens for everything — a lot of "screens" are really
// booleans/state inside the shell, which is why this maps keywords to shell methods instead of route names.
export function buildNavigateFromShell(shell) {
  // No shell mounted (component rendered standalone, e.g. a preview) → return null so callers can
  // fall back to their own prop rather than calling a function that half-works.
  if (!shell) return null;

  // Escape hatch: if a shell supplies its own router, trust it completely and skip the keyword map.
  if (typeof shell.onNavigate === 'function') return shell.onNavigate;

  // Otherwise hand back a keyword dispatcher. Every branch is one destination.
  // vocab/symbol: shell.openProfile?.() = optional call — invoke it only if that shell defines it.
  // That's the whole trick here: the client shell and trainer shell implement overlapping but not
  // identical sets of destinations, and `?.()` makes an unsupported destination a quiet no-op.
  // Manipulate here: adding a new destination = add an `if (screen === '...')` block below.
  return (screen) => {
    if (!screen) return;

    if (screen === 'home') {
      shell.handleHomePress?.();
      return;
    }

    // Several destinations call handleHomePress() FIRST on purpose: it closes whatever panel is
    // currently open so the new one isn't stacked on top of a stale screen. Order matters —
    // swapping these two lines would open the panel and then immediately bounce back to home.
    // The second keyword in each check is the legacy component name some older callers still pass.
    if (screen === 'profile' || screen === 'ViewMyMyProfileScreen') {
      shell.handleHomePress?.();
      shell.openProfile?.();
      return;
    }
    if (screen === 'settings' || screen === 'SettingsScreen') {
      shell.handleHomePress?.();
      shell.openSettings?.();
      return;
    }

    // The settings-family destinations below use rootGoBack() instead of handleHomePress(): they're
    // reached FROM the settings screen, so we pop that pushed screen off the stack first and then
    // open the next one — going all the way home would dump the user out of the settings area.
    if (screen === 'helpFaq') {
      shell.rootGoBack?.();
      shell.openHelpFAQ?.();
      return;
    }
    if (screen === 'terms') {
      shell.rootGoBack?.();
      shell.openTerms?.();
      return;
    }
    if (screen === 'privacy') {
      shell.rootGoBack?.();
      shell.openPrivacy?.();
      return;
    }
    if (screen === 'contactSupport') {
      shell.rootGoBack?.();
      shell.openContactSupport?.();
      return;
    }
    if (screen === 'bugReport') {
      shell.rootGoBack?.();
      shell.openBugReport?.();
      return;
    }

    if (screen === 'nutrition') {
      shell.handleHomePress?.();
      shell.openNutrition?.();
      return;
    }

    // Workout has two possible shell method names depending on the shell, so try the generic one and
    // fall back. Note: ?? here compares the RESULT of openWorkout?.() — if that method is missing the
    // call yields undefined and the right side runs, which is the intended "whichever exists" behavior.
    if (screen === 'workout') {
      shell.openWorkout?.() ?? shell.openWorkoutPlan?.();
      return;
    }

    // Messaging is the one destination with real branching: newer shells expose a single
    // handleOpenConversations() that knows the right state; older ones only have the two setters,
    // so we drive them manually — close the active thread, then show the conversation list.
    if (screen === 'messages') {
      shell.handleHomePress?.();
      if (typeof shell.handleOpenConversations === 'function') {
        shell.handleOpenConversations();
      } else {
        shell.setShowTrainerMessaging?.(false);
        shell.setShowConversationsList?.(true);
      }
      return;
    }

    // 'create' is the "+" button: a modal, not a screen, so it flips the modal flag directly.
    if (screen === 'create') {
      shell.setShowAddFilePopup?.(true);
      return;
    }

    // Voice and AI chat land in the same place; prefer the chat home, fall back to the voice screen.
    if (screen === 'voice' || screen === 'aiChat') {
      shell.handleHomePress?.();
      shell.openAIChatHome?.() ?? shell.openVoiceAI?.();
      return;
    }

    // Billing destinations: `payments` is the trainer's payouts area, `coachingPayment` is the
    // client-side checkout — different screens, same "pop settings first" pattern as above.
    if (screen === 'payments' || screen === 'EarningsScreen') {
      shell.rootGoBack?.();
      shell.openPayments?.();
      return;
    }
    if (screen === 'dashboardBilling' || screen === 'coachingPayment') {
      shell.rootGoBack?.();
      shell.openCoachingPayment?.();
      return;
    }

    // Unknown keyword: falls through and does nothing on purpose — a typo'd destination should not crash a screen.
  };
}

// Hook version for components: gives back the best available navigate function.
export function useShellNavigate(propNavigate) {
  // Read both shells; exactly one of them is mounted at a time, so the other is null.
  const clientShell = useContext(ClientOpenScreenTracker);
  const trainerShell = useContext(TrainerOpenScreenTracker);
  const shell = clientShell || trainerShell;

  // vocab: useMemo = cache this value and only recompute when a dependency changes.
  // Without it, buildNavigateFromShell would return a brand-new function identity every render,
  // which re-triggers any child effect or memo that depends on `navigate`.
  return useMemo(() => {
    // An explicitly passed navigate prop always wins, so a parent can override routing for one screen.
    if (typeof propNavigate === 'function') return propNavigate;
    return buildNavigateFromShell(shell);
  }, [propNavigate, shell]);
}
