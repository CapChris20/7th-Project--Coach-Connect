// Simple Express backend to enable web research + OpenAI responses
// Start: npm run server
// Env: OPENAI_API_KEY, optional TAVILY_API_KEY
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

function resolveApiKey(req) {
  // Prefer header to avoid requiring .env for development
  return req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
}

async function webSearch(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await axios.post(
      'https://api.tavily.com/search',
      {
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: 5,
      },
      { timeout: 12000 }
    );
    const result = res.data;
    const items = Array.isArray(result.results) ? result.results : [];
    return items
      .map((r) => `- ${r.title} — ${r.url}\n${r.content?.slice(0, 300) || ''}`)
      .slice(0, 5);
  } catch (e) {
    return [];
  }
}

app.post('/api/ask', async (req, res) => {
  try {
    const { messages = [], enableWeb = true, model } = req.body || {};
    const apiKey = resolveApiKey(req);
    if (!apiKey) {
      return res.status(400).json({ error: 'Server missing OPENAI_API_KEY' });
    }
    const openai = new OpenAI({ apiKey });
    const userLast = [...messages].reverse().find((m) => m.role === 'user');
    const query = userLast?.content || '';
    let webNotes = [];
    if (enableWeb && query) {
      webNotes = await webSearch(query);
    }
    const contextBlock =
      webNotes.length > 0
        ? [
            {
              role: 'system',
              content:
                'You have the following web findings. Use them as helpful context. Cite key sources briefly.',
            },
            {
              role: 'system',
              content: webNotes.join('\n\n'),
            },
          ]
        : [];

    const preferred = [model || 'gpt-5', 'gpt-4o-mini'];
    let completion = null;
    let lastError = null;
    for (let i = 0; i < preferred.length; i += 1) {
      try {
        completion = await openai.chat.completions.create({
          model: preferred[i],
          messages: [...contextBlock, ...messages],
          temperature: 0.7,
        });
        break;
      } catch (err) {
        lastError = err;
        continue;
      }
    }
    if (!completion) {
      const detail =
        lastError?.response?.data?.error?.message ||
        lastError?.message ||
        'Unknown';
      return res
        .status(500)
        .json({ error: `OpenAI failed server-side: ${detail}` });
    }
    const text =
      completion?.choices?.[0]?.message?.content?.trim?.() ?? '';
    return res.json({ text, raw: completion, usedWeb: webNotes.length > 0 });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Unknown server error' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on http://localhost:${PORT}`);
});


