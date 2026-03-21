# Combined Files Implementation Notes

## Overview
The user requested combining multiple auth and onboarding screens into 2 main files:
1. `src/auth/AuthScreen.js` - Combines WelcomeScreen, RoleSelectionScreen, SignupScreen, LoginScreen
2. `src/auth/OnboardingScreen.js` - Combines ClientOnboardingScreen and TrainerOnboardingScreen (when they exist)

## Status
- **AuthScreen.js**: To be created (~1000+ lines)
- **OnboardingScreen.js**: Structure to be created (ClientOnboardingScreen and TrainerOnboardingScreen don't exist yet)

## Challenges
1. SignupScreen and LoginScreen use dark theme (#0F0B1E background)
2. WelcomeScreen and RoleSelectionScreen use light theme with gradients (#FAFAFA to #F5F5F5)
3. Need to maintain all functionality while combining
4. Internal state management for navigation between views
5. File size will be very large (~1000+ lines for AuthScreen)

## Approach
- Use internal state for `currentView` ('welcome' | 'roleSelection' | 'signup' | 'login')
- Conditional rendering for each view
- Preserve all styling and functionality
- Handle navigation internally with state changes












