// readActionsFromReply.js
//
// WHAT YOU NEED TO READ: the two functions right below (find tools / clean text).
// Everything after "PLUMBING" is messy on purpose — the AI hides JSON in many weird shapes.
//
// Exports (other files import these names — do not rename):
//   readActionsFromReply(reply)        -> [ { name, params, reasoning }, ... ]
//   stripCoachToolJsonFromReply(reply) -> normal message text for the chat bubble
//   COACH_TOOL_NAMES

// ===== NAMED CONSTANTS =====

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

// ===== MAIN FUNCTION =====

/**
 * Find every tool instruction hidden in one coach reply.
 * @param {string} aiResponse
 * @returns {Array<{name: string, params: object, reasoning: string}>}
 */
function readActionsFromReply(aiResponse) {
  const reply = String(aiResponse || '');
  if (!reply.trim()) return [];

  // Step 1: Grab every chunk of text that might be tool JSON.
  const possiblePieces = findPossibleInstructions(reply);

  // Step 2: Parse each chunk; keep valid instructions.
  const toolInstructions = collectInstructionsFromAllPieces(possiblePieces);

  // Step 3: Same tool + same params twice → keep one.
  return removeDuplicateInstructions(toolInstructions);
}

/**
 * User-facing text only — no tool JSON, no web [2][3] cite junk.
 * @param {string} text
 * @returns {string}
 */
function stripCoachToolJsonFromReply(text) {
  const reply = String(text || '');
  if (!reply.trim()) return reply.trim();

  // Step 1: Delete ```json ... ``` blocks that were only tool instructions.
  let cleanedReply = removeFencedToolJsonFromReply(reply);

  // Step 2: Peel `{...tool...}` off the end of the message (repeat if needed).
  cleanedReply = removeTrailingToolJsonFromText(cleanedReply);

  // Step 3: Chop known "JSON glued to the end" patterns.
  cleanedReply = cutTextAtMatchingTail(cleanedReply, TOOL_TAIL_PATTERN);
  cleanedReply = cutTextAtMatchingTail(cleanedReply, FLAT_TOOL_TAIL_PATTERN);
  cleanedReply = cutTextAtMatchingTail(cleanedReply, TOOL_NAME_TAIL_PATTERN);
  cleanedReply = cutTextAtMatchingTail(
    cleanedReply,
    namedToolTailPatternForStrip(),
  );

  // Step 4: Remove web-search markers like [2][3].
  cleanedReply = cleanedReply.replace(/\s*\[\d+\](?:\[\d+\])*/g, '').trim();

  // Step 5: Don't leave huge empty gaps in the bubble.
  return cleanedReply.replace(/\n{3,}/g, '\n\n').trim();
}

module.exports = {
  readActionsFromReply,
  stripCoachToolJsonFromReply,
  COACH_TOOL_NAMES,
};

// ===== HELPER FUNCTIONS =====
// PLUMBING — skip unless a tool call misfired in production and you are debugging.

const COACH_TOOL_NAME_SET = new Set(COACH_TOOL_NAMES);

// Manipulate here: max trailing `{...}` peels when stripping visible text.
const MAX_TRAILING_JSON_STRIPS = 8;

const TOOL_TAIL_PATTERN = /\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*\}\s*$/;
const FLAT_TOOL_TAIL_PATTERN = /\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*\}\s*$/;
const TOOL_NAME_TAIL_PATTERN = /\{\s*"toolName"\s*:\s*"[^"]+"[\s\S]*\}\s*$/;

function namedToolTailPatternForStrip() {
  return new RegExp(`\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"[\\s\\S]*\\}\\s*$`);
}

function tryParseJson(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    return null;
  }
}

function toolNameFromRawInstruction(rawInstruction) {
  if (typeof rawInstruction.name === 'string') return rawInstruction.name.trim();
  if (typeof rawInstruction.tool === 'string') return rawInstruction.tool.trim();
  if (typeof rawInstruction.toolName === 'string') return rawInstruction.toolName.trim();
  return null;
}

function paramsFromRawInstruction(rawInstruction) {
  const params = rawInstruction.params;
  if (params && typeof params === 'object' && !Array.isArray(params)) return params;
  const parameters = rawInstruction.parameters;
  if (parameters && typeof parameters === 'object' && !Array.isArray(parameters)) {
    return parameters;
  }
  return {};
}

function normalizeOneInstruction(rawInstruction) {
  if (!rawInstruction || typeof rawInstruction !== 'object') return null;
  const name = toolNameFromRawInstruction(rawInstruction);
  if (!name) return null;
  const params = paramsFromRawInstruction(rawInstruction);
  const reasoning =
    typeof rawInstruction.reasoning === 'string' ? rawInstruction.reasoning : '';
  return { name, params, reasoning };
}

function instructionFromSingleToolKey(toolName, paramsObject) {
  if (!COACH_TOOL_NAME_SET.has(toolName)) return null;
  if (!paramsObject || typeof paramsObject !== 'object' || Array.isArray(paramsObject)) {
    return null;
  }
  return normalizeOneInstruction({ name: toolName, params: paramsObject });
}

function instructionsFromToolCallsArray(parsedObject) {
  if (!Array.isArray(parsedObject.toolCalls)) return [];
  const list = [];
  for (let index = 0; index < parsedObject.toolCalls.length; index += 1) {
    const one = normalizeOneInstruction(parsedObject.toolCalls[index]);
    if (one) list.push(one);
  }
  return list;
}

function instructionsFromSingleToolCallField(parsedObject) {
  if (!parsedObject.toolCall) return [];
  const one = normalizeOneInstruction(parsedObject.toolCall);
  return one ? [one] : [];
}

function instructionsFromFlatToolOrToolName(parsedObject) {
  if (typeof parsedObject.toolName === 'string') {
    const one = normalizeOneInstruction(parsedObject);
    return one ? [one] : [];
  }
  if (typeof parsedObject.tool === 'string') {
    const one = normalizeOneInstruction(parsedObject);
    return one ? [one] : [];
  }
  return [];
}

function instructionsFromOneTopLevelToolKey(parsedObject) {
  const keys = Object.keys(parsedObject);
  if (keys.length !== 1) return [];
  const onlyKey = keys[0];
  const one = instructionFromSingleToolKey(onlyKey, parsedObject[onlyKey]);
  return one ? [one] : [];
}

function allInstructionsFromParsedObject(parsedObject) {
  if (!parsedObject || typeof parsedObject !== 'object') return [];
  const fromArray = instructionsFromToolCallsArray(parsedObject);
  if (fromArray.length) return fromArray;
  const fromSingleField = instructionsFromSingleToolCallField(parsedObject);
  if (fromSingleField.length) return fromSingleField;
  const fromFlat = instructionsFromFlatToolOrToolName(parsedObject);
  if (fromFlat.length) return fromFlat;
  return instructionsFromOneTopLevelToolKey(parsedObject);
}

function addUniqueStringToList(list, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  if (list.includes(trimmed)) return;
  list.push(trimmed);
}

function addAllRegexMatchesToList(sourceText, globalPattern, list) {
  let match = globalPattern.exec(sourceText);
  while (match !== null) {
    addUniqueStringToList(list, match[0]);
    match = globalPattern.exec(sourceText);
  }
}

function findPossibleInstructions(reply) {
  const replyText = String(reply || '');
  const withoutFences = replyText.replace(/```(?:json)?\s*([\s\S]*?)```/gi, '$1');
  const possiblePieces = [];

  addUniqueStringToList(possiblePieces, withoutFences.trim());

  const wrapperPattern = /\{[\s\S]*?"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}/g;
  addAllRegexMatchesToList(withoutFences, wrapperPattern, possiblePieces);

  const flatToolPattern = /\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g;
  addAllRegexMatchesToList(withoutFences, flatToolPattern, possiblePieces);

  const namedToolPattern = new RegExp(
    `\\{\\s*"(${COACH_TOOL_NAMES.join('|')})"\\s*:\\s*\\{[\\s\\S]*?\\}\\s*\\}`,
    'g',
  );
  addAllRegexMatchesToList(withoutFences, namedToolPattern, possiblePieces);

  const genericTail = withoutFences.match(TOOL_TAIL_PATTERN);
  if (genericTail) addUniqueStringToList(possiblePieces, genericTail[0]);

  const namedTail = withoutFences.match(namedToolTailPatternForStrip());
  if (namedTail) addUniqueStringToList(possiblePieces, namedTail[0]);

  return possiblePieces;
}

function toolInstructionsFromJsonChunk(jsonChunk) {
  const parsedObject = tryParseJson(jsonChunk);
  if (!parsedObject) return [];
  return allInstructionsFromParsedObject(parsedObject);
}

function collectInstructionsFromAllPieces(possiblePieces) {
  const toolInstructions = [];
  for (let index = 0; index < possiblePieces.length; index += 1) {
    const fromOneChunk = toolInstructionsFromJsonChunk(possiblePieces[index]);
    for (let inner = 0; inner < fromOneChunk.length; inner += 1) {
      toolInstructions.push(fromOneChunk[inner]);
    }
  }
  return toolInstructions;
}

function removeDuplicateInstructions(instructions) {
  const unique = [];
  const seenKeys = new Set();
  for (let index = 0; index < instructions.length; index += 1) {
    const instruction = instructions[index];
    const key = `${instruction.name}:${JSON.stringify(instruction.params)}`;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    unique.push(instruction);
  }
  return unique;
}

function removeTrailingToolJsonFromText(visibleText) {
  let cleaned = String(visibleText || '');
  for (let stripCount = 0; stripCount < MAX_TRAILING_JSON_STRIPS; stripCount += 1) {
    const lastBrace = cleaned.lastIndexOf('{');
    if (lastBrace === -1) break;
    const tailJson = cleaned.slice(lastBrace).trim();
    const parsedTail = tryParseJson(tailJson);
    if (!parsedTail) break;
    if (!allInstructionsFromParsedObject(parsedTail).length) break;
    cleaned = cleaned.slice(0, lastBrace).trimEnd();
  }
  return cleaned;
}

function removeFencedToolJsonFromReply(replyText) {
  const afterScan = String(replyText || '').replace(
    /```(?:json)?\s*([\s\S]*?)```/gi,
    (fullFence, innerText) => {
      const parsedInner = tryParseJson(String(innerText || '').trim());
      if (parsedInner && allInstructionsFromParsedObject(parsedInner).length) {
        return '';
      }
      return fullFence;
    },
  );
  return afterScan
    .replace(
      /```(?:json)?\s*\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}\s*```/gi,
      '',
    )
    .trim();
}

function cutTextAtMatchingTail(text, tailPattern) {
  const tailMatch = text.match(tailPattern);
  if (!tailMatch) return text;
  return text.slice(0, tailMatch.index).trimEnd();
}
