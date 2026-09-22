// Strips emoji out of push notification title/body before they're sent.
// Flow: one modern Unicode-property pass removes most emoji → several legacy surrogate-pair
//       passes catch what older JS engines miss → collapse the leftover double spaces.
// Why bother: emoji render inconsistently in OS notification trays and inflate the
// character budget. Keep this in sync with server/stripNotificationEmoji.js.
export function stripNotificationEmoji(input) {
  let s = String(input ?? '');
  if (!s) return '';

  // Primary pass — catches essentially every emoji in one expression.
  // vocab: \p{Extended_Pictographic} = Unicode property escape for "is a pictograph"
  // vocab: the `u` flag is REQUIRED for \p{...} and makes the regex Unicode-aware
  // Wrapped in try/catch because older JS engines throw a SyntaxError on \p{...} at
  // regex-construction time; the fallback passes below still do useful work there.
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, '');
  } catch (_) {}

  // Flag emoji: two regional-indicator characters in a row (🇺🇸 = "US"). They are NOT
  // Extended_Pictographic, so they survive the pass above and need their own rule.
  s = s.replace(/(?:\uD83C[\uDDE6-\uDDFF]){2}/g, '');
  // Keycap sequences: a digit/#/* followed by the combining enclosing keycap (1️⃣).
  // Two alternatives because the variation selector (\uFE0F) is optional.
  s = s.replace(/[#*0-9]\uFE0F\u20E3|[#*0-9]\u20E3/g, '');
  // vocab: \uFE0F = variation selector-16, the invisible "render as emoji" marker.
  //        Removed after the emoji themselves, or an orphan would linger.
  s = s.replace(/\uFE0F/g, '');
  // vocab: \u200D = zero-width joiner, the invisible glue in composite emoji (👨‍👩‍👧).
  //        Its parts are already gone by now; this clears the leftover joiner.
  s = s.replace(/\u200D/g, '');
  // Cleanup: removing an emoji mid-sentence leaves "Nice  work", so collapse runs of
  // whitespace and trim the edges.
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}
