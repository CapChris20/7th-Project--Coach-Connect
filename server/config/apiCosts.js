/**
 * API Cost Tracking & Spending Limits Configuration
 * Centralized management of all active API integrations, pricing, and cost controls
 * 
 * ACTIVE APIS:
 * - Anthropic Claude (AI Coach feature)
 * - DeepSeek (Primary LLM for workouts and general requests)
 * - Serper (Web search for fitness articles and nutrition info)
 * - USDA (Free nutrition database)
 * - Open Food Facts (Free nutrition data)
 * - Perplexity (Optional fallback for AI Coach)
 */

// ─────────────────────────────────────────────────────────
// 1. ACTIVE APIS - Registry of all actively used integrations
// ─────────────────────────────────────────────────────────
const ACTIVE_APIS = {
  anthropic: {
    name: 'Claude',
    status: 'active',
    priority: 'critical',
    description: 'AI Coach feature - provides fitness coaching and nutrition advice',
    monthlyBudget: 150,
  },
  deepseek: {
    name: 'DeepSeek',
    status: 'active',
    priority: 'primary',
    description: 'Primary LLM for workout generation and general AI requests',
    monthlyBudget: 100,
  },
  serper: {
    name: 'Serper',
    status: 'active',
    priority: 'secondary',
    description: 'Web search for fitness articles, restaurant nutrition, and current information',
    monthlyBudget: 20,
  },
  usda: {
    name: 'USDA',
    status: 'active',
    priority: 'primary',
    cost: 'free',
    description: 'Free nutrition database - primary source for food data',
  },
  openfoodfacts: {
    name: 'Open Food Facts',
    status: 'active',
    priority: 'secondary',
    cost: 'free',
    description: 'Free nutrition data - fallback when USDA doesn\'t have results',
  },
  perplexity: {
    name: 'Perplexity',
    status: 'fallback',
    priority: 'optional',
    description: 'Optional fallback for AI Coach if Claude fails',
    monthlyBudget: 20,
  },
};

// ─────────────────────────────────────────────────────────
// 2. SPENDING CAPS - Monthly per-API limits (in USD)
// ─────────────────────────────────────────────────────────
const MONTHLY_CAPS = {
  anthropic: 150,      // Claude (AI Coach + summaries) - highest priority
  deepseek: 100,       // DeepSeek (primary LLM for workouts)
  serper: 20,          // Serper (web search)
  perplexity: 20,      // Perplexity (optional fallback)
};

// ─────────────────────────────────────────────────────────
// 3. DAILY HARD CAP - Stop all APIs if total daily spend exceeds this
// ─────────────────────────────────────────────────────────
const DAILY_HARD_CAP = 20; // Stop all APIs if $20/day reached

// ─────────────────────────────────────────────────────────
// 4. PRICING - Cost per token/query (in USD)
// ─────────────────────────────────────────────────────────
const PRICING = {
  anthropic: {
    // Claude Sonnet 4 pricing (as of 2026)
    input: 3,          // $3 per 1M input tokens
    output: 15,        // $15 per 1M output tokens
    notes: 'Using Claude Sonnet models for balance of cost/quality'
  },
  deepseek: {
    // DeepSeek pricing (competitive, low-cost LLM)
    input: 0.28,       // $0.28 per 1M input tokens
    output: 0.42,      // $0.42 per 1M output tokens
    notes: 'Most cost-effective primary LLM'
  },
  serper: {
    perQuery: 0.001,   // $0.001 per search query (roughly)
    notes: 'Fixed cost per web search'
  },
  perplexity: {
    // Perplexity pricing (estimate)
    input: 1,          // $1 per 1M input tokens
    output: 1,         // $1 per 1M output tokens
    notes: 'Higher cost but useful as fallback'
  }
};

// ─────────────────────────────────────────────────────────
// 5. PER-USER LIMITS - Rate limiting to prevent spam/abuse
// ─────────────────────────────────────────────────────────
const USER_LIMITS = {
  anthropic_calls_per_day: 20,      // Claude (no hard limit, just tracking)
  deepseek_calls_per_day: 15,       // DeepSeek (limit spam/abuse)
  serper_calls_per_user_per_month: 10, // Web search (conserve queries)
};

// ─────────────────────────────────────────────────────────
// 6. HELPER FUNCTIONS - Cost calculations and status checks
// ─────────────────────────────────────────────────────────

/**
 * Estimate cost for Claude/DeepSeek/Perplexity calls based on token count
 * @param {string} apiName - API name (anthropic, deepseek, perplexity)
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @returns {number} Estimated cost in USD
 */
function estimateCost(apiName, inputTokens = 0, outputTokens = 0) {
  const pricing = PRICING[apiName];
  if (!pricing) return 0;

  // Claude, DeepSeek, Perplexity: per-million token pricing
  if (['anthropic', 'deepseek', 'perplexity'].includes(apiName)) {
    const inputCost = (inputTokens / 1_000_000) * pricing.input;
    const outputCost = (outputTokens / 1_000_000) * pricing.output;
    return inputCost + outputCost;
  }

  return 0;
}

/**
 * Estimate cost for Serper web search queries
 * @param {number} queryCount - Number of searches
 * @returns {number} Estimated cost in USD
 */
function estimateSerperCost(queryCount = 1) {
  return queryCount * (PRICING.serper?.perQuery || 0.001);
}

/**
 * Get API status (active, fallback, disabled, or unknown)
 * @param {string} apiName - API name
 * @returns {string} Status of the API
 */
function getAPIStatus(apiName) {
  const api = ACTIVE_APIS[apiName];
  return api?.status || 'unknown';
}

/**
 * Check if API spending is within monthly limit
 * @param {string} apiName - API name
 * @param {number} amountSpent - Amount already spent this month (in USD)
 * @returns {boolean} True if still within limit
 */
function isWithinMonthlyLimit(apiName, amountSpent = 0) {
  const limit = MONTHLY_CAPS[apiName];
  if (!limit) return true; // No cap = unlimited (free APIs)
  return amountSpent < limit;
}

/**
 * Check if total daily spending is within hard cap
 * @param {number} todaySpent - Amount spent so far today (in USD)
 * @returns {boolean} True if still within daily hard cap
 */
function isWithinDailyLimit(todaySpent = 0) {
  return todaySpent < DAILY_HARD_CAP;
}

/**
 * Format cost for display (shows $ and cents)
 * @param {number} cost - Cost in USD
 * @returns {string} Formatted cost (e.g., "$1.23")
 */
function formatCost(cost) {
  return `$${cost.toFixed(2)}`;
}

/**
 * Get all APIs with their current status
 * @returns {Object} Summary of active APIs
 */
function getAPIsSummary() {
  return {
    active: Object.entries(ACTIVE_APIS)
      .filter(([_, api]) => api.status === 'active')
      .map(([key, api]) => ({ key, ...api })),
    fallback: Object.entries(ACTIVE_APIS)
      .filter(([_, api]) => api.status === 'fallback')
      .map(([key, api]) => ({ key, ...api })),
    free: Object.entries(ACTIVE_APIS)
      .filter(([_, api]) => api.cost === 'free')
      .map(([key, api]) => ({ key, ...api })),
  };
}

// ─────────────────────────────────────────────────────────
// 7. EXPORT - All functions and constants
// ─────────────────────────────────────────────────────────
module.exports = {
  // Constants
  ACTIVE_APIS,
  MONTHLY_CAPS,
  DAILY_HARD_CAP,
  PRICING,
  USER_LIMITS,

  // Functions
  estimateCost,
  estimateSerperCost,
  getAPIStatus,
  isWithinMonthlyLimit,
  isWithinDailyLimit,
  formatCost,
  getAPIsSummary,
};
