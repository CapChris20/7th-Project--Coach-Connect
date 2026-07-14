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
 * Add: Photo, Video, PDF/Doc (+ trainer create/import options).
 */

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
import { auth } from '../../../app-start/config';
import { addFile, addSpreadsheetFile, uploadTrainerDocumentImport, getTrainerImportedData } from '../../notes-files/manageNotesAndFiles';
import { functions } from '../../../app-start/config';
import { httpsCallable } from 'firebase/functions';

const OPTIONS = [
  { key: 'photo', label: 'Photo', icon: 'image-outline', gradient: ['#C2410C', '#FF6B9D'], group: 'add' },
  { key: 'video', label: 'Video', icon: 'videocam-outline', gradient: ['#C2410C', '#A855F7'], group: 'add' },
  { key: 'doc', label: 'PDF / Doc', icon: 'document-attach-outline', gradient: ['#CA8A04', '#F97316'], group: 'add' },
  {
    key: 'spreadsheet',
    label: 'Spreadsheet',
    icon: 'grid-outline',
    gradient: ['#10B981', '#047857'],
    group: 'add',
    clientOnly: true,
  },
  {
    key: 'newDoc',
    label: 'New Document',
    icon: 'document-text-outline',
    gradient: ['#C2410C', '#A855F7'],
    group: 'create',
    trainerOnly: true,
  },
  {
    key: 'newSheet',
    label: 'New Spreadsheet',
    icon: 'grid-outline',
    gradient: ['#CA8A04', '#F97316'],
    group: 'create',
    trainerOnly: true,
  },
  {
    key: 'import',
    label: 'Import & Parse',
    icon: 'cloud-upload-outline',
    gradient: ['#BE185D', '#C2410C'],
    group: 'import',
    trainerOnly: true,
  },
  {
    key: 'importSheet',
    label: 'Import Sheet',
    icon: 'download-outline',
    gradient: ['#C2410C', '#FF6B9D'],
    group: 'import',
    trainerOnly: true,
  },
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
  const [step, setStep] = useState('picker'); // 'picker' | 'importResult'
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [importStatus, setImportStatus] = useState(''); // uploading | parsing | complete | error
  const [extractedText, setExtractedText] = useState('');
  const [importError, setImportError] = useState('');
  const uid = clientIdProp ?? auth?.currentUser?.uid;
  const addedBy = addedByProp;
  const trainerId = auth?.currentUser?.uid;

  const handleClose = () => {
    setStep('picker');
    setUploading(false);
    setUploadProgress(0);
    setImportStatus('');
    setExtractedText('');
    setImportError('');
    onClose();
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
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const name = String(file.name || '').toLowerCase();
      const mime = String(file.mimeType || '');
      const ok =
        mime.includes('pdf') ||
        mime.includes('msword') ||
        mime.includes('wordprocessingml') ||
        name.endsWith('.pdf') ||
        name.endsWith('.doc') ||
        name.endsWith('.docx');
      if (!ok) {
        Alert.alert('Unsupported file', 'Please choose a PDF or Word document (.pdf, .doc, .docx).');
        return;
      }
      setUploading(true);
      try {
        await addFile(uid, {
          localUri: file.uri,
          filename: file.name || 'document',
          mimeType: file.mimeType || 'application/octet-stream',
          type: mime.includes('pdf') || name.endsWith('.pdf') ? 'pdf' : 'doc',
          size: typeof file.size === 'number' ? file.size : undefined,
        }, addedBy);
        onAdded?.();
        handleClose();
      } catch (e) {
        console.warn('Add doc error:', e);
        Alert.alert('Upload failed', e?.message || 'Could not add file. The file may be corrupted.');
      } finally {
        setUploading(false);
      }
    } catch (e) {
      console.warn('Document picker error:', e);
      Alert.alert('Picker failed', e?.message || 'Could not open the document picker.');
    }
  };

  const handleImportParse = async () => {
    if (!trainerId || addedBy !== 'trainer') {
      Alert.alert('Trainers only', 'Import & parse is available on the trainer Notes & Files flow.');
      return;
    }
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const name = String(file.name || '').toLowerCase();
      const mime = String(file.mimeType || '');
      const ok =
        mime.includes('pdf') ||
        mime.includes('msword') ||
        mime.includes('wordprocessingml') ||
        name.endsWith('.pdf') ||
        name.endsWith('.doc') ||
        name.endsWith('.docx');
      if (!ok) {
        Alert.alert('Unsupported file', 'Please choose a PDF or Word document (.pdf, .doc, .docx).');
        return;
      }
      setUploading(true);
      setImportStatus('uploading');
      setImportError('');
      setExtractedText('');
      try {
        // Keep in Notes & Files library too
        if (uid) {
          await addFile(
            uid,
            {
              localUri: file.uri,
              filename: file.name || 'document',
              mimeType: file.mimeType || 'application/octet-stream',
              type: mime.includes('pdf') || name.endsWith('.pdf') ? 'pdf' : 'doc',
              size: typeof file.size === 'number' ? file.size : undefined,
            },
            'trainer',
          );
        }
        const { importId, storagePath } = await uploadTrainerDocumentImport(
          trainerId,
          {
            localUri: file.uri,
            filename: file.name || 'document',
            mimeType: file.mimeType || 'application/octet-stream',
          },
          (pct) => setUploadProgress(pct),
        );
        setImportStatus('parsing');
        if (functions) {
          const parseFn = httpsCallable(functions, 'parseTrainerDocumentImport');
          await parseFn({ trainerId, importId, storagePath });
        }
        // Poll for complete
        let attempts = 0;
        let data = null;
        while (attempts < 20) {
          await new Promise((r) => setTimeout(r, 800));
          data = await getTrainerImportedData(trainerId, importId);
          if (data?.status === 'complete' || data?.status === 'error') break;
          attempts += 1;
        }
        if (data?.status === 'error') {
          setImportStatus('error');
          setImportError(data.error || 'Parsing failed. The file may be corrupted or unsupported.');
          setStep('importResult');
        } else {
          setImportStatus('complete');
          setExtractedText(data?.extractedText || '(No text extracted)');
          setStep('importResult');
        }
        onAdded?.();
      } catch (e) {
        console.warn('Import parse error:', e);
        setImportStatus('error');
        setImportError(e?.message || 'Import failed. Check the file type and try again.');
        setStep('importResult');
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    } catch (e) {
      console.warn('Document picker error:', e);
      Alert.alert('Picker failed', e?.message || 'Could not open the document picker.');
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

  const bg = isDark ? '#0C0C12' : '#F7F7FB';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF';
  const cardBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(10,10,15,0.08)';
  const textColor = isDark ? '#FFFFFF' : '#0A0A0F';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.5)';
  const sectionLabel = isDark ? 'rgba(255,255,255,0.38)' : 'rgba(10,10,15,0.4)';

  const visibleOptions = OPTIONS.filter(
    (opt) =>
      (!opt.clientOnly || addedBy === 'client') &&
      (!opt.trainerOnly || addedBy === 'trainer'),
  );

  const sections = [
    { id: 'add', title: 'ADD FILES', keys: ['photo', 'video', 'doc', 'spreadsheet'] },
    { id: 'create', title: 'CREATE NEW', keys: ['newDoc', 'newSheet'] },
    { id: 'import', title: 'IMPORT', keys: ['import', 'importSheet'] },
  ]
    .map((section) => ({
      ...section,
      items: section.keys
        .map((key) => visibleOptions.find((o) => o.key === key))
        .filter(Boolean),
    }))
    .filter((section) => section.items.length > 0);

  const handleOptionPress = (key) => {
    if (key === 'photo') handlePhoto();
    else if (key === 'video') handleVideo();
    else if (key === 'doc') handleDoc();
    else if (key === 'import') handleImportParse();
    else if (key === 'spreadsheet') handleSpreadsheet();
    else if (key === 'newDoc') {
      onNewDocument?.();
      handleClose();
    } else if (key === 'newSheet') {
      onNewSpreadsheet?.();
      handleClose();
    } else if (key === 'importSheet') {
      onImportSpreadsheet?.();
      handleClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={handleClose}>
        <View style={[styles.outer, { backgroundColor: bg }]} onStartShouldSetResponder={() => true}>
          <View style={styles.handle} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={80}
            style={styles.inner}
          >
            <View style={styles.header}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.title, { color: textColor }]}>Add to Notes & Files</Text>
                <Text style={[styles.subtitle, { color: muted }]}>
                  Upload media or create a file for Notes & Files
                </Text>
              </View>
              <TouchableOpacity
                onPress={handleClose}
                hitSlop={12}
                style={[styles.closeBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}
              >
                <Ionicons name="close" size={20} color={muted} />
              </TouchableOpacity>
            </View>

            {uploading ? (
              <View style={styles.loadingBlock}>
                <ActivityIndicator size="large" color="#BE185D" />
                <Text style={[styles.loadingText, { color: muted }]}>
                  {importStatus === 'parsing'
                    ? 'Parsing document…'
                    : importStatus === 'uploading'
                      ? `Uploading… ${uploadProgress > 0 ? `${uploadProgress}%` : ''}`
                      : `Uploading… ${uploadProgress > 0 ? `${uploadProgress}%` : ''}`}
                </Text>
                {uploadProgress > 0 && (
                  <View style={[styles.progressBarBg, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}>
                    <View style={[styles.progressBarFill, { width: `${uploadProgress}%` }]} />
                  </View>
                )}
              </View>
            ) : step === 'importResult' ? (
              <ScrollView keyboardShouldPersistTaps="handled" style={styles.noteScroll}>
                <Text style={[styles.noteLabel, { color: muted }]}>
                  {importStatus === 'error' ? 'Import failed' : 'Imported text'}
                </Text>
                {importStatus === 'error' ? (
                  <Text style={{ color: '#F87171', marginBottom: 16, lineHeight: 20 }}>{importError}</Text>
                ) : (
                  <Text style={[styles.noteInput, { color: textColor, borderColor: cardBorder, minHeight: 180 }]}>
                    {extractedText}
                  </Text>
                )}
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={() => setStep('picker')}>
                    <Text style={{ color: muted, fontSize: 15 }}>Back</Text>
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
                    <Text style={[styles.sectionTitle, { color: sectionLabel }]}>{section.title}</Text>
                    <View style={styles.optionsGrid}>
                      {section.items.map((opt, index) => {
                        const isOrphan = section.items.length % 2 === 1 && index === section.items.length - 1;
                        return (
                          <TouchableOpacity
                            key={opt.key}
                            style={[
                              styles.optionCard,
                              { backgroundColor: cardBg, borderColor: cardBorder },
                              isOrphan && styles.optionCardFull,
                            ]}
                            onPress={() => handleOptionPress(opt.key)}
                            activeOpacity={0.85}
                          >
                            <LinearGradient
                              colors={opt.gradient}
                              style={[styles.optionIconWrap, isOrphan && styles.optionIconWrapRow]}
                            >
                              <Ionicons name={opt.icon} size={24} color="#fff" />
                            </LinearGradient>
                            <Text
                              style={[
                                styles.optionLabel,
                                { color: textColor },
                                isOrphan && styles.optionLabelRow,
                              ]}
                              numberOfLines={2}
                            >
                              {opt.label}
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
