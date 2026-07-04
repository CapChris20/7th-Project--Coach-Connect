/**
 * Document Viewer Modal
 *
 * Purpose: UI screen or component: Document Viewer Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/shared
 * Key exports: DocumentViewerModal
 *
 * @file-header
 */
/**
 * DocumentViewerModal — read-only full-screen modal for trainer text/rich-text documents.
 *
 * Used when a client (or trainer) taps a document in Files. Loads content from Firestore
 * via getTrainerDocument(trainerId, documentId) → users/{trainerId}/documents/{documentId}.
 *
 * Props (from parent screen):
 *   visible     — show/hide the modal
 *   trainerId   — owner of the document in Firestore
 *   documentId  — document id under that trainer
 *   title       — optional title before fetch completes (titleProp below)
 *   trainerName — shown in footer + share message
 *   createdAt   — shown in footer
 *   isDark      — reserved for theme (UI is mostly fixed dark today)
 *   onClose     — called when user taps back or Android hardware back
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,           // full-screen overlay
  View,            // layout container
  Text,            // plain text display
  TouchableOpacity,// tappable back / share buttons
  StyleSheet,      // imported but styles are mostly inline in this file
  SafeAreaView,    // keeps content below notch / home indicator
  ActivityIndicator, // spinner while loading
  ScrollView,      // scroll long document body
  Platform,        // iOS vs Android (share URL behavior)
  Share,           // native share sheet
  Alert,           // error toast when share fails
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview'; // renders rich HTML body when present
import { getTrainerDocument } from '../../notes-files/manageNotesAndFiles';

export default function DocumentViewerModal({
  visible,
  trainerId,
  documentId,
  title: titleProp, // rename prop so we can use local state `title` after fetch
  trainerName,
  createdAt,
  isDark = true,
  onClose,
}) {
  // Plain-text fallback body (when doc has no HTML)
  const [body, setBody] = useState('');
  // Rich HTML from trainer editor (headings, lists, etc.)
  const [bodyHtml, setBodyHtml] = useState('');
  // Title from Firestore (or titleProp until loaded)
  const [title, setTitle] = useState(titleProp || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load (or reset) whenever modal opens or ids change
  useEffect(() => {
    // Modal closed → clear state so next open doesn't flash old content
    if (!visible) {
      setBody('');
      setBodyHtml('');
      setTitle(titleProp || '');
      setError(null);
      setLoading(true);
      return;
    }

    // Can't fetch without both ids
    if (!trainerId || !documentId) {
      setError('Document link is missing.');
      setLoading(false);
      return;
    }

    setTitle(titleProp || 'Document');
    let cancelled = false; // ignore late responses if user closes modal quickly
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

    // Cleanup: mark fetch stale if effect re-runs or modal unmounts
    return () => { cancelled = true; };
  }, [visible, trainerId, documentId, titleProp]);

  const handleShare = async () => {
    try {
      const result = await Share.share({
        message: `Check out this document from ${trainerName || 'your trainer'}: ${title}\n\n${body}`,
        // Deep link on Android only; iOS uses message text
        url: Platform.OS === 'ios' ? undefined : `coachconnect://document/${trainerId}/${documentId}`,
      });

      // Optional: branch on share vs dismiss (not required for UX)
      if (result.action === Share.sharedAction) {
        if (result.activityType) {
          // user picked a specific app (e.g. Messages)
        } else {
          // shared successfully
        }
      } else if (result.action === Share.dismissedAction) {
        // user closed share sheet
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
        {/* Top bar: back | title | share */}
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
            {/* Prefer HTML WebView when trainer saved rich content */}
            {bodyHtml ? (
              <View style={{ borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                <WebView
                  originWhitelist={['*']}
                  style={{ height: 520, backgroundColor: '#0A0A0F' }}
                  scrollEnabled={false}
                  source={{
                    // Wrap stored HTML with dark-theme CSS; outer ScrollView scrolls the page
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
