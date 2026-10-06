// Pulls coach tool JSON out of a model reply, then strips that JSON so the chat shows prose.
// Flow: collect every JSON-looking chunk → keep real tool calls → drop duplicates →
//       a second pass cuts the same JSON (and citation brackets) off the visible reply.
// Used by the coach conversation, the reply bubbles, and the server request handler.
// CommonJS on purpose: the Expo app and the Node server both require() this file.

// ===== NAMED CONSTANTS =====

// Tool names the model is allowed to emit. The letters are the contract with the server.
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

// Same name list, as a "toolName": { ... } detector. Kept next to the list so they cannot drift.
const COACH_TOOL_KEY_RE = new RegExp(
  `"(${COACH_TOOL_NAMES.join('|')})"\\s*:\\s*\\{`,
);

// Manipulate here: how many trailing `{...}` blobs we peel off one reply.
// A model sometimes stacks a tool object, then another, at the end of the paragraph.
const MAX_TRAILING_JSON_STRIPS = 8;

// These three do not use the /g flag, so sharing one RegExp across calls is safe.
// The /g patterns are created inside the helpers. A shared /g RegExp remembers
// lastIndex and would skip matches on the next reply.
const TOOL_TAIL_PATTERN = /\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*\}\s*$/;
const FLAT_TOOL_TAIL_PATTERN = /\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*\}\s*$/;
const TOOL_NAME_TAIL_PATTERN = /\{\s*"toolName"\s*:\s*"[^"]+"[\s\S]*\}\s*$/;

// ===== HELPER FUNCTIONS =====

/**
 * JSON.parse that returns null instead of throwing.
 * Model replies are often almost-JSON. A throw here would kill the chat bubble.
 * @param {string} jsonText
 * @returns {object|null}
 */
function safeJsonParse(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    return null;
  }
}

/**
 * One call, whatever key the model used for the name and the params.
 * @param {object} rawCall
 * @returns {{name: string, params: object, reasoning: string}|null}
 */
function normalizeCall(rawCall) {
  if (!rawCall || typeof rawCall !== 'object') return null;
  const nameRaw =
    typeof rawCall.name === 'string'
      ? rawCall.name
      : typeof rawCall.tool === 'string'
        ? rawCall.tool
        : typeof rawCall.toolName === 'string'
          ? rawCall.toolName
          : null;
  const name = nameRaw ? nameRaw.trim() : null;
  if (!name) return null;
  const params =
    rawCall.params && typeof rawCall.params === 'object' && !Array.isArray(rawCall.params)
      ? rawCall.params
      : rawCall.parameters && typeof rawCall.parameters === 'object' && !Array.isArray(rawCall.parameters)
        ? rawCall.parameters
        : {};
  return {
    name,
    params,
    reasoning: typeof rawCall.reasoning === 'string' ? rawCall.reasoning : '',
  };
}

/**
 * `{ "logSleep": { hours: 8 } }` — the key itself is the tool name.
 * @param {string} name
 * @param {object} params
 * @returns {object|null}
 */
function callFromNamedKey(name, params) {
  if (!COACH_TOOL_NAME_SET.has(name)) return null;
  if (!params || typeof params !== 'object' || Array.isArray(params)) return null;
  return normalizeCall({ name, params });
}

/**
 * Accept every shape the model has actually produced.
 * Order matters: a wrapper key wins over a single named key.
 * @param {object} parsedObject
 * @returns {object[]}
 */
function collectFromObject(parsedObject) {
  if (!parsedObject || typeof parsedObject !== 'object') return [];
  if (Array.isArray(parsedObject.toolCalls)) {
    return parsedObject.toolCalls.map(normalizeCall).filter(Boolean);
  }
  if (parsedObject.toolCall) {
    const oneCall = normalizeCall(parsedObject.toolCall);
    return oneCall ? [oneCall] : [];
  }
  // { "toolName": "rateEnergy", "parameters": { ... } }
  if (typeof parsedObject.toolName === 'string') {
    const oneCall = normalizeCall(parsedObject);
    return oneCall ? [oneCall] : [];
  }
  // { "tool": "updateWorkout", "params": { ... } }
  if (typeof parsedObject.tool === 'string') {
    const oneCall = normalizeCall(parsedObject);
    return oneCall ? [oneCall] : [];
  }
  // { "updateWorkout": { planId, date, ... } }
  const keys = Object.keys(parsedObject);
  if (keys.length === 1) {
    const oneCall = callFromNamedKey(keys[0], parsedObject[keys[0]]);
    if (oneCall) return [oneCall];
  }
  return [];
}

/**
 * @param {string[]} candidates
 * @param {string} candidateText
 */
function rememberCandidate(candidates, candidateText) {
  const trimmed = String(candidateText || '').trim();
  if (trimmed && !candidates.includes(trimmed)) candidates.push(trimmed);
}

/**
 * Every substring that might be tool JSON: the whole reply, fenced blocks, and tails.
 * We over-collect on purpose. safeJsonParse throws away the ones that are not JSON.
 * @param {string} text
 * @returns {string[]}
 */
function candidateJsonStrings(text) {
  const replyText = String(text || '');
  // vocab: ```json fences = the model wraps JSON in a markdown code block
  const unfenced = replyText.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1');
  const candidates = [];

  rememberCandidate(candidates, unfenced.trim());

  // Fresh /g regex each call so lastIndex starts at 0.
  const wrapperPattern = /\{[\s\S]*?"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}/g;
  let wrapperMatch;
  while ((wrapperMatch = wrapperPattern.exec(unfenced)) !== null) {
    rememberCandidate(candidates, wrapperMatch[0]);
  }

  const flatPattern = /\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g;
  let flatMatch;
  while ((flatMatch = flatPattern.exec(unfenced)) !== null) {
    rememberCandidate(candidates, flatMatch[0]);
  }

  const namedToolPattern = new RegExp(
    `\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"\\s*:\\s*\\{[\\s\\S]*?\\}\\s*\\}`,
    'g',
  );
  let namedMatch;
  while ((namedMatch = namedToolPattern.exec(unfenced)) !== null) {
    rememberCandidate(candidates, namedMatch[0]);
  }

  const tailMatch = unfenced.match(TOOL_TAIL_PATTERN);
  if (tailMatch) rememberCandidate(candidates, tailMatch[0]);

  const namedTailPattern = new RegExp(`\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"[\\s\\S]*\\}\\s*$`);
  const namedTailMatch = unfenced.match(namedTailPattern);
  if (namedTailMatch) rememberCandidate(candidates, namedTailMatch[0]);

  return candidates;
}

/**
 * Peel `{...tool...}` off the end, up to MAX_TRAILING_JSON_STRIPS times.
 * Stops at the first tail that is not a tool object, so a normal sentence with a brace survives.
 * @param {string} text
 * @returns {string}
 */
function stripTrailingToolJson(text) {
  let visibleText = String(text || '');
  for (let stripCount = 0; stripCount < MAX_TRAILING_JSON_STRIPS; stripCount += 1) {
    const braceIndex = visibleText.lastIndexOf('{');
    if (braceIndex === -1) break;
    const tailText = visibleText.slice(braceIndex).trim();
    const parsedTail = safeJsonParse(tailText);
    if (!parsedTail || !collectFromObject(parsedTail).length) break;
    visibleText = visibleText.slice(0, braceIndex).trimEnd();
  }
  return visibleText;
}

/**
 * Drop fenced blocks that parse as tool JSON. Leave other code fences alone.
 * @param {string} text
 * @returns {string}
 */
function stripFencedToolJson(text) {
  return String(text || '')
    .replace(/```(?:json)?\s*([\s\S]*?)```/gi, (fullMatch, inner) => {
      const parsedFence = safeJsonParse(String(inner || '').trim());
      if (parsedFence && collectFromObject(parsedFence).length) return '';
      return fullMatch;
    })
    .replace(
      /```(?:json)?\s*\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}\s*```/gi,
      '',
    )
    .trim();
}

/**
 * If the reply ends with this pattern, cut from the match to the end.
 * @param {string} text
 * @param {RegExp} pattern
 * @returns {string}
 */
function cutMatchingTail(text, pattern) {
  const tailMatch = text.match(pattern);
  if (!tailMatch) return text;
  return text.slice(0, tailMatch.index).trimEnd();
}

/**
 * Same name + params means the same button. The model often repeats the JSON twice.
 * @param {Set<string>} seenKeys
 * @param {object[]} calls
 * @param {object} call
 */
function rememberUniqueCall(seenKeys, calls, call) {
  const identityKey = `${call.name}:${JSON.stringify(call.params)}`;
  if (seenKeys.has(identityKey)) return;
  seenKeys.add(identityKey);
  calls.push(call);
}

// ===== MAIN FUNCTION =====

/**
 * Every tool call embedded in a coach reply.
 * @param {string} aiResponse
 * @returns {Array<{name: string, params: object, reasoning: string}>}
 */
function readActionsFromReply(aiResponse) {
  const replyText = String(aiResponse || '');
  if (!replyText.trim()) return [];

  const seenKeys = new Set();
  const calls = [];

  for (const chunk of candidateJsonStrings(replyText)) {
    const parsedChunk = safeJsonParse(chunk);
    if (!parsedChunk) continue;
    for (const call of collectFromObject(parsedChunk)) {
      rememberUniqueCall(seenKeys, calls, call);
    }
  }

  return calls;
}

/**
 * Reply text with tool JSON and web-search citation brackets removed.
 * The chat bubble should show the sentence, not the raw object.
 * @param {string} text
 * @returns {string}
 */
function stripCoachToolJsonFromReply(text) {
  const replyText = String(text || '');
  if (!replyText.trim()) return replyText.trim();

  let visibleText = stripFencedToolJson(replyText);
  visibleText = stripTrailingToolJson(visibleText);
  visibleText = cutMatchingTail(visibleText, TOOL_TAIL_PATTERN);
  visibleText = cutMatchingTail(visibleText, FLAT_TOOL_TAIL_PATTERN);
  visibleText = cutMatchingTail(visibleText, TOOL_NAME_TAIL_PATTERN);

  const namedTailPattern = new RegExp(`\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"[\\s\\S]*\\}\\s*$`);
  visibleText = cutMatchingTail(visibleText, namedTailPattern);

  // Web-search replies cite like [2][3]. Those are not part of the coaching sentence.
  visibleText = visibleText.replace(/\s*\[\d+\](?:\[\d+\])*/g, '').trim();

  return visibleText.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = {
  readActionsFromReply,
  stripCoachToolJsonFromReply,
  COACH_TOOL_NAMES,
};
