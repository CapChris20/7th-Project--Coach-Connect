// Trainer shell: pick which trainer screen to show from the shared tracker.
// Flow: read the open-screen tracker → paint that tab under the header and bottom bar.
// Used once as the trainer app’s main surface after login.

import React from 'react';
import {
  Alert,
  StatusBar,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, ShellBottomNavAnchor } from '../../navigation/bottomMenuSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as XLSX from 'xlsx';
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
import SpreadsheetEditor from '../documents/SpreadsheetEditor';
import DocumentEditor from '../documents/DocumentEditor';
import { GRADIENT_BG_DARK, GRADIENT_BG_LIGHT } from '../home/trainerHomePieces';
import { useTrainerAppStartShell } from './TrainerOpenScreenTracker';
import ProAccessCheck from '../../trainer-pro-plan/ProAccessCheck';
import FreeTrialBanner from '../../trainer-pro-plan/FreeTrialBanner';

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

// ===== MAIN FUNCTION =====

/**
 * Trainer app shell. Screen choice lives on the open-screen tracker.
 */
export default function TrainerMainScreen() {
  const shell = useTrainerAppStartShell();
  return (
    <ProAccessCheck
      onOpenSettings={shell.openSettings}
      onOpenTerms={shell.openTerms}
      onOpenPrivacy={shell.openPrivacy}
    >
      <LinearGradient colors={shell.isDark ? GRADIENT_BG_DARK : GRADIENT_BG_LIGHT} style={{ flex: 1 }}>
        <FreeTrialBanner />
      <SafeAreaView style={{ flex: 1 }} edges={SHELL_SAFE_AREA_EDGES}>
        <StatusBar barStyle={shell.isDark ? 'light-content' : 'dark-content'} />
        {!shell.showWorkoutGenerator &&
          !shell.showPlanViewer &&
          !shell.showTrainerMessaging &&
          !shell.showConversationsList &&
          !shell.showClientRequests &&
          !shell.showClientsList &&
          !shell.showAIWorkouts &&
          !shell.showPhotoGallery && (
          <TopHeader
            isDark={shell.isDark}
            skipTopSafeInset
            onBack={shell.showClientsList ? () => shell.setShowClientsList(false) : undefined}
            onProfilePress={() => shell.openProfile()}
            onSettingsPress={() => shell.openSettings()}
          />
        )}

        {shell.showTrainerMessaging && (
          <ChatWithTraineeScreen
            embedInLayout
            trainer={shell.selectedTrainer}
            conversation={shell.selectedConversation}
            onClose={() => {
              shell.setShowTrainerMessaging(false);
              shell.setShowConversationsList(true);
            }}
            onProfilePress={() => shell.openProfile()}
            onSettingsPress={() => shell.openSettings()}
          />
        )}
        {!shell.showTrainerMessaging && shell.showConversationsList && (
          <View style={{ flex: 1 }}>
            <InboxScreen
              embedInLayout
              onClose={() => shell.setShowConversationsList(false)}
              onSelectConversation={(c, o) => { shell.setSelectedConversation(c); shell.setSelectedTrainer(o); shell.setShowConversationsList(false); shell.setShowTrainerMessaging(true); }}
              onProfilePress={() => shell.openProfile()}
              onSettingsPress={() => shell.openSettings()}
              selectedClientId={shell.selectedClientIdForMessages}
            />
          </View>
        )}
        {!shell.showTrainerMessaging && shell.showClientRequests && (
          <NewTraineeRequestsScreen
            embedInLayout
            onClose={() => shell.setShowClientRequests(false)}
            onProfilePress={() => shell.openProfile()}
            onSettingsPress={() => shell.openSettings()}
            onClientAdded={shell.refreshClients}
          />
        )}
        {!shell.showTrainerMessaging && !shell.showConversationsList && !shell.showClientRequests && shell.showClientsList && (
          <ClientsListScreen
            embedInLayout
            clients={shell.clients}
            trainerId={shell.user?.uid}
            isDark={shell.isDark}
            hasMore={shell.clientsHasMore}
            loadingMore={shell.clientsLoadingMore}
            onLoadMore={shell.loadMoreClients}
            onBack={() => shell.setShowClientsList(false)}
            onSelectClient={(id) => {
              shell.setNavSelectedClientId(id);
              shell.setShowClientsList(false);
            }}
            onClientRemoved={shell.handleTrainerClientRemovedFromRoster}
            onOpenClientRequests={() => {
              shell.setShowClientsList(false);
              shell.setShowClientRequests(true);
            }}
            onProfilePress={() => shell.openProfile()}
            onSettingsPress={() => shell.openSettings()}
            onHomePress={shell.handleHomePress}
            onPlusPress={shell.handlePlusPress}
            onVoicePress={() => {
              shell.handleHomePress();
              shell.openVoiceAI();
              shell.setAiChatState('home');
            }}
            onNutritionPress={() => {
              shell.handleHomePress();
              shell.openNutrition();
            }}
            onWorkoutPress={() => {
              shell.handleHomePress();
              shell.openWorkoutPlan();
            }}
            onMessagesPress={() => {
              shell.handleHomePress();
              shell.setShowConversationsList(true);
            }}
          />
        )}
        {!shell.showTrainerMessaging && !shell.showConversationsList && !shell.showClientRequests && !shell.showClientsList && !shell.showPhotoGallery && !shell.showAIWorkouts && !shell.showWorkoutGenerator && !shell.showPlanViewer && (
          <DashboardContent
            isDark={shell.isDark} clients={shell.clients} clientsLoading={shell.clientsLoading}
            pendingRequestsCount={shell.pendingRequests?.length ?? 0} unreadMessageCount={shell.unreadMessageCount}
            onClientRequestsPress={() => shell.setShowClientRequests(true)}
            onClientsPress={() => shell.setShowClientsList(true)}
            onMessagesPress={(clientId) => { shell.setSelectedClientIdForMessages(clientId); shell.setShowTrainerMessaging(false); shell.setShowConversationsList(true); }}
            onOpenPhotoGallery={(client) => {
              if (!client?.id) return;
              shell.setDay6Client(client);
              shell.setShowConversationsList(false);
              shell.setShowTrainerMessaging(false);
              shell.setShowClientRequests(false);
              shell.setShowPhotoGallery(true);
              shell.setShowAIWorkouts(false);
            }}
            onOpenAIWorkouts={(client) => {
              if (!client?.id) return;
              shell.setDay6Client(client);
              shell.setShowConversationsList(false);
              shell.setShowTrainerMessaging(false);
              shell.setShowClientRequests(false);
              shell.setShowPhotoGallery(false);
              shell.setShowAIWorkouts(true);
            }}
            onRefreshClients={shell.refreshClients} userName={shell.userName}
            trainerId={shell.user?.uid} pdfViewer={shell.pdfViewer} setPdfViewer={shell.setPdfViewer}
            defaultClientId={shell.navSelectedClientId}
            onSelectedClientChange={shell.setSelectedClientIdFromDashboard}
            onOpenWeeklyReport={(clientId, clientName) =>
              shell.openWeeklyReport(clientId, clientName)
            }
            onTrainerClientRemoved={shell.handleTrainerClientRemovedFromRoster} trainerDocsRefreshKey={shell.trainerDocsRefreshKey}
            stripeConnectStatus={shell.trainerProfileDoc?.stripeConnectStatus || 'not_connected'}
            onOpenPayments={shell.openPayments}
            appSessionId={shell.appSessionId}
            userEmail={shell.user?.email || ''}
            onOpenDocumentEditor={({ documentId = null } = {}) => {
              shell.setDocumentEditor({ visible: true, documentId: documentId || null });
            }}
            onOpenSpreadsheetEditor={({ documentId = null, title = '', rows = null } = {}) => {
              shell.setSpreadsheetEditor({
                visible: true,
                documentId: documentId || null,
                title: title || '',
                rows: rows ?? null,
              });
            }}
          />
        )}

        {!shell.showTrainerMessaging && !shell.showConversationsList && !shell.showClientRequests && shell.showPhotoGallery && shell.day6Client?.id && !shell.showWorkoutGenerator && !shell.showPlanViewer && (
          <MyProgressPhotosScreen
            route={{
              params: {
                clientId: shell.day6Client.id,
                clientName: shell.day6Client.name,
                allowUpload: false,
                reserveShellBottomNav: true,
              },
            }}
            navigation={{ goBack: () => shell.setShowPhotoGallery(false) }}
          />
        )}

        {!shell.showTrainerMessaging && !shell.showConversationsList && !shell.showClientRequests && shell.showAIWorkouts && shell.day6Client?.id && !shell.showWorkoutGenerator && !shell.showPlanViewer && (
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
            key={`aiwp-${shell.day6Client.id}-${shell.aiWorkoutsListKey}`}
            embedInLayout
            client={shell.day6Client}
            trainerId={shell.user?.uid}
            onBack={() => shell.setShowAIWorkouts(false)}
            onProfilePress={() => shell.openProfile()}
            onSettingsPress={() => shell.openSettings()}
            onGenerateWorkout={(client) => {
              shell.setGeneratorClient(client);
              shell.setShowAIWorkouts(false);
              shell.setShowWorkoutGenerator(true);
            }}
            onBuildCustom={() => {
              shell.setManualPlanEditId(null);
              shell.setManualPlanBuilderClientIds(shell.day6Client?.id ? [shell.day6Client.id] : []);
              shell.setManualBuilderReturnToAI(true);
              shell.setShowAIWorkouts(false);
              shell.openManualPlanBuilder();
            }}
            onEditManualPlan={(planId) => {
              shell.setManualPlanEditId(planId);
              shell.setManualPlanBuilderClientIds(shell.day6Client?.id ? [shell.day6Client.id] : []);
              shell.setManualBuilderReturnToAI(true);
              shell.setShowAIWorkouts(false);
              shell.openManualPlanBuilder();
            }}
            onViewPlan={(plan) => {
              shell.setViewingPlan(plan);
              shell.setShowAIWorkouts(false);
              shell.setShowPlanViewer(true);
            }}
            route={{ params: { clientId: shell.day6Client.id, clientName: shell.day6Client.name } }}
            navigation={{ goBack: () => shell.setShowAIWorkouts(false) }}
          />
            </View>
          </>
        )}

        {!shell.showTrainerMessaging && !shell.showConversationsList && !shell.showClientRequests && shell.showWorkoutGenerator && shell.generatorClient?.id && (
          <CreateWorkoutPlanScreen
            userId={shell.generatorClient.id}
            coachCanGeneratePlans
            hideBottomNav={true}
            onBack={() => {
              shell.setShowWorkoutGenerator(false);
              shell.setShowAIWorkouts(true);
            }}
            onPlanGenerated={() => {
              shell.setShowWorkoutGenerator(false);
              shell.setShowAIWorkouts(true);
            }}
            onProfilePress={() => shell.openProfile()}
            onSettingsPress={() => shell.openSettings()}
          />
        )}

        {!shell.showTrainerMessaging && !shell.showConversationsList && !shell.showClientRequests && shell.showPlanViewer && shell.viewingPlan && (
          <CreateWorkoutPlanScreen
            userId={shell.day6Client?.id}
            plan={shell.viewingPlan}
            readOnly={true}
            hideBottomNav={true}
            onBack={() => {
              shell.setShowPlanViewer(false);
              shell.setShowAIWorkouts(true);
            }}
            onPlanGenerated={() => {
              shell.setShowPlanViewer(false);
              shell.setShowAIWorkouts(true);
            }}
            onProfilePress={() => shell.openProfile()}
            onSettingsPress={() => shell.openSettings()}
          />
        )}

        {!shell.showWorkoutGenerator &&
          !shell.showPlanViewer &&
          !shell.showTrainerMessaging && (
          <ShellBottomNavAnchor>
            <BottomMenuBar
              onHomePress={shell.handleHomePress}
              onPlusPress={shell.handlePlusPress}
              onVoicePress={shell.openVoiceAI}
              onNutritionPress={() => { shell.openNutrition(); }}
              onWorkoutPress={() => { shell.openWorkoutPlan(); }}
              onMessagesPress={(clientId) => { shell.setSelectedClientIdForMessages(clientId); shell.setShowTrainerMessaging(false); shell.setShowConversationsList(true); }}
            />
          </ShellBottomNavAnchor>
        )}

        <AddFilePopup
          visible={shell.showAddFilePopup}
          onClose={() => { shell.setShowAddFilePopup(false); shell.setAddNotesFilesClientId(null); }}
          onAdded={() => { shell.setShowAddFilePopup(false); shell.setAddNotesFilesClientId(null); shell.refreshClients(); }}
          isDark={shell.isDark}
          clientId={shell.addNotesFilesClientId}
          addedBy="trainer"
          onNewDocument={() => shell.setDocumentEditor({ visible: true, documentId: null, title: '' })}
          onNewSpreadsheet={() => shell.setSpreadsheetEditor({ visible: true, documentId: null, title: '', rows: null })}
          onImportSpreadsheet={async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: [
                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                  'text/csv',
                ],
                copyToCacheDirectory: true,
              });
              if (result.canceled) return;
              const file = result.assets[0];
              const base64 = await FileSystem.readAsStringAsync(file.uri, {
                encoding: FileSystem.EncodingType.Base64,
              });
              const wb = XLSX.read(base64, { type: 'base64' });
              const firstSheetName = wb.SheetNames[0];
              const ws = firstSheetName ? wb.Sheets[firstSheetName] : null;
              const data = ws ? XLSX.utilshell.sheet_to_json(ws, { header: 1 }) : [];
              const rows = (data || []).map((row) =>
                (row || []).map((val) => (val != null ? String(val) : '')),
              );
              shell.setSpreadsheetEditor({
                visible: true,
                documentId: null,
                title: file.name || 'Imported Spreadsheet',
                rows,
              });
            } catch (e) {
              Alert.alert('Import failed', e?.message || 'Could not import spreadsheet.');
            }
          }}
        />
        
        <PdfViewer
          visible={shell.pdfViewer.visible}
          url={shell.pdfViewer.url}
          name={shell.pdfViewer.name}
          isDark={shell.isDark}
          onClose={() => shell.setPdfViewer({ visible: false, url: null, name: null })}
        />
        <SpreadsheetEditor
          visible={shell.spreadsheetEditor.visible}
          trainerId={shell.user?.uid}
          documentId={shell.spreadsheetEditor.documentId}
          isDark={shell.isDark}
          initialTitle={shell.spreadsheetEditor.title}
          initialRows={shell.spreadsheetEditor.rows}
          onClose={() => shell.setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null })}
          onSaved={() => {
            shell.refreshClients();
            shell.setTrainerDocsRefreshKey((k) => k + 1);
          }}
          trainerNavChrome={shell.getTrainerEditorNavChrome()}
        />
        <DocumentEditor
          visible={shell.documentEditor.visible}
          trainerId={shell.user?.uid}
          documentId={shell.documentEditor.documentId}
          isDark={shell.isDark}
          onClose={() => shell.setDocumentEditor({ visible: false, documentId: null })}
          onSaved={() => {
            shell.refreshClients();
            shell.setTrainerDocsRefreshKey((k) => k + 1);
          }}
          trainerNavChrome={shell.getTrainerEditorNavChrome()}
        />
      </SafeAreaView>
    </LinearGradient>
    </ProAccessCheck>
  );
}
