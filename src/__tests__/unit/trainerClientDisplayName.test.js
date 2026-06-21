const {
  isGenericClientDisplayName,
  isWeakClientDisplayName,
  resolveTrainerClientDisplayName,
} = require('../../trainer-app/crm/getTraineeDisplayName');

describe('trainer client display name resolver', () => {
  test('detects generic placeholders', () => {
    expect(isGenericClientDisplayName('Client')).toBe(true);
    expect(isGenericClientDisplayName('Chris')).toBe(false);
  });

  test('resolves best available name from user data', () => {
    const name = resolveTrainerClientDisplayName(
      { name: 'Client' },
      { firstName: 'Chris', lastName: 'Captain' }
    );
    expect(name).toBe('Chris Captain');
    expect(isWeakClientDisplayName('ab')).toBe(true);
  });
});
