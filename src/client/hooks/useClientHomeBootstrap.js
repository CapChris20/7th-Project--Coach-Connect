import { useEffect, useRef } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { getLocalDateKey } from '../../shared/utils/localDay';
import { parseDailyMetricsFromSnapshots } from '../../shared/services/dailyMetricsService';
import { calculateMacroTotals, getDailyGoals, getFoodLogsForDate } from '../../nutrition/services/nutritionService';
import { fetchWorkoutHistory, getActiveWorkout } from '../../workouts/services/workoutService';
import { calculateStreak } from '../components/home/clientHomeComponents';

/**
 * Initial home dashboard Firestore fetch (user doc, goals, nutrition, workouts).
 */
export function useClientHomeBootstrap({
  user,
  db,
  isFetching,
  setLoading,
  setLoadingStartTime,
  setOnboardingData,
  setUserWeight,
  setGoalProgress,
  setCalorieGoal,
  setWaterIntake,
  setSleepHours,
  setSoreness,
  setEnergyLevel,
  setStressLevel,
  setDashboardWorkoutSummary,
  setTodayWorkout,
  setCaloriesConsumed,
  setMacroTotals,
  setNutritionGoals,
  setStreak,
  setWorkoutCount,
  setCaloriesBurned,
}) {
  // Fetch home screen data
  useEffect(() => {
    const startTime = Date.now();
    console.log(`🚀 Starting data fetch for user: ${user?.uid} at ${new Date().toISOString()}`);
    
    // Prevent duplicate calls
    if (isFetching.current) {
      console.log(`⚠️ Already fetching data, skipping... (${(Date.now() - startTime)}ms)`);
      return;
    }
    
    const fetchData = async () => {
      isFetching.current = true;
      
      if (!user?.uid || !db) {
        console.log(`❌ No user or db, setting loading false (${(Date.now() - startTime)}ms)`);
        setLoading(false);
        isFetching.current = false;
        return;
      }

      // Force loading to complete after 10 seconds as backup
      const timeout = setTimeout(() => {
        console.log(`⏰ TIMEOUT: Forcing loading to complete due to timeout (${(Date.now() - startTime)}ms)`);
        setLoading(false);
      }, 10000);

      try {
        console.log(`📥 Setting loading to true (${(Date.now() - startTime)}ms)`);
        setLoadingStartTime(Date.now());
        setLoading(true);
        
        // RESTORE: Get user data first (most important)
        console.log(`👤 Fetching user data... (${(Date.now() - startTime)}ms)`);
        console.log(`🔍 Firebase check - db exists: ${!!db}, user.uid: ${user?.uid}`);
        
        let userDoc;
        try {
          const userRef = doc(db, 'users', user.uid);
          console.log(`📍 User ref path: ${userRef.path}`);
          
          userDoc = await Promise.race([
            getDoc(userRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error('User data timeout')), 8000))
          ]);
          console.log(`✅ User data fetched in ${Date.now() - startTime}ms`);
        } catch (error) {
          console.error(`❌ User data fetch failed: ${error.message}`);
          console.error(`🔍 Error details:`, {
            errorMessage: error.message,
            errorCode: error.code,
            errorStack: error.stack?.substring(0, 200),
            dbExists: !!db,
            userUid: user?.uid,
            timestamp: new Date().toISOString()
          });
          // Continue with empty user data rather than failing completely
          // Keep snapshot-like shape so downstream code can safely call exists()/data().
          userDoc = {
            exists: () => false,
            data: () => null,
          };
        }
        
        // Process user data (even if failed, set defaults to prevent infinite loading)
        if (userDoc && userDoc.exists()) {
          const userDocData = userDoc.data();
          setOnboardingData(userDocData);
          setUserWeight(userDocData.weight);
          setGoalProgress(typeof userDocData.goalProgress === 'number' ? userDocData.goalProgress : null);
          
          const storedCalories = userDocData.calorieTarget ?? userDocData.calorie_target ?? userDocData.nutrition?.calories;
          if (typeof storedCalories === 'number' && storedCalories > 0) {
            setCalorieGoal(Math.round(storedCalories));
          }
          console.log(`✅ User data processed (${(Date.now() - startTime)}ms)`);
        } else {
          console.log(`⚠️ No user data found, using defaults (${(Date.now() - startTime)}ms)`);
          // Set default values to prevent UI issues
          setOnboardingData({});
          setUserWeight(null);
          setGoalProgress(null);
          setCalorieGoal(2000); // Default calorie goal
        }

        // RESTORE: Get nutrition goals
        console.log(`🥗 Fetching nutrition goals... (${(Date.now() - startTime)}ms)`);
        try {
          const goalsDoc = await Promise.race([
            getDoc(doc(db, 'nutrition_goals', user.uid)),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Nutrition goals timeout')), 5000))
          ]);
          
          if (goalsDoc.exists()) {
            const goalsData = goalsDoc.data();
            const goalCal =
              typeof goalsData?.calorie_target === 'number'
                ? goalsData.calorie_target
                : typeof goalsData?.calories === 'number'
                  ? goalsData.calories
                  : null;
            if (goalCal != null && goalCal > 0) {
              setCalorieGoal(Math.round(goalCal));
            }
            console.log(`✅ Nutrition goals processed (${(Date.now() - startTime)}ms)`);
          }
        } catch (e) {
          console.log(`⚠️ Nutrition goals failed, continuing...`);
        }

        // RESTORE: Today's daily metrics (dailyLogs canonical; tracking legacy fallback)
        console.log(`📊 Fetching daily metrics... (${(Date.now() - startTime)}ms)`);
        try {
          const todayKey = getLocalDateKey();
          const timeout = (label) =>
            new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), 5000));
          const [logsDoc, trackingDoc] = await Promise.all([
            Promise.race([getDoc(doc(db, 'users', user.uid, 'dailyLogs', todayKey)), timeout('Daily logs')]),
            // TODO(phase-5): remove legacy daily_tracking read after backfill
            Promise.race([
              getDoc(doc(db, 'users', user.uid, 'daily_tracking', todayKey)),
              timeout('Daily tracking'),
            ]).catch(() => ({ exists: () => false })),
          ]);
          const parsed = parseDailyMetricsFromSnapshots(logsDoc, trackingDoc);
          setWaterIntake(parsed.waterIntake);
          setSleepHours(parsed.sleepHours);
          setSoreness(parsed.soreness);
          setEnergyLevel(parsed.energyLevel);
          setStressLevel(parsed.stressLevel);
          setDashboardWorkoutSummary(parsed.dashboardWorkoutSummary);
          setTodayWorkout(parsed.todayWorkout);
          console.log(`✅ Daily metrics processed (${(Date.now() - startTime)}ms)`);
        } catch (e) {
          console.log(`⚠️ Daily metrics failed, continuing...`);
        }

        // RESTORE: Get nutrition logs
        console.log(`🍎 Fetching nutrition logs... (${(Date.now() - startTime)}ms)`);
        try {
          const nutritionLogs = await Promise.race([
            getFoodLogsForDate(user.uid, getLocalDateKey()),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Nutrition logs timeout')), 6000))
          ]);
          
          const totals = calculateMacroTotals(nutritionLogs);
          setCaloriesConsumed(totals.calories || 0);
          setMacroTotals({
            protein: totals.protein || 0,
            carbs: totals.carbs || 0,
            fats: totals.fat || 0 // Fix: nutrition service returns 'fat' not 'fats'
          });
          console.log(`✅ Nutrition logs processed (${(Date.now() - startTime)}ms)`);
          console.log(`🍎 Macro totals - Protein: ${totals.protein}g, Carbs: ${totals.carbs}g, Fat: ${totals.fat}g`);
        } catch (e) {
          console.log(`⚠️ Nutrition logs failed, continuing...`);
        }

        // Get nutrition goals for proper progress calculation
        console.log(`🎯 Fetching nutrition goals... (${(Date.now() - startTime)}ms)`);
        try {
          const goals = await getDailyGoals(user.uid);
          setNutritionGoals(goals);
          console.log(`✅ Nutrition goals loaded:`, goals);
          console.log(`🎯 Goals breakdown - Protein: ${goals.proteinTarget}g, Carbs: ${goals.carbsTarget}g, Fat: ${goals.fatTarget}g`);
        } catch (e) {
          console.log(`⚠️ Nutrition goals failed, using defaults...`);
          const defaultGoals = { proteinTarget: 150, carbsTarget: 220, fatTarget: 70 };
          setNutritionGoals(defaultGoals);
          console.log(`🎯 Using default goals - Protein: ${defaultGoals.proteinTarget}g, Carbs: ${defaultGoals.carbsTarget}g, Fat: ${defaultGoals.fatTarget}g`);
        }

        // RESTORE: Get workout history
        console.log(`💪 Fetching workout history... (${(Date.now() - startTime)}ms)`);
        try {
          const completedWorkouts = await Promise.race([
            fetchWorkoutHistory(user.uid, 20),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Workout history timeout')), 6000))
          ]);
          
          const workouts = completedWorkouts;
          const calculatedStreak = calculateStreak(workouts);
          setStreak(calculatedStreak);
          setWorkoutCount(workouts.length);

          const todayWorkouts = workouts.filter(w => {
            const workoutDate = w.completedAt?.toDate?.() || new Date(w.completedAt);
            return workoutDate.toISOString().split('T')[0] === getLocalDateKey();
          });
          
          const burned = todayWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);
          setCaloriesBurned(burned);
          console.log(`✅ Workout history processed (${(Date.now() - startTime)}ms)`);
        } catch (e) {
          console.log(`⚠️ Workout history failed, continuing...`);
        }

        // RESTORE: Get active workout
        console.log(`🎯 Fetching active workout... (${(Date.now() - startTime)}ms)`);
        try {
          const activeWorkout = await getActiveWorkout(user.uid);
          if (activeWorkout) {
            setTodayWorkout({
              name: activeWorkout.workoutName || 'Active Workout',
              exercises: activeWorkout.exercises?.length || 0,
              duration: activeWorkout.duration || 0,
              progress: 0,
            });
            console.log(`✅ Active workout processed (${(Date.now() - startTime)}ms)`);
          }
        } catch (e) {
          console.log(`⚠️ Active workout failed, continuing...`);
        }

        console.log(`⚡ All dashboard data loaded successfully`);
        
      } catch (error) {
        console.error(`❌ Error fetching data: ${error.message} (${(Date.now() - startTime)}ms)`);
      } finally {
        const totalTime = Date.now() - startTime;
        console.log(`🏁 Setting loading to false - TOTAL TIME: ${totalTime}ms`);
        clearTimeout(timeout);
        setLoading(false);
        isFetching.current = false;
      }
    };
    
    fetchData();
  }, [user?.uid, db]);

}
