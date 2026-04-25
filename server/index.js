// Simple Express backend to enable web research + OpenAI responses
// Start: npm run server
// Env: OPENAI_API_KEY, optional SERPER_API_KEY
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const axios = require('axios');
const { Groq } = require('groq-sdk');
const multer = require('multer');
const WebSocket = require('ws');
const { normalizeOpenFoodFactsProduct } = require('../src/nutrition/utils/nutritionNormalization');
const { buildRestaurantSearchQuery } = require('./utils/restaurantNutrition');
const OpenAI = require('openai');
const { getWeeklyContext, NotFoundError } = require('./getWeeklyContext');

// Initialize Firebase Admin SDK
try {
  // Try to use service account from environment or file
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.warn('⚠️ Firebase Admin not initialized - notifications will not work:', error.message);
  console.warn('   Add serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT env variable');
}

const foodCache = new Map();
const FOOD_CACHE_TTL = 30 * 1000; // 30 seconds for testing

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
// For file uploads (transcription)
const upload = multer({ storage: multer.memoryStorage() });

// ─────────────────────────────────────────────
// Rate limiting
// ─────────────────────────────────────────────
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
});

const foodSearchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Food search rate limit exceeded.' },
});

app.use(generalLimiter);

// ─────────────────────────────────────────────
// PUSH NOTIFICATION ENDPOINT
// ─────────────────────────────────────────────
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { recipientId, senderName, messageText } = req.body;

    if (!recipientId || !senderName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📲 Push notification request: ${senderName} → ${recipientId}`);
    console.log(`   Message: ${messageText?.substring(0, 50)}...`);

    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      console.warn('⚠️ Firebase Admin not initialized - skipping notification');
      return res.json({ success: false, message: 'Firebase Admin not configured' });
    }

    // Fetch recipient's push token from Firestore
    const db = admin.firestore();
    const recipientDoc = await db.collection('users').doc(recipientId).get();
    
    if (!recipientDoc.exists) {
      console.warn(`⚠️ Recipient ${recipientId} not found in Firestore`);
      return res.json({ success: false, message: 'Recipient not found' });
    }

    const recipientData = recipientDoc.data();
    const pushToken = recipientData?.pushToken;

    if (!pushToken) {
      console.warn(`⚠️ No push token found for ${recipientId}`);
      return res.json({ success: false, message: 'No push token' });
    }

    // Validate push token format
    if (!pushToken.startsWith('ExponentPushToken[') && !pushToken.startsWith('ExpoPushToken[')) {
      console.warn(`⚠️ Invalid push token format for ${recipientId}: ${pushToken.substring(0, 20)}...`);
      return res.json({ success: false, message: 'Invalid push token format' });
    }

    // Check for recent notifications from same sender to handle back-to-back messages
    const now = Date.now();
    const recentNotifRef = db.collection('users').doc(recipientId).collection('recentNotifications').doc(senderName);
    const recentNotifDoc = await recentNotifRef.get();
    
    let notificationTitle = `💬 ${senderName}`;
    let notificationBody = messageText || 'You have a new message';
    let notificationData = { senderId: recipientId, senderName, type: 'message' };
    
    if (recentNotifDoc.exists) {
      const lastNotifTime = recentNotifDoc.data().timestamp?.toMillis?.() || recentNotifDoc.data().timestamp;
      const timeDiff = now - lastNotifTime;
      
      // If last notification was within 10 seconds, treat as back-to-back messages
      if (timeDiff < 10000) {
        const messageCount = recentNotifDoc.data().count || 1;
        notificationTitle = `💬 ${senderName}`;
        notificationBody = `${messageCount + 1} new messages`;
        notificationData = { ...notificationData, messageCount: messageCount + 1, isBackToBack: true };
        console.log(`🔄 Back-to-back messages detected: ${messageCount + 1} messages`);
      }
    }
    
    // Update recent notification tracker
    await recentNotifRef.set({
      timestamp: new Date(now),
      count: (recentNotifDoc.exists() ? recentNotifDoc.data().count || 1 : 1) + 1,
      senderName
    });

    // Send notification via Expo Push API
    const notificationPayload = {
      to: pushToken,
      title: notificationTitle,
      body: notificationBody,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: notificationData,
      // Add interruption level for critical notifications
      interruptionLevel: 'timeSensitive'
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notificationPayload),
    });

    const result = await response.json();
    
    if (result.data && result.data[0]?.status === 'ok') {
      console.log(`✅ Push notification sent successfully to ${recipientId}`);
      res.json({ success: true, message: 'Notification sent' });
    } else {
      console.error('❌ Expo push notification failed:', result);
      res.json({ success: false, message: 'Expo push failed', details: result });
    }
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    res.status(500).json({ error: 'Failed to send notification', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    groq: !!process.env.GROQ_API_KEY,
    deepgram: !!process.env.DEEPGRAM_API_KEY,
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
  });
});

// ─────────────────────────────────────────────
// USER PROFILE (Fix B)
// Mobile app uses this to read `users/<uid>`
// without relying on Expo Go Firestore transport.
// ─────────────────────────────────────────────
async function verifyFirebaseBearerToken(req, res, next) {
  // Declare so we can inspect it in the catch block for diagnostics.
  let token = '';
  try {
    const headerRaw = req.headers.authorization || '';
    const header = String(headerRaw).trim();

    // Accept either:
    // - Authorization: Bearer <token>
    // - Authorization: <token> (raw JWT)
    // Also tolerate accidental "Bearer Bearer <token>" and quoted tokens.
    const match = header.match(/^Bearer\s+(.+)$/i);
    token = match ? match[1] : header;
    token = String(token || '')
      .trim()
      .replace(/^Bearer\s+/i, '')
      .trim();

    // Strip wrapping quotes, if any
    if (
      (token.startsWith('"') && token.endsWith('"')) ||
      (token.startsWith("'") && token.endsWith("'"))
    ) {
      token = token.slice(1, -1).trim();
    }

    if (!token) {
      return res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
    }
    if (!admin.apps.length) {
      return res.status(500).json({ error: 'Firebase Admin not initialized' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.firebaseAuth = decoded;
    return next();
  } catch (e) {
    return res.status(401).json({
      error: 'Invalid or expired token',
      code: e?.code || null,
      name: e?.name || null,
      message: e?.message || null,
    });
  }
}

app.get('/api/me', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const uid = req.firebaseAuth?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const docSnap = await admin.firestore().collection('users').doc(uid).get();
    const data = docSnap.exists ? docSnap.data() : null;

    return res.json({
      exists: !!docSnap.exists,
      user: {
        uid,
        ...(data || {}),
      },
    });
  } catch (e) {
    console.error('GET /api/me failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ─────────────────────────────────────────────
// Weekly Context (7-day aggregation for AI Coach)
// ─────────────────────────────────────────────
app.get('/api/weekly-context/:userId', async (req, res) => {
  const userId = req.params?.userId;
  if (!userId || typeof userId !== 'string' || userId.trim().length < 3) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  try {
    const context = await getWeeklyContext(userId.trim());
    return res.json(context);
  } catch (e) {
    if (e && (e.code === 'not_found' || e.name === 'NotFoundError')) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('GET /api/weekly-context failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch weekly context' });
  }
});

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

app.use('/api/ask', aiLimiter);
app.use('/api/transcribe', aiLimiter);
app.use('/api/ai-coach', aiLimiter);
// app.use('/api', verifyAppSecret); // Temporarily disabled - debugging APP_SECRET issue
app.use('/api/food/search', foodSearchLimiter);
app.use('/api/food/barcode', foodSearchLimiter);

// app.use('/api', verifyAppSecret); // Temporarily disabled for testing

function resolveApiKey(req) {
  // Prefer header to avoid requiring .env for development
  return req.headers['x-openai-key'] || process.env.OPENAI_API_KEY;
}

function resolveDeepSeekKey(req) {
  return req.headers['x-deepseek-key'] || process.env.DEEPSEEK_API_KEY;
}

function resolvePerplexityKey(req) {
  return (
    req.headers['x-perplexity-key'] ||
    process.env.PERPLEXITY_API_KEY ||
    process.env.PPLX_API_KEY
  );
}

function buildToolsAppendix() {
  return (
    `\n\nTOOLS YOU CAN CALL:\n`
    + `When you want to propose an action, append JSON at the END of your response.\n\n`
    + `Format:\n`
    + `{\n`
    + `  "toolCalls": [\n`
    + `    {\n`
    + `      "name": "toolName",\n`
    + `      "params": { "param1": "value1" },\n`
    + `      "reasoning": "Why you're proposing this"\n`
    + `    }\n`
    + `  ]\n`
    + `}\n\n`
    + `Available tools:\n`
    + `1. adjustMacroTargets(protein, carbs, fat, calories)\n`
    + `2. generateDeloadWeek()\n`
    + `3. logNutrition(foodName, quantity)\n`
    + `4. bookSession(trainerId, dateTime)\n`
    + `5. updateGoal(newGoal)\n\n`
    + `User MUST confirm before execution.`
  );
}

function parseToolCalls(text) {
  const raw = String(text || '');
  if (!raw.trim()) return null;

  const lastBrace = raw.lastIndexOf('{');
  if (lastBrace < 0) return null;

  const tail = raw.slice(lastBrace).trim();
  try {
    const obj = JSON.parse(tail);
    const calls = obj?.toolCalls;
    if (!Array.isArray(calls) || calls.length === 0) return null;
    return calls
      .map((c) => ({
        name: typeof c?.name === 'string' ? c.name : null,
        params: c?.params && typeof c.params === 'object' ? c.params : {},
        reasoning: typeof c?.reasoning === 'string' ? c.reasoning : null,
      }))
      .filter((c) => !!c.name);
  } catch (_) {
    return null;
  }
}

function shouldUsePerplexity(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return false;

  const keywords = [
    'trt',
    'testosterone',
    'steroid',
    'steroids',
    'cycle',
    'compound',
    'gear',
    'hormone',
    'hormones',
    'anavar',
    'tren',
    'trenbolone',
    'clen',
    'clenbuterol',
    'dnp',
    'hgh',
    'growth hormone',
    'estrogen',
    'e2',
    'prolactin',
    'pct',
    'clomid',
    'nolvadex',
    'enclomiphene',
  ];

  return keywords.some((k) => t.includes(k));
}

const buildCoachSystemPrompt = (userProfile) => {
  let systemPrompt =
    "You are CoachConnect AI, an expert fitness and nutrition coach.\n\n"
    + "Hard rules:\n"
    + "- Only discuss fitness, exercise, workouts, training, form, mobility, recovery, sleep (only as it relates to training), nutrition, diet, calories/macros, supplements (fitness-related), and habit coaching tied to fitness.\n"
    + "- If the user asks you to \"search the web\" / \"google\" / \"look it up\", treat that as a request to use web context ONLY if the underlying topic is fitness/nutrition. Do not refuse just because the user mentioned the web.\n"
    + "- If the user asks about anything outside those topics (e.g. coding, math homework, general news, relationships, politics, finance, medical diagnosis, legal advice, etc.), do NOT answer it. Respond with exactly:\n"
    + "\"I'm your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?\"\n"
    + "- Keep answers concise, practical, and friendly.";

  if (userProfile && typeof userProfile === 'object') {
    systemPrompt += `\n\nUser profile/context:\n${JSON.stringify(userProfile, null, 2)}`;
  }

  return systemPrompt;
};

/**
 * Build an enhanced AI Coach prompt using real 7-day aggregated data.
 *
 * @param {Object|null} weekly
 * @returns {string}
 */
function buildWeeklyContextSystemPrompt(weekly) {
  const user = weekly?.user || {};
  const targets = weekly?.macroTargets || {};
  const nut = weekly?.nutritionAnalysis || {};
  const wo = weekly?.workoutAnalysis || {};
  const sl = weekly?.sleepAnalysis || {};

  const age = user?.age ?? '?';
  const weight = user?.weight ?? '?';
  const goal = user?.goal ?? 'unknown';
  const targetCal = targets?.calories ?? '?';
  const targetP = targets?.protein ?? '?';
  const targetC = targets?.carbs ?? '?';
  const targetF = targets?.fat ?? '?';

  const avgCal = nut?.avgDailyCalories != null ? Math.round(nut.avgDailyCalories) : '?';
  const avgP = nut?.avgProtein != null ? Math.round(nut.avgProtein) : '?';
  const avgC = nut?.avgCarbs != null ? Math.round(nut.avgCarbs) : '?';
  const avgF = nut?.avgFat != null ? Math.round(nut.avgFat) : '?';
  const consistency = nut?.consistencyScore != null ? nut.consistencyScore : '?';

  const sessions = wo?.sessionsLogged != null ? wo.sessionsLogged : 0;
  const totalVol = wo?.totalVolume != null ? Math.round(wo.totalVolume) : '?';

  const avgHours = sl?.avgHours != null ? Math.round(sl.avgHours * 10) / 10 : '?';
  const depleted = sl?.isDepleted === true;

  return `You are a premium fitness coach with full data visibility.

User: ${age}yo, ${weight}lbs, goal: ${goal}
Targets: ${targetCal} cal, ${targetP}g protein, ${targetC}g carbs, ${targetF}g fat

THIS WEEK'S DATA:
- Nutrition: ${avgCal} cal/day avg (target: ${targetCal}), ${consistency}% consistency
- Protein: ${avgP}g/day (target: ${targetP}g)
- Carbs/Fat: ${avgC}g carbs, ${avgF}g fat (targets: ${targetC}g / ${targetF}g)
- Workouts: ${sessions}/4 logged, ${totalVol} total volume
- Sleep: ${avgHours}h avg (${depleted ? 'DEPLETED' : 'GOOD'})

IMPORTANT: When answering questions, REFERENCE THEIR ACTUAL DATA.
Don't give generic advice. If they ask "why am I stuck", explain using their real numbers.
Example: "You're 80 cal over target AND sleep dropped to 6h—that's killing fat loss."`;
}

function isFitnessNutritionQuery(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return true;

  const fitness = [
    'workout', 'work out', 'training', 'lift', 'lifting', 'gym', 'exercise', 'cardio', 'hiit',
    'strength', 'hypertrophy', 'sets', 'reps', 'pr', 'progressive overload', 'deload',
    'squat', 'bench', 'deadlift', 'press', 'pull-up', 'pull up', 'form', 'technique',
    'mobility', 'stretch', 'warm up', 'cool down', 'recovery', 'soreness',
    'sleep', 'steps', 'heart rate',
    'body recomposition', 'recomposition', 'recomp', 'skinny fat', 'bodyfat', 'body fat', 'bf%',
    'cutting', 'cut', 'bulking', 'bulk', 'lean bulk', 'maintenance', 'caloric deficit', 'calorie deficit',
    'calorie surplus', 'caloric surplus', 'tone up', 'toning', 'fat loss', 'lose fat', 'build muscle',
    'bench press', 'dead lift', 'dead-lift',
  ];
  const nutrition = [
    'nutrition', 'diet', 'calories', 'macro', 'macros', 'protein', 'carbs', 'fat',
    'meal', 'meals', 'meal plan', 'weight loss', 'gain muscle',
    'supplement', 'supplements', 'creatine', 'whey', 'caffeine', 'electrolyte',
    'hydration', 'water', 'fiber',
    'calorie', 'caloric', 'tdee', 'bmr', 'metabolism', 'weigh', 'weigh-in',
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

function shouldUseWebAuto(userText) {
  const raw = String(userText || '');
  const t = raw.toLowerCase();
  if (!t.trim()) return false;

  const keywords = [
    'google',
    'web',
    'search',
    'latest',
    'today',
    'this week',
    'this month',
    '2025',
    '2026',
    'news',
    'update',
    'price',
    'cost',
    'release',
    'version',
    'study',
    'research',
    'meta-analysis',
    'paper',
    'source',
    'cite',
    'link',
    'near me',
    'restaurant',
    'menu',
    'nutrition facts',
    'calories in',
  ];
  if (keywords.some((k) => t.includes(k))) return true;

  const hasNumbers = /\d/.test(t);
  const long = t.length >= 120;
  const hasQuoted = /"[^"]{6,}"/.test(raw);
  return (long && hasNumbers) || hasQuoted;
}

async function getSerperWebContext(userText) {
  const items = await webSearch(userText);
  if (!items || items.length === 0) return null;
  return items.join('\n');
}

async function callOpenAICoach({ apiKey, systemPrompt, messages }) {
  const openai = new OpenAI({ apiKey });
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    temperature: 0.7,
    max_tokens: 700,
  });
  const text = completion?.choices?.[0]?.message?.content?.trim() || '';
  if (!text) throw new Error('OpenAI returned empty response');
  return text;
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

async function callPerplexityCoach({ apiKey, systemPrompt, messages }) {
  const url = 'https://api.perplexity.ai/chat/completions';
  const payload = {
    model: process.env.PERPLEXITY_MODEL || 'sonar',
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
    throw new Error(`Perplexity HTTP ${resp.status}`);
  }

  const text = resp?.data?.choices?.[0]?.message?.content?.trim?.() || '';
  if (!text) throw new Error('Perplexity returned empty response');
  return text;
}

// AI Chat Coach endpoint:
// - Hormone/TRT/etc → Perplexity (routed)
// - Otherwise DeepSeek primary → Perplexity fallback
app.post('/api/ai-coach', async (req, res) => {
  const { messages, userProfile, options, userId } = req.body || {};

  const normalized = normalizeCoachMessages(messages);
  if (normalized.length === 0) {
    return res.status(400).json({ error: 'messages is required' });
  }

  const webMode = options?.web || 'auto'; // 'auto' | 'on' | 'off'
  const lastUserMsg = [...normalized].reverse().find((m) => m.role === 'user')?.content || '';

  // NOTE: Hormone/TRT/etc questions are intentionally routed to Perplexity
  // (even though they're outside fitness/nutrition guardrails).
  const routedToPerplexity = shouldUsePerplexity(lastUserMsg);

  // Guardrail: refuse off-topic prompts without calling providers or web search.
  if (!routedToPerplexity && !isFitnessNutritionQuery(lastUserMsg)) {
    return res.json({
      reply: "I'm your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?",
      source: 'guardrail',
      usedWeb: false,
      webProvider: null,
      webMode: 'off',
    });
  }

  const wantWeb =
    webMode === 'on' ||
    (webMode === 'auto' && shouldUseWebAuto(lastUserMsg));

  // Prefer real weekly context over client-supplied profile (but keep profile as fallback).
  let usedWeeklyContext = false;
  let systemPrompt = buildCoachSystemPrompt(userProfile);
  if (userId && typeof userId === 'string' && userId.trim().length > 0) {
    try {
      const weekly = await getWeeklyContext(userId.trim());
      systemPrompt = buildWeeklyContextSystemPrompt(weekly);
      usedWeeklyContext = true;
    } catch (e) {
      // Non-blocking: if weekly context fails, keep the older prompt.
      console.warn('Weekly context fetch failed; continuing without it:', e?.message || e);
    }
  }
  let usedWeb = false;
  let webProvider = null;

  if (wantWeb && process.env.SERPER_API_KEY) {
    try {
      const webContext = await getSerperWebContext(lastUserMsg);
      if (webContext) {
        usedWeb = true;
        webProvider = 'serper';
        systemPrompt += `\n\nWeb search results (use when relevant; if you use a factual claim from web results, mention the source title/domain briefly):\n${webContext}`;
      }
    } catch (e) {
      console.warn('Serper web context failed:', e?.message || e);
    }
  }

  // Always attach tool-call instructions after any weekly context injection.
  systemPrompt += buildToolsAppendix();

  const deepSeekKey = resolveDeepSeekKey(req);
  const perplexityKey = resolvePerplexityKey(req);

  // 1) Perplexity routing (hormone/TRT/medical)
  if (routedToPerplexity) {
    if (!perplexityKey) {
      return res.status(500).json({ error: 'Perplexity key missing for routed request' });
    }
    try {
      const reply = await callPerplexityCoach({
        apiKey: perplexityKey,
        systemPrompt,
        messages: normalized,
      });
      const toolCalls = parseToolCalls(reply);
      console.log('🧠 /api/ai-coach used: perplexity (routed)');
      return res.json({
        reply,
        toolCalls,
        source: 'perplexity',
        searchedWeb: true,
        usedWeeklyContext,
        // legacy fields (keep for existing clients)
        usedWeb: true,
        webProvider: 'perplexity',
        webMode,
      });
    } catch (err) {
      console.error('Perplexity routed /api/ai-coach failed:', err?.message || err);
      return res.status(500).json({ error: 'AI request failed' });
    }
  }

  // 2) DeepSeek primary (non-routed)
  if (deepSeekKey) {
    try {
      const reply = await callDeepSeekCoach({
        apiKey: deepSeekKey,
        systemPrompt,
        messages: normalized,
      });
      const toolCalls = parseToolCalls(reply);
      console.log('🧠 /api/ai-coach used: deepseek-chat');
      return res.json({
        reply,
        toolCalls,
        source: 'deepseek-chat',
        searchedWeb: false,
        usedWeeklyContext,
        // legacy fields (keep for existing clients)
        usedWeb,
        webProvider,
        webMode,
      });
    } catch (err) {
      console.warn('DeepSeek /api/ai-coach failed, falling back to Perplexity:', err?.message || err);
    }
  } else {
    console.warn('DeepSeek key missing for /api/ai-coach; falling back to Perplexity');
  }

  // 3) Perplexity fallback
  if (!perplexityKey) {
    return res.status(500).json({
      error: 'AI provider unavailable (missing DeepSeek API key and Perplexity API key)',
    });
  }

  try {
    const reply = await callPerplexityCoach({
      apiKey: perplexityKey,
      systemPrompt,
      messages: normalized,
    });
    const toolCalls = parseToolCalls(reply);
    console.log('🧠 /api/ai-coach used: perplexity (fallback)');
    return res.json({
      reply,
      toolCalls,
      source: 'perplexity',
      searchedWeb: true,
      usedWeeklyContext,
      // legacy fields (keep for existing clients)
      usedWeb: webMode === 'off' ? false : true,
      webProvider: webMode === 'off' ? null : 'perplexity',
      webMode,
    });
  } catch (err) {
    console.error('Perplexity /api/ai-coach failed:', err?.message || err);
    return res.status(500).json({ error: 'AI request failed' });
  }
});

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

// Nutrition fallback #3: Serper (Google search) parsing for nutrition facts
const searchFoodWithSerper = async (query) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await axios.post(
      'https://google.serper.dev/search',
      {
        q: `${query} nutrition facts calories protein carbs fat per serving`,
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

    const data = res.data || {};
    const results = [];

    const pushResult = (name, snippet, extras = {}) => {
      const text = String(snippet || '');
      const cals = parseFloat(text.match(/(\d+(?:\.\d+)?)\s*cal/i)?.[1] || 0);
      const protein = parseFloat(text.match(/(\d+(?:\.\d+)?)\s*g\s*protein/i)?.[1] || 0);
      const carbs = parseFloat(text.match(/(\d+(?:\.\d+)?)\s*g\s*carb/i)?.[1] || 0);
      const fat = parseFloat(text.match(/(\d+(?:\.\d+)?)\s*g\s*fat/i)?.[1] || 0);

      if (cals > 0 || protein > 0) {
        results.push({
          id: `serper_${Date.now()}_${Math.random()}`,
          name: name || query,
          brand: 'via Google Search',
          restaurant: null,
          calories: cals,
          protein,
          carbs,
          fat,
          fiber: extras.fiber ?? null,
          sodium: extras.sodium ?? null,
          sugar: extras.sugar ?? null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        });
      }
    };

    // 1. answerBox (featured snippet)
    if (data.answerBox) {
      const box = data.answerBox;
      const title = box.title || query;
      const snippet = box.answer || box.snippet || '';
      pushResult(title, snippet);
    }

    // 2. knowledgeGraph attributes
    if (data.knowledgeGraph?.attributes) {
      const attrs = data.knowledgeGraph.attributes;
      const cleanNum = (v) => parseFloat(String(v || '0').replace(/[^\d.]/g, '') || 0);
      const cals = cleanNum(attrs['Calories'] || attrs['Energy'] || '0');
      const protein = cleanNum(attrs['Protein'] || '0');
      const carbs = cleanNum(attrs['Total Carbohydrate'] || attrs['Carbohydrates'] || '0');
      const fat = cleanNum(attrs['Total Fat'] || attrs['Fat'] || '0');
      const fiber = cleanNum(attrs['Dietary Fiber'] || '0');
      const sodium = cleanNum(attrs['Sodium'] || '0');

      if (cals > 0) {
        results.push({
          id: `serper_${Date.now()}_${Math.random()}`,
          name: data.knowledgeGraph.title || query,
          brand: 'via Google Search',
          restaurant: null,
          calories: cals,
          protein,
          carbs,
          fat,
          fiber: fiber || null,
          sodium: sodium || null,
          sugar: null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        });
      }
    }

    // 3. organic result snippet parsing
    if (results.length === 0 && Array.isArray(data.organic) && data.organic.length > 0) {
      for (const r of data.organic.slice(0, 3)) {
        const text = `${r.title || ''} ${r.snippet || ''}`;
        pushResult(String(r.title || query).split('-')[0].split('|')[0].trim() || query, text);
        if (results.length > 0) break;
      }
    }

    return results;
  } catch (e) {
    console.error('Serper food search error:', e.message);
    return [];
  }
};

// Barcode lookup via Serper when Open Food Facts has no product
const lookupBarcodeWithSerper = async (barcode) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return null;

  try {
    const q = `${barcode} UPC barcode nutrition facts calories per serving`;
    const res = await axios.post(
      'https://google.serper.dev/search',
      { q, num: 5 },
      {
        headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' },
        timeout: 12000,
      }
    );
    const data = res.data || {};
    const parseSnippet = (text) => {
      const t = String(text || '');
      const cals = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*cal/i)?.[1] || 0);
      const protein = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*g\s*protein/i)?.[1] || 0);
      const carbs = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*g\s*carb/i)?.[1] || 0);
      const fat = parseFloat(t.match(/(\d+(?:\.\d+)?)\s*g\s*fat/i)?.[1] || 0);
      return { cals, protein, carbs, fat };
    };
    const num = (v) => (v != null && !Number.isNaN(Number(v))) ? Number(v) : 0;

    // 1. answerBox
    if (data.answerBox) {
      const box = data.answerBox;
      const title = (box.title || `Product ${barcode}`).trim();
      const snippet = box.answer || box.snippet || '';
      const { cals, protein, carbs, fat } = parseSnippet(snippet);
      if (title && (cals > 0 || protein > 0)) {
        return {
          id: `serper_barcode_${barcode}`,
          name: title,
          brand: 'via Google Search',
          restaurant: null,
          calories: cals,
          protein,
          carbs,
          fat,
          fiber: null,
          sodium: null,
          sugar: null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        };
      }
    }

    // 2. knowledgeGraph
    if (data.knowledgeGraph?.title) {
      const kg = data.knowledgeGraph;
      const attrs = kg.attributes || {};
      const cleanNum = (v) => num(parseFloat(String(v || '0').replace(/[^\d.]/g, '')));
      const cals = cleanNum(attrs['Calories'] || attrs['Energy'] || '0');
      const protein = cleanNum(attrs['Protein'] || '0');
      const carbs = cleanNum(attrs['Total Carbohydrate'] || attrs['Carbohydrates'] || '0');
      const fat = cleanNum(attrs['Total Fat'] || attrs['Fat'] || '0');
      if (cals > 0) {
        return {
          id: `serper_barcode_${barcode}`,
          name: kg.title,
          brand: 'via Google Search',
          restaurant: null,
          calories: cals,
          protein,
          carbs,
          fat,
          fiber: null,
          sodium: null,
          sugar: null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        };
      }
    }

    // 3. first organic result with parsed nutrition
    if (Array.isArray(data.organic) && data.organic.length > 0) {
      for (const r of data.organic.slice(0, 3)) {
        const text = `${r.title || ''} ${r.snippet || ''}`;
        const { cals, protein, carbs, fat } = parseSnippet(text);
        const name = (r.title || `Product ${barcode}`).split('-')[0].split('|')[0].trim();
        if (name && (cals > 0 || protein > 0)) {
          return {
            id: `serper_barcode_${barcode}`,
            name,
            brand: 'via Google Search',
            restaurant: null,
            calories: cals,
            protein,
            carbs,
            fat,
            fiber: null,
            sodium: null,
            sugar: null,
            servingSize: 1,
            servingUnit: 'serving',
            servingGrams: 100,
            source: 'serper',
          };
        }
      }
      // return best guess with product name even if we couldn't parse calories
      const first = data.organic[0];
      const name = (first.title || `Product ${barcode}`).split('-')[0].split('|')[0].trim();
      if (name) {
        const text = `${first.title || ''} ${first.snippet || ''}`;
        const { cals, protein, carbs, fat } = parseSnippet(text);
        return {
          id: `serper_barcode_${barcode}`,
          name,
          brand: 'via Google Search',
          restaurant: null,
          calories: cals || 0,
          protein: protein || 0,
          carbs: carbs || 0,
          fat: fat || 0,
          fiber: null,
          sodium: null,
          sugar: null,
          servingSize: 1,
          servingUnit: 'serving',
          servingGrams: 100,
          source: 'serper',
        };
      }
    }
    return null;
  } catch (e) {
    console.warn('Serper barcode lookup failed:', e.message);
    return null;
  }
};

// Barcode fallback: OpenAI infers product + typical nutrition from UPC (last resort; may be approximate)
const lookupBarcodeWithOpenAI = async (barcode) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  try {
    const openai = new OpenAI({ apiKey });
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a nutrition data assistant. Given a product barcode (UPC/EAN), return a JSON object with the product name and typical nutrition for ONE DEFAULT SERVING (e.g. 1 bottle, 1 can, 1 cup cereal). Return only valid JSON, no markdown.
Shape: { "name": "Product Name", "brand": "Brand or null", "calories": number, "protein": number, "carbs": number, "fat": number, "servingGrams": number, "servingUnit": "grams" or "ml" }
Use servingGrams for the typical serving size (e.g. 591 for 20oz bottle in ml, 39 for cereal in g). If you don't know the product, return null.`,
        },
        {
          role: 'user',
          content: `Barcode: ${barcode}. Return JSON only.`,
        },
      ],
      temperature: 0.2,
      max_tokens: 300,
    });
    const text = res?.choices?.[0]?.message?.content?.trim() || '';
    if (!text || text.toLowerCase() === 'null') return null;
    const cleaned = text.replace(/^```json?\s*|\s*```$/g, '').trim();
    const data = JSON.parse(cleaned);
    if (!data || !data.name) return null;
    const num = (v) => (v != null && !Number.isNaN(Number(v))) ? Number(v) : 0;
    const servingGrams = Math.max(1, num(data.servingGrams));
    return {
      id: `openai_barcode_${barcode}`,
      name: data.name,
      brand: data.brand || null,
      restaurant: null,
      calories: num(data.calories),
      protein: num(data.protein),
      carbs: num(data.carbs),
      fat: num(data.fat),
      fiber: null,
      sodium: null,
      sugar: null,
      servingSize: 1,
      servingUnit: data.servingUnit === 'ml' ? 'ml' : 'grams',
      servingGrams,
      source: 'openai',
    };
  } catch (e) {
    console.warn('OpenAI barcode lookup failed:', e.message);
    return null;
  }
};

app.post('/api/ask', async (req, res) => {
  try {
    const { messages, userContext } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Build system prompt with user context
    let systemPrompt = `You are an expert AI fitness and nutrition coach. You only discuss fitness, exercise, workouts, nutrition, diet, and recovery. If asked about anything else respond: 'I'm your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?' Keep responses concise and conversational — they will be spoken out loud.`;

    if (userContext) {
      systemPrompt += `\n\nHere is the user's data: ${JSON.stringify(userContext, null, 2)}`;
    }

    console.log('🤖 Processing /api/ask request');
    console.log('📝 Messages count:', messages.length);
    console.log('👤 User context provided:', !!userContext);

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';

    console.log('✅ Groq response generated');

    res.json({ response });

  } catch (error) {
    console.error('❌ Error in /api/ask:', error);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// Transcription endpoint - Deepgram Nova-2
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audio } = req.body;

    if (!audio) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    console.log('🎤 Processing /api/transcribe request');

    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('audio', Buffer.from(audio, 'base64'), 'audio.webm');
    formData.append('model', 'nova-2');
    formData.append('language', 'en');
    formData.append('smart_format', 'true');

    const response = await axios.post(
      'https://api.deepgram.com/v1/listen',
      formData,
      {
        headers: {
          'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    const transcript = response.data.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';

    console.log('✅ Transcription completed:', transcript.length > 0 ? 'Success' : 'Empty');

    res.json({ transcript });

  } catch (error) {
    console.error('❌ Error in /api/transcribe:', error);
    res.status(500).json({ transcript: '' });
  }
});

// Text-to-Speech endpoint - ElevenLabs Turbo v2
app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('🔊 Processing /api/speak request');

    const response = await axios.post(
      'https://api.elevenlabs.io/v1/text-to-speech/turbo-v2',
      {
        text: text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.75,
        },
      },
      {
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 30000,
      }
    );

    const audioBase64 = Buffer.from(response.data).toString('base64');

    console.log('✅ TTS audio generated');

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBase64);

  } catch (error) {
    console.error('❌ Error in /api/speak:', error);
    res.status(500).json({ error: 'Failed to generate speech' });
  }
});

// Nutrition API endpoints — USDA → Open Food Facts → Serper only (no Nutritionix)
// All return same shape: { id, name, brand, calories, protein, carbs, fat, servingSize, servingUnit, servingGrams, source }

// Simple in-memory cache for food search + barcode (good enough for dev / small scale)
const searchCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

const getCached = (key) => {
  const entry = searchCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return entry.data;
};

const setCache = (key, data) => {
  // Prevent unbounded memory growth
  if (searchCache.size > 500) {
    const firstKey = searchCache.keys().next().value;
    if (firstKey) searchCache.delete(firstKey);
  }
  searchCache.set(key, { data, timestamp: Date.now() });
};

app.get('/api/food/search', async (req, res) => {
  const query = req.query.query?.trim();
  if (!query) return res.status(400).json({ error: 'Query required' });

  // Cache key includes version so ranking tweaks take effect immediately.
  const cacheKey = `v2|${String(query).toLowerCase()}`;
  const cached = foodCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < FOOD_CACHE_TTL) {
    console.log('[Food Search] Cache hit:', query);
    return res.json({ results: cached.data, source: 'cache' });
  }

  let results = null;
  let source = '';
  
  // --- Matching & Ranking (fixes "wrong chain" results) -----------------------
  const KNOWN_BRANDS = [
    'mcdonalds',
    "mcdonald's",
    'burger king',
    "wendy's",
    'wendys',
    'taco bell',
    'pizza hut',
    "domino's",
    'dominos',
    'little caesars',
    "jet's",
    'jets',
    "hungry howie's",
    'hungry howies',
    'coca cola',
    'coca-cola',
    'coke',
    'pepsi',
    'sprite',
    'starbucks',
    'dunkin',
    'subway',
    'chipotle',
    'kfc',
  ];

  const normalizeText = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const queryLower = normalizeText(query);
  const requestedBrand = KNOWN_BRANDS.find((b) => queryLower.includes(normalizeText(b))) || null;

  const queryMeta = {
    hasOz: /\b\d+(\.\d+)?\s*oz\b/.test(queryLower) || /\b\d+(\.\d+)?\s*fl\s*oz\b/.test(queryLower),
    hasMl: /\b\d+\s*ml\b/.test(queryLower),
    hasLarge: /\blarge\b|\blg\b/.test(queryLower),
    hasMedium: /\bmedium\b|\bmed\b/.test(queryLower),
    hasSmall: /\bsmall\b|\bsm\b/.test(queryLower),
    hasDeepDish: /\bdeep\s*dish\b/.test(queryLower),
    hasDetroit: /\bdetroit\b/.test(queryLower),
    pieceCount: (() => {
      const m = queryLower.match(/\b(\d+)\s*(piece|pc|pcs)\b/);
      return m ? Number(m[1]) : null;
    })(),
    ozCount: (() => {
      const m = queryLower.match(/\b(\d+(?:\.\d+)?)\s*(?:fl\s*)?oz\b/);
      return m ? Number(m[1]) : null;
    })(),
  };

  const tokenize = (s) =>
    normalizeText(s)
      .split(' ')
      .filter((w) => w.length > 2 && !['with', 'and', 'from', 'the', 'for', 'nutrition', 'facts', 'calories'].includes(w));

  const queryTokens = tokenize(queryLower);

  const itemText = (item) => {
    const n = normalizeText(item?.food_name || item?.name || '');
    const b = normalizeText(item?.brand_name || item?.brand || '');
    return `${n} ${b}`.trim();
  };

  const findBrandInText = (text) => KNOWN_BRANDS.find((b) => text.includes(normalizeText(b))) || null;

  const sizeScore = (text) => {
    let s = 0;
    if (queryMeta.hasDeepDish && /\bdeep\s*dish\b/.test(text)) s += 8;
    if (queryMeta.hasDetroit && /\bdetroit\b/.test(text)) s += 8;
    if (queryMeta.hasLarge && /\blarge\b|\b14\b|\b16\b/.test(text)) s += 6;
    if (queryMeta.hasMedium && /\bmedium\b|\b12\b/.test(text)) s += 4;
    if (queryMeta.hasSmall && /\bsmall\b|\b10\b/.test(text)) s += 4;
    if (queryMeta.ozCount != null) {
      const oz = queryMeta.ozCount;
      if (new RegExp(`\\b${oz}\\s*(?:fl\\s*)?oz\\b`).test(text)) s += 10;
      // 20oz soda is often represented as ~591ml
      if (oz === 20 && /\b591(\.\d+)?\s*ml\b/.test(text)) s += 10;
    }
    if (queryMeta.pieceCount != null) {
      const pc = queryMeta.pieceCount;
      if (new RegExp(`\\b${pc}\\s*(piece|pc|pcs)\\b`).test(text)) s += 10;
    }
    return s;
  };

  const scoreItem = (item) => {
    const text = itemText(item);
    if (!text) return -999;

    let score = 0;

    // Token overlap
    const hits = queryTokens.filter((t) => text.includes(t)).length;
    score += hits * 4;

    // Brand precision
    if (requestedBrand) {
      const brandNorm = normalizeText(requestedBrand);
      if (text.includes(brandNorm)) score += 40;
      const foundBrand = findBrandInText(text);
      if (foundBrand && normalizeText(foundBrand) !== brandNorm) score -= 60; // wrong chain should not outrank
    }

    // Size / variant matching (20oz, large, deep dish, etc.)
    score += sizeScore(text);

    // Sanity checks (down-rank obvious junk)
    const kcal = Number(item?.nf_calories ?? item?.calories ?? 0);
    if (!Number.isFinite(kcal) || kcal <= 0) score -= 15;
    // For soda queries, penalize water/seltzer
    if ((requestedBrand === 'coke' || requestedBrand === 'coca cola' || requestedBrand === 'coca-cola') && /\bwater\b|\bseltzer\b/.test(text)) {
      score -= 50;
    }

    return score;
  };

  const rankResults = (arr) => {
    const list = Array.isArray(arr) ? arr.slice() : [];
    return list
      .map((it) => ({ it, _score: scoreItem(it) }))
      .sort((a, b) => b._score - a._score)
      .map((x) => x.it);
  };

  const hasGoodMatch = (arr) => {
    const ranked = rankResults(arr);
    if (!ranked.length) return false;
    if (!requestedBrand) return true;
    const topText = itemText(ranked[0]);
    return topText.includes(normalizeText(requestedBrand));
  };

  // TIER 1 — USDA
  let usdaResults = null;
  try {
    console.log('[Food Search] Trying USDA...');
    const r = await fetchWithTimeout(
      `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=10&api_key=${process.env.USDA_API_KEY}`,
      {},
      8000
    );
    if (r.ok) {
      const data = await r.json();
      usdaResults = (data.foods || []).slice(0, 10).map(item => {
        const nutrients = item.foodNutrients || [];
        const get = (id) => nutrients.find(n => n.nutrientId === id)?.value || 0;
        return {
          food_name: item.description,
          brand_name: item.brandOwner || '',
          serving_qty: 1,
          serving_unit: item.servingSize
            ? `${item.servingSize}${item.servingSizeUnit}` 
            : 'serving',
          nf_calories: get(1008),
          nf_protein: get(1003),
          nf_total_carbohydrate: get(1005),
          nf_total_fat: get(1004),
          photo: null,
          source: 'usda'
        };
      });
      
      usdaResults = rankResults(usdaResults);

      if (hasGoodMatch(usdaResults)) {
        results = usdaResults;
        source = 'usda';
        console.log('[Food Search] USDA success with good match:', results.length, 'results');
      } else {
        console.log('[Food Search] USDA found', usdaResults.length, 'results but no good match - will try other sources');
      }
    }
  } catch (e) {
    console.error('[Food Search] USDA failed:', e.message);
  }

  // TIER 2 — Open Food Facts
  console.log('[Food Search] Checking if Open Food Facts needed - current results:', results?.length || 0);
  let offResults = null;
  if (!results || results.length === 0) {
    try {
      console.log('[Food Search] 🥫 Trying Open Food Facts for query:', query);
      const r = await fetchWithTimeout(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=10`,
        {},
        8000
      );
      console.log('[Food Search] 🥫 Open Food Facts response status:', r.status);
      if (r.ok) {
        const data = await r.json();
        console.log('[Food Search] 🥫 Open Food Facts raw data products count:', data.products?.length || 0);
        offResults = (data.products || []).slice(0, 10).map(item => {
          const n = item.nutriments || {};
          return {
            food_name: item.product_name || query,
            brand_name: item.brands || '',
            serving_qty: 1,
            serving_unit: item.serving_size || 'serving',
            nf_calories: n['energy-kcal_serving'] || n['energy-kcal_100g'] || 0,
            nf_protein: n['proteins_serving'] || n['proteins_100g'] || 0,
            nf_total_carbohydrate: n['carbohydrates_serving'] || n['carbohydrates_100g'] || 0,
            nf_total_fat: n['fat_serving'] || n['fat_100g'] || 0,
            photo: item.image_small_url || null,
            source: 'openfoodfacts'
          };
        });
        
        offResults = rankResults(offResults);

        if (hasGoodMatch(offResults)) {
          results = offResults;
          source = 'openfoodfacts';
          console.log('[Food Search] 🥫 Open Food Facts SUCCESS with good match - found', results.length, 'results');
        } else {
          console.log('[Food Search] 🥫 Open Food Facts found', offResults.length, 'results but no good match - will try Serper');
        }
      } else {
        console.log('[Food Search] 🥫 Open Food Facts HTTP error:', r.status);
      }
    } catch (e) {
      console.error('[Food Search] 🥫 Open Food Facts FAILED with error:', e.message);
    }
  } else {
    console.log('[Food Search] 🥫 Open Food Facts NOT needed - already have good match from USDA');
  }

  // TIER 4 — Serper
  // If we have a brand query but top results don't match the brand, go to Serper too.
  const needSerper =
    !results ||
    results.length === 0 ||
    (requestedBrand && results.length > 0 && !itemText(results[0]).includes(normalizeText(requestedBrand)));

  if (needSerper) {
    try {
      console.log('[Food Search] Trying Serper...');
      const r = await fetchWithTimeout(
        'https://google.serper.dev/search',
        {
          method: 'POST',
          headers: {
            'X-API-KEY': process.env.SERPER_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: `${query} calories protein carbs fat nutrition facts`,
            num: 5
          })
        },
        8000
      );
      if (r.ok) {
        const data = await r.json();
        console.log('[Food Search] 🔍 Serper raw data keys:', Object.keys(data));
        console.log('[Food Search] 🔍 Serper answerBox:', data.answerBox ? 'found' : 'not found');
        console.log('[Food Search] 🔍 Serper knowledgeGraph:', data.knowledgeGraph ? 'found' : 'not found');
        console.log('[Food Search] 🔍 Serper organic results count:', data.organic?.length || 0);
        
        const answer = data.answerBox || data.knowledgeGraph;
        if (answer) {
          console.log('[Food Search] 🔍 Serper answer object:', JSON.stringify(answer, null, 2));
          
          // Clean up the title - remove "Calories in" and "Carbs in" prefixes
          let cleanTitle = answer.title || query;
          if (cleanTitle.startsWith('Calories in ')) {
            cleanTitle = cleanTitle.replace('Calories in ', '');
          }
          if (cleanTitle.startsWith('Carbs in ')) {
            cleanTitle = cleanTitle.replace('Carbs in ', '');
          }
          if (cleanTitle.includes(' - CalorieKing')) {
            cleanTitle = cleanTitle.replace(' - CalorieKing', '');
          }
          
          // Extract nutrition from snippet text if available
          const snippet = answer.snippet || '';
          const extractNumber = (text, pattern) => {
            const match = text.match(pattern);
            return match ? parseFloat(match[1]) : 0;
          };
          
          const serperOne = {
            food_name: cleanTitle.trim(),
            brand_name: '',
            serving_qty: 1,
            serving_unit: 'serving',
            nf_calories: parseFloat(answer.calories) || extractNumber(snippet, /(\d+)\s*calories/i) || 0,
            nf_protein: parseFloat(answer.protein) || extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*protein/i) || 0,
            nf_total_carbohydrate: parseFloat(answer.carbohydrates) || parseFloat(answer.carbs) || extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*carb/i) || 0,
            nf_total_fat: parseFloat(answer.fat) || extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*fat/i) || 0,
            photo: null,
            source: 'serper'
          };

          // Merge Serper with existing results (if any) then re-rank.
          const merged = rankResults([serperOne, ...(results || [])]);
          results = merged;
          source = (results?.[0]?.source === 'serper') ? 'serper' : (source || 'mixed');
          console.log('[Food Search] 🔍 Serper extracted nutrition:', serperOne);
        } else {
          console.log('[Food Search] 🔍 Serper - no answerBox or knowledgeGraph found for:', query);
          console.log('[Food Search] 🔍 Serper - first organic result:', data.organic?.[0]?.title);

          // Fallback: use the more robust Serper parsing helper (organic + snippet parsing).
          try {
            const parsed = await searchFoodWithSerper(query);
            if (Array.isArray(parsed) && parsed.length) {
              const merged = rankResults([...(parsed || []), ...(results || [])]);
              results = merged;
              source = (results?.[0]?.source === 'serper') ? 'serper' : (source || 'mixed');
              console.log('[Food Search] 🔍 Serper helper returned', parsed.length, 'items');
            }
          } catch (helperErr) {
            console.warn('[Food Search] Serper helper failed:', helperErr?.message || helperErr);
          }
        }
      }
    } catch (e) {
      console.error('[Food Search] Serper failed:', e.message);
    }
  }

  // Final fallback: if no good matches found, use USDA or OFF results as last resort
  if (!results || results.length === 0) {
    if (usdaResults && usdaResults.length > 0) {
      console.log('[Food Search] No good matches found - falling back to USDA generic results');
      results = usdaResults;
      source = 'usda-fallback';
    } else if (offResults && offResults.length > 0) {
      console.log('[Food Search] No good matches found - falling back to Open Food Facts generic results');
      results = offResults;
      source = 'openfoodfacts-fallback';
    } else {
      console.error('[Food Search] All tiers failed for query:', query);
      return res.status(404).json({ error: 'No results found', query });
    }
  }

  foodCache.set(cacheKey, { data: results, timestamp: Date.now() });
  return res.json({ results, source });
});

app.post('/api/food/barcode', async (req, res) => {
  try {
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    // 1. Open Food Facts with portion normalization (quantity -> default serving, totalCalories computed)
    const cacheKey = `barcode:${barcode}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // Primary lookup
    let result = null;
    try {
      const openFoodFactsUrl = `https://world.openfoodfacts.org/api/v2/product/${barcode}.json`;
      const offResponse = await axios.get(openFoodFactsUrl);

      if (offResponse.data && offResponse.data.product) {
        result = normalizeOpenFoodFactsProduct(offResponse.data.product);
        if (result) console.log('Barcode from OFF:', result.name, 'servingAmount:', result.servingAmount, 'calories:', result.calories);
      }
    } catch (offError) {
      console.warn('OpenFoodFacts barcode lookup failed:', offError.message);
    }

    // Fallback 2: Serper web search for barcode + nutrition
    if (!result && process.env.SERPER_API_KEY) {
      try {
        result = await lookupBarcodeWithSerper(barcode);
        if (result) console.log('Barcode found via Serper:', result.name);
      } catch (serperErr) {
        console.warn('Serper barcode fallback failed:', serperErr.message);
      }
    }

    // Fallback 3: OpenAI infers product + typical nutrition (last resort)
    if (!result && process.env.OPENAI_API_KEY) {
      try {
        result = await lookupBarcodeWithOpenAI(barcode);
        if (result) console.log('Barcode found via OpenAI:', result.name);
      } catch (openaiErr) {
        console.warn('OpenAI barcode fallback failed:', openaiErr.message);
      }
    }

    setCache(cacheKey, result);
    return res.json(result);
  } catch (error) {
    console.error('Barcode lookup error:', error);
    return res.status(500).json({ error: 'Barcode lookup failed' });
  }
});

// Restaurant nutrition: web search + fetch first URL + OpenAI extraction (structured JSON only)
const EXTRACTION_PROMPT = `You are a nutrition data extractor.
Extract exact calories, protein, carbohydrates, fat, and serving description for the specified menu item.
Return ONLY valid JSON.
Do not explain anything.
If data is not found, return null.`;

const RESTAURANT_JSON_SCHEMA = {
  name: 'string',
  calories: 'number',
  protein: 'number',
  carbs: 'number',
  fat: 'number',
  serving_description: 'string',
  source_url: 'string',
};

app.post('/api/nutrition/restaurant', async (req, res) => {
  // Overall timeout for this expensive pipeline (Serper + HTML fetch + OpenAI)
  const routeTimeout = setTimeout(() => {
    if (!res.headersSent) {
      res.status(504).json({ error: 'Restaurant lookup timed out. Try a more specific search.' });
    }
  }, 20000);

  try {
    const { query } = req.body || {};
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ error: 'query is required' });
    }
    const searchQuery = buildRestaurantSearchQuery(query.trim());
    const organics = await serperOrganicSearch(searchQuery, 5);
    const first = organics[0];
    if (!first?.link) {
      return res.json(null);
    }
    let html = '';
    try {
      const pageRes = await axios.get(first.link, {
        responseType: 'text',
        timeout: 10000,
        maxContentLength: 200000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AnatroxNutrition/1.0)' },
        validateStatus: () => true,
      });
      html = typeof pageRes.data === 'string' ? pageRes.data : '';
    } catch (fetchErr) {
      console.warn('Restaurant URL fetch failed:', fetchErr.message);
      return res.json(null);
    }
    if (!html || html.length < 100) {
      return res.json(null);
    }
    const truncated = html.length > 120000 ? html.slice(0, 120000) + '\n...[truncated]' : html;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set, restaurant extraction skipped');
      return res.json(null);
    }
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: EXTRACTION_PROMPT },
        {
          role: 'user',
          content: `Menu item to extract: "${query.trim()}"\n\nExpected JSON schema: ${JSON.stringify(RESTAURANT_JSON_SCHEMA)}\n\nPage content:\n${truncated}`,
        },
      ],
      temperature: 0.1,
      max_tokens: 500,
    });
    const raw = completion?.choices?.[0]?.message?.content?.trim() || '';
    if (!raw || raw.toLowerCase() === 'null') {
      return res.json(null);
    }
    let data = null;
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      data = JSON.parse(cleaned);
    } catch (parseErr) {
      console.warn('Restaurant nutrition JSON parse failed:', parseErr.message);
      return res.json(null);
    }
    if (!data || typeof data !== 'object') {
      return res.json(null);
    }
    const result = {
      name: typeof data.name === 'string' ? data.name : query.trim(),
      calories: typeof data.calories === 'number' ? data.calories : Number(data.calories) || 0,
      protein: typeof data.protein === 'number' ? data.protein : Number(data.protein) || 0,
      carbs: typeof data.carbs === 'number' ? data.carbs : Number(data.carbs) || 0,
      fat: typeof data.fat === 'number' ? data.fat : Number(data.fat) || 0,
      serving_description: typeof data.serving_description === 'string' ? data.serving_description : '',
      source_url: typeof data.source_url === 'string' ? data.source_url : first.link,
    };
    return res.json(result);
  } catch (error) {
    console.error('Restaurant nutrition error:', error?.message || error);
    return res.status(500).json({ error: 'Restaurant nutrition failed' });
  } finally {
    clearTimeout(routeTimeout);
  }
});

app.post('/api/food/usda', async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const usdaUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=20&dataType=Foundation,SR%20Legacy&api_key=${process.env.USDA_API_KEY}`;
    const usdaResponse = await axios.get(usdaUrl);

    if (usdaResponse.data && usdaResponse.data.foods) {
      const results = usdaResponse.data.foods.map(food => ({
        id: food.fdcId || `usda_${Date.now()}_${Math.random()}`,
        name: food.description,
        brand: food.brandOwner || null,
        restaurant: null,
        calories: food.foodNutrients?.find(n => n.nutrientId === 1008)?.value || 0,
        protein: food.foodNutrients?.find(n => n.nutrientId === 1003)?.value || 0,
        carbs: food.foodNutrients?.find(n => n.nutrientId === 1005)?.value || 0,
        fat: food.foodNutrients?.find(n => n.nutrientId === 1004)?.value || 0,
        fiber: food.foodNutrients?.find(n => n.nutrientId === 1079)?.value || null,
        sodium: food.foodNutrients?.find(n => n.nutrientId === 1093)?.value || null,
        sugar: food.foodNutrients?.find(n => n.nutrientId === 2000)?.value || null,
        servingSize: 100,
        servingUnit: 'grams',
        servingGrams: 100,
        source: 'usda'
      }));

      return res.json(results);
    }

    return res.json([]);
  } catch (error) {
    console.error('USDA search error:', error);
    return res.status(500).json({ error: 'USDA search failed' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', serperConfigured: !!process.env.SERPER_API_KEY });
});

// Error logging endpoint - automatically writes errors to ERRORS.txt
app.post('/api/log-error', async (req, res) => {
  try {
    const fs = require('fs');
    const ERROR_LOG_FILE = path.join(__dirname, '..', 'ERRORS.txt');
    
    const errorData = req.body;
    if (!errorData || !errorData.message) {
      return res.status(400).json({ error: 'Invalid error data' });
    }

    // Format timestamp
    const formatTimestamp = (date) => {
      const now = date || new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      return `${dateStr} at ${timeStr}`;
    };

    // Read existing file
    let existingContent = '';
    if (fs.existsSync(ERROR_LOG_FILE)) {
      existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    }

    // Remove "No errors logged yet" if present
    if (existingContent.includes("No errors logged yet")) {
      existingContent = existingContent.split("No errors logged yet")[0];
    }

    // Extract current error count
    const countMatch = existingContent.match(/Total Errors: (\d+)/);
    const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
    const newCount = currentCount + 1;

    // Format error entry
    const now = new Date();
    const readableTime = errorData.readableTime || formatTimestamp(now);
    const timestamp = errorData.timestamp || now.toISOString();
    
    const errorEntry = `================================================================================
ERROR ${newCount}
================================================================================

Message: ${errorData.message || "Unknown error"}
Code: ${errorData.code || "None"}
Context: ${errorData.context || "Unknown"}
Time: ${readableTime}
Timestamp: ${timestamp}
Stack Trace:
${errorData.stack || "No stack trace"}

`;

    // Build new content
    const readableUpdateTime = formatTimestamp(now);
    let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;
    
    // Add new error first
    newContent += errorEntry;

    // Append existing errors
    if (existingContent) {
      const errorsStart = existingContent.indexOf("================================================================================");
      if (errorsStart !== -1) {
        const existingErrors = existingContent.substring(errorsStart);
        newContent += existingErrors;
      }
    }

    // Write to file
    fs.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
    
    res.json({ success: true, message: 'Error logged successfully' });
  } catch (error) {
    console.error('Failed to log error to file:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// Sync queued errors endpoint - syncs multiple errors at once
app.post('/api/sync-errors', async (req, res) => {
  try {
    const fs = require('fs');
    const ERROR_LOG_FILE = path.join(__dirname, '..', 'ERRORS.txt');
    const queuedErrors = req.body.errors || [];
    
    if (queuedErrors.length === 0) {
      return res.json({ success: true, synced: 0 });
    }

    // Format timestamp helper
    const formatTimestamp = (date) => {
      const now = date || new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      return `${dateStr} at ${timeStr}`;
    };

    // Read existing file
    let existingContent = '';
    if (fs.existsSync(ERROR_LOG_FILE)) {
      existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    }

    if (existingContent.includes("No errors logged yet")) {
      existingContent = existingContent.split("No errors logged yet")[0];
    }

    // Get current count
    const countMatch = existingContent.match(/Total Errors: (\d+)/);
    const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
    const newCount = currentCount + queuedErrors.length;

    // Build new content
    const now = new Date();
    const readableUpdateTime = formatTimestamp(now);
    let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;

    // Add all queued errors
    queuedErrors.forEach((errorData, index) => {
      const errorNum = currentCount + index + 1;
      const readableTime = errorData.readableTime || formatTimestamp(new Date(errorData.timestamp || errorData.queuedAt || Date.now()));
      const timestamp = errorData.timestamp || errorData.queuedAt || new Date().toISOString();
      
      newContent += `================================================================================
ERROR ${errorNum}
================================================================================

Message: ${errorData.message || "Unknown error"}
Code: ${errorData.code || "None"}
Context: ${errorData.context || "Unknown"}
Time: ${readableTime}
Timestamp: ${timestamp}
Stack Trace:
${errorData.stack || "No stack trace"}

`;
    });

    // Append existing errors
    if (existingContent) {
      const errorsStart = existingContent.indexOf("================================================================================");
      if (errorsStart !== -1) {
        const existingErrors = existingContent.substring(errorsStart);
        newContent += existingErrors;
      }
    }

    // Write to file
    fs.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
    
    res.json({ success: true, synced: queuedErrors.length });
  } catch (error) {
    console.error('Failed to sync errors:', error);
    res.status(500).json({ error: 'Failed to sync errors' });
  }
});

// ─────────────────────────────────────────────
// ONBOARDING (server-backed to avoid Expo Go Firestore transport)
// ─────────────────────────────────────────────
function normalizeInviteCodeForServer(raw) {
  let s = String(raw || '').trim();
  if (!s) return null;
  // Strip TRAINER prefix (case-insensitive), if user pasted it.
  if (/^trainer/i.test(s)) s = s.replace(/^trainer[\-\s]*/i, '').trim();
  // Remove ALL non-alphanumeric characters, uppercase.
  const cleaned = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  // Must be exactly 6 alphanumeric chars for XXX-XXX format.
  if (cleaned.length !== 6) return null;
  return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
}

app.post('/api/onboarding/check-invite-code', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const code = req.body?.code;
    const normalized = normalizeInviteCodeForServer(code);
    if (!normalized) return res.status(400).json({ error: 'Invalid code format.' });

    const qSnap = await admin
      .firestore()
      .collection('users')
      .where('inviteCode', '==', normalized)
      .limit(1)
      .get();

    return res.json({ exists: !qSnap.empty });
  } catch (e) {
    console.error('POST /api/onboarding/check-invite-code failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to check invite code.' });
  }
});

app.post('/api/onboarding/validate-trainer-code', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const code = req.body?.code;
    const normalized = normalizeInviteCodeForServer(code);
    if (!normalized) return res.status(400).json({ error: 'Invalid code format.' });

    const qSnap = await admin
      .firestore()
      .collection('users')
      .where('inviteCode', '==', normalized)
      .limit(5)
      .get();

    let trainerId = null;
    for (const docSnap of qSnap.docs) {
      const data = docSnap.data() || {};
      if (data?.role === 'trainer') {
        trainerId = docSnap.id;
        break;
      }
    }

    return res.json({ valid: !!trainerId, trainerId });
  } catch (e) {
    console.error('POST /api/onboarding/validate-trainer-code failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to validate trainer code.' });
  }
});

app.post('/api/onboarding/complete', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const uid = req.firebaseAuth?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { finalRole, onboardingData, displayName } = req.body || {};
    const allowedRoles = new Set(['client', 'trainer']);
    const resolvedRole = String(finalRole || onboardingData?.role || 'client');
    if (!allowedRoles.has(resolvedRole)) {
      return res.status(400).json({ error: 'Invalid finalRole.' });
    }

    if (!onboardingData || typeof onboardingData !== 'object') {
      return res.status(400).json({ error: 'Missing onboardingData.' });
    }

    const db = admin.firestore();
    const usersRef = db.collection('users');
    const trainersRef = db.collection('trainers');

    // Check existing user doc to decide whether startingWeight should be set.
    const existingSnap = await usersRef.doc(uid).get();
    const existing = existingSnap.exists ? existingSnap.data() : {};

    const updateData = {
      ...onboardingData,
      role: resolvedRole,
      onboardingCompleted: true,
      onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const weight = onboardingData?.weight;
    if (
      (existing?.startingWeight == null || existing?.startingWeight === '') &&
      weight != null &&
      weight !== ''
    ) {
      updateData.startingWeight = weight;
    }

    await usersRef.doc(uid).set(updateData, { merge: true });

    // Write trainer discovery profile.
    if (resolvedRole === 'trainer') {
      const yearsExperience = onboardingData?.yearsExperience || null;
      const experienceMap = {
        less_than_1: 0,
        '1_2': 2,
        '3_5': 4,
        '6_10': 8,
        '10_plus': 10,
      };
      const experience = experienceMap[yearsExperience] ?? 0;

      const certifications = Array.isArray(onboardingData?.certifications)
        ? onboardingData.certifications
        : onboardingData?.certifications || [];

      const specialties = Array.isArray(onboardingData?.specialties)
        ? onboardingData.specialties
        : onboardingData?.specialties || [];

      const specialty =
        specialties?.[0] ||
        (Array.isArray(onboardingData?.specializations)
          ? onboardingData.specializations?.[0]
          : '') ||
        '';

      const sessionType = onboardingData?.sessionType || 'Both';

      const trainerDocData = {
        uid,
        name:
          onboardingData?.name ||
          onboardingData?.firstName ||
          displayName ||
          'Trainer',
        location: onboardingData?.location || '',
        specialties,
        bio:
          onboardingData?.trainerProfileBio ||
          onboardingData?.bio ||
          onboardingData?.trainingPhilosophy ||
          null,
        certifications,
        rate: onboardingData?.pricing?.perSession || null,
        pricing: onboardingData?.pricing || {},
        yearsExperience,
        experience,
        available: true,
        // Normalize for marketplace cards + profile UI
        specialty,
        price: onboardingData?.pricing?.perMonth ?? onboardingData?.pricing?.perSession ?? null,
        reviewCount: 0,
        rating: 0,
        availability:
          onboardingData?.trainerAvailabilityStatus === 'waitlist' ? 'Waitlist' : 'Available',
        sessionType,
        isRemote: sessionType === 'Remote',
        experienceRange: yearsExperience,
        tags: [],
        credentials: Array.isArray(certifications) ? certifications.join(', ') : certifications || null,
        clients: 0,
        sessions: 0,
        availableDays: [true, true, true, true, true, false, false],
        offerFreeConsultation: onboardingData?.offerFreeConsultation || false,
        flexiblePricingAvailable: onboardingData?.flexiblePricingAvailable || false,
        inviteCode: onboardingData?.inviteCode || null,
        onboardingCompleted: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await trainersRef.doc(uid).set(trainerDocData, { merge: true });
    }

    // Link client to trainer via trainerId (we do it directly with Admin SDK).
    if (resolvedRole === 'client' && onboardingData?.trainerId) {
      const trainerId = String(onboardingData.trainerId);
      const trainerDoc = await usersRef.doc(trainerId).get();
      if (!trainerDoc.exists || trainerDoc.data()?.role !== 'trainer') {
        return res.json({ success: true, linked: false, reason: 'Invalid trainerId' });
      }

      await db
        .collection('trainer_clients')
        .doc(trainerId)
        .collection('clients')
        .doc(uid)
        .set(
          {
            id: uid,
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'active',
          },
          { merge: true }
        );

      await db
        .collection('trainer_client_links')
        .doc(`${trainerId}_${uid}`)
        .set(
          {
            trainerId,
            clientId: uid,
            joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
    }

    return res.json({ success: true, role: resolvedRole });
  } catch (e) {
    console.error('POST /api/onboarding/complete failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to complete onboarding.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    serperConfigured: !!process.env.SERPER_API_KEY,
    openaiConfigured: !!process.env.OPENAI_API_KEY,
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`🚀 Server listening on port ${PORT}`);
  console.log(`🌐 HTTP endpoints: http://localhost:${PORT}`);
  console.log(`🔐 Serper API: ${process.env.SERPER_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🔐 OpenAI API: ${process.env.OPENAI_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`🥬 USDA API: ${process.env.USDA_API_KEY ? '✅ Configured' : '❌ Not configured'}`);
  
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

  // TEMPORARY: List all users to identify test accounts
  app.get('/admin/list-users', async (req, res) => {
    try {
      const auth = admin.auth();
      const listUsers = await auth.listUsers(1000);
      
      const users = listUsers.users.map(user => ({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        createdAt: new Date(user.metadata.creationTime).toLocaleString(),
        lastSignInTime: user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString() : 'Never',
        emailVerified: user.emailVerified
      }));
      
      res.json({ users });
    } catch (error) {
      console.error('Error listing users:', error);
      res.status(500).json({ error: 'Failed to list users' });
    }
  });

  // TEMPORARY: Debug Firestore user doc visibility from this server
  app.get('/admin/firestore-user/:uid', async (req, res) => {
    try {
      const uid = String(req.params?.uid || '').trim();
      if (!uid) return res.status(400).json({ error: 'uid is required' });
      if (!admin.apps.length) return res.status(500).json({ error: 'Firebase Admin not initialized' });

      const db = admin.firestore();
      const snap = await db.collection('users').doc(uid).get();
      return res.json({
        uid,
        exists: snap.exists,
        data: snap.exists ? snap.data() : null,
        projectId: admin.app().options?.projectId || null,
        emulatorHost: process.env.FIRESTORE_EMULATOR_HOST || null,
      });
    } catch (e) {
      console.error('GET /admin/firestore-user failed:', e?.message || e);
      return res.status(500).json({ error: 'Failed to fetch firestore user doc' });
    }
  });

  // TEMPORARY: Delete a user by UID
  app.delete('/admin/delete-user/:uid', async (req, res) => {
    try {
      const { uid } = req.params;
      const auth = admin.auth();
      
      // Delete user from Firebase Auth
      await auth.deleteUser(uid);
      
      // Also delete from Firestore
      const db = admin.firestore();
      await db.collection('users').doc(uid).delete();
      await db.collection('trainers').doc(uid).delete();
      
      console.log(`✅ Deleted user: ${uid}`);
      res.json({ message: `User ${uid} deleted successfully` });
    } catch (error) {
      console.error('Error deleting user:', error);
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  // ─────────────────────────────────────────────
  // LOVABLE API ENDPOINTS - Trainer Management
  // ─────────────────────────────────────────────

  // Get all trainers with filtering and sorting
  app.get('/api/trainers', async (req, res) => {
    try {
      const db = admin.firestore();
      const { 
        page = 1, 
        limit = 10, 
        specialty, 
        minRating, 
        sortBy = 'rating', 
        sortOrder = 'desc',
        search 
      } = req.query;
      
      let trainersQuery = db.collection('trainers').where('available', '==', true);
      
      // Apply filters
      if (specialty) {
        trainersQuery = trainersQuery.where('specialties', 'array-contains', specialty);
      }
      
      if (minRating) {
        trainersQuery = trainersQuery.where('rating', '>=', parseFloat(minRating));
      }
      
      // Execute query
      const snapshot = await trainersQuery.get();
      let trainers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        trainers = trainers.filter(trainer => 
          trainer.name?.toLowerCase().includes(searchLower) ||
          trainer.specialties?.some(s => s.toLowerCase().includes(searchLower)) ||
          trainer.location?.toLowerCase().includes(searchLower)
        );
      }
      
      // Apply sorting
      trainers.sort((a, b) => {
        const aVal = a[sortBy] || 0;
        const bVal = b[sortBy] || 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
      });
      
      // Apply pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedTrainers = trainers.slice(startIndex, endIndex);
      
      res.json({
        trainers: paginatedTrainers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: trainers.length,
          pages: Math.ceil(trainers.length / limit)
        }
      });
    } catch (error) {
      console.error('Error fetching trainers:', error);
      res.status(500).json({ error: 'Failed to fetch trainers' });
    }
  });

  // Get single trainer by ID
  app.get('/api/trainers/:id', async (req, res) => {
    try {
      const db = admin.firestore();
      const trainerDoc = await db.collection('trainers').doc(req.params.id).get();
      
      if (!trainerDoc.exists) {
        return res.status(404).json({ error: 'Trainer not found' });
      }
      
      res.json({
        id: trainerDoc.id,
        ...trainerDoc.data()
      });
    } catch (error) {
      console.error('Error fetching trainer:', error);
      res.status(500).json({ error: 'Failed to fetch trainer' });
    }
  });

  // Create new trainer
  app.post('/api/trainers', async (req, res) => {
    try {
      const db = admin.firestore();
      const trainerData = {
        ...req.body,
        available: true,
        rating: 0,
        reviews: 0,
        clients: 0,
        sessions: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      const trainerRef = await db.collection('trainers').add(trainerData);
      
      res.json({
        id: trainerRef.id,
        ...trainerData
      });
    } catch (error) {
      console.error('Error creating trainer:', error);
      res.status(500).json({ error: 'Failed to create trainer' });
    }
  });

  // Update trainer
  app.put('/api/trainers/:id', async (req, res) => {
    try {
      const db = admin.firestore();
      const trainerRef = db.collection('trainers').doc(req.params.id);
      
      const updateData = {
        ...req.body,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await trainerRef.update(updateData);
      
      const updatedTrainer = await trainerRef.get();
      res.json({
        id: updatedTrainer.id,
        ...updatedTrainer.data()
      });
    } catch (error) {
      console.error('Error updating trainer:', error);
      res.status(500).json({ error: 'Failed to update trainer' });
    }
  });

  // Delete trainer
  app.delete('/api/trainers/:id', async (req, res) => {
    try {
      const db = admin.firestore();
      await db.collection('trainers').doc(req.params.id).delete();
      
      res.json({ message: 'Trainer deleted successfully' });
    } catch (error) {
      console.error('Error deleting trainer:', error);
      res.status(500).json({ error: 'Failed to delete trainer' });
    }
  });

  // Get trainer specialties for filters
  app.get('/api/specialties', async (req, res) => {
    try {
      const db = admin.firestore();
      const snapshot = await db.collection('trainers').get();
      
      const allSpecialties = new Set();
      snapshot.docs.forEach(doc => {
        const specialties = doc.data().specialties || [];
        specialties.forEach(specialty => allSpecialties.add(specialty));
      });
      
      res.json({
        specialties: Array.from(allSpecialties).sort()
      });
    } catch (error) {
      console.error('Error fetching specialties:', error);
      res.status(500).json({ error: 'Failed to fetch specialties' });
    }
  });

  // Sample data endpoint for Lovable testing
  app.get('/api/trainers/sample', (req, res) => {
    res.json({
      trainers: [
        {
          id: "sample1",
          name: "John Smith",
          location: "Detroit, MI",
          specialties: ["strength", "weight_loss"],
          bio: "10 years experience helping clients reach their fitness goals through personalized training programs.",
          rating: 4.8,
          reviews: 25,
          clients: 15,
          sessions: 150,
          certifications: ["NASM", "ACE"],
          yearsExperience: 10,
          rate: 75,
          available: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "sample2",
          name: "Sarah Johnson",
          location: "Los Angeles, CA",
          specialties: ["yoga", "rehabilitation", "senior"],
          bio: "Specializing in gentle yoga and rehabilitation exercises for all ages and fitness levels.",
          rating: 4.9,
          reviews: 42,
          clients: 28,
          sessions: 200,
          certifications: ["Yoga Alliance", "NSCA"],
          yearsExperience: 8,
          rate: 85,
          available: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: "sample3",
          name: "Mike Chen",
          location: "New York, NY",
          specialties: ["crossfit", "powerlifting", "athletic"],
          bio: "Former competitive athlete helping clients achieve peak performance through strength and conditioning.",
          rating: 4.7,
          reviews: 18,
          clients: 12,
          sessions: 89,
          certifications: ["CrossFit Level 3", "NSCA-CSCS"],
          yearsExperience: 6,
          rate: 90,
          available: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ],
      pagination: { page: 1, limit: 10, total: 3, pages: 1 }
    });
  });

  // Sample specialties endpoint
  app.get('/api/specialties/sample', (req, res) => {
    res.json({
      specialties: ["strength", "weight_loss", "yoga", "rehabilitation", "crossfit", "powerlifting", "athletic", "senior", "bodybuilding"]
    });
  });

  console.log('=================================');
  console.log('Server running at:');
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${localIP}:${PORT}`);
  console.log(`  Set EXPO_PUBLIC_API_BASE_URL=http://${localIP}:${PORT} in your .env`);
  console.log('=================================');
  console.log('🔧 Admin endpoints:');
  console.log(`  GET  http://localhost:${PORT}/admin/list-users - List all users`);
  console.log(`  DEL  http://localhost:${PORT}/admin/delete-user/:uid - Delete user by UID`);
  console.log('=================================');
  console.log('🚀 Lovable API endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/trainers - Get all trainers`);
  console.log(`  GET  http://localhost:${PORT}/api/trainers/:id - Get single trainer`);
  console.log(`  POST http://localhost:${PORT}/api/trainers - Create trainer`);
  console.log(`  PUT  http://localhost:${PORT}/api/trainers/:id - Update trainer`);
  console.log(`  DEL  http://localhost:${PORT}/api/trainers/:id - Delete trainer`);
  console.log(`  GET  http://localhost:${PORT}/api/specialties - Get specialties`);
  console.log('=================================');
});


