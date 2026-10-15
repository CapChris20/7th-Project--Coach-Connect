// Turns pasted plain text into structured rich-text HTML for the document editor.
// Flow: normalize whitespace → split on blank lines → classify each block → emit HTML → join.
// Used by: the trainer document editor. Recovers headings, lists, quotes, and code the clipboard dropped.

// ===== NAMED CONSTANTS =====

// vocab: \b = word boundary. The character class excludes whitespace and closing punctuation
// that commonly follows a URL, so "see https://x.com)" doesn't swallow the paren into the link.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/g;
// vocab: (?<!\w) / (?!\w) = negative look-behind / look-ahead — not preceded/followed by a word character.
const PHONE_PATTERN = /(?<!\w)(\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?!\w)/g;
const MIN_PHONE_DIGIT_COUNT = 7;
const MIN_CODE_LINES = 2;
const MIN_LIST_LINES = 2;
const CODE_LINE_MAJORITY = 0.5;
const LIST_MARKER_RATIO = 0.7;

// ===== HELPER FUNCTIONS =====

/**
 * Neutralize any HTML-significant character. The & replacement MUST come first or later
 * replacements would double-escape the ampersands they introduce.
 * @param {string} rawText
 * @returns {string}
 */
function escapeHtml(rawText) {
  return rawText
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Whitespace normalization. Line endings are unified first so every later rule can assume plain \n.
 * @param {string} rawText
 * @returns {string}
 */
function cleanText(rawText) {
  return rawText
    .replace(/\r\n?/g, "\n")
    .replace(/\u200B/g, "")
    .replace(/\u00A0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    // Manipulate here: collapse 3+ blank lines to one blank line before block splitting.
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
}

/**
 * Makes URLs and phone numbers tappable. Escape first so pasted text cannot inject markup.
 * @param {string} line
 * @returns {string}
 */
function linkifyAndPhones(line) {
  let escapedLine = escapeHtml(line);
  escapedLine = escapedLine.replace(URL_PATTERN, (urlMatch) => `<a href="${urlMatch}" target="_blank" rel="noopener">${urlMatch}</a>`);
  escapedLine = escapedLine.replace(PHONE_PATTERN, (phoneMatch) => {
    const tel = phoneMatch.replace(/[^\d+]/g, "");
    if (tel.length < MIN_PHONE_DIGIT_COUNT) return phoneMatch;
    return `<a href="tel:${tel}">${phoneMatch}</a>`;
  });
  return escapedLine;
}

/**
 * Heuristic: does this block look like source code? Majority of lines must hit a code signal.
 * @param {string} block
 * @returns {boolean}
 */
function isCodeBlock(block) {
  const lines = block.split("\n");
  if (lines.length < MIN_CODE_LINES) return false;
  const codeIndicators = lines.filter((line) =>
    /^\s{2,}/.test(line) ||
    /[{};=()<>]/.test(line) ||
    /^(function|const|let|var|class|import|export|def|return|if|else|for|while)\b/.test(line)
  ).length;
  // Manipulate here: >0.5 = more than half the lines must look like code.
  return codeIndicators / lines.length > CODE_LINE_MAJORITY;
}

/**
 * Email-style quoting. `every` (not a ratio) because one line without ">" is mixed content.
 * @param {string} block
 * @returns {boolean}
 */
function looksLikeQuote(block) {
  const lines = block.split("\n");
  return lines.every((line) => line.trim().startsWith(">"));
}

/**
 * Returns 'ul', 'ol', or false — the return value doubles as the HTML tag name to emit.
 * @param {string} block
 * @returns {'ul'|'ol'|false}
 */
function looksLikeList(block) {
  const lines = block.split("\n").filter(Boolean);
  if (lines.length < MIN_LIST_LINES) return false;
  const bulletCount = lines.filter((line) => /^[\s]*[-*•·]\s+/.test(line)).length;
  const numberedCount = lines.filter((line) => /^[\s]*\d+[.)]\s+/.test(line)).length;
  if (bulletCount / lines.length > LIST_MARKER_RATIO) return "ul";
  if (numberedCount / lines.length > LIST_MARKER_RATIO) return "ol";
  return false;
}

/**
 * One blank-line-separated block → one HTML snippet. First matching classifier wins.
 * @param {string} block
 * @returns {string}
 */
function htmlForBlock(block) {
  if (isCodeBlock(block)) {
    return `<pre><code>${escapeHtml(block)}</code></pre>`;
  }
  if (looksLikeQuote(block)) {
    const inner = block.split("\n").map((line) => line.replace(/^>\s?/, "")).join("<br>");
    return `<blockquote><p>${linkifyAndPhones(inner)}</p></blockquote>`;
  }
  const listType = looksLikeList(block);
  if (listType) {
    const items = block.split("\n")
      .map((line) => line.replace(/^[\s]*(?:[-*•·]|\d+[.)])\s+/, "").trim())
      .filter(Boolean)
      .map((listItemText) => `<li>${linkifyAndPhones(listItemText)}</li>`)
      .join("");
    return `<${listType}>${items}</${listType}>`;
  }
  const headingMatch = block.match(/^(#{1,6})\s+(.+)$/);
  if (headingMatch && !block.includes("\n")) {
    const headingLevel = headingMatch[1].length;
    return `<h${headingLevel}>${linkifyAndPhones(headingMatch[2])}</h${headingLevel}>`;
  }
  const inner = block.split("\n").map(linkifyAndPhones).join("<br>");
  return `<p>${inner}</p>`;
}

// ===== MAIN FUNCTION =====

/**
 * Smart paste transformations applied to clipboard plain-text.
 * Returns an HTML string ready to be inserted into TipTap.
 * @param {string} plainText
 * @returns {string}
 */
export function smartPasteToHtml(plainText) {
  const text = cleanText(plainText || "");
  if (!text.trim()) return "";
  const blocks = text.split(/\n{2,}/);
  const parts = [];
  for (const rawBlock of blocks) {
    const block = rawBlock.replace(/^\n+|\n+$/g, "");
    if (!block) continue;
    parts.push(htmlForBlock(block));
  }
  return parts.join("");
}
