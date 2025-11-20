# 📱 ANATROX AI - App Structure & Components

## 🎯 Main Entry Point
- **`App.js`** - Main app component, handles routing, authentication, and all screen navigation

---

## 📂 Core Structure

### 🔐 Authentication & Onboarding
**Location:** `src/screens/auth/` & `src/screens/onboarding/`
- `LoginScreen.js` - User login with email/password and Google OAuth
- `SignupScreen.js` - User registration (client/trainer selection)
- `ForgotPasswordScreen.js` - Password reset
- `OnboardingScreen.js` - First-time user onboarding
- `OnboardingStep1Screen.js` - Onboarding step 1
- `OnboardingStep2Screen.js` - Onboarding step 2

### 👤 Profile & Settings
**Location:** `src/screens/profile/`
- `ProfileScreen.js` - User profile display
- `EditProfileScreen.js` - Edit profile (name, email, role, trainer details)
- `SettingsScreen.js` - App settings (theme, preferences)
- `SubscriptionScreen.js` - Subscription management

### 💬 Chat & Messaging
**Location:** `src/screens/chat/` & `src/screens/trainer/`
- `ChatScreen.js` - GPT AI chat interface
- `ChatListScreen.js` - List of GPT chat conversations
- `ConversationSettingsScreen.js` - Chat settings
- `TrainerSearchScreen.js` - Search for trainers (client view)
- `TrainerMessagingScreen.js` - Trainer-client messaging interface

### 🏋️ Workout
**Location:** `src/screens/workout/`
- `ActiveWorkoutScreen.js` - Active workout session
- `ExerciseDetailScreen.js` - Exercise information
- `ExerciseLibraryScreen.js` - Browse exercises
- `WorkoutHistoryScreen.js` - Past workouts
- `WorkoutProgramsScreen.js` - Workout programs
- `WorkoutSummaryScreen.js` - Workout completion summary

### 🥗 Nutrition
**Location:** `src/screens/nutrition/`
- `FoodLogScreen.js` - Log meals
- `FoodSearchScreen.js` - Search for foods
- `BarcodeScannerScreen.js` - Scan food barcodes
- `MacroTrackerScreen.js` - Track macros
- `MealDetailScreen.js` - Meal details
- `MealPlanGeneratorScreen.js` - Generate meal plans
- `MealPlanHomeScreen.js` - Meal plan dashboard

### 🎤 Voice AI
**Location:** `src/screens/voice/`
- `VoiceChatScreen.js` - Voice chat interface
- `VoiceCoachHomeScreen.js` - Voice coach home
- `VoiceSettingsScreen.js` - Voice settings

### 📊 Dashboard & Analytics
**Location:** `src/screens/dashboard/`
- `DashboardScreen.js` - Main dashboard
- `NutritionAnalyticsScreen.js` - Nutrition analytics
- `ProgressAnalyticsScreen.js` - Progress tracking
- `WorkoutAnalyticsScreen.js` - Workout analytics

### 🏋️ Trainer Features
**Location:** `src/screens/trainer/`
- `TrainerSearchScreen.js` - Search trainers (for clients)
- `TrainerMessagingScreen.js` - Messaging interface
- `ClientManagementScreen.js` - Manage clients (trainer view)
- `ClientDetailScreen.js` - Client details
- `AssignWorkoutScreen.js` - Assign workouts to clients

### 🔧 Admin
**Location:** `src/screens/admin/`
- `RoleMigrationScreen.js` - Update user roles (admin tool)

### 📏 Body Tracking
**Location:** `src/screens/body/`
- `LogMeasurementsScreen.js` - Log body measurements

### 💊 Supplements
**Location:** `src/screens/supplements/`
- `SupplementListScreen.js` - Browse supplements
- `SupplementDetailScreen.js` - Supplement details
- `SupplementSearchScreen.js` - Search supplements

---

## 🧩 Components

### 🧭 Navigation
**Location:** `src/components/navigation/`
- `BottomNavBar.js` - Bottom navigation bar with icons

### 🎨 Common Components
**Location:** `src/components/common/`
- `NavIcon.js` - Icon component for navigation
- `CreateModal.js` - Modal for creating workouts/meals
- `Avatar.js` - User avatar component
- `Button.js` - Reusable button
- `Card.js` - Card container
- `Input.js` - Text input component
- `LoadingSpinner.js` - Loading indicator
- `Modal.js` - Modal wrapper
- `ProgressBar.js` - Progress bar
- `ErrorMessage.js` - Error display

### 💬 Chat Components
**Location:** `src/components/chat/`
- `MessageBubble.js` - Chat message bubble
- `ChatPreviewCard.js` - Chat preview card
- `TypingIndicator.js` - Typing animation

### 📊 Chart Components
**Location:** `src/components/charts/`
- `MacroDonut.js` - Macro nutrition donut chart
- `ProgressChart.js` - Progress visualization
- `WeightChart.js` - Weight tracking chart

### 🏋️ Workout Components
**Location:** `src/components/workout/`
- `ExerciseCard.js` - Exercise display card
- `MuscleGroupFilter.js` - Filter by muscle group
- `RestTimer.js` - Rest timer component
- `SetLogger.js` - Log workout sets
- `WorkoutTimer.js` - Workout timer

### 🥗 Nutrition Components
**Location:** `src/components/nutrition/`
- `AddFoodModal.js` - Add food modal
- `FoodItem.js` - Food item display
- `MacroBar.js` - Macro progress bar
- `MealCard.js` - Meal display card

### 📏 Body Components
**Location:** `src/components/body/`
- `MeasurementCard.js` - Body measurement card
- `PhotoComparison.js` - Before/after photos
- `ProgressTimeline.js` - Progress timeline

### 🤖 AI Components
**Location:** `src/components/ai/`
- `ApiKeyInput.js` - API key input for OpenAI

---

## 🪝 Custom Hooks
**Location:** `src/hooks/`
- `useChat.js` - GPT chat functionality (load/save messages)
- `useAuth.js` - Authentication logic
- `useUser.js` - User data management
- `useWorkout.js` - Workout state management
- `useMealPlan.js` - Meal plan logic
- `useExercises.js` - Exercise data
- `useBodyData.js` - Body measurements
- `useVoice.js` - Voice AI features
- `useSubscription.js` - Subscription management

---

## 🔧 Services

### 🔥 Firebase Services
**Location:** `src/services/firebase/`
- `config.js` - Firebase configuration
- `auth.js` - Authentication service
- `firestore.js` - Firestore database operations
- `storage.js` - File storage
- `trainerMessaging.js` - Trainer-client messaging (conversations, messages, unread counts)

### 🤖 AI Services
**Location:** `src/services/ai/`
- `chatService.js` - GPT chat service
- `chatStorageService.js` - Save/load chat history (AsyncStorage)
- `apiKeyService.js` - Store/retrieve API keys
- `imageService.js` - Image picker and processing
- `openai.js` - OpenAI API client
- `claude.js` - Claude AI integration
- `prompts.js` - AI prompts
- `supplementGPT.js` - Supplement recommendations
- `webSearch.js` - Web search integration

### 🎤 Voice Services
**Location:** `src/services/voice/`
- `voiceService.js` - Voice AI functionality

### 🌐 API Services
**Location:** `src/services/api/`
- `exerciseDB.js` - Exercise database API
- `foodDatabase.js` - Food database API
- `stripe.js` - Payment processing

### 💾 Storage Services
**Location:** `src/services/`
- `chatStorageService.js` - AsyncStorage for chats
- `supabase/` - Supabase integration (if used)

---

## 🎨 Context & State

### 🎨 Theme Context
**Location:** `src/context/`
- `ThemeContext.js` - Theme provider (light/dark mode)

### 📦 State Management
**Location:** `src/store/`
- `authStore.js` - Authentication state (Zustand)
- `userStore.js` - User data state
- `workoutStore.js` - Workout state

---

## ⚙️ Configuration

### 🎨 Theme Config
**Location:** `src/config/`
- `theme.js` - Color schemes, typography, spacing

### 🔐 Environment
**Location:** `src/config/`
- `env.js` - Environment variables

---

## 🛠️ Utilities
**Location:** `src/utils/`
- `calculations.js` - Math calculations (BMI, macros, etc.)
- `formatting.js` - Date/time formatting
- `validation.js` - Form validation
- `constants.js` - App constants
- `permissions.js` - Permission helpers
- `migrateUserRoles.js` - User role migration utility

---

## 📱 Main App Flow

1. **App.js** → Entry point
   - Handles authentication state
   - Routes to Login/Signup or Main App
   - Manages all screen navigation
   - Handles GPT chat, trainer messaging, profile, etc.

2. **Authentication Flow:**
   - `LoginScreen` → `SignupScreen` → `OnboardingScreen` → Main App

3. **Main App (App.js):**
   - Shows home dashboard
   - Bottom navigation bar
   - Floating GPT button
   - Modal screens (settings, profile, chat, etc.)

4. **Trainer/Client Features:**
   - Clients: Search trainers → Message trainers
   - Trainers: View conversations → Message clients

---

## 🔑 Key Files to Understand

### For Messaging:
- `src/services/firebase/trainerMessaging.js` - All messaging logic
- `src/screens/trainer/TrainerMessagingScreen.js` - Messaging UI
- `src/screens/trainer/TrainerSearchScreen.js` - Trainer search

### For GPT Chat:
- `src/hooks/useChat.js` - Chat state management
- `src/screens/chat/ChatScreen.js` - Chat UI
- `src/services/ai/chatService.js` - OpenAI integration
- `src/services/ai/chatStorageService.js` - Save/load chats

### For Navigation:
- `App.js` - Main routing logic
- `src/components/navigation/BottomNavBar.js` - Bottom nav

### For Theme:
- `src/context/ThemeContext.js` - Theme provider
- `src/config/theme.js` - Theme configuration

---

## 📝 Notes

- **Firebase**: Used for authentication, Firestore database, and storage
- **AsyncStorage**: Used for local chat history storage
- **Expo**: React Native framework
- **State Management**: React hooks + Zustand stores
- **Navigation**: Custom navigation in App.js (not React Navigation)

