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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { saveTrainerDocument, getTrainerDocument } from '../services/notesAndFilesService';
import ShareDocumentModal from './ShareDocumentModal';

const MAGENTA = '#FF6B9D';

const DEFAULT_CONTENT = `<h1>Welcome to your document</h1><p>Start writing your workout plan, nutrition guide, or recovery notes. Highlight any text to format it, or use the toolbar above.</p><h2>Tips</h2><ul><li>Press <code>/</code>-style shortcuts via the toolbar</li><li>Drop in images with the image button</li><li>Everything auto-saves as you type</li></ul><blockquote>\"Discipline is the bridge between goals and accomplishment.\" — Jim Rohn</blockquote>`;

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

function formatLastSaved(lastSaved) {
  if (!lastSaved) return '—';
  const diff = Math.round((Date.now() - lastSaved.getTime()) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  return `${Math.floor(diff / 60)}m ago`;
}

function StatusPill({ status }) {
  const map = {
    saved: { label: 'Saved', color: '#22C55E' },
    saving: { label: 'Saving…', color: '#FBBF24' },
    unsaved: { label: 'Unsaved', color: '#FB7185' },
  };
  const { label, color } = map[status] || map.saved;
  return (
    <View style={styles.statusPill}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
}

function ToolButton({ icon, active, disabled, onPress }) {
  const bg = active ? MAGENTA : 'transparent';
  const border = active ? 'rgba(255,107,157,0.55)' : 'transparent';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.toolBtn,
        { opacity: disabled ? 0.3 : 1 },
        active
          ? {
              backgroundColor: bg,
              borderColor: border,
              shadowColor: MAGENTA,
              shadowOpacity: 0.55,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 6 },
              elevation: 12,
            }
          : null,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function buildEditorHtml2({ theme, initialHtml }) {
  const isDark = theme !== 'light';
  const bg = isDark ? '#0A0A0F' : '#FFFFFF';
  const fg = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,15,0.92)';
  const subtle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.08)';
  const codeBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,15,0.06)';
  const quoteBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(10,10,15,0.03)';

  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { margin:0; padding:0; background:${bg}; color:${fg}; height:100%; }
      body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }
      .wrap { padding:18px 18px 24px; }
      #editor { outline:none; min-height:100%; }
      h1 { font-size:34px; line-height:40px; margin:0 0 14px; font-weight:800; font-family:Georgia,serif; }
      h2 { font-size:22px; line-height:28px; margin:22px 0 10px; font-weight:800; }
      h3 { font-size:18px; line-height:24px; margin:18px 0 8px; font-weight:800; }
      p, li { font-size:15px; line-height:24px; margin:0 0 10px; }
      ul, ol { padding-left:22px; margin:8px 0 14px; }
      blockquote { margin:14px 0; padding:12px 12px 12px 14px; border-left:3px solid ${MAGENTA}; background:${quoteBg}; border-radius:12px; color:${isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.72)'}; font-style:italic; }
      code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; background:${codeBg}; padding:2px 6px; border-radius:8px; font-size:13px; }
      pre { background:${codeBg}; border:1px solid ${subtle}; border-radius:12px; padding:12px; overflow:auto; }
      a { color:#06B6D4; text-decoration:none; }
      img { max-width:100%; border-radius:12px; border:1px solid ${subtle}; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div id="editor" contenteditable="true">${initialHtml || ''}</div>
    </div>
    <script>
      const editor = document.getElementById('editor');
      const post = (type, payload) => {
        try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, payload })); } catch(e) {}
      };
      const getHtml = () => editor.innerHTML || '';
      const getText = () => (editor.innerText || '').trim();
      const counts = () => {
        const t = getText();
        const words = t ? t.split(/\\s+/).filter(Boolean).length : 0;
        const chars = t ? t.length : 0;
        return { words, chars };
      };
      const isActive = (cmd) => { try { return document.queryCommandState(cmd); } catch(e) { return false; } };
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
          h1: h === 1,
          h2: h === 2,
          h3: h === 3,
          ul: b.ul,
          ol: b.ol,
          quote: b.quote,
          code: b.pre,
          link: b.link,
          canUndo: true,
          canRedo: true,
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
      window.__RN = {
        setHtml: (html) => { editor.innerHTML = html || ''; emitUpdate(); },
      };
      window.addEventListener('message', (e) => {
        try {
          const msg = JSON.parse(e.data || '{}');
          const p = msg.payload || {};
          if (msg.type === 'CMD') {
            const { name, value } = p;
            if (name === 'heading') {
              const tag = value === 1 ? 'H1' : value === 2 ? 'H2' : value === 3 ? 'H3' : 'P';
              exec('formatBlock', tag);
              return;
            }
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
        } catch(e) {}
      });
      editor.addEventListener('input', emitUpdate);
      document.addEventListener('selectionchange', sendState);
      setTimeout(emitUpdate, 50);
    </script>
  </body>
</html>`;
}

/* function buildEditorHtml({ theme, initialHtml }) {
  const isDark = theme !== 'light';
  const bg = isDark ? '#0A0A0F' : '#FFFFFF';
  const fg = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(10,10,15,0.92)';
  const subtle = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.08)';
  const codeBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(10,10,15,0.06)';
  const quoteBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(10,10,15,0.03)';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />\n<style>\nhtml,body{margin:0;padding:0;background:${bg};color:${fg};height:100%;}\nbody{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;}\n.wrap{padding:18px 18px 24px;}\n#editor{outline:none;min-height:100%;}\nh1{font-size:34px;line-height:40px;margin:0 0 14px;font-weight:800;font-family:Georgia,serif;}\nh2{font-size:22px;line-height:28px;margin:22px 0 10px;font-weight:800;}\nh3{font-size:18px;line-height:24px;margin:18px 0 8px;font-weight:800;}\np,li{font-size:15px;line-height:24px;margin:0 0 10px;}\nul,ol{padding-left:22px;margin:8px 0 14px;}\nblockquote{margin:14px 0;padding:12px 12px 12px 14px;border-left:3px solid ${MAGENTA};background:${quoteBg};border-radius:12px;color:${isDark ? 'rgba(255,255,255,0.72)' : 'rgba(10,10,15,0.72)'};font-style:italic;}\ncode{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;background:${codeBg};padding:2px 6px;border-radius:8px;font-size:13px;}\npre{background:${codeBg};border:1px solid ${subtle};border-radius:12px;padding:12px;overflow:auto;}\na{color:#06B6D4;text-decoration:none;}\nimg{max-width:100%;border-radius:12px;border:1px solid ${subtle};}\n</style>\n</head><body><div class=\"wrap\"><div id=\"editor\" contenteditable=\"true\">${initialHtml || ''}</div></div>\n<script>\nconst editor=document.getElementById('editor');\nconst post=(type,payload)=>{try{window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({type,payload}));}catch(e){}};\nconst getHtml=()=>editor.innerHTML||'';\nconst getText=()=> (editor.innerText||'').trim();\nconst counts=()=>{const t=getText();const words=t?t.split(/\\\\s+/).filter(Boolean).length:0;const chars=t?t.length:0;return{words,chars}};\nconst emit=()=>{post('UPDATE',{html:getHtml(),text:getText(),...counts()});};\nwindow.__RN={setHtml:(h)=>{editor.innerHTML=h||'';emit();}};\nwindow.addEventListener('message',(e)=>{try{const m=JSON.parse(e.data||'{}');if(m.type==='SET_HTML')window.__RN.setHtml((m.payload||{}).html||'');}catch(_){}});\neditor.addEventListener('input',()=>emit());\nsetTimeout(()=>emit(),50);\n</script></body></html>`;\n  // return String.raw`(old large template removed)`;\n }\n*** End Patch"}]}相关 to=functions.ApplyPatch isn't valid.
*/

export default function DocumentEditorModal({
  visible,
  onClose,
  onSaved,
  trainerId,
  documentId = null,
  isDark = true,
}) {
  const webRef = useRef(null);
  const saveTimer = useRef(null);
  const lastUpdateHtml = useRef('');
  const mounted = useRef(false);

  const [docId, setDocId] = useState(documentId || null);
  const [title, setTitle] = useState('Untitled document');
  const [status, setStatus] = useState('saved'); // saved | saving | unsaved
  const [favorite, setFavorite] = useState(false);
  const [sharedWith, setSharedWith] = useState([]);
  const [lastSaved, setLastSaved] = useState(now());
  const [loading, setLoading] = useState(false);
  const [editorTheme, setEditorTheme] = useState(isDark ? 'dark' : 'light');
  const [counts, setCounts] = useState({ words: 0, chars: 0 });
  const [toolState, setToolState] = useState({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    h1: false,
    h2: false,
    h3: false,
    ul: false,
    ol: false,
    quote: false,
    code: false,
    link: false,
    canUndo: true,
    canRedo: true,
  });

  const [showMore, setShowMore] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [prompt, setPrompt] = useState({ visible: false, kind: null, value: '' }); // kind: link|image

  const isEditorDark = editorTheme === 'dark';
  const bg = isEditorDark ? '#0A0A0F' : '#F8FAFC';
  const surface = isEditorDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF';
  const borderC = isEditorDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.10)';
  const text = isEditorDark ? '#FFFFFF' : '#0A0A0F';
  const muted = isEditorDark ? 'rgba(255,255,255,0.6)' : 'rgba(10,10,15,0.55)';

  const editorHtml = useMemo(() => {
    const initial = DEFAULT_CONTENT;
    return buildEditorHtml2({ theme: editorTheme, initialHtml: initial });
  }, [editorTheme]);

  useEffect(() => {
    if (!visible) return;
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [visible]);

  // Load document (if editing existing)
  useEffect(() => {
    if (!visible) return;
    setDocId(documentId || null);
    setStatus('saved');
    setLastSaved(now());
    setCounts({ words: 0, chars: 0 });
    setToolState((s) => ({ ...s, bold: false, italic: false, underline: false, strike: false, h1: false, h2: false, h3: false, ul: false, ol: false, quote: false, code: false, link: false }));
    setPrompt({ visible: false, kind: null, value: '' });
    setShowMore(false);
    setShowShare(false);

    if (documentId && trainerId) {
      setLoading(true);
      getTrainerDocument(trainerId, documentId)
        .then((d) => {
          if (!mounted.current) return;
          if (d) {
            setTitle(d.title || 'Untitled document');
            setFavorite(!!d.isFavorite);
            setSharedWith(Array.isArray(d.sharedWith) ? d.sharedWith : []);
            const html = typeof d.bodyHtml === 'string' && d.bodyHtml.trim() ? d.bodyHtml : (d.body ? `<p>${String(d.body).replace(/\n/g, '<br/>')}</p>` : DEFAULT_CONTENT);
            lastUpdateHtml.current = html;
            // Set content once webview is ready: send after a small delay.
            setTimeout(() => {
              try {
                webRef.current?.postMessage(JSON.stringify({ type: 'SET_HTML', payload: { html } }));
              } catch (_) {}
            }, 120);
          } else {
            setTitle('Untitled document');
            setFavorite(false);
            setSharedWith([]);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (mounted.current) setLoading(false);
        });
    } else {
      setTitle('Untitled document');
      setFavorite(false);
      setSharedWith([]);
      lastUpdateHtml.current = DEFAULT_CONTENT;
      setTimeout(() => {
        try {
          webRef.current?.postMessage(JSON.stringify({ type: 'SET_HTML', payload: { html: DEFAULT_CONTENT } }));
        } catch (_) {}
      }, 120);
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
          const t = String(title || '').trim() || 'Untitled document';
          const body = String(plainText || '').trim();
          const bodyHtml = String(html || '');
          const res = await saveTrainerDocument(trainerId, { id: docId || undefined, title: t, body, bodyHtml });
          if (!mounted.current) return;
          if (!docId && res?.id) setDocId(res.id);
          // tiny delay for the “saved” feel, like the screenshot
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
          const words = Number(msg?.payload?.words || 0);
          const chars = Number(msg?.payload?.chars || 0);
          setCounts({ words: clamp(words, 0, 999999), chars: clamp(chars, 0, 9999999) });
          lastUpdateHtml.current = html;
          queueSave(html, text);
          return;
        }
        if (msg?.type === 'STATE') {
          const p = msg?.payload || {};
          setToolState((prev) => ({
            ...prev,
            bold: !!p.bold,
            italic: !!p.italic,
            underline: !!p.underline,
            strike: !!p.strike,
            h1: !!p.h1,
            h2: !!p.h2,
            h3: !!p.h3,
            ul: !!p.ul,
            ol: !!p.ol,
            quote: !!p.quote,
            code: !!p.code,
            link: !!p.link,
            canUndo: p.canUndo !== false,
            canRedo: p.canRedo !== false,
          }));
          if (typeof p.words === 'number' || typeof p.chars === 'number') {
            setCounts({ words: clamp(Number(p.words) || 0, 0, 999999), chars: clamp(Number(p.chars) || 0, 0, 9999999) });
          }
        }
      } catch (_) {}
    },
    [queueSave],
  );

  const handleBackPress = () => {
    // Don’t lose changes while a save is pending.
    if (status === 'unsaved' || status === 'saving') {
      Alert.alert('Unsaved changes', 'Leave without saving?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: onClose },
      ]);
      return;
    }
    onClose();
  };

  const toggleTheme = () => setEditorTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  const handleFavorite = async () => {
    setFavorite((v) => !v);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={handleBackPress}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, backgroundColor: bg }}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderC, backgroundColor: isEditorDark ? 'rgba(10,10,15,0.72)' : 'rgba(255,255,255,0.85)' }]}>
            <TouchableOpacity onPress={handleBackPress} style={styles.headerBtn} hitSlop={12}>
              <Ionicons name="chevron-back" size={20} color={text} />
            </TouchableOpacity>
            <TextInput
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                setStatus('unsaved');
                // keep saving content on next editor update; if user only changes title, save shortly
                if (saveTimer.current) clearTimeout(saveTimer.current);
                saveTimer.current = setTimeout(() => {
                  queueSave(lastUpdateHtml.current, htmlToPlainText(lastUpdateHtml.current));
                }, 600);
              }}
              placeholder="Untitled document"
              placeholderTextColor={muted}
              style={[styles.headerTitleInput, { color: text }]}
              numberOfLines={1}
            />
            <StatusPill status={status} />
            <TouchableOpacity onPress={handleFavorite} style={styles.headerBtn} hitSlop={12}>
              <Ionicons name={favorite ? 'star' : 'star-outline'} size={18} color={favorite ? MAGENTA : muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleTheme} style={styles.headerBtn} hitSlop={12}>
              <Ionicons name={isEditorDark ? 'sunny-outline' : 'moon-outline'} size={18} color={muted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowMore(true)} style={styles.headerBtn} hitSlop={12}>
              <Ionicons name="ellipsis-horizontal" size={18} color={muted} />
            </TouchableOpacity>
          </View>

          {/* Editor surface */}
          <View style={{ flex: 1 }}>
            <View style={[styles.editorCard, { backgroundColor: surface, borderColor: borderC }]}>
              {/* Floating toolbar */}
              <View style={[styles.toolbar, { borderBottomColor: borderC, backgroundColor: isEditorDark ? 'rgba(12,12,20,0.92)' : 'rgba(255,255,255,0.92)' }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.toolbarRow}>
                  <ToolButton
                    active={toolState.bold}
                    onPress={() => postCmd('bold')}
                    icon={<Text style={[styles.toolText, { color: toolState.bold ? '#0A0A0F' : muted, fontWeight: '800' }]}>B</Text>}
                  />
                  <ToolButton
                    active={toolState.italic}
                    onPress={() => postCmd('italic')}
                    icon={<Text style={[styles.toolText, { color: toolState.italic ? '#0A0A0F' : muted, fontStyle: 'italic', fontWeight: '700' }]}>I</Text>}
                  />
                  <ToolButton
                    active={toolState.underline}
                    onPress={() => postCmd('underline')}
                    icon={<Text style={[styles.toolText, { color: toolState.underline ? '#0A0A0F' : muted, textDecorationLine: 'underline', fontWeight: '700' }]}>U</Text>}
                  />
                  <ToolButton
                    active={toolState.strike}
                    onPress={() => postCmd('strike')}
                    icon={<Text style={[styles.toolText, { color: toolState.strike ? '#0A0A0F' : muted, textDecorationLine: 'line-through', fontWeight: '700' }]}>S</Text>}
                  />
                  <Divider />
                  <ToolButton
                    active={toolState.h1}
                    onPress={() => postCmd('heading', toolState.h1 ? 0 : 1)}
                    icon={<Text style={[styles.toolText, { color: toolState.h1 ? '#0A0A0F' : muted, fontWeight: '800' }]}>H1</Text>}
                  />
                  <ToolButton
                    active={toolState.h2}
                    onPress={() => postCmd('heading', toolState.h2 ? 0 : 2)}
                    icon={<Text style={[styles.toolText, { color: toolState.h2 ? '#0A0A0F' : muted, fontWeight: '800' }]}>H2</Text>}
                  />
                  <ToolButton
                    active={toolState.h3}
                    onPress={() => postCmd('heading', toolState.h3 ? 0 : 3)}
                    icon={<Text style={[styles.toolText, { color: toolState.h3 ? '#0A0A0F' : muted, fontWeight: '800' }]}>H3</Text>}
                  />
                  <Divider />
                  <ToolButton
                    active={toolState.ul}
                    onPress={() => postCmd('ul')}
                    icon={<Ionicons name="list" size={16} color={toolState.ul ? '#0A0A0F' : muted} />}
                  />
                  <ToolButton
                    active={toolState.ol}
                    onPress={() => postCmd('ol')}
                    icon={<Ionicons name="list-circle" size={16} color={toolState.ol ? '#0A0A0F' : muted} />}
                  />
                  <ToolButton
                    active={toolState.quote}
                    onPress={() => postCmd('blockquote')}
                    icon={<Ionicons name="chatbox-ellipses-outline" size={16} color={toolState.quote ? '#0A0A0F' : muted} />}
                  />
                  <ToolButton
                    active={toolState.code}
                    onPress={() => postCmd('codeblock')}
                    icon={<Ionicons name="code-slash-outline" size={16} color={toolState.code ? '#0A0A0F' : muted} />}
                  />
                  <Divider />
                  <ToolButton
                    active={toolState.link}
                    onPress={() => setPrompt({ visible: true, kind: 'link', value: 'https://' })}
                    icon={<Ionicons name="link-outline" size={16} color={toolState.link ? '#0A0A0F' : muted} />}
                  />
                  <ToolButton
                    active={false}
                    onPress={() => setPrompt({ visible: true, kind: 'image', value: '' })}
                    icon={<Ionicons name="image-outline" size={16} color={muted} />}
                  />
                  <ToolButton
                    active={false}
                    onPress={() => postCmd('clear')}
                    icon={<Ionicons name="trash-outline" size={16} color={muted} />}
                  />
                  <Divider />
                  <ToolButton
                    active={false}
                    disabled={!toolState.canUndo}
                    onPress={() => postCmd('undo')}
                    icon={<Ionicons name="arrow-undo-outline" size={16} color={muted} />}
                  />
                  <ToolButton
                    active={false}
                    disabled={!toolState.canRedo}
                    onPress={() => postCmd('redo')}
                    icon={<Ionicons name="arrow-redo-outline" size={16} color={muted} />}
                  />
                </ScrollView>
              </View>

              <View style={{ flex: 1 }}>
                {loading ? (
                  <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color={MAGENTA} />
                  </View>
                ) : (
                  <WebView
                    ref={webRef}
                    originWhitelist={['*']}
                    style={{ flex: 1, backgroundColor: surface }}
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

            {/* Status bar */}
            <View style={styles.statusBar}>
              <Text style={{ color: muted, fontSize: 12 }}>
                {counts.words} {counts.words === 1 ? 'word' : 'words'} · {counts.chars} {counts.chars === 1 ? 'character' : 'characters'}
              </Text>
              <Text style={{ color: muted, fontSize: 12 }}>Last saved {formatLastSaved(lastSaved)}</Text>
            </View>
          </View>

          {/* More menu */}
          {showMore && (
            <Pressable style={styles.moreOverlay} onPress={() => setShowMore(false)}>
              <Pressable style={[styles.moreMenu, { backgroundColor: isEditorDark ? '#0C0C14' : '#FFFFFF', borderColor: borderC }]} onStartShouldSetResponder={() => true}>
                <TouchableOpacity
                  style={styles.moreItem}
                  onPress={() => {
                    setShowMore(false);
                    if (!docId) {
                      Alert.alert('Save first', 'Type a bit so the doc is saved before sharing.');
                      return;
                    }
                    setShowShare(true);
                  }}
                >
                  <Text style={[styles.moreItemText, { color: text }]}>Share…</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.moreItem} onPress={() => setShowMore(false)}>
                  <Text style={[styles.moreItemText, { color: text }]}>Close</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          )}

          {/* Link / Image prompt */}
          {prompt.visible && (
            <Pressable style={styles.promptOverlay} onPress={() => setPrompt({ visible: false, kind: null, value: '' })}>
              <Pressable
                style={[styles.promptSheet, { backgroundColor: isEditorDark ? '#0C0C14' : '#FFFFFF', borderColor: borderC }]}
                onStartShouldSetResponder={() => true}
              >
                <Text style={[styles.promptTitle, { color: text }]}>
                  {prompt.kind === 'link' ? 'Add link' : 'Insert image'}
                </Text>
                <TextInput
                  value={prompt.value}
                  onChangeText={(v) => setPrompt((p) => ({ ...p, value: v }))}
                  placeholder={prompt.kind === 'link' ? 'https://example.com' : 'https://image-url'}
                  placeholderTextColor={muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.promptInput, { color: text, borderColor: borderC }]}
                />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.promptBtn, { backgroundColor: isEditorDark ? 'rgba(255,255,255,0.04)' : 'rgba(10,10,15,0.04)', borderColor: borderC }]}
                    onPress={() => setPrompt({ visible: false, kind: null, value: '' })}
                  >
                    <Text style={[styles.promptBtnText, { color: muted }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.promptBtn, { backgroundColor: MAGENTA, borderColor: MAGENTA }]}
                    onPress={() => {
                      const v = String(prompt.value || '').trim();
                      setPrompt({ visible: false, kind: null, value: '' });
                      if (!v) return;
                      if (prompt.kind === 'link') postCmd('link', v);
                      if (prompt.kind === 'image') postCmd('image', v);
                    }}
                  >
                    <Text style={[styles.promptBtnText, { color: '#0A0A0F', fontWeight: '800' }]}>Insert</Text>
                  </TouchableOpacity>
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
              // reload sharedWith
              if (trainerId && docId) {
                getTrainerDocument(trainerId, docId).then((d) => {
                  if (d && mounted.current) setSharedWith(Array.isArray(d.sharedWith) ? d.sharedWith : []);
                });
              }
            }}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    backdropFilter: undefined,
  },
  headerBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  headerTitleInput: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginRight: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: '700' },
  editorCard: {
    flex: 1,
    marginHorizontal: 12,
    marginTop: 10,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: MAGENTA,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  toolbar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolbarRow: { paddingHorizontal: 10, paddingVertical: 10, alignItems: 'center', gap: 6 },
  toolBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  toolText: { fontSize: 12 },
  divider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.10)', marginHorizontal: 6 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
  },
  moreOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: Platform.OS === 'ios' ? 64 : 56,
    paddingRight: 12,
  },
  moreMenu: {
    width: 220,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  moreItem: { paddingHorizontal: 14, paddingVertical: 14 },
  moreItemText: { fontSize: 15, fontWeight: '700' },
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
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  promptBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promptBtnText: { fontSize: 14, fontWeight: '700' },
  recoveryModalBody: { fontSize: 15, lineHeight: 24 },
});
