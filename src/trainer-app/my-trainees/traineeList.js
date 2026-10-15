// Re-export surface for the trainer's client CRM helpers (clients, notes, tasks, progress).
// Flow: a caller hits one of these names → we load the trainer app module at call time → that function runs.
// Used by inbox, chat, document sharing, and the trainer listing. The real functions live in TrainerAppStart.

// ===== NAMED CONSTANTS =====

// Every CRM name we forward. Letters must match TrainerAppStart exports exactly.
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
 * vocab: require() = a CommonJS import that runs the moment it is called. A static import would
 * run while TrainerAppStart is still loading this file, and that cycle surfaces as a missing component.
 * @returns {object}
 */
function loadTrainerAppModule() {
  // eslint-disable-next-line global-require
  return require('../../app-start/TrainerAppStart');
}

/**
 * Forward every argument to the named CRM function.
 * apply keeps `this` as the trainer module, the same as calling trainerAppModule.getClient(...).
 * @param {string} functionName
 * @param {Array} forwardedArguments
 * @returns {*}
 */
function callTrainerClientFunction(functionName, forwardedArguments) {
  const trainerAppModule = loadTrainerAppModule();
  const clientFunction = trainerAppModule[functionName];
  return clientFunction.apply(trainerAppModule, forwardedArguments);
}

/**
 * Build one exported forwarder for a CRM function name.
 * @param {string} functionName
 * @returns {(...args: any[]) => *}
 */
function makeTraineeCrmForwarder(functionName) {
  return (...forwardedArguments) => callTrainerClientFunction(functionName, forwardedArguments);
}

/**
 * Build the whole export bag from the frozen name list.
 * @returns {Record<string, Function>}
 */
function buildTraineeCrmExports() {
  const exportsBag = {};
  for (let index = 0; index < TRAINEE_CRM_FUNCTION_NAMES.length; index += 1) {
    const functionName = TRAINEE_CRM_FUNCTION_NAMES[index];
    exportsBag[functionName] = makeTraineeCrmForwarder(functionName);
  }
  return exportsBag;
}

// ===== MAIN FUNCTION =====

const traineeCrmExports = buildTraineeCrmExports();

/**
 * Load one client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getClient = traineeCrmExports.getClient;

/**
 * Create or update a client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const createOrUpdateClient = traineeCrmExports.createOrUpdateClient;

/**
 * Copy client fields off the users collection. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const syncClientDataFromUsers = traineeCrmExports.syncClientDataFromUsers;

/**
 * Remove a client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const removeClient = traineeCrmExports.removeClient;

/**
 * Load the trainer's clients. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getTrainerClients = traineeCrmExports.getTrainerClients;

/**
 * Update a client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const updateClient = traineeCrmExports.updateClient;

/**
 * Add a progress entry. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const addProgress = traineeCrmExports.addProgress;

/**
 * Load progress history. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getProgressHistory = traineeCrmExports.getProgressHistory;

/**
 * Delete a progress entry. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const deleteProgress = traineeCrmExports.deleteProgress;

/**
 * Create a client task. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const createTask = traineeCrmExports.createTask;

/**
 * Load client tasks. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getTasks = traineeCrmExports.getTasks;

/**
 * Update a client task. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const updateTask = traineeCrmExports.updateTask;

/**
 * Toggle a task between open and complete. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const toggleTaskComplete = traineeCrmExports.toggleTaskComplete;

/**
 * Delete a client task. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const deleteTask = traineeCrmExports.deleteTask;

/**
 * Create a client note. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const createNote = traineeCrmExports.createNote;

/**
 * Load client notes. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getNotes = traineeCrmExports.getNotes;

/**
 * Update a client note. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const updateNote = traineeCrmExports.updateNote;

/**
 * Delete a client note. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const deleteNote = traineeCrmExports.deleteNote;

/**
 * Load the weight trend. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getWeightTrend = traineeCrmExports.getWeightTrend;

/**
 * Load task counts. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getTaskStats = traineeCrmExports.getTaskStats;

/**
 * Load client analytics. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getClientAnalytics = traineeCrmExports.getClientAnalytics;

/**
 * Check whether a week has enough data to report. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const checkWeeklyDataAvailability = traineeCrmExports.checkWeeklyDataAvailability;
