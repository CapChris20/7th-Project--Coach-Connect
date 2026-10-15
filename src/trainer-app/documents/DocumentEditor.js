// Trainer document editor modal — rich-text WebView + Firestore autosave.
// Flow: load HTML → edit in WebView → debounce-save to users/{trainerId}/documents → share/export.
// Used by: trainer files screen when opening or creating a document.

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView, Pressable, Share, Keyboard } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { deleteDoc, doc } from 'firebase/firestore';
import { saveTrainerDocument, getTrainerDocument } from '../../for-both/files-and-notes/saveNotesAndFiles';
import { db } from '../../app-start/cloudConnection';
import ShareDocumentPopup from './ShareDocumentPopup';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import { SHELL_SAFE_AREA_EDGES } from '../../navigation/bottomMenuSpacing';
import { EditorIconButton, EditorInlineTitle, DEFAULT_SAVE_TITLE_DOCUMENT } from './EditorTopButtons';
import { EDITOR_HIGHLIGHT_COLORS, EDITOR_TEXT_COLORS, FONT_SIZES, getEditorTheme } from './editorColors';
import { EditorGradientPill } from './editorAccent';

// ===== NAMED CONSTANTS =====

const EMPTY_HTML = '<p><br></p>';
const AUTOSAVE_DEBOUNCE_MS = 1200;
const TITLE_SAVE_DEBOUNCE_MS = 600;
const SAVED_STATUS_FLASH_MS = 250;
const THEME_HTML_REAPPLY_MS = 200;
const LOAD_HTML_DELAY_MS = 120;
const WEBVIEW_BOOT_EMIT_MS = 50;
const MAX_WORD_COUNT_CLAMP = 999999;
const MAX_CHAR_COUNT_CLAMP = 9999999;
const DEFAULT_FONT_SIZE_PX = 16;
const DARK_DEFAULT_TEXT_COLOR = '#FFFFFF';
const LIGHT_DEFAULT_TEXT_COLOR = '#0A0A0F';

// ===== HELPER FUNCTIONS =====

/**
 * Keep a number inside a min/max band.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Strip tags/entities so we can store a plain-text body alongside HTML.
 * @param {string} html
 * @returns {string}
 */
function htmlToPlainText(html) {
  const plainText = String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return plainText;
}

/**
 * @returns {Date}
 */
function now() {
  return new Date();
}

/**
 * Title used when saving — blank titles become the default document name.
 * @param {string} raw
 * @returns {string}
 */
function saveTitle(raw) {
  const trimmedTitle = String(raw || '').trim();
  return trimmedTitle || DEFAULT_SAVE_TITLE_DOCUMENT;
}

/**
 * Clamp word/char counts from the WebView so a bad payload cannot blow up UI.
 * @param {object} payload
 * @returns {{ words: number, chars: number }}
 */
function countsFromWebPayload(payload) {
  return {
    words: clamp(Number(payload?.words || 0), 0, MAX_WORD_COUNT_CLAMP),
    chars: clamp(Number(payload?.chars || 0), 0, MAX_CHAR_COUNT_CLAMP),
  };
}

/**
 * Merge WebView STATE flags into the toolbar highlight object.
 * @param {object} previous
 * @param {object} statePayload
 * @returns {object}
 */
function toolStateFromWebPayload(previous, statePayload) {
  return {
    ...previous,
    bold: !!statePayload.bold,
    italic: !!statePayload.italic,
    underline: !!statePayload.underline,
    strike: !!statePayload.strike,
    alignLeft: !!statePayload.alignLeft,
    alignCenter: !!statePayload.alignCenter,
    alignRight: !!statePayload.alignRight,
    alignJustify: !!statePayload.alignJustify,
    h1: !!statePayload.h1,
    h2: !!statePayload.h2,
    h3: !!statePayload.h3,
    ul: !!statePayload.ul,
    ol: !!statePayload.ol,
    checkbox: !!statePayload.checkbox,
    quote: !!statePayload.quote,
    code: !!statePayload.code,
    link: !!statePayload.link,
    canUndo: statePayload.canUndo !== false,
    canRedo: statePayload.canRedo !== false,
  };
}

/**
 * Apply one WebView message (content update or toolbar state).
 * @param {object} msg
 * @param {object} handlers
 */
function applyWebViewMessage(msg, handlers) {
  if (msg?.type === 'UPDATE') {
    handlers.onContentUpdate(msg.payload || {});
    return;
  }
  if (msg?.type === 'STATE') {
    handlers.onToolbarState(msg.payload || {});
  }
}

/**
 * Push HTML into the editor WebView (safe if the bridge is not ready yet).
 * @param {{ current: * }} webRef
 * @param {string} html
 */
function postHtmlToWebView(webRef, html) {
  try {
    webRef.current?.postMessage(
      JSON.stringify({ type: 'SET_HTML', payload: { html } }),
    );
  } catch (_error) {
    // WebView may be unmounted mid-send — ignore.
  }
}

/**
 * Remember HTML locally, then send it to the WebView after a short delay
 * so the bridge is ready after open / theme change.
 * @param {{ current: string }} lastUpdateHtmlRef
 * @param {{ current: * }} webRef
 * @param {string} html
 * @param {number} delayMs
 */
function applyHtml(lastUpdateHtmlRef, webRef, html, delayMs) {
  lastUpdateHtmlRef.current = html;
  setTimeout(() => {
    postHtmlToWebView(webRef, html);
  }, delayMs);
}

/**
 * Resolve stored document body into editor HTML.
 * Prefer bodyHtml; fall back to wrapping plain body; else empty page.
 * @param {object|null|undefined} loadedDoc
 * @returns {string}
 */
function htmlFromLoadedDocument(loadedDoc) {
  if (!loadedDoc) return EMPTY_HTML;
  const bodyHtml = loadedDoc.bodyHtml;
  if (typeof bodyHtml === 'string' && bodyHtml.trim()) return bodyHtml;
  if (loadedDoc.body) {
    return `<p>${String(loadedDoc.body).replace(/\n/g, '<br/>')}</p>`;
  }
  return EMPTY_HTML;
}

/**
 * Title field shows blank when the stored title is still the default placeholder.
 * @param {object} loadedDoc
 * @returns {string}
 */
function titleFromLoadedDocument(loadedDoc) {
  if (!loadedDoc?.title) return '';
  if (loadedDoc.title === DEFAULT_SAVE_TITLE_DOCUMENT) return '';
  return loadedDoc.title;
}

/**
 * Apply a fetched document onto React state + the WebView.
 * @param {object|null|undefined} loadedDoc
 * @param {object} setters
 * @param {(html: string) => void} sendHtml
 */
function fillEditorFromLoadedDocument(loadedDoc, setters, sendHtml) {
  if (!loadedDoc) {
    clearEditorContent(setters, sendHtml);
    return;
  }
  setters.setTitle(titleFromLoadedDocument(loadedDoc));
  setters.setFavorite(!!loadedDoc.isFavorite);
  setters.setSharedWith(
    Array.isArray(loadedDoc.sharedWith) ? loadedDoc.sharedWith : [],
  );
  sendHtml(htmlFromLoadedDocument(loadedDoc));
}

/**
 * Blank title / favorite / share list and empty HTML page.
 * @param {object} setters
 * @param {(html: string) => void} sendHtml
 */
function clearEditorContent(setters, sendHtml) {
  setters.setTitle('');
  setters.setFavorite(false);
  setters.setSharedWith([]);
  sendHtml(EMPTY_HTML);
}

/**
 * Reset chrome state when the modal opens, then load or blank the document.
 * @param {object} args
 */
function loadDocumentWhenVisible({
  documentId,
  trainerId,
  mountedRef,
  lastUpdateHtmlRef,
  webRef,
  setters,
}) {
  // 1. Reset header / counters for a fresh open.
  setters.setDocId(documentId || null);
  setters.setStatus('saved');
  setters.setLastSaved(now());
  setters.setCounts({ words: 0, chars: 0 });
  setters.setFontSize(DEFAULT_FONT_SIZE_PX);
  setters.setPicker(null);
  setters.setPrompt({ visible: false, kind: null, value: '' });
  setters.setShowShare(false);

  const sendHtml = (html) => {
    applyHtml(lastUpdateHtmlRef, webRef, html, LOAD_HTML_DELAY_MS);
  };

  // 2. Existing doc → fetch from Firestore; new doc → empty page.
  if (!documentId || !trainerId) {
    clearEditorContent(setters, sendHtml);
    return;
  }

  setters.setLoading(true);
  getTrainerDocument(trainerId, documentId)
    .then((loadedDoc) => {
      if (!mountedRef.current) return;
      fillEditorFromLoadedDocument(loadedDoc, setters, sendHtml);
    })
    .catch(() => {})
    .finally(() => {
      if (mountedRef.current) setters.setLoading(false);
    });
}

function ToolButton({
  icon,
  active,
  disabled,
  onPress,
  theme
}) {
  const hitProps = {
    onPress,
    disabled,
    activeOpacity: 0.7,
    style: [styles.toolBtn, {
      opacity: disabled ? 0.35 : 1
    }]
  };
  if (active) {
    return <EditorGradientPill radius={8} style={styles.toolBtn} backgroundColor={theme?.accentSoft}>
        <TouchableOpacity {...hitProps}>{icon}</TouchableOpacity>
      </EditorGradientPill>;
  }
  return <TouchableOpacity {...hitProps}>{icon}</TouchableOpacity>;
}
function Divider({
  theme
}) {
  return <View style={[styles.divider, {
    backgroundColor: theme.divider
  }]} />;
}
function GlyphButton({
  label,
  active,
  disabled,
  onPress,
  theme,
  style
}) {
  return <ToolButton theme={theme} active={active} disabled={disabled} onPress={onPress} icon={<Text style={[styles.toolGlyph, {
    color: active ? theme.text : theme.textMuted
  }, style]}>
          {label}
        </Text>} />;
}
function IonTool({
  name,
  active,
  disabled,
  onPress,
  theme,
  size = 17
}) {
  return <ToolButton theme={theme} active={active} disabled={disabled} onPress={onPress} icon={<Ionicons name={name} size={size} color={active ? theme.text : theme.textMuted} />} />;
}
function buildEditorHtml2({
  theme,
  initialHtml
}) {
  const pageBg = theme.printPageBg || '#FFFFFF';
  const canvasBg = theme.printCanvasBg || '#E8EAED';
  const fg = theme.printPageText || '#202124';
  const subtle = 'rgba(60,64,67,0.2)';
  const accent = theme.selectionBorder;
  const linkColor = '#1A73E8';
  const codeBg = '#F1F3F4';
  const pageShadow = '0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)';
  const pageMuted = theme.printPageMuted || '#5F6368';
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      * { box-sizing: border-box; }
      html, body {
        margin: 0;
        padding: 0;
        background: ${canvasBg};
        color: ${fg};
        min-height: 100%;
        -webkit-text-size-adjust: 100%;
      }
      body {
        font-family: 'Google Sans', Roboto, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        padding: 20px 14px 48px;
      }
      .page {
        margin: 0 auto 24px;
        width: calc(100% - 4px);
        max-width: 816px;
        background: ${pageBg};
        min-height: calc((100vw - 28px) * 1.294);
        box-shadow: ${pageShadow};
        border-radius: 0;
        border: none;
        padding: 72px 56px 80px;
      }
      .page:last-child { margin-bottom: 0; }
      @media (max-width: 600px) {
        body { padding: 16px 12px 40px; }
        .page {
          width: 100%;
          padding: 56px 40px 64px;
          min-height: calc((100vw - 24px) * 1.294);
        }
      }
      #editor {
        outline: none;
        min-height: calc((100vw - 28px) * 1.294 - 136px);
        caret-color: ${accent};
        font-size: 11pt;
        line-height: 1.5;
        color: ${fg};
        font-family: inherit;
        word-break: break-word;
      }
      #editor:empty:before {
        content: 'Start typing…';
        color: ${pageMuted};
        pointer-events: none;
      }
      h1 { font-size: 28px; line-height: 1.25; margin: 0 0 12px; font-weight: 800; font-family: inherit; }
      h2 { font-size: 22px; line-height: 1.3; margin: 18px 0 8px; font-weight: 800; font-family: inherit; }
      h3 { font-size: 18px; line-height: 1.35; margin: 14px 0 6px; font-weight: 700; font-family: inherit; }
      p, li { font-size: 16px; line-height: 1.65; margin: 0 0 8px; }
      ul, ol { padding-left: 22px; margin: 8px 0 12px; }
      ul.checklist { list-style: none; padding-left: 8px; }
      ul.checklist li { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 6px; }
      ul.checklist input { margin-top: 4px; accent-color: ${accent}; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      td, th { border: 1px solid ${subtle}; padding: 8px 10px; min-width: 48px; }
      th { background: ${codeBg}; font-weight: 700; }
      hr { border: none; border-top: 1px solid ${subtle}; margin: 16px 0; }
      blockquote { margin: 12px 0; padding: 10px 12px; border-left: 3px solid ${accent}; background: ${codeBg}; border-radius: 8px; font-style: italic; opacity: 0.92; }
      code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: ${codeBg}; padding: 2px 6px; border-radius: 6px; font-size: 13px; }
      pre { background: ${codeBg}; border: 1px solid ${subtle}; border-radius: 10px; padding: 12px; overflow: auto; }
      a { color: ${linkColor}; text-decoration: none; }
      img { max-width: 100%; border-radius: 8px; border: 1px solid ${subtle}; }
    </style>
  </head>
  <body>
    <div class="page"><div id="editor" contenteditable="true">${initialHtml || EMPTY_HTML}</div></div>
    <script>
      const editor = document.getElementById('editor');
      const post = (type, payload) => {
        try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload })); } catch(e) {}
      };
      const getHtml = () => editor.innerHTML || '';
      const getText = () => (editor.innerText || '').replace(/\\u200B/g, '').trim();
      const counts = () => {
        const t = getText();
        const words = t ? t.split(/\\s+/).filter(Boolean).length : 0;
        const chars = t ? t.length : 0;
        return { words, chars };
      };
      const isActive = (cmd) => { try { return document.queryCommandState(cmd); } catch(e) { return false; } };
      const queryAlign = () => {
        if (isActive('justifyFull')) return 'justify';
        if (isActive('justifyCenter')) return 'center';
        if (isActive('justifyRight')) return 'right';
        return 'left';
      };
      const activeHeading = () => {
        const sel = window.getSelection();
        if (!sel || !sel.anchorNode) return 0;
        let n = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
        while (n && n !== editor) {
          const tag = (n.tagName || '').toLowerCase();
          if (tag === 'h1') return 1;
          if (tag === 'h2') return 2;
          if (tag === 'h3') return 3;
          n = n.parentElement;
        }
        return 0;
      };
      const activeBlock = () => {
        const sel = window.getSelection();
        if (!sel || !sel.anchorNode) return { quote:false, pre:false, ul:false, ol:false, link:false };
        let n = sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement;
        let quote=false, pre=false, ul=false, ol=false, link=false, checkbox=false;
        while (n && n !== editor) {
          const tag = (n.tagName || '').toLowerCase();
          if (tag === 'blockquote') quote = true;
          if (tag === 'pre') pre = true;
          if (tag === 'ul') {
            ul = true;
            if (n.classList && n.classList.contains('checklist')) checkbox = true;
          }
          if (tag === 'ol') ol = true;
          if (tag === 'a') link = true;
          n = n.parentElement;
        }
        return { quote, pre, ul, ol, link, checkbox };
      };
      const sendState = () => {
        const h = activeHeading();
        const b = activeBlock();
        post('STATE', {
          bold: isActive('bold'),
          italic: isActive('italic'),
          underline: isActive('underline'),
          strike: isActive('strikeThrough'),
          alignLeft: queryAlign() === 'left',
          alignCenter: queryAlign() === 'center',
          alignRight: queryAlign() === 'right',
          alignJustify: queryAlign() === 'justify',
          h1: h === 1, h2: h === 2, h3: h === 3,
          ul: b.ul && !b.checkbox, ol: b.ol, checkbox: b.checkbox, quote: b.quote, code: b.pre, link: b.link,
          canUndo: true, canRedo: true,
          ...counts(),
        });
      };
      const emitUpdate = () => {
        post('UPDATE', { html: getHtml(), text: getText(), ...counts() });
        sendState();
      };
      const exec = (cmd, value=null) => {
        document.execCommand(cmd, false, value);
        emitUpdate();
      };
      const applyFontSize = (px) => {
        document.execCommand('styleWithCSS', false, true);
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        if (range.collapsed) {
          document.execCommand('fontSize', false, '3');
          const fontElements = editor.querySelectorAll('font[size]');
          fontElements.forEach((el) => { el.removeAttribute('size'); el.style.fontSize = px + 'px'; });
        } else {
          const span = document.createElement('span');
          span.style.fontSize = px + 'px';
          try { range.surroundContents(span); }
          catch(e) { span.appendChild(range.extractContents()); range.insertNode(span); }
        }
        emitUpdate();
      };
      window.__RN = { setHtml: (html) => { editor.innerHTML = html || ${JSON.stringify(EMPTY_HTML)}; emitUpdate(); } };
      window.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse(e.data || '{}');
          const p = msg.payload || {};
          if (msg.type === 'CMD') {
            const { name, value } = p;
            if (name === 'heading') {
              const tag = value === 1 ? 'H1' : value === 2 ? 'H2' : value === 3 ? 'H3' : 'P';
              return exec('formatBlock', tag);
            }
            if (name === 'fontSize') return applyFontSize(Number(value) || 16);
            if (name === 'foreColor') return exec('foreColor', value);
            if (name === 'hiliteColor') return exec('hiliteColor', value);
            if (name === 'alignLeft') return exec('justifyLeft');
            if (name === 'alignCenter') return exec('justifyCenter');
            if (name === 'alignRight') return exec('justifyRight');
            if (name === 'alignJustify') return exec('justifyFull');
            if (name === 'blockquote') return exec('formatBlock', 'BLOCKQUOTE');
            if (name === 'codeblock') return exec('formatBlock', 'PRE');
            if (name === 'divider') return exec('insertHorizontalRule');
            if (name === 'table') {
              return exec('insertHTML', '<table><tbody><tr><th>Header</th><th>Header</th></tr><tr><td>Cell</td><td>Cell</td></tr></tbody></table>');
            }
            if (name === 'checkbox') {
              return exec('insertHTML', '<ul class="checklist"><li><input type="checkbox" /> <span>Task item</span></li></ul>');
            }
            if (name === 'bold') return exec('bold');
            if (name === 'italic') return exec('italic');
            if (name === 'underline') return exec('underline');
            if (name === 'strike') return exec('strikeThrough');
            if (name === 'ul') return exec('insertUnorderedList');
            if (name === 'ol') return exec('insertOrderedList');
            if (name === 'undo') return exec('undo');
            if (name === 'redo') return exec('redo');
            if (name === 'clear') { exec('removeFormat'); exec('formatBlock', 'P'); return; }
            if (name === 'link') { if (!value) return; exec('createLink', value); return; }
            if (name === 'unlink') return exec('unlink');
            if (name === 'image') { if (!value) return; exec('insertImage', value); return; }
          }
          if (msg.type === 'SET_HTML') { window.__RN.setHtml(p.html || ''); return; }
          if (msg.type === 'FOCUS') { editor.focus(); return; }
        } catch(e) {}
      });
      editor.addEventListener('input', emitUpdate);
      editor.addEventListener('click', sendState);
      document.addEventListener('selectionchange', sendState);
      setTimeout(emitUpdate, 50);
    </script>
  </body>
</html>`;
}
// ===== MAIN FUNCTION =====

/**
 * Full-screen rich-text document editor for trainers.
 * @param {object} props
 */
export default function DocumentEditor({
  visible,
  onClose,
  onSaved,
  trainerId,
  documentId = null,
  isDark = true,
  trainerNavChrome = null
}) {
  const webRef = useRef(null);
  const titleInputRef = useRef(null);
  const saveTimer = useRef(null);
  const lastUpdateHtml = useRef('');
  const mounted = useRef(false);
  const [docId, setDocId] = useState(documentId || null);
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('saved');
  const [favorite, setFavorite] = useState(false);
  const [sharedWith, setSharedWith] = useState([]);
  const [lastSaved, setLastSaved] = useState(now());
  const [loading, setLoading] = useState(false);
  const [editorColorsMode, setEditorThemeMode] = useState(isDark ? 'dark' : 'light');
  const [counts, setCounts] = useState({
    words: 0,
    chars: 0
  });
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('transparent');
  const [titleFocused, setTitleFocused] = useState(false);
  const [toolState, setToolState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    alignLeft: true,
    alignCenter: false,
    alignRight: false,
    alignJustify: false,
    h1: false,
    h2: false,
    h3: false,
    ul: false,
    ol: false,
    checkbox: false,
    quote: false,
    code: false,
    link: false,
    canUndo: true,
    canRedo: true
  });
  const [showShare, setShowShare] = useState(false);
  const [picker, setPicker] = useState(null); // 'fontSize' | 'textColor' | 'highlight' | null
  const [prompt, setPrompt] = useState({
    visible: false,
    kind: null,
    value: ''
  });
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isEditorDark = editorColorsMode === 'dark';
  const theme = useMemo(() => getEditorTheme(isEditorDark), [isEditorDark]);
  const insets = useSafeAreaInsets();
  const editorHtml = useMemo(() => buildEditorHtml2({
    theme,
    initialHtml: EMPTY_HTML
  }), [theme]);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  useEffect(() => {
    if (!visible) return;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [visible]);
  useEffect(() => {
    if (visible) setEditorThemeMode(isDark ? 'dark' : 'light');
  }, [visible, isDark]);
  useEffect(() => {
    setTextColor(isEditorDark ? '#FFFFFF' : '#0A0A0F');
  }, [isEditorDark]);
  useEffect(() => {
    if (!visible || loading) return;
    const html = lastUpdateHtml.current || EMPTY_HTML;
    setTimeout(() => {
      postHtmlToWebView(webRef, html);
    }, THEME_HTML_REAPPLY_MS);
  }, [isEditorDark, visible, loading]);

  useEffect(() => {
    if (!visible) return;
    loadDocumentWhenVisible({
      documentId,
      trainerId,
      mountedRef: mounted,
      lastUpdateHtmlRef: lastUpdateHtml,
      webRef,
      setters: {
        setDocId,
        setStatus,
        setLastSaved,
        setCounts,
        setFontSize,
        setPicker,
        setPrompt,
        setShowShare,
        setLoading,
        setTitle,
        setFavorite,
        setSharedWith,
      },
    });
  }, [visible, documentId, trainerId]);
  const postCmd = useCallback((name, value) => {
    const msg = JSON.stringify({
      type: 'CMD',
      payload: {
        name,
        value
      }
    });
    try {
      webRef.current?.postMessage(msg);
    } catch (_) {}
    try {
      webRef.current?.injectJavaScript?.(`window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(msg)} })); true;`);
    } catch (_) {}
  }, []);
  const queueSave = useCallback((html, plainText) => {
    if (!trainerId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setStatus('unsaved');
    saveTimer.current = setTimeout(async () => {
      if (!mounted.current) return;
      setStatus('saving');
      try {
        const documentTitle = saveTitle(title);
        const res = await saveTrainerDocument(trainerId, {
          id: docId || undefined,
          title: documentTitle,
          body: String(plainText || '').trim(),
          bodyHtml: String(html || '')
        });
        if (!mounted.current) return;
        if (!docId && res?.id) setDocId(res.id);
        setTimeout(() => {
          if (!mounted.current) return;
          setStatus('saved');
          setLastSaved(now());
          onSaved?.();
        }, SAVED_STATUS_FLASH_MS);
      } catch (e) {
        if (mounted.current) setStatus('unsaved');
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [trainerId, docId, title, onSaved]);
  const handleWebMessage = useCallback((event) => {
    try {
      const msg = JSON.parse(event?.nativeEvent?.data || '{}');
      applyWebViewMessage(msg, {
        onContentUpdate: (payload) => {
          const html = String(payload?.html || '');
          const text = String(payload?.text || '');
          setCounts(countsFromWebPayload(payload));
          lastUpdateHtml.current = html;
          queueSave(html, text);
        },
        onToolbarState: (statePayload) => {
          setToolState((previous) => toolStateFromWebPayload(previous, statePayload));
          const hasWordCount = typeof statePayload.words === 'number';
          const hasCharCount = typeof statePayload.chars === 'number';
          if (!hasWordCount && !hasCharCount) return;
          setCounts(countsFromWebPayload(statePayload));
        },
      });
    } catch (_error) {
      // Malformed WebView JSON is ignored — keep editing.
    }
  }, [queueSave]);
  const handleBackPress = () => {
    if (status === 'unsaved' || status === 'saving') {
      Alert.alert('Unsaved changes', 'Leave without saving?', [{
        text: 'Cancel',
        style: 'cancel'
      }, {
        text: 'Leave',
        style: 'destructive',
        onPress: onClose
      }]);
      return;
    }
    onClose();
  };
  const handleRename = () => {
    titleInputRef.current?.focus();
  };
  const handleExportPdf = async () => {
    try {
      const html = lastUpdateHtml.current || EMPTY_HTML;
      const fileName = `${String(title || 'document').replace(/[^a-z0-9_-]/gi, '_')}.html`;
      const path = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(path, `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`, {
        encoding: FileSystem.EncodingType.UTF8
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/html',
          dialogTitle: 'Export document'
        });
      } else {
        await Share.share({
          message: htmlToPlainText(html),
          title
        });
      }
    } catch (e) {
      Alert.alert('Export failed', e?.message || 'Could not export document.');
    }
  };
  const handleDuplicate = async () => {
    if (!trainerId) return;
    try {
      setStatus('saving');
      const res = await saveTrainerDocument(trainerId, {
        title: `${saveTitle(title)} (copy)`,
        body: htmlToPlainText(lastUpdateHtml.current),
        bodyHtml: lastUpdateHtml.current || EMPTY_HTML
      });
      Alert.alert('Duplicated', 'A copy was saved to your documents.');
      if (res?.id) setDocId(res.id);
      setStatus('saved');
      setLastSaved(now());
      onSaved?.();
    } catch (e) {
      setStatus('unsaved');
      Alert.alert('Duplicate failed', e?.message || 'Could not duplicate document.');
    }
  };
  const handleDelete = () => {
    if (!trainerId || !docId) {
      Alert.alert('Save first', 'Save the document before deleting.');
      return;
    }
    Alert.alert('Delete document?', 'This cannot be undone.', [{
      text: 'Cancel',
      style: 'cancel'
    }, {
      text: 'Delete',
      style: 'destructive',
      onPress: async () => {
        try {
          await deleteDoc(doc(db, 'users', String(trainerId), 'documents', String(docId)));
          onClose();
          onSaved?.();
        } catch (e) {
          Alert.alert('Delete failed', e?.message || 'Could not delete document.');
        }
      }
    }]);
  };
  const handleSharePress = () => {
    if (!docId) {
      Alert.alert('Save first', 'Type a bit so the document is saved before sharing.');
      return;
    }
    setShowShare(true);
  };
  const openMoreMenu = () => {
    Alert.alert('Document', undefined, [{
      text: 'Rename',
      onPress: handleRename
    }, {
      text: favorite ? 'Remove favorite' : 'Add favorite',
      onPress: () => setFavorite(v => !v)
    }, {
      text: isEditorDark ? 'Light mode' : 'Dark mode',
      onPress: () => setEditorThemeMode(t => t === 'dark' ? 'light' : 'dark')
    }, {
      text: `Word count (${counts.words} words)`,
      onPress: () => Alert.alert('Word count', `${counts.words} words · ${counts.chars} characters`)
    }, {
      text: 'Export',
      onPress: handleExportPdf
    }, {
      text: 'Duplicate',
      onPress: handleDuplicate
    }, {
      text: 'Delete',
      style: 'destructive',
      onPress: handleDelete
    }, {
      text: 'Cancel',
      style: 'cancel'
    }]);
  };
  const openStyleMenu = () => {
    Alert.alert('Text style', undefined, [{
      text: 'Normal',
      onPress: () => postCmd('heading', 0)
    }, {
      text: 'Title',
      onPress: () => postCmd('heading', 1)
    }, {
      text: 'Subtitle',
      onPress: () => postCmd('heading', 2)
    }, {
      text: 'Heading',
      onPress: () => postCmd('heading', 3)
    }, {
      text: 'Cancel',
      style: 'cancel'
    }]);
  };
  const openInsertMenu = () => {
    Alert.alert('Insert', undefined, [{
      text: 'Link',
      onPress: () => setPrompt({
        visible: true,
        kind: 'link',
        value: 'https://'
      })
    }, {
      text: 'Image',
      onPress: () => setPrompt({
        visible: true,
        kind: 'image',
        value: ''
      })
    }, {
      text: 'Bulleted list',
      onPress: () => postCmd('ul')
    }, {
      text: 'Numbered list',
      onPress: () => postCmd('ol')
    }, {
      text: 'Quote',
      onPress: () => postCmd('blockquote')
    }, {
      text: 'Cancel',
      style: 'cancel'
    }]);
  };
  const nav = trainerNavChrome;
  const iconColor = active => active ? theme.text : theme.textMuted;
  const renderFormatToolbar = () => <View style={styles.formatDock}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarScroll} contentContainerStyle={styles.toolbarRow} keyboardShouldPersistTaps="handled">
        <ToolButton theme={theme} active={picker === 'fontSize' || toolState.h1 || toolState.h2 || toolState.h3} onPress={openStyleMenu} icon={<Text style={[styles.toolGlyph, {
        color: theme.textMuted,
        fontWeight: '700'
      }]}>Aa</Text>} />
        <GlyphButton theme={theme} label="B" active={toolState.bold} onPress={() => postCmd('bold')} style={{
        fontWeight: '800'
      }} />
        <GlyphButton theme={theme} label="I" active={toolState.italic} onPress={() => postCmd('italic')} style={{
        fontStyle: 'italic',
        fontWeight: '700'
      }} />
        <GlyphButton theme={theme} label="U" active={toolState.underline} onPress={() => postCmd('underline')} style={{
        textDecorationLine: 'underline',
        fontWeight: '700'
      }} />
        <Divider theme={theme} />
        <ToolButton theme={theme} active={picker === 'textColor'} onPress={() => setPicker(p => p === 'textColor' ? null : 'textColor')} icon={<Ionicons name="text-outline" size={17} color={iconColor(picker === 'textColor')} />} />
        <ToolButton theme={theme} active={picker === 'highlight'} onPress={() => setPicker(p => p === 'highlight' ? null : 'highlight')} icon={<Ionicons name="color-fill-outline" size={17} color={iconColor(picker === 'highlight')} />} />
        <Divider theme={theme} />
        <IonTool theme={theme} name="list-outline" active={toolState.ul} onPress={() => postCmd('ul')} />
        <IonTool theme={theme} name="reorder-four-outline" active={toolState.ol} onPress={() => postCmd('ol')} />
        <IonTool theme={theme} name="link-outline" active={toolState.link} onPress={() => setPrompt({
        visible: true,
        kind: 'link',
        value: 'https://'
      })} />
        <IonTool theme={theme} name="image-outline" active={false} onPress={() => setPrompt({
        visible: true,
        kind: 'image',
        value: ''
      })} />
        <IonTool theme={theme} name="add-outline" active={false} onPress={openInsertMenu} />
      </ScrollView>
      {picker === 'fontSize' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {FONT_SIZES.map(size => fontSize === size ? <EditorGradientPill key={size} style={styles.pickerChip} radius={8}>
                <TouchableOpacity onPress={() => {
          setFontSize(size);
          postCmd('fontSize', size);
          setPicker(null);
        }} style={styles.pickerChipInner}>
                  <Text style={{
            color: theme.text,
            fontWeight: '700',
            fontSize: 12
          }}>{size}</Text>
                </TouchableOpacity>
              </EditorGradientPill> : <TouchableOpacity key={size} onPress={() => {
        setFontSize(size);
        postCmd('fontSize', size);
        setPicker(null);
      }} style={styles.pickerChip}>
                <Text style={{
          color: theme.textMuted,
          fontWeight: '700',
          fontSize: 12
        }}>{size}</Text>
              </TouchableOpacity>)}
        </ScrollView> : null}
      {picker === 'textColor' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {EDITOR_TEXT_COLORS.map(color => <TouchableOpacity key={color} onPress={() => {
        setTextColor(color);
        postCmd('foreColor', color);
        setPicker(null);
      }} style={[styles.colorSwatch, {
        backgroundColor: color,
        borderColor: textColor === color ? theme.selectionBorder : theme.border,
        borderWidth: textColor === color ? 2 : 1,
        width: 28,
        height: 28
      }]} />)}
        </ScrollView> : null}
      {picker === 'highlight' ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
          {EDITOR_HIGHLIGHT_COLORS.map(color => <TouchableOpacity key={color} onPress={() => {
        setHighlightColor(color);
        postCmd('hiliteColor', color === 'transparent' ? 'transparent' : color);
        setPicker(null);
      }} style={[styles.colorSwatch, {
        backgroundColor: color === 'transparent' ? theme.inputBg : color,
        borderColor: theme.border,
        width: 28,
        height: 28
      }]} />)}
        </ScrollView> : null}
    </View>;
  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBackPress}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{
      flex: 1,
      backgroundColor: theme.canvasBg
    }}>
        <SafeAreaView style={{
        flex: 1,
        backgroundColor: theme.canvasBg
      }} edges={SHELL_SAFE_AREA_EDGES}>
          <View style={[styles.gdocsTopBar, {
          paddingTop: insets.top + 6,
          backgroundColor: theme.headerBg,
          borderBottomColor: theme.border
        }]}>
            <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn} hitSlop={12} accessibilityLabel="Back">
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.gdocsTitleWrap}>
              <EditorInlineTitle inputRef={titleInputRef} value={title} onChangeText={t => {
              setTitle(t);
              setStatus('unsaved');
              if (saveTimer.current) clearTimeout(saveTimer.current);
              saveTimer.current = setTimeout(() => {
                queueSave(lastUpdateHtml.current, htmlToPlainText(lastUpdateHtml.current));
              }, TITLE_SAVE_DEBOUNCE_MS);
            }} onFocus={() => setTitleFocused(true)} onBlur={() => setTitleFocused(false)} focused={titleFocused} theme={theme} />
            </View>
            <TouchableOpacity onPress={() => postCmd('undo')} disabled={!toolState.canUndo} style={[styles.headerBtn, {
            opacity: toolState.canUndo ? 1 : 0.35
          }]} accessibilityLabel="Undo">
              <Ionicons name="arrow-undo-outline" size={20} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => postCmd('redo')} disabled={!toolState.canRedo} style={[styles.headerBtn, {
            opacity: toolState.canRedo ? 1 : 0.35
          }]} accessibilityLabel="Redo">
              <Ionicons name="arrow-redo-outline" size={20} color={theme.text} />
            </TouchableOpacity>
            <EditorIconButton icon="share-outline" onPress={handleSharePress} theme={theme} accessibilityLabel="Share" />
            <EditorIconButton icon="ellipsis-vertical" onPress={openMoreMenu} theme={theme} accessibilityLabel="More options" />
          </View>

          <View style={{
          flex: 1,
          minHeight: 0,
          backgroundColor: theme.printCanvasBg
        }}>
            {loading ? <View style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: theme.printCanvasBg
          }}>
                <ActivityIndicator size="large" color={theme.selectionBorder} />
              </View> : <WebView key={isEditorDark ? 'editor-dark' : 'editor-light'} ref={webRef} originWhitelist={['*']} style={{
            flex: 1,
            backgroundColor: theme.printCanvasBg
          }} source={{
            html: editorHtml
          }} onMessage={handleWebMessage} javaScriptEnabled domStorageEnabled keyboardDisplayRequiresUserAction={false} hideKeyboardAccessoryView nestedScrollEnabled scrollEnabled />}
          </View>

          <View style={[styles.bottomChrome, {
          backgroundColor: theme.toolbarBg,
          borderTopColor: theme.border
        }]}>
            {renderFormatToolbar()}
            {nav && !keyboardVisible ? <BottomMenuBar appearanceIsDark={isEditorDark} activeTabKey={nav.activeTabKey || 'files'} onHomePress={nav.onHomePress} onPlusPress={nav.onPlusPress} onVoicePress={nav.onVoicePress} onNutritionPress={nav.onNutritionPress} onWorkoutPress={nav.onWorkoutPress} onMessagesPress={nav.onMessagesPress} /> : null}
          </View>

          {prompt.visible && <Pressable style={styles.promptOverlay} onPress={() => setPrompt({
          visible: false,
          kind: null,
          value: ''
        })}>
              <Pressable style={[styles.promptSheet, {
            backgroundColor: theme.pageBg,
            borderColor: theme.border
          }]} onStartShouldSetResponder={() => true}>
                <Text style={[styles.promptTitle, {
              color: theme.text
            }]}>{prompt.kind === 'link' ? 'Add link' : 'Insert image'}</Text>
                <TextInput value={prompt.value} onChangeText={v => setPrompt(p => ({
              ...p,
              value: v
            }))} placeholder={prompt.kind === 'link' ? 'https://example.com' : 'https://image-url'} placeholderTextColor={theme.textMuted} autoCapitalize="none" autoCorrect={false} style={[styles.promptInput, {
              color: theme.text,
              borderColor: theme.border
            }]} />
                <View style={{
              flexDirection: 'row',
              gap: 10,
              marginTop: 12
            }}>
                  <TouchableOpacity style={[styles.promptBtn, {
                backgroundColor: theme.inputBg,
                borderColor: theme.border
              }]} onPress={() => setPrompt({
                visible: false,
                kind: null,
                value: ''
              })}>
                    <Text style={{
                  color: theme.textMuted,
                  fontWeight: '700'
                }}>Cancel</Text>
                  </TouchableOpacity>
                  <EditorGradientPill style={{
                flex: 1
              }} radius={10}>
                    <TouchableOpacity style={[styles.promptBtn, {
                  borderWidth: 0
                }]} onPress={() => {
                  const promptValue = String(prompt.value || '').trim();
                  const kind = prompt.kind;
                  setPrompt({
                    visible: false,
                    kind: null,
                    value: ''
                  });
                  if (!promptValue) return;
                  if (kind === 'link') postCmd('link', promptValue);
                  if (kind === 'image') postCmd('image', promptValue);
                }}>
                      <Text style={{
                    color: theme.text,
                    fontWeight: '800'
                  }}>Insert</Text>
                    </TouchableOpacity>
                  </EditorGradientPill>
                </View>
              </Pressable>
            </Pressable>}

          <ShareDocumentPopup visible={showShare} onClose={() => setShowShare(false)} trainerId={trainerId} documentId={docId} initialSharedWith={sharedWith} isDark={isEditorDark} onSaved={() => {
          if (trainerId && docId) {
            getTrainerDocument(trainerId, docId).then(d => {
              if (d && mounted.current) setSharedWith(Array.isArray(d.sharedWith) ? d.sharedWith : []);
            });
          }
        }} />

        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>;
}
const styles = StyleSheet.create({
  gdocsTopBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4
  },
  gdocsTitleWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
    justifyContent: 'center'
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottomChrome: {
    flexGrow: 0,
    flexShrink: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex: 10
  },
  formatDock: {
    minHeight: 44,
    flexGrow: 0,
    flexShrink: 0
  },
  toolbarScroll: {
    flexGrow: 0
  },
  toolbarRow: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    gap: 2,
    flexGrow: 0,
    minHeight: 44
  },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  toolGlyph: {
    fontSize: 13
  },
  toolText: {
    fontSize: 14
  },
  divider: {
    width: 1,
    height: 20,
    marginHorizontal: 4
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1
  },
  pickerRow: {
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 8,
    alignItems: 'center'
  },
  pickerChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8
  },
  pickerChipInner: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center'
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  promptSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '800'
  },
  promptInput: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14
  },
  promptBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});