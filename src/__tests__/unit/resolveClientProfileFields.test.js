import {
  normalizeClientProfileFields,
  resolveClientProfileFields,
} from '../../shared-utils/resolveClientProfileFields';

describe('resolveClientProfileFields', () => {
  it('fills profile fields from the first source when merged starts empty', () => {
    const merged = resolveClientProfileFields({
      age: 28,
      height: { feet: 5, inches: 11 },
      weight: 180,
      gender: 'male',
      goals: ['build_muscle'],
      fitnessLevel: 'intermediate',
      daysPerWeek: 4,
      equipmentAccess: ['dumbbells', 'full_gym'],
    });

    expect(merged.age).toBe(28);
    expect(merged.primaryGoal).toBe('build_muscle');
    expect(merged.fitnessLevel).toBe('intermediate');
    expect(merged.daysPerWeek).toBe(4);
    expect(merged.equipmentAccess).toEqual(['dumbbells', 'full_gym']);
  });

  it('prefers later non-empty sources (Firestore over local cache)', () => {
    const merged = resolveClientProfileFields(
      { age: 25, primaryGoal: 'lose_fat', fitnessLevel: 'beginner' },
      { age: 30, fitnessLevel: 'advanced' },
    );

    expect(merged.age).toBe(30);
    expect(merged.primaryGoal).toBe('lose_fat');
    expect(merged.fitnessLevel).toBe('advanced');
  });

  it('keeps cached values when Firestore fields are empty', () => {
    const merged = resolveClientProfileFields(
      { age: 25, daysPerWeek: 3, equipmentAccess: ['bodyweight'] },
      { age: null, daysPerWeek: null, equipmentAccess: [] },
    );

    expect(merged.age).toBe(25);
    expect(merged.daysPerWeek).toBe(3);
    expect(merged.equipmentAccess).toEqual(['bodyweight']);
  });

  it('unwraps nested onboardingData and maps aliases', () => {
    const normalized = normalizeClientProfileFields({
      firstName: 'Cade',
      lastName: 'Cunningham',
      onboardingData: {
        age: 22,
        experience: 'intermediate',
        frequency: 5,
        availableEquipment: ['dumbbells'],
      },
    });

    expect(normalized.name).toBe('Cade Cunningham');
    expect(normalized.age).toBe(22);
    expect(normalized.fitnessLevel).toBe('intermediate');
    expect(normalized.daysPerWeek).toBe(5);
    expect(normalized.equipmentAccess).toEqual(['dumbbells']);
  });
});
