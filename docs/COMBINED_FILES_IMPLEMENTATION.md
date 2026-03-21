# Combined Files Implementation Plan

## Overview
The user requested combining multiple auth and onboarding files into 2 main files:
1. `src/auth/AuthScreen.js` - Combines WelcomeScreen, RoleSelectionScreen, SignupScreen, LoginScreen
2. `src/auth/OnboardingScreen.js` - Combines ClientOnboardingScreen and TrainerOnboardingScreen (to be created)

## File Size Concerns
- **AuthScreen.js** will be ~1500+ lines (very large file)
  - WelcomeScreen: ~130 lines
  - RoleSelectionScreen: ~170 lines
  - SignupScreen: ~770 lines
  - LoginScreen: ~464 lines
  - Total: ~1534+ lines

- **OnboardingScreen.js** will be ~1600+ lines when fully implemented
  - ClientOnboardingScreen: ~800+ lines (6 screens)
  - TrainerOnboardingScreen: ~800+ lines (6 screens)
  - Total: ~1600+ lines

## Current Status
- ✅ WelcomeScreen.js exists in `src/auth/`
- ✅ RoleSelectionScreen.js exists in `src/auth/`
- ✅ SignupScreen.js exists in `src/login/screens/` (not in `src/auth/`)
- ✅ LoginScreen.js exists in `src/login/screens/` (not in `src/auth/`)
- ❌ ClientOnboardingScreen.js doesn't exist in `src/auth/` (one exists in `src/components/client/` but it's for trainer-client relationship onboarding)
- ❌ TrainerOnboardingScreen.js doesn't exist

## Implementation Approach

### AuthScreen.js Structure
```javascript
export default function AuthScreen({ onSignupSuccess, onLoginSuccess }) {
  const [currentView, setCurrentView] = useState('welcome'); // 'welcome' | 'roleSelection' | 'signup' | 'login'
  const [selectedRole, setSelectedRole] = useState(null); // 'trainer' | 'client'
  
  // Render views conditionally
  if (currentView === 'welcome') {
    return <WelcomeView onGetStarted={() => setCurrentView('roleSelection')} onHaveAccount={() => setCurrentView('login')} />
  }
  if (currentView === 'roleSelection') {
    return <RoleSelectionView onSelectRole={(role) => { setSelectedRole(role); setCurrentView('signup'); }} onBack={() => setCurrentView('welcome')} />
  }
  if (currentView === 'signup') {
    return <SignupView role={selectedRole} onSignupSuccess={onSignupSuccess} onBack={() => setCurrentView('roleSelection')} onNavigateToLogin={() => setCurrentView('login')} />
  }
  if (currentView === 'login') {
    return <LoginView onLoginSuccess={onLoginSuccess} onNavigateToSignup={() => { setCurrentView('roleSelection'); }} />
  }
}
```

### OnboardingScreen.js Structure
```javascript
export default function OnboardingScreen({ role, onComplete }) {
  // role: 'trainer' | 'client'
  const [currentStep, setCurrentStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState({});
  
  if (role === 'client') {
    // Render client onboarding steps (6 screens)
  } else if (role === 'trainer') {
    // Render trainer onboarding steps (6 screens)
  }
}
```

## Next Steps
1. Create combined AuthScreen.js with all 4 views
2. Create OnboardingScreen.js structure (since ClientOnboardingScreen and TrainerOnboardingScreen don't exist yet, create a placeholder structure)
3. Update App.js to use the new combined files

## Notes
- ForgotPasswordScreen is NOT being combined (user didn't request it)
- All functionality and styling will be preserved
- Navigation will be handled internally with state changes
- File sizes will be very large - consider refactoring later if maintainability becomes an issue












