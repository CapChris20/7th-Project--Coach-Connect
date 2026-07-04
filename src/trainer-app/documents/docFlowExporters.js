import 'react-native-url-polyfill/auto';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Print from 'expo-print';
import TurndownService from 'turndown';

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

function safeName(name) {
  return (name || 'document').replace(/[^a-z0-9_\-\s]/gi, '').trim().replace(/\s+/g, '_') || 'document';
}

function escapeHtml(s) {
  return (s || '').replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

function htmlToPlainText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|div|li|h1|h2|h3|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function shareFile(path, mimeType, dialogTitle) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, { mimeType, dialogTitle });
  }
}

export async function exportPdf(title, html) {
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>body{font-family:Georgia,serif;max-width:780px;margin:40px auto;padding:0 16px;line-height:1.6;color:#111}
h1,h2,h3{font-family:'Helvetica Neue',Arial,sans-serif}
blockquote{border-left:3px solid #9333ea;padding-left:12px;color:#555;font-style:italic}
pre{background:#f4f4f5;padding:12px;border-radius:6px;overflow:auto}
code{background:#f4f4f5;padding:2px 4px;border-radius:3px}
table{border-collapse:collapse;width:100%} table td,table th{border:1px solid #ddd;padding:6px 8px}
img{max-width:100%}</style></head><body><h1>${escapeHtml(title)}</h1>${html || ''}</body></html>`;
  const { uri } = await Print.printToFileAsync({ html: fullHtml });
  await shareFile(uri, 'application/pdf', 'Export PDF');
}

export async function exportMarkdown(title, html) {
  const md = td.turndown(html || '');
  const path = `${FileSystem.cacheDirectory}${safeName(title)}.md`;
  await FileSystem.writeAsStringAsync(path, md, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, 'text/markdown', 'Export Markdown');
}

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

export async function exportPlainText(title, html) {
  const text = htmlToPlainText(html);
  const path = `${FileSystem.cacheDirectory}${safeName(title)}.txt`;
  await FileSystem.writeAsStringAsync(path, text, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(path, 'text/plain', 'Export plain text');
}

export { htmlToPlainText };
