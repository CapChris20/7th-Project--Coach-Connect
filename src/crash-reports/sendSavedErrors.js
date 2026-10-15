// Offline error buffer, and the drain that writes it into ERRORS.txt.
// Flow: a failed report is pushed onto an AsyncStorage queue → later, when Node can see the filesystem, the queue is written newest-first and then emptied.
// queueErrorForSync is called from recordError. initializeErrorSync runs at startup.

// ===== NAMED CONSTANTS =====

const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
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
const SYNC_INTERVAL_MINUTES = 5;
const SYNC_INTERVAL_MS = SYNC_INTERVAL_MINUTES * SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;
const ERROR_LOG_TITLE = '🔥 ANATROX ERROR LOG';
const TOTAL_ERRORS_HEADER_PREFIX = 'Total Errors: ';
const ERROR_COUNT_PATTERN = /Total Errors: (\d+)/;

let cachedAsyncStorage = null;
let cachedFileSystem = null;

// ===== HELPER FUNCTIONS =====

// PLUMBING — skip unless a queued crash never shows up in ERRORS.txt.

function markAsyncStorageUnavailable() {
  cachedAsyncStorage = false;
  return null;
}

function asyncStorageFromModule(storageModule) {
  if (!storageModule) return markAsyncStorageUnavailable();
  const storage = storageModule.default || storageModule;
  const hasGetAndSet =
    storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
  if (!hasGetAndSet) return markAsyncStorageUnavailable();
  cachedAsyncStorage = storage;
  return cachedAsyncStorage;
}

function getAsyncStorage() {
  if (cachedAsyncStorage !== null) return cachedAsyncStorage;
  if (typeof require === 'undefined') return markAsyncStorageUnavailable();
  try {
    return asyncStorageFromModule(require('@react-native-async-storage/async-storage'));
  } catch (ignoredError) {
    return markAsyncStorageUnavailable();
  }
}

function getFileSystem() {
  if (cachedFileSystem) return cachedFileSystem;
  if (typeof require === 'undefined') return null;
  try {
    const fileSystemModule = require('expo-file-system');
    if (!fileSystemModule) return null;
    cachedFileSystem = fileSystemModule;
    return cachedFileSystem;
  } catch (ignoredError) {
    return null;
  }
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

function resolveErrorLogFile() {
  if (!isNode) return null;
  const pathModule = getPath();
  if (!pathModule) return null;
  return pathModule.join(process.cwd(), ERRORS_FILE_NAME);
}

const ERROR_LOG_FILE = resolveErrorLogFile();

function formatTimestamp(date) {
  const now = date || new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}

function errorCountFromFile(existingContent) {
  const countMatch = existingContent.match(ERROR_COUNT_PATTERN);
  if (!countMatch) return 0;
  return parseInt(countMatch[1], 10);
}

function readableTimeForQueuedError(errorData) {
  if (errorData.readableTime) return errorData.readableTime;
  if (errorData.queuedAt) return errorData.queuedAt;
  return formatTimestamp(new Date(errorData.timestamp));
}

function timestampForQueuedError(errorData) {
  if (errorData.timestamp) return errorData.timestamp;
  if (errorData.queuedAt) return errorData.queuedAt;
  return new Date().toISOString();
}

function renderQueuedErrorBlock(errorData, errorNumber) {
  const readableTime = readableTimeForQueuedError(errorData);
  const timestamp = timestampForQueuedError(errorData);
  return `${ERROR_DIVIDER}
ERROR ${errorNumber}
${ERROR_DIVIDER}

Message: ${errorData.message || UNKNOWN_ERROR_MESSAGE}
Code: ${errorData.code || NO_CODE_LABEL}
Context: ${errorData.context || UNKNOWN_CONTEXT}
Time: ${readableTime}
Timestamp: ${timestamp}
Stack Trace:
${errorData.stack || NO_STACK_LABEL}

`;
}

function previousErrorEntries(existingContent) {
  if (!existingContent) return '';
  const errorsStart = existingContent.indexOf(ERROR_DIVIDER);
  if (errorsStart === -1) return '';
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
  let newContent = formatSyncedLogHeader(previousCount + queuedErrors.length);
  queuedErrors.forEach((errorData, index) => {
    newContent += renderQueuedErrorBlock(errorData, previousCount + index + 1);
  });
  newContent += previousErrorEntries(existingContent);
  return newContent;
}

function canReadQueue(asyncStorage) {
  return Boolean(asyncStorage) && typeof asyncStorage.getItem === 'function';
}

function canWriteQueue(asyncStorage) {
  return (
    Boolean(asyncStorage) &&
    typeof asyncStorage.getItem === 'function' &&
    typeof asyncStorage.setItem === 'function'
  );
}

async function readErrorQueue(asyncStorage) {
  const queueJson = await asyncStorage.getItem(ERROR_QUEUE_KEY);
  if (!queueJson) return [];
  return JSON.parse(queueJson);
}

function readExistingLogFile(fileSystem, errorLogFile) {
  if (!fileSystem.existsSync(errorLogFile)) return '';
  const existingContent = fileSystem.readFileSync(errorLogFile, 'utf8');
  if (!existingContent.includes(EMPTY_LOG_MARKER)) return existingContent;
  return existingContent.split(EMPTY_LOG_MARKER)[0];
}

// ===== MAIN FUNCTION =====

/**
 * Push one error onto the on-device queue. Never throws.
 * @param {object} errorData
 * @returns {Promise<void>}
 */
export async function queueErrorForSync(errorData) {
  try {
    const asyncStorage = getAsyncStorage();
    if (!canWriteQueue(asyncStorage)) return;
    const queue = await readErrorQueue(asyncStorage);
    queue.push({
      ...errorData,
      queuedAt: new Date().toISOString(),
    });
    await asyncStorage.setItem(ERROR_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('Failed to queue error for sync (this is okay in some environments):', error.message);
  }
}

/**
 * Write every queued error into ERRORS.txt, then clear the queue.
 * @returns {Promise<void>}
 */
export async function syncErrorsToFile() {
  const asyncStorage = getAsyncStorage();
  const fileSystem = getFs();
  if (!canReadQueue(asyncStorage) || !fileSystem || !ERROR_LOG_FILE) return;

  try {
    const queuedErrors = await readErrorQueue(asyncStorage);
    if (queuedErrors.length === 0) return;
    const existingContent = readExistingLogFile(fileSystem, ERROR_LOG_FILE);
    const previousCount = errorCountFromFile(existingContent);
    const newContent = buildSyncedLogContent(existingContent, queuedErrors, previousCount);
    fileSystem.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
    await asyncStorage.removeItem(ERROR_QUEUE_KEY);
    console.log(`✅ Synced ${queuedErrors.length} errors to ${ERROR_LOG_FILE}`);
  } catch (error) {
    console.error('Failed to sync errors to file:', error);
  }
}

/**
 * Drain once now, then keep draining for the life of the process.
 * @returns {Promise<void>}
 */
export async function initializeErrorSync() {
  await syncErrorsToFile();
  if (typeof setInterval === 'undefined') return;
  setInterval(async () => {
    await syncErrorsToFile();
  }, SYNC_INTERVAL_MS);
}
