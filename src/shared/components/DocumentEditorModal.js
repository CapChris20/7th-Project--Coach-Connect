/**
 * Trainer document editor — create or edit a document. Save to users/{trainerId}/documents.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { saveTrainerDocument, getTrainerDocument } from '../services/notesAndFilesService';

export default function DocumentEditorModal({
  visible,
  onClose,
  onSaved,
  trainerId,
  documentId = null,
  isDark = true,
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanged, setHasChanged] = useState(false);

  const initialTitle = useRef('');
  const initialBody = useRef('');

  useEffect(() => {
    if (!visible) {
      setTitle('');
      setBody('');
      setSaving(false);
      setLoading(false);
      setHasChanged(false);
      initialTitle.current = '';
      initialBody.current = '';
      return;
    }

    if (documentId && trainerId) {
      setLoading(true);
      getTrainerDocument(trainerId, documentId)
        .then((doc) => {
          if (doc) {
            setTitle(doc.title || '');
            setBody(doc.body || '');
            initialTitle.current = doc.title || '';
            initialBody.current = doc.body || '';
          }
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
      setTitle('');
      setBody('');
      initialTitle.current = '';
      initialBody.current = '';
    }
  }, [visible, documentId, trainerId]);

  useEffect(() => {
    if (visible) {
      setHasChanged(title !== initialTitle.current || body !== initialBody.current);
    }
  }, [title, body, visible]);

  const handleSave = async () => {
    const t = title.trim();
    if (!t) return;
    if (!trainerId) {
      Alert.alert('Error', 'Not signed in as trainer.');
      return;
    }
    setSaving(true);
    try {
      await saveTrainerDocument(trainerId, { id: documentId || undefined, title: t, body: body.trim() });
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert('Failed', e?.message || 'Could not save document.');
    } finally {
      setSaving(false);
    }
  };

  const handleBackPress = () => {
    if (hasChanged) {
      Alert.alert(
        'Unsaved changes',
        'Leave without saving?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleBackPress}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: '#0A0A0F' }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              height: 56,
              borderBottomWidth: 1,
              borderBottomColor: 'rgba(255,255,255,0.07)',
            }}
          >
            <TouchableOpacity
              onPress={handleBackPress}
              style={{ padding: 4 }}
              hitSlop={12}
            >
              <Ionicons name="chevron-back" size={24} color={'#fff'} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff' }}>
              {documentId ? title || 'Edit Document' : 'New Document'}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!title.trim() || saving}
              style={{ minWidth: 56, alignItems: 'flex-end', opacity: !title.trim() || saving ? 0.4 : 1 }}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FF6B9D" />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FF6B9D' }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" color="#FF6B9D" />
            </View>
          ) : (
            <View style={{ flex: 1, paddingTop: 4 }}>
              <TextInput
                style={{
                  paddingHorizontal: 24,
                  paddingTop: 20,
                  paddingBottom: 8,
                  fontSize: 22,
                  fontWeight: 'bold',
                  color: '#fff',
                }}
                placeholder="Document title..."
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={title}
                onChangeText={setTitle}
                editable={!saving}
                multiline={false}
                numberOfLines={1}
                returnKeyType="next"
                // TODO: Implement focus body on submit
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  marginHorizontal: 16,
                  marginVertical: 12,
                }}
              />
              <View
                style={{
                  flex: 1,
                  marginHorizontal: 16,
                  marginTop: 4,
                  marginBottom: 8,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.03)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.06)',
                  paddingVertical: 6,
                }}
              >
                <TextInput
                  style={{
                    flex: 1,
                    paddingHorizontal: 12,
                    paddingTop: 8,
                    fontSize: 16,
                    color: 'rgba(255,255,255,0.95)',
                    lineHeight: 26,
                    textAlignVertical: 'top',
                  }}
                  placeholder="Start writing..."
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={body}
                  onChangeText={setBody}
                  multiline
                  editable={!saving}
                />
              </View>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  height: 48,
                  borderTopWidth: 1,
                  borderTopColor: 'rgba(255,255,255,0.07)',
                  paddingHorizontal: 16,
                }}
              >
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {['Bold', 'Italic', 'Bullet'].map((hint) => (
                    <View
                      key={hint}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderRadius: 8,
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>{hint}</Text>
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={() => { /* TODO: Open share bottom sheet */ }}>
                  <Ionicons name="share-outline" size={22} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
