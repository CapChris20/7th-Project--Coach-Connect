// Simple Express backend for fitness app with Claude, DeepSeek, and web search
// Start: npm run server
// Env: ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, optional SERPER_API_KEY
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();

// Local `npm run server` must never enforce AI Coach caps/guardrails — .env or Cloud Run vars must not win.
if (!process.env.K_SERVICE) {
  process.env.NODE_ENV = process.env.NODE_ENV === 'production' ? 'development' : process.env.NODE_ENV || 'development';
  process.env.AI_COACH_ENFORCE_LIMITS = '0';
}
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const axios = require('axios');
const multer = require('multer');
const WebSocket = require('ws');
const { getWeeklyContext } = require('./getWeeklyContext');
const { serperOrganicSearch } = require('./lib/serperWebSearch');
const {
  shouldInvokeWebSearch,
  shouldUseWebAuto,
  WEB_SEARCH_SYSTEM_APPEND,
  WEB_SOURCE_QUOTE_SYSTEM_APPEND,
  THREAD_CLARIFY_SYSTEM_APPEND,
  NO_WEB_SEARCH_HONESTY_APPEND,
  WEB_SEARCH_FAILED_APPEND,
  messagesRequestWebSearch,
  buildWebSearchQuery,
  stripWebSearchPrefix,
  stripFakeWebSearchClaims,
  userRequestedWebSearchTurn,
  isWebSourceQuoteFollowUp,
  isWebAnswerFollowUp,
  findPriorSubstantiveUserQuestion,
  isFitnessNutritionQuery,
  filterFitnessWebSources,
  resolveCoachWebSearchGate,
} = require('./lib/coachWebSearch');
const { shouldIncludeWeeklyContextInCoachPrompt } = require('./lib/coachPersonalDataRouting');
const { fetchOpenWorkoutPlanPayload, fetchWorkoutPlanContext } = require('./lib/coachExtendedContext');
const { parseBookSessionFields, formatSessionLabel } = require('./lib/bookSessionParse');
const {
  COACH_VOICE_DIRECTIVE,
  COACH_WEB_SEARCH_FORMAT,
  COACH_TOOL_VOICE_NOTE,
  COACH_DATA_INTEGRITY_RULE,
} = require('./lib/coachVoice');
const logger = require('./lib/logger');
const { initServerMonitoring } = require('./lib/monitoring');
initServerMonitoring();
const { mergeCoachToolCalls } = require('./lib/inferCoachToolCall');
const { filterValidCoachToolProposals } = require('../src/ai-coach/server-logic/tools/shouldShowCoachAction');
const { assertCanSendPushNotification } = require('./lib/pushNotificationAuth');
const { buildWorkoutSystemPrompt, buildWorkoutUserPrompt } = require('./lib/workoutPlanPrompt');
const { estimateCost, isWithinMonthlyLimit } = require('./config/apiCosts');
const { randomUUID } = require('crypto');
const {
  COPY: PUSH_COPY,
  pickRandom: pushPickRandom,
  sub: pushSub,
  localDateTimeInIANA,
  hasDashboardWorkoutLog,
  minutesDiffClock,
  stripNotificationEmoji: pushStripNotificationEmoji,
} = require('./pushHelpers');
const {
  tryInitializeFirebaseAdmin,
  printInitFailureHelp,
} = require('./lib/initFirebaseAdmin');
const { runDailyMacroRecalibrationJob } = require('./lib/macroRecalibration');
const { runWithDistributedLock } = require('./lib/distributedLock');
const { resolveAiCoachDailyLimit } = require('./lib/aiCoachRateLimit');
const { createSharedRateLimiter } = require('./middleware/rateLimitShared');
const { startReminderCron } = require('./cron/scheduler');
const {
  isProductionRuntime,
  devOnlyRoute,
  verifyFirebaseBearerToken,
} = require('./middleware/auth');
const { registerHealthRoutes, registerApiHealthRoute } = require('./routes/healthRoutes');
const { registerAICoachRoutes } = require('./routes/aiCoachRoutes');
const { registerNotificationRoutes } = require('./routes/notificationsRoutes');
const { registerMediaRoutes } = require('./routes/mediaRoutes');
const { registerUserRoutes, isTrainerOfClient } = require('./routes/userRoutes');
const { registerSupportRoutes } = require('./routes/supportRoutes');
const { registerOnboardingRoutes } = require('./routes/onboardingRoutes');
const { registerTrainerRoutes } = require('./routes/trainerRoutes');
const { registerWorkoutRoutes } = require('./routes/workoutRoutes');
const { registerFoodRoutes } = require('./routes/foodRoutes');
const { registerNutritionSearchRoutes } = require('./routes/nutritionSearchRoutes');
const { createTokenBucketLimiter } = require('./middleware/tokenBucketRateLimit');
const { registerDevRoutes } = require('./routes/devRoutes');
const { registerMarketplaceRoutes } = require('./routes/marketplaceRoutes');
const { registerAuthRoutes } = require('./routes/authRoutes');
const { registerSubscriptionRoutes } = require('./routes/subscriptionRoutes');
const { registerStripePaymentRoutes } = require('./routes/stripePaymentRoutes');
const { registerStripeConnectRoutes } = require('./routes/stripeConnectRoutes');
const { renderPasswordResetPageHtml } = require('./lib/passwordResetPage');
const { mergeUserDailyMetrics } = require('./lib/dailyMetricsServer');
const { executeDeleteLogServer } = require('./lib/coachDeleteLog');
const { sanitizeCoachImageAttachments, runCoachVisionTurn, isCoachVisionConfigured } = require('./lib/coachVision');

const { isoDateKey, serverTs, safeJsonParse, fetchWithTimeout } = require('./lib/serverCommon');
const { executeTool } = require('./lib/coachTools/executeTool');
const {
  resolveDeepSeekKey,
  resolveAnthropicKey,
  resolvePerplexityKey,
  callDeepSeekChat,
  callClaudeCoach,
  callDeepSeekCoach,
  checkMonthlyApiBudget,
  detectFatigue,
  sendExpoPushSingle,
  createAlert,
} = require('./lib/llm/coachLlmProviders');
const {
  handleAICoachRequest,
  parseToolCalls,
  stripToolJsonFromReply,
  isAiCoachTestRequest,
  isAiCoachTestOrDev,
  isAiCoachLimitsEnforced,
} = require('./lib/aiCoach/coachRequestHandler');
const {
  runSessionSoonReminderJob,
  runNutritionReminderPushJob,
  runWorkoutReminderJob,
} = require('./jobs/reminderJobs');



// Initialize Firebase Admin SDK (service account file, env JSON, or gcloud ADC)
const firebaseAdminInit = tryInitializeFirebaseAdmin();
if (firebaseAdminInit.ok) {
  console.log(`✅ Firebase Admin initialized (${firebaseAdminInit.source})`);
} else {
  printInitFailureHelp(firebaseAdminInit);
}

const app = express();
// Cloud Run sits behind Google's proxy; trust one hop so express-rate-limit
// can read X-Forwarded-For without throwing validation errors on startup.
if (process.env.K_SERVICE) {
  app.set('trust proxy', 1);
}

// Stripe webhooks need the raw body for signature verification — before JSON parser.
const { handleStripeWebhook } = require('./routes/stripeWebhookRoutes');
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook);

// CORS — restrict to known origins (dev + prod)
const allowedOrigins = [
  /^http:\/\/localhost/,
  /^http:\/\/127\.0\.0\.1/,
  /^exp:\/\//,
  // Add your production domain(s) here, e.g.:
  // 'https://anatrox.app',
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, curl)
    if (!origin) return callback(null, true);
    const allowed = allowedOrigins.some((pattern) =>
      typeof pattern === 'string' ? pattern === origin : pattern.test(origin)
    );
    if (allowed) return callback(null, true);
    return callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
registerHealthRoutes(app);
// For file uploads (transcription)
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────

async function clearAiCoachDailyUsage(userId) {
  if (!userId || !admin.apps.length) return;
  try {
    const date = isoDateKey();
    await admin
      .firestore()
      .collection('users')
      .doc(userId)
      .collection('usage')
      .doc(`aiCoach_${date}`)
      .delete();
  } catch (_) {
    /* ignore */
  }
}

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: 'AI rate limit exceeded. Wait a moment and try again.' },
  skip: (req) => isAiCoachTestOrDev(req),
});

const foodSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Food search rate limit exceeded.' },
});

const nutritionSearchLimiter = createTokenBucketLimiter({
  capacity: 100,
  refillIntervalMs: 60 * 1000,
  message: { error: 'Nutrition search rate limit exceeded. Max 100 requests per minute.' },
});

app.use(generalLimiter);

// Apply strict limiters to specific routes
// ─────────────────────────────────────────────
// Simple app-level shared secret (defence in depth)
// ─────────────────────────────────────────────
const verifyAppSecret = (req, res, next) => {
  // Skip for health checks
  if (req.path === '/health') return next();

  const secret = req.headers['x-app-secret'];
  if (!secret || secret !== process.env.APP_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
};

app.use('/api/ai-coach', aiLimiter);
app.use('/api/ask', aiLimiter);
app.use('/api/workout/generate', aiLimiter);
app.use('/api/food/search', foodSearchLimiter);
app.use('/api/food/barcode', foodSearchLimiter);
app.use('/api/nutrition/restaurant', foodSearchLimiter);
app.use('/api/food/usda', foodSearchLimiter);
app.use('/api/nutrition/search', nutritionSearchLimiter);
app.use('/api/youtube/search', generalLimiter);

// ─────────────────────────────────────────────
// PROMPTS (must match user spec exactly)
// ─────────────────────────────────────────────

registerAICoachRoutes(app, {
  verifyFirebaseBearerToken,
  devOnlyRoute,
  handleAICoachRequest,
  executeTool,
  parseToolCalls,
  stripToolJsonFromReply,
  callClaudeCoach,
  sharedRateLimit: createSharedRateLimiter('/api/ai-coach'),
});

const routeDeps = {
  verifyFirebaseBearerToken,
  devOnlyRoute,
  serverTs,
  isoDateKey,
  isAiCoachLimitsEnforced,
  isAiCoachTestRequest,
  resolveDeepSeekKey,
  resolveAnthropicKey,
  callDeepSeekChat,
  callClaudeCoach,
  callDeepSeekCoach,
  buildWorkoutSystemPrompt,
  buildWorkoutUserPrompt,
  isTrainerOfClient,
  parseToolCalls,
  detectFatigue,
  checkMonthlyApiBudget,
  sharedRateLimit: createSharedRateLimiter('/api/ai-coach'),
};

registerNotificationRoutes(app, routeDeps);
registerMediaRoutes(app, routeDeps);
registerUserRoutes(app, routeDeps);
registerSupportRoutes(app, routeDeps);
registerOnboardingRoutes(app, routeDeps);
registerTrainerRoutes(app, routeDeps);
registerWorkoutRoutes(app, routeDeps);
registerFoodRoutes(app, routeDeps);
registerNutritionSearchRoutes(app, {
  ...routeDeps,
  sharedRateLimit: createSharedRateLimiter('/api/nutrition/search'),
});
registerAuthRoutes(app);
registerDevRoutes(app, routeDeps);
registerMarketplaceRoutes(app, routeDeps);
registerSubscriptionRoutes(app, routeDeps);
registerStripePaymentRoutes(app, routeDeps);
registerStripeConnectRoutes(app, routeDeps);

app.get('/reset-password', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderPasswordResetPageHtml());
  } catch (e) {
    console.error('[reset-password] page render failed:', e?.message || e);
    res.status(500).send('Password reset page is unavailable.');
  }
});

// ─────────────────────────────────────────────
// Firebase scheduled jobs (exportable in Functions runtime)
// NOTE: Express server won't run these schedules; deploy via Firebase Functions.
// ─────────────────────────────────────────────
let firebaseFunctionsV1 = null;
try {
  // eslint-disable-next-line global-require
  firebaseFunctionsV1 = require('firebase-functions');
} catch (_) {
  // ignore (server runtime)
}

async function dailyAlertCheckImpl() {
  if (!admin.apps.length) throw new Error('Firebase Admin not initialized');
  const db = admin.firestore();

  const usersSnap = await db.collection('users').where('aiCoachActive', '==', true).get();
  if (usersSnap.empty) return { processed: 0 };

  let processed = 0;
  for (const doc of usersSnap.docs) {
    const userId = doc.id;
    try {
      const weekly = await getWeeklyContext(userId);
      const weekTotalVol = Number(weekly?.workoutAnalysis?.totalVolume) || 0;
      const avgRPE = Number(weekly?.workoutAnalysis?.avgRPE) || 0;
      const avgHours = Number(weekly?.sleepAnalysis?.avgHours) || 0;
      const targetProtein = Number(weekly?.macroTargets?.protein) || 0;
      const avgProtein = Number(weekly?.nutritionAnalysis?.avgProtein) || 0;

      const normalVolume = await calculateNormalVolume(userId);
      const fatigue = weekTotalVol > normalVolume * 1.2 && avgHours < 6.5 && avgRPE >= 8;

      // CHECK 1 - FATIGUE
      if (fatigue) {
        await createAlert(userId, {
          type: 'fatigue',
          title: pushPickRandom(PUSH_COPY.aiCoachTitles || ['Your AI Coach has a tip for you']),
          body: pushPickRandom(PUSH_COPY.aiCoachBodies || ['Open the app for details.']),
          priority: 'high',
        });
      }

      // CHECK 2 - STREAK MILESTONE (if streak stored)
      const currentStreak = Number(weekly?.streakData?.currentStreak) || 0;
      if (currentStreak === 28) {
        await createAlert(userId, {
          type: 'streak',
          title: pushPickRandom(PUSH_COPY.progressTitles || ['Milestone hit']),
          body: pushPickRandom(PUSH_COPY.progressBodies || ['Open the app for details.']),
          priority: 'high',
        });
      }

      // CHECK 3 - MISSED WORKOUTS
      const lastWorkout = await getLastWorkoutDate(userId);
      if (lastWorkout) {
        const daysSince = Math.floor((Date.now() - lastWorkout.getTime()) / (24 * 60 * 60 * 1000));
        if (daysSince === 3) {
          await createAlert(userId, {
            type: 'missedWorkout',
            title: pushPickRandom(PUSH_COPY.genericTitles || ['Time for a progress check']),
            body: pushPickRandom(PUSH_COPY.motivationalBodies || ["Haven't seen you in a few days — how are you doing?"]),
            priority: 'medium',
          });
        }
      }

      // CHECK 4 - MACRO GAP (protein)
      if (targetProtein > 0 && avgProtein < targetProtein - 35) {
        const consecutive = await countConsecutiveDaysUnder(userId, 'protein', targetProtein - 35, 4);
        if (consecutive >= 4) {
          await createAlert(userId, {
            type: 'macroGap',
            title: 'Nutrition check-in',
            body: pushSub(pushPickRandom(PUSH_COPY.nutritionBodies || ['Time to log today\'s meals']), {
              trainerName: 'Your coach',
            }),
            priority: 'low',
          });
        }
      }

      processed += 1;
    } catch (e) {
      console.error('[dailyAlertCheck] user failed:', userId, e?.message || e);
      // continue to next user
    }
  }

  let macroJob = { processed: 0, adjusted: 0 };
  try {
    macroJob = await runDailyMacroRecalibrationJob(admin);
  } catch (e) {
    console.error('[dailyAlertCheck] macro recalibration job failed:', e?.message || e);
  }

  return { processed, macroRecalibration: macroJob };
}

async function weeklySummaryImpl() {
  if (!admin.apps.length) throw new Error('Firebase Admin not initialized');
  const db = admin.firestore();

  const usersSnap = await db.collection('users').where('aiCoachActive', '==', true).get();
  if (usersSnap.empty) return { processed: 0 };

  let processed = 0;
  for (const doc of usersSnap.docs) {
    const userId = doc.id;
    try {
      const wc = await getWeeklyContext(userId);
      const sessions = Number(wc?.workoutAnalysis?.sessionsLogged) || 0;
      const volumeTrend = wc?.workoutAnalysis?.volumeTrend || 'stable';
      const consistency = Number(wc?.nutritionAnalysis?.consistencyScore) || 0;
      const avgHours = Math.round((Number(wc?.sleepAnalysis?.avgHours) || 0) * 10) / 10;
      const weightTrend = wc?.weightTrend || 'unknown';
      const streak = Number(wc?.streakData?.currentStreak) || 0;

      const prompt = `Generate a brief, encouraging weekly fitness summary (max 120 words).

User data:
- Workouts: ${sessions}/4 logged, volume ${volumeTrend}
- Nutrition: ${consistency}% macro consistency
- Sleep: ${avgHours}h avg
- Weight: ${weightTrend}
- Streak: ${streak} days

Include:
1. Highlight 1-2 wins (be specific)
2. Identify 1 area to improve (be specific)
3. 1-2 focus areas for next week
4. Streak/milestone status

Be specific, be encouraging.`;

      const response = await callClaude({
        systemPrompt: 'You are a fitness coach writing weekly summaries',
        messages: [{ role: 'user', content: prompt }],
      });

      const weekId = isoDateKey(); // simple key; can be replaced with ISO week later
      const text = String(response.text || '').trim();

      await db
        .collection('users')
        .doc(userId)
        .collection('weeklySummaries')
        .doc(weekId)
        .set(
          {
            weekId,
            summary: text,
            date: serverTs(),
            source: 'aiCoach',
          },
          { merge: true }
        );

      await createAlert(userId, {
        type: 'weeklySummary',
        title: pushPickRandom(PUSH_COPY.genericTitles || ['New update in your CoachConnect']),
        body: text.slice(0, 100),
        priority: 'low',
      });

      processed += 1;
    } catch (e) {
      console.error('[weeklySummary] user failed:', userId, e?.message || e);
    }
  }
  return { processed };
}

// Export scheduled functions if firebase-functions is available in this runtime
if (firebaseFunctionsV1) {
  exports.dailyAlertCheck = firebaseFunctionsV1.pubsub
    .schedule('0 7 * * *')
    .timeZone('UTC')
    .onRun(async () => dailyAlertCheckImpl());

  exports.weeklySummary = firebaseFunctionsV1.pubsub
    .schedule('0 7 * * 0')
    .timeZone('UTC')
    .onRun(async () => weeklySummaryImpl());
}

// ─────────────────────────────────────────────────────────
// TEST ENDPOINTS - Compare DeepSeek vs Claude
// ─────────────────────────────────────────────────────────
// WARNING: Only use for development/testing. Disable in production.



// Nutrition fallback #3: Serper (Google search) parsing for nutrition facts

// Error logging endpoint - automatically writes errors to ERRORS.txt

/** YYYY-MM-DD in UTC (used for nutrition nudge dedupe). */
registerApiHealthRoute(app, () => {
  const deepseek = !!resolveDeepSeekKey();
  const perplexity = !!resolvePerplexityKey();
  const serper = !!process.env.SERPER_API_KEY;
  const firebaseAdmin = admin.apps.length > 0;
  const anthropic = !!resolveAnthropicKey();
  return {
    ok: deepseek && firebaseAdmin,
    firebaseAdmin,
    aiCoachLimits: isAiCoachLimitsEnforced() ? 'enforced' : 'off',
    nodeEnv: process.env.NODE_ENV || 'development',
    deepseek,
    anthropic,
    coachVisionReady: isCoachVisionConfigured() && firebaseAdmin,
    workoutPlanReady: anthropic && firebaseAdmin,
    perplexity,
    serper,
    usda: !!process.env.USDA_API_KEY,
    youtube: !!(process.env.YOUTUBE_API_KEY || process.env.REACT_NATIVE_YOUTUBE_API_KEY),
    supportEmailReady: !!(
      process.env.RESEND_API_KEY ||
      (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
    ),
    supportInbox: (process.env.SUPPORT_INBOX_EMAIL || 'coachconnect0@gmail.com').trim(),
    aiCoachReady: deepseek && firebaseAdmin,
    webSearchReady: (perplexity || (deepseek && serper)) && firebaseAdmin,
    webSearchRoute: '/api/ai-coach/web-search',
    service: 'coachconnect-api',
    timestamp: new Date().toISOString(),
  };
});

const PORT = process.env.PORT || 4000;

async function listenWithPortCheck() {
  const net = require('net');
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`
❌ Port ${PORT} is already in use (likely an OLD server without limit fixes).

   Kill it, then restart:
     lsof -ti :${PORT} | xargs kill -9
     npm run server
`);
        process.exit(1);
      }
      reject(err);
    });
    probe.once('listening', () => probe.close(resolve));
    probe.listen(PORT, '0.0.0.0');
  });
}

listenWithPortCheck()
  .then(() => {
    app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT} (pid ${process.pid})`);
  console.log(
    `🤖 AI Coach daily limits: ${
      isAiCoachLimitsEnforced()
        ? 'ENFORCED (10/day)'
        : 'OFF — unlimited local/dev (Cloud Run prod enforces daily caps by default)'
    }`
  );
  console.log(`🌐 HTTP endpoints: http://localhost:${PORT}`);
  console.log(`🔐 Serper API: ${process.env.SERPER_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🥬 USDA API: ${process.env.USDA_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  const supportEmailReady =
    !!process.env.RESEND_API_KEY ||
    !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  console.log(
    `📧 Support inbox email: ${supportEmailReady ? '✅ RESEND_API_KEY or SMTP_* set' : '⚠️  No email provider — tickets save to Firestore; add RESEND_API_KEY or SMTP_* for coachconnect0@gmail.com delivery'}`
  );

  const { networkInterfaces } = require('os');
  let localIP = 'localhost';
  try {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          localIP = net.address;
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ Could not determine local IP (networkInterfaces failed):', e?.message || e);
  }

  // SECURITY: removed unauthenticated admin endpoints.

  // ─────────────────────────────────────────────
  // LOVABLE API ENDPOINTS - Trainer Management
  // ─────────────────────────────────────────────


  console.log('=================================');
  console.log('Server running at:');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}`);
  console.log(`  Set EXPO_PUBLIC_API_BASE_URL=http://${localIP}:${PORT} in your .env`);
  console.log('=================================');
  console.log('🔧 Admin endpoints: (removed for security)');
  console.log('=================================');
  console.log('💬 App support (Contact Support screen):');
  console.log(`  POST http://localhost:${PORT}/api/support/contact — JSON { subject, message } + Authorization: Bearer <Firebase ID token>`);
  console.log('=================================');
  console.log('🚀 Lovable API endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/trainers - Get all trainers`);
  console.log(`  GET  http://localhost:${PORT}/api/trainers/:id - Get single trainer`);
  console.log(`  POST http://localhost:${PORT}/api/trainers - Create trainer`);
  console.log(`  PUT  http://localhost:${PORT}/api/trainers/:id - Update trainer`);
  console.log(`  DEL  http://localhost:${PORT}/api/trainers/:id - Delete trainer`);
  console.log(`  GET  http://localhost:${PORT}/api/specialties - Get specialties`);
  console.log('=================================');

  startReminderCron([
    ['cron-session-soon-reminder', () => runSessionSoonReminderJob()],
    ['cron-nutrition-reminder-push', () => runNutritionReminderPushJob()],
    ['cron-workout-reminder', () => runWorkoutReminderJob()],
  ]);
    });
  })
  .catch((e) => {
    console.error('Port check failed:', e?.message || e);
    process.exit(1);
  });


