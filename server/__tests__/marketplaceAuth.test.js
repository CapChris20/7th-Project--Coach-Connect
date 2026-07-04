const { assertTrainerSelf } = require('../lib/marketplaceAuth');

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
});
