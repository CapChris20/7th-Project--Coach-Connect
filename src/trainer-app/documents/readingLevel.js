// Writing-quality stats for the trainer document editor (word count, reading time, A–F grade).
// Flow: computeStats(text) → counts + Flesch score → letter grade; helpers for school grade and top words.
// Used so trainers get instant feedback that a plan or note is readable for their client.

// ===== NAMED CONSTANTS =====

// Sentence boundary = punctuation run + whitespace or end. Stops "3.5" from counting as a sentence.
// vocab: /g flag = global — .match() counts every occurrence
const SENTENCE_END = /[.!?]+(?:\s|$)/g;
const SHORT_WORD_MAX_LETTERS = 3;
const FLESCH_BASE = 206.835;
const FLESCH_SENTENCE_WEIGHT = 1.015;
const FLESCH_SYLLABLE_WEIGHT = 84.6;
const GRADE_A_MIN_SCORE = 80;
const GRADE_B_MIN_SCORE = 70;
const GRADE_C_MIN_SCORE = 60;
const GRADE_D_MIN_SCORE = 50;
const EMPTY_DOC_GRADE = 'A';
const EMPTY_DOC_SCORE = 100;
// Manipulate here: assumed silent reading speed for the "X min" badge
const WORDS_PER_MINUTE = 220;
const AVG_WORDS_DECIMAL_FACTOR = 10;
const SYLLABLES_DECIMAL_FACTOR = 100;
const DEFAULT_TOP_WORD_COUNT = 5;
const MIN_TOP_WORD_LENGTH = 3;
// School-grade fallback when the doc has no words yet (mid middle-school).
const EMPTY_DOC_SCHOOL_GRADE = 7;

// vocab: Set = O(1) .has() in the hot loop vs array.includes()
// Manipulate here: stop-word list — add filler words that pollute the "top words" hint
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'then', 'of', 'to', 'in', 'on', 'for', 'with', 'by',
  'at', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
  'does', 'did', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'i', 'you', 'he', 'she',
  'we', 'they', 'them', 'his', 'her', 'their', 'our', 'my', 'your', 'not', 'no', 'so', 'than',
  'too', 'very', 'can', 'will', 'just', 'also', 'into', 'about', 'up', 'down', 'out', 'over',
  'under',
]);

// Flesch–Kincaid Grade Level (published formula — do not retune).
const FK_SENTENCE_WEIGHT = 0.39;
const FK_SYLLABLE_WEIGHT = 11.8;
const FK_OFFSET = 15.59;
const SCHOOL_GRADE_MIN = 1;
const SCHOOL_GRADE_MAX = 16;

// ===== HELPER FUNCTIONS =====

/**
 * How many sentences are in the plain text (by end punctuation).
 * @param {string} plainText
 * @returns {number}
 */
function countSentencesInText(plainText) {
  const matches = PLACEHOLDER;
  if (!matches) {
    return 0;
  }
  return matches.length;
}

/**
 * Rough syllable count for one English-ish word (vowel-group heuristic).
 * @param {string} word
 * @returns {number}
 */
function estimateSyllableCount(word) {
  const lettersOnly = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!lettersOnly) {
    return 0;
  }
  if (lettersOnly.length <= SHORT_WORD_MAX_LETTERS) {
    return 1;
  }
  const withoutSilentEnding = lettersOnly.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  const withoutLeadingY = withoutSilentEnding.replace(/^y/, '');
  const vowelGroups = withoutLeadingY.match(/[aeiouy]{1,2}/g);
  if (vowelGroups) {
    return vowelGroups.length;
  }
  return 1;
}

/**
 * Sum syllable estimates across every word in the list.
 * @param {string[]} words
 * @returns {number}
 */
function countSyllablesAcrossWords(words) {
  let totalSyllables = 0;
  for (let index = 0; index < words.length; index += 1) {
    totalSyllables += estimateSyllableCount(words[index]);
  }
  return totalSyllables;
}

/**
 * Empty-doc shape so the panel still paints zeros + an A grade.
 * @param {number} chars
 * @returns {object}
 */
function buildEmptyDocumentStats(chars) {
  return {
    words: 0,
    chars,
    sentences: 0,
    paragraphs: 0,
    avgWordsPerSentence: 0,
    syllablesPerWord: 0,
    grade: EMPTY_DOC_GRADE,
    score: EMPTY_DOC_SCORE,
    readingMinutes: 0,
  };
}

/**
 * Map Flesch Reading Ease → letter grade A–F.
 * @param {number} fleschScore
 * @returns {string}
 */
function mapFleschScoreToLetter(fleschScore) {
  // Manipulate here: raise cutoffs to grade harder
  if (fleschScore >= GRADE_A_MIN_SCORE) return 'A';
  if (fleschScore >= GRADE_B_MIN_SCORE) return 'B';
  if (fleschScore >= GRADE_C_MIN_SCORE) return 'C';
  if (fleschScore >= GRADE_D_MIN_SCORE) return 'D';
  return 'F';
}

/**
 * Pick badge ink + wash for a letter grade (Design Law: black/white/gray; never green).
 * @param {boolean} isDark
 * @param {string} darkInk
 * @param {string} lightInk
 * @param {string} background
 * @returns {{ text: string, bg: string }}
 */
function pickGradeBadgeColors(isDark, darkInk, lightInk, background) {
  const textColor = isDark ? darkInk : lightInk;
  return { text: textColor, bg: background };
}

/**
 * Skip empty tokens, tiny words, and filler stop-words.
 * @param {string} word
 * @returns {boolean}
 */
function isStopWordOrTooShort(word) {
  if (!word) return true;
  if (word.length < MIN_TOP_WORD_LENGTH) return true;
  if (STOP_WORDS.has(word)) return true;
  return false;
}

/**
 * Sort helper: higher count first.
 * @param {[string, number]} leftEntry
 * @param {[string, number]} rightEntry
 * @returns {number}
 */
function compareWordCountDescending(leftEntry, rightEntry) {
  return rightEntry[1] - leftEntry[1];
}

/**
 * Count content words (lowercased) for the "top words" hint.
 * @param {string} text
 * @returns {Map<string, number>}
 */
function countContentWords(text) {
  const countsByWord = new Map();
  const lowered = (text || '').toLowerCase();
  const pieces = lowered.split(/[^a-z0-9']+/);
  for (let index = 0; index < pieces.length; index += 1) {
    const word = pieces[index];
    if (isStopWordOrTooShort(word)) {
      continue;
    }
    const previousCount = countsByWord.get(word) || 0;
    countsByWord.set(word, previousCount + 1);
  }
  return countsByWord;
}

/**
 * Badge colors for one letter grade in light or dark theme.
 * @param {string} grade
 * @param {boolean} isDark
 * @returns {{ text: string, bg: string }}
 */
function colorsForLetterGrade(grade, isDark) {
  // Manipulate here: letter-grade tint strength (alpha)
  if (grade === 'A' || grade === 'B') {
    const wash = isDark ? 'rgba(242,242,242,0.12)' : 'rgba(10,10,10,0.08)';
    return pickGradeBadgeColors(isDark, '#F2F2F2', '#0A0A0A', wash);
  }
  if (grade === 'C') {
    const wash = isDark ? 'rgba(166,166,166,0.16)' : 'rgba(87,87,87,0.10)';
    return pickGradeBadgeColors(isDark, '#A6A6A6', '#575757', wash);
  }
  if (grade === 'D' || grade === 'F') {
    return pickGradeBadgeColors(isDark, '#FB7185', '#E11D48', 'rgba(244,63,94,0.12)');
  }
  return pickGradeBadgeColors(isDark, '#9ca3af', '#6b7280', 'rgba(107,114,128,0.12)');
}

// ===== MAIN FUNCTION =====

/**
 * Full writing-stats bundle for the editor side panel.
 * @param {string} text
 * @returns {object}
 */
export function computeStats(text) {
  // 1. Normalize pasted non-breaking spaces; keep raw char count before trim.
  const rawText = text || '';
  const normalizedText = rawText.replace(/\u00a0/g, ' ').trim();
  const chars = rawText.length;

  if (!normalizedText) {
    return buildEmptyDocumentStats(chars);
  }

  // 2. Word and structure counts (guards avoid divide-by-zero later).
  const words = normalizedText.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceCount = countSentencesInText(normalizedText);
  const sentences = Math.max(1, sentenceCount);
  const paragraphChunks = normalizedText.split(/\n+/).filter((paragraph) => paragraph.trim().length);
  const paragraphs = Math.max(1, paragraphChunks.length);

  // 3. Syllable estimate drives Flesch Reading Ease.
  const totalSyllables = countSyllablesAcrossWords(words);
  const avgWordsPerSentence = wordCount / sentences;
  const syllablesPerWord = totalSyllables / wordCount;

  // 4. Flesch Reading Ease — higher = easier (~100 grade-school, ~30 academic). Published constants.
  const fleschScore =
    FLESCH_BASE
    - FLESCH_SENTENCE_WEIGHT * avgWordsPerSentence
    - FLESCH_SYLLABLE_WEIGHT * syllablesPerWord;

  const grade = mapFleschScoreToLetter(fleschScore);

  // Manipulate here: WORDS_PER_MINUTE = assumed silent reading speed
  const readingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  return {
    words: wordCount,
    chars,
    sentences,
    paragraphs,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * AVG_WORDS_DECIMAL_FACTOR) / AVG_WORDS_DECIMAL_FACTOR,
    syllablesPerWord: Math.round(syllablesPerWord * SYLLABLES_DECIMAL_FACTOR) / SYLLABLES_DECIMAL_FACTOR,
    grade,
    score: Math.round(fleschScore),
    readingMinutes,
  };
}

/**
 * Design Law badge colors for a letter grade (never green).
 * @param {string} grade
 * @param {boolean} [isDark=true]
 * @returns {{ text: string, bg: string }}
 */
export function gradeColor(grade, isDark = true) {
  // 1. Delegate to the palette picker so light/dark stay consistent.
  return colorsForLetterGrade(grade, isDark);
}

/**
 * Approximate US school grade from Flesch–Kincaid (clamped 1–16).
 * @param {object} stats
 * @returns {number}
 */
export function schoolGradeFromStats(stats) {
  // 1. Empty docs report a mid middle-school default.
  const words = Number(stats?.words || 0);
  if (words <= 0) {
    return EMPTY_DOC_SCHOOL_GRADE;
  }
  // 2. Published FK formula from average sentence length + syllables per word.
  const avgWords = Number(stats?.avgWordsPerSentence || 0);
  const syllables = Number(stats?.syllablesPerWord || 0);
  const rawGrade = FK_SENTENCE_WEIGHT * avgWords + FK_SYLLABLE_WEIGHT * syllables - FK_OFFSET;
  const rounded = Math.round(rawGrade);
  // 3. Clamp so the badge never shows grade 0 or college-17+.
  return Math.max(SCHOOL_GRADE_MIN, Math.min(SCHOOL_GRADE_MAX, rounded));
}

/**
 * Short copy under the school-grade badge.
 * @param {number} schoolGrade
 * @returns {string}
 */
export function readingEaseCopy(schoolGrade) {
  // Manipulate here: copy thresholds for the reading-level card
  if (schoolGrade <= 8) {
    return 'Easy for most clients to follow.';
  }
  if (schoolGrade <= 10) {
    return 'A bit dense — shorten sentences if you can.';
  }
  return 'Hard to skim — simplify for clients.';
}

/**
 * Most-used content words in the document (for the editor hint).
 * @param {string} text
 * @param {number} [resultCount]
 * @returns {Array<[string, number]>}
 */
export function topWords(text, resultCount = DEFAULT_TOP_WORD_COUNT) {
  // 1. Count non-stop words.
  const countsByWord = countContentWords(text);
  // 2. Sort highest count first, then take the top N.
  const pairsSortedByCount = [...countsByWord.entries()].sort(compareWordCountDescending);
  return pairsSortedByCount.slice(0, resultCount);
}

// ===== PLUMBING — skip unless debugging =====
// (helpers above cover this file; section kept for Variation 3 story shape)
