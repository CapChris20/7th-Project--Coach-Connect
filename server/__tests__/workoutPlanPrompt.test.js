const {
  buildWorkoutUserPrompt,
  buildExerciseExclusionBlock,
  buildExercisePreferenceBlock,
  getPreferredExercisesList,
} = require('../lib/workoutPlanPrompt');

describe('workoutPlanPrompt preferred exercises', () => {
  it('reads preferred exercises from legacy exercisesDislike field', () => {
    expect(getPreferredExercisesList({ exercisesDislike: 'Lat Pulldown, Cable Row' })).toBe(
      'Lat Pulldown, Cable Row',
    );
  });

  it('does not put preferred exercises in the injury exclusion block', () => {
    const block = buildExerciseExclusionBlock({
      exercisesDislike: 'Lat Pulldown, Cable Row',
      injuries: 'Knee pain — no deep squats',
    });
    expect(block).toContain('Knee pain');
    expect(block).not.toContain('Lat Pulldown');
    expect(block).not.toContain('Cable Row');
  });

  it('builds a preference block that tells the model to include listed exercises', () => {
    const block = buildExercisePreferenceBlock({
      exercisesDislike: 'Lat Pulldown, Cable Row',
    });
    expect(block).toContain('PREFERRED EXERCISES');
    expect(block).toContain('Lat Pulldown, Cable Row');
    expect(block).toContain('NOT a ban list');
    expect(block).toContain('INCLUDE');
  });

  it('user prompt prioritizes inclusion and keeps exclusions injury-only', () => {
    const prompt = buildWorkoutUserPrompt({
      exercisesDislike: 'Lat Pulldown',
      injuries: 'Shoulder impingement',
      daysPerWeek: 4,
    });
    expect(prompt).toContain('Preferred Exercises (include in plan when possible): Lat Pulldown');
    expect(prompt).toContain('PREFERRED EXERCISES');
    expect(prompt).toContain('Shoulder impingement');
    expect(prompt).not.toMatch(/banned.*Lat Pulldown/i);
    expect(prompt).toContain('preferred exercises must appear in the plan when feasible');
    expect(prompt).toContain('Training Days Per Week: 4');
    expect(prompt).toContain('EXACTLY 4 day(s)');
    expect(prompt).not.toContain('5-day per week');
  });

  it('resolves daysPerWeek from legacy frequency field', () => {
    const { resolveDaysPerWeek } = require('../lib/workoutPlanPrompt');
    expect(resolveDaysPerWeek({ frequency: 4 })).toBe(4);
    expect(resolveDaysPerWeek({ daysPerWeek: null, frequency: '3' })).toBe(3);
  });
});
