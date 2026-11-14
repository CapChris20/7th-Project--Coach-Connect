// Pulls hidden tool JSON out of a coach reply and strips it from what the user sees.
// Flow: find JSON chunks → parse into { name, params, reasoning } → dedupe → export list or clean bubble text.
// Used by: CoachConversationScreen Confirm chips, and reply display that hides tool blocks from the bubble.
// Key exports (names frozen): readActionsFromReply, stripCoachToolJsonFromReply, COACH_TOOL_NAMES.
// CommonJS on purpose — other files already require/import this door.

// ===== NAMED CONSTANTS =====

// Allowed tool names. Letters stay frozen — other files and the model prompt match these exactly.
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

function readActionsFromReply(aiResponse) {
  const reply = String(aiResponse || '');
  if (!reply.trim()) {
    return [];
  }

  // 1. Grab every chunk of text that might be tool JSON.
  const possiblePieces = findPossibleInstructions(reply);

  // 2. Parse each chunk; keep valid instructions.
  const toolInstructions = collectInstructionsFromAllPieces(possiblePieces);

  // 3. Same tool + same params twice → keep one.
  const uniqueInstructions = removeDuplicateInstructions(toolInstructions);
  return uniqueInstructions;
}

function stripCoachToolJsonFromReply(text) {
  const reply = String(text || '');
  if (!reply.trim()) {
    return reply.trim();
  }

  // 1. Delete ```json ... ``` blocks that were only tool instructions.
  let cleanedReply = removeFencedToolJsonFromReply(reply);

  // 2. Peel `{...tool...}` off the end of the message (repeat if needed).
  cleanedReply = removeTrailingToolJsonFromText(cleanedReply);

  // 3. Chop known “JSON glued to the end” patterns.
  cleanedReply = cutTextAtMatchingTail(cleanedReply, TOOL_TAIL_PATTERN);
  cleanedReply = cutTextAtMatchingTail(cleanedReply, FLAT_TOOL_TAIL_PATTERN);
  cleanedReply = cutTextAtMatchingTail(cleanedReply, TOOL_NAME_TAIL_PATTERN);
  cleanedReply = cutTextAtMatchingTail(cleanedReply, buildNamedToolTailPatternForStrip());

  // 4. Remove web-search markers like [2][3].
  cleanedReply = removeWebSearchCiteMarkers(cleanedReply);

  // 5. Don’t leave huge empty gaps in the bubble.
  cleanedReply = collapseExtraBlankLines(cleanedReply);
  return cleanedReply;
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
const WEB_SEARCH_CITE_MARKERS = /\s*\[\d+\](?:\[\d+\])*/g;
const THREE_OR_MORE_NEWLINES = /\n{3,}/g;
const FENCED_CODE_BLOCK = /```(?:json)?\s*([\s\S]*?)```/gi;
const FENCED_TOOL_WRAPPER =
  /```(?:json)?\s*\{[\s\S]*"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}\s*```/gi;

function buildNamedToolTailPatternForStrip() {
  const toolNameChoices = COACH_TOOL_NAMES.join('|');
  return new RegExp(`\\{\\s*"(${toolNameChoices})"[\\s\\S]*\\}\\s*$`);
}

function tryParseJson(jsonText) {
  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    return null;
  }
}

function trimmedStringOrNull(value) {
  if (typeof value !== 'string') {
    return null;
  }
  return value.trim();
}

function toolNameFromRawInstruction(rawInstruction) {
  const fromName = trimmedStringOrNull(rawInstruction.name);
  if (fromName) {
    return fromName;
  }

  const fromTool = trimmedStringOrNull(rawInstruction.tool);
  if (fromTool) {
    return fromTool;
  }

  const fromToolName = trimmedStringOrNull(rawInstruction.toolName);
  if (fromToolName) {
    return fromToolName;
  }

  return null;
}

function paramsFromRawInstruction(rawInstruction) {
  const params = rawInstruction.params;
  const paramsLookLikeObject = params && typeof params === 'object' && !Array.isArray(params);
  if (paramsLookLikeObject) {
    return params;
  }

  const parameters = rawInstruction.parameters;
  const parametersLookLikeObject =
    parameters && typeof parameters === 'object' && !Array.isArray(parameters);
  if (parametersLookLikeObject) {
    return parameters;
  }

  return {};
}

function reasoningFromRawInstruction(rawInstruction) {
  if (typeof rawInstruction.reasoning !== 'string') {
    return '';
  }
  return rawInstruction.reasoning;
}

function normalizeOneInstruction(rawInstruction) {
  if (!rawInstruction || typeof rawInstruction !== 'object') {
    return null;
  }

  const name = toolNameFromRawInstruction(rawInstruction);
  if (!name) {
    return null;
  }

  const params = paramsFromRawInstruction(rawInstruction);
  const reasoning = reasoningFromRawInstruction(rawInstruction);
  return { name, params, reasoning };
}

function instructionFromSingleToolKey(toolName, paramsObject) {
  if (!COACH_TOOL_NAME_SET.has(toolName)) {
    return null;
  }

  const paramsLookLikeObject =
    paramsObject && typeof paramsObject === 'object' && !Array.isArray(paramsObject);
  if (!paramsLookLikeObject) {
    return null;
  }

  return normalizeOneInstruction({ name: toolName, params: paramsObject });
}

function instructionsFromToolCallsArray(parsedObject) {
  if (!Array.isArray(parsedObject.toolCalls)) {
    return [];
  }

  const list = [];
  for (let index = 0; index < parsedObject.toolCalls.length; index += 1) {
    const one = normalizeOneInstruction(parsedObject.toolCalls[index]);
    if (one) {
      list.push(one);
    }
  }
  return list;
}

function instructionsFromSingleToolCallField(parsedObject) {
  if (!parsedObject.toolCall) {
    return [];
  }

  const one = normalizeOneInstruction(parsedObject.toolCall);
  if (!one) {
    return [];
  }
  return [one];
}

function instructionsFromFlatToolOrToolName(parsedObject) {
  const hasToolNameField = typeof parsedObject.toolName === 'string';
  const hasToolField = typeof parsedObject.tool === 'string';
  if (!hasToolNameField && !hasToolField) {
    return [];
  }

  const one = normalizeOneInstruction(parsedObject);
  if (!one) {
    return [];
  }
  return [one];
}

function instructionsFromOneTopLevelToolKey(parsedObject) {
  const keys = Object.keys(parsedObject);
  if (keys.length !== 1) {
    return [];
  }

  const onlyKey = keys[0];
  const one = instructionFromSingleToolKey(onlyKey, parsedObject[onlyKey]);
  if (!one) {
    return [];
  }
  return [one];
}

function allInstructionsFromParsedObject(parsedObject) {
  if (!parsedObject || typeof parsedObject !== 'object') {
    return [];
  }

  const fromArray = instructionsFromToolCallsArray(parsedObject);
  if (fromArray.length) {
    return fromArray;
  }

  const fromSingleField = instructionsFromSingleToolCallField(parsedObject);
  if (fromSingleField.length) {
    return fromSingleField;
  }

  const fromFlat = instructionsFromFlatToolOrToolName(parsedObject);
  if (fromFlat.length) {
    return fromFlat;
  }

  return instructionsFromOneTopLevelToolKey(parsedObject);
}

function addUniqueStringToList(list, text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) {
    return;
  }
  if (list.includes(trimmed)) {
    return;
  }
  list.push(trimmed);
}

function addAllRegexMatchesToList(sourceText, globalPattern, list) {
  let match = globalPattern.exec(sourceText);
  while (match !== null) {
    addUniqueStringToList(list, match[0]);
    match = globalPattern.exec(sourceText);
  }
}

function replyTextWithFencesUnwrapped(replyText) {
  return replyText.replace(FENCED_CODE_BLOCK, '$1');
}

function findPossibleInstructions(reply) {
  const replyText = String(reply || '');
  const withoutFences = replyTextWithFencesUnwrapped(replyText);
  const possiblePieces = [];

  addUniqueStringToList(possiblePieces, withoutFences.trim());

  const wrapperPattern = /\{[\s\S]*?"(?:toolCalls|toolCall|tool|toolName)"[\s\S]*?\}/g;
  addAllRegexMatchesToList(withoutFences, wrapperPattern, possiblePieces);

  const flatToolPattern = /\{\s*"tool"\s*:\s*"[^"]+"[\s\S]*?\}/g;
  addAllRegexMatchesToList(withoutFences, flatToolPattern, possiblePieces);

  const toolNameChoices = COACH_TOOL_NAMES.join('|');
  const namedToolPattern = new RegExp(
    `\\{\\s*"(${toolNameChoices})"\\s*:\\s*\\{[\\s\\S]*?\\}\\s*\\}`,
    'g',
  );
  addAllRegexMatchesToList(withoutFences, namedToolPattern, possiblePieces);

  const genericTail = withoutFences.match(TOOL_TAIL_PATTERN);
  if (genericTail) {
    addUniqueStringToList(possiblePieces, genericTail[0]);
  }

  const namedTail = withoutFences.match(buildNamedToolTailPatternForStrip());
  if (namedTail) {
    addUniqueStringToList(possiblePieces, namedTail[0]);
  }

  return possiblePieces;
}

function toolInstructionsFromJsonChunk(jsonChunk) {
  const parsedObject = tryParseJson(jsonChunk);
  if (!parsedObject) {
    return [];
  }
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

function fingerprintForInstruction(instruction) {
  return `${instruction.name}:${JSON.stringify(instruction.params)}`;
}

function removeDuplicateInstructions(instructions) {
  const unique = [];
  const seenKeys = new Set();
  for (let index = 0; index < instructions.length; index += 1) {
    const instruction = instructions[index];
    const key = fingerprintForInstruction(instruction);
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    unique.push(instruction);
  }
  return unique;
}

function removeTrailingToolJsonFromText(visibleText) {
  let cleaned = String(visibleText || '');
  for (let stripCount = 0; stripCount < MAX_TRAILING_JSON_STRIPS; stripCount += 1) {
    const lastBrace = cleaned.lastIndexOf('{');
    if (lastBrace === -1) {
      break;
    }

    const tailJson = cleaned.slice(lastBrace).trim();
    const parsedTail = tryParseJson(tailJson);
    if (!parsedTail) {
      break;
    }

    const instructionsInTail = allInstructionsFromParsedObject(parsedTail);
    if (!instructionsInTail.length) {
      break;
    }

    cleaned = cleaned.slice(0, lastBrace).trimEnd();
  }
  return cleaned;
}

function fencedBlockKeepsVisibleText(fullFence, innerText) {
  const parsedInner = tryParseJson(String(innerText || '').trim());
  if (!parsedInner) {
    return fullFence;
  }

  const hasToolInstructions = allInstructionsFromParsedObject(parsedInner).length > 0;
  if (hasToolInstructions) {
    return '';
  }
  return fullFence;
}

function removeFencedToolJsonFromReply(replyText) {
  const sourceText = String(replyText || '');
  const afterScan = sourceText.replace(FENCED_CODE_BLOCK, fencedBlockKeepsVisibleText);
  const withoutToolWrappers = afterScan.replace(FENCED_TOOL_WRAPPER, '');
  return withoutToolWrappers.trim();
}

function cutTextAtMatchingTail(text, tailPattern) {
  const tailMatch = text.match(tailPattern);
  if (!tailMatch) {
    return text;
  }
  return text.slice(0, tailMatch.index).trimEnd();
}

function removeWebSearchCiteMarkers(text) {
  return text.replace(WEB_SEARCH_CITE_MARKERS, '').trim();
}

function collapseExtraBlankLines(text) {
  return text.replace(THREE_OR_MORE_NEWLINES, '\n\n').trim();
}
