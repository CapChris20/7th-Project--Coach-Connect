#!/usr/bin/env node
/**
 * Export Cursor agent-transcript .jsonl files to readable Markdown + HTML index.
 * Usage: node scripts/exportCursorChats.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');
const OUT_DIR = path.join(REPO, 'docs/chat-history-recovery/exported-chats');

const MOBILE_APP_TRANSCRIPTS = path.join(
  process.env.HOME,
  '.cursor/projects/Users-captainchris20-Desktop-My-Coding-Portfolio-7th-Project-Coach-Connect-Mobile-App/agent-transcripts'
);

const EXTRA_TRANSCRIPTS = [
  path.join(
    process.env.HOME,
    '.cursor/projects/Users-captainchris20-Coding-Portfolio-7th-Project-Coach-Connect/agent-transcripts'
  ),
];

const RANGE_START = new Date('2026-05-31T00:00:00');
const RANGE_END = new Date('2026-06-14T01:00:00');

function extractText(content) {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content);

  const parts = [];
  for (const part of content) {
    if (!part || typeof part !== 'object') continue;
    if (part.type === 'text' && part.text) {
      parts.push(part.text);
    } else if (part.type === 'tool_use') {
      const name = part.name || 'tool';
      const input = part.input || {};
      const hint =
        input.path ||
        input.pattern ||
        input.glob_pattern ||
        input.command ||
        input.description ||
        '';
      parts.push(`\n> *[${name}${hint ? `: ${String(hint).slice(0, 120)}` : ''}]*\n`);
    } else if (part.type === 'tool_result') {
      // skip bulky tool output in readable export
    }
  }
  return parts.join('\n').trim();
}

function cleanUserText(text) {
  return text
    .replace(/<user_query>\s*/gi, '')
    .replace(/<\/user_query>\s*/gi, '')
    .replace(/<image_files>[\s\S]*?<\/image_files>\s*/gi, '[screenshots attached]\n')
    .replace(/\[Image\]\s*/gi, '')
    .replace(/<timestamp>[^<]*<\/timestamp>\s*/gi, '')
    .trim();
}

function titleFromFirstUser(text) {
  const cleaned = cleanUserText(text).replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Untitled chat';
  return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
}

function parseJsonl(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  const messages = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    const role = obj.role;
    if (role !== 'user' && role !== 'assistant') continue;
    const raw = extractText(obj.message?.content);
    if (!raw) continue;
    const text = role === 'user' ? cleanUserText(raw) : raw;
    if (!text.trim()) continue;
    messages.push({ role, text });
  }
  return messages;
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function exportChat(sessionId, jsonlPath, mtime) {
  const messages = parseJsonl(jsonlPath);
  if (!messages.length) return null;

  const firstUser = messages.find((m) => m.role === 'user')?.text || '';
  const title = titleFromFirstUser(firstUser);
  const dateStr = mtime.toISOString().slice(0, 19).replace('T', ' ');
  const userCount = messages.filter((m) => m.role === 'user').length;
  const fileBase = `${dateStr.slice(0, 10)}__${sessionId.slice(0, 8)}__${slugify(title)}`;
  const mdPath = path.join(OUT_DIR, `${fileBase}.md`);

  const md = [];
  md.push(`# ${title}`);
  md.push('');
  md.push(`- **Session ID:** \`${sessionId}\``);
  md.push(`- **Last saved:** ${dateStr}`);
  md.push(`- **Messages:** ${messages.length} (${userCount} from you)`);
  md.push(`- **Source:** \`${jsonlPath}\``);
  md.push('');
  md.push('---');
  md.push('');

  let n = 0;
  for (const msg of messages) {
    n += 1;
    const label = msg.role === 'user' ? 'You' : 'Cursor';
    md.push(`## ${n}. ${label}`);
    md.push('');
    md.push(msg.text);
    md.push('');
    md.push('---');
    md.push('');
  }

  fs.writeFileSync(mdPath, md.join('\n'), 'utf8');
  return {
    sessionId,
    title,
    dateStr,
    userCount,
    messageCount: messages.length,
    mdFile: path.basename(mdPath),
    jsonlPath,
    sizeKb: Math.round(fs.statSync(jsonlPath).size / 1024),
  };
}

function collectParentChats(rootDir, filterRange) {
  if (!fs.existsSync(rootDir)) return [];
  const out = [];
  for (const name of fs.readdirSync(rootDir)) {
    const dir = path.join(rootDir, name);
    const jsonl = path.join(dir, `${name}.jsonl`);
    if (!fs.statSync(dir).isDirectory() || !fs.existsSync(jsonl)) continue;
    const mtime = fs.statSync(jsonl).mtime;
    if (filterRange && (mtime < RANGE_START || mtime >= RANGE_END)) continue;
    out.push({ sessionId: name, jsonlPath: jsonl, mtime });
  }
  return out.sort((a, b) => a.mtime - b.mtime);
}

function buildHtmlIndex(exports) {
  const rows = exports
    .map(
      (e) => `
    <tr>
      <td>${e.dateStr}</td>
      <td><a href="${e.mdFile}">${escapeHtml(e.title)}</a></td>
      <td>${e.userCount}</td>
      <td>${e.sizeKb} KB</td>
      <td><code>${e.sessionId.slice(0, 8)}…</code></td>
    </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Coach Connect — Cursor Chats (May 31 – Jun 14)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1100px; margin: 2rem auto; padding: 0 1rem; background: #0c0c14; color: #e8e8ed; }
    h1 { font-size: 1.5rem; }
    p, td, th { line-height: 1.5; }
    a { color: #a78bfa; }
    table { width: 100%; border-collapse: collapse; margin-top: 1.5rem; }
    th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid #2a2a3a; vertical-align: top; }
    th { color: #9ca3af; font-weight: 600; }
    code { font-size: 0.85em; background: #1a1a28; padding: 0.1rem 0.35rem; border-radius: 4px; }
    .note { background: #1a1a28; border-radius: 8px; padding: 1rem; margin: 1rem 0; font-size: 0.95rem; }
  </style>
</head>
<body>
  <h1>Coach Connect — exported Cursor chats</h1>
  <p>May 31, 2026 → June 14, 2026 before 1:00 AM · ${exports.length} conversations</p>
  <div class="note">
    Click a title to open the full readable transcript (.md). Open .md files in Cursor or any editor.
    Raw JSONL lives under <code>~/.cursor/projects/.../agent-transcripts/</code>.
  </div>
  <table>
    <thead>
      <tr><th>Date</th><th>Chat</th><th>Your msgs</th><th>Raw size</th><th>ID</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildMarkdownIndex(exports) {
  const lines = [
    '# Cursor chat exports — May 31 to June 14 (before 1 AM)',
    '',
    `**${exports.length} conversations** exported to this folder. Open \`index.html\` in a browser for a clickable table.`,
    '',
    '| Date | Chat | Your msgs | File |',
    '|------|------|-----------|------|',
  ];
  for (const e of exports) {
    lines.push(
      `| ${e.dateStr} | ${e.title.replace(/\|/g, '\\|')} | ${e.userCount} | [${e.mdFile}](./${e.mdFile}) |`
    );
  }
  lines.push('');
  lines.push('## Raw transcript paths');
  lines.push('');
  for (const e of exports) {
    lines.push(`- \`${e.sessionId}\` → \`${e.jsonlPath}\``);
  }
  lines.push('');
  return lines.join('\n');
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const roots = [MOBILE_APP_TRANSCRIPTS, ...EXTRA_TRANSCRIPTS];
  const chats = [];
  for (const root of roots) {
    chats.push(...collectParentChats(root, true));
  }
  chats.sort((a, b) => a.mtime - b.mtime);

  const exports = [];
  for (const chat of chats) {
    const result = exportChat(chat.sessionId, chat.jsonlPath, chat.mtime);
    if (result) exports.push(result);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), buildHtmlIndex(exports), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'README.md'), buildMarkdownIndex(exports), 'utf8');

  console.log(`Exported ${exports.length} chats to ${OUT_DIR}`);
  for (const e of exports) {
    console.log(`  ${e.mdFile}`);
  }
}

main();
