// Turns pasted plain text into structured rich-text HTML for the document editor.
// Flow: normalize whitespace → split on blank lines → classify each block → emit HTML → join.
// Used by: trainer document editor paste handler. Recovers headings, lists, quotes, and code.

// ===== NAMED CONSTANTS =====

// vocab: \b = word boundary; keeps trailing ")" off the URL capture.
const URL_PATTERN = /\bhttps?:\/\/[^\s<>"')]+/g;
// vocab: look-behind / look-ahead — phone match must not sit inside a longer word.
const PHONE_PATTERN = /(?<!\w)(\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?!\w)/g;
const MIN_PHONE_DIGIT_COUNT = 7;
const MIN_CODE_LINES = 2;
const MIN_LIST_LINES = 2;
// Manipulate here: majority thresholds for code-block and list heuristics.
const CODE_LINE_MAJORITY = 0.5;
const LIST_MARKER_RATIO = 0.7;

// ===== HELPER FUNCTIONS =====

/**
 * True when the matched slice looks like a phone number (not a random digit run).
 * @param {string} matchedText
 * @returns {boolean}
 */
function textLooksLikePhoneNumber(matchedText) {
  const digitCount = String(matchedText || '').replace(/\D/g, '').length;
  return digitCount >= MIN_PHONE_DIGIT_COUNT;
}

/**
 * Escape HTML so pasted text cannot inject tags.
 * Ampersands first — otherwise later replacements double-escape.
 * @param {string} rawText
 * @returns {string}
 */
function escapeHtmlCharacters(rawText) {
  let safe = rawText;
  safe = safe.replace(/&/g, '&amp;');
  safe = safe.replace(/</g, '&lt;');
  safe = safe.replace(/>/g, '&gt;');
  safe = safe.replace(/"/g, '&quot;');
  safe = safe.replace(/'/g, '&#39;');
  return safe;
}

/**
 * Normalize line endings and stray unicode whitespace from the clipboard.
 * @param {string} rawText
 * @returns {string}
 */
function normalizePastedPlainText(rawText) {
  let cleaned = rawText;
  cleaned = cleaned.replace(/\r\n?/g, '\n');
  cleaned = cleaned.replace(/\u200B/g, '');
  cleaned = cleaned.replace(/\u00A0/g, ' ');
  cleaned = cleaned.replace(/[ \t]+\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');
  return cleaned;
}

/**
 * Escape a line, then wrap URLs and phone numbers as links.
 * @param {string} line
 * @returns {string}
 */
function lineWithLinksAndPhoneNumbers(line) {
  let safeLine = escapeHtmlCharacters(line);
  safeLine = safeLine.replace(
    URL_PATTERN,
    (urlMatch) => `<a href="${urlMatch}" target="_blank" rel="noopener">${urlMatch}</a>`,
  );
  safeLine = safeLine.replace(PHONE_PATTERN, (phoneMatch) => {
    if (!textLooksLikePhoneNumber(phoneMatch)) {
      return phoneMatch;
    }
    const digitsOnly = phoneMatch.replace(/[^\d+]/g, '');
    if (digitsOnly.length < MIN_PHONE_DIGIT_COUNT) {
      return phoneMatch;
    }
    return `<a href="tel:${digitsOnly}">${phoneMatch}</a>`;
  });
  return safeLine;
}

/**
 * True when most lines look like source code (indent, braces, or keywords).
 * @param {string} block
 * @returns {boolean}
 */
function pastedBlockLooksLikeCode(block) {
  const lines = block.split('\n');
  if (lines.length < MIN_CODE_LINES) {
    return false;
  }
  let codeLikeLineCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const hasIndent = /^\s{2,}/.test(line);
    const hasCodeChars = /[{};=()<>]/.test(line);
    const hasKeyword = /^(function|const|let|var|class|import|export|def|return|if|else|for|while)\b/.test(line);
    if (hasIndent || hasCodeChars || hasKeyword) {
      codeLikeLineCount += 1;
    }
  }
  return codeLikeLineCount / lines.length > CODE_LINE_MAJORITY;
}

/**
 * True when every non-empty line starts with email-style ">".
 * @param {string} block
 * @returns {boolean}
 */
function pastedBlockLooksLikeEmailQuote(block) {
  const lines = block.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].trim().startsWith('>')) {
      return false;
    }
  }
  return true;
}

/**
 * Return 'ul' / 'ol' when enough lines have list markers; otherwise false.
 * @param {string} block
 * @returns {'ul'|'ol'|false}
 */
function pastedListTagName(block) {
  const lines = block.split('\n').filter(Boolean);
  if (lines.length < MIN_LIST_LINES) {
    return false;
  }
  let bulletLineCount = 0;
  let numberedLineCount = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^[\s]*[-*•·]\s+/.test(line)) {
      bulletLineCount += 1;
    }
    if (/^[\s]*\d+[.)]\s+/.test(line)) {
      numberedLineCount += 1;
    }
  }
  if (bulletLineCount / lines.length > LIST_MARKER_RATIO) {
    return 'ul';
  }
  if (numberedLineCount / lines.length > LIST_MARKER_RATIO) {
    return 'ol';
  }
  return false;
}

/**
 * Turn a ">" quoted block into a blockquote paragraph.
 * @param {string} block
 * @returns {string}
 */
function htmlForQuoteBlock(block) {
  const lines = block.split('\n');
  const withoutMarkers = [];
  for (let index = 0; index < lines.length; index += 1) {
    withoutMarkers.push(lines[index].replace(/^>\s?/, ''));
  }
  const quoteLinesJoined = withoutMarkers.join('<br>');
  return `<blockquote><p>${lineWithLinksAndPhoneNumbers(quoteLinesJoined)}</p></blockquote>`;
}

/**
 * Turn bullet/numbered lines into a ul or ol.
 * @param {string} block
 * @param {'ul'|'ol'} listTag
 * @returns {string}
 */
function htmlForListBlock(block, listTag) {
  const lines = block.split('\n');
  const listItemHtmlParts = [];
  for (let index = 0; index < lines.length; index += 1) {
    const itemText = lines[index].replace(/^[\s]*(?:[-*•·]|\d+[.)])\s+/, '').trim();
    if (!itemText) {
      continue;
    }
    listItemHtmlParts.push(`<li>${lineWithLinksAndPhoneNumbers(itemText)}</li>`);
  }
  return `<${listTag}>${listItemHtmlParts.join('')}</${listTag}>`;
}

/**
 * Markdown-style heading (# … ######) on a single line → h1–h6.
 * @param {string} block
 * @returns {string|null}
 */
function htmlForHeadingBlock(block) {
  if (block.includes('\n')) {
    return null;
  }
  const headingMatch = block.match(/^(#{1,6})\s+(.+)$/);
  if (!headingMatch) {
    return null;
  }
  const headingLevel = headingMatch[1].length;
  const headingText = lineWithLinksAndPhoneNumbers(headingMatch[2]);
  return `<h${headingLevel}>${headingText}</h${headingLevel}>`;
}

/**
 * Default path: paragraph with soft line breaks.
 * @param {string} block
 * @returns {string}
 */
function htmlForParagraphBlock(block) {
  const lines = block.split('\n');
  const linkedLines = [];
  for (let index = 0; index < lines.length; index += 1) {
    linkedLines.push(lineWithLinksAndPhoneNumbers(lines[index]));
  }
  return `<p>${linkedLines.join('<br>')}</p>`;
}

/**
 * Classify one blank-line block and emit its HTML.
 * Order: code → quote → list → heading → paragraph.
 * @param {string} block
 * @returns {string}
 */
function htmlForOnePastedBlock(block) {
  if (pastedBlockLooksLikeCode(block)) {
    return `<pre><code>${escapeHtmlCharacters(block)}</code></pre>`;
  }
  if (pastedBlockLooksLikeEmailQuote(block)) {
    return htmlForQuoteBlock(block);
  }
  const listTag = pastedListTagName(block);
  if (listTag) {
    return htmlForListBlock(block, listTag);
  }
  const headingHtml = htmlForHeadingBlock(block);
  if (headingHtml) {
    return headingHtml;
  }
  return htmlForParagraphBlock(block);
}

// ===== MAIN FUNCTION =====

/**
 * Smart paste: clipboard plain text → HTML snippet for TipTap insert.
 * @param {string} plainText
 * @returns {string}
 */
export function smartPasteToHtml(plainText) {
  // 1. Normalize line endings and stray unicode whitespace.
  const cleanedText = normalizePastedPlainText(plainText || '');
  if (!cleanedText.trim()) {
    return '';
  }

  // 2. Blank-line gaps become separate blocks (paragraphs, lists, etc.).
  const blockStrings = cleanedText.split(/\n{2,}/);
  const htmlPieces = [];

  // 3. Classify each trimmed block and append its HTML.
  for (let index = 0; index < blockStrings.length; index += 1) {
    const trimmedBlock = blockStrings[index].replace(/^\n+|\n+$/g, '');
    if (!trimmedBlock) {
      continue;
    }
    htmlPieces.push(htmlForOnePastedBlock(trimmedBlock));
  }

  // 4. TipTap expects one concatenated HTML string.
  return htmlPieces.join('');
}

// ===== PLUMBING — skip unless debugging =====
// (helpers above cover this file; section kept for Variation 3 story shape)
