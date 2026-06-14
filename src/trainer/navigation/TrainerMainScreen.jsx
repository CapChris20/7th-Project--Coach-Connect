import React from 'react';
import {
  Alert,
  SafeAreaView,
  StatusBar,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import TrainerMessagingScreen from '../screens/TrainerMessagingScreen';
import ConversationsListScreen from '../screens/ConversationsListScreen';
import ClientRequestsScreen from '../screens/ClientRequestsScreen';
import ClientsListScreen from '../screens/TrainerClientsListScreen';
import DashboardContent from '../screens/TrainerDashboardContent';
import PhotoGalleryScreen from '../screens/PhotoGalleryScreen';
import AIWorkoutPlansScreen from '../screens/AIWorkoutPlansScreen';
import WorkoutPlanGeneratorScreen from '../../workouts/screens/workout';
import AddNotesFilesModal from '../../shared/components/AddNotesFilesModal';
import PdfViewerModal from '../../shared/components/PdfViewerModal';
import SpreadsheetEditorModal from '../components/documents/SpreadsheetEditorModal';
import DocumentEditorModal from '../components/documents/DocumentEditorModal';
import { GRADIENT_BG_DARK, GRADIENT_BG_LIGHT } from '../components/dashboard/trainerDashboardUi';
import { useTrainerAppShell } from './TrainerAppShellContext';

export default function TrainerMainScreen() {
  const s = useTrainerAppShell();
  const headerTitle = s.showClientsList
    ? 'Clients'
    : s.showTrainerMessaging
      ? 'Messages'
      : s.showConversationsList
        ? 'Messages'
        : s.showClientRequests
          ? 'Client Requests'
          : 'COACHCONNECT';

  return (
    <LinearGradient colors={s.isDark ? GRADIENT_BG_DARK : GRADIENT_BG_LIGHT} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <StatusBar barStyle={s.isDark ? 'light-content' : 'dark-content'} />
        {!s.showWorkoutGenerator &&
          !s.showPlanViewer &&
          !s.showTrainerMessaging &&
          !s.showAIWorkouts &&
          !s.showPhotoGallery && (
          <CoachConnectHeader
            title={headerTitle}
            isDark={s.isDark}
            skipTopSafeInset
            onBack={s.showClientsList ? () => s.setShowClientsList(false) : undefined}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
          />
        )}

        {s.showTrainerMessaging && (
          <TrainerMessagingScreen
            embedInLayout
            trainer={s.selectedTrainer}
            conversation={s.selectedConversation}
            onClose={s.handleHomePress}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
          />
        )}
        {!s.showTrainerMessaging && s.showConversationsList && (
          <ConversationsListScreen
            embedInLayout
            onClose={() => s.setShowConversationsList(false)}
            onSelectConversation={(c, o) => { s.setSelectedConversation(c); s.setSelectedTrainer(o); s.setShowConversationsList(false); s.setShowTrainerMessaging(true); }}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
            selectedClientId={s.selectedClientIdForMessages}
          />
        )}
        {!s.showTrainerMessaging && s.showClientRequests && (
          <ClientRequestsScreen
            embedInLayout
            onClose={() => s.setShowClientRequests(false)}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
            onClientAdded={s.refreshClients}
          />
        )}
        {!s.showTrainerMessaging && !s.showConversationsList && !s.showClientRequests && s.showClientsList && (
          <ClientsListScreen
            embedInLayout
            clients={s.clients}
            trainerId={s.user?.uid}
            isDark={s.isDark}
            hasMore={s.clientsHasMore}
            loadingMore={s.clientsLoadingMore}
            onLoadMore={s.loadMoreClients}
            onBack={() => s.setShowClientsList(false)}
            onSelectClient={(id) => {
              s.setNavSelectedClientId(id);
              s.setShowClientsList(false);
            }}
            onClientRemoved={s.handleTrainerClientRemovedFromRoster}
            onOpenClientRequests={() => {
              s.setShowClientsList(false);
              s.setShowClientRequests(true);
            }}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
            onHomePress={s.handleHomePress}
            onPlusPress={s.handlePlusPress}
            onVoicePress={() => {
              s.handleHomePress();
              s.openVoiceAI();
              s.setAiChatState('home');
            }}
            onNutritionPress={() => {
              s.handleHomePress();
              s.openNutrition();
            }}
            onWorkoutPress={() => {
              s.handleHomePress();
              s.openWorkoutPlan();
            }}
            onMessagesPress={() => {
              s.handleHomePress();
              s.setShowConversationsList(true);
            }}
          />
        )}
        {!s.showTrainerMessaging && !s.showConversationsList && !s.showClientRequests && !s.showClientsList && !s.showPhotoGallery && !s.showAIWorkouts && !s.showWorkoutGenerator && !s.showPlanViewer && (
          <DashboardContent
            isDark={s.isDark} clients={s.clients} clientsLoading={s.clientsLoading}
            pendingRequestsCount={s.pendingRequests?.length ?? 0} unreadMessageCount={s.unreadMessageCount}
            onClientRequestsPress={() => s.setShowClientRequests(true)}
            onClientsPress={() => s.setShowClientsList(true)}
            onMessagesPress={(clientId) => { s.setSelectedClientIdForMessages(clientId); s.setShowTrainerMessaging(false); s.setShowConversationsList(true); }}
            onOpenPhotoGallery={(client) => {
              if (!client?.id) return;
              s.setDay6Client(client);
              s.setShowConversationsList(false);
              s.setShowTrainerMessaging(false);
              s.setShowClientRequests(false);
              s.setShowPhotoGallery(true);
              s.setShowAIWorkouts(false);
            }}
            onOpenAIWorkouts={(client) => {
              if (!client?.id) return;
              s.setDay6Client(client);
              s.setShowConversationsList(false);
              s.setShowTrainerMessaging(false);
              s.setShowClientRequests(false);
              s.setShowPhotoGallery(false);
              s.setShowAIWorkouts(true);
            }}
            onRefreshClients={s.refreshClients} userName={s.userName}
            trainerId={s.user?.uid} pdfViewer={s.pdfViewer} setPdfViewer={s.setPdfViewer}
            defaultClientId={s.navSelectedClientId}
            onSelectedClientChange={s.setSelectedClientIdFromDashboard}
            onOpenWeeklyReport={(clientId, clientName) =>
              s.openWeeklyReport(clientId, clientName)
            }
            onTrainerClientRemoved={s.handleTrainerClientRemovedFromRoster} trainerDocsRefreshKey={s.trainerDocsRefreshKey}
            stripeConnectStatus={s.trainerProfileDoc?.stripeConnectStatus || 'not_connected'}
            onOpenPayments={s.openPayments}
            appSessionId={s.appSessionId}
            onOpenDocumentEditor={({ documentId = null } = {}) => {
              s.setDocumentEditor({ visible: true, documentId: documentId || null });
            }}
            onOpenSpreadsheetEditor={({ documentId = null, title = '', rows = null } = {}) => {
              s.setSpreadsheetEditor({
                visible: true,
                documentId: documentId || null,
                title: title || '',
                rows: rows ?? null,
              });
            }}
          />
        )}

        {!s.showTrainerMessaging && !s.showConversationsList && !s.showClientRequests && s.showPhotoGallery && s.day6Client?.id && !s.showWorkoutGenerator && !s.showPlanViewer && (
          <PhotoGalleryScreen
            route={{ params: { clientId: s.day6Client.id, clientName: s.day6Client.name, allowUpload: false } }}
            navigation={{ goBack: () => s.setShowPhotoGallery(false) }}
          />
        )}

        {!s.showTrainerMessaging && !s.showConversationsList && !s.showClientRequests && s.showAIWorkouts && s.day6Client?.id && !s.showWorkoutGenerator && !s.showPlanViewer && (
          <>
            <CoachConnectHeader
              title=""
              isDark={s.isDark}
              skipTopSafeInset
              onBack={() => s.setShowAIWorkouts(false)}
              onProfilePress={() => s.openProfile()}
              onSettingsPress={() => s.openSettings()}
            />
            <View style={{ flex: 1 }}>
          <AIWorkoutPlansScreen
            key={`aiwp-${s.day6Client.id}-${s.aiWorkoutsListKey}`}
            embedInLayout
            client={s.day6Client}
            trainerId={s.user?.uid}
            onBack={() => s.setShowAIWorkouts(false)}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
            onGenerateWorkout={(client) => {
              s.setGeneratorClient(client);
              s.setShowAIWorkouts(false);
              s.setShowWorkoutGenerator(true);
            }}
            onBuildCustom={() => {
              s.setManualPlanEditId(null);
              s.setManualPlanBuilderClientIds(s.day6Client?.id ? [s.day6Client.id] : []);
              s.setManualBuilderReturnToAI(true);
              s.setShowAIWorkouts(false);
              s.openManualPlanBuilder();
            }}
            onEditManualPlan={(planId) => {
              s.setManualPlanEditId(planId);
              s.setManualPlanBuilderClientIds(s.day6Client?.id ? [s.day6Client.id] : []);
              s.setManualBuilderReturnToAI(true);
              s.setShowAIWorkouts(false);
              s.openManualPlanBuilder();
            }}
            onViewPlan={(plan) => {
              s.setViewingPlan(plan);
              s.setShowAIWorkouts(false);
              s.setShowPlanViewer(true);
            }}
            route={{ params: { clientId: s.day6Client.id, clientName: s.day6Client.name } }}
            navigation={{ goBack: () => s.setShowAIWorkouts(false) }}
          />
            </View>
          </>
        )}

        {!s.showTrainerMessaging && !s.showConversationsList && !s.showClientRequests && s.showWorkoutGenerator && s.generatorClient?.id && (
          <WorkoutPlanGeneratorScreen
            userId={s.generatorClient.id}
            hideBottomNav={true}
            onBack={() => {
              s.setShowWorkoutGenerator(false);
              s.setShowAIWorkouts(true);
            }}
            onPlanGenerated={() => {
              s.setShowWorkoutGenerator(false);
              s.setShowAIWorkouts(true);
            }}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
          />
        )}

        {!s.showTrainerMessaging && !s.showConversationsList && !s.showClientRequests && s.showPlanViewer && s.viewingPlan && (
          <WorkoutPlanGeneratorScreen
            userId={s.day6Client?.id}
            plan={s.viewingPlan}
            readOnly={true}
            hideBottomNav={true}
            onBack={() => {
              s.setShowPlanViewer(false);
              s.setShowAIWorkouts(true);
            }}
            onPlanGenerated={() => {
              s.setShowPlanViewer(false);
              s.setShowAIWorkouts(true);
            }}
            onProfilePress={() => s.openProfile()}
            onSettingsPress={() => s.openSettings()}
          />
        )}

        {!s.showWorkoutGenerator && !s.showPlanViewer && (
          <BottomNavBar
            onHomePress={s.handleHomePress}
            onPlusPress={s.handlePlusPress}
            onVoicePress={s.openVoiceAI}
            onNutritionPress={() => { s.openNutrition(); }}
            onWorkoutPress={() => { s.openWorkoutPlan(); }}
            onMessagesPress={(clientId) => { s.setSelectedClientIdForMessages(clientId); s.setShowTrainerMessaging(false); s.setShowConversationsList(true); }}
          />
        )}

        <AddNotesFilesModal
          visible={s.showAddNotesFilesModal}
          onClose={() => { s.setShowAddNotesFilesModal(false); s.setAddNotesFilesClientId(null); }}
          onAdded={() => { s.setShowAddNotesFilesModal(false); s.setAddNotesFilesClientId(null); s.refreshClients(); }}
          isDark={s.isDark}
          clientId={s.addNotesFilesClientId}
          addedBy="trainer"
          onNewDocument={() => s.setDocumentEditor({ visible: true, documentId: null, title: '' })}
          onNewSpreadsheet={() => s.setSpreadsheetEditor({ visible: true, documentId: null, title: '', rows: null })}
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
              const data = ws ? XLSX.utils.sheet_to_json(ws, { header: 1 }) : [];
              const rows = (data || []).map((row) =>
                (row || []).map((val) => (val != null ? String(val) : '')),
              );
              s.setSpreadsheetEditor({
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
        
        <PdfViewerModal
          visible={s.pdfViewer.visible}
          url={s.pdfViewer.url}
          name={s.pdfViewer.name}
          isDark={s.isDark}
          onClose={() => s.setPdfViewer({ visible: false, url: null, name: null })}
        />
        <SpreadsheetEditorModal
          visible={s.spreadsheetEditor.visible}
          trainerId={s.user?.uid}
          documentId={s.spreadsheetEditor.documentId}
          isDark={s.isDark}
          initialTitle={s.spreadsheetEditor.title}
          initialRows={s.spreadsheetEditor.rows}
          onClose={() => s.setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null })}
          onSaved={() => {
            s.refreshClients();
            s.setTrainerDocsRefreshKey((k) => k + 1);
          }}
          trainerNavChrome={s.getTrainerEditorNavChrome()}
        />
        <DocumentEditorModal
          visible={s.documentEditor.visible}
          trainerId={s.user?.uid}
          documentId={s.documentEditor.documentId}
          isDark={s.isDark}
          onClose={() => s.setDocumentEditor({ visible: false, documentId: null })}
          onSaved={() => {
            s.refreshClients();
            s.setTrainerDocsRefreshKey((k) => k + 1);
          }}
          trainerNavChrome={s.getTrainerEditorNavChrome()}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}
