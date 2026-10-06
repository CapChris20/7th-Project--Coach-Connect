// Drops filler coaching copy and keeps the most specific lines.
// Flow: skip blanks and duplicates → score each line → return the highest scores, capped.
// Used by the weekly report when it picks pros and cons to show.

// ===== NAMED CONSTANTS =====

// A line at or below this never makes the list. Boring patterns and blank text land here immediately.
const REJECT_SCORE = -99;

const SCORE_FOR_ANY_DIGIT = 4;
const SCORE_FOR_RATIO = 3;
const SCORE_FOR_METRIC_WORD = 2;
const SCORE_FOR_UNIT_WORD = 1;
const SCORE_FOR_COMFORTABLE_LENGTH = 1;
const PENALTY_FOR_SHORT_LINE = 2;
const PENALTY_FOR_LONG_LINE = 1;

// Manipulate here: the comfortable band is the length we want on a card. 24 is the short end of that band.
const COMFORTABLE_LENGTH_MIN = 24;
const COMFORTABLE_LENGTH_MAX = 110;
const SHORT_LINE_LENGTH = 16;
const LONG_LINE_LENGTH = 140;

const DEFAULT_TIP_LIMIT = 5;

const BORING_PATTERNS = [
  /every logged day improves report accuracy/i,
  /auto report uses the same numbers/i,
  /no manual recap needed/i,
  /keep capturing notes/i,
  /consistency builds clarity/i,
  /partial logs still help/i,
  /hydration fields are ready when you fill them/i,
  /pick one metric \(sleep, water, or steps\)/i,
  /stack one micro-habit/i,
  /log every day next week to unlock/i,
  /this recap is generated from your logged metrics/i,
  /keep logging daily for clearer trends/i,
  /training entries give your coach context on load and recovery/i,
  /energy tracking averaged n\/a/i,
  /energy tracking averaged .*\/5 across entries \(where logged\)/i,
  /reliable data trail:.*check-ins give trustworthy averages/i,
  /solid hydration attention on multiple days\.?$/i,
  /add post-workout rating on heavy days/i,
  /aim for 64\+ oz water on at least 5 days/i,
];

const METRIC_WORD_PATTERN = /\b(sleep|water|steps|workout|training|hydration|energy|calories|protein)\b/i;
const UNIT_WORD_PATTERN = /\b(night|day|week|oz|hours?|h\b|lbs)\b/i;
const ANY_DIGIT_PATTERN = /\d/;
const RATIO_PATTERN = /\d+\s*\/\s*\d+/;

// ===== HELPER FUNCTIONS =====

function matchesBoringPattern(tipText) {
  return BORING_PATTERNS.some((pattern) => pattern.test(tipText));
}

function digitScore(tipText) {
  if (ANY_DIGIT_PATTERN.test(tipText)) return SCORE_FOR_ANY_DIGIT;
  return 0;
}

function ratioScore(tipText) {
  if (RATIO_PATTERN.test(tipText)) return SCORE_FOR_RATIO;
  return 0;
}

function metricWordScore(tipText) {
  if (METRIC_WORD_PATTERN.test(tipText)) return SCORE_FOR_METRIC_WORD;
  return 0;
}

function unitWordScore(tipText) {
  if (UNIT_WORD_PATTERN.test(tipText)) return SCORE_FOR_UNIT_WORD;
  return 0;
}

function lengthScore(tipText) {
  let score = 0;
  const isComfortableLength =
    tipText.length >= COMFORTABLE_LENGTH_MIN && tipText.length <= COMFORTABLE_LENGTH_MAX;
  if (isComfortableLength) score += SCORE_FOR_COMFORTABLE_LENGTH;
  if (tipText.length < SHORT_LINE_LENGTH) score -= PENALTY_FOR_SHORT_LINE;
  if (tipText.length > LONG_LINE_LENGTH) score -= PENALTY_FOR_LONG_LINE;
  return score;
}

function scorePoint(text) {
  const tipText = String(text || '').trim();
  if (!tipText) return REJECT_SCORE;
  if (matchesBoringPattern(tipText)) return REJECT_SCORE;

  let score = 0;
  score += digitScore(tipText);
  score += ratioScore(tipText);
  score += metricWordScore(tipText);
  score += unitWordScore(tipText);
  score += lengthScore(tipText);
  return score;
}

// seenLines is updated before the score check so a repeat of a rejected line is still a duplicate.
function rememberUniqueTip(rawLine, seenLines, rankedTips) {
  const tipText = String(rawLine || '').trim();
  if (!tipText) return;

  const dedupeKey = tipText.toLowerCase();
  if (seenLines.has(dedupeKey)) return;
  seenLines.add(dedupeKey);

  const score = scorePoint(tipText);
  if (score < 0) return;
  rankedTips.push({ text: tipText, score });
}

// ===== MAIN FUNCTION =====

/**
 * Keep the highest-scoring coaching lines, dropping filler and duplicates.
 * @param {Array<string>} [items]
 * @param {number} [maxTips] How many lines to return. Callers pass this second.
 * @returns {Array<string>}
 */
export function pickBestTips(items = [], maxTips = DEFAULT_TIP_LIMIT) {
  const seenLines = new Set();
  const rankedTips = [];

  for (const rawLine of items) {
    rememberUniqueTip(rawLine, seenLines, rankedTips);
  }

  return rankedTips
    .sort((leftTip, rightTip) => rightTip.score - leftTip.score)
    .slice(0, maxTips)
    .map((rankedTip) => rankedTip.text);
}

/**
 * True when the line is blank, matches filler copy, or scores below zero.
 * @param {string} text
 * @returns {boolean}
 */
export function isBoringCoachingLine(text) {
  return scorePoint(text) < 0;
}
