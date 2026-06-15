import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const LONG_SESSION_MESSAGES = [
  'Hey coach what should I focus on today',
  'I weighed in at 187 this morning',
  'Log that weight for me',
  'What were my calories yesterday',
  "I had a McDonald's Big Mac for lunch",
  'Log that Big Mac 550 calories',
  'How close am I to my protein goal',
  'I did 45 minutes of cardio this morning',
  'What time should I eat my last meal',
  'Log 8 hours of sleep from last night',
  'I had a Chipotle chicken bowl for dinner',
  'Log that Chipotle bowl for me',
  'Should I take a rest day tomorrow',
  'What are my macros looking like today',
  'I drank 3 liters of water today log it',
  'How many calories did I burn today',
  'I feel tired after my workout',
  'Should I increase my calories',
  'Log a Quest bar chocolate chip cookie dough',
  'What is my protein total for today',
];

export const options = {
  vus: 10,
  duration: '5m',
};

export default function () {
  for (let i = 0; i < 50; i++) {
    const res = http.post(
      `${BASE_URL}/api/ai-coach`,
      JSON.stringify({
        message: randomItem(LONG_SESSION_MESSAGES),
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer fake-load-test-token',
        },
      }
    );

    check(res, {
      'not a crash': (r) => r.status !== 500,
      'consistent response time': (r) => r.timings.duration < 5000,
    });

    sleep(1);
  }
}
