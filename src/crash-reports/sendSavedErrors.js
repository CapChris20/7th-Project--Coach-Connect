// Offline error buffer, and the drain that writes it into ERRORS.txt.
// Flow: failed report → AsyncStorage queue → later drain into ERRORS.txt (newest first) → clear queue.
// queueErrorForSync is called from recordError. initializeErrorSync runs at startup.
// Read order: constants → exported recipes → PLUMBING (storage + file formatting).

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// ===== NAMED CONSTANTS =====

const ERROR_QUEUE_KEY = 'ANATROX_ERROR_QUEUE';
const ERRORS_FILE_NAME = 'ERRORS.txt';
const ERROR_DIVIDER = '================================================================================';
const EMPTY_LOG_MARKER = 'No errors logged yet';
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const NO_CODE_LABEL = 'None';
const UNKNOWN_CONTEXT = 'Unknown';
const NO_STACK_LABEL = 'No stack trace';
const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;
// Manipulate here: minutes between background drain attempts while the app stays open
const SYNC_INTERVAL_MINUTES = 5;
const SYNC_INTERVAL_MS = SYNC_INTERVAL_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const ERROR_LOG_TITLE = '🔥 ANATROX ERROR LOG';
const TOTAL_ERRORS_HEADER_PREFIX = 'Total Errors: ';
const ERROR_COUNT_PATTERN = /Total Errors: (\d+)/;
const UTF8_ENCODING = 'utf8';

// ===== MAIN FUNCTIONS =====

/**
 * Push one error onto the on-device queue. Never throws.
 * @param {object} errorData
 * @returns {Promise<void>}
 */
export async function queueErrorForSync(errorData) {
  try {
    // 1. Need AsyncStorage with get/set — some test environments omit it.
    const asyncStorage = getAsyncStorage();
    if (!canWriteQueue(asyncStorage)) {
      return;
    }

    // 2. Append with a queuedAt stamp so offline drains can sort sensibly.
    const existingQueue = await readErrorQueue(asyncStorage);
    const queuedAtStamp = new Date().toISOString();
    const queuedRecord = Object.assign({}, errorData, { queuedAt: queuedAtStamp });
    existingQueue.push(queuedRecord);
    const queueJson = JSON.stringify(existingQueue);
    await asyncStorage.setItem(ERROR_QUEUE_KEY, queueJson);
  } catch (queueError) {
    const warningMessage = queueError && queueError.message ? queueError.message : String(queueError);
    console.warn(
      'Failed to queue error for sync (this is okay in some environments):',
      warningMessage,
    );
  }
}

/**
 * Write every queued error into ERRORS.txt, then clear the queue.
 * @returns {Promise<void>}
 */
export async function syncErrorsToFile() {
  const asyncStorage = getAsyncStorage();
  const fileSystem = getFs();
  const errorLogFile = resolveErrorLogFilePath();
  const canRead = canReadQueue(asyncStorage);
  if (!canRead) {
    return;
  }
  if (!fileSystem) {
    return;
  }
  if (!errorLogFile) {
    return;
  }

  try {
    // 1. Bail early when nothing is waiting — avoids rewriting the file on every tick.
    const queuedErrors = await readErrorQueue(asyncStorage);
    if (queuedErrors.length === 0) {
      return;
    }

    // 2. Prepend queued blocks ahead of whatever was already on disk.
    const existingContent = readExistingLogFile(fileSystem, errorLogFile);
    const previousCount = errorCountFromFile(existingContent);
    const newContent = buildSyncedLogContent(existingContent, queuedErrors, previousCount);
    fileSystem.writeFileSync(errorLogFile, newContent, UTF8_ENCODING);

    // 3. Only clear the queue after the write succeeds.
    await asyncStorage.removeItem(ERROR_QUEUE_KEY);
    console.log(`✅ Synced ${queuedErrors.length} errors to ${errorLogFile}`);
  } catch (syncError) {
    console.error('Failed to sync errors to file:', syncError);
  }
}

/**
 * Drain once now, then keep draining for the life of the process.
 * @returns {Promise<void>}
 */
export async function initializeErrorSync() {
  // 1. Flush anything left from a previous session before the timer starts.
  await syncErrorsToFile();

  // 2. Keep draining on a timer when setInterval exists (Node / RN).
  if (typeof setInterval === 'undefined') {
    return;
  }
  setInterval(async () => {
    await syncErrorsToFile();
  }, SYNC_INTERVAL_MS);
}

// PLUMBING — skip unless a queued crash never shows up in ERRORS.txt.

let cachedAsyncStorage = null;
let cachedFileSystem = null;

function markAsyncStorageUnavailable() {
  cachedAsyncStorage = false;
  return null;
}

function pickStorageExport(storageModule) {
  if (storageModule.default) {
    return storageModule.default;
  }
  return storageModule;
}

function storageHasGetAndSet(storage) {
  if (!storage) {
    return false;
  }
  if (typeof storage.getItem !== 'function') {
    return false;
  }
  if (typeof storage.setItem !== 'function') {
    return false;
  }
  return true;
}

function asyncStorageFromModule(storageModule) {
  if (!storageModule) {
    return markAsyncStorageUnavailable();
  }
  const storage = pickStorageExport(storageModule);
  if (!storageHasGetAndSet(storage)) {
    return markAsyncStorageUnavailable();
  }
  cachedAsyncStorage = storage;
  return cachedAsyncStorage;
}

function getAsyncStorage() {
  if (cachedAsyncStorage !== null) {
    return cachedAsyncStorage;
  }
  if (typeof require === 'undefined') {
    return markAsyncStorageUnavailable();
  }
  try {
    // vocab: AsyncStorage = on-device key/value store (survives app restarts)
    const storageModule = require('@react-native-async-storage/async-storage');
    return asyncStorageFromModule(storageModule);
  } catch (ignoredError) {
    return markAsyncStorageUnavailable();
  }
}

function getFileSystem() {
  if (cachedFileSystem) {
    return cachedFileSystem;
  }
  if (typeof require === 'undefined') {
    return null;
  }
  try {
    const fileSystemModule = require('expo-file-system');
    if (!fileSystemModule) {
      return null;
    }
    cachedFileSystem = fileSystemModule;
    return cachedFileSystem;
  } catch (ignoredError) {
    return null;
  }
}

function getFs() {
  if (!isNode) {
    return null;
  }
  try {
    return require('fs');
  } catch (ignoredError) {
    return null;
  }
}

function getPath() {
  if (!isNode) {
    return null;
  }
  try {
    return require('path');
  } catch (ignoredError) {
    return null;
  }
}

function resolveErrorLogFilePath() {
  if (!isNode) {
    return null;
  }
  const pathModule = getPath();
  if (!pathModule) {
    return null;
  }
  return pathModule.join(process.cwd(), ERRORS_FILE_NAME);
}

function formatTimestamp(date) {
  let moment = date;
  if (!moment) {
    moment = new Date();
  }
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

function errorCountFromFile(existingContent) {
  const countMatch = existingContent.match(ERROR_COUNT_PATTERN);
  if (!countMatch) {
    return 0;
  }
  return parseInt(countMatch[1], 10);
}

function readableTimeForQueuedError(errorData) {
  if (errorData.readableTime) {
    return errorData.readableTime;
  }
  if (errorData.queuedAt) {
    return errorData.queuedAt;
  }
  return formatTimestamp(new Date(errorData.timestamp));
}

function timestampForQueuedError(errorData) {
  if (errorData.timestamp) {
    return errorData.timestamp;
  }
  if (errorData.queuedAt) {
    return errorData.queuedAt;
  }
  return new Date().toISOString();
}

function messageLineForError(errorData) {
  if (errorData.message) {
    return errorData.message;
  }
  return UNKNOWN_ERROR_MESSAGE;
}

function codeLineForError(errorData) {
  if (errorData.code) {
    return errorData.code;
  }
  return NO_CODE_LABEL;
}

function contextLineForError(errorData) {
  if (errorData.context) {
    return errorData.context;
  }
  return UNKNOWN_CONTEXT;
}

function stackLineForError(errorData) {
  if (errorData.stack) {
    return errorData.stack;
  }
  return NO_STACK_LABEL;
}

function renderQueuedErrorBlock(errorData, errorNumber) {
  const readableTime = readableTimeForQueuedError(errorData);
  const timestamp = timestampForQueuedError(errorData);
  const messageLine = messageLineForError(errorData);
  const codeLine = codeLineForError(errorData);
  const contextLine = contextLineForError(errorData);
  const stackLine = stackLineForError(errorData);
  return `${ERROR_DIVIDER}
ERROR ${errorNumber}
${ERROR_DIVIDER}

Message: ${messageLine}
Code: ${codeLine}
Context: ${contextLine}
Time: ${readableTime}
Timestamp: ${timestamp}
Stack Trace:
${stackLine}

`;
}

function previousErrorEntries(existingContent) {
  if (!existingContent) {
    return '';
  }
  const errorsStart = existingContent.indexOf(ERROR_DIVIDER);
  if (errorsStart === -1) {
    return '';
  }
  return existingContent.substring(errorsStart);
}

function formatSyncedLogHeader(totalCount) {
  const readableUpdateTime = formatTimestamp(new Date());
  return `${ERROR_LOG_TITLE}
${ERROR_DIVIDER}

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

${TOTAL_ERRORS_HEADER_PREFIX}${totalCount}

Last updated: ${readableUpdateTime}

`;
}

function buildSyncedLogContent(existingContent, queuedErrors, previousCount) {
  const totalCount = previousCount + queuedErrors.length;
  let newContent = formatSyncedLogHeader(totalCount);
  for (let index = 0; index < queuedErrors.length; index += 1) {
    const errorData = queuedErrors[index];
    const errorNumber = previousCount + index + 1;
    newContent += renderQueuedErrorBlock(errorData, errorNumber);
  }
  newContent += previousErrorEntries(existingContent);
  return newContent;
}

function canReadQueue(asyncStorage) {
  if (!asyncStorage) {
    return false;
  }
  if (typeof asyncStorage.getItem !== 'function') {
    return false;
  }
  return true;
}

function canWriteQueue(asyncStorage) {
  if (!canReadQueue(asyncStorage)) {
    return false;
  }
  if (typeof asyncStorage.setItem !== 'function') {
    return false;
  }
  return true;
}

async function readErrorQueue(asyncStorage) {
  const queueJson = await asyncStorage.getItem(ERROR_QUEUE_KEY);
  if (!queueJson) {
    return [];
  }
  return JSON.parse(queueJson);
}

function readExistingLogFile(fileSystem, errorLogFile) {
  const fileExists = fileSystem.existsSync(errorLogFile);
  if (!fileExists) {
    return '';
  }
  const existingContent = fileSystem.readFileSync(errorLogFile, UTF8_ENCODING);
  const hasEmptyMarker = existingContent.includes(EMPTY_LOG_MARKER);
  if (!hasEmptyMarker) {
    return existingContent;
  }
  const parts = existingContent.split(EMPTY_LOG_MARKER);
  return parts[0];
}
