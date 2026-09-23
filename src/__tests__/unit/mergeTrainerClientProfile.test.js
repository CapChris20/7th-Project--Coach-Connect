import { combineTraineeProfile } from '../../helpers/combineTraineeProfile';

describe('combineTraineeProfile', () => {
  it('prefers live users/{uid} weight over stale CRM copy', () => {
    const merged = combineTraineeProfile(
      { id: 'client_a', weight: 170, age: 30 },
      { weight: 152, age: 28 },
    );
    expect(merged.weight).toBe(152);
    expect(merged.age).toBe(28);
  });

  it('does not copy one client CRM weight to another user profile', () => {
    const clientA = combineTraineeProfile({ id: 'a', weight: 170 }, { weight: 145 });
    const clientB = combineTraineeProfile({ id: 'b', weight: 170 }, { weight: 198 });
    expect(clientA.weight).toBe(145);
    expect(clientB.weight).toBe(198);
  });

  it('falls back to CRM weight when user profile has no weight yet', () => {
    const merged = combineTraineeProfile({ weight: 170, daysPerWeek: 4 }, {});
    expect(merged.weight).toBe(170);
    expect(merged.daysPerWeek).toBe(4);
  });

  it('resolves daysPerWeek from legacy frequency on user doc', () => {
    const merged = combineTraineeProfile({ daysPerWeek: 5 }, { frequency: 4 });
    expect(merged.daysPerWeek).toBe(4);
  });

  it('keeps CRM-only fields like programName', () => {
    const merged = combineTraineeProfile(
      { programName: 'Hypertrophy Block', weight: 180 },
      { weight: 176 },
    );
    expect(merged.programName).toBe('Hypertrophy Block');
    expect(merged.weight).toBe(176);
  });
});
