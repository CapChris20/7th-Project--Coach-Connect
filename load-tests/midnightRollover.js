import http from 'k6/http';
import { check } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const ROLLOVER_MESSAGES = [
  'Log my evening workout as complete',
  'Log 8 hours sleep for tonight',
  'Log my last meal Chipotle chicken bowl',
  'Log 32oz of water',
  'How did I do today on my goals?',
];

export const options = {
  vus: 300,
  duration: '30s',
};

export default function () {
  const action = Math.random();

  if (action < 0.5) {
    const res = http.post(
      `${BASE_URL}/api/ai-coach`,
      JSON.stringify({
        message: randomItem(ROLLOVER_MESSAGES),
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
  } else {
    const q = encodeURIComponent('Chipotle chicken burrito bowl');
    const res = http.get(`${BASE_URL}/api/food/search?q=${q}`, {
      headers: {
        Authorization: 'Bearer fake-load-test-token',
      },
    });
    check(res, {
      'not a crash': (r) => r.status !== 500,
    });
  }
}
