const admin = require('firebase-admin');
const { getWeeklyContext } = require('../../getWeeklyContext');
const { shouldIncludeWeeklyContextInCoachPrompt } = require('../coachPersonalDataRouting');
const { fetchWorkoutPlanContext } = require('../coachExtendedContext');
const {
  shouldInvokeWebSearch,
  WEB_SEARCH_SYSTEM_APPEND,
  WEB_SOURCE_QUOTE_SYSTEM_APPEND,
  THREAD_CLARIFY_SYSTEM_APPEND,
  NO_WEB_SEARCH_HONESTY_APPEND,
  WEB_SEARCH_FAILED_APPEND,
  messagesRequestWebSearch,
  buildWebSearchQuery,
  stripWebSearchPrefix,
  stripFakeWebSearchClaims,
  userRequestedWebSearchTurn,
  isWebSourceQuoteFollowUp,
  isWebAnswerFollowUp,
  findPriorSubstantiveUserQuestion,
  resolveCoachWebSearchGate,
  filterFitnessWebSources,
} = require('../coachWebSearch');
const { mergeCoachToolCalls } = require('../inferCoachToolCall');
const { filterValidCoachToolProposals } = require('../../../src/ai-coach/server-logic/tools/shouldShowCoachAction');
const { sanitizeCoachImageAttachments, runCoachVisionTurn } = require('../coachVision');
const { parseCoachToolCalls, stripCoachToolJsonFromReply: stripToolJsonFromReply } = require('../../../src/ai-coach/tools/parseCoachToolCalls');
const {
  buildCoachSystemPrompt,
  buildWeeklyContextSystemPrompt,
  formatWorkoutPlanSection,
} = require('../coachPrompt/coachPromptBuilders');
const {
  resolveDeepSeekKey,
  resolvePerplexityKey,
  callDeepSeek,
  callPerplexityCoach,
  callPerplexity,
  coachMessagesForLlm,
  detectFatigue,
  enforceDailyMessageLimit,
  logAPIUsage,
  augmentCoachPromptWithWebSearch,
  WEEKLY_FETCH_FAILURE_NOTE,
  normalizeCoachMessages,
} = require('../llm/coachLlmProviders');
const { resolveAiCoachDailyLimit, isAiCoachLimitsEnforced } = require('../aiCoachRateLimit');
const logger = require('../logger');

function isAiCoachTestRequest(req) {
  if (process.env.NODE_ENV === 'production') return false;
  const header =
    req?.headers?.['x-ai-coach-test-suite'] ||
    req?.headers?.['X-AI-Coach-Test-Suite'] ||
    '';
  return String(header) === '1' || req?.body?.options?.testSuite === true;
}

function isAiCoachTestOrDev(req) {
  return (
    isAiCoachTestRequest(req) ||
    process.env.AI_COACH_UNLIMITED === '1' ||
    process.env.NODE_ENV !== 'production' ||
    !isAiCoachLimitsEnforced()
  );
}

function parseToolCalls(aiResponse) {
  return parseCoachToolCalls(aiResponse);
}

function resolveCoachToolCalls(aiText, userMessage, weeklyContext) {
  return filterValidCoachToolProposals(
    mergeCoachToolCalls(aiText, userMessage, weeklyContext || {}),
    userMessage,
  );
}

async function buildCoachPromptForUser(
  targetUid,
  userProfile,
  lastUserMessage = '',
  coachOptions = {}
) {
  let includeWeekly;
  if (coachOptions.includePersonalData === true && targetUid) {
    includeWeekly = true;
  } else {
    includeWeekly = targetUid
      ? shouldIncludeWeeklyContextInCoachPrompt(
          lastUserMessage,
          coachOptions.conversationMessages,
        )
      : false;
  }

  let systemPrompt = buildCoachSystemPrompt(userProfile, { generalMode: !includeWeekly });
  let weeklyContext = null;
  let usedWeeklyContext = false;

  let workoutPlanCtx = null;
  if (targetUid && admin.apps.length) {
    try {
      workoutPlanCtx = await fetchWorkoutPlanContext(admin.firestore(), targetUid);
    } catch (e) {
      logger.warn('buildCoachPromptForUser: workout plan fetch failed', e?.message || e);
    }
  }

  if (targetUid && includeWeekly) {
    try {
      const weekly = await getWeeklyContext(targetUid);
    const wc = weekly || {};
    logger.info('buildCoachPromptForUser weekly context keys:', {
      streakData: wc?.streakData,
      hasWorkoutPlan: Boolean(wc?.workoutPlan?.activePlan),
      notesCount: wc?.notesAndFiles?.notes?.length ?? 0,
      trainerDocs: wc?.trainerDocuments?.documents?.length ?? 0,
      wellnessAnalysis: wc?.wellnessAnalysis
        ? {
            hasSteps: Boolean(wc.wellnessAnalysis.steps),
            hasWater: Boolean(wc.wellnessAnalysis.water),
            hasEnergy: Boolean(wc.wellnessAnalysis.energy),
            hasMood: Boolean(wc.wellnessAnalysis.mood),
          }
        : null,
      workoutAvgRPE: wc?.workoutAnalysis?.avgRPE,
    });

    const fatigue = await detectFatigue(targetUid);
    const rawAvgRpe = wc?.workoutAnalysis?.avgRPE;
    const avgRPE =
      rawAvgRpe != null && Number.isFinite(Number(rawAvgRpe)) ? Number(rawAvgRpe) : null;

    weeklyContext = {
      age: wc?.user?.age ?? '?',
      weight: wc?.user?.weight ?? '?',
      height: wc?.user?.height ?? '?',
      goal: wc?.user?.goal ?? 'unknown',
      trainingLevel: wc?.user?.trainingLevel ?? 'unknown',

      targetCal: wc?.macroTargets?.calories ?? 0,
      targetP: wc?.macroTargets?.protein ?? 0,
      targetC: wc?.macroTargets?.carbs ?? 0,
      targetF: wc?.macroTargets?.fat ?? 0,

      avgCal: Math.round(Number(wc?.nutritionAnalysis?.avgDailyCalories) || 0),
      avgP: Math.round(Number(wc?.nutritionAnalysis?.avgProtein) || 0),
      avgC: Math.round(Number(wc?.nutritionAnalysis?.avgCarbs) || 0),
      avgF: Math.round(Number(wc?.nutritionAnalysis?.avgFat) || 0),
      consistency: Number(wc?.nutritionAnalysis?.consistencyScore) || 0,
      daysLogged: Number(wc?.nutritionAnalysis?.totalLoggedDaysAllTime) || 0,
      mealDetailDays: Number(wc?.nutritionAnalysis?.dailyBreakdown?.length) || 0,
      totalDaysSinceJoin: Number(wc?.contextMeta?.totalDaysSinceJoin) || 7,
      accountCreatedAt: wc?.contextMeta?.accountCreatedAt || null,
      totalLoggedDaysAllTime: Number(wc?.nutritionAnalysis?.totalLoggedDaysAllTime) || Number(wc?.nutritionAnalysis?.daysLogged) || 0,
      firstLogDate: wc?.nutritionAnalysis?.firstLogDate || null,
      lastLogDate: wc?.nutritionAnalysis?.lastLogDate || null,
      dailyBreakdown: wc?.nutritionAnalysis?.dailyBreakdown || [],
      monthlyRollup: wc?.nutritionAnalysis?.monthlyRollup || [],
      monthlyTimeline: wc?.nutritionAnalysis?.monthlyTimeline || [],
      workoutMonthlyTimeline: wc?.workoutAnalysis?.monthlyTimeline || [],
      firstSessionDate: wc?.workoutAnalysis?.firstSessionDate || null,
      lastSessionDate: wc?.workoutAnalysis?.lastSessionDate || null,
      progressCycleSummary: wc?.progressCycleSummary || [],

      sessions: Number(wc?.workoutAnalysis?.sessionsLogged) || 0,
      sessionDates: wc?.workoutAnalysis?.sessionDates || [],
      totalVol: Math.round(Number(wc?.workoutAnalysis?.totalVolume) || 0),
      avgRPE,

      avgHours: Math.round((Number(wc?.sleepAnalysis?.avgHours) || 0) * 10) / 10,
      sleepQuality: wc?.sleepAnalysis?.quality || 'unknown',
      isDepleted: wc?.sleepAnalysis?.isDepleted === true,

      weightLog: wc?.weightLog || [],
      streak: Number(wc?.streakData?.currentStreak) || 0,
      weightTrend: wc?.weightTrend || 'unknown',
      volumeTrend: wc?.workoutAnalysis?.volumeTrend || 'stable',
      wellness: wc?.wellnessAnalysis || null,
      workoutPlan: wc?.workoutPlan || null,
      notesAndFiles: wc?.notesAndFiles || null,
      trainerDocuments: wc?.trainerDocuments || null,
    };

    systemPrompt = buildWeeklyContextSystemPrompt(weeklyContext);

    const foodLogJson = weeklyContext.dailyBreakdown || [];
    if (foodLogJson.length) {
      systemPrompt += `\n\n=== VERIFIED_FOOD_LOG_JSON (from app database — cite this; do not ask user to paste) ===\n${JSON.stringify(foodLogJson, null, 2)}\n=== END FOOD LOG ===`;
    }

    usedWeeklyContext = true;

    if (fatigue?.detected) {
      systemPrompt += `\n\nFATIGUE DETECTION:\nDetected: true\nReason: ${fatigue.reason}\nRecommendation: suggest lighter training or a rest day (logRestDay tool if they agree). Do NOT offer deload-week generation.`;
    }
  } catch (e) {
    logger.error(
      'Weekly context fetch failed; continuing with base prompt:',
      e?.message || e
    );
    systemPrompt = buildCoachSystemPrompt(userProfile, { generalMode: false });
    systemPrompt += WEEKLY_FETCH_FAILURE_NOTE;
    if (workoutPlanCtx) {
      systemPrompt += formatWorkoutPlanSection(workoutPlanCtx);
    }
  }
  } else if (workoutPlanCtx) {
    systemPrompt += formatWorkoutPlanSection(workoutPlanCtx);
  }

  return { systemPrompt, weeklyContext, usedWeeklyContext };
}

/** Web-search pipeline: Perplexity (sonar) → Serper snippets + DeepSeek */
async function runCoachWebSearch({
  systemPrompt,
  messages,
  searchQuery,
  lastUserMsg,
  weeklyContext,
  targetUid,
  perplexityKey,
  deepSeekKey,
}) {
  const query = stripWebSearchPrefix(String(searchQuery || '').trim()) || String(searchQuery || '').trim();
  const sourceQuoteMode = isWebSourceQuoteFollowUp(lastUserMsg);
  const webSystemPrompt =
    systemPrompt + WEB_SEARCH_SYSTEM_APPEND + (sourceQuoteMode ? WEB_SOURCE_QUOTE_SYSTEM_APPEND : '');

  if (perplexityKey) {
    try {
      const { text, webSources } = await callPerplexityCoach({
        apiKey: perplexityKey,
        systemPrompt: webSystemPrompt,
        messages,
        searchQuery: query,
      });
      const toolCalls = resolveCoachToolCalls(text, lastUserMsg, weeklyContext);
      const reply = stripToolJsonFromReply(text);
      const inputTokens = Math.ceil((webSystemPrompt.length + JSON.stringify(messages).length) / 4);
      const outputTokens = Math.ceil(String(text).length / 4);
      await logAPIUsage('perplexity', targetUid || null, inputTokens, outputTokens, 'web-search');
      return {
        reply,
        toolCalls,
        source: 'perplexity',
        searchedWeb: true,
        webProvider: 'perplexity',
        route: 'web-search',
        webSources,
      };
    } catch (e) {
      console.warn('[web-search] Perplexity failed:', e?.message || e);
    }
  }

  if (deepSeekKey && process.env.SERPER_API_KEY) {
    const augmented = await augmentCoachPromptWithWebSearch(webSystemPrompt, query);
    if (!augmented.searchedWeb) {
      const err = new Error('Web search returned no results for that query.');
      err.status = 503;
      throw err;
    }
    const response = await callDeepSeek({
      apiKey: deepSeekKey,
      systemPrompt: augmented.prompt,
      messages,
    });
    const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
    const reply = stripToolJsonFromReply(response.text);
    const inputTokens = Math.ceil((augmented.prompt.length + JSON.stringify(messages).length) / 4);
    const outputTokens = Math.ceil(String(response.text).length / 4);
    await logAPIUsage('deepseek', targetUid || null, inputTokens, outputTokens, 'web-search');
    return {
      reply,
      toolCalls,
      source: 'deepseek',
      searchedWeb: augmented.searchedWeb,
      webProvider: augmented.webProvider,
      route: 'web-search',
      webSources: augmented.webSources || [],
    };
  }

  const err = new Error(
    'Web search is not available. Set PERPLEXITY_API_KEY or SERPER_API_KEY + DEEPSEEK_API_KEY on the server.'
  );
  err.status = 503;
  throw err;
}

async function handleAICoachRequest(req, res, { forceWebSearch = false } = {}) {
  const started = Date.now();
  const { messages, userProfile, options, userId, query: searchQueryOverride, attachments: rawAttachments } =
    req.body || {};

  const requesterUid = String(req.firebaseAuth?.uid || '').trim();
  const targetUid = String(userId || '').trim();
  if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });
  if (!targetUid) return res.status(400).json({ error: 'userId is required' });
  if (targetUid !== requesterUid) return res.status(403).json({ error: 'Forbidden' });

  const imageAttachments = sanitizeCoachImageAttachments(rawAttachments);
  const hasImages = imageAttachments.length > 0;

  const normalized = normalizeCoachMessages(messages);
  if (normalized.length === 0 && !hasImages) {
    return res.status(400).json({ error: 'messages is required' });
  }

  const webMode = hasImages ? 'off' : forceWebSearch ? 'on' : options?.web || 'auto';
  const lastUserMsg = [...normalized].reverse().find((m) => m.role === 'user')?.content || '';
  if (String(lastUserMsg).length > 2000) {
    return res.status(400).json({ error: 'Message too long (max 2000 chars)' });
  }

  if (!isAiCoachTestOrDev(req)) {
    let firestoreUserProfile = {};
    if (admin.apps.length) {
      try {
        const userSnap = await admin.firestore().collection('users').doc(targetUid).get();
        if (userSnap.exists) {
          firestoreUserProfile = userSnap.data() || {};
        }
      } catch (e) {
        console.warn('[ai-coach] failed to load user tier from Firestore:', e?.message || e);
      }
    }
    const userTier =
      firestoreUserProfile?.subscriptionTier ||
      firestoreUserProfile?.planTier ||
      firestoreUserProfile?.tier ||
      firestoreUserProfile?.subscription ||
      'free';
    console.log(`[ai-coach] uid=${targetUid} tier=${userTier} (from Firestore)`);
    const dailyLimit = resolveAiCoachDailyLimit(firestoreUserProfile);
    const usage = await enforceDailyMessageLimit(targetUid, dailyLimit);
    if (!usage.allowed) {
      return res.status(429).json({
        error: 'Daily AI Coach message limit reached.',
        limit: usage.limit,
        remaining: 0,
        resetsAt: usage.resetsAt,
      });
    }
  }

  const deepSeekKey = resolveDeepSeekKey();
  const perplexityKey = resolvePerplexityKey();
  const answerFollowUp = isWebAnswerFollowUp(lastUserMsg, normalized);
  const userWantsWeb = userRequestedWebSearchTurn({
    webMode,
    lastUserMsg,
    messages: normalized,
    hasImages,
  });
  let invokeWeb =
    !hasImages &&
    !answerFollowUp &&
    (webMode === 'on' ||
      (webMode !== 'off' &&
        (shouldInvokeWebSearch(webMode, lastUserMsg) || messagesRequestWebSearch(normalized, lastUserMsg))));
  if (userWantsWeb && !answerFollowUp && !hasImages && webMode !== 'off') {
    invokeWeb = true;
  }
  const webSearchQuery = buildWebSearchQuery(normalized, lastUserMsg);
  let webSearchFailed = false;

  const promptOptions = {
    ...(options || {}),
    conversationMessages: normalized,
  };
  let { systemPrompt, weeklyContext, usedWeeklyContext } = await buildCoachPromptForUser(
    targetUid,
    userProfile,
    lastUserMsg,
    promptOptions,
  );

  const lastAssistantForFollowUp = [...normalized].reverse().find((m) => m && m.role === 'assistant');
  const priorSourcesForFollowUp = Array.isArray(lastAssistantForFollowUp?.webSources)
    ? lastAssistantForFollowUp.webSources
    : [];

  if (answerFollowUp) {
    const lastAssistant = lastAssistantForFollowUp;
    const priorReply = String(lastAssistant?.content || '').trim();
    const priorQuestion = findPriorSubstantiveUserQuestion(normalized, lastUserMsg);
    const priorSources = priorSourcesForFollowUp;

    if (priorQuestion) {
      systemPrompt += `\n\nORIGINAL USER QUESTION (stay on THIS topic only — do not change subject):\n${priorQuestion.slice(0, 800)}`;
    }
    if (priorReply) {
      systemPrompt += `\n\nYOUR IMMEDIATE PRIOR REPLY (elaborate on THIS only — same topic, same sources):\n${priorReply.slice(0, 3500)}`;
    }
    if (priorSources.length > 0) {
      const srcBlock = priorSources
        .map((s, i) => `${i + 1}. ${s.title || 'Source'} — ${s.url}\n${s.snippet || ''}`)
        .join('\n');
      systemPrompt += `\n\nSOURCES FROM YOUR PRIOR WEB SEARCH (use ONLY these — quote snippets when asked what sources said):\n${srcBlock}`;
    }
    systemPrompt += THREAD_CLARIFY_SYSTEM_APPEND;
    if (isWebSourceQuoteFollowUp(lastUserMsg)) {
      systemPrompt += WEB_SOURCE_QUOTE_SYSTEM_APPEND;
    }
  } else if (!invokeWeb) {
    systemPrompt += NO_WEB_SEARCH_HONESTY_APPEND;
    if (userWantsWeb) systemPrompt += WEB_SEARCH_FAILED_APPEND;
  }

  const coachMeta = {
    usedWeeklyContext,
    nutritionDaysLogged: weeklyContext?.daysLogged ?? null,
    dailyFoodLogDays: Array.isArray(weeklyContext?.dailyBreakdown)
      ? weeklyContext.dailyBreakdown.length
      : 0,
    analyzedImages: hasImages ? imageAttachments.length : 0,
  };

  if (hasImages) {
    try {
      const response = await runCoachVisionTurn({
        systemPrompt,
        messages: normalized,
        attachments: imageAttachments,
        logAPIUsage,
        targetUid,
      });
      const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
      const reply = stripToolJsonFromReply(response.text);
      return res.json({
        reply,
        toolCalls,
        source: response.source || 'vision',
        searchedWeb: false,
        webProvider: null,
        route: 'vision',
        ...coachMeta,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.warn('Coach vision failed:', e?.message || e);
      return res.status(503).json({
        error: e?.message || 'Photo analysis is unavailable',
        hint: 'DeepSeek chat is text-only. Add REPLICATE_API_TOKEN for DeepSeek-VL2 photos, or set DEEPSEEK_VISION_BASE_URL for a DeepSeek-VL host.',
        route: 'vision',
        ...coachMeta,
      });
    }
  }

  if (invokeWeb) {
    const webGate = resolveCoachWebSearchGate({
      lastUserMsg,
      messages: normalized,
      rawQuery: searchQueryOverride || webSearchQuery,
    });
    if (webGate.action === 'ask_topic' || webGate.action === 'off_topic') {
      return res.json({
        reply: webGate.reply,
        toolCalls: [],
        source: 'coach',
        searchedWeb: false,
        webProvider: null,
        route: webGate.action === 'ask_topic' ? 'web-search-ask-topic' : 'web-search-off-topic',
        ...coachMeta,
        ms: Date.now() - started,
      });
    }
    try {
      const result = await runCoachWebSearch({
        systemPrompt,
        messages: coachMessagesForLlm(normalized),
        searchQuery: webGate.query || searchQueryOverride || webSearchQuery,
        lastUserMsg,
        weeklyContext,
        targetUid,
        perplexityKey,
        deepSeekKey,
      });
      if (Array.isArray(result.webSources) && result.webSources.length) {
        result.webSources = filterFitnessWebSources(result.webSources);
      }
      return res.json({ ...result, ...coachMeta, ms: Date.now() - started });
    } catch (e) {
      webSearchFailed = true;
      console.warn('Web search failed; falling back to honest coach reply:', e?.message || e);
      systemPrompt += NO_WEB_SEARCH_HONESTY_APPEND;
      systemPrompt += WEB_SEARCH_FAILED_APPEND;
    }
  }

  if (deepSeekKey) {
    try {
      const response = await callDeepSeek({
        apiKey: deepSeekKey,
        systemPrompt,
        messages: coachMessagesForLlm(normalized),
      });
      const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
      let reply = stripToolJsonFromReply(response.text);
      if ((userWantsWeb || webSearchFailed) && !answerFollowUp) {
        reply = stripFakeWebSearchClaims(reply);
        if (reply && !/live search (?:wasn't|was not|isn't|is not) available/i.test(reply)) {
          reply = `Live search wasn't available this turn — here's what I know from coaching knowledge, not cited web results. ${reply}`;
        }
      }
      
      const inputTokens = Math.ceil((systemPrompt.length + JSON.stringify(normalized).length) / 4);
      const outputTokens = Math.ceil(String(response.text).length / 4);
      await logAPIUsage('deepseek', targetUid || null, inputTokens, outputTokens, 'active');
      return res.json({
        reply,
        toolCalls,
        source: 'deepseek',
        searchedWeb: false,
        webProvider: null,
        route: webSearchFailed || (userWantsWeb && !answerFollowUp)
          ? 'web-search-failed'
          : answerFollowUp
            ? 'thread-follow-up'
            : 'chat',
        answerFollowUp: answerFollowUp === true,
        webSources: answerFollowUp && priorSourcesForFollowUp.length ? priorSourcesForFollowUp : [],
        ...coachMeta,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.warn('DeepSeek failed; falling back to Perplexity if available:', e?.message || e);
    }
  }

  if (perplexityKey) {
    try {
      const response = await callPerplexity({
        apiKey: perplexityKey,
        systemPrompt,
        messages: normalized,
      });
      const toolCalls = resolveCoachToolCalls(response.text, lastUserMsg, weeklyContext);
      const reply = stripToolJsonFromReply(response.text);
      const inputTokens = Math.ceil((systemPrompt.length + JSON.stringify(normalized).length) / 4);
      const outputTokens = Math.ceil(String(response.text).length / 4);
      await logAPIUsage('perplexity', targetUid || null, inputTokens, outputTokens, 'fallback');
      return res.json({
        reply,
        toolCalls,
        source: 'perplexity',
        searchedWeb: true,
        webProvider: 'perplexity',
        route: 'chat',
        ...coachMeta,
        ms: Date.now() - started,
      });
    } catch (e) {
      console.error('Perplexity fallback failed:', e?.message || e);
    }
  }

  const missing = [];
  if (!deepSeekKey) missing.push('DEEPSEEK_API_KEY');
  if (!perplexityKey) missing.push('PERPLEXITY_API_KEY (optional fallback)');
  return res.status(503).json({
    error: 'AI request failed (no providers available)',
    hint:
      missing.length > 0
        ? `Set on Cloud Run → coachconnect-api → Variables: ${missing.join(', ')}. Then redeploy is not required.`
        : 'Check API keys on the server.',
    missingKeys: missing,
  });
}


module.exports = {
  buildCoachPromptForUser,
  runCoachWebSearch,
  handleAICoachRequest,
  parseToolCalls,
  stripToolJsonFromReply,
  isAiCoachTestRequest,
  isAiCoachTestOrDev,
  isAiCoachLimitsEnforced,
};
