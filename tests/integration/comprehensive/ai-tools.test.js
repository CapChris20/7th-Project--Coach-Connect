/**
 * AI tools — executeTool module handles known tool names.
 */
const path = require('path');
const { pass, fail, skip, getAdmin, canWriteFirebase, ROOT } = require('./lib/harness');

async function testAiTools() {
  const results = [];

  try {
    const { executeTool } = require(path.join(ROOT, 'server/lib/coachTools/executeTool.js'));
    if (typeof executeTool === 'function') {
      results.push(pass('executeTool module exports function'));
    } else {
      results.push(fail('executeTool module exports function', 'not a function'));
      return results;
    }
  } catch (e) {
    results.push(fail('executeTool module exports function', e.message));
    return results;
  }

  const { executeTool } = require(path.join(ROOT, 'server/lib/coachTools/executeTool.js'));

  if (!(await canWriteFirebase())) {
    results.push(skip('Unknown tool returns error object', 'Firebase Admin credentials not writable'));
    results.push(skip('Tool: logSleep validates input', 'Firebase Admin credentials not writable'));
    return results;
  }

  getAdmin();

  try {
    const out = await executeTool('test-user-id', { name: '__nonexistent_tool__', params: {} });
    if (out && (out.error || out.success === false || out.message)) {
      results.push(pass('Unknown tool returns error object'));
    } else {
      results.push(fail('Unknown tool returns error object', JSON.stringify(out)));
    }
  } catch (e) {
    results.push(pass('Unknown tool throws or rejects safely', { error: e.message }));
  }

  try {
    const invalid = await executeTool('test-user-id', { name: 'logSleep', params: { hours: 99 } });
    if (invalid?.success === false) {
      results.push(pass('Tool: logSleep validates input'));
    } else {
      results.push(fail('Tool: logSleep validates input', JSON.stringify(invalid)));
    }
  } catch (e) {
    results.push(fail('Tool: logSleep validates input', e.message));
  }

  return results;
}

module.exports = { testAiTools };
