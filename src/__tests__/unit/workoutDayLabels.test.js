const {
  normalizeWorkoutDayLabel,
  isAllowedClientWorkoutDayLabel,
  WORKOUT_DAY_EXAMPLES_SHORT,
} = require('../../shared/utils/workoutDayLabels');

test('workout day label normalization and allowlist', () => {
  expect(normalizeWorkoutDayLabel('  Chest   Day ')).toBe('chest day');
  expect(isAllowedClientWorkoutDayLabel('Pull Day')).toBe(true);
  expect(isAllowedClientWorkoutDayLabel('Totally Random Label')).toBe(false);
  expect(WORKOUT_DAY_EXAMPLES_SHORT).toContain('Leg Day');
});
