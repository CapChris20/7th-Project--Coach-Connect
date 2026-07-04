const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://coachconnect-ai-default-rtdb.firebaseio.com',
});

const db = admin.firestore();

const seedData = async () => {
  console.log('🌱 Starting to seed test data...');

  try {
    // Test Trainers
    const testTrainers = [
      {
        uid: 'trainer1',
        firstName: 'Chris',
        lastName: 'Shina',
        email: 'chris@coachconnect.test',
        displayName: 'Chris Shina',
        role: 'trainer',
        specialties: ['Fat Loss', 'Strength Training', 'Nutrition'],
        experience: '8+ years',
        rating: 4.9,
        reviewCount: 127,
        bio: 'Certified personal trainer specializing in fat loss and strength building.',
        location: 'Los Angeles, CA',
        hourlyRate: 75,
        available: true,
        unreadClientRequests: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        uid: 'trainer2',
        firstName: 'Sarah',
        lastName: 'Johnson',
        email: 'sarah@coachconnect.test',
        displayName: 'Sarah Johnson',
        role: 'trainer',
        specialties: ['Muscle Gain', 'Competition Prep', 'HIIT'],
        experience: '5+ years',
        rating: 4.8,
        reviewCount: 89,
        bio: 'Expert in muscle building and competition preparation.',
        location: 'New York, NY',
        hourlyRate: 85,
        available: true,
        unreadClientRequests: 0,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    // Test Clients
    const testClients = [
      {
        uid: 'client1',
        firstName: 'Mike',
        lastName: 'Wilson',
        email: 'mike@coachconnect.test',
        displayName: 'Mike Wilson',
        role: 'client',
        goals: 'Fat loss and strength building',
        experienceLevel: 'Beginner',
        equipment: 'Dumbbells, resistance bands',
        limitations: 'None',
        age: 28,
        weight: 185,
        height: 72,
        activityLevel: 'Sedentary',
        preferredWorkoutTime: 'Evening',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        uid: 'client2',
        firstName: 'Emily',
        lastName: 'Chen',
        email: 'emily@coachconnect.test',
        displayName: 'Emily Chen',
        role: 'client',
        goals: 'Muscle gain and toning',
        experienceLevel: 'Intermediate',
        equipment: 'Full gym access',
        limitations: 'Knee issues - avoid heavy squats',
        age: 32,
        weight: 135,
        height: 65,
        activityLevel: 'Moderately active',
        preferredWorkoutTime: 'Morning',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      },
      {
        uid: 'client3',
        firstName: 'David',
        lastName: 'Brown',
        email: 'david@coachconnect.test',
        displayName: 'David Brown',
        role: 'client',
        goals: 'Competition preparation',
        experienceLevel: 'Advanced',
        equipment: 'Full gym access + home equipment',
        limitations: 'None',
        age: 25,
        weight: 175,
        height: 70,
        activityLevel: 'Very active',
        preferredWorkoutTime: 'Afternoon',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      },
    ];

    // Seed users
    console.log('📝 Seeding users...');
    for (const user of [...testTrainers, ...testClients]) {
      await db.collection('users').doc(user.uid).set(user);
      console.log(`✅ Created user: ${user.displayName}`);
    }

    // Create some existing trainer-client relationships
    console.log('🤝 Creating existing trainer-client relationships...');
    
    // Chris Shina has 2 existing clients
    await db.collection('trainer_clients/trainer1/clients').doc('client1').set({
      name: 'Mike Wilson',
      joinedAt: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
      status: 'active',
      goals: 'Fat loss and strength building',
      experience: 'Beginner',
      equipment: 'Dumbbells, resistance bands',
      limitations: 'None',
    });

    // Sarah Johnson has 1 existing client
    await db.collection('trainer_clients/trainer2/clients').doc('client2').set({
      name: 'Emily Chen',
      joinedAt: admin.firestore.Timestamp.fromDate(new Date('2024-02-01')),
      status: 'active',
      goals: 'Muscle gain and toning',
      experience: 'Intermediate',
      equipment: 'Full gym access',
      limitations: 'Knee issues',
    });

    // Create sample workouts for existing relationships
    console.log('💪 Creating sample workouts...');
    
    // Workouts for Chris & Mike
    const workoutsForMike = [
      {
        name: 'Upper Body Strength',
        exercises: ['Bench Press', 'Rows', 'Shoulder Press', 'Bicep Curls'],
        sets: '3x10-12',
        duration: 45,
        difficulty: 'Intermediate',
        focus: 'Strength',
        date: admin.firestore.Timestamp.fromDate(new Date('2024-03-01')),
        completed: true,
      },
      {
        name: 'Lower Body Power',
        exercises: ['Squats', 'Lunges', 'Calf Raises', 'Leg Press'],
        sets: '3x12-15',
        duration: 40,
        difficulty: 'Beginner',
        focus: 'Lower Body',
        date: admin.firestore.Timestamp.fromDate(new Date('2024-03-03')),
        completed: false,
      },
    ];

    for (const workout of workoutsForMike) {
      await db.collection('workouts/trainer1/clients/client1/workouts').add({
        ...workout,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Workouts for Sarah & Emily
    const workoutsForEmily = [
      {
        name: 'Full Body HIIT',
        exercises: ['Burpees', 'Mountain Climbers', 'Kettlebell Swings', 'Box Jumps'],
        sets: '4 rounds',
        duration: 30,
        difficulty: 'Advanced',
        focus: 'Cardio/Strength',
        date: admin.firestore.Timestamp.fromDate(new Date('2024-03-02')),
        completed: true,
      },
    ];

    for (const workout of workoutsForEmily) {
      await db.collection('workouts/trainer2/clients/client2/workouts').add({
        ...workout,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // Create sample messages
    console.log('💬 Creating sample messages...');
    
    // Messages between Chris & Mike (Path A: top-level messages)
    const convChrisMike = 'conv_client1_trainer1';
    const messagesChrisMike = [
      { conversationId: convChrisMike, text: 'Hi Mike! Welcome aboard. I\'ve created your first workout program.', senderId: 'trainer1', read: false },
      { conversationId: convChrisMike, text: 'Thanks Chris! Really excited to get started.', senderId: 'client1', read: false },
      { conversationId: convChrisMike, text: 'How did today\'s workout go? Remember to focus on form over weight.', senderId: 'trainer1', read: false },
    ];
    const timestampsChrisMike = [
      admin.firestore.Timestamp.fromDate(new Date('2024-01-15T10:00:00')),
      admin.firestore.Timestamp.fromDate(new Date('2024-01-15T10:30:00')),
      admin.firestore.Timestamp.fromDate(new Date('2024-03-01T18:00:00')),
    ];
    for (let i = 0; i < messagesChrisMike.length; i++) {
      await db.collection('messages').add({
        ...messagesChrisMike[i],
        timestamp: timestampsChrisMike[i],
      });
    }

    // Messages between Sarah & Emily (Path A)
    const convSarahEmily = 'conv_client2_trainer2';
    const messagesSarahEmily = [
      { conversationId: convSarahEmily, text: 'Emily! Great to have you. Let\'s crush those muscle goals!', senderId: 'trainer2', read: false },
      { conversationId: convSarahEmily, text: 'Thanks Sarah! Ready to work hard!', senderId: 'client2', read: false },
    ];
    const timestampsSarahEmily = [
      admin.firestore.Timestamp.fromDate(new Date('2024-02-01T09:00:00')),
      admin.firestore.Timestamp.fromDate(new Date('2024-02-01T09:15:00')),
    ];
    for (let i = 0; i < messagesSarahEmily.length; i++) {
      await db.collection('messages').add({
        ...messagesSarahEmily[i],
        timestamp: timestampsSarahEmily[i],
      });
    }

    // Create sample notifications
    console.log('🔔 Creating sample notifications...');
    
    const notifications = [
      {
        type: 'new_client_request',
        trainerUid: 'trainer1',
        clientUid: 'client3',
        clientName: 'David Brown',
        messageId: 'pending_msg_1',
        messageText: 'Hi! I\'m looking for competition prep coaching. Available?',
        timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-03-05T14:00:00')),
        read: false,
      },
      {
        type: 'workout_completed',
        trainerUid: 'trainer1',
        clientUid: 'client1',
        clientName: 'Mike Wilson',
        workoutName: 'Upper Body Strength',
        timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-03-01T19:00:00')),
        read: true,
      },
    ];

    for (const notification of notifications) {
      await db.collection('notifications').add(notification);
    }

    // Create sample events
    console.log('📊 Creating sample events...');
    
    const events = [
      {
        type: 'client_onboarded',
        trainerUid: 'trainer1',
        clientUid: 'client1',
        timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-01-15')),
      },
      {
        type: 'client_onboarded',
        trainerUid: 'trainer2',
        clientUid: 'client2',
        timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-02-01')),
      },
      {
        type: 'first_message_trigger',
        trainerUid: 'trainer1',
        clientUid: 'client3',
        messageId: 'pending_msg_1',
        timestamp: admin.firestore.Timestamp.fromDate(new Date('2024-03-05T14:00:00')),
      },
    ];

    for (const event of events) {
      await db.collection('events').add(event);
    }

    console.log('🎉 Test data seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Trainers: ${testTrainers.length}`);
    console.log(`   Clients: ${testClients.length}`);
    console.log(`   Relationships: 2`);
    console.log(`   Workouts: 3`);
    console.log(`   Messages: 5`);
    console.log(`   Notifications: 2`);
    console.log(`   Events: 3`);
    console.log('\n🔑 Test Credentials:');
    console.log('   Trainer 1: chris@coachconnect.test');
    console.log('   Trainer 2: sarah@coachconnect.test');
    console.log('   Client 1: mike@coachconnect.test');
    console.log('   Client 2: emily@coachconnect.test');
    console.log('   Client 3: david@coachconnect.test');

  } catch (error) {
    console.error('❌ Error seeding data:', error);
  } finally {
    process.exit(0);
  }
};

seedData().catch(console.error);
