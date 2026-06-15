import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.FAKE_TOKEN || 'fake.firebase.token';

export const options = {
  vus: 100,
  duration: '60s',
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.25'],
  },
};

export default function () {
  const payload = JSON.stringify({
    messages: [{ role: 'user', content: 'How much protein should I eat?' }],
  });

  const res = http.post(`${BASE_URL}/api/coach/chat`, payload, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  });

  check(res, {
    'ai coach route responded': (r) => [200, 401, 403, 429].includes(r.status),
  });
  sleep(0.5);
}
