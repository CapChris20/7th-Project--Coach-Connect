// Saves a safety report and, when it can, opens a mail draft to support.
// Flow: normalize fields → refuse bad reports → write contentReports → optional support mailto.
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

// ===== MAIN FUNCTION =====

/**
 * Persist one content report. A failed mail open still returns the saved report id.
 * @param {object} reportInput
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
  // 1. Normalize and cap fields before we validate.
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

  // 2. Hard stops: signed out, missing target, bad type, self-report (except message reports).
  assertReportIsAllowed(built);

  // 3. Persist first — support email is best-effort after this.
  const firestorePayload = firestoreReportFields(built);
  const reportRef = await addDoc(
    collection(db, CONTENT_REPORTS_COLLECTION),
    firestorePayload,
  );

  // 4. Optional mailto — the report is already saved, so mail failures are ignored.
  if (notifySupport) {
    tryOpenSupportMailForReport(built, reportRef.id);
  }

  return { id: reportRef.id };
}

// ===== PLUMBING — skip unless debugging validation or support email formatting =====

function firestoreReportFields(built) {
  return {
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
}

function tryOpenSupportMailForReport(built, reportId) {
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
    reportId,
  );
  try {
    openSupportMailto({ subject, body });
  } catch (_mailError) {
    // The report is already saved. A closed mail app should not fail the report.
  }
}

function reasonLabel(reasonId) {
  for (let index = 0; index < REPORT_REASONS.length; index += 1) {
    const reason = REPORT_REASONS[index];
    if (reason.id === reasonId) {
      return reason.label;
    }
  }
  if (reasonId) {
    return reasonId;
  }
  return OTHER_REASON;
}

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

  appendOptionalMailLine(lines, 'Target name', report.targetDisplayName);
  appendOptionalMailLine(lines, 'Conversation', report.conversationId);
  appendOptionalMailLine(lines, 'Message', report.messageId);

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

function appendOptionalMailLine(lines, label, value) {
  if (!value) {
    return;
  }
  lines.push(`${label}: ${value}`);
}

function optionalStringOrNull(value) {
  if (!value) {
    return null;
  }
  return String(value);
}

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
    conversationId: optionalStringOrNull(params.conversationId),
    messageId: optionalStringOrNull(params.messageId),
    targetDisplayName: cappedDisplayName(params.targetDisplayName),
  };
}

function cappedDisplayName(targetDisplayName) {
  if (!targetDisplayName) {
    return null;
  }
  return String(targetDisplayName).slice(0, MAX_DISPLAY_NAME_LENGTH);
}

function assertReportIsAllowed(built) {
  if (!built.reporterUid) {
    throw new Error('You must be signed in to report.');
  }
  if (!built.targetUserUid) {
    throw new Error('Missing report target.');
  }
  if (!VALID_REPORT_TYPES.has(built.reportType)) {
    throw new Error('Invalid report type.');
  }

  const isSelfReport = built.reporterUid === built.targetUserUid;
  const isMessageReport = built.reportType === REPORT_TYPES.MESSAGE;
  if (isSelfReport && !isMessageReport) {
    throw new Error('You cannot report yourself.');
  }
}
