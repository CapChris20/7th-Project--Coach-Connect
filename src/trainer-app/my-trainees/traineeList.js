// Re-export surface for the trainer's client CRM helpers (clients, notes, tasks, progress).
// Flow: a caller hits one of these names → we load the trainer app module at call time → that function runs.
// Used by inbox, chat, document sharing, and the trainer listing. The real functions live in TrainerAppStart.

// ===== NAMED CONSTANTS =====

// ===== HELPER FUNCTIONS =====

/**
 * vocab: require() = a CommonJS import that runs the moment it is called. A static import would
 * run while TrainerAppStart is still loading this file, and that cycle surfaces as a missing component.
 * @returns {object}
 */
function loadTrainerAppModule() {
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

// ===== MAIN FUNCTION =====

/**
 * Load one client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getClient = (...forwardedArguments) =>
  callTrainerClientFunction('getClient', forwardedArguments);

/**
 * Create or update a client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const createOrUpdateClient = (...forwardedArguments) =>
  callTrainerClientFunction('createOrUpdateClient', forwardedArguments);

/**
 * Copy client fields off the users collection. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const syncClientDataFromUsers = (...forwardedArguments) =>
  callTrainerClientFunction('syncClientDataFromUsers', forwardedArguments);

/**
 * Remove a client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const removeClient = (...forwardedArguments) =>
  callTrainerClientFunction('removeClient', forwardedArguments);

/**
 * Load the trainer's clients. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getTrainerClients = (...forwardedArguments) =>
  callTrainerClientFunction('getTrainerClients', forwardedArguments);

/**
 * Update a client record. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const updateClient = (...forwardedArguments) =>
  callTrainerClientFunction('updateClient', forwardedArguments);

/**
 * Add a progress entry. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const addProgress = (...forwardedArguments) =>
  callTrainerClientFunction('addProgress', forwardedArguments);

/**
 * Load progress history. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getProgressHistory = (...forwardedArguments) =>
  callTrainerClientFunction('getProgressHistory', forwardedArguments);

/**
 * Delete a progress entry. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const deleteProgress = (...forwardedArguments) =>
  callTrainerClientFunction('deleteProgress', forwardedArguments);

/**
 * Create a client task. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const createTask = (...forwardedArguments) =>
  callTrainerClientFunction('createTask', forwardedArguments);

/**
 * Load client tasks. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getTasks = (...forwardedArguments) =>
  callTrainerClientFunction('getTasks', forwardedArguments);

/**
 * Update a client task. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const updateTask = (...forwardedArguments) =>
  callTrainerClientFunction('updateTask', forwardedArguments);

/**
 * Toggle a task between open and complete. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const toggleTaskComplete = (...forwardedArguments) =>
  callTrainerClientFunction('toggleTaskComplete', forwardedArguments);

/**
 * Delete a client task. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const deleteTask = (...forwardedArguments) =>
  callTrainerClientFunction('deleteTask', forwardedArguments);

/**
 * Create a client note. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const createNote = (...forwardedArguments) =>
  callTrainerClientFunction('createNote', forwardedArguments);

/**
 * Load client notes. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getNotes = (...forwardedArguments) =>
  callTrainerClientFunction('getNotes', forwardedArguments);

/**
 * Update a client note. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const updateNote = (...forwardedArguments) =>
  callTrainerClientFunction('updateNote', forwardedArguments);

/**
 * Delete a client note. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const deleteNote = (...forwardedArguments) =>
  callTrainerClientFunction('deleteNote', forwardedArguments);

/**
 * Load the weight trend. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getWeightTrend = (...forwardedArguments) =>
  callTrainerClientFunction('getWeightTrend', forwardedArguments);

/**
 * Load task counts. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getTaskStats = (...forwardedArguments) =>
  callTrainerClientFunction('getTaskStats', forwardedArguments);

/**
 * Load client analytics. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const getClientAnalytics = (...forwardedArguments) =>
  callTrainerClientFunction('getClientAnalytics', forwardedArguments);

/**
 * Check whether a week has enough data to report. Arguments are forwarded to the trainer CRM.
 * @param {...any} forwardedArguments
 * @returns {*}
 */
export const checkWeeklyDataAvailability = (...forwardedArguments) =>
  callTrainerClientFunction('checkWeeklyDataAvailability', forwardedArguments);
