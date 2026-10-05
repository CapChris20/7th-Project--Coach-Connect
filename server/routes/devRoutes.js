/** Dev-only API comparison tests */
function registerDevRoutes(app, deps) {
  const {
    devOnlyRoute,
    callClaudeCoach,
    callDeepSeekCoach,
    parseToolCalls,
  } = deps;

  const TEST_CASES = [
  {
    id: 'weight_loss_stall',
    prompt: "Why am I not losing weight? I'm eating 2000 cal, hitting 160g protein, but sleep is 6h and I missed leg day.",
    category: 'data-backed-advice'
  },
  {
    id: 'macro_adjustment',
    prompt: "I want to increase my macros. Adjust my targets.",
    category: 'tool-calling'
  },
  {
    id: 'supplement_advice',
    prompt: "What's the best supplement for fat loss?",
    category: 'supplement-advice'
  },
  {
    id: 'trt_question',
    prompt: "My trainee just asked if TRT is worth it",
    category: 'sensitive-topic'
  }
];

/**
 * Test a single API (DeepSeek or Claude) against all test cases
 */
  async function runSingleAPITest(apiName, testCases) {
  const { estimateCost } = require('../config/apiCosts');
  const results = [];
  
  const resolveKeyDirect = (name) => {
    if (name === 'claude' || name === 'anthropic') {
      return (process.env.ANTHROPIC_API_KEY || '').trim();
    }
    if (name === 'deepseek') {
      return (process.env.DEEPSEEK_API_KEY || '').trim();
    }
    return '';
  };

  const withTimeout = async (promise, ms, label) => {
    let t;
    const timeout = new Promise((_, reject) => {
      t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms${label ? ` (${label})` : ''}`)), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      clearTimeout(t);
    }
  };

  for (const testCase of testCases) {
    const startTime = Date.now();
    const testResult = {
      prompt: testCase.prompt,
      category: testCase.category,
      startTime: new Date().toISOString(),
      apiName,
      response: null,
      speed_ms: 0,
      tokens: { input: 0, output: 0 },
      cost: '$0.00',
      cost_usd: 0,
      quality_score: null,
      toolCalls: [],
      error: null,
    };

    try {
      // Build system prompt
      const systemPrompt = `You are a premium fitness coach with data visibility and can use tools.
Your response should be:
- Specific to the user's data
- Data-backed with reasoning
- Practical and actionable
- Friendly but professional`;

      const messages = [{ role: 'user', content: testCase.prompt }];
      let response = null;
      let inputTokens = 0;
      let outputTokens = 0;

      if (apiName === 'claude') {
        const key = resolveKeyDirect('claude');
        if (!key) throw new Error('Missing Claude key (ANTHROPIC_API_KEY)');
        response = await withTimeout(
          callClaudeCoach({ apiKey: key, systemPrompt, messages }),
          30_000,
          'claude'
        );
        // Rough token estimation (Claude): ~4 chars per token
        inputTokens = Math.ceil((systemPrompt.length + testCase.prompt.length) / 4);
        outputTokens = Math.ceil(response.length / 4);
      } else if (apiName === 'deepseek') {
        const key = resolveKeyDirect('deepseek');
        if (!key) throw new Error('Missing DeepSeek key (DEEPSEEK_API_KEY)');
        response = await withTimeout(
          callDeepSeekCoach({ apiKey: key, systemPrompt, messages }),
          30_000,
          'deepseek'
        );
        // Rough token estimation (DeepSeek): ~4 chars per token
        inputTokens = Math.ceil((systemPrompt.length + testCase.prompt.length) / 4);
        outputTokens = Math.ceil(response.length / 4);
      }

      testResult.response = response;
      testResult.speed_ms = Date.now() - startTime;
      testResult.tokens = { input: inputTokens, output: outputTokens };
      
      // Calculate cost
      const pricingApiName = apiName === 'claude' ? 'anthropic' : apiName;
      const cost = estimateCost(pricingApiName, inputTokens, outputTokens);
      testResult.cost = `$${cost.toFixed(4)}`;
      testResult.cost_usd = Number.isFinite(cost) ? cost : 0;

      // Parse tool calls if any
      testResult.toolCalls = parseToolCalls(response) || [];

      // Quick quality scoring (1-10 scale, subjective)
      // Check for data-backed answers, specificity, fitness relevance
      const qualityFactors = {
        length: response.length > 150 ? 2 : 1,
        specificity: /\d+/.test(response) ? 2 : 1, // has numbers
        fitnessFocus: isFitnessNutritionQuery(response) ? 2 : 0,
        actionable: /you should|try|consider|increase|decrease|adjust/.test(response.toLowerCase()) ? 2 : 1,
        dataRef: /protein|calorie|sleep|volume|kg|lb|gram/.test(response.toLowerCase()) ? 1 : 0,
      };
      testResult.quality_score = Math.min(10, Object.values(qualityFactors).reduce((a, b) => a + b, 0));

      console.log(`[${new Date().toISOString()}] ✅ Test '${testCase.id}' (${apiName}): ${testResult.speed_ms}ms, Quality: ${testResult.quality_score}/10`);
    } catch (error) {
      testResult.error = error?.message || String(error);
      testResult.quality_score = 0;
      testResult.cost = '$0.00';
      testResult.cost_usd = 0;
      console.error(`[${new Date().toISOString()}] ❌ Test '${testCase.id}' (${apiName}) failed:`, testResult.error);
    }

    results.push(testResult);
  }

  return results;
}

/**
 * GET /api/test-deepseek - Test DeepSeek alone
 */
app.get('/api/test-deepseek', devOnlyRoute, async (req, res) => {
  console.log('🧪 Starting DeepSeek test suite...');
  const startTime = Date.now();

  try {
    const deepseekResults = await runSingleAPITest('deepseek', TEST_CASES);
    const elapsed = Date.now() - startTime;

    return res.json({
      timestamp: new Date().toISOString(),
      apiTested: 'deepseek',
      totalTime_ms: elapsed,
      testCount: TEST_CASES.length,
      results: deepseekResults,
      avgQuality: (deepseekResults.reduce((sum, r) => sum + (r.quality_score || 0), 0) / deepseekResults.length).toFixed(1),
      totalCost: `$${deepseekResults.reduce((sum, r) => sum + parseFloat(r.cost || 0), 0).toFixed(4)}`,
    });
  } catch (error) {
    console.error('❌ DeepSeek test suite failed:', error);
    return res.status(500).json({
      error: 'Test suite failed',
      details: error?.message || String(error),
    });
  }
});

/**
 * GET /api/test-deepseek-vs-claude - Compare both APIs
 */
app.get('/api/test-deepseek-vs-claude', devOnlyRoute, async (req, res) => {
  console.log('🧪 Starting DeepSeek vs Claude comparison...');
  const startTime = Date.now();

  try {
    // Run tests in parallel for faster comparison
    const [deepseekResults, claudeResults] = await Promise.all([
      runSingleAPITest('deepseek', TEST_CASES),
      runSingleAPITest('claude', TEST_CASES),
    ]);

    const elapsed = Date.now() - startTime;

    // Build comparison results
    const testCases = [];
    for (let i = 0; i < TEST_CASES.length; i++) {
      const deepseekResult = deepseekResults[i];
      const claudeResult = claudeResults[i];
      const { estimateCost } = require('../config/apiCosts');

      // Determine winners for each metric
      const speedWinner = deepseekResult.speed_ms < claudeResult.speed_ms ? 'deepseek' : 'claude';
      const costWinner = parseFloat(deepseekResult.cost) < parseFloat(claudeResult.cost) ? 'deepseek' : 'claude';
      const qualityWinner = (claudeResult.quality_score || 0) > (deepseekResult.quality_score || 0) ? 'claude' : 'deepseek';

      testCases.push({
        prompt: TEST_CASES[i].prompt,
        category: TEST_CASES[i].category,
        deepseek: {
          response: deepseekResult.response?.substring(0, 200) + '...',
          speed_ms: deepseekResult.speed_ms,
          tokens: deepseekResult.tokens,
          cost: deepseekResult.cost,
          quality_score: deepseekResult.quality_score,
          toolCalls: deepseekResult.toolCalls,
        },
        claude: {
          response: claudeResult.response?.substring(0, 200) + '...',
          speed_ms: claudeResult.speed_ms,
          tokens: claudeResult.tokens,
          cost: claudeResult.cost,
          quality_score: claudeResult.quality_score,
          toolCalls: claudeResult.toolCalls,
        },
        winner: {
          speed: speedWinner,
          cost: costWinner,
          quality: qualityWinner,
        },
      });
    }

    // Calculate summary statistics
    const deepseekAvgQuality = (deepseekResults.reduce((sum, r) => sum + (r.quality_score || 0), 0) / deepseekResults.length).toFixed(1);
    const claudeAvgQuality = (claudeResults.reduce((sum, r) => sum + (r.quality_score || 0), 0) / claudeResults.length).toFixed(1);
    const deepseekTotalCost = Number((deepseekResults.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)).toFixed(6));
    const claudeTotalCost = Number((claudeResults.reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0)).toFixed(6));
    const costSavings =
      claudeTotalCost > 0
        ? (((claudeTotalCost - deepseekTotalCost) / claudeTotalCost) * 100).toFixed(1)
        : null;
    const qualityDiff =
      Number(claudeAvgQuality) > 0
        ? (((Number(claudeAvgQuality) - Number(deepseekAvgQuality)) / Number(claudeAvgQuality)) * 100).toFixed(1)
        : null;

    const recommendation =
      claudeTotalCost > 0 && deepseekTotalCost < claudeTotalCost && Number(deepseekAvgQuality) >= 7.5
        ? `DeepSeek is ${costSavings}% cheaper and quality is comparable (${deepseekAvgQuality}/10 vs ${claudeAvgQuality}/10).`
        : claudeTotalCost > 0
          ? `Claude quality: ${claudeAvgQuality}/10 vs DeepSeek: ${deepseekAvgQuality}/10. Cost DeepSeek: $${(deepseekTotalCost / TEST_CASES.length).toFixed(6)} per test vs Claude: $${(claudeTotalCost / TEST_CASES.length).toFixed(6)} per test.`
          : `Claude cost could not be estimated; verify pricing config and re-run.`;

    return res.json({
      timestamp: new Date().toISOString(),
      totalTime_ms: elapsed,
      testCasesCount: TEST_CASES.length,
      testCases,
      summary: {
        deepseek: {
          avgQuality: parseFloat(deepseekAvgQuality),
          totalCost: `$${deepseekTotalCost.toFixed(6)}`,
          costPerTest: `$${(deepseekTotalCost / TEST_CASES.length).toFixed(6)}`,
          avgSpeed_ms: Math.round(deepseekResults.reduce((sum, r) => sum + r.speed_ms, 0) / deepseekResults.length),
        },
        claude: {
          avgQuality: parseFloat(claudeAvgQuality),
          totalCost: `$${claudeTotalCost.toFixed(6)}`,
          costPerTest: `$${(claudeTotalCost / TEST_CASES.length).toFixed(6)}`,
          avgSpeed_ms: Math.round(claudeResults.reduce((sum, r) => sum + r.speed_ms, 0) / claudeResults.length),
        },
        costSavings: costSavings == null ? null : `${costSavings}%`,
        qualityDifference: qualityDiff == null ? null : `${qualityDiff}%`,
        recommendation,
      },
    });
  } catch (error) {
    console.error('❌ Comparison test failed:', error);
    return res.status(500).json({
      error: 'Comparison test failed',
      details: error?.message || String(error),
    });
  }
});

}

module.exports = { registerDevRoutes };
