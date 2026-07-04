const {
  shouldIncludeWeeklyContextInCoachPrompt,
} = require('../../ai-coach/server-logic/context/buildCoachPromptData');

describe('coach personal-data routing', () => {
  test('includes weekly context for personal log intent', () => {
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('What did I eat today?')
    ).toBe(true);
  });

  test('includes weekly context when user mentions food logs', () => {
    expect(
      shouldIncludeWeeklyContextInCoachPrompt("What do u mean you don't have food logs")
    ).toBe(true);
  });

  test('includes weekly context on pushback after coach denied logs', () => {
    const messages = [
      { role: 'user', content: 'What did I eat yesterday?' },
      {
        role: 'assistant',
        content: "I don't have access to your logged food data right now. Your nutrition diary is separate.",
      },
      { role: 'user', content: 'What do you mean?' },
    ];
    expect(shouldIncludeWeeklyContextInCoachPrompt('What do you mean?', messages)).toBe(true);
  });

  test('includes weekly context for all-time history questions', () => {
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('What have I logged since I joined?'),
    ).toBe(true);
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('Show my lifetime nutrition averages'),
    ).toBe(true);
  });

  test('includes weekly context for progress cycle questions', () => {
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('What changed since I started?'),
    ).toBe(true);
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('Help me attribute my progress cycle'),
    ).toBe(true);
  });

  test('skips weekly context for generic question', () => {
    expect(
      shouldIncludeWeeklyContextInCoachPrompt('How much protein is ideal?')
    ).toBe(false);
  });
});
