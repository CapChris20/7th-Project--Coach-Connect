/** Support contact + client error logging */
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const admin = require('firebase-admin');
const { sendSupportInquiryEmail, buildBodies } = require('../supportEmail');

const supportContactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many support messages. Please try again later.' },
});

function registerSupportRoutes(app, deps) {
  const { verifyFirebaseBearerToken, serverTs } = deps;

  app.post('/api/support/contact', supportContactLimiter, verifyFirebaseBearerToken, async (req, res) => {
  try {
    const uid = req.firebaseAuth?.uid;
    const userEmail = req.firebaseAuth?.email || null;
    const subject = String(req.body?.subject || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!subject || subject.length > 200) {
      return res.status(400).json({ error: 'Subject is required (max 200 characters).' });
    }
    if (!message || message.length > 8000) {
      return res.status(400).json({ error: 'Message is required (max 8000 characters).' });
    }

    const { text, html } = buildBodies({ message, userUid: uid, userEmail });
    const emailSubject = `[CoachConnect] ${subject}`;

    await sendSupportInquiryEmail({
      subject: emailSubject,
      text,
      html,
      replyTo: userEmail,
    });

    if (admin.apps.length) {
      try {
        await admin.firestore().collection('supportTickets').add({
          type: 'support',
          subject,
          message,
          userId: uid,
          email: userEmail,
          createdAt: serverTs(),
          delivery: 'email',
        });
      } catch (logErr) {
        console.warn('supportTickets Firestore log failed (email was sent):', logErr?.message || logErr);
      }
    }

    return res.json({ ok: true });
  } catch (e) {
    console.error('POST /api/support/contact failed:', e?.message || e);
    return res.status(500).json({ error: e?.message || 'Failed to send support message.' });
  }
});

app.post('/api/log-error', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const fs = require('fs');
    const ERROR_LOG_FILE = path.join(__dirname, '..', 'ERRORS.txt');
    
    const errorData = req.body;
    if (!errorData || !errorData.message) {
      return res.status(400).json({ error: 'Invalid error data' });
    }

    // Format timestamp
    const formatTimestamp = (date) => {
      const now = date || new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      return `${dateStr} at ${timeStr}`;
    };

    // Read existing file
    let existingContent = '';
    if (fs.existsSync(ERROR_LOG_FILE)) {
      existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    }

    // Remove "No errors logged yet" if present
    if (existingContent.includes("No errors logged yet")) {
      existingContent = existingContent.split("No errors logged yet")[0];
    }

    // Extract current error count
    const countMatch = existingContent.match(/Total Errors: (\d+)/);
    const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
    const newCount = currentCount + 1;

    // Format error entry
    const now = new Date();
    const readableTime = errorData.readableTime || formatTimestamp(now);
    const timestamp = errorData.timestamp || now.toISOString();
    
    const errorEntry = `================================================================================
ERROR ${newCount}
================================================================================

Message: ${errorData.message || "Unknown error"}
Code: ${errorData.code || "None"}
Context: ${errorData.context || "Unknown"}
Time: ${readableTime}
Timestamp: ${timestamp}
Stack Trace:
${errorData.stack || "No stack trace"}

`;

    // Build new content
    const readableUpdateTime = formatTimestamp(now);
    let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;
    
    // Add new error first
    newContent += errorEntry;

    // Append existing errors
    if (existingContent) {
      const errorsStart = existingContent.indexOf("================================================================================");
      if (errorsStart !== -1) {
        const existingErrors = existingContent.substring(errorsStart);
        newContent += existingErrors;
      }
    }

    // Write to file
    fs.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
    
    res.json({ success: true, message: 'Error logged successfully' });
  } catch (error) {
    console.error('Failed to log error to file:', error);
    res.status(500).json({ error: 'Failed to log error' });
  }
});

// Sync queued errors endpoint - syncs multiple errors at once
app.post('/api/sync-errors', verifyFirebaseBearerToken, async (req, res) => {
  try {
    const fs = require('fs');
    const ERROR_LOG_FILE = path.join(__dirname, '..', 'ERRORS.txt');
    const queuedErrors = req.body.errors || [];
    
    if (queuedErrors.length === 0) {
      return res.json({ success: true, synced: 0 });
    }

    // Format timestamp helper
    const formatTimestamp = (date) => {
      const now = date || new Date();
      const dateStr = now.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      const timeStr = now.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      return `${dateStr} at ${timeStr}`;
    };

    // Read existing file
    let existingContent = '';
    if (fs.existsSync(ERROR_LOG_FILE)) {
      existingContent = fs.readFileSync(ERROR_LOG_FILE, 'utf8');
    }

    if (existingContent.includes("No errors logged yet")) {
      existingContent = existingContent.split("No errors logged yet")[0];
    }

    // Get current count
    const countMatch = existingContent.match(/Total Errors: (\d+)/);
    const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
    const newCount = currentCount + queuedErrors.length;

    // Build new content
    const now = new Date();
    const readableUpdateTime = formatTimestamp(now);
    let newContent = `🔥 ANATROX ERROR LOG
================================================================================

Automatically generated list of ALL application errors.
This file logs EVERY SINGLE ERROR that occurs (Firebase, API, UI, network, and general errors).

Total Errors: ${newCount}

Last updated: ${readableUpdateTime}

`;

    // Add all queued errors
    queuedErrors.forEach((errorData, index) => {
      const errorNum = currentCount + index + 1;
      const readableTime = errorData.readableTime || formatTimestamp(new Date(errorData.timestamp || errorData.queuedAt || Date.now()));
      const timestamp = errorData.timestamp || errorData.queuedAt || new Date().toISOString();
      
      newContent += `================================================================================
ERROR ${errorNum}
================================================================================

Message: ${errorData.message || "Unknown error"}
Code: ${errorData.code || "None"}
Context: ${errorData.context || "Unknown"}
Time: ${readableTime}
Timestamp: ${timestamp}
Stack Trace:
${errorData.stack || "No stack trace"}

`;
    });

    // Append existing errors
    if (existingContent) {
      const errorsStart = existingContent.indexOf("================================================================================");
      if (errorsStart !== -1) {
        const existingErrors = existingContent.substring(errorsStart);
        newContent += existingErrors;
      }
    }

    // Write to file
    fs.writeFileSync(ERROR_LOG_FILE, newContent, 'utf8');
    
    res.json({ success: true, synced: queuedErrors.length });
  } catch (error) {
    console.error('Failed to sync errors:', error);
    res.status(500).json({ error: 'Failed to sync errors' });
  }
});

}

module.exports = { registerSupportRoutes };
