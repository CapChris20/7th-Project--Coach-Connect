/**
 * Firebase Cloud Functions
 *
 * - OpenAI Realtime API WebSocket Proxy (v2 HTTPS)
 * - Weekly client summaries via Claude (v2 scheduler)
 */

const functions = require('firebase-functions/v2');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const admin = require('firebase-admin');
const Anthropic = require('@anthropic-ai/sdk');
// Week calculations are done server-side; use explicit timezone for consistency
const moment = require('moment-timezone');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const app = express();
app.use(cors());

// OpenAI Realtime API endpoint
const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

/**
 * Get OpenAI API key from Firebase Functions config
 * Falls back to environment variable for local development
 */
function getOpenAIApiKey() {
  try {
    const config = functions.config();
    return config?.openai?.key || process.env.OPENAI_API_KEY;
  } catch (error) {
    console.error('Error getting OpenAI API key:', error);
    return process.env.OPENAI_API_KEY;
  }
}

/**
 * Create WebSocket connection to OpenAI Realtime API
 */
function createOpenAIWebSocket() {
  const apiKey = getOpenAIApiKey();
  
  if (!apiKey) {
    throw new Error('OpenAI API key not configured. Set with: firebase functions:config:set openai.key="sk-..."');
  }

  const openaiSocket = new WebSocket(OPENAI_REALTIME_URL, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  return openaiSocket;
}

/**
 * Handle WebSocket upgrade request from client
 * Creates proxy connection to OpenAI Realtime API
 */
function handleWebSocketUpgrade(req, socket, head) {
  console.log('🔌 WebSocket upgrade request received');

  // Create WebSocket server for client connection
  const wss = new WebSocketServer({ noServer: true });

  wss.handleUpgrade(req, socket, head, (clientSocket) => {
    console.log('✅ Client WebSocket connected');

    let openaiSocket = null;
    let isClosing = false;

    // Create connection to OpenAI
    try {
      openaiSocket = createOpenAIWebSocket();

      // Handle OpenAI connection open
      openaiSocket.on('open', () => {
        console.log('✅ Connected to OpenAI Realtime API');
        // Client is ready to receive messages
      });

      // Relay messages from OpenAI to client
      openaiSocket.on('message', (data, isBinary) => {
        if (!isClosing && clientSocket.readyState === WebSocket.OPEN) {
          try {
            // Forward message to client
            clientSocket.send(data, { binary: isBinary });
          } catch (error) {
            console.error('❌ Error forwarding OpenAI message to client:', error);
          }
        }
      });

      // Relay messages from client to OpenAI
      clientSocket.on('message', (data, isBinary) => {
        if (!isClosing && openaiSocket && openaiSocket.readyState === WebSocket.OPEN) {
          try {
            // Forward message to OpenAI
            openaiSocket.send(data, { binary: isBinary });
          } catch (error) {
            console.error('❌ Error forwarding client message to OpenAI:', error);
          }
        }
      });

      // Handle OpenAI errors
      openaiSocket.on('error', (error) => {
        console.error('❌ OpenAI WebSocket error:', error);
        if (!isClosing && clientSocket.readyState === WebSocket.OPEN) {
          try {
            // Send error message to client
            clientSocket.send(JSON.stringify({
              type: 'error',
              error: {
                message: error.message || 'OpenAI connection error',
                code: 'openai_error',
              },
            }));
          } catch (e) {
            // Ignore send errors
          }
        }
        cleanup();
      });

      // Handle OpenAI close
      openaiSocket.on('close', (code, reason) => {
        console.log(`🔌 OpenAI WebSocket closed: ${code} - ${reason}`);
        cleanup();
      });

      // Handle client errors
      clientSocket.on('error', (error) => {
        console.error('❌ Client WebSocket error:', error);
        cleanup();
      });

      // Handle client close
      clientSocket.on('close', () => {
        console.log('🔌 Client WebSocket closed');
        cleanup();
      });

      // Cleanup function
      function cleanup() {
        if (isClosing) return;
        isClosing = true;

        console.log('🧹 Cleaning up WebSocket connections...');

        // Close OpenAI connection
        if (openaiSocket) {
          try {
            if (openaiSocket.readyState === WebSocket.OPEN || 
                openaiSocket.readyState === WebSocket.CONNECTING) {
              openaiSocket.close();
            }
          } catch (e) {
            // Ignore close errors
          }
          openaiSocket = null;
        }

        // Close client connection
        if (clientSocket) {
          try {
            if (clientSocket.readyState === WebSocket.OPEN || 
                clientSocket.readyState === WebSocket.CONNECTING) {
              clientSocket.close();
            }
          } catch (e) {
            // Ignore close errors
          }
        }
      }

    } catch (error) {
      console.error('❌ Failed to create OpenAI WebSocket:', error);
      
      // Send error to client
      try {
        if (clientSocket.readyState === WebSocket.OPEN) {
          clientSocket.send(JSON.stringify({
            type: 'error',
            error: {
              message: error.message || 'Failed to connect to OpenAI',
              code: 'connection_error',
            },
          }));
          clientSocket.close();
        }
      } catch (e) {
        // Ignore send errors
      }
    }
  });
}

// HTTP endpoint for health check
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CoachConnect Realtime Proxy',
    openaiConfigured: !!getOpenAIApiKey(),
  });
});

// Create HTTP server and handle WebSocket upgrades
const server = app.listen(0); // Use port 0 for Firebase Functions (auto-assigned)

// Handle WebSocket upgrade requests
server.on('upgrade', handleWebSocketUpgrade);

/**
 * Firebase Cloud Function - Realtime Proxy
 * 
 * Exports as HTTPS function that handles WebSocket upgrades
 */
exports.realtimeProxy = functions.https.onRequest({
  cors: true,
  maxInstances: 10,
}, (req, res) => {
  // Handle HTTP requests (health check)
  if (req.method === 'GET' && req.url === '/') {
    res.json({
      status: 'ok',
      service: 'CoachConnect Realtime Proxy',
      openaiConfigured: !!getOpenAIApiKey(),
      websocket: 'Connect via wss:// protocol',
    });
    return;
  }

  // For WebSocket connections, the upgrade is handled by the server.on('upgrade') handler
  // But Firebase Functions doesn't support direct WebSocket upgrades
  // We need to use a different approach - using HTTP callable function or Express middleware
  
  // This function should be called as an HTTPS endpoint that returns a WebSocket URL
  // The client should then connect to that URL
  // However, Firebase Functions v2 doesn't support WebSocket upgrades directly
  
  // Alternative: Return WebSocket URL that the client should connect to
  // For now, we'll need to use a different approach - maybe use Firebase Hosting rewrites
  // or deploy to Cloud Run instead of Cloud Functions
  
  res.status(400).json({
    error: 'WebSocket connections must use wss:// protocol directly',
    message: 'This endpoint supports HTTP only. Use WebSocket client to connect.',
  });
});

// Note: Firebase Functions v2 doesn't natively support WebSocket upgrades
// The WebSocket proxy needs to be deployed differently:
// Option 1: Use Cloud Run instead of Cloud Functions (supports WebSocket)
// Option 2: Use Firebase Hosting with Cloud Functions backend
// Option 3: Deploy Express server separately (Railway, Render, etc.)

// For now, we'll create a separate Express server deployment approach
// The function above handles HTTP requests, but WebSocket requires a different deployment

/**
 * Compute last week's Monday (weekStart) and Sunday (weekEnd).
 * "Last week" = the previous Mon–Sun (e.g. if today is Tue Mar 10, last week is Mar 3–9).
 */
function getLastWeekBounds() {
  const now = new Date();
  const todayET = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  const [y, m, d] = todayET.split('-').map(Number);
  const dayOfWeek = new Date(y, m - 1, d).getDay(); // 0=Sun, 1=Mon, ... 6=Sat
  const daysSinceMonday = (dayOfWeek + 6) % 7; // Sun=6, Mon=0, Tue=1, ...
  const thisMonday = new Date(y, m - 1, d - daysSinceMonday);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(lastMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastSunday.getDate() + 6);
  const weekStart =
    lastMonday.getFullYear() +
    '-' +
    String(lastMonday.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(lastMonday.getDate()).padStart(2, '0');
  const weekEnd =
    lastSunday.getFullYear() +
    '-' +
    String(lastSunday.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(lastSunday.getDate()).padStart(2, '0');
  return { weekStart, weekEnd };
}

/**
 * Callable: Get canonical week bounds.
 *
 * - If data.weekStart (YYYY-MM-DD) is provided, returns that week's Mon–Sun in America/New_York.
 * - If not provided, returns the same last-week bounds used by the scheduler.
 */
exports.getWeekBounds = onCall(async (request) => {
  try {
    const { weekStart } = request.data || {};

    // No specific week provided → use existing last-week logic
    if (!weekStart) {
      const bounds = getLastWeekBounds();
      return bounds;
    }

    // Specific weekStart provided: treat as a date in ET and compute that ISO week
    const m = moment.tz(weekStart, 'YYYY-MM-DD', 'America/New_York');
    if (!m.isValid()) {
      throw new HttpsError('invalid-argument', 'weekStart must be YYYY-MM-DD');
    }

    const weekStartMoment = m.clone().startOf('isoWeek');
    const weekEndMoment = m.clone().endOf('isoWeek');

    return {
      weekStart: weekStartMoment.format('YYYY-MM-DD'),
      weekEnd: weekEndMoment.format('YYYY-MM-DD'),
    };
  } catch (error) {
    logger.error('getWeekBounds error', { error: error?.message || String(error) });
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', error?.message || 'Failed to compute week bounds.');
  }
});

/**
 * Run weekly summary generation for last week. Shared by scheduler and callable.
 */
async function runWeeklySummaryGeneration() {
  const { weekStart, weekEnd } = getLastWeekBounds();
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    throw new Error('CLAUDE_API_KEY not set. Run: firebase functions:secrets:set CLAUDE_API_KEY');
  }

  const anthropic = new Anthropic({ apiKey });
  const avg = (arr) =>
    arr.length
      ? (arr.reduce((a, b) => a + parseFloat(b), 0) / arr.length).toFixed(1)
      : 'N/A';

  const usersSnap = await db
    .collection('users')
    .where('role', '==', 'client')
    .get();

  if (usersSnap.empty) {
    return { weekStart, weekEnd, successCount: 0, skippedCount: 0, message: 'No clients found' };
  }

  let successCount = 0;
  let skippedCount = 0;

  const processClient = async (userDoc) => {
    const clientId = userDoc.id;
    try {
      const logs = [];
      const startDate = new Date(weekStart);
      const endDate = new Date(weekEnd);
      for (
        let d = new Date(startDate);
        d <= endDate;
        d.setDate(d.getDate() + 1)
      ) {
        const dateKey = d.toISOString().split('T')[0];
        const dailySnap = await db
          .collection('users')
          .doc(clientId)
          .collection('dailyLogs')
          .doc(dateKey)
          .get();
        if (dailySnap.exists) logs.push(dailySnap.data());
      }

      if (logs.length === 0) {
        skippedCount += 1;
        return;
      }

      const avgSleep = avg(logs.map((l) => l.dashboard_sleep).filter(Boolean));
      const avgWater = avg(logs.map((l) => l.dashboard_water).filter(Boolean));
      const avgSteps = avg(logs.map((l) => l.dashboard_steps).filter(Boolean));
      const avgEnergy = avg(logs.map((l) => l.dashboard_energy).filter(Boolean));
      const avgWeight = avg(logs.map((l) => l.dashboard_weight).filter(Boolean));
      const avgSoreness = avg(logs.map((l) => l.dashboard_soreness).filter(Boolean));
      const avgStress = avg(logs.map((l) => l.dashboard_stress).filter(Boolean));
      const avgMood = avg(logs.map((l) => l.dashboard_mood).filter(Boolean));
      const workouts = logs.map((l) => l.dashboard_workouts).filter(Boolean);
      const notes = logs.map((l) => l.dashboard_notes).filter(Boolean);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayByDay = logs
        .map((l, i) => {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + i);
          const dayLabel = `${dayNames[date.getDay()]} ${date.toISOString().slice(0, 10)}`;
          const parts = [
            `Sleep ${l.dashboard_sleep ?? '—'}h`,
            `Water ${l.dashboard_water ?? '—'}oz`,
            `Steps ${l.dashboard_steps ?? '—'}`,
            `Energy ${l.dashboard_energy ?? '—'}/5`,
            l.dashboard_weight != null ? `Weight ${l.dashboard_weight}lbs` : null,
            l.dashboard_soreness != null && l.dashboard_soreness !== '' ? `Soreness ${l.dashboard_soreness}/10` : null,
            l.dashboard_stress != null && l.dashboard_stress !== '' ? `Stress ${l.dashboard_stress}/10` : null,
            l.dashboard_mood != null && l.dashboard_mood !== '' ? `Mood ${l.dashboard_mood}/10` : null,
            l.dashboard_bodyfat != null && l.dashboard_bodyfat !== '' ? `Body fat ${l.dashboard_bodyfat}%` : null,
            l.dashboard_workout_rating != null && l.dashboard_workout_rating !== '' ? `Workout rating ${l.dashboard_workout_rating}/10` : null,
            l.dashboard_workouts ? `Workout: ${String(l.dashboard_workouts).slice(0, 60)}` : null,
            l.dashboard_notes ? `Note: ${String(l.dashboard_notes).slice(0, 120)}` : null,
          ].filter(Boolean);
          return `${dayLabel}: ${parts.join(', ')}`;
        })
        .join('\n');

      const prompt = `
You are a professional fitness coach writing an IN-DEPTH weekly report for a trainer. The data below comes from this client's DAILY LOGS. Use every number and note; be specific and analytical.

Week: ${weekStart} to ${weekEnd}

DAY-BY-DAY (from daily logs — use ALL of this in your report):
${dayByDay}

TOTALS / AVERAGES:
- Avg sleep: ${avgSleep} hrs | Avg water: ${avgWater} oz | Avg steps: ${avgSteps} | Avg energy: ${avgEnergy}/5
- Avg soreness: ${avgSoreness}/10 | Avg stress: ${avgStress}/10 | Avg mood: ${avgMood}/10 (use only if present in data)
- Weight: ${avgWeight} lbs (avg) | Workouts: ${workouts.length} day(s) — ${workouts.join('; ') || 'none'}
- Client notes this week: ${notes.length ? notes.map((n) => `"${String(n).slice(0, 150)}"`).join(' | ') : 'None'}

Write a detailed, evidence-based report. Every bullet and sentence must cite actual numbers or days from the data above. No generic advice.

- dayBreakdown: REQUIRED. Array of exactly 7 strings (Mon–Sun). For each day write 2–3 sentences: all metrics (sleep, water, steps, energy, soreness, stress, mood, weight, workout, note) that appear in the data. Call out patterns (e.g. "low sleep may explain lower energy"). No data = "No check-in."
- summary: 6–10 sentences. Open with overall takeaway. Then: compare early vs late week, best/worst days for key metrics, how notes relate to numbers. Name specific days and numbers.
- trends: REQUIRED. Array of 4–6 short bullets describing week-over-week or day-to-day patterns (e.g. "Sleep improved from 6h Mon–Tue to 7.5h Fri–Sat", "Steps dropped Wed–Thu then recovered", "Stress and mood moved together"). Use only data from above.
- pros: 4–5 bullets of what went well, each with a number or day.
- cons: 3–4 bullets of what to improve, specific and actionable, with numbers where relevant.
- wins: 4–5 concrete wins (e.g. "Hit 64oz water 5/7 days", "Logged 4 workouts").
- focus: 4–5 specific goals for next week (measurable where possible).
- signOff: 1–2 sentences that reference something specific from their week.

Return ONLY valid JSON, no markdown or extra text:
{
  "dayBreakdown": ["string", "string", "string", "string", "string", "string", "string"],
  "summary": "string",
  "trends": ["string", "string", "string", "string"],
  "pros": ["string", "string", "string", "string"],
  "cons": ["string", "string", "string"],
  "wins": ["string", "string", "string", "string"],
  "focus": ["string", "string", "string", "string"],
  "signOff": "string"
}
`;

      const message = await anthropic.messages.create({
        // Switched to Haiku for dramatically lower cost; still plenty for structured reports
        model: 'claude-3-haiku-20240307',
        // Weekly reports don’t need huge essays – this keeps cost/token use under control
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }],
      });
      let raw = (message.content?.[0]?.text || '').trim();
      raw = raw.replace(/^\s*```\w*\s*/i, '').replace(/\s*```\s*$/m, '').trim();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (parseErr) {
        logger.error('Weekly summary batch JSON parse failed', { clientId, rawPreview: raw.slice(0, 200) });
        throw parseErr;
      }

      await db
        .collection('users')
        .doc(clientId)
        .collection('weeklySummaries')
        .doc(weekStart)
        .set({
          weekStart,
          weekEnd,
          dayBreakdown: Array.isArray(parsed.dayBreakdown) ? parsed.dayBreakdown : [],
          summary: parsed.summary,
          trends: Array.isArray(parsed.trends) ? parsed.trends : [],
          pros: Array.isArray(parsed.pros) ? parsed.pros : [],
          cons: Array.isArray(parsed.cons) ? parsed.cons : [],
          wins: Array.isArray(parsed.wins) ? parsed.wins : [],
          focus: Array.isArray(parsed.focus) ? parsed.focus : [],
          signOff: parsed.signOff,
          avgSleep,
          avgWater,
          avgSteps,
          avgEnergy,
          avgWeight,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      successCount += 1;
    } catch (err) {
      logger.error('Error processing client weekly summary', {
        clientId,
        weekStart,
        weekEnd,
        error: err?.message || String(err),
      });
    }
  };

  await Promise.all(usersSnap.docs.map((doc) => processClient(doc)));
  return { weekStart, weekEnd, successCount, skippedCount };
}

/**
 * Generate weekly summary for a single client for a specific week.
 * If weekStartOverride is not provided, falls back to "last week" (default behavior).
 */
async function generateWeeklySummaryForClient(clientId, weekStartOverride) {
  let weekStart, weekEnd;

  if (weekStartOverride) {
    // Expect YYYY-MM-DD (Monday). Compute weekEnd as +6 days.
    const [y, m, d] = weekStartOverride.split('-').map(Number);
    const startDate = new Date(y, m - 1, d);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    weekStart =
      startDate.getFullYear() +
      '-' +
      String(startDate.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(startDate.getDate()).padStart(2, '0');
    weekEnd =
      endDate.getFullYear() +
      '-' +
      String(endDate.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(endDate.getDate()).padStart(2, '0');
  } else {
    ({ weekStart, weekEnd } = getLastWeekBounds());
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY not set');

  const userDoc = await db.collection('users').doc(clientId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'client') {
    return { weekStart, weekEnd, generated: false, reason: 'Not a client' };
  }

  const anthropic = new Anthropic({ apiKey });
  const avg = (arr) =>
    arr.length ? (arr.reduce((a, b) => a + parseFloat(b), 0) / arr.length).toFixed(1) : 'N/A';

  const logs = [];
  const startDate = new Date(weekStart);
  const endDate = new Date(weekEnd);
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateKey = d.toISOString().split('T')[0];
    const dailySnap = await db.collection('users').doc(clientId).collection('dailyLogs').doc(dateKey).get();
    if (dailySnap.exists) logs.push(dailySnap.data());
  }
  if (logs.length === 0) return { weekStart, weekEnd, generated: false, reason: 'No check-ins for last week' };

  const avgSleep = avg(logs.map((l) => l.dashboard_sleep).filter(Boolean));
  const avgWater = avg(logs.map((l) => l.dashboard_water).filter(Boolean));
  const avgSteps = avg(logs.map((l) => l.dashboard_steps).filter(Boolean));
  const avgEnergy = avg(logs.map((l) => l.dashboard_energy).filter(Boolean));
  const avgWeight = avg(logs.map((l) => l.dashboard_weight).filter(Boolean));
  const avgSoreness = avg(logs.map((l) => l.dashboard_soreness).filter(Boolean));
  const avgStress = avg(logs.map((l) => l.dashboard_stress).filter(Boolean));
  const avgMood = avg(logs.map((l) => l.dashboard_mood).filter(Boolean));
  const workouts = [];
  let totalExercises = 0;
  let totalSets = 0;
  const allExerciseNames = new Set();
  const notes = logs.map((l) => l.dashboard_notes).filter(Boolean);

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayByDay = logs
    .map((l, i) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + i);
      const dayLabel = `${dayNames[date.getDay()]} ${date.toISOString().slice(0, 10)}`;
      // Build workout summary from structured workoutLog if present
      let workoutSummary = null;
      if (Array.isArray(l.workoutLog) && l.workoutLog.length > 0) {
        const exSummaries = l.workoutLog
          .filter((ex) => ex && ex.exerciseName)
          .map((ex) => {
            const sets = Array.isArray(ex.sets) ? ex.sets : [];
            const setStrings = sets.map((s) => `${s.reps || 0}×${s.weight || 0}`);
            totalExercises += 1;
            totalSets += sets.length;
            allExerciseNames.add(ex.exerciseName);
            return `${ex.exerciseName} (${sets.length} sets: ${setStrings.join(', ')})`;
          });
        if (exSummaries.length > 0) {
          workoutSummary = exSummaries.join(', ');
          workouts.push(`${dayLabel}: ${workoutSummary}`);
        }
      }

      const parts = [
        `Sleep ${l.dashboard_sleep ?? '—'}h`,
        `Water ${l.dashboard_water ?? '—'}oz`,
        `Steps ${l.dashboard_steps ?? '—'}`,
        `Energy ${l.dashboard_energy ?? '—'}/5`,
        l.dashboard_weight != null ? `Weight ${l.dashboard_weight}lbs` : null,
        l.dashboard_soreness != null && l.dashboard_soreness !== '' ? `Soreness ${l.dashboard_soreness}/10` : null,
        l.dashboard_stress != null && l.dashboard_stress !== '' ? `Stress ${l.dashboard_stress}/10` : null,
        l.dashboard_mood != null && l.dashboard_mood !== '' ? `Mood ${l.dashboard_mood}/10` : null,
        l.dashboard_bodyfat != null && l.dashboard_bodyfat !== '' ? `Body fat ${l.dashboard_bodyfat}%` : null,
        l.dashboard_workout_rating != null && l.dashboard_workout_rating !== '' ? `Workout rating ${l.dashboard_workout_rating}/10` : null,
        workoutSummary ? `Workout: ${workoutSummary}` : null,
        l.dashboard_notes ? `Note: ${String(l.dashboard_notes).slice(0, 120)}` : null,
      ].filter(Boolean);
      return `${dayLabel}: ${parts.join(', ')}`;
    })
    .join('\n');

  const prompt = `
You are a professional fitness coach writing an IN-DEPTH weekly report for a trainer. The data below comes from this client's DAILY LOGS. Use every number and note; be specific and analytical.

Week: ${weekStart} to ${weekEnd}

DAY-BY-DAY (from daily logs — use ALL of this in your report):
${dayByDay}

TOTALS / AVERAGES:
- Avg sleep: ${avgSleep} hrs | Avg water: ${avgWater} oz | Avg steps: ${avgSteps} | Avg energy: ${avgEnergy}/5
- Avg soreness: ${avgSoreness}/10 | Avg stress: ${avgStress}/10 | Avg mood: ${avgMood}/10 (use only if present in data)
- Weight: ${avgWeight} lbs (avg) | Workouts: ${workouts.length} day(s) — ${workouts.join('; ') || 'none'}
- Client notes this week: ${notes.length ? notes.map((n) => `"${String(n).slice(0, 150)}"`).join(' | ') : 'None'}

Write a detailed, evidence-based report. Every bullet and sentence must cite actual numbers or days from the data above. No generic advice.

- dayBreakdown: REQUIRED. Array of exactly 7 strings (Mon–Sun). For each day write 2–3 sentences: all metrics (sleep, water, steps, energy, soreness, stress, mood, weight, workout, note) that appear in the data. Call out patterns (e.g. "low sleep may explain lower energy"). No data = "No check-in."
- summary: 6–10 sentences. Open with overall takeaway. Then: compare early vs late week, best/worst days for key metrics, how notes relate to numbers. Name specific days and numbers.
- trends: REQUIRED. Array of 4–6 short bullets describing week-over-week or day-to-day patterns (e.g. "Sleep improved from 6h Mon–Tue to 7.5h Fri–Sat", "Steps dropped Wed–Thu then recovered", "Stress and mood moved together"). Use only data from above.
- pros: 4–5 bullets of what went well, each with a number or day.
- cons: 3–4 bullets of what to improve, specific and actionable, with numbers where relevant.
- wins: 4–5 concrete wins (e.g. "Hit 64oz water 5/7 days", "Logged 4 workouts").
- focus: 4–5 specific goals for next week (measurable where possible).
- signOff: 1–2 sentences that reference something specific from their week.

Return ONLY valid JSON, no markdown or extra text:
{
  "dayBreakdown": ["string", "string", "string", "string", "string", "string", "string"],
  "summary": "string",
  "trends": ["string", "string", "string", "string"],
  "pros": ["string", "string", "string", "string"],
  "cons": ["string", "string", "string"],
  "wins": ["string", "string", "string", "string"],
  "focus": ["string", "string", "string", "string"],
  "signOff": "string"
}
`;

  const message = await anthropic.messages.create({
    model: 'claude-3-haiku-20240307',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });
  let raw = (message.content?.[0]?.text || '').trim();
  raw = raw.replace(/^\s*```\w*\s*/i, '').replace(/\s*```\s*$/m, '').trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    logger.error('Weekly summary JSON parse failed', { clientId, rawPreview: raw.slice(0, 200) });
    throw parseErr;
  }

  await db.collection('users').doc(clientId).collection('weeklySummaries').doc(weekStart).set({
    weekStart,
    weekEnd,
    dayBreakdown: Array.isArray(parsed.dayBreakdown) ? parsed.dayBreakdown : [],
    summary: parsed.summary,
    trends: Array.isArray(parsed.trends) ? parsed.trends : [],
    pros: Array.isArray(parsed.pros) ? parsed.pros : [],
    cons: Array.isArray(parsed.cons) ? parsed.cons : [],
    wins: Array.isArray(parsed.wins) ? parsed.wins : [],
    focus: Array.isArray(parsed.focus) ? parsed.focus : [],
    signOff: parsed.signOff,
    avgSleep,
    avgWater,
    avgSteps,
    avgEnergy,
    avgWeight,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { weekStart, weekEnd, generated: true };
}

/**
 * Scheduled: Generate weekly summaries every Monday at 1:00 AM America/New_York.
 * Secrets: CLAUDE_API_KEY
 */
exports.generateWeeklySummaries = onSchedule(
  {
    schedule: 'every monday 01:00',
    timeZone: 'America/New_York',
    secrets: ['CLAUDE_API_KEY'],
  },
  async () => {
    try {
      const result = await runWeeklySummaryGeneration();
      logger.info('Weekly summaries generation completed', result);
    } catch (error) {
      logger.error('generateWeeklySummaries error', { error: error?.message || String(error) });
    }
  }
);

/**
 * Callable: Generate weekly report for one client on demand (when trainer views client and no report exists).
 * Body: { clientId: string }. Requires auth.
 */
exports.generateWeeklySummaryForClient = onCall(
  { secrets: ['CLAUDE_API_KEY'], timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const clientId = request.data?.clientId;
    if (!clientId || typeof clientId !== 'string') throw new HttpsError('invalid-argument', 'clientId required');
    try {
      return await generateWeeklySummaryForClient(clientId);
    } catch (error) {
      logger.error('generateWeeklySummaryForClient error', { clientId, error: error?.message || String(error) });
      throw new HttpsError('internal', error?.message || 'Failed to generate report.');
    }
  }
);

/**
 * Callable: Generate weekly report for one client for a specific weekStart (YYYY-MM-DD, Monday).
 * Body: { clientId: string, weekStart: string }. Requires auth.
 */
exports.generateWeeklySummaryForClientForWeek = onCall(
  { secrets: ['CLAUDE_API_KEY'], timeoutSeconds: 540 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const clientId = request.data?.clientId;
    const weekStart = request.data?.weekStart;
    if (!clientId || typeof clientId !== 'string') {
      throw new HttpsError('invalid-argument', 'clientId required');
    }
    if (!weekStart || typeof weekStart !== 'string') {
      throw new HttpsError('invalid-argument', 'weekStart (YYYY-MM-DD) required');
    }
    try {
      return await generateWeeklySummaryForClient(clientId, weekStart);
    } catch (error) {
      logger.error('generateWeeklySummaryForClientForWeek error', {
        clientId,
        weekStart,
        error: error?.message || String(error),
      });
      throw new HttpsError('internal', error?.message || 'Failed to generate report for specified week.');
    }
  }
);

/**
 * Callable: Link client to trainer via invite code. Bypasses Firestore rules (Admin SDK).
 * Body: { clientId: string, trainerId: string }. Client must be authenticated and can only link their own account.
 */
exports.linkClientWithTrainerCode = onCall(async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');

  const { clientId, trainerId } = request.data || {};

  if (request.auth.uid !== clientId) {
    throw new HttpsError('permission-denied', 'Can only link your own account.');
  }

  if (!trainerId || typeof trainerId !== 'string') {
    throw new HttpsError('invalid-argument', 'trainerId required.');
  }

  const trainerDoc = await db.collection('users').doc(trainerId).get();
  if (!trainerDoc.exists || trainerDoc.data()?.role !== 'trainer') {
    throw new HttpsError('invalid-argument', 'Invalid trainer.');
  }

  await db
    .collection('trainer_clients')
    .doc(trainerId)
    .collection('clients')
    .doc(clientId)
    .set(
      {
        id: clientId,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'active',
      },
      { merge: true }
    );

  await db
    .collection('trainer_client_links')
    .doc(`${trainerId}_${clientId}`)
    .set(
      {
        trainerId,
        clientId,
        joinedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

  return { success: true };
});

/**
 * Callable: Remove trainer–client relationship.
 * Body: { trainerId, clientId, reasons?, otherText?, removedBy: 'client' | 'trainer' }.
 * Uses Admin SDK so it is not blocked by client Firestore rules.
 */
exports.removeTrainerClientLink = onCall(async (request) => {
  const { trainerId, clientId, reasons = [], otherText = null, removedBy } = request.data || {};

  if (!trainerId || !clientId) {
    throw new HttpsError('invalid-argument', 'trainerId and clientId are required.');
  }
  // Note: auth check intentionally relaxed for now to unblock development.
  // In production, consider re-enabling request.auth validation.

  const batch = db.batch();
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    // Log removal reasons
    const reasonsRef = db.collection('removalReasons').doc();
    batch.set(reasonsRef, {
      trainerId,
      clientId,
      reasons: Array.isArray(reasons) ? reasons : [],
      otherText: otherText || null,
      removedAt: now,
      removedBy: removedBy === 'trainer' || removedBy === 'client' ? removedBy : 'unknown',
    });

    // Remove from trainer_clients subcollection
    const trainerClientRef = db
      .collection('trainer_clients')
      .doc(trainerId)
      .collection('clients')
      .doc(clientId);
    batch.delete(trainerClientRef);

    // Remove from flat trainer_client_links
    const linkId = `${trainerId}_${clientId}`;
    const linkRef = db.collection('trainer_client_links').doc(linkId);
    batch.delete(linkRef);

    // Clear trainerId on user doc
    const userRef = db.collection('users').doc(clientId);
    batch.set(
      userRef,
      { trainerId: null, trainerRemovedAt: now },
      { merge: true }
    );

    await batch.commit();

    // Archive any conversations between this trainer and client
    const convSnap = await db
      .collection('conversations')
      .where('trainerId', '==', trainerId)
      .where('clientId', '==', clientId)
      .get();

    const archivePromises = [];
    convSnap.forEach((docSnap) => {
      archivePromises.push(
        docSnap.ref.set(
          { archived: true, archivedAt: now },
          { merge: true }
        )
      );
    });
    if (archivePromises.length) {
      await Promise.all(archivePromises);
    }

    return { success: true };
  } catch (error) {
    logger.error('removeTrainerClientLink error', {
      trainerId,
      clientId,
      error: error?.message || String(error),
    });
    throw new HttpsError('internal', error?.message || 'Failed to remove trainer.');
  }
});