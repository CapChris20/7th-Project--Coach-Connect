import { serializeExerciseDislikes, parseExerciseDislikes } from '../../workouts/exercise-library/exerciseDislikeHelpers';

describe('exerciseDislikeHelpers', () => {
  test('serialize selected ids to comma-separated names', () => {
    expect(serializeExerciseDislikes(['burpee', 'leg_press'], '')).toBe('Burpee, Leg Press');
  });

  test('parse stored string back to ids and custom text', () => {
    const parsed = parseExerciseDislikes('Burpee, Leg Press, sled drags');
    expect(parsed.selectedIds).toEqual(expect.arrayContaining(['burpee', 'leg_press']));
    expect(parsed.customText).toBe('sled drags');
  });

  test('round-trip preserves catalog selections', () => {
    const ids = ['rdl', 'running', 'box_jump'];
    const stored = serializeExerciseDislikes(ids, '');
    const parsed = parseExerciseDislikes(stored);
    expect(parsed.selectedIds.sort()).toEqual(ids.sort());
  });
});
