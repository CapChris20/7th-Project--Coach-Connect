// The client's own uploads: search, type tabs, file cards, and the upload sheet.
// Flow: keep client-owned files → filter by typed text and tab → upload photo / document / spreadsheet.
// Used by the client files screen. Trainer-authored stubs stay out so this list is only "mine".

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FileCard } from './FileCard';
import { addFile, addSpreadsheetFile } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { getFileTypeFromItem } from '../../helpers/fileSizeAndDateText';

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

const TABS = [
  { id: TAB_ALL, label: 'All Files', icon: 'list' },
  { id: TAB_IMAGES, label: 'Progress Photos', icon: 'image' },
  { id: TAB_DOCUMENTS, label: 'Documents', icon: 'file-text' },
  { id: TAB_SPREADSHEETS, label: 'Spreadsheets', icon: 'grid' },
];

const GRADIENTS = {
  myFiles: ['#FF6B9D', '#C084FC'],
  trainer: ['#06B6D4', '#C084FC'],
  notes: ['#C084FC', '#FF6B9D'],
};

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

/**
 * Dark vs light paint for the search box, tabs, and empty state.
 * @param {boolean} isDark
 */
function themeFor(isDark) {
  if (isDark) {
    return {
      bg: '#0A0A0F',
      card: '#141419',
      text: '#FFFFFF',
      text60: 'rgba(255,255,255,0.6)',
      text50: 'rgba(255,255,255,0.5)',
      border: 'rgba(255,255,255,0.10)',
      inputBg: 'rgba(255,255,255,0.08)',
      btnBorder: 'rgba(255,255,255,0.20)',
    };
  }
  return {
    bg: '#FFFFFF',
    card: '#F8F8FB',
    text: '#0A0A0F',
    text60: 'rgba(10,10,15,0.6)',
    text50: 'rgba(10,10,15,0.5)',
    border: 'rgba(10,10,15,0.10)',
    inputBg: 'rgba(10,10,15,0.05)',
    btnBorder: 'rgba(10,10,15,0.15)',
  };
}

/**
 * Trainer document stubs carry trainerId + documentId. Those belong in "shared", not here.
 * @param {object} item
 * @returns {boolean}
 */
function isClientOwnedLibraryFile(item) {
  if (item?.type === NOTE_TYPE) return false;
  const addedBy = item?.addedBy || ADDED_BY_CLIENT;
  const isTrainerDocumentStub = item?.type === DOCUMENT_TYPE && item?.trainerId && item?.documentId;
  return addedBy === ADDED_BY_CLIENT && !isTrainerDocumentStub;
}

/**
 * @param {object} item
 * @param {string} searchText
 * @param {string} tab
 * @returns {boolean}
 */
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

/**
 * @param {string} clientId
 * @returns {boolean}
 */
function ensureClientIsSignedIn(clientId) {
  if (clientId) return true;
  Alert.alert('Not signed in', 'Please sign in to upload files.');
  return false;
}

/**
 * Camera / gallery assets do not always send a file name. Fall back to the URI tail, then a timestamp.
 * @param {object} asset
 * @returns {string}
 */
function photoFileName(asset) {
  return asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
}

/**
 * PDFs stay typed as pdf so the card icon matches. Everything else is a generic doc.
 * @param {object} file
 * @returns {string}
 */
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
 * Client-owned files: search, type tabs, cards, and the upload sheet.
 * vocab: useState holds the active tab, the search box, and whether the upload sheet is open.
 * vocab: useMemo rebuilds the filtered list only when items / search / tab change.
 * @param {{
 *   clientId: string,
 *   items: Array,
 *   isDark?: boolean,
 *   onOpenItem?: Function,
 *   onDeleteItem?: Function,
 *   onShareItem?: Function,
 *   onDownloadItem?: Function,
 * }} props
 */
export function MyFilesSection({
  clientId,
  items,
  isDark = true,
  onOpenItem,
  onDeleteItem,
  onShareItem,
  onDownloadItem,
}) {
  const [tab, setTab] = useState(TAB_ALL);
  const [searchText, setSearchText] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const theme = themeFor(isDark);

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

    // 1. Camera permission has to come first — launchCameraAsync will not prompt again on iOS.
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take progress photos.');
      return;
    }

    // 2. One still photo. Editing is off so the original framing is what gets stored.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: PHOTO_UPLOAD_QUALITY,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    // 3. Write the file as a client-owned photo.
    await uploadPickedPhoto(clientId, result.assets[0], setUploading, setUploadOpen);
  };

  const choosePhotoFromGallery = async () => {
    if (!ensureClientIsSignedIn(clientId)) return;

    // 1. Photo-library permission.
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload progress photos.');
      return;
    }

    // 2. One still photo from the library.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: PHOTO_UPLOAD_QUALITY,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    // 3. Same client-owned photo write as the camera path.
    await uploadPickedPhoto(clientId, result.assets[0], setUploading, setUploadOpen);
  };

  const uploadPickedDocument = async () => {
    if (!ensureClientIsSignedIn(clientId)) return;

    // 1. System document picker. copyToCacheDirectory lets us read the file after the picker closes.
    const result = await DocumentPicker.getDocumentAsync({
      type: DOCUMENT_PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets?.[0];
    if (!file?.uri) return;

    // 2. Upload as pdf or doc so the card icon matches the file.
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

    // 1. Spreadsheet / CSV picker.
    const result = await DocumentPicker.getDocumentAsync({
      type: SPREADSHEET_PICKER_TYPES,
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets?.[0];
    if (!file?.uri) return;

    // 2. addSpreadsheetFile stores it as a sheet, not a generic document.
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
      <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 2, color: theme.text50, marginBottom: 10 }}>
        MY FILES
      </Text>

      <View
        style={{
          backgroundColor: theme.card,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.border,
          padding: 12,
          gap: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingHorizontal: 10,
            paddingVertical: 10,
            borderRadius: 14,
            backgroundColor: theme.inputBg,
            borderWidth: 1,
            borderColor: theme.border,
          }}
        >
          <Feather name="search" size={16} color={theme.text60} />
          <TextInput
            placeholder="Search your files…"
            placeholderTextColor={theme.text60}
            value={searchText}
            onChangeText={setSearchText}
            style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '600' }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchText ? (
            <TouchableOpacity onPress={() => setSearchText('')} hitSlop={10}>
              <Feather name="x" size={18} color={theme.text60} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TABS.map((tabOption) => {
            const isActive = tab === tabOption.id;
            return (
              <TouchableOpacity
                key={tabOption.id}
                onPress={() => setTab(tabOption.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: isActive ? 'transparent' : theme.inputBg,
                  borderWidth: 1,
                  borderColor: isActive ? 'transparent' : theme.border,
                  overflow: 'hidden',
                }}
              >
                {isActive ? (
                  <LinearGradient
                    colors={GRADIENTS.myFiles}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: 0,
                      bottom: 0,
                      opacity: 0.95,
                    }}
                  />
                ) : null}
                <Feather name={tabOption.icon} size={14} color={isActive ? '#FF6B9D' : theme.text60} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? '#FF6B9D' : theme.text60 }}>
                  {tabOption.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {filtered.length === 0 ? (
          <View
            style={{
              paddingVertical: 18,
              paddingHorizontal: 14,
              borderRadius: 14,
              backgroundColor: theme.inputBg,
              borderWidth: 1,
              borderColor: theme.border,
            }}
          >
            <Text style={{ color: theme.text60, fontWeight: '700', fontSize: 13, textAlign: 'center', lineHeight: 18 }}>
              No files here yet. Upload progress photos or documents to get started.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {filtered.map((item) => (
              <FileCard
                key={item.id}
                item={item}
                isDark={isDark}
                onOpen={() => onOpenItem?.(item)}
                onDownload={onDownloadItem ? () => onDownloadItem(item) : undefined}
                onShare={onShareItem ? () => onShareItem(item) : undefined}
                onDelete={onDeleteItem ? () => onDeleteItem(item) : undefined}
              />
            ))}
          </View>
        )}

        <TouchableOpacity
          onPress={() => setUploadOpen(true)}
          style={{
            marginTop: 4,
            height: 52,
            borderRadius: 14,
            borderWidth: 2,
            borderColor: '#FF6B9D',
            backgroundColor: 'rgba(255, 107, 157, 0.15)',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 10,
          }}
          accessibilityRole="button"
        >
          <Feather name="plus" size={18} color="#FF6B9D" />
          <Text style={{ fontSize: 14, fontWeight: '900', color: '#FF6B9D', letterSpacing: 0.2 }}>
            Upload File
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={uploadOpen} transparent animationType="slide" onRequestClose={() => setUploadOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
          <View
            style={{
              backgroundColor: '#12121A',
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: 18,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.10)',
              gap: 12,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: '#fff' }}>Upload</Text>
              <TouchableOpacity onPress={() => setUploadOpen(false)} hitSlop={12}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            </View>

            {uploading ? (
              <View style={{ paddingVertical: 18, alignItems: 'center', gap: 10 }}>
                <ActivityIndicator color="#FF6B9D" />
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontWeight: '700' }}>Uploading…</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  onPress={takeProgressPhoto}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 10,
                  }}
                >
                  <Feather name="camera" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={choosePhotoFromGallery}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 10,
                  }}
                >
                  <Feather name="image" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={uploadPickedDocument}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 10,
                  }}
                >
                  <Feather name="file-text" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Upload Document</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={uploadPickedSpreadsheet}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    backgroundColor: 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.10)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 10,
                  }}
                >
                  <Feather name="grid" size={18} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight: '800' }}>Upload Spreadsheet</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity onPress={() => setUploadOpen(false)} style={{ paddingVertical: 10 }}>
              <Text style={{ textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontWeight: '800' }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
