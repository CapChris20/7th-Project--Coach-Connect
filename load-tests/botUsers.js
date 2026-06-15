import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const BOT_FOOD_QUERIES = [
  "Chick-fil-A spicy chicken sandwich",
  "Chipotle chicken burrito white rice",
  "McDonald's Quarter Pounder with cheese",
  "Starbucks pumpkin spice latte grande",
  "Subway Italian BMT footlong",
  "Wingstop original hot wings 10 piece",
  "Domino's brooklyn style pepperoni",
  "Five Guys little cheeseburger",
  "Raising Cane's box combo",
  "Panda Express orange chicken plate",
  "Taco Bell crunchwrap supreme",
  "Popeyes spicy chicken sandwich",
  "Quest chocolate chip cookie dough bar",
  "Premier Protein vanilla caramel shake",
  "Panera bread mac and cheese bowl",
];

const BOT_COACH_MESSAGES = [
  'Log my morning workout',
  'How many calories did I eat today?',
  'Log 7 hours of sleep',
  'What should I eat before training?',
  'Am I hitting my protein goal?',
  'Log 8oz of water',
  'How do I build muscle faster?',
  'What are my macros today?',
];

export const options = {
  stages: [
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const action = Math.random();

  if (action < 0.4) {
    const q = encodeURIComponent(randomItem(BOT_FOOD_QUERIES));
    const res = http.get(`${BASE_URL}/api/food/search?q=${q}`, {
      headers: {
        Authorization: 'Bearer fake-load-test-token',
      },
    });
    check(res, {
      'not a crash': (r) => r.status !== 500,
    });
  } else if (action < 0.7) {
    const res = http.post(
      `${BASE_URL}/api/ai-coach`,
      JSON.stringify({
        message: randomItem(BOT_COACH_MESSAGES),
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
    });
  } else if (action < 0.9) {
    const res = http.get(`${BASE_URL}/api/user/daily-metrics`, {
      headers: {
        Authorization: 'Bearer fake-load-test-token',
      },
    });
    check(res, {
      'not a crash': (r) => r.status !== 500,
    });
  } else {
    const res = http.post(
      `${BASE_URL}/api/workout/generate`,
      JSON.stringify({ goal: 'build_muscle' }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer fake-load-test-token',
          'X-Load-Test': '1',
        },
      }
    );
    check(res, {
      'not a crash': (r) => r.status !== 500,
    });
  }

  sleep(0.5);
}
