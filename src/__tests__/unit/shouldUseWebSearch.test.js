import {
  shouldUseWebAuto,
  isPersonalDataLookup,
  hasExplicitWebIntent,
} from '../../ai-coach/server-logic/chat-api/shouldUseWebSearch';

describe('shouldUseWebSearch routing', () => {
  it('routes pizza-on-cut web questions when user says on the web', () => {
    const msg =
      'Look up on the web, can I have pizza during a cut if I hit my calories and protein?';
    expect(hasExplicitWebIntent(msg)).toBe(true);
    expect(isPersonalDataLookup(msg)).toBe(false);
    expect(shouldUseWebAuto(msg)).toBe(true);
  });

  it('does not treat bare calories in a web question as a personal log lookup', () => {
    const msg = 'Search online — how many calories in a slice of pepperoni pizza?';
    expect(shouldUseWebAuto(msg)).toBe(true);
  });

  it('still blocks personal log lookups without web intent', () => {
    const msg = 'Look up my calories from yesterday';
    expect(isPersonalDataLookup(msg)).toBe(true);
    expect(shouldUseWebAuto(msg)).toBe(false);
  });

  it('blocks dashboard sleep lookups', () => {
    const msg = 'How much did I sleep last night?';
    expect(isPersonalDataLookup(msg)).toBe(true);
    expect(shouldUseWebAuto(msg)).toBe(false);
  });
});
