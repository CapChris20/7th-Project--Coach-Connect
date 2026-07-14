/**
 * Unit checks for certification decision thresholds (no API key required).
 */
const {
  decideVerificationOutcome,
  normalizeMediaType,
} = require('../lib/verifyTrainerCertification');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(normalizeMediaType('image/jpg') === 'image/jpeg', 'jpg alias');
assert(normalizeMediaType('application/pdf') == null, 'pdf unsupported for vision');

let o = decideVerificationOutcome({
  isLegit: true,
  confidence: 0.91,
  issues: [],
});
assert(o.status === 'approved' && o.isVerified === true, 'high confidence auto-approve');
assert(o.userMessage.includes('verified'), 'verified message');

o = decideVerificationOutcome({ isLegit: true, confidence: 0.7, issues: [] });
assert(o.status === 'manual_review' && o.needsManualReview === true, 'mid confidence review');
assert(o.userMessage === 'Under review', 'under review message');

o = decideVerificationOutcome({
  isLegit: false,
  confidence: 0.9,
  issues: ['Looks photoshopped'],
});
assert(o.status === 'rejected' && o.isVerified === false, 'not legit rejects');

o = decideVerificationOutcome({ isLegit: true, confidence: 0.4, issues: ['Blurry'] });
assert(o.status === 'rejected', 'low confidence rejects');

console.log('verifyTrainerCertification decision tests passed');
