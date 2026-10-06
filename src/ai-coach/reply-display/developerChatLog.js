// Dev-only coach chat lines. Copy them out of Metro when a reply looks wrong.
// Flow: clip long text → print the user line, the coach line, and one paste-ready bundle.
// Used by the coach conversation while __DEV__ is on. Production returns immediately.

// ===== NAMED CONSTANTS =====

const LOG_TAG = '[AI Coach Chat]';
const DEFAULT_CLIP_LENGTH = 4000;
const BUNDLE_CLIP_LENGTH = 8000;
const SOURCE_TITLE_CLIP_LENGTH = 120;
const ERROR_USER_CLIP_LENGTH = 500;
const MAX_SOURCES_IN_REPLY_LOG = 6;
const MAX_SOURCES_IN_BUNDLE = 8;
const YOU_RULE_LENGTH = 28;
const COACH_RULE_LENGTH = 26;
const ERROR_RULE_LENGTH = 27;
const CLOSING_RULE_LENGTH = 40;

// ===== HELPER FUNCTIONS =====

/**
 * @param {unknown} text
 * @param {number} [maxLength]
 * @returns {string}
 */
function clipText(text, maxLength = DEFAULT_CLIP_LENGTH) {
  const textValue = String(text || '').trim();
  if (textValue.length <= maxLength) return textValue;
  return `${textValue.slice(0, maxLength)}… (+${textValue.length - maxLength} chars)`;
}

/**
 * @param {object} [meta]
 * @returns {string}
 */
function metaLine(meta = {}) {
  const parts = [];
  if (meta.sessionId) parts.push(`session=${meta.sessionId}`);
  if (meta.route) parts.push(`route=${meta.route}`);
  if (meta.searchedWeb != null) parts.push(`web=${meta.searchedWeb}`);
  if (meta.webProvider) parts.push(`provider=${meta.webProvider}`);
  if (meta.source) parts.push(`source=${meta.source}`);
  if (meta.success != null) parts.push(`ok=${meta.success}`);
  if (meta.toolCall?.name) parts.push(`tool=${meta.toolCall.name}`);
  if (Array.isArray(meta.webSources) && meta.webSources.length) {
    parts.push(`sources=${meta.webSources.length}`);
  }
  return parts.length ? parts.join(' | ') : '';
}

/**
 * @param {Array} webSources
 * @returns {void}
 */
function logWebSources(webSources) {
  webSources.slice(0, MAX_SOURCES_IN_REPLY_LOG).forEach((source, sourceIndex) => {
    const title = source?.title || source?.url || 'source';
    console.log(`${LOG_TAG}   source[${sourceIndex}]: ${clipText(title, SOURCE_TITLE_CLIP_LENGTH)}`);
    if (source?.url) console.log(`${LOG_TAG}            ${source.url}`);
  });
}

// ===== MAIN FUNCTION =====

/**
 * @param {string} text
 * @param {object} [meta]
 * @returns {void}
 */
export function logCoachUserMessage(text, meta = {}) {
  if (!__DEV__) return;
  const body = clipText(text);
  const line = metaLine(meta);
  console.log(`${LOG_TAG} ── YOU ${'─'.repeat(YOU_RULE_LENGTH)}`);
  if (line) console.log(`${LOG_TAG} ${line}`);
  console.log(`${LOG_TAG} ${body || '(empty)'}`);
  if (meta.attachmentCount > 0) {
    console.log(`${LOG_TAG} attachments: ${meta.attachmentCount}`);
  }
}

/**
 * @param {string} text
 * @param {object} [meta]
 * @returns {void}
 */
export function logCoachAssistantMessage(text, meta = {}) {
  if (!__DEV__) return;
  const body = clipText(text);
  const line = metaLine(meta);
  console.log(`${LOG_TAG} ── COACH ${'─'.repeat(COACH_RULE_LENGTH)}`);
  if (line) console.log(`${LOG_TAG} ${line}`);
  console.log(`${LOG_TAG} ${body || '(empty)'}`);
  if (Array.isArray(meta.webSources) && meta.webSources.length) {
    logWebSources(meta.webSources);
  }
  console.log(`${LOG_TAG} ${'─'.repeat(CLOSING_RULE_LENGTH)}`);
}

/**
 * @param {{ userText?: string, coachText?: string, meta?: object }} turn
 * @returns {void}
 */
export function logCoachTurnBundle({ userText, coachText, meta = {} }) {
  if (!__DEV__) return;
  try {
    const bundle = {
      at: new Date().toISOString(),
      you: clipText(userText, BUNDLE_CLIP_LENGTH),
      coach: clipText(coachText, BUNDLE_CLIP_LENGTH),
      route: meta.route ?? null,
      searchedWeb: meta.searchedWeb ?? null,
      webProvider: meta.webProvider ?? null,
      source: meta.source ?? null,
      success: meta.success ?? null,
      tool: meta.toolCall?.name ?? null,
      sources: (meta.webSources || []).slice(0, MAX_SOURCES_IN_BUNDLE).map((source) => ({
        title: source?.title,
        url: source?.url,
      })),
      sessionId: meta.sessionId ?? null,
      error: meta.error ?? null,
    };
    console.log(`${LOG_TAG} PASTE_THIS:`, JSON.stringify(bundle, null, 2));
  } catch (_) {
    // A logging failure must not break the chat.
  }
}

/**
 * @param {Error|string} caughtError
 * @param {string} userText
 * @param {object} [meta]
 * @returns {void}
 */
export function logCoachError(caughtError, userText, meta = {}) {
  if (!__DEV__) return;
  console.log(`${LOG_TAG} ── ERROR ${'─'.repeat(ERROR_RULE_LENGTH)}`);
  console.log(`${LOG_TAG} you: ${clipText(userText, ERROR_USER_CLIP_LENGTH)}`);
  console.log(`${LOG_TAG} ${String(caughtError?.message || caughtError || 'unknown error')}`);
  logCoachTurnBundle({
    userText,
    coachText: '',
    meta: { ...meta, success: false, error: String(caughtError?.message || caughtError) },
  });
}
