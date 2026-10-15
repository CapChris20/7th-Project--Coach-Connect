// Export a trainer document (rich-text HTML) as PDF, Markdown, HTML, or plain text, then share it.
// Flow: editor HTML → convert/wrap for the target format → write to the cache dir → open the OS share sheet.
// Used by the document editor's export menu.

import 'react-native-url-polyfill/auto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import TurndownService from 'turndown';

// ===== NAMED CONSTANTS =====

const DEFAULT_FILE_STEM = 'document';
const MIME_PDF = 'application/pdf';
const MIME_MARKDOWN = 'text/markdown';
const MIME_HTML = 'text/html';
const MIME_PLAIN_TEXT = 'text/plain';
const SHARE_TITLE_PDF = 'Export PDF';
const SHARE_TITLE_MARKDOWN = 'Export Markdown';
const SHARE_TITLE_HTML = 'Export HTML';
const SHARE_TITLE_PLAIN_TEXT = 'Export plain text';

// Manipulate here: headingStyle 'atx' gives `# Heading` (vs underlines); codeBlockStyle 'fenced'
// gives ``` blocks (vs 4-space indentation).
const TURNDOWN_OPTIONS = { headingStyle: 'atx', codeBlockStyle: 'fenced' };

// Shared wrapper/CSS for PDF and HTML so the two exports do not drift.
// Manipulate here: this <style> block IS the PDF/HTML look. Colors and copy must stay identical.
const DOCUMENT_EXPORT_STYLE = `body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 16px;line-height:1.6;color:#111}
h1,h2,h3{font-family:'Helvetica Neue',Arial,sans-serif}
blockquote{border-left:3px solid #9333ea;padding-left:12px;color:#555;font-style:italic}
pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto}
code{background:#f4f4f5;padding:2px 4px;border-radius:3px}
table{border-collapse:collapse;width:100%} table td,table th{border:1px solid #ddd;padding:6px 8px}
img{max-width:100%}`;

const HTML_ENTITY_BY_CHARACTER = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };

// ===== HELPER FUNCTIONS =====

// vocab: Turndown = library that converts HTML → Markdown. Built once at module load because it's
// stateless and reusable — constructing it per export would be wasted work.
const htmlToMarkdownConverter = new TurndownService(TURNDOWN_OPTIONS);

// Turn a user-typed document title into something safe to use as a filename. Strips anything
// that isn't a letter/number/underscore/dash/space, then collapses spaces to underscores.
// The trailing fallback catches a title made ENTIRELY of stripped characters (e.g. "???"),
// which would otherwise produce a file named just ".pdf".
function safeFileStem(name) {
  return (name || DEFAULT_FILE_STEM).replace(/[^a-z0-9_\-\s]/gi, '').trim().replace(/\s+/g, '_') || DEFAULT_FILE_STEM;
}

// Escape the title before dropping it into the HTML templates below. Without this, a title like
// `Plan <b>A</b>` would be interpreted as markup instead of shown as text.
function escapeHtml(text) {
  return (text || '').replace(/[<>&"]/g, (character) => HTML_ENTITY_BY_CHARACTER[character]);
}

function wrapDocumentAsHtml(title, html) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>${DOCUMENT_EXPORT_STYLE}</style></head><body><h1>${escapeHtml(title)}</h1>${html || ''}</body></html>`;
}

function cacheFilePath(title, extension) {
  // vocab: FileSystem.cacheDirectory = app-private scratch space the OS may purge on its own.
  // Correct choice for exports — the real copy is wherever the user shares it to, so we don't
  // want these accumulating in permanent storage.
  return `${FileSystem.cacheDirectory}${safeFileStem(title)}.${extension}`;
}

/**
 * HTML → readable plain text. Order is deliberate and each step depends on the one before it.
 * Exported for previews and notification bodies that need conversion without a share sheet.
 * @param {string} html
 * @returns {string}
 */
function htmlToPlainText(html) {
  return String(html || '')
    // 1. Drop <style> blocks entirely — otherwise their CSS text survives tag-stripping.
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // 2. Turn block-level CLOSING tags into newlines, so paragraphs/list items keep their breaks.
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // 3. Now that structure is preserved as newlines, remove every remaining tag.
    .replace(/<[^>]+>/g, '')
    // 4. Decode entities last — doing it earlier would reintroduce < and > that step 3 would eat.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Manipulate here: collapse 3+ blank lines down to one blank line so exports aren't gappy.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// One share path for all four exporters. The availability check matters: sharing is unsupported
// on some platforms (notably web), and calling shareAsync there throws.
// vocab: async/await = pause here until the promise resolves, without callback nesting
async function shareFile(path, mimeType, dialogTitle) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType, dialogTitle });
  }
}

async function writeUtf8AndShare(path, contents, mimeType, dialogTitle) {
  await FileSystem.writeAsStringAsync(path, contents, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, mimeType, dialogTitle);
}

// ===== MAIN FUNCTION =====

/**
 * PDF: there's no direct "HTML → PDF" API, so we render the document in a hidden web view and
 * print it to a file. That's why the CSS has to be inlined — the print renderer has no
 * access to the app's stylesheets.
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportPdf(title, html) {
  const fullHtml = wrapDocumentAsHtml(title, html);
  // printToFileAsync writes a temp PDF and hands back its file:// uri.
  const { uri } = await Print.printToFileAsync({ html: fullHtml });
  await shareFile(uri, MIME_PDF, SHARE_TITLE_PDF);
}

/**
 * Markdown: convert, then write the file ourselves (no print step needed).
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportMarkdown(title, html) {
  const markdown = htmlToMarkdownConverter.turndown(html || '');
  await writeUtf8AndShare(cacheFilePath(title, 'md'), markdown, MIME_MARKDOWN, SHARE_TITLE_MARKDOWN);
}

/**
 * HTML: same wrapper/CSS as the PDF path so a shared .html file looks like the PDF, but written
 * straight to disk instead of going through the print renderer.
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportHtml(title, html) {
  const fullHtml = wrapDocumentAsHtml(title, html);
  await writeUtf8AndShare(cacheFilePath(title, 'html'), fullHtml, MIME_HTML, SHARE_TITLE_HTML);
}

/**
 * Plain text: the lowest-fidelity export, for pasting into SMS or an email body.
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportPlainText(title, html) {
  const text = htmlToPlainText(html);
  await writeUtf8AndShare(cacheFilePath(title, 'txt'), text, MIME_PLAIN_TEXT, SHARE_TITLE_PLAIN_TEXT);
}

// Exported separately because other features (previews, notification bodies) need the HTML→text
// conversion without triggering a file write or a share sheet.
export { htmlToPlainText };
