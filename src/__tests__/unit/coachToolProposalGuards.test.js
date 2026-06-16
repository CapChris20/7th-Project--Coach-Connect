jest.mock('../../ai/tools/executeCoachTool.js', () => ({
  normalizeToolCall: (raw) => {
    if (!raw) return null;
    const name = raw.name || raw.tool || raw.action;
    if (!name) return null;
    return {
      name,
      params: raw.params && typeof raw.params === 'object' ? { ...raw.params } : {},
    };
  },
}));

const {
  INFORMATIONAL_QUESTIONS,
  EXPLICIT_LOG_REQUESTS,
  AMBIGUOUS_STATEMENTS,
} = require('../fixtures/coachToolGuardFixtures');

/** Likely false-positive tool proposal paired with each fixture string. */
const INFORMATIONAL_TOOL_BY_TEXT = {
  'What did I eat today?': { name: 'logNutrition', params: { food: 'today meals' } },
  'Is 10 hours of sleep too much?': { name: 'logSleep', params: { hours: 10 } },
  'How much protein should I eat?': { name: 'logNutrition', params: { food: 'protein' } },
  'What are my macros?': { name: 'logNutrition', params: { food: 'macros' } },
  'How am I doing this week?': { name: 'logNutrition', params: { food: 'weekly intake' } },
  'What should I eat before a workout?': { name: 'logNutrition', params: { food: 'pre-workout snack' } },
  'Is my calorie intake good?': { name: 'logNutrition', params: { food: 'calories' } },
  'Search the web: what does research say about protein intake for lifters? Cite sources.': {
    name: 'deleteLog',
    params: { logType: 'nutrition' },
  },
};

const EXPLICIT_TOOL_BY_TEXT = {
  'Log 7 hours of sleep': { name: 'logSleep', params: { hours: 7 } },
  'Log 2 eggs for breakfast': { name: 'logNutrition', params: { food: '2 eggs' } },
  'I drank 64oz of water today, log it': { name: 'logWater', params: { ounces: 64 } },
  'Log my workout as complete': { name: 'rateWorkout', params: { rating: 5 } },
  'Set my calorie goal to 2000': { name: 'adjustMacroTargets', params: { calories: 2000 } },
};

const AMBIGUOUS_TOOL_BY_TEXT = {
  'I slept 7 hours': { name: 'logSleep', params: { hours: 7 } },
  'I had eggs this morning': { name: 'logNutrition', params: { food: 'eggs' } },
  'I drank a lot of water': { name: 'logWater', params: { ounces: 16 } },
  'I worked out today': { name: 'rateWorkout', params: { rating: 4 } },
};

const MIXED_FILTER_USER_TEXT = 'Log 7 hours of sleep';
const MIXED_PROPOSALS = [
  { name: 'logSleep', params: { hours: 7 } },
  { name: 'logWater', params: { ounces: 64 } },
  { name: 'logNutrition', params: { food: 'eggs' } },
];

function runSharedGuardTests(getGuards) {
  const { isValidCoachToolProposal, filterValidCoachToolProposals } = getGuards();

  describe('informational questions reject tool proposals', () => {
    it.each(INFORMATIONAL_QUESTIONS)('%s', (userText) => {
      const toolCall = INFORMATIONAL_TOOL_BY_TEXT[userText];
      expect(isValidCoachToolProposal(toolCall, userText)).toBe(false);
    });
  });

  describe('explicit log requests accept tool proposals', () => {
    it.each(EXPLICIT_LOG_REQUESTS)('%s', (userText) => {
      const toolCall = EXPLICIT_TOOL_BY_TEXT[userText];
      expect(isValidCoachToolProposal(toolCall, userText)).toBe(true);
    });
  });

  describe('ambiguous statements reject tool proposals', () => {
    it.each(AMBIGUOUS_STATEMENTS)('%s', (userText) => {
      const toolCall = AMBIGUOUS_TOOL_BY_TEXT[userText];
      expect(isValidCoachToolProposal(toolCall, userText)).toBe(false);
    });
  });

  describe('filterValidCoachToolProposals', () => {
    it('returns only valid proposals from a mixed list', () => {
      const filtered = filterValidCoachToolProposals(MIXED_PROPOSALS, MIXED_FILTER_USER_TEXT);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].name).toBe('logSleep');
    });

    it('returns an empty array for an empty input', () => {
      expect(filterValidCoachToolProposals([], MIXED_FILTER_USER_TEXT)).toEqual([]);
    });

    it('does not throw for null input', () => {
      expect(() => filterValidCoachToolProposals(null, MIXED_FILTER_USER_TEXT)).not.toThrow();
      expect(filterValidCoachToolProposals(null, MIXED_FILTER_USER_TEXT)).toEqual([]);
    });

    it('does not throw for undefined input', () => {
      expect(() => filterValidCoachToolProposals(undefined, MIXED_FILTER_USER_TEXT)).not.toThrow();
      expect(filterValidCoachToolProposals(undefined, MIXED_FILTER_USER_TEXT)).toEqual([]);
    });
  });
}

describe('Client coachToolProposalGuards', () => {
  runSharedGuardTests(() => require('../../ai/tools/validateCoachToolProposal'));
});

describe('Server coachToolProposalGuards', () => {
  runSharedGuardTests(() => require('../../../server/lib/coachToolProposalGuards.js'));
});
