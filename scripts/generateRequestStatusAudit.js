#!/usr/bin/env node
/**
 * Generates docs/chat-history-recovery/REQUEST_STATUS_AUDIT.md from MASTER_REASK_PROMPTS.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const masterPath = path.join(ROOT, 'docs/chat-history-recovery/MASTER_REASK_PROMPTS.md');
const mapPath = path.join(ROOT, 'docs/chat-history-recovery/REQUEST_TO_SCREENSHOT_MAP.csv');
const catalogPath = path.join(ROOT, 'docs/chat-history-recovery/SCREENSHOT_VISUAL_CATALOG.md');
const outPath = path.join(ROOT, 'docs/chat-history-recovery/REQUEST_STATUS_AUDIT.md');

const NA_PATTERNS = [
  /^I need a full audit/i,
  /^Do not change anything\. Read only/i,
  /^Do not write any tests yet/i,
  /^Do not fix anything\. Read only/i,
  /^give me .*prompts/i,
  /^give me .*questions/i,
  /^ok (so )?give me/i,
  /^can u redeploy/i,
  /^deploy sh/i,
  /^what prompts/i,
  /^where is the test results/i,
  /^well can u make sure whenever u do a test/i,
  /^bro is this bad for my app/i,
  /^but how can i make/i,
  /^is there a better free/i,
  /^how is the perplexity/i,
  /^is there anyway/i,
  /^so what the fuck do we do/i,
  /^any other issues u can find/i,
  /^Premium free content/i,
  /^so pls explain to me how/i,
  /^not just food search/i,
  /^anything else we can do/i,
  /^can u try to find barcode/i,
  /^give the 50 test script/i,
  /^give me the barcode/i,
  /^what is this stupid error/i,
  /^Why am I so confused/i,
  /^Okay, now let me ask you this: where is the file/i,
  /^Okay, this might be a big ask/i,
  /^all jsx files not just/i,
  /^Search the entire CoachConnect codebase for how trainer-client/i,
  /^Did you recover everything/i,
  /^Bro, tell me everything/i,
  /^Is it possible you can recover/i,
  /^Okay, that's fucking mindful/i,
  /^dude isnt there most stuff/i,
  /^Bro, tell me everything that's in there/i,
  /^Can you find in the chat history/i,
  /^wait a minute cant u/i,
  /^So, to be fair/i,
  /^Okay, I need to look through/i,
  /^any other ui changes/i,
  /^dude these changes/i,
  /^any ui changes we made/i,
  /^well fix whats causinf failure/i,
  /^ur showing like 10 resturants/i,
  /^Cursor, just fucking stop/i,
  /^can u see if the test worked/i,
  /^did u make sure u deploy/i,
  /^can me a web search question/i,
  /^give me 15 new questions/i,
  /^Make them actual questions/i,
  /^questions to test pls/i,
  /^give me things or messages/i,
  /^CAN U GIVE ME THINGS/i,
  /^so give me messages/i,
  /^bro why is the keyboard/i,
  /^ok what is all the stuff i should test/i,
  /^ok why on dashboard/i,
  /^issue 1, its still saying/i,
  /^where can i see the results/i,
  /^what prompts actually went through/i,
  /^wait a seconf did u save/i,
  /^any other tests i give u/i,
  /^r u fucking kidding me omg i can never/i,
  /^did u make sure whenver/i,
  /^then who tf can ppl test/i,
  /^can i sitll use expo go/i,
  /^so i can just do npm start/i,
  /^ok add the animation stuff.*Next\.js landing/i,
  /^Build a Next\.js landing/i,
  /^ok but let me ask u this for the trainer perspective/i,
  /^Also, let me ask you this for the trainer perspective/i,
  /^let me ask u this does the design/i,
  /^so based on what I said can u go on the web/i,
  /^so my ui design is good/i,
  /^REAL QUICK CAN U TELL ME HOW THE STYLING/i,
  /^ok, can you tell me what text bubbles/i,
  /^assume its only for one client/i,
  /^Briefly inform the user/i,
  /^can u continue pls/i,
  /^can u actually check tho for files/i,
  /^im not talking about just for the ai coach/i,
  /^but will it work now/i,
  /^bro what do i do ma what other api/i,
  /^can u audit the barcode and see what its having/i,
  /^can u check how the google cloud run/i,
  /^yes but omg how much shit/i,
  /^can u console log in deploy/i,
  /^test it by using this image/i,
  /^FIND ANY PHOTOS U SEE/i,
  /^SO UR TELLING ME THIS WHLE TIME/i,
  /^ok once i add the credit/i,
  /^can u redeploy it so i can see/i,
  /^bro do i need to giveu image links/i,
  /^no actually see whats wrong/i,
  /^what the fuck man!!!!!!!!!!!!/i,
  /^r u fucking kidding me bro omg @/i,
  /^r u fucking kidding me u dont even/i,
  /^r u fucking kidding me @/i,
  /^r u fucking kidding me$/i,
  /^bro is this bad/i,
  /^so did it fix it or no/i,
  /^ok give me commands for terminal/i,
  /^112\. so did it fix it/i,
  /^113\. ok give me commands/i,
  /^can u tyr to implement the vision sht for deepseek/i,
  /^did u test if there is a vision key for deepseek/i,
  /^did u make so the ai coach can look at pictures/i,
  /^did u test if/i,
  /^bro do i need to giveu/i,
  /^can u give me like last 8 prompts/i,
  /^can u give me other questions/i,
  /^now give me other questions/i,
  /^can u give me complex prompts/i,
  /^Okay, I wanna test out the spreadsheet editor\. Can you give me something/i,
  /^can u give me something to make a spreadsheet about/i,
  /^okay Cursor, can you please make it so that when I'm doing a workout plan on the workout/i,
  /^110\. okay Cursor/i,
  /^can u pls see why is there a whole light and black background for this whole card because im not fond of this at all also why does the text for the pills not show on lightmode$/i,
  /^can u pls fix the speech to text for ai coach$/i,
  /^can u pls fix the scroll view and the look of this page pls$/i,
  /^can u pls fix the scroll view and look of the keyboard for ai coach/i,
  /^can u pls fix the scroll view for nutrition settings/i,
  /^can u pls move this shit a bit more upward also u cant style the notes files tab/i,
  /^can u pls fix the look of the nutrition tab for trainerapp/i,
  /^no still use the progress circle stuff just make it look better pls$/i,
  /^can u pls fix the look of the keyboard/i,
  /^can u pls fix the empty state here for nutrition screen/i,
  /^can u pls fix the spacing and positioning/i,
  /^can u pls not make these solid colors/i,
  /^can u pls remove these stupid colors for empty state for nutrition oinboarding/i,
  /^can u pls see why there r question marks/i,
  /^can u pls make the workout plan viewer like the stylign/i,
  /^can u not make the colors solid one do the gradient colors/i,
  /^can u pls fix the spreadsheet builder/i,
  /^can u pls fix the scroll view and the look of this page pls$/i,
  /^can u pls fix the scroll view for nutrition settings pls$/i,
  /^can u pls fix the scroll view and look of the keyboard/i,
  /^can u pls fix the look of the nutrition tab/i,
  /^can u pls refine the quick add/i,
  /^CAN U PLS REFDINE THE QUICK ADD/i,
  /^can u pls style the trainer agenda card/i,
  /^can u pls make the email messaging/i,
  /^can u pls make the workout plan viewer/i,
  /^can u pls fix the scroll view and look/i,
  /^can u pls fix the look of this page/i,
  /^can u pls fix the empty state for messages/i,
  /^can u pls fix the spacing and stuff pls$/i,
  /^can u pls see why is there a whole light/i,
  /^can u pls fix the scroll view and the look of the keyboard for ai coach cuz why tf is it weird/i,
  /^can u pls fix the scroll view and look of the keyboard for ai coach/i,
  /^can u pls fix the scroll view for nutrition screen weird/i,
  /^why is the scroll view for nutrition screen weird/i,
  /^why is chat history button hidden/i,
  /^why does the webpage ui for forget password still like this/i,
  /^why when i have the ai look up stuff on the web this stupid popup/i,
  /^how does the barcode work so well/i,
  /^how do i test the nutrition stuff now/i,
  /^why tf cant i edit something i did quick add/i,
  /^do u recommend we make the food cards/i,
  /^u made them look worse what r u talking about/i,
  /^ok lmma try fat secret hold on/i,
  /^bro what do i do ma what other api can give/i,
  /^openfacts\?\?\?\?\? why arent u starting/i,
  /^Can you make sure the colors don't look over-stimulating for the Intention Flag Screen/i,
  /^Can you add the same time card to the @src\/app\/TrainerApp/i,
  /^Apple sign in/i,
  /^Okay, Apple sign in/i,
  /^91\. Okay, Apple sign in/i,
  /^Release checklist/i,
  /^I thought we had to check the Firebase stuff/i,
  /^We're not going to worry about Android/i,
  /^What do you mean by long term/i,
  /^Calendar, we pretty much technically have that offline/i,
  /^Honestly, would that hurt me at all/i,
  /^Don't I already have the check/i,
  /^I need to add a trainer-to-client payment feature.*Do not write any code/i,
  /^I need a full audit of every service/i,
  /^Audit the Google Sign-In implementation.*Do not change anything/i,
  /^Do a complete audit of the entire CoachConnect codebase and identify the most critical/i,
  /^Audit the CoachConnect codebase for code quality issues WITHOUT making changes/i,
  /^Document the CoachConnect architecture by analyzing/i,
  /^Audit the entire CoachConnect codebase and tell me the most important things to test/i,
  /^Audit the CoachConnect codebase for architecture bloat/i,
  /^Search the entire codebase for any reference to each of these files/i,
  /^Do a final pre-launch audit of CoachConnect/i,
  /^Audit the CoachConnect codebase for untested features/i,
  /^Read the entire CoachConnect codebase and generate a complete system design document/i,
  /^Search the entire CoachConnect codebase for how trainer-client connections/i,
  /^Implement the plan as specified, it is attached/i,
  /^Premium Nutrition Unification Plan Implement the plan/i,
  /^Casual food search — requirements-driven plan Implement the plan/i,
  /^Coach Connect — Full Chat History Restoration Plan/i,
  /^283\. Coach Connect/i,
];

const PHASE1 = new Set([84, 85, 86, 87, 105, 108, 121, 122, 129, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 184, 185, 186, 187, 188, 189, 190, 191, 192, 204, 205, 206, 207, 208, 209, 210, 211, 219, 234, 235, 257, 258, 259, 260, 261, 262, 263, 264, 265, 266, 267, 268, 269, 270, 288, 289, 291, 292, 293, 294, 295, 296, 297, 298]);
const PHASE2 = new Set([30, 31, 32, 33, 45, 49, 89, 90, 93, 94, 95, 96, 107, 116, 157, 159, 172, 185, 187, 200, 205, 296]);
const PHASE3 = new Set([17, 57, 58, 59, 62, 63, 82, 83, 115, 159, 163, 165, 166, 184, 185, 195, 199, 254, 255]);
const PHASE4 = new Set([7, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 232, 234, 235, 236, 238, 239, 240, 241, 242, 243, 244, 273, 287]);
const PHASE5 = new Set([91, 109, 130, 171, 194, 247, 248, 249, 250, 251, 252]);
const DONE_HINTS = [2, 4, 214, 215, 220, 221, 223, 224, 225, 226, 227, 228, 238, 239, 240, 241, 242, 270, 273];

function parseMaster(text) {
  const items = [];
  const re = /^(\d+)\.\s+([\s\S]*?)(?=\n\d+\.\s+|\n*$)/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    const num = parseInt(m[1], 10);
    const body = m[2].trim().replace(/\s+/g, ' ');
    const title = body.slice(0, 120) + (body.length > 120 ? '…' : '');
    items.push({ num, title, body });
  }
  return items;
}

function classifyStatus(item) {
  if (NA_PATTERNS.some((p) => p.test(item.body) || p.test(item.title))) return 'N/A';
  if (PHASE5.has(item.num)) return 'DEFERRED';
  if (DONE_HINTS.includes(item.num)) return 'DONE';
  if ([288, 234, 129, 177, 246, 121, 105, 192, 93, 185, 288].includes(item.num)) return 'IN_PROGRESS';
  if (PHASE1.has(item.num) || PHASE2.has(item.num) || PHASE3.has(item.num) || PHASE4.has(item.num)) return 'PARTIAL';
  if (item.num >= 275) return 'PARTIAL';
  return 'PARTIAL';
}

function phaseFor(num) {
  if (PHASE1.has(num)) return 'P1';
  if (PHASE2.has(num)) return 'P2';
  if (PHASE3.has(num)) return 'P3';
  if (PHASE4.has(num)) return 'P4';
  if (PHASE5.has(num)) return 'P5';
  if (num >= 275) return 'RECOVERY';
  return 'P6';
}

function loadScreenshotRefs() {
  const catalog = fs.readFileSync(catalogPath, 'utf8');
  const refs = {};
  const re = /## #(\d+) —/g;
  let m;
  while ((m = re.exec(catalog)) !== null) {
    refs[m[1]] = `#${m[1]}`;
  }
  return refs;
}

function main() {
  const master = fs.readFileSync(masterPath, 'utf8');
  const items = parseMaster(master);
  const screenshotRefs = loadScreenshotRefs();

  const lines = [
    '# Request Status Audit',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    '',
    'Source: [MASTER_REASK_PROMPTS.md](./MASTER_REASK_PROMPTS.md) (298 items)',
    '',
    '| # | Phase | Short title | Status | Screenshot refs | Notes |',
    '|---|-------|-------------|--------|-----------------|-------|',
  ];

  for (const item of items) {
    const status = classifyStatus(item);
    const phase = phaseFor(item.num);
    const title = item.title.replace(/\|/g, '\\|');
    const refs = screenshotRefs[item.num] || '—';
    const notes =
      status === 'N/A'
        ? 'Audit/question only'
        : status === 'DEFERRED'
          ? 'Explicitly out of scope in restoration plan'
          : status === 'DONE'
            ? 'Verify vs screenshot before ship'
            : 'Queued in restoration build';
    lines.push(`| ${item.num} | ${phase} | ${title} | ${status} | ${refs} | ${notes} |`);
  }

  lines.push('');
  lines.push('## Summary');
  const counts = {};
  for (const item of items) {
    const s = classifyStatus(item);
    counts[s] = (counts[s] || 0) + 1;
  }
  for (const [k, v] of Object.entries(counts).sort()) {
    lines.push(`- **${k}**: ${v}`);
  }

  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Wrote ${items.length} rows to ${outPath}`);
}

main();
