import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.FAKE_TOKEN || 'fake.firebase.token';

export const options = {
  stages: [
    { duration: '30s', target: 1000 },
    { duration: '30s', target: 1000 },
    { duration: '15s', target: 0 },
  ],
};

export default function () {
  const coach = http.post(
    `${BASE_URL}/api/coach/chat`,
    JSON.stringify({ messages: [{ role: 'user', content: 'quick check-in' }] }),
    { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
  );
  check(coach, { 'coach call handled': (r) => [200, 401, 403, 429].includes(r.status) });

  const food = http.post(
    `${BASE_URL}/api/food/search`,
    JSON.stringify({ query: 'banana' }),
    { headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' } }
  );
  check(food, { 'food call handled': (r) => [200, 401, 403, 429].includes(r.status) });
  sleep(0.3);
}
