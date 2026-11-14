// Sets up the DocFlow rich-text editor and the toolbar helpers that talk to its WebView.
// Flow: useDocFlowEditor wires TenTap bridges → helpers inject one DOM command each via injectJS.
// Used by: trainer document flows on the TipTap stack (parallel to the legacy contenteditable editor).

import { useMemo } from 'react';
// vocab: TenTap = React Native wrapper around TipTap/ProseMirror in a WebView.
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
// Manipulate here: undo depth. Higher = more memory, more forgiving undo.
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
 * Toolbar align name → legacy document.execCommand name. Unknown → left align.
 * @param {string} alignName
 * @returns {string}
 */
function execCommandNameForAlign(alignName) {
  return ALIGN_COMMAND_BY_NAME[alignName] || ALIGN_COMMAND_DEFAULT;
}

/**
 * WebView chrome colors so the page flash matches light/dark.
 * @param {boolean} isDark
 * @returns {{ webview: object, webviewContainer: object }}
 */
function themeColorsForEditorWebView(isDark) {
  const backgroundColor = isDark ? EDITOR_BG_DARK : EDITOR_BG_LIGHT;
  return {
    webview: { backgroundColor },
    webviewContainer: { flex: 1, backgroundColor },
  };
}

/**
 * Run a JavaScript snippet inside the editor page.
 * vocab: IIFE keeps injected vars off window; trailing `true;` satisfies some WebViews.
 * @param {object} editor
 * @param {string} commandSource
 */
export function injectEditorCommand(editor, commandSource) {
  editor?.injectJS?.(`(function(){ try { ${commandSource} } catch (toolError) {} })(); true;`);
}

/**
 * Insert HTML at the caret. JSON.stringify prevents quote breakage in injected JS.
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
 * Font size via execCommand marker 7, then replace <font> tags with a real px size.
 * @param {object} editor
 * @param {number} pixelSize
 */
export function setFontSize(editor, pixelSize) {
  injectEditorCommand(
    editor,
    `document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '${FONT_SIZE_MARKER}'); document.querySelectorAll('font[size]').forEach(el => { el.removeAttribute('size'); el.style.fontSize='${pixelSize}px'; });`,
  );
}

/**
 * Set the font family on the current selection.
 * @param {object} editor
 * @param {string} family
 */
export function setFontFamily(editor, family) {
  injectEditorCommand(
    editor,
    `document.execCommand('fontName', false, ${JSON.stringify(family)});`,
  );
}

/**
 * Line height has no execCommand — walk from selection to a block in LINE_HEIGHT_BLOCK_SELECTOR.
 * vocab: nodeType === 3 means a text node; we use its parentElement.
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
 * Align the current block (left / center / right / justify).
 * @param {object} editor
 * @param {string} alignName
 */
export function setTextAlign(editor, alignName) {
  const commandName = execCommandNameForAlign(alignName);
  injectEditorCommand(editor, `document.execCommand('${commandName}', false, null);`);
}

/**
 * Insert a starter 3-column table at the caret.
 * @param {object} editor
 */
export function insertTable(editor) {
  insertHtmlAtCursor(editor, STARTER_TABLE_HTML);
}

/**
 * Insert a horizontal rule at the caret.
 * @param {object} editor
 */
export function insertHorizontalRule(editor) {
  insertHtmlAtCursor(editor, HORIZONTAL_RULE_HTML);
}

/**
 * Toggle subscript on the selection.
 * @param {object} editor
 */
export function toggleSubscript(editor) {
  injectEditorCommand(editor, `document.execCommand('subscript', false, null);`);
}

/**
 * Toggle superscript on the selection.
 * @param {object} editor
 */
export function toggleSuperscript(editor) {
  injectEditorCommand(editor, `document.execCommand('superscript', false, null);`);
}

/**
 * Strip inline formatting from the selection.
 * @param {object} editor
 */
export function clearFormatting(editor) {
  injectEditorCommand(editor, `document.execCommand('removeFormat', false, null);`);
}

/**
 * Drop heading / blockquote wrappers back to normal body text.
 * Heading is cleared first because it is the more visible wrapper.
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
 * Hijack paste in the WebView so the native side can restructure clipboard HTML (smartPaste.js).
 * Returns onPaste unchanged so registration and handling still read as one step at the call site.
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

// ===== MAIN FUNCTION =====

/**
 * Build the DocFlow editor instance for the toolbar to drive.
 * Flow: 1. memoize bridges  2. create bridge  3. return handle
 * @param {object} args
 * @param {string} [args.initialContent]
 * @param {Function} [args.onUpdate]
 * @param {boolean} args.isDark
 * @returns {object}
 */
export function useDocFlowEditor({ initialContent, onUpdate, isDark }) {
  // 1. Bridge list is frozen per mount so TipTap does not reset undo history.
  const bridgeExtensions = useMemo(
    () => TenTapStartKit.map((starterBridge) => configuredDocFlowBridge(starterBridge)),
    [],
  );

  // 2. Wire the WebView editor — initialContent must be at least one block (<p></p>).
  const editor = useEditorBridge({
    bridgeExtensions,
    initialContent: initialContent || EMPTY_DOCUMENT_HTML,
    autofocus: false,
    avoidIosKeyboard: true,
    dynamicHeight: false,
    onChange: onUpdate,
    theme: themeColorsForEditorWebView(isDark),
  });

  // 3. Hand the editor back to the screen / toolbar.
  return editor;
}

// PLUMBING — skip unless debugging TenTap bridge names or paste hook internals.

/**
 * Swap in our configured copy of each starter-kit bridge.
 * Unknown names pass through so a TenTap upgrade keeps working without rewriting this list.
 * @param {object} starterBridge
 * @returns {object}
 */
function configuredDocFlowBridge(starterBridge) {
  if (starterBridge.name === 'placeholder') {
    return PlaceholderBridge.configureExtension({ placeholder: PLACEHOLDER });
  }
  // openOnClick false: tapping a link places the cursor, does not navigate away.
  if (starterBridge.name === 'link') {
    return LinkBridge.configureExtension({ openOnClick: false, autolink: true });
  }
  // inline false = images are their own block. allowBase64 is required for pasted data-URL images.
  if (starterBridge.name === 'image') {
    return ImageBridge.configureExtension({ inline: false, allowBase64: true });
  }
  // multicolor true enables the highlight-color palette rather than one fixed yellow.
  if (starterBridge.name === 'highlight') {
    return HighlightBridge.configureExtension({ multicolor: true });
  }
  // Manipulate here: trim HEADING_LEVELS to restrict the H-menu.
  if (starterBridge.name === 'heading') {
    return HeadingBridge.configureExtension({ levels: HEADING_LEVELS });
  }
  if (starterBridge.name === 'history') {
    return HistoryBridge.configureExtension({ depth: HISTORY_UNDO_DEPTH });
  }
  return starterBridge;
}
