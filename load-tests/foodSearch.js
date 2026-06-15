import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.FAKE_TOKEN || 'fake.firebase.token';

export const options = {
  vus: 500,
  duration: '45s',
  thresholds: {
    http_req_duration: ['p(95)<2500'],
    http_req_failed: ['rate<0.35'],
  },
};

export default function () {
  const payload = JSON.stringify({ query: 'chicken breast', limit: 10 });
  const res = http.post(`${BASE_URL}/api/food/search`, payload, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  });

  check(res, {
    'food route responded': (r) => [200, 401, 403, 429].includes(r.status),
  });
  sleep(0.2);
}
