// Read-only full-screen modal for a trainer's text or rich-text document.
// Flow: modal opens → load users/{trainerId}/documents/{documentId} → show HTML or plain text → share or close.
// Used when someone taps a document in Files.

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { getTrainerDocument } from '../../files-and-notes/saveNotesAndFiles';

// ===== NAMED CONSTANTS =====

const MISSING_LINK_MESSAGE = 'Document link is missing.';
const NOT_FOUND_MESSAGE = 'Document not found';
const LOAD_FAILED_FALLBACK = 'Could not load document';
const UNTITLED_DOCUMENT = 'Document';

// ===== HELPER FUNCTIONS =====

function fieldsFromTrainerDocument(documentRecord, titleProp) {
  return {
    title: documentRecord.title || titleProp || UNTITLED_DOCUMENT,
    body: documentRecord.body || '',
    bodyHtml: typeof documentRecord.bodyHtml === 'string' ? documentRecord.bodyHtml : '',
  };
}

function formatDocumentCreatedDate(date) {
  if (!date) return '';
  const parsedDate = date instanceof Date ? date : new Date(date);
  return parsedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function documentShareUrl(trainerId, documentId) {
  // iOS share sheet uses the message text. Android also gets a deep link.
  if (Platform.OS === 'ios') return undefined;
  return `coachconnect://document/${trainerId}/${documentId}`;
}

// Wraps the stored HTML in the dark page styles. The outer ScrollView scrolls; the WebView does not.
function buildDocumentHtml(bodyHtml) {
  return `<!doctype html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n<style>\n  html,body{margin:0;padding:0;background:#0A0A0F;color:rgba(255,255,255,0.9);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}\n  .wrap{padding:16px;}\n  h1{font-size:28px;line-height:34px;margin:0 0 12px;font-weight:800;font-family:Georgia,serif;color:#fff;}\n  h2{font-size:20px;line-height:26px;margin:18px 0 10px;font-weight:800;color:#fff;}\n  h3{font-size:16px;line-height:22px;margin:16px 0 8px;font-weight:800;color:#fff;}\n  p,li{font-size:15px;line-height:24px;margin:0 0 10px;color:rgba(255,255,255,0.82);}\n  ul,ol{padding-left:20px;margin:8px 0 14px;}\n  blockquote{margin:14px 0;padding:12px 12px 12px 14px;border-left:3px solid #FF6B9D;background:rgba(255,255,255,0.03);border-radius:12px;color:rgba(255,255,255,0.72);font-style:italic;}\n  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:8px;font-size:13px;}\n  a{color:#06B6D4;text-decoration:none;}\n  img{max-width:100%;border-radius:12px;border:1px solid rgba(255,255,255,0.08);}\n  pre{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px;overflow:auto;}\n</style></head><body><div class=\"wrap\">${bodyHtml}</div></body></html>`;
}

async function shareDocument({ trainerName, title, body, trainerId, documentId }) {
  const result = await Share.share({
    message: `Check out this document from ${trainerName || 'your trainer'}: ${title}\n\n${body}`,
    url: documentShareUrl(trainerId, documentId),
  });

  // These branches are intentionally empty. They record share vs dismiss without extra UI.
  if (result.action === Share.sharedAction) {
    if (result.activityType) {
      // user picked a specific app (e.g. Messages)
    } else {
      // shared successfully
    }
  } else if (result.action === Share.dismissedAction) {
    // user closed share sheet
  }
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen reader for one trainer document.
 * @param {object} props
 * @param {boolean} props.visible
 * @param {string} props.trainerId
 * @param {string} props.documentId
 * @param {string} [props.title]
 * @param {string} [props.trainerName]
 * @param {Date|string|number} [props.createdAt]
 * @param {boolean} [props.isDark]
 * @param {Function} props.onClose
 */
export default function DocumentViewer({
  visible,
  trainerId,
  documentId,
  title: titleProp,
  trainerName,
  createdAt,
  isDark: _isDark = true,
  onClose,
}) {
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [title, setTitle] = useState(titleProp || '');
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  // Closing clears the last document so the next open does not flash it.
  // vocab: useEffect cleanup sets isCancelled so a slow fetch cannot write after close.
  useEffect(() => {
    if (!visible) {
      setBody('');
      setBodyHtml('');
      setTitle(titleProp || '');
      setErrorMessage(null);
      setIsLoadingDocument(true);
      return;
    }

    if (!trainerId || !documentId) {
      setErrorMessage(MISSING_LINK_MESSAGE);
      setIsLoadingDocument(false);
      return;
    }

    setTitle(titleProp || UNTITLED_DOCUMENT);
    let isCancelled = false;
    setIsLoadingDocument(true);
    setErrorMessage(null);

    getTrainerDocument(trainerId, documentId)
      .then((documentRecord) => {
        if (!isCancelled && documentRecord) {
          const fields = fieldsFromTrainerDocument(documentRecord, titleProp);
          setTitle(fields.title);
          setBody(fields.body);
          setBodyHtml(fields.bodyHtml);
        } else if (!isCancelled) {
          setErrorMessage(NOT_FOUND_MESSAGE);
        }
        if (!isCancelled) setIsLoadingDocument(false);
      })
      .catch((error) => {
        if (!isCancelled) {
          setErrorMessage(error?.message || LOAD_FAILED_FALLBACK);
          setIsLoadingDocument(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [visible, trainerId, documentId, titleProp]);

  const handleShare = async () => {
    try {
      await shareDocument({ trainerName, title, body, trainerId, documentId });
    } catch (error) {
      Alert.alert('Share failed', 'Could not share document.');
    }
  };

  const createdDateLabel = formatDocumentCreatedDate(createdAt || new Date());

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
            {title || UNTITLED_DOCUMENT}
          </Text>
          <TouchableOpacity onPress={handleShare} style={{ padding: 4 }} hitSlop={12}>
            <Ionicons name="share-outline" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {isLoadingDocument && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <ActivityIndicator size="large" color="#FF6B9D" />
            <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>
              Loading…
            </Text>
          </View>
        )}
        {errorMessage && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Text style={{ fontSize: 15, textAlign: 'center', color: 'rgba(255,255,255,0.8)' }}>{errorMessage}</Text>
          </View>
        )}
        {!isLoadingDocument && !errorMessage && (
          <ScrollView
            style={{ flex: 1, paddingHorizontal: 24, paddingTop: 20 }}
            contentContainerStyle={{ paddingBottom: 20 }}
            showsVerticalScrollIndicator={true}
          >
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: '#fff', marginBottom: 12 }} selectable>
              {title || UNTITLED_DOCUMENT}
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
                  source={{ html: buildDocumentHtml(bodyHtml) }}
                />
              </View>
            ) : (
              <Text style={{ fontSize: 16, lineHeight: 26, color: 'rgba(255,255,255,0.85)' }} selectable>
                {body || 'No content.'}
              </Text>
            )}
            <View style={{ marginTop: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>
                Shared by {trainerName || 'your trainer'} on {createdDateLabel}
              </Text>
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}
