// Builds empty + with-food Firestore/Auth seed payloads using real field names from the app.
// Used by import-seed.js and written as portable JSON under seeds/.

const {
  CLIENT_UID,
  TRAINER_UID,
  EXTRA_TRAINER_UID,
  CLIENT_EMAIL,
  TRAINER_EMAIL,
  PLACEHOLDER_PHOTO_URL,
} = require('./constants');

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function weekBounds(date = new Date()) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { weekStart: todayKey(start), weekEnd: todayKey(end) };
}

function authUsers() {
  return [
    {
      localId: CLIENT_UID,
      email: CLIENT_EMAIL,
      emailVerified: true,
      displayName: 'Screenshot Client',
      passwordEnv: 'SCREENSHOT_CLIENT_PASSWORD',
    },
    {
      localId: TRAINER_UID,
      email: TRAINER_EMAIL,
      emailVerified: true,
      displayName: 'Screenshot Trainer',
      passwordEnv: 'SCREENSHOT_TRAINER_PASSWORD',
    },
  ];
}

function emptyFirestore() {
  const now = new Date().toISOString();
  return {
    documents: [
      {
        path: `users/${CLIENT_UID}`,
        data: {
          uid: CLIENT_UID,
          email: CLIENT_EMAIL,
          role: 'client',
          firstName: 'Screenshot',
          lastName: 'Client',
          name: 'Screenshot Client',
          displayName: 'Screenshot Client',
          onboardingCompleted: true,
          onboardingCompletedAt: now,
          createdAt: now,
          updatedAt: now,
          favoriteFoods: [],
        },
      },
      {
        path: `users/${TRAINER_UID}`,
        data: {
          uid: TRAINER_UID,
          email: TRAINER_EMAIL,
          role: 'trainer',
          firstName: 'Screenshot',
          lastName: 'Trainer',
          name: 'Screenshot Trainer',
          displayName: 'Screenshot Trainer',
          onboardingCompleted: true,
          onboardingCompletedAt: now,
          createdAt: now,
          updatedAt: now,
          specialties: ['Strength', 'Nutrition'],
          certifications: ['NASM-CPT'],
          inviteCode: 'SHOT01',
          trainerProfileBio: 'Screenshot trainer profile for UI redesign captures.',
          yearsExperience: '3-5',
        },
      },
      {
        path: `trainers/${TRAINER_UID}`,
        data: {
          uid: TRAINER_UID,
          name: 'Screenshot Trainer',
          displayName: 'Screenshot Trainer',
          photoURL: '',
          specialties: ['Strength', 'Nutrition'],
          bio: 'Screenshot trainer profile for UI redesign captures.',
          certifications: ['NASM-CPT'],
          inviteCode: 'SHOT01',
          onboardingCompleted: true,
          available: true,
          rating: 0,
          reviewCount: 0,
          createdAt: now,
          updatedAt: now,
        },
      },
      {
        path: `nutrition_goals/${CLIENT_UID}`,
        data: {
          user_id: CLIENT_UID,
          calories: 2200,
          calorie_target: 2200,
          proteinTarget: 150,
          protein_target: 150,
          carbsTarget: 220,
          carbs_target: 220,
          fatTarget: 70,
          fat_target: 70,
          macroSplit: { protein: 0.3, carbs: 0.4, fat: 0.3 },
          macro_split: { protein: 0.3, carbs: 0.4, fat: 0.3 },
          updated_at: now,
        },
      },
    ],
    deleteQueryHints: [
      { collection: 'nutrition_logs', where: ['user_id', '==', CLIENT_UID] },
      { collection: 'payments', where: ['trainer_id', '==', TRAINER_UID] },
      { collection: 'conversations', where: ['clientId', '==', CLIENT_UID] },
      { collection: 'messages', where: ['senderId', '==', CLIENT_UID] },
    ],
  };
}

function withFoodFirestore() {
  const now = new Date().toISOString();
  const dateKey = todayKey();
  const { weekStart, weekEnd } = weekBounds();
  const conversationId = `conv_${TRAINER_UID}_${CLIENT_UID}`;
  const pendingConversationId = `conv_pending_${CLIENT_UID}`;
  const base = emptyFirestore();

  const foodLogs = [
    {
      id: `food_${CLIENT_UID}_bfast_1`,
      meal_type: 'breakfast',
      food_name: 'Greek Yogurt Bowl',
      brand: 'Fage',
      calories: 320,
      protein: 28,
      carbs: 30,
      fat: 8,
      notes: 'Honey + berries',
    },
    {
      id: `food_${CLIENT_UID}_bfast_2`,
      meal_type: 'breakfast',
      food_name: 'Oatmeal',
      brand: 'Quaker',
      calories: 180,
      protein: 6,
      carbs: 32,
      fat: 3,
      notes: 'With cinnamon',
    },
    {
      id: `food_${CLIENT_UID}_lunch_1`,
      meal_type: 'lunch',
      food_name: 'Grilled Chicken Salad',
      brand: '',
      calories: 450,
      protein: 42,
      carbs: 18,
      fat: 22,
      notes: 'Olive oil dressing',
    },
    {
      id: `food_${CLIENT_UID}_lunch_2`,
      meal_type: 'lunch',
      food_name: 'Brown Rice',
      brand: '',
      calories: 215,
      protein: 5,
      carbs: 45,
      fat: 2,
      notes: '1 cup cooked',
    },
    {
      id: `food_${CLIENT_UID}_dinner_1`,
      meal_type: 'dinner',
      food_name: 'Salmon',
      brand: '',
      calories: 380,
      protein: 34,
      carbs: 0,
      fat: 26,
      notes: 'Lemon pepper',
    },
    {
      id: `food_${CLIENT_UID}_dinner_2`,
      meal_type: 'dinner',
      food_name: 'Roasted Broccoli',
      brand: '',
      calories: 90,
      protein: 4,
      carbs: 10,
      fat: 5,
      notes: '',
    },
    {
      id: `food_${CLIENT_UID}_snack_1`,
      meal_type: 'snack',
      food_name: 'Protein Shake',
      brand: 'Optimum Nutrition',
      calories: 140,
      protein: 24,
      carbs: 4,
      fat: 2,
      notes: 'Post workout',
    },
    {
      id: `food_${CLIENT_UID}_snack_2`,
      meal_type: 'snack',
      food_name: 'Apple',
      brand: '',
      calories: 95,
      protein: 0.5,
      carbs: 25,
      fat: 0.3,
      notes: '',
    },
  ].map((item) => ({
    path: `nutrition_logs/${item.id}`,
    data: {
      user_id: CLIENT_UID,
      date: dateKey,
      meal_type: item.meal_type,
      food_name: item.food_name,
      brand: item.brand,
      serving_size: 1,
      serving_grams: 100,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: 3,
      sugar: 5,
      sodium: 120,
      potassium: 200,
      originalUnit: 'serving',
      originalAmount: 1,
      loggedUnit: 'serving',
      loggedAmount: 1,
      preferredUnit: 'serving',
      metadata: {
        name: item.food_name,
        brand: item.brand,
        calories: item.calories,
        protein: item.protein,
        carbs: item.carbs,
        fat: item.fat,
        servingUnit: 'serving',
        notes: item.notes || undefined,
      },
      created_at: now,
    },
  }));

  const extras = [
    {
      path: `users/${CLIENT_UID}`,
      data: {
        uid: CLIENT_UID,
        email: CLIENT_EMAIL,
        role: 'client',
        firstName: 'Screenshot',
        lastName: 'Client',
        name: 'Screenshot Client',
        displayName: 'Screenshot Client',
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        createdAt: now,
        updatedAt: now,
        trainerId: TRAINER_UID,
        linked: true,
        paymentStatus: 'current',
        monthlyRate: 150,
        weight: 175,
        height: 70,
        age: 28,
        gender: 'male',
        fitnessLevel: 'intermediate',
        primaryGoal: 'Build muscle',
        goals: ['Build muscle', 'Eat better'],
        daysPerWeek: 4,
        equipmentAccess: ['Dumbbells', 'Barbell', 'Bench'],
        photoURL: PLACEHOLDER_PHOTO_URL,
        favoriteFoods: ['Greek Yogurt Bowl', 'Salmon'],
      },
    },
    {
      path: `users/${TRAINER_UID}`,
      data: {
        uid: TRAINER_UID,
        email: TRAINER_EMAIL,
        role: 'trainer',
        firstName: 'Screenshot',
        lastName: 'Trainer',
        name: 'Screenshot Trainer',
        displayName: 'Screenshot Trainer',
        onboardingCompleted: true,
        onboardingCompletedAt: now,
        createdAt: now,
        updatedAt: now,
        specialties: ['Strength', 'Nutrition', 'Mobility'],
        certifications: ['NASM-CPT', 'Precision Nutrition L1'],
        inviteCode: 'SHOT01',
        trainerProfileBio: 'Helps clients build strength with realistic nutrition habits.',
        yearsExperience: '3-5',
        photoURL: PLACEHOLDER_PHOTO_URL,
        stripeAccountId: 'acct_screenshot_demo',
        stripeStatus: 'pending',
        stripeConnectStatus: 'pending',
        pricing: { monthlyRate: 150 },
      },
    },
    {
      path: `trainers/${TRAINER_UID}`,
      data: {
        uid: TRAINER_UID,
        name: 'Screenshot Trainer',
        displayName: 'Screenshot Trainer',
        photoURL: PLACEHOLDER_PHOTO_URL,
        specialties: ['Strength', 'Nutrition', 'Mobility'],
        bio: 'Helps clients build strength with realistic nutrition habits.',
        certifications: ['NASM-CPT', 'Precision Nutrition L1'],
        inviteCode: 'SHOT01',
        onboardingCompleted: true,
        available: true,
        rating: 4.9,
        reviewCount: 12,
        rate: 150,
        pricing: { monthlyRate: 150 },
        location: 'Detroit, MI',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      path: `trainers/${EXTRA_TRAINER_UID}`,
      data: {
        uid: EXTRA_TRAINER_UID,
        name: 'Alex Rivera',
        displayName: 'Alex Rivera',
        photoURL: PLACEHOLDER_PHOTO_URL,
        specialties: ['HIIT', 'Weight loss'],
        bio: 'Marketplace filler trainer for search screenshots.',
        certifications: ['ACE'],
        onboardingCompleted: true,
        available: true,
        rating: 4.7,
        reviewCount: 8,
        rate: 120,
        location: 'Ann Arbor, MI',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      path: `clients/${CLIENT_UID}`,
      data: {
        uid: CLIENT_UID,
        id: CLIENT_UID,
        role: 'client',
        name: 'Screenshot Client',
        email: CLIENT_EMAIL,
        photoURL: PLACEHOLDER_PHOTO_URL,
        trainerId: TRAINER_UID,
        onboardingCompleted: true,
        goals: ['Build muscle', 'Eat better'],
        fitnessLevel: 'intermediate',
        status: 'active',
      },
    },
    {
      path: `trainer_clients/${TRAINER_UID}/clients/${CLIENT_UID}`,
      data: {
        id: CLIENT_UID,
        joinedAt: now,
        status: 'active',
        name: 'Screenshot Client',
        email: CLIENT_EMAIL,
        weight: 175,
        startingWeight: 182,
        height: 70,
        age: 28,
        gender: 'male',
        goals: ['Build muscle', 'Eat better'],
        fitnessLevel: 'intermediate',
        equipmentAccess: ['Dumbbells', 'Barbell', 'Bench'],
        daysPerWeek: 4,
        photoURL: PLACEHOLDER_PHOTO_URL,
        monthlyRate: 150,
        paymentStatus: 'current',
        programName: 'Hypertrophy Block A',
        updatedAt: now,
        trainerId: TRAINER_UID,
      },
    },
    {
      path: `trainer_client_links/${TRAINER_UID}_${CLIENT_UID}`,
      data: {
        trainerId: TRAINER_UID,
        clientId: CLIENT_UID,
        joinedAt: now,
      },
    },
    {
      path: `users/${CLIENT_UID}/dailyLogs/${dateKey}`,
      data: {
        dashboard_water: 64,
        dashboard_sleep: 7.5,
        dashboard_steps: 8420,
        dashboard_energy: 7,
        dashboard_mood: 8,
        dashboard_soreness: 3,
        dashboard_stress: 4,
        dashboard_weight: 175,
        dashboard_bodyfat: 18,
        dashboard_workouts: 1,
        dashboard_workout_name: 'Upper Push',
        dashboard_workout_exercises: ['Bench Press', 'Overhead Press', 'Lateral Raise'],
        dashboard_notes: 'Felt strong on bench today.',
        workoutLog: [
          {
            exerciseName: 'Bench Press',
            sets: [
              { reps: 8, weight: 135 },
              { reps: 6, weight: 155 },
              { reps: 5, weight: 165 },
            ],
          },
        ],
        updatedAt: now,
      },
    },
    {
      path: `trainer_clients/${TRAINER_UID}/sessions/session_screenshot_1`,
      data: {
        clientId: CLIENT_UID,
        clientName: 'Screenshot Client',
        date: dateKey,
        time: '10:00',
        durationMin: 60,
        duration: 60,
        status: 'scheduled',
        notes: 'Form check on press variations',
        zoomLink: 'https://zoom.us/j/screenshot',
        createdAt: now,
        updatedAt: now,
        trainerId: TRAINER_UID,
        sessionReminderSent: false,
      },
    },
    {
      path: `conversations/${conversationId}`,
      data: {
        id: conversationId,
        participants: [CLIENT_UID, TRAINER_UID],
        clientId: CLIENT_UID,
        trainerId: TRAINER_UID,
        type: 'client-trainer',
        createdAt: now,
        updatedAt: now,
        lastMessage: 'How did upper push feel?',
        lastMessageTime: now,
      },
    },
    {
      path: `messages/msg_screenshot_1`,
      data: {
        id: 'msg_screenshot_1',
        conversationId,
        senderId: TRAINER_UID,
        text: 'How did upper push feel?',
        timestamp: now,
        read: true,
      },
    },
    {
      path: `messages/msg_screenshot_2`,
      data: {
        id: 'msg_screenshot_2',
        conversationId,
        senderId: CLIENT_UID,
        text: 'Great — hit 165 for 5 on bench.',
        timestamp: now,
        read: true,
      },
    },
    {
      path: `conversations/${pendingConversationId}`,
      data: {
        id: pendingConversationId,
        participants: [CLIENT_UID, TRAINER_UID],
        clientId: CLIENT_UID,
        trainerId: TRAINER_UID,
        type: 'client-trainer',
        createdAt: now,
        updatedAt: now,
        lastMessage: 'Connection request',
        lastMessageTime: now,
      },
    },
    {
      path: `messages/msg_pending_request`,
      data: {
        id: 'msg_pending_request',
        conversationId: pendingConversationId,
        senderId: CLIENT_UID,
        status: 'pending',
        clientName: 'Pending Prospect',
        clientGoals: 'Lose fat',
        clientExperienceLevel: 'beginner',
        clientEquipment: 'Dumbbells',
        clientLimitations: 'None',
        requestType: 'intro',
        requestTitle: 'Connection request',
        text: 'Hi — looking for a coach for 3 days/week.',
        timestamp: now,
        read: false,
      },
    },
    {
      path: `users/${CLIENT_UID}/progressPhotos/photo_1`,
      data: {
        url: PLACEHOLDER_PHOTO_URL,
        date: dateKey,
        uploadedBy: CLIENT_UID,
        clientId: CLIENT_UID,
        storagePath: `progressPhotos/${CLIENT_UID}/photo_1.jpg`,
      },
    },
    {
      path: `users/${CLIENT_UID}/notes_and_files/note_1`,
      data: {
        type: 'note',
        content: 'Focus on progressive overload this week.',
        addedBy: 'trainer',
        isRead: false,
        createdAt: now,
        trainerId: TRAINER_UID,
      },
    },
    {
      path: `users/${CLIENT_UID}/notes_and_files/file_1`,
      data: {
        type: 'file',
        name: 'Warmup-Routine.pdf',
        url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        mimeType: 'application/pdf',
        size: 13264,
        addedBy: 'trainer',
        isRead: true,
        createdAt: now,
        trainerId: TRAINER_UID,
      },
    },
    {
      path: `users/${CLIENT_UID}/weeklySummaries/${weekStart}`,
      data: {
        weekStart,
        weekId: weekStart,
        weekEnd,
        summary:
          'Logged 5 of 7 days. Sleep ranged from 6.5 h to 8.0 h. 4 day(s) met or exceeded 64 oz water. 3 day(s) included a workout.',
      },
    },
    {
      path: `users/${CLIENT_UID}/workoutPlans/plan_screenshot_1`,
      data: {
        assigned: true,
        status: 'active',
        generatedAt: now,
        planText:
          'Day 1 Upper Push\n- Bench Press 4x6\n- Overhead Press 3x8\n- Lateral Raise 3x12\n\nDay 2 Lower\n- Squat 4x5\n- RDL 3x8\n- Leg Curl 3x12',
        structuredPlan: {
          title: 'Hypertrophy Block A',
          days: [
            {
              name: 'Upper Push',
              exercises: [
                { name: 'Bench Press', sets: 4, reps: '6' },
                { name: 'Overhead Press', sets: 3, reps: '8' },
              ],
            },
          ],
        },
      },
    },
    {
      path: `users/${CLIENT_UID}/aiChats/chat_1`,
      data: {
        title: 'Nutrition check-in',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      path: `users/${CLIENT_UID}/aiChats/chat_1/messages/m1`,
      data: {
        role: 'user',
        text: 'Am I hitting protein today?',
        createdAt: now,
      },
    },
    {
      path: `users/${CLIENT_UID}/aiChats/chat_1/messages/m2`,
      data: {
        role: 'assistant',
        text: 'Yes — you are at about 143g so far with dinner still open.',
        createdAt: now,
      },
    },
    {
      path: `users/${TRAINER_UID}/aiChats/chat_1`,
      data: {
        title: 'Client programming',
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      path: `users/${TRAINER_UID}/documents/doc_1`,
      data: {
        title: 'Client welcome packet',
        type: 'document',
        updatedAt: now,
        createdAt: now,
      },
    },
    {
      path: `payments/pay_screenshot_1`,
      data: {
        trainer_id: TRAINER_UID,
        client_id: CLIENT_UID,
        amount: 150,
        trainer_payout: 135,
        commission: 15,
        status: 'succeeded',
        created_at: now,
      },
    },
    {
      path: `nutrition_goals/${CLIENT_UID}`,
      data: {
        user_id: CLIENT_UID,
        calories: 2200,
        calorie_target: 2200,
        proteinTarget: 150,
        protein_target: 150,
        carbsTarget: 220,
        carbs_target: 220,
        fatTarget: 70,
        fat_target: 70,
        macroSplit: { protein: 0.3, carbs: 0.4, fat: 0.3 },
        macro_split: { protein: 0.3, carbs: 0.4, fat: 0.3 },
        updated_at: now,
      },
    },
    ...foodLogs,
  ];

  return {
    documents: extras,
    deleteQueryHints: base.deleteQueryHints,
  };
}

function buildScenario(name) {
  if (name !== 'empty' && name !== 'with-food') {
    throw new Error(`Unknown scenario: ${name}`);
  }
  return {
    scenario: name,
    version: '1.0.0',
    projectId: 'anatrox-auth',
    generatedAt: new Date().toISOString(),
    auth: { users: authUsers() },
    firestore: name === 'empty' ? emptyFirestore() : withFoodFirestore(),
  };
}

module.exports = {
  todayKey,
  weekBounds,
  authUsers,
  emptyFirestore,
  withFoodFirestore,
  buildScenario,
};
