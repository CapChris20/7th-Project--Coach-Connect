jest.mock('../../ai/tools/executeCoachTool.js', () => ({
  normalizeToolCall: (raw) => {
    if (!raw?.name) return null;
    return { name: raw.name, params: raw.params || {}, reasoning: raw.reasoning || '' };
  },
}));

const { inferToolCallFromCoachMessage } = require('../../ai/tools/parseUserMessageForTools');

const WEB_SEARCH_USER =
  'Search the web: what does research say about protein intake for lifters? Cite sources.';

const COACH_REPLY_WITH_REMOVE =
  'For muscle building, aim for 1.6–2.2 g/kg. You may want to remove ultra-processed snacks and focus on whole food protein sources like chicken, eggs, and Greek yogurt.';

describe('inferToolCallFromCoachMessage', () => {
  it('does not infer deleteLog from coach prose on informational web-search questions', () => {
    expect(inferToolCallFromCoachMessage(COACH_REPLY_WITH_REMOVE, WEB_SEARCH_USER)).toBeNull();
  });

  it('still infers deleteLog when the user explicitly asks to delete food', () => {
    const user = 'Delete my most recent food entry';
    const coach = 'I can remove that from your nutrition log — confirm below.';
    const tool = inferToolCallFromCoachMessage(coach, user);
    expect(tool?.name).toBe('deleteLog');
  });

  it('does not infer logSleep from ambiguous sleep statements', () => {
    expect(inferToolCallFromCoachMessage('Got it.', 'I slept 7 hours')).toBeNull();
    expect(inferToolCallFromCoachMessage('Sure.', 'Is 10 hours of sleep too much?')).toBeNull();
  });

  it('infers logSleep when the user explicitly asks to log sleep', () => {
    const tool = inferToolCallFromCoachMessage('I can log that for you.', 'Log 7 hours of sleep');
    expect(tool?.name).toBe('logSleep');
    expect(tool?.params?.hours).toBe(7);
  });

  it('does not infer logNutrition without explicit log intent', () => {
    expect(inferToolCallFromCoachMessage('Noted.', 'I had eggs this morning')).toBeNull();
  });

  it('infers logNutrition when the user explicitly asks to log food', () => {
    const tool = inferToolCallFromCoachMessage('Confirm below.', 'Log 2 eggs for breakfast');
    expect(tool?.name).toBe('logNutrition');
  });
});
