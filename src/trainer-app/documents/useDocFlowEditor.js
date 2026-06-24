import { useMemo } from 'react';
import {
  useEditorBridge,
  TenTapStartKit,
  PlaceholderBridge,
  LinkBridge,
  ImageBridge,
  HighlightBridge,
  HeadingBridge,
  HistoryBridge,
} from '@10play/tentap-editor';

const PLACEHOLDER = "Start writing… or paste from anywhere. We'll tidy it up.";

export function useDocFlowEditor({ initialContent, onUpdate, isDark }) {
  const bridgeExtensions = useMemo(
    () => [
      ...TenTapStartKit.map((bridge) => {
        if (bridge.name === 'placeholder') {
          return PlaceholderBridge.configureExtension({ placeholder: PLACEHOLDER });
        }
        if (bridge.name === 'link') {
          return LinkBridge.configureExtension({ openOnClick: false, autolink: true });
        }
        if (bridge.name === 'image') {
          return ImageBridge.configureExtension({ inline: false, allowBase64: true });
        }
        if (bridge.name === 'highlight') {
          return HighlightBridge.configureExtension({ multicolor: true });
        }
        if (bridge.name === 'heading') {
          return HeadingBridge.configureExtension({ levels: [1, 2, 3, 4, 5, 6] });
        }
        if (bridge.name === 'history') {
          return HistoryBridge.configureExtension({ depth: 100 });
        }
        return bridge;
      }),
    ],
    [],
  );

  const editor = useEditorBridge({
    bridgeExtensions,
    initialContent: initialContent || '<p></p>',
    autofocus: false,
    avoidIosKeyboard: true,
    dynamicHeight: false,
    onChange: onUpdate,
    theme: {
      webview: {
        backgroundColor: isDark ? '#121212' : '#ffffff',
      },
      webviewContainer: {
        flex: 1,
        backgroundColor: isDark ? '#121212' : '#ffffff',
      },
    },
  });

  return editor;
}

/** Inject helpers for features not in TenTapStarterKit */
export function injectEditorCommand(editor, js) {
  editor?.injectJS?.(`(function(){ try { ${js} } catch(e) {} })(); true;`);
}

export function insertHtmlAtCursor(editor, html) {
  const safe = JSON.stringify(html || '');
  injectEditorCommand(
    editor,
    `const pm = document.querySelector('.ProseMirror'); if (pm) { pm.focus(); document.execCommand('insertHTML', false, ${safe}); }`,
  );
}

export function setFontSize(editor, px) {
  injectEditorCommand(
    editor,
    `document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '7'); document.querySelectorAll('font[size]').forEach(el => { el.removeAttribute('size'); el.style.fontSize='${px}px'; });`,
  );
}

export function setFontFamily(editor, family) {
  injectEditorCommand(editor, `document.execCommand('fontName', false, ${JSON.stringify(family)});`);
}

export function setLineHeight(editor, value) {
  injectEditorCommand(
    editor,
    `const sel = window.getSelection(); if (!sel || !sel.rangeCount) return; let n = sel.anchorNode; if (n.nodeType === 3) n = n.parentElement; while (n && !n.matches?.('p,h1,h2,h3,h4,h5,h6,li')) n = n.parentElement; if (n) n.style.lineHeight = '${value}';`,
  );
}

export function setTextAlign(editor, align) {
  const cmd = align === 'center' ? 'justifyCenter' : align === 'right' ? 'justifyRight' : align === 'justify' ? 'justifyFull' : 'justifyLeft';
  injectEditorCommand(editor, `document.execCommand('${cmd}', false, null);`);
}

export function insertTable(editor) {
  const tableHtml = '<table><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table><p></p>';
  insertHtmlAtCursor(editor, tableHtml);
}

export function insertHorizontalRule(editor) {
  insertHtmlAtCursor(editor, '<hr />');
}

export function toggleSubscript(editor) {
  injectEditorCommand(editor, `document.execCommand('subscript', false, null);`);
}

export function toggleSuperscript(editor) {
  injectEditorCommand(editor, `document.execCommand('superscript', false, null);`);
}

export function clearFormatting(editor) {
  injectEditorCommand(editor, `document.execCommand('removeFormat', false, null);`);
}

/** Reset block to normal paragraph (heading / quote off). */
export function setNormalText(editor, bridgeState) {
  if (bridgeState?.headingLevel) {
    editor.toggleHeading?.(bridgeState.headingLevel);
    return;
  }
  if (bridgeState?.isBlockquoteActive) {
    editor.toggleBlockquote?.();
  }
}

export function setupSmartPasteListener(editor, onPaste) {
  injectEditorCommand(
    editor,
    `
    const pm = document.querySelector('.ProseMirror');
    if (!pm || pm.__docflowPaste) return;
    pm.__docflowPaste = true;
    pm.addEventListener('paste', function(e) {
      const text = e.clipboardData?.getData('text/plain') || '';
      const html = e.clipboardData?.getData('text/html') || '';
      if (!text && !html) return;
      e.preventDefault();
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'docflow-smart-paste', payload: { text, html } }));
    });
    `,
  );
  return onPaste;
}
