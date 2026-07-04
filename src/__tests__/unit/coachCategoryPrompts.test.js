const {
  getCoachHourSlot,
  pickCategoryPrompt,
  buildHourlySpotlightSuggestions,
  buildHourlyCanHelpWith,
  buildHourlyCoachActions,
  CAN_HELP_WITH_ITEMS,
} = require('../../ai-coach/chat-ui/chat-thread/coachQuickPrompts');

describe('coach category prompts', () => {
  test('builds deterministic hour slot', () => {
    expect(getCoachHourSlot(3600000)).toBe(1);
  });

  test('returns prompts and rotated lists', () => {
    const now = new Date('2026-06-14T10:15:00').getTime();
    const prompt = pickCategoryPrompt('train', { now });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(3);

    const spotlights = buildHourlySpotlightSuggestions({ now });
    expect(spotlights.length).toBeGreaterThan(0);

    const help = buildHourlyCanHelpWith({ now });
    expect(help).toHaveLength(CAN_HELP_WITH_ITEMS.length);

    const webNow = pickCategoryPrompt('web', { now });
    const webLater = pickCategoryPrompt('web', { now: now + 60 * 60 * 1000 });
    expect(typeof webNow).toBe('string');
    expect(webNow.length).toBeGreaterThan(3);

    const actions = buildHourlyCoachActions(
      [
        { id: 'web', starter: 'static' },
        { id: 'log', starter: 'static' },
      ],
      { now },
    );
    expect(actions[0].starter).not.toBe('static');
    expect(actions[1].starter).not.toBe('static');
    expect(pickCategoryPrompt('web', { now })).toBe(actions[0].starter);
  });
});
