// Smart paste transformations applied to clipboard plain-text and HTML.
// Returns an HTML string ready to be inserted into TipTap.

const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/g;
const PHONE_RE = /(?<!\w)(\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?!\w)/g;

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(t) {
  return t
    .replace(/\r\n?/g, "\n")
    .replace(/\u200B/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

function linkifyAndPhones(line) {
  let out = escapeHtml(line);
  out = out.replace(URL_RE, (m) => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
  out = out.replace(PHONE_RE, (m) => {
    const tel = m.replace(/[^\d+]/g, "");
    if (tel.length < 7) return m;
    return `<a href="tel:${tel}">${m}</a>`;
  });
  return out;
}

function isCodeBlock(block) {
  const lines = block.split("\n");
  if (lines.length < 2) return false;
  const codeIndicators = lines.filter(l =>
    /^\s{2,}/.test(l) ||
    /[{};=()<>]/.test(l) ||
    /^(function|const|let|var|class|import|export|def|return|if|else|for|while)\b/.test(l)
  ).length;
  return codeIndicators / lines.length > 0.5;
}

function looksLikeQuote(block) {
  const lines = block.split("\n");
  return lines.every(l => l.trim().startsWith(">"));
}

function looksLikeList(block) {
  const lines = block.split("\n").filter(Boolean);
  if (lines.length < 2) return false;
  const bullet = lines.filter(l => /^[\s]*[-*•·]\s+/.test(l)).length;
  const numbered = lines.filter(l => /^[\s]*\d+[.)]\s+/.test(l)).length;
  if (bullet / lines.length > 0.7) return "ul";
  if (numbered / lines.length > 0.7) return "ol";
  return false;
}

export function smartPasteToHtml(plain) {
  const text = cleanText(plain || "");
  if (!text.trim()) return "";
  const blocks = text.split(/\n{2,}/);
  const parts = [];
  for (const raw of blocks) {
    const block = raw.replace(/^\n+|\n+$/g, "");
    if (!block) continue;

    if (isCodeBlock(block)) {
      parts.push(`<pre><code>${escapeHtml(block)}</code></pre>`);
      continue;
    }
    if (looksLikeQuote(block)) {
      const inner = block.split("\n").map(l => l.replace(/^>\s?/, "")).join("<br>");
      parts.push(`<blockquote><p>${linkifyAndPhones(inner)}</p></blockquote>`);
      continue;
    }
    const listType = looksLikeList(block);
    if (listType) {
      const items = block.split("\n")
        .map(l => l.replace(/^[\s]*(?:[-*•·]|\d+[.)])\s+/, "").trim())
        .filter(Boolean)
        .map(li => `<li>${linkifyAndPhones(li)}</li>`)
        .join("");
      parts.push(`<${listType}>${items}</${listType}>`);
      continue;
    }
    // Markdown-ish headings
    const headingMatch = block.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && !block.includes("\n")) {
      const lvl = headingMatch[1].length;
      parts.push(`<h${lvl}>${linkifyAndPhones(headingMatch[2])}</h${lvl}>`);
      continue;
    }
    // Default: paragraph; convert single newlines into <br>
    const inner = block.split("\n").map(linkifyAndPhones).join("<br>");
    parts.push(`<p>${inner}</p>`);
  }
  return parts.join("");
}
