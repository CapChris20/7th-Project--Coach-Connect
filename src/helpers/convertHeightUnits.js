// US height input engine — one text field where the user types 5'11" (or 5,11 / 5-11 / 5 11).
// Flow: raw keystrokes → normalize odd punctuation → strip to digits + ' " → parse into { feet, inches }.
// Used by onboarding and profile height fields; `height: null` means "keep typing, not valid yet".

// Phone keyboards auto-substitute curly/typographic quotes, and users type commas, dashes, or a
// space as the separator. Every one of those must collapse to plain ' and " or the regexes below miss.
// vocab: /[...]/g = character-class regex; the \uXXXX entries are the curly-quote/prime code points
// vocab: primes = ′ (foot) and ″ (inch) marks that look like quotes but are different characters
const SMART_FOOT_MARKS = /[\u2018\u2019\u201A\u201B\u2032\u2035\u0060\u00B4′´`ˈ]/g;
const SMART_INCH_MARKS = /[\u201C\u201D\u201E\u201F\u2033\u2036\u00AB\u00BB„"]/g;

// Step 1 of cleanup: make every separator the user might produce mean "feet mark".
// Manipulate here: add another `.replace(/X/g, "'")` line to accept a new separator character
function normalizeHeightRawInput(raw) {
  return String(raw || '')
    .replace(SMART_FOOT_MARKS, "'")
    .replace(SMART_INCH_MARKS, '"')
    .replace(/,/g, "'")   // "5,11" → "5'11"
    .replace(/-/g, "'")   // "5-11" → "5'11"
    // "5 11" → "5'11". $1/$2 put the two captured digits back around the inserted quote.
    .replace(/(\d)\s+(\d)/g, "$1'$2");
}

/** Normalize first, then keep digits + foot/inch marks only. */
// Order matters: normalize BEFORE stripping, or curly quotes would be deleted as junk
// and "5’11”" would collapse to the meaningless "511".
// Manipulate here: 8 is the max draft length — enough for 5'11" plus stray marks
function sanitizeHeightDraft(raw) {
  const normalized = normalizeHeightRawInput(raw);
  return normalized.replace(/[^0-9'"]/g, '').slice(0, 8);
}

// Renders a stored height back into the field. Handles both storage shapes the app has used:
// the current { feet, inches } object and legacy total-inches numbers.
export function formatHeightInputDisplay(h) {
  // vocab/symbol: == null = true for BOTH null and undefined (the one place loose equality is useful)
  if (h == null) return '';
  // Shape A — the object form. The `!Array.isArray` guard matters because arrays are
  // also `typeof 'object'` and would otherwise slip into this branch.
  if (typeof h === 'object' && !Array.isArray(h)) {
    const ft = h.feet;
    const inch = h.inches;
    if (ft == null || ft === '') return '';
    // Feet but no inches yet → show `5'` so the user sees their progress mid-entry.
    if (inch == null || inch === '') {
      return `${ft}'`;
    }
    return `${ft}'${inch}"`;
  }
  // Shape B — legacy total inches (e.g. 71). Divide by 12 for feet, remainder for inches.
  if (typeof h === 'number' && Number.isFinite(h)) {
    const total = Math.round(h);
    const feet = Math.floor(total / 12);
    const inches = total % 12;
    return `${feet}'${inches}"`;
  }
  return '';
}

// The validity gate. Everything below refuses to commit a height until this passes,
// so it's the single definition of "a real human height".
export function isHeightComplete(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return false;
  const feet = Number(h.feet);
  const inches = Number(h.inches);
  return (
    // vocab: Number.isFinite = a real number (rejects NaN and Infinity, unlike typeof)
    Number.isFinite(feet) &&
    Number.isFinite(inches) &&
    // Manipulate here: 3–8 feet is the accepted range; inches must stay 0–11 since
    //                  12 inches would be another foot, not a valid remainder
    feet >= 3 &&
    feet <= 8 &&
    inches >= 0 &&
    inches <= 11
  );
}

/**
 * Parse height while typing. Returns the sanitized draft as `text` so ' and " stay visible.
 * @returns {{ text: string, height: { feet: number, inches: number } | null }}
 */
// Called on every keystroke. Returns BOTH what to show in the field (`text`) and the
// committed value (`height`, or null while still incomplete).
// Two return values because the field must keep showing the user's partial draft even
// when there's nothing valid to save yet — replacing the text mid-typing would fight the user.
export function parseHeightInputText(raw) {
  const draft = sanitizeHeightDraft(raw);
  if (!draft) return { text: '', height: null };

  // The shape matcher: 1–2 digits (feet), optionally ' plus 0–2 digits (inches), optional trailing ".
  // vocab: (?:...) = group that isn't captured; ^ and $ anchor it so junk can't tag along
  const match = draft.match(/^(\d{1,2})(?:'(\d{0,2})?)?"?$/);
  if (!match) {
    // Doesn't match the full shape yet (e.g. `5''`). If it at least starts with digits,
    // echo the draft back so typing isn't interrupted; otherwise clear the field.
    const loose = draft.match(/^(\d{1,2})/);
    if (loose) return { text: draft, height: null };
    return { text: '', height: null };
  }

  const feet = parseInt(match[1], 10);
  // Looser than isHeightComplete's 3–8 on purpose: while typing, "1" could still become "10",
  // so only outright impossible feet values are rejected here.
  if (!Number.isFinite(feet) || feet < 1 || feet > 8) {
    return { text: draft, height: null };
  }

  const inchPart = match[2];
  // Feet only so far ("5" or "5'") — valid draft, nothing to commit.
  if (inchPart == null || inchPart === '') {
    return { text: draft, height: null };
  }

  // The deliberate wait: a single inch digit is ambiguous. "5'1" might be 5'1" or the
  // first half of 5'11", and committing early would fight someone typing 5'11".
  // finalizeHeightFromDraft is what rescues the user who stops at one digit.
  if (inchPart.length === 1) {
    return { text: draft, height: null };
  }

  // Two inch digits — clamp into 0–11 so "5'99" lands on 5'11" instead of nonsense.
  // vocab: Math.min(11, Math.max(0, n)) = the standard clamp idiom
  const inches = Math.min(11, Math.max(0, parseInt(inchPart.slice(0, 2), 10)));
  const height = { feet, inches };
  // Final gate — catches the 1–2 feet values the loose check above let through.
  if (!isHeightComplete(height)) {
    return { text: draft, height: null };
  }

  // Success: hand back the canonical `5'11"` string, not the raw draft, so the field
  // snaps to clean formatting the moment the value becomes valid.
  return {
    text: `${feet}'${inches}"`,
    height,
  };
}

/**
 * Commit height from a draft when the user finished typing (e.g. 5'9 or 5'11).
 * parseHeightInputText intentionally waits for two inch digits while typing 5'11".
 */
// Call this on blur / "Next", not on keystroke. It's the escape hatch for the
// single-inch-digit case parseHeightInputText refuses to commit while typing.
export function finalizeHeightFromDraft(raw) {
  // Fast path: if the strict parser already accepted it, take that.
  const { height } = parseHeightInputText(raw);
  if (height) return height;

  const draft = sanitizeHeightDraft(raw);
  if (!draft) return null;

  // The relaxed rule: `{1,2}` inch digits instead of requiring exactly 2, so "5'9"
  // finally resolves to { feet: 5, inches: 9 } now that the user has stopped typing.
  const match = draft.match(/^(\d{1,2})'(\d{1,2})"?$/);
  if (!match) return null;

  const heightObj = {
    feet: parseInt(match[1], 10),
    inches: parseInt(match[2], 10),
  };
  // No clamping here — unlike the typing path, a bad value at commit time should be
  // rejected outright (null) so the UI can show an error rather than silently guessing.
  return isHeightComplete(heightObj) ? heightObj : null;
}
