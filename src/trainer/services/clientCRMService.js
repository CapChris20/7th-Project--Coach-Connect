/**
 * Trainer client CRM — Firestore helpers.
 *
 * Implementation is merged into `src/app/TrainerApp.js` (search: "CLIENT CRM SERVICE")
 * so you can review CRM + UI wiring in one place. This file re-exports the same API
 * for screens/hooks that already import from here.
 */
export {
  getClient,
  createOrUpdateClient,
  syncClientDataFromUsers,
  removeClient,
  getTrainerClients,
  updateClient,
  addProgress,
  getProgressHistory,
  deleteProgress,
  createTask,
  getTasks,
  updateTask,
  toggleTaskComplete,
  deleteTask,
  createNote,
  getNotes,
  updateNote,
  deleteNote,
  getWeightTrend,
  getTaskStats,
  getClientAnalytics,
  checkWeeklyDataAvailability,
} from '../../app/TrainerApp';
