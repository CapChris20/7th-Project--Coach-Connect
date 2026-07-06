/**
 * Trainer Client Detail Screen
 *
 * Purpose: UI screen or component: Trainer Client Detail Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: (see file)
 *
 * @file-header
 */
/** Trainer — single-client detail (sessions + notes/files) */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { doc, getDoc, getDocs, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { getProfileDateKey } from '../../shared-utils/dateKeys';
import { getFoodLogsForDate, calculateMacroTotals, getDailyGoals } from '../../nutrition/daily-log/logFoodToFirestore';
import {
  getTrainerDocuments,
  filterTrainerDocumentsForClient,
  getNotesAndFiles,
} from '../../shared/notes-files/manageNotesAndFiles';
import PdfViewerModal from '../../shared/components/notes-files/PdfViewerModal';
import SpreadsheetViewerModal from '../../shared/components/notes-files/SpreadsheetViewerModal';
import DocumentEditorModal from '../documents/DocumentEditorModal';
import SpreadsheetEditorModal from '../documents/SpreadsheetEditorModal';
import ShareDocumentModal from '../documents/ShareDocumentModal';
import RemoveTrainerSheet from '../../shared/components/modals/RemoveTrainerSheet';
import CalendarTab from '../calendar-tab/TrainerCalendarTab';
import { isBenignTrainerClientFirestoreError } from '../crm/trainerFirestoreErrors';
import { FORM_SCROLL_PROPS, useEmbeddedScrollBottomPad } from '../../navigation/bottomNavMetrics';
import {
  GlassCard,
  TabPills,
  Icon,
  ICON_ACCENT,
  TrainerNotesFilesHeroAndWorkspace,
  getClientInitials,
  getClientSubtext,
  useTrainerTheme,
  GRADIENT_AVATAR,
  CARD_BORDER_PINK_ORANGE,
} from '../dashboard/trainerDashboardUi';

const ClientDetailScreen = ({ client, trainerId, onBack, onRemoveClient, trainerName, getTrainerEditorNavChrome }) => {
  const { isDark } = useTrainerTheme();
  const scrollBottomPad = useEmbeddedScrollBottomPad(48);
  const textColor = isDark ? '#ffffff' : '#1a0a2e';
  const mutedColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.5)';

  const [activeTab, setActiveTab] = useState('Progress');
  const [showRemoveSheet, setShowRemoveSheet] = useState(false);
  const [clientData, setClientData] = useState(null);
  const [loadingClientData, setLoadingClientData] = useState(false);
  const [todayDailyLog, setTodayDailyLog] = useState(null);
  const [refreshNotesAndFilesTrigger, setRefreshNotesAndFilesTrigger] = useState(0);
  const [pdfViewer, setPdfViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetViewer, setSpreadsheetViewer] = useState({ visible: false, url: null, name: null });
  const [spreadsheetEditor, setSpreadsheetEditor] = useState({ visible: false, documentId: null, title: '', rows: null });
  const [trainerDocuments, setTrainerDocuments] = useState([]);
  const [documentEditor, setDocumentEditor] = useState({ visible: false, documentId: null });
  const [shareModal, setShareModal] = useState({ visible: false, documentId: null, sharedWith: [] });

  const trainerEditorNav = useMemo(
    () =>
      typeof getTrainerEditorNavChrome === 'function'
        ? getTrainerEditorNavChrome(() => {
            setDocumentEditor({ visible: false, documentId: null });
            setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null });
          })
        : null,
    [getTrainerEditorNavChrome],
  );

  const trainerDocumentsForClient = useMemo(
    () => filterTrainerDocumentsForClient(trainerDocuments, client?.id),
    [trainerDocuments, client?.id],
  );

  useEffect(() => {
    if (!trainerId) return;
    getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => setTrainerDocuments([]));
  }, [trainerId]);

  // Real-time dailyLog listener
  const clientTodayKey = useMemo(
    () => getProfileDateKey({
      ...(client || {}),
      timezone: clientData?.profileTimezone,
      timeZone: clientData?.profileTimezone,
    }),
    [client, clientData?.profileTimezone],
  );

  useEffect(() => {
    if (!client?.id || !db) { setTodayDailyLog(null); return; }
    const dateKey = clientTodayKey;
    const unsubscribe = onSnapshot(
      doc(db, 'users', client.id, 'dailyLogs', dateKey),
      (snap) => setTodayDailyLog(snap.exists() ? snap.data() : null),
      () => setTodayDailyLog(null)
    );
    return () => unsubscribe();
  }, [client?.id, clientTodayKey]);

  // Fetch all client data
  useEffect(() => {
    if (!client?.id || !trainerId || !db) { setClientData(null); return; }

    let effectCancelled = false;
    const unsubscribers = [];
    
    // Listen to user document changes (weight, profile updates)
    const userUnsub = onSnapshot(
      doc(db, 'users', client.id),
      async (userDoc) => {
        if (!userDoc.exists()) {
          try {
            const tcSnap = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', client.id));
            const tc = tcSnap.exists() ? tcSnap.data() : {};
            let notesAndFiles = [];
            try {
              notesAndFiles = await getNotesAndFiles(client.id);
            } catch (_) {}
            if (effectCancelled) return;
            setClientData({
              beforeWeight: tc.startingWeight ?? tc.weight ?? client?.startingWeight ?? client?.weight ?? null,
              currentWeight: tc.weight ?? client?.weight ?? null,
              trainingDays: [],
              programName: tc.programName || 'Custom Program',
              nutrition: {
                calories: 0,
                protein: 0,
                carbs: 0,
                fat: 0,
                foods: [],
                micros: [],
              },
              calendar: tc.calendar || { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
              notesAndFiles,
            });
          } catch (e) {
            if (!isBenignTrainerClientFirestoreError(e)) {
              console.error('Error building client detail without user doc:', e);
            }
            if (!effectCancelled) setClientData(null);
          }
          return;
        }

        const userData = userDoc.data();

        // Fetch other related data
        try {
          const clientDoc = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', client.id));
          const clientDocData = clientDoc.exists() ? clientDoc.data() : {};

          let notesAndFiles = [];
          try {
            notesAndFiles = await getNotesAndFiles(client.id);
          } catch (_) {}

          const trainingQuery = query(collection(db, 'users', client.id, 'trainingDays'));
          const trainingSnapshot = await getDocs(trainingQuery);
          const trainingDays = trainingSnapshot.docs.map((d) => d.data());

          // Fetch nutrition data (nutrition_logs — same path clients use when logging food)
          const todayKey = clientTodayKey;
          const nutritionLogs = await getFoodLogsForDate(client.id, todayKey);
          const macroTotals = calculateMacroTotals(nutritionLogs);
          let nutritionGoals = { proteinTarget: 150, carbsTarget: 250, fatTarget: 70, calories: 2000 };
          try {
            const goalsData = await getDailyGoals(client.id);
            if (goalsData?.proteinTarget != null) nutritionGoals.proteinTarget = goalsData.proteinTarget;
            if (goalsData?.carbsTarget != null) nutritionGoals.carbsTarget = goalsData.carbsTarget;
            if (goalsData?.fatTarget != null) nutritionGoals.fatTarget = goalsData.fatTarget;
            if (goalsData?.calories != null) nutritionGoals.calories = goalsData.calories;
          } catch (_) {}
          
          if (effectCancelled) return;

          const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);
          
          setClientData({
            profileTimezone: userData.timezone || userData.timeZone || userData?.workoutReminder?.timeZone || null,
            beforeWeight: userData.startingWeight ?? userData.weight ?? clientDocData.startingWeight ?? clientDocData.weight ?? null,
            currentWeight: userData.weight ?? clientDocData.weight ?? null,
            trainingDays,
            programName: clientDocData.programName || 'Custom Program',
            nutrition: {
              calories: macroTotals.calories,
              protein: macroTotals.protein,
              carbs: macroTotals.carbs,
              fat: macroTotals.fat,
              foods: foodNames,
              micros: nutritionLogs.filter((l) => l.micros).flatMap((l) => l.micros || []).filter(Boolean),
              proteinGoal: userData.proteinGoal ?? nutritionGoals.proteinTarget ?? 150,
              carbsGoal: userData.carbsGoal ?? nutritionGoals.carbsTarget ?? 250,
              fatGoal: userData.fatGoal ?? nutritionGoals.fatTarget ?? 70,
              caloriesGoal: userData.calorieTarget ?? userData.calorie_target ?? nutritionGoals.calories ?? 2000,
            },
            calendar: clientDocData.calendar || { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
            notesAndFiles,
          });
        } catch (e) {
          console.error('Error updating client data:', e);
        }
      },
      (error) => {
        if (isBenignTrainerClientFirestoreError(error)) {
          (async () => {
            try {
              const tcSnap = await getDoc(doc(db, 'trainer_clients', trainerId, 'clients', client.id));
              const tc = tcSnap.exists() ? tcSnap.data() : {};
              let notesAndFiles = [];
              try {
                notesAndFiles = await getNotesAndFiles(client.id);
              } catch (_) {}
              if (effectCancelled) return;
              setClientData({
                beforeWeight: tc.startingWeight ?? tc.weight ?? client?.startingWeight ?? client?.weight ?? null,
                currentWeight: tc.weight ?? client?.weight ?? null,
                trainingDays: [],
                programName: tc.programName || 'Custom Program',
                nutrition: {
                  calories: 0,
                  protein: 0,
                  carbs: 0,
                  fat: 0,
                  foods: [],
                  micros: [],
                },
                calendar: tc.calendar || { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
                notesAndFiles,
              });
            } catch (e2) {
              if (!isBenignTrainerClientFirestoreError(e2)) {
                console.error('Error building client detail (listener fallback):', e2);
              }
              if (!effectCancelled) setClientData(null);
            }
          })();
          return;
        }
        console.error('User document listener error:', error);
        if (!effectCancelled) setClientData(null);
      }
    );
    
    unsubscribers.push(userUnsub);
    
    // Listen to nutrition changes (nutrition_logs collection)
    const nutritionUnsub = onSnapshot(
      query(collection(db, 'nutrition_logs'), where('user_id', '==', client.id)),
      async () => {
        try {
          const todayKey = clientTodayKey;
          const nutritionLogs = await getFoodLogsForDate(client.id, todayKey);
          const macroTotals = calculateMacroTotals(nutritionLogs);
          
          if (effectCancelled) return;

          setClientData(prev => {
            if (!prev) return prev;
            
            const foodNames = nutritionLogs.map((l) => l.food_name || l.foodName || 'Food').filter(Boolean);
            
            return {
              ...prev,
              nutrition: {
                ...prev.nutrition,
                calories: macroTotals.calories,
                protein: macroTotals.protein,
                carbs: macroTotals.carbs,
                fat: macroTotals.fat,
                foods: foodNames,
                micros: nutritionLogs.filter((l) => l.micros).flatMap((l) => l.micros || []).filter(Boolean),
              }
            };
          });
        } catch (e) {
          if (!isBenignTrainerClientFirestoreError(e)) {
            console.error('Error updating nutrition data:', e);
          }
        }
      }
    );
    
    unsubscribers.push(nutritionUnsub);

    const notesColRef = collection(db, 'users', client.id, 'notes_and_files');
    const notesUnsub = onSnapshot(
      notesColRef,
      async () => {
        try {
          const notesAndFiles = await getNotesAndFiles(client.id);
          if (effectCancelled) return;
          setClientData((prev) => {
            if (prev) return { ...prev, notesAndFiles };
            return {
              beforeWeight: client?.startingWeight ?? client?.weight ?? null,
              currentWeight: client?.weight ?? null,
              trainingDays: [],
              programName: 'Custom Program',
              nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0, foods: [], micros: [] },
              calendar: { completed: [], upcoming: [], missed: [], upcomingSessions: [] },
              notesAndFiles,
            };
          });
        } catch (e) {
          console.error('Error syncing notes and files (detail):', e);
        }
      },
      (err) => console.error('notes_and_files listener error (detail):', err),
    );
    unsubscribers.push(notesUnsub);

    // Listen to trainer CRM client doc (calendar, program name — not notes; those live in notes_and_files)
    const clientDocUnsub = onSnapshot(
      doc(db, 'trainer_clients', trainerId, 'clients', client.id),
      (clientDoc) => {
        if (!clientDoc.exists()) return;
        
        const clientDocData = clientDoc.data();
        
        setClientData(prev => {
          if (!prev) return prev;
          
          return {
            ...prev,
            calendar: clientDocData.calendar || prev.calendar,
            programName: clientDocData.programName || prev.programName,
          };
        });
      }
    );
    
    unsubscribers.push(clientDocUnsub);
    
    return () => {
      effectCancelled = true;
      unsubscribers.forEach(unsub => unsub());
    };
  }, [client?.id, trainerId, clientTodayKey]);

  const openRemoveClientMenu = () => {
    const sheetTitle = 'Remove client?';
    const sheetMessage =
      'They will be unlinked from you in Coach Connect. You can invite them again later if you change your mind.';

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Remove from my roster…'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
          title: sheetTitle,
          message: sheetMessage,
        },
        (idx) => {
          if (idx === 1) setShowRemoveSheet(true);
        }
      );
      return;
    }

    Alert.alert(sheetTitle, sheetMessage, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove from roster', style: 'destructive', onPress: () => setShowRemoveSheet(true) },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: isDark ? '#0c0c0e' : '#f5f5f7' }}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {/* ── Header ── */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? 16 : 0, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }}>
        <TouchableOpacity onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ width: 36, alignItems: 'flex-start' }}>
          <Icon name="ChevronLeft" size={26} color={textColor} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={{ color: textColor, fontSize: 17, fontWeight: '700', textAlign: 'center' }} numberOfLines={1}>
            {client?.name || 'Client'}
          </Text>
          <Text style={{ color: mutedColor, fontSize: 11, marginTop: 2, textAlign: 'center' }} numberOfLines={1}>
            Tap ⋮ for remove options
          </Text>
        </View>
        <TouchableOpacity
          onPress={openRemoveClientMenu}
          accessibilityLabel="Client options: remove from roster"
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ width: 36, alignItems: 'flex-end' }}
        >
          <Ionicons name="ellipsis-vertical" size={22} color={textColor} />
        </TouchableOpacity>
      </View>

      <RemoveTrainerSheet
        visible={showRemoveSheet}
        onClose={() => setShowRemoveSheet(false)}
        onRemovalComplete={() => { setShowRemoveSheet(false); onRemoveClient?.(); }}
        trainerName={trainerName || 'Trainer'}
        clientName={client?.name || 'Client'}
        removedBy="trainer"
        trainerId={trainerId}
        clientId={client?.id}
      />

      <View style={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: scrollBottomPad, gap: 16, paddingHorizontal: 16, paddingTop: 16 }}
        {...FORM_SCROLL_PROPS}
      >

        {/* ── Client Info Card ── */}
        <GlassCard isDark={isDark} style={{ padding: 16, borderRadius: 16, borderColor: CARD_BORDER_PINK_ORANGE }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
              {client?.photoURL ? (
                <Image source={{ uri: client.photoURL }} style={{ width: 48, height: 48 }} />
              ) : (
                <LinearGradient colors={GRADIENT_AVATAR} style={{ width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>{getClientInitials(client?.name)}</Text>
                </LinearGradient>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: textColor, fontWeight: 'bold', fontSize: 17 }}>{client?.name || 'No Name'}</Text>
              <Text style={{ color: mutedColor, fontSize: 12, marginTop: 2 }}>{getClientSubtext(client)}</Text>
              {todayDailyLog && Object.keys(todayDailyLog).some((k) => k.startsWith('dashboard_') && todayDailyLog[k] != null && todayDailyLog[k] !== '') ? (
                <Text style={{ color: mutedColor, fontSize: 11, marginTop: 4 }}>✓ Check-in logged today</Text>
              ) : (
                <Text style={{ color: mutedColor, fontSize: 11, marginTop: 4 }}>No check-in yet today</Text>
              )}
            </View>
          </View>
          <View
            style={{
              marginTop: 14,
              paddingTop: 14,
              borderTopWidth: 1,
              borderTopColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
            }}
          >
            <TouchableOpacity onPress={openRemoveClientMenu} hitSlop={{ top: 6, bottom: 6 }}>
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>Remove from my roster</Text>
              <Text style={{ color: mutedColor, fontSize: 12, marginTop: 4, lineHeight: 16 }}>
                Unlinks this client from you (same as the ⋮ menu). They keep their account and can work with another coach.
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>

        {/* ── Tab Pills ── */}
        <TabPills activeTab={activeTab} onTabChange={setActiveTab} isDark={isDark} />

        {/* ── Tab Content ── */}
        {loadingClientData ? (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <ActivityIndicator color={ICON_ACCENT} />
            <Text style={{ color: mutedColor, fontSize: 13, marginTop: 12 }}>Loading client data...</Text>
          </View>
        ) : (
          <View>
            {activeTab === 'Sessions' && (
              <CalendarTab
                clientId={client?.id}
                clientName={client?.name || 'Client'}
              />
            )}
            {activeTab === 'Notes & Files' && (
              <TrainerNotesFilesHeroAndWorkspace
                isDark={isDark}
                clientName={client?.name || 'Client'}
                clientData={clientData}
                trainerDocuments={trainerDocumentsForClient}
                clientId={client?.id}
                trainerId={trainerId}
                onRefetchNotesAndFiles={() => setRefreshNotesAndFilesTrigger((t) => t + 1)}
                pdfViewer={pdfViewer}
                setPdfViewer={setPdfViewer}
                spreadsheetViewer={spreadsheetViewer}
                setSpreadsheetViewer={setSpreadsheetViewer}
                onRefetchTrainerDocuments={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
                onOpenDocumentEditor={(f) => {
                  if (!f) return;
                  const docId = f?.documentId || f?.id || null;
                  setDocumentEditor({ visible: true, documentId: docId });
                }}
                onOpenShareModal={({ documentId, initialSharedWith }) =>
                  setShareModal({ visible: true, documentId, sharedWith: initialSharedWith || [] })
                }
                onOpenSpreadsheetEditor={(f) => {
                  if (!f) return;
                  const docId = f?.documentId || f?.id || null;
                  setSpreadsheetEditor({ visible: true, documentId: docId, title: f?.title || f?.name || '', rows: null });
                }}
                onImportSpreadsheet={(item) => {
                  if (!item?.url) return;
                  setSpreadsheetViewer({ visible: true, url: item.url, name: item?.name || 'Spreadsheet' });
                }}
              />
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
      </View>

      <PdfViewerModal
        visible={pdfViewer.visible}
        url={pdfViewer.url}
        name={pdfViewer.name}
        isDark={isDark}
        onClose={() => setPdfViewer({ visible: false, url: null, name: null })}
      />
      <SpreadsheetViewerModal
        visible={spreadsheetViewer.visible}
        url={spreadsheetViewer.url}
        name={spreadsheetViewer.name}
        isDark={isDark}
        onClose={() => setSpreadsheetViewer({ visible: false, url: null, name: null })}
      />
      <SpreadsheetEditorModal
        visible={spreadsheetEditor.visible}
        trainerId={trainerId}
        documentId={spreadsheetEditor.documentId}
        isDark={isDark}
        initialTitle={spreadsheetEditor.title}
        initialRows={spreadsheetEditor.rows}
        onClose={() => setSpreadsheetEditor({ visible: false, documentId: null, title: '', rows: null })}
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
      />
      <DocumentEditorModal
        visible={documentEditor.visible}
        trainerId={trainerId}
        documentId={documentEditor.documentId}
        isDark={isDark}
        onClose={() => setDocumentEditor({ visible: false, documentId: null })}
        onSaved={() => getTrainerDocuments(trainerId).then(setTrainerDocuments).catch(() => {})}
        trainerNavChrome={trainerEditorNav}
      />
      <ShareDocumentModal
        visible={shareModal.visible}
        trainerId={trainerId}
        documentId={shareModal.documentId}
        initialSharedWith={shareModal.sharedWith}
        isDark={isDark}
        onClose={() => setShareModal({ visible: false, documentId: null, sharedWith: [] })}
        onSaved={() => { getTrainerDocuments(trainerId).then(setTrainerDocuments); setRefreshNotesAndFilesTrigger((t) => t + 1); }}
      />
    </SafeAreaView>
  );
};


export default ClientDetailScreen;
