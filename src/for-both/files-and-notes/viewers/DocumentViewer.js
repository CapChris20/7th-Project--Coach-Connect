// Design Law full-screen reader for a trainer text / rich-text document.
// Flow: modal opens → load users/{trainerId}/documents/{documentId} → show HTML or plain text → share.
// Used when someone taps a document in Files. Firebase keys unchanged (trainerId, documentId, bodyHtml).
// vocab: NbPageHeader owns status-bar inset; HardShadow wraps the reading card

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Platform,
  Share,
  Alert,
  StyleSheet,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { getTrainerDocument } from '../../files-and-notes/saveNotesAndFiles';
import NbPageHeader from '../../../look-and-feel/NbPageHeader';
import NbButton from '../../../look-and-feel/NbButton';
import HardShadow from '../../../look-and-feel/HardShadow';
import { useTheme } from '../../../look-and-feel/lightDarkMode';
import { borderRadius, nb, spacing } from '../../../look-and-feel/colorPalette';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  if (Platform.OS === 'ios') return undefined;
  return `coachconnect://document/${trainerId}/${documentId}`;
}

/** Theme-aware HTML shell — black/white/gray only (no pink quote border). */
function buildDocumentHtml(bodyHtml, isDark) {
  const bg = isDark ? '#0A0A0F' : '#FFFFFF';
  const ink = isDark ? 'rgba(255,255,255,0.92)' : '#0A0A0F';
  const muted = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.65)';
  const border = isDark ? 'rgba(255,255,255,0.2)' : '#0A0A0F';
  const soft = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,15,0.04)';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;padding:0;background:${bg};color:${ink};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
  .wrap{padding:16px;}
  h1{font-size:28px;line-height:34px;margin:0 0 12px;font-weight:800;color:${ink};}
  h2{font-size:20px;line-height:26px;margin:18px 0 10px;font-weight:800;color:${ink};}
  h3{font-size:16px;line-height:22px;margin:16px 0 8px;font-weight:800;color:${ink};}
  p,li{font-size:15px;line-height:24px;margin:0 0 10px;color:${muted};}
  ul,ol{padding-left:20px;margin:8px 0 14px;}
  blockquote{margin:14px 0;padding:12px 12px 12px 14px;border-left:3px solid ${border};background:${soft};border-radius:10px;color:${muted};font-style:italic;}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:${soft};padding:2px 6px;border-radius:8px;font-size:13px;}
  a{color:${ink};text-decoration:underline;}
  img{max-width:100%;border-radius:12px;border:3px solid ${border};}
  pre{background:${soft};border:1px solid ${border};border-radius:12px;padding:12px;overflow:auto;}
</style></head><body><div class="wrap">${bodyHtml}</div></body></html>`;
}

function DocumentBody({ bodyHtml, body, colors, isDark }) {
  if (bodyHtml) {
    return (
      <View
        style={{
          borderRadius: borderRadius.nbCard,
          overflow: 'hidden',
          borderWidth: nb.borderWidth,
          borderColor: colors.nbBorder,
        }}
      >
        <WebView
          originWhitelist={['*']}
          style={{ height: 520, backgroundColor: colors.nbSurface }}
          scrollEnabled={false}
          source={{ html: buildDocumentHtml(bodyHtml, isDark) }}
        />
      </View>
    );
  }
  const plainBody = body || 'No content.';
  return (
    <Text style={{ fontSize: 16, lineHeight: 26, color: colors.nbInk, fontWeight: '500' }} selectable>
      {plainBody}
    </Text>
  );
}

async function shareDocument({ trainerName, title, body, trainerId, documentId }) {
  await Share.share({
    message: `Check out this document from ${trainerName || 'your trainer'}: ${title}\n\n${body}`,
    url: documentShareUrl(trainerId, documentId),
  });
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen reader for one trainer document.
 */
export default function DocumentViewer({
  visible,
  trainerId,
  documentId,
  title: titleProp,
  trainerName,
  createdAt,
  isDark: _isDarkIgnored = true,
  onClose,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [title, setTitle] = useState(titleProp || '');
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

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
    } catch {
      Alert.alert('Share failed', 'Could not share document.');
    }
  };

  const createdDateLabel = formatDocumentCreatedDate(createdAt || new Date());
  const headingTitle = title || UNTITLED_DOCUMENT;
  const trainerCreditName = trainerName || 'your trainer';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.nbBackground }]}>
        <NbPageHeader title={headingTitle} subtitle="Document" onBack={onClose} />

        {isLoadingDocument ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.nbInk} />
            <Text style={[styles.hint, { color: colors.nbMuted }]}>Loading…</Text>
          </View>
        ) : null}

        {errorMessage ? (
          <View style={styles.center}>
            <Text style={[styles.error, { color: colors.nbInk }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {!isLoadingDocument && !errorMessage ? (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={{
              paddingHorizontal: nb.screenGutter,
              paddingBottom: 24 + insets.bottom,
            }}
            showsVerticalScrollIndicator
          >
            <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
                ]}
              >
                <Text style={[styles.heading, { color: colors.nbInk }]} selectable>
                  {headingTitle}
                </Text>
                <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
                <DocumentBody bodyHtml={bodyHtml} body={body} colors={colors} isDark={isDark} />
                <Text style={[styles.credit, { color: colors.nbMuted }]}>
                  Shared by {trainerCreditName} on {createdDateLabel}
                </Text>
              </View>
            </HardShadow>

            <View style={{ marginTop: spacing.md }}>
              <NbButton variant="plain" onPress={handleShare}>
                Share
              </NbButton>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  hint: { fontSize: 15, fontWeight: '600' },
  error: { fontSize: 15, textAlign: 'center', fontWeight: '600' },
  scroll: { flex: 1 },
  card: {
    borderRadius: borderRadius.nbCard,
    borderWidth: nb.borderWidth,
    padding: 16,
    gap: 12,
  },
  heading: { fontSize: 22, fontWeight: '900' },
  divider: { height: nb.borderWidthDivider, opacity: 0.35 },
  credit: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 8 },
});
