import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';

const BARCODES = [
  '722252100146',
  '643843000018',
  '611269990006',
  '049000050202',
  '021000609192',
  '016000275553',
  '038000845108',
  '014100085386',
  '070470003016',
  '021130126026',
  '040000529071',
  '028400642941',
  '030100169459',
  '051500255742',
  '038000138416',
];

export const options = {
  stages: [
    { duration: '20s', target: 200 },
    { duration: '1m', target: 200 },
    { duration: '20s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000'],
    http_req_failed: ['rate<0.02'],
  },
};

export default function () {
  const barcode = randomItem(BARCODES);
  const res = http.get(`${BASE_URL}/api/food/barcode/${barcode}`, {
    headers: {
      Authorization: 'Bearer fake-load-test-token',
    },
  });

  check(res, {
    'found not found or auth': (r) =>
      r.status === 200 || r.status === 404 || r.status === 401,
    'not a crash': (r) => r.status !== 500,
    'response time ok': (r) => r.timings.duration < 3000,
  });

  sleep(1);
}
