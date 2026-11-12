// The client's own uploads: NbSegmented tabs, HardShadow search, file cards, NbSheet upload.
// Flow: keep client-owned files → filter by typed text and tab → upload photo / document / spreadsheet.
// Used by the client files screen. Trainer-authored stubs stay out so this list is only "mine".
 //
 // vocab: NbSheet = Design Law bottom sheet for upload choices; NbSegmented = All/Photos/Docs/Sheets

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { borderRadius, nb, spacing } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const TAB_ALL = 'all';
const TAB_IMAGES = 'images';
const TAB_DOCUMENTS = 'documents';
const TAB_SPREADSHEETS = 'spreadsheets';
const ADDED_BY_CLIENT = 'client';
const NOTE_TYPE = 'note';
const DOCUMENT_TYPE = 'document';
const PHOTO_UPLOAD_QUALITY = 0.85;
const DEFAULT_PHOTO_MIME = 'image/jpeg';
const DEFAULT_DOCUMENT_MIME = 'application/octet-stream';

const SEGMENTS = [
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

function isClientOwnedLibraryFile(item) {
  if (item?.type === NOTE_TYPE) return false;
  const addedBy = item?.addedBy || ADDED_BY_CLIENT;
  const isTrainerDocumentStub = item?.type === DOCUMENT_TYPE && item?.trainerId && item?.documentId;
  return addedBy === ADDED_BY_CLIENT && !isTrainerDocumentStub;
}

function fileMatchesTabAndSearch(item, searchText, tab) {
  const fileName = String(item?.name || item?.title || '').toLowerCase();
  if (searchText && !fileName.includes(searchText)) return false;
  if (tab === TAB_ALL) return true;
  const fileType = getFileTypeFromItem(item);
  if (tab === TAB_IMAGES) return fileType === 'image';
  if (tab === TAB_DOCUMENTS) return fileType === DOCUMENT_TYPE || fileType === 'pdf';
  if (tab === TAB_SPREADSHEETS) return fileType === 'spreadsheet';
  return true;
}

function ensureClientIsSignedIn(clientId) {
  if (clientId) return true;
  Alert.alert('Not signed in', 'Please sign in to upload files.');
  return false;
}

function photoFileName(asset) {
  return asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
}

function inferredDocumentType(file) {
  const isPdf = file.mimeType?.includes('pdf') || String(file.name || '').toLowerCase().endsWith('.pdf');
  return isPdf ? 'pdf' : 'doc';
}

async function uploadPickedPhoto(clientId, asset, setUploading, setUploadOpen) {
  setUploading(true);
  try {
    await addFile(
      clientId,
      {
        localUri: asset.uri,
        filename: photoFileName(asset),
        mimeType: asset.mimeType || DEFAULT_PHOTO_MIME,
        type: 'photo',
        size: asset.fileSize,
      },
      ADDED_BY_CLIENT,
    );
    setUploadOpen(false);
  } catch (error) {
    Alert.alert('Upload failed', error?.message || 'Could not upload photo.');
  } finally {
    setUploading(false);
  }
}

// ===== MAIN FUNCTION =====

/**
 * Client-owned files: search, NbSegmented tabs, cards, and NbSheet upload.
 */
export function MyFilesSection({
  clientId,
  items,
  isDark: _isDarkIgnored,
  onOpenItem,
  onDeleteItem,
  onShareItem,
  onDownloadItem,
}) {
  const { colors } = useTheme();
  const [tab, setTab] = useState(TAB_ALL);
  const [searchText, setSearchText] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const myFiles = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter(isClientOwnedLibraryFile);
  }, [items]);

  const filtered = useMemo(() => {
    const typedText = searchText.trim().toLowerCase();
    return myFiles.filter((item) => fileMatchesTabAndSearch(item, typedText, tab));
  }, [myFiles, searchText, tab]);

  const takeProgressPhoto = async () => {
    if (!ensureClientIsSignedIn(clientId)) return;
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take progress photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: PHOTO_UPLOAD_QUALITY,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await uploadPickedPhoto(clientId, result.assets[0], setUploading, setUploadOpen);
  };

  const choosePhotoFromGallery = async () => {
    if (!ensureClientIsSignedIn(clientId)) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload progress photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: PHOTO_UPLOAD_QUALITY,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await uploadPickedPhoto(clientId, result.assets[0], setUploading, setUploadOpen);
  };

  const uploadPickedDocument = async () => {
    if (!ensureClientIsSignedIn(clientId)) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: DOCUMENT_PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets?.[0];
    if (!file?.uri) return;
    setUploading(true);
    try {
      await addFile(
        clientId,
        {
          localUri: file.uri,
          filename: file.name || 'document',
          mimeType: file.mimeType || DEFAULT_DOCUMENT_MIME,
          type: inferredDocumentType(file),
          size: file.size,
        },
        ADDED_BY_CLIENT,
      );
      setUploadOpen(false);
    } catch (error) {
      Alert.alert('Upload failed', error?.message || 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  };

  const uploadPickedSpreadsheet = async () => {
    if (!ensureClientIsSignedIn(clientId)) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: SPREADSHEET_PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets?.[0];
    if (!file?.uri) return;
    setUploading(true);
    try {
      await addSpreadsheetFile(
        clientId,
        {
          localUri: file.uri,
          filename: file.name || 'spreadsheet',
          mimeType: file.mimeType || DEFAULT_DOCUMENT_MIME,
          size: file.size,
        },
        ADDED_BY_CLIENT,
      );
      setUploadOpen(false);
    } catch (error) {
      Alert.alert('Upload failed', error?.message || 'Could not upload spreadsheet.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ marginBottom: 26 }}>
      <Text style={[styles.eyebrow, { color: colors.nbMuted }]}>MY FILES</Text>

      <HardShadow radius={borderRadius.nbCard} offset={nb.shadowOffsetCard}>
        <View
          style={[
            styles.panel,
            { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
          ]}
        >
          <View
            style={[
              styles.search,
              { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder },
            ]}
          >
            <Feather name="search" size={16} color={colors.nbMuted} />
            <TextInput
              placeholder="Search your files…"
              placeholderTextColor={colors.nbMuted}
              value={searchText}
              onChangeText={setSearchText}
              style={[styles.searchInput, { color: colors.nbInk }]}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchText ? (
              <TouchableOpacity onPress={() => setSearchText('')} hitSlop={10}>
                <Feather name="x" size={18} color={colors.nbMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          <NbSegmented segments={SEGMENTS} selected={tab} onSelect={setTab} />

          {filtered.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: colors.nbSoft, borderColor: colors.nbBorder }]}>
              <Text style={[styles.emptyText, { color: colors.nbMuted }]}>
                No files here yet. Upload progress photos or documents to get started.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map((item) => (
                <FileCard
                  key={item.id}
                  item={item}
                  onOpen={() => onOpenItem?.(item)}
                  onDownload={onDownloadItem ? () => onDownloadItem(item) : undefined}
                  onShare={onShareItem ? () => onShareItem(item) : undefined}
                  onDelete={onDeleteItem ? () => onDeleteItem(item) : undefined}
                />
              ))}
            </View>
          )}

          <NbButton variant="plain" onPress={() => setUploadOpen(true)}>
            Upload File
          </NbButton>
        </View>
      </HardShadow>

      <NbSheet visible={uploadOpen} onClose={() => setUploadOpen(false)} title="Upload">
        {uploading ? (
          <View style={styles.uploading}>
            <ActivityIndicator color={colors.nbInk} />
            <Text style={[styles.uploadingText, { color: colors.nbMuted }]}>Uploading…</Text>
          </View>
        ) : (
          <View style={{ gap: 10, paddingBottom: spacing.md }}>
            <NbButton variant="plain" onPress={takeProgressPhoto}>
              Take Photo
            </NbButton>
            <NbButton variant="plain" onPress={choosePhotoFromGallery}>
              Choose from Gallery
            </NbButton>
            <NbButton variant="plain" onPress={uploadPickedDocument}>
              Upload Document
            </NbButton>
            <NbButton variant="plain" onPress={uploadPickedSpreadsheet}>
              Upload Spreadsheet
            </NbButton>
            <NbButton variant="plain" onPress={() => setUploadOpen(false)}>
              Cancel
            </NbButton>
          </View>
        )}
      </NbSheet>
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
