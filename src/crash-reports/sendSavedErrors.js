// Offline error buffer, and the drain that writes it into ERRORS.txt.
// Flow: a failed report is pushed onto an AsyncStorage queue → later, when Node
//       can see the filesystem, the queue is written newest-first and then emptied.
// queueErrorForSync is called from recordError. initializeErrorSync runs at startup.

// ===== NAMED CONSTANTS =====

// Same environment probe as recordError.js. The file-writing half only works under Node.
// vocab: process.versions.node exists in Node and not in React Native.
const isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// Manipulate here: renaming this key orphans errors already queued on existing devices.
const ERROR_QUEUE_KEY = 'ANATROX_ERROR_QUEUE';
const ERRORS_FILE_NAME = 'ERRORS.txt';
const ERROR_DIVIDER = '================================================================================';
const EMPTY_LOG_MARKER = 'No errors logged yet';
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const NO_CODE_LABEL = 'None';
const UNKNOWN_CONTEXT = 'Unknown';
const NO_STACK_LABEL = 'No stack trace';
// Manipulate here: shorter interval = fresher ERRORS.txt, more file writes.
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

// Module cache. Three states on purpose for AsyncStorage:
//   null = not looked up yet, false = looked up and unavailable, object = the real module.
// false stops us from retrying a doomed require on every error.
let cachedAsyncStorage = null;
let cachedFileSystem = null;

// ===== HELPER FUNCTIONS =====

// Required lazily so this file can load on a phone, in a browser, or in a bare Node script.
function getAsyncStorage() {
  if (cachedAsyncStorage !== null) return cachedAsyncStorage;
  try {
    if (typeof require === 'undefined') {
      cachedAsyncStorage = false;
      return null;
    }
    const storageModule = require('@react-native-async-storage/async-storage');
    if (!storageModule) {
      cachedAsyncStorage = false;
      return null;
    }
    // The package is an ES default export. Interop sometimes hands back the namespace instead.
    const storage = storageModule.default || storageModule;
    // Expo Go / web can resolve a stub with no methods. Checking the methods avoids a crash later.
    if (storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function') {
      cachedAsyncStorage = storage;
      return cachedAsyncStorage;
    }
    cachedAsyncStorage = false;
    return null;
  } catch (ignoredError) {
    cachedAsyncStorage = false;
    return null;
  }
}

function getFileSystem() {
  if (cachedFileSystem) return cachedFileSystem;
  try {
    if (typeof require === 'undefined') return null;
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

// vocab: process.cwd() = the directory the Node script was launched from.
// Manipulate here: ERRORS.txt is the drain target. recordError.js writes ERRORS.md instead.
function resolveErrorLogFile() {
  if (!isNode) return null;
  const pathModule = getPath();
  if (!pathModule) return null;
  return pathModule.join(process.cwd(), ERRORS_FILE_NAME);
}

const ERROR_LOG_FILE = resolveErrorLogFile();

/**
 * Same human stamp recordError.js uses. Kept local so this file does not import that one at load time.
 * @param {Date} [date]
 * @returns {string}
 */
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

/**
 * @param {string} existingContent
 * @returns {number}
 */
function errorCountFromFile(existingContent) {
  const countMatch = existingContent.match(/Total Errors: (\d+)/);
  return countMatch ? parseInt(countMatch[1]) : 0;
}

/**
 * Older queued rows are missing fields newer ones have. Each line has a fallback chain.
 * @param {object} errorData
 * @param {number} errorNumber
 * @returns {string}
 */
function renderQueuedErrorBlock(errorData, errorNumber) {
  const readableTime = errorData.readableTime
    || errorData.queuedAt
    || formatTimestamp(new Date(errorData.timestamp));
  const timestamp = errorData.timestamp || errorData.queuedAt || new Date().toISOString();
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

/**
 * Fresh header, then this batch, then the older entries sliced from the first divider.
 * @param {string} existingContent
 * @param {object[]} queuedErrors
 * @param {number} previousCount
 * @returns {string}
 */
function buildSyncedLogContent(existingContent, queuedErrors, previousCount) {
  const readableUpdateTime = formatTimestamp(new Date());
  let newContent = `🔥 ANATROX ERROR LOG
${ERROR_DIVIDER}

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${previousCount + queuedErrors.length}

Last updated: ${readableUpdateTime}

`;

  queuedErrors.forEach((errorData, index) => {
    newContent += renderQueuedErrorBlock(errorData, previousCount + index + 1);
  });

  if (existingContent) {
    const errorsStart = existingContent.indexOf(ERROR_DIVIDER);
    if (errorsStart !== -1) {
      newContent += existingContent.substring(errorsStart);
    }
  }

  return newContent;
}

/**
 * @param {object} asyncStorage
 * @returns {boolean}
 */
function canReadQueue(asyncStorage) {
  return Boolean(asyncStorage) && typeof asyncStorage.getItem === 'function';
}

// ===== MAIN FUNCTION =====

/**
 * Push one error onto the on-device queue. Never throws: this runs inside other error handlers.
 * The queue is unbounded. A phone stuck offline through a crash loop will grow this blob.
 * Manipulate here: slice the array (for example queue.slice(-200)) if that becomes a problem.
 * @param {object} errorData
 * @returns {Promise<void>}
 */
export async function queueErrorForSync(errorData) {
  try {
    const asyncStorage = getAsyncStorage();
    if (!asyncStorage) return;
    if (typeof asyncStorage.getItem !== 'function' || typeof asyncStorage.setItem !== 'function') return;

    // AsyncStorage only stores strings, so the whole queue is one JSON blob.
    const queueJson = await asyncStorage.getItem(ERROR_QUEUE_KEY);
    const queue = queueJson ? JSON.parse(queueJson) : [];

    // queuedAt is extra, so you can see the gap between the error and when the phone stored it.
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
 * Needs both AsyncStorage and Node's fs. On a phone this returns without doing anything.
 * The queue is cleared only after the write succeeds, so a failed write is retried next time.
 * @returns {Promise<void>}
 */
export async function syncErrorsToFile() {
  const asyncStorage = getAsyncStorage();
  const fileSystem = getFs();

  if (!canReadQueue(asyncStorage) || !fileSystem || !ERROR_LOG_FILE) return;

  try {
    const queueJson = await asyncStorage.getItem(ERROR_QUEUE_KEY);
    if (!queueJson) return;

    const queuedErrors = JSON.parse(queueJson);
    if (queuedErrors.length === 0) return;

    let existingContent = '';
    if (fileSystem.existsSync(ERROR_LOG_FILE)) {
      existingContent = fileSystem.readFileSync(ERROR_LOG_FILE, 'utf8');
    }

    if (existingContent.includes(EMPTY_LOG_MARKER)) {
      existingContent = existingContent.split(EMPTY_LOG_MARKER)[0];
    }

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
 * Drain once now (errors from the previous session, including a crash), then keep draining.
 * The interval is never cleared. It is meant to live as long as the process does.
 * @returns {Promise<void>}
 */
export async function initializeErrorSync() {
  await syncErrorsToFile();

  if (typeof setInterval !== 'undefined') {
    setInterval(async () => {
      await syncErrorsToFile();
    }, SYNC_INTERVAL_MS);
  }
}
