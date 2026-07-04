/**
 * Restore user document from trainers collection (and any other sources).
 * Run: node scripts/restoreUserDocument.js
 *
 * Restores: users/KdtVuFxsxXRSD9NLSHBTx0zVo8l2 (pissdick@gmail.com)
 * - Pulls profile from trainers/{uid} if it exists (name, bio, certifications, pricing, etc.)
 * - Your client list in trainer_clients/{uid}/clients was never deleted and is still there.
 */

const admin = require('firebase-admin');
const path = require('path');

const UID = 'KdtVuFxsxXRSD9NLSHBTx0zVo8l2';
const EMAIL = 'pissdick@gmail.com';

async function main() {
  let serviceAccount;
  try {
    serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
  } catch (e) {
    console.error('Missing serviceAccountKey.json in project root.');
    process.exit(1);
  }

  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  }
  const db = admin.firestore();

  const restored = {
    email: EMAIL,
    role: 'trainer',
    onboardingCompleted: true,
    onboardingCompletedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Pull everything we can from trainers collection (copy of profile from onboarding)
  const trainerSnap = await db.collection('trainers').doc(UID).get();
  if (trainerSnap.exists) {
    const t = trainerSnap.data();
    Object.assign(restored, {
      name: t.name,
      firstName: t.name ? t.name.split(' ')[0] : null,
      lastName: t.name ? t.name.split(' ').slice(1).join(' ') : null,
      location: t.location,
      specialties: t.specialties,
      trainingPhilosophy: t.bio,
      bio: t.bio,
      certifications: t.certifications,
      yearsExperience: t.yearsExperience,
      pricing: t.pricing || { perSession: t.rate, perMonth: null, initialConsult: null },
      inviteCode: t.inviteCode,
      offerFreeConsultation: t.offerFreeConsultation,
      flexiblePricingAvailable: t.flexiblePricingAvailable,
    });
    console.log('Restored profile from trainers collection:', t.name || t.uid);
  } else {
    console.log('No trainers/{uid} doc found - restored minimal user doc only.');
  }

  // Confirm client list still exists (trainer_clients was not deleted)
  const clientsSnap = await db.collection('trainer_clients').doc(UID).collection('clients').get();
  console.log('Your clients (trainer_clients):', clientsSnap.size, 'clients still in Firestore.');

  await db.collection('users').doc(UID).set(restored, { merge: true });
  console.log('Users document restored. Sign in again – profile and client list should be back.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
