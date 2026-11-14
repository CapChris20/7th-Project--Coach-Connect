// Split a web-search coach reply into sections without dropping any characters.
// Flow: normalize whitespace → detect ## or ** headings → pull summary lead → bucket line types.
// Used by InternetAnswerReply, replyTextStyles (preprocess), and unit tests on title regexes.
// Read order: exported title patterns → main recipes → PLUMBING at the bottom.

// ===== NAMED CONSTANTS =====

// Exported — tests match section titles against these patterns.
export const SUMMARY_TITLES = /^(summary|quick answer|takeaway|overview|tl;dr)$/i;
export const ACTION_TITLES = /^(next step|next steps|what to do|your next step|action|try this)$/i;
export const PERSONAL_TITLES =
  /^(what this means for you|for you|practical takeaway|in practice|coaching take|bottom line for you|what to do with this)$/i;

const KIND_SUMMARY = 'summary';
const KIND_ACTION = 'action';
const KIND_PERSONAL = 'personal';
const KIND_BULLETS = 'bullets';
const KIND_DEFAULT = 'default';
const KIND_NUMBERED = 'numbered';
const KIND_PARAGRAPH = 'paragraph';

const MARKDOWN_HASH_HEADING = /^##\s+/m;
const SPLIT_ON_HASH_HEADING = /\n(?=##\s+)/;
const CHUNK_WITH_HASH_HEADING = /^##\s+(.+?)\s*\n([\s\S]*)/;

const MARKDOWN_BOLD_HEADING = /\*\*[A-Za-z][^*\n]{2,60}\*\*/;
const SPLIT_ON_BOLD_HEADING = /\n(?=\*\*[A-Za-z][^*\n]+\*\*\s*\n?)/;
const CHUNK_WITH_BOLD_HEADING = /^\*\*([^*]+)\*\*\s*\n?([\s\S]*)/;

const RESEARCH_BULLET_TITLE =
  /key point|key finding|finding|research|evidence|what the research|highlights|sources|citations/;
const PERSONAL_TITLE_PHRASE = /what this means/;

const SENTENCE_SPLIT_PATTERN = /[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g;

const LINE_STARTS_WITH_BULLET = /^[-*•]\s+/;
const LINE_STARTS_WITH_NUMBER = /^\d+[.)]\s+/;

const STRUCTURE_HASH_HEADING = /^#{1,3}\s/m;
const STRUCTURE_BULLET_LIST = /^[-*•]\s/m;
const STRUCTURE_NUMBERED_LIST = /^\d+[.)]\s/m;
const STRUCTURE_BOLD_LABEL = /\*\*[^*\n]{2,60}\*\*/;

// Manipulate here: below this sentence count we do not invent ## headings
const MIN_SENTENCES_FOR_AUTO_LAYOUT = 3;
const SUMMARY_SENTENCES_TO_KEEP = 3;
const MIN_SENTENCES_LEFT_FOR_BULLET_BLOCK = 2;

const DEFAULT_LEAD_SENTENCE_COUNT = 2;

const AUTO_LAYOUT_INTRO =
  "Here's a clear breakdown based on current research.\n\n";
const AUTO_LAYOUT_WHAT_IT_IS_HEADING = '## What it is\n';
const AUTO_LAYOUT_KEY_FINDINGS_HEADING = '## Key findings\n';
const AUTO_LAYOUT_BULLET_PREFIX = '- **Point:** ';

// ===== MAIN FUNCTIONS =====

/**
 * Normalize a web-search reply; invent ## blocks only when the model sent a dense paragraph.
 * Flow: 1. trim + newlines  2. keep existing structure  3. else auto-layout sentences
 * @param {string} markdown
 * @returns {string}
 */
export function preprocessWebSearchLayout(markdown) {
  // 1. Trim and normalize newlines (Windows → Unix, collapse huge gaps).
  const cleaned = normalizeWebSearchMarkdown(markdown);
  if (!cleaned) {
    return cleaned;
  }

  // 2. Respect existing structure — never stomp model headings or lists.
  if (replyAlreadyHasStructure(cleaned)) {
    return cleaned.trim();
  }

  // 3. Dense paragraph only: invent ## blocks from sentences.
  const sentences = sentencesFromPlainText(cleaned);
  return autoLayoutPlainSentences(sentences);
}

/**
 * Split a web answer into summary lead + titled sections (or a fallback blob).
 * Flow: 1. empty guard  2. parse headings  3. peel summary into summaryLead
 * @param {string} raw
 * @returns {{ summary: null, summaryLead: string|null, sections: Array, fallbackMarkdown: string, fullText: string }}
 */
export function splitInternetAnswer(raw) {
  const fullText = textOrEmpty(raw).trim();
  if (!fullText) {
    return emptySplitResult('');
  }

  // 1. Parse heading-delimited sections when present.
  const parsedSections = tryParseMarkdownSections(fullText);
  if (!parsedSections.length) {
    return emptySplitResult(fullText);
  }

  // 2. Summary body lives on summaryLead — `summary` stays null for callers.
  const peeled = peelSummarySection(parsedSections);

  // 3. Hand back the split shape callers already expect.
  return {
    summary: null,
    summaryLead: peeled.summaryLead,
    sections: peeled.bodySections,
    fallbackMarkdown: '',
    fullText,
  };
}

/**
 * Bucket one section body into paragraphs, bullets, and numbered lines.
 * Flow: 1. empty guard  2. trim lines  3. classify into buckets
 * @param {string} body
 * @returns {{ paragraphs: string[], bullets: string[], numbered: string[] }}
 */
export function parseSectionBlocks(body) {
  const trimmedBody = textOrEmpty(body).trim();
  if (!trimmedBody) {
    return { paragraphs: [], bullets: [], numbered: [] };
  }

  // 1. One non-empty trimmed line per row.
  const lines = nonEmptyTrimmedLines(trimmedBody);

  // 2. Sort each line into bullets / numbered / paragraphs.
  return bucketLinesByKind(lines);
}

/**
 * Peel a dense paragraph into a short lead plus leftover sentences as bullets.
 * @param {string} text
 * @param {number} [leadCount]
 * @returns {{ lead: string, bullets: string[] }}
 */
export function splitDenseParagraph(text, leadCount = DEFAULT_LEAD_SENTENCE_COUNT) {
  const trimmed = textOrEmpty(text).trim();
  if (!trimmed) {
    return { lead: '', bullets: [] };
  }

  const sentences = sentencesFromPlainText(trimmed);
  if (sentences.length <= leadCount) {
    return { lead: sentences.join(' '), bullets: [] };
  }

  return leadAndLeftoverBullets(sentences, leadCount);
}

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless web-search section split / auto-layout looks wrong.

function textOrEmpty(value) {
  if (value == null) {
    return '';
  }
  return String(value);
}

function normalizeWebSearchMarkdown(markdown) {
  let cleaned = textOrEmpty(markdown).trim();
  if (!cleaned) {
    return cleaned;
  }
  cleaned = cleaned.replace(/\r\n/g, '\n');
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned;
}

function leadAndLeftoverBullets(sentences, leadCount) {
  const leadSentences = sentences.slice(0, leadCount);
  const leftoverSentences = sentences.slice(leadCount);
  return {
    lead: leadSentences.join(' '),
    bullets: leftoverSentences,
  };
}

function bucketLinesByKind(lines) {
  const buckets = { bullets: [], numbered: [], paragraphs: [] };
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const classified = lineKindAndText(lines[lineIndex]);
    pushLineIntoBuckets(classified, buckets);
  }
  return {
    paragraphs: buckets.paragraphs,
    bullets: buckets.bullets,
    numbered: buckets.numbered,
  };
}

function stripHeadingDecoration(rawTitle) {
  let titleText = textOrEmpty(rawTitle);
  titleText = titleText.replace(/^\*\*|\*\*$/g, '');
  titleText = titleText.replace(/^#+\s*/, '');
  return titleText.trim();
}

function classifySectionByTitle(titleText) {
  const normalized = stripHeadingDecoration(titleText).toLowerCase();

  if (SUMMARY_TITLES.test(normalized)) {
    return KIND_SUMMARY;
  }
  if (ACTION_TITLES.test(normalized)) {
    return KIND_ACTION;
  }
  if (PERSONAL_TITLES.test(normalized)) {
    return KIND_PERSONAL;
  }
  if (PERSONAL_TITLE_PHRASE.test(normalized)) {
    return KIND_PERSONAL;
  }
  if (RESEARCH_BULLET_TITLE.test(normalized)) {
    return KIND_BULLETS;
  }
  return KIND_DEFAULT;
}

function sectionRecordFromMatch(headingMatch) {
  const titleText = headingMatch[1];
  const bodyText = headingMatch[2];
  return {
    title: stripHeadingDecoration(titleText),
    body: bodyText.trim(),
    kind: classifySectionByTitle(titleText),
    lead: null,
  };
}

function parseSectionsWithPatterns(fullText, splitPattern, chunkPattern) {
  const found = [];
  const rawChunks = fullText.split(splitPattern);
  for (let chunkIndex = 0; chunkIndex < rawChunks.length; chunkIndex += 1) {
    const chunk = rawChunks[chunkIndex];
    if (!chunk) {
      continue;
    }
    const match = chunk.match(chunkPattern);
    if (!match) {
      continue;
    }
    found.push(sectionRecordFromMatch(match));
  }
  return found;
}

function tryParseMarkdownSections(fullText) {
  // ## headings win — mixing hash + bold splitters would duplicate paragraphs.
  if (MARKDOWN_HASH_HEADING.test(fullText)) {
    return parseSectionsWithPatterns(
      fullText,
      SPLIT_ON_HASH_HEADING,
      CHUNK_WITH_HASH_HEADING,
    );
  }
  if (MARKDOWN_BOLD_HEADING.test(fullText)) {
    return parseSectionsWithPatterns(
      fullText,
      SPLIT_ON_BOLD_HEADING,
      CHUNK_WITH_BOLD_HEADING,
    );
  }
  return [];
}

function sentencesFromPlainText(plainText) {
  const matches = plainText.match(SENTENCE_SPLIT_PATTERN);
  if (!matches) {
    return [plainText];
  }

  const sentences = [];
  for (let matchIndex = 0; matchIndex < matches.length; matchIndex += 1) {
    const piece = matches[matchIndex].trim();
    if (piece) {
      sentences.push(piece);
    }
  }
  return sentences;
}

function replyAlreadyHasStructure(markdown) {
  if (STRUCTURE_HASH_HEADING.test(markdown)) {
    return true;
  }
  if (STRUCTURE_BULLET_LIST.test(markdown)) {
    return true;
  }
  if (STRUCTURE_NUMBERED_LIST.test(markdown)) {
    return true;
  }
  if (STRUCTURE_BOLD_LABEL.test(markdown)) {
    return true;
  }
  if (markdown.includes('\n\n')) {
    return true;
  }
  return false;
}

function bulletMarkdownFromSentences(sentences) {
  const bulletLines = [];
  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex += 1) {
    bulletLines.push(`${AUTO_LAYOUT_BULLET_PREFIX}${sentences[sentenceIndex]}`);
  }
  return bulletLines.join('\n');
}

function autoLayoutPlainSentences(sentences) {
  if (sentences.length < MIN_SENTENCES_FOR_AUTO_LAYOUT) {
    return sentences.join('\n\n');
  }

  const summaryBlock = sentences.slice(0, SUMMARY_SENTENCES_TO_KEEP).join(' ');
  const afterSummary = sentences.slice(SUMMARY_SENTENCES_TO_KEEP);

  if (afterSummary.length < MIN_SENTENCES_LEFT_FOR_BULLET_BLOCK) {
    return `${summaryBlock}\n\n${afterSummary.join('\n\n')}`;
  }

  const bulletMarkdown = bulletMarkdownFromSentences(afterSummary);
  return (
    AUTO_LAYOUT_INTRO +
    AUTO_LAYOUT_WHAT_IT_IS_HEADING +
    `${summaryBlock}\n\n` +
    AUTO_LAYOUT_KEY_FINDINGS_HEADING +
    bulletMarkdown
  );
}

function emptySplitResult(fallbackText) {
  return {
    summary: null,
    summaryLead: null,
    sections: [],
    fallbackMarkdown: fallbackText,
    fullText: fallbackText,
  };
}

function lineKindAndText(trimmedLine) {
  if (LINE_STARTS_WITH_BULLET.test(trimmedLine)) {
    const withoutMarker = trimmedLine.replace(LINE_STARTS_WITH_BULLET, '').trim();
    return { kind: KIND_BULLETS, text: withoutMarker };
  }
  if (LINE_STARTS_WITH_NUMBER.test(trimmedLine)) {
    const withoutMarker = trimmedLine.replace(LINE_STARTS_WITH_NUMBER, '').trim();
    return { kind: KIND_NUMBERED, text: withoutMarker };
  }
  return { kind: KIND_PARAGRAPH, text: trimmedLine };
}

function pushLineIntoBuckets(classified, buckets) {
  if (classified.kind === KIND_BULLETS) {
    buckets.bullets.push(classified.text);
    return;
  }
  if (classified.kind === KIND_NUMBERED) {
    buckets.numbered.push(classified.text);
    return;
  }
  buckets.paragraphs.push(classified.text);
}

function peelSummarySection(sectionList) {
  const summaryIndex = findSummarySectionIndex(sectionList);
  if (summaryIndex < 0) {
    return { summaryLead: null, bodySections: sectionList };
  }

  const summarySection = sectionList[summaryIndex];
  const bodySections = sectionsWithoutIndex(sectionList, summaryIndex);

  return {
    summaryLead: summarySection.body || null,
    bodySections,
  };
}

function sectionsWithoutIndex(sectionList, skipIndex) {
  const bodySections = [];
  for (let sectionIndex = 0; sectionIndex < sectionList.length; sectionIndex += 1) {
    if (sectionIndex === skipIndex) {
      continue;
    }
    bodySections.push(sectionList[sectionIndex]);
  }
  return bodySections;
}

function findSummarySectionIndex(sectionList) {
  for (let sectionIndex = 0; sectionIndex < sectionList.length; sectionIndex += 1) {
    if (sectionList[sectionIndex].kind === KIND_SUMMARY) {
      return sectionIndex;
    }
  }
  return -1;
}

function nonEmptyTrimmedLines(text) {
  const rawLines = text.split('\n');
  const lines = [];
  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex += 1) {
    const trimmedLine = rawLines[lineIndex].trim();
    if (trimmedLine) {
      lines.push(trimmedLine);
    }
  }
  return lines;
}
