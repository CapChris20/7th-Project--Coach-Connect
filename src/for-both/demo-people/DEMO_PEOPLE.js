// Fictional people used in demo seeds, sample APIs, and test fixtures.
// Flow: build each person → group trainers then clients → export DEMO_PEOPLE.
// Used by: onboarding mocks, search tests, trainer/client sample data.

// ===== NAMED CONSTANTS =====

// Manipulate here: change demo names/emails/locations. Keep ids stable —
// seeds and tests key off trainer1 / client1 / sample1 / etc.
const DEMO_EMAIL_DOMAIN = 'coachconnect.example';

// ===== HELPER FUNCTIONS =====

/**
 * One fictional person row. Emails always use the demo domain, never real users.
 * @param {object} parts
 * @returns {object}
 */
function makeDemoPerson(parts) {
  const firstName = parts.firstName;
  const lastName = parts.lastName;
  const displayName = firstName + ' ' + lastName;

  let shortName = parts.shortName;
  if (!shortName) {
    const lastInitial = lastName.charAt(0);
    shortName = firstName + ' ' + lastInitial + '.';
  }

  let email = parts.email;
  if (!email) {
    email = parts.emailLocalPart + '@' + DEMO_EMAIL_DOMAIN;
  }

  const person = {
    firstName: firstName,
    lastName: lastName,
    displayName: displayName,
    shortName: shortName,
    email: email,
  };

  if (parts.id) {
    person.id = parts.id;
  }
  if (parts.location) {
    person.location = parts.location;
  }
  if (parts.searchKey) {
    person.searchKey = parts.searchKey;
  }

  return person;
}

/**
 * Trainer identities used in demo seeds.
 * @returns {object}
 */
function buildDemoTrainers() {
  // 1. Primary demo trainer.
  const primaryTrainer = makeDemoPerson({
    id: 'trainer1',
    firstName: 'Jordan',
    lastName: 'Miller',
    shortName: 'Jordan M.',
    emailLocalPart: 'jordan',
    location: 'Los Angeles, CA',
  });

  // 2. Secondary demo trainer.
  const secondaryTrainer = makeDemoPerson({
    id: 'trainer2',
    firstName: 'Morgan',
    lastName: 'Taylor',
    shortName: 'Morgan T.',
    emailLocalPart: 'morgan',
    location: 'New York, NY',
  });

  // 3. Sample trainer 3.
  const sampleTrainer3 = makeDemoPerson({
    id: 'sample1',
    firstName: 'Alex',
    lastName: 'Rivera',
    shortName: 'Alex R.',
    emailLocalPart: 'alex.rivera',
    location: 'Detroit, MI',
  });

  // 4. Sample trainer 4.
  const sampleTrainer4 = makeDemoPerson({
    id: 'sample3',
    firstName: 'Sam',
    lastName: 'Casey',
    shortName: 'Sam C.',
    emailLocalPart: 'sam.casey',
    location: 'New York, NY',
  });

  return {
    PRIMARY_TRAINER: primaryTrainer,
    SECONDARY_TRAINER: secondaryTrainer,
    SAMPLE_TRAINER_3: sampleTrainer3,
    SAMPLE_TRAINER_4: sampleTrainer4,
  };
}

/**
 * Client identities for demo / fixture paths (no real user emails).
 * @returns {object}
 */
function buildDemoClients() {
  // 1. Demo client 1.
  const client1 = makeDemoPerson({
    id: 'client1',
    firstName: 'Taylor',
    lastName: 'Brooks',
    shortName: 'Taylor B.',
    emailLocalPart: 'taylor',
  });

  // 2. Demo client 2.
  const client2 = makeDemoPerson({
    id: 'client2',
    firstName: 'Riley',
    lastName: 'Harper',
    shortName: 'Riley H.',
    emailLocalPart: 'riley',
  });

  // 3. Demo client 3.
  const client3 = makeDemoPerson({
    id: 'client3',
    firstName: 'Avery',
    lastName: 'Quinn',
    shortName: 'Avery Q.',
    emailLocalPart: 'avery',
  });

  // 4. Fixture client for mismatch / search tests.
  // No id on purpose — older fixtures keyed by searchKey + email only.
  const fixtureClient = makeDemoPerson({
    firstName: 'Dakota',
    lastName: 'Reese',
    shortName: 'Dakota R.',
    emailLocalPart: 'dakota.reese',
    searchKey: 'dakota',
  });

  return {
    CLIENT_1: client1,
    CLIENT_2: client2,
    CLIENT_3: client3,
    FIXTURE_CLIENT: fixtureClient,
  };
}

/**
 * Full DEMO_PEOPLE map — trainers first, then clients. Export keys stay frozen.
 * @returns {object}
 */
function buildDemoPeopleMap() {
  // 1. Build trainer rows.
  const trainers = buildDemoTrainers();

  // 2. Build client rows.
  const clients = buildDemoClients();

  // 3. One object so importers keep using DEMO_PEOPLE.PRIMARY_TRAINER etc.
  return {
    PRIMARY_TRAINER: trainers.PRIMARY_TRAINER,
    SECONDARY_TRAINER: trainers.SECONDARY_TRAINER,
    SAMPLE_TRAINER_3: trainers.SAMPLE_TRAINER_3,
    SAMPLE_TRAINER_4: trainers.SAMPLE_TRAINER_4,
    CLIENT_1: clients.CLIENT_1,
    CLIENT_2: clients.CLIENT_2,
    CLIENT_3: clients.CLIENT_3,
    FIXTURE_CLIENT: clients.FIXTURE_CLIENT,
  };
}

// ===== MAIN EXPORTS =====

export const DEMO_PEOPLE = buildDemoPeopleMap();

export default DEMO_PEOPLE;
