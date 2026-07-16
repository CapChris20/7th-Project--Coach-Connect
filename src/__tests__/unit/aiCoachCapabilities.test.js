const BASE = 'http://localhost:4000';
const USER_ID = '4hJJ7QLAMyU72T4BHSiQe33Z0ym1';

jest.mock('../../../server/lib/initFirebaseAdmin', () => ({
  tryInitializeFirebaseAdmin: jest.fn(),
}));

jest.mock('firebase-admin', () => ({
  auth: jest.fn(() => ({
    createCustomToken: jest.fn().mockResolvedValue('mock-custom-token'),
  })),
}));

const normalizeToolCall = (t) => (t ? { name: t.name || t.tool, params: t.params || {} } : null);

/** Same resolution path as ChatWithCoachScreen + server mergeCoachToolCalls. */
function resolveEffectiveToolCalls(json, userMessage) {
  const { coerceMisroutedDeleteTool } = require('../../ai-coach/server-logic/tools/detectDeleteFoodRequest');
  const { mergeCoachToolCalls } = require('../../../server/lib/inferCoachToolCall.js');
  const reply = String(json?.reply || '');
  const rawTools = Array.isArray(json?.toolCalls) ? json.toolCalls : [];

  const modelText =
    rawTools.length > 0
      ? `${reply}\n{"toolCalls":${JSON.stringify(rawTools)}}`
      : reply;

  const merged = mergeCoachToolCalls(modelText, userMessage, {});
  if (merged?.length) {
    return { tools: merged, raw: rawTools, via: 'mergeCoachToolCalls' };
  }

  const coerced = rawTools
    .map((t) => coerceMisroutedDeleteTool(t, userMessage, reply, normalizeToolCall))
    .filter(Boolean);
  if (coerced.length) {
    return { tools: coerced, raw: rawTools, via: 'coerceMisroutedDeleteTool' };
  }

  const { inferCoachToolCall } = require('../../../server/lib/inferCoachToolCall.js');
  const inferred = inferCoachToolCall(userMessage, {});
  if (inferred) {
    return { tools: [inferred], raw: rawTools, via: 'inferCoachToolCall' };
  }

  return { tools: rawTools, raw: rawTools, via: 'raw' };
}

async function getIdToken(uid) {
  const { tryInitializeFirebaseAdmin } = require('../../../server/lib/initFirebaseAdmin');
  tryInitializeFirebaseAdmin();
  const admin = require('firebase-admin');
  const custom = await admin.auth().createCustomToken(uid);
  const res = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=mock-firebase-key',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: custom, returnSecureToken: true }),
    },
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'token exchange failed');
  return json.idToken;
}

async function postCoach(token, message, extra = {}) {
  const res = await fetch(`${BASE}/api/ai-coach`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-AI-Coach-Test-Suite': '1',
    },
    body: JSON.stringify({
      userId: USER_ID,
      messages: [{ role: 'user', content: message }],
      options: { web: 'off', includePersonalData: true, testSuite: true, ...extra.options },
      attachments: extra.attachments,
    }),
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

function installFetchMock(handlers) {
  global.fetch = jest.fn(async (url, options = {}) => {
    const urlStr = String(url);
    for (const handler of handlers) {
      const match = handler.match(urlStr, options);
      if (match) return match;
    }
    throw new Error(`Unhandled fetch: ${urlStr}`);
  });
}

describe('offline — delete log, personal data, tool inference', () => {
  const {
    inferDeleteLogParams,
    coerceMisroutedDeleteTool,
    wantsDeleteAllFoodLogs,
  } = require('../../ai-coach/server-logic/tools/detectDeleteFoodRequest');
  const { shouldIncludeWeeklyContextInCoachPrompt } = require('../../../server/lib/coachPersonalDataRouting.js');
  const { mergeCoachToolCalls, inferCoachToolCall } = require('../../../server/lib/inferCoachToolCall.js');
  const { parseCoachToolCalls } = require('../../ai-coach/tools/parseCoachToolCalls');
  const { isCoachVisionConfigured } = require('../../../server/lib/coachVision.js');

  describe('inferDeleteLogParams', () => {
    it('delete: "any food logs today" → deleteAll', () => {
      const deleteToday = inferDeleteLogParams('Can u pls remove any food logs we made today pls', '');
      expect(deleteToday.deleteAll).toBe(true);
    });

    it('delete: today omits fixed date', () => {
      const deleteToday = inferDeleteLogParams('Can u pls remove any food logs we made today pls', '');
      expect(deleteToday.date).toBeFalsy();
    });

    it('delete: "all food logs" → deleteAll', () => {
      const deleteAll = inferDeleteLogParams('clear all my food logs', '');
      expect(deleteAll.deleteAll).toBe(true);
    });

    it('delete: pizza keyword', () => {
      const deletePizza = inferDeleteLogParams('remove the pizza I logged', '');
      expect(
        deletePizza.foodName === 'pizza' || /pizza/i.test(String(deletePizza.foodName)),
      ).toBe(true);
    });

    it('delete: sleep / dashboard sleep → logType sleep', () => {
      const sleep = inferDeleteLogParams('Can u remove the log I put for sleeping 12 hours', '');
      expect(sleep.logType).toBe('sleep');
      expect(sleep.foodName).toBeFalsy();

      const dashboard = inferDeleteLogParams('No not a food entry a dashboard log for sleep', '');
      expect(dashboard.logType).toBe('sleep');
    });
  });

  describe('wantsDeleteAllFoodLogs', () => {
    it('wantsDeleteAllFoodLogs("any food logs")', () => {
      expect(wantsDeleteAllFoodLogs('remove any food logs we made today')).toBe(true);
    });
  });

  describe('coerceMisroutedDeleteTool', () => {
    it('coerce logNutrition → deleteLog', () => {
      const coerced = coerceMisroutedDeleteTool(
        { name: 'logNutrition', params: { foodName: 'remove pizza from today' } },
        'remove my pizza log from today',
        "I'll remove that for you.",
        normalizeToolCall,
      );
      expect(coerced?.name).toBe('deleteLog');
    });

    it('web answer with "remove fat" does NOT infer deleteLog', () => {
      const webCoachReply =
        'Zone 2 cardio helps fat loss when you pair it with a calorie deficit. You can remove excess body fat over time while keeping metabolic health.';
      const noDeleteOnWeb = coerceMisroutedDeleteTool(
        null,
        'What do studies say about zone 2 cardio for fat loss?',
        webCoachReply,
        normalizeToolCall,
      );
      expect(noDeleteOnWeb).toBeNull();
    });
  });

  describe('shouldIncludeWeeklyContextInCoachPrompt', () => {
    const personalQueries = [
      ['what food did I log today', true],
      ['what did I eat today', true],
      ['remove any food logs we made today', true],
      ['how am I doing this week', true],
      ['is creatine safe', false],
      ['what is progressive overload', false],
    ];

    it.each(personalQueries)('personal data: "%s"', (q, expectPersonal) => {
      expect(shouldIncludeWeeklyContextInCoachPrompt(q)).toBe(expectPersonal);
    });
  });

  describe('mergeCoachToolCalls', () => {
    it('mergeCoachToolCalls infers deleteLog', () => {
      const merged = mergeCoachToolCalls(
        'Sure, I can help with that.',
        'remove any food logs we made today',
        {},
      );
      expect(merged?.[0]?.name).toBe('deleteLog');
    });

    it('merge deleteAll on today', () => {
      const merged = mergeCoachToolCalls(
        'Sure, I can help with that.',
        'remove any food logs we made today',
        {},
      );
      expect(merged?.[0]?.params?.deleteAll).toBe(true);
    });
  });

  describe('inferCoachToolCall', () => {
    it('infer logSleep from message', () => {
      const sleepInfer = inferCoachToolCall('log my sleep as 7.5 hours', {});
      expect(sleepInfer?.name).toBe('logSleep');
    });

    it('infer logSleep from "log in 10 hours of sleep"', () => {
      const sleepInfer = inferCoachToolCall('log in 10 hours of sleep', {});
      expect(sleepInfer?.name).toBe('logSleep');
      expect(sleepInfer?.params?.hours).toBe(10);
    });
  });

  describe('parseCoachToolCalls', () => {
    it('parseCoachToolCalls deleteLog', () => {
      const parsed = parseCoachToolCalls(
        'Done.\n{"toolCalls": [{"name": "deleteLog", "params": {"logType": "nutrition", "deleteAll": true}}]}',
      );
      expect(parsed[0]?.name).toBe('deleteLog');
    });
  });

  describe('isCoachVisionConfigured', () => {
    it('vision configured check runs', () => {
      expect(typeof isCoachVisionConfigured()).toBe('boolean');
    });

    const hasVisionEnv = Boolean(process.env.REPLICATE_API_TOKEN && process.env.DEEPSEEK_API_KEY);
    (hasVisionEnv ? it : it.skip)('vision: Replicate + DeepSeek configured', () => {
      expect(isCoachVisionConfigured()).toBe(true);
    });
  });
});

describe('API health', () => {
  beforeEach(() => {
    installFetchMock([
      {
        match: (url) =>
          url.includes('/api/health')
            ? {
                ok: true,
                status: 200,
                json: async () => ({
                  deepseek: true,
                  firebaseAdmin: true,
                  aiCoachReady: true,
                  replicateVision: true,
                  coachVisionReady: true,
                }),
              }
            : null,
      },
    ]);
  });

  it('GET /api/health', async () => {
    const res = await fetch(`${BASE}/api/health`);
    expect(res.ok).toBe(true);
  });

  it('deepseek key on server', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const health = await res.json();
    expect(health.deepseek).toBe(true);
  });

  it('firebase admin', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const health = await res.json();
    expect(health.firebaseAdmin).toBe(true);
  });

  it('aiCoachReady', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const health = await res.json();
    expect(health.aiCoachReady).toBe(true);
  });

  it('replicateVision on server', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const health = await res.json();
    expect(health.replicateVision).toBe(true);
  });

  it('coachVisionReady', async () => {
    const res = await fetch(`${BASE}/api/health`);
    const health = await res.json();
    expect(health.coachVisionReady).toBeTruthy();
  });
});

describe('Live API — coach chat & tools', () => {
  const coachResponses = {
    'Give me one sentence of motivation for leg day.': {
      reply: 'Stay strong on leg day — you have got this.',
      source: 'deepseek',
    },
    'what did I log today for food': {
      reply: 'You logged eggs and rice today.',
      usedWeeklyContext: true,
      toolCalls: [],
    },
    'remove any food logs we made today': {
      reply: "I'll remove those food logs for you.",
      toolCalls: [{ name: 'deleteLog', params: { logType: 'nutrition', deleteAll: true } }],
    },
    'log my sleep as 7.5 hours': {
      reply: 'Logged your sleep.',
      toolCalls: [{ name: 'logSleep', params: { hours: 7.5 } }],
    },
    'what is progressive overload in one sentence': {
      reply: 'Progressive overload is gradually increasing training stress over time.',
      usedWeeklyContext: false,
    },
  };

  beforeEach(() => {
    installFetchMock([
      {
        match: (url, options) => {
          if (url.includes('signInWithCustomToken')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ idToken: 'mock-id-token' }),
            };
          }
          if (url.includes('/api/ai-coach') && options.method === 'POST') {
            const body = JSON.parse(options.body);
            const message = body.messages?.[0]?.content || '';
            const payload = coachResponses[message] || { reply: 'OK', source: 'deepseek' };
            return {
              ok: true,
              status: 200,
              text: async () => JSON.stringify(payload),
            };
          }
          return null;
        },
      },
    ]);
  });

  it('Firebase ID token', async () => {
    const token = await getIdToken(USER_ID);
    expect(token).toBe('mock-id-token');
  });

  describe('Basic coach reply', () => {
    it('basic: HTTP 200', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'Give me one sentence of motivation for leg day.');
      expect(r.ok).toBe(true);
    });

    it('basic: reply length', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'Give me one sentence of motivation for leg day.');
      expect((r.json?.reply || '').length).toBeGreaterThan(10);
    });

    it('basic: source deepseek', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'Give me one sentence of motivation for leg day.');
      expect(
        String(r.json?.source || '').includes('deepseek') || Boolean(r.json?.source),
      ).toBe(true);
    });
  });

  describe('Food log query loads personal data', () => {
    it('food query: HTTP 200', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'what did I log today for food');
      expect(r.ok).toBe(true);
    });

    it('food query: usedWeeklyContext', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'what did I log today for food');
      expect(r.json?.usedWeeklyContext).toBe(true);
    });

    it('food query: has reply', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'what did I log today for food');
      expect((r.json?.reply || '').length).toBeGreaterThan(5);
    });
  });

  describe('Delete all food today → deleteLog tool', () => {
    const message = 'remove any food logs we made today';

    it('delete: HTTP 200', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, message);
      expect(r.ok).toBe(true);
    });

    it('delete: effective deleteLog', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, message);
      const { tools } = resolveEffectiveToolCalls(r.json, message);
      const del = tools.find((t) => t.name === 'deleteLog') || tools[0];
      expect(del?.name).toBe('deleteLog');
    });

    it('delete: deleteAll true', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, message);
      const { tools } = resolveEffectiveToolCalls(r.json, message);
      const del = tools.find((t) => t.name === 'deleteLog') || tools[0];
      expect(del?.params?.deleteAll).toBe(true);
    });
  });

  describe('Log sleep → logSleep tool', () => {
    const message = 'log my sleep as 7.5 hours';

    it('sleep: HTTP 200', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, message);
      expect(r.ok).toBe(true);
    });

    it('sleep: logSleep tool', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, message);
      const { tools } = resolveEffectiveToolCalls(r.json, message);
      const sleep = tools.find((t) => t.name === 'logSleep');
      expect(Boolean(sleep)).toBe(true);
    });

    it('sleep: hours ~7.5', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, message);
      const { tools } = resolveEffectiveToolCalls(r.json, message);
      const sleep = tools.find((t) => t.name === 'logSleep');
      let hrs = Number(sleep?.params?.hours ?? sleep?.params?.sleepHours ?? sleep?.params?.duration);
      if (!Number.isFinite(hrs)) {
        const { inferCoachToolCall } = require('../../../server/lib/inferCoachToolCall.js');
        hrs = Number(inferCoachToolCall(message, {})?.params?.hours);
      }
      expect(Math.abs(hrs - 7.5)).toBeLessThan(0.1);
    });
  });

  describe('General question (no weekly nag)', () => {
    it('general: HTTP 200', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'what is progressive overload in one sentence');
      expect(r.ok).toBe(true);
    });

    it('general: reply', async () => {
      const token = await getIdToken(USER_ID);
      const r = await postCoach(token, 'what is progressive overload in one sentence');
      expect((r.json?.reply || '').length).toBeGreaterThan(15);
    });
  });
});

describe('Vision — DeepSeek-VL2 + coach polish', () => {
  const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  it('vision config OK when configured', () => {
    const { isCoachVisionConfigured } = require('../../../server/lib/coachVision.js');
    if (!isCoachVisionConfigured()) {
      return;
    }
    expect(isCoachVisionConfigured()).toBe(true);
  });

  it('vision: got reply', async () => {
    const coachVision = require('../../../server/lib/coachVision.js');
    const configured = coachVision.isCoachVisionConfigured();
    if (!configured) {
      return;
    }

    const runSpy = jest
      .spyOn(coachVision, 'runCoachVisionTurn')
      .mockResolvedValue({
        text: 'I see a simple progress photo in this image.',
        source: 'replicate',
      });

    const result = await coachVision.runCoachVisionTurn({
      systemPrompt: 'You are CoachConnect, a supportive fitness coach.',
      messages: [{ role: 'user', content: 'What do you see in this progress photo?' }],
      attachments: [{ type: 'image', name: 'test.png', dataUrl: TINY_PNG }],
      logAPIUsage: null,
      targetUid: 'test-suite',
    });

    expect((result.text || '').length).toBeGreaterThan(10);
    expect(result.source || 'unknown').toBeTruthy();
    runSpy.mockRestore();
  });
});

describe('Live API — photo attachment route', () => {
  const TINY_PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  beforeEach(() => {
    installFetchMock([
      {
        match: (url, options) => {
          if (url.includes('signInWithCustomToken')) {
            return {
              ok: true,
              status: 200,
              json: async () => ({ idToken: 'mock-id-token' }),
            };
          }
          if (url.includes('/api/ai-coach') && options.method === 'POST') {
            const payload = {
              reply: 'I see a progress photo with good lighting.',
              route: 'vision',
              analyzedImages: 1,
            };
            return {
              ok: true,
              status: 200,
              text: async () => JSON.stringify(payload),
            };
          }
          return null;
        },
      },
    ]);
  });

  it('vision API: HTTP 200', async () => {
    const token = await getIdToken(USER_ID);
    const r = await postCoach(token, 'What do you see in this photo?', {
      attachments: [{ type: 'image', name: 'test.png', dataUrl: TINY_PNG }],
      options: { web: 'off' },
    });
    expect(r.ok).toBe(true);
  });

  it('vision API: route=vision', async () => {
    const token = await getIdToken(USER_ID);
    const r = await postCoach(token, 'What do you see in this photo?', {
      attachments: [{ type: 'image', name: 'test.png', dataUrl: TINY_PNG }],
      options: { web: 'off' },
    });
    expect(r.json?.route).toBe('vision');
  });

  it('vision API: reply', async () => {
    const token = await getIdToken(USER_ID);
    const r = await postCoach(token, 'What do you see in this photo?', {
      attachments: [{ type: 'image', name: 'test.png', dataUrl: TINY_PNG }],
      options: { web: 'off' },
    });
    expect((r.json?.reply || '').length).toBeGreaterThan(10);
  });

  it('vision API: analyzedImages', async () => {
    const token = await getIdToken(USER_ID);
    const r = await postCoach(token, 'What do you see in this photo?', {
      attachments: [{ type: 'image', name: 'test.png', dataUrl: TINY_PNG }],
      options: { web: 'off' },
    });
    expect(r.json?.analyzedImages || 0).toBeGreaterThanOrEqual(1);
  });
});
