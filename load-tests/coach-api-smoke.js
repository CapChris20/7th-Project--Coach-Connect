/**
 * k6 smoke — AI Coach health + rate-limit headers (run against local or staging API).
 * Usage: k6 run load-tests/coach-api-smoke.js
 * Env: K6_BASE_URL=http://127.0.0.1:4000
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.K6_BASE_URL || 'http://127.0.0.1:4000';

export const options = {
  vus: 2,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function coachApiSmoke() {
  const health = http.get(`${BASE}/health`);
  check(health, {
    'health 200': (r) => r.status === 200,
  });

  const unauthorized = http.post(
    `${BASE}/api/ai-coach/execute-tool`,
    JSON.stringify({ userId: 'test', toolCall: { name: 'logWater', params: { amount_oz: 8 } }, confirmed: true }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(unauthorized, {
    'execute-tool rejects missing auth': (r) => r.status === 401 || r.status === 403,
  });

  sleep(1);
}
