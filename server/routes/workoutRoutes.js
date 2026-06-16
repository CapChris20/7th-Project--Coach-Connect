/** Workout plan generation + general ask */
const admin = require('firebase-admin');
const {
  assertWorkoutGenerationAllowed,
  recordSuccessfulWorkoutGeneration,
  formatLimitMessage,
  WORKOUT_GENERATION_LIMIT,
} = require('../lib/workoutGenerationLimit');

function registerWorkoutRoutes(app, deps) {
  const {
    verifyFirebaseBearerToken,
    resolveDeepSeekKey,
    resolveAnthropicKey,
    callDeepSeekChat,
    callClaudeCoach,
    buildWorkoutSystemPrompt,
    buildWorkoutUserPrompt,
    isTrainerOfClient,
    serverTs,
  } = deps;

app.post('/api/ask', verifyFirebaseBearerToken, async (req, res) => {
  const started = Date.now();
  try {
    const { messages, userContext } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const deepSeekKey = resolveDeepSeekKey();
    if (!deepSeekKey) {
      return res.status(500).json({ error: 'AI provider unavailable (missing DeepSeek API key)' });
    }

    let systemPrompt =
      `You are an expert AI fitness and nutrition coach. ` +
      `You only discuss fitness, exercise, workouts, nutrition, diet, and recovery. ` +
      `If asked about anything else respond: ` +
      `'I\\'m your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?' ` +
      `Keep responses concise and conversational.`;

    if (userContext && typeof userContext === 'object') {
      systemPrompt += `\n\nHere is the user's data: ${JSON.stringify(userContext, null, 2)}`;
    }

    const response = await callDeepSeekChat({
      apiKey: deepSeekKey,
      systemPrompt,
      messages,
      maxTokens: 600,
    });

    return res.json({
      response,
      source: 'deepseek',
      ms: Date.now() - started,
    });
  } catch (e) {
    console.error('❌ Error in /api/ask:', e?.message || e);
    return res.status(500).json({ error: 'Failed to process request' });
  }
});

app.post('/api/workout/generate', verifyFirebaseBearerToken, async (req, res) => {
  if (
    process.env.NODE_ENV !== 'production' &&
    String(req.headers['x-load-test'] || '') === '1'
  ) {
    return res.json({
      text: `# Mock Workout Plan

Day 1: Push
1. Bench Press - 4 x 8, 90s rest
2. Incline Dumbbell Press - 3 x 10, 75s rest

Day 2: Pull
1. Pull Ups - 4 x 6, 90s rest
2. Barbell Row - 3 x 8, 90s rest`,
      source: 'load-test-mock',
      ms: 0,
      usage: null,
    });
  }

  const started = Date.now();
  try {
    const { onboardingData, subjectUserId } = req.body || {};
    const requesterUid = String(req.firebaseAuth?.uid || '').trim();
    if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });

    const targetUid = String(subjectUserId || requesterUid).trim();
    if (targetUid !== requesterUid) {
      const allowed = await isTrainerOfClient(requesterUid, targetUid);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
    }

    const apiKey = resolveAnthropicKey();
    if (!apiKey) {
      return res.status(503).json({ error: 'AI provider unavailable' });
    }

    if (admin.apps.length) {
      const db = admin.firestore();
      const gate = await assertWorkoutGenerationAllowed(db, targetUid);
      if (!gate.allowed) {
        return res.status(429).json({
          error: 'monthly_limit_reached',
          message: formatLimitMessage(gate.resets_at),
          limit: WORKOUT_GENERATION_LIMIT,
          used: gate.used,
          resets_at: gate.resets_at,
        });
      }
    }

    const systemPrompt = buildWorkoutSystemPrompt();
    const userPrompt = buildWorkoutUserPrompt(onboardingData || {});

    const text = await callClaudeCoach({
      apiKey,
      systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: 8000,
      timeoutMs: 120000,
    });

    let usage = null;
    if (admin.apps.length) {
      const db = admin.firestore();
      usage = await recordSuccessfulWorkoutGeneration(db, targetUid, serverTs);
    }

    return res.json({
      text,
      source: 'claude',
      ms: Date.now() - started,
      usage,
    });
  } catch (e) {
    console.error('POST /api/workout/generate failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to generate workout plan' });
  }
});

}

module.exports = { registerWorkoutRoutes };
