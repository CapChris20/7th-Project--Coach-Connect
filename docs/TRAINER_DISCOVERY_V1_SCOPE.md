# Trainer Discovery V1 Scope Definition

## Context

This app uses a **TRAINER DIRECTORY**, not a marketplace. V1 focuses on discovery and connection, not reviews/ratings/rankings.

---

## V1 SCOPE - INCLUDED

### 1. Trainer Opt-In Discoverability
- Trainers appear in directory when `role == 'trainer'` in Firestore
- No additional opt-in required (role assignment = discoverability)
- **File:** `src/trainer-page/screens/TrainerSearchScreen.js`

### 2. Simple Directory List
- Lists all trainers from Firestore
- Sorted alphabetically by name
- **File:** `src/trainer-page/screens/TrainerSearchScreen.js` (lines 30-65)

### 3. Basic Filters
- Search by name
- Search by specialization
- Search by location
- Search by bio (full-text search)
- **File:** `src/trainer-page/screens/TrainerSearchScreen.js` (lines 67-99)

### 4. Trainer Profile Display
- Name
- Bio
- Certifications
- Specialties (array)
- Location
- Photo
- **File:** `src/trainer-page/screens/TrainerSearchScreen.js` (trainer card display)

### 5. Client Request → Trainer Approve Flow
- Client initiates messaging via trainer card
- Creates conversation if doesn't exist
- Trainer receives message and can respond
- **Files:**
  - `src/trainer-page/screens/TrainerSearchScreen.js` (onSelectTrainer)
  - `src/trainer-page/screens/TrainerMessagingScreen.js`
  - `src/ai/components/trainerMessaging.js` (getOrCreateConversation)

---

## V1 SCOPE - EXCLUDED (Marketplace Features)

### Reviews & Ratings System
**Files to modify:**
- `src/extra/api/trainerReviews.js` - DISABLE frontend usage
- `src/trainer-page/screens/TrainerSearchScreen.js` - REMOVE rating/review display

**What to remove/disable:**
1. ❌ Review submission UI
2. ❌ Rating stars display on trainer cards
3. ❌ Review count display
4. ❌ Average rating calculation/display
5. ❌ Review list display on trainer profiles

**Backend code:** Keep `trainerReviews.js` code commented for future use, but disable frontend access

### Rankings & Sorting
- ❌ Sort by popularity
- ❌ Sort by rating
- ❌ Featured trainers
- ❌ "Top trainers" section

### Monetization Features
- ❌ Trainer pricing display
- ❌ Subscription requirement to message trainers
- ❌ Payment for trainer access

---

## Files Related to Discovery

### Core Discovery Files (KEEP)
1. `src/trainer-page/screens/TrainerSearchScreen.js` - Main discovery screen
2. `src/trainer-page/screens/TrainerMessagingScreen.js` - Messaging (connection flow)
3. `src/trainer-page/screens/ConversationsListScreen.js` - Conversation list
4. `src/ai/components/trainerMessaging.js` - Messaging service

### Review Files (DISABLE for V1)
1. `src/extra/api/trainerReviews.js` - Review API service
   - **Action:** Comment out or remove frontend usage
   - **Functions to disable:** `submitReview()`, `updateTrainerRating()`, `getAverageRating()`
   - **Keep:** `getTrainerReviews()` can remain but won't be called from UI

2. `firestore.rules` - `trainerReviews` collection
   - **Action:** KEEP rules (no harm), but no UI access

### Files to Check for Review/Rating Display
1. `src/trainer-page/screens/TrainerSearchScreen.js` - Check for rating stars/review counts
2. `src/trainer-page/screens/EditTrainerProfileScreen.js` - Check for review display
3. `src/client-page/screens/ProfileScreen.js` - Check if trainer profile shows reviews

---

## Implementation Recommendations

### For V1 Scope Lock

1. **Remove Review UI from TrainerSearchScreen**
   - Remove any rating stars
   - Remove review count badges
   - Remove "View Reviews" buttons

2. **Disable Review Submission**
   - Remove "Write Review" buttons/UI
   - Comment out `submitReview()` calls

3. **Keep Backend Code**
   - Keep `trainerReviews.js` file for future use
   - Keep Firestore collection and rules
   - Add comments: `// V1: Reviews disabled, kept for future use`

4. **Update Documentation**
   - Document that V1 is directory-only
   - Note that reviews are future feature

---

## Verification Checklist

- [ ] No review submission UI exists in trainer discovery flow
- [ ] No rating stars displayed on trainer cards
- [ ] No review counts displayed
- [ ] No average ratings calculated/displayed
- [ ] Trainer directory shows: name, bio, certs, specialties, location only
- [ ] Client can message trainer directly (connection flow works)
- [ ] No marketplace-style sorting (by popularity, rating, etc.)
- [ ] No pricing/subscription requirements for discovery

