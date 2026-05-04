// Simple Express backend for fitness app with Claude, DeepSeek, and web search
// Start: npm run server
// Env: ANTHROPIC_API_KEY, DEEPSEEK_API_KEY, optional SERPER_API_KEY
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const axios = require('axios');
const multer = require('multer');
const WebSocket = require('ws');
const { normalizeOpenFoodFactsProduct } = require('../src/nutrition/utils/nutritionNormalization');
const { buildRestaurantSearchQuery } = require('./utils/restaurantNutrition');
const { getWeeklyContext, NotFoundError } = require('./getWeeklyContext');
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
  EMPTY_SEARCH_HINT,
  normalizeSearchKey,
  classifyNutritionSearchMode,
  extractMacrosFromText,
  fixTypoForSerperQuery,
  searchResultsDocId,
} = require('./nutritionSearchHelpers');

/** Bump when search pipeline or caching rules change (invalidates Firestore searchResults format). */
const FOOD_SEARCH_PIPELINE_VERSION = 18;

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
const FOOD_CACHE_TTL = 24 * 60 * 60 * 1000; // 24h in-memory; Firestore searchResults is canonical for repeat lookups

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

function stripToolJsonFromReply(text) {
  const raw = String(text || '');
  if (!raw.trim()) return raw;
  const match = raw.match(/\{[\s\S]*"toolCalls"[\s\S]*\}\s*$/);
  if (!match) return raw.trim();
  return raw.slice(0, match.index).trimEnd();
}

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
    const {
      recipientId,
      senderName,
      messageText,
      senderId: senderIdBody,
      conversationId,
      messageId,
      notificationType: notificationTypeRaw,
    } = req.body;

    const notificationType =
      String(notificationTypeRaw || 'message').trim() || 'message';
    const isChatLike = notificationType === 'message';

    if (!recipientId || !senderName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log(`📲 Push notification request: ${senderName} → ${recipientId} [${notificationType}]`);
    console.log(`   Message: ${messageText?.substring(0, 50)}...`);

    // Check if Firebase Admin is initialized
    if (!admin.apps.length) {
      console.warn('⚠️ Firebase Admin not initialized - skipping notification');
      return res.json({ success: false, message: 'Firebase Admin not configured' });
    }

    const db = admin.firestore();
    const recipientDoc = await db.collection('users').doc(recipientId).get();

    if (!recipientDoc.exists) {
      console.warn(`⚠️ Recipient ${recipientId} not found in Firestore`);
      return res.json({ success: false, message: 'Recipient not found' });
    }

    const recipientData = recipientDoc.data();
    if (recipientData?.notificationsEnabled === false) {
      return res.json({ success: false, message: 'Notifications disabled for user' });
    }

    const expoPushToken = recipientData?.expoPushToken || recipientData?.pushToken;

    if (!expoPushToken) {
      console.warn(`⚠️ No Expo push token found for ${recipientId}`);
      return res.json({ success: false, message: 'No push token' });
    }

    if (!expoPushToken.startsWith('ExponentPushToken[') && !expoPushToken.startsWith('ExpoPushToken[')) {
      console.warn(`⚠️ Invalid Expo push token format for ${recipientId}`);
      return res.json({ success: false, message: 'Invalid push token format' });
    }

    const nowMs = Date.now();
    let notificationTitle = senderName;
    let notificationBody = messageText || (isChatLike ? 'You have a new message' : '');

    let notificationData = {
      type: notificationType,
      recipientId,
      senderId: senderIdBody != null ? String(senderIdBody) : '',
      senderName,
      conversationId: conversationId || '',
      messageId: messageId || '',
    };

    if (isChatLike) {
      const senderKeyRaw = senderIdBody || senderName || 'unknown';
      const senderKey = String(senderKeyRaw).replace(/[/\\]/g, '_').slice(0, 200);
      const recentNotifRef = db
        .collection('users')
        .doc(recipientId)
        .collection('recentNotifications')
        .doc(senderKey);
      const recentSnap = await recentNotifRef.get();
      const prev = recentSnap.exists ? recentSnap.data() : null;

      const prevTs = prev?.timestamp?.toMillis
        ? prev.timestamp.toMillis()
        : typeof prev?.timestamp === 'number'
          ? prev.timestamp
          : 0;
      const timeSincePrev = prevTs ? nowMs - prevTs : Infinity;

      const BURST_MS = 10 * 1000;
      const RESET_MS = 5 * 60 * 1000;

      let burstCount = 1;
      notificationBody = messageText || 'You have a new message';

      if (prev && timeSincePrev < BURST_MS) {
        burstCount = (Number(prev.count) || 1) + 1;
        notificationBody = `${burstCount} new messages`;
        console.log(`🔄 Burst messages from ${senderKey}: ${burstCount}`);
      } else if (prev && timeSincePrev >= RESET_MS) {
        burstCount = 1;
      }

      const titleTpl = pushPickRandom(PUSH_COPY.trainerMessageTitles || []);
      if (titleTpl) {
        notificationTitle = pushSub(titleTpl, { trainerName: senderName });
      }

      notificationData = {
        type: 'message',
        recipientId,
        senderId: senderIdBody || null,
        senderName,
        conversationId: conversationId || '',
        messageId: messageId || '',
      };

      await recentNotifRef.set({
        timestamp: admin.firestore.Timestamp.fromMillis(nowMs),
        count: burstCount,
        senderName,
        senderId: senderIdBody || null,
      });
    }

    const safePushTitle = pushStripNotificationEmoji(notificationTitle) || 'CoachConnect';
    let safePushBody = pushStripNotificationEmoji(notificationBody || '');
    if (!safePushBody) {
      safePushBody = isChatLike ? 'You have a new message' : 'Open CoachConnect';
    }

    const notificationPayload = {
      to: expoPushToken,
      title: safePushTitle,
      body: safePushBody,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      data: Object.fromEntries(
        Object.entries(notificationData).map(([k, v]) => [k, v == null ? '' : String(v)])
      ),
      interruptionLevel: 'active',
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
    // Expo returns either { data: [{ status: 'ok', id }] } (batch) or { data: { status: 'ok', id } } (single).
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    const expoOk = ticket?.status === 'ok';

    if (expoOk) {
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
    deepseek: !!process.env.DEEPSEEK_API_KEY,
    anthropic: !!(
      process.env.ANTHROPIC_API_KEY ||
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY ||
      process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY
    ),
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
// Contact support → email inbox (coachconnect@cc.app by default)
// Requires: RESEND_API_KEY or SMTP_* (see server/supportEmail.js)
// ─────────────────────────────────────────────
const { sendSupportInquiryEmail, buildBodies } = require('./supportEmail');

const supportContactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many support messages. Please try again later.' },
});

app.post('/api/support/contact', supportContactLimiter, verifyFirebaseBearerToken, async (req, res) => {
  try {
    const uid = req.firebaseAuth?.uid;
    const userEmail = req.firebaseAuth?.email || null;
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!subject || subject.length > 200) {
      return res.status(400).json({ error: 'Subject is required (max 200 characters).' });
    }
    if (!message || message.length > 8000) {
      return res.status(400).json({ error: 'Message is required (max 8000 characters).' });
    }

    const { text, html } = buildBodies({ message, userUid: uid, userEmail });
    const emailSubject = `[CoachConnect] ${subject}`;

    await sendSupportInquiryEmail({
      subject: emailSubject,
      text,
      html,
      replyTo: userEmail,
    });

    if (admin.apps.length) {
      try {
        await admin.firestore().collection('supportTickets').add({
          type: 'support',
          subject,
          message,
          userId: uid,
          email: userEmail,
          createdAt: serverTs(),
          delivery: 'email',
        });
      } catch (logErr) {
        console.warn('supportTickets Firestore log failed (email was sent):', logErr?.message || logErr);
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/support/contact failed:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to send support message.' });
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

app.use('/api/ai-coach', aiLimiter);
app.use('/api/ask', aiLimiter);
app.use('/api/food/search', foodSearchLimiter);
app.use('/api/food/barcode', foodSearchLimiter);

// app.use('/api', verifyAppSecret); // Temporarily disabled for testing

function resolveDeepSeekKey(req) {
  return req?.headers?.['x-deepseek-key'] || process.env.DEEPSEEK_API_KEY;
}

function resolveAnthropicKey(req) {
  return (
    req?.headers?.['x-anthropic-key'] ||
    process.env.ANTHROPIC_API_KEY ||
    // Fallbacks (not recommended for production): allow using the same .env key name
    // you may already have for the Expo client.
    process.env.EXPO_PUBLIC_CLAUDE_API_KEY ||
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY
  );
}

function resolvePerplexityKey(req) {
  return (
    req?.headers?.['x-perplexity-key'] ||
    process.env.PERPLEXITY_API_KEY ||
    process.env.PPLX_API_KEY
  );
}

// ─────────────────────────────────────────────
// PROMPTS (must match user spec exactly)
// ─────────────────────────────────────────────
function buildCoachSystemPrompt(userProfile) {
  let systemPrompt =
`You are CoachConnect AI, a premium fitness and nutrition coach. You're not just smart—you're creative, empathetic, and genuinely invested in your clients' progress.

CORE VALUES:
- Be data-driven but conversational (not robotic)
- Match the client's energy and communication style
- Be encouraging without being fake
- Explain the "why" behind your recommendations
- Adapt your tone based on their mood and goals

HARD RULES (DO NOT BREAK):
- Discuss: fitness, exercise, workouts, training, form, mobility, recovery, sleep (only as it relates to training), nutrition, diet, calories/macros, supplements (fitness-related), habit coaching tied to fitness
- ALSO ALLOWED: Greetings ("hi", "hello", "hey"), farewells ("bye", "see you", "catch you later"), and casual social chat that's brief and fitness-adjacent ("How's your week going?" → respond, then pivot to fitness)
- If they ask to "search the web" / "google" for fitness/nutrition topics → treat as web search request (use Perplexity routing if hormone/medical)
- If they ask about non-fitness topics (coding, math, politics, finance, medical diagnosis, legal, relationships, etc.) → respond with:
  "I'm your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?"
- Keep answers concise, practical, and friendly (but not bland)

CREATIVITY & PERSONALITY:
- Use analogies and real-world examples (not generic fitness clichés)
- Celebrate small wins, not just big achievements
- Give context, not just orders ("Here's why this matters...")
- Ask follow-up questions to understand their situation better
- Suggest creative solutions when they hit plateaus (not just "eat more protein")

YOUR SUPERPOWERS (USE THEM):
1. Full Context Visibility: You have access to their nutrition, workouts, sleep, goals, and photos. Reference specific data.
2. Data-Backed Answers: Never guess. If something doesn't add up, explain using their actual numbers.
3. Tool Calling: You can propose actions (adjust macros, log meals, generate deload weeks, book sessions). Always explain WHY first.
4. Web Research: For hormone, TRT, medical questions → I'll search the web for clinical evidence.
5. Proactive Coaching: Don't wait for them to ask. Flag fatigue, celebrate streaks, notice patterns.
6. Weekly Summaries: Every Sunday, I generate a personalized recap + next week's focus.
7. Fatigue Detection: If I see high volume + low sleep, I proactively suggest recovery.

WHEN SUGGESTING CHANGES (Tool Calling):
- Explain the reasoning first
- Propose the change in JSON format at the end of your response
- Always say "This would require your confirmation"
- Format: {"toolCalls": [{"name": "adjustMacroTargets", "params": {...}, "reasoning": "..."}]}
- Example: "You're 22g under protein this week. I'm suggesting we swap 1 bowl of rice for 4oz salmon at dinner. That adds 25g protein and cuts 50g carbs. Confirm?"

TONE GUIDELINES:
- Monday morning: Energetic, motivating ("Let's crush this week")
- Mid-week slump: Supportive, practical ("Here's how to stay on track")
- Weekend: Relaxed, flexible ("Enjoy it, we'll adjust Monday")
- After wins: Genuine celebration ("This is real progress")
- After struggles: Constructive, not judgmental ("Here's what we learned")`;

  if (userProfile && typeof userProfile === 'object') {
    systemPrompt += `\n\nUSER PROFILE:\n${JSON.stringify(userProfile, null, 2)}`;
  }
  return systemPrompt;
}

function buildWeeklyContextSystemPrompt(weeklyContext) {
  const {
    age, weight, height, goal, trainingLevel,
    targetCal, targetP, targetC, targetF,
    avgCal, avgP, avgC, avgF, consistency,
    sessions, totalVol, avgRPE,
    avgHours, sleepQuality, isDepleted,
    streak, weightTrend, volumeTrend,
  } = weeklyContext || {};

  return `You are a PREMIUM fitness coach with full data visibility. Your job is to be smarter, more creative, and more insightful than a generic chatbot.

CLIENT SNAPSHOT:
${age}yo, ${weight}lbs, ${height}" tall | Goal: ${goal} | Level: ${trainingLevel}
Macro Targets: ${targetCal} cal | ${targetP}g protein | ${targetC}g carbs | ${targetF}g fat

═══════════════════════════════════════════
THIS WEEK'S ACTUAL DATA (not assumptions):
═══════════════════════════════════════════

NUTRITION:
- Avg daily: ${avgCal} cal (target: ${targetCal}, gap: ${avgCal - targetCal > 0 ? '+' : ''}${avgCal - targetCal} cal)
- Protein: ${avgP}g/day (target: ${targetP}g, gap: ${avgP - targetP > 0 ? '+' : ''}${avgP - targetP}g)
- Carbs: ${avgC}g/day (target: ${targetC}g)
- Fat: ${avgF}g/day (target: ${targetF}g)
- Consistency: ${consistency}% (days hitting macros)
- Trend: ${avgCal > targetCal ? 'OVER' : avgCal < targetCal ? 'UNDER' : 'ON TARGET'}

TRAINING:
- Sessions logged: ${sessions}/4 this week
- Total volume: ${totalVol} (${volumeTrend})
- Avg RPE: ${avgRPE}/10 (${avgRPE >= 8 ? 'HIGH intensity' : avgRPE >= 6 ? 'MODERATE intensity' : 'LOW intensity'})
- Strength trend: ${volumeTrend}

RECOVERY:
- Sleep: ${avgHours}h/night (target: 7.5h, deficit: ${7.5 - avgHours > 0 ? (7.5 - avgHours).toFixed(1) : 'none'}h)
- Sleep quality: ${sleepQuality} ${isDepleted ? '⚠️ DEPLETED' : '✓ GOOD'}
- Fatigue risk: ${isDepleted && avgRPE >= 8 ? 'HIGH (suggest deload)' : isDepleted ? 'MODERATE' : 'LOW'}

MOTIVATION & STREAKS:
- Current streak: ${streak} days consistent
- Next milestone: ${30 - streak} days until 30-day (unlocks free month)
- Weight trend: ${weightTrend}

═══════════════════════════════════════════
HOW TO USE THIS DATA:
═══════════════════════════════════════════

NEVER give generic advice. ALWAYS reference their numbers:
❌ WRONG: "You need more protein"
✅ RIGHT: "You're averaging ${avgP}g vs ${targetP}g target—that's ${targetP - avgP}g short. Here's why it matters for your goal: [explain using their specific situation]"

SPOT PATTERNS:
- If protein gap + low sleep → Explain recovery impact
- If volume up 20% + sleep down → Suggest deload (proactive coaching)
- If consistency = 86% → Celebrate! Note which meals/days miss target
- If weight trending up on cut → Reference actual nutrition data, don't assume

PROPOSE CHANGES WITH CONFIDENCE:
- Always explain the reasoning with their specific numbers
- Then propose the action (macro adjustment, deload week, meal swap)
- End with: "Confirm? [Yes/No]"
- Use tool calling JSON format

CREATIVITY WITHIN DATA:
- Use metaphors ("Your sleep is like bad wifi for recovery")
- Suggest specific food swaps based on what they've logged before
- Connect their goals to their current reality ("You're on track for your goal IF we nail sleep this week")
- Be honest when things aren't working ("Your volume is up but sleep is down—your body can't adapt both at once")

WEEKLY SUMMARY TONE:
- Celebrate wins (even small ones)
- Be specific about areas to improve
- Propose 1-2 focus areas for next week (not 10 changes)
- End with motivation: "You've got the data, now let's execute"

REMEMBER: You're not a calculator. You're a coach. Use the numbers to tell a story about their week.`;
}

// ─────────────────────────────────────────────
// Tool calling: parse + execute
// ─────────────────────────────────────────────
function parseToolCalls(aiResponse) {
  const raw = String(aiResponse || '');
  if (!raw.trim()) return [];
  const match = raw.match(/\{[\s\S]*"toolCalls"[\s\S]*\}\s*$/);
  if (!match) return [];
  const obj = safeJsonParse(match[0]);
  const calls = obj?.toolCalls;
  if (!Array.isArray(calls)) return [];
  return calls
    .map((c) => ({
      name: typeof c?.name === 'string' ? c.name : null,
      params: c?.params && typeof c.params === 'object' ? c.params : {},
      reasoning: typeof c?.reasoning === 'string' ? c.reasoning : '',
    }))
    .filter((c) => !!c.name);
}

async function executeTool(userId, toolCall) {
  const db = admin.apps.length ? admin.firestore() : null;
  if (!db) return { success: false, message: 'Firestore unavailable (Firebase Admin not initialized)' };
  if (!userId || typeof userId !== 'string') return { success: false, message: 'Invalid userId' };
  const name = toolCall?.name;
  const params = toolCall?.params || {};

  try {
    if (name === 'adjustMacroTargets') {
      const { protein, carbs, fat, calories } = params || {};
      await db
        .collection('users')
        .doc(userId)
        .collection('macroTargets')
        .doc('current')
        .set(
          {
            protein: protein ?? null,
            carbs: carbs ?? null,
            fat: fat ?? null,
            calories: calories ?? null,
            updatedAt: serverTs(),
            updatedBy: 'aiCoach',
          },
          { merge: true }
        );
      return { success: true, message: 'Macros updated' };
    }

    if (name === 'generateDeloadWeek') {
      const currentPlanId = params?.currentPlanId || 'current';
      const planSnap = await db
        .collection('users')
        .doc(userId)
        .collection('workoutPlans')
        .doc(String(currentPlanId))
        .get();
      if (!planSnap.exists) {
        return { success: false, message: 'Current workout plan not found' };
      }
      const plan = planSnap.data() || {};

      const scale = (n, factor) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * factor * 100) / 100 : n);
      const cloneWithDeload = (obj) => {
        if (Array.isArray(obj)) return obj.map(cloneWithDeload);
        if (!obj || typeof obj !== 'object') return obj;
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
          // Heuristic: scale common volume fields
          if (['sets', 'reps', 'totalVolume', 'volume', 'workVolume'].includes(k)) out[k] = scale(v, 0.6);
          else if (k === 'weight' || k === 'load') out[k] = scale(v, 0.6);
          else out[k] = cloneWithDeload(v);
        }
        return out;
      };

      const newId = params?.newPlanId || randomUUID();
      const deloadPlan = {
        ...cloneWithDeload(plan),
        isDeload: true,
        createdAt: serverTs(),
        createdBy: 'aiCoach',
        sourcePlanId: String(currentPlanId),
      };

      await db
        .collection('users')
        .doc(userId)
        .collection('workoutPlans')
        .doc(String(newId))
        .set(deloadPlan, { merge: true });

      return { success: true, message: 'Deload week generated', data: { newPlanId: newId } };
    }

    if (name === 'logNutrition') {
      const foodName = String(params?.foodName || '').trim();
      const quantity = params?.quantity ?? 1;
      if (!foodName) return { success: false, message: 'Missing foodName' };

      // Minimal implementation: use USDA search (first result), treat as 1 serving.
      const apiKey = process.env.USDA_API_KEY;
      if (!apiKey) return { success: false, message: 'USDA_API_KEY not configured' };
      const r = await fetchWithTimeout(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&pageSize=1&api_key=${apiKey}`,
        {},
        8000
      );
      if (!r.ok) return { success: false, message: `USDA lookup failed (HTTP ${r.status})` };
      const data = await r.json();
      const item = (data.foods || [])[0];
      if (!item) return { success: false, message: 'No USDA results found' };
      const nutrients = item.foodNutrients || [];
      const get = (id) => nutrients.find((n) => n.nutrientId === id)?.value || 0;
      const cals = Number(get(1008)) || 0;
      const p = Number(get(1003)) || 0;
      const c = Number(get(1005)) || 0;
      const f = Number(get(1004)) || 0;
      const mult = typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : 1;

      const todayKey = isoDateKey();
      const logRef = db.collection('users').doc(userId).collection('nutritionLogs').doc(todayKey);
      const mealId = randomUUID();

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(logRef);
        const existing = snap.exists ? snap.data() || {} : {};
        const meals = Array.isArray(existing.meals) ? existing.meals.slice() : [];
        meals.push({
          id: mealId,
          foodName: item.description || foodName,
          quantity: mult,
          calories: cals * mult,
          protein: p * mult,
          carbs: c * mult,
          fat: f * mult,
          source: 'usda',
          createdAt: new Date().toISOString(),
        });

        const prevTotals = existing.dayTotals || {};
        const toNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0);
        const nextTotals = {
          calories: toNum(prevTotals.calories) + cals * mult,
          protein: toNum(prevTotals.protein) + p * mult,
          carbs: toNum(prevTotals.carbs) + c * mult,
          fat: toNum(prevTotals.fat) + f * mult,
        };

        tx.set(
          logRef,
          {
            meals,
            dayTotals: nextTotals,
            updatedAt: serverTs(),
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });

      return { success: true, message: 'Logged!' };
    }

    if (name === 'bookSession') {
      const trainerId = String(params?.trainerId || '').trim();
      const dateTime = params?.dateTime;
      if (!trainerId) return { success: false, message: 'Missing trainerId' };
      if (!dateTime) return { success: false, message: 'Missing dateTime' };
      const newId = randomUUID();
      await db
        .collection('users')
        .doc(userId)
        .collection('sessions')
        .doc(newId)
        .set(
          {
            trainerId,
            dateTime,
            status: 'pending',
            createdAt: serverTs(),
            createdBy: 'aiCoach',
          },
          { merge: true }
        );
      return { success: true, message: 'Session booked', data: { sessionId: newId } };
    }

    if (name === 'updateGoal') {
      const newGoal = String(params?.newGoal || '').trim();
      if (!newGoal) return { success: false, message: 'Missing newGoal' };
      await db.collection('users').doc(userId).set({ goal: newGoal, updatedAt: serverTs() }, { merge: true });
      return { success: true, message: `Goal changed to ${newGoal}` };
    }

    return { success: false, message: `Unknown tool: ${name}` };
  } catch (e) {
    console.error(`[executeTool] ${name} failed:`, e?.message || e);
    return { success: false, message: 'Tool execution failed', data: { error: e?.message || String(e) } };
  }
}

// ─────────────────────────────────────────────
// Perplexity routing (hormone / medical web questions)
// ─────────────────────────────────────────────
function shouldUsePerplexity(userMessage) {
  const t = String(userMessage || '').toLowerCase();
  if (!t.trim()) return false;
  const keywords = [
    'hormone', 'trt', 'testosterone', 'inject', 'steroid', 'cycle', 'compound', 'gear', 'pct', 'hcg',
    'anavar', 'test', 'tren', 'nandrolone', 'pharmacology', 'doping', 'sarm', 'sarms',
    'gh', 'growth hormone', 'insulin',
  ];
  return keywords.some((k) => t.includes(k));
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
    max_tokens: 700,
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
  const apiKey =
    process.env.ANTHROPIC_API_KEY ||
    process.env.EXPO_PUBLIC_CLAUDE_API_KEY ||
    process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ||
    '';
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
    const recommendation = detected ? 'generateDeloadWeek' : (lowSleep ? 'rest' : 'none');

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
app.post('/api/ask', async (req, res) => {
  const started = Date.now();
  try {
    const { messages, userContext } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const deepSeekKey = resolveDeepSeekKey(req);
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
    const msg = e?.message || String(e);
    console.error('❌ Error in /api/ask:', msg);
    return res.status(500).json({ error: 'Failed to process request', details: msg });
  }
});

async function callClaudeCoach({ apiKey, systemPrompt, messages }) {
  const url = process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1/messages';

  // Try models in order — same list that already works in workout.js.
  // Env override takes priority; otherwise walk the fallback list.
  const envModel = process.env.CLAUDE_MODEL || process.env.ANTHROPIC_MODEL;
  const modelList = envModel
    ? [envModel]
    : [
        // Claude 4 series (same ones that work in workout.js)
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
      max_tokens: 800,
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
      timeout: 20000,
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
// - DeepSeek primary
// - Perplexity fallback (optional)
app.post('/api/ai-coach', async (req, res) => {
  const started = Date.now();
  const { messages, userProfile, options, userId } = req.body || {};

  const normalized = normalizeCoachMessages(messages);
  if (normalized.length === 0) {
    return res.status(400).json({ error: 'messages is required' });
  }

  const webMode = options?.web || 'auto'; // 'auto' | 'on' | 'off'
  const lastUserMsg = [...normalized].reverse().find((m) => m.role === 'user')?.content || '';

  // Guardrail: refuse off-topic prompts without calling providers.
  if (!isFitnessNutritionQuery(lastUserMsg)) {
    return res.json({
      reply: "I'm your fitness coach — I can only help with fitness and nutrition. What would you like to work on today?",
      source: 'guardrail',
      searchedWeb: false,
      usedWeeklyContext: false,
      toolCalls: [],
      ms: Date.now() - started,
    });
  }

  // Prefer real weekly context over client-supplied profile (but keep profile as fallback).
  let usedWeeklyContext = false;
  let weekly = null;
  let weeklyPrompt = null;
  if (userId && typeof userId === 'string' && userId.trim().length > 0 && admin.apps.length) {
    const limitRes = await enforceDailyMessageLimit(userId.trim(), 10);
    if (!limitRes.allowed) {
      return res.status(429).json({
        error: 'Daily AI Coach limit reached (10/day). Try again tomorrow.',
        remaining: 0,
      });
    }
  }

  // 1) Fetch weekly context and build system prompt
  let systemPrompt = buildCoachSystemPrompt(userProfile);
  if (userId && typeof userId === 'string' && userId.trim().length > 0) {
    try {
      weekly = await getWeeklyContext(userId.trim());
      const wc = weekly || {};
      const fatigue = await detectFatigue(userId.trim());

      const weeklyContext = {
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

        sessions: Number(wc?.workoutAnalysis?.sessionsLogged) || 0,
        totalVol: Math.round(Number(wc?.workoutAnalysis?.totalVolume) || 0),
        avgRPE: Number(wc?.workoutAnalysis?.avgRPE) || 0,

        avgHours: Math.round((Number(wc?.sleepAnalysis?.avgHours) || 0) * 10) / 10,
        sleepQuality: wc?.sleepAnalysis?.quality || 'unknown',
        isDepleted: wc?.sleepAnalysis?.isDepleted === true,

        // These are optional in your current getWeeklyContext implementation; keep safe defaults.
        streak: Number(wc?.streakData?.currentStreak) || 0,
        weightTrend: wc?.weightTrend || wc?.streakData?.weightTrend || 'unknown',
        volumeTrend: wc?.workoutAnalysis?.volumeTrend || 'stable',
      };

      weeklyPrompt = buildWeeklyContextSystemPrompt(weeklyContext);
      systemPrompt = weeklyPrompt;
      usedWeeklyContext = true;

      if (fatigue?.detected) {
        systemPrompt += `\n\nFATIGUE DETECTION:\nDetected: true\nReason: ${fatigue.reason}\nRecommendation: ${fatigue.recommendation}`;
      }
    } catch (e) {
      console.warn('Weekly context fetch failed; continuing without it:', e?.message || e);
    }
  }

  // 2) Decide routing: Perplexity (hormone/medical) vs DeepSeek primary
  const deepSeekKey = resolveDeepSeekKey(req);
  const perplexityKey = resolvePerplexityKey(req);
  const wantPerplexity = webMode !== 'off' && shouldUsePerplexity(lastUserMsg) && !!perplexityKey;

  // 3) Call Perplexity if routed
  if (wantPerplexity) {
    try {
      const response = await callPerplexity({
        apiKey: perplexityKey,
        systemPrompt,
        messages: normalized,
      });
      const toolCalls = parseToolCalls(response.text);
      const reply = stripToolJsonFromReply(response.text);

      const inputTokens = Math.ceil((systemPrompt.length + JSON.stringify(normalized).length) / 4);
      const outputTokens = Math.ceil(String(response.text).length / 4);
      await logAPIUsage('perplexity', userId || null, inputTokens, outputTokens, 'active');

      return res.json({
        reply,
        toolCalls,
        source: 'perplexity',
        searchedWeb: true,
        usedWeeklyContext,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.warn('Perplexity routed request failed; falling back to DeepSeek:', e?.message || e);
    }
  }

  // 4) DeepSeek primary
  if (deepSeekKey) {
    try {
      const response = await callDeepSeek({
        apiKey: deepSeekKey,
        systemPrompt,
        messages: normalized,
      });

      const toolCalls = parseToolCalls(response.text);
      const reply = stripToolJsonFromReply(response.text);

      const inputTokens = Math.ceil((systemPrompt.length + JSON.stringify(normalized).length) / 4);
      const outputTokens = Math.ceil(String(response.text).length / 4);
      await logAPIUsage('deepseek', userId || null, inputTokens, outputTokens, 'active');

      return res.json({
        reply,
        toolCalls,
        source: 'deepseek',
        searchedWeb: false,
        usedWeeklyContext,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.warn('DeepSeek failed; falling back to Perplexity if available:', e?.message || e);
    }
  }

  // 5) Final fallback: Perplexity if DeepSeek fails
  if (perplexityKey) {
    try {
      const response = await callPerplexity({
        apiKey: perplexityKey,
        systemPrompt,
        messages: normalized,
      });
      const toolCalls = parseToolCalls(response.text);
      const reply = stripToolJsonFromReply(response.text);

      const inputTokens = Math.ceil((systemPrompt.length + JSON.stringify(normalized).length) / 4);
      const outputTokens = Math.ceil(String(response.text).length / 4);
      await logAPIUsage('perplexity', userId || null, inputTokens, outputTokens, 'fallback');

      return res.json({
        reply,
        toolCalls,
        source: 'perplexity',
        searchedWeb: true,
        usedWeeklyContext,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.error('Perplexity fallback failed:', e?.message || e);
    }
  }

  return res.status(500).json({ error: 'AI request failed (no providers available)' });
});

// Execute a tool call after user confirmation
app.post('/api/ai-coach/execute-tool', async (req, res) => {
  try {
    const { userId, toolCall, confirmed } = req.body || {};
    if (!confirmed) return res.status(400).json({ error: 'Tool execution requires confirmation' });
    if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'userId is required' });
    if (!toolCall || typeof toolCall !== 'object') return res.status(400).json({ error: 'toolCall is required' });
    const result = await executeTool(userId.trim(), toolCall);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ success: false, message: 'Failed to execute tool', data: { error: e?.message || String(e) } });
  }
});

// Debug endpoints for prompt + tool parsing validation (dev only)
app.get('/api/ai-coach/debug/prompts', async (req, res) => {
  try {
    const userId = String(req.query?.userId || '').trim();
    const userProfileRaw = req.query?.userProfile;
    const userProfile =
      typeof userProfileRaw === 'string' && userProfileRaw.trim()
        ? safeJsonParse(userProfileRaw)
        : null;

    const basePrompt = buildCoachSystemPrompt(userProfile && typeof userProfile === 'object' ? userProfile : null);

    let weeklyPrompt = null;
    if (userId) {
      try {
        const wc = await getWeeklyContext(userId);
        const weeklyContext = {
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
          sessions: Number(wc?.workoutAnalysis?.sessionsLogged) || 0,
          totalVol: Math.round(Number(wc?.workoutAnalysis?.totalVolume) || 0),
          avgRPE: Number(wc?.workoutAnalysis?.avgRPE) || 0,
          avgHours: Math.round((Number(wc?.sleepAnalysis?.avgHours) || 0) * 10) / 10,
          sleepQuality: wc?.sleepAnalysis?.quality || 'unknown',
          isDepleted: wc?.sleepAnalysis?.isDepleted === true,
          streak: Number(wc?.streakData?.currentStreak) || 0,
          weightTrend: wc?.weightTrend || 'unknown',
          volumeTrend: wc?.workoutAnalysis?.volumeTrend || 'stable',
        };
        weeklyPrompt = buildWeeklyContextSystemPrompt(weeklyContext);
      } catch (e) {
        weeklyPrompt = null;
      }
    }

    return res.json({ basePrompt, weeklyPrompt });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to build prompts', details: e?.message || String(e) });
  }
});

app.post('/api/ai-coach/debug/parse-toolcalls', (req, res) => {
  try {
    const text = String(req.body?.text || '');
    const toolCalls = parseToolCalls(text);
    const reply = stripToolJsonFromReply(text);
    return res.json({ toolCalls, reply });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to parse toolcalls', details: e?.message || String(e) });
  }
});

// Optional: Expose fatigue detection for debugging
app.get('/api/fatigue/:userId', async (req, res) => {
  try {
    const userId = String(req.params?.userId || '').trim();
    if (!userId) return res.status(400).json({ error: 'Invalid userId' });
    const result = await detectFatigue(userId);
    return res.json(result);
  } catch (e) {
    return res.status(500).json({ error: 'Fatigue detection failed', details: e?.message || String(e) });
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

  return { processed };
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

const TEST_CASES = [
  {
    id: 'weight_loss_stall',
    prompt: "Why am I not losing weight? I'm eating 2000 cal, hitting 160g protein, but sleep is 6h and I missed leg day.",
    category: 'data-backed-advice'
  },
  {
    id: 'macro_adjustment',
    prompt: "I want to increase my macros. Adjust my targets.",
    category: 'tool-calling'
  },
  {
    id: 'supplement_advice',
    prompt: "What's the best supplement for fat loss?",
    category: 'supplement-advice'
  },
  {
    id: 'trt_question',
    prompt: "My trainee just asked if TRT is worth it",
    category: 'sensitive-topic'
  }
];

/**
 * Test a single API (DeepSeek or Claude) against all test cases
 */
async function runSingleAPITest(apiName, testCases) {
  const { estimateCost } = require('./config/apiCosts');
  const results = [];
  
  const resolveKeyDirect = (name) => {
    if (name === 'claude' || name === 'anthropic') {
      return (
        process.env.ANTHROPIC_API_KEY ||
        process.env.EXPO_PUBLIC_CLAUDE_API_KEY ||
        process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ||
        ''
      ).trim();
    }
    if (name === 'deepseek') {
      return (process.env.DEEPSEEK_API_KEY || '').trim();
    }
    return '';
  };

  const withTimeout = async (promise, ms, label) => {
    let t;
    const timeout = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms${label ? ` (${label})` : ''}`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(t);
    }
  };

  for (const testCase of testCases) {
    const startTime = Date.now();
    const testResult = {
      prompt: testCase.prompt,
      category: testCase.category,
      startTime: new Date().toISOString(),
      apiName,
      response: null,
      speed_ms: 0,
      tokens: { input: 0, output: 0 },
      cost: '$0.00',
      cost_usd: 0,
      quality_score: null,
      toolCalls: [],
      error: null,
    };

    try {
      // Build system prompt
      const systemPrompt = `You are a premium fitness coach with data visibility and can use tools.
Your response should be:
- Specific to the user's data
- Data-backed with reasoning
- Practical and actionable
- Friendly but professional`;

      const messages = [{ role: 'user', content: testCase.prompt }];
      let response = null;
      let inputTokens = 0;
      let outputTokens = 0;

      if (apiName === 'claude') {
        const key = resolveKeyDirect('claude');
        if (!key) throw new Error('Missing Claude key (ANTHROPIC_API_KEY or EXPO_PUBLIC_CLAUDE_API_KEY)');
        response = await withTimeout(
          callClaudeCoach({ apiKey: key, systemPrompt, messages }),
          30_000,
          'claude'
        );
        // Rough token estimation (Claude): ~4 chars per token
        inputTokens = Math.ceil((systemPrompt.length + testCase.prompt.length) / 4);
        outputTokens = Math.ceil(response.length / 4);
      } else if (apiName === 'deepseek') {
        const key = resolveKeyDirect('deepseek');
        if (!key) throw new Error('Missing DeepSeek key (DEEPSEEK_API_KEY)');
        response = await withTimeout(
          callDeepSeekCoach({ apiKey: key, systemPrompt, messages }),
          30_000,
          'deepseek'
        );
        // Rough token estimation (DeepSeek): ~4 chars per token
        inputTokens = Math.ceil((systemPrompt.length + testCase.prompt.length) / 4);
        outputTokens = Math.ceil(response.length / 4);
      }

      testResult.response = response;
      testResult.speed_ms = Date.now() - startTime;
      testResult.tokens = { input: inputTokens, output: outputTokens };
      
      // Calculate cost
      const pricingApiName = apiName === 'claude' ? 'anthropic' : apiName;
      const cost = estimateCost(pricingApiName, inputTokens, outputTokens);
      testResult.cost = `$${cost.toFixed(4)}`;
      testResult.cost_usd = Number.isFinite(cost) ? cost : 0;

      // Parse tool calls if any
      testResult.toolCalls = parseToolCalls(response) || [];

      // Quick quality scoring (1-10 scale, subjective)
      // Check for data-backed answers, specificity, fitness relevance
      const qualityFactors = {
        length: response.length > 150 ? 2 : 1,
        specificity: /\d+/.test(response) ? 2 : 1, // has numbers
        fitnessFocus: isFitnessNutritionQuery(response) ? 2 : 0,
        actionable: /you should|try|consider|increase|decrease|adjust/.test(response.toLowerCase()) ? 2 : 1,
        dataRef: /protein|calorie|sleep|volume|kg|lb|gram/.test(response.toLowerCase()) ? 1 : 0,
      };
      testResult.quality_score = Math.min(10, Object.values(qualityFactors).reduce((a, b) => a + b, 0));

      console.log(`[${new Date().toISOString()}] ✅ Test '${testCase.id}' (${apiName}): ${testResult.speed_ms}ms, Quality: ${testResult.quality_score}/10`);
    } catch (error) {
      testResult.error = error?.message || String(error);
      testResult.quality_score = 0;
      testResult.cost = '$0.00';
      testResult.cost_usd = 0;
      console.error(`[${new Date().toISOString()}] ❌ Test '${testCase.id}' (${apiName}) failed:`, testResult.error);
    }

    results.push(testResult);
  }

  return results;
}

/**
 * GET /api/test-deepseek - Test DeepSeek alone
 */
app.get('/api/test-deepseek', async (req, res) => {
  console.log('🧪 Starting DeepSeek test suite...');
  const startTime = Date.now();

  try {
    const deepseekResults = await runSingleAPITest('deepseek', TEST_CASES);
    const elapsed = Date.now() - startTime;

    return res.json({
      timestamp: new Date().toISOString(),
      apiTested: 'deepseek',
      totalTime_ms: elapsed,
      testCount: TEST_CASES.length,
      results: deepseekResults,
      avgQuality: (deepseekResults.reduce((sum, r) => sum + (r.quality_score || 0), 0) / deepseekResults.length).toFixed(1),
      totalCost: `$${deepseekResults.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0).toFixed(4)}`,
    });
  } catch (error) {
    console.error('❌ DeepSeek test suite failed:', error);
    return res.status(500).json({
      error: 'Test suite failed',
      details: error?.message || String(error),
    });
  }
});

/**
 * GET /api/test-deepseek-vs-claude - Compare both APIs
 */
app.get('/api/test-deepseek-vs-claude', async (req, res) => {
  console.log('🧪 Starting DeepSeek vs Claude comparison...');
  const startTime = Date.now();

  try {
    // Run tests in parallel for faster comparison
    const [deepseekResults, claudeResults] = await Promise.all([
      runSingleAPITest('deepseek', TEST_CASES),
      runSingleAPITest('claude', TEST_CASES),
    ]);

    const elapsed = Date.now() - startTime;

    // Build comparison results
    const testCases = [];
    for (let i = 0; i < TEST_CASES.length; i++) {
      const deepseekResult = deepseekResults[i];
      const claudeResult = claudeResults[i];
      const { estimateCost } = require('./config/apiCosts');

      // Determine winners for each metric
      const speedWinner = deepseekResult.speed_ms < claudeResult.speed_ms ? 'deepseek' : 'claude';
      const costWinner = parseFloat(deepseekResult.cost) < parseFloat(claudeResult.cost) ? 'deepseek' : 'claude';
      const qualityWinner = (claudeResult.quality_score || 0) > (deepseekResult.quality_score || 0) ? 'claude' : 'deepseek';

      testCases.push({
        prompt: TEST_CASES[i].prompt,
        category: TEST_CASES[i].category,
        deepseek: {
          response: deepseekResult.response?.substring(0, 200) + '...',
          speed_ms: deepseekResult.speed_ms,
          tokens: deepseekResult.tokens,
          cost: deepseekResult.cost,
          quality_score: deepseekResult.quality_score,
          toolCalls: deepseekResult.toolCalls,
        },
        claude: {
          response: claudeResult.response?.substring(0, 200) + '...',
          speed_ms: claudeResult.speed_ms,
          tokens: claudeResult.tokens,
          cost: claudeResult.cost,
          quality_score: claudeResult.quality_score,
          toolCalls: claudeResult.toolCalls,
        },
        winner: {
          speed: speedWinner,
          cost: costWinner,
          quality: qualityWinner,
        },
      });
    }

    // Calculate summary statistics
    const deepseekAvgQuality = (deepseekResults.reduce((sum, r) => sum + (r.quality_score || 0), 0) / deepseekResults.length).toFixed(1);
    const claudeAvgQuality = (claudeResults.reduce((sum, r) => sum + (r.quality_score || 0), 0) / claudeResults.length).toFixed(1);
    const deepseekTotalCost = Number((deepseekResults.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)).toFixed(6));
    const claudeTotalCost = Number((claudeResults.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)).toFixed(6));
    const costSavings =
      claudeTotalCost > 0
        ? (((claudeTotalCost - deepseekTotalCost) / claudeTotalCost) * 100).toFixed(1)
        : null;
    const qualityDiff =
      Number(claudeAvgQuality) > 0
        ? (((Number(claudeAvgQuality) - Number(deepseekAvgQuality)) / Number(claudeAvgQuality)) * 100).toFixed(1)
        : null;

    const recommendation =
      claudeTotalCost > 0 && deepseekTotalCost < claudeTotalCost && Number(deepseekAvgQuality) >= 7.5
        ? `DeepSeek is ${costSavings}% cheaper and quality is comparable (${deepseekAvgQuality}/10 vs ${claudeAvgQuality}/10).`
        : claudeTotalCost > 0
          ? `Claude quality: ${claudeAvgQuality}/10 vs DeepSeek: ${deepseekAvgQuality}/10. Cost DeepSeek: $${(deepseekTotalCost / TEST_CASES.length).toFixed(6)} per test vs Claude: $${(claudeTotalCost / TEST_CASES.length).toFixed(6)} per test.`
          : `Claude cost could not be estimated; verify pricing config and re-run.`;

    return res.json({
      timestamp: new Date().toISOString(),
      totalTime_ms: elapsed,
      testCasesCount: TEST_CASES.length,
      testCases,
      summary: {
        deepseek: {
          avgQuality: parseFloat(deepseekAvgQuality),
          totalCost: `$${deepseekTotalCost.toFixed(6)}`,
          costPerTest: `$${(deepseekTotalCost / TEST_CASES.length).toFixed(6)}`,
          avgSpeed_ms: Math.round(deepseekResults.reduce((sum, r) => sum + r.speed_ms, 0) / deepseekResults.length),
        },
        claude: {
          avgQuality: parseFloat(claudeAvgQuality),
          totalCost: `$${claudeTotalCost.toFixed(6)}`,
          costPerTest: `$${(claudeTotalCost / TEST_CASES.length).toFixed(6)}`,
          avgSpeed_ms: Math.round(claudeResults.reduce((sum, r) => sum + r.speed_ms, 0) / claudeResults.length),
        },
        costSavings: costSavings == null ? null : `${costSavings}%`,
        qualityDifference: qualityDiff == null ? null : `${qualityDiff}%`,
        recommendation,
      },
    });
  } catch (error) {
    console.error('❌ Comparison test failed:', error);
    return res.status(500).json({
      error: 'Comparison test failed',
      details: error?.message || String(error),
    });
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
const searchFoodWithSerper = async (rawQuery) => {
  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return [];

  const query = fixTypoForSerperQuery(rawQuery);

  const toSerperRow = (name, macros, extras = {}) => {
    const serving_label = extras.serving_label ?? macros.servingLabel ?? null;
    const unitLabel = serving_label || extras.serving_unit || 'serving';
    return {
      id: `serper_${Date.now()}_${Math.random()}`,
      food_name: name || query,
      name: name || query,
      brand_name: 'via Google Search',
      brand: 'via Google Search',
      restaurant: null,
      serving_qty: 1,
      serving_unit: unitLabel,
      serving_label,
      nf_calories: macros.calories,
      nf_protein: macros.protein,
      nf_total_carbohydrate: macros.carbs,
      nf_total_fat: macros.fat,
      calories: macros.calories,
      protein: macros.protein,
      carbs: macros.carbs,
      fat: macros.fat,
      fiber: extras.fiber ?? null,
      sodium: extras.sodium ?? null,
      sugar: extras.sugar ?? null,
      servingSize: 1,
      servingUnit: unitLabel,
      servingGrams: 100,
      photo: null,
      source: 'serper',
    };
  };

  try {
    const res = await axios.post(
      'https://google.serper.dev/search',
      {
        q: `${query} nutrition facts calories protein carbs fat`,
        num: 8,
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

    const organicBlob = (n = 8) =>
      Array.isArray(data.organic)
        ? data.organic
            .slice(0, n)
            .map((r) => `${r.title || ''} ${r.snippet || ''}`)
            .join('\n')
        : '';

    /** Featured answers often list calories only; macros sit in organic titles/snippets. */
    const mergeOrganicForMacros = (snippet) =>
      `${String(snippet || '')}\n${organicBlob()}`.trim();

    const queryHint = String(query || '').toLowerCase();

    const pushFromText = (name, text) => {
      const macros = extractMacrosFromText(text, queryHint);
      if (macros.calories > 0 || macros.protein > 0 || macros.carbs > 0 || macros.fat > 0) {
        results.push(toSerperRow(name, macros));
      }
    };

    // 1. answerBox (featured snippet)
    if (data.answerBox) {
      const box = data.answerBox;
      let title = box.title || query;
      title = String(title).replace(/^Calories in /i, '').replace(/^Carbs in /i, '').trim();
      const snippet = mergeOrganicForMacros(box.answer || box.snippet || '');
      pushFromText(title, snippet);
    }

    // 2. knowledgeGraph attributes
    if (data.knowledgeGraph?.attributes) {
      const attrs = data.knowledgeGraph.attributes;
      const cleanNum = (v) => parseFloat(String(v || '0').replace(/[^\d.]/g, '') || 0);
      const cals = cleanNum(attrs['Calories'] || attrs['Energy'] || '0');
      let protein = cleanNum(attrs['Protein'] || '0');
      let carbs = cleanNum(attrs['Total Carbohydrate'] || attrs['Carbohydrates'] || '0');
      let fat = cleanNum(attrs['Total Fat'] || attrs['Fat'] || '0');
      const fiber = cleanNum(attrs['Dietary Fiber'] || '0');
      const sodium = cleanNum(attrs['Sodium'] || '0');

      const kgBlob = [
        data.knowledgeGraph.title,
        data.knowledgeGraph.description || '',
        ...Object.entries(attrs).map(([k, v]) => `${k}: ${v}`),
        organicBlob(),
      ].join('\n');
      const parsedKg = extractMacrosFromText(kgBlob, queryHint);

      if (cals > 0 && protein === 0 && carbs === 0 && fat === 0) {
        if (parsedKg.protein > 0) protein = parsedKg.protein;
        if (parsedKg.carbs > 0) carbs = parsedKg.carbs;
        if (parsedKg.fat > 0) fat = parsedKg.fat;
      }
      if (/\b(burger|cheeseburger|hamburger)\b/.test(queryHint) && parsedKg.carbs > carbs) {
        carbs = parsedKg.carbs;
      }

      if (cals > 0) {
        results.push(
          toSerperRow(
            data.knowledgeGraph.title || query,
            {
              calories: cals,
              protein,
              carbs,
              fat,
              servingLabel: parsedKg.servingLabel,
            },
            { fiber: fiber || null, sodium: sodium || null },
          ),
        );
      }
    }

    // 3. organic — merge snippets first (macros often split across results)
    if (results.length === 0 && Array.isArray(data.organic) && data.organic.length > 0) {
      const mega = data.organic
        .slice(0, 6)
        .map((r) => `${r.title || ''} ${r.snippet || ''}`)
        .join('\n');
      const megaMacros = extractMacrosFromText(mega, queryHint);
      if (megaMacros.calories > 0 || megaMacros.protein > 0) {
        const title =
          String(data.organic[0].title || query)
            .split('-')[0]
            .split('|')[0]
            .trim() || query;
        results.push(toSerperRow(title, megaMacros));
      } else {
        for (const r of data.organic.slice(0, 5)) {
          const text = `${r.title || ''} ${r.snippet || ''}`;
          const title =
            String(r.title || query)
              .split('-')[0]
              .split('|')[0]
              .trim() || query;
          pushFromText(title, text);
          if (results.length > 0) break;
        }
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

// Nutrition API endpoints — barcode: USDA → Open Food Facts → Serper | search: USDA → OFF → Serper (restaurant chains: Serper first)
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

// ─── USDA Branded barcode → same shape as Open Food Facts normalizer (client + addFoodLog) ───
function normalizeGtinDigits(barcode) {
  const d = String(barcode || '').replace(/\D/g, '');
  if (!d) return '';
  const stripped = d.replace(/^0+/, '');
  return stripped || '0';
}

function getFdcNutrientFromSearchFood(item, ...nutrientIds) {
  const nutrients = item.foodNutrients || [];
  for (const id of nutrientIds) {
    const n = nutrients.find((x) => x.nutrientId === id);
    if (n != null && n.value != null && !Number.isNaN(Number(n.value))) return Number(n.value);
  }
  return 0;
}

function mapUsdaBrandedSearchHitToBarcodeFood(hit) {
  const kcal = getFdcNutrientFromSearchFood(hit, 1008);
  const protein = getFdcNutrientFromSearchFood(hit, 1003);
  const carbs = getFdcNutrientFromSearchFood(hit, 1005);
  const fat = getFdcNutrientFromSearchFood(hit, 1004);
  const fiber = getFdcNutrientFromSearchFood(hit, 1079);
  const sodium = getFdcNutrientFromSearchFood(hit, 1090, 1093);
  const sugar = getFdcNutrientFromSearchFood(hit, 2000);

  let servingG = Number(hit.servingSize);
  if (!Number.isFinite(servingG) || servingG <= 0) servingG = 100;
  const unitRaw = String(hit.servingSizeUnit || 'g').toLowerCase();
  const useMl = unitRaw === 'ml' || unitRaw === 'milliliters';
  const scale = servingG / 100;

  return {
    id: String(hit.fdcId),
    name: hit.description || 'Unknown',
    brand: hit.brandOwner || null,
    restaurant: null,
    calories: kcal,
    protein,
    carbs,
    fat,
    fiber: fiber || null,
    sodium: sodium || null,
    sugar: sugar || null,
    servingSize: scale,
    servingUnit: useMl ? 'ml' : 'grams',
    servingGrams: Math.round(servingG),
    source: 'usda',
    kcalPer100Unit: kcal,
    servingAmount: Math.round(servingG),
  };
}

async function lookupBarcodeUsda(barcode) {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey || !String(barcode || '').trim()) return null;

  const clean = String(barcode).trim();
  const target = normalizeGtinDigits(clean);

  try {
    const res = await axios.post(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      {
        query: clean,
        pageSize: 25,
        dataType: ['Branded'],
      },
      { timeout: 12000, headers: { 'Content-Type': 'application/json' } }
    );

    const foods = res.data?.foods || [];
    const hit =
      foods.find((f) => normalizeGtinDigits(f.gtinUpc) === target) ||
      foods.find((f) => String(f.gtinUpc || '').replace(/\D/g, '') === clean.replace(/\D/g, '')) ||
      null;

    if (!hit) return null;

    console.log('[Barcode] USDA branded match:', hit.description, 'fdcId:', hit.fdcId, 'gtin:', hit.gtinUpc);
    return mapUsdaBrandedSearchHitToBarcodeFood(hit);
  } catch (e) {
    console.warn('[Barcode] USDA lookup failed:', e.message);
    return null;
  }
}

/** Fast-food / pizza / dine-out chains → try Serper (web) before USDA/OFF. Excludes soda-only brand tokens. */
const RESTAURANT_FIRST_BRANDS = [
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
  'starbucks',
  'dunkin',
  'subway',
  'chipotle',
  'kfc',
  "papa john's",
  'papa johns',
  'arbys',
  "arby's",
  'panera bread',
  'panera',
  'sonic',
  'five guys',
  'qdoba',
  'jack in the box',
  'del taco',
  'popeyes',
  "popeye's",
  'wingstop',
  'buffalo wild wings',
  'olive garden',
  'applebees',
  "applebee's",
  'texas roadhouse',
  'outback',
  'red lobster',
  'ihop',
  'cracker barrel',
  "chick-fil-a",
  'chick fil a',
  'red robin',
  'cottage inn',
];

app.get('/api/food/search', async (req, res) => {
  const query = req.query.query?.trim();
  if (!query) return res.status(400).json({ error: 'Query required' });

  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '20'), 10) || 20, 1), 40);
  const normalizedKey = normalizeSearchKey(query);
  const cacheKey = `v${FOOD_SEARCH_PIPELINE_VERSION}|${normalizedKey}`;

  const cachedMem = foodCache.get(cacheKey);
  if (cachedMem && Date.now() - cachedMem.timestamp < FOOD_CACHE_TTL) {
    console.log('[Food Search] In-memory cache hit:', query);
    return res.json({
      results: (cachedMem.data || []).slice(0, limit),
      source: 'cache',
      cached: true,
    });
  }

  try {
    if (admin.apps.length) {
      const docId = searchResultsDocId(normalizedKey);
      const snap = await admin.firestore().collection('searchResults').doc(docId).get();
      if (snap.exists) {
        const d = snap.data();
        if (Number(d.pipelineVersion) !== FOOD_SEARCH_PIPELINE_VERSION) {
          console.log('[Food Search] Firestore cache stale version — refetch');
        } else if (Array.isArray(d.results) && d.results.length > 0) {
          console.log('[Food Search] Firestore searchResults hit:', query);
          foodCache.set(cacheKey, { data: d.results, timestamp: Date.now() });
          return res.json({
            results: d.results.slice(0, limit),
            source: d.source || 'firestore-cache',
            cached: true,
          });
        }
      }
    }
  } catch (fcReadErr) {
    console.warn('[Food Search] Firestore cache read failed:', fcReadErr.message);
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
    'little caesars',
    'red robin',
    'dominos',
    "domino's",
    'papa johns',
    "papa john's",
    'cottage inn',
  ];

  const normalizeText = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/’/g, "'")
      .replace(/[^a-z0-9\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  /** Strip punctuation/spacing so "Domino's" / "domino s" match query token "dominos". */
  const brandKey = (s) =>
    String(s || '')
      .toLowerCase()
      .replace(/['’`]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const isLetterChar = (c) => c != null && c !== '' && /[a-z]/i.test(c);

  /**
   * Match chain/brand as a real token, not a substring inside another word.
   * Prevents "dominos" matching "DOMINOSTEINE" / "dominosteine" (old logic used naive includes on brandKey).
   */
  const brandMatchesItem = (text, brand) => {
    const hay = normalizeText(text);
    const needle = normalizeText(brand);
    if (!needle) return false;

    let i = 0;
    while ((i = hay.indexOf(needle, i)) !== -1) {
      const before = i === 0 ? ' ' : hay[i - 1];
      const after = i + needle.length >= hay.length ? ' ' : hay[i + needle.length];
      if (!isLetterChar(before) && !isLetterChar(after)) return true;
      i += 1;
    }

    const kb = brandKey(brand);
    const tk = brandKey(hay);
    if (kb.length < 3) return false;

    let j = 0;
    while ((j = tk.indexOf(kb, j)) !== -1) {
      const beforeC = j === 0 ? null : tk[j - 1];
      const afterC = j + kb.length >= tk.length ? null : tk[j + kb.length];
      const okBefore = beforeC == null || !isLetterChar(beforeC);
      const okAfter = afterC == null || !isLetterChar(afterC);
      if (okBefore && okAfter) return true;
      j += 1;
    }
    return false;
  };

  const queryLower = normalizeText(query);
  const requestedBrand = KNOWN_BRANDS.find((b) => queryLower.includes(normalizeText(b))) || null;
  const restaurantChainHit =
    RESTAURANT_FIRST_BRANDS.find((b) => queryLower.includes(normalizeText(b))) || null;

  const searchMode = classifyNutritionSearchMode(queryLower, !!restaurantChainHit);
  console.log('[Food Search] Mode:', searchMode, 'query:', query);

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

  /** "apple jacks cereal" → "apple jacks" so phrase match beats random apple+cereal baby foods */
  const queryCorePhrase = queryLower
    .replace(/\b(cereal|ready[\s-]?to[\s-]?eat|rte|milk|bar|drink|soda|juice|snack|chips|crackers|oatmeal)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const escapeRe = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const itemText = (item) => {
    const n = normalizeText(item?.food_name || item?.name || '');
    const b = normalizeText(item?.brand_name || item?.brand || '');
    return `${n} ${b}`.trim();
  };

  const findBrandInText = (text) => KNOWN_BRANDS.find((b) => brandMatchesItem(text, b)) || null;

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

    // Strong match: full product phrase (e.g. "apple jacks") — beats apple+cereal in babyfood
    if (queryCorePhrase.length >= 4 && text.includes(queryCorePhrase)) {
      score += 120;
    }
    // Multi-word query: reward consecutive words from core phrase appearing together
    const coreWords = queryCorePhrase.split(' ').filter((w) => w.length > 2);
    if (coreWords.length >= 2) {
      const joined = coreWords.join(' ');
      if (text.includes(joined)) score += 60;
    }

    // Token overlap — whole word only (avoids "jack" inside unrelated cheese when token is "jacks")
    let tokenHits = 0;
    for (const t of queryTokens) {
      try {
        if (new RegExp(`\\b${escapeRe(t)}\\b`, 'i').test(text)) tokenHits += 1;
      } catch {
        if (text.includes(t)) tokenHits += 1;
      }
    }
    score += tokenHits * 6;

    // Restaurant chain in query → only rows that actually name that chain should win (any chain, not pizza-only)
    if (restaurantChainHit) {
      if (brandMatchesItem(text, restaurantChainHit)) score += 42;
      else score -= 58;
      const wrongChain = RESTAURANT_FIRST_BRANDS.find(
        (b) => brandMatchesItem(text, b) && brandKey(b) !== brandKey(restaurantChainHit),
      );
      if (wrongChain) score -= 65;
      const t = text.toLowerCase();
      // Retail-aisle noise that often ranks on shared words ("pizza", "burger", "chicken") without being the restaurant
      if (
        /\bpizza\s+sauce\b|\bpizza\s*,\s*sauce\b|,\s*pizza\s+sauce\b/i.test(t) ||
        /\bpizza\s+crackers\b|\bpizza\s+dough\b|\bpizza\s+paste\b|\bpizza\s+bourekas\b|\bpizza\s+bruschetta\b|\bpizza\s+empanadas\b|\bpizza\s+pastelillos\b/i.test(t) ||
        /\b(bourekas|empanadas|pastelillos|bruschette)\b/i.test(t)
      ) {
        score -= 100;
      }
      if (item?.source === 'serper' && brandMatchesItem(text, restaurantChainHit)) score += 28;
    } else if (requestedBrand) {
      if (brandMatchesItem(text, requestedBrand)) score += 40;
      else score -= 52;
      const foundBrand = findBrandInText(text);
      if (foundBrand && brandKey(foundBrand) !== brandKey(requestedBrand)) score -= 60;
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

    // User typed grocery cereal — not baby food jars
    if (/\bbabyfood\b|\bbaby food\b/i.test(text) && !/\b(baby|infant|toddler|jar)\b/.test(queryLower)) {
      score -= 55;
    }
    // Asked for cereal but row is clearly cheese / unrelated
    if (/\bcereal\b/.test(queryLower) && /\bcheese\b|\bcheeses\b/i.test(text) && !/\bcereal\b/i.test(text)) {
      score -= 70;
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
    const topText = itemText(ranked[0]);
    if (restaurantChainHit) return brandMatchesItem(topText, restaurantChainHit);
    if (requestedBrand) return brandMatchesItem(topText, requestedBrand);
    return true;
  };

  const needsFill = () => !results?.length || !hasGoodMatch(results);

  const mapUsdaFoods = (foods) =>
    (foods || []).map((item) => {
      const nutrients = item.foodNutrients || [];
      const get = (id) => nutrients.find((n) => n.nutrientId === id)?.value || 0;
      const household = item.householdServingFullText ? String(item.householdServingFullText).trim() : '';
      const sizeBit = item.servingSize ? `${item.servingSize}${item.servingSizeUnit || ''}` : '';
      const servingHuman = String(household || sizeBit || '').trim();
      return {
        food_name: item.description,
        brand_name: item.brandOwner || '',
        serving_qty: 1,
        serving_unit: servingHuman || 'serving',
        serving_label: household || sizeBit || null,
        householdServingFullText: household || null,
        nf_calories: get(1008),
        nf_protein: get(1003),
        nf_total_carbohydrate: get(1005),
        nf_total_fat: get(1004),
        photo: null,
        source: 'usda',
      };
    });

  /** Serper web results merged into `results` / `source`. */
  async function mergeSerperFoodSearch(logLabel) {
    if (!process.env.SERPER_API_KEY) return;
    try {
      console.log(logLabel);
      let parsed = [];
      try {
        parsed = await searchFoodWithSerper(query);
      } catch (helperErr) {
        console.warn('[Food Search] Serper helper failed:', helperErr?.message || helperErr);
      }

      if (!parsed.length) {
        const qSerper = fixTypoForSerperQuery(query);
        const r = await fetchWithTimeout(
          'https://google.serper.dev/search',
          {
            method: 'POST',
            headers: {
              'X-API-KEY': process.env.SERPER_API_KEY,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: `${qSerper} calories protein carbs fat nutrition facts menu`,
              num: 8,
            }),
          },
          12000,
        );
        if (r.ok) {
          const data = await r.json();
          const answer = data.answerBox || data.knowledgeGraph;
          if (answer) {
            let cleanTitle = answer.title || query;
            if (cleanTitle.startsWith('Calories in ')) cleanTitle = cleanTitle.replace('Calories in ', '');
            if (cleanTitle.startsWith('Carbs in ')) cleanTitle = cleanTitle.replace('Carbs in ', '');
            if (cleanTitle.includes(' - CalorieKing')) cleanTitle = cleanTitle.replace(' - CalorieKing', '');
            const organicExtra = Array.isArray(data.organic)
              ? data.organic
                  .slice(0, 8)
                  .map((o) => `${o.title || ''} ${o.snippet || ''}`)
                  .join('\n')
              : '';
            const snippet = `${answer.snippet || ''} ${answer.answer || ''}\n${organicExtra}`.trim();
            const macros = extractMacrosFromText(snippet, String(query || '').toLowerCase());
            const extractNumber = (text, pattern) => {
              const match = text.match(pattern);
              return match ? parseFloat(match[1]) : 0;
            };
            const srv = macros.servingLabel || null;
            parsed = [
              {
                food_name: cleanTitle.trim(),
                brand_name: '',
                serving_qty: 1,
                serving_unit: srv || 'serving',
                serving_label: srv,
                nf_calories:
                  parseFloat(answer.calories) ||
                  macros.calories ||
                  extractNumber(snippet, /(\d+)\s*calories/i) ||
                  0,
                nf_protein:
                  parseFloat(answer.protein) || macros.protein || extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*protein/i) || 0,
                nf_total_carbohydrate:
                  parseFloat(answer.carbohydrates) ||
                  parseFloat(answer.carbs) ||
                  macros.carbs ||
                  extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*carb/i) ||
                  0,
                nf_total_fat:
                  parseFloat(answer.fat) || macros.fat || extractNumber(snippet, /(\d+\.?\d*)\s*g?\s*fat/i) || 0,
                photo: null,
                source: 'serper',
              },
            ];
          }
        }
      }

      if (Array.isArray(parsed) && parsed.length) {
        const merged = rankResults([...parsed, ...(results || [])]);
        results = merged;
        source = results?.[0]?.source === 'serper' ? 'serper' : source || 'mixed';
        console.log('[Food Search] 🔍 Serper merged', parsed.length, 'items');
      }
    } catch (e) {
      console.error('[Food Search] Serper failed:', e.message);
    }
  }

  let usdaResults = null;
  let offResults = null;

  async function loadUsdaFoundationFirst() {
    if (!process.env.USDA_API_KEY) return;
    try {
      // FDC mixed-type searches return SR Legacy baby foods / Survey noise BEFORE Kellogg's branded rows.
      // Terminal proof: Branded-only + "apple jacks" returns Kellogg's Apple Jacks; mixed "Apple Jacks cereal" does not (first page).
      const combinedFoods = [];
      const seenIds = new Set();
      const pushFoods = (foods) => {
        for (const f of foods || []) {
          if (f?.fdcId && !seenIds.has(f.fdcId)) {
            seenIds.add(f.fdcId);
            combinedFoods.push(f);
          }
        }
      };

      const brandedQuery =
        queryCorePhrase.length >= 3 ? queryCorePhrase : queryLower;

      const apiUrl = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(process.env.USDA_API_KEY)}`;

      console.log('[Food Search] USDA Branded-first:', brandedQuery);
      const rBrand = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: brandedQuery,
            pageSize: 45,
            dataType: ['Branded'],
          }),
        },
        12000,
      );
      if (rBrand.ok) {
        const dBrand = await rBrand.json();
        pushFoods(dBrand.foods);
      }

      console.log('[Food Search] USDA mixed datatypes (full query)...');
      const rMix = await fetchWithTimeout(
        apiUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query,
            pageSize: 50,
            dataType: ['Branded', 'Foundation', 'SR Legacy', 'Survey (FNDDS)'],
          }),
        },
        12000,
      );
      if (rMix.ok) {
        const dMix = await rMix.json();
        pushFoods(dMix.foods);
      }

      usdaResults = rankResults(mapUsdaFoods(combinedFoods.slice(0, 120)));
      if (hasGoodMatch(usdaResults)) {
        results = usdaResults;
        source = 'usda';
        console.log('[Food Search] USDA grocery match:', results.length, 'pool:', combinedFoods.length);
      } else {
        console.log('[Food Search] USDA weak match — may try other tiers');
      }
    } catch (e) {
      console.error('[Food Search] USDA primary search failed:', e.message);
    }
  }

  async function loadUsdaBroad() {
    if (!process.env.USDA_API_KEY) return;
    try {
      console.log('[Food Search] USDA (broad search)...');
      const r = await fetchWithTimeout(
        `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=12&api_key=${process.env.USDA_API_KEY}`,
        {},
        10000,
      );
      if (!r.ok) return;
      const data = await r.json();
      const mapped = rankResults(mapUsdaFoods((data.foods || []).slice(0, 12)));
      usdaResults = mapped;
      if (hasGoodMatch(mapped)) {
        results = mapped;
        source = 'usda';
        console.log('[Food Search] USDA broad match:', results.length);
      }
    } catch (e) {
      console.error('[Food Search] USDA broad failed:', e.message);
    }
  }

  async function loadOpenFoodFacts() {
    if (restaurantChainHit) {
      console.log(
        '[Food Search] 🥫 OFF skipped for restaurant chain query (retail DB ≠ menu — Serper/USDA first)',
      );
      return;
    }
    try {
      console.log('[Food Search] 🥫 Open Food Facts:', query);
      const r = await fetchWithTimeout(
        `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=24`,
        {},
        10000,
      );
      console.log('[Food Search] 🥫 Open Food Facts status:', r.status);
      if (!r.ok) return;
      const data = await r.json();
      console.log('[Food Search] 🥫 OFF products:', data.products?.length || 0);
      offResults = (data.products || []).slice(0, 24).map((item) => {
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
          source: 'openfoodfacts',
        };
      });
      offResults = rankResults(offResults);
      if (hasGoodMatch(offResults)) {
        const top = offResults[0];
        const topText = itemText(top);
        const retailFrozen =
          /\bpizza\b/.test(queryLower) &&
          /\b(take\s*&\s*bake|take\s+and\s+bake|bake\s+at\s+home)\b/.test(topText) &&
          !/\b(take|bake|frozen|grocery)\b/.test(queryLower);
        if (retailFrozen) {
          console.log(
            '[Food Search] 🥫 OFF top looks retail/frozen pizza — continuing to web search for better match',
          );
        } else {
          results = offResults;
          source = 'openfoodfacts';
          console.log('[Food Search] 🥫 OFF good match:', results.length);
        }
      }
    } catch (e) {
      console.error('[Food Search] 🥫 Open Food Facts FAILED:', e.message);
    }
  }

  // ─── Tier order: generic → USDA → OFF → Serper → USDA broad
  //                 branded + restaurant chain in query → Serper first (OFF skipped), then USDA
  if (searchMode === 'generic') {
    if (needsFill()) await loadUsdaFoundationFirst();
    if (needsFill()) await loadOpenFoodFacts();
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (after USDA + OFF)');
    if (needsFill()) await loadUsdaBroad();
  } else if (restaurantChainHit) {
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (restaurant chain first)');
    if (needsFill()) await loadOpenFoodFacts();
    if (needsFill()) await loadUsdaBroad();
    if (needsFill()) await loadUsdaFoundationFirst();
  } else {
    if (needsFill()) await loadOpenFoodFacts();
    if (needsFill()) await mergeSerperFoodSearch('[Food Search] Serper (after OFF)');
    if (needsFill()) await loadUsdaBroad();
    if (needsFill()) await loadUsdaFoundationFirst();
  }

  const brandForSerperFinal = restaurantChainHit || requestedBrand;
  const needSerperFinal =
    process.env.SERPER_API_KEY &&
    (!results?.length ||
      (brandForSerperFinal &&
        results.length > 0 &&
        !brandMatchesItem(itemText(results[0]), brandForSerperFinal)));

  if (needSerperFinal) {
    await mergeSerperFoodSearch('[Food Search] Serper final pass (brand / empty fix)');
  }

  if (!results || results.length === 0) {
    if (usdaResults && usdaResults.length > 0) {
      console.log('[Food Search] Fallback: USDA results');
      results = usdaResults;
      source = 'usda-fallback';
    } else if (offResults && offResults.length > 0) {
      console.log('[Food Search] Fallback: OFF results');
      results = offResults;
      source = 'openfoodfacts-fallback';
    }
  }

  if (!results || results.length === 0) {
    console.error('[Food Search] All tiers failed for query:', query);
    return res.json({
      results: [],
      source: 'none',
      hint: EMPTY_SEARCH_HINT,
      query,
    });
  }

  if (restaurantChainHit && Array.isArray(results) && results.length) {
    const strict = results.filter((it) => brandMatchesItem(itemText(it), restaurantChainHit));
    if (strict.length > 0) {
      results = rankResults(strict);
      console.log('[Food Search] Restaurant-only filter:', strict.length, 'results mention', restaurantChainHit);
    }
  }

  const out = (results || []).slice(0, limit);

  foodCache.set(cacheKey, { data: out, timestamp: Date.now() });

  try {
    if (admin.apps.length && out.length > 0) {
      const docId = searchResultsDocId(normalizedKey);
      await admin.firestore().collection('searchResults').doc(docId).set(
        {
          queryKey: normalizedKey,
          originalQuery: query,
          pipelineVersion: FOOD_SEARCH_PIPELINE_VERSION,
          food_name: out[0]?.food_name || out[0]?.name || query,
          calories: Number(out[0]?.nf_calories ?? out[0]?.calories ?? 0),
          protein: Number(out[0]?.nf_protein ?? out[0]?.protein ?? 0),
          carbs: Number(out[0]?.nf_total_carbohydrate ?? out[0]?.carbs ?? 0),
          fat: Number(out[0]?.nf_total_fat ?? out[0]?.fat ?? 0),
          source: source || out[0]?.source || 'unknown',
          results: out,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    }
  } catch (fwErr) {
    console.warn('[Food Search] Firestore cache write failed:', fwErr.message);
  }

  return res.json({ results: out, source });
});

// Barcode pipeline (fixed order): ① USDA Branded-only GTIN match ② Open Food Facts product API ③ Serper web
app.post('/api/food/barcode', async (req, res) => {
  try {
    const { barcode } = req.body;
    
    if (!barcode) {
      return res.status(400).json({ error: 'Barcode is required' });
    }

    const cacheKey = `barcode:${barcode}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    let result = null;

    // 1. USDA FDC — branded products only (see lookupBarcodeUsda: dataType Branded + GTIN match)
    if (process.env.USDA_API_KEY) {
      result = await lookupBarcodeUsda(barcode.trim());
      if (result) console.log('Barcode from USDA:', result.name, 'fdcId:', result.id);
    }

    // 2. Open Food Facts with portion normalization
    if (!result) {
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
    }

    // 3. Serper web search for barcode + nutrition
    if (!result && process.env.SERPER_API_KEY) {
      try {
        result = await lookupBarcodeWithSerper(barcode);
        if (result) console.log('Barcode found via Serper:', result.name);
      } catch (serperErr) {
        console.warn('Serper barcode fallback failed:', serperErr.message);
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
  // Overall timeout for this pipeline (Serper + HTML fetch)
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
    // For now, return null since we removed OpenAI extraction
    // In the future, consider using Claude via /api/ai-coach for extraction
    console.warn('Restaurant nutrition extraction requires API integration - returning null');
    return res.json(null);
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

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server listening on port ${PORT}`);
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


