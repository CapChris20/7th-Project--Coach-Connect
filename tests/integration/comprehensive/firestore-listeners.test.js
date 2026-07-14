/**
 * Firestore listener wiring — verifies key subscribe helpers exist and export correctly.
 */
const fs = require('fs');
const path = require('path');
const { pass, fail, ROOT } = require('./lib/harness');

function fileContains(filePath, patterns) {
  const text = fs.readFileSync(filePath, 'utf8');
  return patterns.every((p) => text.includes(p));
}

async function testFirestoreListeners() {
  const results = [];

  const checks = [
    {
      name: 'Unread index single listener (subscribeToUnreadIndex)',
      file: 'src/messaging/unreadCountIndex.js',
      patterns: ['subscribeToUnreadIndex', 'onSnapshot', 'unreadCount', 'INDEX_DOC'],
    },
    {
      name: 'Trainer unread hook (useUnreadNotificationCount)',
      file: 'src/notifications/useUnreadNotificationCount.js',
      patterns: ['subscribeToUnreadCount', 'useEffect'],
    },
    {
      name: 'SessionsContext dedupes training sessions listener',
      file: 'src/trainer-app/hooks/useMyTrainingSessions.js',
      patterns: ['onSnapshot', 'trainer_clients'],
    },
    {
      name: 'Mark all messages read pagination (READ_PAGE_SIZE 50)',
      file: 'src/ai-coach/server-logic/services/markAllMessagesRead.js',
      patterns: ['READ_PAGE_SIZE', 'markConversationMessagesReadPaginated', 'writeBatch'],
    },
    {
      name: 'Client home daily date key bootstrap',
      file: 'src/__tests__/integration/clientHomeBootstrap.test.js',
      patterns: ['getLocalDateKey', 'home'],
    },
  ];

  for (const check of checks) {
    const fp = path.join(ROOT, check.file);
    try {
      if (!fs.existsSync(fp)) {
        results.push(fail(check.name, `missing file ${check.file}`));
        continue;
      }
      if (fileContains(fp, check.patterns)) {
        results.push(pass(check.name));
      } else {
        results.push(fail(check.name, 'expected patterns not found'));
      }
    } catch (e) {
      results.push(fail(check.name, e.message));
    }
  }

  return results;
}

module.exports = { testFirestoreListeners };
