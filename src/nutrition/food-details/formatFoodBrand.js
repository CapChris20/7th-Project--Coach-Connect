/**
 * food Brand Display
 *
 * Purpose: food Brand Display — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: isSearchSourceLabel, resolveFoodBrandLabel, inferBrandFromFoodName, shouldShowFoodBrandSubtitle
 *
 * @file-header
 */
/**
 * Food search card subtitles — never show API/source names (e.g. "via Google Search").
 */

const SOURCE_LABEL_RE =
  /^(via\s+)?(google|serper|duckduckgo|web)\s*search$/i;

/** True when a brand string is really a search-provider label, not a food brand. */
function isSearchSourceLabel(brand) {
  const b = String(brand || '').trim();
  if (!b) return false;
  if (SOURCE_LABEL_RE.test(b)) return true;
  if (/^via\s+/i.test(b)) return true;
  return false;
}

/** Strip source labels; infer restaurant/brand from the food title when possible. */
function resolveFoodBrandLabel(foodName, brand) {
  const raw = String(brand || '').trim();
  if (raw && !isSearchSourceLabel(raw)) return raw;

  return inferBrandFromFoodName(foodName);
}

/** Wendy's, Taco Bell, etc. from titles like "Wendy's Vanilla Frosty". */
function inferBrandFromFoodName(foodName) {
  const name = String(foodName || '').trim();
  if (!name || isSearchSourceLabel(name)) return '';

  const possessive = name.match(/^([A-Za-z][A-Za-z0-9&\s.'-]*?'s)\b/);
  if (possessive) return possessive[1].trim();

  const knownTwoWord =
    /^(Taco Bell|Burger King|Pizza Hut|Dairy Queen|Jack in the Box|In-N-Out|Carl's Jr|Hardee's|Tim Hortons|Popeyes|Chick-fil-A|Raising Cane's|Five Guys|Shake Shack|Red Robin|Olive Garden|Buffalo Wild Wings|Cottage Inn)\b/i;
  const two = name.match(knownTwoWord);
  if (two) return two[1];

  const words = name.split(/\s+/).filter(Boolean);
  if (words.length >= 2 && /^[A-Z]/.test(words[0]) && /^[A-Z]/.test(words[1])) {
    return `${words[0]} ${words[1]}`;
  }
  if (words.length >= 1 && /^[A-Z]/.test(words[0]) && words[0].length > 2) {
    return words[0];
  }
  return '';
}

/** Hide subtitle when it repeats the start of the food name (e.g. Wendy's under Wendy's Frosty). */
function shouldShowFoodBrandSubtitle(foodName, brand) {
  const b = String(brand || '').trim();
  if (!b) return false;
  const n = String(foodName || '').trim().toLowerCase();
  if (!n) return true;
  const bl = b.toLowerCase();
  if (n === bl) return false;
  if (n.startsWith(`${bl} `) || n.startsWith(`${bl}'`) || n.startsWith(`${bl}-`)) return false;
  return true;
}

module.exports = {
  isSearchSourceLabel,
  resolveFoodBrandLabel,
  inferBrandFromFoodName,
  shouldShowFoodBrandSubtitle,
};
