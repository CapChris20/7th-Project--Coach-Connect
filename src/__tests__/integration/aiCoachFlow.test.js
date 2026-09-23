const {
  readActionsFromReply,
  stripCoachToolJsonFromReply,
} = require('../../ai-coach/coach-actions/readActionsFromReply');
const {
  shouldIncludeWeeklyContextInCoachPrompt,
} = require('../../ai-coach/coach-knowledge/decideWhatCoachShouldKnow');

describe('ai coach flow integration', () => {
  test('parses tool payload and keeps readable assistant text', () => {
    const reply = `Great, I can do that.\n{"toolCalls":[{"name":"logWater","params":{"amountOz":32}}]}`;
    const calls = readActionsFromReply(reply);
    const text = stripCoachToolJsonFromReply(reply);
    expect(calls[0].name).toBe('logWater');
    expect(text).toBe('Great, I can do that.');
  });

  test('strips numeric citation brackets from web replies', () => {
    const reply = 'Protein helps recovery.[2][3]';
    expect(stripCoachToolJsonFromReply(reply)).toBe('Protein helps recovery.');
  });

  test('screenNames personal-history prompts to weekly context path', () => {
    expect(shouldIncludeWeeklyContextInCoachPrompt('How am I doing this week?')).toBe(true);
  });
});
