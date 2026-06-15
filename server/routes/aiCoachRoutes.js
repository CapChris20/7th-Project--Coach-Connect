/** AI Coach HTTP routes (handlers live in server/index.js for now). */
function registerAICoachRoutes(app, deps) {
  const {
    verifyFirebaseBearerToken,
    devOnlyRoute,
    handleAICoachRequest,
    executeTool,
    parseToolCalls,
    stripToolJsonFromReply,
  } = deps;

  app.post('/api/ai-coach', verifyFirebaseBearerToken, (req, res) =>
    handleAICoachRequest(req, res),
  );

  app.post('/api/ai-coach/web-search', verifyFirebaseBearerToken, (req, res) =>
    handleAICoachRequest(req, res, { forceWebSearch: true }),
  );

  app.post('/api/ai-coach/execute-tool', verifyFirebaseBearerToken, async (req, res) => {
    try {
      const { userId, toolCall, confirmed } = req.body || {};
      if (!confirmed) return res.status(400).json({ error: 'Tool execution requires confirmation' });
      if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'userId is required' });
      if (!toolCall || typeof toolCall !== 'object') return res.status(400).json({ error: 'toolCall is required' });

      const requesterUid = String(req.firebaseAuth?.uid || '').trim();
      const targetUid = String(userId || '').trim();
      if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });
      if (targetUid !== requesterUid) return res.status(403).json({ error: 'Forbidden' });

      console.log('[audit] ai-coach execute-tool', {
        at: new Date().toISOString(),
        uid: requesterUid,
        tool: String(toolCall?.name || 'unknown'),
      });

      const { guardCoachToolProposal } = require('../lib/coachToolProposalGuards');
      const guarded = guardCoachToolProposal(toolCall);
      if (!guarded) {
        return res.status(400).json({ success: false, message: 'Invalid or unsupported tool proposal' });
      }

      const result = await executeTool(targetUid, guarded);
      return res.json(result);
    } catch (e) {
      return res.status(500).json({
        success: false,
        message: 'Failed to execute tool',
        data: { error: e?.message || String(e) },
      });
    }
  });

  app.post('/api/ai-coach/debug/parse-toolcalls', devOnlyRoute, (req, res) => {
    try {
      const text = String(req.body?.text || '');
      const toolCalls = parseToolCalls(text);
      const reply = stripToolJsonFromReply(text);
      return res.json({ toolCalls, reply });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to parse toolcalls', details: e?.message || String(e) });
    }
  });
}

module.exports = { registerAICoachRoutes };
