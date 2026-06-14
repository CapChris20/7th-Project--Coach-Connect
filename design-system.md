# Coach Connect — Design System

Reference document synthesized from production UI screenshots (May 2026) and implemented tokens in `src/theme/colors.js`, `src/shared/ui/theme.js`, `src/shared/ui/brandGradients.js`, and premium dashboard components.

**Platform:** React Native (Expo). **Primary aesthetic:** Premium dark “neon glass” with optional iOS-inspired light mode.

---

## 1. Color Palette

### Brand core (both modes)

| Token | Hex | Usage |
|-------|-----|--------|
| **Pink (primary)** | `#FF6B9D` | CTAs, user-owned content, calorie/activity accents |
| **Purple (secondary)** | `#C084FC` | Sleep, AI, brand wordmark, secondary gradients |
| **Cyan** | `#06B6D4` | Coach content, hydration, document badges |
| **Orange** | `#F97316` | Workout, energy, warm gradient stops |
| **Indigo (legacy theme)** | `#5856D6` | `ThemeContext` primary (settings-style screens) |
| **Violet accent** | `#7C3AED` | Legacy `ACCENT_COLOR` in ClientApp |

### Brand gradients (canonical)

| Name | Stops | Direction | Usage |
|------|-------|-----------|--------|
| **Nav / logo icon** | `#E94EAD` → `#A348D0` → `#6B3AD9` | Top → bottom | Tab icons, masked brand glyphs |
| **Primary CTA (warm)** | `#BE185D` → `#C2410C` | Left → right | “Explore Dashboard”, header profile icon |
| **Primary CTA (cool)** | `#C084FC` → `#FF6B9D` | Left → right | Files hero, message buttons |
| **Pink → purple (marketing)** | `#E94E89` → `#9155FD` | Left → right | “Coach Connect” title treatments |
| **Pink → orange (action)** | `#E91E63` / `#FF6B9D` → `#F4511E` / `#F97316` | Left → right | High-energy primary buttons |
| **Cyan → pink (border)** | `#06B6D4` → `#FF6B9D` | Left → right | Hero card top borders, “Today” cards |
| **Purple → blue (FAB)** | `#A259FF` → `#6366F1` | Diagonal | Center “+” nav button (alt screens) |
| **Trainer hero (warm)** | `#FF5F6D` → `#FFC371` | Diagonal | Trainer home hero card (light) |

### Dark mode — backgrounds & surfaces

| Token | Hex / value | Usage |
|-------|-------------|--------|
| **App background** | `#000000` / `#0A0A0F` | Screen root (`colors.background`, premium theme) |
| **Elevated surface** | `#0D0D0D` – `#121212` | Base cards |
| **Card fill** | `#141419` / `#1A1A2E` / `#1C1C24` | Stat cards, file tiles |
| **Glass surface** | `rgba(255,255,255,0.05)` | Frosted stat cards |
| **Glass strong** | `rgba(255,255,255,0.08)` | Emphasized panels |
| **Chip / secondary** | `#1C1C2E` / `rgba(255,255,255,0.08)` | Quick-action pills, icon buttons |
| **Hero inner gradient** | `#1a0a2e` → `#0f0a1a` | Dashboard / Files hero interiors |
| **Nav bar** | `rgba(12,12,18,0.55)` + blur | Bottom navigation |
| **Obsidian (liquid)** | `#050505` | Deep liquid-glass variant |

### Dark mode — text

| Token | Value | Usage |
|-------|-------|--------|
| **Primary** | `#FFFFFF` | Headings, values |
| **Secondary** | `rgba(255,255,255,0.60)` | Body, descriptions |
| **Label / overline** | `rgba(255,255,255,0.45)` – `0.50` | `YOUR COMPLETE DASHBOARD`, section kickers |
| **Tertiary / meta** | `rgba(255,255,255,0.30)` – `0.40` | Timestamps, hints |
| **Muted (tailwind-style)** | `#94A3B8` / `#A0A0B8` | Section headers on profile-style cards |

### Dark mode — borders & strokes

| Token | Value | Usage |
|-------|-------|--------|
| **Hairline** | `rgba(255,255,255,0.08)` – `0.10` | Card edges |
| **Glass stroke top** | `rgba(255,255,255,0.15)` | Liquid glass highlight |
| **Glass stroke bottom** | `rgba(255,255,255,0.04)` | Liquid glass shadow edge |
| **Coach file border** | `rgba(6,182,212,0.25)` | Cyan-tinted tiles |
| **My file border** | `rgba(255,107,157,0.25)` | Pink-tinted tiles |
| **Subtle card border** | `#222222` | Flat metric cards (reference mocks) |

### Light mode — backgrounds & surfaces

| Token | Hex / value | Usage |
|-------|-------------|--------|
| **App background** | `#F2F2F7` / `#F8F9FA` / `#F8FAFC` | iOS-style gray canvas |
| **Surface** | `#FFFFFF` | Cards, header |
| **Surface secondary** | `#F9F9F9` / `#F3E8FF` | Lavender-tinted stat areas |
| **Hero inner gradient** | `#F8FAFF` → `#FFFFFF` | Light hero cards |
| **Metric box** | `#F1F1F1` | Inline stat backgrounds (trainer) |
| **Nav bar** | `rgba(255,255,255,0.55)` + blur | Bottom navigation |

### Light mode — text

| Token | Value | Usage |
|-------|-------|--------|
| **Primary (ink)** | `#0A0A0F` / `#1A202C` / `#000000` | Headlines |
| **Secondary** | `rgba(10,10,15,0.58)` – `0.60` | Body |
| **Label** | `rgba(10,10,15,0.45)` – `0.55` | Overlines |
| **iOS secondary** | `#3C3C43` | ThemeContext body |
| **Muted** | `#71717A` / `#718096` | Captions |

### Accent palette (semantic & decorative)

| Category | Hex | Semantic use |
|----------|-----|----------------|
| **Electric cyan** | `#00E5FF` / `#64D2FF` / `#4FC3F7` / `#38BDF8` | Water, coach docs, highlights |
| **Magenta** | `#FF00D4` / `#FF2DCE` | Liquid-glass accent alt |
| **Hot pink** | `#FF4081` / `#FF4D97` | User badges, names in greeting |
| **Soft purple** | `#B388FF` / `#8A70FF` | Active nav, sleep |
| **Teal progress** | `#00B4D8` | Weight “current” value (light charts) |
| **Soft purple (before)** | `#B794F4` | Weight “before” value |
| **Profile / avatar warm** | `#BE185D` → `#C2410C` | Avatar ring, profile header |
| **Camera action** | `#FF9800` | Avatar edit button |
| **Light orange** | `#FFB25B` | Liquid gradient stop |

### Semantic colors (status & feedback)

| Token | Dark | Light | Usage |
|-------|------|-------|--------|
| **Success** | `#30D158` | `#30D158` | Active client, positive trend |
| **Success (alt)** | `#10B981` / `#38A169` | same | Weight loss, completion |
| **Warning** | `#FF9F0A` | `#FF9F0A` | Alerts |
| **Error** | `#FF453A` / `#FF3B30` | `#FF3B30` / `#E53E3E` | Badges, snackbars |
| **Info** | `#5856D6` | `#5856D6` | Links, info chips |
| **Inactive** | `#8E8E93` | `#8E8E93` | Disabled nav, placeholders |
| **Notification dot** | `#FF5C8D` | — | Unread indicators |
| **Active pill bg** | `rgba(124,58,237,0.2)` / `#F3E5F5` | Purple wash behind “Active” |

### Section color coding (content ownership)

| Owner | Primary accent | Border / badge |
|-------|----------------|----------------|
| **Coach / trainer** | Cyan `#06B6D4` | Cyan borders, “DOC” badges |
| **Client / user** | Pink `#FF6B9D` | Pink borders, “IMAGE” badges |
| **Shared / neutral** | Purple `#C084FC` | Notes, mixed sections |

---

## 2. Typography

**Font family:** System default — SF Pro / SF Pro Rounded on iOS, Roboto on Android. No custom web font required for RN. Serif accent (`Georgia`) used only on Plan Viewer.

### Type scale

| Role | Size | Weight | Line height | Letter spacing | Example |
|------|------|--------|-------------|----------------|---------|
| **Brand / app name** | 28–32px | 700–800 | 34–38 | -0.5 to 0 | “Coach Connect” |
| **Hero greeting** | 24–28px | 700 | 30–34 | 0 | “Good Morning, Chris!” |
| **Hero name highlight** | 24–28px | 700 | — | 0 | “Chris!” in `#FF6B9D` |
| **Hero card headline** | 22px | 900 | 28 | 0 | “Everything You Need…” |
| **Section title (sentence)** | 20–24px | 700 | 28–32 | 0 | “Training Agenda” |
| **Large stat / timer** | 36–42px | 800 | 40–44 | -1 | File count “3”, weight “178” |
| **Metric value** | 32–40px | 700–800 | 36–44 | -0.2 | Sleep hours, calories |
| **H2 (theme)** | 24px | 600 | 32 | 0 | Screen titles |
| **H3 (theme)** | 20px | 600 | 28 | 0 | Card titles |
| **Body** | 16px | 400–600 | 24 | 0 | Descriptions, quotes |
| **Body small** | 14px | 400–600 | 21 | 0 | Subheads under heroes |
| **Button label** | 14–16px | 700 | 20–24 | 0 | “Explore Dashboard” |
| **Section overline** | 11–12px | 700 | 16 | **1px** (≈0.08em) | `YOUR COMPLETE DASHBOARD` |
| **Card label (caps)** | 10–12px | 700–800 | 14–16 | **0.8–1px** | `WATER INTAKE`, `SLEEP` |
| **Nav label** | 10px | 600 | 12 | **0.3px** | “Home”, “Nutrition” |
| **Caption / meta** | 9–12px | 400–600 | 14–16 | 0.2–0.8 | Dates, file sizes |
| **Badge text** | 10–11px | 800 | 12 | 0.2 | “99+”, “DOC” |

### Text color pairing

| Role | Dark mode | Light mode |
|------|-----------|------------|
| Primary | `#FFFFFF` | `#0A0A0F` / `#000000` |
| Secondary | `rgba(255,255,255,0.60)` | `rgba(10,10,15,0.58)` |
| Overline | `rgba(255,255,255,0.45)` | `rgba(10,10,15,0.45)` |
| Accent inline | `#FF6B9D`, `#06B6D4`, `#C084FC` | Same brand accents on ink |

### Gradient text (marketing headers)

```css
background: linear-gradient(to right, #E94E89, #9155FD);
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

---

## 3. Spacing & Layout

### Spacing scale (from `theme.js`)

| Token | px | Typical use |
|-------|-----|-------------|
| `xs` | 4 | Icon gaps, nav padding |
| `sm` | 8 | Pill gaps, tight stacks |
| `md` | 16 | Default card margin, grid gap |
| `lg` | 24 | Card internal padding (heroes) |
| `xl` | 32 | Major section breaks |
| `xxl` | 48 | Screen section padding |
| `xxxl` | 64 | Large hero spacing |

### Layout standards

| Rule | Value |
|------|--------|
| **Screen horizontal margin** | 16–20px (`paddingHorizontal: 16` most heroes; 20px on full-bleed grids) |
| **Between major sections** | 24–32px vertical |
| **Between cards in a grid** | 12–16px (`CARD_GAP = 16`, stat row gap `12`) |
| **Hero card vertical margin** | 16px |
| **Card internal padding** | 20–24px (heroes); 16px (metric tiles) |
| **CTA height** | 48–56px |
| **Bottom nav min height** | 80px + safe area inset |
| **FAB size** | 56×56px |
| **Stat row horizontal inset** | 40px total (20px × 2) |

### Grid behavior (mobile default)

| Pattern | Columns | Gap |
|---------|---------|-----|
| Wellness / metrics | 2 | 12px |
| Files (coach) | 1–2 scroll | 12px |
| Files (my uploads) | Horizontal carousel | 12px |
| Trainer client metrics | 3 | 8px |
| Quick-action chips | 4 equal flex | 8px |

---

## 4. Component Styles

### Cards

| Property | Dark | Light |
|----------|------|-------|
| **Background** | `#141419`, glass `rgba(255,255,255,0.05)`, or hero gradient `#1a0a2e`→`#0f0a1a` | `#FFFFFF`, `rgba(255,255,255,0.72)` glass |
| **Border** | `rgba(255,255,255,0.08)` or accent tint (cyan/pink 25% opacity) | `rgba(0,0,0,0.06–0.08)` or gradient border wrapper |
| **Border radius** | **24px** (standard), **28–32px** (large marketing), **16px** (compact actions) | Same |
| **Padding** | 16–24px | Same |
| **Top accent stripe** | 3px horizontal gradient (`#BE185D`→`#C2410C` or cyan→pink) | Same pattern, slightly softer stops |
| **Shadow / glow** | Colored glow preferred over black drop shadow: e.g. `shadowColor: #BE185D`, `shadowOpacity: 0.32`, `shadowRadius: 16`, `offset: {0,8}` | Soft neutral: `0 10px 25px rgba(0,0,0,0.05)` |
| **Gradient border** | 1–2px pseudo-border via wrapper `LinearGradient` + inner clip | Pink→purple `border-image` style on weight cards |

### Buttons

| Variant | Style |
|---------|--------|
| **Primary CTA** | Full-width, height 48px, `borderRadius: 14–20px`, horizontal gradient (`#BE185D`→`#C2410C` or `#C084FC`→`#FF6B9D`), white label 14px/700, trailing arrow icon 16px |
| **Secondary** | `#1C1C24` / `rgba(255,255,255,0.08)` bg, no gradient, 12px radius, 12×24 padding |
| **Ghost / add** | 1px `rgba(255,255,255,0.1)` border, transparent fill |
| **FAB (nav)** | 56px circle, brand gradient fill, white `+` 28px, `shadowRadius: 8` |
| **Pill chip** | Height 40px, `borderRadius: 10–12px`, icon 12px + label 10px/600 |

**Press / hover states:**

- Pressed: `opacity: 0.92`, `scale: 0.98`
- Hovered (web): `opacity: 0.96`
- Android ripple: `rgba(255,255,255,0.12–0.20)`

### Icons

| Context | Size | Style | Color |
|---------|------|-------|-------|
| **Nav tab** | 36px (gradient mask) | Ionicons filled/outline | Brand gradient via `MaskedView` |
| **Nav inactive** | 24–28px | Outline | `rgba(255,255,255,0.35)` dark / `rgba(0,0,0,0.35)` light |
| **Hero feature** | 12–24px | Outline (`-outline` suffix) | Cyan `#64D2FF` or section accent |
| **Metric container** | 20–24px in 40px circle | Solid or outline | Tinted circle `rgba(accent, 0.15)` |
| **Settings** | 24px | Custom PNG / gear | Blue-gray 3D asset |
| **Profile header** | 36px | PNG + gradient mask | `#BE185D`→`#C2410C` |

### Form elements

| Property | Value |
|----------|--------|
| **Input height** | 44px |
| **Input radius** | 12px |
| **Input background (dark)** | `#252530` / recessed `rgba(255,255,255,0.06)` |
| **Border** | None or `1px rgba(255,255,255,0.1)` |
| **Placeholder** | `#8E8E93` / `rgba(255,255,255,0.4)` |
| **Label** | 12px caps or 14px sentence case above field, muted color |
| **Inline actions** | Small gradient “Save” pill beside metric inputs |

### Toggles & switches

Follow iOS system switches where used; brand accent tint `#C084FC` or `#5856D6` when custom. Animate with `Animated.spring` / default RN switch animation (~200ms).

### Badges & pills

| Type | Style |
|------|--------|
| **Count badge** | min 22px, `borderRadius: 11`, `#FF3B30` fill, 2px border matching card bg |
| **Category (DOC/IMAGE)** | 10px/800, uppercase, pill `borderRadius: 6–8`, cyan or pink fill |
| **Section number** | 20px circle, cyan or pink fill, white numeral |
| **Status “ACTIVE”** | Purple bg `#2D2D3A` / light purple text `#B388FF`, 12px radius |

### Bottom navigation

- Frosted bar: blur intensity **28** (dark) / **18** (light)
- Top corners: **24px** radius
- Active tab: frosted pill behind icon, spring animation `friction: 8`
- Active label: `colors.primary` (`#5856D6`) or brand purple `#8A70FF`

---

## 5. Visual Effects

### When to use effects

| Effect | Use | Avoid |
|--------|-----|-------|
| **Linear gradients** | CTAs, FAB, top card stripes, brand text, nav icons | Large flat text blocks, body paragraphs |
| **Colored glow shadow** | Hero cards, primary buttons | Every list row |
| **Black drop shadow** | Light-mode cards only (soft) | Dark mode (prefer glow) |
| **Backdrop blur** | Nav bar, glass stat cards, light header | Deep nested scroll children |
| **Gradient borders** | Hero cards, weight card, files hero | Small chips (use solid tint border) |
| **Illustrations / Lottie** | Empty wellness states | Dense data tables |

### Animation tokens

| Interaction | Duration | Easing / config |
|-------------|----------|-----------------|
| **Nav tab active** | ~300ms perceived | `Animated.spring`, `friction: 8`, native driver |
| **Screen enter fade** | 350ms | `timing`, default ease |
| **Screen enter rise** | 350ms | `translateY: 10 → 0` |
| **Modal scale in** | 220ms fade + spring | `friction: 8`, `tension: 65` |
| **Card press** | Instant | `scale: 0.98`, `opacity: 0.92` |
| **Photo gallery hover** | 100ms in / 120ms out | `scale: 1.02` |
| **Toast notify** | 200ms in, 2400ms hold, 200ms out | opacity |
| **Progress ring fill** | 600–800ms | `timing` on stroke |

**CSS equivalent (web prototypes):**

```css
transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
            opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
```

### Hover states (web)

| Element | Effect |
|---------|--------|
| Primary button | `opacity: 0.96`, optional `translateY(-1px)` |
| Card pressable | `scale(0.98)` |
| List tile | `opacity: 0.88` (`activeOpacity`) |

### Focus states (web / a11y)

```css
outline: 2px solid #C084FC;
outline-offset: 2px;
```

Prefer visible focus on gradient buttons via outer ring, not inner glow.

### Glow reference (React Native)

```javascript
{
  shadowColor: '#FF6B9D', // or #BE185D for warm heroes
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.32,
  shadowRadius: 16,
  elevation: 10,
}
```

---

## 6. Responsive Breakpoints

| Breakpoint | Min width | Layout behavior |
|------------|-----------|-----------------|
| **Mobile** | 0–767px | Default; single column; 2-col metric grids; horizontal carousels |
| **Tablet** | **768px** | Wider cards; client grids may add columns; photo gallery multi-column (`TABLET_MIN_WIDTH = 768`) |
| **Desktop / large** | 1024px+ (inferred) | Centered max-width content; 3–4 col metrics; side-by-side hero + stats |

**React Native pattern:**

```javascript
const { width } = useWindowDimensions();
const isTablet = width > 768;
```

Stack → grid: wellness 2-col stays on phone; trainer dashboards expand horizontal padding proportionally.

---

## 7. Design Principles

### Aesthetic

**“Premium neon glass”** — dark-first, high-contrast, fitness-tech energy. Combines:

- iOS 18–influenced spacing and system typography
- Glassmorphism-lite (blur + translucent fills, not heavy skeuomorphism)
- Cyber-athletic gradients on actions only
- Playful illustrations for empty states (not for dense data)

Light mode is a **soft UI** variant: white cards, subtle shadows, same gradient accents on borders and FAB.

### Key rules

1. **Dark space is structure** — use 24–32px between sections; never pack metric grids tight.
2. **Gradients signal action** — one primary gradient per screen region; don’t rainbow every card.
3. **Color codes ownership** — cyan = coach, pink = client, purple = shared/AI/sleep.
4. **Prefer glow over black shadow** on dark surfaces.
5. **Rounded everything** — minimum 12px on interactive elements; 24px on cards.
6. **Caps + letter-spacing for labels** — establishes hierarchy without extra font sizes.
7. **No decorative clutter** — no gratuitous dividers; use gradient hairlines or numbered section badges.
8. **Accessibility** — maintain 4.5:1 on body text; use `rgba` white at 60%+ for secondary on `#0A0A0F`.

### Tone & feel

Energetic, motivating, professional — “your coach in your pocket,” not clinical hospital UI. Confident typography (700–900 weights on heroes). Friendly illustrations reduce tracking anxiety.

---

## 8. Code Examples

### Premium hero card (React Native)

```jsx
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View, StyleSheet } from 'react-native';

const TOP_BORDER = ['#BE185D', '#C2410C'];
const CTA = ['#BE185D', '#C2410C'];
const BG = ['#1a0a2e', '#0f0a1a'];

export function HeroCard({ title, subtitle, onPress }) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.shadow}>
        <View style={styles.clip}>
          <LinearGradient colors={TOP_BORDER} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.topStripe} />
          <LinearGradient colors={BG} style={styles.inner}>
            <Text style={styles.overline}>YOUR COMPLETE DASHBOARD</Text>
            <Text style={styles.headline}>{title}</Text>
            <Text style={styles.subhead}>{subtitle}</Text>
            <Pressable onPress={onPress} style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
              <LinearGradient colors={CTA} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaFill}>
                <Text style={styles.ctaText}>Explore Dashboard</Text>
              </LinearGradient>
            </Pressable>
          </LinearGradient>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 16, paddingHorizontal: 16 },
  shadow: {
    borderRadius: 24,
    shadowColor: '#BE185D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 10,
  },
  clip: { borderRadius: 24, overflow: 'hidden' },
  topStripe: { height: 3, width: '100%' },
  inner: { padding: 24, minHeight: 220 },
  overline: { fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' },
  headline: { marginTop: 12, fontSize: 22, fontWeight: '900', lineHeight: 28, color: '#FFF' },
  subhead: { marginTop: 8, fontSize: 14, fontWeight: '600', lineHeight: 21, color: 'rgba(255,255,255,0.6)' },
  cta: { marginTop: 16, borderRadius: 14, overflow: 'hidden' },
  ctaPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  ctaFill: { height: 48, justifyContent: 'center', alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
```

### Tailwind (web / marketing preview)

```html
<!-- Metric card -->
<div class="rounded-3xl border border-white/10 bg-[#141419] p-4">
  <p class="text-xs font-bold uppercase tracking-widest text-[#94A3B8]">Water</p>
  <p class="text-4xl font-bold text-white">0</p>
  <p class="text-sm text-white/60">glasses today</p>
</motion.div>

<!-- Primary button -->
<button class="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#BE185D] to-[#C2410C] text-sm font-bold text-white transition active:scale-[0.98] hover:opacity-95">
  Explore Dashboard →
</button>
```

### Button hover animation (CSS)

```css
.btn-primary {
  background: linear-gradient(90deg, #BE185D 0%, #C2410C 100%);
  border-radius: 14px;
  transition: transform 0.15s cubic-bezier(0.4, 0, 0.2, 1),
              opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.2s ease;
  box-shadow: 0 8px 24px rgba(190, 24, 93, 0.35);
}
.btn-primary:hover {
  opacity: 0.96;
  transform: translateY(-1px);
  box-shadow: 0 12px 32px rgba(190, 24, 93, 0.45);
}
.btn-primary:active {
  transform: scale(0.98);
  opacity: 0.92;
}
```

### Gradient border card (CSS wrapper pattern)

```css
.card-gradient-border {
  padding: 1px;
  border-radius: 24px;
  background: linear-gradient(135deg, #06B6D4, #FF6B9D);
}
.card-gradient-border__inner {
  border-radius: 23px;
  background: #0A0A0F;
  padding: 24px;
}
```

### Icon usage (React Native + brand gradient)

```jsx
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const GRADIENT = ['#E94EAD', '#A348D0', '#6B3AD9'];

function BrandIcon({ name, size = 36 }) {
  return (
    <MaskedView style={{ width: size, height: size }} maskElement={<Ionicons name={name} size={size} color="#000" />}>
      <LinearGradient colors={GRADIENT} locations={[0, 0.5, 1]} style={{ width: size, height: size }} />
    </MaskedView>
  );
}
```

### Glass stat card (dark)

```jsx
<View style={{
  backgroundColor: 'rgba(255,255,255,0.05)',
  borderRadius: 24,
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.10)',
  padding: 16,
}}>
  {/* content */}
</View>
```

---

## Quick reference — import paths

| File | Purpose |
|------|---------|
| `src/theme/colors.js` | Dark premium palette + pink glow shadows |
| `src/shared/ui/theme.js` | Light/dark iOS theme, typography, spacing scale |
| `src/shared/ui/brandGradients.js` | Nav icon gradient stops |
| `src/shared/ui/liquid/liquidTokens.js` | Obsidian glass + neon accent alt |
| `src/client/components/DashboardHeroCard.jsx` | Hero card anatomy |
| `src/navigation/BottomNavBar.js` | Nav blur, FAB, spring tabs |

---

*Last updated from design references — May 2026. Align new UI with this doc before introducing new hex values.*
