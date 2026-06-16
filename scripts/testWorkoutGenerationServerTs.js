#!/usr/bin/env node
/**
 * Ensures recordSuccessfulWorkoutGeneration calls serverTs as a function (not a pre-called value).
 * This was the Cloud Run 500 bug after successful Claude plan generation.
 *
 * Run: node scripts/testWorkoutGenerationServerTs.js
 */
const { recordSuccessfulWorkoutGeneration } = require('../server/lib/workoutGenerationLimit');

let passed = 0;
let failed = 0;

function assert(name, cond, detail = '') {
  if (cond) {
    passed += 1;
    console.log(`✅ PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`❌ FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function run() {
  console.log('Workout generation serverTs regression\n');

  let written = null;
  let serverTsCallCount = 0;

  const mockServerTs = () => {
    serverTsCallCount += 1;
    return { _kind: 'FieldValue.serverTimestamp' };
  };

  const usageRef = { id: 'workout_generations' };
  const mockDb = {
    collection(name) {
      return {
        doc(userId) {
          return {
            collection(sub) {
              return {
                doc(docId) {
                  return usageRef;
                },
              };
            },
          };
        },
      };
    },
    runTransaction(fn) {
      const tx = {
        async get() {
          return { exists: false, data: () => ({}) };
        },
        set(_ref, data) {
          written = data;
        },
      };
      return fn(tx).then((result) => result);
    },
  };

  const usage = await recordSuccessfulWorkoutGeneration(mockDb, 'user-test-1', mockServerTs);

  assert('serverTs invoked once inside transaction', serverTsCallCount === 1);
  assert('last_generated set from serverTs()', written?.last_generated?._kind === 'FieldValue.serverTimestamp');
  assert('usage payload returned', typeof usage.generations_used === 'number');
  assert('month key stored', /^\d{4}-\d{2}$/.test(written?.month));

  // Passing a string instead of a function should throw (the old bug pattern).
  let threw = false;
  try {
    await recordSuccessfulWorkoutGeneration(mockDb, 'user-test-2', '2026-06-01T00:00:00Z');
  } catch (e) {
    threw = true;
  }
  assert('passing serverTs() value (string) throws — catches regression', threw);

  console.log('\n────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('Workout generation serverTs tests passed.');
}

run().catch((e) => {
  console.error('Unexpected error:', e);
  process.exit(1);
});
