# Anatrox - AI-Powered Fitness App

A comprehensive React Native Expo fitness application with AI-powered meal planning, workout tracking, body progress monitoring, and voice coaching features.

## 🚀 Features

- **AI Meal Planning**: Personalized meal plans using Claude AI
- **Workout Tracking**: Exercise library with progress monitoring
- **Body Progress**: Photo comparison and measurement tracking
- **Voice Coaching**: AI-powered voice assistant for fitness guidance
- **Nutrition Analytics**: Macro tracking and food database integration
- **Progress Dashboard**: Comprehensive analytics and insights

## 📱 Tech Stack

- **Framework**: React Native with Expo SDK 52
- **Navigation**: React Navigation 6
- **State Management**: Zustand
- **Backend**: Firebase (Auth, Firestore, Storage)
- **Database**: Supabase
- **AI Services**: Claude AI, OpenAI
- **APIs**: ExerciseDB, OpenFoodFacts, Stripe
- **Styling**: React Native StyleSheet with custom theme

## 🛠 Setup Instructions

### Prerequisites

- Node.js (v18 or higher)
- Expo CLI (`npm install -g @expo/cli`)
- iOS Simulator (for iOS development)
- Android Studio (for Android development)

### Installation

1. **Clone and Install Dependencies**
   ```bash
   cd "7th Project- Anatrox AI"
   npm install
   ```

2. **Environment Configuration**
   ```bash
   cp .env.example .env
   ```
   
   Fill in your API keys in `.env`:
   - Firebase configuration (from Firebase Console)
   - Supabase URL and anon key
   - Claude API key (from console.anthropic.com)
   - OpenAI API key (from platform.openai.com)
   - ExerciseDB API key (from RapidAPI.com)
   - Stripe publishable key

3. **Start Development Server**
   ```bash
   npm start
   ```

### API Setup Guide

#### Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication, Firestore, and Storage
4. Copy configuration keys to `.env`

#### Supabase Setup
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project
3. Go to Settings > API
4. Copy URL and anon key to `.env`

#### Claude AI Setup
1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Create an API key
3. Add to `.env` as `EXPO_PUBLIC_CLAUDE_API_KEY`

#### OpenAI Setup
1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an API key
3. Add to `.env` as `EXPO_PUBLIC_OPENAI_API_KEY`

#### ExerciseDB Setup
1. Go to [RapidAPI](https://rapidapi.com/)
2. Subscribe to ExerciseDB API
3. Copy API key to `.env`

#### Stripe Setup
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get publishable key from Developers > API Keys
3. Add to `.env` as `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## 📁 Project Structure

```
src/
├── navigation/          # Navigation components
├── screens/            # All app screens
│   ├── auth/           # Authentication screens
│   ├── profile/        # User profile screens
│   ├── body/           # Body tracking screens
│   ├── nutrition/      # Nutrition screens
│   ├── workout/        # Workout screens
│   ├── voice/          # Voice coaching screens
│   └── dashboard/      # Analytics screens
├── components/         # Reusable components
│   ├── common/         # Common UI components
│   ├── charts/        # Chart components
│   ├── body/           # Body tracking components
│   ├── nutrition/      # Nutrition components
│   └── workout/        # Workout components
├── services/           # API services
│   ├── firebase/       # Firebase services
│   ├── supabase/       # Supabase services
│   ├── ai/             # AI services
│   ├── api/             # External APIs
│   └── voice/           # Voice services
├── hooks/              # Custom React hooks
├── store/              # Zustand stores
├── utils/              # Utility functions
└── config/             # Configuration files
```

## 🤖 Development Work Distribution: AI vs Manual

This table outlines what AI can generate automatically versus what requires manual implementation and customization.

### 📊 Work Distribution Legend
- **AI Work (80-100%)**: AI generates complete, functional code
- **AI Work (50-80%)**: AI generates structure, you customize logic/business rules
- **Manual Work (80-100%)**: Requires your domain knowledge, API integration, or custom logic
- **Review/Testing**: Both AI and you collaborate on testing and refinement

### 🎯 Screens

| Screen | AI Work | Your Work | Complexity |
|--------|---------|-----------|------------|
| **ChatListScreen.js** | 90% - Component structure, UI layout, Firestore queries, real-time listeners | 10% - Business logic rules, notification preferences, filtering logic | Medium |
| **ChatScreen.js** | 85% - Message rendering, input handling, Firestore integration, typing indicators | 15% - Message formatting rules, attachment handling, custom emoji reactions | High |
| **ConversationSettingsScreen.js** | 80% - Settings UI, toggle switches, modal components | 20% - Privacy settings logic, block/unblock rules, notification settings | Low |
| **SupplementSearchScreen.js** | 70% - Search UI, input handling, filtering components | 30% - Search algorithm, supplement data structure, categorization logic | Medium |
| **SupplementDetailScreen.js** | 85% - Detail view layout, data rendering, navigation | 15% - Supplement data schema, dosage calculations, interaction warnings | Medium |
| **SupplementListScreen.js** | 75% - List rendering, filtering UI, pagination | 25% - Category organization, sorting logic, filter combinations | Low |
| **ClientManagementScreen.js** | 80% - Client list UI, card components, navigation | 20% - Client data structure, trainer-client relationship logic, permissions | Medium |
| **ClientDetailScreen.js** | 85% - Dashboard layout, data visualization, tab navigation | 15% - Progress metrics calculation, chart data formatting, workout history logic | High |
| **AssignWorkoutScreen.js** | 70% - Workout selection UI, exercise picker, form components | 30% - Workout assignment logic, schedule rules, notification triggers | High |
| **ClientDashboardScreen.js** | 85% - Dashboard layout, chart components, data display | 15% - Progress calculations, goal tracking logic, achievement system | Medium |
| **SignupScreen.js** (Update) | 60% - Role toggle UI, form structure | 40% - Role selection logic, user type routing, profile setup differences | Medium |
| **DashboardScreen.js** (Update) | 65% - Conditional rendering structure, tab navigation | 35% - Trainer vs Client dashboard logic, role-based data fetching, permissions | High |

### 🧩 Components

| Component | AI Work | Your Work | Complexity |
|-----------|---------|-----------|------------|
| **MessageBubble.js** | 90% - Bubble styling, message rendering, timestamp formatting | 10% - Custom message types, media rendering, link previews | Low |
| **ChatPreviewCard.js** | 85% - Card layout, avatar display, last message preview | 15% - Unread count logic, timestamp formatting, status indicators | Low |
| **TypingIndicator.js** | 95% - Animation logic, dot indicators, timing | 5% - Customization of animation speed/style | Low |

### 🔧 Services

| Service | AI Work | Your Work | Complexity |
|---------|---------|-----------|------------|
| **chatService.js** | 85% - Firestore message CRUD, real-time listeners, query structure | 15% - Message validation rules, security rules, rate limiting | High |
| **conversationService.js** | 75% - Conversation CRUD, participant management, metadata handling | 25% - Conversation rules, privacy settings, notification logic | Medium |
| **supplementGPT.js** | 70% - OpenAI API integration, prompt structure, response handling | 30% - Prompt engineering, response parsing, error handling, cost optimization | High |
| **ai/index.js** | 95% - Export structure, module organization | 5% - Custom exports if needed | Low |
| **supplements.js** (data) | 40% - Data structure template | 60% - **Manual data entry** - Supplement database, categories, dosages, interactions | High |

### 🗂️ Navigation

| File | AI Work | Your Work | Complexity |
|------|---------|-----------|------------|
| **MainNavigator.js** (Update) | 70% - Tab navigator structure, screen definitions | 30% - Role-based navigation logic, conditional tab rendering, permissions | High |

### 📝 Summary Statistics

| Category | Total Files | Avg AI Work | Avg Your Work | Notes |
|----------|-------------|-------------|---------------|-------|
| **New Screens** | 10 | 78% | 22% | Most screens are UI-heavy, AI excels here |
| **New Components** | 3 | 90% | 10% | Components are highly reusable, AI generates well |
| **New Services** | 4 | 79% | 21% | Services need your business logic and API keys |
| **Data Files** | 1 | 40% | 60% | **Critical**: Supplement database requires manual research |
| **Updated Files** | 3 | 65% | 35% | Integration with existing codebase requires your knowledge |

### 🎯 Key Manual Work Areas

1. **Supplement Database (`supplements.js`)**
   - **Why Manual**: Requires domain expertise, research, and accuracy
   - **Your Work**: Research supplement data, dosages, interactions, side effects
   - **Time Estimate**: 8-12 hours for comprehensive database

2. **Business Logic & Rules**
   - Trainer-client relationship management
   - Workout assignment permissions
   - Chat moderation rules
   - Role-based access control

3. **API Integration & Configuration**
   - Firebase security rules
   - Firestore data structure design
   - OpenAI prompt engineering for supplements
   - Real-time synchronization logic

4. **Testing & Refinement**
   - Test all screens on iOS/Android
   - Verify real-time chat functionality
   - Test role-based navigation
   - Validate supplement search accuracy

### 💡 Development Strategy

1. **Phase 1: AI-Generated Structure** (AI: 80%, You: 20%)
   - Let AI generate all screen/component structures
   - Review and adjust as needed

2. **Phase 2: Data & Business Logic** (AI: 30%, You: 70%)
   - Manually create supplement database
   - Implement role-based logic
   - Set up Firestore security rules

3. **Phase 3: Integration** (AI: 50%, You: 50%)
   - Connect services to screens
   - Implement navigation flows
   - Test user journeys

4. **Phase 4: Polish & Testing** (AI: 20%, You: 80%)
   - Manual testing on devices
   - UI/UX refinements
   - Performance optimization
   - Bug fixes

### ⚠️ Important Notes

- **Supplement Database**: This is the biggest manual task. Consider using an external API or purchasing a supplement database.
- **Firebase Security Rules**: Critical for production - must be manually configured based on your app's security requirements.
- **Role-Based Logic**: Trainer vs Client features require careful planning of user flows and permissions.
- **Real-Time Chat**: Test thoroughly on both iOS and Android - real-time features can be platform-specific.

## 🎨 Styling

The app uses a custom theme system with React Native StyleSheet:

```javascript
import { colors, typography, spacing } from './src/config/theme';

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
});
```

## 🔧 Available Scripts

- `npm start` - Start Expo development server
- `npm run android` - Run on Android device/emulator
- `npm run ios` - Run on iOS simulator
- `npm run web` - Run on web browser

## 📱 Platform Support

- iOS (iOS 13+)
- Android (API 21+)
- Web (limited functionality)

## 🔐 Permissions

The app requires the following permissions:
- Camera (for progress photos and barcode scanning)
- Microphone (for voice coaching)
- Photo Library (for saving progress photos)

## 🚀 Deployment

### Development Build
```bash
expo build:android
expo build:ios
```

### Production Build
```bash
expo build:android --type app-bundle
expo build:ios --type archive
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Check the documentation
- Open an issue on GitHub
- Contact the development team

---

**Anatrox** - Your AI-powered fitness companion 🏋️‍♀️💪


