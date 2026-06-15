/**
 * AI Coach vision — OpenAI sees the image, DeepSeek writes coach voice.
 *
 * api.deepseek.com (deepseek-chat / v4-flash) is TEXT-ONLY — it rejects image_url.
 *
 * Preferred setup:
 *   OPENAI_API_KEY + DEEPSEEK_API_KEY
 *
 * Legacy fallback setup:
 *   1. REPLICATE_API_TOKEN — hosted deepseek-ai/deepseek-vl2
 *   2. DEEPSEEK_VISION_BASE_URL — OpenAI-compatible host for deepseek-ai/deepseek-vl2
 */
const axios = require('axios');
const logger = require('./logger');

const MAX_IMAGES = 2;
const MAX_DATA_URL_CHARS = 5_500_000;

const VISION_SYSTEM_ADDENDUM = `
PHOTO ANALYSIS (this turn):
The user attached photo(s). You CAN see them — describe what is actually visible.
- Progress / physique: note posture, lighting, angle limits; give constructive coaching feedback tied to their goal. Do not claim exact body-fat % or medical diagnoses.
- Food: describe the meal; estimate macros only if they ask or it fits the question.
- Form / exercise: comment on visible setup and cues; flag what you cannot see from the angle.
Never say you cannot see the image. If quality is poor, say what limits your read.`;

function resolveDeepSeekKey() {
  return process.env.DEEPSEEK_API_KEY || null;
}

function resolveDeepSeekVisionBaseUrl() {
  const raw = String(process.env.DEEPSEEK_VISION_BASE_URL || '').trim();
  return raw ? raw.replace(/\/$/, '') : null;
}

function resolveDeepSeekVisionApiKey() {
  return process.env.DEEPSEEK_VISION_API_KEY || process.env.DEEPSEEK_API_KEY || null;
}

function resolveOpenAIKey() {
  return process.env.OPENAI_API_KEY || null;
}

function resolveOpenAIVisionModel() {
  return process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
}

function resolveReplicateToken() {
  return process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY || null;
}

function replicateAuthHeader(token) {
  return { Authorization: `Token ${token}` };
}

let cachedReplicateVl2Version = null;

async function resolveReplicateDeepSeekVL2Version(token) {
  const fromEnv = String(process.env.REPLICATE_DEEPSEEK_VL2_VERSION || '').trim();
  if (fromEnv) return fromEnv;
  if (cachedReplicateVl2Version) return cachedReplicateVl2Version;

  const modelSlug = process.env.REPLICATE_DEEPSEEK_VL2_MODEL || 'deepseek-ai/deepseek-vl2';
  const resp = await axios.get(`https://api.replicate.com/v1/models/${modelSlug}`, {
    headers: { ...replicateAuthHeader(token), 'Content-Type': 'application/json' },
    timeout: 20000,
    validateStatus: () => true,
  });
  if (resp.status < 200 || resp.status >= 300) {
    const msg = resp?.data?.detail || resp?.data?.title || '';
    throw new Error(`Replicate model lookup HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }
  const version = resp?.data?.latest_version?.id;
  if (!version) throw new Error(`Replicate model ${modelSlug} has no latest_version`);
  cachedReplicateVl2Version = version;
  return version;
}

function formatReplicateError(resp) {
  const status = resp?.status;
  const detail = resp?.data?.detail || resp?.data?.title || resp?.data?.error || '';
  if (status === 402) {
    return `Replicate billing: add credit at replicate.com/account/billing — ${detail || 'insufficient credit'}`;
  }
  if (status === 401 || status === 403) {
    return `Replicate auth failed — check REPLICATE_API_TOKEN — ${detail || 'unauthorized'}`;
  }
  if (status === 429) {
    return `Replicate rate limit — wait a minute or add a payment method — ${detail || 'throttled'}`;
  }
  return `Replicate DeepSeek-VL2 HTTP ${status}${detail ? `: ${detail}` : ''}`;
}

function stripDataUrlPrefix(dataUrl) {
  const s = String(dataUrl || '');
  const m = s.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s);
  if (m) return { mediaType: m[1], data: m[2] };
  return { mediaType: 'image/jpeg', data: s.replace(/^data:[^;]+;base64,/, '') };
}

function sanitizeCoachImageAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((a) => a && a.type === 'image' && typeof a.dataUrl === 'string')
    .filter((a) => a.dataUrl.startsWith('data:image'))
    .filter((a) => a.dataUrl.length <= MAX_DATA_URL_CHARS)
    .slice(0, MAX_IMAGES)
    .map((a) => ({
      type: 'image',
      name: String(a.name || 'photo.jpg').slice(0, 120),
      dataUrl: a.dataUrl,
    }));
}

function buildVisionUserContent(text, imageDataUrls) {
  const userText =
    String(text || '').trim() ||
    'Please analyze the attached photo(s) and give helpful fitness or nutrition coaching feedback.';
  const parts = [{ type: 'text', text: userText }];
  for (const url of imageDataUrls) {
    parts.push({
      type: 'image_url',
      image_url: { url, detail: 'low' },
    });
  }
  return parts;
}

function injectVisionIntoMessages(textMessages, imageDataUrls) {
  const msgs = Array.isArray(textMessages) ? [...textMessages] : [];
  const lastUserIdx = [...msgs].reverse().findIndex((m) => m.role === 'user');
  if (lastUserIdx < 0) {
    msgs.push({ role: 'user', content: buildVisionUserContent('', imageDataUrls) });
    return msgs;
  }
  const idx = msgs.length - 1 - lastUserIdx;
  const last = msgs[idx];
  msgs[idx] = {
    role: 'user',
    content: buildVisionUserContent(last.content, imageDataUrls),
  };
  return msgs;
}

function buildVLAnalysisPrompt(userText) {
  const q = String(userText || '').trim();
  return q
    ? `You are analyzing a fitness client's photo. Describe everything visible that matters for coaching (physique, posture, food, form, equipment, labels). Then answer: ${q}`
    : 'You are analyzing a fitness client photo. Describe everything visible that matters for coaching (physique, posture, food, form, equipment, labels).';
}

async function callDeepSeekChat({ apiKey, systemPrompt, messages, maxTokens = 900 }) {
  const url = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';
  const model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  const payload = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...(Array.isArray(messages) ? messages : [])],
    temperature: 0.6,
    max_tokens: maxTokens,
  };
  const resp = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 45000,
    validateStatus: () => true,
  });
  if (resp.status < 200 || resp.status >= 300) {
    const msg = resp?.data?.error?.message || resp?.data?.message || '';
    throw new Error(`DeepSeek HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }
  const text = resp?.data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) throw new Error('DeepSeek returned empty response');
  return String(text);
}

async function callDeepSeekVLViaOpenAICompat({ baseUrl, apiKey, systemPrompt, messages, imageDataUrls }) {
  const model = process.env.DEEPSEEK_VISION_MODEL || 'deepseek-ai/deepseek-vl2';
  const visionMessages = injectVisionIntoMessages(messages, imageDataUrls);
  const openAiMessages = visionMessages.map((m) => ({
    role: m.role,
    content: Array.isArray(m.content) ? m.content : String(m.content || ''),
  }));

  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const payload = {
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...openAiMessages],
    temperature: 0.6,
    max_tokens: 900,
  };

  const resp = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 90000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const msg =
      resp?.data?.error?.message ||
      resp?.data?.message ||
      (typeof resp?.data === 'string' ? resp.data.slice(0, 300) : null);
    throw new Error(`DeepSeek-VL HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }

  const text = resp?.data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) throw new Error('DeepSeek-VL returned empty response');
  return { text: String(text), source: 'deepseek-vl', model };
}

async function callOpenAIVisionForAnalysis({ apiKey, userText, imageDataUrls }) {
  const model = resolveOpenAIVisionModel();
  const prompt = buildVLAnalysisPrompt(userText);
  const imageUrl = imageDataUrls?.[0];
  if (!imageUrl) throw new Error('No image for OpenAI vision');

  const url = process.env.OPENAI_URL || 'https://api.openai.com/v1/chat/completions';
  const payload = {
    model,
    max_tokens: 1024,
    temperature: 0.2,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageUrl, detail: 'high' } },
        ],
      },
    ],
  };

  const resp = await axios.post(url, payload, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 120000,
    validateStatus: () => true,
  });

  if (resp.status < 200 || resp.status >= 300) {
    const msg =
      resp?.data?.error?.message ||
      resp?.data?.message ||
      (typeof resp?.data === 'string' ? resp.data.slice(0, 300) : null);
    throw new Error(`OpenAI vision HTTP ${resp.status}${msg ? `: ${msg}` : ''}`);
  }

  const text = resp?.data?.choices?.[0]?.message?.content;
  if (!text || !String(text).trim()) throw new Error('OpenAI vision returned empty response');
  return { text: String(text), source: 'openai-vision', model };
}

async function callDeepSeekVLViaReplicate({ token, userText, imageDataUrls }) {
  const prompt = buildVLAnalysisPrompt(userText);
  const version = await resolveReplicateDeepSeekVL2Version(token);
  const input = {
    prompt,
    image: imageDataUrls[0],
    temperature: 0.4,
    max_length_tokens: 1024,
  };

  const resp = await axios.post(
    'https://api.replicate.com/v1/predictions',
    { version, input },
    {
      headers: {
        ...replicateAuthHeader(token),
        'Content-Type': 'application/json',
        Prefer: 'wait',
      },
      timeout: 120000,
      validateStatus: () => true,
    }
  );

  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(formatReplicateError(resp));
  }

  const out = resp?.data?.output;
  const text = Array.isArray(out) ? out.join('') : typeof out === 'string' ? out : '';
  if (!text || !String(text).trim()) {
    const err = resp?.data?.error;
    throw new Error(err ? `Replicate DeepSeek-VL2 failed: ${err}` : 'Replicate DeepSeek-VL2 returned empty output');
  }
  return { text: String(text), source: 'deepseek-vl2-replicate', model: 'deepseek-ai/deepseek-vl2' };
}

async function polishVisionWithDeepSeekCoach({ apiKey, systemPrompt, messages, visualAnalysis }) {
  const lastUserMsg = [...(Array.isArray(messages) ? messages : [])].reverse().find((m) => m.role === 'user');
  const question =
    (typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '') ||
    'Give coaching feedback on this photo.';

  const coachMessages = [
    {
      role: 'user',
      content: `PHOTO ANALYSIS (from DeepSeek-VL — treat as what you saw in the image):\n${visualAnalysis}\n\nClient question: ${question}\n\nRespond as their CoachConnect coach. Do not mention VL, Replicate, or internal tools.`,
    },
  ];

  const text = await callDeepSeekChat({
    apiKey,
    systemPrompt: `${systemPrompt}${VISION_SYSTEM_ADDENDUM}`,
    messages: coachMessages,
  });
  return { text, source: 'deepseek-vision', model: process.env.DEEPSEEK_MODEL || 'deepseek-chat' };
}

/**
 * Run a vision turn — OpenAI for eyes, DeepSeek for coach voice.
 */
async function runCoachVisionTurn({
  systemPrompt,
  messages,
  attachments,
  logAPIUsage,
  targetUid,
}) {
  const images = sanitizeCoachImageAttachments(attachments);
  if (!images.length) {
    throw new Error('No valid image attachments');
  }

  const imageDataUrls = images.map((i) => i.dataUrl);
  const lastUserMsg = [...(Array.isArray(messages) ? messages : [])].reverse().find((m) => m.role === 'user');
  const userText = typeof lastUserMsg?.content === 'string' ? lastUserMsg.content : '';

  const visionBaseUrl = resolveDeepSeekVisionBaseUrl();
  const visionApiKey = resolveDeepSeekVisionApiKey();
  const replicateToken = resolveReplicateToken();
  const deepSeekKey = resolveDeepSeekKey();
  const openAIKey = resolveOpenAIKey();

  let lastErr = null;
  const prompt = `${systemPrompt}${VISION_SYSTEM_ADDENDUM}`;

  // Preferred: OpenAI vision for image understanding, then DeepSeek coach polish.
  if (openAIKey && deepSeekKey) {
    try {
      const vl = await callOpenAIVisionForAnalysis({
        apiKey: openAIKey,
        userText,
        imageDataUrls,
      });
      const polished = await polishVisionWithDeepSeekCoach({
        apiKey: deepSeekKey,
        systemPrompt,
        messages,
        visualAnalysis: vl.text,
      });
      if (logAPIUsage) {
        const inputTokens = Math.ceil((prompt.length + vl.text.length) / 4) + 850 * images.length;
        const outputTokens = Math.ceil(String(polished.text).length / 4);
        await logAPIUsage('deepseek', targetUid || null, inputTokens, outputTokens, 'vision');
      }
      return { ...polished, source: 'openai-vision', model: vl.model };
    } catch (e) {
      logger.warn('OpenAI vision failed:', e?.message || e);
      throw new Error(
        e?.message?.includes('HTTP')
          ? `Photo analysis failed (${e.message}). Check OPENAI_API_KEY on Cloud Run.`
          : e?.message || 'Photo analysis failed. Try again in a moment.'
      );
    }
  }

  // Legacy fallback: Replicate DeepSeek-VL2 + DeepSeek coach polish.
  if (replicateToken && deepSeekKey) {
    try {
      const vl = await callDeepSeekVLViaReplicate({
        token: replicateToken,
        userText,
        imageDataUrls,
      });
      const polished = await polishVisionWithDeepSeekCoach({
        apiKey: deepSeekKey,
        systemPrompt,
        messages,
        visualAnalysis: vl.text,
      });
      if (logAPIUsage) {
        const inputTokens = Math.ceil((prompt.length + vl.text.length) / 4) + 850 * images.length;
        const outputTokens = Math.ceil(String(polished.text).length / 4);
        await logAPIUsage('deepseek', targetUid || null, inputTokens, outputTokens, 'vision');
      }
      return polished;
    } catch (e) {
      logger.warn('DeepSeek-VL2 via Replicate failed:', e?.message || e);
      lastErr = e;
    }
  }

  if (visionBaseUrl && visionApiKey) {
    try {
      const response = await callDeepSeekVLViaOpenAICompat({
        baseUrl: visionBaseUrl,
        apiKey: visionApiKey,
        systemPrompt: prompt,
        messages,
        imageDataUrls,
      });
      if (logAPIUsage) {
        const inputTokens = Math.ceil((prompt.length + JSON.stringify(messages).length) / 4) + 850 * images.length;
        const outputTokens = Math.ceil(String(response.text).length / 4);
        await logAPIUsage('deepseek', targetUid || null, inputTokens, outputTokens, 'vision-vl');
      }
      return response;
    } catch (e) {
      logger.warn('DeepSeek-VL (OpenAI-compat) failed:', e?.message || e);
      lastErr = e;
    }
  }

  const hint = !openAIKey && !replicateToken && !visionBaseUrl
    ? 'DeepSeek chat (api.deepseek.com) is text-only. For progress photos add OPENAI_API_KEY (recommended), REPLICATE_API_TOKEN (legacy), or set DEEPSEEK_VISION_BASE_URL.'
    : !deepSeekKey
      ? 'DEEPSEEK_API_KEY is required to polish photo analysis into coach replies.'
      : lastErr?.message || 'DeepSeek vision request failed';

  throw new Error(hint);
}

function isCoachVisionConfigured() {
  const deepSeekKey = resolveDeepSeekKey();
  return Boolean(
    (resolveOpenAIKey() && deepSeekKey) ||
    (resolveDeepSeekVisionBaseUrl() && resolveDeepSeekVisionApiKey()) ||
      (resolveReplicateToken() && deepSeekKey)
  );
}

module.exports = {
  VISION_SYSTEM_ADDENDUM,
  sanitizeCoachImageAttachments,
  runCoachVisionTurn,
  isCoachVisionConfigured,
};
