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
const EMPTY_PLAIN_BODY = 'No content.';
const DEFAULT_TRAINER_CREDIT = 'your trainer';
const HEADER_SUBTITLE = 'Document';
const SHARE_FAILED_TITLE = 'Share failed';
const SHARE_FAILED_BODY = 'Could not share document.';
const LOADING_HINT = 'Loading…';
const RICH_TEXT_WEBVIEW_HEIGHT_PX = 520;
const SCROLL_BOTTOM_PADDING_PX = 24;
const DATE_FORMAT_OPTIONS = { year: 'numeric', month: 'long', day: 'numeric' };

// ===== HELPER FUNCTIONS =====

/**
 * Theme-aware HTML shell for rich-text bodyHtml — black/white/gray only (no pink quote border).
 * Letters inside the template are paint tokens for the WebView, not Firestore keys.
 */
function buildDocumentHtmlShell(bodyHtml, isDarkMode) {
  const pageBackground = isDarkMode ? '#0A0A0F' : '#FFFFFF';
  const inkColor = isDarkMode ? 'rgba(255,255,255,0.92)' : '#0A0A0F';
  const mutedColor = isDarkMode ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.65)';
  const borderColor = isDarkMode ? 'rgba(255,255,255,0.2)' : '#0A0A0F';
  const softFill = isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,15,0.04)';

  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html,body{margin:0;padding:0;background:${pageBackground};color:${inkColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}
  .wrap{padding:16px;}
  h1{font-size:28px;line-height:34px;margin:0 0 12px;font-weight:800;color:${inkColor};}
  h2{font-size:20px;line-height:26px;margin:18px 0 10px;font-weight:800;color:${inkColor};}
  h3{font-size:16px;line-height:22px;margin:16px 0 8px;font-weight:800;color:${inkColor};}
  p,li{font-size:15px;line-height:24px;margin:0 0 10px;color:${mutedColor};}
  ul,ol{padding-left:20px;margin:8px 0 14px;}
  blockquote{margin:14px 0;padding:12px 12px 12px 14px;border-left:3px solid ${borderColor};background:${softFill};border-radius:10px;color:${mutedColor};font-style:italic;}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:${softFill};padding:2px 6px;border-radius:8px;font-size:13px;}
  a{color:${inkColor};text-decoration:underline;}
  img{max-width:100%;border-radius:12px;border:3px solid ${borderColor};}
  pre{background:${softFill};border:1px solid ${borderColor};border-radius:12px;padding:12px;overflow:auto;}
</style></head><body><div class="wrap">${bodyHtml}</div></body></html>`;
}

/**
 * Pull the display fields we need from a Firestore document record.
 * Keys title / body / bodyHtml stay as the rest of the app already stores them.
 */
function fieldsFromTrainerDocument(documentRecord, titleFromProps) {
  const hasHtmlString = typeof documentRecord.bodyHtml === 'string';
  const htmlBody = hasHtmlString ? documentRecord.bodyHtml : '';

  return {
    title: documentRecord.title || titleFromProps || UNTITLED_DOCUMENT,
    body: documentRecord.body || '',
    bodyHtml: htmlBody,
  };
}

/**
 * Long-form created date for the credit line under the card.
 */
function formatDocumentCreatedDate(dateValue) {
  if (!dateValue) return '';
  const parsedDate = dateValue instanceof Date ? dateValue : new Date(dateValue);
  return parsedDate.toLocaleDateString(undefined, DATE_FORMAT_OPTIONS);
}

/**
 * Android gets a deep link in Share; iOS uses message body only (url undefined).
 */
function documentShareUrlForPlatform(trainerId, documentId) {
  if (Platform.OS === 'ios') return undefined;
  return `coachconnect://document/${trainerId}/${documentId}`;
}

/**
 * Open the OS share sheet with the document text (+ Android deep link).
 */
async function shareDocumentWithOs({ trainerName, title, body, trainerId, documentId }) {
  const creditName = trainerName || DEFAULT_TRAINER_CREDIT;
  const shareMessage = `Check out this document from ${creditName}: ${title}\n\n${body}`;
  const shareUrl = documentShareUrlForPlatform(trainerId, documentId);

  await Share.share({
    message: shareMessage,
    url: shareUrl,
  });
}

/**
 * Apply missing-link / not-found / success / catch into the reader state setters.
 * isCancelled() guards every setState so a closed modal never writes.
 */
async function loadTrainerDocumentIntoView({
  trainerId,
  documentId,
  titleFromProps,
  isCancelled,
  setTitle,
  setBody,
  setBodyHtml,
  setErrorMessage,
  setIsLoadingDocument,
}) {
  // 1. Missing ids → stop with a friendly message.
  const idsAreMissing = !trainerId || !documentId;
  if (idsAreMissing) {
    if (!isCancelled()) {
      setErrorMessage(MISSING_LINK_MESSAGE);
      setIsLoadingDocument(false);
    }
    return;
  }

  // 2. Show loading chrome before the Firestore round-trip.
  if (!isCancelled()) {
    setTitle(titleFromProps || UNTITLED_DOCUMENT);
    setIsLoadingDocument(true);
    setErrorMessage(null);
  }

  try {
    // vocab: getTrainerDocument = read users/{trainerId}/documents/{documentId}
    const documentRecord = await getTrainerDocument(trainerId, documentId);
    if (isCancelled()) return;

    // 3. Empty record → not found.
    if (!documentRecord) {
      setErrorMessage(NOT_FOUND_MESSAGE);
      setIsLoadingDocument(false);
      return;
    }

    // 4. Push title + body into the reading card.
    const fields = fieldsFromTrainerDocument(documentRecord, titleFromProps);
    setTitle(fields.title);
    setBody(fields.body);
    setBodyHtml(fields.bodyHtml);
    setIsLoadingDocument(false);
  } catch (error) {
    if (isCancelled()) return;
    let friendlyMessage = LOAD_FAILED_FALLBACK;
    if (error && error.message) {
      friendlyMessage = error.message;
    }
    setErrorMessage(friendlyMessage);
    setIsLoadingDocument(false);
  }
}

/**
 * Reset local reader state when the modal is hidden.
 */
function clearReaderStateWhenHidden({
  titleFromProps,
  setBody,
  setBodyHtml,
  setTitle,
  setErrorMessage,
  setIsLoadingDocument,
}) {
  setBody('');
  setBodyHtml('');
  setTitle(titleFromProps || '');
  setErrorMessage(null);
  setIsLoadingDocument(true);
}

// ===== IN-FILE UI PIECES =====

/**
 * Rich HTML via WebView, or selectable plain text when bodyHtml is empty.
 */
function DocumentBody({ bodyHtml, body, colors, isDarkMode }) {
  const hasRichHtml = Boolean(bodyHtml);
  if (hasRichHtml) {
    const htmlSource = { html: buildDocumentHtmlShell(bodyHtml, isDarkMode) };
    const webFrameStyle = {
      borderRadius: borderRadius.nbCard,
      overflow: 'hidden',
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
    };
    const webViewStyle = {
      height: RICH_TEXT_WEBVIEW_HEIGHT_PX,
      backgroundColor: colors.nbSurface,
    };

    return (
      <View style={webFrameStyle}>
        <WebView
          originWhitelist={['*']}
          style={webViewStyle}
          scrollEnabled={false}
          source={htmlSource}
        />
      </View>
    );
  }

  let plainBodyText = EMPTY_PLAIN_BODY;
  if (body) {
    plainBodyText = body;
  }
  const plainTextStyle = {
    fontSize: 16,
    lineHeight: 26,
    color: colors.nbInk,
    fontWeight: '500',
  };

  return (
    <Text style={plainTextStyle} selectable>
      {plainBodyText}
    </Text>
  );
}

function LoadingDocumentState({ inkColor, mutedColor }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={inkColor} />
      <Text style={[styles.hint, { color: mutedColor }]}>{LOADING_HINT}</Text>
    </View>
  );
}

function ErrorDocumentState({ errorMessage, inkColor }) {
  return (
    <View style={styles.center}>
      <Text style={[styles.error, { color: inkColor }]}>{errorMessage}</Text>
    </View>
  );
}

function DocumentReaderScroll({
  headingTitle,
  bodyHtml,
  body,
  colors,
  isDarkMode,
  trainerCreditName,
  createdDateLabel,
  bottomPaddingPixels,
  onSharePress,
}) {
  const contentContainerStyle = {
    paddingHorizontal: nb.screenGutter,
    paddingBottom: bottomPaddingPixels,
  };
  const cardStyle = [
    styles.card,
    { backgroundColor: colors.nbSurface, borderColor: colors.nbBorder },
  ];
  const creditLine = `Shared by ${trainerCreditName} on ${createdDateLabel}`;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator
    >
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View style={cardStyle}>
          <Text style={[styles.heading, { color: colors.nbInk }]} selectable>
            {headingTitle}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.nbBorder }]} />
          <DocumentBody
            bodyHtml={bodyHtml}
            body={body}
            colors={colors}
            isDarkMode={isDarkMode}
          />
          <Text style={[styles.credit, { color: colors.nbMuted }]}>{creditLine}</Text>
        </View>
      </HardShadow>

      <View style={{ marginTop: spacing.md }}>
        <NbButton variant="plain" onPress={onSharePress}>
          Share
        </NbButton>
      </View>
    </ScrollView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Full-screen reader for one trainer document.
 * Hook order frozen: useTheme → useSafeAreaInsets → body → bodyHtml → title → loading → error → effect.
 */
export default function DocumentViewer({
  visible,
  trainerId,
  documentId,
  title: titleFromProps,
  trainerName,
  createdAt,
  isDark: _isDarkIgnored = true,
  onClose,
}) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [body, setBody] = useState('');
  const [bodyHtml, setBodyHtml] = useState('');
  const [title, setTitle] = useState(titleFromProps || '');
  const [isLoadingDocument, setIsLoadingDocument] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    // 1. Modal closed → wipe local state so the next open starts clean.
    if (!visible) {
      clearReaderStateWhenHidden({
        titleFromProps,
        setBody,
        setBodyHtml,
        setTitle,
        setErrorMessage,
        setIsLoadingDocument,
      });
      return;
    }

    // 2. Modal open → fetch the document; cancel flag stops late setState.
    let loadWasCancelled = false;
    const isCancelled = () => loadWasCancelled;

    void loadTrainerDocumentIntoView({
      trainerId,
      documentId,
      titleFromProps,
      isCancelled,
      setTitle,
      setBody,
      setBodyHtml,
      setErrorMessage,
      setIsLoadingDocument,
    });

    return () => {
      loadWasCancelled = true;
    };
  }, [visible, trainerId, documentId, titleFromProps]);

  const handleSharePress = async () => {
    try {
      await shareDocumentWithOs({
        trainerName,
        title,
        body,
        trainerId,
        documentId,
      });
    } catch {
      Alert.alert(SHARE_FAILED_TITLE, SHARE_FAILED_BODY);
    }
  };

  const createdDateLabel = formatDocumentCreatedDate(createdAt || new Date());
  const headingTitle = title || UNTITLED_DOCUMENT;
  const trainerCreditName = trainerName || DEFAULT_TRAINER_CREDIT;
  const shouldShowReader = !isLoadingDocument && !errorMessage;
  const shouldShowLoading = isLoadingDocument === true;
  const shouldShowError = Boolean(errorMessage);
  const bottomPaddingPixels = SCROLL_BOTTOM_PADDING_PX + insets.bottom;
  const screenBackgroundStyle = [styles.container, { backgroundColor: colors.nbBackground }];

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={screenBackgroundStyle}>
        <NbPageHeader title={headingTitle} subtitle={HEADER_SUBTITLE} onBack={onClose} />

        {shouldShowLoading ? (
          <LoadingDocumentState inkColor={colors.nbInk} mutedColor={colors.nbMuted} />
        ) : null}

        {shouldShowError ? (
          <ErrorDocumentState errorMessage={errorMessage} inkColor={colors.nbInk} />
        ) : null}

        {shouldShowReader ? (
          <DocumentReaderScroll
            headingTitle={headingTitle}
            bodyHtml={bodyHtml}
            body={body}
            colors={colors}
            isDarkMode={isDark}
            trainerCreditName={trainerCreditName}
            createdDateLabel={createdDateLabel}
            bottomPaddingPixels={bottomPaddingPixels}
            onSharePress={handleSharePress}
          />
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
