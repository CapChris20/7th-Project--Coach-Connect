/**
 * Remove emoji / pictographs from push notification title and body (client).
 * Keep logic aligned with server/stripNotificationEmoji.js.
 */
export function stripNotificationEmoji(input) {
  let s = String(input ?? '');
  if (!s) return '';

  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, '');
  } catch (_) {}

  s = s.replace(/(?:\uD83C[\uDDE6-\uDDFF]){2}/g, '');
  s = s.replace(/[#*0-9]\uFE0F\u20E3|[#*0-9]\u20E3/g, '');
  s = s.replace(/\uFE0F/g, '');
  s = s.replace(/\u200D/g, '');
  s = s.replace(/\s{2,}/g, ' ').trim();
  return s;
}
