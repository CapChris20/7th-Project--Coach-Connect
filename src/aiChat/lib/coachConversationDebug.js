/**
 * Dev-only AI Coach conversation logs — copy from Metro when reporting issues.
 */

const TAG = '[AI Coach Chat]';

function clip(text, max = 4000) {
  const s = String(text || '').trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… (+${s.length - max} chars)`;
}

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

/** Log what the user sent (before API call). */
export function logCoachUserMessage(text, meta = {}) {
  if (!__DEV__) return;
  const body = clip(text);
  const line = metaLine(meta);
  console.log(`${TAG} ── YOU ${'─'.repeat(28)}`);
  if (line) console.log(`${TAG} ${line}`);
  console.log(`${TAG} ${body || '(empty)'}`);
  if (meta.attachmentCount > 0) {
    console.log(`${TAG} attachments: ${meta.attachmentCount}`);
  }
}

/** Log coach reply (after API — what the UI shows). */
export function logCoachAssistantMessage(text, meta = {}) {
  if (!__DEV__) return;
  const body = clip(text);
  const line = metaLine(meta);
  console.log(`${TAG} ── COACH ${'─'.repeat(26)}`);
  if (line) console.log(`${TAG} ${line}`);
  console.log(`${TAG} ${body || '(empty)'}`);
  if (Array.isArray(meta.webSources) && meta.webSources.length) {
    meta.webSources.slice(0, 6).forEach((s, i) => {
      const title = s?.title || s?.url || 'source';
      console.log(`${TAG}   source[${i}]: ${clip(title, 120)}`);
      if (s?.url) console.log(`${TAG}            ${s.url}`);
    });
  }
  console.log(`${TAG} ${'─'.repeat(40)}`);
}

/** One JSON blob to paste into a bug report. */
export function logCoachTurnBundle({ userText, coachText, meta = {} }) {
  if (!__DEV__) return;
  try {
    const bundle = {
      at: new Date().toISOString(),
      you: clip(userText, 8000),
      coach: clip(coachText, 8000),
      route: meta.route ?? null,
      searchedWeb: meta.searchedWeb ?? null,
      webProvider: meta.webProvider ?? null,
      source: meta.source ?? null,
      success: meta.success ?? null,
      tool: meta.toolCall?.name ?? null,
      sources: (meta.webSources || []).slice(0, 8).map((s) => ({
        title: s?.title,
        url: s?.url,
      })),
      sessionId: meta.sessionId ?? null,
      error: meta.error ?? null,
    };
    console.log(`${TAG} PASTE_THIS:`, JSON.stringify(bundle, null, 2));
  } catch (_) {
    // ignore
  }
}

export function logCoachError(err, userText, meta = {}) {
  if (!__DEV__) return;
  console.log(`${TAG} ── ERROR ${'─'.repeat(27)}`);
  console.log(`${TAG} you: ${clip(userText, 500)}`);
  console.log(`${TAG} ${String(err?.message || err || 'unknown error')}`);
  logCoachTurnBundle({
    userText,
    coachText: '',
    meta: { ...meta, success: false, error: String(err?.message || err) },
  });
}
