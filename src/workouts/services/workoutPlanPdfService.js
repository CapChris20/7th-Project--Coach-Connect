/**
 * Workout plan PDF: parse plan text, generate PDF (expo-print), save to Storage + Firestore.
 * Only used AFTER the plan is generated; does not change AI or prompts.
 */

import * as Print from 'expo-print';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { storage, db } from '../../app/config';

const STORAGE_PATH_PREFIX = 'workout-plans';
const FIRESTORE_COLLECTION = 'workoutPlans';

/**
 * Parse plan text into structured data for PDF.
 * Returns { title, subtitle, days: [{ label, exercises: [{ name, sets, reps, rest }] }], notes } or null.
 */
export function parsePlanForPdf(planText) {
  if (!planText || typeof planText !== 'string') return null;
  const raw = planText.trim();
  if (!raw.length) return null;

  try {
    let title = 'Workout Plan';
    let subtitle = '';
    const days = [];
    let notes = '';

    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const titleMatch = raw.match(/^(?:#\s*)?([^\n#]+?)(?:\s*[-—|]\s*([^\n]+))?$/m);
    if (titleMatch) {
      title = stripEmojis(stripMarkdown(titleMatch[1].trim()));
      if (titleMatch[2]) subtitle = stripEmojis(stripMarkdown(titleMatch[2].trim()));
    }

    const dayBlockRegex = /(?:^|\n)(?:(?:Day|Workout)\s*(\d+)[:\s\-—]*([^\n]*)|(?:##?\s*)?([^\n#]+?)\s*(?=\n(?:Exercise|•|\d\.)|$))/gim;
    let dayMatch;
    const daySections = [];
    let lastIndex = 0;
    while ((dayMatch = dayBlockRegex.exec(raw)) !== null) {
      const label = stripEmojis(stripMarkdown((dayMatch[2] || dayMatch[3] || `Day ${dayMatch[1] || daySections.length + 1}`).trim()));
      const start = dayMatch.index;
      daySections.push({ label, start, end: raw.length });
    }
    for (let i = 0; i < daySections.length; i++) {
      const block = daySections[i];
      const blockEnd = daySections[i + 1] ? daySections[i + 1].start : raw.length;
      const blockText = raw.slice(block.start, blockEnd);
      const exercises = [];
      const exerciseLineRegex = /(?:^|\n)\s*(?:•|\d+\.|\*)\s*([^—\-]+?)(?:\s*[—\-]\s*|\s+)(?:(\d+)\s*x\s*(\d+)|(\d+)\s*sets?\s*[x×]\s*(\d+)\s*reps?|(\d+)\s*reps?)(?:\s*[,;]\s*|\s+)(?:(\d+)\s*s\s*rest|(\d+)\s*sec(?:onds?)?\s*rest|rest\s*(\d+)\s*s)?/gim;
      let exMatch;
      while ((exMatch = exerciseLineRegex.exec(blockText)) !== null) {
        const name = stripEmojis(stripMarkdown((exMatch[1] || '').trim()));
        const sets = exMatch[2] || exMatch[4] || exMatch[6] || '—';
        const reps = exMatch[3] || exMatch[5] || exMatch[6] || '—';
        const rest = exMatch[7] || exMatch[8] || exMatch[9] ? `${exMatch[7] || exMatch[8] || exMatch[9]}s` : '—';
        if (name) exercises.push({ name, sets: String(sets), reps: String(reps), rest });
      }
      if (exercises.length === 0) {
        const bulletLines = blockText.split(/\n/).filter((l) => /^[\s•\d.*\-]/.test(l) && l.trim().length > 2);
        bulletLines.slice(0, 15).forEach((line) => {
          const cleaned = stripEmojis(stripMarkdown(line.replace(/^[\s•\d.*\-]+\s*/, '').trim()));
          if (cleaned) exercises.push({ name: cleaned, sets: '—', reps: '—', rest: '—' });
        });
      }
      daySections[i].exercises = exercises;
      days.push({ label: block.label, exercises: daySections[i].exercises });
    }

    const notesSections = ['IMPORTANT NOTES', '7\\. IMPORTANT NOTES', 'NOTES', 'Important notes'];
    for (const heading of notesSections) {
      const re = new RegExp(`${heading}[\\s\\S]*?(?=\\n\\n|$)`, 'i');
      const m = raw.match(re);
      if (m && m[0]) {
        notes = stripEmojis(stripMarkdown(m[0].replace(new RegExp(heading, 'i'), '').trim()));
        break;
      }
    }

    if (days.length === 0 && !title) return null;
    return { title, subtitle, days, notes };
  } catch (e) {
    return null;
  }
}

/** Remove emoji and other symbols (e.g. 🏆) from text for display and PDF. */
export function stripEmojis(s) {
  if (s == null || typeof s !== 'string') return '';
  return String(s)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // misc symbols & pictographs
    .replace(/[\u{2600}-\u{26FF}]/gu, '')     // misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // dingbats
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')  // emoticons
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')  // flags
    .replace(/\s+/g, ' ')
    .trim();
}

/** Strip markdown to plain text so PDF and displays don't show ** or ## etc. */
export function stripMarkdown(s) {
  if (s == null || typeof s !== 'string') return '';
  return String(s)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*•]\s*/gm, '')
    .replace(/^\s*\d+\.\s*/gm, '')
    .trim();
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build HTML for PDF: header, day sections with table, notes, footer.
 */
export function buildPdfHtml(parsed, clientName = 'Client') {
  const title = escapeHtml(parsed.title || 'Workout Plan');
  const subtitle = escapeHtml(parsed.subtitle || '');
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

  let body = '';
  (parsed.days || []).forEach((day, i) => {
    body += `
    <div class="day-section">
      <div class="day-header">DAY ${i + 1} — ${escapeHtml(day.label).toUpperCase()}</div>
      <table class="exercise-table">
        <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th></tr></thead>
        <tbody>
          ${(day.exercises || []).map((ex, j) => `
            <tr class="${j % 2 === 0 ? 'row-even' : 'row-odd'}">
              <td>${escapeHtml(ex.name)}</td>
              <td>${escapeHtml(ex.sets)}</td>
              <td>${escapeHtml(ex.reps)}</td>
              <td>${escapeHtml(ex.rest)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  });
  if (parsed.notes) {
    body += `<div class="notes-section"><div class="notes-header">Notes</div><div class="notes-body">${escapeHtml(parsed.notes)}</div></div>`;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; color: #111; }
    .header { background: #0a0a0a; color: #fff; padding: 20px 24px; }
    .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .client-name { font-size: 14px; color: rgba(255,255,255,0.8); }
    .logo { font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.9); letter-spacing: 0.5px; }
    .title { font-size: 22px; font-weight: 700; margin: 8px 0 4px 0; }
    .subtitle { font-size: 13px; color: #9ca3af; }
    .header-date { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 12px; }
    .day-section { margin-top: 24px; }
    .day-header { background: #374151; color: #fff; padding: 10px 16px; font-size: 13px; font-weight: 700; }
    .exercise-table { width: 100%; border-collapse: collapse; margin-top: 0; font-size: 12px; }
    .exercise-table th { background: #f3f4f6; padding: 10px 12px; text-align: left; font-weight: 600; }
    .exercise-table td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; }
    .row-even { background: #fff; }
    .row-odd { background: #f5f5f7; }
    .notes-section { margin-top: 24px; padding: 16px; background: #f9fafb; border-radius: 8px; }
    .notes-header { font-weight: 700; font-size: 13px; margin-bottom: 8px; }
    .notes-body { font-size: 12px; line-height: 1.5; color: #374151; white-space: pre-wrap; }
    .footer { text-align: center; padding: 24px; font-size: 11px; color: #6b7280; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <span class="client-name">${escapeHtml(clientName)}</span>
      <span class="logo">CoachConnect</span>
    </div>
    <div class="title">${title}</div>
    ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    <div class="header-date">${dateStr}</div>
  </div>
  ${body}
  <div class="footer">Generated by CoachConnect AI</div>
</body>
</html>`;
}

function uriToBlob(uri) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('Failed to fetch file'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });
}

/**
 * Generate PDF file from HTML. Returns { uri } (local file URI).
 */
export async function generatePdfFile(html) {
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  return { uri };
}

/**
 * Upload PDF to Firebase Storage: workout-plans/{uid}/{timestamp}-plan.pdf
 */
export async function uploadPdfToStorage(uid, localUri) {
  if (!storage || !uid) throw new Error('Storage or uid not ready');
  const path = `${STORAGE_PATH_PREFIX}/${uid}/${Date.now()}-plan.pdf`;
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);
  await uploadBytes(storageRef, blob, { contentType: 'application/pdf' });
  return getDownloadURL(storageRef);
}

/**
 * Save plan metadata to Firestore: users/{uid}/workoutPlans/{planId}
 */
export async function savePlanToFirestore(uid, planId, { url, planTitle, clientName }) {
  if (!db || !uid || !planId) throw new Error('Firestore or ids not ready');
  await setDoc(doc(db, 'users', uid, FIRESTORE_COLLECTION, planId), {
    url: url || null,
    generatedAt: serverTimestamp(),
    planTitle: planTitle || 'Workout Plan',
    clientName: clientName || null,
  });
}

/**
 * Fetch all saved workout plans for user from Firestore (users/{uid}/workoutPlans).
 * Returns array of { id, url, generatedAt, planTitle, clientName } sorted newest first.
 */
export async function getWorkoutPlans(uid) {
  if (!db || !uid) return [];
  try {
    const colRef = collection(db, 'users', uid, FIRESTORE_COLLECTION);
    const q = query(colRef, orderBy('generatedAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        url: data.url || null,
        generatedAt: data.generatedAt,
        planTitle: data.planTitle || 'Workout Plan',
        clientName: data.clientName || null,
      };
    });
  } catch (e) {
    if (e?.code === 'failed-precondition') return []; // no index; fallback: fetch without orderBy
    try {
      const snap = await getDocs(collection(db, 'users', uid, FIRESTORE_COLLECTION));
      const list = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          url: data.url || null,
          generatedAt: data.generatedAt,
          planTitle: data.planTitle || 'Workout Plan',
          clientName: data.clientName || null,
        };
      });
      list.sort((a, b) => {
        const ta = a.generatedAt?.toMillis?.() ?? a.generatedAt ?? 0;
        const tb = b.generatedAt?.toMillis?.() ?? b.generatedAt ?? 0;
        return tb - ta;
      });
      return list;
    } catch (_) {
      return [];
    }
  }
}

/**
 * Full flow: build HTML from parsed plan, generate PDF, upload to Storage, save to Firestore.
 * Returns { pdfLocalUri, pdfDownloadUrl, planId }.
 */
export async function generateAndSavePlanPdf(uid, parsed, clientName) {
  const html = buildPdfHtml(parsed, clientName);
  const { uri: pdfLocalUri } = await generatePdfFile(html);
  const pdfDownloadUrl = await uploadPdfToStorage(uid, pdfLocalUri);
  const planId = `plan_${Date.now()}`;
  await savePlanToFirestore(uid, planId, {
    url: pdfDownloadUrl,
    planTitle: parsed.title || 'Workout Plan',
    clientName,
  });
  return { pdfLocalUri, pdfDownloadUrl, planId };
}
