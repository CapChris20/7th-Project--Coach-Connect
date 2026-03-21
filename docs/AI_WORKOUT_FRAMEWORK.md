# AI-Powered Workout Framework

## Overview

A clean, modular Claude-based AI framework for generating personalized workout plans. This framework is designed to be simple, editable, and easy to extend.

## Structure

### 1. Claude API Client
**Location:** `src/services/ai/claudeClient.js`

A simple, focused Claude API client with:
- Direct API key configuration (ready to use)
- Clean `sendClaudePrompt()` function
- Automatic context formatting
- Error handling
- Optional `generateWorkoutPlan()` helper

### 2. Onboarding Data Structure
**Location:** `src/services/ai/onboardingData.js`

Structured onboarding questions covering:
- Fitness goals
- Experience level
- Workout location & equipment
- Frequency & duration
- Injuries/limitations
- Workout style preferences
- Motivation level

Each question is a data object with:
- `id` - Unique identifier
- `label` - Display text
- `type` - Input type (select, multi-select, number, text)
- `options` - Available choices (if applicable)
- `required` - Whether the question is mandatory
- `conditional` - Optional conditional logic

## Usage Flow

### Step 1: Collect Onboarding Data

```javascript
import { onboardingQuestions, buildUserProfile } from '../services/ai/onboardingData';

// In your onboarding UI component:
// 1. Render questions based on onboardingQuestions array
// 2. Collect answers into an object
const answers = {
  fitness_goal: 'muscle_gain',
  experience_level: 'intermediate',
  workout_location: 'gym',
  available_equipment: ['dumbbells', 'barbell', 'bench'],
  workout_frequency: 4,
  workout_duration: 60,
  injuries_limitations: null,
  workout_style: 'hypertrophy',
  disliked_exercises: 'burpees',
  motivation_level: 'high'
};

// 3. Build structured profile
const userProfile = buildUserProfile(answers);
```

### Step 2: Generate Workout Plan

```javascript
import { generateWorkoutPlan } from '../services/ai/claudeClient';

// Generate workout plan with user context
const result = await generateWorkoutPlan(userProfile);

if (result.error) {
  console.error('Error:', result.error);
} else {
  console.log('Workout Plan:', result.text);
  // Use result.text in your UI
}
```

### Step 3: Custom Prompts (Advanced)

```javascript
import { sendClaudePrompt } from '../services/ai/claudeClient';
import { formatProfileForPrompt } from '../services/ai/onboardingData';

// Custom prompt with user context
const userContext = buildUserProfile(answers);
const formattedContext = formatProfileForPrompt(userContext);

const prompt = `Generate a 4-week progressive workout plan. ${formattedContext}`;

const result = await sendClaudePrompt(prompt, userContext, {
  systemPrompt: 'You are an expert fitness coach.',
  maxTokens: 4096
});
```

## How Onboarding Data Flows to AI

1. **Collection**: UI collects answers using the `onboardingQuestions` structure
2. **Transformation**: `buildUserProfile()` converts raw answers to structured object
3. **Formatting**: `formatProfileForPrompt()` (or automatic context formatting) prepares data for Claude
4. **API Call**: Claude receives formatted context along with the workout generation prompt
5. **Response**: Claude generates personalized workout plan based on user context

The context is automatically formatted as:
```
--- USER CONTEXT ---
fitness_goal: muscle_gain
experience_level: intermediate
workout_location: gym
available_equipment: dumbbells, barbell, bench
workout_frequency: 4
workout_duration: 60
workout_style: hypertrophy
motivation_level: high
disliked_exercises: burpees
--- END CONTEXT ---
```

## Extending the Framework

### Adding New Questions

Simply add to the `onboardingQuestions` array:

```javascript
{
  id: 'preferred_time',
  label: 'What time of day do you prefer to work out?',
  type: 'select',
  required: false,
  options: [
    { value: 'morning', label: 'Morning' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'evening', label: 'Evening' }
  ]
}
```

### Conditional Questions

Use the `conditional` property to show/hide questions:

```javascript
{
  id: 'gym_access',
  label: 'What type of gym membership do you have?',
  type: 'select',
  conditional: {
    showIf: {
      field: 'workout_location',
      value: ['gym', 'both']
    }
  },
  // ... options
}
```

### Custom System Prompts

Modify the system prompt in `generateWorkoutPlan()` or pass custom prompts:

```javascript
const result = await sendClaudePrompt(
  'Generate a beginner-friendly plan',
  userProfile,
  {
    systemPrompt: 'You are a patient, encouraging trainer...',
    maxTokens: 2048
  }
);
```

## File Locations

- **Claude Client**: `src/services/ai/claudeClient.js`
- **Onboarding Data**: `src/services/ai/onboardingData.js`
- **Documentation**: `docs/AI_WORKOUT_FRAMEWORK.md`

## API Configuration

The API key is configured directly in `claudeClient.js`. For production:
- Move to environment variable
- Or use secure key management service
- Current key is ready to use for development

## Notes

- This is an MVP framework - simple and practical
- All logic is modular and readable
- Easy to extend without overengineering
- No backend infrastructure required
- Pure JavaScript/JSX - no TypeScript

