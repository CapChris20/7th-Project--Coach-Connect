// The client's own uploads: search, NbSegmented tabs, HardShadow file cards, NbSheet upload.
// Flow: keep client-owned files → filter by typed text + tab → upload photo / document / spreadsheet.
// Used by the client files screen. Trainer-authored stubs stay out so this list is only "mine".

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { FileCard } from './FileCard';
import { addFile, addSpreadsheetFile } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { getFileTypeFromItem } from '../../helpers/fileSizeAndDateText';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import NbSheet from '../../look-and-feel/NbSheet';
import NbButton from '../../look-and-feel/NbButton';
import NbSegmented from '../../look-and-feel/NbSegmented';
import HardShadow from '../../look-and-feel/HardShadow';
import NbNoticeSheet from '../../look-and-feel/NbNoticeSheet';
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const TAB_ALL = 'all';
const TAB_IMAGES = 'images';
const TAB_DOCUMENTS = 'documents';
const TAB_SPREADSHEETS = 'spreadsheets';
const ADDED_BY_CLIENT = 'client';
const NOTE_TYPE = 'note';
const DOCUMENT_TYPE = 'document';
const PHOTO_SOURCE_CAMERA = 'camera';
const PHOTO_SOURCE_GALLERY = 'gallery';
const FILE_TYPE_IMAGE = 'image';
const FILE_TYPE_PDF = 'pdf';
const FILE_TYPE_SPREADSHEET = 'spreadsheet';
const FILE_TYPE_PHOTO = 'photo';
const FILE_TYPE_DOC = 'doc';
const PERMISSION_GRANTED = 'granted';

// Manipulate here: JPEG compression when picking photos (0–1). Lower = smaller uploads.
const PHOTO_UPLOAD_QUALITY = 0.85;
const DEFAULT_PHOTO_MIME = 'image/jpeg';
const DEFAULT_DOCUMENT_MIME = 'application/octet-stream';
const SECTION_BOTTOM_GAP = 26;
const UPLOAD_BUTTON_GAP = 10;
const FILE_CARD_GAP = 12;
const NOTICE_OK_LABEL = 'OK';
const DEFAULT_DOCUMENT_FILENAME = 'document';
const DEFAULT_SPREADSHEET_FILENAME = 'spreadsheet';
const SECTION_EYEBROW = 'MY FILES';
const SEARCH_PLACEHOLDER = 'Search your files…';
const EMPTY_MY_FILES_COPY =
  'No files here yet. Upload progress photos or documents to get started.';
const UPLOADING_LABEL = 'Uploading…';
const UPLOAD_SHEET_TITLE = 'Upload';
const NOT_SIGNED_IN_TITLE = 'Not signed in';
const NOT_SIGNED_IN_MESSAGE = 'Please sign in to upload files.';
const PERMISSION_NEEDED_TITLE = 'Permission needed';
const CAMERA_PERMISSION_MESSAGE = 'Allow camera access to take progress photos.';
const GALLERY_PERMISSION_MESSAGE = 'Allow photo library access to upload progress photos.';
const UPLOAD_FAILED_TITLE = 'Upload failed';
const UPLOAD_FAILED_FALLBACK = 'Could not upload file.';

const TAB_SEGMENTS = [
  { id: TAB_ALL, label: 'All Files' },
  { id: TAB_IMAGES, label: 'Photos' },
  { id: TAB_DOCUMENTS, label: 'Documents' },
  { id: TAB_SPREADSHEETS, label: 'Sheets' },
];

const DOCUMENT_PICKER_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.*',
  'text/plain',
  '*/*',
];

const SPREADSHEET_PICKER_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  '*/*',
];

// ===== HELPER FUNCTIONS =====

function isTrainerDocumentStub(item) {
  if (!item) return false;
  if (item.type !== DOCUMENT_TYPE) return false;
  if (!item.trainerId) return false;
  if (!item.documentId) return false;
  return true;
}

function isClientOwnedLibraryFile(item) {
  if (!item) return false;
  if (item.type === NOTE_TYPE) return false;

  let addedBy = ADDED_BY_CLIENT;
  if (item.addedBy) {
    addedBy = item.addedBy;
  }
  if (addedBy !== ADDED_BY_CLIENT) return false;
  if (isTrainerDocumentStub(item)) return false;
  return true;
}

function keepOnlyClientOwnedFiles(items) {
  const list = Array.isArray(items) ? items : [];
  const ownedFiles = [];
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (isClientOwnedLibraryFile(item)) {
      ownedFiles.push(item);
    }
  }
  return ownedFiles;
}

function fileMatchesTab(fileType, tab) {
  if (tab === TAB_ALL) return true;
  if (tab === TAB_IMAGES) return fileType === FILE_TYPE_IMAGE;
  if (tab === TAB_DOCUMENTS) {
    if (fileType === DOCUMENT_TYPE) return true;
    if (fileType === FILE_TYPE_PDF) return true;
    return false;
  }
  if (tab === TAB_SPREADSHEETS) return fileType === FILE_TYPE_SPREADSHEET;
  return true;
}

function fileDisplayNameLower(item) {
  if (!item) return '';
  const rawName = item.name || item.title || '';
  return String(rawName).toLowerCase();
}

function fileMatchesSearchAndTab(item, typedText, tab) {
  const fileName = fileDisplayNameLower(item);
  if (typedText && !fileName.includes(typedText)) return false;
  const fileType = getFileTypeFromItem(item);
  return fileMatchesTab(fileType, tab);
}

function filterFilesBySearchAndTab(myFiles, searchText, tab) {
  const typedText = searchText.trim().toLowerCase();
  const matchedFiles = [];
  for (let index = 0; index < myFiles.length; index += 1) {
    const item = myFiles[index];
    if (fileMatchesSearchAndTab(item, typedText, tab)) {
      matchedFiles.push(item);
    }
  }
  return matchedFiles;
}

function showNotSignedInNotice(showNotice) {
  showNotice(NOT_SIGNED_IN_TITLE, NOT_SIGNED_IN_MESSAGE);
}

function showPhotoPermissionNeeded(photoSource, showNotice) {
  let message = GALLERY_PERMISSION_MESSAGE;
  if (photoSource === PHOTO_SOURCE_CAMERA) {
    message = CAMERA_PERMISSION_MESSAGE;
  }
  showNotice(PERMISSION_NEEDED_TITLE, message);
}

async function askPhotoPermission(photoSource) {
  let permission;
  if (photoSource === PHOTO_SOURCE_CAMERA) {
    permission = await ImagePicker.requestCameraPermissionsAsync();
  } else {
    permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  }
  return permission.status === PERMISSION_GRANTED;
}

function firstPickedAsset(result) {
  if (!result) return null;
  if (!result.assets) return null;
  if (result.assets.length === 0) return null;
  return result.assets[0];
}

async function pickOnePhotoAsset(photoSource) {
  const pickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: PHOTO_UPLOAD_QUALITY,
  };

  let result;
  if (photoSource === PHOTO_SOURCE_CAMERA) {
    result = await ImagePicker.launchCameraAsync(pickerOptions);
  } else {
    result = await ImagePicker.launchImageLibraryAsync(pickerOptions);
  }

  if (result.canceled) return null;
  const asset = firstPickedAsset(result);
  if (!asset) return null;
  if (!asset.uri) return null;
  return asset;
}

async function pickOneDocumentFile(pickerTypes) {
  const result = await DocumentPicker.getDocumentAsync({
    type: pickerTypes,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const file = firstPickedAsset(result);
  if (!file) return null;
  if (!file.uri) return null;
  return file;
}

function photoFileNameFromAsset(asset) {
  if (asset.fileName) return asset.fileName;
  const uriParts = asset.uri.split('/');
  const uriTail = uriParts[uriParts.length - 1];
  if (uriTail) return uriTail;
  return `photo_${Date.now()}.jpg`;
}

function mimeTypeLooksLikePdf(mimeType) {
  if (!mimeType) return false;
  return mimeType.includes('pdf');
}

function fileNameLooksLikePdf(fileName) {
  const lowerName = String(fileName || '').toLowerCase();
  return lowerName.endsWith('.pdf');
}

function documentTypeFromPickedFile(file) {
  const mimeLooksPdf = mimeTypeLooksLikePdf(file.mimeType);
  const nameLooksPdf = fileNameLooksLikePdf(file.name);
  if (mimeLooksPdf || nameLooksPdf) return FILE_TYPE_PDF;
  return FILE_TYPE_DOC;
}

async function savePhotoAssetForClient(clientId, asset) {
  return addFile(
    clientId,
    {
      localUri: asset.uri,
      filename: photoFileNameFromAsset(asset),
      mimeType: asset.mimeType || DEFAULT_PHOTO_MIME,
      type: FILE_TYPE_PHOTO,
      size: asset.fileSize,
    },
    ADDED_BY_CLIENT,
  );
}

function uploadErrorMessage(error) {
  if (error && error.message) return error.message;
  return UPLOAD_FAILED_FALLBACK;
}

async function runUploadWithSpinner(uploadWork, setUploading, setUploadOpen, showNotice, failureTitle) {
  setUploading(true);
  try {
    await uploadWork();
    setUploadOpen(false);
  } catch (error) {
    showNotice(failureTitle, uploadErrorMessage(error));
  } finally {
    setUploading(false);
  }
}

function noticeTitleText(notice) {
  if (!notice) return '';
  if (notice.title) return notice.title;
  return '';
}

function noticeMessageText(notice) {
  if (!notice) return undefined;
  return notice.message;
}

function noticeConfirmLabelText(notice) {
  if (!notice) return NOTICE_OK_LABEL;
  if (notice.confirmLabel) return notice.confirmLabel;
  return NOTICE_OK_LABEL;
}

function noticeCancelLabelText(notice) {
  if (!notice) return undefined;
  return notice.cancelLabel;
}

function noticeConfirmAction(notice) {
  if (!notice) return undefined;
  return notice.onConfirm;
}

function SearchYourFilesField({ colors, searchText, onSearchTextChange }) {
  const hasTypedText = !!searchText;

  function clearSearch() {
    onSearchTextChange('');
  }

  return (
    <View
      style={[
        styles.search,
        { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
      ]}
    >
      <Feather name="search" size={16} color={colors.nbMuted} />
      <TextInput
        placeholder={SEARCH_PLACEHOLDER}
        placeholderTextColor={colors.nbMuted}
        value={searchText}
        onChangeText={onSearchTextChange}
        style={[styles.searchInput, { color: colors.nbInk }]}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {hasTypedText ? (
        <TouchableOpacity onPress={clearSearch} hitSlop={10}>
          <Feather name="x" size={18} color={colors.nbMuted} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function EmptyMyFilesMessage({ colors }) {
  return (
    <View style={[styles.empty, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}>
      <Text style={[styles.emptyText, { color: colors.nbMuted }]}>{EMPTY_MY_FILES_COPY}</Text>
    </View>
  );
}

function buildMyFileCardRows(filteredFiles, onOpenItem, onDownloadItem, onShareItem, onDeleteItem) {
  const rows = [];
  for (let index = 0; index < filteredFiles.length; index += 1) {
    const fileItem = filteredFiles[index];

    function openThisFile() {
      if (!onOpenItem) return;
      onOpenItem(fileItem);
    }

    let downloadThisFile;
    if (onDownloadItem) {
      downloadThisFile = () => onDownloadItem(fileItem);
    }

    let shareThisFile;
    if (onShareItem) {
      shareThisFile = () => onShareItem(fileItem);
    }

    let deleteThisFile;
    if (onDeleteItem) {
      deleteThisFile = () => onDeleteItem(fileItem);
    }

    rows.push(
      <FileCard
        key={fileItem.id}
        item={fileItem}
        onOpen={openThisFile}
        onDownload={downloadThisFile}
        onShare={shareThisFile}
        onDelete={deleteThisFile}
      />,
    );
  }
  return rows;
}

function MyFilesCardList({ filteredFiles, onOpenItem, onDownloadItem, onShareItem, onDeleteItem }) {
  const cardRows = buildMyFileCardRows(
    filteredFiles,
    onOpenItem,
    onDownloadItem,
    onShareItem,
    onDeleteItem,
  );

  return <View style={{ gap: FILE_CARD_GAP }}>{cardRows}</View>;
}

function UploadChoicesBody({
  colors,
  uploading,
  onTakePhoto,
  onChooseGallery,
  onUploadDocument,
  onUploadSpreadsheet,
  onCancel,
}) {
  if (uploading) {
    return (
      <View style={styles.uploading}>
        <ActivityIndicator color={colors.nbInk} />
        <Text style={[styles.uploadingText, { color: colors.nbMuted }]}>{UPLOADING_LABEL}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: UPLOAD_BUTTON_GAP, paddingBottom: spacing.md }}>
      <NbButton variant="plain" onPress={onTakePhoto}>
        Take Photo
      </NbButton>
      <NbButton variant="plain" onPress={onChooseGallery}>
        Choose from Gallery
      </NbButton>
      <NbButton variant="plain" onPress={onUploadDocument}>
        Upload Document
      </NbButton>
      <NbButton variant="plain" onPress={onUploadSpreadsheet}>
        Upload Spreadsheet
      </NbButton>
      <NbButton variant="plain" onPress={onCancel}>
        Cancel
      </NbButton>
    </View>
  );
}

function MyFilesPanelBody({
  listIsEmpty,
  colors,
  filteredFiles,
  onOpenItem,
  onDownloadItem,
  onShareItem,
  onDeleteItem,
}) {
  if (listIsEmpty) {
    return <EmptyMyFilesMessage colors={colors} />;
  }
  return (
    <MyFilesCardList
      filteredFiles={filteredFiles}
      onOpenItem={onOpenItem}
      onDownloadItem={onDownloadItem}
      onShareItem={onShareItem}
      onDeleteItem={onDeleteItem}
    />
  );
}

// ===== MAIN FUNCTION =====

/**
 * Client-owned files: search, NbSegmented tabs, cards, and NbSheet upload.
 * @param {{ clientId: string, items: Array, isDark?: boolean, onOpenItem?: Function, onDeleteItem?: Function, onShareItem?: Function, onDownloadItem?: Function }} props
 */
export function MyFilesSection({
  clientId,
  items,
  isDark: _themeFromParentUnused,
  onOpenItem,
  onDeleteItem,
  onShareItem,
  onDownloadItem,
}) {
  const { colors } = useTheme();

  const [selectedTab, setSelectedTab] = useState(TAB_ALL);
  const [searchText, setSearchText] = useState('');
  const [uploadSheetOpen, setUploadSheetOpen] = useState(false);
  const [uploadInProgress, setUploadInProgress] = useState(false);
  const [notice, setNotice] = useState(null);

  const showNotice = (title, message, extras = {}) => {
    setNotice({ title, message, ...extras });
  };

  const myFiles = useMemo(() => keepOnlyClientOwnedFiles(items), [items]);
  const filteredFiles = useMemo(
    () => filterFilesBySearchAndTab(myFiles, searchText, selectedTab),
    [myFiles, searchText, selectedTab],
  );

  const listIsEmpty = filteredFiles.length === 0;
  const noticeIsVisible = !!notice;
  const noticeTitle = noticeTitleText(notice);
  const noticeMessage = noticeMessageText(notice);
  const noticeConfirmLabel = noticeConfirmLabelText(notice);
  const noticeCancelLabel = noticeCancelLabelText(notice);
  const noticeConfirmHandler = noticeConfirmAction(notice);

  async function uploadPhotoFromSource(photoSource) {
    // 1. Must be signed in before touching camera or library.
    if (!clientId) {
      showNotSignedInNotice(showNotice);
      return;
    }

    // 2. Ask the OS for permission for that source.
    const permissionGranted = await askPhotoPermission(photoSource);
    if (!permissionGranted) {
      showPhotoPermissionNeeded(photoSource, showNotice);
      return;
    }

    // 3. Open the picker; bail if the user cancels.
    const pickedAsset = await pickOnePhotoAsset(photoSource);
    if (!pickedAsset) return;

    // 4. Upload, then close the sheet on success.
    await runUploadWithSpinner(
      () => savePhotoAssetForClient(clientId, pickedAsset),
      setUploadInProgress,
      setUploadSheetOpen,
      showNotice,
      UPLOAD_FAILED_TITLE,
    );
  }

  async function uploadOfficeFileFromPicker(pickerTypes, savePickedFile) {
    // 1. Must be signed in.
    if (!clientId) {
      showNotSignedInNotice(showNotice);
      return;
    }

    // 2. Open the document picker; bail on cancel or missing uri.
    const pickedFile = await pickOneDocumentFile(pickerTypes);
    if (!pickedFile) return;

    // 3. Upload and close the sheet on success.
    await runUploadWithSpinner(
      () => savePickedFile(clientId, pickedFile),
      setUploadInProgress,
      setUploadSheetOpen,
      showNotice,
      UPLOAD_FAILED_TITLE,
    );
  }

  function saveDocumentPick(signedInClientId, file) {
    return addFile(
      signedInClientId,
      {
        localUri: file.uri,
        filename: file.name || DEFAULT_DOCUMENT_FILENAME,
        mimeType: file.mimeType || DEFAULT_DOCUMENT_MIME,
        type: documentTypeFromPickedFile(file),
        size: file.size,
      },
      ADDED_BY_CLIENT,
    );
  }

  function saveSpreadsheetPick(signedInClientId, file) {
    return addSpreadsheetFile(
      signedInClientId,
      {
        localUri: file.uri,
        filename: file.name || DEFAULT_SPREADSHEET_FILENAME,
        mimeType: file.mimeType || DEFAULT_DOCUMENT_MIME,
        size: file.size,
      },
      ADDED_BY_CLIENT,
    );
  }

  const openUploadSheet = () => setUploadSheetOpen(true);
  const closeUploadSheet = () => setUploadSheetOpen(false);
  const clearNotice = () => setNotice(null);
  const takePhoto = () => uploadPhotoFromSource(PHOTO_SOURCE_CAMERA);
  const chooseGallery = () => uploadPhotoFromSource(PHOTO_SOURCE_GALLERY);
  const uploadDocument = () => uploadOfficeFileFromPicker(DOCUMENT_PICKER_TYPES, saveDocumentPick);
  const uploadSpreadsheet = () =>
    uploadOfficeFileFromPicker(SPREADSHEET_PICKER_TYPES, saveSpreadsheetPick);

  return (
    <View style={{ marginBottom: SECTION_BOTTOM_GAP }}>
      <Text style={[styles.eyebrow, { color: colors.nbMuted }]}>{SECTION_EYEBROW}</Text>

      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <SearchYourFilesField
            colors={colors}
            searchText={searchText}
            onSearchTextChange={setSearchText}
          />

          <NbSegmented
            segments={TAB_SEGMENTS}
            selected={selectedTab}
            onSelect={setSelectedTab}
          />

          <MyFilesPanelBody
            listIsEmpty={listIsEmpty}
            colors={colors}
            filteredFiles={filteredFiles}
            onOpenItem={onOpenItem}
            onDownloadItem={onDownloadItem}
            onShareItem={onShareItem}
            onDeleteItem={onDeleteItem}
          />

          <NbButton variant="plain" onPress={openUploadSheet}>
            Upload File
          </NbButton>
        </View>
      </HardShadow>

      <NbSheet visible={uploadSheetOpen} onClose={closeUploadSheet} title={UPLOAD_SHEET_TITLE}>
        <UploadChoicesBody
          colors={colors}
          uploading={uploadInProgress}
          onTakePhoto={takePhoto}
          onChooseGallery={chooseGallery}
          onUploadDocument={uploadDocument}
          onUploadSpreadsheet={uploadSpreadsheet}
          onCancel={closeUploadSheet}
        />
      </NbSheet>

      <NbNoticeSheet
        visible={noticeIsVisible}
        onClose={clearNotice}
        title={noticeTitle}
        message={noticeMessage}
        confirmLabel={noticeConfirmLabel}
        cancelLabel={noticeCancelLabel}
        onConfirm={noticeConfirmHandler}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 12,
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  panel: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 12,
    gap: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: borderRadius.nbInput,
    borderWidth: nb.borderWidthDivider,
    minHeight: nb.minTouchTarget,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  empty: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidthDivider,
  },
  emptyText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  uploading: {
    paddingVertical: 18,
    alignItems: 'center',
    gap: 10,
  },
  uploadingText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
});
