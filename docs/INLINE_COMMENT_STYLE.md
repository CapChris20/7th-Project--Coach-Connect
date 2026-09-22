# Inline Comment Style Guide

**Owner:** Chris Shina  
**Purpose:** Drop this file into any project (and point Cursor / teammates at it) so every new file is written at the same teaching depth.

This is **not** “comment every if.” It is: explain the confusing layer so you can **read and manipulate** the app without asking someone what a line means.

Teaching lives **in the code file** — not a separate explanations dump.

---

## The bar (copy this depth)

If comments only say “handle submit” or “animation loop,” they fail. They must teach **vocab**, **why this block exists**, and **what to tweak**.

```ts
// This function is the heartbeat of the background animation.
// The browser keeps calling it; we decide whether to actually repaint.
const frame = (now: number) => {
  // vocab: now = timestamp in milliseconds from requestAnimationFrame
  //        (not “wall clock time” you set yourself)

  // Stop forever after cleanup ran (user left the page / component unmounted)
  // vocab: disposed = our flag meaning “tear down already happened — don’t touch WebGL”
  if (disposed) return;

  // Queue the NEXT call to `frame` before we paint.
  // vocab: raf = id of that scheduled call — keep it so we can cancel later
  // vocab: requestAnimationFrame(frame) = “call frame again right before the next screen refresh”
  // Why call itself? That’s the loop — each run schedules the next run.
  raf = window.requestAnimationFrame(frame);

  // Accessibility: OS “reduce motion” on → keep the loop scheduled but don’t animate
  if (reduceMotion) return;

  // FPS cap: if it’s been less than FRAME_MS (≈33ms ≈ 30fps) since last paint, skip this tick
  // Manipulate here: lower FRAME_MS = smoother but heavier; raise = calmer on laptops
  if (now - lastDraw < FRAME_MS) return;

  lastDraw = now;

  // Convert ms since start → seconds, then hand to draw (shader uses uTime in seconds)
  // vocab: (now - start) / 1000 = elapsed seconds; draw pushes that into the GPU as uTime
  draw((now - start) / 1000);
};
```

**Pass/fail test:** Would I know what each *weird* line is for and how to change behavior, from comments alone? If no → add more.

---

## Required pieces (every real file)

### 1. File-top summary (2–4 lines)

Plain `//` comments at the top:

- What this file does
- High-level flow (A → B → C)
- Where it’s used (optional but helpful)

```ts
// Login card — school email field + Google sign-in button.
// Flow: validate UMich email → open Google popup → redirect on success.
// Used by /auth/login. Shared auth work lives in sign-in-actions.ts.
```

Barrels / re-export indexes: **one line max**.

### 2. Block-by-block logic

Before each meaningful block, say:

- **What** it does
- **Why** it exists (especially order / side effects)
- How it connects to the rest of the file

Do this for: handlers, hooks, meaningful `if`/`else`, `try`/`catch`, maps with logic, major JSX sections, shaders, async pipelines.

### 3. `// vocab:` on unfamiliar terms

On **first use in that file**, tag anything a developer might not know cold:

| Kind | Examples |
|------|----------|
| APIs / hooks | `useEffect`, `useState`, `onAuthStateChanged`, `requestAnimationFrame` |
| Language / symbols | `async`/`await`, `?.`, `??`, `...spread`, `as const` |
| Libraries | Firebase, Framer Motion, Lottie, GLSL / WebGL |
| Domain jargon | `uniform`, `shader`, `hosted domain`, `reauthenticate` |

Format:

```ts
// vocab: useEffect = React hook that runs after paint (and cleanup when you leave)
// vocab/symbol: ?? = if left side is null/undefined, use the right side instead
```

Plain English. No textbook dump — one tight line is enough.

### 4. `// Manipulate here:` on tweakables

Whenever a number, color, flag, or branch controls look / speed / behavior:

```ts
// Manipulate here: lower FRAME_MS = smoother but heavier; raise = calmer on laptops
if (now - lastDraw < FRAME_MS) return;
```

Good targets: durations, opacities, FPS caps, feature toggles, copy lists, gradient stops, breakpoints.

---

## What NOT to comment

- Obvious `import` lines
- Pure “this is an if” / “this is a loop” with **no app meaning**
- `throw` that only repeats the error string above it
- A `router.push` under an `if` you already explained
- Restating the function name in different words with zero teaching

---

## Tiny vs dense files

| File type | Comment depth |
|-----------|----------------|
| Short route wrapper / one-liner re-export | File top + one note |
| Forms, auth, API, state, animations, shaders, nav, landing sections | **Full frame depth** |

When in doubt → denser. Under-commenting is the failure mode we care about.

---

## Checklist (paste into PRs / Cursor prompts)

- [ ] File-top 2–4 lines (what / flow / where used)
- [ ] Every logic block has a “what + why”
- [ ] Unfamiliar APIs / symbols / library terms get `// vocab:`
- [ ] Tweakable constants get `// Manipulate here:`
- [ ] No separate “explanations.md” for what belongs inline
- [ ] Passes the “could I manipulate this without asking?” test

---

## How to use this in another project

1. **Copy this file** into the repo, e.g.:
   - `docs/INLINE_COMMENT_STYLE.md`, or
   - `src/docs/comment-style.md`
2. **Add a Cursor rule** (`.cursor/rules/inline-comment-style.mdc`) with `alwaysApply: true` that says:

```markdown
---
description: Frame-depth inline commenting standard
alwaysApply: true
---

# Inline Comment Style

Every new or significantly edited `.ts` / `.tsx` / `.js` / `.jsx` file MUST follow
`docs/INLINE_COMMENT_STYLE.md` (or your path to this guide).

Required: file-top summary · block explanations · `// vocab:` · `// Manipulate here:`
Gold standard: the `frame` function example in that doc.
Do not put teaching in a separate explanations file — keep it inline.
```

3. When asking an agent to write code, say:  
   **“Follow docs/INLINE_COMMENT_STYLE.md at frame depth.”**

---

## Anti-patterns (what “shitty comments” look like)

```ts
// ❌ Label only — teaches nothing
// Handle submit
async function onSubmit() { ... }

// ❌ Narrates syntax
// Loop through users
users.forEach(...)

// ❌ Restates the identifier
// Set loading to true
setIsLoading(true);
```

```ts
// ✅ Teaches meaning + tweak
// Disable the form while Google popup / Firestore / redirect runs.
// Manipulate here: keep this true until the whole pipeline finishes (don’t clear early)
setIsLoading(true);
```

---

## Performance note

Comments are stripped from production JS bundles. Dense teaching comments do **not** slow the app. Prefer clarity in source over “fewer lines.”

---

**Origin:** Refined on the Devora project (WebGL / React / Firebase codebase).  
**Intent:** Upcoming-tool-developer readable code — manipulate without babysitting.
