// Lightweight readability + writing stats.
// Returns: words, chars, sentences, paragraphs, avgWordsPerSentence, grade (A-F), readingMinutes

const SENTENCE_END = /[.!?]+(?:\s|$)/g;

function countSyllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

export function computeStats(text) {
  const trimmed = (text || "").replace(/\u00a0/g, " ").trim();
  const chars = (text || "").length;
  if (!trimmed) {
    return {
      words: 0, chars, sentences: 0, paragraphs: 0,
      avgWordsPerSentence: 0, syllablesPerWord: 0,
      grade: "A", score: 100, readingMinutes: 0,
    };
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentenceMatches = trimmed.match(SENTENCE_END) || [];
  const sentences = Math.max(1, sentenceMatches.length);
  const paragraphs = Math.max(1, trimmed.split(/\n+/).filter(s => s.trim().length).length);
  const totalSyllables = words.reduce((a, w) => a + countSyllables(w), 0);
  const avgWordsPerSentence = wordCount / sentences;
  const syllablesPerWord = totalSyllables / wordCount;
  // Flesch Reading Ease
  const flesch = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * syllablesPerWord;
  let grade = "A";
  if (flesch >= 80) grade = "A";
  else if (flesch >= 70) grade = "B";
  else if (flesch >= 60) grade = "C";
  else if (flesch >= 50) grade = "D";
  else grade = "F";
  const readingMinutes = Math.max(1, Math.round(wordCount / 220));
  return {
    words: wordCount,
    chars,
    sentences,
    paragraphs,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    syllablesPerWord: Math.round(syllablesPerWord * 100) / 100,
    grade,
    score: Math.round(flesch),
    readingMinutes,
  };
}

export function gradeColor(grade, isDark = true) {
  switch (grade) {
    case "A": return { text: isDark ? '#34d399' : '#059669', bg: 'rgba(16,185,129,0.12)' };
    case "B": return { text: isDark ? '#34d399' : '#059669', bg: 'rgba(16,185,129,0.12)' };
    case "C": return { text: isDark ? '#fbbf24' : '#d97706', bg: 'rgba(245,158,11,0.12)' };
    case "D": return { text: isDark ? '#fb923c' : '#ea580c', bg: 'rgba(249,115,22,0.12)' };
    case "F": return { text: isDark ? '#fb7185' : '#e11d48', bg: 'rgba(244,63,94,0.12)' };
    default:  return { text: isDark ? '#9ca3af' : '#6b7280', bg: 'rgba(107,114,128,0.12)' };
  }
}

export function topWords(text, n = 5) {
  const STOP = new Set(["the","a","an","and","or","but","if","then","of","to","in","on","for","with","by","at","from","is","are","was","were","be","been","being","have","has","had","do","does","did","this","that","these","those","it","its","as","i","you","he","she","we","they","them","his","her","their","our","my","your","not","no","so","than","too","very","can","will","just","also","into","about","up","down","out","over","under"]);
  const counts = new Map();
  for (const w of (text || "").toLowerCase().split(/[^a-z0-9']+/)) {
    if (!w || w.length < 3 || STOP.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, n);
}
