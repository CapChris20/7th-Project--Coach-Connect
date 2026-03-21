// Script to migrate trainers from users collection to trainers collection
// Run with: node scripts/migrateTrainers.js

const admin = require('firebase-admin');
const serviceAccount = require('../server/serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrateTrainers() {
  try {
    console.log('🔍 Finding users with role: trainer...');
    
    // Get all users with role: trainer
    const usersSnapshot = await db.collection('users')
      .where('role', '==', 'trainer')
      .get();
    
    console.log(`📊 Found ${usersSnapshot.size} users with trainer role`);
    
    if (usersSnapshot.size === 0) {
      console.log('❌ No trainers found to migrate');
      return;
    }
    
    // Migrate each trainer to trainers collection
    const batch = db.batch();
    let migratedCount = 0;
    
    usersSnapshot.forEach((doc) => {
      const trainerData = doc.data();
      const trainerId = doc.id;
      
      console.log(`👤 Migrating trainer: ${trainerData.name} (${trainerId})`);
      
      // Create trainer document
      const trainerRef = db.collection('trainers').doc(trainerId);
      batch.set(trainerRef, {
        ...trainerData,
        migratedAt: admin.firestore.FieldValue.serverTimestamp(),
        migratedFrom: 'users'
      });
      
      migratedCount++;
    });
    
    // Commit the batch
    await batch.commit();
    
    console.log(`✅ Successfully migrated ${migratedCount} trainers to trainers collection`);
    
    // Verify migration
    const trainersSnapshot = await db.collection('trainers').get();
    console.log(`📊 Verification: ${trainersSnapshot.size} trainers now in trainers collection`);
    
  } catch (error) {
    console.error('❌ Error migrating trainers:', error);
  } finally {
    process.exit(0);
  }
}

migrateTrainers();
