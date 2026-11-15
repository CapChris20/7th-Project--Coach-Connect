// Dev-only Metro logs for the AI coach conversation — paste bundles when a reply looks wrong.
// Flow: clip long strings → print YOU / COACH / ERROR blocks → optional JSON paste bundle.
// Used while __DEV__ is true. Production builds return on the first line of every export.

// ===== NAMED CONSTANTS =====

const LOG_TAG = '[AI Coach Chat]';

// Manipulate here: how much of a message Metro prints before we append “… (+N chars)”
const DEFAULT_CLIP_LENGTH = 4000;
const BUNDLE_CLIP_LENGTH = 8000;
const SOURCE_TITLE_CLIP_LENGTH = 120;
const ERROR_USER_CLIP_LENGTH = 500;

// Manipulate here: how many web sources we expand under a coach reply vs inside PASTE_THIS JSON
const MAX_SOURCES_IN_REPLY_LOG = 6;
const MAX_SOURCES_IN_BUNDLE = 8;

// Manipulate here: length of the ─── divider after YOU / COACH / ERROR / closing line
const YOU_RULE_LENGTH = 28;
const COACH_RULE_LENGTH = 26;
const ERROR_RULE_LENGTH = 27;
const CLOSING_RULE_LENGTH = 40;

// ===== HELPER FUNCTIONS =====

function clipTextForLog(text, maxLength = DEFAULT_CLIP_LENGTH) {
  const asString = String(text || '').trim();
  if (asString.length <= maxLength) {
    return asString;
  }
  const charsKept = maxLength;
  const charsHidden = asString.length - maxLength;
  return `${asString.slice(0, charsKept)}… (+${charsHidden} chars)`;
}

function printYouDivider() {
  console.log(`${LOG_TAG} ── YOU ${'─'.repeat(YOU_RULE_LENGTH)}`);
}

function printCoachDivider() {
  console.log(`${LOG_TAG} ── COACH ${'─'.repeat(COACH_RULE_LENGTH)}`);
}

function printErrorDivider() {
  console.log(`${LOG_TAG} ── ERROR ${'─'.repeat(ERROR_RULE_LENGTH)}`);
}

function printClosingDivider() {
  console.log(`${LOG_TAG} ${'─'.repeat(CLOSING_RULE_LENGTH)}`);
}

function printMetaLineIfPresent(metaLine) {
  if (!metaLine) {
    return;
  }
  console.log(`${LOG_TAG} ${metaLine}`);
}

function printBodyOrEmpty(clippedBody) {
  let bodyForLog = '(empty)';
  if (clippedBody) {
    bodyForLog = clippedBody;
  }
  console.log(`${LOG_TAG} ${bodyForLog}`);
}

function printAttachmentCountIfAny(meta) {
  const attachmentCount = meta.attachmentCount || 0;
  if (attachmentCount <= 0) {
    return;
  }
  console.log(`${LOG_TAG} attachments: ${attachmentCount}`);
}

function printWebSourcesFromMeta(meta) {
  const webSources = meta.webSources;
  if (!Array.isArray(webSources)) {
    return;
  }
  if (webSources.length === 0) {
    return;
  }
  printWebSourcesInReply(webSources);
}

function errorMessageFromCaught(caughtError) {
  if (caughtError && caughtError.message) {
    return String(caughtError.message);
  }
  if (caughtError) {
    return String(caughtError);
  }
  return 'unknown error';
}

function printErrorUserLine(userText) {
  const clippedUser = clipTextForLog(userText, ERROR_USER_CLIP_LENGTH);
  console.log(`${LOG_TAG} you: ${clippedUser}`);
}

function metaWithSuccessFalse(meta, errorMessage) {
  return Object.assign({}, meta, {
    success: false,
    error: errorMessage,
  });
}

function pushMetaPartIfPresent(parts, label, value) {
  if (value == null || value === '') {
    return;
  }
  parts.push(`${label}=${value}`);
}

function toolNameFromMeta(meta) {
  if (!meta.toolCall) {
    return null;
  }
  return meta.toolCall.name;
}

function buildMetaKeyValueParts(meta = {}) {
  const parts = [];

  pushMetaPartIfPresent(parts, 'session', meta.sessionId);
  pushMetaPartIfPresent(parts, 'route', meta.route);

  if (meta.searchedWeb != null) {
    parts.push(`web=${meta.searchedWeb}`);
  }

  pushMetaPartIfPresent(parts, 'provider', meta.webProvider);
  pushMetaPartIfPresent(parts, 'source', meta.source);

  if (meta.success != null) {
    parts.push(`ok=${meta.success}`);
  }

  // vocab: toolCall = optional { name } from the coach tool pipeline this turn
  const toolName = toolNameFromMeta(meta);
  pushMetaPartIfPresent(parts, 'tool', toolName);

  if (meta.toolCount != null) {
    parts.push(`tools=${meta.toolCount}`);
  }

  pushMetaPartIfPresent(parts, 'branch', meta.toolBranch);

  if (meta.tapConfirmProse) {
    parts.push('tapConfirmProse=1');
  }

  const webSources = meta.webSources;
  if (Array.isArray(webSources) && webSources.length > 0) {
    parts.push(`sources=${webSources.length}`);
  }

  return parts;
}

function formatMetaLine(meta = {}) {
  const parts = buildMetaKeyValueParts(meta);
  if (parts.length === 0) {
    return '';
  }
  return parts.join(' | ');
}

function sourceLabelForLog(source) {
  if (!source) {
    return 'source';
  }
  if (source.title) {
    return source.title;
  }
  if (source.url) {
    return source.url;
  }
  return 'source';
}

function printWebSourcesInReply(webSources) {
  const sourcesToShow = webSources.slice(0, MAX_SOURCES_IN_REPLY_LOG);

  for (let sourceIndex = 0; sourceIndex < sourcesToShow.length; sourceIndex += 1) {
    const source = sourcesToShow[sourceIndex];
    const label = sourceLabelForLog(source);
    const clippedLabel = clipTextForLog(label, SOURCE_TITLE_CLIP_LENGTH);
    console.log(`${LOG_TAG}   source[${sourceIndex}]: ${clippedLabel}`);

    if (source && source.url) {
      console.log(`${LOG_TAG}            ${source.url}`);
    }
  }
}

function webSourcesForPasteBundle(meta) {
  const allSources = meta.webSources || [];
  const capped = allSources.slice(0, MAX_SOURCES_IN_BUNDLE);
  const forJson = [];

  for (let sourceIndex = 0; sourceIndex < capped.length; sourceIndex += 1) {
    const source = capped[sourceIndex];
    let title;
    let url;
    if (source) {
      title = source.title;
      url = source.url;
    }
    forJson.push({
      title,
      url,
    });
  }

  return forJson;
}

function buildPasteBundle(userText, coachText, meta) {
  // vocab/symbol: ?? = if left side is null/undefined, use the right side (0 / false survive)
  const toolName = toolNameFromMeta(meta);

  return {
    at: new Date().toISOString(),
    you: clipTextForLog(userText, BUNDLE_CLIP_LENGTH),
    coach: clipTextForLog(coachText, BUNDLE_CLIP_LENGTH),
    route: meta.route ?? null,
    searchedWeb: meta.searchedWeb ?? null,
    webProvider: meta.webProvider ?? null,
    source: meta.source ?? null,
    success: meta.success ?? null,
    tool: toolName ?? null,
    toolCount: meta.toolCount ?? null,
    toolBranch: meta.toolBranch ?? null,
    tapConfirmProse: meta.tapConfirmProse === true,
    sources: webSourcesForPasteBundle(meta),
    sessionId: meta.sessionId ?? null,
    error: meta.error ?? null,
  };
}

// ===== MAIN FUNCTION =====

/**
 * Print the user’s message in Metro (dev only).
 * Flow: 1. clip body  2. YOU divider + meta  3. attachment count if any
 * @param {string} text
 * @param {object} [meta]
 */
export function logCoachUserMessage(text, meta = {}) {
  // vocab: __DEV__ = Metro/Expo flag — true in local builds, false in production bundles
  if (!__DEV__) {
    return;
  }

  // 1. Clip body so Metro does not choke on huge prompts.
  const clippedBody = clipTextForLog(text);
  const metaLine = formatMetaLine(meta);

  // 2. Print divider + optional meta + message.
  printYouDivider();
  printMetaLineIfPresent(metaLine);
  printBodyOrEmpty(clippedBody);

  // 3. Attachments are counted separately — not inlined in the text clip.
  printAttachmentCountIfAny(meta);
}

/**
 * Print the coach reply in Metro (dev only), with optional web sources under the body.
 * Flow: 1. clip + meta  2. COACH block  3. sources  4. closing rule
 * @param {string} text
 * @param {object} [meta]
 */
export function logCoachAssistantMessage(text, meta = {}) {
  if (!__DEV__) {
    return;
  }

  // 1. Same clip + meta pattern as the user side.
  const clippedBody = clipTextForLog(text);
  const metaLine = formatMetaLine(meta);

  // 2. Coach block header + body.
  printCoachDivider();
  printMetaLineIfPresent(metaLine);
  printBodyOrEmpty(clippedBody);

  // 3. Expand a short list of web sources under the body when present.
  printWebSourcesFromMeta(meta);

  // 4. Closing divider so the next YOU block is easy to spot while scrolling.
  printClosingDivider();
}

/**
 * One JSON blob engineers can paste into a bug report (dev only).
 * Flow: 1. build paste object  2. stringify under PASTE_THIS
 * @param {{ userText?: string, coachText?: string, meta?: object }} input
 */
export function logCoachTurnBundle({ userText, coachText, meta = {} }) {
  if (!__DEV__) {
    return;
  }

  try {
    // 1. One paste object — clip texts, flatten tool / web fields, cap sources.
    const pasteBundle = buildPasteBundle(userText, coachText, meta);

    // 2. vocab: PASTE_THIS prefix is grep-friendly in Metro scrollback
    console.log(`${LOG_TAG} PASTE_THIS:`, JSON.stringify(pasteBundle, null, 2));
  } catch (stringifyError) {
    // Logging must never break the chat UI — swallow stringify failures.
    void stringifyError;
  }
}

/**
 * Print an error header, then still emit the paste bundle with success=false.
 * Flow: 1. ERROR divider + you + message  2. paste bundle with success false
 * @param {*} caughtError
 * @param {string} userText
 * @param {object} [meta]
 */
export function logCoachError(caughtError, userText, meta = {}) {
  if (!__DEV__) {
    return;
  }

  // 1. Short error header in Metro.
  printErrorDivider();
  printErrorUserLine(userText);
  const errorMessage = errorMessageFromCaught(caughtError);
  console.log(`${LOG_TAG} ${errorMessage}`);

  // 2. Still emit the paste bundle with success=false for support.
  const metaWithFailure = metaWithSuccessFalse(meta, errorMessage);
  logCoachTurnBundle({
    userText,
    coachText: '',
    meta: metaWithFailure,
  });
}
