import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const MOCK_CLIENT_IDS = [
  'client001',
  'client002',
  'client003',
  'client004',
  'client005',
  'client006',
  'client007',
  'client008',
  'client009',
  'client010',
];

export const options = {
  stages: [
    { duration: '20s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<4000'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  const rosterRes = http.get(`${BASE_URL}/api/trainer/clients`, {
    headers: {
      Authorization: 'Bearer fake-load-test-token',
    },
  });

  check(rosterRes, {
    'roster or auth not crash': (r) => r.status === 200 || r.status === 401,
    'not a crash': (r) => r.status !== 500,
  });

  const clientId = randomItem(MOCK_CLIENT_IDS);
  const metricsRes = http.get(
    `${BASE_URL}/api/trainer/clients/${clientId}/metrics`,
    {
      headers: {
        Authorization: 'Bearer fake-load-test-token',
      },
    }
  );

  check(metricsRes, {
    'metrics or auth not crash': (r) =>
      r.status === 200 || r.status === 401 || r.status === 404,
    'not a crash': (r) => r.status !== 500,
  });

  sleep(1);
}
