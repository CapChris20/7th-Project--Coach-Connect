const {
  assertTrainerSelf,
  toPublicTrainerProfile,
  pickWritableTrainerFields,
} = require('../lib/marketplaceAuth');

describe('marketplace trainer auth', () => {
  test('missing token returns 401', () => {
    const result = assertTrainerSelf({ firebaseAuth: {} }, 'trainer123');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
  });

  test('different user returns 403', () => {
    const result = assertTrainerSelf({ firebaseAuth: { uid: 'trainer456' } }, 'trainer123');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(403);
    expect(result.error).toMatch(/Cannot modify other trainer profiles/i);
  });

  test('same user returns ok', () => {
    const result = assertTrainerSelf({ firebaseAuth: { uid: 'trainer123' } }, 'trainer123');
    expect(result.ok).toBe(true);
    expect(result.requesterUid).toBe('trainer123');
    expect(result.targetId).toBe('trainer123');
  });

  test('toPublicTrainerProfile strips private fields', () => {
    const publicProfile = toPublicTrainerProfile('t1', {
      name: 'Alex',
      email: 'secret@example.com',
      phone: '555-0100',
      stripeAccountId: 'acct_123',
      certificationSheets: [{ url: 'https://private' }],
      rating: 4.5,
    });
    expect(publicProfile).toEqual({ id: 't1', name: 'Alex', rating: 4.5 });
    expect(publicProfile.email).toBeUndefined();
    expect(publicProfile.stripeAccountId).toBeUndefined();
    expect(publicProfile.certificationSheets).toBeUndefined();
  });

  test('pickWritableTrainerFields ignores rating/stripe spoofing', () => {
    const writable = pickWritableTrainerFields({
      name: 'Alex',
      rating: 99,
      stripeAccountId: 'acct_hack',
      bio: 'Hi',
    });
    expect(writable).toEqual({ name: 'Alex', bio: 'Hi' });
  });
});
