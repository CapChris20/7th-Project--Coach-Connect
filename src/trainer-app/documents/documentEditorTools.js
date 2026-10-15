// Sets up the rich-text editor ("DocFlow") and the command helpers its toolbar calls.
// Flow: useDocFlowEditor configures TenTap bridges → helpers inject JavaScript into the WebView.
// Used by: the trainer document editor toolbar. The editor is a web page, so commands are DOM strings.

import { useMemo } from 'react';
// vocab: TenTap = React Native wrapper around TipTap/ProseMirror rendered in a WebView.
// A "bridge" is one feature (link, image, history…) plugged into that editor.
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

// ===== NAMED CONSTANTS =====

// Manipulate here: the empty-document prompt text.
const PLACEHOLDER = "Start writing… or paste from anywhere. We'll tidy it up.";
const EMPTY_DOCUMENT_HTML = '<p></p>';
const EDITOR_BG_DARK = '#121212';
const EDITOR_BG_LIGHT = '#ffffff';
const HEADING_LEVELS = [1, 2, 3, 4, 5, 6];
// Manipulate here: undo depth. 100 steps trades a little memory for a forgiving undo stack.
const HISTORY_UNDO_DEPTH = 100;
const FONT_SIZE_MARKER = '7';
const LINE_HEIGHT_BLOCK_SELECTOR = 'p,h1,h2,h3,h4,h5,h6,li';
const STARTER_TABLE_HTML =
  '<table><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table><p></p>';
const HORIZONTAL_RULE_HTML = '<hr />';
const SMART_PASTE_MESSAGE_TYPE = 'docflow-smart-paste';

const ALIGN_COMMAND_BY_NAME = {
  center: 'justifyCenter',
  right: 'justifyRight',
  justify: 'justifyFull',
};
const ALIGN_COMMAND_DEFAULT = 'justifyLeft';

// ===== HELPER FUNCTIONS =====

/**
 * Swap in our configured copy of a starter-kit bridge. Unknown bridges pass through so a TenTap
 * upgrade that adds features keeps working without rewriting this list by hand.
 * @param {object} bridge
 * @returns {object}
 */
function configuredDocFlowBridge(bridge) {
  if (bridge.name === 'placeholder') {
    return PlaceholderBridge.configureExtension({ placeholder: PLACEHOLDER });
  }
  // openOnClick false: tapping a link should place the cursor, not navigate away.
  if (bridge.name === 'link') {
    return LinkBridge.configureExtension({ openOnClick: false, autolink: true });
  }
  // inline false = images are their own block. allowBase64 is required for pasted data-URL images.
  if (bridge.name === 'image') {
    return ImageBridge.configureExtension({ inline: false, allowBase64: true });
  }
  // multicolor true is what enables the highlight-color palette rather than one fixed yellow.
  if (bridge.name === 'highlight') {
    return HighlightBridge.configureExtension({ multicolor: true });
  }
  // Manipulate here: trim HEADING_LEVELS to restrict the H-menu.
  if (bridge.name === 'heading') {
    return HeadingBridge.configureExtension({ levels: HEADING_LEVELS });
  }
  if (bridge.name === 'history') {
    return HistoryBridge.configureExtension({ depth: HISTORY_UNDO_DEPTH });
  }
  return bridge;
}

/**
 * @param {boolean} isDark
 */
function editorWebViewTheme(isDark) {
  const backgroundColor = isDark ? EDITOR_BG_DARK : EDITOR_BG_LIGHT;
  return {
    webview: { backgroundColor },
    webviewContainer: { flex: 1, backgroundColor },
  };
}

/**
 * Align names we show in the toolbar → legacy execCommand names. Unknown values become left
 * so a bad value resets alignment rather than doing nothing.
 * @param {string} align
 * @returns {string}
 */
function execCommandForAlign(align) {
  return ALIGN_COMMAND_BY_NAME[align] || ALIGN_COMMAND_DEFAULT;
}

// ===== MAIN FUNCTION =====

/**
 * Build the DocFlow editor instance. The bridge list is memoized with [] so a new array identity
 * cannot re-initialize the editor and wipe undo history.
 * vocab: useMemo = React hook that keeps the same value until deps change (here: never).
 * vocab: useEditorBridge = TenTap hook that returns the editor handle the toolbar talks to.
 * @param {{ initialContent?: string, onUpdate?: Function, isDark: boolean }} args
 */
export function useDocFlowEditor({ initialContent, onUpdate, isDark }) {
  const bridgeExtensions = useMemo(
    () => TenTapStartKit.map((bridge) => configuredDocFlowBridge(bridge)),
    [],
  );

  const editor = useEditorBridge({
    bridgeExtensions,
    // '<p></p>' rather than '': TipTap needs at least one block node to place a cursor in.
    initialContent: initialContent || EMPTY_DOCUMENT_HTML,
    autofocus: false,
    avoidIosKeyboard: true,
    // dynamicHeight false = the WebView fills its container and scrolls internally.
    dynamicHeight: false,
    onChange: onUpdate,
    // The WebView's own background must be themed too — otherwise a white page flashes in dark mode.
    theme: editorWebViewTheme(isDark),
  });

  return editor;
}

/**
 * Run a snippet inside the editor page.
 * The IIFE keeps injected variables off the page global; try/catch swallows errors so a failed
 * command cannot break the editor; the trailing `true;` is required by some WebViews.
 * vocab/symbol: editor?.injectJS?.() = do nothing if the editor is not ready yet.
 * @param {object} editor
 * @param {string} commandSource
 */
export function injectEditorCommand(editor, commandSource) {
  editor?.injectJS?.(`(function(){ try { ${commandSource} } catch(e) {} })(); true;`);
}

/**
 * Insert raw HTML at the caret. JSON.stringify escapes quotes so the HTML cannot break out of
 * the injected string and run as arbitrary code.
 * @param {object} editor
 * @param {string} html
 */
export function insertHtmlAtCursor(editor, html) {
  const safeHtml = JSON.stringify(html || '');
  injectEditorCommand(
    editor,
    `const pm = document.querySelector('.ProseMirror'); if (pm) { pm.focus(); document.execCommand('insertHTML', false, ${safeHtml}); }`,
  );
}

/**
 * Font size workaround: execCommand('fontSize') only accepts the legacy 1–7 scale, so we apply
 * size 7 as a MARKER, then replace those tags with a real CSS pixel size.
 * @param {object} editor
 * @param {number|string} pixelSize
 */
export function setFontSize(editor, pixelSize) {
  injectEditorCommand(
    editor,
    `document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '${FONT_SIZE_MARKER}'); document.querySelectorAll('font[size]').forEach(el => { el.removeAttribute('size'); el.style.fontSize='${pixelSize}px'; });`,
  );
}

/**
 * @param {object} editor
 * @param {string} family
 */
export function setFontFamily(editor, family) {
  injectEditorCommand(editor, `document.execCommand('fontName', false, ${JSON.stringify(family)});`);
}

/**
 * No execCommand exists for line height, so this climbs from the selection to a block node.
 * vocab: nodeType === 3 = a text node, so we take its parentElement.
 * Manipulate here: LINE_HEIGHT_BLOCK_SELECTOR is the list of blocks line height may be applied to.
 * @param {object} editor
 * @param {string|number} value
 */
export function setLineHeight(editor, value) {
  injectEditorCommand(
    editor,
    `const sel = window.getSelection(); if (!sel || !sel.rangeCount) return; let n = sel.anchorNode; if (n.nodeType === 3) n = n.parentElement; while (n && !n.matches?.('${LINE_HEIGHT_BLOCK_SELECTOR}')) n = n.parentElement; if (n) n.style.lineHeight = '${value}';`,
  );
}

/**
 * @param {object} editor
 * @param {string} align
 */
export function setTextAlign(editor, align) {
  const commandName = execCommandForAlign(align);
  injectEditorCommand(editor, `document.execCommand('${commandName}', false, null);`);
}

/**
 * Starter 3-column table plus a trailing empty paragraph so the caret can escape the table.
 * @param {object} editor
 */
export function insertTable(editor) {
  insertHtmlAtCursor(editor, STARTER_TABLE_HTML);
}

/**
 * @param {object} editor
 */
export function insertHorizontalRule(editor) {
  insertHtmlAtCursor(editor, HORIZONTAL_RULE_HTML);
}

/**
 * @param {object} editor
 */
export function toggleSubscript(editor) {
  injectEditorCommand(editor, `document.execCommand('subscript', false, null);`);
}

/**
 * @param {object} editor
 */
export function toggleSuperscript(editor) {
  injectEditorCommand(editor, `document.execCommand('superscript', false, null);`);
}

/**
 * @param {object} editor
 */
export function clearFormatting(editor) {
  injectEditorCommand(editor, `document.execCommand('removeFormat', false, null);`);
}

/**
 * Reset the current block to a normal paragraph. Heading is cleared first because it is the more
 * visible wrapper; one call clears one wrapper.
 * @param {object} editor
 * @param {object} [bridgeState]
 */
export function setNormalText(editor, bridgeState) {
  if (bridgeState?.headingLevel) {
    editor.toggleHeading?.(bridgeState.headingLevel);
    return;
  }
  if (bridgeState?.isBlockquoteActive) {
    editor.toggleBlockquote?.();
  }
}

/**
 * Hijack paste inside the WebView so the native side can restructure clipboard HTML (smartPaste.js).
 * Returned unchanged so registration and handling still read as one step at the call site.
 * @param {object} editor
 * @param {Function} onPaste
 * @returns {Function}
 */
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
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: '${SMART_PASTE_MESSAGE_TYPE}', payload: { text, html } }));
    });
    `,
  );
  return onPaste;
}
