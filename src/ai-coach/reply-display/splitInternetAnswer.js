// Split a web-search coach reply into sections without dropping any of the text.
// Flow: tidy newlines → if it already has headings, parse them → otherwise leave the
// full text in fallbackMarkdown. A separate pass adds headings only to a plain paragraph.
// Used by the internet-answer reply view and the reply style helper.

// ===== NAMED CONSTANTS =====

// These three are exported — tests and tools match section titles against them.
export const SUMMARY_TITLES = /^(summary|quick answer|takeaway|overview|tl;dr)$/i;
export const ACTION_TITLES = /^(next step|next steps|what to do|your next step|action|try this)$/i;
export const PERSONAL_TITLES =
  /^(what this means for you|for you|practical takeaway|in practice|coaching take|bottom line for you|what to do with this)$/i;

const SECTION_KIND_SUMMARY = 'summary';
const SECTION_KIND_ACTION = 'action';
const SECTION_KIND_PERSONAL = 'personal';
const SECTION_KIND_BULLETS = 'bullets';
const SECTION_KIND_DEFAULT = 'default';

const HASH_HEADING_START = /^##\s+/m;
const HASH_HEADING_SPLIT = /\n(?=##\s+)/;
const HASH_HEADING_CHUNK = /^##\s+(.+?)\s*\n([\s\S]*)/;

const BOLD_HEADING_START = /\*\*[A-Za-z][^*\n]{2,60}\*\*/;
const BOLD_HEADING_SPLIT = /\n(?=\*\*[A-Za-z][^*\n]+\*\*\s*\n?)/;
const BOLD_HEADING_CHUNK = /^\*\*([^*]+)\*\*\s*\n?([\s\S]*)/;

const BULLET_RESEARCH_TITLE = /key point|key finding|finding|research|evidence|what the research|highlights|sources|citations/;
const PERSONAL_PHRASE = /what this means/;

// Same sentence splitter the layout pass and splitDenseParagraph both used to inline.
const SENTENCE_PATTERN = /[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g;

const BULLET_LINE_PATTERN = /^[-*•]\s+/;
const NUMBERED_LINE_PATTERN = /^\d+[.)]\s+/;

// Manipulate here: a paragraph shorter than this is left as separate sentences, not forced into headings.
const MINIMUM_SENTENCES_FOR_SECTION_LAYOUT = 3;
const SUMMARY_SENTENCE_COUNT = 3;
const MINIMUM_REMAINING_SENTENCES_FOR_BULLETS = 2;

const DEFAULT_LEAD_SENTENCE_COUNT = 2;

// ===== HELPER FUNCTIONS =====

function normalizeTitle(rawTitle) {
  return String(rawTitle || '')
    .replace(/^\*\*|\*\*$/g, '')
    .replace(/^#+\s*/, '')
    .trim();
}

function sectionKind(title) {
  const normalizedTitle = normalizeTitle(title).toLowerCase();
  if (SUMMARY_TITLES.test(normalizedTitle)) return SECTION_KIND_SUMMARY;
  if (ACTION_TITLES.test(normalizedTitle)) return SECTION_KIND_ACTION;
  if (PERSONAL_TITLES.test(normalizedTitle) || PERSONAL_PHRASE.test(normalizedTitle)) {
    return SECTION_KIND_PERSONAL;
  }
  if (BULLET_RESEARCH_TITLE.test(normalizedTitle)) return SECTION_KIND_BULLETS;
  return SECTION_KIND_DEFAULT;
}

function sectionFromHeadingMatch(headingMatch) {
  return {
    title: normalizeTitle(headingMatch[1]),
    body: headingMatch[2].trim(),
    kind: sectionKind(headingMatch[1]),
    lead: null,
  };
}

function sectionsFromHeadingChunks(text, splitPattern, chunkPattern) {
  const sections = [];
  const chunks = text.split(splitPattern).filter(Boolean);
  for (const chunk of chunks) {
    const headingMatch = chunk.match(chunkPattern);
    if (headingMatch) sections.push(sectionFromHeadingMatch(headingMatch));
  }
  return sections;
}

// ## headings win. If the reply uses those, bold headings are not also parsed —
// mixing the two splitters would duplicate the same paragraph.
function extractSections(text) {
  if (HASH_HEADING_START.test(text)) {
    return sectionsFromHeadingChunks(text, HASH_HEADING_SPLIT, HASH_HEADING_CHUNK);
  }
  if (BOLD_HEADING_START.test(text)) {
    return sectionsFromHeadingChunks(text, BOLD_HEADING_SPLIT, BOLD_HEADING_CHUNK);
  }
  return [];
}

// .match() on a global pattern returns every sentence. No match means the whole text is one piece.
function splitIntoSentences(text) {
  const matches = text.match(SENTENCE_PATTERN);
  if (!matches) return [text];
  return matches.map((sentence) => sentence.trim()).filter(Boolean);
}

function markdownAlreadyHasLayout(text) {
  const hasHeading = /^#{1,3}\s/m.test(text);
  const hasBullet = /^[-*•]\s/m.test(text);
  const hasNumberedLine = /^\d+[.)]\s/m.test(text);
  const hasBoldLabel = /\*\*[^*\n]{2,60}\*\*/.test(text);
  const hasParagraphBreak = text.includes('\n\n');
  return hasHeading || hasBullet || hasNumberedLine || hasBoldLabel || hasParagraphBreak;
}

function layoutForUnstructuredSentences(sentences) {
  if (sentences.length < MINIMUM_SENTENCES_FOR_SECTION_LAYOUT) {
    return sentences.join('\n\n');
  }

  const summary = sentences.slice(0, SUMMARY_SENTENCE_COUNT).join(' ');
  const remainingSentences = sentences.slice(SUMMARY_SENTENCE_COUNT);
  if (remainingSentences.length >= MINIMUM_REMAINING_SENTENCES_FOR_BULLETS) {
    const bulletLines = remainingSentences.map((sentence) => `- **Point:** ${sentence}`).join('\n');
    return `Here's a clear breakdown based on current research.\n\n## What it is\n${summary}\n\n## Key findings\n${bulletLines}`;
  }

  return `${summary}\n\n${remainingSentences.join('\n\n')}`;
}

function isBulletLine(line) {
  return BULLET_LINE_PATTERN.test(line);
}

function isNumberedLine(line) {
  return NUMBERED_LINE_PATTERN.test(line);
}

function answerWithNoSections(fullText) {
  return {
    summary: null,
    summaryLead: null,
    sections: [],
    fallbackMarkdown: fullText,
    fullText,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Add ## headings only when the reply is one dense paragraph. Never deletes sentences.
 * @param {string} markdown
 * @returns {string}
 */
export function preprocessWebSearchLayout(markdown) {
  let normalized = String(markdown || '').trim();
  if (!normalized) return normalized;

  normalized = normalized.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  // Already has headings, lists, bold labels, or paragraph breaks. Leave it alone.
  if (markdownAlreadyHasLayout(normalized)) return normalized.trim();

  return layoutForUnstructuredSentences(splitIntoSentences(normalized));
}

/**
 * Parse a web-search reply into sections. Every character of the raw text stays in fullText.
 * `summary` is always null — the summary body lives on summaryLead. Callers depend on that.
 * @param {string} raw
 * @returns {{ summary: null, summaryLead: string|null, sections: Array, fallbackMarkdown: string, fullText: string }}
 */
export function splitInternetAnswer(raw) {
  const text = String(raw || '').trim();
  if (!text) return answerWithNoSections('');

  const sections = extractSections(text);
  if (!sections.length) return answerWithNoSections(text);

  const summaryIndex = sections.findIndex((section) => section.kind === SECTION_KIND_SUMMARY);
  let summaryLead = null;
  let bodySections = sections;

  if (summaryIndex >= 0) {
    const summarySection = sections[summaryIndex];
    summaryLead = summarySection.body || null;
    bodySections = sections.filter((section, index) => index !== summaryIndex);
  }

  return {
    summary: null,
    summaryLead,
    sections: bodySections,
    fallbackMarkdown: '',
    fullText: text,
  };
}

/**
 * Split one section body into paragraphs, bullets, and numbered lines.
 * @param {string} body
 * @returns {{ paragraphs: string[], bullets: string[], numbered: string[] }}
 */
export function parseSectionBlocks(body) {
  const rawBody = String(body || '').trim();
  if (!rawBody) return { paragraphs: [], bullets: [], numbered: [] };

  const lines = rawBody.split('\n').map((line) => line.trim()).filter(Boolean);
  const bullets = [];
  const numbered = [];
  const paragraphs = [];

  for (const line of lines) {
    if (isBulletLine(line)) {
      bullets.push(line.replace(BULLET_LINE_PATTERN, '').trim());
    } else if (isNumberedLine(line)) {
      numbered.push(line.replace(NUMBERED_LINE_PATTERN, '').trim());
    } else {
      paragraphs.push(line);
    }
  }

  return { paragraphs, bullets, numbered };
}

/**
 * @deprecated Use preprocessWebSearchLayout — kept so tests can still split a dense paragraph.
 * @param {string} text
 * @param {number} [leadCount]
 * @returns {{ lead: string, bullets: string[] }}
 */
export function splitDenseParagraph(text, leadCount = DEFAULT_LEAD_SENTENCE_COUNT) {
  const rawText = String(text || '').trim();
  if (!rawText) return { lead: '', bullets: [] };

  const sentences = splitIntoSentences(rawText);
  if (sentences.length <= leadCount) {
    return { lead: sentences.join(' '), bullets: [] };
  }

  return {
    lead: sentences.slice(0, leadCount).join(' '),
    bullets: sentences.slice(leadCount),
  };
}
