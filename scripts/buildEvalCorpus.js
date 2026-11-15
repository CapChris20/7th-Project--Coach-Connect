#!/usr/bin/env node
/**
 * Offline. Builds eval cases from recorded product payloads.
 * Perturbs queries (drop brand, one-edit typo, reorder, add size).
 * Picks a cousin that shares a token and has a different brand and category tag.
 * Does not hand-list brands. Does not call the network.
 *
 *   node scripts/buildEvalCorpus.js
 */
const fs = require('fs');
const path = require('path');

const RAW_PATH = path.join(__dirname, '../tests/food-fixtures/recorded-off-products.json');
const OUT_PATH = path.join(__dirname, '../tests/food-fixtures/corpus.json');
const UNANSWERABLE_TOKEN = 'qqqxqj';

function tokensOf(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function unique(list) {
  return [...new Set(list)];
}

function holdoutSplit(id) {
  let hash = 2166136261;
  const text = String(id);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 5 === 0 ? 'holdout' : 'tune';
}

function assignCategory(product) {
  const tags = (product.categories_tags || []).map((tag) => String(tag).toLowerCase());
  const tagText = tags.join(' ');
  if (/restaurant|fast-food|fast-foods/.test(tagText)) return 'restaurant_menu';
  if (!String(product.brands || '').trim()) return 'generic_ingredient';
  return 'packaged_brand';
}

function macroBundle(nutrients) {
  const source = nutrients || {};
  if (source['energy-kcal_100g'] != null) {
    return {
      basis: '100g',
      kcal: source['energy-kcal_100g'],
      protein: source.proteins_100g ?? null,
      carbs: source.carbohydrates_100g ?? null,
      fat: source.fat_100g ?? null,
    };
  }
  if (source['energy-kcal_serving'] != null) {
    return {
      basis: 'serving',
      kcal: source['energy-kcal_serving'],
      protein: source.proteins_serving ?? null,
      carbs: source.carbohydrates_serving ?? null,
      fat: source.fat_serving ?? null,
    };
  }
  return {
    basis: 'unknown',
    kcal: source['energy-kcal'],
    protein: source.proteins ?? null,
    carbs: source.carbohydrates ?? null,
    fat: source.fat ?? null,
  };
}

function typoToken(token) {
  const chars = token.split('');
  const index = Math.floor(chars.length / 2);
  const code = chars[index].charCodeAt(0);
  if (code < 97 || code > 122) return null;
  chars[index] = String.fromCharCode(code === 122 ? 97 : code + 1);
  const next = chars.join('');
  if (next === token) return null;
  return next;
}

function documentFrequency(products) {
  const frequency = new Map();
  for (const product of products) {
    const seen = new Set(product.nameTokens);
    for (const token of seen) {
      frequency.set(token, (frequency.get(token) || 0) + 1);
    }
  }
  return frequency;
}

function idf(frequency, token, productCount) {
  const docs = frequency.get(token) || 0;
  return Math.log((productCount + 1) / (docs + 1));
}

function rareToken(product, frequency, productCount) {
  let best = null;
  let bestScore = -1;
  for (const token of product.nameTokens) {
    if (token.length < 5) continue;
    const score = idf(frequency, token, productCount);
    if (score > bestScore || (score === bestScore && best && token < best)) {
      best = token;
      bestScore = score;
    }
  }
  return best;
}

function brandsDiffer(left, right) {
  const leftBrand = String(left.brand || '').toLowerCase().trim();
  const rightBrand = String(right.brand || '').toLowerCase().trim();
  if (!leftBrand || !rightBrand) return leftBrand !== rightBrand;
  return leftBrand !== rightBrand;
}

function familiesDiffer(left, right) {
  const leftHead = (left.categoryPath || [])[0] || '';
  const rightHead = (right.categoryPath || [])[0] || '';
  if (!leftHead || !rightHead) return left.category !== right.category;
  return leftHead !== rightHead;
}

function pickCousin(product, products, frequency, productCount) {
  let best = null;
  for (const other of products) {
    if (other.id === product.id) continue;
    if (!brandsDiffer(product, other)) continue;
    if (!familiesDiffer(product, other)) continue;
    const shared = product.nameTokens.filter((token) => other.nameTokenSet.has(token));
    if (shared.length !== 1) continue;
    const sharedToken = shared[0];
    const score = idf(frequency, sharedToken, productCount);
    const candidate = { id: other.id, sharedToken, score };
    if (!best) {
      best = candidate;
      continue;
    }
    if (candidate.score > best.score) best = candidate;
    else if (candidate.score === best.score && candidate.id < best.id) best = candidate;
  }
  return best;
}

function exactQuery(product) {
  const brandTokens = product.brandTokens;
  const nameHasBrand = brandTokens.length > 0 && brandTokens.every((token) => product.nameTokenSet.has(token));
  if (!product.brand || nameHasBrand) return product.name;
  return `${product.brand} ${product.name}`.replace(/\s+/g, ' ').trim();
}

function dropBrandQuery(product) {
  if (!product.brandTokens.length) return null;
  const kept = product.nameTokens.filter((token) => !product.brandTokenSet.has(token));
  if (kept.length === 0) return null;
  const query = kept.join(' ');
  if (query === exactQuery(product).toLowerCase()) return null;
  return query;
}

function buildProducts(rawProducts) {
  const products = [];
  for (const raw of rawProducts) {
    const macros = macroBundle(raw.nutriments);
    if (macros.kcal == null) continue;
    const name = String(raw.product_name || '').trim();
    const nameTokens = unique(tokensOf(name));
    if (!nameTokens.length) continue;
    if (nameTokens.includes(UNANSWERABLE_TOKEN)) {
      throw new Error(`recorded product contains the reserved unanswerable token: ${raw.code}`);
    }
    const brand = String(raw.brands || '').trim();
    const brandTokens = unique(tokensOf(brand));
    const id = `off:${raw.code}`;
    products.push({
      id,
      code: raw.code,
      name,
      brand,
      category: assignCategory(raw),
      categoryPath: raw.categories_tags || [],
      source: 'openfoodfacts',
      basis: macros.basis,
      kcal: macros.kcal,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      servingLabel: raw.serving_size || null,
      fetchedFromTag: raw.fetchedFromTag || null,
      split: holdoutSplit(raw.code),
      nameTokens,
      nameTokenSet: new Set(nameTokens),
      brandTokens,
      brandTokenSet: new Set(brandTokens),
    });
  }
  products.sort((left, right) => left.id.localeCompare(right.id));
  return products;
}

function publicProduct(product, cousin) {
  return {
    id: product.id,
    code: product.code,
    name: product.name,
    brand: product.brand,
    category: product.category,
    categoryPath: product.categoryPath,
    source: product.source,
    basis: product.basis,
    kcal: product.kcal,
    protein: product.protein,
    carbs: product.carbs,
    fat: product.fat,
    servingLabel: product.servingLabel,
    fetchedFromTag: product.fetchedFromTag,
    split: product.split,
    cousinId: cousin ? cousin.id : null,
    cousinSharedToken: cousin ? cousin.sharedToken : null,
  };
}

function addCase(cases, product, perturbation, query, answerable) {
  if (!query) return;
  cases.push({
    id: `${product.id}:${perturbation}`,
    category: product.category,
    split: product.split,
    perturbation,
    query,
    targetId: answerable ? product.id : null,
    cousinId: product.cousinId,
    answerable,
  });
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    process.stderr.write(`missing ${RAW_PATH}. Run scripts/recordEvalCorpus.js on a machine with network.\n`);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  const products = buildProducts(raw.products || []);
  const frequency = documentFrequency(products);
  const productCount = products.length;

  const cousinById = new Map();
  for (const product of products) {
    cousinById.set(product.id, pickCousin(product, products, frequency, productCount));
  }

  const publicProducts = products.map((product) => publicProduct(product, cousinById.get(product.id)));
  for (const product of products) {
    const cousin = cousinById.get(product.id);
    product.cousinId = cousin ? cousin.id : null;
  }

  const cases = [];
  const barcodeCases = [];
  for (const product of products) {
    const full = exactQuery(product);
    addCase(cases, product, 'exact', full, true);
    addCase(cases, product, 'drop_brand', dropBrandQuery(product), true);
    const rare = rareToken(product, frequency, productCount);
    const misspelled = rare ? typoToken(rare) : null;
    if (rare && misspelled) {
      const typoQuery = full.replace(new RegExp(`\\b${rare}\\b`, 'i'), misspelled);
      if (typoQuery !== full) addCase(cases, product, 'typo_rare', typoQuery, true);
    }
    if (product.nameTokens.length >= 2) {
      const reversed = [...product.nameTokens].reverse().join(' ');
      if (reversed !== product.nameTokens.join(' ')) addCase(cases, product, 'reorder', reversed, true);
    }
    addCase(cases, product, 'add_size', `${full} 12 oz`, true);
    addCase(cases, product, 'unanswerable', `${full} ${UNANSWERABLE_TOKEN}`, false);

    const digits = String(product.code || '');
    if (digits.length === 8 || digits.length === 12 || digits.length === 13 || digits.length === 14) {
      barcodeCases.push({
        id: `barcode:${digits}`,
        category: 'barcode',
        split: product.split,
        perturbation: 'exact_gtin',
        scanned: digits,
        targetId: product.id,
        answerable: true,
      });
    }
  }

  cases.sort((left, right) => left.id.localeCompare(right.id));
  barcodeCases.sort((left, right) => left.id.localeCompare(right.id));

  const gaps = [...(raw.gaps || [])];
  if (!publicProducts.some((product) => product.category === 'restaurant_menu')) {
    gaps.push('No recorded product carried an OFF category tag containing restaurant or fast-food. Restaurant-menu cases are empty. No chain list was added.');
  }
  if (!publicProducts.some((product) => product.category === 'generic_ingredient')) {
    gaps.push('No recorded product had an empty brand, so generic-ingredient cases are empty. USDA Foundation was not recorded.');
  }

  const payload = {
    generator: 'scripts/buildEvalCorpus.js',
    needsNetwork: false,
    retrieval: 'closed-world over recorded products. Not a live source search.',
    unanswerableToken: UNANSWERABLE_TOKEN,
    gaps,
    products: publicProducts,
    cases,
    barcodeCases,
  };
  fs.writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
  process.stdout.write(`products=${publicProducts.length} cases=${cases.length} barcode=${barcodeCases.length}\n`);
}

main();
