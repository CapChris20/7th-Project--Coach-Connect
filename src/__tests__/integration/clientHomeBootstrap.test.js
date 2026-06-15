const { getLocalDateKey } = require('../../shared/utils/getLocalDay');

describe('client home bootstrap', () => {
  test('getLocalDateKey returns stable YYYY-MM-DD for home daily metrics', () => {
    const key = getLocalDateKey(new Date('2026-06-14T15:30:00'));
    expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(key).toBe('2026-06-14');
  });

  test('getLocalDateKey uses local calendar day not UTC midnight drift', () => {
    const d = new Date();
    d.setHours(23, 45, 0, 0);
    expect(getLocalDateKey(d)).toBe(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
  });
});
