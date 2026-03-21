# Refactoring Guide for PremiumHomeScreen.js and DashboardScreen.js

This document outlines the complete refactoring changes needed for both components to replace hardcoded data with Firebase queries.

## Components to Refactor

1. **PremiumHomeScreen.js** - Replace hardcoded stats (lines 344-373)
2. **DashboardScreen.js** - Replace all fake data (lines 17-37)

## Key Changes Needed

### PremiumHomeScreen.js

1. **Add Firebase imports**:
   - `auth` from `'../../extra/api/config'`
   - `getActiveWorkout` from `'../../workouts/api/workoutService'`
   - `fetchWorkoutHistory` from `'../../workouts/api/workoutService'`
   - `getFoodLogsForDate`, `getDailyGoals`, `calculateMacroTotals` from `'../../extra/api/nutritionService'`
   - `getTrainerClients` from `'../../extra/api/clientCRMService'`
   - `fetchWorkoutTemplates` from `'../../workouts/api/workoutService'`
   - `collection`, `query`, `where`, `getDocs` from `'firebase/firestore'`
   - `db` from `'../../extra/api/config'`

2. **Add state for fetched data**:
   - `activeWorkout`
   - `calorieGoal`
   - `caloriesBurned`
   - `streak`
   - `trainerClients`
   - `workoutTemplates`
   - `loading`

3. **Add useEffect hooks to fetch data**:
   - Fetch active workout
   - Fetch calorie goal
   - Fetch today's calories (from props or fetch)
   - Calculate streak from completed workouts
   - For trainers: fetch client count
   - Fetch workout templates count

4. **Helper function to calculate streak**:
   ```javascript
   const calculateStreak = (completedWorkouts) => {
     // Calculate consecutive days with completed workouts
     // Starting from today, count backwards
   }
   ```

### DashboardScreen.js

1. **Add Firebase imports**:
   - `auth` from `'../../extra/api/config'`
   - `doc`, `getDoc` from `'firebase/firestore'`
   - `db` from `'../../extra/api/config'`
   - `getActiveWorkout` from `'../../workouts/api/workoutService'`
   - `fetchWorkoutHistory` from `'../../workouts/api/workoutService'`
   - `getFoodLogsForDate`, `getDailyGoals`, `calculateMacroTotals` from `'../../extra/api/nutritionService'`

2. **Add state for fetched data**:
   - `userProfile`
   - `streak`
   - `todayCalories`
   - `calorieGoal`
   - `activeWorkout`
   - `recentMeals`
   - `loading`

3. **Add useEffect hooks to fetch data**:
   - Fetch user profile (weight, goal)
   - Calculate streak
   - Fetch today's calories
   - Fetch calorie goal
   - Fetch active workout
   - Fetch recent meals

## Implementation Notes

- Both components already receive some data via props (e.g., `todaysCalories`, `todaysWorkouts` in PremiumHomeScreen)
- Keep existing UI/styling intact
- Add loading states where appropriate
- Handle errors gracefully with default values
- For streak calculation, use completed workouts and count consecutive days from today backwards


