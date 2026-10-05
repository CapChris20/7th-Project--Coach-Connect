/** Health / readiness routes */
function registerHealthRoutes(app) {
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'coachconnect-api',
      deepseek: !!process.env.DEEPSEEK_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      replicateVision: !!(process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY),
      youtube: !!(process.env.YOUTUBE_API_KEY || process.env.REACT_NATIVE_YOUTUBE_API_KEY),
      serperConfigured: !!process.env.SERPER_API_KEY,
    });
  });

}

/** Rich /api/health for local dev + deploy checks (call after AI keys are resolvable). */
function registerApiHealthRoute(app, getStatus) {
  app.get('/api/health', (_req, res) => {
    res.json(getStatus());
  });
}

module.exports = { registerHealthRoutes, registerApiHealthRoute };
