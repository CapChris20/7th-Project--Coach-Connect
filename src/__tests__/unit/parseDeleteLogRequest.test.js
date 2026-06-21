const {
  userWantsDeleteLog,
  coerceMisroutedDeleteTool,
} = require('../../ai-coach/server-logic/tools/detectDeleteFoodRequest');

describe('userWantsDeleteLog', () => {
  it('accepts explicit delete-food requests', () => {
    expect(userWantsDeleteLog('Delete my most recent food entry')).toBe(true);
  });

  it('rejects generic coaching prose about removing foods', () => {
    expect(userWantsDeleteLog('tell me whether to remove sugar from my diet')).toBe(false);
  });
});

describe('coerceMisroutedDeleteTool', () => {
  it('does not coerce delete from coach reply alone', () => {
    const coach =
      'You may want to remove ultra-processed snacks and focus on whole food protein sources.';
    expect(coerceMisroutedDeleteTool(null, '', coach, (x) => x)).toBeNull();
  });
});
