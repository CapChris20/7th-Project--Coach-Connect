# Chat verify & restore prompts

Use **one chat at a time**. Open it from Cursor history → scroll to bottom → paste the prompt → send → let it finish → test app → next chat.

**Workspace:** `/Users/captainchris20/Desktop/My-Coding-Portfolio/7th-Project--Coach-Connect`

**Order:** run in this sequence (skip rows marked SKIP).

| # | Open this chat (first message hint) | Session ID |
|---|-------------------------------------|------------|
| 1 | "full audit of every service, API, and infrastructure cost" | `a2116213-660f-473b-8fb4-c4df99a1c468` |
| 2 | "black or white border for thid card" (onboarding) | `81d5e120-5135-4149-9dda-ebbd83abeedb` |
| 3 | SKIP — product questions only | `bb3d5a73-d88d-46cf-8a31-7188bcafa0b3` |
| 4 | "test out the spreadsheet editor" | `43d4e4ad-5153-4c58-8820-4f5b0fe99d34` |
| 5 | dev build errors / client main screen folder | `22de0722-96e2-4524-80eb-7a0fe3ebbe27` |
| 6 | "5 out of 8 for energy level" / 100% bug | `2ec46bca-f736-4b8a-9528-5081f5559c21` |
| 7 | support email "the number 0" | `9405e11c-511e-4946-aa21-46b28b8bb7ed` |
| 8 | "nutrition fact for food on a separate screen" (MEGA) | `8047eeaa-aefd-44f5-a51a-18e895120b9c` |
| 9 | SKIP — code quality audit, no build | `842532aa-1255-463a-9642-330973281de7` |
| 10 | SKIP — one-line follow-up | `2a168f9b-b583-4584-ad67-a3fdfca8bec7` |
| 11 | "Write Jest unit tests for the coach tool proposal guards" | `d427da4a-27c8-4c2f-9c22-bd7495ad4c4b` |
| 12 | "Audit untested features" + delete folders + reorganize | `c2bb292e-64d7-4a0e-98a5-67ccff9e3269` |
| 13 | "Set up k6 load tests" + file renames | `a560aff3-4487-498f-9334-4f19c84b6fc0` |

After each chat: reload Metro, spot-check anything you remember from that session, then continue.

---

## Prompt — paste at the bottom of EVERY chat (same text every time)

```
VERIFY & RESTORE — this thread only. Do not use git as source of truth.

Read our ENTIRE conversation in THIS chat from first message to last.

Step 1 — INVENTORY (no code yet)
- List every issue I asked you to fix and every change you actually made in this thread (code, UI, deletes, renames, tests, server).
- List every file you touched in this thread (Write / StrReplace / Delete / rename scripts).
- Note where I said something was still wrong — those versions do NOT count as done.

Step 2 — GAP CHECK (compare to disk now)
For each file/change from Step 1, open the current file at:
/Users/captainchris20/Desktop/My-Coding-Portfolio/7th-Project--Coach-Connect
Mark each item: PRESENT | PARTIAL | MISSING | WRONG (reverted/broken)

Step 3 — RESTORE GAPS ONLY
- Re-apply only MISSING, PARTIAL, and WRONG items from this thread.
- Do not re-do work that already matches the last good state from this thread.
- Do not invent features not in this thread.
- If this thread renamed/moved files, map old paths from the chat to current paths before editing.

Step 4 — REPORT
Table: file | what this thread did | status before | what you fixed now
Run relevant tests if this thread added/changed tests.
Firebase projectId stays anatrox-auth. Do not commit .env or secrets.

Start with Step 1. Wait for my OK before Step 3 only if the gap list is huge (50+ items); otherwise do all steps in one pass.
```

---

## Optional: add this line when starting a specific chat

Paste **above** the main prompt (replace `N`):

```
I am verifying chat #N from the May 31–June 14 recovery list. Session context is only this thread.
```

Examples:
- Chat #8: `I am verifying chat #8 from the May 31–June 14 recovery list...`
- Chat #12: `I am verifying chat #12 from the May 31–June 14 recovery list...`

---

## After all chats

1. Full app smoke test (auth, AI Coach home, nutrition, workout pills, spreadsheet).
2. `npm test` once at the end.
3. Commit when you're happy.

Known miss already confirmed: workout "Tap to edit" pills should be **border only** (asked in chat #12) — current `workout.js` still has filled gradient. Chat #12 verify should catch that.
