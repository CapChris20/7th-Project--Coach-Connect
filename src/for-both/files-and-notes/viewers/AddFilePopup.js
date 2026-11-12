// Design Law “Add files” sheet (files-and-notes PNG 05 / 06) — NbSheet list rows + Cancel.
 // Flow: pick Photo/Video/Doc → picker → upload → close; note step → addNote; trainer create/import below.
 // Used by Notes & Files + button on client and trainer screens.
 //
 // vocab: NbSheet = Design Law bottom sheet; HardShadow = solid offset shadow (no blur)
 // KEEP upload/import handlers + Firebase keys. No LinearGradient option cards. Never green.

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { auth } from '../../../app-start/cloudConnection';
import {
  addFile,
  addNote,
  addSpreadsheetFile,
  uploadTrainerDocumentImport,
  getTrainerImportedData,
} from '../../files-and-notes/saveNotesAndFiles';
import { functions } from '../../../app-start/cloudConnection';
import { httpsCallable } from 'firebase/functions';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import NbSheet from '../../../look-and-feel/NbSheet';
import NbButton from '../../../look-and-feel/NbButton';
import NbIconChip from '../../../look-and-feel/NbIconChip';
import HardShadow from '../../../look-and-feel/HardShadow';
import { accentGradients, borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const STEP_PICKER = 'picker';
const STEP_NOTE = 'note';
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
const OPTION_NOTE = 'note';
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
// Manipulate here: delay after sheet dismiss before ImagePicker / document editor opens (ms)
const ACTION_OPEN_DELAY_MS = 120;

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

const PICTURE_ICON = require('../../../assets/icons/handoff/picture.png');
const MUSCLE_ICON = require('../../../assets/icons/handoff/muscle.png');
const WEEK_ICON = require('../../../assets/icons/handoff/week.png');
const JOURNEY_ICON = require('../../../assets/icons/handoff/journey.png');
const WORKOUT_ICON = require('../../../assets/icons/handoff/workout.png');
const PROGRESS_ICON = require('../../../assets/icons/handoff/progress.png');

// Manipulate here: PNG 05 primary rows — labels/subtitles are Design Law copy
const CLIENT_ROWS = [
  {
    key: OPTION_PHOTO,
    label: 'Photo',
    subtitle: 'Camera or library',
    icon: PICTURE_ICON,
    accentIndex: 0,
  },
  {
    key: OPTION_VIDEO,
    label: 'Video',
    subtitle: 'From your library',
    icon: WORKOUT_ICON,
    accentIndex: 3,
  },
  {
    key: OPTION_DOC,
    label: 'PDF / Doc',
    subtitle: 'PDF or Word, up to 10 MB',
    icon: MUSCLE_ICON,
    accentIndex: 4,
  },
  {
    key: OPTION_NOTE,
    label: 'Add note or file',
    subtitle: 'Write a note for your coach',
    subtitleTrainer: 'Write a note for this client',
    icon: WEEK_ICON,
    accentIndex: 8,
  },
];

// Trainer-only create/import — rendered as HardShadow rows below the primary list
const TRAINER_EXTRA_ROWS = [
  {
    key: OPTION_NEW_DOC,
    label: 'New Document',
    subtitle: 'Blank doc for this client',
    icon: JOURNEY_ICON,
    accentIndex: 2,
  },
  {
    key: OPTION_NEW_SHEET,
    label: 'New Spreadsheet',
    subtitle: 'Blank sheet for this client',
    icon: PROGRESS_ICON,
    accentIndex: 5,
  },
  {
    key: OPTION_IMPORT,
    label: 'Import & Parse',
    subtitle: 'Upload a PDF/Word and extract text',
    icon: MUSCLE_ICON,
    accentIndex: 6,
  },
  {
    key: OPTION_IMPORT_SHEET,
    label: 'Import Sheet',
    subtitle: 'Bring in a spreadsheet file',
    icon: PROGRESS_ICON,
    accentIndex: 7,
  },
];

// Client-only extra under MORE (kept so spreadsheet upload handler stays reachable)
const CLIENT_EXTRA_ROWS = [
  {
    key: OPTION_SPREADSHEET,
    label: 'Spreadsheet file',
    subtitle: 'Upload .xlsx or CSV',
    icon: PROGRESS_ICON,
    accentIndex: 8,
  },
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

async function requestLibraryPermission(message) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission needed', message);
    return false;
  }
  return true;
}

async function requestCameraPermission(message) {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
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

async function pickCameraPhoto() {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: PHOTO_PICKER_QUALITY,
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
  // Also keep a copy in notes_and_files so the client sees the uploaded PDF/doc.
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

function uploadingStatusLabel(importStatus, uploadProgress) {
  if (importStatus === IMPORT_STATUS_PARSING) return 'Parsing document…';
  const percentSuffix = uploadProgress > 0 ? `${uploadProgress}%` : '';
  return `Uploading… ${percentSuffix}`;
}

/**
 * PNG 05 list row: NbIconChip + title/subtitle + chevron.
 * vocab: accentIndex picks which accentGradients ramp fills the chip (small accent only).
 */
function AddFileRow({ label, subtitle, icon, accentIndex, onPress, colors, showDivider, hardShadow }) {
  const rowInner = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.row,
        hardShadow && styles.rowHard,
        hardShadow && {
          backgroundColor: colors.nbSurface,
          borderColor: colors.nbBorder,
        },
        !hardShadow && showDivider && {
          borderBottomWidth: nb.borderWidthDivider,
          borderBottomColor: colors.nbBorder,
        },
      ]}
    >
      <NbIconChip
        source={icon}
        size={44}
        index={accentIndex}
        colors={accentGradients[accentIndex % accentGradients.length]}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: colors.nbInk }]}>{label}</Text>
        <Text style={[styles.rowSub, { color: colors.nbMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} />
    </TouchableOpacity>
  );

  // Trainer extras: each option is its own HardShadow card (PNG law + user brief)
  if (hardShadow) {
    return (
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall} style={styles.extraRowWrap}>
        {rowInner}
      </HardShadow>
    );
  }
  return rowInner;
}

// ===== MAIN FUNCTION =====

/**
 * Design Law Add files sheet (PNG 05/06).
 * @param {object} props
 */
export default function AddFilePopup({
  visible,
  onClose,
  onAdded,
  isDark: _isDarkIgnored,
  clientId: clientIdProp,
  addedBy: addedByProp = ADDED_BY_CLIENT,
  onNewDocument,
  onNewSpreadsheet,
  onImportSpreadsheet,
  onAddNote,
}) {
  const { colors } = useTheme();
  const [step, setStep] = useState(STEP_PICKER);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatus, setImportStatus] = useState('');
  const [extractedText, setExtractedText] = useState('');
  const [importError, setImportError] = useState('');
  const [noteText, setNoteText] = useState('');
  const uid = clientIdProp ?? auth?.currentUser?.uid;
  const addedBy = addedByProp;
  const trainerId = auth?.currentUser?.uid;
  const isTrainer = addedBy === ADDED_BY_TRAINER;

  const handleClose = () => {
    setStep(STEP_PICKER);
    setUploading(false);
    setUploadProgress(0);
    setImportStatus('');
    setExtractedText('');
    setImportError('');
    setNoteText('');
    onClose();
  };

  // Upload a still photo asset (camera or library) as type:photo.
  const uploadPhotoAsset = async (asset) => {
    if (!uid || !asset?.uri) return;
    setUploading(true);
    try {
      const { uri, fileSize } = asset;
      const name = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      await addFile(
        uid,
        {
          localUri: uri,
          filename: name,
          mimeType: 'image/jpeg',
          type: 'photo',
          size: optionalFileSize(fileSize),
        },
        addedBy,
      );
      onAdded?.();
      handleClose();
    } catch (error) {
      console.warn('Add photo error:', error);
      Alert.alert('Upload failed', error?.message || 'Could not add photo.');
    } finally {
      setUploading(false);
    }
  };

  // PNG subtitle “Camera or library” — offer both sources before ImagePicker opens.
  const handlePhoto = () => {
    if (!uid) return;
    Alert.alert('Add photo', 'Choose a source', [
      {
        text: 'Camera',
        onPress: async () => {
          const ok = await requestCameraPermission('Allow camera access to take a photo.');
          if (!ok) return;
          const asset = await pickCameraPhoto();
          if (asset) await uploadPhotoAsset(asset);
        },
      },
      {
        text: 'Library',
        onPress: async () => {
          const ok = await requestLibraryPermission(
            'Allow access to your photo library to add photos.',
          );
          if (!ok) return;
          const asset = await pickLibraryAsset(['images'], { quality: PHOTO_PICKER_QUALITY });
          if (asset) await uploadPhotoAsset(asset);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleVideo = async () => {
    if (!uid) return;
    const hasPermission = await requestLibraryPermission(
      'Allow access to your library to add videos.',
    );
    if (!hasPermission) return;
    const asset = await pickLibraryAsset(['videos']);
    if (!asset) return;
    setUploading(true);
    try {
      const { uri, fileSize } = asset;
      const name = uri.split('/').pop() || `video_${Date.now()}.mp4`;
      await addFile(
        uid,
        {
          localUri: uri,
          filename: name,
          mimeType: 'video/mp4',
          type: 'video',
          size: optionalFileSize(fileSize),
        },
        addedBy,
      );
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
    setUploading(true);
    try {
      await addFile(
        uid,
        {
          localUri: file.uri,
          filename: file.name || 'document',
          mimeType: file.mimeType || DEFAULT_OCTET_STREAM,
          type: notesTypeForDocument(file),
          size: optionalFileSize(file.size),
        },
        addedBy,
      );
      onAdded?.();
      handleClose();
    } catch (error) {
      console.warn('Add doc error:', error);
      Alert.alert('Upload failed', error?.message || 'Could not add file. The file may be corrupted.');
    } finally {
      setUploading(false);
    }
  };

  const handleSpreadsheet = async () => {
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
    setUploading(true);
    setUploadProgress(0);
    try {
      await addSpreadsheetFile(
        uid,
        {
          localUri: file.uri,
          filename: file.name || 'spreadsheet',
          mimeType: file.mimeType || DEFAULT_OCTET_STREAM,
          size: optionalFileSize(file.size),
        },
        addedBy,
        (percent) => setUploadProgress(percent),
      );
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

  const handleImportParse = async () => {
    // Trainers only — client role never sees this row.
    if (!trainerId || addedBy !== ADDED_BY_TRAINER) {
      Alert.alert('Trainers only', 'Import & parse is available on the trainer Notes & Files flow.');
      return;
    }
    let file;
    try {
      file = await pickPdfOrWordDocument();
    } catch (error) {
      console.warn('Document picker error:', error);
      Alert.alert('Picker failed', error?.message || 'Could not open the document picker.');
      return;
    }
    if (!file) return;
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
      if (imported?.status === IMPORT_STATUS_ERROR) {
        setImportStatus(IMPORT_STATUS_ERROR);
        setImportError(imported.error || 'Parsing failed. The file may be corrupted or unsupported.');
        setStep(STEP_IMPORT_RESULT);
        return;
      }
      setImportStatus(IMPORT_STATUS_COMPLETE);
      setExtractedText(imported?.extractedText || '(No text extracted)');
      setStep(STEP_IMPORT_RESULT);
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

  // PNG 07 path: write a note into notes_and_files (type:note). Parent may own a richer composer via onAddNote.
  const handleSaveNote = async () => {
    const content = String(noteText || '').trim();
    if (!content) {
      Alert.alert('Empty note', 'Write something for your coach first.');
      return;
    }
    if (!uid) return;
    setUploading(true);
    try {
      await addNote(uid, content, addedBy);
      onAdded?.();
      handleClose();
    } catch (error) {
      console.warn('Add note error:', error);
      Alert.alert('Could not save note', error?.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const openNoteStep = () => {
    // Prefer parent composer when wired; otherwise stay in-sheet (STEP_NOTE).
    if (typeof onAddNote === 'function') {
      handleClose();
      setTimeout(() => onAddNote(), ACTION_OPEN_DELAY_MS);
      return;
    }
    setStep(STEP_NOTE);
  };

  const handleOptionPress = (key) => {
    if (key === OPTION_PHOTO) return handlePhoto();
    if (key === OPTION_VIDEO) return handleVideo();
    if (key === OPTION_DOC) return handleDoc();
    if (key === OPTION_SPREADSHEET) return handleSpreadsheet();
    if (key === OPTION_IMPORT) return handleImportParse();
    if (key === OPTION_NOTE) return openNoteStep();
    if (key === OPTION_NEW_DOC) {
      handleClose();
      setTimeout(() => onNewDocument?.(), ACTION_OPEN_DELAY_MS);
      return;
    }
    if (key === OPTION_NEW_SHEET) {
      handleClose();
      setTimeout(() => onNewSpreadsheet?.(), ACTION_OPEN_DELAY_MS);
      return;
    }
    if (key === OPTION_IMPORT_SHEET) {
      handleClose();
      setTimeout(() => onImportSpreadsheet?.(), ACTION_OPEN_DELAY_MS);
    }
  };

  const primaryRows = CLIENT_ROWS.map((row) =>
    row.key === OPTION_NOTE && isTrainer
      ? { ...row, subtitle: row.subtitleTrainer || row.subtitle }
      : row,
  );
  const extraRows = isTrainer ? TRAINER_EXTRA_ROWS : CLIENT_EXTRA_ROWS;
  const sheetTitle =
    step === STEP_NOTE ? 'Add note or file' : step === STEP_IMPORT_RESULT ? 'Import' : 'Add files';

  return (
    <NbSheet visible={visible} onClose={handleClose} title={sheetTitle}>
      {uploading ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator size="large" color={colors.nbInk} />
          <Text style={[styles.loadingText, { color: colors.nbMuted }]}>
            {uploadingStatusLabel(importStatus, uploadProgress)}
          </Text>
          {uploadProgress > 0 ? (
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  { width: `${uploadProgress}%`, backgroundColor: colors.nbFill },
                ]}
              />
            </View>
          ) : null}
        </View>
      ) : step === STEP_IMPORT_RESULT ? (
        <View style={{ paddingBottom: spacing.md }}>
          <Text style={[styles.importLabel, { color: colors.nbMuted }]}>
            {importStatus === IMPORT_STATUS_ERROR ? 'Import failed' : 'Imported text'}
          </Text>
          {importStatus === IMPORT_STATUS_ERROR ? (
            <Text style={[styles.importBody, { color: colors.nbInk }]}>{importError}</Text>
          ) : (
            <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
              <View
                style={[
                  styles.importCard,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                <Text style={[styles.importBody, { color: colors.nbInk }]}>{extractedText}</Text>
              </View>
            </HardShadow>
          )}
          <View style={styles.importActions}>
            <NbButton variant="plain" onPress={() => setStep(STEP_PICKER)} style={{ flex: 1 }}>
              Back
            </NbButton>
            <NbButton variant="fill" onPress={handleClose} style={{ flex: 1 }}>
              Done
            </NbButton>
          </View>
        </View>
      ) : step === STEP_NOTE ? (
        // PNG 07 composer lives in-sheet; pass onAddNote for a full-screen NbPageHeader composer.
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ paddingBottom: spacing.md }}
        >
          <Text style={[styles.importLabel, { color: colors.nbMuted }]}>YOUR NOTE</Text>
          <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder={
                isTrainer
                  ? 'Write a note for your client…'
                  : 'Knee felt tight on the second set. Video attached.'
              }
              placeholderTextColor={colors.nbMuted}
              multiline
              textAlignVertical="top"
              style={[
                styles.noteInput,
                {
                  color: colors.nbInk,
                  backgroundColor: colors.nbSurface,
                  borderColor: colors.nbBorder,
                },
              ]}
            />
          </HardShadow>
          <NbButton variant="fill" onPress={handleSaveNote} style={{ marginTop: 16 }}>
            Add to Notes & Files
          </NbButton>
          <NbButton variant="plain" onPress={() => setStep(STEP_PICKER)} style={{ marginTop: 10 }}>
            Back
          </NbButton>
        </KeyboardAvoidingView>
      ) : (
        <View style={{ paddingBottom: spacing.md }}>
          {/* PNG 05: flat list on the sheet — no GradientFrame / option tiles */}
          <View style={styles.list}>
            {primaryRows.map((row, index) => (
              <AddFileRow
                key={row.key}
                label={row.label}
                subtitle={row.subtitle}
                icon={row.icon}
                accentIndex={row.accentIndex}
                onPress={() => handleOptionPress(row.key)}
                colors={colors}
                showDivider={index < primaryRows.length - 1}
              />
            ))}
          </View>

          {extraRows.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>
                {isTrainer ? 'CREATE & IMPORT' : 'MORE'}
              </Text>
              {extraRows.map((row) => (
                <AddFileRow
                  key={row.key}
                  label={row.label}
                  subtitle={row.subtitle}
                  icon={row.icon}
                  accentIndex={row.accentIndex}
                  onPress={() => handleOptionPress(row.key)}
                  colors={colors}
                  hardShadow
                />
              ))}
            </>
          ) : null}

          {/* Cancel = plain NbButton (HardShadow built into NbButton) */}
          <NbButton variant="plain" onPress={handleClose} style={{ marginTop: 16 }}>
            Cancel
          </NbButton>
        </View>
      )}
    </NbSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 4,
    paddingVertical: 14,
    gap: 12,
  },
  rowHard: {
    paddingHorizontal: 14,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    minHeight: nb.minTouchTarget + 12,
  },
  extraRowWrap: {
    marginBottom: 10,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  rowSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginTop: 2,
  },
  sectionLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 11,
    letterSpacing: 1.2,
    marginTop: 18,
    marginBottom: 10,
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
  },
  progressTrack: {
    height: 8,
    width: '80%',
    maxWidth: 220,
    borderRadius: 999,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  importLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  importCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    minHeight: 120,
  },
  importBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  importActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  noteInput: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    padding: 14,
    minHeight: 140,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 22,
  },
});
