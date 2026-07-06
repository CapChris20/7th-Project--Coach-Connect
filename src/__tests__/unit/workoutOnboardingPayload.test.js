import { buildWorkoutOnboardingPayload } from '../../workouts/plan-generator/workoutOnboardingPayload';

describe('buildWorkoutOnboardingPayload', () => {
  it('includes normalized daysPerWeek and omits null fields', () => {
    const payload = buildWorkoutOnboardingPayload({
      age: 28,
      daysPerWeek: null,
      frequency: 4,
      injuries: null,
      weight: 152,
    });
    expect(payload.daysPerWeek).toBe(4);
    expect(payload.age).toBe(28);
    expect(payload.weight).toBe(152);
    expect(payload).not.toHaveProperty('injuries');
  });

  it('coerces string daysPerWeek to a number', () => {
    const payload = buildWorkoutOnboardingPayload({ daysPerWeek: '3' });
    expect(payload.daysPerWeek).toBe(3);
  });

  it('flattens nested onboardingData before building payload', () => {
    const payload = buildWorkoutOnboardingPayload({
      onboardingData: { daysPerWeek: 4, primaryGoal: 'build_muscle' },
      role: 'client',
    });
    expect(payload.daysPerWeek).toBe(4);
    expect(payload.primaryGoal).toBe('build_muscle');
    expect(payload).not.toHaveProperty('role');
  });
});
