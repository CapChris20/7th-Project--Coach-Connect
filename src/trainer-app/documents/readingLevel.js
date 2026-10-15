// Writing-quality stats for the trainer's document editor (word count, reading time, A–F grade).
// Flow: computeStats(text) → counts + Flesch Reading Ease → letter grade; gradeColor() themes the badge.
// Used by the document editor so trainers get instant feedback that a plan/note is readable for their client.

// ===== NAMED CONSTANTS =====

// Sentence boundary = one or more of . ! ? followed by whitespace or end-of-text. The trailing
// whitespace requirement is what stops "3.5" or "e.g." mid-word from counting as a sentence.
// vocab: the /g flag = global — needed because we use .match() to count ALL occurrences
const SENTENCE_END = /[.!?]+(?:\s|$)/g;
const SHORT_WORD_MAX_LETTERS = 3;
const FLESCH_BASE = 206.835;
const FLESCH_SENTENCE_WEIGHT = 1.015;
const FLESCH_SYLLABLE_WEIGHT = 84.6;
const GRADE_A_MIN_SCORE = 80;
const GRADE_B_MIN_SCORE = 70;
const GRADE_C_MIN_SCORE = 60;
const GRADE_D_MIN_SCORE = 50;
const EMPTY_DOC_GRADE = "A";
const EMPTY_DOC_SCORE = 100;
const WORDS_PER_MINUTE = 220;
const AVG_WORDS_DECIMAL_FACTOR = 10;
const SYLLABLES_DECIMAL_FACTOR = 100;
const DEFAULT_TOP_WORD_COUNT = 5;
const MIN_TOP_WORD_LENGTH = 3;

// vocab: Set = collection with O(1) `.has()` — far faster than array.includes() in a hot loop.
// Manipulate here: this is the stop-word list. Anything in it is ignored as filler; add a word
// here if it keeps polluting the results.
const STOP_WORDS = new Set(["the","a","an","and","or","but","if","then","of","to","in","on","for","with","by","at","from","is","are","was","were","be","been","being","have","has","had","do","does","did","this","that","these","those","it","its","as","i","you","he","she","we","they","them","his","her","their","our","my","your","not","no","so","than","too","very","can","will","just","also","into","about","up","down","out","over","under"]);

// ===== HELPER FUNCTIONS =====

// Vowel-group syllable estimate. This is a heuristic, not a dictionary — it only has to be
// good enough on average for the Flesch score below.
function countSyllables(word) {
  const lettersOnly = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!lettersOnly) return 0;
  // Very short words are effectively always one syllable, and the rules below misfire on them.
  if (lettersOnly.length <= SHORT_WORD_MAX_LETTERS) return 1;
  // Strip silent endings so "raced" counts as 1, not 2. The [^laeiouy] guards keep real
  // syllables ("aisles", "tasted") from being stripped.
  const withoutSilentEnding = lettersOnly.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  // A leading y is a consonant ("yellow"), so remove it before counting y as a vowel.
  const withoutLeadingY = withoutSilentEnding.replace(/^y/, "");
  // Each run of 1–2 vowels is one syllable, which is why "beautiful" lands near 3.
  const vowelGroups = withoutLeadingY.match(/[aeiouy]{1,2}/g);
  return vowelGroups ? vowelGroups.length : 1;
}

function emptyDocumentStats(chars) {
  return {
    words: 0, chars, sentences: 0, paragraphs: 0,
    avgWordsPerSentence: 0, syllablesPerWord: 0,
    grade: EMPTY_DOC_GRADE, score: EMPTY_DOC_SCORE, readingMinutes: 0,
  };
}

function letterGradeFromFlesch(fleschScore) {
  // Map the raw score onto a letter so the UI can show one glanceable badge.
  // Manipulate here: these four cutoffs are our own choice — raise them to grade harder.
  if (fleschScore >= GRADE_A_MIN_SCORE) return "A";
  if (fleschScore >= GRADE_B_MIN_SCORE) return "B";
  if (fleschScore >= GRADE_C_MIN_SCORE) return "C";
  if (fleschScore >= GRADE_D_MIN_SCORE) return "D";
  return "F";
}

function gradeTheme(isDark, darkText, lightText, background) {
  return { text: isDark ? darkText : lightText, bg: background };
}

function shouldSkipTopWord(word) {
  if (!word) return true;
  if (word.length < MIN_TOP_WORD_LENGTH) return true;
  if (STOP_WORDS.has(word)) return true;
  return false;
}

function sortByCountDescending(leftEntry, rightEntry) {
  return rightEntry[1] - leftEntry[1];
}

// ===== MAIN FUNCTION =====

/**
 * Lightweight readability + writing stats.
 * Returns: words, chars, sentences, paragraphs, avgWordsPerSentence, grade (A-F), readingMinutes
 * @param {string} text
 * @returns {object}
 */
export function computeStats(text) {
  // Non-breaking spaces (\u00a0) come in from pasted rich text and would otherwise glue words
  // together, inflating word length and wrecking the score. Normalize them to real spaces.
  const trimmed = (text || "").replace(/\u00a0/g, " ").trim();
  // chars measures the UNtrimmed text, because the user cares about the true character count.
  const chars = (text || "").length;

  // Empty-document early return. It hands back a full-shaped object (not null) so the UI can
  // render the stats panel without null checks on every field. Grade "A" / score 100 is the
  // friendly default — an empty doc isn't "unreadable".
  if (!trimmed) {
    return emptyDocumentStats(chars);
  }

  // filter(Boolean) drops the empty strings that split() produces around runs of whitespace.
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceMatches = trimmed.match(SENTENCE_END) || [];
  // Math.max(1, …) on both counts is a divide-by-zero guard: text with no final punctuation
  // still has one sentence, and text with no line breaks still has one paragraph.
  const sentences = Math.max(1, sentenceMatches.length);
  const paragraphs = Math.max(1, trimmed.split(/\n+/).filter((paragraph) => paragraph.trim().length).length);
  // vocab: reduce = fold the array into one value; here, sum of every word's syllable estimate
  const totalSyllables = words.reduce((syllableTotal, word) => syllableTotal + countSyllables(word), 0);
  const avgWordsPerSentence = wordCount / sentences;
  const syllablesPerWord = totalSyllables / wordCount;

  // vocab: Flesch Reading Ease = standard readability formula. Higher = easier to read
  // (~100 is grade-school simple, ~30 is dense academic prose). It punishes two things only:
  // long sentences and long words. Those constants are from the published formula —
  // don't tune them or the score stops matching every other tool that reports Flesch.
  const flesch = FLESCH_BASE - FLESCH_SENTENCE_WEIGHT * avgWordsPerSentence - FLESCH_SYLLABLE_WEIGHT * syllablesPerWord;

  const grade = letterGradeFromFlesch(flesch);

  // Manipulate here: WORDS_PER_MINUTE is the assumed adult silent-reading speed.
  // Math.max(1, …) so any non-empty doc reads as "1 min" rather than "0 min".
  const readingMinutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));

  return {
    words: wordCount,
    chars,
    sentences,
    paragraphs,
    // Round-trip through *10 / *100 is the standard trick to round to 1 and 2 decimal places,
    // keeping these as numbers (not strings) so the UI can still compare them.
    avgWordsPerSentence: Math.round(avgWordsPerSentence * AVG_WORDS_DECIMAL_FACTOR) / AVG_WORDS_DECIMAL_FACTOR,
    syllablesPerWord: Math.round(syllablesPerWord * SYLLABLES_DECIMAL_FACTOR) / SYLLABLES_DECIMAL_FACTOR,
    grade,
    score: Math.round(flesch),
    readingMinutes,
  };
}

/**
 * Badge colors per grade. `text` flips with theme so it stays legible on either background;
 * `bg` is a low-alpha tint that works on both, which is why it doesn't need a dark variant.
 * @param {string} grade
 * @param {boolean} [isDark=true]
 * @returns {{ text: string, bg: string }}
 */
export function gradeColor(grade, isDark = true) {
  switch (grade) {
    case "A": return gradeTheme(isDark, '#34d399', '#059669', 'rgba(16,185,129,0.12)');
    case "B": return gradeTheme(isDark, '#34d399', '#059669', 'rgba(16,185,129,0.12)');
    case "C": return gradeTheme(isDark, '#fbbf24', '#d97706', 'rgba(245,158,11,0.12)');
    case "D": return gradeTheme(isDark, '#fb923c', '#ea580c', 'rgba(249,115,22,0.12)');
    case "F": return gradeTheme(isDark, '#fb7185', '#e11d48', 'rgba(244,63,94,0.12)');
    // Unknown grade → neutral grey, so a new grade letter never renders as an invisible color.
    default:  return gradeTheme(isDark, '#9ca3af', '#6b7280', 'rgba(107,114,128,0.12)');
  }
}

/**
 * Most-repeated meaningful words, for the "you keep saying this" hint.
 * @param {string} text
 * @param {number} [resultCount=5]
 * @returns {Array<[string, number]>}
 */
export function topWords(text, resultCount = DEFAULT_TOP_WORD_COUNT) {
  const counts = new Map();
  // Split on anything that isn't a letter/digit/apostrophe, so punctuation is dropped but
  // contractions ("client's") survive as one word.
  for (const word of (text || "").toLowerCase().split(/[^a-z0-9']+/)) {
    if (shouldSkipTopWord(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  // vocab/symbol: [...map.entries()] = spread the Map into an array of [word, count] pairs so
  // it can be sorted. Count descending, then slice takes the top resultCount.
  return [...counts.entries()].sort(sortByCountDescending).slice(0, resultCount);
}
