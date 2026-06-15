import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

export const options = {
  stages: [
    { duration: '20s', target: 1000 },
    { duration: '40s', target: 1000 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1500'],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/health`);
  check(res, { 'health status': (r) => [200, 404].includes(r.status) });
}
