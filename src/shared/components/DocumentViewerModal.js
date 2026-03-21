/**
 * Read-only in-app viewer for trainer-created documents.
 * Fetches body from users/{trainerId}/documents/{documentId}.
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
  Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getTrainerDocument } from '../services/notesAndFilesService';

export default function DocumentViewerModal({ visible, trainerId, documentId, title: titleProp, trainerName, createdAt, isDark = true, onClose }) {
  const [body, setBody] = useState('');
  const [title, setTitle] = useState(titleProp || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) {
      setBody('');
      setTitle(titleProp || '');
      setError(null);
      setLoading(true);
      return;
    }
    if (!trainerId || !documentId) {
      setError('Document link is missing.');
      setLoading(false);
      return;
    }
    setTitle(titleProp || 'Document');
    let cancelled = false;
    setLoading(true);
    setError(null);
    getTrainerDocument(trainerId, documentId)
      .then((doc) => {
        if (!cancelled && doc) {
          setTitle(doc.title || titleProp || 'Document');
          setBody(doc.body || '');
        } else if (!cancelled) {
          setError('Document not found');
        }
        if (!cancelled) setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message || 'Could not load document');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [visible, trainerId, documentId, titleProp]);

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out this document from ${trainerName || 'your trainer'}: ${title}\n\n${body}`,
        url: Platform.OS === 'ios' ? undefined : `coachconnect://document/${trainerId}/${documentId}`,
      });

      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // Shared with activity type of result.activityType
        } else {
          // Shared
        }
      } else if (result.action === Share.dismissedAction) {
        // Dismissed
      }
    } catch (error) {
      Alert.alert('Share failed', 'Could not share document.');
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
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
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={'#fff'} />
          </TouchableOpacity>
          <Text style={{ fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1, textAlign: 'center' }} numberOfLines={1}>
            {title || 'Document'}
          </Text>
          <TouchableOpacity onPress={handleShare} style={{ padding: 4 }} hitSlop={12}>
            <Ionicons name="share-outline" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color="#FF6B9D" />
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
              Loading…
            </Text>
          </View>
        )}
        {error && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ fontSize: 15, textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>{error}</Text>
          </View>
        )}
        {!loading && !error && (
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
          >
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 12 }} selectable>
              {title || 'Document'}
            </Text>
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255,255,255,0.06)',
                marginVertical: 12,
              }}
            />
            <Text style={{ fontSize: 16, lineHeight: 26, color: 'rgba(255,255,255,0.85)' }} selectable>
              {body || 'No content.'}
            </Text>
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Shared by {trainerName || 'your trainer'} on {formatDate(createdAt || new Date())}
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
