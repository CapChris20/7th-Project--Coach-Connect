// Write a contentReports doc + best-effort support mailto so reports aren’t a dead inbox.
// Flow: UI picks reason → submitContentReport → Firestore create + optional mailto to support.
// Used by: ReportOrBlockPopup / report flows in chat + marketplace.
// Key exports: submitContentReport

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { openSupportMailto } from '../settings/emailSupport';
import { REPORT_REASONS, REPORT_TYPES } from './reportReasons';

const VALID_TYPES = new Set(Object.values(REPORT_TYPES));

function reasonLabel(reasonId) {
  const hit = REPORT_REASONS.find((r) => r.id === reasonId);
  return hit?.label || reasonId || 'other';
}

/**
 * @param {object} params
 * @param {string} params.reporterId
 * @param {'user'|'message'|'trainer_profile'} params.type
 * @param {string} params.targetUid
 * @param {string} params.reason - REPORT_REASONS id
 * @param {string} [params.details]
 * @param {string} [params.conversationId]
 * @param {string} [params.messageId]
 * @param {string} [params.targetDisplayName]
 * @param {boolean} [params.notifySupport=true] - open mailto after write
 */
export async function submitContentReport({
  reporterId,
  type,
  targetUid,
  reason,
  details = '',
  conversationId = null,
  messageId = null,
  targetDisplayName = null,
  notifySupport = true,
}) {
  const reporter = String(reporterId || '').trim();
  const target = String(targetUid || '').trim();
  const reportType = String(type || '').trim();
  const reasonId = String(reason || 'other').trim();

  if (!reporter) throw new Error('You must be signed in to report.');
  if (!target) throw new Error('Missing report target.');
  if (!VALID_TYPES.has(reportType)) throw new Error('Invalid report type.');
  if (reporter === target && reportType !== REPORT_TYPES.MESSAGE) {
    throw new Error('You cannot report yourself.');
  }

  // vocab: contentReports = top-level moderation queue; clients may create, not list others’
  const payload = {
    reporterId: reporter,
    type: reportType,
    targetUid: target,
    reason: reasonId,
    details: String(details || '').slice(0, 2000),
    conversationId: conversationId ? String(conversationId) : null,
    messageId: messageId ? String(messageId) : null,
    targetDisplayName: targetDisplayName ? String(targetDisplayName).slice(0, 120) : null,
    status: 'open',
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'contentReports'), payload);

  if (notifySupport) {
    const subject = `Content report — ${reportType} — Coach Connect`;
    const body =
      `A user submitted an in-app safety report.\n\n` +
      `Report id: ${ref.id}\n` +
      `Type: ${reportType}\n` +
      `Reason: ${reasonLabel(reasonId)}\n` +
      `Reporter uid: ${reporter}\n` +
      `Target uid: ${target}\n` +
      (targetDisplayName ? `Target name: ${targetDisplayName}\n` : '') +
      (conversationId ? `Conversation: ${conversationId}\n` : '') +
      (messageId ? `Message: ${messageId}\n` : '') +
      (details ? `\nDetails:\n${String(details).slice(0, 1500)}\n` : '') +
      `\nPlease review in Firestore → contentReports.\n`;
    try {
      openSupportMailto({ subject, body });
    } catch (_) {
      /* mailto is best-effort — Firestore write already succeeded */
    }
  }

  return { id: ref.id };
}
