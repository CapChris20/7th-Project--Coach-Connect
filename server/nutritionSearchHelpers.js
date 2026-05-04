'use strict';

const crypto = require('crypto');

const EMPTY_SEARCH_HINT =
  "Can't find that. Try searching differently or add manually";

/**
 * Stable cache key for Firestore + in-memory food search cache.
 */
function normalizeSearchKey(q) {
  return String(q || '')
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ');
}

/**
 * Branded / restaurant / prepared-menu style → Open Food Facts & Serper before loose USDA matches.
 * Generic / grocery → USDA first (includes Branded for packaged foods + Foundation / SR / survey).
 */
function classifyNutritionSearchMode(queryLower, restaurantChainHit) {
  if (restaurantChainHit) return 'branded';
  // Pizza and labeled pizza orders rarely match USDA branded rows well.
  if (/\bpizza\b/.test(queryLower)) return 'branded';
  // Chain-style menu language
  if (
    /\b(nugget|mcnugget|mcnuggets|big mac|quarter pounder|whopper|crazy bread|breadsticks|boneless|combo meal)\b/.test(
      queryLower,
    )
  ) {
    return 'branded';
  }
  if (/\b\d+\s*(piece|pc|pcs)\b/.test(queryLower)) return 'branded';
  // Red Robin Clucks & Fries (users often typo "Glucks")
  if (/\b(glucks|clucks)\b/.test(queryLower)) return 'branded';
  return 'generic';
}

function parseFloatSafe(v, fallback = 0) {
  const n = parseFloat(String(v || '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : fallback;
}

/** 4-4-9 rule estimate from macros (kcal). */
function macroCalories(p, c, f) {
  return 4 * p + 4 * c + 9 * f;
}

/**
 * Largest plausible calorie figure in a chunk (avoids grabbing "100 cal" when "800 cal" is also present).
 */
function maxCaloriesInChunk(t) {
  const s = String(t || '');
  let best = 0;
  const patterns = [
    /(\d+(?:,\d{3})*(?:\.\d+)?)\s*calories?\b/gi,
    /\bcalories?[:\s]+(\d+(?:,\d{3})*(?:\.\d+)?)\b/gi,
    /\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*kcal\b/gi,
    /\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*cals?\b/gi,
    /\b(\d+(?:,\d{3})*(?:\.\d+)?)\s*cal\b/gi,
  ];
  for (const re of patterns) {
    let m;
    const r = new RegExp(re.source, re.flags);
    while ((m = r.exec(s)) !== null) {
      const v = parseFloatSafe(m[1]);
      if (v > best && v > 0 && v < 20000) best = v;
    }
  }
  return best;
}

/**
 * Parse one contiguous snippet only (no cross-sentence mixing).
 */
function extractMacrosFromChunk(text) {
  const t = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');

  let calories = maxCaloriesInChunk(t);

  let protein = parseFloatSafe(
    t.match(/(\d+(?:\.\d+)?)\s*g(?:rams)?(?:\s+of)?\s+protein/i)?.[1],
  );
  if (!protein) protein = parseFloatSafe(t.match(/protein[:\s]+(\d+(?:\.\d+)?)\s*g/i)?.[1]);
  if (!protein) protein = parseFloatSafe(t.match(/(\d+(?:\.\d+)?)\s*g\s*protein\b/i)?.[1]);
  if (!protein) protein = parseFloatSafe(t.match(/protein[:\s\-–]+(\d+(?:\.\d+)?)\s*g?\b/i)?.[1]);
  if (!protein) protein = parseFloatSafe(t.match(/P[:\s]+(\d+(?:\.\d+)?)\s*g\b/i)?.[1]);

  let carbs = parseFloatSafe(t.match(/(\d+(?:\.\d+)?)\s*g(?:rams)?(?:\s+of)?\s+carbohydrates?\b/i)?.[1]);
  if (!carbs) carbs = parseFloatSafe(t.match(/(\d+(?:\.\d+)?)\s*g(?:rams)?(?:\s+of)?\s+(?:total\s+)?carb/i)?.[1]);
  if (!carbs) carbs = parseFloatSafe(t.match(/carb(?:ohydrate)?s?[:\s]+(\d+(?:\.\d+)?)\s*g/i)?.[1]);
  if (!carbs) carbs = parseFloatSafe(t.match(/(\d+(?:\.\d+)?)\s*g\s*carbs?\b/i)?.[1]);
  if (!carbs) carbs = parseFloatSafe(t.match(/(\d+(?:\.\d+)?)\s*g\s*of\s*carb/i)?.[1]);
  if (!carbs) carbs = parseFloatSafe(t.match(/C[:\s]+(\d+(?:\.\d+)?)\s*g\b/i)?.[1]);

  let fat = parseFloatSafe(
    t.match(/(\d+(?:\.\d+)?)\s*g(?:rams)?(?:\s+of)?\s+total\s+fat/i)?.[1],
  );
  if (!fat) fat = parseFloatSafe(t.match(/total\s+fat[:\s]+(\d+(?:\.\d+)?)\s*g/i)?.[1]);
  if (!fat) {
    fat = parseFloatSafe(t.match(/(\d+(?:\.\d+)?)\s*g(?:rams)?(?:\s+of)?\s+(?:total\s+)?fat/i)?.[1]);
  }
  if (!fat) fat = parseFloatSafe(t.match(/fat[:\s]+(\d+(?:\.\d+)?)\s*g/i)?.[1]);
  if (!fat) fat = parseFloatSafe(t.match(/(\d+(?:\.\d+)?)\s*g\s*fat\b/i)?.[1]);
  if (!fat) fat = parseFloatSafe(t.match(/F[:\s]+(\d+(?:\.\d+)?)\s*g\b/i)?.[1]);

  return { calories, protein, carbs, fat };
}

function splitNutritionSegments(text) {
  const t = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return [];
  const parts = t
    .split(/\s*(?:\n+|(?<=[.!?])\s+)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  return parts.length ? parts : [t];
}

function segmentNutritionScore(chunk, parsed) {
  const { calories, protein, carbs, fat } = parsed;
  const mc = macroCalories(protein, carbs, fat);
  if (calories < 30 || mc < 15) return -Infinity;

  const ratio = mc / calories;
  let score = 0;
  if (ratio >= 0.62 && ratio <= 1.12) score = 200 + ratio * 10;
  else if (ratio >= 0.4 && ratio <= 1.35) score = 80 + ratio * 5;
  else score = ratio * 20;

  const low = chunk.toLowerCase();
  if (/\bfull\s+order\b|\bentire\s+order\b|\b8\s+sticks\b|\border\s+of\b|\bcomplete\s+order\b/i.test(low)) score += 45;
  if (/\bsingle\b|\bone\s+breadstick\b|\bper\s+breadstick\b|\bper\s+stick\b|\bone\s+stick\b/i.test(low)) score -= 55;
  if (/\broughly\s+100\s|\babout\s+100\s|\b100\s+calories\b.*\bbreadstick/i.test(low)) score -= 45;

  return score;
}

function extractAroundDominantCalorie(text) {
  const t = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
  let maxCal = 0;
  let maxIdx = -1;
  const re = /(\d+(?:,\d{3})*(?:\.\d+)?)\s*calories?\b/gi;
  let m;
  while ((m = re.exec(t)) !== null) {
    const v = parseFloatSafe(m[1]);
    if (v >= maxCal && v > 0 && v < 20000) {
      maxCal = v;
      maxIdx = m.index;
    }
  }
  if (maxIdx < 0 || maxCal < 120) return null;
  const win = t.slice(Math.max(0, maxIdx - 120), Math.min(t.length, maxIdx + 420));
  const parsed = extractMacrosFromChunk(win);
  const mc = macroCalories(parsed.protein, parsed.carbs, parsed.fat);
  if (mc < 40) return null;
  const ratio = mc / (parsed.calories || maxCal);
  if (ratio < 0.45 || ratio > 1.25) return null;
  if (parsed.calories && Math.abs(parsed.calories - maxCal) > maxCal * 0.15) {
    parsed.calories = maxCal;
  }
  return {
    ...parsed,
    servingLabel: extractServingLabelFromSegment(win),
    _portionHintText: win,
  };
}

/**
 * Human-readable serving line from the same text block as the macros (e.g. "1 breadstick", "Full order (8 sticks)").
 */
function extractServingLabelFromSegment(seg) {
  if (!seg || String(seg).length < 4) return null;
  const s = String(seg);
  const low = s.toLowerCase();

  if (/\bfull\s+order\b|\bentire\s+order\b|a\s+full\s+order/i.test(low)) {
    const stick = s.match(/(\d+)\s*sticks?\b/i);
    if (stick) return `Full order (${stick[1]} sticks)`;
    return 'Full order';
  }
  if (/\border\s+of\b.*\b(\d+)\s*sticks?\b|\b(\d+)\s*sticks?\b.*\bcrazy\s+bread/i.test(low)) {
    const stick = s.match(/(\d+)\s*sticks?\b/i);
    if (stick) return `Full order (${stick[1]} sticks)`;
  }
  if (
    /\bsingle\s+breadstick\b|\bone\s+breadstick\b|\ba\s+breadstick\b|breadstick\s+contains|contains\s+roughly.*breadstick/i.test(
      low,
    )
  ) {
    return '1 breadstick';
  }
  if (/\bper\s+breadstick\b|\beach\s+breadstick\b/i.test(low)) return 'Per breadstick';
  if (/\bper\s+stick\b|\beach\s+stick\b/i.test(low) && /bread|pretzel|crazy/i.test(low)) return 'Per stick';
  if (/\bone\s+nugget\b|\bsingle\s+nugget\b|per\s+nugget\b/i.test(low)) return '1 nugget';
  if (/\b(\d+)[\s-]*piece\b.*\bnuggets?\b|\bnuggets?\b.*\b(\d+)[\s-]*piece\b/i.test(low)) {
    const pc = s.match(/\b(\d+)[\s-]*piece\b/i);
    if (pc) return `${pc[1]}-pc nuggets`;
  }
  if (/\b(\d+)\s*(?:pc|pcs)\b.*\bnuggets?\b/i.test(low)) {
    const pc = s.match(/\b(\d+)\s*(?:pc|pcs)\b/i);
    if (pc) return `${pc[1]}-pc nuggets`;
  }
  if (/\b1\s+slice\b|\bone\s+slice\b|\bper\s+slice\b/i.test(low)) return '1 slice';
  if (/\b(small|medium|large)\s+(?:combo|meal|fries|drink|size)\b/i.test(low)) {
    const sz = s.match(/\b(small|medium|large)\b/i);
    if (sz) return `${sz[1].charAt(0).toUpperCase() + sz[1].slice(1)} (menu size)`;
  }
  if (/\blittle\s+cheeseburger\b/i.test(low)) return '1 Little Cheeseburger';
  if (/\bbacon\s+cheeseburger\b/i.test(low)) return '1 bacon cheeseburger';
  if (/\bdouble\s+cheeseburger\b/i.test(low)) return '1 double cheeseburger';
  if (/\bwhopper\b/i.test(low)) return '1 Whopper';
  if (/\bbig\s+mac\b/i.test(low)) return '1 Big Mac';
  return null;
}

/**
 * Pull explicit portion language from snippets ("Serving size 2 slices", "whole pizza", "per 2 slices").
 * Shown on cards so users aren't misled (e.g. 860 cal is often 2 slices, not whole pizza).
 */
function portionDescriptionFromText(text) {
  if (!text || String(text).length < 8) return null;
  const s = String(text).replace(/\u00a0/g, ' ');
  const low = s.toLowerCase();

  let m = s.match(/serving\s+size[:\s]+([^\n.;]{3,100})/i);
  if (m) {
    const line = m[1].trim().replace(/\s+/g, ' ');
    return line.length > 110 ? `${line.slice(0, 107)}…` : line;
  }

  m = s.match(/nutrition\s*(?:facts|information)?\s+for\s+([^\n.;]{3,75})/i);
  if (m) return m[1].trim().replace(/\s+/g, ' ');

  const wordNum = (w) => {
    const map = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
    const x = String(w).toLowerCase();
    return map[x] ?? parseInt(w, 10);
  };

  m = s.match(/\b(?:amount\s+per\s+serving|calories?\s+for|macros?\s+for)\s+([^\n.;]{3,70})/i);
  if (m && /slice|pizza|quarter|whole|half/i.test(m[1])) return m[1].trim().replace(/\s+/g, ' ');

  m = s.match(/\b(?:per|for)\s+(\d+|two|three|four|five|six|seven|eight)\s+slices?\b/i);
  if (m) {
    const n = wordNum(m[1]);
    if (n > 0 && n <= 16) return `${n} slice${n === 1 ? '' : 's'}`;
  }

  if (/\bwhole\s+(?:14[\"']?|16[\"']?)?\s*pizza\b|\bentire\s+pizza\b|\bone\s+whole\s+pizza\b|\bfull\s+pizza\b/i.test(low)) {
    return 'Whole pizza';
  }
  if (/\bhalf\s+a\s+pizza\b|\bhalf\s+pizza\b|1\/2\s+pizza/i.test(low)) return 'Half pizza';
  if (/\bquarter\s+pizza\b|1\/4\s*pizza|¼\s*pizza/i.test(low)) return '¼ pizza';

  m = s.match(/\b(\d+)\s*slices?\s*(?:\(|,|\.|;|—|--|\||of\b|\s+contains\b)/i);
  if (m && /\bpizza|slice|corner|jets|detroit|deep/i.test(low)) {
    const n = parseInt(m[1], 10);
    if (n > 0 && n <= 16) return `${n} slice${n === 1 ? '' : 's'}`;
  }

  m = s.match(/\b(two|three|four|five|six)\s+slices?\b/i);
  if (m && /\bpizza|corner|cheese|jets/i.test(low)) {
    const n = wordNum(m[1]);
    if (n) return `${n} slices`;
  }

  if (/\b1\s*slice\b|\bone\s+slice\b|\bper\s+slice\b/i.test(low)) return '1 slice';

  return null;
}

/** When query names a menu item, use it if the snippet supports it (fills gaps segment regex misses). */
function servingLabelFromQueryHint(queryHint, text) {
  const q = String(queryHint || '').toLowerCase().trim();
  const tt = String(text || '').toLowerCase();
  if (!q || q.length < 4) return null;
  if (/\blittle\s+cheeseburger\b/.test(q) && /little\s+cheeseburger|five\s+guys/i.test(tt)) {
    return '1 Little Cheeseburger';
  }
  if (/\bbigger\s+burger\b|\blittle\s+hamburger\b/.test(q) && /five\s+guys|little\s+hamburger|bigger\s+burger/i.test(tt)) {
    return q.includes('hamburger') ? '1 Little Hamburger' : '1 Bigger Burger';
  }
  if (/\bwhopper\b/.test(q)) return '1 Whopper';
  if (/\bbig\s+mac\b/.test(q)) return '1 Big Mac';
  return null;
}

/**
 * If text lists both "2 slices" (~800 cal) and whole-pizza calories (~1600+), we may have picked the
 * large number. When portion language clearly refers to a few slices, prefer the slice-range calorie line.
 */
function reconcilePizzaSliceCalories(parsed, queryHint, fullText) {
  const cal = Number(parsed.calories) || 0;
  if (cal < 1100) return parsed;
  const q = String(queryHint || '').toLowerCase();
  if (!/\bpizza|slice|corner|jets|detroit|hut|domino|cheese\s*pie\b/i.test(q)) return parsed;

  const t = String(fullText || '');
  const prePart =
    portionDescriptionFromText(t) ||
    (() => {
      for (const seg of splitNutritionSegments(t)) {
        const p = portionDescriptionFromText(seg);
        if (p) return p;
      }
      return null;
    })();
  if (!prePart || !/slice|serving\s+size|^\d+\s*g/i.test(prePart)) return parsed;

  const segs = splitNutritionSegments(t);
  for (const seg of segs) {
    const low = seg.toLowerCase();
    if (!/slice|serving|per\s+\d|about|around/.test(low)) continue;
    if (/\bwhole\s+pizza\b|\bentire\s+pizza\b|full\s+large|whole\s+1[46]/.test(low)) continue;
    const m = seg.match(/(\d{3,4})\s*calories?\b/i);
    if (m) {
      const c = parseInt(m[1], 10);
      if (c >= 350 && c <= 1300) {
        return { ...parsed, calories: c };
      }
    }
  }
  return parsed;
}

/**
 * Segment scoring loves patty-only lines (macros sum ≈ calories but omit bun carbs). Take max carbs across segments for burger-style queries.
 */
function reconcileBurgerSandwichCarbs(parsed, queryHint, fullText) {
  const q = String(queryHint || '').toLowerCase();
  if (!/\b(burger|cheeseburger|hamburger|sandwich|sub\b|hoagie|panini)\b/.test(q)) return parsed;
  const cal = Number(parsed.calories) || 0;
  let carbs = Number(parsed.carbs) || 0;
  if (cal < 200 || carbs >= 14) return parsed;

  const t = String(fullText || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ');
  const segments = splitNutritionSegments(t);
  let maxC = carbs;
  for (const seg of segments) {
    const p = extractMacrosFromChunk(seg);
    if (p.carbs > maxC && p.carbs < 400) maxC = p.carbs;
  }
  const glob = extractMacrosFromChunk(t);
  if (glob.carbs > maxC && glob.carbs < 400) maxC = glob.carbs;

  if (maxC > carbs) return { ...parsed, carbs: maxC };
  return parsed;
}

/**
 * Best-effort extraction from Serper snippets. Prefers one coherent block (same sentence / serving)
 * so we don't mix e.g. "800 cal full order" with "3g fat per breadstick".
 * @param {string} queryHint - optional user query (lowercase) for bun/patty reconciliation + serving labels
 */
function extractMacrosFromText(text, queryHint = '') {
  const t = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, servingLabel: null };
  }

  const qh = String(queryHint || '').toLowerCase();

  const refine = (obj, portionSegmentOpt) => {
    const { _portionHintText, ...rest } = obj || {};
    let o = reconcileBurgerSandwichCarbs({ ...rest }, qh, t);
    o = reconcilePizzaSliceCalories(o, qh, t);
    let label = o.servingLabel;
    if (!label) {
      const sl = servingLabelFromQueryHint(qh, t);
      if (sl) label = sl;
    }
    const segPrefer = portionSegmentOpt || _portionHintText || '';
    let part =
      portionDescriptionFromText(segPrefer) ||
      portionDescriptionFromText(t);
    if (part && label) {
      const pl = part.toLowerCase();
      if (!label.toLowerCase().includes(pl.slice(0, Math.min(12, pl.length)))) {
        label = `${label} · ${part}`;
      }
    } else if (part && !label) {
      label = part;
    }
    const out = { ...o, servingLabel: label || o.servingLabel || null };
    return out;
  };

  const segments = splitNutritionSegments(t);
  let best = null;
  let bestSeg = '';
  let bestScore = -Infinity;

  for (const seg of segments) {
    const parsed = extractMacrosFromChunk(seg);
    const sc = segmentNutritionScore(seg, parsed);
    if (sc > bestScore) {
      bestScore = sc;
      best = parsed;
      bestSeg = seg;
    }
  }

  const withLabel = (parsed, seg) => ({
    ...parsed,
    servingLabel: extractServingLabelFromSegment(seg || t),
  });

  if (best && bestScore >= 120) {
    return refine(withLabel(best, bestSeg), bestSeg);
  }

  const windowed = extractAroundDominantCalorie(t);
  if (windowed) {
    return refine(windowed, windowed._portionHintText || '');
  }

  if (best && bestScore > -Infinity) {
    return refine(withLabel(best, bestSeg), bestSeg);
  }

  return refine(withLabel(extractMacrosFromChunk(t), t), t);
}

/**
 * Fix common typos before sending to Serper (does not change user-visible query).
 */
function fixTypoForSerperQuery(q) {
  let s = String(q);
  if (/red\s+robin/i.test(s) && /\bglucks\b/i.test(s)) {
    s = s.replace(/\bglucks\b/gi, 'Clucks');
  }
  return s;
}

function searchResultsDocId(normalizedKey) {
  return crypto.createHash('sha256').update(normalizedKey).digest('hex').slice(0, 40);
}

module.exports = {
  EMPTY_SEARCH_HINT,
  normalizeSearchKey,
  classifyNutritionSearchMode,
  extractMacrosFromText,
  fixTypoForSerperQuery,
  searchResultsDocId,
  parseFloatSafe,
};
