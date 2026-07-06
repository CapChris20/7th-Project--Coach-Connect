const admin = require('firebase-admin');
const axios = require('axios');
const { randomUUID } = require('crypto');
const { isoDateKey, serverTs } = require('../serverCommon');
const { estimateCost, isWithinMonthlyLimit } = require('../../config/apiCosts');
const { isAiCoachLimitsEnforced } = require('../aiCoachRateLimit');
const { resolveAiCoachDailyLimit } = require('../aiCoachRateLimit');
const { serperOrganicSearch } = require('../serperWebSearch');
const { COACH_VOICE_DIRECTIVE, COACH_WEB_SEARCH_FORMAT } = require('../coachVoice');
const { filterFitnessWebSources, stripWebSearchPrefix } = require('../coachWebSearch');
const { stripNotificationEmoji: pushStripNotificationEmoji } = require('../../pushHelpers');
const logger = require('../logger');

function resolveDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || null;
}
function resolveAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || null;
}
function resolvePerplexityKey() {
  return process.env.PERPLEXITY_API_KEY || process.env.PPLX_API_KEY || null;
}

async function callPerplexity({ apiKey, systemPrompt, messages }) {
  const url = 'https://api.perplexity.ai/chat/completions';
  const payload = {
    model: 'pplx-70b-online',
    messages: [{ role: 'system', content: systemPrompt }, ...(Array.isArray(messages) ? messages : [])],
    temperature: 0.7,
    max_tokens: 1200,
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
    max_tokens: 1200,
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

async function checkMonthlyApiBudget(apiName) {
  if (!admin.apps.length) return true;
  try {
    const db = admin.firestore();
    return await isWithinMonthlyLimit(apiName, db);
  } catch (e) {
    console.warn('checkMonthlyApiBudget failed:', e?.message || e);
    return true;
  }
}

async function enforceDailyMessageLimit(userId, limit = 30) {
  if (!isAiCoachLimitsEnforced()) {
    return { allowed: true, remaining: null, limit: null, resetsAt: null };
  }
  if (!admin.apps.length) return { allowed: true, remaining: null, limit: null, resetsAt: null };
  const db = admin.firestore();
  const date = isoDateKey();
  const ref = db.collection('users').doc(userId).collection('usage').doc(`aiCoach_${date}`);
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists ? snap.data() || {} : {};
    const count = Number(cur.count || 0);
    if (count >= limit) return { allowed: false, remaining: 0 };
    tx.set(ref, { count: count + 1, date, limit, updatedAt: serverTs() }, { merge: true });
    return { allowed: true, remaining: Math.max(0, limit - (count + 1)) };
  });
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  tomorrow.setUTCHours(0, 0, 0, 0);
  return {
    ...result,
    limit,
    resetsAt: tomorrow.toISOString(),
  };
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

const normalizeCoachMessages = (messages) => {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((m) => {
      const role =
        m?.role === 'assistant' || m?.role === 'ai' || m?.role === 'system'
          ? m.role === 'system'
            ? 'system'
            : 'assistant'
          : 'user';
      const content =
        typeof m?.content === 'string'
          ? m.content
          : typeof m?.text === 'string'
            ? m.text
            : '';
      const out = { role, content };
      if (role === 'assistant' && Array.isArray(m.webSources) && m.webSources.length > 0) {
        out.webSources = m.webSources
          .filter((s) => s && (s.url || s.title))
          .slice(0, 12)
          .map((s) => ({
            title: String(s.title || '').trim(),
            url: String(s.url || s.link || '').trim(),
            snippet: String(s.snippet || '').trim(),
          }));
      }
      if (role === 'assistant' && m.searchedWeb === true) out.searchedWeb = true;
      return out;
    })
    .filter((m) => m.content.trim().length > 0)
    .slice(-40);
};

function coachMessagesForLlm(messages) {
  return (Array.isArray(messages) ? messages : []).map((m) => ({
    role: m.role === 'system' ? 'system' : m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));
}

function normalizeWebSources(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    let url = '';
    let title = '';
    let snippet = '';
    if (typeof item === 'string') {
      url = item.trim();
      try {
        title = new URL(url).hostname.replace(/^www\./i, '');
      } catch (_) {
        title = url;
      }
    } else if (item && typeof item === 'object') {
      url = String(item.url || item.link || '').trim();
      title = String(item.title || '').trim();
      snippet = String(item.snippet || '').trim();
      if (!title && url) {
        try {
          title = new URL(url).hostname.replace(/^www\./i, '');
        } catch (_) {
          title = url;
        }
      }
    }
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      id: `src_${out.length}`,
      title: title || url,
      url,
      snippet: snippet.slice(0, 280),
    });
    if (out.length >= 8) break;
  }
  return out;
}

function extractPerplexityWebSources(data) {
  const fromResults = Array.isArray(data?.search_results)
    ? data.search_results.map((r) => ({
        title: r?.title,
        url: r?.url,
        snippet: r?.snippet || '',
      }))
    : [];
  if (fromResults.length) return normalizeWebSources(fromResults);
  return normalizeWebSources(Array.isArray(data?.citations) ? data.citations : []);
}

async function fetchSerperCoachSearch(query) {
  const items = await serperOrganicSearch(String(query || '').trim(), 8);
  if (!items.length) return { context: null, sources: [] };
  const sources = filterFitnessWebSources(
    normalizeWebSources(items.map((r) => ({ title: r.title, url: r.link, snippet: r.snippet }))),
  );
  if (!sources.length) return { context: null, sources: [] };
  const context = sources.map((r) => `- ${r.title} — ${r.url}\n${r.snippet || ''}`).join('\n');
  return { context, sources };
}

/** DeepSeek has no native browsing — prepend Serper snippets so it can answer with current web facts. */
async function augmentCoachPromptWithWebSearch(basePrompt, userText) {
  const { context, sources } = await fetchSerperCoachSearch(userText);
  if (!context) return { prompt: basePrompt, searchedWeb: false, webProvider: null, webSources: [] };
  return {
    prompt: `${basePrompt}

WEB SEARCH RESULTS (Serper — use for current facts; mention source names in plain sentences when citing):
${context}
END WEB SEARCH RESULTS`,
    searchedWeb: true,
    webProvider: 'serper',
    webSources: sources,
  };
}

async function callDeepSeekCoach({ apiKey, systemPrompt, messages }) {
  const url = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';
  const payload = {
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
    temperature: 0.7,
    max_tokens: 1200,
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

function buildPerplexityWebMessages(messages, searchQuery) {
  const cleanQuery = stripWebSearchPrefix(searchQuery) || String(searchQuery || '').trim();
  if (!cleanQuery) {
    return Array.isArray(messages) ? messages.slice(-4) : [];
  }
  return [{ role: 'user', content: cleanQuery }];
}

const PERPLEXITY_WEB_SYSTEM = `${COACH_VOICE_DIRECTIVE}
${COACH_WEB_SEARCH_FORMAT}

WEB SEARCH MODE:
You have live internet access. Search the web and answer using current sources.
Follow the WEB SEARCH REPLY FORMAT above — opening line, ## What it is, ## Key findings, ## Practical notes, ## Suggested follow-ups. Never one long paragraph.
Cite sources as [Source Name] after claims.`;

async function callPerplexityCoach({ apiKey, systemPrompt, messages, searchQuery = '' }) {
  const url = 'https://api.perplexity.ai/chat/completions';
  const perplexityMessages = buildPerplexityWebMessages(messages, searchQuery);
  const payload = {
    model: process.env.PERPLEXITY_MODEL || 'sonar',
    messages: [
      { role: 'system', content: searchQuery ? PERPLEXITY_WEB_SYSTEM : systemPrompt },
      ...perplexityMessages,
    ],
    temperature: 0.5,
    max_tokens: 1400,
    return_citations: true,
  };

  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 45000,
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
  return { text, webSources: extractPerplexityWebSources(resp?.data || {}) };
}

const WEEKLY_FETCH_FAILURE_NOTE =
  '\n\nNOTE: Weekly data failed to load for this request. Answer from profile only. Do not imply you have access to logs, food data, sleep, steps, or workout history for this conversation.';

module.exports = {
  resolveDeepSeekKey,
  resolveAnthropicKey,
  resolvePerplexityKey,
  callPerplexity,
  callDeepSeek,
  callClaude,
  logAPIUsage,
  checkMonthlyApiBudget,
  enforceDailyMessageLimit,
  detectFatigue,
  sendExpoPushSingle,
  createAlert,
  coachMessagesForLlm,
  normalizeCoachMessages,
  normalizeWebSources,
  extractPerplexityWebSources,
  fetchSerperCoachSearch,
  augmentCoachPromptWithWebSearch,
  callDeepSeekCoach,
  callDeepSeekChat,
  callClaudeCoach,
  buildPerplexityWebMessages,
  callPerplexityCoach,
  WEEKLY_FETCH_FAILURE_NOTE,
};
