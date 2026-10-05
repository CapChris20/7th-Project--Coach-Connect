// Sets up the rich-text editor ("DocFlow") and the command helpers its toolbar calls.
// Flow: useDocFlowEditor configures the TenTap bridges and returns the editor instance; every other
// export sends a command down into the editor for a feature the starter kit doesn't expose.
// Key thing to understand: the editor runs inside a WebView. The helpers below work by INJECTING
// JavaScript into that web page — that's why they're strings of DOM code, not React calls.
import { useMemo } from 'react';
// vocab: TenTap = React Native wrapper around TipTap/ProseMirror (a web rich-text editor) rendered
// in a WebView. A "bridge" is one feature (link, image, history…) plugged into that editor.
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

// Manipulate here: the empty-document prompt text.
const PLACEHOLDER = "Start writing… or paste from anywhere. We'll tidy it up.";

export function useDocFlowEditor({ initialContent, onUpdate, isDark }) {
  // Take the default bridge set and swap in a configured version of the ones we care about,
  // passing everything else through untouched. Matching on bridge.name (rather than rebuilding the
  // list by hand) means a TenTap upgrade that adds new bridges keeps working automatically.
  // useMemo with [] because this list must be built exactly once — a new array identity would
  // re-initialize the whole editor and wipe the user's undo history.
  const bridgeExtensions = useMemo(
    () => [
      ...TenTapStartKit.map((bridge) => {
        if (bridge.name === 'placeholder') {
          return PlaceholderBridge.configureExtension({ placeholder: PLACEHOLDER });
        }
        // openOnClick false: tapping a link inside the editor should place the cursor for editing,
        // not navigate away. autolink true turns a typed URL into a link automatically.
        if (bridge.name === 'link') {
          return LinkBridge.configureExtension({ openOnClick: false, autolink: true });
        }
        // inline false = images are their own block (not sitting in a line of text).
        // allowBase64 is required for pasted/embedded images, which arrive as data URLs.
        if (bridge.name === 'image') {
          return ImageBridge.configureExtension({ inline: false, allowBase64: true });
        }
        // multicolor true is what enables the highlight-color palette rather than one fixed yellow.
        if (bridge.name === 'highlight') {
          return HighlightBridge.configureExtension({ multicolor: true });
        }
        // Manipulate here: enable all six heading levels. Trim this array to restrict the H-menu.
        if (bridge.name === 'heading') {
          return HeadingBridge.configureExtension({ levels: [1, 2, 3, 4, 5, 6] });
        }
        // Manipulate here: undo depth. 100 steps trades a little memory for a forgiving undo stack.
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
    // '<p></p>' rather than '': TipTap needs at least one block node to place a cursor in, and an
    // empty string can leave the editor unfocusable.
    initialContent: initialContent || '<p></p>',
    // autofocus off so opening a document doesn't immediately throw up the keyboard.
    autofocus: false,
    // avoidIosKeyboard keeps the caret visible above the iOS keyboard.
    avoidIosKeyboard: true,
    // dynamicHeight false = the WebView fills its container and scrolls internally, instead of
    // growing with the content (which would fight the screen's own ScrollView).
    dynamicHeight: false,
    onChange: onUpdate,
    // The WebView's own background must be themed too — otherwise a white page flashes behind the
    // dark UI while the editor loads.
    // Manipulate here: '#121212' is the editor page background in dark mode.
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
// Every helper below funnels through here. Three deliberate details in this one line:
//   - the IIFE `(function(){…})()` keeps injected variables out of the page's global scope, so
//     repeated injections can't collide
//   - try/catch swallows errors: a failed command must not break the editor page
//   - the trailing `true;` is required by WebViews — without a final value, injection can warn or
//     fail on some platforms
// vocab/symbol: editor?.injectJS?.() = do nothing if the editor isn't ready yet
export function injectEditorCommand(editor, js) {
  editor?.injectJS?.(`(function(){ try { ${js} } catch(e) {} })(); true;`);
}

// Inserts raw HTML at the caret. JSON.stringify is doing security work here, not formatting: it
// escapes quotes, backslashes, and newlines so the HTML can't break out of the injected string and
// execute as arbitrary code.
export function insertHtmlAtCursor(editor, html) {
  const safe = JSON.stringify(html || '');
  injectEditorCommand(
    editor,
    // .ProseMirror is the editable div TipTap renders. It must be focused first or execCommand has
    // no selection to act on.
    `const pm = document.querySelector('.ProseMirror'); if (pm) { pm.focus(); document.execCommand('insertHTML', false, ${safe}); }`,
  );
}

// Font size, via a deliberate workaround: execCommand('fontSize') only accepts the legacy 1–7
// scale, so we apply size 7 purely as a MARKER, then find every <font size> tag it created, strip
// the attribute, and set a real CSS pixel size instead. That's why '7' is hardcoded — it's a
// sentinel, not a size.
export function setFontSize(editor, px) {
  injectEditorCommand(
    editor,
    `document.execCommand('styleWithCSS', false, true); document.execCommand('fontSize', false, '7'); document.querySelectorAll('font[size]').forEach(el => { el.removeAttribute('size'); el.style.fontSize='${px}px'; });`,
  );
}

// JSON.stringify again for the same escaping reason — font names contain spaces and quotes.
export function setFontFamily(editor, family) {
  injectEditorCommand(editor, `document.execCommand('fontName', false, ${JSON.stringify(family)});`);
}

// No execCommand exists for line height, so this walks the DOM manually: start at the selection,
// step from a text node up to its element, then climb until we hit a block-level node, and set the
// style there. Setting it on a text node or an inline span would have no visible effect.
// Manipulate here: the matches() selector is the list of blocks line height may be applied to.
export function setLineHeight(editor, value) {
  injectEditorCommand(
    editor,
    // vocab: nodeType === 3 = a text node (as opposed to an element), so we take its parentElement.
    `const sel = window.getSelection(); if (!sel || !sel.rangeCount) return; let n = sel.anchorNode; if (n.nodeType === 3) n = n.parentElement; while (n && !n.matches?.('p,h1,h2,h3,h4,h5,h6,li')) n = n.parentElement; if (n) n.style.lineHeight = '${value}';`,
  );
}

// Maps our alignment names onto the legacy execCommand names. The final `else` makes left the
// default, so an unknown value resets alignment rather than doing nothing.
export function setTextAlign(editor, align) {
  const cmd = align === 'center' ? 'justifyCenter' : align === 'right' ? 'justifyRight' : align === 'justify' ? 'justifyFull' : 'justifyLeft';
  injectEditorCommand(editor, `document.execCommand('${cmd}', false, null);`);
}

// Manipulate here: the starter table is 3 columns with a header row and two empty body rows. The
// trailing <p></p> is important — without it the caret gets stuck inside the table with no way to
// type after it.
export function insertTable(editor) {
  const tableHtml = '<table><tr><th>Header 1</th><th>Header 2</th><th>Header 3</th></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></table><p></p>';
  insertHtmlAtCursor(editor, tableHtml);
}

export function insertHorizontalRule(editor) {
  insertHtmlAtCursor(editor, '<hr />');
}

// These three are thin execCommand passthroughs, here so the toolbar has one consistent API for
// every action rather than mixing bridge methods and raw injections.
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
// Uses the editor's real API (not injection) because TipTap's toggles are the reliable way to change
// block type. It works by toggling OFF whatever is currently on: calling toggleHeading with the
// ACTIVE level turns that heading off. The early return means one call clears one wrapper — heading
// takes precedence since it's the more visible formatting.
export function setNormalText(editor, bridgeState) {
  if (bridgeState?.headingLevel) {
    editor.toggleHeading?.(bridgeState.headingLevel);
    return;
  }
  if (bridgeState?.isBlockquoteActive) {
    editor.toggleBlockquote?.();
  }
}

// Hijacks paste inside the WebView so the native side can restructure the clipboard content
// (see smartPaste.js) instead of letting the browser insert its own markup.
export function setupSmartPasteListener(editor, onPaste) {
  // Reading the injected script below, line by line — note the comments stay OUT here, because
  // anything inside the template literal becomes part of the code sent to the WebView:
  //   1. `pm.__docflowPaste` is the guard against double-binding. This helper can be injected again
  //      on re-render, and without the flag every paste would fire two handlers.
  //   2. If the clipboard has neither text nor HTML (an image, say), we return and let the browser's
  //      default paste run.
  //   3. preventDefault() comes BEFORE posting: it cancels the browser's own paste so the native
  //      side has full control, and will insert the cleaned-up HTML itself.
  //   4. window.ReactNativeWebView.postMessage is the WebView→native message channel. The
  //      'docflow-smart-paste' type string is what the native onMessage handler matches on, so it
  //      must stay in sync with the listener on the React Native side.
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
  // Returned unchanged — callers pass their handler through so registration and handling read as
  // one step at the call site.
  return onPaste;
}
