/**
 * AI-powered trainer certification verification via Claude vision (Anthropic SDK).
 * Analyzes uploaded certification images and writes results to Firestore.
 */

const axios = require('axios');
const admin = require('firebase-admin');
const AnthropicPkg = require('@anthropic-ai/sdk');
const Anthropic = AnthropicPkg.Anthropic || AnthropicPkg.default || AnthropicPkg;

function resolveAnthropicKey() {
  return (
    (process.env.ANTHROPIC_API_KEY || '').trim() ||
    (process.env.CLAUDE_API_KEY || '').trim() ||
    // Local/dev fallback only — prefer server ANTHROPIC_API_KEY in production
    (process.env.EXPO_PUBLIC_CLAUDE_API_KEY || '').trim() ||
    null
  );
}

function extractJsonObject(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    /* fall through */
  }
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch (_) {
      /* fall through */
    }
  }
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch (_) {
      /* fall through */
    }
  }
  return null;
}

function normalizeMediaType(mime) {
  const m = String(mime || '').toLowerCase().trim();
  if (m === 'image/jpg' || m === 'image/jpeg') return 'image/jpeg';
  if (m === 'image/png') return 'image/png';
  if (m === 'image/gif') return 'image/gif';
  if (m === 'image/webp') return 'image/webp';
  return null;
}

async function fetchImageAsBase64(imageUrl) {
  const resp = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: 12 * 1024 * 1024,
    validateStatus: () => true,
  });
  if (resp.status < 200 || resp.status >= 300) {
    throw new Error(`Failed to download certification image (HTTP ${resp.status})`);
  }
  const contentType = normalizeMediaType(resp.headers?.['content-type']) || 'image/jpeg';
  const base64 = Buffer.from(resp.data).toString('base64');
  return { base64, mediaType: contentType };
}

/**
 * Call Claude vision to analyze a certification image.
 * @returns {{ isLegit, certType, certNumber, expirationDate, confidence, issues }}
 */
async function analyzeCertificationWithClaude({
  imageBase64,
  mediaType,
  trainerName,
}) {
  const apiKey = resolveAnthropicKey();
  if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

  const model =
    process.env.CLAUDE_VISION_MODEL ||
    process.env.CLAUDE_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-sonnet-4-5';

  const system = `You are a certification document fraud analyst for a fitness coaching app.
Inspect the image carefully and return ONLY valid JSON (no markdown) with this shape:
{
  "isLegit": boolean,
  "certType": string|null,
  "certNumber": string|null,
  "expirationDate": string|null,
  "confidence": number,
  "issues": string[]
}

Rules:
- isLegit: true only if this appears to be a real fitness/personal-training (or related) certification document.
- confidence: 0 to 1 based on image clarity, authenticity cues, and completeness of fields.
- Check: is this actually a certification? Does it have a valid-looking cert number? Is expiration current (not expired)? Does the name on the document reasonably match "${trainerName}"? Are there forgery/quality issues (blurry, cropped, inconsistent fonts, photoshop artifacts)?
- expirationDate: ISO date YYYY-MM-DD when possible, else null.
- issues: short human-readable problems (empty array if none).`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model,
    max_tokens: 800,
    temperature: 0,
    system,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `Trainer name on file: "${trainerName}". Analyze this certification upload and respond with JSON only.`,
          },
        ],
      },
    ],
  });

  const text =
    (Array.isArray(message?.content)
      ? message.content.find((c) => c?.type === 'text')?.text
      : '') || '';
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Claude returned non-JSON certification analysis');
  }

  const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  const isLegit = parsed.isLegit === true;
  const issues = Array.isArray(parsed.issues)
    ? parsed.issues.map((x) => String(x)).filter(Boolean)
    : [];

  return {
    isLegit,
    certType: parsed.certType != null ? String(parsed.certType) : null,
    certNumber: parsed.certNumber != null ? String(parsed.certNumber) : null,
    expirationDate: parsed.expirationDate != null ? String(parsed.expirationDate) : null,
    confidence,
    issues,
  };
}

function decideVerificationOutcome(analysis) {
  const { isLegit, confidence, issues } = analysis;
  if (!isLegit || confidence < 0.6) {
    return {
      status: 'rejected',
      decision: 'rejected',
      userMessage: 'Rejected',
      reason:
        issues[0] ||
        (!isLegit
          ? 'Document does not appear to be a valid certification.'
          : 'Low confidence in document authenticity.'),
      isVerified: false,
      needsManualReview: false,
    };
  }
  if (confidence > 0.85) {
    return {
      status: 'approved',
      decision: 'auto_approved',
      userMessage: 'Certification verified ✓',
      reason: null,
      isVerified: true,
      needsManualReview: false,
    };
  }
  return {
    status: 'manual_review',
    decision: 'manual_review',
    userMessage: 'Under review',
    reason: 'Needs manual admin review',
    isVerified: false,
    needsManualReview: true,
  };
}

/**
 * Analyze certification, persist to trainers/{trainerId}/aiVerification, apply auto-approval rules.
 */
async function verifyTrainerCertification({
  trainerId,
  trainerName,
  imageBase64,
  imageUrl,
  mediaType,
  storagePath = null,
  fileName = null,
  serverTs = () => admin.firestore.FieldValue.serverTimestamp(),
}) {
  if (!trainerId) throw new Error('trainerId is required');
  if (!admin.apps.length) throw new Error('Firebase Admin not initialized');

  let base64 = imageBase64 ? String(imageBase64).replace(/^data:[^;]+;base64,/, '') : null;
  let mime = normalizeMediaType(mediaType);

  if (!base64 && imageUrl) {
    const fetched = await fetchImageAsBase64(imageUrl);
    base64 = fetched.base64;
    mime = mime || fetched.mediaType;
  }

  if (!base64) throw new Error('imageBase64 or imageUrl is required');
  if (!mime) throw new Error('Unsupported media type — use JPEG, PNG, GIF, or WebP');

  const analysis = await analyzeCertificationWithClaude({
    imageBase64: base64,
    mediaType: mime,
    trainerName: String(trainerName || '').trim() || 'Unknown trainer',
  });
  const outcome = decideVerificationOutcome(analysis);
  const now = serverTs();

  const payload = {
    ...analysis,
    ...outcome,
    trainerName: String(trainerName || '').trim() || null,
    storagePath: storagePath || null,
    fileName: fileName || null,
    imageUrl: imageUrl || null,
    analyzedAt: now,
    updatedAt: now,
  };

  const db = admin.firestore();
  const trainerRef = db.collection('trainers').doc(String(trainerId));
  const historyRef = trainerRef.collection('aiVerification').doc();

  const batch = db.batch();
  batch.set(historyRef, payload);
  batch.set(trainerRef.collection('aiVerification').doc('latest'), payload, { merge: true });
  batch.set(
    trainerRef,
    {
      aiVerification: payload,
      certificationVerificationStatus: outcome.status,
      isVerified: outcome.isVerified === true,
      certificationVerifiedAt: outcome.isVerified ? now : null,
      updatedAt: now,
    },
    { merge: true },
  );

  if (outcome.needsManualReview) {
    const adminRef = db.collection('admin_notifications').doc();
    batch.set(adminRef, {
      type: 'certification_manual_review',
      trainerId: String(trainerId),
      trainerName: String(trainerName || '').trim() || null,
      confidence: analysis.confidence,
      certType: analysis.certType,
      storagePath: storagePath || null,
      imageUrl: imageUrl || null,
      issues: analysis.issues,
      createdAt: now,
      status: 'pending',
    });
  }

  await batch.commit();

  return {
    analysis,
    outcome,
    userMessage: outcome.userMessage,
    status: outcome.status,
    aiVerification: payload,
  };
}

module.exports = {
  verifyTrainerCertification,
  analyzeCertificationWithClaude,
  decideVerificationOutcome,
  normalizeMediaType,
};
