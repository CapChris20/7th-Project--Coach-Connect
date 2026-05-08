import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { FileCard } from './FileCard';
import { addFile, addSpreadsheetFile } from '../../../shared/services/notesAndFilesService';
import { getFileTypeFromItem } from '../../../shared/utils/fileFormatting';

const TABS = [
  { id: 'all', label: 'All Files', icon: 'list' },
  { id: 'images', label: 'Progress Photos', icon: 'image' },
  { id: 'documents', label: 'Documents', icon: 'file-text' },
  { id: 'spreadsheets', label: 'Spreadsheets', icon: 'grid' },
];

const GRADIENTS = {
  myFiles: ['#FF6B9D', '#C084FC'],
  trainer: ['#06B6D4', '#C084FC'],
  notes: ['#C084FC', '#FF6B9D'],
};

function themeFor(isDark) {
  return isDark
    ? {
        bg: '#0A0A0F',
        card: '#141419',
        text: '#FFFFFF',
        text60: 'rgba(255,255,255,0.6)',
        text50: 'rgba(255,255,255,0.5)',
        border: 'rgba(255,255,255,0.10)',
        inputBg: 'rgba(255,255,255,0.08)',
        btnBorder: 'rgba(255,255,255,0.20)',
      }
    : {
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

export function MyFilesSection({ clientId, items, isDark = true, onOpenItem, onDeleteItem, onShareItem, onDownloadItem }) {
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const theme = themeFor(isDark);

  const myFiles = useMemo(() => {
    const list = Array.isArray(items) ? items : [];
    return list.filter((x) => {
      if (x?.type === 'note') return false;
      const addedBy = x?.addedBy || 'client';
      const isDocStub = x?.type === 'document' && x?.trainerId && x?.documentId;
      return addedBy === 'client' && !isDocStub;
    });
  }, [items]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return myFiles.filter((x) => {
      const name = String(x?.name || x?.title || '').toLowerCase();
      if (query && !name.includes(query)) return false;
      if (tab === 'all') return true;
      const t = getFileTypeFromItem(x);
      if (tab === 'images') return t === 'image';
      if (tab === 'documents') return t === 'document' || t === 'pdf';
      if (tab === 'spreadsheets') return t === 'spreadsheet';
      return true;
    });
  }, [myFiles, q, tab]);

  const requireUid = () => {
    if (!clientId) {
      Alert.alert('Not signed in', 'Please sign in to upload files.');
      return false;
    }
    return true;
  };

  const handleTakePhoto = async () => {
    if (!requireUid()) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to take progress photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      await addFile(clientId, { localUri: asset.uri, filename: name, mimeType: asset.mimeType || 'image/jpeg', type: 'photo', size: asset.fileSize }, 'client');
      setUploadOpen(false);
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleChooseFromGallery = async () => {
    if (!requireUid()) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload progress photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const name = asset.fileName || asset.uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      await addFile(clientId, { localUri: asset.uri, filename: name, mimeType: asset.mimeType || 'image/jpeg', type: 'photo', size: asset.fileSize }, 'client');
      setUploadOpen(false);
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadDocument = async () => {
    if (!requireUid()) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.*', 'text/plain', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets?.[0];
    if (!file?.uri) return;
    setUploading(true);
    try {
      const inferredType = file.mimeType?.includes('pdf') || String(file.name || '').toLowerCase().endsWith('.pdf') ? 'pdf' : 'doc';
      await addFile(
        clientId,
        { localUri: file.uri, filename: file.name || 'document', mimeType: file.mimeType || 'application/octet-stream', type: inferredType, size: file.size },
        'client',
      );
      setUploadOpen(false);
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload document.');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadSpreadsheet = async () => {
    if (!requireUid()) return;
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', '*/*'],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const file = result.assets?.[0];
    if (!file?.uri) return;
    setUploading(true);
    try {
      await addSpreadsheetFile(
        clientId,
        { localUri: file.uri, filename: file.name || 'spreadsheet', mimeType: file.mimeType || 'application/octet-stream', size: file.size },
        'client',
      );
      setUploadOpen(false);
    } catch (e) {
      Alert.alert('Upload failed', e?.message || 'Could not upload spreadsheet.');
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
            value={q}
            onChangeText={setQ}
            style={{ flex: 1, color: theme.text, fontSize: 14, fontWeight: '600' }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {q ? (
            <TouchableOpacity onPress={() => setQ('')} hitSlop={10}>
              <Feather name="x" size={18} color={theme.text60} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => setTab(t.id)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingHorizontal: 12,
                  paddingVertical: 9,
                  borderRadius: 999,
                  backgroundColor: active ? 'transparent' : theme.inputBg,
                  borderWidth: 1,
                  borderColor: active ? 'transparent' : theme.border,
                  overflow: 'hidden',
                }}
              >
                {active ? (
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
                <Feather name={t.icon} size={14} color={active ? '#FF6B9D' : theme.text60} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: active ? '#FF6B9D' : theme.text60 }}>
                  {t.label}
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
                  onPress={handleTakePhoto}
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
                  onPress={handleChooseFromGallery}
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
                  onPress={handleUploadDocument}
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
                  onPress={handleUploadSpreadsheet}
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

