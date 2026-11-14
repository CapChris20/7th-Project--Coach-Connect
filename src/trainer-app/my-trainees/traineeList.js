// Thin CRM re-export: every client / note / task / progress name used elsewhere in the app.
// Flow: frozen name list → one lazy forwarder per name → require TrainerAppStart only when called.
// Used by inbox, chat, document sharing, and trainer listings. Export letters must match TrainerAppStart.
// Why require (not import): a static import would cycle while TrainerAppStart is still loading this file.

// ===== NAMED CONSTANTS =====

// Every CRM name we forward. Letters must match TrainerAppStart exports exactly — do not rename.
const TRAINEE_CRM_FUNCTION_NAMES = [
  'getClient',
  'createOrUpdateClient',
  'syncClientDataFromUsers',
  'removeClient',
  'getTrainerClients',
  'updateClient',
  'addProgress',
  'getProgressHistory',
  'deleteProgress',
  'createTask',
  'getTasks',
  'updateTask',
  'toggleTaskComplete',
  'deleteTask',
  'createNote',
  'getNotes',
  'updateNote',
  'deleteNote',
  'getWeightTrend',
  'getTaskStats',
  'getClientAnalytics',
  'checkWeeklyDataAvailability',
];

// ===== HELPER FUNCTIONS =====

/**
 * Build one exported forwarder for a CRM function name.
 * @param {string} crmFunctionName
 * @returns {(...args: any[]) => *}
 */
function makeLazyCrmForwarder(crmFunctionName) {
  return (...forwardedArguments) => {
    return callNamedCrmFunction(crmFunctionName, forwardedArguments);
  };
}

/**
 * Forward every argument to the named CRM function on TrainerAppStart.
 * vocab: Function.apply = call with an explicit `this` + argument list (same as module.getClient(...)).
 * @param {string} crmFunctionName
 * @param {Array} forwardedArguments
 * @returns {*}
 */
function callNamedCrmFunction(crmFunctionName, forwardedArguments) {
  const trainerAppModule = loadTrainerAppModuleOnceCalled();
  const clientFunction = trainerAppModule[crmFunctionName];
  return clientFunction.apply(trainerAppModule, forwardedArguments);
}

/**
 * Lazy-load TrainerAppStart only when a CRM call actually happens.
 * vocab: require() = CommonJS import that runs the moment it is called (breaks the import cycle).
 * @returns {object}
 */
function loadTrainerAppModuleOnceCalled() {
  // eslint-disable-next-line global-require
  return require('../../app-start/TrainerAppStart');
}

// ===== MAIN FUNCTION =====

/**
 * Walk the frozen CRM name list and attach one lazy forwarder per name.
 * Flow: 1. empty bag  2. one forwarder per name  3. return the bag for named exports below
 * @returns {Record<string, Function>}
 */
function buildEveryTraineeCrmForwarder() {
  // 1. Start with an empty bag of exports.
  const forwardersByName = {};

  // 2. One forwarder per frozen CRM name.
  for (let nameIndex = 0; nameIndex < TRAINEE_CRM_FUNCTION_NAMES.length; nameIndex += 1) {
    const crmFunctionName = TRAINEE_CRM_FUNCTION_NAMES[nameIndex];
    forwardersByName[crmFunctionName] = makeLazyCrmForwarder(crmFunctionName);
  }

  // 3. Hand the bag to the named export lines below.
  return forwardersByName;
}

const traineeCrmForwarders = buildEveryTraineeCrmForwarder();

// ===== PUBLIC EXPORTS — same letters callers already import =====

export const getClient = traineeCrmForwarders.getClient;
export const createOrUpdateClient = traineeCrmForwarders.createOrUpdateClient;
export const syncClientDataFromUsers = traineeCrmForwarders.syncClientDataFromUsers;
export const removeClient = traineeCrmForwarders.removeClient;
export const getTrainerClients = traineeCrmForwarders.getTrainerClients;
export const updateClient = traineeCrmForwarders.updateClient;
export const addProgress = traineeCrmForwarders.addProgress;
export const getProgressHistory = traineeCrmForwarders.getProgressHistory;
export const deleteProgress = traineeCrmForwarders.deleteProgress;
export const createTask = traineeCrmForwarders.createTask;
export const getTasks = traineeCrmForwarders.getTasks;
export const updateTask = traineeCrmForwarders.updateTask;
export const toggleTaskComplete = traineeCrmForwarders.toggleTaskComplete;
export const deleteTask = traineeCrmForwarders.deleteTask;
export const createNote = traineeCrmForwarders.createNote;
export const getNotes = traineeCrmForwarders.getNotes;
export const updateNote = traineeCrmForwarders.updateNote;
export const deleteNote = traineeCrmForwarders.deleteNote;
export const getWeightTrend = traineeCrmForwarders.getWeightTrend;
export const getTaskStats = traineeCrmForwarders.getTaskStats;
export const getClientAnalytics = traineeCrmForwarders.getClientAnalytics;
export const checkWeeklyDataAvailability = traineeCrmForwarders.checkWeeklyDataAvailability;

// ===== PLUMBING — skip unless debugging circular import / forwarder wiring =====
// Helpers live above the main bag so story order is constants → helpers → main → exports.
