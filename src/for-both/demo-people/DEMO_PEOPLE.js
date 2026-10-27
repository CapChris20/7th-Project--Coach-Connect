/**
 * Central registry of consistent fictional identities used for demo data,
 * sample endpoints, mock transactions, and test fixtures across Coach Connect.
 */

export const DEMO_PEOPLE = {
  // Primary Demo Trainer (replaces founder Chris Shina in demo seeds)
  PRIMARY_TRAINER: {
    id: 'trainer1',
    firstName: 'Jordan',
    lastName: 'Miller',
    displayName: 'Jordan Miller',
    shortName: 'Jordan M.',
    email: 'jordan@coachconnect.example',
    location: 'Los Angeles, CA',
  },

  // Secondary Demo Trainer (replaces Sarah Johnson)
  SECONDARY_TRAINER: {
    id: 'trainer2',
    firstName: 'Morgan',
    lastName: 'Taylor',
    displayName: 'Morgan Taylor',
    shortName: 'Morgan T.',
    email: 'morgan@coachconnect.example',
    location: 'New York, NY',
  },

  // Sample Trainer 3 (replaces John Smith)
  SAMPLE_TRAINER_3: {
    id: 'sample1',
    firstName: 'Alex',
    lastName: 'Rivera',
    displayName: 'Alex Rivera',
    shortName: 'Alex R.',
    email: 'alex.rivera@coachconnect.example',
    location: 'Detroit, MI',
  },

  // Sample Trainer 4 (replaces Mike Chen)
  SAMPLE_TRAINER_4: {
    id: 'sample3',
    firstName: 'Sam',
    lastName: 'Casey',
    displayName: 'Sam Casey',
    shortName: 'Sam C.',
    email: 'sam.casey@coachconnect.example',
    location: 'New York, NY',
  },

  // Demo Client 1 (replaces Mike Wilson)
  CLIENT_1: {
    id: 'client1',
    firstName: 'Taylor',
    lastName: 'Brooks',
    displayName: 'Taylor Brooks',
    shortName: 'Taylor B.',
    email: 'taylor@coachconnect.example',
  },

  // Demo Client 2 (replaces Emily Chen)
  CLIENT_2: {
    id: 'client2',
    firstName: 'Riley',
    lastName: 'Harper',
    displayName: 'Riley Harper',
    shortName: 'Riley H.',
    email: 'riley@coachconnect.example',
  },

  // Demo Client 3 (replaces David Brown)
  CLIENT_3: {
    id: 'client3',
    firstName: 'Avery',
    lastName: 'Quinn',
    displayName: 'Avery Quinn',
    shortName: 'Avery Q.',
    email: 'avery@coachconnect.example',
  },

  // Demo Fixture Client (replaces Cade Cunningham in mismatch / search tests)
  FIXTURE_CLIENT: {
    firstName: 'Dakota',
    lastName: 'Reese',
    displayName: 'Dakota Reese',
    shortName: 'Dakota R.',
    searchKey: 'dakota',
    email: 'dakota.reese@coachconnect.example',
  },
};

export default DEMO_PEOPLE;
