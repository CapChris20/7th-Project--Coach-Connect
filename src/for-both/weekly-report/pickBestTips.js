// Ranks coaching sentences so the weekly report shows specific tips, not boilerplate.
// Flow: trim and dedupe → score each unique line → sort high to low → return top N texts.
// Used by WinsAndWorkOnsSection and prepareReportForScreen when building pros/cons.
// Read order: constants → main recipes → PLUMBING (scoring + filler matching).

// ===== NAMED CONSTANTS =====

// A line at or below this never makes the list. Blank text and filler patterns land here first.
const REJECT_SCORE = -99;

const SCORE_FOR_ANY_DIGIT = 4;
const SCORE_FOR_RATIO = 3;
const SCORE_FOR_METRIC_WORD = 2;
const SCORE_FOR_UNIT_WORD = 1;
const SCORE_FOR_COMFORTABLE_LENGTH = 1;
const PENALTY_FOR_SHORT_LINE = 2;
const PENALTY_FOR_LONG_LINE = 1;

// Manipulate here: comfortable band is what reads well on a card; 24 is the short end
const COMFORTABLE_LENGTH_MIN = 24;
const COMFORTABLE_LENGTH_MAX = 110;
const SHORT_LINE_LENGTH = 16;
const LONG_LINE_LENGTH = 140;

const DEFAULT_TIP_LIMIT = 5;

// Manipulate here: add a regex when a new generator line shows up as filler on the card
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

// ===== MAIN FUNCTION =====

/**
 * Keep the highest-scoring coaching lines, dropping filler and duplicates.
 * Flow: 1. rank unique lines  2. sort high→low  3. take the top N texts
 * @param {Array<string>} [items]
 * @param {number} [maxTips] How many lines to return. Callers pass this second.
 * @returns {Array<string>}
 */
export function pickBestTips(items = [], maxTips = DEFAULT_TIP_LIMIT) {
  const rawLines = items || [];

  // 1. Walk every raw line — dedupe and score as we go (rejected repeats still count as seen)
  const rankedTips = collectRankedUniqueTips(rawLines);

  // 2. Best lines first
  const sortedTips = copyTipsHighestScoreFirst(rankedTips);

  // 3. Cap for the card layout, return plain strings (not { text, score })
  return tipTextsOnly(sortedTips, maxTips);
}

/**
 * True when the line is blank, matches filler copy, or scores below zero.
 * @param {string} text
 * @returns {boolean}
 */
export function isBoringCoachingLine(text) {
  const score = scoreOneCoachingLine(text);
  return score < 0;
}

// ===== HELPER FUNCTIONS =====
// Small helpers the mains call. Scoring details sit under PLUMBING.

function collectRankedUniqueTips(rawLines) {
  const seenKeys = new Set();
  const rankedTips = [];

  for (const rawLine of rawLines) {
    tryAddRankedTip(rawLine, seenKeys, rankedTips);
  }

  return rankedTips;
}

function tipTextsOnly(sortedTips, maxTips) {
  const tipTexts = [];
  const tipCount = Math.min(sortedTips.length, maxTips);

  for (let tipIndex = 0; tipIndex < tipCount; tipIndex += 1) {
    tipTexts.push(sortedTips[tipIndex].text);
  }

  return tipTexts;
}

// ===== PLUMBING — skip unless debugging =====

// seenKeys is updated before the score gate so a repeat of a rejected line still counts as duplicate
function tryAddRankedTip(rawLine, seenKeys, rankedTips) {
  const tipText = String(rawLine || '').trim();
  if (!tipText) return;

  const dedupeKey = tipText.toLowerCase();
  if (seenKeys.has(dedupeKey)) return;
  seenKeys.add(dedupeKey);

  const score = scoreOneCoachingLine(tipText);
  if (score < 0) return;

  rankedTips.push({ text: tipText, score });
}

function copyTipsHighestScoreFirst(rankedTips) {
  const sortedCopy = rankedTips.slice();
  sortedCopy.sort((leftTip, rightTip) => rightTip.score - leftTip.score);
  return sortedCopy;
}

function lineMatchesFillerCopy(tipText) {
  for (const pattern of BORING_PATTERNS) {
    if (pattern.test(tipText)) return true;
  }
  return false;
}

function pointsForLength(tipText) {
  let points = 0;
  const lengthIsComfortable =
    tipText.length >= COMFORTABLE_LENGTH_MIN && tipText.length <= COMFORTABLE_LENGTH_MAX;

  if (lengthIsComfortable) points += SCORE_FOR_COMFORTABLE_LENGTH;
  if (tipText.length < SHORT_LINE_LENGTH) points -= PENALTY_FOR_SHORT_LINE;
  if (tipText.length > LONG_LINE_LENGTH) points -= PENALTY_FOR_LONG_LINE;

  return points;
}

// One pass adds digit, ratio, metric-word, unit-word, and length points together.
// Specific numbers beat vague pep talk — that is why digits score highest.
function scoreOneCoachingLine(text) {
  const tipText = String(text || '').trim();
  if (!tipText) return REJECT_SCORE;
  if (lineMatchesFillerCopy(tipText)) return REJECT_SCORE;

  let totalPoints = 0;
  if (ANY_DIGIT_PATTERN.test(tipText)) totalPoints += SCORE_FOR_ANY_DIGIT;
  if (RATIO_PATTERN.test(tipText)) totalPoints += SCORE_FOR_RATIO;
  if (METRIC_WORD_PATTERN.test(tipText)) totalPoints += SCORE_FOR_METRIC_WORD;
  if (UNIT_WORD_PATTERN.test(tipText)) totalPoints += SCORE_FOR_UNIT_WORD;
  totalPoints += pointsForLength(tipText);

  return totalPoints;
}
