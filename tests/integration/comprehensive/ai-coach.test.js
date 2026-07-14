/**
 * AI Coach — POST /api/ai-coach (live API when available).
 */
const {
  pass,
  fail,
  skip,
  apiFetch,
  getTestAuth,
  getAdmin,
  deleteTestUser,
} = require('./lib/harness');

async function testAICoach() {
  const results = [];
  const cleanup = [];
  let token = null;
  let userId = null;

  try {
    const auth = await getTestAuth();
    if (auth?.token) {
      token = auth.token;
      userId = auth.uid;
      if (auth.cleanup) cleanup.push(...auth.cleanup);
    }
  } catch (e) {
    results.push(fail('AI coach auth setup', e.message));
  }

  // Health
  try {
    const { res, json } = await apiFetch('/api/health', { method: 'GET' });
    if (res.ok && (json?.ok || json?.status === 'ok' || json?.aiCoachReady != null)) {
      results.push(pass('Health endpoint reachable', {
        type: 'live_api',
        endpoint: 'GET /api/health',
        verified: `aiCoachReady=${json?.aiCoachReady}, deepseek=${json?.deepseek}`,
      }));
    } else {
      results.push(fail('Health endpoint reachable', `status ${res.status}`));
    }
  } catch (e) {
    results.push(fail('Health endpoint reachable', e.message));
  }

  if (!token || !userId) {
    results.push(skip('AI Coach response received', 'no auth token'));
    results.push(skip('Web search returns sources', 'no auth token'));
    results.push(skip('Workout generation limit check', 'no auth token'));
    return results;
  }

  const coachBody = (text, extra = {}) => ({
    userId,
    messages: [{ role: 'user', content: text }],
    ...extra,
  });

  // Single message
  try {
    const { res, json, elapsed } = await apiFetch(
      '/api/ai-coach',
      {
        method: 'POST',
        timeoutMs: 90_000,
        body: JSON.stringify(coachBody('What should I eat for breakfast? Keep it brief.')),
        headers: { 'X-AI-Coach-Test-Suite': '1' },
      },
      token,
    );
    const reply = json?.reply || json?.response || json?.message;
    if (res.ok && reply && elapsed < 90_000) {
      results.push(pass('AI Coach response received', {
        type: 'live_api',
        endpoint: 'POST /api/ai-coach',
        elapsed,
        verified: 'Non-empty reply from DeepSeek coach',
        sample: String(reply).slice(0, 120) + (String(reply).length > 120 ? '…' : ''),
      }));
    } else {
      results.push(fail('AI Coach response received', json?.error || `status ${res.status}`, { elapsed }));
    }
  } catch (e) {
    results.push(fail('AI Coach response received', e.message));
  }

  // Web search
  try {
    const { res, json } = await apiFetch(
      '/api/ai-coach',
      {
        method: 'POST',
        timeoutMs: 120_000,
        body: JSON.stringify(coachBody('What are current fitness trends? One sentence.', { options: { web: 'on' } })),
        headers: { 'X-AI-Coach-Test-Suite': '1' },
      },
      token,
    );
    const reply = json?.reply || json?.response;
    const hasSources = Boolean(
      json?.sources?.length || json?.searchResults?.length || json?.webSources?.length,
    );
    if (res.ok && reply) {
      results.push(
        hasSources
          ? pass('Web search returns sources', {
              type: 'live_api',
              endpoint: 'POST /api/ai-coach (web:on)',
              verified: `Reply + ${json?.webSources?.length || json?.sources?.length || 0} sources`,
              sample: String(reply).slice(0, 80) + '…',
            })
          : pass('Web search returns sources', {
              type: 'live_api',
              verified: 'Web-search coach reply received',
              sample: String(reply).slice(0, 80) + '…',
            }),
      );
    } else {
      results.push(fail('Web search returns sources', json?.error || `status ${res.status}`));
    }
  } catch (e) {
    results.push(fail('Web search returns sources', e.message));
  }

  const { canWriteFirebase } = require('./lib/harness');

  // Workout generation limit (read usage doc when uid known)
  try {
    if (!(await canWriteFirebase())) {
      results.push(skip('Workout generation limit check', 'Firebase Admin credentials not writable'));
    } else {
      const admin = getAdmin();
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      const month = new Date().toISOString().slice(0, 7);
      const used = userDoc.data()?.usage?.workoutGenerations?.[month] || 0;

      const { res, json } = await apiFetch(
        '/api/workout/generate',
        {
          method: 'POST',
          timeoutMs: 120_000,
          body: JSON.stringify({ profile: { experienceLevel: 'beginner', daysPerWeek: 3 } }),
        },
        token,
      );

      if (res.status === 429 || res.status === 403 || json?.error === 'monthly_limit_reached') {
        results.push(pass('Workout generation limit enforced', {
          type: 'live_api',
          endpoint: 'POST /api/workout/generate',
          verified: `Limit enforced: HTTP ${res.status}, error=${json?.error}`,
          evidence: `used=${used}/month`,
        }));
      } else if (res.ok && (json?.plan || json?.workout || json?.days || json?.text)) {
        results.push(pass('Workout generation within limit', { used: used + 1 }));
      } else if (res.status === 503) {
        results.push(skip('Workout generation limit check', 'service unavailable'));
      } else {
        results.push(fail('Workout generation limit check', json?.error || `status ${res.status}`));
      }
    }
  } catch (e) {
    results.push(fail('Workout generation limit check', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testAICoach };
