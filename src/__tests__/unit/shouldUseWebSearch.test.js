import {
  shouldUseWebAuto,
  isPersonalDataLookup,
  hasExplicitWebIntent,
  isWebAnswerFollowUp,
} from '../../ai-coach/internet-lookup/shouldLookUpOnInternet';

describe('shouldLookUpOnInternet routing', () => {
  it('screenNames pizza-on-cut web questions when user says on the web', () => {
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

  // Regression: IMG_4988 / IMG_4989 — "quote the sources" must NOT hijack a new fitness question
  it('treats gym-days + quote-the-sources as a fresh web search, not a citation tutorial follow-up', () => {
    const msg =
      'If I should be worry of 3 days vs 4 days going to the gym. Go on the web and quote the sources';
    expect(shouldUseWebAuto(msg)).toBe(true);
    expect(isWebAnswerFollowUp(msg, [{ role: 'user', content: msg }])).toBe(false);
  });

  it('still treats short quote-only follow-ups as thread follow-ups after a coach reply', () => {
    const msg = 'quote from the sources on that';
    const msgs = [
      { role: 'user', content: 'What does research say about creatine dosing for lifters?' },
      {
        role: 'assistant',
        content: 'Most lifters do well on 3–5g creatine monohydrate daily for saturation over time.',
      },
      { role: 'user', content: msg },
    ];
    expect(isWebAnswerFollowUp(msg, msgs)).toBe(true);
  });
});
