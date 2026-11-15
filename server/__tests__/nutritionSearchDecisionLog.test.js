const {
  handleNutritionSearch,
  logSearchDecision,
} = require('../routes/nutritionSearchRoutes');

function captureLogs(run) {
  const lines = [];
  const original = console.log;
  console.log = (...args) => {
    lines.push(args.map((part) => (typeof part === 'string' ? part : JSON.stringify(part))).join(' '));
  };
  return Promise.resolve()
    .then(run)
    .finally(() => {
      console.log = original;
    })
    .then(() => lines);
}

function decisionFrom(lines) {
  const line = lines.find((entry) => entry.includes('[Nutrition Search] decision'));
  if (!line) return null;
  const jsonStart = line.indexOf('{');
  return JSON.parse(line.slice(jsonStart));
}

describe('nutrition search decision log', () => {
  test('logs query, shown ids, selected id, and status without a user id', async () => {
    const lines = await captureLogs(() => logSearchDecision({
      query: 'cooked grain',
      restaurant: null,
      sourceResults: [{ sourceKey: 'usdaFdc', displayName: 'should-not-matter' }],
      consensus: { calories: { value: 180 } },
      status: 'shown',
    }));
    const decision = decisionFrom(lines);
    expect(decision).toEqual({
      query: 'cooked grain',
      restaurant: null,
      shownCandidateIds: ['consensus', 'usdaFdc'],
      selectedId: null,
      status: 'shown',
    });
    expect(decision.uid).toBeUndefined();
    expect(decision.email).toBeUndefined();
    expect(JSON.stringify(decision).includes('should-not-matter')).toBe(false);
  });

  test('handleNutritionSearch logs a shown decision and does not put a uid in it', async () => {
    const response = {
      statusCode: 200,
      body: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.body = payload;
        return this;
      },
    };
    const lines = await captureLogs(() => handleNutritionSearch(
      {
        body: { foodName: 'cooked grain' },
        firebaseAuth: { uid: 'user-should-not-be-in-decision' },
      },
      response,
      {
        skipDailyLimit: true,
        searchFoodNutrition: async () => ({
          query: { foodName: 'cooked grain' },
          consensus: { calories: { value: 100, sources_agreeing: 2 } },
          sourceResults: [{ sourceKey: 'openFoodFacts' }],
          excludedSources: [],
          sources_used: ['OpenFoodFacts'],
          siteLogs: [],
          successCount: 1,
          fallbackUsed: false,
        }),
      },
    ));
    const decision = decisionFrom(lines);
    expect(response.statusCode).toBe(200);
    expect(decision.query).toBe('cooked grain');
    expect(decision.shownCandidateIds).toEqual(['consensus', 'openFoodFacts']);
    expect(decision.selectedId).toBeNull();
    expect(decision.status).toBe('shown');
    expect(decision.uid).toBeUndefined();
    expect(JSON.stringify(decision).includes('user-should-not-be-in-decision')).toBe(false);
  });
});
