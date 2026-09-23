const { readActionsFromReply } = require('../../ai-coach/coach-actions/readActionsFromReply');

test('parses named-key bookSession payload', () => {
  const calls = readActionsFromReply(
    '{"bookSession":{"date":"2026-06-20","time":"9:00 AM"}}'
  );
  expect(calls).toHaveLength(1);
  expect(calls[0].name).toBe('bookSession');
  expect(calls[0].params.date).toBe('2026-06-20');
});
