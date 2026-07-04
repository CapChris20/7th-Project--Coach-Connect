import http from 'k6/http';
import { check } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const ABUSE_QUERIES = [
  "McDonald's Big Mac",
  "Chick-fil-A original sandwich",
  "Domino's pepperoni pizza slice",
  "Chipotle chicken burrito bowl",
  "Starbucks grande caramel macchiato",
];

export const options = {
  vus: 1,
  duration: '60s',
};

export default function () {
  const action = Math.random();

  if (action < 0.4) {
    const q = encodeURIComponent(randomItem(ABUSE_QUERIES));
    const res = http.get(`${BASE_URL}/api/food/search?q=${q}`, {
      headers: {
        Authorization: 'Bearer fake-load-test-token',
      },
    });
    check(res, {
      'rate limited or auth rejected not crash': (r) => r.status !== 500,
    });
  } else if (action < 0.7) {
    const res = http.post(
      `${BASE_URL}/api/ai-coach`,
      JSON.stringify({
        message: 'log 9999 calories Big Mac',
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer fake-load-test-token',
        },
      }
    );
    check(res, {
      'rate limited or auth rejected not crash': (r) => r.status !== 500,
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
      'rate limited or auth rejected not crash': (r) => r.status !== 500,
    });
  }
}
