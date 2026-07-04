/**
 * shell Navigate
 *
 * Purpose: shell Navigate — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/navigation
 * Key exports: buildNavigateFromShell, useShellNavigate
 *
 * @file-header
 */
import { useContext, useMemo } from 'react';
import { ClientAppShellContext } from '../client-app/navigation/ClientAppShellContext';
import { TrainerAppShellContext } from '../trainer-app/navigation/TrainerAppShellContext';

/** Resolve stack/tab navigation from app shell when a screen prop is missing. */
export function buildNavigateFromShell(shell) {
  if (!shell) return null;
  if (typeof shell.onNavigate === 'function') return shell.onNavigate;

  return (screen) => {
    if (!screen) return;
    if (screen === 'home') {
      shell.handleHomePress?.();
      return;
    }
    if (screen === 'profile' || screen === 'ViewMyViewMyProfileScreen') {
      shell.handleHomePress?.();
      shell.openProfile?.();
      return;
    }
    if (screen === 'settings' || screen === 'SettingsScreen') {
      shell.handleHomePress?.();
      shell.openSettings?.();
      return;
    }
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
    if (screen === 'workout') {
      shell.openWorkout?.() ?? shell.openWorkoutPlan?.();
      return;
    }
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
    if (screen === 'create') {
      shell.setShowAddNotesFilesModal?.(true);
      return;
    }
    if (screen === 'voice' || screen === 'aiChat') {
      shell.handleHomePress?.();
      shell.openAIChatHome?.() ?? shell.openVoiceAI?.();
      return;
    }
    if (screen === 'payments' || screen === 'PaymentsScreen') {
      shell.rootGoBack?.();
      shell.openPayments?.();
      return;
    }
    if (screen === 'dashboardBilling' || screen === 'coachingPayment') {
      shell.rootGoBack?.();
      shell.openCoachingPayment?.();
      return;
    }
  };
}

export function useShellNavigate(propNavigate) {
  const clientShell = useContext(ClientAppShellContext);
  const trainerShell = useContext(TrainerAppShellContext);
  const shell = clientShell || trainerShell;

  return useMemo(() => {
    if (typeof propNavigate === 'function') return propNavigate;
    return buildNavigateFromShell(shell);
  }, [propNavigate, shell]);
}
