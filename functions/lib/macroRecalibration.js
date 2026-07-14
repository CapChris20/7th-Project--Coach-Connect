/**
 * Server-side macro recalibration (Admin SDK) — used by cron + HTTP route.
 */
const MIN_LOGGED_DAYS = 8;
const ERROR_THRESHOLD_PERCENT = 15;
const RECALIBRATION_DAYS = 14;

function isoDateKey(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toISOString().slice(0, 10);
}

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
  if (ts.toDate) return ts.toDate();
  const p = Date.parse(ts);
  return Number.isNaN(p) ? null : new Date(p);
}

function daysBetween(a, b) {
  return Math.floor(Math.abs(b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

function goalMultiplier(goal) {
  const g = String(goal || '').toLowerCase();
  if (g.includes('lose') || g.includes('cut') || g.includes('fat')) return 0.95;
  if (g.includes('muscle') || g.includes('bulk') || g.includes('build')) return 1.05;
  return 1;
}

async function fetchNutritionLogsByDay(db, userId, startKey) {
  const snap = await db
    .collection('nutrition_logs')
    .where('user_id', '==', userId)
    .where('date', '>=', startKey)
    .get()
    .catch(async () => {
      const all = await db.collection('nutrition_logs').where('user_id', '==', userId).limit(200).get();
      return all;
    });

  const byDay = {};
  snap.docs.forEach((d) => {
    const data = d.data() || {};
    const day = data.date || d.id;
    if (day < startKey) return;
    byDay[day] = (byDay[day] || 0) + (Number(data.calories) || 0);
  });

  const entries = Object.entries(byDay).filter(([, c]) => c > 0);
  const total = entries.reduce((s, [, c]) => s + c, 0);
  return {
    loggedDays: entries.length,
    actualAvgCals: entries.length ? Math.round(total / entries.length) : 0,
  };
}

async function recalibrateUserMacros(db, admin, userId) {
  const startKey = isoDateKey(new Date(Date.now() - RECALIBRATION_DAYS * 86400000));
  const { loggedDays, actualAvgCals } = await fetchNutritionLogsByDay(db, userId, startKey);

  if (loggedDays < MIN_LOGGED_DAYS) {
    return { success: false, reason: 'not_enough_data', userId };
  }

  const userRef = db.collection('users').doc(userId);
  const userSnap = await userRef.get();
  if (!userSnap.exists) return { success: false, reason: 'no_user', userId };
  const userData = userSnap.data() || {};

  const mtRef = userRef.collection('macroTargets').doc('current');
  const mtSnap = await mtRef.get();
  const mt = mtSnap.exists ? mtSnap.data() : {};

  const goalsSnap = await db.collection('nutrition_goals').doc(userId).get();
  const goals = goalsSnap.exists ? goalsSnap.data() : {};

  const initialEstimate = Math.round(
    Number(mt.calories) ||
      Number(goals.calorie_target) ||
      Number(userData.macroTargets?.calories) ||
      2000
  );

  const protein0 = Number(mt.protein || goals.protein_target || 160);
  const carbs0 = Number(mt.carbs || goals.carbs_target || 200);
  const fat0 = Number(mt.fat || goals.fat_target || 70);

  const errorPercent =
    initialEstimate > 0 ? (Math.abs(actualAvgCals - initialEstimate) / initialEstimate) * 100 : 0;

  const serverTs = () =>
    admin.apps.length ? admin.firestore.FieldValue.serverTimestamp() : new Date();

  if (errorPercent <= ERROR_THRESHOLD_PERCENT) {
    await mtRef.set({ confidence: 'high', verifiedAt: serverTs() }, { merge: true });
    return { success: true, adjusted: false, userId, errorPercent };
  }

  const goal = userData.primaryGoal || userData.goal || 'maintain';
  const adjustedCals = Math.round(actualAvgCals * goalMultiplier(goal));
  const newProtein = Math.max(50, Math.round((adjustedCals * (protein0 / Math.max(initialEstimate, 1))) / 4));
  const newCarbs = Math.max(50, Math.round((adjustedCals * (carbs0 / Math.max(initialEstimate, 1))) / 4));
  const newFat = Math.max(30, Math.round((adjustedCals * (fat0 / Math.max(initialEstimate, 1))) / 9));

  await db.collection('nutrition_goals').doc(userId).set(
    {
      user_id: userId,
      calorie_target: adjustedCals,
      protein_target: newProtein,
      carbs_target: newCarbs,
      fat_target: newFat,
      recalibrated_at: serverTs(),
      updated_at: serverTs(),
    },
    { merge: true }
  );

  await mtRef.set(
    {
      calories: adjustedCals,
      protein: newProtein,
      carbs: newCarbs,
      fat: newFat,
      confidence: 'high',
      recalibratedAt: serverTs(),
      initialEstimate,
      actualAverage: actualAvgCals,
      errorPercent: Number(errorPercent.toFixed(1)),
    },
    { merge: true }
  );

  await userRef.collection('macroHistory').add({
    event: 'recalibration',
    timestamp: serverTs(),
    previousCals: initialEstimate,
    newCals: adjustedCals,
    newProtein,
    newCarbs,
    newFat,
    reason: 'automatic_recalibration',
  });

  return {
    success: true,
    adjusted: true,
    userId,
    previousCals: initialEstimate,
    newCals: adjustedCals,
    errorPercent,
  };
}

function shouldRecalibrateUser(userData, mt) {
  if (mt?.confidence === 'high' && mt?.recalibratedAt) return false;
  const anchor =
    tsToDate(userData.onboardingCompletedAt) ||
    tsToDate(userData.createdAt) ||
    tsToDate(mt?.createdAt);
  if (!anchor) return false;
  return daysBetween(anchor, new Date()) >= RECALIBRATION_DAYS;
}

async function runDailyMacroRecalibrationJob(admin) {
  if (!admin.apps.length) {
    console.warn('[macroRecalibration] Firebase Admin not initialized');
    return { processed: 0 };
  }
  const db = admin.firestore();
  const snap = await db.collection('users').where('role', '==', 'client').get().catch(() => null);
  const docs = snap?.docs?.length ? snap.docs : (await db.collection('users').limit(500).get()).docs;

  let processed = 0;
  let adjusted = 0;

  for (const userDoc of docs) {
    const userId = userDoc.id;
    const userData = userDoc.data() || {};
    if (String(userData.role || '').toLowerCase() === 'trainer') continue;

    const mtSnap = await db.collection('users').doc(userId).collection('macroTargets').doc('current').get();
    const mt = mtSnap.exists ? mtSnap.data() : {};
    if (!shouldRecalibrateUser(userData, mt)) continue;

    const result = await recalibrateUserMacros(db, admin, userId);
    processed += 1;
    if (result.adjusted) {
      adjusted += 1;
      try {
        await db.collection('users').doc(userId).collection('aiCoachActions').add({
          action: 'macroRecalibration',
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          details: result,
        });
      } catch (_) {
        /* ignore */
      }
    }
  }

  console.log(`[macroRecalibration] processed=${processed} adjusted=${adjusted}`);
  return { processed, adjusted };
}

module.exports = {
  recalibrateUserMacros,
  runDailyMacroRecalibrationJob,
  shouldRecalibrateUser,
  RECALIBRATION_DAYS,
};
