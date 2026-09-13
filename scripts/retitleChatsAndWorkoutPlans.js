/**
 * Retitle bland AI chats + "AI Plan – date" workout library cards for a user.
 *
 * Usage:
 *   node scripts/retitleChatsAndWorkoutPlans.js                 # find account from screenshot titles
 *   node scripts/retitleChatsAndWorkoutPlans.js --uid <uid>
 *   node scripts/retitleChatsAndWorkoutPlans.js --email you@x.com
 *   node scripts/retitleChatsAndWorkoutPlans.js --apply         # write changes (default is dry-run)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { tryInitializeFirebaseAdmin, admin } = require('../server/lib/initFirebaseAdmin');

function looksLikeDefaultAiPlanName(name) {
  const t = String(name || '').trim();
  if (!t) return true;
  if (/^ai\s*plan\b/i.test(t)) return true;
  if (/^workout\s*plan\s*[·\-–—]/i.test(t)) return true;
  if (/^your workout plan$/i.test(t)) return true;
  return false;
}

function pickFrom(pool, seed) {
  const list = Array.isArray(pool) && pool.length ? pool : ['Training Blueprint'];
  const s = String(seed || 'plan');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return list[hash % list.length];
}

function buildCreativeWorkoutPlanName(planData = {}, fallbackSeed = '') {
  const structured =
    planData?.structuredPlan && typeof planData.structuredPlan === 'object'
      ? planData.structuredPlan
      : planData && typeof planData === 'object'
        ? planData
        : {};
  const goalRaw = String(
    structured.goal || structured.focus || structured.primaryGoal || planData?.goal || planData?.focus || '',
  )
    .trim()
    .toLowerCase();
  const weeks =
    Number(structured.weeks || structured.totalWeeks || structured.durationWeeks || planData?.totalWeeks) || 0;
  const days =
    Number(structured.daysPerWeek || structured.trainingDays?.length || planData?.daysPerWeek || 0) || 0;

  const catalogs = [
    { test: /muscle|hypertrophy|size|mass|build muscle|gain muscle/, picks: ['Muscle Forge', 'Hypertrophy Blueprint', 'Size Engine', 'Mass Builder Protocol', 'Growth Phase Arc'] },
    { test: /fat|cut|loss|lean|shred|slim|deficit/, picks: ['Shred Protocol', 'Lean Machine Plan', 'Cut Season Blueprint', 'Fat-Loss Engine', 'Definition Phase'] },
    { test: /strength|power|strong|1rm|pr/, picks: ['Strength Surge', 'Power Phase', 'Iron Foundation', 'Force Builder', 'Heavy Day Blueprint'] },
    { test: /recomp|recomposition/, picks: ['Recomp Blueprint', 'Body Recomp Arc', 'Rebuild Protocol', 'Sculpt & Strengthen'] },
    { test: /endurance|cardio|condition|stamina/, picks: ['Conditioning Circuit', 'Engine Builder', 'Endurance Arc', 'Work Capacity Plan'] },
    { test: /athletic|sport|performance|athlete/, picks: ['Athlete Protocol', 'Performance Arc', 'Game-Day Prep', 'Sport Strength Plan'] },
    { test: /beginner|starter|intro|new to/, picks: ['Foundation Phase', 'Starter Strength Arc', 'First Iron Plan', 'Base Builder'] },
    { test: /home|bodyweight|minimal equipment|no gym/, picks: ['Home Iron Plan', 'Bodyweight Blueprint', 'Minimal Gear Arc', 'Apartment Athlete Plan'] },
  ];

  let pool = ['Training Blueprint', 'Progress Arc', 'Performance Protocol', 'Lift Lab Plan', 'Weekly Grind Blueprint'];
  for (const entry of catalogs) {
    if (entry.test.test(goalRaw)) {
      pool = entry.picks;
      break;
    }
  }
  const seed = `${goalRaw}|${weeks}|${days}|${fallbackSeed || planData?.generatedAt || planData?.id || 'plan'}`;
  let name = pickFrom(pool, seed);
  if (weeks >= 2 && weeks <= 52 && !/^\d+-week/i.test(name)) name = `${weeks}-Week ${name}`;
  return String(name).replace(/\s+/g, ' ').trim().slice(0, 56);
}

function isJunkChatTitle(title) {
  const t = String(title || '').trim();
  if (!t) return true;
  if (/live search wasn'?t available/i.test(t)) return true;
  if (/here'?s what i know from coaching/i.test(t)) return true;
  if (/not cited web results/i.test(t)) return true;
  if (/^(new chat|chat|untitled)$/i.test(t)) return true;
  if (/^(calories|protein|macro|macros|fitness|sleep|recovery|workout|hypertrophy|cutting|bulking|recomp|steps|cardio)\s+chat$/i.test(t)) {
    return true;
  }
  if (/^\d+h sleep log$/i.test(t)) return true;
  if (/^fitness log$/i.test(t)) return true;
  if (/^body recomp$/i.test(t)) return true;
  return false;
}

function creativeChatTitleFromContext(title, lastUser = '', lastAssistant = '', seed = '') {
  const blob = `${lastUser}\n${lastAssistant}\n${title}`.toLowerCase();
  if (/ashwagandha/.test(blob)) return 'Ashwagandha & Sleep Science';
  if (/skinny\s*fat/.test(blob)) return 'Skinny-Fat Fix';
  if (/recomp|recomposition/.test(blob)) return 'Recomp Roadmap';
  if (/hypertrophy/.test(blob)) return 'Hypertrophy Huddle';
  if (/recovery/.test(blob)) return 'Recovery Reset';
  if (/training split|split and/.test(blob)) return 'Training Split Blueprint';
  if (/calorie deficit|deficit be/.test(blob)) return 'Deficit Strategy';
  if (/calorie|calories|kcal/.test(blob)) return 'Calorie Strategy';
  if (/protein/.test(blob)) return 'Protein Playbook';
  if (/macro/.test(blob)) return 'Macro Math Night';
  if (/nutrition|ate far|what i ate|food/.test(blob)) return 'Nutrition Reality Check';
  if (/progress/.test(blob)) return 'Progress Reality Check';
  if (/image|photo|picture/.test(blob)) return 'Photo Form Check';
  if (/workout card|today.?s workout|log.*workout/.test(blob)) return 'Workout Log Assist';
  if (/energy/.test(blob)) return 'Energy Check-In';
  if (/creatinee?/.test(blob)) return 'Creatine Clarity';
  if (/10k|10,000|steps|walking/.test(blob)) return '10K Steps Science';
  if (/sleep|slept/.test(blob)) {
    const m = blob.match(/(\d+(?:\.\d+)?)\s*h/);
    if (m) return `${m[1].replace(/\.0$/, '')}h Sleep Debrief`;
    return 'Sleep Recovery Tactics';
  }
  if (/water|hydrat/.test(blob)) return 'Hydration Check-In';
  if (/workout|training|lift|gym/.test(blob)) return 'Training Tune-Up';
  if (/cut(ting)?/.test(blob)) return 'Cutting Game Plan';
  if (/bulk(ing)?/.test(blob)) return 'Bulking Blueprint';
  if (/how r|how ru|what.?s up|yo what/.test(blob)) return 'Quick Coaching Huddle';
  if (/live search/.test(blob) || isJunkChatTitle(title)) {
    const pool = [
      'Coach Check-In',
      'Quick Coaching Huddle',
      'Form & Fuel Talk',
      'Progress Pulse',
      'Training Tune-Up',
    ];
    return pickFrom(pool, seed || title || lastUser);
  }
  return null;
}

function parseArgs(argv) {
  const out = { apply: false, uid: null, email: null };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--uid') out.uid = argv[++i];
    else if (a === '--email') out.email = argv[++i];
  }
  return out;
}

async function resolveUid(db, opts) {
  if (opts.uid) return opts.uid;
  if (opts.email) {
    const snap = await db.collection('users').where('email', '==', opts.email.trim().toLowerCase()).limit(1).get();
    if (!snap.empty) return snap.docs[0].id;
    // try exact email as stored
    const snap2 = await db.collection('users').where('email', '==', opts.email.trim()).limit(1).get();
    if (!snap2.empty) return snap2.docs[0].id;
    throw new Error(`No user found for email ${opts.email}`);
  }

  // Prefer collectionGroup search for junk titles (fast), then fall back to user scan.
  const markerPrefixes = ['Live search', 'Calories Chat', 'Fitness Log', 'Body Recomp'];
  const uidScores = new Map();
  for (const prefix of markerPrefixes) {
    try {
      const snap = await db
        .collectionGroup('aiChats')
        .orderBy('title')
        .startAt(prefix)
        .endAt(`${prefix}\uf8ff`)
        .limit(30)
        .get();
      snap.forEach((d) => {
        const userRef = d.ref.parent.parent;
        if (!userRef) return;
        const uid = userRef.id;
        const prev = uidScores.get(uid) || { score: 0, samples: [] };
        prev.score += 1;
        if (prev.samples.length < 5) prev.samples.push(String(d.data()?.title || '').slice(0, 60));
        uidScores.set(uid, prev);
      });
    } catch (e) {
      console.warn(`collectionGroup probe failed for "${prefix}":`, e?.message || e);
    }
  }

  if (uidScores.size) {
    const hits = [...uidScores.entries()]
      .map(([uid, v]) => ({ uid, score: v.score, sampleTitles: v.samples }))
      .sort((a, b) => b.score - a.score);
    console.log('Matched accounts (from chat titles):');
    for (const h of hits.slice(0, 8)) {
      const userDoc = await db.collection('users').doc(h.uid).get();
      const email = userDoc.data()?.email || '';
      const name = userDoc.data()?.name || userDoc.data()?.displayName || '';
      console.log(`  ${h.uid}  score=${h.score}  ${email}  ${name}`);
      console.log(`    samples: ${h.sampleTitles.join(' | ')}`);
    }
    return hits[0].uid;
  }

  throw new Error(
    'Could not auto-detect account. Pass --uid or --email (e.g. --email you@gmail.com)',
  );
}

async function main() {
  const opts = parseArgs(process.argv);
  const init = tryInitializeFirebaseAdmin();
  if (!init.ok) {
    console.error('Firebase Admin failed:', init.error || init);
    process.exit(1);
  }
  const db = admin.firestore();
  const uid = await resolveUid(db, opts);
  console.log(`\nTarget uid: ${uid}${opts.apply ? ' (APPLY)' : ' (dry-run)'}\n`);

  // --- Workout plans ---
  const plansSnap = await db.collection('users').doc(uid).collection('workoutPlans').get();
  let planUpdates = 0;
  for (const docSnap of plansSnap.docs) {
    const data = docSnap.data() || {};
    const current = data.title || data.name || '';
    if (!looksLikeDefaultAiPlanName(current)) continue;
    const next = buildCreativeWorkoutPlanName(
      { ...data, structuredPlan: data.structuredPlan || null },
      docSnap.id,
    );
    console.log(`[plan] ${docSnap.id}: "${current}" → "${next}"`);
    planUpdates += 1;
    if (opts.apply) {
      await docSnap.ref.set({ title: next, name: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
  }

  const currentPlan = await db.collection('users').doc(uid).collection('workoutPlan').doc('current').get();
  if (currentPlan.exists) {
    const data = currentPlan.data() || {};
    const current = data.title || data.name || '';
    if (looksLikeDefaultAiPlanName(current)) {
      const next = buildCreativeWorkoutPlanName(data, 'current');
      console.log(`[current plan] "${current}" → "${next}"`);
      planUpdates += 1;
      if (opts.apply) {
        await currentPlan.ref.set(
          { title: next, name: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true },
        );
      }
    }
  }

  // --- AI chats ---
  const chatsSnap = await db.collection('users').doc(uid).collection('aiChats').get();
  let chatUpdates = 0;
  const usedTitles = new Set();
  for (const docSnap of chatsSnap.docs) {
    const data = docSnap.data() || {};
    const current = String(data.title || '').trim();
    if (!needsRetitle(current)) continue;
    let next =
      creativeChatTitleFromContext(
        current,
        data.lastUserMessage || '',
        data.lastAssistantMessage || '',
        docSnap.id,
      ) || pickFrom(['Coach Check-In', 'Quick Coaching Huddle', 'Progress Pulse', 'Form & Fuel Talk'], docSnap.id);

    // Avoid identical duplicates in the list
    if (usedTitles.has(next)) {
      const alts = [
        `${next} · Round 2`,
        `Follow-up: ${next}`,
        `${next} Revisited`,
        pickFrom(['Late-Night Coaching', 'Quick Form Check', 'Fuel Check-In', 'Recovery Reset'], `${docSnap.id}-alt`),
      ];
      next = alts.find((t) => !usedTitles.has(t)) || `${next} ${chatUpdates + 1}`;
    }
    usedTitles.add(next);

    console.log(`[chat] ${docSnap.id}: "${current.slice(0, 60)}" → "${next}"`);
    chatUpdates += 1;
    if (opts.apply) {
      await docSnap.ref.set(
        { title: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
  }

  console.log(`\nWould update ${planUpdates} plans and ${chatUpdates} chats.${opts.apply ? ' Applied.' : ' Re-run with --apply to write.'}`);
}

function needsRetitle(title) {
  const t = String(title || '').trim();
  if (isJunkChatTitle(t)) return true;
  if (/^calories chat$/i.test(t)) return true;
  if (/^fitness log$/i.test(t)) return true;
  if (/^body recomp$/i.test(t)) return true;
  if (/^body recomposition$/i.test(t)) return true;
  if (/sleep log$/i.test(t)) return true;
  if (/^protein intake$/i.test(t)) return true;
  if (/^skinny fat$/i.test(t)) return true;
  // Raw first-message titles (sentence fragments)
  if (t.length > 34) return true;
  if (/^(can u|can you|how much|how r |how ru|why am|given my|log my|do you|are you|what do|the how|the given)\b/i.test(t)) {
    return true;
  }
  return false;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
