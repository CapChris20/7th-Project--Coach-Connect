const admin = require('firebase-admin');
const { COPY: PUSH_COPY, pickRandom: pushPickRandom, sub: pushSub, localDateTimeInIANA, hasDashboardWorkoutLog, minutesDiffClock } = require('../pushHelpers');
const { sendExpoPushSingle } = require('../lib/llm/coachLlmProviders');
const logger = require('../lib/logger');

function utcDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

let _nutritionReminderUtcDaySent = null;

async function runSessionSoonReminderJob() {
  if (!admin.apps.length) return;
  const db = admin.firestore();
  const HOUR_MS = 60 * 60 * 1000;
  const WINDOW_MS = 12 * 60 * 1000;
  const lower = Date.now() + HOUR_MS - WINDOW_MS;
  const upper = Date.now() + HOUR_MS + WINDOW_MS;
  let snap;
  try {
    snap = await db
      .collectionGroup('sessions')
      .where('startAtMs', '>=', lower)
      .where('startAtMs', '<=', upper)
      .limit(120)
      .get();
  } catch (e) {
    console.warn('[sessionSoonReminder] query failed — deploy Firestore index (collectionGroup sessions, startAtMs):', e?.message || e);
    return;
  }

  for (const d of snap.docs) {
    const data = d.data() || {};
    if (data.sessionReminderSent) continue;
    const st = String(data.status || 'pending').toLowerCase();
    if (st === 'cancelled' || st === 'canceled' || st === 'declined') continue;
    const clientId = data.clientId;
    if (!clientId) continue;

    try {
      const u = await db.collection('users').doc(clientId).get();
      if (!u.exists || u.data()?.notificationsEnabled === false) continue;
      const token = u.data()?.expoPushToken || u.data()?.pushToken;

      let coachLabel = 'Your coach';
      if (data.trainerId) {
        const ts = await db.collection('users').doc(String(data.trainerId)).get();
        if (ts.exists) {
          const td = ts.data();
          coachLabel = td?.displayName || td?.name || td?.firstName || coachLabel;
        }
      }

      const bodyTpl = pushPickRandom(PUSH_COPY.sessionSoonBodies || ['Session coming up soon.']);
      const body = pushSub(bodyTpl, { trainerName: coachLabel });
      const ok = await sendExpoPushSingle(token, {
        title: pushSub(pushPickRandom(PUSH_COPY.sessionBookingTitles || ['Session']), {
          trainerName: coachLabel,
        }),
        body,
        data: {
          type: 'session_reminder',
          recipientId: clientId,
          sessionId: d.id,
          trainerId: String(data.trainerId || ''),
          priority: 'low',
        },
      });
      if (ok) {
        await d.ref.set({ sessionReminderSent: true }, { merge: true });
      }
    } catch (e) {
      console.warn('[sessionSoonReminder] doc failed:', d.id, e?.message || e);
    }
  }
}

/** Opt-in daily nutrition nudge (Profile → clients). At most once per UTC day per user. */
async function runNutritionReminderPushJob() {
  if (!admin.apps.length) return;
  if (new Date().getUTCHours() !== 20) return;
  const utcDay = utcDayKey();
  if (_nutritionReminderUtcDaySent === utcDay) return;

  const db = admin.firestore();
  let snap;
  try {
    snap = await db.collection('users').where('nutritionReminderPush', '==', true).limit(400).get();
  } catch (e) {
    console.warn('[nutritionReminderPush]', e?.message || e);
    return;
  }

  for (const doc of snap.docs) {
    const u = doc.data() || {};
    if (u.notificationsEnabled === false) continue;
    if (u.lastNutritionReminderDay === utcDay) continue;
    const token = u.expoPushToken || u.pushToken;
    const coach = 'Your coach';
    const bodyTpl = pushPickRandom(PUSH_COPY.nutritionBodies || ["Time to log today's meals"]);
    const body = pushSub(bodyTpl, { trainerName: coach });
    const ok = await sendExpoPushSingle(token, {
      title: 'Nutrition check-in',
      body,
      data: {
        type: 'nutrition_reminder',
        recipientId: doc.id,
        priority: 'low',
      },
    });
    if (ok) {
      await doc.ref.set({ lastNutritionReminderDay: utcDay }, { merge: true });
    }
  }
  _nutritionReminderUtcDaySent = utcDay;
}

/**
 * Daily workout reminder (remote). Only before 6:00 PM local and only if today's
 * dashboard has no workout log in dailyLogs/{localDateKey}.
 */
async function runWorkoutReminderJob() {
  if (!admin.apps.length) return;
  const db = admin.firestore();
  let snap;
  try {
    snap = await db.collection('users').where('workoutReminder.enabled', '==', true).limit(500).get();
  } catch (e) {
    console.warn('[workoutReminder]', e?.message || e);
    return;
  }

  for (const doc of snap.docs) {
    const u = doc.data() || {};
    const wr = u.workoutReminder || {};
    if (wr.hourLocal == null || wr.minuteLocal == null) continue;
    const tz = wr.timeZone && String(wr.timeZone).trim() ? wr.timeZone : 'UTC';
    const { dateKey, hour, minute } = localDateTimeInIANA(tz);
    if (hour >= 18) continue;

    const rh = Number(wr.hourLocal);
    const rm = Number(wr.minuteLocal);
    if (!Number.isFinite(rh) || !Number.isFinite(rm)) continue;
    if (minutesDiffClock(hour, minute, rh, rm) > 12) continue;

    if (wr.lastWorkoutPushDay === dateKey) continue;
    if (u.notificationsEnabled === false) continue;

    try {
      const logsSnap = await db.collection('users').doc(doc.id).collection('dailyLogs').doc(dateKey).get();
      if (hasDashboardWorkoutLog(logsSnap.data())) continue;

      const token = u.expoPushToken || u.pushToken;
      const body = pushPickRandom(PUSH_COPY.workoutReminders || ['Time to workout!']);
      const ok = await sendExpoPushSingle(token, {
        title: 'CoachConnect',
        body,
        data: { type: 'workout_reminder', recipientId: doc.id, priority: 'low' },
      });
      if (ok) {
        await doc.ref.update({ 'workoutReminder.lastWorkoutPushDay': dateKey });
      }
    } catch (e) {
      console.warn('[workoutReminder] user failed:', doc.id, e?.message || e);
    }
  }
}

module.exports = {
  runSessionSoonReminderJob,
  runNutritionReminderPushJob,
  runWorkoutReminderJob,
  utcDayKey,
};
