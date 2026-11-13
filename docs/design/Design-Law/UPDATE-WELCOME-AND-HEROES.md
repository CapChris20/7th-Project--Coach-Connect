# Update: new welcome screen and home heroes (these win over older screens)

Newest design decisions from the owner. Where these conflict with anything else in this package, these win.

Mockup: `mockups/hero-and-welcome-redesign.html`
Screenshots: `screens/hero-and-welcome-redesign/` (01 and 02 welcome, 03 and 04 client home hero, 05 and 06 trainer home hero; odd = light, even = dark)
Logo: `assets/cc-logo-transparent.png` (made from `src/assets/logo/Logo.PNG`, black removed)

## 1. Welcome screen (replaces screen 1 of `welcome-and-sign-in`)
- Black stage card with the CC infinity logo as the centerpiece, faint grid, two slow dashed rings (28s and 40s rotation).
- COACH CONNECT wordmark under the logo, a small gradient bar, and the looping tagline strip "One Day or Day One!" with gradient diamond separators.
- Gradient sticker "Day One starts here", three tilted tiles (Plans and logs, Daily check-ins, Real progress), headline with "in sync." highlighted, Get started button, Sign in link. The moon button switches theme.
- Repo files: see the Welcome entry in `MAPPING.md`, plus `src/for-both/icons/AppLogo.jsx` and `src/assets/logo/brandLogo.js` for the logo.

## 2. Client home hero and 3. Trainer home hero (replace the old top cards)
- The hero is ONLY: small label, "Welcome to Coach Connect" (Coach Connect on a gradient highlight), the lifter (client) or boxer (trainer) Lottie on a gradient ring, and the tagline strip along the bottom.
- Do NOT show a streak pill, week dots, session counts, "Lower body", a countdown, or stats in the hero. The owner rejected all of that.
- The trainer hero is the mirror image of the client hero (animation on the left).
- Home heroes use **surface + ink** (white card in light, dark surface in dark) — not the inverted `fill`/`blk` stage. The welcome logo stage stays black/fill.
- Everything below the hero (Up next, trainer card, Your week, Needs you, clients carousel and so on) keeps the layout from `client-home` and `trainer-home` mockups.
- Labels "Your training home" and "Your coaching home" are placeholder wording.

Build source: `build-sources/heroes.py` (needs `kit.py`, `logo.png`).
