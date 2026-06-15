const {
  shouldIncludeWeeklyContextInCoachPrompt,
} = require('../../ai/context/gatherCoachContextFromUser');

describe('coach personal-data routing', () => {
  test('includes weekly context for personal log intent', () => {
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('What did I eat today?')
    ).toBe(true);
  });

  test('skips weekly context for generic question', () => {
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('How much protein is ideal?')
    ).toBe(false);
  });
});
