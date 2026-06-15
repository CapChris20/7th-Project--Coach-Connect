import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
const TOKEN = __ENV.FAKE_TOKEN || 'fake.firebase.token';
const CODES = ['722252100146', '049000050202', '021130126026', '038000138416'];

export const options = {
  stages: [
    { duration: '20s', target: 200 },
    { duration: '40s', target: 200 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
  },
};

export default function () {
  const code = CODES[Math.floor(Math.random() * CODES.length)];
  const res = http.get(`${BASE_URL}/api/barcode/${code}`, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  check(res, { 'barcode route handled': (r) => [200, 401, 403, 404, 429].includes(r.status) });
  sleep(0.25);
}
