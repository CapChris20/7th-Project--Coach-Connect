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
  for (let index = 0; index < REPORT_REASONS.length; index += 1) {
    const reason = REPORT_REASONS[index];
    if (reason.id === reasonId) return reason.label;
  }
  return reasonId || OTHER_REASON;
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

/**
 * @param {object} params
 * @returns {object}
 */
function buildReportPayload(params) {
  const reporterUid = String(params.reporterId || '').trim();
  const targetUserUid = String(params.targetUid || '').trim();
  const reportType = String(params.type || '').trim();
  const reasonId = String(params.reason || OTHER_REASON).trim();

  return {
    reporterUid,
    targetUserUid,
    reportType,
    reasonId,
    details: String(params.details || '').slice(0, MAX_DETAILS_LENGTH),
    conversationId: params.conversationId ? String(params.conversationId) : null,
    messageId: params.messageId ? String(params.messageId) : null,
    targetDisplayName: params.targetDisplayName
      ? String(params.targetDisplayName).slice(0, MAX_DISPLAY_NAME_LENGTH)
      : null,
  };
}

/**
 * @param {object} built
 * @returns {void}
 */
function assertReportIsAllowed(built) {
  if (!built.reporterUid) throw new Error('You must be signed in to report.');
  if (!built.targetUserUid) throw new Error('Missing report target.');
  if (!VALID_REPORT_TYPES.has(built.reportType)) throw new Error('Invalid report type.');
  if (built.reporterUid === built.targetUserUid && built.reportType !== REPORT_TYPES.MESSAGE) {
    throw new Error('You cannot report yourself.');
  }
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
  const built = buildReportPayload({
    reporterId,
    type,
    targetUid,
    reason,
    details,
    conversationId,
    messageId,
    targetDisplayName,
  });
  assertReportIsAllowed(built);

  // vocab: contentReports is the moderation queue. A client may create a report, not list other people's.
  const payload = {
    reporterId: built.reporterUid,
    type: built.reportType,
    targetUid: built.targetUserUid,
    reason: built.reasonId,
    details: built.details,
    conversationId: built.conversationId,
    messageId: built.messageId,
    targetDisplayName: built.targetDisplayName,
    status: OPEN_STATUS,
    createdAt: serverTimestamp(),
  };

  const reportRef = await addDoc(collection(db, CONTENT_REPORTS_COLLECTION), payload);

  if (notifySupport) {
    const subject = `Content report — ${built.reportType} — Coach Connect`;
    const body = supportMailBody(
      {
        reportType: built.reportType,
        reasonId: built.reasonId,
        reporterUid: built.reporterUid,
        targetUid: built.targetUserUid,
        targetDisplayName: built.targetDisplayName,
        conversationId: built.conversationId,
        messageId: built.messageId,
        details: built.details,
      },
      reportRef.id,
    );
    try {
      openSupportMailto({ subject, body });
    } catch (_) {
      // The report is already saved. A closed mail app should not fail the report.
    }
  }

  return { id: reportRef.id };
}
