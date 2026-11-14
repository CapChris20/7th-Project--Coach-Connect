// Writes one error to a file (Node scripts) or to the API (the app), and also to Firestore.
// Flow: build one error record → Node prepends it to ERRORS.md, the app POSTs /api/log-error → either way, add an app_errors document.
// Called from the app's crash path. CommonJS so plain Node scripts can require() it.
// Read order: constants → recordError recipe → PLUMBING (filesystem, API, Firestore).

const LOG_ERROR_PATH = '/api/log-error';
const APP_ERRORS_COLLECTION = 'app_errors';
const ERRORS_FILE_NAME = 'ERRORS.md';
const ERROR_DIVIDER = '================================================================================';
const EMPTY_LOG_MARKER = 'No errors logged yet';
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const UNKNOWN_CONTEXT = 'Unknown';
const NO_CODE_LABEL = 'None';
const NO_STACK_LABEL = 'No stack trace';
const TOTAL_ERRORS_HEADER_PREFIX = 'Total Errors: ';
const ERROR_LOG_TITLE = '🔥 ANATROX ERROR LOG';
const ERROR_COUNT_PATTERN = /Total Errors: (\d+)/;

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
const { getApiBase } = require('../for-both/online-connection/whereToConnect');

/**
 * Record one error to the file or the API, then to Firestore.
 * The API call is not awaited — the app must not block the UI on logging.
 * @param {Error|object} error
 * @param {string} context
 * @returns {Promise<void>}
 */
async function recordError(error, context) {
  // 1. Turn the thrown value into one consistent record shape for every sink.
  const recordedAt = new Date();
  const errorData = buildErrorData(error, recordedAt, context);

  // 2. Node scripts append to ERRORS.md; the mobile app posts to /api/log-error instead.
  const fileSystem = getFs();
  const errorLogFile = getErrorLogFile();
  const shouldWriteMarkdown = canWriteMarkdownFile(fileSystem, errorLogFile);
  if (shouldWriteMarkdown) {
    writeErrorToMarkdownFile(fileSystem, errorLogFile, errorData, recordedAt);
  } else {
    writeErrorToApi(errorData);
  }

  // 3. Firestore is always attempted so support can search app_errors in anatrox-auth.
  await writeErrorToFirestore(errorData);
}

module.exports = { recordError };

// PLUMBING — skip unless ERRORS.md, /api/log-error, or app_errors is missing a crash.

function formatReadableCrashTime(date) {
  const moment = date || new Date();
  const datePart = moment.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = moment.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${datePart} at ${timePart}`;
}

function messageFromCrashError(crashError) {
  if (crashError && crashError.message) return crashError.message;
  return UNKNOWN_ERROR_MESSAGE;
}

function codeFromCrashError(crashError) {
  if (crashError && crashError.code) return crashError.code;
  return null;
}

function stackFromCrashError(crashError) {
  if (crashError && crashError.stack) return crashError.stack;
  return null;
}

function buildErrorData(crashError, recordedAt, contextLabel) {
  return {
    message: messageFromCrashError(crashError),
    code: codeFromCrashError(crashError),
    stack: stackFromCrashError(crashError),
    context: contextLabel || UNKNOWN_CONTEXT,
    timestamp: recordedAt.toISOString(),
    readableTime: formatReadableCrashTime(recordedAt),
  };
}

function getFs() {
  if (!isNode) return null;
  try {
    return require('fs');
  } catch (ignoredError) {
    return null;
  }
}

function getPath() {
  if (!isNode) return null;
  try {
    return require('path');
  } catch (ignoredError) {
    return null;
  }
}

function getErrorLogFile() {
  if (!isNode) return null;
  const pathModule = getPath();
  if (!pathModule) return null;
  try {
    return pathModule.join(__dirname, '..', '..', ERRORS_FILE_NAME);
  } catch (ignoredError) {
    return null;
  }
}

function canWriteMarkdownFile(fileSystem, errorLogFile) {
  return Boolean(isNode && fileSystem && errorLogFile);
}

let cachedFirestoreDb = null;
let firestoreLookupAttempted = false;

function firestoreHandleFromConfig(firebaseConfig) {
  if (!firebaseConfig || !firebaseConfig.db) {
    console.warn('⚠️ Firestore db is null - errors won\'t be logged to Firestore');
    return null;
  }
  console.log('✅ Firestore db loaded for error logging');
  return firebaseConfig.db;
}

function getDb() {
  if (firestoreLookupAttempted) return cachedFirestoreDb;
  firestoreLookupAttempted = true;
  if (typeof require === 'undefined') return cachedFirestoreDb;
  try {
    const firebaseConfig = require('../app-start/cloudConnection');
    cachedFirestoreDb = firestoreHandleFromConfig(firebaseConfig);
  } catch (loadError) {
    console.warn('⚠️ Could not load Firestore config:', loadError.message);
  }
  return cachedFirestoreDb;
}

function errorCountFromFile(existingContent) {
  const countMatch = existingContent.match(ERROR_COUNT_PATTERN);
  if (!countMatch) return 0;
  return parseInt(countMatch[1], 10);
}

function readExistingErrorLog(fileSystem, errorLogFile) {
  if (!fileSystem.existsSync(errorLogFile)) return '';
  return fileSystem.readFileSync(errorLogFile, 'utf8');
}

function stripEmptyLogMarker(existingContent) {
  if (!existingContent.includes(EMPTY_LOG_MARKER)) return existingContent;
  return existingContent.split(EMPTY_LOG_MARKER)[0];
}

function previousErrorEntries(existingContent) {
  if (!existingContent) return '';
  const errorsStart = existingContent.indexOf(ERROR_DIVIDER);
  if (errorsStart === -1) return '';
  return existingContent.substring(errorsStart);
}

function formatErrorEntry(errorData, errorNumber) {
  const codeLabel = errorData.code || NO_CODE_LABEL;
  const stackLabel = errorData.stack || NO_STACK_LABEL;
  return `${ERROR_DIVIDER}
ERROR ${errorNumber}
${ERROR_DIVIDER}

Message: ${errorData.message}
Code: ${codeLabel}
Context: ${errorData.context}
Time: ${errorData.readableTime}
Timestamp: ${errorData.timestamp}
Stack Trace:
${stackLabel}

`;
}

function formatErrorLogHeader(newCount, recordedAt) {
  const readableUpdateTime = formatReadableCrashTime(recordedAt);
  return `${ERROR_LOG_TITLE}
${ERROR_DIVIDER}

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

${TOTAL_ERRORS_HEADER_PREFIX}${newCount}

Last updated: ${readableUpdateTime}

`;
}

function writeErrorToMarkdownFile(fileSystem, errorLogFile, errorData, recordedAt) {
  try {
    const rawContent = readExistingErrorLog(fileSystem, errorLogFile);
    const existingContent = stripEmptyLogMarker(rawContent);
    const newCount = errorCountFromFile(existingContent) + 1;
    const newContent =
      formatErrorLogHeader(newCount, recordedAt) +
      formatErrorEntry(errorData, newCount) +
      previousErrorEntries(existingContent);
    fileSystem.writeFileSync(errorLogFile, newContent, 'utf8');
    console.log(`✅ Error logged to ${errorLogFile}`);
  } catch (fileError) {
    console.error('Failed to write error to file:', fileError);
  }
}

function queueErrorIfApiCallFailed(errorData) {
  try {
    const errorSyncModule = require('./sendSavedErrors');
    if (!errorSyncModule) return;
    if (!errorSyncModule.queueErrorForSync) return;
    errorSyncModule.queueErrorForSync(errorData).catch(() => {});
  } catch (ignoredError) {
    console.log('📝 Error:', errorData);
  }
}

async function postErrorToLogApi(baseUrl, errorData) {
  const { getApiAuthHeaders } = require('../for-both/online-connection/attachLoginProof');
  const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers.Authorization) return;
  await fetch(`${baseUrl}${LOG_ERROR_PATH}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(errorData),
  });
}

function sendErrorToApiWithoutWaiting(baseUrl, errorData) {
  (async () => {
    try {
      await postErrorToLogApi(baseUrl, errorData);
    } catch (ignoredError) {
      /* queue below */
    }
  })().catch(() => {
    queueErrorIfApiCallFailed(errorData);
  });
}

function writeErrorToApi(errorData) {
  try {
    const baseUrl = getApiBase();
    sendErrorToApiWithoutWaiting(baseUrl, errorData);
  } catch (ignoredError) {
    console.log('📝 Error:', errorData);
  }
}

async function writeErrorToFirestore(errorData) {
  const firestoreDb = getDb();
  if (!firestoreDb) return;
  try {
    const { addDoc, collection, serverTimestamp } = require('firebase/firestore');
    const docRef = await addDoc(collection(firestoreDb, APP_ERRORS_COLLECTION), {
      ...errorData,
      timestamp: serverTimestamp(),
    });
    console.log('✅ Error logged to Firestore:', docRef.id);
  } catch (firestoreError) {
    console.error('❌ Failed to log error to Firestore:', firestoreError.message);
  }
}
