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
const { webSearch } = require('./lib/serperWebSearch');
const { shouldInvokeWebSearch, WEB_SEARCH_SYSTEM_APPEND } = require('./lib/coachWebSearch');
const { shouldIncludeWeeklyContextInCoachPrompt } = require('./lib/coachPersonalDataRouting');
const { fetchOpenWorkoutPlanPayload } = require('./lib/coachExtendedContext');
const { parseBookSessionFields, formatSessionLabel } = require('./lib/bookSessionParse');
const {
  COACH_VOICE_DIRECTIVE,
  COACH_TOOL_VOICE_NOTE,
  COACH_DATA_INTEGRITY_RULE,
} = require('./lib/coachVoice');
const logger = require('./lib/logger');
const { initServerMonitoring } = require('./lib/monitoring');
initServerMonitoring();
const { mergeCoachToolCalls } = require('./lib/inferCoachToolCall');
const { assertCanSendPushNotification } = require('./lib/pushNotificationAuth');
const { buildWorkoutSystemPrompt, buildWorkoutUserPrompt } = require('./lib/workoutPlanPrompt');
const { estimateCost } = require('./config/apiCosts');
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
const { registerWorkoutRoutes } = require('./routes/workoutRoutes');
const { registerFoodRoutes } = require('./routes/foodRoutes');
const { registerDevRoutes } = require('./routes/devRoutes');
const { registerMarketplaceRoutes } = require('./routes/marketplaceRoutes');
const { mergeUserDailyMetrics } = require('./lib/dailyMetricsServer');
const { executeDeleteLogServer } = require('./lib/coachDeleteLog');
const { sanitizeCoachImageAttachments, runCoachVisionTurn } = require('./lib/coachVision');


// Initialize Firebase Admin SDK (service account file, env JSON, or gcloud ADC)
const firebaseAdminInit = tryInitializeFirebaseAdmin();
if (firebaseAdminInit.ok) {
  console.log(`✅ Firebase Admin initialized (${firebaseAdminInit.source})`);
} else {
  printInitFailureHelp(firebaseAdminInit);
}


// ─────────────────────────────────────────────
// Shared helpers (timestamps, ids, etc.)
// ─────────────────────────────────────────────
function isoDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  // Use UTC date key for consistent server behavior
  return dt.toISOString().slice(0, 10);
}

function serverTs() {
  return admin.apps.length
    ? admin.firestore.FieldValue.serverTimestamp()
    : new Date();
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

const {
  parseCoachToolCalls,
  stripCoachToolJsonFromReply: stripToolJsonFromReply,
} = require('../src/shared/parseCoachToolCalls');

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

const app = express();

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
function isAiCoachTestRequest(req) {
  const header =
    req?.headers?.['x-ai-coach-test-suite'] ||
    req?.headers?.['X-AI-Coach-Test-Suite'] ||
    '';
  return String(header) === '1' || req?.body?.options?.testSuite === true;
}

/** Production-only: must set AI_COACH_ENFORCE_LIMITS=1 AND NODE_ENV=production. Never on local npm run server. */
function isAiCoachLimitsEnforced() {
  if (process.env.AI_COACH_ENFORCE_LIMITS !== '1') return false;
  if (process.env.NODE_ENV !== 'production') return false;
  return true;
}

function isAiCoachTestOrDev(req) {
  return (
    isAiCoachTestRequest(req) ||
    process.env.AI_COACH_UNLIMITED === '1' ||
    process.env.NODE_ENV !== 'production' ||
    !isAiCoachLimitsEnforced()
  );
}

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
app.use('/api/youtube/search', generalLimiter);

function resolveDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || null;
}

function resolveAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || null;
}

function resolvePerplexityKey() {
  return process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || null;
}

function resolveOpenAIKey() {
  return process.env.OPENAI_API_KEY || null;
}

// ─────────────────────────────────────────────
// PROMPTS (must match user spec exactly)
// ─────────────────────────────────────────────
function buildCoachSystemPrompt(userProfile, { generalMode = false } = {}) {
  let systemPrompt =
`You are CoachConnect — their fitness and nutrition coach in this app.

${COACH_VOICE_DIRECTIVE}

CORE DIRECTIVE: USER AUTONOMY IS PARAMOUNT.
- User's explicit request > your coaching judgment. Always.
- If user asks to change targets, DO IT. Do not refuse. Do not argue. Do not lecture.
- You are an assistant, not a gatekeeper. Trust them to know their own body and life.
- If you think they're making a suboptimal choice, say so briefly (1 sentence), then EXECUTE the request.

SCOPE:
Talk fitness, training, workouts, form, mobility, recovery, sleep (as it affects training), nutrition, macros, supplements, and habits tied to their goals.
Brief greetings and casual check-ins are fine — answer like a human, then steer back to their program if it fits.
If they ask you to search the web or google something fitness-related, answer from web results when provided — don't claim you can't browse.
Off-topic stuff (coding, politics, legal, unrelated medical diagnosis): "I'm your fitness coach — I can only help with training and nutrition. What do you want to work on?"
Keep replies tight. No essays unless they asked for depth.

DATA:
${
  generalMode
    ? `This turn is a general coaching question (food yes/no, sodium, supplements, workouts for a goal, form, programming). Answer ONLY what they asked — short and direct. Do NOT mention their app food log, calorie averages, log consistency, meals they ate, workout gaps, or sleep unless they explicitly asked about their logs or personal progress. Do not guilt, nag, or pivot with "your real problem is..." Do not invent log data. You may lightly reference their stated goal or training level from profile when helpful. If they ask what they logged or what's in their nutrition diary, say: "Ask me again with something like 'what did I eat today?' and I'll pull your Nutrition log" — do NOT claim you can see or cannot see log data you weren't given.`
    : `When you have their weekly summary or food log in this prompt, use real numbers and dates. Never ask them to paste a log you can already see. If a day isn't in the log, say they didn't log that day.`
}

ABSOLUTE RULES:
1. NEVER refuse user requests for macro/goal changes
2. NEVER lecture instead of executing
3. NEVER say "I can't" or "I won't" 
4. NEVER override user choices with your judgment
5. If user asks to change targets to ANY value, return tool JSON with that exact value
6. If user asks to log something, DO IT - don't delay with questions
7. NEVER say "you should do X instead" - just DO X if they ask

When they ask to DO something → execute immediately with tool JSON. Period.

TOOLS (when they ask you to DO something in the app):
If they want to log food, change calorie/macro targets, log sleep on the dashboard, swap an exercise, book a session, deload, change goal, or message their trainer — you MUST ALWAYS end your reply with this JSON block (valid JSON only, last thing in the message, no backticks, no markdown):
{"toolCalls": [{"name": "<toolName>", "params": {...}, "reasoning": "short why"}]}

EXACT EXAMPLES OF CORRECT FORMAT:
Example 1 - Keep target but adjust macros:
User: "adjust my macros"
Your response: "I'm keeping your calorie target at 2249 but adjusting protein to 130g...
{"toolCalls": [{"name": "adjustMacroTargets", "params": {"calories": 2249, "protein": 130, "carbs": 200, "fat": 65}, "reasoning": "Adjust protein to 130g for realistic starting point"}]}"

Example 2 - Change calorie target:
User: "change my calories to 1800"
Your response: "I'll set your calories to 1800...
{"toolCalls": [{"name": "adjustMacroTargets", "params": {"calories": 1800, "protein": 150, "carbs": 180, "fat": 60}, "reasoning": "Set to 1800 kcal as requested"}]}"

CRITICAL RULES - MANDATORY:
1. ALWAYS include tool JSON. NEVER skip it. NEVER say "tap confirm" without JSON.
2. NEVER refuse user requests. If they ask to change targets, DO IT with the JSON.
3. ALWAYS show the specific number values in your JSON params (calories, protein, carbs, fat).
4. The tool JSON must be the LAST thing in your message.
5. Your JSON MUST be valid JSON with proper quotes and syntax.

Allowed tools only:
adjustMacroTargets (protein, carbs, fat, calories numbers — updates Nutrition screen)
logNutrition (foodName, calories, protein, carbs, fat, mealType — real food only)
logSleep (hours, optional date YYYY-MM-DD — dashboard sleep)
logWater (amount_oz — water intake tracking)
logSteps (step_count — daily step count)
rateEnergy (rating 1-10, optional notes — energy level check-in)
logMood (mood: "happy"|"okay"|"stressed"|"tired"|"anxious", optional notes — mood tracking)
rateWorkout (rating 1-10, optional notes — workout experience rating)
logRestDay (optional date YYYY-MM-DD — marks rest day on dashboard workout card)
updateWorkout (planId "current", dayIndex, exerciseIndex, newExercise)
openWorkoutPlan (planId "current" or saved plan id — opens plan viewer + summarize in chat)
bookSession (sessionDate YYYY-MM-DD, sessionTime HH:mm, optional durationMin)
updateGoal (newGoal string)
notifyTrainer (message, issueType, severity)
deleteLog (logType: nutrition|sleep|water|steps|energy|mood|workout|restDay — optional date YYYY-MM-DD, foodName/logId for nutrition, deleteAll for all food that day)

${COACH_TOOL_VOICE_NOTE}

Tool routing:
- Calorie/macro goal changes → adjustMacroTargets with explicit calories
- "I slept X hours" / "9 hours sleep" → logSleep
- "I drank X oz of water" / "100 oz water" → logWater
- "I did X steps" / "10,000 steps today" → logSteps
- "My energy is X/10" / "Energy level 8" → rateEnergy (1-10 rating)
- "My mood is..." / "I'm feeling happy/stressed/tired/anxious" → logMood
- "That workout was X/10" / "Workout rating 9" → rateWorkout (1-10 only — completed workouts, never rest days)
- "Rest day" / "log rest" / "skip workout today" / "mark today rest" → logRestDay ONLY (updates dashboard workout card). NEVER rateWorkout or updateWorkout for rest days. You HAVE logRestDay — never say you lack a tool for rest days.
- Food/meals with macros → logNutrition only
- "Delete/remove/clear food or logs" → deleteLog (logType nutrition + foodName/date). NEVER use logNutrition for deletes.
- Trainer-related stuff → bookSession, notifyTrainer, updateGoal
- Workouts → updateWorkout, openWorkoutPlan
- "Open/show my workout plan" or "what's today's session" → openWorkoutPlan AND summarize from WORKOUT PROGRAM below
- Workout plan questions → answer from WORKOUT PROGRAM section (full JSON/plan detail is in context). Never say you can't see their plan.
- "Delete/remove/clear my [food/sleep/water/steps/energy/mood/workout] log" → deleteLog with matching logType. For food include foodName when specified; omit foodName to remove the most recent entry; deleteAll:true to clear all food for that day. NEVER refuse delete requests.

CRITICAL RULES FOR DASHBOARD METRICS:
- When user mentions SLEEP → ALWAYS use logSleep. Never say "I can't log sleep".
- When user mentions STEPS → ALWAYS use logSteps. Never say "I can't track steps".
- When user mentions WATER → ALWAYS use logWater. Never say "I can't log water".
- When user mentions ENERGY/FATIGUE → ALWAYS use rateEnergy. Never refuse.
- When user mentions MOOD/FEELING → ALWAYS use logMood. Never refuse.
- When user rates a WORKOUT → ALWAYS use rateWorkout. Never refuse.
Your toolkit covers ALL of these. Do NOT say "I can't track that" or "that's not something I can track" for any dashboard metric.

${COACH_DATA_INTEGRITY_RULE}`;

  if (userProfile && typeof userProfile === 'object') {
    const slim = generalMode
      ? {
          primaryGoal: userProfile.primaryGoal || userProfile.goal,
          fitnessLevel: userProfile.fitnessLevel || userProfile.trainingLevel,
          name: userProfile.firstName || userProfile.name,
        }
      : userProfile;
    systemPrompt += `\n\nUSER PROFILE:\n${JSON.stringify(slim, null, 2)}`;
  }
  return systemPrompt;
}

function formatDailyNutritionLines(dailyBreakdown, { totalLoggedDaysAllTime, detailDays } = {}) {
  if (!Array.isArray(dailyBreakdown) || !dailyBreakdown.length) {
    const hint =
      totalLoggedDaysAllTime > 0
        ? `No meal-level detail in the last ${detailDays || 45} days (${totalLoggedDaysAllTime} older logged days exist — use lifetime averages above).`
        : 'No nutrition logged since joining.';
    return hint;
  }
  return dailyBreakdown
    .map((d) => {
      const header = `- ${d.date}: ${d.calories} cal, ${d.protein}g P, ${d.carbs}g C, ${d.fat}g F`;
      if (Array.isArray(d.meals) && d.meals.length) {
        const mealLines = d.meals
          .map((m) => `    • ${m.meal || 'meal'}: ${m.food} (${m.calories || 0} cal, ${m.protein || 0}g P)`)
          .join('\n');
        return `${header}\n${mealLines}`;
      }
      const foods =
        Array.isArray(d.foods) && d.foods.length
          ? ` | foods: ${d.foods.slice(0, 12).join(', ')}`
          : '';
      return `${header}${foods}`;
    })
    .join('\n');
}

function formatWeightLogLines(weightLog) {
  if (!Array.isArray(weightLog) || !weightLog.length) {
    return 'No weight entries logged since joining.';
  }
  return weightLog.map((w) => `- ${w.date}: ${w.weightLbs} lbs`).join('\n');
}

function formatActivityWellnessSection(wellness) {
  if (!wellness || typeof wellness !== 'object') return '';
  const lines = [];
  const { steps, water, energy, mood } = wellness;
  const recentDetailDays = 14;

  if (steps?.avgDaily != null) {
    const recent = (Array.isArray(steps.daily) ? steps.daily : []).slice(-recentDetailDays);
    const breakdown = recent.map((d) => `${d.date}: ${d.steps.toLocaleString()}`).join(', ');
    const daysNote = steps.daysLogged ? ` on ${steps.daysLogged} logged days` : '';
    lines.push(
      `- Steps: avg ${steps.avgDaily.toLocaleString()}/day${daysNote}${breakdown ? ` | recent: ${breakdown}` : ''}`
    );
  }
  if (water?.avgOzDaily != null) {
    const daysNote = water.daysLogged ? ` (${water.daysLogged} logged days)` : '';
    lines.push(`- Water: avg ${water.avgOzDaily} oz/day${daysNote}`);
  }
  if (energy?.avgRating != null) {
    const daysNote = energy.daysLogged ? ` (${energy.daysLogged} logged days)` : '';
    lines.push(`- Avg energy rating: ${energy.avgRating}/10${daysNote}`);
  }
  if (Array.isArray(mood?.entries) && mood.entries.length) {
    const recent = mood.entries.slice(-recentDetailDays);
    const moodLine = recent.map((e) => `${e.date}: ${e.mood}`).join(', ');
    lines.push(`- Mood log: ${moodLine}`);
  }
  if (wellness.soreness?.avgRating != null) {
    lines.push(`- Avg soreness: ${wellness.soreness.avgRating}/10`);
  }
  if (Array.isArray(wellness.sleepDaily) && wellness.sleepDaily.length) {
    const recent = wellness.sleepDaily.slice(-recentDetailDays);
    const sleepLine = recent.map((s) => `${s.date}: ${s.hours}h`).join(', ');
    lines.push(`- Sleep by day: ${sleepLine}`);
  }

  if (!lines.length) return '';
  return `\n\nACTIVITY & WELLNESS (since you joined — lifetime averages, recent daily detail):\n${lines.join('\n')}`;
}

function formatWorkoutPlanSection(workoutPlan) {
  if (!workoutPlan?.activePlan && !(workoutPlan?.plans || []).length) return '';
  const active = workoutPlan.activePlan;
  const lines = [
    'Use planId "current" for the active plan unless the user names another saved plan.',
    'You HAVE their full program below — cite exercises, sets, and days directly. Never say plan details are missing.',
    'When they ask to open/view the plan → use openWorkoutPlan tool (opens visual viewer) and summarize today\'s session in chat.',
  ];
  if (active?.summary) {
    const meta = [
      active.dayCount ? `${active.dayCount} days` : null,
      active.exerciseCount ? `${active.exerciseCount} exercises` : null,
    ]
      .filter(Boolean)
      .join(', ');
    lines.push(`\nACTIVE PLAN [planId: ${active.id || 'current'}] — ${active.title || 'Current'}${meta ? ` (${meta})` : ''}:`);
    lines.push(active.summary);
    if (active.hasLinkOnly) {
      lines.push('(Plan is a PDF/link only — coach cannot read file contents, only title.)');
    }
  }
  const others = (workoutPlan.plans || []).filter((p) => p.id !== active?.id && p.summary);
  if (others.length) {
    lines.push('\nOther saved plans (full detail — cite by planId when user asks about a specific plan):');
    others.forEach((p) => {
      const meta = [
        p.dayCount ? `${p.dayCount} days` : null,
        p.exerciseCount ? `${p.exerciseCount} exercises` : null,
      ]
        .filter(Boolean)
        .join(', ');
      lines.push(`\n[planId: ${p.id}] ${p.title || p.id}${meta ? ` (${meta})` : ''}:`);
      lines.push(p.summary);
    });
  }
  if (lines.length <= 2) return '';
  return `\n\nWORKOUT PROGRAM (from app — every exercise below is real logged data; do not invent or say details are missing):\n${lines.join('\n')}`;
}

function formatNotesAndFilesSection(notesAndFiles, trainerDocuments) {
  const lines = [];
  if (notesAndFiles?.notes?.length) {
    lines.push('Notes:');
    notesAndFiles.notes.forEach((n) => {
      lines.push(`- [${n.from}${n.date ? ` · ${n.date}` : ''}] ${n.content}`);
    });
  }
  if (notesAndFiles?.files?.length) {
    lines.push('Files (metadata only — cannot open attachments):');
    notesAndFiles.files.forEach((f) => {
      lines.push(`- [${f.from}${f.date ? ` · ${f.date}` : ''}] ${f.type}: ${f.name}`);
    });
  }
  if (trainerDocuments?.documents?.length) {
    lines.push('Trainer-shared documents:');
    trainerDocuments.documents.forEach((d) => {
      const prev = d.preview ? ` — ${d.preview}` : '';
      lines.push(`- ${d.title} (${d.type})${prev}`);
    });
  }
  if (!lines.length) return '';
  return `\n\nFILES & NOTES (from app):\n${lines.join('\n')}`;
}

function buildWeeklyContextSystemPrompt(weeklyContext) {
  const {
    age, weight, height, goal, trainingLevel,
    targetCal, targetP, targetC, targetF,
    avgCal, avgP, avgC, avgF, consistency, daysLogged,
    totalDaysSinceJoin, totalLoggedDaysAllTime, firstLogDate, lastLogDate,
    sessions, sessionDates, totalVol, avgRPE,
    avgHours, sleepQuality, isDepleted,
    streak, weightTrend, volumeTrend,
    dailyBreakdown, weightLog,
    wellness,
    workoutPlan,
    notesAndFiles,
    trainerDocuments,
  } = weeklyContext || {};

  const sessionDateLine =
    Array.isArray(sessionDates) && sessionDates.length
      ? sessionDates.join(', ')
      : 'none';

  const calGap = avgCal - targetCal;
  const proGap = avgP - targetP;
  const sleepDeficit = avgHours < 7.5 ? (7.5 - avgHours).toFixed(1) : null;
  const hasAvgRpe = Number.isFinite(avgRPE) && avgRPE > 0;
  const fatigueNote =
    isDepleted && hasAvgRpe && avgRPE >= 8
      ? 'high fatigue — deload worth discussing'
      : isDepleted
        ? 'moderate fatigue'
        : 'fatigue risk low';

  const trainingLine = hasAvgRpe
    ? `Training: ${sessions} sessions (${sessionDateLine}), volume ${totalVol} (${volumeTrend}), avg RPE ${avgRPE}/10.`
    : `Training: ${sessions} sessions (${sessionDateLine}), volume ${totalVol} (${volumeTrend}).`;

  const streakLine = streak > 0 ? `\n\nStreak ${streak} days.` : '';
  const historySpan = totalDaysSinceJoin || 7;
  const foodLogMeta =
    totalLoggedDaysAllTime > daysLogged
      ? ` (${totalLoggedDaysAllTime} total logged days since joining; meal detail below is the most recent ${daysLogged} days)`
      : '';

  return `You are their CoachConnect coach. Everything below is real data from their app — use it, don't ask them to paste logs.

${COACH_VOICE_DIRECTIVE}

DATA RULES:
The daily nutrition log below is what they actually logged in the app. Lifetime averages cover their full history since joining. If a date is listed with foods, reference those meals in normal sentences. If a date is missing from the recent detail section, they didn't log that day — say so plainly. Never claim you can't see their food log when data is below.

CLIENT: ${age}yo, ${weight}lbs, ${height}" | goal ${goal} | ${trainingLevel}
Targets: ${targetCal} cal, ${targetP}g protein, ${targetC}g carbs, ${targetF}g fat

ACCOUNT HISTORY (${historySpan} days since joining):
Nutrition lifetime avg ${avgCal} cal vs ${targetCal} target (${calGap > 0 ? '+' : ''}${calGap}), protein ${avgP}g vs ${targetP}g (${proGap > 0 ? '+' : ''}${proGap}), carbs ${avgC}g, fat ${avgF}g. Logged on ${totalLoggedDaysAllTime || daysLogged || 0} days (${consistency}% of days since joining).${firstLogDate ? ` First log: ${firstLogDate}.` : ''}${lastLogDate ? ` Last log: ${lastLogDate}.` : ''} Calorie trend vs target: ${avgCal > targetCal ? 'over' : avgCal < targetCal ? 'under' : 'on target'}.

Recent daily food log${foodLogMeta}:
${formatDailyNutritionLines(dailyBreakdown, { totalLoggedDaysAllTime, detailDays: daysLogged })}

Weight (trend ${weightTrend}):
${formatWeightLogLines(weightLog)}

${trainingLine}

Recovery: sleep ~${avgHours}h/night${sleepDeficit ? `, about ${sleepDeficit}h under 7.5h target` : ''}, quality ${sleepQuality}${isDepleted ? ', depleted' : ''}. ${fatigueNote}.${formatActivityWellnessSection(wellness)}${formatWorkoutPlanSection(workoutPlan)}${formatNotesAndFilesSection(notesAndFiles, trainerDocuments)}${streakLine}

Weight trend ${weightTrend}.

COACHING:
Lead with what matters most for their goal. Only cite their logged numbers when the user asked about their progress, logs, habits, or personal situation — not for general fitness/nutrition questions (sodium, protein timing, supplements, form). If they asked a general question, answer it directly without dragging in calorie averages or log gaps.

YOUR JOB:
- Give information and answer questions
- EXECUTE their requests via tool JSON immediately
- NOT override their choices with judgment
- NOT refuse requests

If user says "change to X", set it to X. If they say "log Y", log it. Their autonomy > your coaching caution.

TOOLS - MANDATORY:
When they ask to DO something → ALWAYS return tool JSON. No exceptions. No delays. No lectures first.

If they say "change my targets" → return tool JSON with their requested values.
If they say "don't do X" → respect it, don't argue, just acknowledge.
If they ask to log food/sleep/steps/etc → return tool JSON immediately.

${COACH_TOOL_VOICE_NOTE}

Tool routing:
- Calorie/macro goal changes → adjustMacroTargets
- "I slept X hours" → logSleep
- "I drank X oz" → logWater
- "I did X steps" → logSteps
- "My energy is X/10" → rateEnergy
- "My mood is..." (happy/okay/stressed/tired/anxious) → logMood
- "Workout was X/10" → rateWorkout (1-10 only)
- "Rest day" / "log rest" / "skip workout today" → logRestDay (dashboard workout card). NEVER rateWorkout for rest days.
- Food/meals → logNutrition only
- Trainer/sessions → bookSession, notifyTrainer
- Workouts/exercises → updateWorkout, openWorkoutPlan
- "Open my plan" / "today's session" → openWorkoutPlan + answer from WORKOUT PROGRAM below
- "Delete/remove/clear my log" → deleteLog (logType + optional foodName/date). NEVER refuse deletes.

CRITICAL RULES FOR DASHBOARD METRICS:
- When user mentions SLEEP → ALWAYS use logSleep. Never say "I can't log sleep".
- When user mentions STEPS → ALWAYS use logSteps. Never say "I can't track steps".
- When user mentions WATER → ALWAYS use logWater. Never say "I can't log water".
- When user mentions ENERGY/FATIGUE → ALWAYS use rateEnergy. Never refuse.
- When user mentions MOOD/FEELING → ALWAYS use logMood. Never refuse.
- When user rates a WORKOUT → ALWAYS use rateWorkout. Never refuse.
Your toolkit covers ALL of these. Do NOT say "I can't track that" or "that's not something I can track" for any dashboard metric.

${COACH_DATA_INTEGRITY_RULE}

Allowed tools: adjustMacroTargets, logNutrition, logSleep, logWater, logSteps, rateEnergy, logMood, rateWorkout, logRestDay, deleteLog, updateWorkout, openWorkoutPlan, bookSession, updateGoal, notifyTrainer.`;
}

// ─────────────────────────────────────────────
// Tool calling: parse + execute
// ─────────────────────────────────────────────
function parseToolCalls(aiResponse) {
  return parseCoachToolCalls(aiResponse);
}

function resolveCoachToolCalls(aiText, userMessage, weeklyContext) {
  return mergeCoachToolCalls(aiText, userMessage, weeklyContext || {});
}

async function executeTool(userId, toolCall) {
  const db = admin.apps.length ? admin.firestore() : null;
  if (!db) return { success: false, message: 'Firestore unavailable (Firebase Admin not initialized)' };
  if (!userId || typeof userId !== 'string') return { success: false, message: 'Invalid userId' };
  const name = toolCall?.name;
  const params = toolCall?.params || {};

  try {
    if (name === 'adjustMacroTargets') {
      const goalsSnap = await db.collection('nutrition_goals').doc(userId).get();
      const cur = goalsSnap.exists ? goalsSnap.data() || {} : {};

      const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const protein =
        num(params?.protein ?? params?.newProtein) ??
        num(cur.protein_target) ??
        num(cur.protein) ??
        150;
      const carbs =
        num(params?.carbs ?? params?.newCarbs) ?? num(cur.carbs_target) ?? num(cur.carbs) ?? 200;
      const fat = num(params?.fat ?? params?.newFats) ?? num(cur.fat_target) ?? num(cur.fat) ?? 65;
      let calories = num(params?.calories ?? params?.newCals ?? params?.calorieTarget);
      if (calories == null) {
        calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
      }

      const macroPayload = {
        protein,
        carbs,
        fat,
        calories,
        updatedAt: serverTs(),
        updatedBy: 'aiCoach',
      };

      await db
        .collection('users')
        .doc(userId)
        .collection('macroTargets')
        .doc('current')
        .set(macroPayload, { merge: true });

      await db.collection('nutrition_goals').doc(userId).set(
        {
          user_id: userId,
          protein_target: protein,
          carbs_target: carbs,
          fat_target: fat,
          calorie_target: calories,
          calories,
          updated_at: serverTs(),
        },
        { merge: true }
      );

      return {
        success: true,
        message: `Daily target updated to ${calories} kcal. Open Nutrition to see the new goal.`,
        data: { calories, protein, carbs, fat },
      };
    }

    if (name === 'logSleep') {
      const hours = Number(params?.hours ?? params?.sleepHours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
        return { success: false, message: 'Invalid sleep hours (use 0.5–24)' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        db
          .collection('users')
          .doc(userId)
          .collection('sleep_logs')
          .doc(dateKey)
          .set({ hours, date: dateKey, logged_at: serverTs() }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_sleep: hours }, tracking: { sleepHours: hours } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged ${hours} hours of sleep on your dashboard.`,
        data: { hours, date: dateKey },
      };
    }

    if (name === 'logWater') {
      const amount_oz = Number(params?.amount_oz);
      if (!Number.isFinite(amount_oz) || amount_oz <= 0) {
        return { success: false, message: 'Water amount must be greater than 0 ounces' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        db
          .collection('users')
          .doc(userId)
          .collection('water_logs')
          .doc(dateKey)
          .set({ amount_oz, date: dateKey, logged_at: serverTs() }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_water: String(amount_oz) }, tracking: { waterIntake: amount_oz } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged ${amount_oz}oz of water.`,
        data: { amount_oz, date: dateKey },
      };
    }

    if (name === 'logSteps') {
      const step_count = Number(params?.step_count);
      if (!Number.isFinite(step_count) || step_count < 0) {
        return { success: false, message: 'Step count must be 0 or greater' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        db
          .collection('users')
          .doc(userId)
          .collection('step_logs')
          .doc(dateKey)
          .set({ step_count, date: dateKey, logged_at: serverTs() }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_steps: step_count }, tracking: { steps: step_count } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged ${step_count} steps.`,
        data: { step_count, date: dateKey },
      };
    }

    if (name === 'rateEnergy') {
      const rating = Number(params?.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
        return { success: false, message: 'Energy rating must be between 1 and 10' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        // Write to new energy_logs collection
        db
          .collection('users')
          .doc(userId)
          .collection('energy_logs')
          .doc(dateKey)
          .set({
            rating,
            notes: String(params?.notes || '').trim(),
            date: dateKey,
            logged_at: serverTs(),
          }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          {
            logs: { dashboard_energy: rating },
            tracking: { energyLevel: String(rating) },
          },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged energy level: ${rating}/10.`,
        data: { rating, date: dateKey },
      };
    }

    if (name === 'logMood') {
      const mood = String(params?.mood || '').toLowerCase().trim();
      const validMoods = ['happy', 'okay', 'stressed', 'tired', 'anxious'];
      if (!validMoods.includes(mood)) {
        return { success: false, message: `Mood must be one of: ${validMoods.join(', ')}` };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        // Write to new mood_logs collection
        db
          .collection('users')
          .doc(userId)
          .collection('mood_logs')
          .doc(dateKey)
          .set({
            mood,
            notes: String(params?.notes || '').trim(),
            date: dateKey,
            logged_at: serverTs(),
          }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_mood: mood }, tracking: { mood } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged mood: ${mood}.`,
        data: { mood, date: dateKey },
      };
    }

    if (name === 'rateWorkout') {
      const notes = String(params?.notes || params?.note || '').toLowerCase();
      const rating = Number(params?.rating);
      if (
        /\brest\s*day\b/.test(notes) ||
        /\bno\s+workout\b/.test(notes) ||
        rating === 0 ||
        !Number.isFinite(rating) ||
        rating < 1
      ) {
        const dateKey = String(params?.date || isoDateKey()).trim();
        await mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          {
            logs: {
              dashboard_workout_name: 'Rest day',
              dashboard_workouts: 'Rest day',
              workoutLog: [],
            },
            tracking: {
              workoutName: 'Rest day',
              workoutSummary: 'Rest day',
              workoutExercises: [],
            },
          },
          serverTs,
        );
        return {
          success: true,
          message: `Rest day logged for ${dateKey}. Check your dashboard workout card.`,
          data: { date: dateKey },
        };
      }
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
        return { success: false, message: 'Workout rating must be between 1 and 10' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await db
        .collection('users')
        .doc(userId)
        .collection('workout_ratings')
        .doc(dateKey)
        .set({
          rating,
          notes: String(params?.notes || '').trim(),
          date: dateKey,
          logged_at: serverTs(),
        }, { merge: true });
      return {
        success: true,
        message: `Logged workout rating: ${rating}/10.`,
        data: { rating, date: dateKey },
      };
    }

    if (name === 'logRestDay') {
      const dateKey = String(params?.date || isoDateKey()).trim();
      await mergeUserDailyMetrics(
        db,
        userId,
        dateKey,
        {
          logs: {
            dashboard_workout_name: 'Rest day',
            dashboard_workouts: 'Rest day',
            workoutLog: [],
          },
          tracking: {
            workoutName: 'Rest day',
            workoutSummary: 'Rest day',
            workoutExercises: [],
          },
        },
        serverTs,
      );
      return {
        success: true,
        message: `Rest day logged for ${dateKey}. Check your dashboard workout card.`,
        data: { date: dateKey },
      };
    }

    if (name === 'deleteLog') {
      return executeDeleteLogServer(db, userId, params, serverTs, isoDateKey);
    }

    if (name === 'logNutrition') {
      const foodName = String(params?.foodName || params?.food || '').trim();
      if (!foodName) return { success: false, message: 'Missing foodName' };

      let cals = Number(params?.calories ?? params?.cals);
      let p = Number(params?.protein);
      let c = Number(params?.carbs);
      let f = Number(params?.fat ?? params?.fats);

      if (!Number.isFinite(cals) || cals <= 0) {
        const manualMsg = `I couldn't look up nutrition data for "${foodName}". Please log this manually in the nutrition tab for accurate tracking.`;
        const apiKey = process.env.USDA_API_KEY;
        if (!apiKey) {
          return { success: false, message: manualMsg };
        }
        const r = await fetchWithTimeout(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&pageSize=1&api_key=${apiKey}`,
          {},
          8000
        );
        if (!r.ok) return { success: false, message: manualMsg };
        const data = await r.json();
        const item = (data.foods || [])[0];
        if (!item) return { success: false, message: manualMsg };
        const nutrients = item.foodNutrients || [];
        const get = (id) => nutrients.find((n) => n.nutrientId === id)?.value || 0;
        cals = Number(get(1008)) || 0;
        p = Number(get(1003)) || 0;
        c = Number(get(1005)) || 0;
        f = Number(get(1004)) || 0;
        if (!Number.isFinite(cals) || cals <= 0) {
          return { success: false, message: manualMsg };
        }
      }

      const todayKey = String(params?.date || isoDateKey()).trim();
      const mealType = String(params?.mealType || 'snack').toLowerCase();
      await db.collection('nutrition_logs').add({
        user_id: userId,
        date: todayKey,
        meal_type: mealType,
        food_name: foodName,
        brand: '',
        serving_size: 1,
        serving_grams: 100,
        calories: Math.round(cals),
        protein: Math.round(p * 10) / 10,
        carbs: Math.round(c * 10) / 10,
        fat: Math.round(f * 10) / 10,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        potassium: 0,
        source: 'aiCoach',
        created_at: serverTs(),
      });

      return {
        success: true,
        message: `Logged ${foodName} (${Math.round(cals)} cal). Your dashboard will update shortly.`,
      };
    }

    if (name === 'bookSession') {
      const trainerId = String(params?.trainerId || '').trim();
      if (!trainerId) {
        return {
          success: false,
          message: 'Connect with a trainer in the app first — then I can request a session for you.',
        };
      }
      const { date, time, durationMin } = parseBookSessionFields(params);
      if (!date || !time) {
        return {
          success: false,
          message: 'Tell me the date and time (e.g. "next Tuesday at 10am") so I can request the session.',
        };
      }
      const sessionRef = db.collection(`trainer_clients/${trainerId}/sessions`).doc();
      await sessionRef.set(
        {
          clientId: userId,
          trainerId,
          date,
          time,
          durationMin,
          duration: durationMin,
          status: 'pending',
          notes: String(params?.notes || '').trim() || 'Requested via AI Coach',
          createdAt: serverTs(),
          updatedAt: serverTs(),
          createdBy: 'aiCoach',
        },
        { merge: true }
      );
      const label = formatSessionLabel({ date, time });
      return {
        success: true,
        message: `Session request sent for ${label}. Your trainer will confirm it — check Home for pending invites.`,
        data: { sessionId: sessionRef.id, date, time },
      };
    }

    if (name === 'updateGoal') {
      const newGoal = String(params?.newGoal || '').trim();
      if (!newGoal) return { success: false, message: 'Missing newGoal' };
      await db.collection('users').doc(userId).set({ goal: newGoal, updatedAt: serverTs() }, { merge: true });
      return { success: true, message: `Goal changed to ${newGoal}` };
    }

    if (name === 'notifyTrainer') {
      const trainerId = String(params?.trainerId || '').trim();
      const message = String(params?.message || '').trim();
      if (!trainerId) return { success: false, message: 'Missing trainerId' };
      if (!message) return { success: false, message: 'Missing message' };
      const clientSnap = await db.collection('users').doc(userId).get();
      const clientName =
        clientSnap.exists
          ? clientSnap.data()?.firstName || clientSnap.data()?.name || 'Client'
          : 'Client';
      const severity = String(params?.severity || 'medium').toLowerCase();
      const issueType = String(params?.issueType || 'check_in').trim();
      const alertId = randomUUID();
      await db
        .collection('users')
        .doc(trainerId)
        .collection('alerts')
        .doc(alertId)
        .set(
          {
            type: 'client_alert',
            clientId: userId,
            clientName,
            message,
            issueType,
            severity,
            createdAt: serverTs(),
            read: false,
            source: 'aiCoach',
          },
          { merge: true }
        );
      await createAlert(trainerId, {
        type: 'client_alert',
        title: `Message from ${clientName}`,
        body: message,
        priority: severity === 'high' ? 'high' : severity === 'low' ? 'low' : 'medium',
      });
      return { success: true, message: 'Your trainer has been notified.' };
    }

    if (name === 'openWorkoutPlan') {
      const planId = String(params?.planId || params?.currentPlanId || 'current').trim() || 'current';
      const payload = await fetchOpenWorkoutPlanPayload(db, userId, planId);
      if (!payload) {
        return {
          success: false,
          message: 'No workout plan found yet. Generate one under Workout → AI Plans first.',
        };
      }
      const parts = [`Opening **${payload.title}**.`];
      if (payload.todayPreview) {
        parts.push(`Today's session:\n${payload.todayPreview}`);
      } else if (payload.summary) {
        parts.push(String(payload.summary).slice(0, 1200));
      }
      return {
        success: true,
        message: parts.join('\n\n'),
        data: payload,
      };
    }

    if (name === 'updateWorkout') {
      const planId = String(params?.planId || params?.currentPlanId || 'current').trim();
      const dayIndex = Number(params?.dayIndex ?? params?.dayIdx ?? 0);
      const exerciseIndex = Number(params?.exerciseIndex ?? params?.exerciseIdx ?? 0);
      const newName = String(
        params?.newExercise?.name || params?.newExercise || params?.exerciseName || ''
      ).trim();
      if (!newName) return { success: false, message: 'Missing new exercise name' };

      const planRef = db.collection('users').doc(userId).collection('workoutPlans').doc(planId);
      const planSnap = await planRef.get();
      if (!planSnap.exists) return { success: false, message: 'Workout plan not found' };
      const plan = planSnap.data() || {};
      const rawText = plan.rawPlan || plan.planText || '';
      let structured =
        plan.structuredPlan && typeof plan.structuredPlan === 'object'
          ? { ...plan.structuredPlan }
          : {};

      let rawParsed = null;
      try {
        rawParsed = rawText && String(rawText).trim().startsWith('{') ? JSON.parse(rawText) : null;
      } catch (_) {
        rawParsed = null;
      }

      let planDays = [];
      if (Array.isArray(structured.plan) && structured.plan.length) planDays = structured.plan.slice();
      else if (Array.isArray(structured.workoutPlan) && structured.workoutPlan.length) {
        planDays = structured.workoutPlan.slice();
      } else if (Array.isArray(rawParsed?.plan) && rawParsed.plan.length) planDays = rawParsed.plan.slice();
      else if (Array.isArray(rawParsed?.workoutPlan) && rawParsed.workoutPlan.length) {
        planDays = rawParsed.workoutPlan.slice();
      } else if (Array.isArray(structured.days) && structured.days.length) {
        planDays = structured.days.slice();
      }

      while (planDays.length <= dayIndex) {
        planDays.push({ day: `Day ${planDays.length + 1}`, exercises: [] });
      }
      const day = { ...planDays[dayIndex], exercises: [...(planDays[dayIndex]?.exercises || [])] };
      while (day.exercises.length <= exerciseIndex) {
        day.exercises.push({ name: 'Exercise' });
      }
      const prev = day.exercises[exerciseIndex] || {};
      day.exercises[exerciseIndex] = {
        ...prev,
        name: newName,
        exerciseName: newName,
        modifiedBy: 'aiCoach',
        modifiedAt: new Date().toISOString(),
        modificationReason: String(params?.reason || '').trim() || null,
      };
      planDays[dayIndex] = day;
      structured = { ...structured, plan: planDays, workoutPlan: planDays };

      await planRef.set(
        {
          structuredPlan: structured,
          updatedAt: serverTs(),
          lastModifiedBy: 'aiCoach',
        },
        { merge: true }
      );
      await db
        .collection('users')
        .doc(userId)
        .collection('workoutPlan')
        .doc('current')
        .set({ structuredPlan: structured, updatedAt: serverTs() }, { merge: true })
        .catch(() => {});
      return { success: true, message: `Updated exercise to ${newName}` };
    }

    return { success: false, message: `Unknown tool: ${name}` };
  } catch (e) {
    console.error(`[executeTool] ${name} failed:`, e?.message || e);
    return { success: false, message: 'Tool execution failed', data: { error: e?.message || String(e) } };
  }
}

async function callPerplexity({ apiKey, systemPrompt, messages }) {
  const url = 'https://api.perplexity.ai/chat/completions';
  const payload = {
    model: 'pplx-70b-online',
    messages: [{ role: 'system', content: systemPrompt }, ...(Array.isArray(messages) ? messages : [])],
    temperature: 0.7,
    max_tokens: 700,
  };

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const msg =
      resp?.data?.error?.message ||
      resp?.data?.message ||
      (typeof resp?.data === 'string' ? resp.data.slice(0, 300) : null);
    throw new Error(`Perplexity HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }
  const text = resp?.data?.choices?.[0]?.message?.content;
  if (!text || String(text).trim().length === 0) throw new Error('Perplexity returned empty response');
  return { text: String(text) };
}

// ─────────────────────────────────────────────
// Providers: DeepSeek + Claude
// ─────────────────────────────────────────────
async function callDeepSeek({ apiKey, systemPrompt, messages }) {
  const url = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';
  const payload = {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, ...(Array.isArray(messages) ? messages : [])],
    temperature: 0.7,
    max_tokens: 900,
  };
  const resp = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });
  if (resp.status < 200 || resp.status >= 300) {
    const msg =
      resp?.data?.error?.message ||
      resp?.data?.message ||
      (typeof resp?.data === 'string' ? resp.data.slice(0, 300) : null);
    throw new Error(`DeepSeek HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }
  const text = resp?.data?.choices?.[0]?.message?.content;
  if (!text || String(text).trim().length === 0) throw new Error('DeepSeek returned empty response');
  return { text: String(text), raw: resp.data || null };
}

async function callClaude({ systemPrompt, messages }) {
  const apiKey = resolveAnthropicKey();
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const url = process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages';
  const anthropicMessages = (Array.isArray(messages) ? messages : [])
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .map((m) => ({ role: m.role, content: [{ type: 'text', text: String(m?.content || '') }] }))
    .filter((m) => m.content?.[0]?.text?.trim?.().length > 0);

  const payload = {
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20240620',
    max_tokens: 700,
    temperature: 0.7,
    system: String(systemPrompt || ''),
    messages: anthropicMessages,
  };

  const resp = await axios.post(url, payload, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
      'content-type': 'application/json',
    },
    timeout: 25000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const detail =
      resp?.data?.error?.message ||
      (typeof resp?.data === 'string' ? resp.data.slice(0, 300) : null);
    throw new Error(`Claude HTTP ${resp.status}${detail ? `: ${detail}` : ''}`);
  }

  const text = resp?.data?.content?.find?.((c) => c?.type === 'text')?.text || '';
  if (!text || String(text).trim().length === 0) throw new Error('Claude returned empty response');
  return { text: String(text), raw: resp.data || null };
}

// ─────────────────────────────────────────────
// Analytics + abuse protection
// ─────────────────────────────────────────────
async function logAPIUsage(apiName, userId, inputTokens, outputTokens, status) {
  try {
    if (!admin.apps.length) return;
    const db = admin.firestore();
    const date = isoDateKey();
    const cost = estimateCost(apiName === 'claude' ? 'anthropic' : apiName, inputTokens, outputTokens);
    const ref = db.collection('analytics').doc('api-usage').collection(date).doc(String(apiName));
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const cur = snap.exists ? snap.data() || {} : {};
      tx.set(
        ref,
        {
          apiName,
          date,
          calls: (cur.calls || 0) + 1,
          inputTokens: (cur.inputTokens || 0) + (Number(inputTokens) || 0),
          outputTokens: (cur.outputTokens || 0) + (Number(outputTokens) || 0),
          cost: (cur.cost || 0) + (Number(cost) || 0),
          lastUserId: userId || null,
          lastStatus: status || 'unknown',
          updatedAt: serverTs(),
        },
        { merge: true }
      );
    });
  } catch (e) {
    console.warn('logAPIUsage failed:', e?.message || e);
  }
}

async function enforceDailyMessageLimit(userId, limit = 10) {
  if (!isAiCoachLimitsEnforced()) {
    return { allowed: true, remaining: null };
  }
  if (!admin.apps.length) return { allowed: true, remaining: null };
  const db = admin.firestore();
  const date = isoDateKey();
  const ref = db.collection('users').doc(userId).collection('usage').doc(`aiCoach_${date}`);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? snap.data() || {} : {};
    const count = Number(cur.count || 0);
    if (count >= limit) return { allowed: false, remaining: 0 };
    tx.set(ref, { count: count + 1, date, updatedAt: serverTs() }, { merge: true });
    return { allowed: true, remaining: Math.max(0, limit - (count + 1)) };
  });
  return result;
}

// ─────────────────────────────────────────────
// Fatigue detection + alerts (used by Cloud Functions and chat)
// ─────────────────────────────────────────────
async function getLastWorkoutDate(userId) {
  if (!admin.apps.length) return null;
  const db = admin.firestore();
  const snap = await db
    .collection('users')
    .doc(userId)
    .collection('workoutLogs')
    .orderBy('timestamp', 'desc')
    .limit(1)
    .get()
    .catch(() => null);
  const doc = snap && !snap.empty ? snap.docs[0] : null;
  if (!doc) return null;
  const data = doc.data() || {};
  const ts = data.timestamp;
  if (ts && typeof ts.toDate === 'function') return ts.toDate();
  const idMs = Date.parse(doc.id);
  if (!Number.isNaN(idMs)) return new Date(idMs);
  return null;
}

async function calculateNormalVolume(userId) {
  if (!admin.apps.length) return 10000;
  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const startTs = admin.firestore.Timestamp.fromMillis(now.toMillis() - 30 * 24 * 60 * 60 * 1000);

  let docs = [];
  try {
    const snap = await db
      .collection('users')
      .doc(userId)
      .collection('workoutLogs')
      .where('timestamp', '>=', startTs)
      .orderBy('timestamp', 'desc')
      .get();
    docs = snap.docs || [];
  } catch (_) {
    const snap = await db.collection('users').doc(userId).collection('workoutLogs').get().catch(() => null);
    docs = snap?.docs || [];
  }

  const vols = docs
    .map((d) => Number(d.data()?.totalVolume))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!vols.length) return 10000;
  const sum = vols.reduce((a, b) => a + b, 0);
  return sum / vols.length;
}

async function countConsecutiveDaysUnder(userId, macro, threshold, days) {
  if (!admin.apps.length) return 0;
  const db = admin.firestore();
  const now = new Date();
  let count = 0;
  for (let i = 0; i < days; i += 1) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = isoDateKey(d);
    const snap = await db.collection('users').doc(userId).collection('nutritionLogs').doc(key).get().catch(() => null);
    if (!snap || !snap.exists) break;
    const totals = snap.data()?.dayTotals || {};
    const value = Number(totals?.[macro]);
    if (!Number.isFinite(value)) break;
    if (value < threshold) count += 1;
    else break;
  }
  return count;
}

async function detectFatigue(userId) {
  try {
    const weekly = await getWeeklyContext(userId);
    const weekTotal = Number(weekly?.workoutAnalysis?.totalVolume) || 0;
    const avgHours = Number(weekly?.sleepAnalysis?.avgHours);
    const avgRPE = Number(weekly?.workoutAnalysis?.avgRPE);
    const normal = await calculateNormalVolume(userId);

    const over = weekTotal > normal * 1.2;
    const lowSleep = Number.isFinite(avgHours) ? avgHours < 6.5 : false;
    const highRpe = Number.isFinite(avgRPE) ? avgRPE >= 8 : false;

    const detected = over && lowSleep && highRpe;
    const reason = detected
      ? `High volume (${Math.round(weekTotal)}) is >20% above your normal (~${Math.round(normal)}), sleep is low (${avgHours}h), and intensity is high (RPE ${avgRPE}/10).`
      : 'No high-fatigue pattern detected from the last 7 days.';
    const recommendation = detected ? 'rest' : (lowSleep ? 'rest' : 'none');

    return { detected, reason, recommendation };
  } catch (e) {
    return { detected: false, reason: 'Fatigue check failed', recommendation: 'none' };
  }
}

/**
 * One-off Expo push (same ticket shape handling as POST /api/notifications/send).
 * @returns {Promise<boolean>} true if Expo accepted the ticket
 */
async function sendExpoPushSingle(token, { title, body, data = {} }) {
  if (!token || typeof token !== 'string') return false;
  if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) return false;
  const strData = {};
  for (const [k, v] of Object.entries(data)) {
    strData[k] = v == null ? '' : String(v);
  }
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: token,
        title: pushStripNotificationEmoji(title || 'CoachConnect') || 'CoachConnect',
        body: (() => {
          let b = pushStripNotificationEmoji(String(body || ''));
          if (!b.trim()) b = 'Open CoachConnect';
          return b.slice(0, 400);
        })(),
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        data: strData,
        interruptionLevel: 'active',
      }),
    });
    const result = await response.json();
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    return ticket?.status === 'ok';
  } catch (e) {
    console.warn('sendExpoPushSingle failed:', e?.message || e);
    return false;
  }
}

async function createAlert(userId, alert) {
  if (!admin.apps.length) return { success: false, message: 'Firebase Admin not initialized' };
  const db = admin.firestore();
  const alertId = randomUUID();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const payload = {
    type: alert?.type || 'generic',
    title: alert?.title || 'CoachConnect Alert',
    body: alert?.body || '',
    priority: alert?.priority || 'low',
    createdAt: serverTs(),
    read: false,
    expiresAt,
  };

  await db.collection('users').doc(userId).collection('alerts').doc(alertId).set(payload, { merge: true });

  // Remote push: Expo first (matches ClientApp tokens); FCM fallback for legacy installs.
  try {
    const userSnap = await db.collection('users').doc(userId).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    if (userData?.notificationsEnabled !== false) {
      const expoToken = userData?.expoPushToken || userData?.pushToken;
      const alertData = {
        type: String(payload.type || 'generic'),
        priority: String(payload.priority || 'low'),
        alertId: String(alertId),
      };
      const expoOk = await sendExpoPushSingle(expoToken, {
        title: payload.title,
        body: payload.body,
        data: alertData,
      });
      if (!expoOk) {
        const fcmToken = userData?.fcmToken || null;
        if (fcmToken && admin.messaging) {
          await admin.messaging().send({
            token: fcmToken,
            notification: { title: payload.title, body: payload.body },
            data: { type: payload.type, priority: payload.priority, alertId },
          });
        }
      }
    }
  } catch (e) {
    console.warn('createAlert push failed:', e?.message || e);
  }

  // Add a chat message in conversationHistory for visibility
  try {
    await db
      .collection('users')
      .doc(userId)
      .collection('conversationHistory')
      .add({
        role: 'assistant',
        content: `${payload.title}\n${payload.body}`.trim(),
        type: 'alert',
        alertType: payload.type,
        priority: payload.priority,
        createdAt: serverTs(),
      });
  } catch (e) {
    console.warn('createAlert conversationHistory write failed:', e?.message || e);
  }

  return { success: true, message: 'Alert created', data: { alertId } };
}

function isFitnessNutritionQuery(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return true;

  const fitness = [
    'workout', 'work out', 'training', 'lift', 'lifting', 'gym', 'exercise', 'cardio', 'hiit',
    'strength', 'hypertrophy', 'sets', 'reps', 'pr', 'progressive overload', 'deload',
    'squat', 'bench', 'deadlift', 'press', 'pull-up', 'pull up', 'form', 'technique',
    'mobility', 'stretch', 'warm up', 'cool down', 'recovery', 'soreness',
    'sleep', 'steps', 'heart rate', 'streak', 'progress', 'adherence', 'week', 'this week',
    'body recomposition', 'recomposition', 'recomp', 'skinny fat', 'bodyfat', 'body fat', 'bf%',
    'cutting', 'cut', 'bulking', 'bulk', 'lean bulk', 'maintenance', 'caloric deficit', 'calorie deficit',
    'calorie surplus', 'caloric surplus', 'tone up', 'toning', 'fat loss', 'lose fat', 'build muscle',
    'bench press', 'dead lift', 'dead-lift',
    'shoulder', 'knee', 'back', 'hip', 'injury', 'hurt', 'pain', 'ache', 'sore',
    'trainer', 'coach', 'session', 'appointment', 'schedule',
    'swap', 'replace', 'modify', 'program', 'plan', 'routine', 'split',
    'overhead', 'fatigue', 'tired', 'plateau',
  ];
  const nutrition = [
    'nutrition', 'diet', 'calories', 'macro', 'macros', 'protein', 'carbs', 'fat', 'fats',
    'meal', 'meals', 'meal plan', 'weight loss', 'gain muscle', 'weight',
    'supplement', 'supplements', 'creatine', 'whey', 'caffeine', 'electrolyte',
    'hydration', 'water', 'fiber',
    'calorie', 'caloric', 'tdee', 'bmr', 'metabolism', 'weigh', 'weigh-in',
    'chicken', 'rice', 'ate', 'eat', 'eating', 'food', 'hungry', 'hunger', 'log',
    'oz', 'cup', 'grams', 'kcal',
  ];

  return [...fitness, ...nutrition].some((k) => t.includes(k));
}

const normalizeCoachMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => ({
      role: m?.role === 'assistant' || m?.role === 'system' ? m.role : 'user',
      content: typeof m?.content === 'string' ? m.content : '',
    }))
    .filter((m) => m.content.trim().length > 0)
    .slice(-40);
};

async function getSerperWebContext(userText) {
  const items = await webSearch(userText);
  if (!items || items.length === 0) return null;
  return items.join('\n');
}

/** DeepSeek has no native browsing — prepend Serper snippets so it can answer with current web facts. */
async function augmentCoachPromptWithWebSearch(basePrompt, userText) {
  const webContext = await getSerperWebContext(userText);
  if (!webContext) return { prompt: basePrompt, searchedWeb: false, webProvider: null };
  return {
    prompt: `${basePrompt}

WEB SEARCH RESULTS (Serper — use for current facts; mention source names in plain sentences when citing):
${webContext}
END WEB RESULTS`,
    searchedWeb: true,
    webProvider: 'serper',
  };
}

async function callDeepSeekCoach({ apiKey, systemPrompt, messages }) {
  const url = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';
  const payload = {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    temperature: 0.7,
    max_tokens: 700,
  };

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`DeepSeek HTTP ${resp.status}`);
  }

  const data = resp.data || {};
  if (!data.choices || !data.choices[0] || !data.choices[0].message) {
    throw new Error('Invalid DeepSeek response structure');
  }

  const reply = data.choices[0].message.content;
  if (!reply || String(reply).trim().length === 0) {
    throw new Error('DeepSeek returned empty response');
  }

  return String(reply);
}

async function callDeepSeekChat({ apiKey, systemPrompt, messages, maxTokens = 600 }) {
  const url = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';
  const payload = {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, ...(Array.isArray(messages) ? messages : [])],
    temperature: 0.7,
    max_tokens: maxTokens,
  };

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const msg =
      resp?.data?.error?.message ||
      resp?.data?.message ||
      (typeof resp?.data === 'string' ? resp.data.slice(0, 200) : null);
    throw new Error(`DeepSeek HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }

  const text = resp?.data?.choices?.[0]?.message?.content;
  if (!text || String(text).trim().length === 0) {
    throw new Error('DeepSeek returned empty response');
  }
  return String(text);
}

// Simple DeepSeek Q&A endpoint (used by workout generator + general chat)

async function callClaudeCoach({
  apiKey,
  systemPrompt,
  messages,
  maxTokens = 800,
  timeoutMs = 20000,
}) {
  const url = process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages';

  const envModel = process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL;
  const modelList = envModel
    ? [envModel]
    : [
        'claude-haiku-4-5-20251001',
        'claude-haiku-4-5',
        'claude-sonnet-4-20250514',
        'claude-sonnet-4-6',
      ];

  const normalizedMessages = Array.isArray(messages) ? messages : [];
  const anthropicMessages = normalizedMessages
    .filter((m) => m?.role === 'user' || m?.role === 'assistant')
    .map((m) => ({
      role: m.role,
      content: [{ type: 'text', text: String(m?.content || '') }],
    }))
    .filter((m) => m.content?.[0]?.text?.trim?.().length > 0);

  let lastErr = null;
  for (const model of modelList) {
    const payload = {
      model,
      max_tokens: maxTokens,
      temperature: 0.7,
      system: String(systemPrompt || ''),
      messages: anthropicMessages,
    };

    const resp = await axios.post(url, payload, {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
        'content-type': 'application/json',
      },
      timeout: timeoutMs,
      validateStatus: () => true,
    });

    if (resp.status < 200 || resp.status >= 300) {
      const detail =
        resp?.data?.error?.message ||
        (typeof resp?.data === 'string' ? resp.data.slice(0, 200) : null);
      const msg = `Claude HTTP ${resp.status} (model: ${model})${detail ? `: ${detail}` : ''}`;
      console.warn('callClaudeCoach error:', msg);
      lastErr = new Error(msg);
      // 401 = bad key — no point retrying other models
      if (resp.status === 401) throw lastErr;
      continue;
    }

    const text = resp?.data?.content?.find?.((c) => c?.type === 'text')?.text || '';
    if (!text || String(text).trim().length === 0) {
      lastErr = new Error(`Claude returned empty response (model: ${model})`);
      continue;
    }
    console.log(`✅ Claude responded using model: ${model}`);
    return String(text);
  }

  throw lastErr || new Error('Claude: all models failed');
}

async function callPerplexityCoach({ apiKey, systemPrompt, messages }) {
  const url = 'https://api.perplexity.ai/chat/completions';
  const payload = {
    model: process.env.PERPLEXITY_MODEL || 'sonar',
    messages: [{ role: 'system', content: systemPrompt }, ...(Array.isArray(messages) ? messages : [])],
    temperature: 0.7,
    max_tokens: 700,
  };

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 20000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const msg =
      resp?.data?.error?.message ||
      resp?.data?.message ||
      (typeof resp?.data === 'string' ? resp.data.slice(0, 300) : null);
    throw new Error(`Perplexity HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }

  const text = resp?.data?.choices?.[0]?.message?.content?.trim?.() || '';
  if (!text) throw new Error('Perplexity returned empty response');
  return text;
}

const WEEKLY_FETCH_FAILURE_NOTE =
  '\n\nNOTE: Weekly data failed to load for this request. Answer from profile only. Do not imply you have access to logs, food data, sleep, steps, or workout history for this conversation.';

async function buildCoachPromptForUser(
  targetUid,
  userProfile,
  lastUserMessage = '',
  coachOptions = {}
) {
  let includeWeekly;
  if (coachOptions.includePersonalData === false) {
    includeWeekly = false;
  } else if (coachOptions.includePersonalData === true && targetUid) {
    includeWeekly = true;
  } else {
    includeWeekly = targetUid
      ? shouldIncludeWeeklyContextInCoachPrompt(lastUserMessage)
      : false;
  }

  let systemPrompt = buildCoachSystemPrompt(userProfile, { generalMode: !includeWeekly });
  let weeklyContext = null;
  let usedWeeklyContext = false;

  if (!targetUid || !includeWeekly) {
    return { systemPrompt, weeklyContext, usedWeeklyContext };
  }

  try {
    const weekly = await getWeeklyContext(targetUid);
    const wc = weekly || {};
    logger.info('buildCoachPromptForUser weekly context keys:', {
      streakData: wc?.streakData,
      hasWorkoutPlan: Boolean(wc?.workoutPlan?.activePlan),
      notesCount: wc?.notesAndFiles?.notes?.length ?? 0,
      trainerDocs: wc?.trainerDocuments?.documents?.length ?? 0,
      wellnessAnalysis: wc?.wellnessAnalysis
        ? {
            hasSteps: Boolean(wc.wellnessAnalysis.steps),
            hasWater: Boolean(wc.wellnessAnalysis.water),
            hasEnergy: Boolean(wc.wellnessAnalysis.energy),
            hasMood: Boolean(wc.wellnessAnalysis.mood),
          }
        : null,
      workoutAvgRPE: wc?.workoutAnalysis?.avgRPE,
    });

    const fatigue = await detectFatigue(targetUid);
    const rawAvgRpe = wc?.workoutAnalysis?.avgRPE;
    const avgRPE =
      rawAvgRpe != null && Number.isFinite(Number(rawAvgRpe)) ? Number(rawAvgRpe) : null;

    weeklyContext = {
      age: wc?.user?.age ?? '?',
      weight: wc?.user?.weight ?? '?',
      height: wc?.user?.height ?? '?',
      goal: wc?.user?.goal ?? 'unknown',
      trainingLevel: wc?.user?.trainingLevel ?? 'unknown',

      targetCal: wc?.macroTargets?.calories ?? 0,
      targetP: wc?.macroTargets?.protein ?? 0,
      targetC: wc?.macroTargets?.carbs ?? 0,
      targetF: wc?.macroTargets?.fat ?? 0,

      avgCal: Math.round(Number(wc?.nutritionAnalysis?.avgDailyCalories) || 0),
      avgP: Math.round(Number(wc?.nutritionAnalysis?.avgProtein) || 0),
      avgC: Math.round(Number(wc?.nutritionAnalysis?.avgCarbs) || 0),
      avgF: Math.round(Number(wc?.nutritionAnalysis?.avgFat) || 0),
      consistency: Number(wc?.nutritionAnalysis?.consistencyScore) || 0,
      daysLogged: Number(wc?.nutritionAnalysis?.dailyBreakdown?.length) || 0,
      totalDaysSinceJoin: Number(wc?.contextMeta?.totalDaysSinceJoin) || 7,
      totalLoggedDaysAllTime: Number(wc?.nutritionAnalysis?.totalLoggedDaysAllTime) || Number(wc?.nutritionAnalysis?.daysLogged) || 0,
      firstLogDate: wc?.nutritionAnalysis?.firstLogDate || null,
      lastLogDate: wc?.nutritionAnalysis?.lastLogDate || null,
      dailyBreakdown: wc?.nutritionAnalysis?.dailyBreakdown || [],

      sessions: Number(wc?.workoutAnalysis?.sessionsLogged) || 0,
      sessionDates: wc?.workoutAnalysis?.sessionDates || [],
      totalVol: Math.round(Number(wc?.workoutAnalysis?.totalVolume) || 0),
      avgRPE,

      avgHours: Math.round((Number(wc?.sleepAnalysis?.avgHours) || 0) * 10) / 10,
      sleepQuality: wc?.sleepAnalysis?.quality || 'unknown',
      isDepleted: wc?.sleepAnalysis?.isDepleted === true,

      weightLog: wc?.weightLog || [],
      streak: Number(wc?.streakData?.currentStreak) || 0,
      weightTrend: wc?.weightTrend || 'unknown',
      volumeTrend: wc?.workoutAnalysis?.volumeTrend || 'stable',
      wellness: wc?.wellnessAnalysis || null,
      workoutPlan: wc?.workoutPlan || null,
      notesAndFiles: wc?.notesAndFiles || null,
      trainerDocuments: wc?.trainerDocuments || null,
    };

    systemPrompt = buildWeeklyContextSystemPrompt(weeklyContext);

    const foodLogJson = weeklyContext.dailyBreakdown || [];
    if (foodLogJson.length) {
      systemPrompt += `\n\n=== VERIFIED_FOOD_LOG_JSON (from app database — cite this; do not ask user to paste) ===\n${JSON.stringify(foodLogJson, null, 2)}\n=== END FOOD LOG ===`;
    }

    usedWeeklyContext = true;

    if (fatigue?.detected) {
      systemPrompt += `\n\nFATIGUE DETECTION:\nDetected: true\nReason: ${fatigue.reason}\nRecommendation: suggest lighter training or a rest day (logRestDay tool if they agree). Do NOT offer deload-week generation.`;
    }
  } catch (e) {
    logger.error(
      'Weekly context fetch failed; continuing with base prompt:',
      e?.message || e
    );
    systemPrompt = buildCoachSystemPrompt(userProfile, { generalMode: false });
    systemPrompt += WEEKLY_FETCH_FAILURE_NOTE;
  }

  return { systemPrompt, weeklyContext, usedWeeklyContext };
}

/** Web-search pipeline: Perplexity (sonar) → Serper snippets + DeepSeek */
async function runCoachWebSearch({
  systemPrompt,
  messages,
  searchQuery,
  lastUserMsg,
  weeklyContext,
  targetUid,
  perplexityKey,
  deepSeekKey,
}) {
  const query = String(searchQuery || '').trim();
  const webSystemPrompt = systemPrompt + WEB_SEARCH_SYSTEM_APPEND;

  if (perplexityKey) {
    try {
      const text = await callPerplexityCoach({
        apiKey: perplexityKey,
        systemPrompt: webSystemPrompt,
        messages,
      });
      const toolCalls = resolveCoachToolCalls(text, lastUserMsg, weeklyContext);
      const reply = stripToolJsonFromReply(text);
      const inputTokens = Math.ceil((webSystemPrompt.length + JSON.stringify(messages).length) / 4);
      const outputTokens = Math.ceil(String(text).length / 4);
      await logAPIUsage('perplexity', targetUid || null, inputTokens, outputTokens, 'web-search');
      return {
        reply,
        toolCalls,
        source: 'perplexity',
        searchedWeb: true,
        webProvider: 'perplexity',
        route: 'web-search',
      };
    } catch (e) {
      console.warn('[web-search] Perplexity failed:', e?.message || e);
    }
  }

  if (deepSeekKey && process.env.SERPER_API_KEY) {
    const augmented = await augmentCoachPromptWithWebSearch(webSystemPrompt, query);
    const response = await callDeepSeek({
      apiKey: deepSeekKey,
      systemPrompt: augmented.prompt,
      messages,
    });
    const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
    const reply = stripToolJsonFromReply(response.text);
    const inputTokens = Math.ceil((augmented.prompt.length + JSON.stringify(messages).length) / 4);
    const outputTokens = Math.ceil(String(response.text).length / 4);
    await logAPIUsage('deepseek', targetUid || null, inputTokens, outputTokens, 'web-search');
    return {
      reply,
      toolCalls,
      source: 'deepseek',
      searchedWeb: augmented.searchedWeb,
      webProvider: augmented.webProvider,
      route: 'web-search',
    };
  }

  const err = new Error(
    'Web search is not available. Set PERPLEXITY_API_KEY or SERPER_API_KEY + DEEPSEEK_API_KEY on the server.'
  );
  err.status = 503;
  throw err;
}

async function handleAICoachRequest(req, res, { forceWebSearch = false } = {}) {
  const started = Date.now();
  const { messages, userProfile, options, userId, query: searchQueryOverride, attachments: rawAttachments } =
    req.body || {};

  const requesterUid = String(req.firebaseAuth?.uid || '').trim();
  const targetUid = String(userId || '').trim();
  if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });
  if (!targetUid) return res.status(400).json({ error: 'userId is required' });
  if (targetUid !== requesterUid) return res.status(403).json({ error: 'Forbidden' });

  const imageAttachments = sanitizeCoachImageAttachments(rawAttachments);
  const hasImages = imageAttachments.length > 0;

  const normalized = normalizeCoachMessages(messages);
  if (normalized.length === 0 && !hasImages) {
    return res.status(400).json({ error: 'messages is required' });
  }

  const webMode = forceWebSearch || hasImages ? 'off' : options?.web || 'auto';
  const lastUserMsg = [...normalized].reverse().find((m) => m.role === 'user')?.content || '';
  if (String(lastUserMsg).length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
  }

  if (targetUid && admin.apps.length) {
    await clearAiCoachDailyUsage(targetUid);
  }

  const { systemPrompt, weeklyContext, usedWeeklyContext } = await buildCoachPromptForUser(
    targetUid,
    userProfile,
    lastUserMsg,
    options || {}
  );

  const deepSeekKey = resolveDeepSeekKey();
  const perplexityKey = resolvePerplexityKey();
  const invokeWeb = !hasImages && shouldInvokeWebSearch(webMode, lastUserMsg);

  const coachMeta = {
    usedWeeklyContext,
    nutritionDaysLogged: weeklyContext?.daysLogged ?? null,
    dailyFoodLogDays: Array.isArray(weeklyContext?.dailyBreakdown)
      ? weeklyContext.dailyBreakdown.length
      : 0,
    analyzedImages: hasImages ? imageAttachments.length : 0,
  };

  if (hasImages) {
    try {
      const response = await runCoachVisionTurn({
        systemPrompt,
        messages: normalized,
        attachments: imageAttachments,
        logAPIUsage,
        targetUid,
      });
      const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
      const reply = stripToolJsonFromReply(response.text);
      return res.json({
        reply,
        toolCalls,
        source: response.source || 'vision',
        searchedWeb: false,
        webProvider: null,
        route: 'vision',
        ...coachMeta,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.warn('Coach vision failed:', e?.message || e);
      return res.status(503).json({
        error: e?.message || 'Photo analysis is unavailable',
        hint: 'Set OPENAI_API_KEY or ANTHROPIC_API_KEY on the server for progress photo analysis.',
        route: 'vision',
        ...coachMeta,
      });
    }
  }

  if (invokeWeb) {
    try {
      const result = await runCoachWebSearch({
        systemPrompt,
        messages: normalized,
        searchQuery: searchQueryOverride || lastUserMsg,
        lastUserMsg,
        weeklyContext,
        targetUid,
        perplexityKey,
        deepSeekKey,
      });
      return res.json({ ...result, ...coachMeta, ms: Date.now() - started });
    } catch (e) {
      if (forceWebSearch) {
        return res.status(e.status || 503).json({
          error: e.message || 'Web search failed',
          route: 'web-search',
          hint: 'Set PERPLEXITY_API_KEY or SERPER_API_KEY + DEEPSEEK_API_KEY in server .env',
        });
      }
      console.warn('Web search failed; falling back to standard coach:', e?.message || e);
    }
  }

  if (deepSeekKey) {
    try {
      const response = await callDeepSeek({
        apiKey: deepSeekKey,
        systemPrompt,
        messages: normalized,
      });
      const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
      const reply = stripToolJsonFromReply(response.text);
      
      // Debug: log what tools were resolved
      if (toolCalls && toolCalls.length > 0) {
        console.log('[DEBUG] toolCalls resolved:', toolCalls.map(t => ({ name: t.name, params: t.params })));
      } else {
        console.log('[DEBUG] No toolCalls from AI response. User message:', lastUserMsg);
        console.log('[DEBUG] AI response preview:', response.text.slice(0, 300));
        
        // AGGRESSIVE FALLBACK: Parse specific numbers from AI response if it mentions actions
        const mentionsAction = /\b(I'm|I'll|I am)\s+(?:also\s+)?(?:going\s+to\s+)?(?:setting?|adjusting?|changing?|resetting?|updating?|logging?)/i.test(response.text);
        const calorieMatch = response.text.match(/(?:set|keep|maintain|adjust).*?(?:calorie[s]?|kcal)[s]?.*?(?:to|at|around)\s+(\d{3,4})\b/i);
        const proteinMatch = response.text.match(/(?:protein|carb|fat).*?(?:to|at|around)\s+(\d+)g?\b/i);
        
        if (mentionsAction && (calorieMatch || proteinMatch)) {
          const calories = calorieMatch ? Number(calorieMatch[1]) : weeklyContext?.targetCal || 2250;
          const protein = proteinMatch ? Number(proteinMatch[1]) : weeklyContext?.targetP || 150;
          
          // Try to extract carbs and fat too
          const carbMatch = response.text.match(/carb[s]?.*?(?:to|at|around)\s+(\d+)g?\b/i);
          const fatMatch = response.text.match(/fat.*?(?:to|at|around)\s+(\d+)g?\b/i);
          
          const carbs = carbMatch ? Number(carbMatch[1]) : weeklyContext?.targetC || 200;
          const fat = fatMatch ? Number(fatMatch[1]) : weeklyContext?.targetF || 65;
          
          if (Number.isFinite(calories) && calories >= 800) {
            console.log('[DEBUG] ✅ EMERGENCY PARSE: Extracted from AI response:', { calories, protein, carbs, fat });
            const inferred = {
              name: 'adjustMacroTargets',
              params: { calories, protein, carbs, fat },
              reasoning: 'AI Coach recommendations',
            };
            toolCalls.push(inferred);
          }
        }
      }
      
      const inputTokens = Math.ceil((systemPrompt.length + JSON.stringify(normalized).length) / 4);
      const outputTokens = Math.ceil(String(response.text).length / 4);
      await logAPIUsage('deepseek', targetUid || null, inputTokens, outputTokens, 'active');
      return res.json({
        reply,
        toolCalls,
        source: 'deepseek',
        searchedWeb: false,
        webProvider: null,
        route: 'chat',
        ...coachMeta,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.warn('DeepSeek failed; falling back to Perplexity if available:', e?.message || e);
    }
  }

  if (perplexityKey) {
    try {
      const response = await callPerplexity({
        apiKey: perplexityKey,
        systemPrompt,
        messages: normalized,
      });
      const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
      const reply = stripToolJsonFromReply(response.text);
      const inputTokens = Math.ceil((systemPrompt.length + JSON.stringify(normalized).length) / 4);
      const outputTokens = Math.ceil(String(response.text).length / 4);
      await logAPIUsage('perplexity', targetUid || null, inputTokens, outputTokens, 'fallback');
      return res.json({
        reply,
        toolCalls,
        source: 'perplexity',
        searchedWeb: true,
        webProvider: 'perplexity',
        route: 'chat',
        ...coachMeta,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.error('Perplexity fallback failed:', e?.message || e);
    }
  }

  const missing = [];
  if (!deepSeekKey) missing.push('DEEPSEEK_API_KEY');
  if (!perplexityKey) missing.push('PERPLEXITY_API_KEY (optional fallback)');
  return res.status(503).json({
    error: 'AI request failed (no providers available)',
    hint:
      missing.length > 0
        ? `Set on Cloud Run → coachconnect-api → Variables: ${missing.join(', ')}. Then redeploy is not required.`
        : 'Check API keys on the server.',
    missingKeys: missing,
  });
}

registerAICoachRoutes(app, {
  verifyFirebaseBearerToken,
  devOnlyRoute,
  handleAICoachRequest,
  executeTool,
  parseToolCalls,
  stripToolJsonFromReply,
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
};

registerNotificationRoutes(app, routeDeps);
registerMediaRoutes(app, routeDeps);
registerUserRoutes(app, routeDeps);
registerSupportRoutes(app, routeDeps);
registerOnboardingRoutes(app, routeDeps);
registerWorkoutRoutes(app, routeDeps);
registerFoodRoutes(app, routeDeps);
registerDevRoutes(app, routeDeps);
registerMarketplaceRoutes(app);

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
function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

let _nutritionReminderUtcDaySent = null;

/**
 * ~1 hour before session start: one Expo push per session (sessionReminderSent).
 * Requires `startAtMs` on session docs (trainer app saves this).
 */
async function runSessionSoonReminderJob() {
  if (!admin.apps.length) return;
  const db = admin.firestore();
  const HOUR_MS = 60 * 60 * 1000;
  const WINDOW_MS = 12 * 60 * 1000;
  const lower = Date.now() + HOUR_MS - WINDOW_MS;
  const upper = Date.now() + HOUR_MS + WINDOW_MS;
  let snap;
  try {
    snap = await db
      .collectionGroup('sessions')
      .where('startAtMs', '>=', lower)
      .where('startAtMs', '<=', upper)
      .limit(120)
      .get();
  } catch (e) {
    console.warn('[sessionSoonReminder] query failed — deploy Firestore index (collectionGroup sessions, startAtMs):', e?.message || e);
    return;
  }

  for (const d of snap.docs) {
    const data = d.data() || {};
    if (data.sessionReminderSent) continue;
    const st = String(data.status || 'pending').toLowerCase();
    if (st === 'cancelled' || st === 'canceled' || st === 'declined') continue;
    const clientId = data.clientId;
    if (!clientId) continue;

    try {
      const u = await db.collection('users').doc(clientId).get();
      if (!u.exists || u.data()?.notificationsEnabled === false) continue;
      const token = u.data()?.expoPushToken || u.data()?.pushToken;

      let coachLabel = 'Your coach';
      if (data.trainerId) {
        const ts = await db.collection('users').doc(String(data.trainerId)).get();
        if (ts.exists) {
          const td = ts.data();
          coachLabel = td?.displayName || td?.name || td?.firstName || coachLabel;
        }
      }

      const bodyTpl = pushPickRandom(PUSH_COPY.sessionSoonBodies || ['Session coming up soon.']);
      const body = pushSub(bodyTpl, { trainerName: coachLabel });
      const ok = await sendExpoPushSingle(token, {
        title: pushSub(pushPickRandom(PUSH_COPY.sessionBookingTitles || ['Session']), {
          trainerName: coachLabel,
        }),
        body,
        data: {
          type: 'session_reminder',
          recipientId: clientId,
          sessionId: d.id,
          trainerId: String(data.trainerId || ''),
          priority: 'low',
        },
      });
      if (ok) {
        await d.ref.set({ sessionReminderSent: true }, { merge: true });
      }
    } catch (e) {
      console.warn('[sessionSoonReminder] doc failed:', d.id, e?.message || e);
    }
  }
}

/** Opt-in daily nutrition nudge (Profile → clients). At most once per UTC day per user. */
async function runNutritionReminderPushJob() {
  if (!admin.apps.length) return;
  if (new Date().getUTCHours() !== 20) return;
  const utcDay = utcDayKey();
  if (_nutritionReminderUtcDaySent === utcDay) return;

  const db = admin.firestore();
  let snap;
  try {
    snap = await db.collection('users').where('nutritionReminderPush', '==', true).limit(400).get();
  } catch (e) {
    console.warn('[nutritionReminderPush]', e?.message || e);
    return;
  }

  for (const doc of snap.docs) {
    const u = doc.data() || {};
    if (u.notificationsEnabled === false) continue;
    if (u.lastNutritionReminderDay === utcDay) continue;
    const token = u.expoPushToken || u.pushToken;
    const coach = 'Your coach';
    const bodyTpl = pushPickRandom(PUSH_COPY.nutritionBodies || ["Time to log today's meals"]);
    const body = pushSub(bodyTpl, { trainerName: coach });
    const ok = await sendExpoPushSingle(token, {
      title: 'Nutrition check-in',
      body,
      data: {
        type: 'nutrition_reminder',
        recipientId: doc.id,
        priority: 'low',
      },
    });
    if (ok) {
      await doc.ref.set({ lastNutritionReminderDay: utcDay }, { merge: true });
    }
  }
  _nutritionReminderUtcDaySent = utcDay;
}

/**
 * Daily workout reminder (remote). Only before 6:00 PM local and only if today's
 * dashboard has no workout log in dailyLogs/{localDateKey}.
 */
async function runWorkoutReminderJob() {
  if (!admin.apps.length) return;
  const db = admin.firestore();
  let snap;
  try {
    snap = await db.collection('users').where('workoutReminder.enabled', '==', true).limit(500).get();
  } catch (e) {
    console.warn('[workoutReminder]', e?.message || e);
    return;
  }

  for (const doc of snap.docs) {
    const u = doc.data() || {};
    const wr = u.workoutReminder || {};
    if (wr.hourLocal == null || wr.minuteLocal == null) continue;
    const tz = wr.timeZone && String(wr.timeZone).trim() ? wr.timeZone : 'UTC';
    const { dateKey, hour, minute } = localDateTimeInIANA(tz);
    if (hour >= 18) continue;

    const rh = Number(wr.hourLocal);
    const rm = Number(wr.minuteLocal);
    if (!Number.isFinite(rh) || !Number.isFinite(rm)) continue;
    if (minutesDiffClock(hour, minute, rh, rm) > 12) continue;

    if (wr.lastWorkoutPushDay === dateKey) continue;
    if (u.notificationsEnabled === false) continue;

    try {
      const logsSnap = await db.collection('users').doc(doc.id).collection('dailyLogs').doc(dateKey).get();
      if (hasDashboardWorkoutLog(logsSnap.data())) continue;

      const token = u.expoPushToken || u.pushToken;
      const body = pushPickRandom(PUSH_COPY.workoutReminders || ['Time to workout!']);
      const ok = await sendExpoPushSingle(token, {
        title: 'CoachConnect',
        body,
        data: { type: 'workout_reminder', recipientId: doc.id, priority: 'low' },
      });
      if (ok) {
        await doc.ref.update({ 'workoutReminder.lastWorkoutPushDay': dateKey });
      }
    } catch (e) {
      console.warn('[workoutReminder] user failed:', doc.id, e?.message || e);
    }
  }
}

registerApiHealthRoute(app, () => {
  const deepseek = !!resolveDeepSeekKey();
  const perplexity = !!resolvePerplexityKey();
  const serper = !!process.env.SERPER_API_KEY;
  const firebaseAdmin = admin.apps.length > 0;
  const anthropic = !!resolveAnthropicKey();
  const openai = !!resolveOpenAIKey();
  return {
    ok: deepseek && firebaseAdmin,
    firebaseAdmin,
    aiCoachLimits: isAiCoachLimitsEnforced() ? 'enforced' : 'off',
    nodeEnv: process.env.NODE_ENV || 'development',
    deepseek,
    anthropic,
    openai,
    coachVisionReady: (openai || anthropic) && firebaseAdmin,
    workoutPlanReady: anthropic && firebaseAdmin,
    perplexity,
    serper,
    usda: !!process.env.USDA_API_KEY,
    youtube: !!(process.env.YOUTUBE_API_KEY || process.env.REACT_NATIVE_YOUTUBE_API_KEY),
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
        : 'OFF — unlimited local dev (production: NODE_ENV=production + AI_COACH_ENFORCE_LIMITS=1)'
    }`
  );
  console.log(`🌐 HTTP endpoints: http://localhost:${PORT}`);
  console.log(`🔐 Serper API: ${process.env.SERPER_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🥬 USDA API: ${process.env.USDA_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  const supportEmailReady =
    !!process.env.RESEND_API_KEY ||
    !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  console.log(
    `📧 Support inbox email: ${supportEmailReady ? '✅ RESEND_API_KEY or SMTP_* set' : '❌ Not configured — Contact Support in the app will fail until you set RESEND_API_KEY or SMTP_*'}`
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

  setInterval(() => {
    runSessionSoonReminderJob().catch((e) => console.warn('[sessionSoonReminder]', e?.message || e));
    runNutritionReminderPushJob().catch((e) => console.warn('[nutritionReminderPush]', e?.message || e));
    runWorkoutReminderJob().catch((e) => console.warn('[workoutReminder]', e?.message || e));
  }, 10 * 60 * 1000);
  setTimeout(() => {
    runSessionSoonReminderJob().catch(() => {});
    runNutritionReminderPushJob().catch(() => {});
    runWorkoutReminderJob().catch(() => {});
  }, 20 * 1000);
    });
  })
  .catch((e) => {
    console.error('Port check failed:', e?.message || e);
    process.exit(1);
  });


