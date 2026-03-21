// Trainer Migration Utility
// Migrates existing trainers from users collection to trainers collection

import { db } from '../app/config';
import { collection, getDocs, doc, setDoc, query, where } from 'firebase/firestore';

/**
 * Migrates all users with role 'trainer' to the trainers collection
 * This should be run once to migrate existing trainer accounts
 */
export async function migrateTrainersToSeparateCollection() {
  try {
    console.log('🔄 Starting trainer migration...');
    
    // Get all users with role 'trainer'
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'trainer'));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log('ℹ️ No trainers found to migrate');
      return { success: true, migrated: 0, skipped: 0 };
    }
    
    let migrated = 0;
    let skipped = 0;
    
    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data();
      const trainerId = userDoc.id;
      
      try {
        // Check if trainer already exists in trainers collection
        const trainerDocRef = doc(db, 'trainers', trainerId);
        const trainerDoc = await getDoc(trainerDocRef);
        
        if (trainerDoc.exists()) {
          console.log(`⏭️ Skipping ${trainerId} - already exists in trainers collection`);
          skipped++;
          continue;
        }
        
        // Create trainer profile
        const trainerData = {
          uid: trainerId,
          name: userData.name || 'Unknown',
          email: userData.email || '',
          bio: userData.bio || '',
          credentials: userData.credentials || '',
          specializations: userData.specializations || [],
          location: userData.location || '',
          photoURL: userData.photoURL || null,
          rating: userData.rating || 0,
          reviewCount: userData.reviewCount || 0,
          verified: false,
          activeClients: 0,
          totalClients: 0,
          createdAt: userData.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          migratedFrom: 'users',
        };
        
        await setDoc(trainerDocRef, trainerData);
        console.log(`✅ Migrated trainer: ${trainerData.name} (${trainerId})`);
        migrated++;
        
      } catch (error) {
        console.error(`❌ Error migrating trainer ${trainerId}:`, error);
      }
    }
    
    console.log(`🎉 Migration complete! Migrated: ${migrated}, Skipped: ${skipped}`);
    return { success: true, migrated, skipped };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return { success: false, error: error.message, migrated: 0, skipped: 0 };
  }
}

/**
 * Get count of trainers in both collections for verification
 */
export async function getTrainerCounts() {
  try {
    // Count trainers in users collection
    const usersRef = collection(db, 'users');
    const usersQuery = query(usersRef, where('role', '==', 'trainer'));
    const usersSnapshot = await getDocs(usersQuery);
    const usersCount = usersSnapshot.size;
    
    // Count trainers in trainers collection
    const trainersRef = collection(db, 'trainers');
    const trainersSnapshot = await getDocs(trainersRef);
    const trainersCount = trainersSnapshot.size;
    
    console.log(`📊 Trainer counts - Users collection: ${usersCount}, Trainers collection: ${trainersCount}`);
    
    return { usersCount, trainersCount };
  } catch (error) {
    // Permissions can be locked down in production rules; don't spam console.
    const code = error?.code || error?.name;
    if (code !== 'permission-denied') {
    console.error('❌ Error getting trainer counts:', error);
    }
    return { usersCount: 0, trainersCount: 0 };
  }
}

/**
 * Run migration and return results
 */
export async function runTrainerMigration() {
  console.log('🚀 Starting trainer migration process...');
  
  // Get initial counts
  const initialCounts = await getTrainerCounts();
  
  // Run migration
  const migrationResult = await migrateTrainersToSeparateCollection();
  
  // Get final counts
  const finalCounts = await getTrainerCounts();
  
  return {
    initialCounts,
    migrationResult,
    finalCounts,
    success: migrationResult.success
  };
}
