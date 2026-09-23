// Display cellFormattingters for booked trainer/client sessions.
// Flow: raw stored values ("2026-03-14", "14:30") → human strings ("Saturday, March 14, 2026", "2:30 PM").
// Used by session cards and meeting rows; never used to do date math, only to print.

// Zero-pads a number to two digits so "2:5 PM" never happens.
// vocab: padStart(2, '0') = "make the string at least 2 chars long by adding '0' to the front"
export const pad2 = (n) => String(n).padStart(2, '0');

// Turns a stored date key into a long spelled-out date.
export const cellFormattingDateLong = (dateKey) => {
  if (!dateKey) return '';
  // Accept either a real Date or a "YYYY-MM-DD" string.
  // The 'T12:00:00' is deliberate: parsing a bare "YYYY-MM-DD" is treated as UTC midnight,
  // which can shift the day backwards for anyone west of UTC. Anchoring at noon makes the
  // date immune to timezone offsets.
  // vocab: .slice(0, 10) = keep just the "YYYY-MM-DD" part and throw away any time that came along
  const d = dateKey instanceof Date ? dateKey : new Date(String(dateKey).slice(0, 10) + 'T12:00:00');
  // Garbage in → show the raw value rather than the literal string "Invalid Date".
  if (Number.isNaN(d.getTime())) return String(dateKey);
  // vocab: toLocaleDateString(undefined, ...) = cellFormatting using the *device's* locale
  // Manipulate here: drop 'weekday' for a shorter label, or use month: 'short' for "Mar 14, 2026"
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
};

// Converts a stored 24-hour "HH:MM" into a 12-hour clock label.
export const cellFormattingTime12 = (hhmm) => {
  if (!hhmm) return '';
  const [hStr, mStr] = String(hhmm).split(':');
  const h = parseInt(hStr, 10);
  // `mStr || '0'` covers values stored as just "14" with no minutes.
  const m = parseInt(mStr || '0', 10);
  // Unparseable time → echo it back instead of rendering "NaN:NaN".
  if (Number.isNaN(h) || Number.isNaN(m)) return String(hhmm);
  const ampm = h >= 12 ? 'PM' : 'AM';
  // The 12-hour wrap trick: midnight (0) and noon (12) must both print as "12", not "0".
  // ((h + 11) % 12) + 1 maps 0→12, 13→1, 23→11 in one shot.
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${pad2(m)} ${ampm}`;
};

