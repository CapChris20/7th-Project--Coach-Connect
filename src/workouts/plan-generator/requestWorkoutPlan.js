/**
 * workout Plan Api
 *
 * Purpose: UI screen or component: workout Plan Api. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/workouts
 * Key exports: requestWorkoutPlanFromApi, loadOnboardingAndPlanArtifacts, generateWorkoutPlanWithClaude
 *
 * @file-header
 */
import { auth, db } from '../../app-start/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { getCurrentWorkoutPlan } from '../active-workout/workoutService';
import { getApiAuthHeaders } from '../../shared/api/getAuthHeaders';
import { getWorkoutGenerationApiBases } from '../../shared/api/baseUrl';
import { postJsonWithTimeout, logApiAttempt } from '../../shared/api/apiFetch';
import { formatWorkoutLimitResetLabel } from '../plan-generator/trackWorkoutGenerationUsage';

const WORKOUT_PLAN_FETCH_TIMEOUT_MS = 180000;

import { buildWorkoutOnboardingPayload } from './workoutOnboardingPayload';

export async function requestWorkoutPlanFromApi(onboardingData, subjectUserId) {
  const headers = await getApiAuthHeaders({ 'Content-Type': 'application/json' });
  if (!headers.Authorization) {
    throw new Error('Sign in to generate a workout plan.');
  }

  const bases = getWorkoutGenerationApiBases();
  const body = {
    onboardingData: buildWorkoutOnboardingPayload(onboardingData),
    subjectUserId: subjectUserId || auth.currentUser?.uid,
  };

  if (__DEV__) {
    console.log('[workout] generate plan - trying API bases:', bases.slice(0, 6).join(' -> '));
  }

  let lastErr = null;
  for (const base of bases) {
    const url = `${String(base).replace(/\/$/, '')}/api/workout/generate`;
    try {
      const res = await postJsonWithTimeout(url, body, headers, WORKOUT_PLAN_FETCH_TIMEOUT_MS);
      const payload = await res.json().catch(() => ({}));
      if (res.status === 429 && payload?.error === 'monthly_limit_reached') {
        const err = new Error(
          payload.message ||
            `You've used all your workout generations for this month. Resets ${formatWorkoutLimitResetLabel(payload.resets_at)}.`
        );
        err.code = 'monthly_limit_reached';
        err.limitPayload = payload;
        throw err;
      }
      if (!res.ok) {
        const err = new Error(payload?.message || payload?.error || `Request failed (${res.status})`);
        err.httpStatus = res.status;
        // Stale Cloud Run revision or server down — try next base (e.g. local npm run server).
        const retryable = [404, 502, 503, 504].includes(res.status);
        if (retryable) {
          logApiAttempt('workout/generate', url, err);
          lastErr = err;
          continue;
        }
        err.fromHttpResponse = true;
        throw err;
      }
      if (!payload?.text) {
        throw new Error('Empty response from workout generator');
      }
      if (__DEV__) {
        console.log('[workout] generate plan OK via', base);
      }
      return {
        text: String(payload.text),
        usage: payload.usage ?? null,
      };
    } catch (e) {
      logApiAttempt('workout/generate', url, e);
      if (e?.code === 'monthly_limit_reached') throw e;
      if (e?.code === 'timeout') throw e;
      if (e?.fromHttpResponse) throw e;
      lastErr = e;
    }
  }

  const tried = bases.slice(0, 6).join(', ');
  const msg = String(lastErr?.message || '');
  const hint = msg.includes('timed out')
    ? 'The server took too long. Try again on Wi-Fi.'
    : msg.includes('404') || lastErr?.httpStatus === 404
      ? 'Workout API missing on Cloud Run (stale deploy). Run: npm run server — or redeploy with ./server/deploy.sh'
      : msg.includes('AI provider unavailable')
        ? 'Workout generation needs ANTHROPIC_API_KEY on Cloud Run. Add it to .env, then run: ./scripts/syncCloudRunEnv.sh'
        : 'Could not reach the workout API. Check internet, then reload with: npm start (dev build).';
  throw lastErr || new Error(`${hint}${tried ? ` Tried: ${tried}` : ''}`);
}

export async function loadOnboardingAndPlanArtifacts({ userId, propPlan } = {}) {
  const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
  if (!subjectUid) {
    throw new Error('User not found');
  }
  let onboardingData = null;
  if (db) {
    const userSnap = await getDoc(doc(db, 'users', subjectUid));
    if (userSnap.exists()) onboardingData = userSnap.data();
  }
  if (!onboardingData) {
    const cached = await AsyncStorage.getItem(`onboarding_data_${subjectUid}`);
    if (cached) onboardingData = JSON.parse(cached);
  }
  let plan = propPlan || null;
  if (!plan) {
    plan = await getCurrentWorkoutPlan(subjectUid);
  }
  return { onboardingData, plan };
}

export async function generateWorkoutPlanWithClaude({ onboardingData, userId }) {
  const subjectUid = (userId && String(userId).trim()) || auth.currentUser?.uid;
  const { text, usage } = await requestWorkoutPlanFromApi(onboardingData, subjectUid);
  return {
    planText: text,
    generatedAt: Date.now(),
    userData: onboardingData,
    usage,
  };
}
