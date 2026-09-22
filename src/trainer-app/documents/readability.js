// Writing-quality stats for the trainer's document editor (word count, reading time, A–F grade).
// Flow: computeStats(text) → counts + Flesch Reading Ease → letter grade; gradeColor() themes the
// badge; topWords() powers the "most used words" list.
// Why it exists: gives trainers instant feedback that a plan/note is readable for their client.

// Lightweight readability + writing stats.
// Returns: words, chars, sentences, paragraphs, avgWordsPerSentence, grade (A-F), readingMinutes

// Sentence boundary = one or more of . ! ? followed by whitespace or end-of-text. The trailing
// whitespace requirement is what stops "3.5" or "e.g." mid-word from counting as a sentence.
// vocab: the /g flag = global — needed because we use .match() to count ALL occurrences
const SENTENCE_END = /[.!?]+(?:\s|$)/g;

// Vowel-group syllable estimate. This is a heuristic, not a dictionary — it only has to be
// good enough on average for the Flesch score below.
function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  // Very short words are effectively always one syllable, and the rules below misfire on them.
  if (word.length <= 3) return 1;
  // Strip silent endings so "raced" counts as 1, not 2. The [^laeiouy] guards keep real
  // syllables ("aisles", "tasted") from being stripped.
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  // A leading y is a consonant ("yellow"), so remove it before counting y as a vowel.
  word = word.replace(/^y/, "");
  // Each run of 1–2 vowels is one syllable, which is why "beautiful" lands near 3.
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

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
    return {
      words: 0, chars, sentences: 0, paragraphs: 0,
      avgWordsPerSentence: 0, syllablesPerWord: 0,
      grade: "A", score: 100, readingMinutes: 0,
    };
  }

  // filter(Boolean) drops the empty strings that split() produces around runs of whitespace.
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceMatches = trimmed.match(SENTENCE_END) || [];
  // Math.max(1, …) on both counts is a divide-by-zero guard: text with no final punctuation
  // still has one sentence, and text with no line breaks still has one paragraph.
  const sentences = Math.max(1, sentenceMatches.length);
  const paragraphs = Math.max(1, trimmed.split(/\n+/).filter(s => s.trim().length).length);
  // vocab: reduce = fold the array into one value; here, sum of every word's syllable estimate
  const totalSyllables = words.reduce((a, w) => a + countSyllables(w), 0);
  const avgWordsPerSentence = wordCount / sentences;
  const syllablesPerWord = totalSyllables / wordCount;

  // Flesch Reading Ease
  // vocab: Flesch Reading Ease = standard readability formula. Higher = easier to read
  // (~100 is grade-school simple, ~30 is dense academic prose). It punishes two things only:
  // long sentences and long words. Those constants are from the published formula —
  // don't tune them or the score stops matching every other tool that reports Flesch.
  const flesch = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * syllablesPerWord;

  // Map the raw score onto a letter so the UI can show one glanceable badge.
  // Manipulate here: these four cutoffs are our own choice — raise them to grade harder.
  let grade = "A";
  if (flesch >= 80) grade = "A";
  else if (flesch >= 70) grade = "B";
  else if (flesch >= 60) grade = "C";
  else if (flesch >= 50) grade = "D";
  else grade = "F";

  // Manipulate here: 220 words per minute is the assumed adult silent-reading speed.
  // Math.max(1, …) so any non-empty doc reads as "1 min" rather than "0 min".
  const readingMinutes = Math.max(1, Math.round(wordCount / 220));

  return {
    words: wordCount,
    chars,
    sentences,
    paragraphs,
    // Round-trip through *10 / *100 is the standard trick to round to 1 and 2 decimal places,
    // keeping these as numbers (not strings) so the UI can still compare them.
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    syllablesPerWord: Math.round(syllablesPerWord * 100) / 100,
    grade,
    score: Math.round(flesch),
    readingMinutes,
  };
}

// Badge colors per grade. `text` flips with theme so it stays legible on either background;
// `bg` is a low-alpha tint that works on both, which is why it doesn't need a dark variant.
// Manipulate here: green = good, amber/orange = caution, rose = poor. A and B intentionally
// share the same green — the letter carries the distinction, not the color.
export function gradeColor(grade, isDark = true) {
  switch (grade) {
    case "A": return { text: isDark ? '#34d399' : '#059669', bg: 'rgba(16,185,129,0.12)' };
    case "B": return { text: isDark ? '#34d399' : '#059669', bg: 'rgba(16,185,129,0.12)' };
    case "C": return { text: isDark ? '#fbbf24' : '#d97706', bg: 'rgba(245,158,11,0.12)' };
    case "D": return { text: isDark ? '#fb923c' : '#ea580c', bg: 'rgba(249,115,22,0.12)' };
    case "F": return { text: isDark ? '#fb7185' : '#e11d48', bg: 'rgba(244,63,94,0.12)' };
    // Unknown grade → neutral grey, so a new grade letter never renders as an invisible color.
    default:  return { text: isDark ? '#9ca3af' : '#6b7280', bg: 'rgba(107,114,128,0.12)' };
  }
}

// Most-repeated meaningful words, for the "you keep saying this" hint. n = how many to return.
export function topWords(text, n = 5) {
  // vocab: Set = collection with O(1) `.has()` — far faster than array.includes() in a hot loop.
  // Manipulate here: this is the stop-word list. Anything in it is ignored as filler; add a word
  // here if it keeps polluting the results.
  const STOP = new Set(["the","a","an","and","or","but","if","then","of","to","in","on","for","with","by","at","from","is","are","was","were","be","been","being","have","has","had","do","does","did","this","that","these","those","it","its","as","i","you","he","she","we","they","them","his","her","their","our","my","your","not","no","so","than","too","very","can","will","just","also","into","about","up","down","out","over","under"]);
  const counts = new Map();
  // Split on anything that isn't a letter/digit/apostrophe, so punctuation is dropped but
  // contractions ("client's") survive as one word.
  for (const w of (text || "").toLowerCase().split(/[^a-z0-9']+/)) {
    // Manipulate here: length < 3 filters out noise like "ok" and stray initials.
    if (!w || w.length < 3 || STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  // vocab/symbol: [...map.entries()] = spread the Map into an array of [word, count] pairs so
  // it can be sorted. b[1]-a[1] sorts by count descending, then slice takes the top n.
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, n);
}
