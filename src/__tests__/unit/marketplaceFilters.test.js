const {
  normalizeTrainer,
  filterTrainers,
  trainerFirstName,
  gradGradient,
  DEFAULT_FILTERS,
} = require('../../client-app/marketplace/marketplaceFilters');

describe('marketplace filter utils', () => {
  test('normalizes trainer shape', () => {
    const t = normalizeTrainer({ id: 't1', displayName: 'Chris Doe', price: 200 }, 1);
    expect(t.name).toBe('Chris Doe');
    expect(t.price).toBe(200);
    expect(Array.isArray(t.specialties)).toBe(true);
  });

  test('filters by query and preserves defaults', () => {
    const list = [
      normalizeTrainer({ id: 'a', displayName: 'Alex Lift', price: 150 }, 0),
      normalizeTrainer({ id: 'b', displayName: 'Beth Yoga', price: 220 }, 1),
    ];
    const out = filterTrainers(list, DEFAULT_FILTERS, { query: 'alex' });
    expect(out).toHaveLength(1);
    expect(trainerFirstName('Beth Yoga')).toBe('Beth');
    expect(gradGradient('unknown')).toEqual(gradGradient('pink'));
  });
});
