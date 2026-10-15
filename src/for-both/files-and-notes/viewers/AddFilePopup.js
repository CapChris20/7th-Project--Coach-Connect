// Bottom-sheet picker for adding a photo, video, PDF, or spreadsheet to Notes & Files.
// Flow: pick a type → library or document picker → upload → close, or show import text.
// Used by the Notes & Files plus button on client and trainer screens.

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { auth } from '../../../app-start/cloudConnection';
import { addFile, addSpreadsheetFile, uploadTrainerDocumentImport, getTrainerImportedData } from '../../files-and-notes/saveNotesAndFiles';
import { functions } from '../../../app-start/cloudConnection';
import { httpsCallable } from 'firebase/functions';

// ===== NAMED CONSTANTS =====

const STEP_PICKER = 'picker';
const STEP_IMPORT_RESULT = 'importResult';
const IMPORT_STATUS_UPLOADING = 'uploading';
const IMPORT_STATUS_PARSING = 'parsing';
const IMPORT_STATUS_COMPLETE = 'complete';
const IMPORT_STATUS_ERROR = 'error';
const ADDED_BY_TRAINER = 'trainer';
const ADDED_BY_CLIENT = 'client';
const OPTION_PHOTO = 'photo';
const OPTION_VIDEO = 'video';
const OPTION_DOC = 'doc';
const OPTION_SPREADSHEET = 'spreadsheet';
const OPTION_NEW_DOC = 'newDoc';
const OPTION_NEW_SHEET = 'newSheet';
const OPTION_IMPORT = 'import';
const OPTION_IMPORT_SHEET = 'importSheet';
const DEFAULT_OCTET_STREAM = 'application/octet-stream';

// Manipulate here: how many times we re-read importedData before giving up.
const IMPORT_POLL_ATTEMPTS = 20;
// Manipulate here: wait between parse-status checks.
const IMPORT_POLL_WAIT_MS = 800;
const PHOTO_PICKER_QUALITY = 0.8;

const PDF_AND_WORD_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '*/*',
];

const SPREADSHEET_PICKER_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  '*/*',
];

const OPTIONS = [
  { key: OPTION_PHOTO, label: 'Photo', icon: 'image-outline', gradient: ['#C2410C', '#FF6B9D'], group: 'add' },
  { key: OPTION_VIDEO, label: 'Video', icon: 'videocam-outline', gradient: ['#C2410C', '#A855F7'], group: 'add' },
  { key: OPTION_DOC, label: 'PDF / Doc', icon: 'document-attach-outline', gradient: ['#CA8A04', '#F97316'], group: 'add' },
  {
    key: OPTION_SPREADSHEET,
    label: 'Spreadsheet',
    icon: 'grid-outline',
    gradient: ['#10B981', '#047857'],
    group: 'add',
    clientOnly: true,
  },
  {
    key: OPTION_NEW_DOC,
    label: 'New Document',
    icon: 'document-text-outline',
    gradient: ['#C2410C', '#A855F7'],
    group: 'create',
    trainerOnly: true,
  },
  {
    key: OPTION_NEW_SHEET,
    label: 'New Spreadsheet',
    icon: 'grid-outline',
    gradient: ['#CA8A04', '#F97316'],
    group: 'create',
    trainerOnly: true,
  },
  {
    key: OPTION_IMPORT,
    label: 'Import & Parse',
    icon: 'cloud-upload-outline',
    gradient: ['#BE185D', '#C2410C'],
    group: 'import',
    trainerOnly: true,
  },
  {
    key: OPTION_IMPORT_SHEET,
    label: 'Import Sheet',
    icon: 'download-outline',
    gradient: ['#C2410C', '#FF6B9D'],
    group: 'import',
    trainerOnly: true,
  },
];

const SECTION_DEFS = [
  { id: 'add', title: 'ADD FILES', keys: [OPTION_PHOTO, OPTION_VIDEO, OPTION_DOC, OPTION_SPREADSHEET] },
  { id: 'create', title: 'CREATE NEW', keys: [OPTION_NEW_DOC, OPTION_NEW_SHEET] },
  { id: 'import', title: 'IMPORT', keys: [OPTION_IMPORT, OPTION_IMPORT_SHEET] },
];

// ===== HELPER FUNCTIONS =====

function isPdfOrWordFile(file) {
  const fileName = String(file.name || '').toLowerCase();
  const mimeType = String(file.mimeType || '');
  if (mimeType.includes('pdf')) return true;
  if (mimeType.includes('msword')) return true;
  if (mimeType.includes('wordprocessingml')) return true;
  if (fileName.endsWith('.pdf')) return true;
  if (fileName.endsWith('.doc')) return true;
  if (fileName.endsWith('.docx')) return true;
  return false;
}

function notesTypeForDocument(file) {
  const fileName = String(file.name || '').toLowerCase();
  const mimeType = String(file.mimeType || '');
  if (mimeType.includes('pdf') || fileName.endsWith('.pdf')) return 'pdf';
  return 'doc';
}

function optionalFileSize(size) {
  return typeof size === 'number' ? size : undefined;
}

function popupColors(isDark) {
  return {
    pageBackground: isDark ? '#0C0C12' : '#F7F7FB',
    cardBackground: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
    cardBorder: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)',
    textColor: isDark ? '#FFFFFF' : '#0A0A0F',
    mutedColor: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.5)',
    sectionLabel: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(10,10,15,0.4)',
    progressTrack: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
  };
}

function optionsVisibleForRole(addedBy) {
  return OPTIONS.filter(
    (option) =>
      (!option.clientOnly || addedBy === ADDED_BY_CLIENT) &&
      (!option.trainerOnly || addedBy === ADDED_BY_TRAINER),
  );
}

function itemsForSection(section, visibleOptions) {
  return section.keys
    .map((key) => visibleOptions.find((option) => option.key === key))
    .filter(Boolean);
}

function sectionsWithVisibleItems(visibleOptions) {
  return SECTION_DEFS
    .map((section) => ({ ...section, items: itemsForSection(section, visibleOptions) }))
    .filter((section) => section.items.length > 0);
}

function runOptionAction(key, actions) {
  const action = actions[key];
  if (!action) return;
  action();
}

async function requestLibraryPermission(message) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', message);
    return false;
  }
  return true;
}

async function pickLibraryAsset(mediaTypes, extraOptions = {}) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: false,
    ...extraOptions,
  });
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return result.assets[0];
}

async function pickPdfOrWordDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: PDF_AND_WORD_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  if (!isPdfOrWordFile(file)) {
    Alert.alert('Unsupported file', 'Please choose a PDF or Word document (.pdf, .doc, .docx).');
    return null;
  }
  return file;
}

function sleepMs(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForImportParse(trainerId, importId) {
  let attempts = 0;
  let imported = null;
  while (attempts < IMPORT_POLL_ATTEMPTS) {
    await sleepMs(IMPORT_POLL_WAIT_MS);
    imported = await getTrainerImportedData(trainerId, importId);
    if (imported?.status === IMPORT_STATUS_COMPLETE || imported?.status === IMPORT_STATUS_ERROR) {
      return imported;
    }
    attempts += 1;
  }
  return imported;
}

async function askServerToParseImport(trainerId, importId, storagePath) {
  if (!functions) return;
  const parseImportedDocument = httpsCallable(functions, 'parseTrainerDocumentImport');
  await parseImportedDocument({ trainerId, importId, storagePath });
}

async function runTrainerImportParse({ trainerId, uid, file, onProgress, onParsingStarted }) {
  if (uid) {
    await addFile(
      uid,
      {
        localUri: file.uri,
        filename: file.name || 'document',
        mimeType: file.mimeType || DEFAULT_OCTET_STREAM,
        type: notesTypeForDocument(file),
        size: optionalFileSize(file.size),
      },
      ADDED_BY_TRAINER,
    );
  }
  const { importId, storagePath } = await uploadTrainerDocumentImport(
    trainerId,
    {
      localUri: file.uri,
      filename: file.name || 'document',
      mimeType: file.mimeType || DEFAULT_OCTET_STREAM,
    },
    onProgress,
  );
  onParsingStarted?.();
  await askServerToParseImport(trainerId, importId, storagePath);
  return waitForImportParse(trainerId, importId);
}

function applyImportResult(imported, setters) {
  if (imported?.status === IMPORT_STATUS_ERROR) {
    setters.setImportStatus(IMPORT_STATUS_ERROR);
    setters.setImportError(imported.error || 'Parsing failed. The file may be corrupted or unsupported.');
    setters.setStep(STEP_IMPORT_RESULT);
    return;
  }
  setters.setImportStatus(IMPORT_STATUS_COMPLETE);
  setters.setExtractedText(imported?.extractedText || '(No text extracted)');
  setters.setStep(STEP_IMPORT_RESULT);
}

function uploadingStatusLabel(importStatus, uploadProgress) {
  if (importStatus === IMPORT_STATUS_PARSING) return 'Parsing document…';
  const percentSuffix = uploadProgress > 0 ? `${uploadProgress}%` : '';
  return `Uploading… ${percentSuffix}`;
}

// ===== MAIN FUNCTION =====

/**
 * Modal triggered by the bottom nav plus button.
 * Add: Photo, Video, PDF/Doc (+ trainer create/import options).
 * @param {object} props
 */
export default function AddFilePopup({
  visible,
  onClose,
  onAdded,
  isDark = true,
  clientId: clientIdProp,
  addedBy: addedByProp = ADDED_BY_CLIENT,
  onNewDocument,
  onNewSpreadsheet,
  onImportSpreadsheet,
}) {
  const [step, setStep] = useState(STEP_PICKER);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [importError, setImportError] = useState('');
  const uid = clientIdProp ?? auth?.currentUser?.uid;
  const addedBy = addedByProp;
  const trainerId = auth?.currentUser?.uid;

  const handleClose = () => {
    setStep(STEP_PICKER);
    setUploading(false);
    setUploadProgress(0);
    setImportStatus('');
    setExtractedText('');
    setImportError('');
    onClose();
  };

  const handlePhoto = async () => {
    // 1. Need a user and photo-library permission.
    if (!uid) return;
    const hasPermission = await requestLibraryPermission('Allow access to your photo library to add photos.');
    if (!hasPermission) return;

    // 2. Pick one image. Cancel is a no-op.
    const asset = await pickLibraryAsset(['images'], { quality: PHOTO_PICKER_QUALITY });
    if (!asset) return;

    // 3. Upload as a photo row, then close.
    setUploading(true);
    try {
      const { uri, fileSize } = asset;
      const name = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      await addFile(uid, { localUri: uri, filename: name, mimeType: 'image/jpeg', type: 'photo', size: optionalFileSize(fileSize) }, addedBy);
      onAdded?.();
      handleClose();
    } catch (error) {
      console.warn('Add photo error:', error);
      Alert.alert('Upload failed', error?.message || 'Could not add photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleVideo = async () => {
    // 1. Need a user and library permission.
    if (!uid) return;
    const hasPermission = await requestLibraryPermission('Allow access to your library to add videos.');
    if (!hasPermission) return;

    // 2. Pick one video. Cancel is a no-op.
    const asset = await pickLibraryAsset(['videos']);
    if (!asset) return;

    // 3. Upload as a video row, then close.
    setUploading(true);
    try {
      const { uri, fileSize } = asset;
      const name = uri.split('/').pop() || `video_${Date.now()}.mp4`;
      await addFile(uid, { localUri: uri, filename: name, mimeType: 'video/mp4', type: 'video', size: optionalFileSize(fileSize) }, addedBy);
      onAdded?.();
      handleClose();
    } catch (error) {
      console.warn('Add video error:', error);
      Alert.alert('Upload failed', error?.message || 'Could not add video.');
    } finally {
      setUploading(false);
    }
  };

  const handleDoc = async () => {
    // 1. Need a user, then a PDF or Word file.
    if (!uid) return;
    let file;
    try {
      file = await pickPdfOrWordDocument();
    } catch (error) {
      console.warn('Document picker error:', error);
      Alert.alert('Picker failed', error?.message || 'Could not open the document picker.');
      return;
    }
    if (!file) return;

    // 2. Upload the document, then close.
    setUploading(true);
    try {
      await addFile(uid, {
        localUri: file.uri,
        filename: file.name || 'document',
        mimeType: file.mimeType || DEFAULT_OCTET_STREAM,
        type: notesTypeForDocument(file),
        size: optionalFileSize(file.size),
      }, addedBy);
      onAdded?.();
      handleClose();
    } catch (error) {
      console.warn('Add doc error:', error);
      Alert.alert('Upload failed', error?.message || 'Could not add file. The file may be corrupted.');
    } finally {
      setUploading(false);
    }
  };

  const handleImportParse = async () => {
    // 1. Trainers only.
    if (!trainerId || addedBy !== ADDED_BY_TRAINER) {
      Alert.alert('Trainers only', 'Import & parse is available on the trainer Notes & Files flow.');
      return;
    }

    // 2. Pick a PDF or Word file.
    let file;
    try {
      file = await pickPdfOrWordDocument();
    } catch (error) {
      console.warn('Document picker error:', error);
      Alert.alert('Picker failed', error?.message || 'Could not open the document picker.');
      return;
    }
    if (!file) return;

    // 3. Keep a copy in Notes & Files, upload for parse, and wait.
    setUploading(true);
    setImportStatus(IMPORT_STATUS_UPLOADING);
    setImportError('');
    setExtractedText('');
    try {
      const imported = await runTrainerImportParse({
        trainerId,
        uid,
        file,
        onProgress: (percent) => setUploadProgress(percent),
        onParsingStarted: () => setImportStatus(IMPORT_STATUS_PARSING),
      });
      applyImportResult(imported, { setImportStatus, setImportError, setExtractedText, setStep });
      onAdded?.();
    } catch (error) {
      console.warn('Import parse error:', error);
      setImportStatus(IMPORT_STATUS_ERROR);
      setImportError(error?.message || 'Import failed. Check the file type and try again.');
      setStep(STEP_IMPORT_RESULT);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSpreadsheet = async () => {
    // 1. Need a user, then a sheet or CSV.
    if (!uid) return;
    let file;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: SPREADSHEET_PICKER_TYPES,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      file = result.assets[0];
    } catch (error) {
      console.warn('Document picker error:', error);
      return;
    }

    // 2. Upload with a progress bar, then close.
    setUploading(true);
    setUploadProgress(0);
    try {
      await addSpreadsheetFile(uid, {
        localUri: file.uri,
        filename: file.name || 'spreadsheet',
        mimeType: file.mimeType || DEFAULT_OCTET_STREAM,
        size: optionalFileSize(file.size),
      }, addedBy, (percent) => setUploadProgress(percent));
      onAdded?.();
      handleClose();
    } catch (error) {
      console.warn('Add spreadsheet error:', error);
      Alert.alert('Upload failed', error?.message || 'Could not add spreadsheet.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const colors = popupColors(isDark);
  const visibleOptions = optionsVisibleForRole(addedBy);
  const sections = sectionsWithVisibleItems(visibleOptions);

  const handleOptionPress = (key) => {
    // 1. Each tile key maps to one action. Unknown keys are a no-op.
    runOptionAction(key, {
      [OPTION_PHOTO]: handlePhoto,
      [OPTION_VIDEO]: handleVideo,
      [OPTION_DOC]: handleDoc,
      [OPTION_IMPORT]: handleImportParse,
      [OPTION_SPREADSHEET]: handleSpreadsheet,
      [OPTION_NEW_DOC]: () => {
        onNewDocument?.();
        handleClose();
      },
      [OPTION_NEW_SHEET]: () => {
        onNewSpreadsheet?.();
        handleClose();
      },
      [OPTION_IMPORT_SHEET]: () => {
        onImportSpreadsheet?.();
        handleClose();
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={[styles.outer, { backgroundColor: colors.pageBackground }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={80}
            style={styles.inner}
          >
            <View style={styles.header}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.title, { color: colors.textColor }]}>Add to Notes & Files</Text>
                <Text style={[styles.subtitle, { color: colors.mutedColor }]}>
                  Upload media or create a file for Notes & Files
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={12}
                style={[styles.closeBtn, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
              >
                <Ionicons name="close" size={20} color={colors.mutedColor} />
              </TouchableOpacity>
            </View>

            {uploading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator size="large" color="#BE185D" />
                <Text style={[styles.loadingText, { color: colors.mutedColor }]}>
                  {uploadingStatusLabel(importStatus, uploadProgress)}
                </Text>
                {uploadProgress > 0 && (
                  <View style={[styles.progressBarBg, { backgroundColor: colors.progressTrack }]}>
                    <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                  </View>
                )}
              </View>
            ) : step === STEP_IMPORT_RESULT ? (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.noteScroll}>
                <Text style={[styles.noteLabel, { color: colors.mutedColor }]}>
                  {importStatus === IMPORT_STATUS_ERROR ? 'Import failed' : 'Imported text'}
                </Text>
                {importStatus === IMPORT_STATUS_ERROR ? (
                  <Text style={{ color: '#F87171', marginBottom: 16, lineHeight: 20 }}>{importError}</Text>
                ) : (
                  <Text style={[styles.noteInput, { color: colors.textColor, borderColor: colors.cardBorder, minHeight: 180 }]}>
                    {extractedText}
                  </Text>
                )}
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => setStep(STEP_PICKER)}>
                    <Text style={{ color: colors.mutedColor, fontSize: 15 }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleClose}>
                    <LinearGradient colors={['#BE185D', '#C2410C']} style={styles.saveNoteBtn}>
                      <Text style={styles.saveNoteBtnText}>Done</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.pickerScroll}
              >
                {sections.map((section) => (
                  <View key={section.id} style={styles.sectionBlock}>
                    <Text style={[styles.sectionTitle, { color: colors.sectionLabel }]}>{section.title}</Text>
                    <View style={styles.optionsGrid}>
                      {section.items.map((option, index) => {
                        const isOrphan = section.items.length % 2 === 1 && index === section.items.length - 1;
                        return (
                          <TouchableOpacity
                            key={option.key}
                            style={[
                              styles.optionCard,
                              { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder },
                              isOrphan && styles.optionCardFull,
                            ]}
                            onPress={() => handleOptionPress(option.key)}
                            activeOpacity={0.85}
                          >
                            <LinearGradient
                              colors={option.gradient}
                              style={[styles.optionIconWrap, isOrphan && styles.optionIconWrapRow]}
                            >
                              <Ionicons name={option.icon} size={24} color="#fff" />
                            </LinearGradient>
                            <Text
                              style={[
                                styles.optionLabel,
                                { color: colors.textColor },
                                isOrphan && styles.optionLabelRow,
                              ]}
                              numberOfLines={2}
                            >
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </KeyboardAvoidingView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  outer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: 28,
    maxHeight: '78%',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 10,
    marginBottom: 4,
  },
  inner: { paddingHorizontal: 18, paddingTop: 10, flexGrow: 0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  loadingBlock: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 15 },
  pickerScroll: { paddingBottom: 12 },
  sectionBlock: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
    marginLeft: 2,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  optionCard: {
    width: '48.5%',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  optionCardFull: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 14,
    paddingHorizontal: 16,
  },
  optionIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionIconWrapRow: {
    marginBottom: 0,
  },
  optionLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 17,
  },
  optionLabelRow: {
    textAlign: 'left',
    flex: 1,
    fontSize: 15,
  },
  noteScroll: { flexGrow: 0 },
  noteLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  noteInput: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  saveNoteBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  saveNoteBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  progressBarBg: {
    height: 6,
    width: '80%',
    maxWidth: 200,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#10B981',
    borderRadius: 3,
  },
});
