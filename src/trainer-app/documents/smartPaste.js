// Turns pasted plain text into structured rich-text HTML for the document editor.
// Flow: normalize whitespace → split into blank-line-separated blocks → classify each block
// (code / quote / list / heading / paragraph) → emit the matching HTML → join.
// Why it exists: pasting a plan from Notes or an email would otherwise arrive as one flat blob;
// this recovers the structure the user could see but the clipboard didn't carry.

// Smart paste transcellFormattingions applied to clipboard plain-text and HTML.
// Returns an HTML string ready to be inserted into TipTap.

// vocab: \b = word boundary. The character class excludes whitespace and the closing punctuation
// that commonly follows a URL, so "see https://x.com)" doesn't swallow the paren into the link.
const URL_RE = /\bhttps?:\/\/[^\s<>"')]+/g;
// Phone numbers, loosely: optional country code, optional area code in parens, then 3–4 + 3–4 digits.
// vocab: (?<!\w) / (?!\w) = negative look-behind / look-ahead — "not preceded/followed by a word
// character". Those guards are what stop the middle of an order number or an ID from matching.
const PHONE_RE = /(?<!\w)(\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?!\w)/g;

// Neutralize any HTML-significant character in pasted text. The & replacement MUST come first —
// doing it later would double-escape the ampersands introduced by the other replacements
// (turning "&lt;" into "&amp;lt;").
function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Whitespace normalization. Order matters here too: line endings are unified first so every later
// rule can assume plain \n.
function cleanText(t) {
  return t
    // Windows/old-Mac line endings → \n.
    .replace(/\r\n?/g, "\n")
    // Zero-width spaces, invisible junk from web copies.
    .replace(/\u200B/g, "")
    // Non-breaking spaces → real spaces, or words stay glued together.
    .replace(/\u00A0/g, " ")
    // Trailing spaces before a newline (very common in email quoting).
    .replace(/[ \t]+\n/g, "\n")
    // Manipulate here: collapse 3+ blank lines to one blank line. This runs BEFORE block splitting,
    // so it prevents huge runs of empty paragraphs.
    .replace(/\n{3,}/g, "\n\n")
    // Runs of spaces/tabs inside a line → one space (fixes justified text pasted from PDFs).
    .replace(/[ \t]{2,}/g, " ");
}

// Makes URLs and phone numbers tappable. Escaping happens FIRST so the user's text can't inject
// markup, and only then do we add our own trusted <a> tags.
function linkifyAndPhones(line) {
  let out = escapeHtml(line);
  // Manipulate here: rel="noopener" is a security must-keep — without it the opened page can
  // reach back into this one via window.opener.
  out = out.replace(URL_RE, (m) => `<a href="${m}" target="_blank" rel="noopener">${m}</a>`);
  out = out.replace(PHONE_RE, (m) => {
    // The href needs digits and a leading + only; the visible text keeps the user's cellFormattingting.
    const tel = m.replace(/[^\d+]/g, "");
    // Manipulate here: under 7 digits it's probably a date, price, or ID, not a phone — leave it
    // as plain text. This is the main defense against the loose PHONE_RE over-matching.
    if (tel.length < 7) return m;
    return `<a href="tel:${tel}">${m}</a>`;
  });
  return out;
}

// Heuristic: does this block look like source code? We score each line against three signals and
// require a majority, because any ONE signal alone gives false positives (prose has parentheses,
// and indented text isn't always code).
function isCodeBlock(block) {
  const lines = block.split("\n");
  // A single line is never treated as a code block — too little evidence, and a one-line <pre>
  // looks wrong in a document.
  if (lines.length < 2) return false;
  const codeIndicators = lines.filter(l =>
    // Signal 1: indented by 2+ spaces.
    /^\s{2,}/.test(l) ||
    // Signal 2: contains punctuation that's dense in code but rare in prose.
    /[{};=()<>]/.test(l) ||
    // Signal 3: starts with a keyword from a common language.
    /^(function|const|let|var|class|import|export|def|return|if|else|for|while)\b/.test(l)
  ).length;
  // Manipulate here: >0.5 = more than half the lines must look like code. Raise toward 0.8 if
  // prose is being misdetected; lower it if real code snippets are being missed.
  return codeIndicators / lines.length > 0.5;
}

// Email-style quoting. `every` (not a ratio) because a quote block is unambiguous — if even one
// line lacks the ">" it's mixed content and belongs in a paragraph instead.
function looksLikeQuote(block) {
  const lines = block.split("\n");
  return lines.every(l => l.trim().startsWith(">"));
}

// Returns 'ul', 'ol', or false — the return value doubles as the HTML tag name to emit.
function looksLikeList(block) {
  const lines = block.split("\n").filter(Boolean);
  // One bullet isn't a list.
  if (lines.length < 2) return false;
  // Manipulate here: the accepted bullet characters (-, *, •, ·) and numbered forms ("1." / "1)").
  const bullet = lines.filter(l => /^[\s]*[-*•·]\s+/.test(l)).length;
  const numbered = lines.filter(l => /^[\s]*\d+[.)]\s+/.test(l)).length;
  // Manipulate here: 0.7 = 70% of lines must carry a marker. Deliberately lenient so a list with
  // one wrapped continuation line still registers as a list.
  if (bullet / lines.length > 0.7) return "ul";
  if (numbered / lines.length > 0.7) return "ol";
  return false;
}

export function smartPasteToHtml(plain) {
  const text = cleanText(plain || "");
  if (!text.trim()) return "";
  // A blank line is the block separator — the same convention as Markdown, and what most people
  // actually type when they mean "new paragraph".
  const blocks = text.split(/\n{2,}/);
  const parts = [];
  for (const raw of blocks) {
    const block = raw.replace(/^\n+|\n+$/g, "");
    if (!block) continue;

    // Classification order is significant: each check is more specific than the next, and the
    // first match wins via `continue`. Code is tested first because a code block can easily
    // contain something that looks like a list or a heading (a "# comment" line, for instance).
    if (isCodeBlock(block)) {
      // Escaped, never linkified — a URL inside a code sample must stay literal text.
      parts.push(`<pre><code>${escapeHtml(block)}</code></pre>`);
      continue;
    }
    if (looksLikeQuote(block)) {
      // Strip the "> " marker from each line, then rejoin with <br> so the quote stays one
      // paragraph rather than becoming several.
      const inner = block.split("\n").map(l => l.replace(/^>\s?/, "")).join("<br>");
      parts.push(`<blockquote><p>${linkifyAndPhones(inner)}</p></blockquote>`);
      continue;
    }
    const listType = looksLikeList(block);
    if (listType) {
      const items = block.split("\n")
        // Remove whichever marker style this line used (bullet or number).
        .map(l => l.replace(/^[\s]*(?:[-*•·]|\d+[.)])\s+/, "").trim())
        // Drop lines that were nothing but a marker.
        .filter(Boolean)
        .map(li => `<li>${linkifyAndPhones(li)}</li>`)
        .join("");
      // listType is 'ul' or 'ol', used directly as the wrapping tag.
      parts.push(`<${listType}>${items}</${listType}>`);
      continue;
    }
    // Markdown-ish headings
    // The `!block.includes("\n")` guard means only a STANDALONE line becomes a heading — otherwise
    // a paragraph that happens to begin with "#" would lose all its remaining lines.
    // Manipulate here: {1,6} accepts # through ###### (h1–h6); the count of #s becomes the level.
    const headingMatch = block.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch && !block.includes("\n")) {
      const lvl = headingMatch[1].length;
      parts.push(`<h${lvl}>${linkifyAndPhones(headingMatch[2])}</h${lvl}>`);
      continue;
    }
    // Default: paragraph; convert single newlines into <br>
    // Single newlines become line breaks (not new paragraphs) because the blank-line split above
    // already claimed paragraph duty — this preserves things like address blocks.
    const inner = block.split("\n").map(linkifyAndPhones).join("<br>");
    parts.push(`<p>${inner}</p>`);
  }
  // No separator: block-level tags already provide their own spacing.
  return parts.join("");
}
