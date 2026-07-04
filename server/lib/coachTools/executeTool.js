const admin = require('firebase-admin');
const { randomUUID } = require('crypto');
const { isoDateKey, serverTs } = require('../serverCommon');
const { mergeUserDailyMetrics } = require('../dailyMetricsServer');
const { executeDeleteLogServer } = require('../coachDeleteLog');
const { parseBookSessionFields, formatSessionLabel } = require('../bookSessionParse');
const { fetchOpenWorkoutPlanPayload } = require('../coachExtendedContext');
const logger = require('../logger');

async function executeTool(userId, toolCall) {
  const db = admin.apps.length ? admin.firestore() : null;
  if (!db) return { success: false, message: 'Firestore unavailable (Firebase Admin not initialized)' };
  if (!userId || typeof userId !== 'string') return { success: false, message: 'Invalid userId' };
  const name = toolCall?.name;
  const params = toolCall?.params || {};

  try {
    if (name === 'adjustMacroTargets') {
      const goalsSnap = await db.collection('nutrition_goals').doc(userId).get();
      const cur = goalsSnap.exists ? goalsSnap.data() || {} : {};

      const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
      };

      const protein =
        num(params?.protein ?? params?.newProtein) ??
        num(cur.protein_target) ??
        num(cur.protein) ??
        150;
      const carbs =
        num(params?.carbs ?? params?.newCarbs) ?? num(cur.carbs_target) ?? num(cur.carbs) ?? 200;
      const fat = num(params?.fat ?? params?.newFats) ?? num(cur.fat_target) ?? num(cur.fat) ?? 65;
      let calories = num(params?.calories ?? params?.newCals ?? params?.calorieTarget);
      if (calories == null) {
        calories = Math.round(protein * 4 + carbs * 4 + fat * 9);
      }

      const macroPayload = {
        protein,
        carbs,
        fat,
        calories,
        updatedAt: serverTs(),
        updatedBy: 'aiCoach',
      };

      await db
        .collection('users')
        .doc(userId)
        .collection('macroTargets')
        .doc('current')
        .set(macroPayload, { merge: true });

      await db.collection('nutrition_goals').doc(userId).set(
        {
          user_id: userId,
          protein_target: protein,
          carbs_target: carbs,
          fat_target: fat,
          calorie_target: calories,
          calories,
          updated_at: serverTs(),
        },
        { merge: true }
      );

      return {
        success: true,
        message: `Daily target updated to ${calories} kcal. Open Nutrition to see the new goal.`,
        data: { calories, protein, carbs, fat },
      };
    }

    if (name === 'logSleep') {
      const hours = Number(params?.hours ?? params?.sleepHours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 24) {
        return { success: false, message: 'Invalid sleep hours (use 0.5–24)' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        db
          .collection('users')
          .doc(userId)
          .collection('sleep_logs')
          .doc(dateKey)
          .set({ hours, date: dateKey, logged_at: serverTs() }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_sleep: hours }, tracking: { sleepHours: hours } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged ${hours} hours of sleep on your dashboard.`,
        data: { hours, date: dateKey },
      };
    }

    if (name === 'logWater') {
      const amount_oz = Number(params?.amount_oz);
      if (!Number.isFinite(amount_oz) || amount_oz <= 0) {
        return { success: false, message: 'Water amount must be greater than 0 ounces' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        db
          .collection('users')
          .doc(userId)
          .collection('water_logs')
          .doc(dateKey)
          .set({ amount_oz, date: dateKey, logged_at: serverTs() }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_water: String(amount_oz) }, tracking: { waterIntake: amount_oz } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged ${amount_oz}oz of water.`,
        data: { amount_oz, date: dateKey },
      };
    }

    if (name === 'logSteps') {
      const step_count = Number(params?.step_count);
      if (!Number.isFinite(step_count) || step_count < 0) {
        return { success: false, message: 'Step count must be 0 or greater' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        db
          .collection('users')
          .doc(userId)
          .collection('step_logs')
          .doc(dateKey)
          .set({ step_count, date: dateKey, logged_at: serverTs() }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_steps: step_count }, tracking: { steps: step_count } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged ${step_count} steps.`,
        data: { step_count, date: dateKey },
      };
    }

    if (name === 'rateEnergy') {
      const rating = Number(params?.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
        return { success: false, message: 'Energy rating must be between 1 and 10' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        // Write to new energy_logs collection
        db
          .collection('users')
          .doc(userId)
          .collection('energy_logs')
          .doc(dateKey)
          .set({
            rating,
            notes: String(params?.notes || '').trim(),
            date: dateKey,
            logged_at: serverTs(),
          }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          {
            logs: { dashboard_energy: rating },
            tracking: { energyLevel: String(rating) },
          },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged energy level: ${rating}/10.`,
        data: { rating, date: dateKey },
      };
    }

    if (name === 'logMood') {
      const mood = String(params?.mood || '').toLowerCase().trim();
      const validMoods = ['happy', 'okay', 'stressed', 'tired', 'anxious'];
      if (!validMoods.includes(mood)) {
        return { success: false, message: `Mood must be one of: ${validMoods.join(', ')}` };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await Promise.all([
        // Write to new mood_logs collection
        db
          .collection('users')
          .doc(userId)
          .collection('mood_logs')
          .doc(dateKey)
          .set({
            mood,
            notes: String(params?.notes || '').trim(),
            date: dateKey,
            logged_at: serverTs(),
          }, { merge: true }),
        mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          { logs: { dashboard_mood: mood }, tracking: { mood } },
          serverTs,
        ),
      ]);
      return {
        success: true,
        message: `Logged mood: ${mood}.`,
        data: { mood, date: dateKey },
      };
    }

    if (name === 'rateWorkout') {
      const notes = String(params?.notes || params?.note || '').toLowerCase();
      const rating = Number(params?.rating);
      if (
        /\brest\s*day\b/.test(notes) ||
        /\bno\s+workout\b/.test(notes) ||
        rating === 0 ||
        !Number.isFinite(rating) ||
        rating < 1
      ) {
        const dateKey = String(params?.date || isoDateKey()).trim();
        await mergeUserDailyMetrics(
          db,
          userId,
          dateKey,
          {
            logs: {
              dashboard_workout_name: 'Rest day',
              dashboard_workouts: 'Rest day',
              workoutLog: [],
            },
            tracking: {
              workoutName: 'Rest day',
              workoutSummary: 'Rest day',
              workoutExercises: [],
            },
          },
          serverTs,
        );
        return {
          success: true,
          message: `Rest day logged for ${dateKey}. Check your dashboard workout card.`,
          data: { date: dateKey },
        };
      }
      if (!Number.isFinite(rating) || rating < 1 || rating > 10) {
        return { success: false, message: 'Workout rating must be between 1 and 10' };
      }
      const dateKey = String(params?.date || isoDateKey()).trim();
      await db
        .collection('users')
        .doc(userId)
        .collection('workout_ratings')
        .doc(dateKey)
        .set({
          rating,
          notes: String(params?.notes || '').trim(),
          date: dateKey,
          logged_at: serverTs(),
        }, { merge: true });
      return {
        success: true,
        message: `Logged workout rating: ${rating}/10.`,
        data: { rating, date: dateKey },
      };
    }

    if (name === 'logRestDay') {
      const dateKey = String(params?.date || isoDateKey()).trim();
      await mergeUserDailyMetrics(
        db,
        userId,
        dateKey,
        {
          logs: {
            dashboard_workout_name: 'Rest day',
            dashboard_workouts: 'Rest day',
            workoutLog: [],
          },
          tracking: {
            workoutName: 'Rest day',
            workoutSummary: 'Rest day',
            workoutExercises: [],
          },
        },
        serverTs,
      );
      return {
        success: true,
        message: `Rest day logged for ${dateKey}. Check your dashboard workout card.`,
        data: { date: dateKey },
      };
    }

    if (name === 'deleteLog') {
      return executeDeleteLogServer(db, userId, params, serverTs, isoDateKey);
    }

    if (name === 'logNutrition') {
      const foodName = String(params?.foodName || params?.food || '').trim();
      if (!foodName) return { success: false, message: 'Missing foodName' };

      let cals = Number(params?.calories ?? params?.cals);
      let p = Number(params?.protein);
      let c = Number(params?.carbs);
      let f = Number(params?.fat ?? params?.fats);

      if (!Number.isFinite(cals) || cals <= 0) {
        const manualMsg = `I couldn't look up nutrition data for "${foodName}". Please log this manually in the nutrition tab for accurate tracking.`;
        const apiKey = process.env.USDA_API_KEY;
        if (!apiKey) {
          return { success: false, message: manualMsg };
        }
        const r = await fetchWithTimeout(
          `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(foodName)}&pageSize=1&api_key=${apiKey}`,
          {},
          8000
        );
        if (!r.ok) return { success: false, message: manualMsg };
        const data = await r.json();
        const item = (data.foods || [])[0];
        if (!item) return { success: false, message: manualMsg };
        const nutrients = item.foodNutrients || [];
        const get = (id) => nutrients.find((n) => n.nutrientId === id)?.value || 0;
        cals = Number(get(1008)) || 0;
        p = Number(get(1003)) || 0;
        c = Number(get(1005)) || 0;
        f = Number(get(1004)) || 0;
        if (!Number.isFinite(cals) || cals <= 0) {
          return { success: false, message: manualMsg };
        }
      }

      const todayKey = String(params?.date || isoDateKey()).trim();
      const mealType = String(params?.mealType || 'snack').toLowerCase();
      await db.collection('nutrition_logs').add({
        user_id: userId,
        date: todayKey,
        meal_type: mealType,
        food_name: foodName,
        brand: '',
        serving_size: 1,
        serving_grams: 100,
        calories: Math.round(cals),
        protein: Math.round(p * 10) / 10,
        carbs: Math.round(c * 10) / 10,
        fat: Math.round(f * 10) / 10,
        fiber: 0,
        sugar: 0,
        sodium: 0,
        potassium: 0,
        source: 'aiCoach',
        created_at: serverTs(),
      });

      return {
        success: true,
        message: `Logged ${foodName} (${Math.round(cals)} cal). Your dashboard will update shortly.`,
      };
    }

    if (name === 'bookSession') {
      const trainerId = String(params?.trainerId || '').trim();
      if (!trainerId) {
        return {
          success: false,
          message: 'Connect with a trainer in the app first — then I can request a session for you.',
        };
      }
      const { date, time, durationMin } = parseBookSessionFields(params);
      if (!date || !time) {
        return {
          success: false,
          message: 'Tell me the date and time (e.g. "next Tuesday at 10am") so I can request the session.',
        };
      }
      const sessionRef = db.collection(`trainer_clients/${trainerId}/sessions`).doc();
      await sessionRef.set(
        {
          clientId: userId,
          trainerId,
          date,
          time,
          durationMin,
          duration: durationMin,
          status: 'pending',
          notes: String(params?.notes || '').trim() || 'Requested via AI Coach',
          createdAt: serverTs(),
          updatedAt: serverTs(),
          createdBy: 'aiCoach',
        },
        { merge: true }
      );
      const label = formatSessionLabel({ date, time });
      return {
        success: true,
        message: `Session request sent for ${label}. Your trainer will confirm it — check Home for pending invites.`,
        data: { sessionId: sessionRef.id, date, time },
      };
    }

    if (name === 'updateGoal') {
      const newGoal = String(params?.newGoal || '').trim();
      if (!newGoal) return { success: false, message: 'Missing newGoal' };
      await db.collection('users').doc(userId).set({ goal: newGoal, updatedAt: serverTs() }, { merge: true });
      return { success: true, message: `Goal changed to ${newGoal}` };
    }

    if (name === 'notifyTrainer') {
      const trainerId = String(params?.trainerId || '').trim();
      const message = String(params?.message || '').trim();
      if (!trainerId) return { success: false, message: 'Missing trainerId' };
      if (!message) return { success: false, message: 'Missing message' };
      const clientSnap = await db.collection('users').doc(userId).get();
      const clientName =
        clientSnap.exists
          ? clientSnap.data()?.firstName || clientSnap.data()?.name || 'Client'
          : 'Client';
      const severity = String(params?.severity || 'medium').toLowerCase();
      const issueType = String(params?.issueType || 'check_in').trim();
      const alertId = randomUUID();
      await db
        .collection('users')
        .doc(trainerId)
        .collection('alerts')
        .doc(alertId)
        .set(
          {
            type: 'client_alert',
            clientId: userId,
            clientName,
            message,
            issueType,
            severity,
            createdAt: serverTs(),
            read: false,
            source: 'aiCoach',
          },
          { merge: true }
        );
      await createAlert(trainerId, {
        type: 'client_alert',
        title: `Message from ${clientName}`,
        body: message,
        priority: severity === 'high' ? 'high' : severity === 'low' ? 'low' : 'medium',
      });
      return { success: true, message: 'Your trainer has been notified.' };
    }

    if (name === 'openWorkoutPlan') {
      const planId = String(params?.planId || params?.currentPlanId || 'current').trim() || 'current';
      const payload = await fetchOpenWorkoutPlanPayload(db, userId, planId);
      if (!payload) {
        return {
          success: false,
          message: 'No workout plan found yet. Generate one under Workout → AI Plans first.',
        };
      }
      const parts = [`Opening **${payload.title}**.`];
      const programText =
        payload.summary ||
        payload.allDaysPreview ||
        payload.todayPreview ||
        '';
      if (programText) {
        parts.push(
          `Saved program (cite ONLY these exercises — never invent others):\n${String(programText).slice(0, 22000)}`,
        );
      }
      return {
        success: true,
        message: parts.join('\n\n'),
        data: payload,
      };
    }

    if (name === 'updateWorkout') {
      const planId = String(params?.planId || params?.currentPlanId || 'current').trim();
      const dayIndex = Number(params?.dayIndex ?? params?.dayIdx ?? 0);
      const exerciseIndex = Number(params?.exerciseIndex ?? params?.exerciseIdx ?? 0);
      const newName = String(
        params?.newExercise?.name || params?.newExercise || params?.exerciseName || ''
      ).trim();
      if (!newName) return { success: false, message: 'Missing new exercise name' };

      const planRef = db.collection('users').doc(userId).collection('workoutPlans').doc(planId);
      const planSnap = await planRef.get();
      if (!planSnap.exists) return { success: false, message: 'Workout plan not found' };
      const plan = planSnap.data() || {};
      const rawText = plan.rawPlan || plan.planText || '';
      let structured =
        plan.structuredPlan && typeof plan.structuredPlan === 'object'
          ? { ...plan.structuredPlan }
          : {};

      let rawParsed = null;
      try {
        rawParsed = rawText && String(rawText).trim().startsWith('{') ? JSON.parse(rawText) : null;
      } catch (_) {
        rawParsed = null;
      }

      let planDays = [];
      if (Array.isArray(structured.plan) && structured.plan.length) planDays = structured.plan.slice();
      else if (Array.isArray(structured.workoutPlan) && structured.workoutPlan.length) {
        planDays = structured.workoutPlan.slice();
      } else if (Array.isArray(rawParsed?.plan) && rawParsed.plan.length) planDays = rawParsed.plan.slice();
      else if (Array.isArray(rawParsed?.workoutPlan) && rawParsed.workoutPlan.length) {
        planDays = rawParsed.workoutPlan.slice();
      } else if (Array.isArray(structured.days) && structured.days.length) {
        planDays = structured.days.slice();
      }

      while (planDays.length <= dayIndex) {
        planDays.push({ day: `Day ${planDays.length + 1}`, exercises: [] });
      }
      const day = { ...planDays[dayIndex], exercises: [...(planDays[dayIndex]?.exercises || [])] };
      while (day.exercises.length <= exerciseIndex) {
        day.exercises.push({ name: 'Exercise' });
      }
      const prev = day.exercises[exerciseIndex] || {};
      day.exercises[exerciseIndex] = {
        ...prev,
        name: newName,
        exerciseName: newName,
        modifiedBy: 'aiCoach',
        modifiedAt: new Date().toISOString(),
        modificationReason: String(params?.reason || '').trim() || null,
      };
      planDays[dayIndex] = day;
      structured = { ...structured, plan: planDays, workoutPlan: planDays };

      await planRef.set(
        {
          structuredPlan: structured,
          updatedAt: serverTs(),
          lastModifiedBy: 'aiCoach',
        },
        { merge: true }
      );
      await db
        .collection('users')
        .doc(userId)
        .collection('workoutPlan')
        .doc('current')
        .set({ structuredPlan: structured, updatedAt: serverTs() }, { merge: true })
        .catch(() => {});
      return { success: true, message: `Updated exercise to ${newName}` };
    }

    return { success: false, message: `Unknown tool: ${name}` };
  } catch (e) {
    console.error(`[executeTool] ${name} failed:`, e?.message || e);
    return { success: false, message: 'Tool execution failed', data: { error: e?.message || String(e) } };
  }
}


module.exports = { executeTool };
