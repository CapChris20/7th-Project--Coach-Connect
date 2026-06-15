import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.FAKE_TOKEN || 'fake.firebase.token';

export const options = {
  vus: 1,
  duration: '60s',
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/coach/chat`,
    JSON.stringify({ messages: [{ role: 'user', content: 'spam request payload' }] }),
    {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
    }
  );
  check(res, { 'request handled': (r) => [200, 401, 403, 429].includes(r.status) });
  sleep(0.05);
}
