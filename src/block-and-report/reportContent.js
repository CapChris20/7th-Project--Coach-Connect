// Saves a safety report and, when it can, opens a mail draft to support.
// Flow: check the reporter and the target → write contentReports → open mail if that write succeeded.
// Used by the report popup in chat and on trainer profiles.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../app-start/cloudConnection';
import { openSupportMailto } from '../settings/emailSupport';
import { REPORT_REASONS, REPORT_TYPES } from './reportReasons';

// ===== NAMED CONSTANTS =====

const CONTENT_REPORTS_COLLECTION = 'contentReports';
const OPEN_STATUS = 'open';
const OTHER_REASON = 'other';
const MAX_DETAILS_LENGTH = 2000;
const MAX_MAIL_DETAILS_LENGTH = 1500;
const MAX_DISPLAY_NAME_LENGTH = 120;
const VALID_REPORT_TYPES = new Set(Object.values(REPORT_TYPES));

// ===== HELPER FUNCTIONS =====

/**
 * @param {string} reasonId
 * @returns {string}
 */
function reasonLabel(reasonId) {
  const matchingReason = REPORT_REASONS.find((reason) => reason.id === reasonId);
  return matchingReason?.label || reasonId || OTHER_REASON;
}

/**
 * @param {object} report
 * @param {string} reportId
 * @returns {string}
 */
function supportMailBody(report, reportId) {
  const lines = [
    'A user submitted an in-app safety report.',
    '',
    `Report id: ${reportId}`,
    `Type: ${report.reportType}`,
    `Reason: ${reasonLabel(report.reasonId)}`,
    `Reporter uid: ${report.reporterUid}`,
    `Target uid: ${report.targetUid}`,
  ];
  if (report.targetDisplayName) lines.push(`Target name: ${report.targetDisplayName}`);
  if (report.conversationId) lines.push(`Conversation: ${report.conversationId}`);
  if (report.messageId) lines.push(`Message: ${report.messageId}`);
  if (report.details) {
    lines.push('');
    lines.push('Details:');
    lines.push(String(report.details).slice(0, MAX_MAIL_DETAILS_LENGTH));
  }
  lines.push('');
  lines.push('Please review in Firestore → contentReports.');
  lines.push('');
  return lines.join('\n');
}

// ===== MAIN FUNCTION =====

/**
 * The mail draft is optional. A failed mail open still returns the saved report id.
 * @param {object} params
 * @param {string} params.reporterId
 * @param {string} params.type
 * @param {string} params.targetUid
 * @param {string} params.reason
 * @param {string} [params.details]
 * @param {string} [params.conversationId]
 * @param {string} [params.messageId]
 * @param {string} [params.targetDisplayName]
 * @param {boolean} [params.notifySupport]
 * @returns {Promise<{ id: string }>}
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
  const reporterUid = String(reporterId || '').trim();
  const targetUserUid = String(targetUid || '').trim();
  const reportType = String(type || '').trim();
  const reasonId = String(reason || OTHER_REASON).trim();

  if (!reporterUid) throw new Error('You must be signed in to report.');
  if (!targetUserUid) throw new Error('Missing report target.');
  if (!VALID_REPORT_TYPES.has(reportType)) throw new Error('Invalid report type.');
  if (reporterUid === targetUserUid && reportType !== REPORT_TYPES.MESSAGE) {
    throw new Error('You cannot report yourself.');
  }

  // vocab: contentReports is the moderation queue. A client may create a report, not list other people's.
  const payload = {
    reporterId: reporterUid,
    type: reportType,
    targetUid: targetUserUid,
    reason: reasonId,
    details: String(details || '').slice(0, MAX_DETAILS_LENGTH),
    conversationId: conversationId ? String(conversationId) : null,
    messageId: messageId ? String(messageId) : null,
    targetDisplayName: targetDisplayName ? String(targetDisplayName).slice(0, MAX_DISPLAY_NAME_LENGTH) : null,
    status: OPEN_STATUS,
    createdAt: serverTimestamp(),
  };

  const reportRef = await addDoc(collection(db, CONTENT_REPORTS_COLLECTION), payload);

  if (notifySupport) {
    const subject = `Content report — ${reportType} — Coach Connect`;
    const body = supportMailBody({
      reportType,
      reasonId,
      reporterUid,
      targetUid: targetUserUid,
      targetDisplayName,
      conversationId,
      messageId,
      details,
    }, reportRef.id);
    try {
      openSupportMailto({ subject, body });
    } catch (_) {
      // The report is already saved. A closed mail app should not fail the report.
    }
  }

  return { id: reportRef.id };
}
