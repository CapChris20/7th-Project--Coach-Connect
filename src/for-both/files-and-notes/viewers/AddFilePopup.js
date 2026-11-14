// Design Law “Add files” sheet (files-and-notes PNG 05/06) + PNG 07 attach composer.
// Flow: pick Photo/Video/Doc → upload; note step → optional attachments → addNote + files.
// Used by Notes & Files + button on client and trainer screens.
// Read order: constants → UI pieces → AddFilePopup → styles → PLUMBING pickers at bottom.
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
import NbNoticeSheet from '../../../look-and-feel/NbNoticeSheet';
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
const OPTION_IMPORT = 'import';
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
// In-app SpreadsheetEditor is retired — trainers upload .xlsx/CSV or use Google Sheets.
const TRAINER_EXTRA_ROWS = [
  {
    key: OPTION_NEW_DOC,
    label: 'New Document',
    subtitle: 'Blank doc for this client',
    icon: JOURNEY_ICON,
    accentIndex: 2,
  },
  {
    key: OPTION_IMPORT,
    label: 'Import & Parse',
    subtitle: 'Upload a PDF/Word and extract text',
    icon: MUSCLE_ICON,
    accentIndex: 6,
  },
  {
    key: OPTION_SPREADSHEET,
    label: 'Spreadsheet file',
    subtitle: 'Upload .xlsx or CSV (view only)',
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

// ===== HELPER FUNCTIONS (story-side) =====

function sheetTitleForStep(step) {
  if (step === STEP_NOTE) {
    return 'Add note or file';
  }
  if (step === STEP_IMPORT_RESULT) {
    return 'Import';
  }
  return 'Add files';
}

function attachmentIconForKind(kind) {
  if (kind === 'video') {
    return WORKOUT_ICON;
  }
  if (kind === 'doc') {
    return MUSCLE_ICON;
  }
  return PICTURE_ICON;
}

function attachmentAccentIndexForKind(kind) {
  if (kind === 'video') {
    return 3;
  }
  return 0;
}

function attachmentFallbackLabel(kind) {
  if (kind === 'video') {
    return 'Video';
  }
  return 'Attachment';
}

function primaryRowsForAudience(isTrainer) {
  const rows = [];
  let index = 0;
  while (index < CLIENT_ROWS.length) {
    const row = CLIENT_ROWS[index];
    if (row.key === OPTION_NOTE && isTrainer) {
      rows.push({ ...row, subtitle: row.subtitleTrainer || row.subtitle });
    } else {
      rows.push(row);
    }
    index += 1;
  }
  return rows;
}

function extraRowsForAudience(isTrainer) {
  if (isTrainer) {
    return TRAINER_EXTRA_ROWS;
  }
  return CLIENT_EXTRA_ROWS;
}

function extraSectionLabel(isTrainer) {
  if (isTrainer) {
    return 'CREATE & IMPORT';
  }
  return 'MORE';
}

function notePlaceholderForAudience(isTrainer) {
  if (isTrainer) {
    return 'Write a note for your client…';
  }
  return 'Knee felt tight on the second set. Video attached.';
}

function keyboardAvoidBehavior() {
  if (Platform.OS === 'ios') {
    return 'padding';
  }
  return undefined;
}

// ===== IN-FILE UI PIECES (no hooks) =====

function AddFileUploadingBlock({ colors, importStatus, uploadProgress }) {
  const statusLabel = uploadingStatusLabel(importStatus, uploadProgress);
  const showProgressBar = uploadProgress > 0;

  return (
    <View style={styles.loadingBlock}>
      <ActivityIndicator size="large" color={colors.nbInk} />
      <Text style={[styles.loadingText, { color: colors.nbMuted }]}>{statusLabel}</Text>
      {showProgressBar ? (
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
  );
}

/**
 * PNG 05 list row: NbIconChip + title/subtitle + chevron.
 * vocab: accentIndex picks which accentGradients ramp fills the chip (small accent only).
 */
function AddFileRow({ label, subtitle, icon, accentIndex, onPress, colors, showDivider, hardShadow }) {
  const chipColors = accentGradients[accentIndex % accentGradients.length];
  const rowStyle = [
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
  ];

  const rowInner = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={rowStyle}
    >
      <NbIconChip
        source={icon}
        size={44}
        index={accentIndex}
        colors={chipColors}
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

  // Trainer extras: each option is its own HardShadow card (PNG law)
  if (hardShadow) {
    return (
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetSmall} style={styles.extraRowWrap}>
        {rowInner}
      </HardShadow>
    );
  }
  return rowInner;
}

function ImportResultStep({
  colors,
  importStatus,
  importError,
  extractedText,
  onBack,
  onDone,
}) {
  const importFailed = importStatus === IMPORT_STATUS_ERROR;
  const headingLabel = importFailed ? 'Import failed' : 'Imported text';

  return (
    <View style={{ paddingBottom: spacing.md }}>
      <Text style={[styles.importLabel, { color: colors.nbMuted }]}>{headingLabel}</Text>
      {importFailed ? (
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
        <NbButton variant="plain" onPress={onBack} style={{ flex: 1 }}>
          Back
        </NbButton>
        <NbButton variant="fill" onPress={onDone} style={{ flex: 1 }}>
          Done
        </NbButton>
      </View>
    </View>
  );
}

function PendingAttachmentRow({
  file,
  colors,
  showDivider,
  onRemove,
}) {
  const iconSource = attachmentIconForKind(file.kind);
  const accentIndex = attachmentAccentIndexForKind(file.kind);
  const sizeLabel = formatBytes(file.size) || attachmentFallbackLabel(file.kind);

  return (
    <View
      style={[
        styles.attachRow,
        showDivider && {
          borderBottomWidth: nb.borderWidthDivider,
          borderBottomColor: colors.nbBorder,
        },
      ]}
    >
      <NbIconChip source={iconSource} size={44} index={accentIndex} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.rowLabel, { color: colors.nbInk }]} numberOfLines={1}>
          {file.name}
        </Text>
        <Text style={[styles.rowSub, { color: colors.nbMuted }]} numberOfLines={1}>
          {sizeLabel}
        </Text>
      </View>
      <HardShadow offset={nb.shadowOffsetSmall} radius={10}>
        <TouchableOpacity
          onPress={onRemove}
          style={[
            styles.removeAttach,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
          accessibilityLabel={`Remove ${file.name}`}
        >
          <Ionicons name="close" size={18} color={colors.nbInk} />
        </TouchableOpacity>
      </HardShadow>
    </View>
  );
}

function NoteComposerStep({
  colors,
  isTrainer,
  noteText,
  onChangeNoteText,
  pendingAttachments,
  onRemoveAttachment,
  onAddAnotherFile,
  onSaveNote,
  onBack,
}) {
  const placeholder = notePlaceholderForAudience(isTrainer);
  const hasAttachments = pendingAttachments.length > 0;
  const avoidBehavior = keyboardAvoidBehavior();

  return (
    <KeyboardAvoidingView
      behavior={avoidBehavior}
      style={{ paddingBottom: spacing.md }}
    >
      <Text style={[styles.importLabel, { color: colors.nbMuted }]}>YOUR NOTE</Text>
      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
        <TextInput
          value={noteText}
          onChangeText={onChangeNoteText}
          placeholder={placeholder}
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

      {hasAttachments ? (
        <HardShadow
          radius={borderRadius.nbCard}
          offset={nb.shadowOffsetCard}
          style={{ marginTop: 14 }}
        >
          <View
            style={[
              styles.attachList,
              { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
            ]}
          >
            {pendingAttachments.map((file, index) => (
              <PendingAttachmentRow
                key={file.id}
                file={file}
                colors={colors}
                showDivider={index < pendingAttachments.length - 1}
                onRemove={() => onRemoveAttachment(file.id)}
              />
            ))}
          </View>
        </HardShadow>
      ) : null}

      <HardShadow offset={nb.shadowOffsetSmall} radius={borderRadius.nbCard} style={{ marginTop: 14 }}>
        <TouchableOpacity
          onPress={onAddAnotherFile}
          style={[
            styles.addAnother,
            { borderColor: colors.nbBorder, backgroundColor: colors.nbSurface },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add another file"
        >
          <Ionicons name="add" size={20} color={colors.nbInk} />
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.nbInk }}>
            Add another file
          </Text>
        </TouchableOpacity>
      </HardShadow>

      <NbButton variant="fill" onPress={onSaveNote} style={{ marginTop: 16 }}>
        Add to Notes & Files
      </NbButton>
      <NbButton variant="plain" onPress={onBack} style={{ marginTop: 10 }}>
        Back
      </NbButton>
    </KeyboardAvoidingView>
  );
}

function PickerListStep({
  colors,
  primaryRows,
  extraRows,
  extraLabel,
  onOptionPress,
  onCancel,
}) {
  return (
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
            onPress={() => onOptionPress(row.key)}
            colors={colors}
            showDivider={index < primaryRows.length - 1}
          />
        ))}
      </View>

      {extraRows.length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{extraLabel}</Text>
          {extraRows.map((row) => (
            <AddFileRow
              key={row.key}
              label={row.label}
              subtitle={row.subtitle}
              icon={row.icon}
              accentIndex={row.accentIndex}
              onPress={() => onOptionPress(row.key)}
              colors={colors}
              hardShadow
            />
          ))}
        </>
      ) : null}

      <NbButton variant="plain" onPress={onCancel} style={{ marginTop: 16 }}>
        Cancel
      </NbButton>
    </View>
  );
}

function AddFileSheetBody({
  uploading,
  step,
  colors,
  importStatus,
  uploadProgress,
  importError,
  extractedText,
  isTrainer,
  noteText,
  pendingAttachments,
  primaryRows,
  extraRows,
  extraLabel,
  onBackToPicker,
  onClose,
  onChangeNoteText,
  onRemoveAttachment,
  onAddAnotherFile,
  onSaveNote,
  onOptionPress,
}) {
  if (uploading) {
    return (
      <AddFileUploadingBlock
        colors={colors}
        importStatus={importStatus}
        uploadProgress={uploadProgress}
      />
    );
  }

  if (step === STEP_IMPORT_RESULT) {
    return (
      <ImportResultStep
        colors={colors}
        importStatus={importStatus}
        importError={importError}
        extractedText={extractedText}
        onBack={onBackToPicker}
        onDone={onClose}
      />
    );
  }

  if (step === STEP_NOTE) {
    return (
      <NoteComposerStep
        colors={colors}
        isTrainer={isTrainer}
        noteText={noteText}
        onChangeNoteText={onChangeNoteText}
        pendingAttachments={pendingAttachments}
        onRemoveAttachment={onRemoveAttachment}
        onAddAnotherFile={onAddAnotherFile}
        onSaveNote={onSaveNote}
        onBack={onBackToPicker}
      />
    );
  }

  return (
    <PickerListStep
      colors={colors}
      primaryRows={primaryRows}
      extraRows={extraRows}
      extraLabel={extraLabel}
      onOptionPress={onOptionPress}
      onCancel={onClose}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Design Law Add files sheet (PNG 05/06).
 * Hook order frozen.
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
  // PNG 07 composer: files staged with the note before upload
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [notice, setNotice] = useState(null);
  const [photoSourceOpen, setPhotoSourceOpen] = useState(false);
  const [photoForComposer, setPhotoForComposer] = useState(false);
  const [attachMoreOpen, setAttachMoreOpen] = useState(false);

  const uid = uidFromPropOrAuth(clientIdProp);
  const addedBy = addedByProp;
  const trainerId = signedInUidFromAuth();
  const isTrainer = addedBy === ADDED_BY_TRAINER;

  const showNotice = (title, message) => setNotice({ title, message });

  const resetSheetState = () => {
    setStep(STEP_PICKER);
    setUploading(false);
    setUploadProgress(0);
    setImportStatus('');
    setExtractedText('');
    setImportError('');
    setNoteText('');
    setPendingAttachments([]);
    setPhotoSourceOpen(false);
    setPhotoForComposer(false);
    setAttachMoreOpen(false);
  };

  const handleClose = () => {
    resetSheetState();
    onClose();
  };

  // Upload a still photo asset (camera or library) as type:photo.
  const uploadPhotoAsset = async (asset) => {
    if (!uid || !(asset && asset.uri)) return;
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
      callIfPresent(onAdded);
      handleClose();
    } catch (error) {
      console.warn('Add photo error:', error);
      showNotice('Upload failed', errorMessageOrFallback(error, 'Could not add photo.'));
    } finally {
      setUploading(false);
    }
  };

  const stageOrUploadPhoto = async (asset) => {
    const shouldStageOnNote = photoForComposer || step === STEP_NOTE;
    if (shouldStageOnNote) {
      const meta = pendingAttachmentMeta(asset, 'photo');
      if (meta) {
        setPendingAttachments(function appendPhoto(previousAttachments) {
          return previousAttachments.concat([meta]);
        });
      }
      setPhotoForComposer(false);
      return;
    }
    await uploadPhotoAsset(asset);
  };

  const pickPhotoFromCamera = async () => {
    setPhotoSourceOpen(false);
    const ok = await requestCameraPermission();
    if (!ok) {
      showNotice('Permission needed', 'Allow camera access to take a photo.');
      return;
    }
    const asset = await pickCameraPhoto();
    if (asset) await stageOrUploadPhoto(asset);
  };

  const pickPhotoFromLibrary = async () => {
    setPhotoSourceOpen(false);
    const ok = await requestLibraryPermission();
    if (!ok) {
      showNotice('Permission needed', 'Allow access to your photo library to add photos.');
      return;
    }
    const asset = await pickLibraryAsset(['images'], { quality: PHOTO_PICKER_QUALITY });
    if (asset) await stageOrUploadPhoto(asset);
  };

  // PNG subtitle “Camera or library” — NbNoticeSheet with Camera / Library (not Alert.alert).
  const handlePhoto = () => {
    if (!uid) return;
    setPhotoForComposer(false);
    setPhotoSourceOpen(true);
  };

  const handleVideo = async (forComposer = false) => {
    if (!uid) return;
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) {
      showNotice('Permission needed', 'Allow access to your library to add videos.');
      return;
    }
    const asset = await pickLibraryAsset(['videos']);
    if (!asset) return;

    const shouldStageOnNote = forComposer || step === STEP_NOTE;
    if (shouldStageOnNote) {
      const meta = pendingAttachmentMeta(asset, 'video');
      if (meta) {
        setPendingAttachments(function appendVideo(previousAttachments) {
          return previousAttachments.concat([meta]);
        });
      }
      return;
    }

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
      callIfPresent(onAdded);
      handleClose();
    } catch (error) {
      console.warn('Add video error:', error);
      showNotice('Upload failed', errorMessageOrFallback(error, 'Could not add video.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDoc = async (forComposer = false) => {
    if (!uid) return;
    let file;
    try {
      file = await pickPdfOrWordDocument();
    } catch (error) {
      console.warn('Document picker error:', error);
      showNotice('Picker failed', errorMessageOrFallback(error, 'Could not open the document picker.'));
      return;
    }
    if (!file) return;
    if (file.unsupported) {
      showNotice('Unsupported file', 'Please choose a PDF or Word document (.pdf, .doc, .docx).');
      return;
    }

    const shouldStageOnNote = forComposer || step === STEP_NOTE;
    if (shouldStageOnNote) {
      const meta = pendingAttachmentMeta(file, 'doc');
      if (meta) {
        setPendingAttachments(function appendDoc(previousAttachments) {
          return previousAttachments.concat([meta]);
        });
      }
      return;
    }

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
      callIfPresent(onAdded);
      handleClose();
    } catch (error) {
      console.warn('Add doc error:', error);
      showNotice('Upload failed', errorMessageOrFallback(error, 'Could not add file. The file may be corrupted.'));
    } finally {
      setUploading(false);
    }
  };

  // PNG 07 “Add another file” — stage photo/video/doc onto the note composer.
  const handleAddAnotherFile = () => setAttachMoreOpen(true);

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
      callIfPresent(onAdded);
      handleClose();
    } catch (error) {
      console.warn('Add spreadsheet error:', error);
      showNotice('Upload failed', errorMessageOrFallback(error, 'Could not add spreadsheet.'));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleImportParse = async () => {
    // 1. Trainers only — client role never sees this row.
    if (!trainerId || addedBy !== ADDED_BY_TRAINER) {
      showNotice('Trainers only', 'Import & parse is available on the trainer Notes & Files flow.');
      return;
    }
    let file;
    try {
      file = await pickPdfOrWordDocument();
    } catch (error) {
      console.warn('Document picker error:', error);
      showNotice('Picker failed', errorMessageOrFallback(error, 'Could not open the document picker.'));
      return;
    }
    if (!file) return;
    if (file.unsupported) {
      showNotice('Unsupported file', 'Please choose a PDF or Word document (.pdf, .doc, .docx).');
      return;
    }
    setUploading(true);
    setImportStatus(IMPORT_STATUS_UPLOADING);
    setImportError('');
    setExtractedText('');
    // 2. Upload to trainers/imports, call parse cloud fn, poll importedData.
    try {
      const imported = await runTrainerImportParse({
        trainerId,
        uid,
        file,
        onProgress: (percent) => setUploadProgress(percent),
        onParsingStarted: () => setImportStatus(IMPORT_STATUS_PARSING),
      });
      const importedStatus = imported && imported.status;
      if (importedStatus === IMPORT_STATUS_ERROR) {
        setImportStatus(IMPORT_STATUS_ERROR);
        const parseErrorText = (imported && imported.error) || 'Parsing failed. The file may be corrupted or unsupported.';
        setImportError(parseErrorText);
        setStep(STEP_IMPORT_RESULT);
        return;
      }
      setImportStatus(IMPORT_STATUS_COMPLETE);
      const extracted = (imported && imported.extractedText) || '(No text extracted)';
      setExtractedText(extracted);
      setStep(STEP_IMPORT_RESULT);
      callIfPresent(onAdded);
    } catch (error) {
      console.warn('Import parse error:', error);
      setImportStatus(IMPORT_STATUS_ERROR);
      setImportError(errorMessageOrFallback(error, 'Import failed. Check the file type and try again.'));
      setStep(STEP_IMPORT_RESULT);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // PNG 07 path: write note + upload any staged attachments into notes_and_files.
  const handleSaveNote = async () => {
    // 1. Need text or at least one staged attachment.
    const content = String(noteText || '').trim();
    if (!content && pendingAttachments.length === 0) {
      showNotice('Empty note', 'Write something or attach a file first.');
      return;
    }
    if (!uid) return;
    // 2. Upload staged files, then the note row, then close.
    setUploading(true);
    try {
      for (const file of pendingAttachments) {
        await addFile(
          uid,
          {
            localUri: file.uri,
            filename: file.name,
            mimeType: file.mimeType || DEFAULT_OCTET_STREAM,
            type: file.type || file.kind,
            size: file.size,
          },
          addedBy,
        );
      }
      if (content) {
        await addNote(uid, content, addedBy);
      }
      callIfPresent(onAdded);
      handleClose();
    } catch (error) {
      console.warn('Add note error:', error);
      showNotice('Could not save note', errorMessageOrFallback(error, 'Please try again.'));
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
      setTimeout(() => callIfPresent(onNewDocument), ACTION_OPEN_DELAY_MS);
    }
  };

  const removePendingAttachment = (attachmentId) => {
    setPendingAttachments(function dropAttachment(previousAttachments) {
      const kept = [];
      let index = 0;
      while (index < previousAttachments.length) {
        const item = previousAttachments[index];
        if (item.id !== attachmentId) {
          kept.push(item);
        }
        index += 1;
      }
      return kept;
    });
  };

  const primaryRows = primaryRowsForAudience(isTrainer);
  const extraRows = extraRowsForAudience(isTrainer);
  const extraLabel = extraSectionLabel(isTrainer);
  const sheetTitle = sheetTitleForStep(step);

  const closePhotoSourceSheet = () => {
    setPhotoSourceOpen(false);
    setPhotoForComposer(false);
  };

  const openPhotoForComposer = () => {
    setAttachMoreOpen(false);
    setPhotoForComposer(true);
    setPhotoSourceOpen(true);
  };

  const openVideoForComposer = () => {
    setAttachMoreOpen(false);
    handleVideo(true);
  };

  const openDocForComposer = () => {
    setAttachMoreOpen(false);
    handleDoc(true);
  };

  // 3. Paint main sheet + notice + photo-source + “add another” sheets.
  return (
    <>
      <NbSheet visible={visible} onClose={handleClose} title={sheetTitle}>
        <AddFileSheetBody
          uploading={uploading}
          step={step}
          colors={colors}
          importStatus={importStatus}
          uploadProgress={uploadProgress}
          importError={importError}
          extractedText={extractedText}
          isTrainer={isTrainer}
          noteText={noteText}
          pendingAttachments={pendingAttachments}
          primaryRows={primaryRows}
          extraRows={extraRows}
          extraLabel={extraLabel}
          onBackToPicker={() => setStep(STEP_PICKER)}
          onClose={handleClose}
          onChangeNoteText={setNoteText}
          onRemoveAttachment={removePendingAttachment}
          onAddAnotherFile={handleAddAnotherFile}
          onSaveNote={handleSaveNote}
          onOptionPress={handleOptionPress}
        />
      </NbSheet>

      <NbNoticeSheet
        visible={!!notice}
        onClose={() => setNotice(null)}
        title={noticeTitle(notice)}
        message={noticeMessage(notice)}
        confirmLabel="OK"
      />

      {/* Camera vs library — Design Law sheet instead of Alert.alert action sheet */}
      <NbSheet
        visible={photoSourceOpen}
        onClose={closePhotoSourceSheet}
        title="Add photo"
      >
        <View style={{ gap: 10, paddingBottom: spacing.md }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.nbMuted, marginBottom: 4 }}>
            Choose a source
          </Text>
          <NbButton variant="fill" onPress={pickPhotoFromCamera}>
            Camera
          </NbButton>
          <NbButton variant="ghost" onPress={pickPhotoFromLibrary}>
            Library
          </NbButton>
          <NbButton variant="ghost" onPress={closePhotoSourceSheet}>
            Cancel
          </NbButton>
        </View>
      </NbSheet>

      <NbSheet visible={attachMoreOpen} onClose={() => setAttachMoreOpen(false)} title="Add another file">
        <View style={{ gap: 10, paddingBottom: spacing.md }}>
          <NbButton variant="fill" onPress={openPhotoForComposer}>
            Photo
          </NbButton>
          <NbButton variant="ghost" onPress={openVideoForComposer}>
            Video
          </NbButton>
          <NbButton variant="ghost" onPress={openDocForComposer}>
            PDF / Doc
          </NbButton>
          <NbButton variant="ghost" onPress={() => setAttachMoreOpen(false)}>
            Cancel
          </NbButton>
        </View>
      </NbSheet>
    </>
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
  attachList: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    overflow: 'hidden',
  },
  attachRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 64,
  },
  removeAttach: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addAnother: {
    minHeight: 50,
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});


function signedInUidFromAuth() {
  if (!auth) return undefined;
  if (!auth.currentUser) return undefined;
  return auth.currentUser.uid;
}

function uidFromPropOrAuth(clientIdProp) {
  if (clientIdProp !== null && clientIdProp !== undefined) {
    return clientIdProp;
  }
  return signedInUidFromAuth();
}

function callIfPresent(maybeFn) {
  if (typeof maybeFn === 'function') {
    maybeFn();
  }
}

function errorMessageOrFallback(error, fallbackMessage) {
  if (error && error.message) {
    return error.message;
  }
  return fallbackMessage;
}

function firstPickerAsset(result) {
  if (!result || result.canceled) return null;
  if (!result.assets || !result.assets.length) return null;
  const asset = result.assets[0];
  if (!asset || !asset.uri) return null;
  return asset;
}

function noticeTitle(notice) {
  if (notice && notice.title) return notice.title;
  return '';
}

function noticeMessage(notice) {
  if (notice) return notice.message;
  return undefined;
}

// ===== PLUMBING — skip unless debugging =====
// Pickers, import polling, and attachment meta (hoisted function declarations).

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

async function requestLibraryPermission() {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

async function requestCameraPermission() {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

function formatBytes(size) {
  const byteCount = Number(size);
  if (!Number.isFinite(byteCount) || byteCount <= 0) return '';
  if (byteCount < 1024) return `${byteCount} B`;
  if (byteCount < 1024 * 1024) return `${Math.round(byteCount / 1024)} KB`;
  return `${(byteCount / (1024 * 1024)).toFixed(1)} MB`;
}

function mimeTypeForPendingKind(asset, kind) {
  if (kind === 'video') {
    return 'video/mp4';
  }
  if (kind === 'doc') {
    return asset.mimeType || DEFAULT_OCTET_STREAM;
  }
  return 'image/jpeg';
}

function defaultNameForPendingKind(kind, uri) {
  const fromUri = uri.split('/').pop();
  if (fromUri) {
    return fromUri;
  }
  if (kind === 'video') {
    return `video_${Date.now()}.mp4`;
  }
  return `photo_${Date.now()}.jpg`;
}

function pendingAttachmentMeta(asset, kind) {
  const uri = asset && asset.uri;
  if (!uri) return null;
  const name =
    asset.fileName ||
    asset.name ||
    defaultNameForPendingKind(kind, uri);
  const attachmentType = kind === 'doc' ? notesTypeForDocument(asset) : kind;
  return {
    id: `${kind}_${uri}_${Date.now()}`,
    uri,
    name,
    kind,
    mimeType: asset.mimeType || mimeTypeForPendingKind(asset, kind),
    size: optionalFileSize(
      asset.fileSize !== null && asset.fileSize !== undefined ? asset.fileSize : asset.size,
    ),
    type: attachmentType,
  };
}

async function pickLibraryAsset(mediaTypes, extraOptions = {}) {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes,
    allowsEditing: false,
    ...extraOptions,
  });
  return firstPickerAsset(result);
}

async function pickCameraPhoto() {
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: PHOTO_PICKER_QUALITY,
  });
  return firstPickerAsset(result);
}

async function pickPdfOrWordDocument() {
  const result = await DocumentPicker.getDocumentAsync({
    type: PDF_AND_WORD_TYPES,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = result.assets[0];
  if (!isPdfOrWordFile(file)) {
    return { unsupported: true };
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
    const importedStatus = imported && imported.status;
    if (importedStatus === IMPORT_STATUS_COMPLETE || importedStatus === IMPORT_STATUS_ERROR) {
      return imported;
    }
    attempts += 1;
  }
  return imported;
}

async function askServerToParseImport(trainerId, importId, storagePath) {
  if (!functions) return;
  // vocab: httpsCallable = Firebase callable cloud function bridge
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
  callIfPresent(onParsingStarted);
  await askServerToParseImport(trainerId, importId, storagePath);
  return waitForImportParse(trainerId, importId);
}

function uploadingStatusLabel(importStatus, uploadProgress) {
  if (importStatus === IMPORT_STATUS_PARSING) return 'Parsing document…';
  const percentSuffix = uploadProgress > 0 ? `${uploadProgress}%` : '';
  return `Uploading… ${percentSuffix}`;
}
