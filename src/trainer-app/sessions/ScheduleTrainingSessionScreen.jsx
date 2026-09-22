// Compatibility shim only — the real schedule-a-session screen lives in the trainer screens folder.
// Flow: anything still importing from this path gets forwarded to the current implementation.
// Note: nothing new should import this. Point new code at ../screens/ScheduleTrainingSessionScreen.

/**
 * @deprecated Import from `../screens/ScheduleTrainingSessionScreen` instead.
 */
export { default, ScheduleTrainingSessionScreen } from '../screens/ScheduleTrainingSessionScreen';
