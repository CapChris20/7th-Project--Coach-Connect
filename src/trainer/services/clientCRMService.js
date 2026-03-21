// Client CRM Service
// Handles all Firestore operations for trainer-client CRM system
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../../app/config';
import { autoLogErrorSync } from '../../utils/autoLogError';
import { getOrCreateConversation } from '../../ai/services/trainerMessaging';

const CLIENTS_COLLECTION = 'clients';
const PROGRESS_SUBCOLLECTION = 'progress';
const TASKS_SUBCOLLECTION = 'tasks';
const NOTES_SUBCOLLECTION = 'notes';

// ============================================================================
// CLIENT PROFILE OPERATIONS
// ============================================================================

/**
 * Get a single client by ID
 * @param {string} clientId - The client's user ID
 * @param {string} [trainerId] - Optional trainer ID; when provided, prefers trainer_clients (primary system)
 * @returns {Promise<Object|null>} Client data or null if not found
 */
export async function getClient(clientId, trainerId = null) {
  if (!clientId || !db) return null;

  try {
    // P2#7: Prefer trainer_clients when trainerId is known
    if (trainerId) {
      const trainerClientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
      const trainerClientSnap = await getDoc(trainerClientRef);
      if (trainerClientSnap.exists()) {
        return { id: trainerClientSnap.id, ...trainerClientSnap.data() };
      }
    }

    // Fallback to legacy clients collection
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    const clientSnap = await getDoc(clientRef);
    if (!clientSnap.exists()) return null;

    return { id: clientSnap.id, ...clientSnap.data() };
  } catch (error) {
    console.error('Error getting client:', error);
    autoLogErrorSync(error, 'clientCRMService - getClient');
    return null;
  }
}

/**
 * Create or update a client profile
 * @param {string} clientId - The client's user ID
 * @param {string} trainerId - The trainer's user ID
 * @param {Object} clientData - Client profile data
 * @returns {Promise<Object>} Success result
 */
export async function createOrUpdateClient(clientId, trainerId, clientData) {
  if (!clientId || !trainerId || !db) {
    throw new Error('Missing required parameters: clientId or trainerId');
  }

  try {
    // Use trainer_clients subcollection (new system with proper rules)
    const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
    
    // Build payload with ALL client data - sync everything from users collection
    const payload = {
      id: clientId,
      // Basic info
      name: clientData.name || '',
      email: clientData.email || '',
      photoURL: clientData.photoURL || null,
      
      // Physical stats
      height: clientData.height || null,
      weight: clientData.weight || null,
      age: clientData.age || null,
      gender: clientData.gender || null,
      
      // Goals and preferences
      goals: clientData.goals || '',
      fitnessLevel: clientData.fitnessLevel || null,
      equipmentAccess: clientData.equipmentAccess || [],
      daysPerWeek: clientData.daysPerWeek || null,
      injuries: clientData.injuries || null,
      exercisesDislike: clientData.exercisesDislike || '',
      preferredWorkoutTime: clientData.preferredWorkoutTime || null,
      trainingEnvironment: clientData.trainingEnvironment || null,
      currentStressLevel: clientData.currentStressLevel || null,
      sleepQuality: clientData.sleepQuality || null,
      energyLevels: clientData.energyLevels || null,
      supplementsCurrentlyTaking: clientData.supplementsCurrentlyTaking || '',
      hydrationHabits: clientData.hydrationHabits || null,

      // Additional profile
      phone: clientData.phone || null,
      bio: clientData.bio || null,
      role: clientData.role || 'client',
      
      // Metadata
      createdAt: clientData.createdAt || serverTimestamp(),
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active',
    };


    // 🔄 AUTOMATIC CONVERSATION CREATION
    // Create conversation between trainer and client for instant messaging
    try {
      const conversationId = await getOrCreateConversation(clientId, trainerId);
    } catch (convError) {
      console.error('⚠️ Error creating auto-conversation:', convError);
      // Don't fail the whole operation if conversation creation fails
    }

    // Note: trainerId is stored in trainer_clients/{trainerId}/clients/{clientId} only.
    // The client's user doc is updated by the client themselves (e.g. via ClientApp reconciliation).

    // Use setDoc without merge first (create), then update if needed
    // This ensures we're doing a 'create' operation which matches the rules
    const existingDoc = await getDoc(clientRef);
    if (existingDoc.exists()) {
      await setDoc(clientRef, payload, { merge: true });
    } else {
      await setDoc(clientRef, payload);
    }

    // Also write to trainer_client_links (flat collection - easy to see in Firebase Console)
    try {
      const linkId = `${trainerId}_${clientId}`;
      const linkRef = doc(db, TRAINER_CLIENT_LINKS, linkId);
      await setDoc(linkRef, {
        trainerId,
        clientId,
        name: payload.name,
        email: payload.email,
        goals: payload.goals,
        status: payload.status,
        joinedAt: payload.joinedAt,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (linkErr) {
      console.warn('⚠️ trainer_client_links write skipped:', linkErr?.message);
    }
    
    // Verify it was saved
    const verifyDoc = await getDoc(clientRef);
    if (verifyDoc.exists()) {
    } else {
      console.error('❌ ERROR: Client was not saved!');
    }
    
    // Also update legacy clients collection for backward compatibility (if rules allow)
    try {
      const legacyClientRef = doc(db, CLIENTS_COLLECTION, clientId);
      await setDoc(legacyClientRef, {
        id: clientId,
        trainerId,
        ...payload,
      }, { merge: true });
    } catch (legacyError) {
      // Ignore legacy collection errors - new system is primary
    }
    
    return { success: true, id: clientId };
  } catch (error) {
    console.error('Error creating/updating client:', error);
    autoLogErrorSync(error, 'clientCRMService - createOrUpdateClient');
    throw error;
  }
}

/**
 * Sync client data from users collection to CRM
 * This ensures the CRM always has the latest client data
 * @param {string} clientId - The client's user ID
 * @param {string} trainerId - The trainer's user ID
 * @returns {Promise<Object>} Updated client data
 */
export async function syncClientDataFromUsers(clientId, trainerId) {
  if (!clientId || !trainerId || !db) {
    throw new Error('Missing required parameters');
  }

  try {
    // Fetch latest data from users collection (source of truth)
    const userDoc = await getDoc(doc(db, 'users', clientId));
    if (!userDoc.exists()) {
      return null;
    }

    const userData = userDoc.data();
    
    // Construct name
    const clientName = userData.name || 
      `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 
      userData.displayName || 
      'Client';

    // Build sync payload with ALL data
    const syncPayload = {
      name: clientName,
      email: userData.email || '',
      photoURL: userData.photoURL || null,
      height: userData.height || null,
      weight: userData.weight || null,
      age: userData.age || null,
      gender: userData.gender || null,
      goals: userData.primaryGoal || userData.goals || '',
      fitnessLevel: userData.fitnessLevel || null,
      equipmentAccess: userData.equipmentAccess || [],
      daysPerWeek: userData.daysPerWeek || null,
      injuries: userData.injuries || null,
      exercisesDislike: userData.exercisesDislike || '',
      preferredWorkoutTime: userData.preferredWorkoutTime || null,
      trainingEnvironment: userData.trainingEnvironment || null,
      currentStressLevel: userData.currentStressLevel || null,
      sleepQuality: userData.sleepQuality || null,
      energyLevels: userData.energyLevels || null,
      supplementsCurrentlyTaking: userData.supplementsCurrentlyTaking || '',
      hydrationHabits: userData.hydrationHabits || null,
      phone: userData.phone || null,
      bio: userData.bio || null,
      role: userData.role || 'client',
      updatedAt: serverTimestamp(),
    };

    // Update CRM with latest data
    const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
    await setDoc(clientRef, syncPayload, { merge: true });
    
    return { id: clientId, ...syncPayload };
  } catch (error) {
    console.error('Error syncing client data:', error);
    throw error;
  }
}

/**
 * Remove a client from trainer's CRM
 * @param {string} clientId - The client's user ID
 * @param {string} trainerId - The trainer's user ID
 * @returns {Promise<Object>} Success result
 */
export async function removeClient(clientId, trainerId) {
  if (!clientId || !trainerId || !db) {
    throw new Error('Missing required parameters: clientId or trainerId');
  }

  try {
    // Remove from trainer_clients subcollection
    const clientRef = doc(db, `trainer_clients/${trainerId}/clients/${clientId}`);
    await deleteDoc(clientRef);
    
    
    // Also try to remove from legacy clients collection (if exists)
    try {
      const legacyClientRef = doc(db, CLIENTS_COLLECTION, clientId);
      await deleteDoc(legacyClientRef);
    } catch (legacyError) {
      // Ignore legacy collection errors
    }
    
    return { success: true, id: clientId };
  } catch (error) {
    console.error('Error removing client:', error);
    throw error;
  }
}

const TRAINER_CLIENT_LINKS = 'trainer_client_links';

/**
 * Get all clients for a trainer
 * Single source of truth: trainer_clients/{trainerId}/clients. Enriches with users for display name/photo.
 * Filters out clients whose user accounts have been deleted.
 * @param {string} trainerId - The trainer's user ID
 * @returns {Promise<Array>} Array of client objects (deduplicated by clientId)
 */
export async function getTrainerClients(trainerId) {
  if (!trainerId || !db) return [];

  try {
    const seen = new Set();
    const clients = [];

    // 1. Primary: trainer_clients subcollection (single source of truth)
    const clientsRef = collection(db, `trainer_clients/${trainerId}/clients`);
    const querySnapshot = await getDocs(clientsRef);
    querySnapshot.forEach((docSnap) => {
      const clientId = docSnap.id;
      if (!seen.has(clientId)) {
        seen.add(clientId);
        clients.push({ id: clientId, ...docSnap.data() });
      }
    });

    // 2. Enrich with display name and photo from users (read-only for display)
    // 3. Filter out clients whose user accounts no longer exist
    const validClients = [];
    for (const client of clients) {
      try {
        const userDoc = await getDoc(doc(db, 'users', client.id));
        if (userDoc.exists()) {
          const d = userDoc.data();
          client.name = client.name || d.name || d.displayName || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Client';
          client.photoURL = client.photoURL || d.photoURL || null;
          validClients.push(client); // Only keep clients with existing user accounts
        } else {
        }
      } catch (_) {
        // Keep existing name if user fetch fails but still filter out since we can't verify existence
      }
    }

    // Sort by name alphabetically
    validClients.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase();
      const nameB = (b.name || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return validClients;
  } catch (error) {
    console.error('Error getting trainer clients:', error);
    autoLogErrorSync(error, 'clientCRMService - getTrainerClients');
    return [];
  }
}

/**
 * Update client profile
 * @param {string} clientId - The client's user ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Success result
 */
export async function updateClient(clientId, updates) {
  if (!clientId || !db) {
    throw new Error('Missing required parameter: clientId');
  }

  try {
    const clientRef = doc(db, CLIENTS_COLLECTION, clientId);
    await updateDoc(clientRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating client:', error);
    autoLogErrorSync(error, 'clientCRMService - updateClient');
    throw error;
  }
}

// ============================================================================
// PROGRESS TRACKING OPERATIONS
// ============================================================================

/**
 * Add a progress entry for a client
 * @param {string} clientId - The client's user ID
 * @param {Object} progressData - Progress entry data
 * @returns {Promise<Object>} Success result with progress ID
 */
export async function addProgress(clientId, progressData) {
  if (!clientId || !db) {
    throw new Error('Missing required parameter: clientId');
  }

  try {
    const progressRef = collection(db, CLIENTS_COLLECTION, clientId, PROGRESS_SUBCOLLECTION);
    const payload = {
      weight: progressData.weight || null,
      bodyFat: progressData.bodyFat || null,
      chest: progressData.chest || null,
      arms: progressData.arms || null,
      waist: progressData.waist || null,
      photos: progressData.photos || [],
      note: progressData.note || '',
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(progressRef, payload);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding progress:', error);
    autoLogErrorSync(error, 'clientCRMService - addProgress');
    throw error;
  }
}

/**
 * Get all progress entries for a client
 * @param {string} clientId - The client's user ID
 * @returns {Promise<Array>} Array of progress entries
 */
export async function getProgressHistory(clientId) {
  if (!clientId || !db) return [];

  try {
    const trainerId = auth?.currentUser?.uid;
    let querySnapshot;
    if (trainerId) {
      try {
        const newProgressRef = collection(db, `trainer_clients/${trainerId}/clients/${clientId}/${PROGRESS_SUBCOLLECTION}`);
        querySnapshot = await getDocs(newProgressRef);
      } catch (newPathError) {
        const legacyProgressRef = collection(db, CLIENTS_COLLECTION, clientId, PROGRESS_SUBCOLLECTION);
        querySnapshot = await getDocs(legacyProgressRef);
      }
    } else {
      const legacyProgressRef = collection(db, CLIENTS_COLLECTION, clientId, PROGRESS_SUBCOLLECTION);
      querySnapshot = await getDocs(legacyProgressRef);
    }
    const progressEntries = [];

    querySnapshot.forEach((docSnap) => {
      progressEntries.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    // Sort by createdAt descending (newest first)
    progressEntries.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return timeB - timeA;
    });

    return progressEntries;
  } catch (error) {
    const code = error?.code || error?.name;
    if (code !== 'permission-denied') {
    console.error('Error getting progress history:', error);
    }
    autoLogErrorSync(error, 'clientCRMService - getProgressHistory');
    return [];
  }
}

/**
 * Delete a progress entry
 * @param {string} clientId - The client's user ID
 * @param {string} progressId - The progress entry ID
 * @returns {Promise<Object>} Success result
 */
export async function deleteProgress(clientId, progressId) {
  if (!clientId || !progressId || !db) {
    throw new Error('Missing required parameters: clientId or progressId');
  }

  try {
    const progressRef = doc(db, CLIENTS_COLLECTION, clientId, PROGRESS_SUBCOLLECTION, progressId);
    await deleteDoc(progressRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting progress:', error);
    autoLogErrorSync(error, 'clientCRMService - deleteProgress');
    throw error;
  }
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

/**
 * Create a task for a client
 * @param {string} clientId - The client's user ID
 * @param {string} trainerId - The trainer's user ID
 * @param {Object} taskData - Task data
 * @returns {Promise<Object>} Success result with task ID
 */
export async function createTask(clientId, trainerId, taskData) {
  if (!clientId || !trainerId || !db) {
    throw new Error('Missing required parameters: clientId or trainerId');
  }

  try {
    const tasksRef = collection(db, CLIENTS_COLLECTION, clientId, TASKS_SUBCOLLECTION);
    const payload = {
      title: taskData.title || '',
      description: taskData.description || '',
      dueDate: taskData.dueDate || null,
      completed: false,
      trainerId,
      createdAt: serverTimestamp(),
    };

    const docRef = await addDoc(tasksRef, payload);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating task:', error);
    autoLogErrorSync(error, 'clientCRMService - createTask');
    throw error;
  }
}

/**
 * Get all tasks for a client
 * @param {string} clientId - The client's user ID
 * @returns {Promise<Array>} Array of tasks
 */
export async function getTasks(clientId) {
  if (!clientId || !db) return [];

  try {
    const trainerId = auth?.currentUser?.uid;
    let querySnapshot;
    if (trainerId) {
      try {
        const newTasksRef = collection(db, `trainer_clients/${trainerId}/clients/${clientId}/${TASKS_SUBCOLLECTION}`);
        querySnapshot = await getDocs(newTasksRef);
      } catch (newPathError) {
        const legacyTasksRef = collection(db, CLIENTS_COLLECTION, clientId, TASKS_SUBCOLLECTION);
        querySnapshot = await getDocs(legacyTasksRef);
      }
    } else {
      const legacyTasksRef = collection(db, CLIENTS_COLLECTION, clientId, TASKS_SUBCOLLECTION);
      querySnapshot = await getDocs(legacyTasksRef);
    }
    const tasks = [];

    querySnapshot.forEach((docSnap) => {
      tasks.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    // Sort by createdAt descending (newest first)
    tasks.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return timeB - timeA;
    });

    return tasks;
  } catch (error) {
    const code = error?.code || error?.name;
    if (code !== 'permission-denied') {
    console.error('Error getting tasks:', error);
    }
    autoLogErrorSync(error, 'clientCRMService - getTasks');
    return [];
  }
}

/**
 * Update a task
 * @param {string} clientId - The client's user ID
 * @param {string} taskId - The task ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Success result
 */
export async function updateTask(clientId, taskId, updates) {
  if (!clientId || !taskId || !db) {
    throw new Error('Missing required parameters: clientId or taskId');
  }

  try {
    const taskRef = doc(db, CLIENTS_COLLECTION, clientId, TASKS_SUBCOLLECTION, taskId);
    await updateDoc(taskRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating task:', error);
    autoLogErrorSync(error, 'clientCRMService - updateTask');
    throw error;
  }
}

/**
 * Toggle task completion status
 * @param {string} clientId - The client's user ID
 * @param {string} taskId - The task ID
 * @param {boolean} completed - New completion status
 * @returns {Promise<Object>} Success result
 */
export async function toggleTaskComplete(clientId, taskId, completed) {
  return await updateTask(clientId, taskId, { completed });
}

/**
 * Delete a task
 * @param {string} clientId - The client's user ID
 * @param {string} taskId - The task ID
 * @returns {Promise<Object>} Success result
 */
export async function deleteTask(clientId, taskId) {
  if (!clientId || !taskId || !db) {
    throw new Error('Missing required parameters: clientId or taskId');
  }

  try {
    const taskRef = doc(db, CLIENTS_COLLECTION, clientId, TASKS_SUBCOLLECTION, taskId);
    await deleteDoc(taskRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting task:', error);
    autoLogErrorSync(error, 'clientCRMService - deleteTask');
    throw error;
  }
}

// ============================================================================
// NOTES OPERATIONS (FIRESTORE TEXT NOTES)
// ============================================================================

/**
 * Create a text note in Firestore
 * @param {string} clientId - The client's user ID
 * @param {string} trainerId - The trainer's user ID
 * @param {Object} noteData - Note data
 * @returns {Promise<Object>} Success result with note ID
 */
export async function createNote(clientId, trainerId, noteData) {
  if (!clientId || !trainerId || !db) {
    throw new Error('Missing required parameters: clientId or trainerId');
  }

  try {
    const notesRef = collection(db, CLIENTS_COLLECTION, clientId, NOTES_SUBCOLLECTION);
    const payload = {
      text: noteData.text || '',
      trainerId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(notesRef, payload);
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error creating note:', error);
    autoLogErrorSync(error, 'clientCRMService - createNote');
    throw error;
  }
}

/**
 * Get all notes for a client
 * @param {string} clientId - The client's user ID
 * @returns {Promise<Array>} Array of notes
 */
export async function getNotes(clientId) {
  if (!clientId || !db) return [];

  try {
    const notesRef = collection(db, CLIENTS_COLLECTION, clientId, NOTES_SUBCOLLECTION);
    const querySnapshot = await getDocs(notesRef);
    const notes = [];

    querySnapshot.forEach((docSnap) => {
      notes.push({
        id: docSnap.id,
        ...docSnap.data(),
      });
    });

    // Sort by createdAt descending (newest first)
    notes.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || a.createdAt || 0;
      const timeB = b.createdAt?.toMillis?.() || b.createdAt || 0;
      return timeB - timeA;
    });

    return notes;
  } catch (error) {
    console.error('Error getting notes:', error);
    autoLogErrorSync(error, 'clientCRMService - getNotes');
    return [];
  }
}

/**
 * Update a note
 * @param {string} clientId - The client's user ID
 * @param {string} noteId - The note ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object>} Success result
 */
export async function updateNote(clientId, noteId, updates) {
  if (!clientId || !noteId || !db) {
    throw new Error('Missing required parameters: clientId or noteId');
  }

  try {
    const noteRef = doc(db, CLIENTS_COLLECTION, clientId, NOTES_SUBCOLLECTION, noteId);
    await updateDoc(noteRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating note:', error);
    autoLogErrorSync(error, 'clientCRMService - updateNote');
    throw error;
  }
}

/**
 * Delete a note
 * @param {string} clientId - The client's user ID
 * @param {string} noteId - The note ID
 * @returns {Promise<Object>} Success result
 */
export async function deleteNote(clientId, noteId) {
  if (!clientId || !noteId || !db) {
    throw new Error('Missing required parameters: clientId or noteId');
  }

  try {
    const noteRef = doc(db, CLIENTS_COLLECTION, clientId, NOTES_SUBCOLLECTION, noteId);
    await deleteDoc(noteRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    autoLogErrorSync(error, 'clientCRMService - deleteNote');
    throw error;
  }
}

// ============================================================================
// ANALYTICS OPERATIONS
// ============================================================================

/**
 * Get weight trend data for analytics
 * @param {string} clientId - The client's user ID
 * @param {number} limit - Number of entries to return (default: 30)
 * @returns {Promise<Array>} Array of weight data points
 */
export async function getWeightTrend(clientId, limit = 30) {
  if (!clientId || !db) return [];

  try {
    const progressEntries = await getProgressHistory(clientId);
    const weightData = progressEntries
      .filter((entry) => entry.weight != null && entry.weight > 0)
      .map((entry) => ({
        date: entry.createdAt?.toDate?.() || entry.createdAt || new Date(),
        weight: Number(entry.weight),
      }))
      .slice(0, limit);

    return weightData;
  } catch (error) {
    console.error('Error getting weight trend:', error);
    autoLogErrorSync(error, 'clientCRMService - getWeightTrend');
    return [];
  }
}

/**
 * Get task statistics for a client
 * @param {string} clientId - The client's user ID
 * @returns {Promise<Object>} Task statistics
 */
export async function getTaskStats(clientId) {
  if (!clientId || !db) {
    return { total: 0, completed: 0, pending: 0 };
  }

  try {
    const tasks = await getTasks(clientId);
    const total = tasks.length;
    const completed = tasks.filter((task) => task.completed === true).length;
    const pending = total - completed;

    return { total, completed, pending };
  } catch (error) {
    console.error('Error getting task stats:', error);
    autoLogErrorSync(error, 'clientCRMService - getTaskStats');
    return { total: 0, completed: 0, pending: 0 };
  }
}

/**
 * Get comprehensive analytics for a client
 * @param {string} clientId - The client's user ID
 * @returns {Promise<Object>} Analytics data
 */
export async function getClientAnalytics(clientId) {
  if (!clientId || !db) {
    return {
      weightTrend: [],
      taskStats: { total: 0, completed: 0, pending: 0 },
      lastProgressDate: null,
      daysSinceLastCheckIn: null,
      progressEntriesCount: 0,
    };
  }

  try {
    const [weightTrend, taskStats, progressEntries] = await Promise.all([
      getWeightTrend(clientId),
      getTaskStats(clientId),
      getProgressHistory(clientId),
    ]);

    // Calculate days since last check-in
    let lastProgressDate = null;
    let daysSinceLastCheckIn = null;

    if (progressEntries.length > 0) {
      const lastEntry = progressEntries[0]; // Already sorted newest first
      lastProgressDate = lastEntry.createdAt?.toDate?.() || lastEntry.createdAt || null;

      if (lastProgressDate) {
        const now = new Date();
        const diffTime = now - lastProgressDate;
        daysSinceLastCheckIn = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }
    }

    return {
      weightTrend,
      taskStats,
      lastProgressDate,
      daysSinceLastCheckIn,
      progressEntriesCount: progressEntries.length,
    };
  } catch (error) {
    console.error('Error getting client analytics:', error);
    autoLogErrorSync(error, 'clientCRMService - getClientAnalytics');
    return {
      weightTrend: [],
      taskStats: { total: 0, completed: 0, pending: 0 },
      lastProgressDate: null,
      daysSinceLastCheckIn: null,
      progressEntriesCount: 0,
    };
  }
}

/**
 * Check how many days of data exist for a user in the past week
 * @param {string} userId - The user's ID
 * @returns {Promise<Object>} Object with count and array of dates with data
 */
export async function checkWeeklyDataAvailability(userId) {
  if (!userId || !db) {
    throw new Error('Missing userId or db');
  }

  try {
    // Calculate the date range for the past 7 days
    const today = new Date();
    const daysWithData = [];
    const dateKeys = [];
    
    // Generate date keys for the past 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateKey = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      dateKeys.push(dateKey);
    }
    
    // Check each day for data
    const dailyLogsRef = collection(db, 'users', userId, 'dailyLogs');
    
    for (const dateKey of dateKeys) {
      const docRef = doc(dailyLogsRef, dateKey);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        daysWithData.push({
          date: dateKey,
          hasWorkout: !!data.workout,
          hasNutrition: !!data.nutrition,
          hasWeight: !!data.weight,
          hasMood: !!data.mood,
          data: data
        });
      }
    }
    
    return {
      totalDays: 7,
      daysWithData: daysWithData.length,
      missingDays: 7 - daysWithData.length,
      details: daysWithData,
      dateRange: {
        start: dateKeys[dateKeys.length - 1],
        end: dateKeys[0]
      }
    };
  } catch (error) {
    const code = error?.code;
    const msg = String(error?.message || error || '').toLowerCase();
    const permissionDenied = code === 'permission-denied' || msg.includes('missing or insufficient permissions');

    // If the trainer can’t read this client's data, silently return an "empty availability" object.
    // This prevents noisy Firebase errors from disrupting the CRM UI.
    if (permissionDenied) {
      const today = new Date();
      const dateKeys = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateKey = date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
        dateKeys.push(dateKey);
      }
      return {
        totalDays: 7,
        daysWithData: 0,
        missingDays: 7,
        details: [],
        dateRange: {
          start: dateKeys[dateKeys.length - 1],
          end: dateKeys[0],
        },
      };
    }

    console.error('Error checking weekly data availability:', error);
    autoLogErrorSync(error, 'clientCRMService - checkWeeklyDataAvailability');
    throw error;
  }
}





