import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '10s', target: 1000 },
    { duration: '30s', target: 1000 },
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);

  check(res, {
    'server is up': (r) => r.status === 200 || r.status === 404,
    'not a crash': (r) => r.status !== 500,
    'not permanently down': (r) => r.status !== 503,
  });
}
