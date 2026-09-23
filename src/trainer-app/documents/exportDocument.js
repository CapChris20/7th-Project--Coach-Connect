// Export a trainer document (rich-text HTML) as PDF, Markdown, HTML, or plain text, then share it.
// Flow: editor HTML → convert/wrap for the target cellFormatting → write to the cache dir → open the OS
// share sheet so the trainer can AirDrop / email / save it.
// Used by the document editor's export menu.
import 'react-native-url-polyfill/auto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import TurndownService from 'turndown';

// vocab: Turndown = library that converts HTML → Markdown. Built once at module load because it's
// stateless and reusable — constructing it per export would be wasted work.
// Manipulate here: headingStyle 'atx' gives `# Heading` (vs underlines); codeBlockStyle 'fenced'
// gives ``` blocks (vs 4-space indentation).
const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

// Turn a user-typed document title into something safe to use as a filename. Strips anything
// that isn't a letter/number/underscore/dash/space, then collapses spaces to underscores.
// The trailing `|| 'document'` catches a title made ENTIRELY of stripped characters (e.g. "???"),
// which would otherwise produce a file named just ".pdf".
function safeName(name) {
  return (name || 'document').replace(/[^a-z0-9_\-\s]/gi, '').trim().replace(/\s+/g, '_') || 'document';
}

// Escape the title before dropping it into the HTML templates below. Without this, a title like
// `Plan <b>A</b>` would be interpreted as markup instead of shown as text.
// vocab: the replacer object is a lookup table — for each matched char `c`, return its entity.
function escapeHtml(s) {
  return (s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

// HTML → readable plain text. Order is deliberate and each step depends on the one before it:
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

// PDF: there's no direct "HTML → PDF" API, so we render the document in a hidden web view and
// print it to a file. That's why the CSS below has to be inlined — the print renderer has no
// access to the app's stylesheets.
// Manipulate here: this <style> block IS the PDF's look. max-width 780px + margin auto centers
// the text column; line-height 1.6 sets the density; the purple blockquote border is brand color.
export async function exportPdf(title, html) {
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 16px;line-height:1.6;color:#111}
h1,h2,h3{font-family:'Helvetica Neue',Arial,sans-serif}
blockquote{border-left:3px solid #9333ea;padding-left:12px;color:#555;font-style:italic}
pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto}
code{background:#f4f4f5;padding:2px 4px;border-radius:3px}
table{border-collapse:collapse;width:100%} table td,table th{border:1px solid #ddd;padding:6px 8px}
img{max-width:100%}</style></head><body><h1>${escapeHtml(title)}</h1>${html || ''}</body></html>`;
  // printToFileAsync writes a temp PDF and hands back its file:// uri.
  const { uri } = await Print.printToFileAsync({ html: fullHtml });
  await shareFile(uri, 'application/pdf', 'Export PDF');
}

// Markdown: convert, then write the file ourselves (no print step needed).
export async function exportMarkdown(title, html) {
  const md = td.turndown(html || '');
  // vocab: FileSystem.cacheDirectory = app-private scratch space the OS may purge on its own.
  // Correct choice for exports — the real copy is wherever the user shares it to, so we don't
  // want these accumulating in permanent storage.
  const path = `${FileSystem.cacheDirectory}${safeName(title)}.md`;
  await FileSystem.writeAsStringAsync(path, md, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, 'text/markdown', 'Export Markdown');
}

// HTML: same wrapper/CSS as the PDF path so a shared .html file looks like the PDF, but written
// straight to disk instead of going through the print renderer.
// Manipulate here: keep this <style> in sync with exportPdf above, or the two exports will drift.
export async function exportHtml(title, html) {
  const full = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 16px;line-height:1.6;color:#111}
h1,h2,h3{font-family:'Helvetica Neue',Arial,sans-serif}
blockquote{border-left:3px solid #9333ea;padding-left:12px;color:#555;font-style:italic}
pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto}
code{background:#f4f4f5;padding:2px 4px;border-radius:3px}
table{border-collapse:collapse;width:100%} table td,table th{border:1px solid #ddd;padding:6px 8px}
img{max-width:100%}</style></head><body><h1>${escapeHtml(title)}</h1>${html || ''}</body></html>`;
  const path = `${FileSystem.cacheDirectory}${safeName(title)}.html`;
  await FileSystem.writeAsStringAsync(path, full, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, 'text/html', 'Export HTML');
}

// Plain text: the lowest-fidelity export, for pasting into SMS or an email body.
export async function exportPlainText(title, html) {
  const text = htmlToPlainText(html);
  const path = `${FileSystem.cacheDirectory}${safeName(title)}.txt`;
  await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, 'text/plain', 'Export plain text');
}

// Exported separately because other features (previews, notification bodies) need the HTML→text
// conversion without triggering a file write or a share sheet.
export { htmlToPlainText };
