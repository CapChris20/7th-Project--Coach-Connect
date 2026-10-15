// Workout plan PDF: turn plan text into a file, then save it to Storage and Firestore.
// Flow: parse the plan → build HTML → print to a PDF → upload → write the metadata row.
// Used after a plan is generated. This file does not change AI prompts.

import * as Print from 'expo-print';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { storage, db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

const STORAGE_PATH_PREFIX = 'workout-plans';
const FIRESTORE_COLLECTION = 'workoutPlans';
const USERS_COLLECTION = 'users';
const DEFAULT_PLAN_TITLE = 'Workout Plan';
const DEFAULT_CLIENT_NAME = 'Client';
const MISSING_SET_REP_REST = '—';
const PDF_CONTENT_TYPE = 'application/pdf';
const INDEX_MISSING_CODE = 'failed-precondition';
const MAX_FALLBACK_BULLETS = 15;
const REST_CAPTURE_GROUP = 7;
const NOTES_HEADINGS = ['IMPORTANT NOTES', '7\\. IMPORTANT NOTES', 'NOTES', 'Important notes'];

// ===== HELPER FUNCTIONS =====

/**
 * Remove emoji and other symbols (for example 🏆) so the PDF does not print tofu boxes.
 * @param {string} text
 * @returns {string}
 */
export function stripEmojis(text) {
  if (text == null || typeof text !== 'string') return '';
  return String(text)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
    .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strip markdown markers so the PDF does not show ** or ##.
 * @param {string} text
 * @returns {string}
 */
export function stripMarkdown(text) {
  if (text == null || typeof text !== 'string') return '';
  return String(text)
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^\s*[-*•]\s*/gm, '')
    .replace(/^\s*\d+\.\s*/gm, '')
    .trim();
}

/**
 * @param {string} text
 * @returns {string}
 */
function cleanPlanText(text) {
  return stripEmojis(stripMarkdown(text));
}

/**
 * HTML-escape so a plan title with < or & cannot break the PDF markup.
 * @param {*} text
 * @returns {string}
 */
function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} raw
 * @returns {{ title: string, subtitle: string }}
 */
function parseTitleAndSubtitle(raw) {
  let title = DEFAULT_PLAN_TITLE;
  let subtitle = '';
  const titleMatch = raw.match(/^(?:#\s*)?([^\n#]+?)(?:\s*[-—|]\s*([^\n]+))?$/m);
  if (!titleMatch) return { title, subtitle };
  title = cleanPlanText(titleMatch[1].trim());
  if (titleMatch[2]) subtitle = cleanPlanText(titleMatch[2].trim());
  return { title, subtitle };
}

/**
 * Headings like "Day 1 — Push" or "## Upper Body". end is filled in on a second pass.
 * @param {string} raw
 * @returns {Array<{ label: string, start: number, end: number }>}
 */
function collectDaySections(raw) {
  const dayBlockRegex = /(?:^|\n)(?:(?:Day|Workout)\s*(\d+)[:\s\-—]*([^\n]*)|(?:##?\s*)?([^\n#]+?)\s*(?=\n(?:Exercise|•|\d\.)|$))/gim;
  const daySections = [];
  let dayMatch = dayBlockRegex.exec(raw);
  while (dayMatch !== null) {
    const fallbackLabel = `Day ${dayMatch[1] || daySections.length + 1}`;
    const label = cleanPlanText((dayMatch[2] || dayMatch[3] || fallbackLabel).trim());
    daySections.push({ label, start: dayMatch.index, end: raw.length });
    dayMatch = dayBlockRegex.exec(raw);
  }
  return daySections;
}

/**
 * @param {RegExpMatchArray} exerciseMatch
 * @returns {{ name: string, sets: string, reps: string, rest: string }|null}
 */
function exerciseFromRegexMatch(exerciseMatch) {
  const name = cleanPlanText((exerciseMatch[1] || '').trim());
  if (!name) return null;
  const sets = exerciseMatch[2] || exerciseMatch[4] || exerciseMatch[6] || MISSING_SET_REP_REST;
  const reps = exerciseMatch[3] || exerciseMatch[5] || exerciseMatch[6] || MISSING_SET_REP_REST;
  const restSeconds = exerciseMatch[REST_CAPTURE_GROUP] || exerciseMatch[8] || exerciseMatch[9];
  const rest = restSeconds ? `${restSeconds}s` : MISSING_SET_REP_REST;
  return { name, sets: String(sets), reps: String(reps), rest };
}

/**
 * Structured "3 x 10, 60s rest" lines. AI plans usually look like this.
 * @param {string} blockText
 * @returns {Array<{ name: string, sets: string, reps: string, rest: string }>}
 */
function parseStructuredExercises(blockText) {
  const exerciseLineRegex = /(?:^|\n)\s*(?:•|\d+\.|\*)\s*([^—\-]+?)(?:\s*[—\-]\s*|\s+)(?:(\d+)\s*x\s*(\d+)|(\d+)\s*sets?\s*[x×]\s*(\d+)\s*reps?|(\d+)\s*reps?)(?:\s*[,;]\s*|\s+)(?:(\d+)\s*s\s*rest|(\d+)\s*sec(?:onds?)?\s*rest|rest\s*(\d+)\s*s)?/gim;
  const exercises = [];
  let exerciseMatch = exerciseLineRegex.exec(blockText);
  while (exerciseMatch !== null) {
    const exercise = exerciseFromRegexMatch(exerciseMatch);
    if (exercise) exercises.push(exercise);
    exerciseMatch = exerciseLineRegex.exec(blockText);
  }
  return exercises;
}

/**
 * When the structured regex finds nothing, keep the first bullets as names only.
 * @param {string} blockText
 * @returns {Array<{ name: string, sets: string, reps: string, rest: string }>}
 */
function parseBulletFallbackExercises(blockText) {
  const bulletLines = blockText.split(/\n/).filter((line) => /^[\s•\d.*\-]/.test(line) && line.trim().length > 2);
  const exercises = [];
  for (const line of bulletLines.slice(0, MAX_FALLBACK_BULLETS)) {
    const cleaned = cleanPlanText(line.replace(/^[\s•\d.*\-]+\s*/, '').trim());
    if (cleaned) {
      exercises.push({
        name: cleaned,
        sets: MISSING_SET_REP_REST,
        reps: MISSING_SET_REP_REST,
        rest: MISSING_SET_REP_REST,
      });
    }
  }
  return exercises;
}

/**
 * @param {string} blockText
 * @returns {Array<{ name: string, sets: string, reps: string, rest: string }>}
 */
function parseExercisesFromBlock(blockText) {
  const structured = parseStructuredExercises(blockText);
  if (structured.length > 0) return structured;
  return parseBulletFallbackExercises(blockText);
}

/**
 * @param {string} raw
 * @param {Array<{ label: string, start: number, end: number }>} daySections
 * @returns {Array<{ label: string, exercises: object[] }>}
 */
function daysFromSections(raw, daySections) {
  const days = [];
  for (let i = 0; i < daySections.length; i++) {
    const block = daySections[i];
    const blockEnd = daySections[i + 1] ? daySections[i + 1].start : raw.length;
    const exercises = parseExercisesFromBlock(raw.slice(block.start, blockEnd));
    daySections[i].exercises = exercises;
    days.push({ label: block.label, exercises });
  }
  return days;
}

/**
 * First matching notes heading wins. "7. IMPORTANT NOTES" is an older plan template.
 * @param {string} raw
 * @returns {string}
 */
function parseNotes(raw) {
  for (const heading of NOTES_HEADINGS) {
    const notesRegex = new RegExp(`${heading}[\\s\\S]*?(?=\\n\\n|$)`, 'i');
    const match = raw.match(notesRegex);
    if (!match || !match[0]) continue;
    return cleanPlanText(match[0].replace(new RegExp(heading, 'i'), '').trim());
  }
  return '';
}

/**
 * @param {object} parsed
 * @returns {string}
 */
function exerciseTablesHtml(parsed) {
  let body = '';
  (parsed.days || []).forEach((day, i) => {
    body += `
    <div class="day-section">
      <div class="day-header">DAY ${i + 1} — ${escapeHtml(day.label).toUpperCase()}</div>
      <table class="exercise-table">
        <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th></tr></thead>
        <tbody>
          ${(day.exercises || []).map((exercise, j) => `
            <tr class="${j % 2 === 0 ? 'row-even' : 'row-odd'}">
              <td>${escapeHtml(exercise.name)}</td>
              <td>${escapeHtml(exercise.sets)}</td>
              <td>${escapeHtml(exercise.reps)}</td>
              <td>${escapeHtml(exercise.rest)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  });
  if (parsed.notes) {
    body += `<div class="notes-section"><div class="notes-header">Notes</div><div class="notes-body">${escapeHtml(parsed.notes)}</div></div>`;
  }
  return body;
}

/**
 * vocab: XMLHttpRequest + responseType blob is how React Native turns a file:// URI into bytes for Storage.
 * @param {string} uri
 * @returns {Promise<Blob>}
 */
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
 * @param {object} planDoc
 * @returns {object}
 */
function mapPlanDocument(planDoc) {
  const data = planDoc.data();
  return {
    id: planDoc.id,
    url: data.url || null,
    generatedAt: data.generatedAt,
    planTitle: data.planTitle || DEFAULT_PLAN_TITLE,
    clientName: data.clientName || null,
  };
}

/**
 * Newest generatedAt first. Missing timestamps sort as 0 so they sink.
 * @param {object[]} plans
 */
function sortPlansNewestFirst(plans) {
  plans.sort((leftPlan, rightPlan) => {
    const leftTime = leftPlan.generatedAt?.toMillis?.() ?? leftPlan.generatedAt ?? 0;
    const rightTime = rightPlan.generatedAt?.toMillis?.() ?? rightPlan.generatedAt ?? 0;
    return rightTime - leftTime;
  });
}

/**
 * Used when the generatedAt index is still building.
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
async function fetchPlansWithoutOrder(uid) {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION, uid, FIRESTORE_COLLECTION));
  const plans = snapshot.docs.map(mapPlanDocument);
  sortPlansNewestFirst(plans);
  return plans;
}

// ===== MAIN FUNCTION =====

/**
 * Parse plan text into { title, subtitle, days, notes } for the PDF. Null when there is nothing to print.
 * @param {string} planText
 * @returns {object|null}
 */
export function parsePlanForPdf(planText) {
  if (!planText || typeof planText !== 'string') return null;
  const raw = planText.trim();
  if (!raw.length) return null;

  try {
    const { title, subtitle } = parseTitleAndSubtitle(raw);
    const daySections = collectDaySections(raw);
    const days = daysFromSections(raw, daySections);
    const notes = parseNotes(raw);
    if (days.length === 0 && !title) return null;
    return { title, subtitle, days, notes };
  } catch (error) {
    return null;
  }
}

/**
 * Build HTML for PDF: header, day tables, notes, footer. Layout CSS stays in this string.
 * @param {object} parsed
 * @param {string} [clientName]
 * @returns {string}
 */
export function buildPdfHtml(parsed, clientName = DEFAULT_CLIENT_NAME) {
  const title = escapeHtml(parsed.title || DEFAULT_PLAN_TITLE);
  const subtitle = escapeHtml(parsed.subtitle || '');
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const body = exerciseTablesHtml(parsed);

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
  <div class="footer">Generated by CoachConnect</div>
</body>
</html>`;
}

/**
 * Generate PDF file from HTML. Returns { uri } (local file URI).
 * vocab: Print.printToFileAsync = Expo writes HTML to a PDF on disk.
 * @param {string} html
 * @returns {Promise<{ uri: string }>}
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
 * @param {string} uid
 * @param {string} localUri
 * @returns {Promise<string>}
 */
export async function uploadPdfToStorage(uid, localUri) {
  if (!storage || !uid) throw new Error('Storage or uid not ready');
  const path = `${STORAGE_PATH_PREFIX}/${uid}/${Date.now()}-plan.pdf`;
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);
  await uploadBytes(storageRef, blob, { contentType: PDF_CONTENT_TYPE });
  return getDownloadURL(storageRef);
}

/**
 * Save plan metadata to Firestore: users/{uid}/workoutPlans/{planId}
 * @param {string} uid
 * @param {string} planId
 * @param {{ url?: string, planTitle?: string, clientName?: string }} fields
 * @returns {Promise<void>}
 */
export async function savePlanToFirestore(uid, planId, { url, planTitle, clientName }) {
  if (!db || !uid || !planId) throw new Error('Firestore or ids not ready');
  await setDoc(doc(db, USERS_COLLECTION, uid, FIRESTORE_COLLECTION, planId), {
    url: url || null,
    generatedAt: serverTimestamp(),
    planTitle: planTitle || DEFAULT_PLAN_TITLE,
    clientName: clientName || null,
  });
}

/**
 * Fetch saved workout plans for a user, newest first.
 * @param {string} uid
 * @returns {Promise<object[]>}
 */
export async function getWorkoutPlans(uid) {
  if (!db || !uid) return [];
  try {
    const collectionRef = collection(db, USERS_COLLECTION, uid, FIRESTORE_COLLECTION);
    const plansQuery = query(collectionRef, orderBy('generatedAt', 'desc'));
    const snapshot = await getDocs(plansQuery);
    return snapshot.docs.map(mapPlanDocument);
  } catch (error) {
    if (error?.code === INDEX_MISSING_CODE) return [];
    try {
      return await fetchPlansWithoutOrder(uid);
    } catch (ignoredError) {
      return [];
    }
  }
}

/**
 * Full flow: HTML → PDF → Storage → Firestore.
 * @param {string} uid
 * @param {object} parsed
 * @param {string} clientName
 * @returns {Promise<{ pdfLocalUri: string, pdfDownloadUrl: string, planId: string }>}
 */
export async function generateAndSavePlanPdf(uid, parsed, clientName) {
  const html = buildPdfHtml(parsed, clientName);
  const { uri: pdfLocalUri } = await generatePdfFile(html);
  const pdfDownloadUrl = await uploadPdfToStorage(uid, pdfLocalUri);
  const planId = `plan_${Date.now()}`;
  await savePlanToFirestore(uid, planId, {
    url: pdfDownloadUrl,
    planTitle: parsed.title || DEFAULT_PLAN_TITLE,
    clientName,
  });
  return { pdfLocalUri, pdfDownloadUrl, planId };
}
