const {
  buildNutritionMonthlyTimeline,
  buildWorkoutMonthlyTimeline,
  buildProgressCycleSummary,
  resolveCoachContextStartMs,
} = require('../../../server/lib/coachWeeklyData');

describe('coach progress cycle timeline', () => {
  test('resolveCoachContextStartMs uses account creation without arbitrary cap', () => {
    const created = new Date('2020-01-15T12:00:00Z').getTime();
    expect(resolveCoachContextStartMs({ createdAt: { toMillis: () => created } })).toBe(created);
  });

  test('buildNutritionMonthlyTimeline covers full history', () => {
    const timeline = buildNutritionMonthlyTimeline([
      { date: '2024-01-10', calories: 2000, protein: 150 },
      { date: '2024-01-20', calories: 2200, protein: 160 },
      { date: '2024-02-05', calories: 1800, protein: 140 },
    ]);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].month).toBe('2024-01');
    expect(timeline[0].daysLogged).toBe(2);
    expect(timeline[1].month).toBe('2024-02');
  });

  test('buildWorkoutMonthlyTimeline groups sessions by month', () => {
    const timeline = buildWorkoutMonthlyTimeline([
      '2024-01-05',
      '2024-01-12',
      '2024-02-01',
    ]);
    expect(timeline).toEqual([
      { month: '2024-01', sessions: 2 },
      { month: '2024-02', sessions: 1 },
    ]);
  });

  test('buildProgressCycleSummary compares early vs recent phases', () => {
    const lines = buildProgressCycleSummary(
      [
        { month: '2024-01', avgCalories: 1800, avgProtein: 120, daysLogged: 10 },
        { month: '2024-06', avgCalories: 2200, avgProtein: 160, daysLogged: 18 },
      ],
      [
        { month: '2024-01', sessions: 8 },
        { month: '2024-06', sessions: 16 },
      ],
      [
        { date: '2024-01-01', weightLbs: 180 },
        { date: '2024-06-01', weightLbs: 175 },
      ],
    );
    expect(lines.some((l) => l.includes('Nutrition:'))).toBe(true);
    expect(lines.some((l) => l.includes('Training:'))).toBe(true);
    expect(lines.some((l) => l.includes('Weight:'))).toBe(true);
  });
});
