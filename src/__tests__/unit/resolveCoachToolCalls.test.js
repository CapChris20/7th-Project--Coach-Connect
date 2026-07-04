const { mergeCoachToolCalls } = require('../../../server/lib/inferCoachToolCall');
const { filterValidCoachToolProposals } = require('../../ai-coach/server-logic/tools/shouldShowCoachAction');

function resolveCoachToolCalls(aiText, userMessage, weeklyContext) {
  return filterValidCoachToolProposals(
    mergeCoachToolCalls(aiText, userMessage, weeklyContext || {}),
    userMessage,
  );
}

describe('resolveCoachToolCalls (server)', () => {
  it('returns no tools for informational protein web-search questions', () => {
    const user =
      'Search the web: what does research say about protein intake for lifters? Cite sources.';
    const coach =
      "For muscle building, aim for 1.6–2.2 g/kg. I'll adjust your protein target to 150g if you'd like.";
    expect(resolveCoachToolCalls(coach, user, {})).toEqual([]);
  });

  it('returns adjustMacroTargets when user explicitly asks to change targets', () => {
    const user = 'Set my calorie goal to 2000 and protein to 150g';
    const coach =
      '{"toolCalls": [{"name": "adjustMacroTargets", "params": {"calories": 2000, "protein": 150, "carbs": 200, "fat": 65}, "reasoning": "As requested"}]}';
    const tools = resolveCoachToolCalls(coach, user, {});
    expect(tools.some((t) => t.name === 'adjustMacroTargets')).toBe(true);
  });
});
