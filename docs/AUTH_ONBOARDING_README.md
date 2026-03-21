# Authentication and Onboarding Flow - Implementation Status

## Overview

This document tracks the implementation of a complete authentication and onboarding flow for both client and trainer roles with Apple-style subtle gradients. The implementation is in progress.

---

## ✅ Completed Components

### 1. Reusable Components

#### `src/components/onboarding/GradientCard.jsx`
- **Purpose**: Reusable gradient card component with animations
- **Features**:
  - Vertical gradient background (2 colors)
  - Press animations (scale to 0.98)
  - Selected state with darker gradient (10% darker)
  - Multi-select support with checkmark overlay
  - Three size variants: small (80px), medium (120px), large (160px)
  - Disabled state support
  - Smooth spring animations using react-native-reanimated
- **Props**:
  - `colors`: Array of 2 gradient colors
  - `selected`: Boolean for selected state
  - `onPress`: Function handler
  - `disabled`: Boolean for disabled state
  - `multiSelect`: Boolean to show checkmark when selected
  - `size`: 'small' | 'medium' | 'large'
  - `children`: Content inside card
  - `style`: Additional styles

#### `src/components/onboarding/OnboardingProgress.jsx`
- **Purpose**: Progress indicator component showing current step in onboarding flow
- **Features**:
  - Visual progress pills (6 total steps)
  - Completed steps: Green gradient with checkmark icon
  - Current step: Purple gradient with pulse animation
  - Upcoming steps: Gray gradient
  - Title display
  - Step counter ("Step X of Y")
  - Smooth animations using react-native-reanimated
- **Props**:
  - `currentStep`: Number (1-6)
  - `totalSteps`: Number (default: 6)
  - `title`: String (screen title)

---

### 2. Authentication Screens

#### `src/auth/WelcomeScreen.js`
- **Purpose**: Entry point screen for the authentication flow
- **Features**:
  - Subtle gradient background (#FAFAFA to #F5F5F5)
  - App logo/title "ANATROX" centered at top
  - Tagline: "Your personal fitness journey starts here"
  - Two action buttons:
    - **Get Started**: Primary gradient button (#8B5CF6 to #7C3AED)
    - **I already have an account**: Ghost button (text only)
  - Smooth fade-in animations
  - Full-screen layout with SafeAreaView
- **Props**:
  - `navigation`: Navigation object (optional)
  - `onGetStarted`: Function to navigate to role selection
  - `onHaveAccount`: Function to navigate to login
- **Design**:
  - Apple-style subtle gradients
  - Clean, minimal design
  - Smooth animations on mount

#### `src/auth/RoleSelectionScreen.js`
- **Purpose**: Screen for users to select their role (Trainer or Client)
- **Features**:
  - Title: "I am a..."
  - Subtitle: "Choose your role to continue"
  - Two large role cards (stacked vertically):
    - **Trainer Card**: Purple gradient (#8B5CF6 to #7C3AED) with dumbbell emoji (💪)
    - **Client Card**: Green gradient (#10B981 to #059669) with running emoji (🏃)
  - Each card shows:
    - Large icon/emoji
    - Role title (white, bold)
    - Subtitle description
  - Back button (if provided)
  - Smooth animations
  - Card height: 200px, rounded corners: 20px
- **Props**:
  - `navigation`: Navigation object (optional)
  - `onSelectRole`: Function called with 'trainer' or 'client'
  - `onBack`: Function to go back (optional)
- **Design**:
  - Vibrant gradient cards
  - Large, touchable areas
  - Clear visual distinction between roles

---

## ⏳ Pending Implementation

### 3. Authentication Screen Updates

#### `src/login/screens/SignupScreen.js` (Needs Update)
- **Required Changes**:
  - Accept `role` parameter from RoleSelectionScreen
  - Display role badge at top: "Signing up as Trainer" or "Signing up as Client"
  - Different gradient based on role:
    - Trainer: Purple gradient (#8B5CF6 to #7C3AED)
    - Client: Green gradient (#10B981 to #059669)
  - Form fields: First Name, Last Name, Email, Password, Confirm Password
  - Validation: All fields required, email format, password min 8 chars, passwords must match
  - On success: Create Firebase Auth account, create user document with `role` field, set `onboardingCompleted: false`, navigate to appropriate onboarding screen

#### `src/login/screens/LoginScreen.js` (Needs Update)
- **Required Changes**:
  - Title: "Welcome Back"
  - Standard login form (email, password)
  - "Forgot Password?" link
  - On successful login:
    - Fetch user data from Firestore
    - Check `onboardingCompleted` status:
      - If `false` → Navigate to appropriate onboarding (TrainerOnboarding or ClientOnboarding)
      - If `true` → Navigate to main app (TrainerApp or ClientApp)

---

### 4. Onboarding Screens

#### `src/auth/ClientOnboardingScreen.js` (To Be Created)
- **Purpose**: 6-screen onboarding flow for clients
- **Screens**:
  1. **Fitness Experience Level**: Beginner, Intermediate, Advanced
  2. **Primary Goal**: Lose Fat, Build Muscle, Maintain Health, Athletic Performance
  3. **Equipment Access**: Full Gym, Dumbbells, Resistance Bands, Pull-up Bar, Bodyweight Only (multi-select)
  4. **Training Frequency**: 1-7 days per week (horizontal scrollable)
  5. **Injuries or Limitations**: Optional text input (can skip)
  6. **Connect to Trainer**: Optional trainer invite code input (can skip)
- **Data Structure**:
  - `fitnessLevel`: string
  - `primaryGoal`: string
  - `equipmentAccess`: array
  - `daysPerWeek`: number
  - `injuries`: string or null
  - `trainerId`: string or null
  - `onboardingCompleted`: true
  - `onboardingCompletedAt`: timestamp

#### `src/auth/TrainerOnboardingScreen.js` (To Be Created)
- **Purpose**: 6-screen onboarding flow for trainers
- **Screens**:
  1. **Certifications**: Multiple selection (NASM-CPT, ACE, ISSA, ACSM, NSCA-CPT, Other, No formal certification)
  2. **Years of Experience**: Less than 1 year, 1-2 years, 3-5 years, 6-10 years, 10+ years
  3. **Training Specialties**: Multiple selection grid (Strength Training, Weight Loss, Bodybuilding, Athletic Performance, Rehabilitation, Powerlifting, CrossFit, Yoga/Flexibility, Senior Fitness, Youth Training)
  4. **Training Approach**: Text input (200-500 characters) describing training philosophy
  5. **Pricing**: Optional per session and per month rates (can skip)
  6. **Generate Invite Code**: Auto-generate unique 6-character invite code (ABC-123 format)
- **Data Structure**:
  - `certifications`: array
  - `yearsExperience`: string
  - `specialties`: array
  - `trainingPhilosophy`: string
  - `pricing`: object with perSession and perMonth fields
  - `inviteCode`: string (unique, auto-generated)
  - `onboardingCompleted`: true
  - `onboardingCompletedAt`: timestamp

---

### 5. App.js Updates (Needs Update)

- **Required Changes**:
  - Initial route logic: Check auth state
    - If NOT logged in → Navigate to WelcomeScreen
    - If logged in:
      - Fetch user document from Firestore
      - Check `onboardingCompleted` field:
        - If `false` → Navigate to appropriate onboarding screen
        - If `true` → Navigate to main app based on role
  - Navigation stack integration:
    - Welcome
    - RoleSelection
    - SignUp
    - Login
    - TrainerOnboarding
    - ClientOnboarding
    - TrainerApp
    - ClientApp

---

### 6. Firebase Schema Documentation (Needs Documentation)

#### Client Users (`users` collection)
- `uid`: string
- `email`: string
- `firstName`: string
- `lastName`: string
- `role`: 'client'
- `photoURL`: string or null
- `fitnessLevel`: string
- `primaryGoal`: string
- `equipmentAccess`: array
- `daysPerWeek`: number
- `injuries`: string or null
- `trainerId`: string or null
- `onboardingCompleted`: boolean
- `onboardingCompletedAt`: timestamp
- `createdAt`: timestamp
- `updatedAt`: timestamp

#### Trainer Users (`users` collection)
- `uid`: string
- `email`: string
- `firstName`: string
- `lastName`: string
- `role`: 'trainer'
- `photoURL`: string or null
- `certifications`: array
- `yearsExperience`: string
- `specialties`: array
- `trainingPhilosophy`: string
- `pricing`: object
  - `perSession`: number or null
  - `perMonth`: number or null
- `inviteCode`: string (unique)
- `onboardingCompleted`: boolean
- `onboardingCompletedAt`: timestamp
- `createdAt`: timestamp
- `updatedAt`: timestamp

---

## File Structure

```
src/
├── auth/
│   ├── WelcomeScreen.js ✅
│   ├── RoleSelectionScreen.js ✅
│   ├── ClientOnboardingScreen.js ⏳
│   └── TrainerOnboardingScreen.js ⏳
├── components/
│   └── onboarding/
│       ├── GradientCard.jsx ✅
│       └── OnboardingProgress.jsx ✅
└── login/
    └── screens/
        ├── SignupScreen.js ⏳ (needs update)
        └── LoginScreen.js ⏳ (needs update)
```

---

## Design Guidelines

### Gradients
- All vertical (top to bottom)
- Subtle, Apple-style (not vibrant)
- 2 colors maximum, close on color spectrum
- Selected state: 10% darker version of base gradient

### Cards
- Border radius: 12-16px
- Soft shadows: shadowOpacity: 0.08, shadowRadius: 8
- Padding: 16-24px
- Smooth transitions on all interactions

### Animations
- Duration: 200-300ms
- Use spring animations for scaling
- Smooth easing curves
- Pulse animations for current step indicators

### Typography
- Titles: 28px bold
- Subtitles: 16px regular, gray color
- Card text: 18px medium
- Counter/helper text: 14px regular

### Color Palette
- **Primary Purple**: #8B5CF6 to #7C3AED (Trainer)
- **Primary Green**: #10B981 to #059669 (Client)
- **Neutral Gray**: #E5E7EB to #D1D5DB
- **Background**: #FAFAFA to #F5F5F5

---

## Integration Notes

### Current Status
- ✅ Reusable components (GradientCard, OnboardingProgress) are ready to use
- ✅ WelcomeScreen and RoleSelectionScreen are implemented
- ⏳ Onboarding screens need to be created
- ⏳ SignupScreen and LoginScreen need updates
- ⏳ App.js routing logic needs integration

### Next Steps
1. Create ClientOnboardingScreen (6 screens)
2. Create TrainerOnboardingScreen (6 screens)
3. Update SignupScreen to accept role parameter and use role-based styling
4. Update LoginScreen to check onboarding status and route accordingly
5. Update App.js to integrate new auth flow
6. Document Firebase schema changes

---

## Usage Examples

### Using GradientCard
```jsx
import GradientCard from '../components/onboarding/GradientCard';

<GradientCard
  colors={['#8B5CF6', '#7C3AED']}
  selected={isSelected}
  onPress={() => handleSelect()}
  multiSelect={true}
  size="medium"
>
  <Text>Card Content</Text>
</GradientCard>
```

### Using OnboardingProgress
```jsx
import OnboardingProgress from '../components/onboarding/OnboardingProgress';

<OnboardingProgress
  currentStep={3}
  totalSteps={6}
  title="What's your fitness experience?"
/>
```

### Using WelcomeScreen
```jsx
import WelcomeScreen from '../auth/WelcomeScreen';

<WelcomeScreen
  onGetStarted={() => navigateToRoleSelection()}
  onHaveAccount={() => navigateToLogin()}
/>
```

### Using RoleSelectionScreen
```jsx
import RoleSelectionScreen from '../auth/RoleSelectionScreen';

<RoleSelectionScreen
  onSelectRole={(role) => navigateToSignup(role)}
  onBack={() => navigateToWelcome()}
/>
```

---

## Testing Checklist

- [ ] GradientCard animations work smoothly
- [ ] GradientCard selected state darkens correctly
- [ ] OnboardingProgress displays correct step state
- [ ] OnboardingProgress pulse animation works
- [ ] WelcomeScreen buttons navigate correctly
- [ ] RoleSelectionScreen cards navigate correctly
- [ ] All gradients render correctly
- [ ] All animations are smooth
- [ ] All text is readable
- [ ] All touch targets are adequately sized

---

## Notes

- All components use `react-native-reanimated` for animations
- All components use `expo-linear-gradient` for gradients
- Components are designed to work with the existing app structure
- Firebase integration will be added when onboarding screens are created
- Navigation logic will be integrated when App.js is updated

---

## Last Updated

- **Date**: Current session
- **Status**: In Progress (4/10 components completed)
- **Next**: Create onboarding screens and update auth screens

