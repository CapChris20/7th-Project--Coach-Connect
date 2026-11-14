// Workout plan PDF: turn plan text into a file, then save it to Storage and Firestore.
// Flow: parse the plan → build HTML → print to a PDF → upload → write the metadata row.
// Used after a plan is generated. This file does not change AI prompts.

import * as Print from 'expo-print';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, serverTimestamp, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { storage, db } from '../../app-start/cloudConnection';

// ===== NAMED CONSTANTS =====

// Storage / Firestore path letters are frozen — do not rename for branding.
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
const PLAN_ID_PREFIX = 'plan_';
const NOTES_HEADINGS = ['IMPORTANT NOTES', '7\\. IMPORTANT NOTES', 'NOTES', 'Important notes'];

// ===== HELPER FUNCTIONS =====

/**
 * Remove emoji so the PDF does not print tofu boxes.
 * @param {string|null|undefined} text
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
 * @param {string|null|undefined} text
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
 * Escape HTML special characters for safe injection into the PDF template.
 * @param {string|null|undefined} text
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

/** Emoji + markdown cleanup used by every parse step. */
function cleanPlanText(text) {
  return stripEmojis(stripMarkdown(text));
}

/**
 * Map one Firestore plan document into the shape the UI already expects.
 * @param {import('firebase/firestore').QueryDocumentSnapshot} planDoc
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
 * Sort newest generatedAt first (used when the ordered query index is missing).
 * @param {Array} plans
 */
function sortPlansNewestFirst(plans) {
  plans.sort((leftPlan, rightPlan) => {
    const leftTime = leftPlan.generatedAt?.toMillis?.() ?? leftPlan.generatedAt ?? 0;
    const rightTime = rightPlan.generatedAt?.toMillis?.() ?? rightPlan.generatedAt ?? 0;
    return rightTime - leftTime;
  });
}

/**
 * Fetch plans without orderBy, then sort in memory.
 * @param {string} uid
 * @returns {Promise<Array>}
 */
async function fetchPlansWithoutOrder(uid) {
  const snapshot = await getDocs(collection(db, USERS_COLLECTION, uid, FIRESTORE_COLLECTION));
  const plans = [];
  for (const planDoc of snapshot.docs) {
    plans.push(mapPlanDocument(planDoc));
  }
  sortPlansNewestFirst(plans);
  return plans;
}

/**
 * Map ordered query docs into plan rows.
 * @param {import('firebase/firestore').QuerySnapshot} snapshot
 * @returns {Array}
 */
function mapPlanSnapshotToRows(snapshot) {
  const plans = [];
  for (const planDoc of snapshot.docs) {
    plans.push(mapPlanDocument(planDoc));
  }
  return plans;
}

// ===== MAIN FUNCTION =====

/**
 * Parse plan text into { title, subtitle, days, notes } for the PDF.
 * Null when there is nothing to print.
 * Flow: 1. guard empty  2. title/subtitle  3. days  4. notes  5. return or null
 * @param {string} planText
 * @returns {{ title: string, subtitle: string, days: Array, notes: string }|null}
 */
export function parsePlanForPdf(planText) {
  // 1. Refuse empty / non-string input.
  if (!planText || typeof planText !== 'string') return null;
  const trimmedPlanText = planText.trim();
  if (!trimmedPlanText.length) return null;

  try {
    // 2. Title line (and optional subtitle after — or |).
    const { title, subtitle } = parseTitleAndSubtitle(trimmedPlanText);

    // 3. Day blocks → exercise rows.
    const daySections = collectDaySections(trimmedPlanText);
    const days = daysFromSections(trimmedPlanText, daySections);

    // 4. Optional notes section.
    const notes = parseNotes(trimmedPlanText);

    // 5. Need at least a title or one day, otherwise nothing to print.
    if (days.length === 0 && !title) return null;
    return { title, subtitle, days, notes };
  } catch (error) {
    return null;
  }
}

/**
 * Build HTML for PDF: header, day tables, notes, footer.
 * Flow: 1. escape header fields  2. build day tables  3. wrap in HTML shell
 * @param {{ title?: string, subtitle?: string, days?: Array, notes?: string }} parsed
 * @param {string} [clientName]
 * @returns {string}
 */
export function buildPdfHtml(parsed, clientName = DEFAULT_CLIENT_NAME) {
  // 1. Escape everything that lands in HTML.
  const title = escapeHtml(parsed.title || DEFAULT_PLAN_TITLE);
  const subtitle = escapeHtml(parsed.subtitle || '');
  const safeClientName = escapeHtml(clientName);
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  // 2. Day tables + notes body.
  const body = exerciseTablesHtml(parsed);

  // 3. Full HTML document (layout CSS stays in this string — same as before).
  const subtitleBlock = subtitle ? `<div class="subtitle">${subtitle}</div>` : '';

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
      <span class="client-name">${safeClientName}</span>
      <span class="logo">CoachConnect</span>
    </div>
    <div class="title">${title}</div>
    ${subtitleBlock}
    <div class="header-date">${dateStr}</div>
  </div>
  ${body}
  <div class="footer">Generated by CoachConnect</div>
</body>
</html>`;
}

/**
 * Print HTML to a local PDF file URI.
 * vocab: Print.printToFileAsync = Expo writes HTML to a PDF on disk
 * @param {string} html
 * @returns {Promise<{ uri: string }>}
 */
export async function generatePdfFile(html) {
  // 1. Ask Expo to print the HTML to a temp file.
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });

  // 2. Hand back the local file URI (caller uploads next).
  return { uri };
}

/**
 * Upload PDF to Firebase Storage: workout-plans/{uid}/{timestamp}-plan.pdf
 * Flow: 1. guard  2. path + blob  3. upload  4. download URL
 * @param {string} uid
 * @param {string} localUri
 * @returns {Promise<string>}
 */
export async function uploadPdfToStorage(uid, localUri) {
  // 1. Need Storage client and a user id.
  if (!storage || !uid) throw new Error('Storage or uid not ready');

  // 2. Build the Storage path and turn the file:// URI into bytes.
  const path = `${STORAGE_PATH_PREFIX}/${uid}/${Date.now()}-plan.pdf`;
  const storageRef = ref(storage, path);
  const blob = await uriToBlob(localUri);

  // 3. Upload with PDF content type.
  await uploadBytes(storageRef, blob, { contentType: PDF_CONTENT_TYPE });

  // 4. Public download URL for Firestore metadata.
  return getDownloadURL(storageRef);
}

/**
 * Save plan metadata to Firestore: users/{uid}/workoutPlans/{planId}
 * Field letters (url, generatedAt, planTitle, clientName) are frozen.
 * @param {string} uid
 * @param {string} planId
 * @param {{ url?: string, planTitle?: string, clientName?: string }} meta
 */
export async function savePlanToFirestore(uid, planId, { url, planTitle, clientName }) {
  // 1. Guard missing ids / db.
  if (!db || !uid || !planId) throw new Error('Firestore or ids not ready');

  // 2. Write the metadata row (serverTimestamp for generatedAt).
  await setDoc(doc(db, USERS_COLLECTION, uid, FIRESTORE_COLLECTION, planId), {
    url: url || null,
    generatedAt: serverTimestamp(),
    planTitle: planTitle || DEFAULT_PLAN_TITLE,
    clientName: clientName || null,
  });
}

/**
 * Fetch saved workout plans for a user, newest first.
 * Flow: 1. guard  2. ordered query  3. index-missing → []  4. else unordered fallback
 * @param {string} uid
 * @returns {Promise<Array>}
 */
export async function getWorkoutPlans(uid) {
  // 1. No db / uid → empty list (same door as before).
  if (!db || !uid) return [];

  try {
    // 2. Prefer server-side newest-first order.
    const collectionRef = collection(db, USERS_COLLECTION, uid, FIRESTORE_COLLECTION);
    const plansQuery = query(collectionRef, orderBy('generatedAt', 'desc'));
    const snapshot = await getDocs(plansQuery);
    return mapPlanSnapshotToRows(snapshot);
  } catch (error) {
    // 3. Missing composite index → empty (do not crash the screen).
    if (error?.code === INDEX_MISSING_CODE) return [];

    // 4. Other failures → try unordered fetch + local sort.
    try {
      return await fetchPlansWithoutOrder(uid);
    } catch (ignoredError) {
      return [];
    }
  }
}

/**
 * Full flow: HTML → PDF → Storage → Firestore.
 * Flow: 1. HTML  2. local PDF  3. upload  4. metadata row  5. return urls + id
 * @param {string} uid
 * @param {{ title?: string }} parsed
 * @param {string} clientName
 * @returns {Promise<{ pdfLocalUri: string, pdfDownloadUrl: string, planId: string }>}
 */
export async function generateAndSavePlanPdf(uid, parsed, clientName) {
  // 1. Build the printable HTML.
  const html = buildPdfHtml(parsed, clientName);

  // 2. Print to a local PDF file.
  const { uri: pdfLocalUri } = await generatePdfFile(html);

  // 3. Upload to Storage and get a download URL.
  const pdfDownloadUrl = await uploadPdfToStorage(uid, pdfLocalUri);

  // 4. Save metadata under users/{uid}/workoutPlans/{planId}.
  const planId = `${PLAN_ID_PREFIX}${Date.now()}`;
  await savePlanToFirestore(uid, planId, {
    url: pdfDownloadUrl,
    planTitle: parsed.title || DEFAULT_PLAN_TITLE,
    clientName,
  });

  // 5. Return local uri + download url + plan id for the caller.
  return { pdfLocalUri, pdfDownloadUrl, planId };
}

// ===== PLUMBING — skip unless debugging =====
// Markdown parse, HTML tables, Storage blob — only open when a PDF looks wrong.

function parseTitleAndSubtitle(raw) {
  let title = DEFAULT_PLAN_TITLE;
  let subtitle = '';
  const titleMatch = raw.match(/^(?:#\s*)?([^\n#]+?)(?:\s*[-—|]\s*([^\n]+))?$/m);
  if (!titleMatch) return { title, subtitle };
  title = cleanPlanText(titleMatch[1].trim());
  if (titleMatch[2]) subtitle = cleanPlanText(titleMatch[2].trim());
  return { title, subtitle };
}

function collectDaySections(raw) {
  const dayBlockRegex =
    /(?:^|\n)(?:(?:Day|Workout)\s*(\d+)[:\s\-—]*([^\n]*)|(?:##?\s*)?([^\n#]+?)\s*(?=\n(?:Exercise|•|\d\.)|$))/gim;
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

function exerciseFromRegexMatch(exerciseMatch) {
  const name = cleanPlanText((exerciseMatch[1] || '').trim());
  if (!name) return null;
  const sets = exerciseMatch[2] || exerciseMatch[4] || exerciseMatch[6] || MISSING_SET_REP_REST;
  const reps = exerciseMatch[3] || exerciseMatch[5] || exerciseMatch[6] || MISSING_SET_REP_REST;
  const restSeconds = exerciseMatch[REST_CAPTURE_GROUP] || exerciseMatch[8] || exerciseMatch[9];
  const rest = restSeconds ? `${restSeconds}s` : MISSING_SET_REP_REST;
  return { name, sets: String(sets), reps: String(reps), rest };
}

function parseStructuredExercises(blockText) {
  const exerciseLineRegex =
    /(?:^|\n)\s*(?:•|\d+\.|\*)\s*([^—\-]+?)(?:\s*[—\-]\s*|\s+)(?:(\d+)\s*x\s*(\d+)|(\d+)\s*sets?\s*[x×]\s*(\d+)\s*reps?|(\d+)\s*reps?)(?:\s*[,;]\s*|\s+)(?:(\d+)\s*s\s*rest|(\d+)\s*sec(?:onds?)?\s*rest|rest\s*(\d+)\s*s)?/gim;
  const exercises = [];
  let exerciseMatch = exerciseLineRegex.exec(blockText);
  while (exerciseMatch !== null) {
    const exercise = exerciseFromRegexMatch(exerciseMatch);
    if (exercise) exercises.push(exercise);
    exerciseMatch = exerciseLineRegex.exec(blockText);
  }
  return exercises;
}

function parseBulletFallbackExercises(blockText) {
  const allLines = blockText.split(/\n/);
  const bulletLines = [];
  for (const line of allLines) {
    const looksLikeBullet = /^[\s•\d.*\-]/.test(line) && line.trim().length > 2;
    if (looksLikeBullet) bulletLines.push(line);
  }

  const exercises = [];
  const linesToUse = bulletLines.slice(0, MAX_FALLBACK_BULLETS);
  for (const line of linesToUse) {
    const cleaned = cleanPlanText(line.replace(/^[\s•\d.*\-]+\s*/, '').trim());
    if (!cleaned) continue;
    exercises.push({
      name: cleaned,
      sets: MISSING_SET_REP_REST,
      reps: MISSING_SET_REP_REST,
      rest: MISSING_SET_REP_REST,
    });
  }
  return exercises;
}

function parseExercisesFromBlock(blockText) {
  const structured = parseStructuredExercises(blockText);
  if (structured.length > 0) return structured;
  return parseBulletFallbackExercises(blockText);
}

function daysFromSections(raw, daySections) {
  const days = [];
  for (let i = 0; i < daySections.length; i++) {
    const block = daySections[i];
    const nextBlock = daySections[i + 1];
    const blockEnd = nextBlock ? nextBlock.start : raw.length;
    const exercises = parseExercisesFromBlock(raw.slice(block.start, blockEnd));
    daySections[i].exercises = exercises;
    days.push({ label: block.label, exercises });
  }
  return days;
}

function parseNotes(raw) {
  for (const heading of NOTES_HEADINGS) {
    const notesRegex = new RegExp(`${heading}[\\s\\S]*?(?=\\n\\n|$)`, 'i');
    const match = raw.match(notesRegex);
    if (!match || !match[0]) continue;
    return cleanPlanText(match[0].replace(new RegExp(heading, 'i'), '').trim());
  }
  return '';
}

function oneExerciseTableRowHtml(exercise, rowIndex) {
  const rowClass = rowIndex % 2 === 0 ? 'row-even' : 'row-odd';
  return `
            <tr class="${rowClass}">
              <td>${escapeHtml(exercise.name)}</td>
              <td>${escapeHtml(exercise.sets)}</td>
              <td>${escapeHtml(exercise.reps)}</td>
              <td>${escapeHtml(exercise.rest)}</td>
            </tr>
          `;
}

function oneDaySectionHtml(day, dayIndex) {
  const dayNumber = dayIndex + 1;
  const dayLabelUpper = escapeHtml(day.label).toUpperCase();
  const exerciseRows = day.exercises || [];
  let rowsHtml = '';
  for (let j = 0; j < exerciseRows.length; j++) {
    rowsHtml += oneExerciseTableRowHtml(exerciseRows[j], j);
  }

  return `
    <div class="day-section">
      <div class="day-header">DAY ${dayNumber} — ${dayLabelUpper}</div>
      <table class="exercise-table">
        <thead><tr><th>Exercise</th><th>Sets</th><th>Reps</th><th>Rest</th></tr></thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>`;
}

function exerciseTablesHtml(parsed) {
  let body = '';
  const days = parsed.days || [];
  for (let i = 0; i < days.length; i++) {
    body += oneDaySectionHtml(days[i], i);
  }

  if (parsed.notes) {
    body += `<div class="notes-section"><div class="notes-header">Notes</div><div class="notes-body">${escapeHtml(parsed.notes)}</div></div>`;
  }

  return body;
}

/**
 * vocab: XMLHttpRequest + responseType blob turns a file:// URI into bytes for Storage upload.
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
