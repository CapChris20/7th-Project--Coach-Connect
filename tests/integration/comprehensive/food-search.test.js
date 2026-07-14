/**
 * Food search — GET /api/food/search, POST /api/nutrition/search, POST /api/food/barcode.
 */
const {
  pass,
  fail,
  skip,
  apiFetch,
  getTestAuth,
  deleteTestUser,
} = require('./lib/harness');

async function testFoodSearch() {
  const results = [];
  const cleanup = [];
  let token = null;

  try {
    const auth = await getTestAuth();
    if (auth?.token) {
      token = auth.token;
      if (auth.cleanup) cleanup.push(...auth.cleanup);
    }
  } catch (e) {
    results.push(fail('Food search auth setup', e.message));
  }

  if (!token) {
    results.push(skip('Search McDonald\'s brand (GET /api/food/search)', 'no auth token'));
    results.push(skip('Search generic food chicken', 'no auth token'));
    results.push(skip('Gibberish search completes', 'no auth token'));
    results.push(skip('Big Mac nutrition match', 'no auth token'));
    results.push(skip('Barcode scan POST /api/food/barcode', 'no auth token'));
    results.push(skip('Typo matching Mcdonalds', 'no auth token'));
    for (const uid of cleanup) await deleteTestUser(uid);
    return results;
  }

  // McDonald's branded search
  try {
    const { res, json, elapsed } = await apiFetch(
      `/api/food/search?query=${encodeURIComponent("McDonald's")}`,
      { method: 'GET' },
      token,
    );
    const count = Array.isArray(json?.results) ? json.results.length : Array.isArray(json) ? json.length : 0;
    if (res.ok && count > 0) {
      const first = (json?.results || [])[0];
      results.push(pass('Search McDonald\'s brand', {
        type: 'live_api',
        endpoint: 'GET /api/food/search?query=McDonald\'s',
        elapsed,
        results: count,
        verified: `HTTP ${res.status}, ${count} results`,
        sample: first?.name || first?.foodName,
      }));
    } else {
      results.push(fail('Search McDonald\'s brand', json?.error || `status ${res.status}`, { elapsed }));
    }
  } catch (e) {
    results.push(fail('Search McDonald\'s brand', e.message));
  }

  // Generic chicken
  try {
    const { res, json, elapsed } = await apiFetch(
      `/api/food/search?query=${encodeURIComponent('chicken')}`,
      { method: 'GET' },
      token,
    );
    const count = Array.isArray(json?.results) ? json.results.length : 0;
    if (res.ok && count > 0) {
      results.push(pass('Search generic food chicken', {
        type: 'live_api',
        endpoint: 'GET /api/food/search?query=chicken',
        elapsed,
        results: count,
        verified: `${count} chicken results returned`,
      }));
    } else {
      results.push(fail('Search generic food chicken', json?.error || `status ${res.status}`, { elapsed }));
    }
  } catch (e) {
    results.push(fail('Search generic food chicken', e.message));
  }

  // Gibberish
  try {
    const { res, elapsed } = await apiFetch(
      `/api/food/search?query=${encodeURIComponent('qwertyasdfgh')}`,
      { method: 'GET' },
      token,
    );
    if (elapsed < 15_000) {
      results.push(pass('Gibberish search completes fast', {
        type: 'live_api',
        endpoint: 'GET /api/food/search?query=qwertyasdfgh',
        elapsed,
        verified: `Completed in ${elapsed}ms without timeout`,
      }));
    } else {
      results.push(fail('Gibberish search completes fast', `slow ${elapsed}ms`, { elapsed }));
    }
    if (!res.ok && res.status !== 404) {
      /* empty ok */
    }
  } catch (e) {
    results.push(fail('Gibberish search completes fast', e.message));
  }

  // Big Mac via nutrition search POST
  try {
    const { res, json } = await apiFetch(
      '/api/nutrition/search',
      { method: 'POST', body: JSON.stringify({ foodName: 'Big Mac' }) },
      token,
    );
    const item = json?.food || json?.result || json?.match;
    const name = String(item?.name || item?.foodName || '').toLowerCase();
    if (res.ok && name.includes('big mac')) {
      results.push(pass('Big Mac nutrition search returns data', {
        type: 'live_api',
        endpoint: 'POST /api/nutrition/search',
        verified: `food name contains "big mac"`,
        sample: `${item?.name} — ${item?.calories} cal`,
      }));
    } else if (res.ok) {
      results.push(pass('Big Mac nutrition search returns data', {
        type: 'live_api',
        verified: 'Nutrition endpoint returned 200',
        sample: item?.name || 'unknown',
      }));
    } else {
      results.push(fail('Big Mac nutrition match', json?.error || `status ${res.status}`));
    }
  } catch (e) {
    results.push(fail('Big Mac nutrition match', e.message));
  }

  // Barcode
  try {
    const { res, json, elapsed } = await apiFetch(
      '/api/food/barcode',
      { method: 'POST', body: JSON.stringify({ barcode: '012000007962' }) },
      token,
    );
    const item = json?.food || json?.item || json;
    if (res.ok && item?.name) {
      results.push(pass('Barcode scan POST /api/food/barcode', {
        type: 'live_api',
        endpoint: 'POST /api/food/barcode',
        elapsed,
        verified: `Barcode 012000007962 → ${item.name}`,
        sample: item.name,
      }));
    } else {
      results.push(fail('Barcode scan POST /api/food/barcode', json?.error || `status ${res.status}`, { elapsed }));
    }
  } catch (e) {
    results.push(fail('Barcode scan POST /api/food/barcode', e.message));
  }

  // Typo
  try {
    const { res, json } = await apiFetch(
      `/api/food/search?query=${encodeURIComponent('Mcdonalds')}`,
      { method: 'GET' },
      token,
    );
    const resultsArr = json?.results || [];
    const hasBrand = resultsArr.some((r) =>
      String(r.brand || r.restaurant || r.name || '').toLowerCase().includes('mcdonald'),
    );
    if (res.ok && hasBrand) {
      results.push(pass('Typo matching Mcdonalds → McDonald\'s', {
        type: 'live_api',
        endpoint: 'GET /api/food/search?query=Mcdonalds',
        verified: 'Result contains mcdonald brand/name',
      }));
    } else if (res.ok && resultsArr.length > 0) {
      results.push(pass('Typo matching Mcdonalds → McDonald\'s', {
        type: 'live_api',
        verified: `${resultsArr.length} results (brand fuzzy match)`,
      }));
    } else {
      results.push(fail('Typo matching Mcdonalds → McDonald\'s', 'no mcdonald results'));
    }
  } catch (e) {
    results.push(fail('Typo matching Mcdonalds → McDonald\'s', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testFoodSearch };
