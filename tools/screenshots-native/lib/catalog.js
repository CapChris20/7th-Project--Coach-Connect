// Screen inventory for native Maestro screenshot capture.
// Live Gmail Maestro accounts = with-data only; empty logged-in states are skipped.

const AUTH_SCREENS = [
  {
    screen: 'login-welcome',
    role: 'both',
    state: 'empty',
    route: null,
    long: false,
    expect: ['Get Started', 'Sign In'],
    navigate: ['auth-welcome'],
  },
  {
    screen: 'login-form',
    role: 'both',
    state: 'empty',
    route: null,
    long: false,
    expect: ['Welcome Back', 'Submit login'],
    navigate: ['auth-login-form'],
  },
  {
    screen: 'signup-form',
    role: 'both',
    state: 'empty',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Sign', 'email'],
    navigate: ['auth-signup-form'],
  },
  {
    screen: 'forgot-password',
    role: 'both',
    state: 'empty',
    route: null,
    long: false,
    expect: ['password', 'Reset|Forgot|email'],
    navigate: ['auth-forgot-password'],
  },
];

const CLIENT_WITH_DATA = [
  {
    screen: 'client-home',
    role: 'client',
    state: 'with-data',
    route: 'ClientMainTabs',
    long: true,
    scrollFrames: 3,
    expect: ['Home', 'Nutrition Today|Good Morning|Good Afternoon|Good Evening|Explore Dashboard'],
    navigate: ['client-tab-home'],
  },
  {
    screen: 'client-dashboard',
    role: 'client',
    state: 'with-data',
    route: 'ClientDashboard',
    long: true,
    scrollFrames: 4,
    expect: ['YOUR DASHBOARD|Welcome back|Dashboard'],
    navigate: ['client-dashboard'],
  },
  {
    screen: 'client-nutrition',
    role: 'client',
    state: 'with-data',
    route: 'ClientNutrition',
    long: true,
    scrollFrames: 3,
    expect: ['Nutrition|Calories|Search foods'],
    navigate: ['client-tab-nutrition'],
  },
  {
    screen: 'client-food-search',
    role: 'client',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Add Food|Search foods'],
    navigate: ['client-food-search'],
  },
  {
    screen: 'client-confirm-food',
    role: 'client',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Log it|CAL|Serving|Confirm'],
    navigate: ['client-confirm-food'],
  },
  {
    screen: 'client-nutrition-goals',
    role: 'client',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Goal|Calorie|Protein|Settings|Target'],
    navigate: ['client-nutrition-goals'],
  },
  {
    screen: 'client-workout',
    role: 'client',
    state: 'with-data',
    route: 'ClientWorkoutPlan',
    long: true,
    scrollFrames: 3,
    expect: ['Workout|Generate Plan|Workout Plans|Library'],
    navigate: ['client-tab-workout'],
  },
  {
    screen: 'client-exercise-library',
    role: 'client',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Library|Exercise|Search|Saved|Plan'],
    navigate: ['client-exercise-library'],
  },
  {
    screen: 'client-ai',
    role: 'client',
    state: 'with-data',
    route: 'ClientAI',
    long: true,
    scrollFrames: 3,
    expect: ['AI Coach|Ask your coach'],
    navigate: ['client-tab-ai'],
  },
  {
    screen: 'client-ai-chat',
    role: 'client',
    state: 'with-data',
    route: 'ClientAIChat',
    long: true,
    scrollFrames: 2,
    expect: ['Ask your coach|Message input|AI Coach'],
    navigate: ['client-ai-chat'],
  },
  {
    screen: 'client-profile',
    role: 'client',
    state: 'with-data',
    route: 'ClientProfile',
    long: true,
    scrollFrames: 3,
    expect: ['Profile|Sign out|Edit'],
    navigate: ['client-profile'],
  },
  {
    screen: 'client-settings',
    role: 'client',
    state: 'with-data',
    route: 'ClientSettings',
    long: true,
    scrollFrames: 4,
    expect: ['Settings|Edit Profile|Blocked users|Workout Reminders'],
    navigate: ['client-settings'],
  },
  {
    screen: 'client-help-faq',
    role: 'client',
    state: 'with-data',
    route: 'ClientHelpFAQ',
    long: true,
    scrollFrames: 3,
    expect: ['Help|FAQ|Question'],
    navigate: ['client-help-faq'],
  },
  {
    screen: 'client-trainer-search',
    role: 'client',
    state: 'with-data',
    route: 'ClientTrainerSearch',
    long: true,
    scrollFrames: 3,
    expect: ['Find a Trainer|Browse|Trainer'],
    navigate: ['client-trainer-search'],
  },
  {
    screen: 'client-inbox',
    role: 'client',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 2,
    expect: ['Messages|Conversations|Inbox|No messages'],
    navigate: ['client-inbox'],
  },
  {
    screen: 'client-weekly-report',
    role: 'client',
    state: 'with-data',
    route: 'ClientWeeklyReport',
    long: true,
    scrollFrames: 3,
    expect: ['Weekly|Report|Sleep|Water'],
    navigate: ['client-weekly-report'],
  },
];

const TRAINER_WITH_DATA = [
  {
    screen: 'trainer-home',
    role: 'trainer',
    state: 'with-data',
    route: 'TrainerMain',
    long: true,
    scrollFrames: 4,
    expect: ['Active Clients|Pending Requests|Home|Clients'],
    navigate: ['trainer-home'],
  },
  {
    screen: 'trainer-progress',
    role: 'trainer',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Progress|Weight|Sessions'],
    navigate: ['trainer-progress-tab'],
  },
  {
    screen: 'trainer-sessions',
    role: 'trainer',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Sessions|Schedule|Upcoming'],
    navigate: ['trainer-sessions-tab'],
  },
  {
    screen: 'trainer-nutrition-tab',
    role: 'trainer',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Nutrition|Calories|Protein|Meal'],
    navigate: ['trainer-nutrition-tab'],
  },
  {
    screen: 'trainer-clients',
    role: 'trainer',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 3,
    expect: ['Clients|All Clients|Trainee'],
    navigate: ['trainer-clients'],
  },
  {
    screen: 'trainer-client-detail',
    role: 'trainer',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 4,
    expect: ['Progress|Sessions|Nutrition|Messages'],
    navigate: ['trainer-client-detail'],
  },
  {
    screen: 'trainer-messages',
    role: 'trainer',
    state: 'with-data',
    route: null,
    long: true,
    scrollFrames: 2,
    expect: ['Messages|Conversations|No messages'],
    navigate: ['trainer-messages'],
  },
  {
    screen: 'trainer-workout',
    role: 'trainer',
    state: 'with-data',
    route: 'TrainerWorkoutPlan',
    long: true,
    scrollFrames: 3,
    expect: ['Workout|Generate|Plan|Library'],
    navigate: ['trainer-workout'],
  },
  {
    screen: 'trainer-settings',
    role: 'trainer',
    state: 'with-data',
    route: 'TrainerSettings',
    long: true,
    scrollFrames: 4,
    expect: ['Settings|Edit Profile|Blocked users'],
    navigate: ['trainer-settings'],
  },
  {
    screen: 'trainer-profile',
    role: 'trainer',
    state: 'with-data',
    route: 'TrainerProfile',
    long: true,
    scrollFrames: 3,
    expect: ['Profile|Sign out|Edit'],
    navigate: ['trainer-profile'],
  },
  {
    screen: 'trainer-payments',
    role: 'trainer',
    state: 'with-data',
    route: 'TrainerPayments',
    long: true,
    scrollFrames: 3,
    expect: ['Payment|Payout|Stripe|Pro|Billing'],
    navigate: ['trainer-payments'],
  },
];

const EMPTY_SKIPPED_REASON =
  'Live Maestro accounts used — empty logged-in state skipped to avoid wiping production user data';

function buildManifestSeed() {
  const entries = [];

  for (const item of AUTH_SCREENS) {
    entries.push({
      ...item,
      scrollIndex: 0,
      file: null,
      status: 'pending',
      reason: null,
      captureMethod: 'maestro-ios',
      attempts: 0,
    });
  }

  for (const item of [...CLIENT_WITH_DATA, ...TRAINER_WITH_DATA]) {
    // Empty counterpart skipped for live accounts
    entries.push({
      screen: item.screen,
      role: item.role,
      state: 'empty',
      route: item.route || null,
      file: null,
      status: 'skipped',
      reason: EMPTY_SKIPPED_REASON,
      captureMethod: 'maestro-ios',
      scrollIndex: null,
      attempts: 0,
    });

    const frames = item.long ? item.scrollFrames || 3 : 1;
    for (let i = 0; i < frames; i += 1) {
      const suffix =
        frames === 1
          ? ''
          : i === 0
            ? '--01-top'
            : i === frames - 1
              ? `--${String(i + 1).padStart(2, '0')}-bottom`
              : `--${String(i + 1).padStart(2, '0')}-scroll`;
      const fileBase = `${item.screen}${suffix}`;
      entries.push({
        screen: item.screen,
        role: item.role,
        state: item.state,
        route: item.route || null,
        file: `src/screenshots/${item.state}/${item.role}/${fileBase}.png`,
        status: 'pending',
        reason: null,
        captureMethod: 'maestro-ios',
        scrollIndex: i,
        scrollFrames: frames,
        expect: item.expect,
        navigate: item.navigate,
        attempts: 0,
      });
    }
  }

  return entries;
}

module.exports = {
  AUTH_SCREENS,
  CLIENT_WITH_DATA,
  TRAINER_WITH_DATA,
  EMPTY_SKIPPED_REASON,
  buildManifestSeed,
};
