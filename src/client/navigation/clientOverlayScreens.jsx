/**
 * client Overlay Screens
 *
 * Purpose: UI screen or component: client Overlay Screens. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/client
 * Key exports: ClientProfileScreen, ClientSettingsScreen, ClientHelpFAQScreen, ClientTermsScreen, ClientPrivacyScreen, ClientContactSupportScreen, ClientBugReportScreen, ClientNutritionScreen
 *
 * @file-header
 */
import React from 'react';
import { AppNavigationProvider } from '../../navigation/AppNavigationContext';
import { useClientAppShell } from './ClientAppShellContext';
import ProfileScreen from '../../profile/screens/ProfileScreen';
import SettingsScreen from '../../settings/screens/SettingsScreen';
import HelpFAQScreen from '../../settings/screens/HelpFAQScreen';
import TermsOfServiceScreen from '../../settings/screens/TermsOfServiceScreen';
import PrivacyPolicyScreen from '../../settings/screens/PrivacyPolicyScreen';
import ContactSupportScreen from '../../settings/screens/ContactSupportScreen';
import BugReportScreen from '../../settings/screens/BugReportScreen';
import NutritionContainer from '../../nutrition/daily-log/NutritionContainer';
import AddNotesFilesModal from '../../shared/components/notes-files/AddNotesFilesModal';
import TrainerSearchScreen, { TrainerProfileSheet } from '../marketplace/screens/TrainerSearchScreen';
import WeeklyReportScreen from '../screens/WeeklyReportScreen';
import PhotoGalleryScreen from '../screens/PhotoGalleryScreen';
import AIWorkoutPlansScreen from '../screens/AIWorkoutPlansScreen';
import WorkoutPlanGeneratorScreen from '../../workouts/active-workout/workout';
import AIChatHomeScreen from '../../aiChat/chat-home/AIChatHomeScreen';
import AIChatScreen from '../../aiChat/chat-thread/AIChatScreen';
import AICoachTestSuite from '../../aiChat/AICoachTestSuite';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../app/config';
import { rootNavigate } from '../../navigation/navigationRef';
import { buildNavigateFromShell } from '../../navigation/shellNavigate';

function withNav(children, shell) {
  return <AppNavigationProvider {...shell.navProviderProps}>{children}</AppNavigationProvider>;
}

export function ClientProfileScreen() {
  const s = useClientAppShell();
  const onNavigate = buildNavigateFromShell(s);
  return withNav(
    <>
      <ProfileScreen
        onBack={s.rootGoBack}
        userRole="Client"
        userData={s.userData}
        onboardingData={s.onboardingData}
        onNavigate={onNavigate}
        onProfileSaved={async () => {
          try {
            s.onRefetchUserData?.();
            if (s.user?.uid && db) {
              const snap = await getDoc(doc(db, 'users', s.user.uid));
              if (snap.exists()) s.setOnboardingData(snap.data());
            }
          } catch (e) {
            console.warn('ProfileScreen refresh after save:', e?.message);
          }
        }}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientSettingsScreen() {
  const s = useClientAppShell();
  const onNavigate = buildNavigateFromShell(s);
  return withNav(
    <>
      <SettingsScreen
        onBack={s.rootGoBack}
        onNavigate={onNavigate}
        userData={s.userData}
        trainerData={s.trainerData}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientHelpFAQScreen() {
  const s = useClientAppShell();
  return withNav(<HelpFAQScreen onBack={s.rootGoBack} />, s);
}

export function ClientTermsScreen() {
  const s = useClientAppShell();
  return withNav(<TermsOfServiceScreen onBack={s.rootGoBack} />, s);
}

export function ClientPrivacyScreen() {
  const s = useClientAppShell();
  return withNav(<PrivacyPolicyScreen onBack={s.rootGoBack} />, s);
}

export function ClientContactSupportScreen() {
  const s = useClientAppShell();
  return withNav(<ContactSupportScreen onBack={s.rootGoBack} />, s);
}

export function ClientBugReportScreen() {
  const s = useClientAppShell();
  return withNav(<BugReportScreen onBack={s.rootGoBack} />, s);
}

export function ClientNutritionScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <NutritionContainer
        onBack={() => {
          s.rootGoBack();
          s.refetchNutritionData?.();
        }}
        onNutritionDataChanged={s.refetchNutritionData}
        onProfilePress={s.openProfile}
        onSettingsPress={s.openSettings}
        onHomePress={s.handleHomePress}
        onPlusPress={() => s.setShowAddNotesFilesModal(true)}
        onVoicePress={s.openAIChatHome}
        onNutritionPress={s.openNutrition}
        onWorkoutPress={s.openWorkout}
        onMessagesPress={s.handleOpenConversations}
      />
      <AddNotesFilesModal
        visible={s.showAddNotesFilesModal}
        onClose={() => s.setShowAddNotesFilesModal(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientWorkoutPlanScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <WorkoutPlanGeneratorScreen
        onBack={s.rootGoBack}
        onProfilePress={s.openProfile}
        onSettingsPress={s.openSettings}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientTrainerSearchScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <TrainerSearchScreen
        onBack={s.rootGoBack}
        onSelectTrainer={(trainer) => {
          s.setProfileTrainer(trainer);
          s.rootGoBack();
          s.openTrainerProfile();
        }}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientTrainerProfileScreen() {
  const s = useClientAppShell();
  if (!s.profileTrainer) {
    s.rootGoBack();
    return null;
  }
  return withNav(
    <>
      <TrainerProfileSheet
        trainer={s.profileTrainer}
        onClose={s.rootGoBack}
        onRequestTrainer={() => {}}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientWeeklyReportScreen() {
  const s = useClientAppShell();
  if (!s.user?.uid) return null;
  return withNav(
    <>
      <WeeklyReportScreen
        clientId={s.user.uid}
        clientName={s.userData?.firstName || s.user?.displayName || 'You'}
        isClientSelfView
        isDark={s.isDark}
        onClose={s.rootGoBack}
        onHomePress={() => {
          s.rootGoBack();
          s.handleHomePress();
        }}
        onPlusPress={() => {
          s.rootGoBack();
          s.setShowAddNotesFilesModal(true);
        }}
        onVoicePress={() => {
          s.rootGoBack();
          s.openAIChatHome();
        }}
        onNutritionPress={() => {
          s.rootGoBack();
          s.openNutrition();
        }}
        onWorkoutPress={() => {
          s.rootGoBack();
          s.openWorkout();
        }}
        onMessagesPress={() => {
          s.rootGoBack();
          s.handleOpenConversations();
        }}
        onProfilePress={() => {
          s.rootGoBack();
          s.openProfile();
        }}
        onSettingsPress={() => {
          s.rootGoBack();
          s.openSettings();
        }}
      />
      {s.addNotesFilesModalEl}
    </>,
    s,
  );
}

export function ClientPhotoGalleryScreen() {
  const s = useClientAppShell();
  if (!s.day6Client?.id) return null;
  return withNav(
    <PhotoGalleryScreen
      route={{ params: { clientId: s.day6Client.id, clientName: s.day6Client.name, allowUpload: true } }}
      navigation={{ goBack: s.rootGoBack }}
      onRegisterAddHandler={s.registerProgressPhotoAddHandler}
    />,
    s,
  );
}

export function ClientAIWorkoutsScreen() {
  const s = useClientAppShell();
  if (!s.day6Client?.id) return null;
  return withNav(
    <AIWorkoutPlansScreen
      embedInLayout={false}
      client={s.day6Client}
      trainerId={s.userData?.trainerId}
      onBack={s.rootGoBack}
      route={{ params: { clientId: s.day6Client.id, clientName: s.day6Client.name } }}
      navigation={{ goBack: s.rootGoBack }}
    />,
    s,
  );
}

export function ClientPlanViewerScreen() {
  const s = useClientAppShell();
  if (!s.viewingPlan) return null;
  return withNav(
    <WorkoutPlanGeneratorScreen
      plan={s.viewingPlan}
      readOnly
      hideBottomNav
      onBack={s.rootGoBack}
    />,
    s,
  );
}

export function ClientAIChatHomeScreen() {
  const s = useClientAppShell();
  return withNav(
    <>
      <AIChatHomeScreen
        userId={s.user?.uid}
        onStartChat={(payload = {}) => s.openAIChatSession(payload)}
        onSessionPress={(session) =>
          s.openAIChatSession({ sessionId: session.sessionId || session.id })
        }
        onOpenTestSuite={__DEV__ ? () => rootNavigateTests(s) : undefined}
        {...s.aiChatNavHandlers}
      />
      <AddNotesFilesModal
        visible={s.showAddNotesFilesModal}
        onClose={() => s.setShowAddNotesFilesModal(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientAIChatScreen() {
  const s = useClientAppShell();
  const chatState = s.aiChatState && typeof s.aiChatState === 'object' ? s.aiChatState : {};
  return withNav(
    <>
      <AIChatScreen
        key={JSON.stringify({
          sid: chatState.sessionId ?? null,
          pf: chatState.prefill ?? null,
          att: Array.isArray(chatState.initialAttachments) ? chatState.initialAttachments.length : 0,
        })}
        userId={s.user?.uid}
        userProfile={{ ...(s.onboardingData || {}), ...(s.userData || {}) }}
        trainerId={s.userData?.trainerId}
        prefill={chatState.prefill}
        sessionId={chatState.sessionId}
        initialAttachments={chatState.initialAttachments}
        onBack={() => {
          s.setAiChatState('home');
          s.rootGoBack();
        }}
        openAttachmentsOnMount={false}
        {...s.aiChatNavHandlers}
      />
      <AddNotesFilesModal
        visible={s.showAddNotesFilesModal}
        onClose={() => s.setShowAddNotesFilesModal(false)}
        onAdded={s.refreshNotesAndFiles}
        isDark={s.isDark}
      />
    </>,
    s,
  );
}

export function ClientAICoachTestScreen() {
  const s = useClientAppShell();
  return withNav(
    <AICoachTestSuite
      userId={s.user?.uid}
      userProfile={{ ...(s.onboardingData || {}), ...(s.userData || {}) }}
      trainerName={s.userData?.trainerName || s.userData?.trainer?.name || 'Coach'}
      onBack={() => {
        s.setAiChatState('home');
        s.rootGoBack();
      }}
    />,
    s,
  );
}
