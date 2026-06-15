/**
 * Firebase Cloud Functions
 *
 * - OpenAI Realtime API WebSocket Proxy (v2 HTTPS)
 * - Weekly client summaries (deterministic from dailyLogs; v2 scheduler)
 */

const functions = require('firebase-functions/v2');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const express = require('express');
const { WebSocketServer, WebSocket } = require('ws');
const cors = require('cors');
const admin = require('firebase-admin');
// Week calculations are done server-side; use explicit timezone for consistency
const moment = require('moment-timezone');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

/**
 * DELETE ACCOUNT (App Store requirement)
 *
 * HTTPS endpoint: POST /auth/deleteAccount
 * - Requires Firebase ID token in Authorization header
 * - Only allows deleting the caller's own account
 * - Purges:
 *   - Auth user
 *   - All Firestore data under users/{uid} (doc + subcollections)
 *   - All Storage files under users/{uid}/
 */
const authApp = express();
authApp.use(cors());
authApp.use(express.json({ limit: '1mb' }));

async function verifyFirebaseIdToken(req) {
  const header = req.headers.authorization || req.headers.Authorization || '';
  const match = typeof header === 'string' ? header.match(/^Bearer (.+)$/i) : null;
  const token = match?.[1];
  if (!token) {
    const err = new Error('Missing Authorization bearer token');
    err.statusCode = 401;
    throw err;
  }
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (e) {
    const err = new Error('Invalid or expired auth token');
    err.statusCode = 401;
    err.cause = e;
    throw err;
  }
}

async function purgeUserFirestore(uid) {
  const userRef = db.collection('users').doc(uid);
  // Admin SDK recursive delete removes doc + all nested subcollections.
  // Uses BulkWriter under the hood for scale.
  await db.recursiveDelete(userRef);
}

async function purgeUserStorage(uid) {
  const prefix = `users/${uid}/`;
  // Best-effort: delete all files under prefix. Non-existent prefix is fine.
  await bucket.deleteFiles({ prefix });
}

exports.deleteAccount = onCall(
  {
    timeoutSeconds: 540,
  },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in.');
    const uid = request.auth.uid;
    try {
      await purgeUserFirestore(uid);
      await purgeUserStorage(uid);
      try {
        await admin.auth().deleteUser(uid);
      } catch (e) {
        const code = e?.code || e?.errorInfo?.code || '';
        if (!String(code).includes('auth/user-not-found')) throw e;
      }
      return { ok: true };
    } catch (e) {
      logger.error('deleteAccount callable failed', { uid, error: e?.message || String(e) });
      throw new HttpsError('internal', e?.message || 'Delete failed');
    }
  }
);

authApp.post('/deleteAccount', async (req, res) => {
  try {
    const decoded = await verifyFirebaseIdToken(req);
    const userId = req.body?.userId;
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ ok: false, error: 'userId is required' });
    }
    if (decoded.uid !== userId) {
      return res.status(403).json({ ok: false, error: 'Can only delete your own account' });
    }

    // Order: purge user data first, then delete auth record.
    // (If auth is deleted first, clients may lose ability to retry on flaky networks.)
    await purgeUserFirestore(userId);
    await purgeUserStorage(userId);

    // Idempotent-ish: if already deleted, treat as success.
    try {
      await admin.auth().deleteUser(userId);
    } catch (e) {
      const code = e?.code || e?.errorInfo?.code || '';
      if (!String(code).includes('auth/user-not-found')) throw e;
    }

    return res.json({ ok: true });
  } catch (e) {
    const status = e?.statusCode || 500;
    logger.error('auth.deleteAccount failed', { status, error: e?.message || String(e) });
    return res.status(status).json({ ok: false, error: e?.message || 'Delete failed' });
  }
});

exports.auth = functions.https.onRequest(
  {
    cors: true,
    timeoutSeconds: 540,
    maxInstances: 10,
  },
  authApp
);

/** Format HH:mm (24h) for notification body */
function formatTime12(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return '';
  const parts = hhmm.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  if (Number.isNaN(h)) return hhmm;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(Number.isNaN(m) ? 0 : m).padStart(2, '0')} ${ampm}`;
}

/** Format YYYY-MM-DD for notification body */
function formatDateShort(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/**
 * Send push via Expo Push API (same token format as ClientApp — ExponentPushToken[...]).
 */
const { stripNotificationEmoji } = require('./stripNotificationEmoji');

async function sendExpoPushNotification(to, title, body, data = {}) {
  if (!to || typeof to !== 'string') return { skipped: true, reason: 'no_token' };
  if (!to.startsWith('ExponentPushToken[') && !to.startsWith('ExpoPushToken[')) {
    logger.warn('sendExpoPushNotification: non-Expo token', { prefix: to.slice(0, 24) });
    return { skipped: true, reason: 'invalid_token_format' };
  }

  const cleanTitle = stripNotificationEmoji(title) || 'CoachConnect';
  let cleanBody = stripNotificationEmoji(String(body || ''));
  if (!cleanBody.trim()) cleanBody = 'Open CoachConnect';

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to,
      title: cleanTitle,
      body: cleanBody,
      sound: 'default',
      priority: 'high',
      channelId: 'default',
      interruptionLevel: 'active',
      data: typeof data === 'object' && data !== null ? data : {},
    }),
  });

  const json = await res.json().catch(() => ({}));
  const ticket = json?.data?.[0];
  if (ticket?.status === 'error') {
    logger.error('Expo push ticket error', { message: ticket.message, details: ticket.details });
    return { ok: false, error: ticket.message };
  }
  return { ok: true, ticket };
}

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

/** Must match client `getDateKey` / dailyLogs doc IDs (America/New_York). */
const WEEK_SUMMARY_TZ = 'America/New_York';

/**
 * Compute last week's Monday (weekStart) and Sunday (weekEnd) in ET.
 * "Last week" = the calendar Mon–Sun block before the current week (same as before, but
 * all math in America/New_York so Cloud Functions UTC runtime cannot skew days).
 */
function getLastWeekBounds() {
  const today = moment.tz(WEEK_SUMMARY_TZ);
  // Calendar week Mon–Sun in ET (same intent as legacy): Monday of this week, then go back 7 days.
  const dow = today.day(); // 0 Sun … 6 Sat
  const daysSinceMonday = (dow + 6) % 7; // Mon → 0, Sun → 6
  const thisMonday = today.clone().subtract(daysSinceMonday, 'days').startOf('day');
  const lastMonday = thisMonday.clone().subtract(7, 'days');
  const lastSunday = lastMonday.clone().add(6, 'days');
  return {
    weekStart: lastMonday.format('YYYY-MM-DD'),
    weekEnd: lastSunday.format('YYYY-MM-DD'),
  };
}

/**
 * Load dailyLogs for each calendar day of the week (ET keys). Returns aligned 7 slots
 * plus `logs` (only days with a doc) for averages — same keys the app writes.
 */
async function fetchDailyLogsForWeek(clientId, weekStart, weekEnd) {
  const start = moment.tz(weekStart, 'YYYY-MM-DD', WEEK_SUMMARY_TZ);
  const end = moment.tz(weekEnd, 'YYYY-MM-DD', WEEK_SUMMARY_TZ);
  const logByDay = [];
  for (let d = start.clone(); d.isSameOrBefore(end, 'day'); d.add(1, 'day')) {
    const dateKey = d.format('YYYY-MM-DD');
    const dailySnap = await db.collection('users').doc(clientId).collection('dailyLogs').doc(dateKey).get();
    logByDay.push(dailySnap.exists ? dailySnap.data() : null);
  }
  const logs = logByDay.filter(Boolean);
  return { logByDay, logs };
}

const WEEKDAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function parseMetricNumber(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function workoutSnippetFromLog(l) {
  if (!l) return null;
  if (Array.isArray(l.workoutLog) && l.workoutLog.length > 0) {
    const exSummaries = l.workoutLog
      .filter((ex) => ex && ex.exerciseName)
      .map((ex) => {
        const sets = Array.isArray(ex.sets) ? ex.sets : [];
        const setStrings = sets.map((s) => `${s.reps || 0}×${s.weight || 0}`);
        return `${ex.exerciseName} (${sets.length} sets${setStrings.length ? `: ${setStrings.join(', ')}` : ''})`;
      });
    if (exSummaries.length > 0) return exSummaries.join('; ');
  }
  const dw = l.dashboard_workouts;
  if (dw != null && String(dw).trim()) return String(dw).trim().slice(0, 200);
  return null;
}

/** One line per day — matches `trainer/components/weeklyReport/WeeklyReportPremium.parseDayNote` (`Day (YYYY-MM-DD): note`). */
function dayLineForWeeklyReport(dayLabel, dateStr, log) {
  const heading = `${dayLabel} (${dateStr})`;
  if (!log) {
    return `${heading}: No check-in for this day.`;
  }
  const chunks = [];
  const slp = parseMetricNumber(log.dashboard_sleep);
  if (slp != null) chunks.push(`Sleep ${slp} h`);
  const wtr = parseMetricNumber(log.dashboard_water);
  if (wtr != null) chunks.push(`Water ${wtr} oz`);
  const steps = parseMetricNumber(log.dashboard_steps);
  if (steps != null) chunks.push(`${Math.round(steps)} steps`);
  const ene = parseMetricNumber(log.dashboard_energy);
  if (ene != null) chunks.push(`energy ${ene}/5`);
  const mood = parseMetricNumber(log.dashboard_mood);
  if (mood != null) chunks.push(`mood ${mood}/10`);
  const str = parseMetricNumber(log.dashboard_stress);
  if (str != null) chunks.push(`Stress ${str}/10`);
  const sor = parseMetricNumber(log.dashboard_soreness);
  if (sor != null) chunks.push(`Soreness ${sor}/10`);
  const wt = parseMetricNumber(log.dashboard_weight);
  if (wt != null) chunks.push(`Weight ${wt} lbs`);
  const wr = parseMetricNumber(log.dashboard_workout_rating);
  if (wr != null) chunks.push(`workout rating ${wr}/10`);
  if (log.dashboard_bodyfat != null && String(log.dashboard_bodyfat).trim()) {
    chunks.push(`Body fat ${String(log.dashboard_bodyfat).trim()}%`);
  }
  const wsnip = workoutSnippetFromLog(log);
  if (wsnip) chunks.push(`Workout: ${wsnip}`);
  if (log.dashboard_notes && String(log.dashboard_notes).trim()) {
    chunks.push(`Note: ${String(log.dashboard_notes).trim().slice(0, 140)}`);
  }
  const body = chunks.length
    ? `${chunks.join('. ')}.`
    : 'Check-in logged; add metrics next time for a fuller snapshot.';
  return `${heading}: ${body}`;
}

/**
 * Same Firestore JSON shape as the former Claude path — templates + arithmetic only.
 */
function buildDeterministicWeeklyReport({ logByDay, weekStart, weekEnd, avgSleep, avgWater, avgSteps, avgEnergy, avgWeight }) {
  const startM = moment.tz(weekStart, 'YYYY-MM-DD', WEEK_SUMMARY_TZ);
  const dayBreakdown = logByDay.map((l, i) => {
    const dateStr = startM.clone().add(i, 'days').format('YYYY-MM-DD');
    const label = WEEKDAY_LABELS[i] || `Day ${i + 1}`;
    return dayLineForWeeklyReport(label, dateStr, l);
  });

  const nLogged = logByDay.filter(Boolean).length;
  const sleepVals = logByDay
    .map((l, i) => {
      if (!l) return null;
      const n = parseMetricNumber(l.dashboard_sleep);
      if (n == null) return null;
      return { n, d: startM.clone().add(i, 'days').format('YYYY-MM-DD') };
    })
    .filter(Boolean);
  const waterVals = logByDay
    .map((l, i) => {
      if (!l) return null;
      const n = parseMetricNumber(l.dashboard_water);
      if (n == null) return null;
      return { n, d: startM.clone().add(i, 'days').format('YYYY-MM-DD') };
    })
    .filter(Boolean);
  const stepVals = logByDay
    .map((l, i) => {
      if (!l) return null;
      const n = parseMetricNumber(l.dashboard_steps);
      if (n == null) return null;
      return { n, d: startM.clone().add(i, 'days').format('YYYY-MM-DD') };
    })
    .filter(Boolean);
  const highWaterDays = waterVals.filter((x) => x.n >= 64).length;
  const workoutDays = logByDay.filter((l) => {
    if (!l) return false;
    if (workoutSnippetFromLog(l)) return true;
    const t = String(l.dashboard_workouts || '').toLowerCase();
    return Boolean(t) && !/\brest\b|off day|recovery|no workout|take a rest/i.test(t);
  }).length;

  let summary = `Between ${weekStart} and ${weekEnd}, you logged ${nLogged} of 7 daily check-ins. `;
  summary += `Week averages: sleep ${avgSleep} h, water ${avgWater} oz, steps ${avgSteps}, energy ${avgEnergy}/5`;
  if (avgWeight && avgWeight !== 'N/A') summary += `, weight ${avgWeight} lbs`;
  summary += '. ';
  if (sleepVals.length >= 2) {
    const sorted = [...sleepVals].sort((a, b) => a.n - b.n);
    const lo = sorted[0];
    const hi = sorted[sorted.length - 1];
    if (hi.n > lo.n) summary += `Sleep ranged from ${lo.n} h (${lo.d}) to ${hi.n} h (${hi.d}). `;
  } else if (sleepVals.length === 1) {
    summary += `Sleep logged on ${sleepVals[0].d}: ${sleepVals[0].n} h. `;
  }
  if (waterVals.length) {
    summary += `${highWaterDays} day(s) met or exceeded 64 oz water. `;
  }
  summary += `${workoutDays} day(s) included a workout or training log. `;
  summary +=
    'This recap is generated from your logged metrics (no AI). Keep logging daily for clearer trends next week.';

  const trends = [];
  trends.push(
    nLogged >= 6
      ? 'Strong check-in streak: most days have data this week.'
      : nLogged >= 4
        ? 'Moderate consistency: over half the week logged.'
        : `Check-in presence: ${nLogged}/7 days — add missing days to tighten trends.`,
  );
  if (sleepVals.length >= 2) {
    const sorted = [...sleepVals].sort((a, b) => a.n - b.n);
    trends.push(`Sleep varied from ${sorted[0].n} h to ${sorted[sorted.length - 1].n} h across logged days.`);
  } else if (avgSleep && avgSleep !== 'N/A') {
    trends.push(`Average sleep where logged: ${avgSleep} h.`);
  } else {
    trends.push('Sleep: add nightly sleep hours to see rhythm trends.');
  }
  if (waterVals.length) {
    const avgW = waterVals.reduce((a, x) => a + x.n, 0) / waterVals.length;
    trends.push(`Hydration center of mass ~${avgW.toFixed(0)} oz on days with water entries.`);
  } else {
    trends.push('Hydration: log water intake to surface weekly hydration patterns.');
  }
  if (stepVals.length) {
    const avgS = stepVals.reduce((a, x) => a + x.n, 0) / stepVals.length;
    trends.push(`Movement: ~${Math.round(avgS)} steps on average across days with step data.`);
  } else {
    trends.push('Movement: add daily steps to compare weekday vs weekend activity.');
  }

  const wins = [];
  if (nLogged === 7) wins.push('Perfect week: 7/7 check-ins logged.');
  else if (nLogged >= 5) wins.push(`${nLogged}/7 check-ins — strong logging habit.`);
  if (highWaterDays >= 4) wins.push(`Hydration: ${highWaterDays} days at 64+ oz.`);
  if (workoutDays >= 4) wins.push(`${workoutDays} training days recorded this week.`);
  const goodSleep = sleepVals.filter((x) => x.n >= 7).length;
  if (goodSleep >= 3) wins.push(`${goodSleep} nights at 7+ h sleep on logged days.`);
  const avgE = parseMetricNumber(avgEnergy);
  if (avgE != null && avgE >= 3.5) wins.push(`Average energy ${avgEnergy}/5 — steady readiness signal.`);
  while (wins.length < 4) {
    wins.push('Consistency builds clarity: partial logs still help your coach spot patterns.');
  }

  const cons = [];
  if (nLogged < 7) cons.push(`Fill in ${7 - nLogged} missing day(s) to remove blind spots in trends.`);
  const avgSlp = parseMetricNumber(avgSleep);
  if (avgSlp != null && avgSlp < 7) {
    cons.push(`Average sleep under 7 h (${avgSleep} h) — prioritize wind-down and consistency.`);
  }
  if (waterVals.length && highWaterDays < 3) {
    cons.push('Hydration gaps: fewer than 3 days hit the 64 oz target.');
  }
  if (workoutDays <= 2 && nLogged >= 4) {
    cons.push('Training volume on the lower side — confirm planned rest vs missed sessions.');
  }
  while (cons.length < 3) {
    cons.push('Pick one metric (sleep, water, or steps) to improve measurably next week.');
  }

  const pros = [];
  pros.push(
    nLogged >= 5 ? `Reliable data trail: ${nLogged} check-ins give trustworthy averages.` : 'Every logged day improves report accuracy.',
  );
  if (workoutDays > 0) pros.push('Training entries give your coach context on load and recovery.');
  pros.push(
    highWaterDays >= 3 ? 'Solid hydration attention on multiple days.' : 'Hydration fields are ready when you fill them.',
  );
  pros.push(`Energy tracking averaged ${avgEnergy}/5 across entries (where logged).`);
  pros.push('Auto report uses the same numbers you already log — no manual recap needed.');
  while (pros.length < 4) {
    pros.push('Keep capturing notes; context pairs well with metrics.');
  }

  const focus = [];
  focus.push('Log every day next week to unlock day-by-day comparisons.');
  if (avgSlp != null && avgSlp < 7) {
    focus.push('Pick 2–3 anchor nights for 7+ h sleep and protect them on the calendar.');
  }
  if (highWaterDays < 5) focus.push('Aim for 64+ oz water on at least 5 days.');
  focus.push('Add post-workout rating on heavy days to track readiness vs load.');
  while (focus.length < 4) {
    focus.push('Stack one micro-habit (5–10 minutes) on your lowest-logged weekday.');
  }

  const signOff =
    nLogged >= 1
      ? `You showed up ${nLogged} time${nLogged === 1 ? '' : 's'} this week — carry that momentum forward.`
      : 'Start fresh next week: one quick check-in sets the tone.';

  return {
    dayBreakdown,
    summary: summary.trim(),
    trends: trends.slice(0, 6),
    pros: pros.slice(0, 5),
    cons: cons.slice(0, 4),
    wins: wins.slice(0, 5),
    focus: focus.slice(0, 5),
    signOff,
  };
}

function firestoreWeeklySummaryFields(parsed, extras) {
  return {
    weekStart: extras.weekStart,
    weekEnd: extras.weekEnd,
    dayBreakdown: Array.isArray(parsed.dayBreakdown) ? parsed.dayBreakdown : [],
    summary: parsed.summary,
    trends: Array.isArray(parsed.trends) ? parsed.trends : [],
    pros: Array.isArray(parsed.pros) ? parsed.pros : [],
    cons: Array.isArray(parsed.cons) ? parsed.cons : [],
    wins: Array.isArray(parsed.wins) ? parsed.wins : [],
    focus: Array.isArray(parsed.focus) ? parsed.focus : [],
    signOff: parsed.signOff,
    avgSleep: extras.avgSleep,
    avgWater: extras.avgWater,
    avgSteps: extras.avgSteps,
    avgEnergy: extras.avgEnergy,
    avgWeight: extras.avgWeight,
    source: 'deterministic',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
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
      const { logByDay, logs } = await fetchDailyLogsForWeek(clientId, weekStart, weekEnd);

      if (logs.length === 0) {
        skippedCount += 1;
        return;
      }

      const avgSleep = avg(logs.map((l) => l.dashboard_sleep).filter(Boolean));
      const avgWater = avg(logs.map((l) => l.dashboard_water).filter(Boolean));
      const avgSteps = avg(logs.map((l) => l.dashboard_steps).filter(Boolean));
      const avgEnergy = avg(logs.map((l) => l.dashboard_energy).filter(Boolean));
      const avgWeight = avg(logs.map((l) => l.dashboard_weight).filter(Boolean));

      const parsed = buildDeterministicWeeklyReport({
        logByDay,
        weekStart,
        weekEnd,
        avgSleep,
        avgWater,
        avgSteps,
        avgEnergy,
        avgWeight,
      });

      await db
        .collection('users')
        .doc(clientId)
        .collection('weeklySummaries')
        .doc(weekStart)
        .set(
          firestoreWeeklySummaryFields(parsed, {
            weekStart,
            weekEnd,
            avgSleep,
            avgWater,
            avgSteps,
            avgEnergy,
            avgWeight,
          }),
        );
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
    // Expect YYYY-MM-DD (Monday). Week end = +6 days, all in America/New_York.
    const start = moment.tz(weekStartOverride, 'YYYY-MM-DD', WEEK_SUMMARY_TZ);
    if (!start.isValid()) {
      throw new Error('Invalid weekStart; use YYYY-MM-DD');
    }
    weekStart = start.format('YYYY-MM-DD');
    weekEnd = start.clone().add(6, 'days').format('YYYY-MM-DD');
  } else {
    ({ weekStart, weekEnd } = getLastWeekBounds());
  }

  const userDoc = await db.collection('users').doc(clientId).get();
  if (!userDoc.exists || userDoc.data()?.role !== 'client') {
    return { weekStart, weekEnd, generated: false, reason: 'Not a client' };
  }

  const avg = (arr) =>
    arr.length ? (arr.reduce((a, b) => a + parseFloat(b), 0) / arr.length).toFixed(1) : 'N/A';

  const { logByDay, logs } = await fetchDailyLogsForWeek(clientId, weekStart, weekEnd);
  if (logs.length === 0) return { weekStart, weekEnd, generated: false, reason: 'No check-ins for last week' };

  const avgSleep = avg(logs.map((l) => l.dashboard_sleep).filter(Boolean));
  const avgWater = avg(logs.map((l) => l.dashboard_water).filter(Boolean));
  const avgSteps = avg(logs.map((l) => l.dashboard_steps).filter(Boolean));
  const avgEnergy = avg(logs.map((l) => l.dashboard_energy).filter(Boolean));
  const avgWeight = avg(logs.map((l) => l.dashboard_weight).filter(Boolean));

  const parsed = buildDeterministicWeeklyReport({
    logByDay,
    weekStart,
    weekEnd,
    avgSleep,
    avgWater,
    avgSteps,
    avgEnergy,
    avgWeight,
  });

  await db
    .collection('users')
    .doc(clientId)
    .collection('weeklySummaries')
    .doc(weekStart)
    .set(
      firestoreWeeklySummaryFields(parsed, {
        weekStart,
        weekEnd,
        avgSleep,
        avgWater,
        avgSteps,
        avgEnergy,
        avgWeight,
      }),
    );
  return { weekStart, weekEnd, generated: true };
}

/**
 * Scheduled: Generate weekly summaries (America/New_York).
 * Deterministic text from dailyLogs — no LLM. Writes `source: 'deterministic'`.
 *
 * Runs every Sunday 12:00 AM Eastern via Cloud Scheduler (Firebase creates the job).
 * After deploy, confirm in Google Cloud Console → Cloud Scheduler that the job exists
 * and in Logs Explorer filter `generateWeeklySummaries` or `Weekly summaries generation`.
 *
 * Week window: `getLastWeekBounds()` = previous ISO Mon–Sun in ET (fully completed before
 * this run). dailyLogs doc IDs must match ET
 * `YYYY-MM-DD` (same as app `getDateKey`).
 *
 * Skips a client entirely if they have zero dailyLogs in that window. Per-client errors
 * are logged and do not stop other clients.
 */
exports.generateWeeklySummaries = onSchedule(
  {
    schedule: 'every sunday 00:00',
    timeZone: 'America/New_York',
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
  { timeoutSeconds: 540 },
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
  { timeoutSeconds: 540 },
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
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  const callerUid = request.auth.uid;
  const callerIsTrainer = callerUid === trainerId;
  const callerIsClient = callerUid === clientId;
  if (!callerIsTrainer && !callerIsClient) {
    throw new HttpsError('permission-denied', 'Only linked trainer or client may remove this relationship.');
  }
  if (removedBy === 'trainer' && !callerIsTrainer) {
    throw new HttpsError('permission-denied', 'Only the trainer can set removedBy=trainer.');
  }
  if (removedBy === 'client' && !callerIsClient) {
    throw new HttpsError('permission-denied', 'Only the client can set removedBy=client.');
  }
  const effectiveRemovedBy = removedBy === 'trainer' || removedBy === 'client'
    ? removedBy
    : callerIsTrainer
      ? 'trainer'
      : 'client';

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
      removedBy: effectiveRemovedBy,
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

/**
 * When a trainer schedules a session (trainer_clients/{trainerId}/sessions/{sessionId}),
 * notify the client via Expo push if they have pushToken on users/{clientId}.
 */
exports.onTrainerSessionCreated = onDocumentCreated(
  'trainer_clients/{trainerId}/sessions/{sessionId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const trainerId = event.params.trainerId;
    const sessionId = event.params.sessionId;
    const data = snapshot.data() || {};

    const clientId = data.clientId;
    if (!clientId || typeof clientId !== 'string') {
      logger.warn('onTrainerSessionCreated: missing clientId', { sessionId, trainerId });
      return;
    }

    try {
      const [clientSnap, trainerSnap] = await Promise.all([
        db.collection('users').doc(clientId).get(),
        db.collection('users').doc(trainerId).get(),
      ]);

      const pushToken = clientSnap.data()?.expoPushToken || clientSnap.data()?.pushToken;
      if (!pushToken || typeof pushToken !== 'string') {
        logger.info('onTrainerSessionCreated: no Expo push token for client', { clientId, sessionId });
        return;
      }

      const coachLabel =
        trainerSnap.data()?.displayName ||
        trainerSnap.data()?.name ||
        'Your coach';

      const dateLabel = formatDateShort(String(data.date || ''));
      const timeLabel = formatTime12(String(data.time || ''));

      let body = `${coachLabel} scheduled a session with you.`;
      const bits = [];
      if (dateLabel) bits.push(dateLabel);
      if (timeLabel) bits.push(timeLabel);
      if (bits.length) body = `${coachLabel} scheduled a session for ${bits.join(' at ')}.`;

      const title = 'Session scheduled';

      await sendExpoPushNotification(pushToken, title, body, {
        type: 'session_scheduled',
        sessionId,
        trainerId,
        clientId,
      });

      logger.info('onTrainerSessionCreated: push sent', { clientId, sessionId, trainerId });
    } catch (err) {
      logger.error('onTrainerSessionCreated failed', {
        error: err?.message || String(err),
        sessionId,
        trainerId,
        clientId,
      });
    }
  }
);

// Day-14 macro recalibration (6 AM America/Detroit)
Object.assign(exports, require('./macroRecalibrationFunction'));