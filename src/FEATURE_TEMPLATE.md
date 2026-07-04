# Coach Connect — Feature Template

Copy this structure when adding a **new product feature** (not a one-off screen in an existing domain).

---

## 1. Choose location

| Feature type | Root folder |
|--------------|-------------|
| Client-only UI flow | `src/client-app/<feature-name>/` |
| Trainer-only UI flow | `src/trainer-app/<feature-name>/` |
| Both roles + shared logic | `src/<feature-name>/` (top-level) |
| AI coach capability | `src/ai-coach/` (see existing split) |

---

## 2. Recommended folder layout

### Top-level feature (e.g. `src/meal-plan/` — hypothetical)

```
src/meal-plan/
├── README.md                 ← optional: 3-line scope note (only if complex)
├── components/               ← UI pieces used only inside this feature
│   └── MealPlanCard.jsx
├── screens/                  ← full screens
│   └── MealPlanHomeScreen.jsx
├── services/                 ← Firestore / API (no JSX)
│   └── saveMealPlanToFirestore.js
├── hooks/                    ← optional: data hooks
│   └── useMealPlanForWeek.js
└── utils/                    ← optional: feature-local pure helpers
    └── formatMealPlanDay.js
```

### Role-specific wrapper (when UI differs per role)

```
src/client-app/meal-plan/
└── screens/
    └── LogTodaysMealsScreen.jsx    ← imports from src/meal-plan/ or composes locally

src/trainer-app/meal-plan/
└── screens/
    └── AssignMealPlanScreen.jsx
```

---

## 3. File checklist for a new screen

- [ ] Screen file: `FeatureActionScreen.jsx` (PascalCase + `Screen`)
- [ ] Register route in `src/navigation/routes.js` (`CLIENT_ROUTES` / `TRAINER_ROUTES`)
- [ ] Wire into role navigator (`client-app/navigation/` or `trainer-app/navigation/`)
- [ ] Firestore paths documented if new collections used
- [ ] Unit test if pure logic extracted
- [ ] Entry added to catalog: run `node scripts/generateSrcFileCatalog.mjs`

---

## 4. Minimal screen stub

```jsx
/**
 * Meal Plan Home Screen
 *
 * Purpose: Shows the client's weekly meal plan summary.
 * Why it matters: Entry point for meal-plan logging linked to nutrition goals.
 *
 * @file-header
 */
import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../shared-ui/ThemeContext';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';

export default function MealPlanHomeScreen({ onBack }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <CoachConnectHeader title="Meal plan" onBack={onBack} />
      <Text>…</Text>
    </View>
  );
}
```

Adjust relative imports based on folder depth (see `STYLE_GUIDE.md`).

---

## 5. Service module stub

```js
/**
 * saveMealPlanToFirestore
 *
 * Purpose: Writes meal plan documents for a client under users/{uid}/mealPlans.
 * Why it matters: Single write path keeps nutrition and coach tools consistent.
 *
 * @file-header
 */
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../app-start/config';
import { stripUndefinedForFirestore } from '../../shared-utils/firestoreSanitize';

export async function saveMealPlan(uid, planId, data) {
  const ref = doc(db, 'users', uid, 'mealPlans', planId);
  await setDoc(ref, stripUndefinedForFirestore({ ...data, updatedAt: serverTimestamp() }), { merge: true });
}
```

---

## 6. When to use `shared/` instead

Move code to `shared/` when **two or more features** import it:

- `shared/components/` — large reusable UI
- `shared/services/` — Firestore/API used by client + trainer
- `shared/api/` — HTTP clients

Keep feature-specific code in the feature folder until duplication proves otherwise.

---

## 7. Server-side features

If the feature needs secrets, AI, or scraping:

```
server/routes/<feature>Routes.js
server/lib/<feature>/
```

Mobile app calls via `src/shared/api/` — never embed API keys in `src/`.

---

## 8. Tests

```
src/__tests__/unit/<featureName>.test.js        ← pure logic
src/__tests__/integration/<feature>Flow.test.js ← optional E2E-style
```

Run: `npm test`

---

## 9. Existing features to copy as reference

| Feature | Good reference for… |
|---------|---------------------|
| `nutrition/food-search/` | Search + confirm sheet + service layer |
| `ai-coach/chat-ui/` | Complex screen + modals + persistence |
| `metrics/daily-metrics/` | Firestore write consolidation |
| `messaging/` | Thin screens + heavy service elsewhere |
| `client-app/navigation/` | Overlay screens + route wiring |
