/** Shared inputs for client + server coach tool guard tests (data only). */

const INFORMATIONAL_QUESTIONS = [
  'What did I eat today?',
  'Is 10 hours of sleep too much?',
  'How much protein should I eat?',
  'What are my macros?',
  'How am I doing this week?',
  'What should I eat before a workout?',
  'Is my calorie intake good?',
];

const EXPLICIT_LOG_REQUESTS = [
  'Log 7 hours of sleep',
  'Log 2 eggs for breakfast',
  'I drank 64oz of water today, log it',
  'Log my workout as complete',
  'Set my calorie goal to 2000',
];

const AMBIGUOUS_STATEMENTS = [
  'I slept 7 hours',
  'I had eggs this morning',
  'I drank a lot of water',
  'I worked out today',
];

module.exports = {
  INFORMATIONAL_QUESTIONS,
  EXPLICIT_LOG_REQUESTS,
  AMBIGUOUS_STATEMENTS,
};
