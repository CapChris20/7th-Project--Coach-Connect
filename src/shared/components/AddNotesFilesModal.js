/**
 * Add Notes Files Modal
 *
 * Purpose: UI screen or component: Add Notes Files Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: AddNotesFilesModal
 *
 * @file-header
 */
/**
 * Modal triggered by the bottom nav plus button.
 * Add: Photo, Video, Note, PDF/Doc. Saves to Firestore + Storage and mirrors to trainer CRM.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
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
import { auth } from '../../app/config';
import { addNote, addFile, addSpreadsheetFile } from '../notes-files/manageNotesAndFiles';

const OPTIONS = [
  { key: 'photo', label: 'Photo', icon: 'image-outline', gradient: ['#06B6D4', '#8B5CF6'] },
  { key: 'video', label: 'Video', icon: 'videocam-outline', gradient: ['#EC4899', '#F97316'] },
  { key: 'note', label: 'Note', icon: 'document-text-outline', gradient: ['#8B5CF6', '#EC4899'] },
  { key: 'doc', label: 'PDF / Doc', icon: 'document-attach-outline', gradient: ['#F97316', '#06B6D4'] },
  { key: 'spreadsheet', label: 'Spreadsheet', icon: 'grid-outline', gradient: ['#10B981', '#059669'], clientOnly: true },
];

export default function AddNotesFilesModal({
  visible,
  onClose,
  onAdded,
  isDark = true,
  clientId: clientIdProp,
  addedBy: addedByProp = 'client',
  onNewDocument,
  onNewSpreadsheet,
  onImportSpreadsheet,
}) {
  const [step, setStep] = useState('picker'); // 'picker' | 'note'
  const [noteText, setNoteText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const uid = clientIdProp ?? auth?.currentUser?.uid;
  const addedBy = addedByProp;

  const handleClose = () => {
    setStep('picker');
    setNoteText('');
    setUploading(false);
    setUploadProgress(0);
    onClose();
  };

  const handleAddNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    if (!uid) {
      Alert.alert('Error', 'You must be signed in to add a note.');
      return;
    }
    setUploading(true);
    try {
      await addNote(uid, text, addedBy);
      onAdded?.();
      handleClose();
    } catch (e) {
      console.warn('Add note error:', e);
      Alert.alert('Failed', e?.message || 'Could not save note.');
    } finally {
      setUploading(false);
    }
  };

  const handlePhoto = async () => {
    if (!uid) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const { uri, fileSize } = result.assets[0];
      const name = uri.split('/').pop() || `photo_${Date.now()}.jpg`;
      await addFile(uid, { localUri: uri, filename: name, mimeType: 'image/jpeg', type: 'photo', size: typeof fileSize === 'number' ? fileSize : undefined }, addedBy);
      onAdded?.();
      handleClose();
    } catch (e) {
      console.warn('Add photo error:', e);
      Alert.alert('Upload failed', e?.message || 'Could not add photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleVideo = async () => {
    if (!uid) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your library to add videos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setUploading(true);
    try {
      const { uri, fileSize } = result.assets[0];
      const name = uri.split('/').pop() || `video_${Date.now()}.mp4`;
      await addFile(uid, { localUri: uri, filename: name, mimeType: 'video/mp4', type: 'video', size: typeof fileSize === 'number' ? fileSize : undefined }, addedBy);
      onAdded?.();
      handleClose();
    } catch (e) {
      console.warn('Add video error:', e);
      Alert.alert('Upload failed', e?.message || 'Could not add video.');
    } finally {
      setUploading(false);
    }
  };

  const handleDoc = async () => {
    if (!uid) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.*', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true);
      try {
        await addFile(uid, {
          localUri: file.uri,
          filename: file.name || 'document',
          mimeType: file.mimeType || 'application/octet-stream',
          type: file.mimeType?.includes('pdf') ? 'pdf' : 'doc',
          size: typeof file.size === 'number' ? file.size : undefined,
        }, addedBy);
        onAdded?.();
        handleClose();
      } catch (e) {
        console.warn('Add doc error:', e);
        Alert.alert('Upload failed', e?.message || 'Could not add file.');
      } finally {
        setUploading(false);
      }
    } catch (e) {
      console.warn('Document picker error:', e);
    }
  };

  const handleSpreadsheet = async () => {
    if (!uid) return;
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true);
      setUploadProgress(0);
      try {
        await addSpreadsheetFile(uid, {
          localUri: file.uri,
          filename: file.name || 'spreadsheet',
          mimeType: file.mimeType || 'application/octet-stream',
          size: typeof file.size === 'number' ? file.size : undefined,
        }, addedBy, (pct) => setUploadProgress(pct));
        onAdded?.();
        handleClose();
      } catch (e) {
        console.warn('Add spreadsheet error:', e);
        Alert.alert('Upload failed', e?.message || 'Could not add spreadsheet.');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    } catch (e) {
      console.warn('Document picker error:', e);
    }
  };

  const bg = isDark ? 'rgba(15,10,30,0.98)' : 'rgba(248,246,255,0.98)';
  const textColor = isDark ? '#fff' : '#1a1040';
  const muted = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,16,64,0.6)';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={[styles.outer, { backgroundColor: bg }]} onStartShouldSetResponder={() => true}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.inner}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: textColor }]}>Add to Notes & Files</Text>
              <TouchableOpacity onPress={handleClose} hitSlop={12}>
                <Ionicons name="close" size={26} color={muted} />
              </TouchableOpacity>
            </View>

            {uploading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator size="large" color="#a855f7" />
                <Text style={[styles.loadingText, { color: muted }]}>Uploading… {uploadProgress > 0 ? `${uploadProgress}%` : ''}</Text>
                {uploadProgress > 0 && (
                  <View style={[styles.progressBarBg, { backgroundColor: muted }]}>
                    <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                  </View>
                )}
              </View>
            ) : step === 'note' ? (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.noteScroll}>
                <Text style={[styles.noteLabel, { color: muted }]}>Your note</Text>
                <TextInput
                  style={[styles.noteInput, { color: textColor, borderColor: muted }]}
                  placeholder="Type a note…"
                  placeholderTextColor={muted}
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  numberOfLines={4}
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => setStep('picker')}>
                    <Text style={{ color: muted, fontSize: 15 }}>Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAddNote} disabled={!noteText.trim()}>
                    <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.saveNoteBtn}>
                      <Text style={styles.saveNoteBtnText}>Save Note</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : (
              <>
                <View style={styles.optionsGrid}>
                  {OPTIONS.filter((opt) => opt.key !== 'spreadsheet' && (!opt.clientOnly || addedBy === 'client')).map((opt) => (
                    <TouchableOpacity
                      key={opt.key}
                      style={styles.optionCard}
                      onPress={() => {
                        if (opt.key === 'note') setStep('note');
                        else if (opt.key === 'photo') handlePhoto();
                        else if (opt.key === 'video') handleVideo();
                        else if (opt.key === 'doc') handleDoc();
                      }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient colors={opt.gradient} style={styles.optionIconWrap}>
                        <Ionicons name={opt.icon} size={28} color="#fff" />
                      </LinearGradient>
                      <Text style={[styles.optionLabel, { color: textColor }]}>{opt.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {addedBy === 'client' && (
                  <View style={styles.spreadsheetRow}>
                    {OPTIONS.filter((opt) => opt.key === 'spreadsheet').map((opt) => (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.optionCard, { width: '48%' }]}
                        onPress={() => handleSpreadsheet()}
                        activeOpacity={0.85}
                      >
                        <LinearGradient colors={opt.gradient} style={styles.optionIconWrap}>
                          <Ionicons name={opt.icon} size={28} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.optionLabel, { color: textColor }]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* EXTRA TRAINER-ONLY DOC/SPREADSHEET ACTIONS UNDER THE GRID */}
                {addedBy === 'trainer' && (
                  <View style={{ marginTop: 16, gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.optionCard, { flex: 1 }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          onNewDocument?.();
                          handleClose();
                        }}
                      >
                        <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.optionIconWrap}>
                          <Ionicons name="document-text-outline" size={28} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.optionLabel, { color: textColor }]}>New Document</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.optionCard, { flex: 1 }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          onNewSpreadsheet?.();
                          handleClose();
                        }}
                      >
                        <LinearGradient colors={['#10B981', '#059669']} style={styles.optionIconWrap}>
                          <Ionicons name="grid-outline" size={28} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.optionLabel, { color: textColor }]}>New Spreadsheet</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                      <TouchableOpacity
                        style={[styles.optionCard, { flex: 1 }]}
                        activeOpacity={0.85}
                        onPress={() => {
                          onImportSpreadsheet?.();
                          handleClose();
                        }}
                      >
                        <LinearGradient colors={['#06B6D4', '#8B5CF6']} style={styles.optionIconWrap}>
                          <Ionicons name="cloud-upload-outline" size={28} color="#fff" />
                        </LinearGradient>
                        <Text style={[styles.optionLabel, { color: textColor }]}>Import Spreadsheet</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  outer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  inner: { paddingHorizontal: 20, paddingTop: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '800' },
  loadingBlock: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  loadingText: { fontSize: 15 },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  spreadsheetRow: {
    width: '100%',
    alignItems: 'center',
    marginTop: 12,
  },
  optionCard: {
    width: '48%',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  optionIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  optionLabel: { fontSize: 15, fontWeight: '700' },
  noteScroll: { flex: 1 },
  noteLabel: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  noteInput: {
    borderWidth: 1,
    borderRadius: 12,
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
