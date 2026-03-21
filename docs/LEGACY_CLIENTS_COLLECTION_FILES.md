# Files Using Legacy `clients` Collection

This document lists all files that query or use the legacy `clients` collection (as opposed to the `trainer_clients/{trainerUid}/clients/{clientUid}` structure).

## Summary

**Total Files: 4**

- **1 core service file** (`clientCRMService.js`) - Contains all legacy functions
- **3 files** importing and using functions from `clientCRMService.js`

---

## Files List

### 1. **`src/extra/api/clientCRMService.js`** ⚠️ PRIMARY TARGET

**Status**: Core service file - ALL legacy functions defined here

**Legacy Collection Used**: `clients/{clientId}`

**Functions Using Legacy System**:

| Function | Line | What It Does | Legacy Path |
|----------|------|--------------|-------------|
| `getClient(clientId)` | 32-57 | Get single client by ID | `clients/{clientId}` |
| `createOrUpdateClient(clientId, trainerId, clientData)` | 66-98 | Create/update client profile | `clients/{clientId}` |
| `getTrainerClients(trainerId)` | 105-140 | **Get all clients for trainer** | `clients` collection (query by `trainerId`) |
| `updateClient(clientId, updates)` | 148-170 | Update client profile | `clients/{clientId}` |
| `addProgress(clientId, progressData)` | 182-212 | Add progress entry | `clients/{clientId}/progress` |
| `getProgressHistory(clientId)` | 219-252 | Get progress history | `clients/{clientId}/progress` |
| `deleteProgress(clientId, progressId)` | 260-279 | Delete progress entry | `clients/{clientId}/progress/{progressId}` |
| `createTask(clientId, trainerId, taskData)` | 292-320 | Create task | `clients/{clientId}/tasks` |
| `getTasks(clientId)` | 327-360 | Get all tasks | `clients/{clientId}/tasks` |
| `updateTask(clientId, taskId, updates)` | 369-391 | Update task | `clients/{clientId}/tasks/{taskId}` |
| `deleteTask(clientId, taskId)` | 410-429 | Delete task | `clients/{clientId}/tasks/{taskId}` |
| `createNote(clientId, trainerId, noteData)` | 442-468 | Create note | `clients/{clientId}/notes` |
| `getNotes(clientId)` | 475-508 | Get all notes | `clients/{clientId}/notes` |
| `updateNote(clientId, noteId, updates)` | 517-539 | Update note | `clients/{clientId}/notes/{noteId}` |
| `deleteNote(clientId, noteId)` | 547-566 | Delete note | `clients/{clientId}/notes/{noteId}` |
| `getWeightTrend(clientId)` | 578-602 | Get weight trend (uses `getProgressHistory`) | Indirect |
| `getTaskStats(clientId)` | 609-631 | Get task stats (uses `getTasks`) | Indirect |
| `getClientAnalytics(clientId)` | 638-694 | Get analytics (uses progress/tasks) | Indirect |

**Key Constant**:
- Line 18: `const CLIENTS_COLLECTION = 'clients';`

**Impact**: 🔴 **CRITICAL** - This is the only file that directly queries the legacy collection. All other files use functions from this service.

---

### 2. **`src/trainer-page/screens/ConversationsListScreen.js`**

**Status**: Uses legacy functions

**Import**: Line 15
```javascript
import { getTrainerClients, createOrUpdateClient } from '../../extra/api/clientCRMService';
```

**Functions Called**:
- Line 43: `getTrainerClients(currentUser.uid)`
  - **Purpose**: Load trainer's clients list
  - **Impact**: MEDIUM - Used for displaying conversations

**Migration Impact**: ⚠️ Needs update after `clientCRMService.js` migration
- `getTrainerClients` should work as-is (already takes `trainerId`)
- Verify compatibility with new implementation

---

### 3. **`src/trainer-page/screens/TrainerMessagingScreen.js`**

**Status**: Uses legacy functions

**Import**: Line 25
```javascript
import { getTrainerClients, createOrUpdateClient } from '../../extra/api/clientCRMService';
```

**Functions Called**:
- Line 67: `getTrainerClients(currentUser.uid)`
  - **Purpose**: Check if person is already a client
- Line 84: `getTrainerClients(currentUser.uid)`
  - **Purpose**: Check for existing clients before adding
- Line 93: `createOrUpdateClient(trainer.id, currentUser.uid, {...})`
  - **Purpose**: Add person as a client
  - **Impact**: HIGH - Creates new client relationships

**Migration Impact**: ⚠️ **NEEDS UPDATE**
- `createOrUpdateClient` signature may change (may need `trainerId` as first parameter)
- `getTrainerClients` should work as-is

---

### 4. **`src/trainer-page/components/PremiumTrainerDashboard.jsx`**

**Status**: Uses legacy functions

**Import**: Line 14
```javascript
import { getProgressHistory } from '../../extra/api/clientCRMService';
```

**Functions Called**:
- Line 133: `getProgressHistory(clientId)`
  - **Purpose**: Fetch last check-in date for stats
  - **Impact**: MEDIUM - Used for calculating "last check-in" stat

**Migration Impact**: ⚠️ **NEEDS UPDATE**
- `getProgressHistory` will need `trainerUid` parameter
- Call site needs to pass `trainerUid`

---

## Migration Priority

1. **🔴 HIGH PRIORITY**:
   - `src/extra/api/clientCRMService.js` - Core service file (all functions)
   - `src/trainer-page/screens/TrainerMessagingScreen.js` - Uses `createOrUpdateClient` (creates clients)

2. **🟡 MEDIUM PRIORITY**:
   - `src/trainer-page/components/PremiumTrainerDashboard.jsx` - Uses `getProgressHistory`
   - `src/trainer-page/screens/ConversationsListScreen.js` - Uses `getTrainerClients` (should work as-is)

---

## Notes

- **No Firestore Rules**: There are no security rules for the legacy `clients` collection in `firestore.rules`. The rules only define `trainer_clients/{trainerUid}/clients/{clientUid}` structure.
- **Subcollections**: The legacy system uses subcollections (`progress`, `tasks`, `notes`) that also need to be migrated.
- **Data Migration**: Existing data in `clients/{clientId}` needs to be migrated to `trainer_clients/{trainerId}/clients/{clientId}`.

---

## Related Documentation

- See `docs/TRAINER_CLIENT_MIGRATION.md` for detailed migration guide
- Primary system: `trainer_clients/{trainerUid}/clients/{clientUid}` (used by `useTrainerClients` hook)












