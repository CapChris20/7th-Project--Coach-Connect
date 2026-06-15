import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.FAKE_TOKEN || 'fake.firebase.token';

export const options = {
  vus: 50,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<4000'],
    http_req_failed: ['rate<0.2'],
  },
};

export default function () {
  const payload = JSON.stringify({
    onboardingData: { goal: 'build muscle', trainingDaysPerWeek: 4 },
  });
  const res = http.post(`${BASE_URL}/api/workout/generate`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
      'X-Load-Test': '1',
    },
  });

  check(res, {
    'workout route responded': (r) => [200, 401, 403, 429].includes(r.status),
  });
  sleep(0.5);
}
