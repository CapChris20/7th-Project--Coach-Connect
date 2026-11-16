// Trainer shell: one surface that swaps dashboard, roster, inbox, AI workouts, and overlays.
// Flow: read shell flags → decide which full-screen branch → paint header / body / bottom nav / popups.
// Used once as the trainer app main surface after login.

import React from 'react';
import {
  StatusBar,
  View,
} from 'react-native';
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
import SpreadsheetEditor from '../documents/SpreadsheetEditor';
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
  const profileDoc = shell.trainerProfileDoc;
  if (profileDoc && profileDoc.inviteCode) {
    return profileDoc.inviteCode;
  }
  const userData = shell.userData;
  if (userData && userData.inviteCode) {
    return userData.inviteCode;
  }
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
    if (!request) continue;
    const displayName = request.name || request.displayName || request.clientName;
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
  const messagingBusy = messagingOrInboxIsOpen(shell);
  const galleryClient = shell.day6Client;
  const generatorClient = shell.generatorClient;
  const hasGalleryClient = Boolean(galleryClient && galleryClient.id);
  const hasGeneratorClient = Boolean(generatorClient && generatorClient.id);
  const hasViewingPlan = Boolean(shell.viewingPlan);

  const showPhotoGallery =
    !messagingBusy &&
    shell.showPhotoGallery &&
    hasGalleryClient &&
    !shell.showWorkoutGenerator &&
    !shell.showPlanViewer;

  const showAIWorkoutsList =
    !messagingBusy &&
    shell.showAIWorkouts &&
    hasGalleryClient &&
    !shell.showWorkoutGenerator &&
    !shell.showPlanViewer;

  const showWorkoutGenerator =
    !messagingBusy && shell.showWorkoutGenerator && hasGeneratorClient;

  const showPlanViewer =
    !messagingBusy && shell.showPlanViewer && hasViewingPlan;

  const showClientsRoster = !messagingBusy && shell.showClientsList;

  return {
    showDefaultHeader: trainerShouldShowDefaultHeader(shell),
    showBottomNav: trainerShouldShowBottomNav(shell),
    showDashboard: trainerShowDashboardHome(shell),
    showPhotoGallery,
    showAIWorkoutsList,
    showWorkoutGenerator,
    showPlanViewer,
    showClientsRoster,
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
  if (!client || !client.id) return;
  shell.setDay6Client(client);
  shell.setShowConversationsList(false);
  shell.setShowTrainerMessaging(false);
  shell.setShowClientRequests(false);
  shell.setShowPhotoGallery(true);
  shell.setShowAIWorkouts(false);
}

function closeAllTrainerOverlaysBeforeAIWorkouts(shell, client) {
  if (!client || !client.id) return;
  shell.setDay6Client(client);
  shell.setShowConversationsList(false);
  shell.setShowTrainerMessaging(false);
  shell.setShowClientRequests(false);
  shell.setShowPhotoGallery(false);
  shell.setShowAIWorkouts(true);
}

function openManualPlanBuilderFromAI(shell, planIdOrNull) {
  shell.setManualPlanEditId(planIdOrNull);
  const galleryClient = shell.day6Client;
  let clientIdsForBuilder = [];
  if (galleryClient && galleryClient.id) {
    clientIdsForBuilder = [galleryClient.id];
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
  const profileDoc = shell.trainerProfileDoc;
  if (profileDoc && profileDoc.stripeConnectStatus) {
    return profileDoc.stripeConnectStatus;
  }
  return STRIPE_NOT_CONNECTED;
}

function callIfPresent(maybeFn) {
  if (maybeFn) {
    maybeFn();
  }
}

function trainerUidFromShell(shell) {
  const user = shell.user;
  if (!user) return undefined;
  return user.uid;
}

function TrainerMessagingBranch({ shell }) {
  if (!shell.showTrainerMessaging) return null;
  return (
    <ChatWithTraineeScreen
      embedInLayout
      trainer={shell.selectedTrainer}
      conversation={shell.selectedConversation}
      onClose={() => openTrainerInboxFromThreadClose(shell)}
      onProfilePress={() => shell.openProfile()}
      onSettingsPress={() => shell.openSettings()}
    />
  );
}

function TrainerInboxBranch({ shell }) {
  if (shell.showTrainerMessaging) return null;
  if (!shell.showConversationsList) return null;
  return (
    <View style={{ flex: 1 }}>
      <InboxScreen
        embedInLayout
        onClose={() => shell.setShowConversationsList(false)}
        onSelectConversation={(conversation, otherParty) =>
          openTrainerThreadFromInbox(shell, conversation, otherParty)
        }
        onProfilePress={() => shell.openProfile()}
        onSettingsPress={() => shell.openSettings()}
        selectedClientId={shell.selectedClientIdForMessages}
      />
    </View>
  );
}

function TrainerClientRequestsBranch({ shell }) {
  if (shell.showTrainerMessaging) return null;
  if (!shell.showClientRequests) return null;

  function openPayoutFromRequests() {
    shell.setShowClientRequests(false);
    callIfPresent(shell.openPayments);
  }

  return (
    <NewTraineeRequestsScreen
      embedInLayout
      onClose={() => shell.setShowClientRequests(false)}
      onProfilePress={() => shell.openProfile()}
      onSettingsPress={() => shell.openSettings()}
      onClientAdded={shell.refreshClients}
      onOpenPayout={openPayoutFromRequests}
    />
  );
}

function TrainerClientsRosterBranch({ shell, inviteCode, pendingCount, previewNames }) {
  const trainerUid = trainerUidFromShell(shell);

  function openVoiceFromRoster() {
    shell.handleHomePress();
    shell.openVoiceAI();
    shell.setAiChatState(AI_CHAT_HOME);
  }

  function openNutritionFromRoster() {
    shell.handleHomePress();
    shell.openNutrition();
  }

  function openWorkoutFromRoster() {
    shell.handleHomePress();
    shell.openWorkoutPlan();
  }

  function openMessagesFromRoster() {
    shell.handleHomePress();
    shell.setShowConversationsList(true);
  }

  function selectClientFromRoster(clientId) {
    shell.setNavSelectedClientId(clientId);
    shell.setShowClientsList(false);
  }

  function openClientRequestsFromRoster() {
    shell.setShowClientsList(false);
    shell.setShowClientRequests(true);
  }

  return (
    <ClientsListScreen
      embedInLayout
      clients={shell.clients}
      trainerId={trainerUid}
      inviteCode={inviteCode}
      pendingRequestCount={pendingCount}
      pendingRequestNames={previewNames}
      isDark={shell.isDark}
      hasMore={shell.clientsHasMore}
      loadingMore={shell.clientsLoadingMore}
      onLoadMore={shell.loadMoreClients}
      onBack={() => shell.setShowClientsList(false)}
      onSelectClient={selectClientFromRoster}
      onClientRemoved={shell.handleTrainerClientRemovedFromRoster}
      onOpenClientRequests={openClientRequestsFromRoster}
      onProfilePress={() => shell.openProfile()}
      onSettingsPress={() => shell.openSettings()}
      onHomePress={shell.handleHomePress}
      onPlusPress={shell.handlePlusPress}
      onVoicePress={openVoiceFromRoster}
      onNutritionPress={openNutritionFromRoster}
      onWorkoutPress={openWorkoutFromRoster}
      onMessagesPress={openMessagesFromRoster}
    />
  );
}

function TrainerDashboardBranch({ shell, inviteCode }) {
  const pendingList = shell.pendingRequests;
  let pendingRequestsCount = 0;
  if (pendingList) {
    pendingRequestsCount = pendingList.length;
  }

  const stripeConnectStatus = stripeConnectStatusFromShell(shell);
  const user = shell.user;
  let userEmail = '';
  if (user && user.email) {
    userEmail = user.email;
  }
  const trainerUid = trainerUidFromShell(shell);

  function openDocumentEditorFromDashboard(args) {
    let documentId = null;
    if (args && args.documentId) {
      documentId = args.documentId;
    }
    shell.setDocumentEditor({ visible: true, documentId });
  }

  function openSpreadsheetEditorFromDashboard(args) {
    let documentId = null;
    let title = '';
    let rows = null;
    let isProgramStarter = false;
    if (args) {
      if (args.documentId) documentId = args.documentId;
      if (args.title) title = args.title;
      if (args.rows) rows = args.rows;
      if (args.isProgramStarter) isProgramStarter = args.isProgramStarter;
    }
    shell.setSpreadsheetEditor({
      visible: true,
      documentId,
      title,
      rows,
      isProgramStarter,
    });
  }

  return (
    <DashboardContent
      isDark={shell.isDark}
      clients={shell.clients}
      clientsLoading={shell.clientsLoading}
      pendingRequestsCount={pendingRequestsCount}
      unreadMessageCount={shell.unreadMessageCount}
      onClientRequestsPress={() => shell.setShowClientRequests(true)}
      onOpenNotifications={() => callIfPresent(shell.openNotifications)}
      onClientsPress={() => shell.setShowClientsList(true)}
      inviteCode={inviteCode}
      onListMe={() => callIfPresent(shell.openProfile)}
      onMessagesPress={(clientId) => openTrainerMessagesWithClient(shell, clientId)}
      onOpenPhotoGallery={(client) => closeAllTrainerOverlaysBeforeGallery(shell, client)}
      onOpenAIWorkouts={(client) => closeAllTrainerOverlaysBeforeAIWorkouts(shell, client)}
      onRefreshClients={shell.refreshClients}
      userName={shell.userName}
      trainerId={trainerUid}
      pdfViewer={shell.pdfViewer}
      setPdfViewer={shell.setPdfViewer}
      defaultClientId={shell.navSelectedClientId}
      onSelectedClientChange={shell.setSelectedClientIdFromDashboard}
      onOpenWeeklyReport={(clientId, clientName) => shell.openWeeklyReport(clientId, clientName)}
      onTrainerClientRemoved={shell.handleTrainerClientRemovedFromRoster}
      trainerDocsRefreshKey={shell.trainerDocsRefreshKey}
      stripeConnectStatus={stripeConnectStatus}
      onOpenPayments={shell.openPayments}
      appSessionId={shell.appSessionId}
      userEmail={userEmail}
      onOpenDocumentEditor={openDocumentEditorFromDashboard}
      onOpenSpreadsheetEditor={openSpreadsheetEditorFromDashboard}
    />
  );
}

function TrainerPhotoGalleryBranch({ shell }) {
  const galleryParams = {
    clientId: shell.day6Client.id,
    clientName: shell.day6Client.name,
    allowUpload: false,
    reserveShellBottomNav: true,
  };
  return (
    <MyProgressPhotosScreen
      route={{ params: galleryParams }}
      navigation={{ goBack: () => shell.setShowPhotoGallery(false) }}
    />
  );
}

function TrainerAIWorkoutsBranch({ shell }) {
  const listKey = `aiwp-${shell.day6Client.id}-${shell.aiWorkoutsListKey}`;
  const routeParams = {
    clientId: shell.day6Client.id,
    clientName: shell.day6Client.name,
  };
  const trainerUid = trainerUidFromShell(shell);

  function generateWorkoutFromList(client) {
    shell.setGeneratorClient(client);
    shell.setShowAIWorkouts(false);
    shell.setShowWorkoutGenerator(true);
  }

  function viewPlanFromList(plan) {
    shell.setViewingPlan(plan);
    shell.setShowAIWorkouts(false);
    shell.setShowPlanViewer(true);
  }

  return (
    <>
      <TopHeader
        title=""
        isDark={shell.isDark}
        skipTopSafeInset
        onBack={() => shell.setShowAIWorkouts(false)}
        onProfilePress={() => shell.openProfile()}
        onSettingsPress={() => shell.openSettings()}
      />
      <View style={{ flex: 1 }}>
        <SavedWorkoutsScreen
          key={listKey}
          embedInLayout
          client={shell.day6Client}
          trainerId={trainerUid}
          onBack={() => shell.setShowAIWorkouts(false)}
          onProfilePress={() => shell.openProfile()}
          onSettingsPress={() => shell.openSettings()}
          onGenerateWorkout={generateWorkoutFromList}
          onBuildCustom={() => openManualPlanBuilderFromAI(shell, null)}
          onEditManualPlan={(planId) => openManualPlanBuilderFromAI(shell, planId)}
          onViewPlan={viewPlanFromList}
          route={{ params: routeParams }}
          navigation={{ goBack: () => shell.setShowAIWorkouts(false) }}
        />
      </View>
    </>
  );
}

function TrainerWorkoutGeneratorBranch({ shell }) {
  return (
    <CreateWorkoutPlanScreen
      userId={shell.generatorClient.id}
      coachCanGeneratePlans
      hideBottomNav
      onBack={() => returnFromWorkoutGeneratorToAI(shell)}
      onPlanGenerated={() => returnFromWorkoutGeneratorToAI(shell)}
      onProfilePress={() => shell.openProfile()}
      onSettingsPress={() => shell.openSettings()}
    />
  );
}

function TrainerPlanViewerBranch({ shell }) {
  const galleryClient = shell.day6Client;
  let userIdForPlan = undefined;
  if (galleryClient) {
    userIdForPlan = galleryClient.id;
  }

  return (
    <CreateWorkoutPlanScreen
      userId={userIdForPlan}
      plan={shell.viewingPlan}
      readOnly
      hideBottomNav
      onBack={() => returnFromPlanViewerToAI(shell)}
      onPlanGenerated={() => returnFromPlanViewerToAI(shell)}
      onProfilePress={() => shell.openProfile()}
      onSettingsPress={() => shell.openSettings()}
    />
  );
}

function TrainerShellPopups({ shell }) {
  const trainerUid = trainerUidFromShell(shell);

  function closeAddFilePopup() {
    shell.setShowAddFilePopup(false);
    shell.setAddNotesFilesClientId(null);
  }

  function afterFileAdded() {
    shell.setShowAddFilePopup(false);
    shell.setAddNotesFilesClientId(null);
    shell.refreshClients();
  }

  function openNewDocumentFromAdd() {
    shell.setDocumentEditor({ visible: true, documentId: null, title: '' });
  }

  function openNewSpreadsheetFromAdd() {
    shell.setSpreadsheetEditor({
      visible: true,
      documentId: null,
      title: '',
      rows: null,
      isProgramStarter: false,
    });
  }

  function closeDocumentEditor() {
    shell.setDocumentEditor({ visible: false, documentId: null });
  }

  function afterDocumentSaved() {
    shell.refreshClients();
    shell.setTrainerDocsRefreshKey((key) => key + 1);
  }

  function closeSpreadsheetEditor() {
    shell.setSpreadsheetEditor({
      visible: false,
      documentId: null,
      title: '',
      rows: null,
      isProgramStarter: false,
    });
  }

  function afterSpreadsheetSaved() {
    shell.refreshClients();
    shell.setTrainerDocsRefreshKey((key) => key + 1);
  }

  return (
    <>
      <AddFilePopup
        visible={shell.showAddFilePopup}
        onClose={closeAddFilePopup}
        onAdded={afterFileAdded}
        isDark={shell.isDark}
        clientId={shell.addNotesFilesClientId}
        addedBy="trainer"
        onNewDocument={openNewDocumentFromAdd}
        onNewSpreadsheet={openNewSpreadsheetFromAdd}
      />

      <PdfViewer
        visible={shell.pdfViewer.visible}
        url={shell.pdfViewer.url}
        name={shell.pdfViewer.name}
        isDark={shell.isDark}
        onClose={() => shell.setPdfViewer({ visible: false, url: null, name: null })}
      />
      <DocumentEditor
        visible={shell.documentEditor.visible}
        trainerId={trainerUid}
        documentId={shell.documentEditor.documentId}
        isDark={shell.isDark}
        onClose={closeDocumentEditor}
        onSaved={afterDocumentSaved}
        trainerNavChrome={shell.getTrainerEditorNavChrome()}
      />
      <SpreadsheetEditor
        visible={shell.spreadsheetEditor?.visible || false}
        trainerId={trainerUid}
        documentId={shell.spreadsheetEditor?.documentId || null}
        isDark={shell.isDark}
        initialTitle={shell.spreadsheetEditor?.title || ''}
        initialRows={shell.spreadsheetEditor?.rows || null}
        isProgramStarter={shell.spreadsheetEditor?.isProgramStarter || false}
        onClose={closeSpreadsheetEditor}
        onSaved={afterSpreadsheetSaved}
      />
    </>
  );
}

function TrainerMainScreenLayout({
  shell,
  isOffline,
  offlineRetrying,
  retryOffline,
  inviteCode,
  pendingCount,
  previewNames,
  visibility,
}) {
  const shellBackground = shellBackgroundColor(shell.isDark);
  const statusBarStyle = statusBarStyleForTheme(shell.isDark);
  let headerBackHandler = undefined;
  if (shell.showClientsList) {
    headerBackHandler = () => shell.setShowClientsList(false);
  }
  const rootStyle = { flex: 1, backgroundColor: shellBackground };

  return (
    <ProAccessCheck
      onOpenSettings={shell.openSettings}
      onOpenTerms={shell.openTerms}
      onOpenPrivacy={shell.openPrivacy}
    >
      <View style={rootStyle}>
        <FreeTrialBanner onSubscribe={() => callIfPresent(shell.openSettings)} />
        <SafeAreaView style={{ flex: 1 }} edges={SHELL_SAFE_AREA_EDGES}>
          <StatusBar barStyle={statusBarStyle} />
          <OfflineBanner visible={isOffline} retrying={offlineRetrying} onRetry={retryOffline} />

          {visibility.showDefaultHeader ? (
            <TopHeader
              isDark={shell.isDark}
              skipTopSafeInset
              onBack={headerBackHandler}
              onProfilePress={() => shell.openProfile()}
              onSettingsPress={() => shell.openSettings()}
            />
          ) : null}

          <TrainerMessagingBranch shell={shell} />
          <TrainerInboxBranch shell={shell} />
          <TrainerClientRequestsBranch shell={shell} />

          {visibility.showClientsRoster ? (
            <TrainerClientsRosterBranch
              shell={shell}
              inviteCode={inviteCode}
              pendingCount={pendingCount}
              previewNames={previewNames}
            />
          ) : null}

          {visibility.showDashboard ? (
            <TrainerDashboardBranch shell={shell} inviteCode={inviteCode} />
          ) : null}

          {visibility.showPhotoGallery ? <TrainerPhotoGalleryBranch shell={shell} /> : null}
          {visibility.showAIWorkoutsList ? <TrainerAIWorkoutsBranch shell={shell} /> : null}
          {visibility.showWorkoutGenerator ? <TrainerWorkoutGeneratorBranch shell={shell} /> : null}
          {visibility.showPlanViewer ? <TrainerPlanViewerBranch shell={shell} /> : null}

          {visibility.showBottomNav ? (
            <ShellBottomNavAnchor>
              <BottomMenuBar
                onHomePress={shell.handleHomePress}
                onPlusPress={shell.handlePlusPress}
                onVoicePress={shell.openVoiceAI}
                onNutritionPress={() => shell.openNutrition()}
                onWorkoutPress={() => shell.openWorkoutPlan()}
                onMessagesPress={(clientId) => openTrainerMessagesWithClient(shell, clientId)}
              />
            </ShellBottomNavAnchor>
          ) : null}

          <TrainerShellPopups shell={shell} />
        </SafeAreaView>
      </View>
    </ProAccessCheck>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Trainer main surface — decide which branch is full screen, then paint chrome + popups.
 * Flow: 1. read shell  2. invite/pending labels  3. visibility flags  4. layout
 */
export default function TrainerMainScreen() {
  // 1. Shell context + offline banner state.
  const shell = useTrainerAppStartShell();
  const { isOffline, refreshing: offlineRetrying, refresh: retryOffline } = useNetworkStatus();

  // 2. Invite code + pending-request chips for the roster / dashboard cards.
  const inviteCode = trainerInviteCodeFromShell(shell);
  const pendingCount = pendingRequestCountFromShell(shell);
  const previewNames = pendingRequestPreviewNames(shell);

  // 3. Which full-screen branch (and chrome) should show right now.
  const visibility = decideTrainerShellVisibility(shell);

  // 4. Paint Pro gate → banners → SafeArea → branch → popups.
  return (
    <TrainerMainScreenLayout
      shell={shell}
      isOffline={isOffline}
      offlineRetrying={offlineRetrying}
      retryOffline={retryOffline}
      inviteCode={inviteCode}
      pendingCount={pendingCount}
      previewNames={previewNames}
      visibility={visibility}
    />
  );
}
