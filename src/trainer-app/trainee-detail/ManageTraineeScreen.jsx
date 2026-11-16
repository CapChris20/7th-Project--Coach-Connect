// Trainer view of one linked trainee: profile card, Progress/Nutrition tabs, Sessions, Notes & Files.
// Flow: live Firestore listeners fill clientData → tabs switch content → editors/modals open from workspace.
// Used by: TrainerAppStart when the trainer taps a client on the roster.
// Read order: constants → pure layout → ClientDetailScreen recipe → PLUMBING loaders at the bottom.
//
// vocab: NbCard / NbAvatar = neobrutalist profile shell; ProgressTab / NutritionTab reuse home tab bodies

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, getDocs, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db, functions } from '../../app-start/cloudConnection';
import { getProfileDateKey } from '../../helpers/dateStrings';
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from '../../nutrition/daily-log/saveLoggedFood';
import {
  getTrainerDocuments,
  filterTrainerDocumentsForClient,
  getNotesAndFiles,
} from '../../for-both/files-and-notes/saveNotesAndFiles';
import PdfViewer from '../../for-both/files-and-notes/viewers/PdfViewer';
import SpreadsheetViewer from '../../for-both/files-and-notes/viewers/SpreadsheetViewer';
import DocumentEditor from '../documents/DocumentEditor';
import SpreadsheetEditor from '../documents/SpreadsheetEditor';
import ShareDocumentPopup from '../documents/ShareDocumentPopup';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import RemoveClientSheet from '../my-trainees/RemoveClientSheet';
import CalendarTab from '../scheduling/CalendarTab';
import ProgressTab from '../progress-tab/TrainerProgressTab';
import NutritionTab from '../nutrition-tab/TrainerNutritionTab';
import { isBenignTrainerClientFirestoreError } from '../trainee-records/calmDatabaseErrors';
import { FORM_SCROLL_PROPS, useEmbeddedScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import {
  TabPills,
  ICON_ACCENT,
  TrainerNotesFilesHeroAndWorkspace,
  getClientSubtext,
  useTrainerTheme,
} from '../home/trainerHomePieces';
import { lightColors, darkColors, nb, spacing } from '../../look-and-feel/colorPalette';
import NbCard from '../../look-and-feel/NbCard';
import HardShadow from '../../look-and-feel/HardShadow';

// ===== NAMED CONSTANTS =====

const TAB_PROGRESS = 'Progress';
const TAB_NUTRITION = 'Nutrition';
const TAB_SESSIONS = 'Sessions';
const TAB_NOTES_FILES = 'Notes & Files';

const SCROLL_BOTTOM_PAD = 48;
const DEFAULT_PROGRAM_NAME = 'Custom Workout Plan';
const DEFAULT_CLIENT_LABEL = 'Client';

// Manipulate here: fallback macro goals when getDailyGoals fails or returns blanks.
const DEFAULT_PROTEIN_GOAL = 150;
const DEFAULT_CARBS_GOAL = 250;
const DEFAULT_FAT_GOAL = 70;
const DEFAULT_CALORIES_GOAL = 2000;

const MAX_LIKED_EXERCISES_SHOWN = 12;
const HIT_SLOP_HEADER = { top: 12, bottom: 12, left: 12, right: 12 };
const HIT_SLOP_MENU = { top: 8, bottom: 8, left: 8, right: 8 };
const HEADER_SQUARE_SIZE = 44;
const HEADER_SQUARE_RADIUS = 12;

// ===== HELPER FUNCTIONS =====

function callIfFunction(maybeFunction, ...args) {
  if (typeof maybeFunction !== 'function') {
    return;
  }
  return maybeFunction(...args);
}

function clientIdOf(client) {
  if (!client) return undefined;
  return client.id;
}

function clientNameOf(client, fallback) {
  if (!client || !client.name) return fallback;
  return client.name;
}

function noticeTitle(notice) {
  if (!notice) return '';
  return notice.title || '';
}

function noticeMessage(notice) {
  if (!notice) return undefined;
  return notice.message;
}

function errorMessageOrFallback(errorObject, fallbackText) {
  if (errorObject && errorObject.message) return errorObject.message;
  return fallbackText;
}

function profileTimezoneFromClientData(clientData) {
  if (!clientData) return undefined;
  return clientData.profileTimezone;
}

function likedExercisesFromClientData(clientData) {
  if (!clientData) return null;
  return clientData.likedExercises;
}


// ===== PURE LAYOUT (no hooks) =====

/**
 * Visual shell for one trainee’s detail screen.
 * Receives already-resolved props from ClientDetailScreen so hooks stay in the recipe below.
 */
function ClientDetailLayout({
  isDark,
  screenBg,
  textColor,
  mutedColor,
  divider,
  statusBarStyle,
  androidHeaderPad,
  scrollBottomPad,
  clientDisplayName,
  clientSubtitle,
  showLikedExercises,
  likedExercisesText,
  activeTab,
  onTabChange,
  loadingClientData,
  showProgressTab,
  showNutritionTab,
  showSessionsTab,
  showNotesFilesTab,
  progressTabNode,
  nutritionTabNode,
  sessionsTabNode,
  notesFilesTabNode,
  onBack,
  onOpenRemoveMenu,
  showRemoveSheet,
  onCloseRemoveSheet,
  onConfirmRemove,
  removeBusy,
  pdfViewer,
  onClosePdf,
  spreadsheetViewer,
  onCloseSpreadsheet,
  documentEditor,
  trainerId,
  onCloseDocumentEditor,
  onDocumentSaved,
  spreadsheetEditor,
  onCloseSpreadsheetEditor,
  onSpreadsheetSaved,
  trainerEditorNav,
  shareModal,
  onCloseShareModal,
  onShareSaved,
  notice,
  onCloseNotice,
}) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: screenBg }}>
      <StatusBar barStyle={statusBarStyle} />

      {/* Design Law header: back square · name/subtitle · ⋯ (PNG 05/07/17) */}
      <ClientDetailHeader
        textColor={textColor}
        mutedColor={mutedColor}
        screenBg={screenBg}
        divider={divider}
        androidHeaderPad={androidHeaderPad}
        clientDisplayName={clientDisplayName}
        clientSubtitle={clientSubtitle}
        onBack={onBack}
        onOpenRemoveMenu={onOpenRemoveMenu}
      />

      <RemoveClientSheet
        visible={showRemoveSheet}
        onClose={onCloseRemoveSheet}
        onConfirm={onConfirmRemove}
        clientName={clientDisplayName}
        busy={removeBusy}
      />

      <View style={{ flex: 1, minHeight: 0 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingBottom: scrollBottomPad,
            gap: 16,
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
          {...FORM_SCROLL_PROPS}
        >
          {showLikedExercises ? (
            <LikedExercisesCard
              textColor={textColor}
              mutedColor={mutedColor}
              likedExercisesText={likedExercisesText}
            />
          ) : null}

          <TabPills activeTab={activeTab} onTabChange={onTabChange} isDark={isDark} />

          {loadingClientData ? (
            <LoadingClientBlock mutedColor={mutedColor} />
          ) : (
            <View>
              {showProgressTab ? progressTabNode : null}
              {showNutritionTab ? nutritionTabNode : null}
              {showSessionsTab ? sessionsTabNode : null}
              {showNotesFilesTab ? notesFilesTabNode : null}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>

      <PdfViewer
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={onClosePdf}
      />
      <SpreadsheetViewer
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={onCloseSpreadsheet}
      />
      <DocumentEditor
        visible={documentEditor.visible}
        trainerId={trainerId}
        documentId={documentEditor.documentId}
        isDark={isDark}
        onClose={onCloseDocumentEditor}
        onSaved={onDocumentSaved}
        trainerNavChrome={trainerEditorNav}
      />
      <SpreadsheetEditor
        visible={spreadsheetEditor?.visible || false}
        trainerId={trainerId}
        documentId={spreadsheetEditor?.documentId || null}
        isDark={isDark}
        initialTitle={spreadsheetEditor?.title || ''}
        initialRows={spreadsheetEditor?.rows || null}
        isProgramStarter={spreadsheetEditor?.isProgramStarter || false}
        onClose={onCloseSpreadsheetEditor}
        onSaved={onSpreadsheetSaved}
      />
      <ShareDocumentPopup
        visible={shareModal.visible}
        trainerId={trainerId}
        documentId={shareModal.documentId}
        initialSharedWith={shareModal.sharedWith}
        isDark={isDark}
        onClose={onCloseShareModal}
        onSaved={onShareSaved}
      />
      <NbNoticeSheet
        visible={!!notice}
        onClose={onCloseNotice}
        title={noticeTitle(notice)}
        message={noticeMessage(notice)}
        confirmLabel="OK"
      />
    </SafeAreaView>
  );
}

function ClientDetailHeader({
  textColor,
  mutedColor,
  screenBg,
  divider,
  androidHeaderPad,
  clientDisplayName,
  clientSubtitle,
  onBack,
  onOpenRemoveMenu,
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md,
        paddingTop: androidHeaderPad + spacing.sm,
        paddingBottom: spacing.sm,
        gap: 12,
      }}
    >
      <HardShadow offset={nb.shadowOffsetSmall} radius={HEADER_SQUARE_RADIUS}>
        <TouchableOpacity
          onPress={onBack}
          hitSlop={HIT_SLOP_HEADER}
          style={{
            width: HEADER_SQUARE_SIZE,
            height: HEADER_SQUARE_SIZE,
            borderRadius: HEADER_SQUARE_RADIUS,
            borderWidth: nb.borderWidth,
            borderColor: divider,
            backgroundColor: screenBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={textColor} />
        </TouchableOpacity>
      </HardShadow>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            color: textColor,
            fontSize: 20,
            fontFamily: 'SpaceGrotesk_700Bold',
            letterSpacing: -0.3,
          }}
          numberOfLines={1}
        >
          {clientDisplayName}
        </Text>
        <Text
          style={{ color: mutedColor, fontSize: 13, marginTop: 2, fontFamily: 'Inter_500Medium' }}
          numberOfLines={1}
        >
          {clientSubtitle}
        </Text>
      </View>
      <HardShadow offset={nb.shadowOffsetSmall} radius={HEADER_SQUARE_RADIUS}>
        <TouchableOpacity
          onPress={onOpenRemoveMenu}
          accessibilityLabel="Client options: remove from roster"
          accessibilityRole="button"
          hitSlop={HIT_SLOP_MENU}
          style={{
            width: HEADER_SQUARE_SIZE,
            height: HEADER_SQUARE_SIZE,
            borderRadius: HEADER_SQUARE_RADIUS,
            borderWidth: nb.borderWidth,
            borderColor: divider,
            backgroundColor: screenBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="ellipsis-horizontal" size={22} color={textColor} />
        </TouchableOpacity>
      </HardShadow>
    </View>
  );
}

function LikedExercisesCard({ textColor, mutedColor, likedExercisesText }) {
  return (
    <NbCard style={{ padding: 14 }}>
      <Text
        style={{
          color: textColor,
          fontFamily: 'SpaceGrotesk_700Bold',
          fontSize: 13,
          marginBottom: 8,
          textTransform: 'uppercase',
          letterSpacing: 1.2,
        }}
      >
        Liked exercises
      </Text>
      <Text style={{ color: mutedColor, fontSize: 13, lineHeight: 18, fontFamily: 'Inter_400Regular' }}>
        {likedExercisesText}
      </Text>
    </NbCard>
  );
}

function LoadingClientBlock({ mutedColor }) {
  return (
    <View style={{ padding: 40, alignItems: 'center' }}>
      <ActivityIndicator color={ICON_ACCENT} />
      <Text style={{ color: mutedColor, fontSize: 13, marginTop: 12 }}>
        Loading client data...
      </Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

// Trainer — single-client detail (sessions + notes/files).
const ClientDetailScreen = ({
  client,
  trainerId,
  onBack,
  onRemoveClient,
  trainerName: _trainerName,
  getTrainerEditorNavChrome,
  onMessagesPress,
}) => {
  const { isDark } = useTrainerTheme();
  const scrollBottomPad = useEmbeddedScrollBottomPad(SCROLL_BOTTOM_PAD);
  const { textColor, mutedColor, screenBg, divider } = screenColorsForTheme(isDark);

  const [activeTab, setActiveTab] = useState(TAB_PROGRESS);
  const [showRemoveSheet, setShowRemoveSheet] = useState(false);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [todayDailyLog, setTodayDailyLog] = useState(null);
  const [refreshNotesAndFilesTrigger, setRefreshNotesAndFilesTrigger] = useState(0);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [trainerDocuments, setTrainerDocuments] = useState([]);
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({
    visible: false,
    documentId: null,
    title: '',
    rows: null,
    isProgramStarter: false,
  });
  const [shareModal, setShareModal] = useState({ visible: false, documentId: null, sharedWith: [] });
  // vocab: notice = NbNoticeSheet payload — Design Law sheet instead of Alert.alert
  const [notice, setNotice] = useState(null);
  const showNotice = useCallback((title, message) => setNotice({ title, message }), []);

  const trainerEditorNav = useMemo(
    () =>
      typeof getTrainerEditorNavChrome === 'function'
        ? getTrainerEditorNavChrome(() => {
            setDocumentEditor({ visible: false, documentId: null });
            setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null, isProgramStarter: false });
          })
        : null,
    [getTrainerEditorNavChrome],
  );

  const linkedClientId = clientIdOf(client);
  const trainerDocumentsForClient = useMemo(
    () => filterTrainerDocumentsForClient(trainerDocuments, linkedClientId),
    [trainerDocuments, linkedClientId],
  );

  // 1. Load trainer-owned document templates once we know trainerId.
  useEffect(() => {
    if (!trainerId) return;
    getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => setTrainerDocuments([]));
  }, [trainerId]);

  // Client's "today" key — timezone can come from the live user doc once it loads.
  const clientTodayKey = useMemo(
    () =>
      getProfileDateKey({
        ...(client || {}),
        timezone: profileTimezoneFromClientData(clientData),
        timeZone: profileTimezoneFromClientData(clientData),
      }),
    [client, clientData],
  );

  // 2. Live dailyLog for "check-in logged today" on the profile card.
  useEffect(() => {
    if (!linkedClientId || !db) {
      setTodayDailyLog(null);
      return;
    }
    const dateKey = clientTodayKey;
    // vocab: onSnapshot = live Firestore listener; returns an unsubscribe function.
    const unsubscribe = onSnapshot(
      doc(db, 'users', linkedClientId, 'dailyLogs', dateKey),
      (snap) => setTodayDailyLog(snap.exists() ? snap.data() : null),
      () => setTodayDailyLog(null),
    );
    return () => unsubscribe();
  }, [linkedClientId, clientTodayKey]);

  // 3. Main data: user doc + CRM + nutrition + notes listeners (tear down all on unmount).
  useEffect(() => {
    if (!linkedClientId || !trainerId || !db) {
      setClientData(null);
      return;
    }

    let effectCancelled = false;
    const unsubscribers = [];

    const applyLoadedClientData = (nextClientData) => {
      if (effectCancelled) return;
      setClientData(nextClientData);
    };

    const applyCrmFallback = async (logLabel) => {
      try {
        const fallbackData = await buildClientDataFromCrmFallback(trainerId, client);
        applyLoadedClientData(fallbackData);
      } catch (fallbackError) {
        if (!isBenignTrainerClientFirestoreError(fallbackError)) {
          console.error(logLabel, fallbackError);
        }
        if (!effectCancelled) setClientData(null);
      }
    };

    const onUserDocSnapshot = async (userDoc) => {
      if (!userDoc.exists()) {
        await applyCrmFallback('Error building client detail without user doc:');
        return;
      }

      const userData = userDoc.data();
      try {
        const nextClientData = await buildClientDataFromUserDoc({
          userData,
          trainerId,
          clientId: linkedClientId,
          clientTodayKey,
        });
        applyLoadedClientData(nextClientData);
      } catch (updateError) {
        console.error('Error updating client data:', updateError);
      }
    };

    const onUserDocError = (error) => {
      if (isBenignTrainerClientFirestoreError(error)) {
        applyCrmFallback('Error building client detail (listener fallback):');
        return;
      }
      console.error('User document listener error:', error);
      if (!effectCancelled) setClientData(null);
    };

    // users/{clientId} — profile, liked exercises, weight.
    const userUnsub = onSnapshot(
      doc(db, 'users', linkedClientId),
      onUserDocSnapshot,
      onUserDocError,
    );
    unsubscribers.push(userUnsub);

    // Nutrition logs collection — same path clients use when logging food.
    const nutritionUnsub = onSnapshot(
      query(collection(db, 'nutrition_logs'), where('user_id', '==', linkedClientId)),
      async () => {
        try {
          const nutritionLogs = await getFoodLogsForDate(linkedClientId, clientTodayKey);
          const macroTotals = calculateMacroTotals(nutritionLogs);
          if (effectCancelled) return;

          setClientData((previousData) =>
            mergeNutritionIntoClientData(previousData, nutritionLogs, macroTotals),
          );
        } catch (nutritionError) {
          if (!isBenignTrainerClientFirestoreError(nutritionError)) {
            console.error('Error updating nutrition data:', nutritionError);
          }
        }
      },
    );
    unsubscribers.push(nutritionUnsub);

    // notes_and_files subcollection under the client user doc.
    const notesColRef = collection(db, 'users', linkedClientId, 'notes_and_files');
    const notesUnsub = onSnapshot(
      notesColRef,
      async () => {
        try {
          const notesAndFiles = await getNotesAndFiles(linkedClientId);
          if (effectCancelled) return;
          setClientData((previousData) =>
            mergeNotesIntoClientData(previousData, notesAndFiles, client),
          );
        } catch (notesError) {
          console.error('Error syncing notes and files (detail):', notesError);
        }
      },
      (notesListenerError) => console.error('notes_and_files listener error (detail):', notesListenerError),
    );
    unsubscribers.push(notesUnsub);

    // CRM client doc (calendar, program name — notes live in notes_and_files).
    const clientDocUnsub = onSnapshot(
      doc(db, 'trainer_clients', trainerId, 'clients', linkedClientId),
      (clientDoc) => {
        if (!clientDoc.exists()) return;
        const clientDocData = clientDoc.data();
        setClientData((previousData) =>
          mergeCrmFieldsIntoClientData(previousData, clientDocData),
        );
      },
    );
    unsubscribers.push(clientDocUnsub);

    return () => {
      effectCancelled = true;
      for (let index = 0; index < unsubscribers.length; index += 1) {
        unsubscribers[index]();
      }
    };
  }, [linkedClientId, trainerId, clientTodayKey]);

  const openRemoveClientMenu = () => setShowRemoveSheet(true);

  const confirmRemoveClient = useCallback(async () => {
    if (!trainerId || !linkedClientId || !functions) {
      showNotice('Unavailable', 'Cloud Functions are not configured.');
      return;
    }
    setRemoveBusy(true);
    try {
      // vocab: httpsCallable = Firebase Cloud Function wrapper; letters of the name stay frozen.
      const removeLinkCallable = httpsCallable(functions, 'removeTrainerClientLink');
      await removeLinkCallable({
        trainerId,
        clientId: linkedClientId,
        reasons: [],
        otherText: null,
        removedBy: 'trainer',
      });
      setShowRemoveSheet(false);
      callIfFunction(onRemoveClient);
    } catch (removeError) {
      showNotice('Remove failed', errorMessageOrFallback(removeError, 'Could not remove this client.'));
    } finally {
      setRemoveBusy(false);
    }
  }, [linkedClientId, onRemoveClient, showNotice, trainerId]);

  // Named decisions for layout (no nested ternaries in JSX).
  const clientDisplayName = clientNameOf(client, DEFAULT_CLIENT_LABEL);
  const clientSubtitle = getClientSubtext(client);
  const likedExercises = likedExercisesFromClientData(clientData);
  const showLikedExercises =
    Array.isArray(likedExercises) && likedExercises.length > 0;
  const likedExercisesText = showLikedExercises
    ? likedExercisesDisplayText(likedExercises)
    : '';
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';
  const androidHeaderPad = Platform.OS === 'android' ? 8 : 0;

  const showProgressTab = activeTab === TAB_PROGRESS;
  const showNutritionTab = activeTab === TAB_NUTRITION;
  const showSessionsTab = activeTab === TAB_SESSIONS;
  const showNotesFilesTab = activeTab === TAB_NOTES_FILES;

  const progressTabKey = linkedClientId || 'progress';
  const nutritionTabKey = linkedClientId || 'nutrition';
  const progressTabNode = (
    <ProgressTab
      key={progressTabKey}
      isDark={isDark}
      clientData={clientData}
      todayDailyLog={todayDailyLog}
    />
  );

  const nutritionTabNode = (
    <NutritionTab
      key={nutritionTabKey}
      isDark={isDark}
      clientData={clientData}
      clientName={clientDisplayName}
      onRemindLog={() => {
        const firstNameToken = String(clientDisplayName || 'Client').split(/\s+/)[0];
        showNotice(
          'Reminder sent',
          `${firstNameToken} will get a nudge to log today’s meals.`,
        );
      }}
    />
  );

  const sessionsTabNode = (
    <CalendarTab
      clientId={linkedClientId}
      clientName={clientNameOf(client, DEFAULT_CLIENT_LABEL)}
      onMessageClient={() => callIfFunction(onMessagesPress, linkedClientId)}
    />
  );

  const notesFilesTabNode = (
    <TrainerNotesFilesHeroAndWorkspace
      isDark={isDark}
      clientName={clientNameOf(client, DEFAULT_CLIENT_LABEL)}
      clientData={clientData}
      trainerDocuments={trainerDocumentsForClient}
      clientId={linkedClientId}
      trainerId={trainerId}
      onRefetchNotesAndFiles={() =>
        setRefreshNotesAndFilesTrigger((previous) => previous + 1)
      }
      pdfViewer={pdfViewer}
      setPdfViewer={setPdfViewer}
      spreadsheetViewer={spreadsheetViewer}
      setSpreadsheetViewer={setSpreadsheetViewer}
      onRefetchTrainerDocuments={() =>
        getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})
      }
      onOpenDocumentEditor={(fileItem) => {
        if (!fileItem) return;
        let documentId = null;
        if (fileItem.documentId) documentId = fileItem.documentId;
        else if (fileItem.id) documentId = fileItem.id;
        setDocumentEditor({ visible: true, documentId });
      }}
      onOpenSpreadsheetEditor={(fileItem) => {
        if (!fileItem) return;
        let documentId = null;
        if (fileItem.documentId) documentId = fileItem.documentId;
        else if (fileItem.id) documentId = fileItem.id;
        const title = fileItem.title || fileItem.name || '';
        setSpreadsheetEditor({ visible: true, documentId, title, rows: null, isProgramStarter: false });
      }}
      onOpenShareModal={({ documentId, initialSharedWith }) =>
        setShareModal({
          visible: true,
          documentId,
          sharedWith: initialSharedWith || [],
        })
      }
    />
  );

  return (
    <ClientDetailLayout
      isDark={isDark}
      screenBg={screenBg}
      textColor={textColor}
      mutedColor={mutedColor}
      divider={divider}
      statusBarStyle={statusBarStyle}
      androidHeaderPad={androidHeaderPad}
      scrollBottomPad={scrollBottomPad}
      clientDisplayName={clientDisplayName}
      clientSubtitle={clientSubtitle}
      showLikedExercises={showLikedExercises}
      likedExercisesText={likedExercisesText}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      loadingClientData={loadingClientData}
      showProgressTab={showProgressTab}
      showNutritionTab={showNutritionTab}
      showSessionsTab={showSessionsTab}
      showNotesFilesTab={showNotesFilesTab}
      progressTabNode={progressTabNode}
      nutritionTabNode={nutritionTabNode}
      sessionsTabNode={sessionsTabNode}
      notesFilesTabNode={notesFilesTabNode}
      onBack={onBack}
      onOpenRemoveMenu={openRemoveClientMenu}
      showRemoveSheet={showRemoveSheet}
      onCloseRemoveSheet={() => !removeBusy && setShowRemoveSheet(false)}
      onConfirmRemove={confirmRemoveClient}
      removeBusy={removeBusy}
      pdfViewer={pdfViewer}
      onClosePdf={() => setPdfViewer({ visible: false, url: null, name: null })}
      spreadsheetViewer={spreadsheetViewer}
      onCloseSpreadsheet={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      documentEditor={documentEditor}
      trainerId={trainerId}
      onCloseDocumentEditor={() => setDocumentEditor({ visible: false, documentId: null })}
      onDocumentSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
      spreadsheetEditor={spreadsheetEditor}
      onCloseSpreadsheetEditor={() =>
        setSpreadsheetEditor({
          visible: false,
          documentId: null,
          title: '',
          rows: null,
          isProgramStarter: false,
        })
      }
      onSpreadsheetSaved={() => {
        getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {});
        setRefreshNotesAndFilesTrigger((previous) => previous + 1);
      }}
      trainerEditorNav={trainerEditorNav}
      shareModal={shareModal}
      onCloseShareModal={() => setShareModal({ visible: false, documentId: null, sharedWith: [] })}
      onShareSaved={() => {
        getTrainerDocuments(trainerId).then(setTrainerDocuments);
        setRefreshNotesAndFilesTrigger((previous) => previous + 1);
      }}
      notice={notice}
      onCloseNotice={() => setNotice(null)}
    />
  );
};

export default ClientDetailScreen;

// PLUMBING — skip unless debugging

function emptyNutritionBlock() {
  return {
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    foods: [],
    micros: [],
  };
}

function emptyCalendarBlock() {
  return { completed: [], upcoming: [], missed: [], upcomingSessions: [] };
}

async function loadNotesAndFilesSafe(clientId) {
  try {
    return await getNotesAndFiles(clientId);
  } catch (_loadError) {
    return [];
  }
}

function clientDataFromTrainerCrmOnly(trainerClientDoc, client, notesAndFiles) {
  // vocab/symbol: ?? = use right side only when left is null/undefined (keeps a real 0).
  const clientStartingWeight = client ? client.startingWeight : null;
  const clientWeight = client ? client.weight : null;
  return {
    beforeWeight:
      trainerClientDoc.startingWeight
      ?? trainerClientDoc.weight
      ?? clientStartingWeight
      ?? clientWeight
      ?? null,
    currentWeight: trainerClientDoc.weight ?? clientWeight ?? null,
    trainingDays: [],
    programName: trainerClientDoc.programName || DEFAULT_PROGRAM_NAME,
    nutrition: emptyNutritionBlock(),
    calendar: trainerClientDoc.calendar || emptyCalendarBlock(),
    notesAndFiles,
  };
}

function foodNamesFromLogs(nutritionLogs) {
  const names = [];
  for (let index = 0; index < nutritionLogs.length; index += 1) {
    const logRow = nutritionLogs[index];
    const foodName = logRow.food_name || logRow.foodName || 'Food';
    if (foodName) names.push(foodName);
  }
  return names;
}

function appendTruthyMicros(accumulator, rowMicros) {
  for (let microIndex = 0; microIndex < rowMicros.length; microIndex += 1) {
    const microEntry = rowMicros[microIndex];
    if (!microEntry) continue;
    accumulator.push(microEntry);
  }
}

function microsFromLogs(nutritionLogs) {
  const micros = [];
  for (let index = 0; index < nutritionLogs.length; index += 1) {
    const logRow = nutritionLogs[index];
    if (!logRow.micros) continue;
    appendTruthyMicros(micros, logRow.micros || []);
  }
  return micros;
}

function mergeNutritionIntoClientData(previousData, nutritionLogs, macroTotals) {
  if (!previousData) return previousData;
  return {
    ...previousData,
    nutrition: {
      ...previousData.nutrition,
      calories: macroTotals.calories,
      protein: macroTotals.protein,
      carbs: macroTotals.carbs,
      fat: macroTotals.fat,
      foods: foodNamesFromLogs(nutritionLogs),
      micros: microsFromLogs(nutritionLogs),
    },
  };
}

function mergeNotesIntoClientData(previousData, notesAndFiles, client) {
  if (previousData) {
    return { ...previousData, notesAndFiles };
  }
  const clientStartingWeight = client ? client.startingWeight : null;
  const clientWeight = client ? client.weight : null;
  return {
    beforeWeight: clientStartingWeight ?? clientWeight ?? null,
    currentWeight: clientWeight ?? null,
    trainingDays: [],
    programName: DEFAULT_PROGRAM_NAME,
    nutrition: emptyNutritionBlock(),
    calendar: emptyCalendarBlock(),
    notesAndFiles,
  };
}

function mergeCrmFieldsIntoClientData(previousData, clientDocData) {
  if (!previousData) return previousData;
  return {
    ...previousData,
    calendar: clientDocData.calendar || previousData.calendar,
    programName: clientDocData.programName || previousData.programName,
  };
}

function resolveNutritionGoals(userData, nutritionGoals) {
  return {
    proteinGoal: userData.proteinGoal ?? nutritionGoals.proteinTarget ?? DEFAULT_PROTEIN_GOAL,
    carbsGoal: userData.carbsGoal ?? nutritionGoals.carbsTarget ?? DEFAULT_CARBS_GOAL,
    fatGoal: userData.fatGoal ?? nutritionGoals.fatTarget ?? DEFAULT_FAT_GOAL,
    caloriesGoal:
      userData.calorieTarget
      ?? userData.calorie_target
      ?? nutritionGoals.calories
      ?? DEFAULT_CALORIES_GOAL,
  };
}

async function loadNutritionGoalsOrDefaults(clientId) {
  const nutritionGoals = {
    proteinTarget: DEFAULT_PROTEIN_GOAL,
    carbsTarget: DEFAULT_CARBS_GOAL,
    fatTarget: DEFAULT_FAT_GOAL,
    calories: DEFAULT_CALORIES_GOAL,
  };
  try {
    const goalsData = await getDailyGoals(clientId);
    if (goalsData && goalsData.proteinTarget != null) nutritionGoals.proteinTarget = goalsData.proteinTarget;
    if (goalsData && goalsData.carbsTarget != null) nutritionGoals.carbsTarget = goalsData.carbsTarget;
    if (goalsData && goalsData.fatTarget != null) nutritionGoals.fatTarget = goalsData.fatTarget;
    if (goalsData && goalsData.calories != null) nutritionGoals.calories = goalsData.calories;
  } catch (_goalsError) {
    // Keep defaults.
  }
  return nutritionGoals;
}

function trainingDaysFromSnapshot(trainingSnapshot) {
  const trainingDays = [];
  for (let index = 0; index < trainingSnapshot.docs.length; index += 1) {
    trainingDays.push(trainingSnapshot.docs[index].data());
  }
  return trainingDays;
}

async function buildClientDataFromUserDoc({
  userData,
  trainerId,
  clientId,
  clientTodayKey,
}) {
  // Firestore paths (frozen): trainer_clients/{trainerId}/clients/{clientId}, users/{clientId}/trainingDays
  const clientDocSnap = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', clientId));
  const clientDocData = clientDocSnap.exists() ? clientDocSnap.data() : {};

  const notesAndFiles = await loadNotesAndFilesSafe(clientId);

  const trainingQuery = query(collection(db, 'users', clientId, 'trainingDays'));
  const trainingSnapshot = await getDocs(trainingQuery);
  const trainingDays = trainingDaysFromSnapshot(trainingSnapshot);

  const nutritionLogs = await getFoodLogsForDate(clientId, clientTodayKey);
  const macroTotals = calculateMacroTotals(nutritionLogs);
  const nutritionGoals = await loadNutritionGoalsOrDefaults(clientId);
  const goalFields = resolveNutritionGoals(userData, nutritionGoals);

  return {
    profileTimezone:
      userData.timezone
      || userData.timeZone
      || (userData.workoutReminder ? userData.workoutReminder.timeZone : null)
      || null,
    beforeWeight:
      userData.startingWeight
      ?? userData.weight
      ?? clientDocData.startingWeight
      ?? clientDocData.weight
      ?? null,
    currentWeight: userData.weight ?? clientDocData.weight ?? null,
    trainingDays,
    programName: clientDocData.programName || DEFAULT_PROGRAM_NAME,
    nutrition: {
      calories: macroTotals.calories,
      protein: macroTotals.protein,
      carbs: macroTotals.carbs,
      fat: macroTotals.fat,
      foods: foodNamesFromLogs(nutritionLogs),
      micros: microsFromLogs(nutritionLogs),
      ...goalFields,
    },
    calendar: clientDocData.calendar || emptyCalendarBlock(),
    notesAndFiles,
    likedExercises: Array.isArray(userData.likedExercises) ? userData.likedExercises : [],
    exercisesPrefer: userData.exercisesPrefer || userData.exercisesDislike || '',
  };
}

async function buildClientDataFromCrmFallback(trainerId, client) {
  const trainerClientSnap = await getDoc(
    doc(db, 'trainer_clients', trainerId, 'clients', client.id),
  );
  const trainerClientDoc = trainerClientSnap.exists() ? trainerClientSnap.data() : {};
  const notesAndFiles = await loadNotesAndFilesSafe(client.id);
  return clientDataFromTrainerCrmOnly(trainerClientDoc, client, notesAndFiles);
}

function hasDashboardCheckInToday(todayDailyLog) {
  if (!todayDailyLog) return false;
  const fieldNames = Object.keys(todayDailyLog);
  for (let index = 0; index < fieldNames.length; index += 1) {
    const fieldName = fieldNames[index];
    if (!fieldName.startsWith('dashboard_')) continue;
    const fieldValue = todayDailyLog[fieldName];
    if (fieldValue != null && fieldValue !== '') return true;
  }
  return false;
}

function likedExerciseName(entry) {
  if (typeof entry === 'string') return entry;
  if (!entry) return '';
  return entry.name || entry.exerciseName || '';
}

function likedExercisesDisplayText(likedExercises) {
  const names = [];
  for (let index = 0; index < likedExercises.length; index += 1) {
    const name = likedExerciseName(likedExercises[index]);
    if (name) names.push(name);
  }
  return names.slice(0, MAX_LIKED_EXERCISES_SHOWN).join(' · ');
}

function screenColorsForTheme(isDark) {
  const palette = isDark ? darkColors : lightColors;
  return {
    textColor: palette.nbInk,
    mutedColor: palette.nbMuted,
    screenBg: palette.nbBackground,
    divider: palette.nbBorder,
  };
}
