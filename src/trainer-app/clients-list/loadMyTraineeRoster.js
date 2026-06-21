/**
 * client CRMService
 *
 * Purpose: Data/service layer: client CRMService. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/trainer
 * Key exports: getClient, createOrUpdateClient, syncClientDataFromUsers, removeClient, getTrainerClients, updateClient, addProgress, getProgressHistory
 *
 * @file-header
 */
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
function trainerApp() {
  return require('../../app-start/TrainerApp');
}

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
