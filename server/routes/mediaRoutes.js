/** YouTube API proxy */
const axios = require('axios');

function registerMediaRoutes(app, deps) {
  const { verifyFirebaseBearerToken } = deps;

app.get('/api/youtube/search', verifyFirebaseBearerToken, async (req, res) => {
  const key = String(
    process.env.YOUTUBE_API_KEY || process.env.REACT_NATIVE_YOUTUBE_API_KEY || '',
  ).trim();
  if (!key) {
    return res.status(501).json({ ok: false, error: 'YouTube API key not set in server .env' });
  }
  let q = String(req.query.q || '').trim();
  if (!q) q = 'workout exercise form tutorial';
  if (q.length > 200) q = q.slice(0, 200);
  const maxResults = Math.min(50, Math.max(1, parseInt(String(req.query.maxResults || '50'), 10) || 50));
  try {
    const { data } = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        type: 'video',
        maxResults,
        order: 'relevance',
        q,
        key,
      },
      timeout: 18000,
    });
    if (data?.error) {
      const msg = data.error.message || 'YouTube API error';
      return res.status(502).json({ ok: false, error: msg });
    }
    const items = (data.items || [])
      .map((it) => ({
        videoId: it.id?.videoId,
        title: it.snippet?.title || '',
        channel: it.snippet?.channelTitle || '',
        description: it.snippet?.description || '',
        publishedAt: it.snippet?.publishedAt || '',
      }))
      .filter((it) => it.videoId);
    return res.json({ ok: true, items });
  } catch (e) {
    const msg = e.response?.data?.error?.message || e.message || 'youtube_proxy_failed';
    return res.status(502).json({ ok: false, error: msg });
  }
});

}

module.exports = { registerMediaRoutes };
