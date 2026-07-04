import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '2m', target: 50 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/workout/generate`,
    JSON.stringify({
      goal: 'build_muscle',
      daysPerWeek: 5,
      experience: 'intermediate',
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer fake-load-test-token',
        'X-Load-Test': '1',
      },
    }
  );

  check(res, {
    'status is 200 or 401 or 429': (r) =>
      r.status === 200 || r.status === 401 || r.status === 429,
    'not a crash': (r) => r.status !== 500,
    'is mocked not real claude': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.mock === true || r.status === 401;
      } catch {
        return false;
      }
    },
  });

  sleep(2);
}
