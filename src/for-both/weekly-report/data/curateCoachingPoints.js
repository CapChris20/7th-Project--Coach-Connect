/** Drop filler coaching copy; keep the most specific, useful lines only. */

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

function scorePoint(text) {
  const t = String(text || '').trim();
  if (!t) return -99;

  let score = 0;
  if (BORING_PATTERNS.some((re) => re.test(t))) return -99;

  if (/\d/.test(t)) score += 4;
  if (/\d+\s*\/\s*\d+/.test(t)) score += 3;
  if (/\b(sleep|water|steps|workout|training|hydration|energy|calories|protein)\b/i.test(t)) score += 2;
  if (/\b(night|day|week|oz|hours?|h\b|lbs)\b/i.test(t)) score += 1;
  if (t.length >= 24 && t.length <= 110) score += 1;
  if (t.length < 16) score -= 2;
  if (t.length > 140) score -= 1;

  return score;
}

export function curateCoachingPoints(items = [], max = 5) {
  const seen = new Set();
  const ranked = [];

  for (const raw of items) {
    const text = String(raw || '').trim();
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const score = scorePoint(text);
    if (score < 0) continue;
    ranked.push({ text, score });
  }

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
    .map((row) => row.text);
}

export function isBoringCoachingLine(text) {
  return scorePoint(text) < 0;
}
