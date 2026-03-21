# Codebase Audit Report
**Project:** CoachConnect AI - AI Fitness Coach App  
**Date:** Generated automatically  
**Tech Stack:** React Native (Expo), Firebase, OpenAI

---

## Overview

**CoachConnect** is a comprehensive fitness and nutrition coaching mobile application built with React Native (Expo SDK 52). The app serves both clients and trainers with features including workout tracking, nutrition logging, AI-powered voice coaching, trainer discovery, messaging, and subscription management.

### App Type
- **Platform:** React Native mobile app (iOS/Android/Web via Expo)
- **Framework:** Expo SDK ~52.0.0
- **Primary Language:** JavaScript
- **State Management:** React hooks (useState, useEffect), Zustand (limited)
- **Navigation:** Custom modal-based navigation (no React Navigation stack)

### Architecture Pattern
- **Backend:** Firebase (Firestore, Auth, Storage)
- **API Layer:** Express.js server (`server/index.js`) for OpenAI/Serper proxy
- **AI Integration:** OpenAI GPT-4, Whisper (STT), TTS, Claude (Anthropic)
- **Storage:** Firebase Storage, AsyncStorage (local), R2 bucket (mentioned in memories)

---

## Project Tree

```
coachconnect-app/
├── App.js                          # Main app entry, navigation orchestration
├── app.json                        # Expo configuration
├── package.json                    # Dependencies
├── firestore.rules                 # Firestore security rules
├── server/                         # Express backend server
│   └── index.js                    # API proxy (OpenAI, Serper, transcription)
├── functions/                      # Firebase Cloud Functions
│   └── index.js                    # Serverless functions
├── src/
│   ├── ai/                         # AI chat features
│   │   ├── components/             # Chat components, OpenAI clients
│   │   └── screens/                # Chat screens, trainer search
│   ├── api/                        # API service layer (legacy)
│   ├── app/                        # App-level utilities, stores
│   ├── assets/                     # Icons, videos, images
│   ├── bottom-navbar/              # Bottom navigation component
│   ├── client-page/                # Client dashboard screens
│   ├── components/                 # Shared UI components
│   ├── extra/                      # Additional utilities, services
│   │   ├── api/                    # API services (active)
│   │   ├── app/                    # App config, theme, navigation
│   │   └── components/             # UI components
│   ├── login/                      # Auth screens
│   ├── nutrition/                  # Nutrition tracking features
│   ├── settings/                   # Settings screens
│   ├── splash/                     # Splash screen
│   ├── trainer-page/               # Trainer CRM screens
│   ├── ui/                         # UI library (FluidGlass)
│   ├── voice-ai/                   # Voice AI feature
│   ├── workout/                    # Workout features
│   └── workouts/                   # Additional workout screens
├── docs/                           # Documentation
├── utils/                          # Utility functions (error logging)
└── scripts/                        # Build/maintenance scripts
```

---

## Features Implemented

### Auth and Onboarding

**Files:**
- `src/login/screens/LoginScreen.js` - Email/password login, Google/Apple sign-in
- `src/login/screens/SignupScreen.js` - User registration with role selection
- `src/login/screens/ForgotPasswordScreen.js` - Password reset flow
- `src/login/screens/OnboardingScreen.js` - Multi-step onboarding wizard
- `src/login/screens/OnboardingStep1Screen.js` - Onboarding step 1
- `src/login/screens/OnboardingStep2Screen.js` - Onboarding step 2
- `src/app/RoleMigrationScreen.js` - Legacy role migration helper
- `src/extra/api/auth.js` - Auth service utilities

**Responsibilities:**
- Firebase Authentication integration (email/password, Google, Apple)
- User role assignment (client/trainer) during signup
- Onboarding completion tracking in Firestore
- Password reset email functionality

**Status:** ✅ Complete

---

### Role Routing and Permissions

**Files:**
- `App.js` (lines 79-98, 857-1218) - Role-based UI rendering
- `src/extra/app/MainNavigator.js` - Navigation wrapper (empty/minimal)
- `firestore.rules` - Firestore security rules for role-based access

**Responsibilities:**
- Conditional rendering of client vs trainer dashboard based on `user.role`
- Firestore rules enforce user data access (users can read trainer profiles, own data only)
- Role stored in `users/{userId}` document

**Status:** ✅ Complete (basic role-based UI split implemented)

---

### Trainer Side CRM

**Files:**
- `src/trainer-page/screens/ClientManagementScreen.js` - List all clients
- `src/trainer-page/screens/ClientDetailScreen.js` - Individual client details, progress
- `src/trainer-page/screens/TrainerMessagingScreen.js` - Direct messaging with clients
- `src/trainer-page/screens/ConversationsListScreen.js` - Conversation list
- `src/trainer-page/screens/EditTrainerProfileScreen.js` - Trainer profile editor
- `src/trainer-page/screens/AssignWorkoutScreen.js` - Assign workouts to clients
- `src/extra/api/clientCRMService.js` - CRM data operations
- `src/extra/api/trainerReviews.js` - Trainer review management
- `src/ai/screens/ClientDetailScreen.js` - Alternative client detail view

**Responsibilities:**
- Client list management (fetch clients from Firestore)
- Client detail view with workout/nutrition progress
- Trainer-client messaging system
- Trainer profile editing (bio, certifications, specialties, location)
- Workout assignment to clients
- Review collection/display

**Status:** ✅ Mostly complete (some features may be stubbed)

---

### Client Side Dashboard

**Files:**
- `App.js` (lines 958-1217) - Main client dashboard render
- `src/client-page/screens/DashboardScreen.js` - Client dashboard
- `src/client-page/screens/ProfileScreen.js` - User profile screen
- `src/client-page/screens/ClientDashboardScreen.js` - Alternative dashboard
- `src/client-page/screens/SettingsScreen.js` - Settings hub
- `src/client-page/screens/ProgressAnalyticsScreen.js` - Progress charts
- `src/client-page/screens/WorkoutAnalyticsScreen.js` - Workout analytics
- `src/client-page/screens/NutritionAnalyticsScreen.js` - Nutrition analytics
- Multiple settings sub-screens in `src/client-page/screens/`

**Responsibilities:**
- Today's workouts display
- Today's calories/macro stats
- Quick actions (workout, nutrition, trainer search, progress)
- Progress tracking and analytics
- Profile management
- Settings and preferences

**Status:** ✅ Complete (core dashboard functional)

---

### Workouts

**Files:**
- `src/workout/screens/WorkoutProgramsScreen.js` - Workout program library
- `src/workout/screens/ExerciseLibraryScreen.js` - Exercise database browser
- `src/workout/screens/ActiveWorkoutScreen.js` - Active workout session
- `src/workout/screens/WorkoutHistoryScreen.js` - Completed workouts history
- `src/workout/screens/WorkoutSummaryScreen.js` - Post-workout summary
- `src/workout/screens/ExerciseDetailScreen.js` - Exercise instructions/details
- `src/workout/screens/LogMeasurementsScreen.js` - Body measurements logging
- `src/workout/components/SetLogger.js` - Set/rep logging component
- `src/workout/components/RestTimer.js` - Rest timer component
- `src/workout/components/WorkoutTimer.js` - Workout session timer
- `src/workout/components/ExerciseCard.js` - Exercise display card
- `src/workout/components/ProgressTimeline.js` - Progress visualization
- `src/workout/components/PhotoComparison.js` - Before/after photos
- `src/workout/components/MeasurementCard.js` - Measurement display
- `src/workout/components/MuscleGroupFilter.js` - Exercise filtering
- `src/workouts/screens/WorkoutLibraryScreen.jsx` - Workout library (JSX)
- `src/workouts/screens/ActiveWorkoutScreen.jsx` - Active workout (JSX)
- `src/workouts/screens/WorkoutHistoryScreen.jsx` - History (JSX)
- `src/extra/api/workoutService.js` - Workout CRUD operations
- `src/extra/api/exerciseDB.js` - Exercise database service

**Firestore Collections:**
- `workouts` - Daily workout logs (legacy)
- `workoutTemplates` - Reusable workout templates
- `activeWorkouts` - Currently active workout sessions
- `completedWorkouts` - Workout history/completed sessions

**Responsibilities:**
- Workout template creation and management
- Active workout tracking with set/rep logging
- Exercise library with search and filtering
- Workout history and progress tracking
- Rest timer and workout timer
- Body measurements logging
- Progress photos (before/after)

**Status:** ✅ Complete (full workout flow implemented)

---

### Nutrition

**Files:**
- `src/nutrition/screens/MealPlanHomeScreen.js` - Nutrition dashboard
- `src/nutrition/screens/FoodLogScreen.js` - Daily food logging
- `src/nutrition/screens/FoodSearchScreen.js` - Food database search
- `src/nutrition/screens/BarcodeScannerScreen.js` - Barcode scanning for food
- `src/nutrition/screens/MacroTrackerScreen.js` - Macro tracking display
- `src/nutrition/screens/MealDetailScreen.js` - Meal details view
- `src/nutrition/screens/MealPlanGeneratorScreen.js` - AI meal plan generation
- `src/nutrition/screens/NutritionSettingsScreen.js` - Nutrition goals/settings
- `src/nutrition/screens/SupplementListScreen.js` - Supplement list
- `src/nutrition/screens/SupplementDetailScreen.js` - Supplement details
- `src/nutrition/screens/SupplementSearchScreen.js` - Supplement search
- `src/nutrition/components/FoodItem.js` - Food item display
- `src/nutrition/components/MealCard.js` - Meal card component
- `src/nutrition/components/MacroBar.js` - Macro progress bars
- `src/nutrition/components/AddFoodModal.js` - Add food modal
- `src/nutrition/components/supplements.js` - Supplement components
- `src/extra/api/nutritionService.js` - Nutrition CRUD operations
- `src/extra/api/foodDatabase.js` - Food database service (USDA integration)
- `src/ai/components/supplementGPT.js` - AI supplement recommendations

**Firestore Collections:**
- `nutrition_logs` - Daily food logs (fields: `user_id`, `date`, `food_name`, `calories`, `protein`, `carbs`, `fat`, etc.)
- `nutrition_goals` - Daily macro targets (fields: `user_id`, `calorie_target`, `protein_target`, `carbs_target`, `fat_target`, `macro_split`)

**Responsibilities:**
- Daily food logging with macro tracking
- Food database search (USDA integration)
- Barcode scanning for packaged foods
- Macro tracking (calories, protein, carbs, fat) with progress bars
- Meal plan generation (AI-powered)
- Supplement tracking and recommendations
- Nutrition goals management

**Status:** ✅ Complete (full nutrition tracking implemented)

---

### Messaging

**Files:**
- `src/trainer-page/screens/TrainerMessagingScreen.js` - Trainer-client messaging
- `src/trainer-page/screens/ConversationsListScreen.js` - Conversation list
- `src/ai/components/trainerMessaging.js` - Messaging service logic
- `src/extra/api/trainerMessaging.js` - Messaging API service
- `App.js` (lines 252-1311) - Floating messages button with unread count

**Firestore Collections:**
- `conversations` - Conversation metadata (fields: `participants`, `lastMessage`, `updatedAt`)
- `messages` - Individual messages (fields: `senderId`, `conversationId`, `text`, `timestamp`, `read`)

**Responsibilities:**
- Real-time messaging between trainers and clients
- Conversation list with unread message counts
- Message read/unread status tracking
- Unread count badge on floating button

**Status:** ✅ Complete (messaging system functional)

---

### Voice AI

**Files:**
- `src/voice-ai/screens/VoiceAIHomeScreen.js` - Voice AI welcome/entry screen
- `src/voice-ai/screens/VoiceCoachHomeScreen.js` - Active voice conversation screen
- `src/voice-ai/screens/VoiceChatScreen.js` - Legacy voice chat screen
- `src/voice-ai/screens/VoiceSettingsScreen.js` - Voice settings (language, voice selection)
- `src/voice-ai/components/VoiceOrb.js` - Animated voice orb component
- `src/voice-ai/components/useVoice.js` - Voice hook (unused/legacy)
- `src/voice-ai/components/voiceService.js` - Voice service utilities
- `server/index.js` (lines 123-155) - Transcription endpoint (`/api/transcribe`)

**Responsibilities:**
- Voice recording (Expo Audio)
- Speech-to-text via OpenAI Whisper API (via server proxy)
- AI response generation (OpenAI GPT-4o-mini) with summary-first strategy
- Text-to-speech via OpenAI TTS API
- Conversation history storage (AsyncStorage)
- Contextual conversation titles (AI-generated)
- Multi-language support (English, Spanish, French, German, Chinese, etc.)
- Voice selection (Alloy, Echo, Fable, Onyx, Nova, Shimmer)
- Fitness/nutrition-only topic filtering

**Status:** ✅ Complete (full voice AI pipeline implemented)

---

### Find Trainer or Directory

**Files:**
- `src/trainer-page/screens/TrainerSearchScreen.js` - Trainer discovery/search
- `src/ai/screens/TrainerSearchScreen.js` - Alternative trainer search
- `src/extra/api/trainerReviews.js` - Trainer review fetching
- `App.js` (lines 709-720, 1136-1191) - Trainer search navigation and placeholder cards

**Firestore Collections:**
- `users` - Trainer profiles (filtered by `role == 'trainer'`)
- `trainerReviews` - Trainer reviews (fields: `trainerId`, `clientId`, `rating`, `review`, `timestamp`)

**Responsibilities:**
- Trainer profile browsing/search
- Trainer profile details (bio, certifications, specialties, location, reviews)
- Review display and submission
- Trainer selection and messaging initiation

**Status:** ✅ Complete (trainer discovery functional)

---

### Payments and Subscription

**Files:**
- `src/extra/api/stripe.js` - Stripe payment integration
- `src/client-page/screens/SubscriptionScreen.js` - Subscription management screen

**Responsibilities:**
- Stripe initialization (publishable key from env)
- Payment intent creation (stubbed backend endpoint)
- Payment processing flow (incomplete)
- Subscription management UI (basic)

**Status:** ⚠️ Partial (Stripe SDK integrated, but backend endpoints are placeholder URLs)

---

### Storage and Uploads

**Files:**
- `src/extra/api/storage.js` - Firebase Storage utilities
- `src/extra/api/config.js` - Firebase Storage initialization

**Firestore Collections:**
- Uses Firebase Storage (bucket configured in Firebase config)

**Responsibilities:**
- Image upload to Firebase Storage
- Progress photo storage
- Profile picture uploads
- File URL generation

**Status:** ✅ Complete (Firebase Storage integration present)

---

### Notifications

**Files:**
- `src/client-page/screens/NotificationsSettingsScreen.jsx` - Notification preferences
- `src/settings/screens/NotificationsOverviewScreen.jsx` - Notification settings overview
- `src/settings/screens/EmailPreferencesScreen.jsx` - Email notification preferences
- `app.json` - Expo notifications plugin configuration

**Responsibilities:**
- Notification preferences UI
- Expo Notifications integration (configured in app.json)
- Email notification preferences

**Status:** ⚠️ Partial (UI exists, but actual notification sending not implemented)

---

### Analytics

**Files:**
- `src/client-page/screens/ProgressAnalyticsScreen.js` - Progress charts
- `src/client-page/screens/WorkoutAnalyticsScreen.js` - Workout analytics
- `src/client-page/screens/NutritionAnalyticsScreen.js` - Nutrition analytics
- `src/extra/components/ProgressChart.js` - Chart component
- `src/extra/components/WeightChart.js` - Weight tracking chart

**Responsibilities:**
- Progress visualization (charts)
- Workout statistics and trends
- Nutrition macro trends
- Weight tracking over time

**Status:** ✅ Complete (analytics screens and chart components implemented)

---

## Screens and Navigation

### Navigation Architecture

**Type:** Modal-based navigation (no React Navigation stack router)
- Screens shown/hidden via state (`showNutrition`, `showVoice`, `showSettings`, etc.)
- `App.js` orchestrates all screen visibility
- Bottom navigation bar for main navigation

### Screen List

#### Auth & Onboarding
1. **SplashScreen** - `src/splash/SplashScreen.jsx`
2. **LoginScreen** - `src/login/screens/LoginScreen.js`
3. **SignupScreen** - `src/login/screens/SignupScreen.js`
4. **ForgotPasswordScreen** - `src/login/screens/ForgotPasswordScreen.js`
5. **OnboardingScreen** - `src/login/screens/OnboardingScreen.js`
6. **OnboardingStep1Screen** - `src/login/screens/OnboardingStep1Screen.js`
7. **OnboardingStep2Screen** - `src/login/screens/OnboardingStep2Screen.js`

#### Client Dashboard
8. **AppContent (Home)** - `App.js` (lines 50-1439) - Main dashboard
9. **ProfileScreen** - `src/client-page/screens/ProfileScreen.js`
10. **SettingsScreen** - `src/client-page/screens/SettingsScreen.js`
11. **ProgressAnalyticsScreen** - `src/client-page/screens/ProgressAnalyticsScreen.js`
12. **WorkoutAnalyticsScreen** - `src/client-page/screens/WorkoutAnalyticsScreen.js`
13. **NutritionAnalyticsScreen** - `src/client-page/screens/NutritionAnalyticsScreen.js`
14. **SubscriptionScreen** - `src/client-page/screens/SubscriptionScreen.js`
15. **AccountProfileScreen** - `src/client-page/screens/AccountProfileScreen.jsx`
16. **EditProfileScreen** - `src/client-page/screens/EditProfileScreen.js`
17. **GoalsTargetsScreen** - `src/client-page/screens/GoalsTargetsScreen.jsx`
18. **UnitsMeasurementsScreen** - `src/client-page/screens/UnitsMeasurementsScreen.jsx`
19. **NotificationsSettingsScreen** - `src/client-page/screens/NotificationsSettingsScreen.jsx`
20. **PrivacySecurityScreen** - `src/client-page/screens/PrivacySecurityScreen.jsx`
21. **DataStorageScreen** - `src/client-page/screens/DataStorageScreen.jsx`
22. **SocialSharingScreen** - `src/client-page/screens/SocialSharingScreen.jsx`
23. **TutorialsGuidesScreen** - `src/client-page/screens/TutorialsGuidesScreen.jsx`
24. **HelpSupportScreen** - `src/client-page/screens/HelpSupportScreen.jsx`
25. **WorkoutPreferencesScreen** - `src/client-page/screens/WorkoutPreferencesScreen.jsx`

#### Trainer Dashboard
26. **ClientManagementScreen** - `src/trainer-page/screens/ClientManagementScreen.js`
27. **ClientDetailScreen** - `src/trainer-page/screens/ClientDetailScreen.js`
28. **EditTrainerProfileScreen** - `src/trainer-page/screens/EditTrainerProfileScreen.js`
29. **TrainerSearchScreen** - `src/trainer-page/screens/TrainerSearchScreen.js`
30. **TrainerMessagingScreen** - `src/trainer-page/screens/TrainerMessagingScreen.js`
31. **ConversationsListScreen** - `src/trainer-page/screens/ConversationsListScreen.js`
32. **AssignWorkoutScreen** - `src/trainer-page/screens/AssignWorkoutScreen.js`

#### Workouts
33. **WorkoutLibraryScreen** - `src/workouts/screens/WorkoutLibraryScreen.jsx`
34. **ActiveWorkoutScreen** - `src/workouts/screens/ActiveWorkoutScreen.jsx`
35. **WorkoutHistoryScreen** - `src/workouts/screens/WorkoutHistoryScreen.jsx`
36. **WorkoutProgramsScreen** - `src/workout/screens/WorkoutProgramsScreen.js`
37. **ExerciseLibraryScreen** - `src/workout/screens/ExerciseLibraryScreen.js`
38. **ExerciseDetailScreen** - `src/workout/screens/ExerciseDetailScreen.js`
39. **WorkoutSummaryScreen** - `src/workout/screens/WorkoutSummaryScreen.js`
40. **LogMeasurementsScreen** - `src/workout/screens/LogMeasurementsScreen.js`

#### Nutrition
41. **MealPlanHomeScreen** - `src/nutrition/screens/MealPlanHomeScreen.js`
42. **FoodLogScreen** - `src/nutrition/screens/FoodLogScreen.js`
43. **FoodSearchScreen** - `src/nutrition/screens/FoodSearchScreen.js`
44. **BarcodeScannerScreen** - `src/nutrition/screens/BarcodeScannerScreen.js`
45. **MacroTrackerScreen** - `src/nutrition/screens/MacroTrackerScreen.js`
46. **MealDetailScreen** - `src/nutrition/screens/MealDetailScreen.js`
47. **MealPlanGeneratorScreen** - `src/nutrition/screens/MealPlanGeneratorScreen.js`
48. **NutritionSettingsScreen** - `src/nutrition/screens/NutritionSettingsScreen.js`
49. **SupplementListScreen** - `src/nutrition/screens/SupplementListScreen.js`
50. **SupplementDetailScreen** - `src/nutrition/screens/SupplementDetailScreen.js`
51. **SupplementSearchScreen** - `src/nutrition/screens/SupplementSearchScreen.js`

#### Voice AI
52. **VoiceAIHomeScreen** - `src/voice-ai/screens/VoiceAIHomeScreen.js` - Welcome/conversation list
53. **VoiceCoachHomeScreen** - `src/voice-ai/screens/VoiceCoachHomeScreen.js` - Active conversation
54. **VoiceSettingsScreen** - `src/voice-ai/screens/VoiceSettingsScreen.js`
55. **VoiceChatScreen** - `src/voice-ai/screens/VoiceChatScreen.js` (legacy/unused)

#### AI Chat
56. **ChatListScreen** - `src/ai/screens/ChatListScreen.js`
57. **ChatScreen** - `src/ai/screens/ChatScreen.js`
58. **ConversationSettingsScreen** - `src/ai/screens/ConversationSettingsScreen.js`

#### Settings (Nested)
59. **WorkoutRemindersSettingsScreen** - `src/settings/screens/WorkoutRemindersSettingsScreen.jsx`
60. **RestTimerSettingsScreen** - `src/settings/screens/RestTimerSettingsScreen.jsx`
61. **TermsOfServiceScreen** - `src/settings/screens/TermsOfServiceScreen.jsx`
62. **PrivacyPolicyScreen** - `src/settings/screens/PrivacyPolicyScreen.jsx`
63. **HelpFAQScreen** - `src/settings/screens/HelpFAQScreen.jsx`
64. **AboutAppScreen** - `src/settings/screens/AboutAppScreen.jsx`
65. **EmailPreferencesScreen** - `src/settings/screens/EmailPreferencesScreen.jsx`

### Navigation Flow

**Client Flow:**
```
Splash → Login/Signup → Onboarding → Home Dashboard
  ├─ Workout Library → Active Workout → Workout Summary
  ├─ Nutrition (Meal Plan Home) → Food Log → Food Search/Barcode
  ├─ Voice AI Home → Voice Conversation
  ├─ Trainer Search → Trainer Profile → Messaging
  ├─ Profile → Settings → [Various Settings Screens]
  └─ Messages Button → Conversations List → Messaging
```

**Trainer Flow:**
```
Splash → Login/Signup → Onboarding → Trainer Dashboard
  ├─ Client Management → Client Detail
  ├─ Messages → Conversations List → Messaging
  ├─ Edit Trainer Profile
  └─ Assign Workout → [Client Selection]
```

---

## APIs and Integrations

### Firebase

**Services Used:**
- **Firebase Auth** - Authentication (email/password, Google, Apple)
- **Firestore** - NoSQL database
- **Firebase Storage** - File/image storage

**Files:**
- `src/extra/api/config.js` - Firebase initialization
- `src/extra/api/firestore.js` - Firestore CRUD utilities
- `src/extra/api/storage.js` - Storage upload utilities
- `src/extra/api/auth.js` - Auth helpers

**Key Functions:**
- `initializeApp()` - Firebase app initialization
- `getAuth()`, `getFirestore()`, `getStorage()` - Service getters
- `createDoc()`, `getDocById()`, `updateDocById()`, `deleteDocById()` - Firestore operations
- `queryCollection()` - Firestore queries

**Collections Used:**
- `users` - User profiles and roles
- `conversations` - Chat conversations
- `messages` - Chat messages
- `workouts` - Daily workout logs
- `workoutTemplates` - Workout templates
- `activeWorkouts` - Active workout sessions
- `completedWorkouts` - Completed workout history
- `nutrition_logs` - Food logs
- `nutrition_goals` - Macro goals
- `trainerReviews` - Trainer reviews
- `app_errors` - Error logging
- `dailyQuote` - Daily fitness quotes

---

### OpenAI / GPT

**Services Used:**
- **GPT-4o-mini** - Text generation (chat, meal plans, workout plans)
- **Whisper API** - Speech-to-text transcription
- **TTS API** - Text-to-speech (voices: Alloy, Echo, Fable, Onyx, Nova, Shimmer)

**Files:**
- `src/ai/components/openaiClient.js` - Main OpenAI client (`generateResponse()`)
- `src/ai/components/openai.js` - Legacy OpenAI wrapper
- `src/voice-ai/screens/VoiceCoachHomeScreen.js` - Voice AI pipeline (lines 428-660)
- `server/index.js` - Server proxy for OpenAI APIs

**Key Functions:**
- `generateResponse(userPrompt, options)` - GPT text generation
- `askServer(messages, options)` - Server-side GPT with web search
- Transcription endpoint: `POST /api/transcribe` (server)

**Usage:**
- Chat conversations (full responses)
- Voice AI (summary-first strategy: short voice summary + full text detail)
- Meal plan generation
- Workout plan generation
- Supplement recommendations
- Conversation title generation

**API Keys:**
- `EXPO_PUBLIC_OPENAI_API_KEY` - Client-side OpenAI key
- Server uses `OPENAI_API_KEY` or `x-openai-key` header

---

### Claude (Anthropic)

**Files:**
- `src/ai/components/claude.js` - Claude API client

**Status:** ⚠️ Code present but usage unclear (may be unused/experimental)

---

### Serper API (Web Search)

**Files:**
- `src/ai/components/webSearch.js` - Client-side web search (unused)
- `src/extra/api/webSearch.js` - Web search utilities
- `server/index.js` (lines 23-53) - Server-side Serper integration

**Key Functions:**
- `webSearch(query)` - Server-side Google search via Serper API

**Usage:**
- Enabled for text chat responses (detailed information)
- Disabled for voice AI (for speed optimization)

**Configuration:**
- `SERPER_API_KEY` - Server environment variable

---

### Supabase

**Files:**
- `src/extra/api/config.js` (lines 100-109) - Supabase client initialization (commented out)

**Status:** ❌ Not actively used (commented out code, likely replaced by Firebase)

---

### Deepgram

**Status:** ❌ Not found in codebase

---

### ElevenLabs

**Status:** ❌ Not found in codebase

---

### USDA (Food Database)

**Files:**
- `src/extra/api/foodDatabase.js` - Food database service
- `src/api/foodDatabase.js` - Legacy food database

**Usage:**
- Food search functionality
- Macro data for logged foods

**Status:** ✅ Integrated (via food database service)

---

### Express Backend Server

**File:**
- `server/index.js` - Express.js server

**Endpoints:**
- `POST /api/ask` - GPT with optional web search (Serper)
- `POST /api/transcribe` - Audio transcription (Whisper)
- `POST /api/log-error` - Error logging to file
- `POST /api/sync-errors` - Batch error syncing
- `GET /health` - Health check

**Dependencies:**
- `express` - Web server
- `cors` - CORS middleware
- `axios` - HTTP client (for Serper)
- `openai` - OpenAI SDK
- `multer` - File upload handling

**Configuration:**
- `PORT` - Server port (default: 4000)
- `OPENAI_API_KEY` - OpenAI API key
- `SERPER_API_KEY` - Serper API key (optional)

---

## Data Models

### Firestore Collections

#### `users/{userId}`
**Schema:**
- `role` (string) - 'client' or 'trainer'
- `email` (string)
- `displayName` (string)
- `photoURL` (string, optional)
- `onboardingCompleted` (boolean)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- **Trainer-specific fields:**
  - `bio` (string)
  - `certifications` (string)
  - `specialties` (array of strings)
  - `location` (string)

**Rules:** Users can read own data + trainer profiles. Write own data only.

---

#### `conversations/{conversationId}`
**Schema:**
- `participants` (array of user IDs)
- `lastMessage` (string)
- `lastMessageAt` (timestamp)
- `updatedAt` (timestamp)
- `createdAt` (timestamp)

**Rules:** Users can read if participant, create if includes self, update if participant.

---

#### `messages/{messageId}`
**Schema:**
- `senderId` (user ID)
- `conversationId` (string)
- `text` (string)
- `timestamp` (timestamp)
- `read` (boolean)
- `readAt` (timestamp, optional)

**Rules:** Users can read all messages, create if senderId matches, update any.

---

#### `workouts/{workoutId}` (Legacy Daily Workouts)
**Schema:**
- `userId` (user ID)
- `name` (string)
- `date` (string, YYYY-MM-DD)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Rules:** Users can CRUD own workouts only.

---

#### `workoutTemplates/{templateId}`
**Schema:**
- `userId` (user ID)
- `name` (string)
- `exercises` (array of exercise objects)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

**Rules:** Users can CRUD own templates only.

---

#### `activeWorkouts/{activeWorkoutId}`
**Schema:**
- `userId` (user ID)
- `templateId` (string, optional)
- `name` (string)
- `exercises` (array)
- `startTime` (timestamp)
- `status` (string) - 'active' or 'paused'

**Rules:** Users can CRUD own active workouts only.

---

#### `completedWorkouts/{completedWorkoutId}`
**Schema:**
- `userId` (user ID)
- `templateId` (string, optional)
- `name` (string)
- `exercises` (array with completed sets/reps)
- `startTime` (timestamp)
- `endTime` (timestamp)
- `duration` (number, minutes)

**Rules:** Users can read own completed workouts, create only (no update/delete).

---

#### `nutrition_logs/{logId}`
**Schema:**
- `user_id` (user ID)
- `date` (string, YYYY-MM-DD)
- `food_name` (string)
- `calories` (number)
- `protein` (number)
- `carbs` (number)
- `fat` (number)
- `meal_type` (string, optional) - 'breakfast', 'lunch', 'dinner', 'snack'
- `timestamp` (timestamp)

**Rules:** Users can CRUD own logs only.

---

#### `nutrition_goals/{goalId}` (uses userId as document ID)
**Schema:**
- `user_id` (user ID)
- `calorie_target` (number)
- `protein_target` (number)
- `carbs_target` (number)
- `fat_target` (number)
- `macro_split` (object) - `{ protein: 0.3, carbs: 0.4, fat: 0.3 }`
- `updated_at` (timestamp)

**Rules:** Users can CRUD own goals only.

---

#### `trainerReviews/{reviewId}`
**Schema:**
- `trainerId` (user ID)
- `clientId` (user ID)
- `rating` (number, 1-5)
- `review` (string)
- `timestamp` (timestamp)

**Rules:** Anyone can read, clients can create/update/delete own reviews.

---

#### `app_errors/{errorId}`
**Schema:**
- `message` (string)
- `code` (string)
- `context` (string)
- `stack` (string)
- `timestamp` (timestamp)
- `userId` (user ID, optional)

**Rules:** Anyone can create, no read/update/delete (write-only logging).

---

#### `dailyQuote/{quoteId}` (single document: 'today')
**Schema:**
- `quote` (string)
- `author` (string)
- `date` (string, YYYY-MM-DD)
- `updatedAt` (timestamp)

**Rules:** Authenticated users can read, authenticated users can write (app updates daily).

---

### AsyncStorage Keys

**Voice AI Conversations:**
- `VOICE_AI_CONVERSATIONS_{userId}` - JSON array of conversation objects

**Settings:**
- `SELECTED_VOICE` - Selected TTS voice
- `VOICE_AI_PLAYBACK_SPEED` - Playback speed (float)
- `VOICE_AI_LANGUAGE` - Selected language code

**API Keys:**
- OpenAI API key stored via `apiKeyService.js`

---

## Incomplete Areas

### Stubbed/Placeholder Features

1. **Payments (Stripe)**
   - `src/extra/api/stripe.js` - Payment intent creation uses placeholder URL (`https://your-backend.com/create-payment-intent`)
   - Backend payment processing not implemented
   - **Location:** `src/extra/api/stripe.js` lines 28-29

2. **Trainer Dashboard - Create Program**
   - TODO comment in `App.js` line 889: "TODO: Navigate to create program"
   - **Location:** `App.js` line 887-904

3. **Trainer Dashboard - Analytics**
   - TODO comment in `App.js` line 908: "TODO: Navigate to analytics"
   - **Location:** `App.js` line 906-923

4. **Client Dashboard - Progress Navigation**
   - TODO comment in `App.js` line 1042: "TODO: Navigate to progress"
   - **Location:** `App.js` line 1040-1057

5. **Client Dashboard - Programs Navigation**
   - TODO comment in `App.js` line 1091: "TODO: Navigate to programs"
   - **Location:** `App.js` line 1088-1106

6. **Meal Plan Creation**
   - TODO comment in `App.js` line 1323: "TODO: Implement meal plan creation"
   - **Location:** `App.js` line 1322-1325

7. **Placeholder Data**
   - Client dashboard shows placeholder trainer cards (hardcoded trainer names)
   - **Location:** `App.js` lines 1151-1190

8. **OpenAI Client TODOs**
   - TODO comments in `src/ai/components/openaiClient.js` (lines 6, 10, 227)
   - **Location:** `src/ai/components/openaiClient.js`

### Unused/Legacy Files

1. **Voice Chat Screen (Legacy)**
   - `src/voice-ai/screens/VoiceChatScreen.js` - Replaced by VoiceCoachHomeScreen
   
2. **Supabase Integration**
   - Supabase client initialization commented out in `src/extra/api/config.js`

3. **Claude Integration**
   - `src/ai/components/claude.js` present but usage unclear

4. **Duplicate API Folders**
   - `src/api/` (legacy) vs `src/extra/api/` (active)
   - Some files exist in both locations

5. **Duplicate Screen Locations**
   - Some screens exist in multiple locations (e.g., `ClientDetailScreen` in both `src/ai/screens/` and `src/trainer-page/screens/`)

### Incomplete Error Handling

- Error logging system exists but some error paths may not be fully covered
- Some API calls lack comprehensive error handling

---

## Next Recommended Steps

### High Priority

1. **Complete Payment Integration**
   - Implement backend payment intent creation endpoint
   - Connect Stripe webhooks for subscription management
   - Update `src/extra/api/stripe.js` with actual backend URL

2. **Implement Trainer Program Creation**
   - Build workout program creation UI/flow
   - Connect to `workoutTemplates` collection

3. **Complete Trainer Analytics**
   - Build analytics dashboard for trainers
   - Show client progress metrics, engagement stats

4. **Notification System**
   - Implement actual push notification sending (Expo Notifications)
   - Connect to Firebase Cloud Messaging if needed
   - Send notifications for messages, workout reminders

5. **Code Cleanup**
   - Remove duplicate files (`src/api/` vs `src/extra/api/`)
   - Remove unused legacy screens
   - Consolidate duplicate screen components

### Medium Priority

6. **Meal Plan Creation Flow**
   - Complete meal plan creation modal/flow
   - Connect to nutrition logging system

7. **Progress Navigation**
   - Implement actual progress screen navigation from dashboard

8. **Programs Navigation**
   - Implement programs screen navigation from dashboard

9. **Claude Integration Decision**
   - Decide if Claude integration is needed, remove if unused

10. **Supabase Removal**
    - Remove commented Supabase code if not needed

### Low Priority

11. **Code Documentation**
    - Add JSDoc comments to key functions
    - Document API endpoints

12. **Testing**
    - Add unit tests for service functions
    - Add integration tests for critical flows

13. **Performance Optimization**
    - Optimize Firestore queries (add indexes if needed)
    - Optimize image loading and caching

14. **Accessibility**
    - Add accessibility labels to UI components
    - Test with screen readers

---

## Summary

**Total Screens:** ~65 screens  
**Major Features:** 11 feature categories  
**APIs Integrated:** Firebase, OpenAI, Serper, Stripe (partial), USDA  
**Data Collections:** 11 Firestore collections  
**Status:** Core features complete, some navigation TODOs, payment backend needed

The codebase is feature-rich with a solid foundation. Main gaps are in payment processing backend, some navigation flows, and notification delivery.

