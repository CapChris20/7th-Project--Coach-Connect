// Muscle groups for exercise filtering
export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'traps',
  'lats',
  'delts',
  'core',
  'full_body',
  'cardio'
];

// Diet types
export const DIET_TYPES = [
  'balanced',
  'keto',
  'paleo',
  'vegan',
  'vegetarian',
  'mediterranean',
  'low_carb',
  'high_protein',
  'intermittent_fasting',
  'flexible_dieting'
];

// Activity levels
export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary', description: 'Little to no exercise' },
  { value: 'light', label: 'Lightly Active', description: 'Light exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderately Active', description: 'Moderate exercise 3-5 days/week' },
  { value: 'active', label: 'Very Active', description: 'Hard exercise 6-7 days/week' },
  { value: 'very_active', label: 'Extremely Active', description: 'Very hard exercise, physical job' }
];

// Fitness goals
export const FITNESS_GOALS = [
  { value: 'weight_loss', label: 'Weight Loss', description: 'Lose weight and burn fat' },
  { value: 'muscle_gain', label: 'Muscle Gain', description: 'Build muscle and strength' },
  { value: 'maintenance', label: 'Maintenance', description: 'Maintain current physique' },
  { value: 'endurance', label: 'Endurance', description: 'Improve cardiovascular fitness' },
  { value: 'flexibility', label: 'Flexibility', description: 'Improve mobility and flexibility' },
  { value: 'strength', label: 'Strength', description: 'Increase overall strength' }
];

// Workout types
export const WORKOUT_TYPES = [
  'strength_training',
  'cardio',
  'hiit',
  'yoga',
  'pilates',
  'swimming',
  'running',
  'cycling',
  'walking',
  'dancing',
  'martial_arts',
  'crossfit',
  'bodyweight',
  'functional'
];

// Equipment options
export const EQUIPMENT_OPTIONS = [
  'none',
  'dumbbells',
  'barbell',
  'kettlebell',
  'resistance_bands',
  'pull_up_bar',
  'bench',
  'squat_rack',
  'cable_machine',
  'treadmill',
  'bike',
  'elliptical',
  'full_gym'
];

// Subscription plans
export const SUBSCRIPTION_PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 9.99,
    features: ['Basic meal plans', 'Exercise library', 'Progress tracking'],
    popular: false
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 19.99,
    features: ['AI meal planning', 'Voice coaching', 'Advanced analytics', 'Custom workouts'],
    popular: true
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29.99,
    features: ['Everything in Premium', '1-on-1 coaching', 'Priority support', 'Advanced features'],
    popular: false
  }
];

// Measurement units
export const MEASUREMENT_UNITS = {
  weight: ['kg', 'lbs'],
  height: ['cm', 'ft'],
  distance: ['km', 'miles'],
  temperature: ['celsius', 'fahrenheit']
};

// Notification types
export const NOTIFICATION_TYPES = [
  'meal_reminder',
  'workout_reminder',
  'water_reminder',
  'progress_update',
  'motivational',
  'achievement'
];

// App colors
export const APP_COLORS = {
  primary: '#000000',
  secondary: '#1a1a1a',
  accent: '#ff6b35',
  success: '#28a745',
  warning: '#ffc107',
  error: '#dc3545',
  info: '#17a2b8',
  background: '#ffffff',
  surface: '#f8f9fa',
  text: '#212529',
  textSecondary: '#6c757d'
};

