/** User profile, weekly context, macro recalibration */
const admin = require('firebase-admin');
const { getWeeklyContext } = require('../getWeeklyContext');
const { recalibrateUserMacros } = require('../lib/macroRecalibration');

async function isTrainerOfClient(trainerUid, clientUid) {
  try {
    if (!admin.apps.length) return false;
    if (!trainerUid || !clientUid) return false;
    const snap = await admin
      .firestore()
      .collection('trainer_clients')
      .doc(String(trainerUid))
      .collection('clients')
      .doc(String(clientUid))
      .get();
    return snap.exists;
  } catch (_) {
    return false;
  }
}

function registerUserRoutes(app, deps) {
  const {
    verifyFirebaseBearerToken,
    isoDateKey,
    isAiCoachLimitsEnforced,
    isAiCoachTestRequest,
  } = deps;

  app.get('/api/me', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const uid = req.firebaseAuth?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const docSnap = await admin.firestore().collection('users').doc(uid).get();
    const data = docSnap.exists ? docSnap.data() : null;

    return res.json({
      exists: !!docSnap.exists,
      user: {
        uid,
        ...(data || {}),
      },
    });
  } catch (e) {
    console.error('GET /api/me failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
  });

  app.get('/api/weekly-context/:userId', verifyFirebaseBearerToken, async (req, res) => {
  const targetUserId = String(req.params?.userId || '').trim();
  if (!targetUserId || targetUserId.length < 3) {
    return res.status(400).json({ error: 'Invalid userId' });
  }

  const requesterUid = String(req.firebaseAuth?.uid || '').trim();
  if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });

  // Owner can read their own weekly context.
  // Optional: allow trainer to read assigned client.
  const allowed =
    targetUserId === requesterUid ||
    (await isTrainerOfClient(requesterUid, targetUserId));

  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
                  
  try {
    const context = await getWeeklyContext(targetUserId);
    return res.json(context);
  } catch (e) {
    if (e && (e.code === 'not_found' || e.name === 'NotFoundError')) {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('GET /api/weekly-context failed:', e?.message || e);
    return res.status(500).json({ error: 'Failed to fetch weekly context' });
  }
  });

  app.post('/api/ai-coach/reset-usage', verifyFirebaseBearerToken, async (req, res) => {
  if (isAiCoachLimitsEnforced() && !isAiCoachTestRequest(req)) {
    return res.status(403).json({ error: 'Not available in production without X-AI-Coach-Test-Suite: 1' });
  }
  if (!admin.apps.length) return res.status(503).json({ error: 'Firebase Admin not initialized' });
  const uid = String(req.firebaseAuth?.uid || '').trim();
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const date = isoDateKey();
    await admin.firestore().collection('users').doc(uid).collection('usage').doc(`aiCoach_${date}`).delete();
    return res.json({ ok: true, message: 'Daily AI Coach usage reset for today.' });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Reset failed' });
  }
  });

  app.post('/api/macro-recalibration', verifyFirebaseBearerToken, async (req, res) => {
  const userId = String(req.firebaseAuth?.uid || '').trim();
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!admin.apps.length) {
    return res.status(503).json({ error: 'Firebase Admin not initialized' });
  }
  try {
    const result = await recalibrateUserMacros(admin.firestore(), admin, userId);
    return res.json(result);
  } catch (e) {
    console.error('POST /api/macro-recalibration failed:', e?.message || e);
    return res.status(500).json({ error: 'Macro recalibration failed' });
  }
  });

  app.get('/api/fatigue/:userId', verifyFirebaseBearerToken, async (req, res) => {
    const { detectFatigue } = deps;
    try {
      const userId = String(req.params?.userId || '').trim();
      if (!userId) return res.status(400).json({ error: 'Invalid userId' });

      const requesterUid = String(req.firebaseAuth?.uid || '').trim();
      if (!requesterUid) return res.status(401).json({ error: 'Unauthorized' });

      const allowed =
        userId === requesterUid || (await isTrainerOfClient(requesterUid, userId));
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });

      const result = await detectFatigue(userId);
      return res.json(result);
    } catch (e) {
      console.error('GET /api/fatigue failed:', e?.message || e);
      return res.status(500).json({ error: 'Fatigue detection failed' });
    }
  });
}

module.exports = { registerUserRoutes, isTrainerOfClient };
