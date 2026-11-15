/**
 * Metamorphic invariants for food match.
 * These assert the invariant HOLDS. On the v1 pipeline several are expected to fail.
 * Do not weaken an assertion to make v1 pass.
 */
const fs = require('fs');
const path = require('path');

jest.mock('axios', () => ({
  post: jest.fn(async () => ({ data: {} })),
  get: jest.fn(async () => ({ data: {} })),
}));

jest.mock('../lib/fatSecretClient', () => ({
  lookupBarcodeFatSecret: jest.fn(async () => null),
  fatSecretConfigured: () => false,
}));

const { runEval, runInvariants, stableJson, loadCorpus } = require('../../scripts/evalFoodSearch');

function gs1CheckDigit(body) {
  let sum = 0;
  for (let index = 0; index < body.length; index += 1) {
    const fromRight = body.length - index;
    const weight = fromRight % 2 === 1 ? 3 : 1;
    sum += Number(body[index]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

describe('food match invariants on the v1 pipeline', () => {
  const corpus = loadCorpus();
  const first = runEval(corpus);
  const second = runEval(corpus);
  const invariants = runInvariants(corpus, first, stableJson(first), stableJson(second));

  test.each(invariants.filter((item) => item.id !== 8))('invariant $id holds', (invariant) => {
    expect({ id: invariant.id, holds: invariant.holds, failures: invariant.failures }).toEqual({
      id: invariant.id,
      holds: true,
      failures: [],
    });
  });

  test('invariant 8: a bad checksum makes no network call', async () => {
    const axios = require('axios');
    axios.post.mockClear();
    axios.get.mockClear();
    process.env.USDA_API_KEY = 'test-key';
    process.env.SERPER_API_KEY = 'test-key';
    const body = '11111111111';
    const bad = `${body}${(gs1CheckDigit(body) + 1) % 10}`;
    const { resolveBarcodeLookup } = require('../lib/resolveBarcodeLookup');
    await resolveBarcodeLookup(bad);
    expect(axios.post).not.toHaveBeenCalled();
    expect(axios.get).not.toHaveBeenCalled();
  });

  test('two eval runs are byte-identical', () => {
    expect(stableJson(first)).toBe(stableJson(second));
  });
});

describe('barcode mismatch trace file', () => {
  const tracePath = path.join(__dirname, '../../scripts/data/barcodeMismatchTrace.json');

  test('trace file exists after scripts/traceBarcodeMismatch.js', () => {
    expect(fs.existsSync(tracePath)).toBe(true);
  });
});
