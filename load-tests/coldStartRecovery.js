import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '5s', target: 500 },
    { duration: '30s', target: 500 },
    { duration: '5s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(90)<10000'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);

  check(res, {
    'recovered from cold start': (r) => r.status === 200 || r.status === 404,
    'not permanently down': (r) => r.status !== 503,
  });
}
