/**
 * Scale / load smoke — concurrent health checks and batched Firestore writes.
 */
const { pass, fail, skip, apiFetch, canWriteFirebase, getAdmin } = require('./lib/harness');

async function testScaleTests() {
  const results = [];

  // Concurrent health requests (lightweight stand-in for 500-user spike)
  try {
    const concurrency = 20;
    const start = Date.now();
    const responses = await Promise.all(
      Array.from({ length: concurrency }, () => apiFetch('/api/health', { method: 'GET', timeoutMs: 15_000 })),
    );
    const elapsed = Date.now() - start;
    const okCount = responses.filter((r) => r.res.ok).length;
    if (okCount >= concurrency * 0.9) {
      results.push(pass(`${concurrency} concurrent health checks`, { metric: `${elapsed}ms`, ok: okCount }));
    } else {
      results.push(fail(`${concurrency} concurrent health checks`, `only ${okCount}/${concurrency} ok`, { elapsed }));
    }
  } catch (e) {
    results.push(fail('Concurrent health checks', e.message));
  }

  if (!(await canWriteFirebase())) {
    results.push(skip('Batch Firestore write throughput', 'Firebase Admin credentials not writable'));
    return results;
  }

  try {
    const db = getAdmin().firestore();
    const batchSize = 50;
    const start = Date.now();
    const batch = db.batch();
    for (let i = 0; i < batchSize; i += 1) {
      const ref = db.collection('_cc_scale_test').doc(`doc-${Date.now()}-${i}`);
      batch.set(ref, { i, ts: new Date().toISOString() });
    }
    await batch.commit();
    const elapsed = Date.now() - start;

    const snap = await db.collection('_cc_scale_test').limit(batchSize).get();
    const deleteBatch = db.batch();
    snap.docs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();

    if (elapsed < 10_000) {
      results.push(pass(`Batch ${batchSize} Firestore writes`, { metric: `${elapsed}ms` }));
    } else {
      results.push(fail(`Batch ${batchSize} Firestore writes`, `slow ${elapsed}ms`));
    }
  } catch (e) {
    results.push(fail('Batch Firestore write throughput', e.message));
  }

  return results;
}

module.exports = { testScaleTests };
