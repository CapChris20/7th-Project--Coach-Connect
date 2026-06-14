/** Serper Google search helpers (AI coach web context + food search). */
const axios = require('axios');

async function webSearch(query) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) {
    console.warn('SERPER_API_KEY not set, web search disabled');
    return [];
  }
  try {
    const res = await axios.post(
      'https://google.serper.dev/search',
      {
        q: query,
        num: 5,
      },
      {
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 12000,
      }
    );
    const result = res.data;
    const items = Array.isArray(result.organic) ? result.organic : [];
    return items
      .map((r) => `- ${r.title} — ${r.link}\n${r.snippet || ''}`)
      .slice(0, 5);
  } catch (e) {
    console.error('Serper API error:', e.message);
    return [];
  }
}

/** Returns raw organic results from Serper (for restaurant extraction: get first link). */
async function serperOrganicSearch(query, num = 5) {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await axios.post(
      'https://google.serper.dev/search',
      { q: query, num },
      {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        timeout: 12000,
      }
    );
    const items = Array.isArray(res.data?.organic) ? res.data.organic : [];
    return items.map((r) => ({ link: r.link, title: r.title, snippet: r.snippet || '' }));
  } catch (e) {
    console.error('Serper organic search error:', e.message);
    return [];
  }
}

module.exports = { webSearch, serperOrganicSearch };
