// Seed all trainers with random marketplace-friendly fields
// Run with: node scripts/seedRandomTrainerMarketplaceData.js

const admin = require('firebase-admin');
const serviceAccount = require('../server/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const AVAILABILITIES = ['Available', 'Waitlist', 'Limited Spots'];
const SESSION_TYPES = ['Remote', 'In-Person', 'Both'];
const DEMO_CITIES = [
  // US
  'New York, NY',
  'Los Angeles, CA',
  'Austin, TX',
  'Seattle, WA',
  'Miami, FL',
  'Chicago, IL',
  'Denver, CO',
  'San Francisco, CA',
  'Portland, OR',
  'Boston, MA',
  'Atlanta, GA',
  'Nashville, TN',
  'Dallas, TX',
  'Houston, TX',
  'Phoenix, AZ',
  'San Diego, CA',
  'Minneapolis, MN',
  'Boulder, CO',
  'Salt Lake City, UT',
  'Honolulu, HI',
  // Canada
  'Toronto, ON',
  'Vancouver, BC',
  'Montreal, QC',
  'Calgary, AB',
  // Europe
  'London, UK',
  'Manchester, UK',
  'Dublin, IE',
  'Berlin, DE',
  'Munich, DE',
  'Paris, FR',
  'Lyon, FR',
  'Barcelona, ES',
  'Madrid, ES',
  'Amsterdam, NL',
  'Copenhagen, DK',
  'Stockholm, SE',
  'Oslo, NO',
  'Zurich, CH',
  // LatAm
  'Mexico City, MX',
  'Guadalajara, MX',
  'São Paulo, BR',
  'Rio de Janeiro, BR',
  'Buenos Aires, AR',
  'Santiago, CL',
  // Asia-Pacific
  'Sydney, AU',
  'Melbourne, AU',
  'Brisbane, AU',
  'Auckland, NZ',
  'Wellington, NZ',
  'Singapore',
  'Tokyo, JP',
  'Osaka, JP',
  'Seoul, KR',
  'Bangkok, TH',
  'Hong Kong',
];

const DEMO_PHILOSOPHIES = [
  'I help busy professionals build strength and energy with short, highly effective workouts.',
  'My coaching blends strength training, conditioning, and habit systems you can actually stick to.',
  'I focus on form, confidence, and sustainable progress over quick fixes or crash diets.',
  'Training should add to your life, not take it over — we’ll build something that fits your schedule.',
  'We’ll combine strength, mobility, and recovery so you feel better in and out of the gym.',
  'I specialize in safe, progressive training for beginners and people coming back from long breaks.',
  'My approach is data-informed but human-first: we’ll track what matters and ignore what doesn’t.',
];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function buildRandomFields(trainer) {
  // Always overwrite visual marketplace fields like price, availability, etc.
  // but DO NOT fake ratings or review counts (leave those for real data).

  const basePricing = trainer.pricing || {};

  const price =
    randomInt(
      Math.max(80, basePricing.perMonth || basePricing.perSession || 120),
      Math.max(180, basePricing.perMonth || basePricing.perSession || 400)
    );

  const availability = randomFrom(AVAILABILITIES);
  const sessionType = randomFrom(SESSION_TYPES);
  const isRemote = sessionType !== 'In-Person';

  const specialties = trainer.specialties || trainer.specializations || [];
  const specialty =
    (Array.isArray(specialties) && specialties.length > 0 ? specialties[0] : null) ||
    trainer.specialty ||
    null;

  const experienceRange =
    trainer.yearsExperience ||
    trainer.experienceRange ||
    randomFrom(['less_than_1', '1_2', '3_5', '6_10', '10_plus']);

  const certifications = trainer.certifications || [];
  const credentials =
    (Array.isArray(certifications) && certifications.length > 0
      ? certifications.join(', ')
      : trainer.credentials || null);

  const tags =
    trainer.tags && Array.isArray(trainer.tags) && trainer.tags.length > 0
      ? trainer.tags
      : [];

  const location =
    trainer.location && typeof trainer.location === 'string' && trainer.location.trim().length > 0
      ? trainer.location
      : randomFrom(DEMO_CITIES);

  const bioExisting =
    trainer.bio && typeof trainer.bio === 'string' && trainer.bio.trim().length > 0
      ? trainer.bio.trim()
      : null;

  const philosophyExisting =
    trainer.trainingPhilosophy &&
    typeof trainer.trainingPhilosophy === 'string' &&
    trainer.trainingPhilosophy.trim().length > 0
      ? trainer.trainingPhilosophy.trim()
      : null;

  const demoPhilosophy = randomFrom(DEMO_PHILOSOPHIES);
  const bio = bioExisting || philosophyExisting || demoPhilosophy;
  const trainingPhilosophy = philosophyExisting || bioExisting || demoPhilosophy;

  return {
    price,
    availability,
    isRemote,
    sessionType,
    specialty,
    experienceRange,
    tags,
    credentials,
    location,
    bio,
    trainingPhilosophy,
  };
}

async function seedTrainers() {
  try {
    console.log('🔍 Loading trainers collection...');
    const snap = await db.collection('trainers').get();

    if (snap.empty) {
      console.log('❌ No trainers found in trainers collection.');
      return;
    }

    console.log(`📊 Found ${snap.size} trainers. Seeding random marketplace fields...`);

    let count = 0;
    const batch = db.batch();

    snap.forEach((doc) => {
      const data = doc.data() || {};
      const ref = doc.ref;
      const randomFields = buildRandomFields(data);

      batch.set(
        ref,
        {
          ...randomFields,
        },
        { merge: true }
      );

      count += 1;
    });

    await batch.commit();
    console.log(`✅ Seeded random marketplace fields for ${count} trainers.`);
  } catch (err) {
    console.error('❌ Error seeding trainer marketplace data:', err);
  } finally {
    process.exit(0);
  }
}

seedTrainers();

