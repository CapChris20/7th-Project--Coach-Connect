const {
  getLocalDateKey,
  msUntilLocalMidnight,
  nextLocalMidnight,
} = require('../../shared/utils/getLocalDay');

describe('local day helpers', () => {
  test('returns YYYY-MM-DD local date key', () => {
    expect(getLocalDateKey(new Date('2026-06-14T12:00:00'))).toMatch(
      /^\d{4}-\d{2}-\d{2}$/
    );
  });

  test('midnight helpers are non-negative and monotonic', () => {
    const now = new Date('2026-06-14T23:59:30');
    expect(msUntilLocalMidnight(now)).toBeGreaterThan(0);
    expect(nextLocalMidnight(now).getTime()).toBeGreaterThan(now.getTime());
  });
});
