// Export a trainer document (rich-text HTML) as PDF, Markdown, HTML, or plain text, then share it.
// Flow: editor HTML → convert/wrap for the target format → cache file → OS share sheet.
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
blockquote{border-left:3px solid #0A0A0A;padding-left:12px;color:#575757;font-style:italic}
pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto}
code{background:#f4f4f5;padding:2px 4px;border-radius:3px}
table{border-collapse:collapse;width:100%} table td,table th{border:1px solid #ddd;padding:6px 8px}
img{max-width:100%}`;

const HTML_ENTITY_BY_CHARACTER = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' };

// vocab: Turndown = library that converts HTML → Markdown. Built once at module load because it is
// stateless — constructing it per export would be wasted work.
const htmlToMarkdownConverter = new TurndownService(TURNDOWN_OPTIONS);

// ===== HELPER FUNCTIONS =====

/**
 * Turn a typed title into a safe filename stem.
 * Fallback catches titles made only of stripped characters (e.g. "???") so we never write ".pdf".
 * @param {string} name
 * @returns {string}
 */
function safeFileStemFromTitle(name) {
  const stemFromTitle = (name || DEFAULT_FILE_STEM)
    .replace(/[^a-z0-9_\-\s]/gi, '')
    .trim()
    .replace(/\s+/g, '_');
  if (!stemFromTitle) {
    return DEFAULT_FILE_STEM;
  }
  return stemFromTitle;
}

/**
 * Escape title text before dropping it into HTML templates.
 * Without this, a title like `Plan <b>A</b>` would be interpreted as markup.
 * @param {string} text
 * @returns {string}
 */
function escapeHtmlForTemplate(text) {
  const rawText = text || '';
  return rawText.replace(/[<>&"]/g, (character) => {
    return HTML_ENTITY_BY_CHARACTER[character];
  });
}

/**
 * Same chrome wrapper for PDF and HTML exports so they do not drift apart.
 * @param {string} title
 * @param {string} bodyHtml
 * @returns {string}
 */
function wrapDocumentAsFullHtml(title, bodyHtml) {
  const safeTitle = escapeHtmlForTemplate(title);
  const body = bodyHtml || '';
  const headBlock = `<!doctype html><html><head><meta charset="utf-8"><title>${safeTitle}</title>
<style>${DOCUMENT_EXPORT_STYLE}</style></head>`;
  const bodyBlock = `<body><h1>${safeTitle}</h1>${body}</body></html>`;
  return headBlock + bodyBlock;
}

/**
 * Path under the app cache directory for one export file.
 * vocab: cacheDirectory = app-private scratch the OS may purge; fine for one-shot exports.
 * @param {string} title
 * @param {string} extension
 * @returns {string}
 */
function cacheFilePathForExport(title, extension) {
  return `${FileSystem.cacheDirectory}${safeFileStemFromTitle(title)}.${extension}`;
}

/**
 * HTML → readable plain text. Order is deliberate — each step depends on the one before it.
 * @param {string} html
 * @returns {string}
 */
function stripHtmlToPlainText(html) {
  return String(html || '')
    // 1. Drop <style> blocks so CSS text does not survive tag-stripping.
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    // 2. Closing block tags → newlines so paragraphs keep their breaks.
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // 3. Remove every remaining tag.
    .replace(/<[^>]+>/g, '')
    // 4. Decode entities last — earlier would reintroduce < > that step 3 would eat.
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    // Manipulate here: collapse 3+ blank lines to one blank line so exports are not gappy.
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Open the OS share sheet when sharing is available (skips quietly on web).
 * vocab: async/await = pause until the promise resolves, without callback nesting
 * @param {string} path
 * @param {string} mimeType
 * @param {string} dialogTitle
 * @returns {Promise<void>}
 */
async function openShareSheetIfAvailable(path, mimeType, dialogTitle) {
  const sharingWorks = await Sharing.isAvailableAsync();
  if (!sharingWorks) {
    return;
  }
  await Sharing.shareAsync(path, { mimeType, dialogTitle });
}

/**
 * Write UTF-8 text to a cache path, then share it.
 * @param {string} path
 * @param {string} contents
 * @param {string} mimeType
 * @param {string} dialogTitle
 * @returns {Promise<void>}
 */
async function writeTextFileAndShare(path, contents, mimeType, dialogTitle) {
  await FileSystem.writeAsStringAsync(path, contents, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await openShareSheetIfAvailable(path, mimeType, dialogTitle);
}

// ===== MAIN FUNCTION =====

/**
 * PDF: render HTML in a hidden web view and print to a temp file, then share.
 * CSS must be inlined — the print renderer has no access to the app's stylesheets.
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportPdf(title, html) {
  // 1. Wrap with the same chrome as HTML export.
  const fullHtml = wrapDocumentAsFullHtml(title, html);

  // 2. vocab: printToFileAsync renders HTML and writes a temp PDF uri.
  const printResult = await Print.printToFileAsync({ html: fullHtml });

  // 3. Hand the file to the OS share sheet.
  await openShareSheetIfAvailable(printResult.uri, MIME_PDF, SHARE_TITLE_PDF);
}

/**
 * Markdown: convert with Turndown, write a .md file, then share.
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportMarkdown(title, html) {
  const markdownBody = htmlToMarkdownConverter.turndown(html || '');
  const filePath = cacheFilePathForExport(title, 'md');
  await writeTextFileAndShare(filePath, markdownBody, MIME_MARKDOWN, SHARE_TITLE_MARKDOWN);
}

/**
 * HTML: same wrapper/CSS as PDF, written straight to disk (no print step).
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportHtml(title, html) {
  const fullHtml = wrapDocumentAsFullHtml(title, html);
  const filePath = cacheFilePathForExport(title, 'html');
  await writeTextFileAndShare(filePath, fullHtml, MIME_HTML, SHARE_TITLE_HTML);
}

/**
 * Plain text: lowest-fidelity export for pasting into SMS or email.
 * @param {string} title
 * @param {string} html
 * @returns {Promise<void>}
 */
export async function exportPlainText(title, html) {
  const plainText = stripHtmlToPlainText(html);
  const filePath = cacheFilePathForExport(title, 'txt');
  await writeTextFileAndShare(filePath, plainText, MIME_PLAIN_TEXT, SHARE_TITLE_PLAIN_TEXT);
}

// Previews and notification bodies need conversion without a share sheet.
export { stripHtmlToPlainText as htmlToPlainText };
