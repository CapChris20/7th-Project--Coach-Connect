import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const MESSAGES = [
  'How much protein should I eat to build muscle?',
  'Log 8 hours of sleep for me',
  'What did I eat today?',
  'I just finished a chest workout log it',
  'How am I doing on my calorie goal today?',
  'Log 64oz of water please',
  'Should I do cardio or weights today?',
  'What are my macros for this week?',
  'I weigh 185 pounds this morning',
  'Is 2200 calories enough for a bulk?',
  'How many grams of protein in a Big Mac?',
  'Log my morning run 30 minutes',
  'What time should I eat my last meal?',
  'Am I hitting my protein goal today?',
  'I had Chipotle for lunch log it',
];

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/ai-coach`,
    JSON.stringify({
      message: randomItem(MESSAGES),
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-load-test-token',
      },
    }
  );

  check(res, {
    'auth rejected or ok not crash': (r) =>
      r.status === 200 || r.status === 401 || r.status === 429,
    'not a server crash': (r) => r.status !== 500,
    'response time ok': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
