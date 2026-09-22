// Re-export surface for the trainer's client-CRM Firestore helpers (clients, notes, tasks, progress).
// Flow: caller imports from here → we lazily require the real implementations at call time.
// Note: the actual functions live in the trainer app-start module (search: "CLIENT CRM SERVICE").
//   The lazy require below is the whole point of this file — see the comment on trainerApp().

/**
 * Trainer client CRM — Firestore helpers.
 *
 * Implementation lives in `src/app-start/TrainerApp.js` (search: "CLIENT CRM SERVICE").
 * This file re-exports the same API for hooks/screens that import from here.
 *
 * Uses lazy `require()` so we never create a static cycle:
 * TrainerApp → useTrainerClients → this module → TrainerApp (unfinished),
 * which can surface as `ReferenceError: AppNavigationProvider doesn't exist` and similar.
 */
// vocab: require() = CommonJS import that runs the moment it's CALLED, unlike `import` which is
// hoisted and resolved before the file body runs. Deferring it means by the time any function
// below actually executes, the trainer module has finished evaluating — so the circular
// dependency never observes a half-initialized module.
function trainerApp() {
  return require('../../app-start/TrainerApp');
}

// Every line is the same shape: forward the call and every argument to the real implementation.
// vocab/symbol: ...args = collect all arguments into an array, then spread them back out — this
// keeps each wrapper signature-agnostic, so adding a parameter upstream needs no change here.
// Manipulate here: to expose another CRM helper, add one matching line; don't add real logic in
// this file — it's intentionally a pass-through so behavior has exactly one home.
export const getClient = (...args) => trainerApp().getClient(...args);
export const createOrUpdateClient = (...args) => trainerApp().createOrUpdateClient(...args);
export const syncClientDataFromUsers = (...args) => trainerApp().syncClientDataFromUsers(...args);
export const removeClient = (...args) => trainerApp().removeClient(...args);
export const getTrainerClients = (...args) => trainerApp().getTrainerClients(...args);
export const updateClient = (...args) => trainerApp().updateClient(...args);
export const addProgress = (...args) => trainerApp().addProgress(...args);
export const getProgressHistory = (...args) => trainerApp().getProgressHistory(...args);
export const deleteProgress = (...args) => trainerApp().deleteProgress(...args);
export const createTask = (...args) => trainerApp().createTask(...args);
export const getTasks = (...args) => trainerApp().getTasks(...args);
export const updateTask = (...args) => trainerApp().updateTask(...args);
export const toggleTaskComplete = (...args) => trainerApp().toggleTaskComplete(...args);
export const deleteTask = (...args) => trainerApp().deleteTask(...args);
export const createNote = (...args) => trainerApp().createNote(...args);
export const getNotes = (...args) => trainerApp().getNotes(...args);
export const updateNote = (...args) => trainerApp().updateNote(...args);
export const deleteNote = (...args) => trainerApp().deleteNote(...args);
export const getWeightTrend = (...args) => trainerApp().getWeightTrend(...args);
export const getTaskStats = (...args) => trainerApp().getTaskStats(...args);
export const getClientAnalytics = (...args) => trainerApp().getClientAnalytics(...args);
export const checkWeeklyDataAvailability = (...args) => trainerApp().checkWeeklyDataAvailability(...args);
