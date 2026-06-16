/** Password reset and other unauthenticated auth helpers */
const rateLimit = require('express-rate-limit');
const { sendBrandedPasswordResetEmail, EMAIL_RE } = require('../lib/passwordResetEmail');

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset attempts. Please try again in a few minutes.' },
});

const GENERIC_OK_MESSAGE =
  'If an account exists for that email, we sent a password reset link. Check your inbox and spam folder.';

function registerAuthRoutes(app) {
  app.post('/api/auth/forgot-password', forgotPasswordLimiter, async (req, res) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }
      if (!EMAIL_RE.test(email)) {
        return res.status(400).json({ error: 'Please enter a valid email address' });
      }

      let useClientFirebase = false;
      let provider = null;

      try {
        const result = await sendBrandedPasswordResetEmail(email);
        useClientFirebase = result.useClientFirebase === true;
        provider = result.provider || null;
      } catch (e) {
        console.error('[auth/forgot-password] send failed:', e?.message || e);
        useClientFirebase = true;
      }

      return res.json({
        ok: true,
        message: GENERIC_OK_MESSAGE,
        useClientFirebase,
        provider,
      });
    } catch (e) {
      console.error('POST /api/auth/forgot-password failed:', e?.message || e);
      return res.status(500).json({ error: 'Could not process password reset. Please try again.' });
    }
  });
}

module.exports = { registerAuthRoutes };
