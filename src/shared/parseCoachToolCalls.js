/**
 * Parse AI Coach tool JSON from model replies (shared by server + Expo client).
 */

const COACH_TOOL_NAMES = [
  'adjustMacroTargets',
  'logNutrition',
  'logSleep',
  'logWater',
  'logSteps',
  'rateEnergy',
  'logMood',
  'rateWorkout',
  'logRestDay',
  'updateWorkout',
  'openWorkoutPlan',
  'bookSession',
  'updateGoal',
  'notifyTrainer',
  'deleteLog',
];

const COACH_TOOL_NAME_SET = new Set(COACH_TOOL_NAMES);
const COACH_TOOL_KEY_RE = new RegExp(
  `"(${COACH_TOOL_NAMES.join('|')})"\\s*:\\s*\\{`,
);

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch (_) {
    return null;
  }
}

function normalizeCall(c) {
  if (!c || typeof c !== 'object') return null;
  const nameRaw =
    typeof c.name === 'string'
      ? c.name
      : typeof c.tool === 'string'
        ? c.tool
        : typeof c.toolName === 'string'
          ? c.toolName
          : null;
  const name = nameRaw ? nameRaw.trim() : null;
  if (!name) return null;
  const params =
    c.params && typeof c.params === 'object' && !Array.isArray(c.params)
      ? c.params
      : c.parameters && typeof c.parameters === 'object' && !Array.isArray(c.parameters)
        ? c.parameters
        : {};
  return {
    name,
    params,
    reasoning: typeof c.reasoning === 'string' ? c.reasoning : '',
  };
}

function callFromNamedKey(name, params) {
  if (!COACH_TOOL_NAME_SET.has(name)) return null;
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  return normalizeCall({ name, params });
}

function collectFromObject(obj) {
  if (!obj || typeof obj !== 'object') return [];
  if (Array.isArray(obj.toolCalls)) {
    return obj.toolCalls.map(normalizeCall).filter(Boolean);
  }
  if (obj.toolCall) {
    const one = normalizeCall(obj.toolCall);
    return one ? [one] : [];
  }
  // Top-level { "toolName": "rateEnergy", "parameters": { ... } }
  if (typeof obj.toolName === 'string') {
    const one = normalizeCall(obj);
    return one ? [one] : [];
  }
  // Top-level { "tool": "updateWorkout", "params": { ... } }
  if (typeof obj.tool === 'string') {
    const one = normalizeCall(obj);
    return one ? [one] : [];
  }
  // Top-level { "updateWorkout": { planId, date, ... } }
  const keys = Object.keys(obj);
  if (keys.length === 1) {
    const one = callFromNamedKey(keys[0], obj[keys[0]]);
    if (one) return [one];
  }
  return [];
}

function candidateJsonStrings(text) {
  const raw = String(text || '');
  const unfenced = raw.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1');
  const out = [];
  const push = (s) => {
    const t = String(s || '').trim();
    if (t && !out.includes(t)) out.push(t);
  };

  push(unfenced.trim());

  const reObj = /\{[\s\S]*?"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}/g;
  let m;
  while ((m = reObj.exec(unfenced)) !== null) {
    push(m[0]);
  }

  const reFlatTool = /\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g;
  while ((m = reFlatTool.exec(unfenced)) !== null) {
    push(m[0]);
  }

  const reNamedTool = new RegExp(`\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"\\s*:\\s*\\{[\\s\\S]*?\\}\\s*\\}`, 'g');
  while ((m = reNamedTool.exec(unfenced)) !== null) {
    push(m[0]);
  }

  const tail = unfenced.match(/\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*\}\s*$/);
  if (tail) push(tail[0]);

  const namedTail = unfenced.match(new RegExp(`\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"[\\s\\S]*\\}\\s*$`));
  if (namedTail) push(namedTail[0]);

  return out;
}

function stripTrailingToolJson(text) {
  let out = String(text || '');
  for (let i = 0; i < 8; i += 1) {
    const idx = out.lastIndexOf('{');
    if (idx === -1) break;
    const tail = out.slice(idx).trim();
    const obj = safeJsonParse(tail);
    if (!obj || !collectFromObject(obj).length) break;
    out = out.slice(0, idx).trimEnd();
  }
  return out;
}

/** @returns {Array<{name:string,params:object,reasoning:string}>} */
function parseCoachToolCalls(aiResponse) {
  const raw = String(aiResponse || '');
  if (!raw.trim()) return [];

  const seen = new Set();
  const calls = [];

  for (const chunk of candidateJsonStrings(raw)) {
    const obj = safeJsonParse(chunk);
    if (!obj) continue;
    for (const c of collectFromObject(obj)) {
      const key = `${c.name}:${JSON.stringify(c.params)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      calls.push(c);
    }
  }

  return calls;
}

function stripCoachToolJsonFromReply(text) {
  const raw = String(text || '');
  if (!raw.trim()) return raw.trim();

  let out = raw
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, (match, inner) => {
      const obj = safeJsonParse(String(inner || '').trim());
      if (obj && collectFromObject(obj).length) return '';
      return match;
    })
    .replace(
      /```(?:json)?\s*\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}\s*```/gi,
      '',
    )
    .trim();

  out = stripTrailingToolJson(out);

  const tail = out.match(/\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*\}\s*$/);
  if (tail) {
    out = out.slice(0, tail.index).trimEnd();
  }

  const flatTail = out.match(/\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*\}\s*$/);
  if (flatTail) {
    out = out.slice(0, flatTail.index).trimEnd();
  }

  const toolNameTail = out.match(/\{\s*"toolName"\s*:\s*"[^"]+"[\s\S]*\}\s*$/);
  if (toolNameTail) {
    out = out.slice(0, toolNameTail.index).trimEnd();
  }

  const namedTail = out.match(new RegExp(`\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"[\\s\\S]*\\}\\s*$`));
  if (namedTail) {
    out = out.slice(0, namedTail.index).trimEnd();
  }

  return out.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = {
  parseCoachToolCalls,
  stripCoachToolJsonFromReply,
  COACH_TOOL_NAMES,
};
