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
import { WebView } from 'react-native-webview';
import { getTrainerDocument } from '../services/notesAndFilesService';

export default function DocumentViewerModal({ visible, trainerId, documentId, title: titleProp, trainerName, createdAt, isDark = true, onClose }) {
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [title, setTitle] = useState(titleProp || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) {
      setBody('');
      setBodyHtml('');
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
          setBodyHtml(typeof doc.bodyHtml === 'string' ? doc.bodyHtml : '');
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
            {bodyHtml ? (
              <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <WebView
                  originWhitelist={['*']}
                  style={{ height: 520, backgroundColor: '#0A0A0F' }}
                  scrollEnabled={false}
                  source={{
                    html: `<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n<style>\n  html,body{margin:0;padding:0;background:#0A0A0F;color:rgba(255,255,255,0.9);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}\n  .wrap{padding:16px;}\n  h1{font-size:28px;line-height:34px;margin:0 0 12px;font-weight:800;font-family:Georgia,serif;color:#fff;}\n  h2{font-size:20px;line-height:26px;margin:18px 0 10px;font-weight:800;color:#fff;}\n  h3{font-size:16px;line-height:22px;margin:16px 0 8px;font-weight:800;color:#fff;}\n  p,li{font-size:15px;line-height:24px;margin:0 0 10px;color:rgba(255,255,255,0.82);}\n  ul,ol{padding-left:20px;margin:8px 0 14px;}\n  blockquote{margin:14px 0;padding:12px 12px 12px 14px;border-left:3px solid #FF6B9D;background:rgba(255,255,255,0.03);border-radius:12px;color:rgba(255,255,255,0.72);font-style:italic;}\n  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:8px;font-size:13px;}\n  a{color:#06B6D4;text-decoration:none;}\n  img{max-width:100%;border-radius:12px;border:1px solid rgba(255,255,255,0.08);}\n  pre{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;overflow:auto;}\n</style></head><body><div class=\"wrap\">${bodyHtml}</div></body></html>`,
                  }}
                />
              </View>
            ) : (
              <Text style={{ fontSize: 16, lineHeight: 26, color: 'rgba(255,255,255,0.85)' }} selectable>
                {body || 'No content.'}
              </Text>
            )}
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
