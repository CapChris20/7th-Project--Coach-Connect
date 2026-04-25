# CoachConnect AI - Fitness Coach App

A comprehensive React Native fitness application with AI-powered coaching, workout tracking, nutrition logging, and trainer-client connections.

## What This App Does

### For Clients
- **Workout Tracking**: Create workouts, track exercises with sets/reps, use rest timers, view workout history
- **Nutrition Logging**: Log meals, track macros (calories, protein, carbs, fat), scan barcodes, set nutrition goals
- **Voice AI Coach**: Conversational AI assistant for fitness/nutrition questions (voice and text)
- **Trainer Discovery**: Browse trainer directory, view profiles, initiate messaging
- **Progress Tracking**: Log body measurements, track weight, view analytics and charts
- **Profile Management**: Edit profile, manage settings, view stats

### For Trainers
- **Client Management**: View client list, see client details and progress
- **Messaging**: Communicate with clients via real-time messaging
- **Profile Management**: Edit trainer profile (bio, certifications, specialties, location)
- **Workout Assignment**: Assign workouts to clients (feature exists)

## Tech Stack

- **Framework**: React Native with Expo SDK ~52.0.0
- **Backend**: Firebase (Authentication, Firestore, Storage)
- **AI Services**: OpenAI (GPT-4o-mini, Whisper STT, TTS)
- **Web Search**: Serper API (for detailed text responses)
- **Server**: Express.js (runs on port 4000, proxies OpenAI/Serper APIs)
- **State Management**: React hooks (useState, useEffect)
- **Navigation**: Custom modal-based navigation (no React Navigation stack)

## How Trainer Discovery Works

**This app uses a TRAINER DIRECTORY, not a marketplace.**

### Discovery Features (V1)
- **Opt-in Discoverability**: Trainers appear in directory when `role == 'trainer'` in Firestore
- **Directory List**: All trainers are listed (sorted alphabetically)
- **Basic Filters**: Search by name, specialization, location, or bio
- **Client Request Flow**: Clients can message trainers directly from the directory
- **Trainer Approve**: Trainers receive messages and can respond (approval via messaging)

### Not Included (V1)
- Reviews or ratings
- Rankings or popularity sorting
- Featured trainers
- Trainer pricing
- Subscription requirements for access

## How to Run Locally

### Prerequisites
- Node.js (v18+)
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator or Android Studio (for mobile development)

### Installation

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment variables**
   Create a `.env` file in the root directory with:
   ```env
   # Firebase
   EXPO_PUBLIC_FIREBASE_API_KEY=your_key
   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_domain
   EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_bucket
   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   EXPO_PUBLIC_FIREBASE_APP_ID=your_app_id

   # OpenAI
   EXPO_PUBLIC_OPENAI_API_KEY=your_key

   # Serper (optional, for web search)
   SERPER_API_KEY=your_key

   # Server URL (optional, defaults to localhost:4000)
   EXPO_PUBLIC_API_BASE_URL=http://localhost:4000
   ```

3. **Start the backend server** (in a separate terminal)
   ```bash
   npm run server
   ```
   Server runs on `http://localhost:4000`

4. **Start Expo development server**
   ```bash
   npm start
   ```

5. **Run on device/simulator**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app (for physical device)

## Required Environment Variables

### Firebase (Required)
- `EXPO_PUBLIC_FIREBASE_API_KEY`
- `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `EXPO_PUBLIC_FIREBASE_PROJECT_ID`
- `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `EXPO_PUBLIC_FIREBASE_APP_ID`

### OpenAI (Required for Voice AI)
- `EXPO_PUBLIC_OPENAI_API_KEY`

### Serper API (Optional - enables web search for detailed responses)
- `SERPER_API_KEY` (server-side only)

### Server URL (Optional)
- `EXPO_PUBLIC_API_BASE_URL` (defaults to `http://localhost:4000`)

## Project Structure

```
src/
├── app/                    # App-level components (AuthGate, TrainerApp, ClientApp)
├── login/                  # Authentication and onboarding screens
├── client-page/            # Client-only screens
├── trainer-page/           # Trainer-only screens (CRM)
├── workout/                # Workout screens and components
├── workouts/               # Additional workout screens (JSX)
├── nutrition/              # Nutrition screens and components
├── voice-ai/               # Voice AI screens and components
├── ai/                     # AI chat screens and components
├── bottom-navbar/          # Bottom navigation component
├── extra/                  # Shared utilities
│   ├── api/                # API services (Firebase, OpenAI, etc.)
│   ├── app/                # App config, theme, constants
│   └── components/         # Shared UI components
└── ui/                     # UI library components
```

## Known Limitations

1. **Payment Backend**: Stripe integration incomplete (frontend SDK integrated, backend endpoints are placeholders)
2. **Push Notifications**: UI exists but notification sending not implemented
3. **Navigation TODOs**: Some screens (progress, programs) exist but navigation not fully wired
4. **Trainer Analytics**: Placeholder UI only, not implemented
5. **Meal Plan Creation**: Flow incomplete

## What Is Intentionally NOT Implemented (V1)

- Trainer reviews/ratings (this is a directory, not a marketplace)
- Trainer rankings or popularity sorting
- Marketplace-style features (pricing, subscriptions for access)
- Advanced trainer discovery filters (beyond basic search)

## Additional Documentation

- `docs/CODEBASE_AUDIT.md` - Comprehensive codebase audit
- `docs/CLEANUP_REPORT.md` - Dead code and duplication audit
- `docs/TRAINER_DISCOVERY_V1_SCOPE.md` - Trainer discovery scope definition
- `docs/CURRENT_STATE.txt` - Current feature status and next steps

## License

[Add license information here]

