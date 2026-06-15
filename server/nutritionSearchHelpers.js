'use strict';

const crypto = require('crypto');
const {
  isMenuStyleQuery,
  itemMatchesQuery,
  isRetailFoodNoise,
  significantQueryTokens,
  isGroceryIngredientQuery,
} = require('../src/nutrition/food-search/rankFoodSearchResults');

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
function classifyNutritionSearchMode(queryLower) {
  if (isGroceryIngredientQuery(queryLower)) return 'generic';
  if (isMenuStyleQuery(queryLower)) return 'branded';
  // Pizza and labeled pizza orders rarely match USDA branded rows well.
  if (/\bpizza\b/.test(queryLower)) return 'branded';
  // Chain-style menu language (avoid bare "boneless" — matches fresh meat labels)
  if (
    /\b(nugget|mcnugget|mcnuggets|big mac|quarter pounder|whopper|crazy bread|breadsticks|boneless\s+wing|boneless\s+wings|combo meal)\b/.test(
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
  if (!fat) fat = parseFloatSafe(t.match(/\bFat\.?\s*(\d+(?:\.\d+)?)\s*g\b/i)?.[1]);

  if (!carbs) carbs = parseFloatSafe(t.match(/\bCarbs\.?\s*(\d+(?:\.\d+)?)\s*g\b/i)?.[1]);
  if (!protein) protein = parseFloatSafe(t.match(/\bProtein\.?\s*(\d+(?:\.\d+)?)\s*g\b/i)?.[1]);

  if (!calories) {
    const nearPortion = t.match(
      /(?:1\s+slice|large\s+slice|medium|small|regular|per\s+serving|serving)[^0-9]{0,40}(\d{2,3})(?:\s*cal|\s*[\.\s,])/i,
    );
    if (nearPortion) calories = parseFloatSafe(nearPortion[1]);
  }

  return { calories, protein, carbs, fat };
}

/**
 * Chain PDF dot-rows, (cal/fat/carbs/protein) slashes, FatSecret-style labels — any restaurant.
 */
function parseStructuredNutritionSnippet(text) {
  const t = String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return null;

  const servingLabel =
    extractServingLabelFromSegment(t) || portionDescriptionFromText(t) || null;

  const slash = t.match(
    /(\d{2,4})\s*cal\/(\d+(?:\.\d+)?)\s*g\s*fat\/[^/]*\/(\d+(?:\.\d+)?)\s*g\s*carbs\/[^/]*\/(\d+(?:\.\d+)?)\s*g\s*protein/i,
  );
  if (slash) {
    return {
      calories: parseFloatSafe(slash[1]),
      fat: parseFloatSafe(slash[2]),
      carbs: parseFloatSafe(slash[3]),
      protein: parseFloatSafe(slash[4]),
      servingLabel,
    };
  }

  const dotRow6 = t.match(
    /([A-Za-z][A-Za-z0-9\s'&/()-]{3,52})\.\s*(\d{2,4})\s*\.\s*(\d+(?:\.\d+)?)\s*\.\s*(\d+(?:\.\d+)?)\s*\.\s*(\d+(?:\.\d+)?)\s*\.\s*(\d+(?:\.\d+)?)\s*\.\s*(\d+(?:\.\d+)?)/i,
  );
  if (dotRow6) {
    const calories = parseFloatSafe(dotRow6[2]);
    const carbs = parseFloatSafe(dotRow6[3]);
    const fat = parseFloatSafe(dotRow6[5]);
    const protein = parseFloatSafe(dotRow6[7]);
    if (calories >= 50 && calories <= 2500 && macroCalories(protein, carbs, fat) >= 15) {
      return { calories, carbs, fat, protein, servingLabel };
    }
  }

  const labeled = extractMacrosFromChunk(t);
  if (labeled.calories > 0 && macroCalories(labeled.protein, labeled.carbs, labeled.fat) >= 20) {
    return { ...labeled, servingLabel };
  }

  return null;
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
  if (/\blarge\s+slice\b/i.test(low)) return '1 large slice';

  if (/\bgarlic\s+cheese\s+bread\b|\bcheese\s+bread\b|\bbreadsticks?\b/i.test(low)) {
    if (/\b2\s+slices?\b|\btwo\s+slices?\b/i.test(low)) return '2 pieces';
    if (/\b1\s+(?:slice|piece|order|serving)\b|\bone\s+(?:slice|piece)\b/i.test(low)) return '1 piece';
    return '1 order';
  }

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
  if (/\bbread\b/.test(q) && !/\bpizza\b/.test(q)) {
    if (/\bgarlic\b|\bcheese\b/i.test(q) || /\bgarlic\s+cheese\s+bread\b/i.test(tt)) return '1 order';
  }
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

  const structured = parseStructuredNutritionSnippet(t);
  if (structured && structured.calories > 0) {
    const refineEarly = (obj) => {
      let o = reconcileBurgerSandwichCarbs({ ...obj }, qh, t);
      o = reconcilePizzaSliceCalories(o, qh, t);
      let label = o.servingLabel || servingLabelFromQueryHint(qh, t);
      if (!label) label = extractServingLabelFromSegment(t);
      return { ...o, servingLabel: label || o.servingLabel || null };
    };
    return refineEarly(structured);
  }

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
 * Normalize brand spelling / punctuation for web search (user-visible query unchanged).
 */
function normalizeRestaurantSearchQuery(q) {
  let s = String(q || '')
    .trim()
    .toLowerCase()
    .replace(/[''`]/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  s = s.replace(/\bwendys\b/g, "wendy's");
  s = s.replace(/\bdennys\b/g, "denny's");
  s = s.replace(/\bchickfilas?\b/g, 'chick fil a');
  s = s.replace(/\bchick\s+fil\s+a\b/g, 'chick fil a');
  s = s.replace(/\bin\s+n\s+out\b/g, 'in n out');
  s = s.replace(/\bin-n-out\b/g, 'in n out');
  s = s.replace(/\bdouble\s+double\b/g, 'double double');
  s = s.replace(/\bcheesecake\s+factory\s+brown\s+bread\b/g, 'cheesecake factory brown wheat bread');
  s = s.replace(/\bgrand\s+slam\s+breakfast\b/g, 'original grand slam');
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

/**
 * Alternate Serper queries when the primary search returns no usable rows.
 */
function buildSerperFallbackQueries(userQuery) {
  const primary = normalizeRestaurantSearchQuery(userQuery);
  const out = [];
  const seen = new Set();
  const add = (q) => {
    const k = String(q || '').toLowerCase().trim();
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(q.trim());
  };

  add(primary);

  if (/cheesecake factory.*brown.*bread/.test(primary)) {
    add('cheesecake factory brown wheat bread');
    add('cheesecake factory complimentary bread');
  }
  if (/denny.*grand slam/.test(primary)) {
    add("denny's original grand slam");
    add("denny's grand slam");
  }
  if (/wendy.*baconator/.test(primary)) {
    add("wendy's baconator sandwich");
  }
  if (/chick fil a.*biscuit/.test(primary)) {
    add('chick fil a chicken biscuit nutrition');
  }
  if (/in n out.*double/.test(primary)) {
    add('in n out double double burger');
  }
  if (/burger king.*whopper/.test(primary) && !/\bcheese\b/.test(primary)) {
    add('burger king whopper sandwich no cheese');
  }
  if (/chipotle.*burrito/.test(primary)) {
    add('chipotle steak burrito calories protein fatsecret');
  }
  if (/\b(dairy queen|dq)\b/.test(primary) && /\bblizzard\b/.test(primary) && /\bmedium\b/.test(primary)) {
    add('dairy queen oreo blizzard medium calories');
  }

  const tokens = significantQueryTokens(primary);
  if (tokens.length >= 3) {
    add(tokens.slice(-3).join(' '));
  }
  if (tokens.length >= 2) {
    add(tokens.slice(-2).join(' '));
  }

  return out;
}

/**
 * Fix common typos before sending to Serper (does not change user-visible query).
 */
function fixTypoForSerperQuery(q) {
  let s = normalizeRestaurantSearchQuery(q) || String(q).trim().toLowerCase();
  if (/red\s+robin/i.test(s) && /\bglucks\b/i.test(s)) {
    s = s.replace(/\bglucks\b/gi, 'clucks');
  }
  if (isMenuStyleQuery(s) && !/\bnutrition\b/i.test(s)) {
    s = `${s} nutrition facts calories protein carbs fat menu`;
  }
  return s;
}

function searchResultsDocId(normalizedKey) {
  return crypto.createHash('sha256').update(normalizedKey).digest('hex').slice(0, 40);
}

const {
  scoreOrganicNutritionHit,
  isPlausibleRestaurantNutritionRow,
  rankSerperFoodResultRows,
} = require('../src/nutrition/food-search/validateRestaurantResult');
const {
  displayNameForSerperRow,
  isJunkWebSearchTitle,
} = require('../src/nutrition/food-search/formatFoodSearchTitle');

const MIN_ORGANIC_HIT_SCORE = 18;
const MIN_ORGANIC_HIT_SCORE_RELAXED = 8;

/** Fill missing P/C/F when Serper snippets only expose calories. */
function enrichParsedMacros(macros, sourceText, queryHint) {
  const m = { ...macros };
  const mc = macroCalories(m.protein, m.carbs, m.fat);
  if (m.calories < 80 || mc >= 25) return m;

  const text = String(sourceText || '');
  const windowed = extractAroundDominantCalorie(text);
  if (windowed) {
    return {
      calories: m.calories || windowed.calories,
      protein: windowed.protein || m.protein,
      carbs: windowed.carbs || m.carbs,
      fat: windowed.fat || m.fat,
      servingLabel: m.servingLabel || windowed.servingLabel || null,
    };
  }

  const full = extractMacrosFromText(text, queryHint);
  const fullMc = macroCalories(full.protein, full.carbs, full.fat);
  if (fullMc > mc) {
    return {
      calories: m.calories || full.calories,
      protein: full.protein || m.protein,
      carbs: full.carbs || m.carbs,
      fat: full.fat || m.fat,
      servingLabel: m.servingLabel || full.servingLabel || null,
    };
  }
  return m;
}

/**
 * Build multiple Serper rows from organic hits + per-snippet macro blocks (sizes, slices, etc.).
 */
function extractMultipleSerperRowsFromOrganic(
  organicResults,
  userQuery,
  queryHint,
  maxRows = 10,
  { relaxed = false } = {},
) {
  const out = [];
  const keys = new Set();
  const minOrganic = relaxed ? MIN_ORGANIC_HIT_SCORE_RELAXED : MIN_ORGANIC_HIT_SCORE;

  const push = (rawTitle, macros, organicScore = 0, sourceText = '') => {
    const enriched = enrichParsedMacros(macros, sourceText, queryHint);
    const lowCalDrink = enriched.calories > 0 && enriched.calories <= 80;
    if (!isPlausibleRestaurantNutritionRow(enriched, { relaxed }) && !lowCalDrink) return;
    const k = `${Math.round(enriched.calories)}|${Math.round(enriched.protein)}|${Math.round(enriched.carbs)}|${Math.round(enriched.fat)}|${enriched.servingLabel || ''}`;
    if (keys.has(k)) return;
    keys.add(k);
    out.push({
      displayName: displayNameForSerperRow(rawTitle, userQuery, enriched),
      macros: enriched,
      organicScore,
    });
  };

  const list = (Array.isArray(organicResults) ? organicResults : [])
    .map((r) => ({ r, score: scoreOrganicNutritionHit(r, userQuery) }))
    .filter((x) => x.score >= minOrganic)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const at = String(a.r.title || '').toLowerCase();
      const bt = String(b.r.title || '').toLowerCase();
      return at.localeCompare(bt);
    });

  for (const { r, score } of list.slice(0, 10)) {
    const text = `${r.title || ''} ${r.snippet || ''}`;
    const rawTitle = isJunkWebSearchTitle(r.title) ? userQuery : String(r.title || userQuery).trim();

    push(rawTitle, extractMacrosFromText(text, queryHint), score, text);

    for (const seg of splitNutritionSegments(text)) {
      const parsed = extractMacrosFromChunk(seg);
      const segScore = segmentNutritionScore(seg, parsed);
      if (segScore < 80) continue;
      const servingLabel = extractServingLabelFromSegment(seg);
      push(
        rawTitle,
        {
          calories: parsed.calories,
          protein: parsed.protein,
          carbs: parsed.carbs,
          fat: parsed.fat,
          servingLabel: servingLabel || null,
        },
        score,
        seg,
      );
    }
  }

  if (out.length === 0 && list.length > 0) {
    for (const { r, score } of list.slice(0, 6)) {
      const text = `${r.title || ''} ${r.snippet || ''}`;
      const rawTitle = isJunkWebSearchTitle(r.title) ? userQuery : String(r.title || userQuery).trim();
      const enriched = enrichParsedMacros(extractMacrosFromText(text, queryHint), text, queryHint);
      if (!isPlausibleRestaurantNutritionRow(enriched, { relaxed: true })) continue;
      const k = `${Math.round(enriched.calories)}|${Math.round(enriched.protein)}|${Math.round(enriched.carbs)}|${Math.round(enriched.fat)}|${enriched.servingLabel || ''}`;
      if (keys.has(k)) continue;
      keys.add(k);
      out.push({
        displayName: displayNameForSerperRow(rawTitle, userQuery, enriched),
        macros: enriched,
        organicScore: score,
      });
    }
  }

  if (out.length === 0 && list.length > 0) {
    const mega = list.map(({ r }) => `${r.title || ''} ${r.snippet || ''}`).join('\n');
    push(userQuery, extractMacrosFromText(mega, queryHint), list[0]?.score || 0, mega);
  }

  if (/\bmedium\b/i.test(queryHint)) {
    for (const { r, score } of list) {
      const title = String(r.title || '');
      if (!/\bmedium\b/i.test(title)) continue;
      const text = `${title} ${r.snippet || ''}`;
      push(title.trim(), extractMacrosFromText(text, queryHint), score + 15, text);
    }
  }

  if (out.length === 0) return [];

  const appRows = out.map((p) => ({
    food_name: p.displayName,
    name: p.displayName,
    nf_calories: p.macros.calories,
    nf_protein: p.macros.protein,
    nf_total_carbohydrate: p.macros.carbs,
    nf_total_fat: p.macros.fat,
    serving_label: p.macros.servingLabel || null,
    _organicScore: p.organicScore || 0,
    source: 'serper',
  }));

  const ranked = rankSerperFoodResultRows(appRows, userQuery);

  return ranked.slice(0, maxRows).map((r) => ({
    displayName: r.food_name || r.name,
    macros: {
      calories: r.nf_calories ?? r.calories,
      protein: r.nf_protein ?? r.protein,
      carbs: r.nf_total_carbohydrate ?? r.carbs,
      fat: r.nf_total_fat ?? r.fat,
      servingLabel: r.serving_label || null,
    },
    organicScore: r._organicScore || 0,
    multiServingFallback: r.multiServingFallback,
    servingMultiplier: r.servingMultiplier,
    nutrition_unverified: r.nutrition_unverified,
  }));
}

module.exports = {
  EMPTY_SEARCH_HINT,
  normalizeSearchKey,
  classifyNutritionSearchMode,
  extractMacrosFromText,
  extractMultipleSerperRowsFromOrganic,
  rankSerperFoodResultRows,
  fixTypoForSerperQuery,
  normalizeRestaurantSearchQuery,
  buildSerperFallbackQueries,
  isMenuStyleQuery,
  itemMatchesQuery,
  isRetailFoodNoise,
  significantQueryTokens,
  searchResultsDocId,
  parseFloatSafe,
};
