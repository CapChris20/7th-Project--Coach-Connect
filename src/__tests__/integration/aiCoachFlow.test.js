const {
  parseCoachToolCalls,
  stripCoachToolJsonFromReply,
} = require('../../shared/parseCoachToolCalls');
const {
  shouldIncludeWeeklyContextInCoachPrompt,
} = require('../../ai/context/gatherCoachContextFromUser');

describe('ai coach flow integration', () => {
  test('parses tool payload and keeps readable assistant text', () => {
    const reply = `Great, I can do that.\n{"toolCalls":[{"name":"logWater","params":{"amountOz":32}}]}`;
    const calls = parseCoachToolCalls(reply);
    const text = stripCoachToolJsonFromReply(reply);
    expect(calls[0].name).toBe('logWater');
    expect(text).toBe('Great, I can do that.');
  });

  test('routes personal-history prompts to weekly context path', () => {
    expect(shouldIncludeWeeklyContextInCoachPrompt('How am I doing this week?')).toBe(true);
  });
});
