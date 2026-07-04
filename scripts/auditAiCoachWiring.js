#!/usr/bin/env node
/**
 * Wiring audit — files on disk are not enough; exports must be imported where used.
 * Complements baselineMatchAudit.mjs (file presence only).
 *
 * Run: node scripts/auditAiCoachWiring.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/** @type {Array<{id:string, severity:'error'|'warn', note:string, check:()=>boolean|string}>} */
const RULES = [
  {
    id: 'coach-chat-logging-import',
    severity: 'error',
    note: 'ChatWithCoachScreen must import coachConversationDebug (June 11 Metro logs)',
    check() {
      const src = read('src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx');
      return src.includes('coachConversationDebug') && src.includes('logCoachUserMessage');
    },
  },
  {
    id: 'coach-chat-logging-calls',
    severity: 'error',
    note: 'ChatWithCoachScreen must call logCoachUserMessage + logCoachTurnBundle on each turn',
    check() {
      const src = read('src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx');
      return (
        src.includes('logCoachUserMessage(') &&
        src.includes('logCoachAssistantMessage(') &&
        src.includes('logCoachTurnBundle(') &&
        src.includes('logCoachError(')
      );
    },
  },
  {
    id: 'coach-debug-module-exists',
    severity: 'error',
    note: 'coachConversationDebug.js must exist',
    check() {
      return exists('src/ai-coach/chat-ui/lib/coachConversationDebug.js');
    },
  },
  {
    id: 'web-search-client-routing',
    severity: 'error',
    note: 'Client must prefer Cloud Run for AI Coach + retry failed web search',
    check() {
      const base = read('src/shared/api/baseUrl.js');
      const svc = read('src/ai-coach/server-logic/chat-api/sendCoachMessageToServer.js');
      return (
        base.includes('getAICoachApiBases') &&
        base.includes('push(PRODUCTION_API_BASE_URL)') &&
        svc.includes('shouldRetryWebSearchOnNextBase')
      );
    },
  },
  {
    id: 'web-search-followup-not-fresh-search',
    severity: 'error',
    note: 'Explicit web search must not be classified as thread follow-up',
    check() {
      const { isWebAnswerFollowUp, shouldUseWebAuto } = require(path.join(
        ROOT,
        'server/lib/coachWebSearch.js',
      ));
      const msg = 'Search the web: what does research say about protein intake for lifters?';
      return shouldUseWebAuto(msg) && !isWebAnswerFollowUp(msg, [{ role: 'user', content: msg }]);
    },
  },
  {
    id: 'casual-menu-wired-to-server',
    severity: 'error',
    note: 'casualMenuSearch must be required by serperMenuFoodSearch',
    check() {
      const src = read('server/lib/serperMenuFoodSearch.js');
      return src.includes('casualMenuSearch');
    },
  },
  {
    id: 'coach-food-search-server',
    severity: 'warn',
    note: 'server/lib/coachFoodSearch.js should exist for coach food lookups',
    check() {
      return exists('server/lib/coachFoodSearch.js');
    },
  },
  {
    id: 'coach-formatted-reply-used',
    severity: 'error',
    note: 'CoachFormattedReply should be imported in ChatWithCoachScreen',
    check() {
      return read('src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx').includes('CoachFormattedReply');
    },
  },
  {
    id: 'coach-web-sources-used',
    severity: 'error',
    note: 'CoachWebSourceCards should be imported in ChatWithCoachScreen',
    check() {
      return read('src/ai-coach/chat-ui/chat-thread/ChatWithCoachScreen.jsx').includes('CoachWebSourceCards');
    },
  },
  {
    id: 'coach-quick-prompts-home',
    severity: 'error',
    note: 'StartCoachChatScreen should use hourly coach prompts',
    check() {
      const src = read('src/ai-coach/chat-ui/screens/StartCoachChatScreen.jsx');
      return src.includes('buildHourlySpotlightSuggestions') && src.includes('buildHourlyCanHelpWith');
    },
  },
  {
    id: 'coach-capabilities-orphan',
    severity: 'warn',
    note: 'coachQuickActionsList.js exists but may be unused (home has inline tiles)',
    check() {
      const cap = exists('src/ai-coach/chat-ui/lib/coachQuickActionsList.js');
      if (!cap) return true;
      const used = grepRepo('coachQuickActionsList').some((f) => !f.endsWith('coachQuickActionsList.js'));
      return used;
    },
  },
  {
    id: 'firestore-listener-utils',
    severity: 'warn',
    note: 'firestoreListenerUtils — check if still needed or inlined elsewhere',
    check() {
      const p = 'src/shared/services/firestoreListenerUtils.js';
      if (!exists(p)) return true;
      return grepRepo('firestoreListenerUtils').length > 1;
    },
  },
  {
    id: 'ai-coach-test-suite',
    severity: 'warn',
    note: 'AICoachTestSuite.jsx for in-app dev testing',
    check() {
      return exists('src/ai-coach/chat-ui/AICoachTestSuite.jsx');
    },
  },
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function grepRepo(needle) {
  const hits = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') || ent.name === 'node_modules' || ent.name === 'coverage') continue;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (/\.(js|jsx|mjs|cjs)$/.test(ent.name)) {
        try {
          if (read(path.relative(ROOT, full)).includes(needle)) hits.push(path.relative(ROOT, full));
        } catch (_) {
          /* ignore */
        }
      }
    }
  }
  walk(ROOT);
  return hits;
}

function main() {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' AI COACH WIRING AUDIT (files + imports + calls)');
  console.log('═══════════════════════════════════════════════════════════\n');

  let errors = 0;
  let warns = 0;
  let passed = 0;

  for (const rule of RULES) {
    let ok;
    try {
      ok = rule.check();
    } catch (e) {
      ok = `check threw: ${e.message}`;
    }
    const pass = ok === true;
    if (pass) {
      passed += 1;
      console.log(`✅ ${rule.id}`);
    } else if (rule.severity === 'error') {
      errors += 1;
      console.log(`❌ ${rule.id} — ${rule.note}`);
      if (ok !== false) console.log(`   ${ok}`);
    } else {
      warns += 1;
      console.log(`⚠️  ${rule.id} — ${rule.note}`);
    }
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Passed: ${passed} | Errors: ${errors} | Warnings: ${warns}`);
  console.log('\nNote: baselineMatchAudit.mjs only checks file presence on disk.');
  console.log('This script checks critical imports/calls for AI Coach + nutrition.\n');

  if (errors > 0) process.exit(1);
}

main();
