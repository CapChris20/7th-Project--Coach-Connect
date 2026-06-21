/**
 * Document Editor Modal
 *
 * Purpose: UI screen or component: Document Editor Modal. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: DocumentEditorModal
 *
 * @file-header
 */
/**
 * Trainer document editor — create or edit a document. Save to users/{trainerId}/documents.
 */

import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
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
  ScrollView,
  Pressable,
  Share,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { deleteDoc, doc } from 'firebase/firestore';
import { saveTrainerDocument, getTrainerDocument } from '../../shared/notes-files/manageNotesAndFiles';
import { db } from '../../app-start/config';
import ShareDocumentModal from './ShareDocumentModal';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import BottomNavBar from '../../navigation/BottomNavBar';
import EditorStatusPill from './EditorStatusPill';
import {
  EditorIconButton,
  EditorTitleField,
  DEFAULT_SAVE_TITLE_DOCUMENT,
} from './EditorHeaderActions';
import {
  EDITOR_HIGHLIGHT_COLORS,
  EDITOR_TEXT_COLORS,
  FONT_SIZES,
  formatEditorSavedAgo,
  getEditorTheme,
} from './editorTheme';
import {
  EditorGradientBar,
  EditorGradientPill,
} from './editorGradients';

const EMPTY_HTML = '<p><br></p>';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function htmlToPlainText(html) {
  const s = String(html || '')
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
  return s;
}

function now() {
  return new Date();
}

const saveTitle = (raw) => {
  const t = String(raw || '').trim();
  return t || DEFAULT_SAVE_TITLE_DOCUMENT;
};

function ToolButton({ icon, active, disabled, onPress, theme }) {
  const hitProps = {
    onPress,
    disabled,
    activeOpacity: 0.7,
    style: [styles.toolBtn, { opacity: disabled ? 0.35 : 1 }],
  };
  if (active) {
    return (
      <EditorGradientPill radius={8} style={styles.toolBtn} backgroundColor={theme?.accentSoft}>
        <TouchableOpacity {...hitProps}>{icon}</TouchableOpacity>
      </EditorGradientPill>
    );
  }
  return <TouchableOpacity {...hitProps}>{icon}</TouchableOpacity>;
}

function Divider({ theme }) {
  return <View style={[styles.divider, { backgroundColor: theme.divider }]} />;
}

function buildEditorHtml2({ theme, initialHtml }) {
  const pageBg = theme.pageBg;
  const canvasBg = theme.canvasBg;
  const fg = theme.text;
  const subtle = theme.border;
  const accent = theme.accent;
  const codeBg = theme.inputBg;

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin:0; padding:0; background:${canvasBg}; color:${fg}; height:100%; }
      body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
      .page {
        margin:12px 10px 24px;
        background:${pageBg};
        border:1px solid ${subtle};
        border-radius:10px;
        min-height:calc(100vh - 48px);
        box-shadow:${theme.pageShadow ? '0 4px 24px rgba(0,0,0,0.08)' : 'none'};
      }
      .wrap { padding:28px 20px 48px; min-height:100%; box-sizing:border-box; }
      #editor {
        outline:none;
        min-height:320px;
        caret-color:${accent};
        font-size:16px;
        line-height:1.65;
        font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
      }
      h1 { font-size:32px; line-height:1.25; margin:0 0 12px; font-weight:800; font-family:inherit; }
      h2 { font-size:24px; line-height:1.3; margin:20px 0 8px; font-weight:800; font-family:inherit; }
      h3 { font-size:18px; line-height:1.35; margin:16px 0 6px; font-weight:700; font-family:inherit; }
      p, li { font-size:16px; line-height:1.65; margin:0 0 8px; }
      ul, ol { padding-left:22px; margin:8px 0 12px; }
      blockquote { margin:12px 0; padding:10px 12px; border-left:3px solid ${accent}; background:${codeBg}; border-radius:8px; font-style:italic; opacity:0.9; }
      code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; background:${codeBg}; padding:2px 6px; border-radius:6px; font-size:13px; }
      pre { background:${codeBg}; border:1px solid ${subtle}; border-radius:10px; padding:12px; overflow:auto; }
      a { color:${theme.formula}; text-decoration:none; }
      img { max-width:100%; border-radius:8px; border:1px solid ${subtle}; }
    </style>
  </head>
  <body>
    <div class="page"><div class="wrap"><div id="editor" contenteditable="true">${initialHtml || EMPTY_HTML}</div></div></div>
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
        let quote=false, pre=false, ul=false, ol=false, link=false;
        while (n && n !== editor) {
          const tag = (n.tagName || '').toLowerCase();
          if (tag === 'blockquote') quote = true;
          if (tag === 'pre') pre = true;
          if (tag === 'ul') ul = true;
          if (tag === 'ol') ol = true;
          if (tag === 'a') link = true;
          n = n.parentElement;
        }
        return { quote, pre, ul, ol, link };
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
          h1: h === 1, h2: h === 2, h3: h === 3,
          ul: b.ul, ol: b.ol, quote: b.quote, code: b.pre, link: b.link,
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
            if (name === 'blockquote') return exec('formatBlock', 'BLOCKQUOTE');
            if (name === 'codeblock') return exec('formatBlock', 'PRE');
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

export default function DocumentEditorModal({
  visible,
  onClose,
  onSaved,
  trainerId,
  documentId = null,
  isDark = true,
  trainerNavChrome = null,
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
  const [editorThemeMode, setEditorThemeMode] = useState(isDark ? 'dark' : 'light');
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [fontSize, setFontSize] = useState(16);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [highlightColor, setHighlightColor] = useState('transparent');
  const [titleFocused, setTitleFocused] = useState(false);
  const [toolState, setToolState] = useState({
    bold: false, italic: false, underline: false, strike: false,
    alignLeft: true, alignCenter: false, alignRight: false,
    h1: false, h2: false, h3: false, ul: false, ol: false,
    quote: false, code: false, link: false, canUndo: true, canRedo: true,
  });

  const [showShare, setShowShare] = useState(false);
  const [picker, setPicker] = useState(null); // 'fontSize' | 'textColor' | 'highlight' | null
  const [prompt, setPrompt] = useState({ visible: false, kind: null, value: '' });

  const isEditorDark = editorThemeMode === 'dark';
  const theme = useMemo(() => getEditorTheme(isEditorDark), [isEditorDark]);

  const editorHtml = useMemo(
    () => buildEditorHtml2({ theme, initialHtml: EMPTY_HTML }),
    [theme],
  );

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
    if (!visible) return;
    setDocId(documentId || null);
    setStatus('saved');
    setLastSaved(now());
    setCounts({ words: 0, chars: 0 });
    setFontSize(16);
    setPicker(null);
    setPrompt({ visible: false, kind: null, value: '' });
    setShowShare(false);

    const applyHtml = (html) => {
      lastUpdateHtml.current = html;
      setTimeout(() => {
        try {
          webRef.current?.postMessage(JSON.stringify({ type: 'SET_HTML', payload: { html } }));
        } catch (_) {}
      }, 120);
    };

    if (documentId && trainerId) {
      setLoading(true);
      getTrainerDocument(trainerId, documentId)
        .then((d) => {
          if (!mounted.current) return;
          if (d) {
            setTitle(d.title && d.title !== DEFAULT_SAVE_TITLE_DOCUMENT ? d.title : '');
            setFavorite(!!d.isFavorite);
            setSharedWith(Array.isArray(d.sharedWith) ? d.sharedWith : []);
            const html =
              typeof d.bodyHtml === 'string' && d.bodyHtml.trim()
                ? d.bodyHtml
                : d.body
                  ? `<p>${String(d.body).replace(/\n/g, '<br/>')}</p>`
                  : EMPTY_HTML;
            applyHtml(html);
          } else {
            setTitle('');
            setFavorite(false);
            setSharedWith([]);
            applyHtml(EMPTY_HTML);
          }
        })
        .catch(() => {})
        .finally(() => mounted.current && setLoading(false));
    } else {
      setTitle('');
      setFavorite(false);
      setSharedWith([]);
      applyHtml(EMPTY_HTML);
    }
  }, [visible, documentId, trainerId]);

  const postCmd = useCallback((name, value) => {
    try {
      webRef.current?.postMessage(JSON.stringify({ type: 'CMD', payload: { name, value } }));
    } catch (_) {}
  }, []);

  const queueSave = useCallback(
    (html, plainText) => {
      if (!trainerId) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setStatus('unsaved');
      saveTimer.current = setTimeout(async () => {
        if (!mounted.current) return;
        setStatus('saving');
        try {
          const t = saveTitle(title);
          const res = await saveTrainerDocument(trainerId, {
            id: docId || undefined,
            title: t,
            body: String(plainText || '').trim(),
            bodyHtml: String(html || ''),
          });
          if (!mounted.current) return;
          if (!docId && res?.id) setDocId(res.id);
          setTimeout(() => {
            if (!mounted.current) return;
            setStatus('saved');
            setLastSaved(now());
            onSaved?.();
          }, 250);
        } catch (e) {
          if (mounted.current) setStatus('unsaved');
        }
      }, 1200);
    },
    [trainerId, docId, title, onSaved],
  );

  const handleWebMessage = useCallback(
    (event) => {
      try {
        const msg = JSON.parse(event?.nativeEvent?.data || '{}');
        if (msg?.type === 'UPDATE') {
          const html = String(msg?.payload?.html || '');
          const text = String(msg?.payload?.text || '');
          setCounts({
            words: clamp(Number(msg?.payload?.words || 0), 0, 999999),
            chars: clamp(Number(msg?.payload?.chars || 0), 0, 9999999),
          });
          lastUpdateHtml.current = html;
          queueSave(html, text);
          return;
        }
        if (msg?.type === 'STATE') {
          const p = msg?.payload || {};
          setToolState((prev) => ({
            ...prev,
            bold: !!p.bold, italic: !!p.italic, underline: !!p.underline, strike: !!p.strike,
            alignLeft: !!p.alignLeft, alignCenter: !!p.alignCenter, alignRight: !!p.alignRight,
            h1: !!p.h1, h2: !!p.h2, h3: !!p.h3, ul: !!p.ul, ol: !!p.ol,
            quote: !!p.quote, code: !!p.code, link: !!p.link,
            canUndo: p.canUndo !== false, canRedo: p.canRedo !== false,
          }));
          if (typeof p.words === 'number' || typeof p.chars === 'number') {
            setCounts({
              words: clamp(Number(p.words) || 0, 0, 999999),
              chars: clamp(Number(p.chars) || 0, 0, 9999999),
            });
          }
        }
      } catch (_) {}
    },
    [queueSave],
  );

  const handleBackPress = () => {
    if (status === 'unsaved' || status === 'saving') {
      Alert.alert('Unsaved changes', 'Leave without saving?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onClose },
      ]);
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
      await FileSystem.writeAsStringAsync(
        path,
        `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${html}</body></html>`,
        { encoding: FileSystem.EncodingType.UTF8 },
      );
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/html', dialogTitle: 'Export document' });
      } else {
        await Share.share({ message: htmlToPlainText(html), title });
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
        bodyHtml: lastUpdateHtml.current || EMPTY_HTML,
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
    Alert.alert('Delete document?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
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
        },
      },
    ]);
  };

  const handleSharePress = () => {
    if (!docId) {
      Alert.alert('Save first', 'Type a bit so the document is saved before sharing.');
      return;
    }
    setShowShare(true);
  };

  const handleAddPress = () => {
    Alert.alert('Add to document', undefined, [
      { text: 'Link', onPress: () => setPrompt({ visible: true, kind: 'link', value: 'https://' }) },
      { text: 'Image', onPress: () => setPrompt({ visible: true, kind: 'image', value: '' }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openMoreMenu = () => {
    Alert.alert('Document options', undefined, [
      { text: 'Rename', onPress: handleRename },
      { text: 'Duplicate', onPress: handleDuplicate },
      { text: 'Delete', style: 'destructive', onPress: handleDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const nav = trainerNavChrome;
  const iconColor = (active) => (active ? theme.text : theme.textMuted);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleBackPress}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.canvasBg }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.canvasBg }}>
          {nav ? (
            <CoachConnectHeader
              title="Document"
              skipTopSafeInset
              appearanceIsDark={isEditorDark}
              onBack={handleBackPress}
              onProfilePress={nav.onProfilePress}
              onSettingsPress={nav.onSettingsPress}
            />
          ) : (
            <View style={[styles.backRow, { backgroundColor: theme.headerBg }]}>
              <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn} hitSlop={12}>
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.titleSection, { backgroundColor: theme.headerBg, borderBottomColor: theme.border }]}>
            <EditorTitleField
              inputRef={titleInputRef}
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                setStatus('unsaved');
                if (saveTimer.current) clearTimeout(saveTimer.current);
                saveTimer.current = setTimeout(() => {
                  queueSave(lastUpdateHtml.current, htmlToPlainText(lastUpdateHtml.current));
                }, 600);
              }}
              onFocus={() => setTitleFocused(true)}
              onBlur={() => setTitleFocused(false)}
              focused={titleFocused}
              theme={theme}
            />
            <View style={styles.metaRow}>
              <EditorStatusPill status={status} theme={theme} />
              <View style={{ flex: 1 }} />
              <EditorIconButton
                icon="share-outline"
                onPress={handleSharePress}
                theme={theme}
                accessibilityLabel="Share"
              />
              <EditorIconButton
                icon={favorite ? 'star' : 'star-outline'}
                onPress={() => setFavorite((v) => !v)}
                theme={theme}
                active={favorite}
                accessibilityLabel="Favorite"
              />
              <EditorIconButton
                icon={isEditorDark ? 'sunny-outline' : 'moon-outline'}
                onPress={() => setEditorThemeMode((t) => (t === 'dark' ? 'light' : 'dark'))}
                theme={theme}
                accessibilityLabel="Toggle theme"
              />
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <View
              style={[
                styles.editorCard,
                {
                  backgroundColor: theme.canvasBg,
                  borderColor: theme.border,
                  ...(theme.pageShadow || {}),
                },
              ]}
            >
              <View style={[styles.toolbar, { borderBottomColor: theme.border, backgroundColor: theme.toolbarBg }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarRow}>
                  <ToolButton theme={theme} active={toolState.bold} onPress={() => postCmd('bold')} icon={<Text style={[styles.toolText, { color: iconColor(toolState.bold), fontWeight: '800' }]}>B</Text>} />
                  <ToolButton theme={theme} active={toolState.italic} onPress={() => postCmd('italic')} icon={<Text style={[styles.toolText, { color: iconColor(toolState.italic), fontStyle: 'italic', fontWeight: '700' }]}>I</Text>} />
                  <ToolButton theme={theme} active={toolState.underline} onPress={() => postCmd('underline')} icon={<Text style={[styles.toolText, { color: iconColor(toolState.underline), textDecorationLine: 'underline', fontWeight: '700' }]}>U</Text>} />
                  <ToolButton theme={theme} active={toolState.strike} onPress={() => postCmd('strike')} icon={<Text style={[styles.toolText, { color: iconColor(toolState.strike), textDecorationLine: 'line-through', fontWeight: '700' }]}>S</Text>} />
                  <Divider theme={theme} />
                  <ToolButton
                    theme={theme}
                    active={picker === 'fontSize'}
                    onPress={() => setPicker((p) => (p === 'fontSize' ? null : 'fontSize'))}
                    icon={<Text style={[styles.toolText, { color: theme.textMuted, fontWeight: '700' }]}>{fontSize}</Text>}
                  />
                  <ToolButton
                    theme={theme}
                    active={picker === 'textColor'}
                    onPress={() => setPicker((p) => (p === 'textColor' ? null : 'textColor'))}
                    icon={<View style={[styles.colorSwatch, { backgroundColor: textColor === '#FFFFFF' && !isEditorDark ? theme.text : textColor, borderColor: theme.border }]} />}
                  />
                  <ToolButton
                    theme={theme}
                    active={picker === 'highlight'}
                    onPress={() => setPicker((p) => (p === 'highlight' ? null : 'highlight'))}
                    icon={
                      <View style={[styles.colorSwatch, { backgroundColor: highlightColor === 'transparent' ? theme.inputBg : highlightColor, borderColor: theme.border }]}>
                        <EditorGradientBar style={{ position: 'absolute', bottom: 2, left: 4, right: 4 }} />
                      </View>
                    }
                  />
                  <Divider theme={theme} />
                  <ToolButton theme={theme} active={toolState.alignLeft} onPress={() => postCmd('alignLeft')} icon={<MaterialIcons name="format-align-left" size={18} color={iconColor(toolState.alignLeft)} />} />
                  <ToolButton theme={theme} active={toolState.alignCenter} onPress={() => postCmd('alignCenter')} icon={<MaterialIcons name="format-align-center" size={18} color={iconColor(toolState.alignCenter)} />} />
                  <ToolButton theme={theme} active={toolState.alignRight} onPress={() => postCmd('alignRight')} icon={<MaterialIcons name="format-align-right" size={18} color={iconColor(toolState.alignRight)} />} />
                  <Divider theme={theme} />
                  <ToolButton theme={theme} active={toolState.link} onPress={() => setPrompt({ visible: true, kind: 'link', value: 'https://' })} icon={<Ionicons name="link-outline" size={18} color={iconColor(toolState.link)} />} />
                  <ToolButton theme={theme} active={false} onPress={() => setPrompt({ visible: true, kind: 'image', value: '' })} icon={<Ionicons name="image-outline" size={18} color={theme.textMuted} />} />
                  <Divider theme={theme} />
                  <ToolButton theme={theme} active={false} disabled={!toolState.canUndo} onPress={() => postCmd('undo')} icon={<Ionicons name="arrow-undo-outline" size={18} color={theme.textMuted} />} />
                  <ToolButton theme={theme} active={false} disabled={!toolState.canRedo} onPress={() => postCmd('redo')} icon={<Ionicons name="arrow-redo-outline" size={18} color={theme.textMuted} />} />
                </ScrollView>
                {picker === 'fontSize' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                    {FONT_SIZES.map((size) => (
                      fontSize === size ? (
                        <EditorGradientPill key={size} style={styles.pickerChip} radius={8}>
                          <TouchableOpacity
                            onPress={() => { setFontSize(size); postCmd('fontSize', size); setPicker(null); }}
                            style={styles.pickerChipInner}
                          >
                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 12 }}>{size}</Text>
                          </TouchableOpacity>
                        </EditorGradientPill>
                      ) : (
                        <TouchableOpacity
                          key={size}
                          onPress={() => { setFontSize(size); postCmd('fontSize', size); setPicker(null); }}
                          style={styles.pickerChip}
                        >
                          <Text style={{ color: theme.textMuted, fontWeight: '700', fontSize: 12 }}>{size}</Text>
                        </TouchableOpacity>
                      )
                    ))}
                  </ScrollView>
                ) : null}
                {picker === 'textColor' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                    {EDITOR_TEXT_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => { setTextColor(color); postCmd('foreColor', color); setPicker(null); }}
                        style={[styles.colorSwatch, { backgroundColor: color, borderColor: theme.border, width: 28, height: 28 }]}
                      />
                    ))}
                  </ScrollView>
                ) : null}
                {picker === 'highlight' ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerRow}>
                    {EDITOR_HIGHLIGHT_COLORS.map((color) => (
                      <TouchableOpacity
                        key={color}
                        onPress={() => { setHighlightColor(color); postCmd('hiliteColor', color === 'transparent' ? 'transparent' : color); setPicker(null); }}
                        style={[styles.colorSwatch, { backgroundColor: color === 'transparent' ? theme.inputBg : color, borderColor: theme.border, width: 28, height: 28 }]}
                      />
                    ))}
                  </ScrollView>
                ) : null}
              </View>

              <View style={{ flex: 1 }}>
                {loading ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={theme.accent} />
                  </View>
                ) : (
                  <WebView
                    ref={webRef}
                    originWhitelist={['*']}
                    style={{ flex: 1, backgroundColor: theme.canvasBg }}
                    source={{ html: editorHtml }}
                    onMessage={handleWebMessage}
                    javaScriptEnabled
                    domStorageEnabled
                    keyboardDisplayRequiresUserAction={false}
                    hideKeyboardAccessoryView
                  />
                )}
              </View>
            </View>

            <View style={[styles.statusBar, { borderTopColor: theme.border }]}>
              <Text style={{ color: theme.textMuted, fontSize: 12 }}>
                {counts.words} {counts.words === 1 ? 'word' : 'words'} · {counts.chars} {counts.chars === 1 ? 'character' : 'characters'} · Last saved {formatEditorSavedAgo(lastSaved)}
              </Text>
            </View>
          </View>

          {prompt.visible && (
            <Pressable style={styles.promptOverlay} onPress={() => setPrompt({ visible: false, kind: null, value: '' })}>
              <Pressable style={[styles.promptSheet, { backgroundColor: theme.pageBg, borderColor: theme.border }]} onStartShouldSetResponder={() => true}>
                <Text style={[styles.promptTitle, { color: theme.text }]}>{prompt.kind === 'link' ? 'Add link' : 'Insert image'}</Text>
                <TextInput
                  value={prompt.value}
                  onChangeText={(v) => setPrompt((p) => ({ ...p, value: v }))}
                  placeholder={prompt.kind === 'link' ? 'https://example.com' : 'https://image-url'}
                  placeholderTextColor={theme.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.promptInput, { color: theme.text, borderColor: theme.border }]}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity style={[styles.promptBtn, { backgroundColor: theme.inputBg, borderColor: theme.border }]} onPress={() => setPrompt({ visible: false, kind: null, value: '' })}>
                    <Text style={{ color: theme.textMuted, fontWeight: '700' }}>Cancel</Text>
                  </TouchableOpacity>
                  <EditorGradientPill style={{ flex: 1 }} radius={10}>
                    <TouchableOpacity
                      style={[styles.promptBtn, { borderWidth: 0 }]}
                      onPress={() => {
                        const v = String(prompt.value || '').trim();
                        const kind = prompt.kind;
                        setPrompt({ visible: false, kind: null, value: '' });
                        if (!v) return;
                        if (kind === 'link') postCmd('link', v);
                        if (kind === 'image') postCmd('image', v);
                      }}
                    >
                      <Text style={{ color: theme.text, fontWeight: '800' }}>Insert</Text>
                    </TouchableOpacity>
                  </EditorGradientPill>
                </View>
              </Pressable>
            </Pressable>
          )}

          <ShareDocumentModal
            visible={showShare}
            onClose={() => setShowShare(false)}
            trainerId={trainerId}
            documentId={docId}
            initialSharedWith={sharedWith}
            isDark={isEditorDark}
            onSaved={() => {
              if (trainerId && docId) {
                getTrainerDocument(trainerId, docId).then((d) => {
                  if (d && mounted.current) setSharedWith(Array.isArray(d.sharedWith) ? d.sharedWith : []);
                });
              }
            }}
          />

          {nav ? (
            <BottomNavBar
              appearanceIsDark={isEditorDark}
              activeTabKey={nav.activeTabKey || 'files'}
              onHomePress={nav.onHomePress}
              onPlusPress={nav.onPlusPress}
              onVoicePress={nav.onVoicePress}
              onNutritionPress={nav.onNutritionPress}
              onWorkoutPress={nav.onWorkoutPress}
              onMessagesPress={nav.onMessagesPress}
            />
          ) : null}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backRow: {
    paddingHorizontal: 6,
    paddingTop: 4,
  },
  titleSection: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  editorCard: {
    flex: 1,
    marginHorizontal: 0,
    marginTop: 0,
    overflow: 'hidden',
  },
  toolbar: { borderBottomWidth: StyleSheet.hairlineWidth },
  toolbarRow: { paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', gap: 4 },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolText: { fontSize: 14 },
  divider: { width: 1, height: 20, marginHorizontal: 4 },
  colorSwatch: { width: 20, height: 20, borderRadius: 999, borderWidth: 1 },
  pickerRow: { paddingHorizontal: 10, paddingBottom: 8, gap: 8, alignItems: 'center' },
  pickerChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  pickerChipInner: { paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', justifyContent: 'center' },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  promptOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  promptSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  promptTitle: { fontSize: 16, fontWeight: '800' },
  promptInput: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  promptBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
