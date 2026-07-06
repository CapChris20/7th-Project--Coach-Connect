/** Step metadata for onboarding snapshot gallery (mirrors OnboardingWizardScreen titles). */

export const FOOD_CARD_GRADIENTS = {
  protein: ['#9A3412', '#FF3D8A'],
  carbs: ['#A67C00', '#FF6B9D'],
  fat: ['#0891B2', '#8B5CF6'],
  calories: ['#9A3412', '#8B5CF6'],
};

export const OPTION_GRADIENTS = [
  FOOD_CARD_GRADIENTS.protein,
  FOOD_CARD_GRADIENTS.carbs,
  FOOD_CARD_GRADIENTS.fat,
  FOOD_CARD_GRADIENTS.calories,
];

export const CLIENT_STEPS = [
  {
    step: 1,
    title: 'Tell us about yourself',
    subtitle: 'This helps us personalize your experience',
    type: 'inputs',
    fields: ['Weight', 'Height', 'Age'],
    options: ['Male', 'Female', 'Other', 'Prefer not to say'],
  },
  {
    step: 2,
    title: "What's your fitness experience?",
    type: 'list',
    options: ['Beginner', 'Intermediate', 'Advanced'],
  },
  {
    step: 3,
    title: "What's your main goal?",
    subtitle: 'Select all that apply',
    type: 'list',
    options: ['Lose Fat', 'Build Muscle', 'Maintain Health', 'Athletic Performance', 'Improve Mental Health', 'Build Consistency & Habits'],
  },
  {
    step: 4,
    title: 'What equipment do you have access to?',
    subtitle: 'Select all that apply',
    type: 'grid',
    options: ['Full Gym', 'Dumbbells', 'Resistance Bands', 'Pull-up Bar', 'Bodyweight Only', 'Home', 'Gym', 'Both'],
  },
  {
    step: 5,
    title: 'How many days per week can you train?',
    type: 'days',
    options: ['Morning', 'Afternoon', 'Evening', 'No preference'],
  },
  {
    step: 6,
    title: 'Any injuries or limitations?',
    subtitle: "We'll help you work around them safely",
    type: 'textarea',
    options: ['Injuries field', 'Exercises you would prefer', 'Supplements'],
  },
  {
    step: 7,
    title: 'Do you have a trainer?',
    type: 'list',
    options: ['Yes, I have a trainer code', 'No, I\u2019ll train independently'],
  },
  {
    step: 8,
    title: 'Describe Your Situation',
    subtitle: 'Optional details — then tell us your story below (required)',
    type: 'textarea',
    options: ['Stress level chips', 'Situation description'],
  },
  {
    step: 9,
    title: 'AI-Powered Features',
    type: 'ai',
    options: ['AI Fitness Coach', 'Workout Generator', 'Smart Progress Tracking', 'Form & Recovery Tips'],
  },
];

export const TRAINER_STEPS = [
  {
    step: 1,
    title: 'What certifications do you have?',
    subtitle: 'Select all that apply.',
    type: 'list',
    options: ['NASM-CPT', 'ACE', 'ISSA', 'ACSM', 'NSCA-CPT', 'Other', 'No formal certification'],
  },
  {
    step: 2,
    title: 'How long have you been training clients?',
    subtitle: 'Tell clients how long you\u2019ve been coaching.',
    type: 'list',
    options: ['Less than 1 year', '1–2 years', '3–5 years', '6–10 years', '10+ years'],
  },
  {
    step: 3,
    title: 'What are your specialties?',
    subtitle: 'Select all that apply.',
    type: 'pills',
    options: ['Strength Training', 'Weight Loss', 'Bodybuilding', 'Athletic Performance', 'HIIT', 'Nutrition Coaching'],
  },
  {
    step: 4,
    title: 'Describe your training philosophy',
    subtitle: 'Help clients understand your approach.',
    type: 'textarea',
    options: ['Philosophy text area'],
  },
  {
    step: 5,
    title: 'Availability & session format',
    subtitle: 'Set how clients can book with you.',
    type: 'list',
    options: ['Available now', 'Waitlist', 'Remote', 'In-person', 'Both'],
  },
  {
    step: 6,
    title: 'Almost done!',
    subtitle: 'A few last details for your profile.',
    type: 'inputs',
    fields: ['Full name', 'City, State', 'Short bio', 'Profile photo'],
  },
  {
    step: 7,
    title: 'Your client invite code',
    subtitle: 'Share this with your clients to get started.',
    type: 'invite',
    options: ['TRAINER-DEMO12', 'Copy Code', 'Share'],
  },
  {
    step: 8,
    title: 'Coach Connect Pro',
    type: 'subscription',
    options: ['Pro monthly', 'Pro annual', 'Feature list'],
  },
];

export function allSnapshotSteps() {
  return [
    ...CLIENT_STEPS.map((s) => ({ role: 'client', ...s })),
    ...TRAINER_STEPS.map((s) => ({ role: 'trainer', ...s })),
  ];
}
