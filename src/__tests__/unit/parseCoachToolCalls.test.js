const {
  parseCoachToolCalls,
  stripCoachToolJsonFromReply,
} = require('../../ai-coach/tools/parseCoachToolCalls');

const { normalizeToolParams } = require('../../ai-coach/server-logic/tools/cleanupToolParams');

describe('parseCoachToolCalls', () => {
  it('parses valid JSON at end of reply', () => {
    const reply =
      'I can log that for you.\n{"toolCalls":[{"name":"logWater","params":{"amountOz":32}}]}';
    const calls = parseCoachToolCalls(reply);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'logWater',
      params: { amountOz: 32 },
    });
  });

  it('parses fenced JSON inside backticks', () => {
    const reply = 'Done.\n```json\n{"tool":"logSleep","params":{"hours":7}}\n```';
    const calls = parseCoachToolCalls(reply);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      name: 'logSleep',
      params: { hours: 7 },
    });
  });

  it('returns empty array for plain text with no JSON', () => {
    expect(parseCoachToolCalls('Just a friendly reply with no tools.')).toEqual([]);
  });

  it('returns empty array for malformed JSON without throwing', () => {
    expect(() => parseCoachToolCalls('{"toolCalls":[{broken json')).not.toThrow();
    expect(parseCoachToolCalls('{"toolCalls":[{broken json')).toEqual([]);
  });

  it('returns all tool calls when multiple are present', () => {
    const reply =
      '{"toolCalls":[{"name":"logWater","params":{"amountOz":16}},{"name":"logSteps","params":{"steps":5000}}]}';
    const calls = parseCoachToolCalls(reply);
    expect(calls).toHaveLength(2);
    expect(calls.map((c) => c.name)).toEqual(['logWater', 'logSteps']);
  });

  it('returns empty array for empty string without throwing', () => {
    expect(() => parseCoachToolCalls('')).not.toThrow();
    expect(parseCoachToolCalls('')).toEqual([]);
    expect(() => parseCoachToolCalls(null)).not.toThrow();
    expect(parseCoachToolCalls(null)).toEqual([]);
  });
});

describe('stripCoachToolJsonFromReply', () => {
  it('strips trailing JSON and returns clean text only', () => {
    const reply =
      'Logged your water.\n{"toolCalls":[{"name":"logWater","params":{"amountOz":32}}]}';
    expect(stripCoachToolJsonFromReply(reply)).toBe('Logged your water.');
  });

  it('returns reply unchanged when no JSON is present', () => {
    const reply = 'No tools here.';
    expect(stripCoachToolJsonFromReply(reply)).toBe('No tools here.');
  });

  it('returns empty string when reply is only JSON', () => {
    const reply = '{"toolCalls":[{"name":"logSleep","params":{"hours":7}}]}';
    expect(stripCoachToolJsonFromReply(reply)).toBe('');
  });

  it('strips fenced JSON correctly', () => {
    const reply = 'All set.\n```json\n{"tool":"logMood","params":{"mood":"great"}}\n```';
    expect(stripCoachToolJsonFromReply(reply)).toBe('All set.');
  });
});

describe('normalizeToolParams', () => {
  it('maps logWater amountOz to amount_oz', () => {
    expect(normalizeToolParams('logWater', { amountOz: 32 })).toMatchObject({
      amountOz: 32,
      amount_oz: 32,
    });
  });

  it('maps logNutrition meal snack to mealType snacks', () => {
    expect(normalizeToolParams('logNutrition', { meal: 'snack' })).toMatchObject({
      meal: 'snack',
      mealType: 'snacks',
    });
  });

  it('keeps logSleep hours unchanged', () => {
    expect(normalizeToolParams('logSleep', { hours: 7 })).toEqual({ hours: 7 });
  });

  it('passes unknown aliases through without error', () => {
    expect(() => normalizeToolParams('notifyTrainer', { message: 'Hello coach' })).not.toThrow();
    expect(normalizeToolParams('notifyTrainer', { message: 'Hello coach' })).toEqual({
      message: 'Hello coach',
    });
  });

  it('does not throw when params are missing', () => {
    expect(() => normalizeToolParams('logWater')).not.toThrow();
    expect(() => normalizeToolParams('logWater', null)).not.toThrow();
    expect(normalizeToolParams('logWater')).toMatchObject({ amount_oz: null });
  });
});
