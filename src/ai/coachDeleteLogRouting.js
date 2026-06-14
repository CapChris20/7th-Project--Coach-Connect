/**
 * Delete-log intent detection + fix model misrouting logNutrition → deleteLog.
 */

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

function userWantsDeleteLog(text) {
  return /\b(delete|remove|clear|undo|unlog|erase)\b/i.test(String(text || ''));
}

function coachTextImpliesDelete(text) {
  const t = String(text || '');
  return (
    userWantsDeleteLog(t) ||
    /\b(i'?ll|i will|going to)\s+(delete|remove|clear)\b/i.test(t) ||
    /\b(deleted|removed|cleared)\b.*\b(from your|from the)\b/i.test(t)
  );
}

function parseLooseDateKey(text) {
  const raw = String(text || '');
  const iso = raw.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const slash = raw.match(/\b(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])(?:\/(\d{2,4}))?\b/);
  if (slash) {
    const year = slash[3]
      ? slash[3].length === 2
        ? Number(`20${slash[3]}`)
        : Number(slash[3])
      : new Date().getFullYear();
    return `${year}-${slash[1].padStart(2, '0')}-${slash[2].padStart(2, '0')}`;
  }

  const md = raw.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\b/i,
  );
  if (md) {
    const month = MONTHS[md[1].toLowerCase()] || MONTHS[md[1].toLowerCase().slice(0, 3)];
    if (month) {
      const year = new Date().getFullYear();
      return `${year}-${String(month).padStart(2, '0')}-${String(Number(md[2])).padStart(2, '0')}`;
    }
  }
  return null;
}

function sanitizeDeleteFoodQuery(raw) {
  let s = String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/^(remove|delete|clear|undo)\s+(the|my|both|those|these)?\s*/i, '')
    .replace(/^(the|my|both|those|these|some)\s+/i, '')
    .replace(/^(one|two|three|four|a|\d+)\s+/i, '')
    .replace(/\s+from\s+(today|yesterday|this morning|tonight|may\s+\d{1,2}.*)$/i, '')
    .replace(/\s+(today|yesterday|right now)$/i, '')
    .replace(/\s+x\d+$/i, '')
    .trim();

  if (!s) return null;

  if (/domino/.test(s)) return "domino";
  if (/pizza/.test(s)) return 'pizza';
  if (/^(two|2|both|slices?|the slices?|pizza slices?)$/.test(s)) return 'pizza';
  if (/chicken/.test(s)) return 'chicken';
  if (/rice/.test(s)) return 'rice';
  if (/burger/.test(s)) return 'burger';
  if (/shake/.test(s)) return 'shake';

  const junk =
    /^(last|recent|latest|today|all|food|nutrition|my|both|two|2|three|3|from|the|slice|slices)$/;
  if (junk.test(s)) return null;

  return s.length >= 3 ? s : null;
}

function extractDeleteFoodKeyword(lower) {
  if (/domino/.test(lower)) return "domino";
  if (/pizza/.test(lower)) return 'pizza';
  if (/\b(chicken|rice|burger|shake|eggs|steak|salmon|oatmeal)\b/.test(lower)) {
    const m = lower.match(/\b(chicken|rice|burger|shake|eggs|steak|salmon|oatmeal)\b/);
    return m?.[1] || null;
  }
  if (/\b(two|2|both)\s+slices?\b/.test(lower) || /\bpizza slices?\b/.test(lower)) return 'pizza';
  return null;
}

function wantsDeleteAllFoodLogs(lower) {
  if (/\b(all|everything|any)\b/.test(lower) && /\b(food|meal|log|entr|nutrition)/.test(lower)) {
    return true;
  }
  if (/\b(remove|delete|clear|undo)\b.*\b(any|all|every)\b.*\b(food|meal|log|nutrition)/.test(lower)) {
    return true;
  }
  if (/\b(remove|delete|clear|undo)\b.*\btoday'?s?\b.*\b(food|meal|log|nutrition)/.test(lower)) {
    return true;
  }
  if (/\bfood logs?\b.*\b(today|we made today)\b/.test(lower)) {
    return true;
  }
  return false;
}

function inferDeleteLogParams(userText = '', coachText = '') {
  const combined = `${userText}\n${coachText}`;
  const lower = combined.toLowerCase();
  const params = { logType: 'nutrition' };

  if (/\btoday\b/.test(String(userText || '').toLowerCase())) {
    // Use local today at execution — don't override with coach prose dates.
  } else {
    const date = parseLooseDateKey(combined);
    if (date) params.date = date;
  }

  if (wantsDeleteAllFoodLogs(lower)) {
    params.deleteAll = true;
    return params;
  }

  if (/\b(last|recent|latest)\b/.test(lower) && /\b(food|meal|log|entr)/.test(lower)) {
    return params;
  }

  let foodName = extractDeleteFoodKeyword(lower);

  const foodMatch =
    combined.match(/(?:delete|remove|clear|undo)\s+(?:the|my|both)?\s*(.+?)\s+(?:log|entry|meal|from)/i) ||
    combined.match(/(?:delete|remove|clear)\s+(?:the|my|both)?\s*(.+?)\s+(?:i|we)?\s*(?:logged|log)/i);
  if (foodMatch?.[1]) {
    const candidate = sanitizeDeleteFoodQuery(foodMatch[1]);
    if (candidate) foodName = candidate;
  }

  if (foodName) params.foodName = foodName;

  return params;
}

function cleanMisroutedFoodName(raw) {
  return sanitizeDeleteFoodQuery(raw) || String(raw || '')
    .replace(/^(remove|delete|clear|undo)\s+(the|my|both)?\s*/i, '')
    .replace(/\s+from\s+.*$/i, '')
    .replace(/\s+x\d+$/i, '')
    .trim();
}

function coerceMisroutedDeleteTool(toolCall, userText = '', coachText = '', normalizeToolCall) {
  const deleteIntent = userWantsDeleteLog(userText) || coachTextImpliesDelete(coachText);

  if (!toolCall) {
    if (!deleteIntent) return null;
    return normalizeToolCall({
      name: 'deleteLog',
      params: inferDeleteLogParams(userText, coachText),
      reasoning: 'Remove this from your nutrition log.',
    });
  }

  const nameRaw = toolCall.name || toolCall.tool;
  const params = toolCall.params && typeof toolCall.params === 'object' ? { ...toolCall.params } : {};
  const foodStr = String(params.foodName || params.food || '');

  const misroutedLog =
    (nameRaw === 'logNutrition' || nameRaw === 'deleteLog') &&
    (deleteIntent || /^(remove|delete|clear|undo)\b/i.test(foodStr));

  if (!misroutedLog) return normalizeToolCall(toolCall);

  const inferred = inferDeleteLogParams(userText, coachText);
  const foodName = cleanMisroutedFoodName(foodStr);
  if (foodName && !/^(remove|delete|clear)/i.test(foodName)) {
    inferred.foodName = foodName;
  } else if (!inferred.foodName && params.foodName) {
    const fromParams = sanitizeDeleteFoodQuery(params.foodName || params.food);
    if (fromParams) inferred.foodName = fromParams;
  }
  const userLower = String(userText || '').toLowerCase();
  if (/\btoday\b/.test(userLower)) {
    delete inferred.date;
  } else if (params.date) {
    inferred.date = params.date;
  }
  if (params.deleteAll) inferred.deleteAll = true;

  return normalizeToolCall({
    name: 'deleteLog',
    params: inferred,
    reasoning: toolCall.reasoning || params.reasoning || 'Remove this from your nutrition log.',
  });
}

module.exports = {
  userWantsDeleteLog,
  coachTextImpliesDelete,
  parseLooseDateKey,
  sanitizeDeleteFoodQuery,
  wantsDeleteAllFoodLogs,
  inferDeleteLogParams,
  coerceMisroutedDeleteTool,
};
