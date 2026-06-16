/**
 * Branded password-reset emails via Firebase Admin link + Resend/SMTP.
 */
const admin = require('firebase-admin');
const { sendTransactionalEmail, isTransactionalEmailConfigured } = require('../supportEmail');
const {
  getPasswordResetPageBaseUrl,
  rewriteResetLinkToBrandedPage,
} = require('./passwordResetPage');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function maskEmail(email) {
  const s = String(email || '').trim();
  const at = s.indexOf('@');
  if (at <= 1) return '***';
  return `${s[0]}***${s.slice(at)}`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPasswordResetHtml({ resetLink, recipientEmail }) {
  const link = escapeHtml(resetLink);
  const emailLine = recipientEmail
    ? `<p style="margin:0 0 20px;font-size:14px;line-height:21px;color:rgba(255,255,255,0.72);">
        Hi there — we received a request to reset the password for <strong style="color:#FFFFFF;">${escapeHtml(recipientEmail)}</strong>.
      </p>`
    : `<p style="margin:0 0 20px;font-size:14px;line-height:21px;color:rgba(255,255,255,0.72);">
        Hi there — we received a request to reset your Coach Connect password.
      </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta name="color-scheme" content="dark"/>
  <title>Reset your Coach Connect password</title>
</head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Inter,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Reset your Coach Connect password — tap the button to choose a new password.
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0A0A0F;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:520px;background:#15151C;border-radius:20px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
        <tr><td style="height:4px;background:linear-gradient(90deg,#BE185D 0%,#C2410C 100%);"></td></tr>
        <tr><td style="padding:32px 28px 12px;">
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <div style="width:40px;height:40px;border-radius:12px;background:linear-gradient(135deg,#E94EAD,#6B3AD9);text-align:center;line-height:40px;font-size:18px;color:#fff;font-weight:900;">C</div>
            </td>
            <td style="vertical-align:middle;">
              <p style="margin:0;font-size:11px;font-weight:800;letter-spacing:0.2em;color:rgba(255,255,255,0.45);">COACH CONNECT</p>
              <p style="margin:2px 0 0;font-size:13px;font-weight:600;color:rgba(255,255,255,0.55);">Password reset</p>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:8px 28px 8px;">
          <h1 style="margin:0 0 12px;font-size:28px;font-weight:900;color:#FFFFFF;letter-spacing:-0.4px;line-height:1.2;">Reset your password</h1>
          ${emailLine}
          <p style="margin:0;font-size:14px;line-height:22px;color:rgba(255,255,255,0.62);">
            Tap the button below to open our secure reset page. You'll choose a new password, then sign back in on the app.
          </p>
        </td></tr>
        <tr><td style="padding:24px 28px 8px;" align="center">
          <a href="${link}" style="display:inline-block;min-width:220px;padding:16px 32px;border-radius:14px;background:linear-gradient(90deg,#C1265A,#D84315);color:#FFFFFF;font-size:16px;font-weight:800;text-decoration:none;text-align:center;box-shadow:0 8px 24px rgba(193,38,90,0.35);">Reset password</a>
        </td></tr>
        <tr><td style="padding:12px 28px 28px;">
          <p style="margin:0 0 16px;font-size:12px;line-height:18px;color:rgba(255,255,255,0.42);">
            Button not working? <a href="${link}" style="color:#C084FC;font-weight:700;text-decoration:underline;">Open reset page</a>
          </p>
          <p style="margin:0;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);font-size:12px;line-height:18px;color:rgba(255,255,255,0.38);">
            If you didn't request this, you can ignore this email — your password won't change.<br/>
            This link expires soon for your security.
          </p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11px;color:rgba(255,255,255,0.32);">© Coach Connect</p>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildPasswordResetText({ resetLink, recipientEmail }) {
  return [
    'Coach Connect — Reset your password',
    '',
    recipientEmail ? `Account: ${recipientEmail}` : '',
    '',
    'We received a request to reset your password.',
    'Open this secure link to choose a new password:',
    '',
    resetLink,
    '',
    "If you didn't request this, ignore this email.",
    'The link expires soon for your security.',
    '',
    '— Coach Connect',
  ]
    .filter(Boolean)
    .join('\n');
}

function getActionCodeSettings() {
  const pageUrl = getPasswordResetPageBaseUrl();
  const settings = {
    url: pageUrl,
    handleCodeInApp: false,
  };

  const iosBundle = process.env.PASSWORD_RESET_IOS_BUNDLE_ID || 'com.chrisshina.coachconnect';
  const androidPackage = process.env.PASSWORD_RESET_ANDROID_PACKAGE || 'com.chrisshina.coachconnect';
  if (iosBundle) settings.iOS = { bundleId: iosBundle };
  if (androidPackage) {
    settings.android = {
      packageName: androidPackage,
      installApp: true,
      minimumVersion: '1',
    };
  }

  return settings;
}

/**
 * @param {string} email
 * @returns {Promise<{ sent: boolean, provider?: string, useClientFirebase?: boolean }>}
 */
async function sendBrandedPasswordResetEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(normalized)) {
    throw new Error('Invalid email address');
  }

  if (!admin.apps.length) {
    console.warn('[password-reset] Firebase Admin not initialized — client will use Firebase SDK', {
      email: maskEmail(normalized),
    });
    return { sent: false, useClientFirebase: true };
  }

  if (!isTransactionalEmailConfigured()) {
    console.warn('[password-reset] Email provider not configured — client will use Firebase SDK', {
      email: maskEmail(normalized),
    });
    return { sent: false, useClientFirebase: true };
  }

  let resetLink;
  try {
    const firebaseLink = await admin.auth().generatePasswordResetLink(normalized, getActionCodeSettings());
    resetLink = rewriteResetLinkToBrandedPage(firebaseLink);
    console.log('[password-reset] Branded reset page URL', {
      email: maskEmail(normalized),
      page: getPasswordResetPageBaseUrl(),
    });
  } catch (e) {
    const code = e?.code || '';
    if (code === 'auth/user-not-found') {
      console.log('[password-reset] No Firebase user for email (generic success returned)', {
        email: maskEmail(normalized),
      });
      return { sent: true, provider: 'noop' };
    }
    throw e;
  }

  console.log('[password-reset] Sending branded reset email…', { email: maskEmail(normalized) });

  const result = await sendTransactionalEmail({
    to: normalized,
    subject: 'Reset your Coach Connect password',
    text: buildPasswordResetText({ resetLink, recipientEmail: normalized }),
    html: buildPasswordResetHtml({ resetLink, recipientEmail: normalized }),
  });

  console.log('[password-reset] Reset email sent', {
    email: maskEmail(normalized),
    provider: result.provider,
    messageId: result.id || null,
  });

  return { sent: true, provider: result.provider };
}

module.exports = {
  sendBrandedPasswordResetEmail,
  buildPasswordResetHtml,
  buildPasswordResetText,
  EMAIL_RE,
};
