# Project Instructions & Coding Style (Variation 3)

## Critical Rule: Always Follow `CODING_STYLE.md` (Variation 3)

Whenever generating, modifying, refactoring, or reviewing code in this codebase:

1. **Junior Recipe First**:
   - Write like a junior engineer wrote a plain-English recipe.
   - Plain English, obvious control flow, no "clever" AI tricks or terse abbreviations.
   - Every variable and function name must be explicit and spoken out loud (e.g. `cleanedFoodName`, `servingAmountInGrams` — never `t`, `gp`, `bg`, `conv`).
   - One function, one job. If the description needs "and", split it into two helpers.

2. **Numbered Main Function**:
   - Any main/orchestrating function or screen handler must read as a clear numbered checklist (`// 1.`, `// 2.`, `// 3.`, ...).
   - A developer should be able to read the main function top to bottom and narrate what the app does without decoding code.

3. **Story-First File Layout**:
   - Top of file: Brief summary of what the file owns and does.
   - Next: Named constants.
   - Next: Helper functions.
   - Next: Main numbered function / export.
   - Bottom: `// PLUMBING — skip unless debugging` for raw math, complex regexes, or parsing details.

4. **Nesting & Control Flow**:
   - Maximum nesting depth of 2 inside functions.
   - Name the decision before using it.
   - Never use nested ternary operators (`a ? b ? c : d : e`) in JSX or logic. Use `if` and early `return` instead.

5. **Freeze List (Never Change Existing Behavior)**:
   - Keep existing Firestore collection paths and document structures unchanged.
   - Keep API key names, environment variable names, and exported function names identical.
   - Keep React Hook ordering intact.
   - Keep Firebase project ID as `anatrox-auth`.

6. **Security Hygiene**:
   - Never use `Math.random()` for tokens, keys, or security-sensitive identifiers. Use `crypto.randomUUID()` or `crypto.randomBytes()`.
   - Never trust raw user inputs in regexes without length caps.
   - Always ensure prototype pollution keys (`__proto__`, `constructor`, `prototype`) are rejected.

