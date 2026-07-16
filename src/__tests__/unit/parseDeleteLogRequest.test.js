const {
  userWantsDeleteLog,
  coerceMisroutedDeleteTool,
  inferDeleteLogParams,
  inferDeleteLogType,
} = require('../../ai-coach/server-logic/tools/detectDeleteFoodRequest');

describe('userWantsDeleteLog', () => {
  it('accepts explicit delete-food requests', () => {
    expect(userWantsDeleteLog('Delete my most recent food entry')).toBe(true);
  });

  it('accepts sleep dashboard deletes', () => {
    expect(userWantsDeleteLog('Can u remove the log I put for sleeping 12 hours')).toBe(true);
    expect(userWantsDeleteLog('remove my sleep log from the dashboard')).toBe(true);
  });

  it('rejects generic coaching prose about removing foods', () => {
    expect(userWantsDeleteLog('tell me whether to remove sugar from my diet')).toBe(false);
  });
});

describe('inferDeleteLogParams metric routing', () => {
  it('routes sleep removes to logType sleep', () => {
    expect(inferDeleteLogType('Can u remove the log I put for sleeping 12 hours')).toBe('sleep');
    const params = inferDeleteLogParams('No not a food entry a dashboard log for sleep', '');
    expect(params.logType).toBe('sleep');
    expect(params.foodName).toBeFalsy();
  });

  it('keeps food deletes as nutrition', () => {
    const params = inferDeleteLogParams('remove the pizza I logged', '');
    expect(params.logType).toBe('nutrition');
    expect(params.foodName).toMatch(/pizza/i);
  });
});

describe('coerceMisroutedDeleteTool', () => {
  it('does not coerce delete from coach reply alone', () => {
    const coach =
      'You may want to remove ultra-processed snacks and focus on whole food protein sources.';
    expect(coerceMisroutedDeleteTool(null, '', coach, (x) => x)).toBeNull();
  });

  it('infers sleep delete when model omitted tool JSON', () => {
    const coerced = coerceMisroutedDeleteTool(
      null,
      'Can u remove the log I put for sleeping 12 hours',
      "I'll remove that sleep log — tap Confirm.",
      (x) => x,
    );
    expect(coerced?.name).toBe('deleteLog');
    expect(coerced?.params?.logType).toBe('sleep');
  });

  it('does not overwrite sleep deleteLog with nutrition', () => {
    const coerced = coerceMisroutedDeleteTool(
      { name: 'deleteLog', params: { logType: 'sleep' } },
      'remove my sleep log from the dashboard',
      'Got it — removing sleep.',
      (x) => x,
    );
    expect(coerced?.params?.logType).toBe('sleep');
  });

  it('rewrites food-shaped deleteLog when user asked for sleep', () => {
    const coerced = coerceMisroutedDeleteTool(
      { name: 'deleteLog', params: { logType: 'nutrition' } },
      'remove my sleep log',
      "I'll remove the sleep log.",
      (x) => x,
    );
    expect(coerced?.params?.logType).toBe('sleep');
  });
});
