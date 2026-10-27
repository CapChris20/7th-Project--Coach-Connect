/**
 * CommonJS export of DEMO_PEOPLE for backend server and maintenance scripts.
 */

const DEMO_PEOPLE = {
  PRIMARY_TRAINER: {
    id: 'trainer1',
    firstName: 'Jordan',
    lastName: 'Miller',
    displayName: 'Jordan Miller',
    shortName: 'Jordan M.',
    email: 'jordan@coachconnect.example',
    location: 'Los Angeles, CA',
  },
  SECONDARY_TRAINER: {
    id: 'trainer2',
    firstName: 'Morgan',
    lastName: 'Taylor',
    displayName: 'Morgan Taylor',
    shortName: 'Morgan T.',
    email: 'morgan@coachconnect.example',
    location: 'New York, NY',
  },
  SAMPLE_TRAINER_3: {
    id: 'sample1',
    firstName: 'Alex',
    lastName: 'Rivera',
    displayName: 'Alex Rivera',
    shortName: 'Alex R.',
    email: 'alex.rivera@coachconnect.example',
    location: 'Detroit, MI',
  },
  SAMPLE_TRAINER_4: {
    id: 'sample3',
    firstName: 'Sam',
    lastName: 'Casey',
    displayName: 'Sam Casey',
    shortName: 'Sam C.',
    email: 'sam.casey@coachconnect.example',
    location: 'New York, NY',
  },
  CLIENT_1: {
    id: 'client1',
    firstName: 'Taylor',
    lastName: 'Brooks',
    displayName: 'Taylor Brooks',
    shortName: 'Taylor B.',
    email: 'taylor@coachconnect.example',
  },
  CLIENT_2: {
    id: 'client2',
    firstName: 'Riley',
    lastName: 'Harper',
    displayName: 'Riley Harper',
    shortName: 'Riley H.',
    email: 'riley@coachconnect.example',
  },
  CLIENT_3: {
    id: 'client3',
    firstName: 'Avery',
    lastName: 'Quinn',
    displayName: 'Avery Quinn',
    shortName: 'Avery Q.',
    email: 'avery@coachconnect.example',
  },
  FIXTURE_CLIENT: {
    firstName: 'Dakota',
    lastName: 'Reese',
    displayName: 'Dakota Reese',
    shortName: 'Dakota R.',
    searchKey: 'dakota',
    email: 'dakota.reese@coachconnect.example',
  },
};

module.exports = { DEMO_PEOPLE };
