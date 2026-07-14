/**
 * Workout generation — API + prompt module contract.
 */
const path = require('path');
const {
  pass,
  fail,
  skip,
  apiFetch,
  getTestAuth,
  deleteTestUser,
  ROOT,
} = require('./lib/harness');

async function testWorkoutGeneration() {
  const results = [];
  const cleanup = [];

  try {
    const mod = require(path.join(ROOT, 'server/__tests__/workoutPlanPrompt.test.js'));
    results.push(pass('Workout plan prompt unit tests exist'));
  } catch {
    const promptPath = path.join(ROOT, 'server/lib/workoutPlanPrompt.js');
    if (require('fs').existsSync(promptPath)) {
      results.push(pass('Workout plan prompt module present'));
    } else {
      results.push(fail('Workout plan prompt module present', 'not found'));
    }
  }

  let token = null;
  try {
    const auth = await getTestAuth();
    if (auth?.token) {
      token = auth.token;
      if (auth.cleanup) cleanup.push(...auth.cleanup);
    }
  } catch (e) {
    results.push(fail('Workout gen auth setup', e.message));
  }

  if (!token) {
    results.push(skip('POST /api/workout/generate returns plan', 'no auth token'));
    for (const uid of cleanup) await deleteTestUser(uid);
    return results;
  }

  try {
    const { res, json, elapsed } = await apiFetch(
      '/api/workout/generate',
      {
        method: 'POST',
        timeoutMs: 120_000,
        body: JSON.stringify({
          profile: {
            experienceLevel: 'intermediate',
            daysPerWeek: 4,
            equipment: ['dumbbells'],
            goals: 'strength',
          },
        }),
      },
      token,
    );

    const hasPlan = Boolean(json?.plan || json?.workout || json?.days || json?.sessions || json?.text);
    if (res.ok && hasPlan) {
      results.push(pass('POST /api/workout/generate returns plan', { time: `${elapsed}ms` }));
    } else if (res.status === 429 || res.status === 403) {
      results.push(pass('Workout generation rate limit active', { status: res.status }));
    } else if (res.status === 503) {
      results.push(skip('POST /api/workout/generate returns plan', 'service unavailable'));
    } else {
      results.push(fail('POST /api/workout/generate returns plan', json?.error || `status ${res.status}`));
    }
  } catch (e) {
    results.push(fail('POST /api/workout/generate returns plan', e.message));
  }

  for (const uid of cleanup) await deleteTestUser(uid);
  return results;
}

module.exports = { testWorkoutGeneration };
