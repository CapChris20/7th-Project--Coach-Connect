/**
 * Convert local coach chat attachments into API-safe image payloads (base64 data URLs).
 */
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';

const MAX_IMAGES = 3;
const MAX_DATA_URL_CHARS = 5_500_000;

function toDataUrl(att) {
  if (att?.dataUrl && String(att.dataUrl).startsWith('data:image')) {
    return String(att.dataUrl);
  }
  const raw = att?.base64;
  if (!raw) return null;
  if (String(raw).startsWith('data:image')) return String(raw);
  const mime = att?.mimeType || 'image/jpeg';
  return `data:${mime};base64,${String(raw).replace(/^data:[^;]+;base64,/, '')}`;
}

async function uriToDataUrl(uri, mimeType = 'image/jpeg') {
  if (!uri) return null;
  const base64 = await readAsStringAsync(uri, { encoding: EncodingType.Base64 });
  if (!base64) return null;
  return `data:${mimeType};base64,${base64}`;
}

/**
 * @param {Array<{id?, preview?, uri?, base64?, dataUrl?, name?, type?, mimeType?}>} attachments
 * @returns {Promise<Array<{ type: 'image', name: string, dataUrl: string }>>}
 */
export async function prepareCoachAttachmentsForApi(attachments = []) {
  const candidates = (Array.isArray(attachments) ? attachments : [])
    .filter((a) => a && (a.type === 'image' || a.preview || a.base64 || a.dataUrl))
    .slice(0, MAX_IMAGES);

  const out = [];
  for (const att of candidates) {
    try {
      let dataUrl = toDataUrl(att);
      if (!dataUrl && att.preview) {
        dataUrl = await uriToDataUrl(att.preview, att.mimeType || 'image/jpeg');
      }
      if (!dataUrl && att.uri) {
        dataUrl = await uriToDataUrl(att.uri, att.mimeType || 'image/jpeg');
      }
      if (!dataUrl || dataUrl.length > MAX_DATA_URL_CHARS) continue;
      out.push({
        type: 'image',
        name: att.name || 'photo.jpg',
        dataUrl,
      });
    } catch (e) {
      console.warn('[prepareCoachAttachments] skip attachment:', e?.message || e);
    }
  }
  return out;
}
