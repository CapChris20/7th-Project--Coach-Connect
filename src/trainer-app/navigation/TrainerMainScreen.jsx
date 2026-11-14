// Trainer shell: one surface that swaps dashboard, roster, inbox, AI workouts, and overlays.
// Flow: read shell flags → decide which full-screen branch → paint header / body / bottom nav / popups.
// Used once as the trainer app main surface after login.

import React from 'react';
import { StatusBar, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import TopHeader from '../../for-both/loading-and-header/TopHeader';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import ChatWithTraineeScreen from '../../messaging/ChatScreen';
import InboxScreen from '../../messaging/InboxScreen';
import NewTraineeRequestsScreen from '../new-requests/NewTraineeRequestsScreen';
import ClientsListScreen from '../my-trainees/MyTraineesScreen';
import DashboardContent from '../home/TrainerHomeContent';
import MyProgressPhotosScreen from '../../for-both/photo-gallery/MyProgressPhotosScreen';
import SavedWorkoutsScreen from '../../for-both/workout-plans/SavedWorkoutsScreen';
import CreateWorkoutPlanScreen from '../../workouts/create-plan/CreateWorkoutPlanScreen';
import AddFilePopup from '../../for-both/files-and-notes/viewers/AddFilePopup';
import PdfViewer from '../../for-both/files-and-notes/viewers/PdfViewer';
import DocumentEditor from '../documents/DocumentEditor';
import { darkColors, lightColors } from '../../look-and-feel/colorPalette';
import { useTrainerAppStartShell } from './TrainerOpenScreenTracker';
import ProAccessCheck from '../../trainer-pro-plan/ProAccessCheck';
import FreeTrialBanner from '../../trainer-pro-plan/FreeTrialBanner';
import OfflineBanner from '../../for-both/loading-and-header/OfflineBanner';
import useNetworkStatus from '../../for-both/online-connection/useNetworkStatus';

// ===== NAMED CONSTANTS =====

const STRIPE_NOT_CONNECTED = 'not_connected';
const AI_CHAT_HOME = 'home';

// ===== HELPER FUNCTIONS =====

// Trainer invite code can live on profile doc or cached userData — try both.
function trainerInviteCodeFromShell(shell) {
  var _optObj, _optObj2;
  if ((_optObj = shell.trainerProfileDoc) == null ? void 0 : _optObj.inviteCode) return shell.trainerProfileDoc.inviteCode;
  if ((_optObj2 = shell.userData) == null ? void 0 : _optObj2.inviteCode) return shell.userData.inviteCode;
  return null;
}
function pendingRequestCountFromShell(shell) {
  if (!Array.isArray(shell.pendingRequests)) return 0;
  return shell.pendingRequests.length;
}
function pendingRequestPreviewNames(shell) {
  const requests = shell.pendingRequests || [];
  const previewNames = [];
  const maxPreview = Math.min(3, requests.length);
  for (let index = 0; index < maxPreview; index += 1) {
    const request = requests[index];
    const displayName = (request == null ? void 0 : request.name) || (request == null ? void 0 : request.displayName) || (request == null ? void 0 : request.clientName);
    if (displayName) previewNames.push(displayName);
  }
  return previewNames;
}
function shellBlocksDefaultHeader(shell) {
  if (shell.showWorkoutGenerator) return true;
  if (shell.showPlanViewer) return true;
  if (shell.showTrainerMessaging) return true;
  if (shell.showConversationsList) return true;
  if (shell.showClientRequests) return true;
  if (shell.showClientsList) return true;
  if (shell.showAIWorkouts) return true;
  if (shell.showPhotoGallery) return true;
  return false;
}

// Default chrome header hides when a focused flow (chat, generator, gallery, …) is open.
function trainerShouldShowDefaultHeader(shell) {
  return !shellBlocksDefaultHeader(shell);
}

// Bottom nav hides only while workout generator, plan viewer, or live chat is full screen.
function trainerShouldShowBottomNav(shell) {
  if (shell.showWorkoutGenerator) return false;
  if (shell.showPlanViewer) return false;
  if (shell.showTrainerMessaging) return false;
  return true;
}
function messagingOrInboxIsOpen(shell) {
  if (shell.showTrainerMessaging) return true;
  if (shell.showConversationsList) return true;
  if (shell.showClientRequests) return true;
  return false;
}
function trainerShowDashboardHome(shell) {
  if (messagingOrInboxIsOpen(shell)) return false;
  if (shell.showClientsList) return false;
  if (shell.showPhotoGallery) return false;
  if (shell.showAIWorkouts) return false;
  if (shell.showWorkoutGenerator) return false;
  if (shell.showPlanViewer) return false;
  return true;
}
function decideTrainerShellVisibility(shell) {
  var _optObj3, _optObj4;
  const messagingBusy = messagingOrInboxIsOpen(shell);
  const hasGalleryClient = Boolean((_optObj3 = shell.day6Client) == null ? void 0 : _optObj3.id);
  const hasGeneratorClient = Boolean((_optObj4 = shell.generatorClient) == null ? void 0 : _optObj4.id);
  const hasViewingPlan = Boolean(shell.viewingPlan);
  const showPhotoGallery = !messagingBusy && shell.showPhotoGallery && hasGalleryClient && !shell.showWorkoutGenerator && !shell.showPlanViewer;
  const showAIWorkoutsList = !messagingBusy && shell.showAIWorkouts && hasGalleryClient && !shell.showWorkoutGenerator && !shell.showPlanViewer;
  const showWorkoutGenerator = !messagingBusy && shell.showWorkoutGenerator && hasGeneratorClient;
  const showPlanViewer = !messagingBusy && shell.showPlanViewer && hasViewingPlan;
  const showClientsRoster = !messagingBusy && shell.showClientsList;
  return {
    showDefaultHeader: trainerShouldShowDefaultHeader(shell),
    showBottomNav: trainerShouldShowBottomNav(shell),
    showDashboard: trainerShowDashboardHome(shell),
    showPhotoGallery,
    showAIWorkoutsList,
    showWorkoutGenerator,
    showPlanViewer,
    showClientsRoster
  };
}
function openTrainerInboxFromThreadClose(shell) {
  shell.setShowTrainerMessaging(false);
  shell.setShowConversationsList(true);
}
function openTrainerThreadFromInbox(shell, conversation, otherParty) {
  shell.setSelectedConversation(conversation);
  shell.setSelectedTrainer(otherParty);
  shell.setShowConversationsList(false);
  shell.setShowTrainerMessaging(true);
}
function openTrainerMessagesWithClient(shell, clientId) {
  shell.setSelectedClientIdForMessages(clientId);
  shell.setShowTrainerMessaging(false);
  shell.setShowConversationsList(true);
}
function closeAllTrainerOverlaysBeforeGallery(shell, client) {
  if (!(client == null ? void 0 : client.id)) return;
  shell.setDay6Client(client);
  shell.setShowConversationsList(false);
  shell.setShowTrainerMessaging(false);
  shell.setShowClientRequests(false);
  shell.setShowPhotoGallery(true);
  shell.setShowAIWorkouts(false);
}
function closeAllTrainerOverlaysBeforeAIWorkouts(shell, client) {
  if (!(client == null ? void 0 : client.id)) return;
  shell.setDay6Client(client);
  shell.setShowConversationsList(false);
  shell.setShowTrainerMessaging(false);
  shell.setShowClientRequests(false);
  shell.setShowPhotoGallery(false);
  shell.setShowAIWorkouts(true);
}
function openManualPlanBuilderFromAI(shell, planIdOrNull) {
  var _optObj5;
  shell.setManualPlanEditId(planIdOrNull);
  const clientId = (_optObj5 = shell.day6Client) == null ? void 0 : _optObj5.id;
  let clientIdsForBuilder = [];
  if (clientId) {
    clientIdsForBuilder = [clientId];
  }
  shell.setManualPlanBuilderClientIds(clientIdsForBuilder);
  shell.setManualBuilderReturnToAI(true);
  shell.setShowAIWorkouts(false);
  shell.openManualPlanBuilder();
}
function returnFromWorkoutGeneratorToAI(shell) {
  shell.setShowWorkoutGenerator(false);
  shell.setShowAIWorkouts(true);
}
function returnFromPlanViewerToAI(shell) {
  shell.setShowPlanViewer(false);
  shell.setShowAIWorkouts(true);
}
function shellBackgroundColor(isDark) {
  if (isDark) return darkColors.nbBackground;
  return lightColors.nbBackground;
}
function statusBarStyleForTheme(isDark) {
  if (isDark) return 'light-content';
  return 'dark-content';
}
function stripeConnectStatusFromShell(shell) {
  var _optObj6;
  return ((_optObj6 = shell.trainerProfileDoc) == null ? void 0 : _optObj6.stripeConnectStatus) || STRIPE_NOT_CONNECTED;
}
function TrainerMessagingBranch({
  shell
}) {
  if (!shell.showTrainerMessaging) return null;
  return <ChatWithTraineeScreen embedInLayout trainer={shell.selectedTrainer} conversation={shell.selectedConversation} onClose={() => openTrainerInboxFromThreadClose(shell)} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} />;
}
function TrainerInboxBranch({
  shell
}) {
  if (shell.showTrainerMessaging) return null;
  if (!shell.showConversationsList) return null;
  return <View style={{
    flex: 1
  }}>
      <InboxScreen embedInLayout onClose={() => shell.setShowConversationsList(false)} onSelectConversation={(conversation, otherParty) => openTrainerThreadFromInbox(shell, conversation, otherParty)} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} selectedClientId={shell.selectedClientIdForMessages} />
    </View>;
}
function TrainerClientRequestsBranch({
  shell
}) {
  if (shell.showTrainerMessaging) return null;
  if (!shell.showClientRequests) return null;
  return <NewTraineeRequestsScreen embedInLayout onClose={() => shell.setShowClientRequests(false)} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} onClientAdded={shell.refreshClients} onOpenPayout={() => {
    var _optCallObj, _optCallFn;
    shell.setShowClientRequests(false);
    (_optCallObj = shell, _optCallFn = _optCallObj.openPayments) == null ? void 0 : _optCallFn.call(_optCallObj);
  }} />;
}
function TrainerClientsRosterBranch({
  shell,
  inviteCode,
  pendingCount,
  previewNames
}) {
  var _optObj7;
  return <ClientsListScreen embedInLayout clients={shell.clients} trainerId={(_optObj7 = shell.user) == null ? void 0 : _optObj7.uid} inviteCode={inviteCode} pendingRequestCount={pendingCount} pendingRequestNames={previewNames} isDark={shell.isDark} hasMore={shell.clientsHasMore} loadingMore={shell.clientsLoadingMore} onLoadMore={shell.loadMoreClients} onBack={() => shell.setShowClientsList(false)} onSelectClient={clientId => {
    shell.setNavSelectedClientId(clientId);
    shell.setShowClientsList(false);
  }} onClientRemoved={shell.handleTrainerClientRemovedFromRoster} onOpenClientRequests={() => {
    shell.setShowClientsList(false);
    shell.setShowClientRequests(true);
  }} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} onHomePress={shell.handleHomePress} onPlusPress={shell.handlePlusPress} onVoicePress={() => {
    shell.handleHomePress();
    shell.openVoiceAI();
    shell.setAiChatState(AI_CHAT_HOME);
  }} onNutritionPress={() => {
    shell.handleHomePress();
    shell.openNutrition();
  }} onWorkoutPress={() => {
    shell.handleHomePress();
    shell.openWorkoutPlan();
  }} onMessagesPress={() => {
    shell.handleHomePress();
    shell.setShowConversationsList(true);
  }} />;
}
function TrainerDashboardBranch({
  shell,
  inviteCode
}) {
  var _optObj8, _optObj9, _optObj0;
  const pendingRequestsCount = ((_optObj8 = shell.pendingRequests) == null ? void 0 : _optObj8.length) ?? 0;
  const stripeConnectStatus = stripeConnectStatusFromShell(shell);
  const userEmail = ((_optObj9 = shell.user) == null ? void 0 : _optObj9.email) || '';
  return <DashboardContent isDark={shell.isDark} clients={shell.clients} clientsLoading={shell.clientsLoading} pendingRequestsCount={pendingRequestsCount} unreadMessageCount={shell.unreadMessageCount} onClientRequestsPress={() => shell.setShowClientRequests(true)} onOpenNotifications={() => {
    var _optCallObj2, _optCallFn2;
    return (_optCallObj2 = shell, _optCallFn2 = _optCallObj2.openNotifications) == null ? void 0 : _optCallFn2.call(_optCallObj2);
  }} onClientsPress={() => shell.setShowClientsList(true)} inviteCode={inviteCode} onListMe={() => {
    var _optCallObj3, _optCallFn3;
    return (_optCallObj3 = shell, _optCallFn3 = _optCallObj3.openProfile) == null ? void 0 : _optCallFn3.call(_optCallObj3);
  }} onMessagesPress={clientId => openTrainerMessagesWithClient(shell, clientId)} onOpenPhotoGallery={client => closeAllTrainerOverlaysBeforeGallery(shell, client)} onOpenAIWorkouts={client => closeAllTrainerOverlaysBeforeAIWorkouts(shell, client)} onRefreshClients={shell.refreshClients} userName={shell.userName} trainerId={(_optObj0 = shell.user) == null ? void 0 : _optObj0.uid} pdfViewer={shell.pdfViewer} setPdfViewer={shell.setPdfViewer} defaultClientId={shell.navSelectedClientId} onSelectedClientChange={shell.setSelectedClientIdFromDashboard} onOpenWeeklyReport={(clientId, clientName) => shell.openWeeklyReport(clientId, clientName)} onTrainerClientRemoved={shell.handleTrainerClientRemovedFromRoster} trainerDocsRefreshKey={shell.trainerDocsRefreshKey} stripeConnectStatus={stripeConnectStatus} onOpenPayments={shell.openPayments} appSessionId={shell.appSessionId} userEmail={userEmail} onOpenDocumentEditor={({
    documentId = null
  } = {}) => {
    shell.setDocumentEditor({
      visible: true,
      documentId: documentId || null
    });
  }} />;
}
function TrainerPhotoGalleryBranch({
  shell
}) {
  const galleryParams = {
    clientId: shell.day6Client.id,
    clientName: shell.day6Client.name,
    allowUpload: false,
    reserveShellBottomNav: true
  };
  return <MyProgressPhotosScreen route={{
    params: galleryParams
  }} navigation={{
    goBack: () => shell.setShowPhotoGallery(false)
  }} />;
}
function TrainerAIWorkoutsBranch({
  shell
}) {
  var _optObj1;
  const listKey = `aiwp-${shell.day6Client.id}-${shell.aiWorkoutsListKey}`;
  const routeParams = {
    clientId: shell.day6Client.id,
    clientName: shell.day6Client.name
  };
  return <>
      <TopHeader title="" isDark={shell.isDark} skipTopSafeInset onBack={() => shell.setShowAIWorkouts(false)} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} />
      <View style={{
      flex: 1
    }}>
        <SavedWorkoutsScreen key={listKey} embedInLayout client={shell.day6Client} trainerId={(_optObj1 = shell.user) == null ? void 0 : _optObj1.uid} onBack={() => shell.setShowAIWorkouts(false)} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} onGenerateWorkout={client => {
        shell.setGeneratorClient(client);
        shell.setShowAIWorkouts(false);
        shell.setShowWorkoutGenerator(true);
      }} onBuildCustom={() => openManualPlanBuilderFromAI(shell, null)} onEditManualPlan={planId => openManualPlanBuilderFromAI(shell, planId)} onViewPlan={plan => {
        shell.setViewingPlan(plan);
        shell.setShowAIWorkouts(false);
        shell.setShowPlanViewer(true);
      }} route={{
        params: routeParams
      }} navigation={{
        goBack: () => shell.setShowAIWorkouts(false)
      }} />
      </View>
    </>;
}
function TrainerWorkoutGeneratorBranch({
  shell
}) {
  return <CreateWorkoutPlanScreen userId={shell.generatorClient.id} coachCanGeneratePlans hideBottomNav onBack={() => returnFromWorkoutGeneratorToAI(shell)} onPlanGenerated={() => returnFromWorkoutGeneratorToAI(shell)} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} />;
}
function TrainerPlanViewerBranch({
  shell
}) {
  var _optObj10;
  return <CreateWorkoutPlanScreen userId={(_optObj10 = shell.day6Client) == null ? void 0 : _optObj10.id} plan={shell.viewingPlan} readOnly hideBottomNav onBack={() => returnFromPlanViewerToAI(shell)} onPlanGenerated={() => returnFromPlanViewerToAI(shell)} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} />;
}
function TrainerShellPopups({
  shell
}) {
  var _optObj11;
  return <>
      <AddFilePopup visible={shell.showAddFilePopup} onClose={() => {
      shell.setShowAddFilePopup(false);
      shell.setAddNotesFilesClientId(null);
    }} onAdded={() => {
      shell.setShowAddFilePopup(false);
      shell.setAddNotesFilesClientId(null);
      shell.refreshClients();
    }} isDark={shell.isDark} clientId={shell.addNotesFilesClientId} addedBy="trainer" onNewDocument={() => shell.setDocumentEditor({
      visible: true,
      documentId: null,
      title: ''
    })} />

      <PdfViewer visible={shell.pdfViewer.visible} url={shell.pdfViewer.url} name={shell.pdfViewer.name} isDark={shell.isDark} onClose={() => shell.setPdfViewer({
      visible: false,
      url: null,
      name: null
    })} />
      <DocumentEditor visible={shell.documentEditor.visible} trainerId={(_optObj11 = shell.user) == null ? void 0 : _optObj11.uid} documentId={shell.documentEditor.documentId} isDark={shell.isDark} onClose={() => shell.setDocumentEditor({
      visible: false,
      documentId: null
    })} onSaved={() => {
      shell.refreshClients();
      shell.setTrainerDocsRefreshKey(key => key + 1);
    }} trainerNavChrome={shell.getTrainerEditorNavChrome()} />
    </>;
}
function TrainerMainScreenLayout({
  shell,
  isOffline,
  offlineRetrying,
  retryOffline,
  inviteCode,
  pendingCount,
  previewNames,
  visibility
}) {
  const shellBackground = shellBackgroundColor(shell.isDark);
  const statusBarStyle = statusBarStyleForTheme(shell.isDark);
  const headerBackHandler = shell.showClientsList ? () => shell.setShowClientsList(false) : undefined;
  const rootStyle = {
    flex: 1,
    backgroundColor: shellBackground
  };
  return <ProAccessCheck onOpenSettings={shell.openSettings} onOpenTerms={shell.openTerms} onOpenPrivacy={shell.openPrivacy}>
      <View style={rootStyle}>
        <FreeTrialBanner onSubscribe={() => {
        var _optCallObj4, _optCallFn4;
        return (_optCallObj4 = shell, _optCallFn4 = _optCallObj4.openSettings) == null ? void 0 : _optCallFn4.call(_optCallObj4);
      }} />
        <SafeAreaView style={{
        flex: 1
      }} edges={SHELL_SAFE_AREA_EDGES}>
          <StatusBar barStyle={statusBarStyle} />
          <OfflineBanner visible={isOffline} retrying={offlineRetrying} onRetry={retryOffline} />

          {visibility.showDefaultHeader ? <TopHeader isDark={shell.isDark} skipTopSafeInset onBack={headerBackHandler} onProfilePress={() => shell.openProfile()} onSettingsPress={() => shell.openSettings()} /> : null}

          <TrainerMessagingBranch shell={shell} />
          <TrainerInboxBranch shell={shell} />
          <TrainerClientRequestsBranch shell={shell} />

          {visibility.showClientsRoster ? <TrainerClientsRosterBranch shell={shell} inviteCode={inviteCode} pendingCount={pendingCount} previewNames={previewNames} /> : null}

          {visibility.showDashboard ? <TrainerDashboardBranch shell={shell} inviteCode={inviteCode} /> : null}

          {visibility.showPhotoGallery ? <TrainerPhotoGalleryBranch shell={shell} /> : null}
          {visibility.showAIWorkoutsList ? <TrainerAIWorkoutsBranch shell={shell} /> : null}
          {visibility.showWorkoutGenerator ? <TrainerWorkoutGeneratorBranch shell={shell} /> : null}
          {visibility.showPlanViewer ? <TrainerPlanViewerBranch shell={shell} /> : null}

          {visibility.showBottomNav ? <ShellBottomNavAnchor>
              <BottomMenuBar onHomePress={shell.handleHomePress} onPlusPress={shell.handlePlusPress} onVoicePress={shell.openVoiceAI} onNutritionPress={() => shell.openNutrition()} onWorkoutPress={() => shell.openWorkoutPlan()} onMessagesPress={clientId => openTrainerMessagesWithClient(shell, clientId)} />
            </ShellBottomNavAnchor> : null}

          <TrainerShellPopups shell={shell} />
        </SafeAreaView>
      </View>
    </ProAccessCheck>;
}

// ===== MAIN FUNCTION =====

/**
 * Trainer main surface — decide which branch is full screen, then paint chrome + popups.
 * Flow: 1. read shell  2. invite/pending labels  3. visibility flags  4. layout
 */
export default function TrainerMainScreen() {
  // 1. Shell context + offline banner state.
  const shell = useTrainerAppStartShell();
  const {
    isOffline,
    refreshing: offlineRetrying,
    refresh: retryOffline
  } = useNetworkStatus();

  // 2. Invite code + pending-request chips for the roster / dashboard cards.
  const inviteCode = trainerInviteCodeFromShell(shell);
  const pendingCount = pendingRequestCountFromShell(shell);
  const previewNames = pendingRequestPreviewNames(shell);

  // 3. Which full-screen branch (and chrome) should show right now.
  const visibility = decideTrainerShellVisibility(shell);

  // 4. Paint Pro gate → banners → SafeArea → branch → popups.
  return <TrainerMainScreenLayout shell={shell} isOffline={isOffline} offlineRetrying={offlineRetrying} retryOffline={retryOffline} inviteCode={inviteCode} pendingCount={pendingCount} previewNames={previewNames} visibility={visibility} />;
}
