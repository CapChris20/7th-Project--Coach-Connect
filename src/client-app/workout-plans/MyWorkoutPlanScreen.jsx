// Weekly workout plan viewer: training-day cards, rest-day cards, and exercise popups.
// Flow: split the plan into workout vs rest → tap a day → tap an exercise or recovery item.
// Used when the client opens a saved plan. Day keys (short, focus, rest) stay as the plan stores them.

import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { FORM_SCROLL_PROPS, useModalScrollBottomPad, useShellBottomNavInset } from "../../navigation/bottomMenuSpacing";

const CTA_GRAD = ["#9D174D", "#B45309"];
const TOKENS = {
  pink: "#FF6B9D",
  purple: "#C084FC",
  bgDark: "#0A0A0F",
  bgLight: "#F2F2F7",
  cardDark: "#12131A",
  cardLight: "#FFFFFF",
  borderDark: "rgba(255,255,255,0.10)",
  borderLight: "rgba(10,10,15,0.08)",
  textDark: "#FFFFFF",
  textLight: "#0A0A0F",
  mutedDark: "rgba(255,255,255,0.62)",
  mutedLight: "rgba(10,10,15,0.58)",
  tertiaryDark: "rgba(255,255,255,0.45)",
  tertiaryLight: "rgba(10,10,15,0.45)",
  rowDark: "rgba(255,255,255,0.05)",
  rowLight: "rgba(10,10,15,0.04)",
};

const FOCUS_KEYS = {
  pink: { badge: "#FF6B9D", grad: CTA_GRAD },
  purple: { badge: "#C084FC", grad: ["#9333EA", "#C084FC"] },
  cyan: { badge: "#06B6D4", grad: ["#0891B2", "#06B6D4"] },
  orange: { badge: "#F97316", grad: ["#EA580C", "#F97316"] },
  green: { badge: "#10B981", grad: ["#059669", "#10B981"] },
  gray: { badge: "#94A3B8", grad: ["#4B5563", "#6B7280"] },
};

/** One unique muted rim gradient per weekday — not oversaturated. */
const GRAD_PINK_ORANGE = ["#9D174D", "#B45309"]; // dark pink → dark orange
const GRAD_GOLD_ORANGE = ["#A16207", "#B45309"]; // dark gold → dark orange
const GRAD_MULTI_PREMIUM = ["#1E3A8A", "#B45309", "#5B21B6", "#991B1B", "#A16207"]; // blue · orange · purple · red · gold
const GRAD_PURPLE_CYAN = ["#5B21B6", "#0E7490"]; // dark purple → cyan
const GRAD_MAGENTA_ORANGE = ["#86198F", "#B45309"]; // dark magenta → dark orange
const GRAD_PINK_CYAN = ["#9D174D", "#0E7490"]; // dark pink → cyan
const GRAD_CYAN_GOLD = ["#0E7490", "#A16207"]; // cyan → gold

const GRAD_CYCLE = [
  GRAD_PINK_ORANGE,
  GRAD_GOLD_ORANGE,
  GRAD_MULTI_PREMIUM,
  GRAD_PURPLE_CYAN,
  GRAD_MAGENTA_ORANGE,
  GRAD_PINK_CYAN,
  GRAD_CYAN_GOLD,
];

const DAY_RIM_BY_SHORT = {
  MON: GRAD_PINK_ORANGE,
  TUE: GRAD_GOLD_ORANGE,
  WED: GRAD_MULTI_PREMIUM,
  THU: GRAD_PURPLE_CYAN,
  FRI: GRAD_MAGENTA_ORANGE,
  SAT: GRAD_PINK_CYAN,
  SUN: GRAD_CYAN_GOLD,
};

const MULTI_GRAD_LOCATIONS = [0, 0.28, 0.52, 0.76, 1];

// ===== NAMED CONSTANTS =====

const DEFAULT_WEEKS_REMAINING = 4;
const DEFAULT_FOCUS_SUMMARY = "Complete muscle building program";
const DEFAULT_HERO_TITLE = "Your Workout Plan";
const DEFAULT_SESSION_TITLE = "Training";
const DEFAULT_RECOVERY_LABEL = "Recovery focus";
const DEFAULT_RECOVERY_FALLBACK = "Light movement & rest";
const DEFAULT_REST_SHORT = "Rest";
const SHORT_DAY_LETTERS = 3;
const PREVIEW_ROW_COUNT = 3;
const LABEL_WORD_CAP = 6;
const LABEL_CHAR_CAP = 44;
const LABEL_CHAR_TRIM = 41;
const LABEL_CUT_MIN_CHARS = 8;
const STEP_MIN_CHARS = 8;
const SHEET_HEIGHT_RATIO = 0.92;
const SHELL_BOTTOM_INSET = 16;
const MODAL_SCROLL_PAD = 56;
const DETAIL_SCROLL_PAD = 48;
const SHEET_SCROLL_PAD = 40;

const RECOVERY_TYPE_RULES = [
  { test: /walk|cardio|jog|run|hike/i, type: "Walking" },
  { test: /yoga/i, type: "Yoga" },
  { test: /stretch|mobil|flex/i, type: "Stretching" },
  { test: /foam\s*roll/i, type: "Foam Roll" },
  { test: /sleep|rest|nap/i, type: "Sleep" },
  { test: /water|hydra|drink/i, type: "Hydration" },
  { test: /nutri|meal|eat|food|prep/i, type: "Nutrition" },
  { test: /breath|meditat|mindful/i, type: "Mindfulness" },
];

const RECOVERY_FOCUS_RULES = [
  { test: /muscle|sore|blood\s*flow|circulation/i, focus: "Muscle recovery" },
  { test: /stress|mental|mind/i, focus: "Mental health" },
  { test: /sleep|energy/i, focus: "Energy" },
  { test: /mobil|flex/i, focus: "Mobility" },
];

const DEFAULT_RECOVERY_TYPE = "Activity";
const DEFAULT_RECOVERY_FOCUS = "Recovery";

// ===== HELPER FUNCTIONS =====

function stripeColors(rimColors) {
  if (!Array.isArray(rimColors) || rimColors.length <= 2) return rimColors;
  return [rimColors[0], rimColors[rimColors.length - 1]];
}

function getDayRimGradient(day, fallbackIndex = 0) {
  const short = String(day?.short || "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "")
    .slice(0, SHORT_DAY_LETTERS);
  if (short && DAY_RIM_BY_SHORT[short]) return DAY_RIM_BY_SHORT[short];
  return GRAD_CYCLE[Math.abs(Number(fallbackIndex) || 0) % GRAD_CYCLE.length];
}

function resolveAccent(focusColor, day, dayIndex = 0) {
  if (day) {
    const grad = getDayRimGradient(day, dayIndex);
    return { badge: grad[0], grad };
  }
  if (focusColor && FOCUS_KEYS[focusColor]) return FOCUS_KEYS[focusColor];
  const focusColorUppercase = String(focusColor || "").toUpperCase();
  if (focusColorUppercase.includes("F97316")) return { badge: GRAD_GOLD_ORANGE[0], grad: GRAD_GOLD_ORANGE };
  if (focusColorUppercase.includes("64D2FF") || focusColorUppercase.includes("06B6D4") || focusColorUppercase.includes("22D3EE")) {
    return { badge: GRAD_PURPLE_CYAN[0], grad: GRAD_PURPLE_CYAN };
  }
  if (focusColorUppercase.includes("FF6B9D")) return { badge: GRAD_PINK_ORANGE[0], grad: GRAD_PINK_ORANGE };
  if (focusColorUppercase.includes("10B981")) return FOCUS_KEYS.green;
  if (focusColorUppercase.includes("C084FC")) return { badge: GRAD_PURPLE_CYAN[0], grad: GRAD_PURPLE_CYAN };
  return { badge: GRAD_PINK_ORANGE[0], grad: GRAD_PINK_ORANGE };
}

function dayTitleSeparator(rawDay) {
  if (rawDay.includes("—")) return "—";
  if (rawDay.includes("–")) return "–";
  return null;
}

function sessionTitleLines(day) {
  const rawDay = String(day.day || "").trim();
  const focus = String(day.focus || "").trim();
  const sep = dayTitleSeparator(rawDay);
  if (sep) {
    const parts = rawDay.split(sep).map((part) => part.trim()).filter(Boolean);
    return { title: parts[0] || rawDay, subtitle: parts.slice(1).join(" · ") || focus };
  }
  const bits = focus.split(/\s*·\s*/).map((part) => part.trim()).filter(Boolean);
  if (bits.length >= 2) {
    return { title: bits[0], subtitle: bits.slice(1).join(" · ") };
  }
  return { title: rawDay || DEFAULT_SESSION_TITLE, subtitle: focus };
}

function parseSetsRepsRest(ex) {
  let sets = String(ex.sets != null ? ex.sets : "—").trim();
  let reps = String(ex.reps != null ? ex.reps : "—").trim();
  const combined = String(ex.sets || "");
  if (/[×x]/i.test(combined)) {
    const parts = combined.split(/[×x]/i);
    sets = (parts[0] || "").trim() || sets;
    reps = (parts[1] || "").trim() || reps;
  }
  let rest = String(ex.rest || "").trim();
  rest = rest.replace(/\s*rest\s*$/i, "").trim();
  if (!rest) rest = "—";
  return { sets, reps, rest };
}

function formatExerciseMeta(ex) {
  const { sets, reps, rest } = parseSetsRepsRest(ex);
  const mid = `${sets}×${reps}`;
  if (!rest || rest === "—") return mid;
  let restLabel = rest;
  if (!/s$/i.test(restLabel) && !/min/i.test(restLabel) && /^\d+(\.\d+)?$/.test(restLabel)) {
    restLabel = `${restLabel}s`;
  }
  const tail = /\brest\b/i.test(restLabel) ? restLabel : `${restLabel} rest`;
  return `${mid} · ${tail}`;
}

function splitTips(text) {
  const tipText = String(text || "").trim();
  if (!tipText) return [];
  const parts = tipText.split(/(?<=[.!?])\s+/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [tipText];
}

function splitLegacyNote(raw) {
  const lines = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const byArrow = raw.split(/\s*(?:→|➝|->)\s*/).map((line) => line.trim()).filter(Boolean);
  if (byArrow.length > 1) return byArrow;
  const sentences = splitTips(raw);
  return sentences.length ? sentences : [raw];
}

function toRecoveryItems(day) {
  if (Array.isArray(day?.recoveryActivities) && day.recoveryActivities.length > 0) {
    return day.recoveryActivities
      .filter((activity) => activity && typeof activity === "object" && typeof activity.label === "string" && activity.label.trim())
      .map((activity) => ({ label: extractShortLabel(activity.label), detail: String(activity.detail || "").trim() }));
  }
  const raw = String(day?.recoveryNote || day?.focus || "").trim();
  if (!raw) return [{ label: DEFAULT_RECOVERY_FALLBACK, detail: "" }];
  return splitLegacyNote(raw).map((segment) => ({
    label: extractShortLabel(segment),
    detail: segment.trim(),
  }));
}

function extractShortLabel(seg) {
  let labelText = String(seg || "").trim().replace(/\s+/g, " ");
  if (!labelText) return DEFAULT_RECOVERY_LABEL;
  labelText = labelText.replace(/^[-–—•*]\s*/, "").replace(/\.\s*$/, "");
  labelText = labelText
    .replace(/^Follow\s+with\s+/i, "")
    .replace(/^Prioritize\s+/i, "")
    .replace(/^Focus\s+on\s+/i, "")
    .replace(/^Consider\s+(doing\s+)?/i, "")
    .replace(/^Use\s+this\s+time\s+to\s+/i, "")
    .replace(/^Try\s+(to\s+)?/i, "")
    .replace(/^Aim\s+for\s+/i, "")
    .replace(/^If\s+you\s+feel\s+\w+,\s*/i, "")
    .replace(/^Given\s+[^,]+,\s*/i, "")
    .replace(/^A\s+(?=\d)/i, "");
  labelText = labelText.charAt(0).toUpperCase() + labelText.slice(1);
  const cutPoints = /\s+(?:—|--|to\s+(?:promote|reduce|help|improve|support|aid|maintain|prevent|enhance|avoid|ensure|allow|boost|keep|build|maximize|minimize|flush|speed|accelerate))\b|\s+(?:outdoors|indoors|especially|throughout|tonight|today|this\s+week|for\s+the\s+(?:next|rest|week|upcoming)|focus(?:ing)?\s+on|targeting|this\s+helps|which\s+helps|helps\s|if\s+you|and\s+dr)|\s*[;:]\s*/i;
  const beforeCut = labelText.split(cutPoints)[0].trim();
  if (beforeCut && beforeCut.length >= LABEL_CUT_MIN_CHARS) labelText = beforeCut;
  const words = labelText.split(/\s+/);
  if (words.length > LABEL_WORD_CAP) labelText = words.slice(0, LABEL_WORD_CAP).join(" ");
  if (labelText.length > LABEL_CHAR_CAP) labelText = labelText.slice(0, LABEL_CHAR_TRIM).replace(/\s+\S*$/, "");
  return labelText || DEFAULT_RECOVERY_LABEL;
}

function recoveryDayDisplayName(day) {
  return String(day?.day || "").replace(/^\?\s*/, "").trim() || String(day?.short || DEFAULT_REST_SHORT);
}

function muscleToTargets(muscle) {
  if (!muscle) return [];
  return String(muscle)
    .split(/[,/|]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function GradientFrame({ children, rimColors, radius = 20, innerBg, isDark }) {
  const rim = rimColors;
  const stripe = stripeColors(rim);
  const isMulti = rim.length > 2;
  return (
    <View style={{ borderRadius: radius }}>
      <LinearGradient
        colors={rim}
        locations={isMulti ? MULTI_GRAD_LOCATIONS : undefined}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius, padding: 1.5 }}
      >
        <View
          style={{
            borderRadius: radius - 1.5,
            backgroundColor: innerBg,
            overflow: "hidden",
            borderWidth: isDark ? 0 : 1,
            borderColor: isDark ? "transparent" : TOKENS.borderLight,
          }}
        >
          <LinearGradient
            colors={stripe}
            locations={stripe.length > 2 ? [0, 0.5, 1] : undefined}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topStripe}
          />
          {children}
        </View>
      </LinearGradient>
    </View>
  );
}

function IndexBadge({ index, grad }) {
  const isMulti = grad.length > 2;
  return (
    <LinearGradient
      colors={grad}
      locations={isMulti ? MULTI_GRAD_LOCATIONS : undefined}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.indexBadge}
    >
      <Text style={styles.indexBadgeText}>{index}</Text>
    </LinearGradient>
  );
}

function DayShortBadge({ label, grad }) {
  const isMulti = grad.length > 2;
  return (
    <LinearGradient
      colors={grad}
      locations={isMulti ? MULTI_GRAD_LOCATIONS : undefined}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.dayShortGrad}
    >
      <Text style={styles.dayShortText}>{label}</Text>
    </LinearGradient>
  );
}

function SectionHead({ label, isDark }) {
  return (
    <View style={styles.sectionHeadRow}>
      <Text style={[styles.sectionHeading, { color: isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight }]}>
        {label}
      </Text>
      <LinearGradient colors={CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sectionLine} />
    </View>
  );
}

function PlanSummaryCard({ title, weeksRemaining, focus, isDark = true }) {
  const innerBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const textPrimary = isDark ? TOKENS.textDark : TOKENS.textLight;
  const textMuted = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const textSecondary = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const boxBg = isDark ? TOKENS.rowDark : TOKENS.rowLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;

  return (
    <GradientFrame rimColors={CTA_GRAD} innerBg={innerBg} isDark={isDark}>
      <View style={styles.summaryInner}>
        <Text style={[styles.summaryLabel, { color: textMuted }]}>PLAN SUMMARY</Text>
        <Text style={[styles.summaryTitle, { color: textPrimary }]}>{title}</Text>
        <View style={styles.summaryRow}>
          <View style={[styles.summaryBox, { backgroundColor: boxBg, borderColor: borderC }]}>
            <Text style={[styles.summaryBoxLabel, { color: textMuted }]}>Weeks left</Text>
            <Text style={[styles.summaryBoxValue, { color: textPrimary }]}>{weeksRemaining}</Text>
          </View>
          <View style={[styles.summaryBox, { flex: 2, backgroundColor: boxBg, borderColor: borderC }]}>
            <Text style={[styles.summaryBoxLabel, { color: textMuted }]}>Focus</Text>
            <Text style={[styles.summaryBoxFocus, { color: textSecondary }]}>{focus}</Text>
          </View>
        </View>
      </View>
    </GradientFrame>
  );
}

function PreviewRow({ index, title, meta, grad, isDark }) {
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const rowBg = isDark ? TOKENS.rowDark : TOKENS.rowLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;

  return (
    <View style={[styles.previewRow, { backgroundColor: rowBg, borderColor: borderC }]}>
      <IndexBadge index={index} grad={grad} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.previewTitle, { color: text }]} numberOfLines={1}>
          {title}
        </Text>
        {!!meta && (
          <Text style={[styles.previewMeta, { color: tertiary }]} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>
    </View>
  );
}

function TrainingDayCard({ day, onPress, isDark, dayIndex = 0 }) {
  const accent = resolveAccent(day.focusColor, day, dayIndex);
  const { title, subtitle } = sessionTitleLines(day);
  const preview = (day.exercises || []).slice(0, PREVIEW_ROW_COUNT);
  const remaining = (day.exercises || []).length - preview.length;
  const innerBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <GradientFrame rimColors={accent.grad} innerBg={innerBg} isDark={isDark}>
        <View style={styles.dayCardInner}>
          <View style={styles.trainHeaderRow}>
            <DayShortBadge label={day.short} grad={accent.grad} />
            <View style={styles.trainTitles}>
              <Text style={[styles.trainTitle, { color: text }]}>{title}</Text>
              {!!subtitle && (
                <Text style={[styles.trainSubtitle, { color: tertiary }]} numberOfLines={2}>
                  {subtitle}
                </Text>
              )}
            </View>
            <Ionicons name="chevron-forward" size={18} color={tertiary} />
          </View>
          <View style={styles.trainPreview}>
            {preview.map((ex, i) => (
              <PreviewRow
                key={`${ex.name}-${i}`}
                index={String(i + 1).padStart(2, "0")}
                title={ex.name}
                meta={formatExerciseMeta(ex)}
                grad={accent.grad}
                isDark={isDark}
              />
            ))}
          </View>
          {remaining > 0 && (
            <Text style={[styles.trainMoreText, { color: tertiary, borderTopColor: borderC }]}>
              + {remaining} more {remaining === 1 ? "exercise" : "exercises"}
            </Text>
          )}
        </View>
      </GradientFrame>
    </TouchableOpacity>
  );
}

function RecoveryDayCard({ day, onPress, isDark, grad }) {
  const items = toRecoveryItems(day);
  const preview = items.slice(0, PREVIEW_ROW_COUNT);
  const remaining = items.length - preview.length;
  const innerBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const displayName = recoveryDayDisplayName(day);

  return (
    <TouchableOpacity activeOpacity={0.82} onPress={onPress}>
      <GradientFrame rimColors={grad} innerBg={innerBg} isDark={isDark}>
        <View style={styles.dayCardInner}>
          <View style={styles.trainHeaderRow}>
            <DayShortBadge label={day.short} grad={grad} />
            <View style={styles.trainTitles}>
              <Text style={[styles.trainTitle, { color: text }]}>Rest & Recovery</Text>
              <Text style={[styles.trainSubtitle, { color: tertiary }]} numberOfLines={2}>
                {displayName}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tertiary} />
          </View>
          <View style={styles.trainPreview}>
            {preview.map((item, i) => (
              <PreviewRow
                key={`${i}-${item.label.slice(0, 12)}`}
                index={String(i + 1).padStart(2, "0")}
                title={item.label}
                grad={grad}
                isDark={isDark}
              />
            ))}
          </View>
          {remaining > 0 && (
            <Text style={[styles.trainMoreText, { color: tertiary, borderTopColor: borderC }]}>
              + {remaining} more {remaining === 1 ? "focus" : "focus areas"}
            </Text>
          )}
        </View>
      </GradientFrame>
    </TouchableOpacity>
  );
}

function SubViewHeader({ onBack, grad, shortLabel, title, subtitle, isDark, backLabel = "Back to weekly plan" }) {
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;

  return (
    <View style={styles.subHeader}>
      <TouchableOpacity onPress={onBack} style={styles.subBackPill} activeOpacity={0.75}>
        <Ionicons name="chevron-back" size={16} color={text} />
        <Text style={[styles.subBackText, { color: text }]}>{backLabel}</Text>
      </TouchableOpacity>
      <View style={styles.subTitleRow}>
        <DayShortBadge label={shortLabel} grad={grad} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.subTitle, { color: text }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subSubtitle, { color: tertiary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </View>
  );
}

function DayDetailScreen({ day, onBack, onOpenExercise, isDark, dayIndex = 0 }) {
  const scrollBottomPad = useModalScrollBottomPad(48);
  const accent = resolveAccent(day.focusColor, day, dayIndex);
  const { title: sessionName, subtitle } = sessionTitleLines(day);
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const innerBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;

  return (
    <View style={[styles.detailRoot, { backgroundColor: isDark ? TOKENS.bgDark : TOKENS.bgLight }]}>
      <SubViewHeader
        onBack={onBack}
        grad={accent.grad}
        shortLabel={day.short}
        title={sessionName}
        subtitle={subtitle}
        isDark={isDark}
      />
      <ScrollView
        contentContainerStyle={[styles.detailScroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        <Text style={[styles.detailCount, { color: text }]}>{(day.exercises || []).length} exercises</Text>
        <Text style={[styles.detailHint, { color: tertiary }]}>Tap any exercise for coaching cues.</Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          {(day.exercises || []).map((ex, i) => (
            <TouchableOpacity key={`${ex.name}-${i}`} activeOpacity={0.78} onPress={() => onOpenExercise(i)}>
              <GradientFrame rimColors={accent.grad} radius={16} innerBg={innerBg} isDark={isDark}>
                <View style={[styles.listRowInner, { borderBottomWidth: 0 }]}>
                  <IndexBadge index={String(i + 1).padStart(2, "0")} grad={accent.grad} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.previewTitle, { color: text }]}>{ex.name}</Text>
                    <Text style={[styles.previewMeta, { color: tertiary }]}>{formatExerciseMeta(ex)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={tertiary} />
                </View>
              </GradientFrame>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RecoveryDayDetailScreen({ day, items, onBack, onOpenSegment, isDark, grad }) {
  const scrollBottomPad = useModalScrollBottomPad(48);
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const innerBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const displayName = recoveryDayDisplayName(day);

  return (
    <View style={[styles.detailRoot, { backgroundColor: isDark ? TOKENS.bgDark : TOKENS.bgLight }]}>
      <SubViewHeader
        onBack={onBack}
        grad={grad}
        shortLabel={day.short}
        title="Rest & Recovery"
        subtitle={displayName}
        isDark={isDark}
      />
      <ScrollView
        contentContainerStyle={[styles.detailScroll, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        <Text style={[styles.detailCount, { color: text }]}>{items.length} recovery focus areas</Text>
        <Text style={[styles.detailHint, { color: tertiary }]}>Tap any item for full guidance.</Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          {items.map((item, i) => (
            <TouchableOpacity key={`${i}-${item.label.slice(0, 16)}`} activeOpacity={0.78} onPress={() => onOpenSegment(i)}>
              <GradientFrame rimColors={grad} radius={16} innerBg={innerBg} isDark={isDark}>
                <View style={styles.listRowInner}>
                  <IndexBadge index={String(i + 1).padStart(2, "0")} grad={grad} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[styles.previewTitle, { color: text }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {!!item.detail && (
                      <Text style={[styles.previewMeta, { color: tertiary }]} numberOfLines={1}>
                        {item.detail}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={tertiary} />
                </View>
              </GradientFrame>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ExerciseDetailModal({ visible, day, exerciseIndex, onClose, onChangeIndex, isDark }) {
  const scrollBottomPad = useModalScrollBottomPad(40);
  const exercises = day?.exercises || [];
  const ex = exerciseIndex != null ? exercises[exerciseIndex] : null;
  const accent = resolveAccent(day?.focusColor, day);
  const { title: sessionName } = day ? sessionTitleLines(day) : { title: "" };
  const { sets, reps, rest } = ex ? parseSetsRepsRest(ex) : { sets: "—", reps: "—", rest: "—" };
  const tips = ex ? splitTips(ex.notes) : [];
  const targets = ex ? muscleToTargets(ex.muscle) : [];
  const hasPrev = exerciseIndex > 0;
  const hasNext = exerciseIndex < exercises.length - 1;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const muted = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const innerBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;

  if (!visible || !ex) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? TOKENS.bgDark : TOKENS.bgLight,
              maxHeight: Dimensions.get("window").height * SHEET_HEIGHT_RATIO,
            },
          ]}
        >
          <LinearGradient colors={accent.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetStripe} />
          <View style={styles.sheetHero}>
            <View style={styles.sheetTopRow}>
              <TouchableOpacity onPress={onClose} style={[styles.sheetIconBtn, { backgroundColor: isDark ? TOKENS.rowDark : TOKENS.rowLight }]}>
                <Ionicons name="close" size={20} color={text} />
              </TouchableOpacity>
              <LinearGradient colors={accent.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetCounterGrad}>
                <Text style={styles.sheetCounterText}>
                  {String(exerciseIndex + 1).padStart(2, "0")} / {String(exercises.length).padStart(2, "0")}
                </Text>
              </LinearGradient>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.sheetKicker, { color: tertiary }]}>
              {day.short} · {sessionName}
            </Text>
            <Text style={[styles.sheetTitle, { color: text }]}>{ex.name}</Text>
          </View>

          <ScrollView
            contentContainerStyle={[styles.sheetBody, { paddingBottom: scrollBottomPad }]}
            {...FORM_SCROLL_PROPS}
          >
            <View style={styles.statRow}>
              {[
                ["SETS", sets],
                ["REPS", reps],
                ["REST", rest],
              ].map(([label, value]) => (
                <View key={label} style={[styles.statBox, { backgroundColor: isDark ? TOKENS.rowDark : TOKENS.rowLight, borderColor: borderC }]}>
                  <Text style={[styles.statLabel, { color: tertiary }]}>{label}</Text>
                  <Text style={[styles.statValue, { color: text }]}>{value}</Text>
                </View>
              ))}
            </View>

            {targets.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: tertiary }]}>TARGETS</Text>
                <View style={styles.pillWrap}>
                  {targets.map((targetName) => (
                    <View key={targetName} style={[styles.targetPill, { borderColor: borderC, backgroundColor: innerBg }]}>
                      <Text style={[styles.targetPillText, { color: muted }]}>{targetName}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {tips.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: tertiary }]}>TIPS</Text>
                {tips.map((tip, i) => (
                  <View key={i} style={[styles.tipRow, { backgroundColor: isDark ? TOKENS.rowDark : TOKENS.rowLight, borderColor: borderC }]}>
                    <IndexBadge index={String(i + 1).padStart(2, "0")} grad={accent.grad} />
                    <Text style={[styles.tipBody, { color: muted }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => hasPrev && onChangeIndex(exerciseIndex - 1)}
                disabled={!hasPrev}
                style={[styles.navBtnOutline, { borderColor: borderC, backgroundColor: innerBg, opacity: hasPrev ? 1 : 0.35 }]}
              >
                <Ionicons name="chevron-back" size={18} color={muted} />
                <Text style={[styles.navBtnText, { color: muted }]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => hasNext && onChangeIndex(exerciseIndex + 1)} disabled={!hasNext} style={{ flex: 1, opacity: hasNext ? 1 : 0.35 }}>
                <LinearGradient colors={CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navBtnPrimary}>
                  <Text style={styles.navBtnPrimaryText}>Next</Text>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function firstMatchingType(labelText) {
  for (const rule of RECOVERY_TYPE_RULES) {
    if (rule.test.test(labelText)) return rule.type;
  }
  return DEFAULT_RECOVERY_TYPE;
}

function firstMatchingFocus(labelText) {
  for (const rule of RECOVERY_FOCUS_RULES) {
    if (rule.test.test(labelText)) return rule.focus;
  }
  return DEFAULT_RECOVERY_FOCUS;
}

function parseRecoveryMeta(label) {
  const labelText = String(label).toLowerCase();
  const durMatch = labelText.match(/(\d[\d–\-]*\s*(?:min(?:ute)?s?|hours?|hr))/i);
  const duration = durMatch ? durMatch[1] : null;
  return {
    duration,
    type: firstMatchingType(labelText),
    focus: firstMatchingFocus(labelText),
  };
}

function splitDetailIntoSteps(detail) {
  if (!detail) return [];
  return detail.split(/(?<=[.!?])\s+/).filter((step) => step.trim().length > STEP_MIN_CHARS);
}

function RecoveryGuidance({ steps, item, meta, tertiary, muted, borderC, grad, isDark }) {
  const rowBackground = isDark ? TOKENS.rowDark : TOKENS.rowLight;
  if (steps.length > 1) {
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: tertiary }]}>GUIDANCE</Text>
        {steps.map((step, i) => (
          <View key={i} style={[styles.tipRow, { backgroundColor: rowBackground, borderColor: borderC }]}>
            <IndexBadge index={String(i + 1).padStart(2, "0")} grad={grad} />
            <Text style={[styles.tipBody, { color: muted }]}>{step}</Text>
          </View>
        ))}
      </View>
    );
  }
  if (item.detail) {
    return (
      <View style={styles.sectionBlock}>
        <Text style={[styles.sectionLabel, { color: tertiary }]}>GUIDANCE</Text>
        <Text style={[styles.recoveryModalBody, { color: muted }]}>{item.detail}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.rcvEmptyGuidance, { borderColor: borderC }]}>
      <Text style={[styles.rcvEmptyText, { color: tertiary }]}>
        Focus on {meta.type.toLowerCase()} and listen to your body.
      </Text>
    </View>
  );
}

function RecoveryFocusModal({ visible, day, items, segmentIndex, onClose, onChangeIndex, isDark, grad }) {
  const scrollBottomPad = useModalScrollBottomPad(40);
  const item = segmentIndex != null ? items[segmentIndex] : null;
  const hasPrev = segmentIndex > 0;
  const hasNext = segmentIndex < items.length - 1;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const muted = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const innerBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const displayName = day ? recoveryDayDisplayName(day) : "";
  const meta = item ? parseRecoveryMeta(item.label) : {};
  const steps = item ? splitDetailIntoSteps(item.detail) : [];

  if (!visible || item == null || !day) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? TOKENS.bgDark : TOKENS.bgLight,
              maxHeight: Dimensions.get("window").height * SHEET_HEIGHT_RATIO,
            },
          ]}
        >
          <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetStripe} />
          <View style={styles.sheetHero}>
            <View style={styles.sheetTopRow}>
              <TouchableOpacity onPress={onClose} style={[styles.sheetIconBtn, { backgroundColor: isDark ? TOKENS.rowDark : TOKENS.rowLight }]}>
                <Ionicons name="close" size={20} color={text} />
              </TouchableOpacity>
              <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.sheetCounterGrad}>
                <Text style={styles.sheetCounterText}>
                  {String(segmentIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                </Text>
              </LinearGradient>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.sheetKicker, { color: tertiary }]}>
              {day.short} · Rest · {displayName}
            </Text>
            <Text style={[styles.sheetTitle, { color: text }]}>{item.label}</Text>
          </View>

          <ScrollView
            contentContainerStyle={[styles.sheetBody, { paddingBottom: scrollBottomPad }]}
            {...FORM_SCROLL_PROPS}
          >
            <View style={styles.statRow}>
              <View style={[styles.statBox, { backgroundColor: isDark ? TOKENS.rowDark : TOKENS.rowLight, borderColor: borderC }]}>
                <Text style={[styles.statLabel, { color: tertiary }]}>TYPE</Text>
                <Text style={[styles.statValue, { color: text, fontSize: 15 }]}>{meta.type}</Text>
              </View>
              {meta.duration && (
                <View style={[styles.statBox, { backgroundColor: isDark ? TOKENS.rowDark : TOKENS.rowLight, borderColor: borderC }]}>
                  <Text style={[styles.statLabel, { color: tertiary }]}>DURATION</Text>
                  <Text style={[styles.statValue, { color: text, fontSize: 15 }]}>{meta.duration}</Text>
                </View>
              )}
              <View style={[styles.statBox, { backgroundColor: isDark ? TOKENS.rowDark : TOKENS.rowLight, borderColor: borderC }]}>
                <Text style={[styles.statLabel, { color: tertiary }]}>FOCUS</Text>
                <Text style={[styles.statValue, { color: text, fontSize: 15 }]}>{meta.focus}</Text>
              </View>
            </View>

            <RecoveryGuidance
              steps={steps}
              item={item}
              meta={meta}
              tertiary={tertiary}
              muted={muted}
              borderC={borderC}
              grad={grad}
              isDark={isDark}
            />

            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => hasPrev && onChangeIndex(segmentIndex - 1)}
                disabled={!hasPrev}
                style={[styles.navBtnOutline, { borderColor: borderC, backgroundColor: innerBg, opacity: hasPrev ? 1 : 0.35 }]}
              >
                <Ionicons name="chevron-back" size={18} color={muted} />
                <Text style={[styles.navBtnText, { color: muted }]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => hasNext && onChangeIndex(segmentIndex + 1)} disabled={!hasNext} style={{ flex: 1, opacity: hasNext ? 1 : 0.35 }}>
                <LinearGradient colors={CTA_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.navBtnPrimary}>
                  <Text style={styles.navBtnPrimaryText}>Next</Text>
                  <Ionicons name="chevron-forward" size={18} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function MyWorkoutPlanLayout({
  isDark,
  openDay,
  openDayIndex,
  onBackFromDay,
  setExerciseModal,
  exerciseModal,
  openRecoveryDay,
  recoveryItems,
  onBackFromRecovery,
  setRecoveryModalIndex,
  recoveryGrad,
  recoveryModalIndex,
  handleRootBack,
  scrollBottomPad,
  heroTitle,
  weeksRemaining,
  focusSummary,
  overview,
  workoutDays,
  setOpenDay,
  setOpenDayIndex,
  setOpenRecoveryDay,
  setOpenRecoveryIndex,
  restDays,
}) {
  const pageBackground = isDark ? TOKENS.bgDark : TOKENS.bgLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const backChevronColor = isDark ? TOKENS.pink : '#BE185D';
  const hasOverview = overview.trim().length > 0;
  const hasWorkoutDays = workoutDays.length > 0;
  const hasRecoveryDays = restDays.length > 0;

  if (openDay) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBackground }}>
        <DayDetailScreen day={openDay} dayIndex={openDayIndex} onBack={onBackFromDay} onOpenExercise={(idx) => setExerciseModal(idx)} isDark={isDark} />
        <ExerciseDetailModal
          visible={exerciseModal != null}
          day={openDay}
          exerciseIndex={exerciseModal}
          onClose={() => setExerciseModal(null)}
          onChangeIndex={setExerciseModal}
          isDark={isDark}
        />
      </View>
    );
  }

  if (openRecoveryDay) {
    return (
      <View style={{ flex: 1, backgroundColor: pageBackground }}>
        <RecoveryDayDetailScreen
          day={openRecoveryDay}
          items={recoveryItems}
          onBack={onBackFromRecovery}
          onOpenSegment={(idx) => setRecoveryModalIndex(idx)}
          isDark={isDark}
          grad={recoveryGrad}
        />
        <RecoveryFocusModal
          visible={recoveryModalIndex != null}
          day={openRecoveryDay}
          items={recoveryItems}
          segmentIndex={recoveryModalIndex}
          onClose={() => setRecoveryModalIndex(null)}
          onChangeIndex={setRecoveryModalIndex}
          isDark={isDark}
          grad={recoveryGrad}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: pageBackground }]}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 }}>
        <TouchableOpacity
          onPress={handleRootBack}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 4,
            paddingVertical: 8,
            paddingRight: 12,
          }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={backChevronColor} />
          <Text style={{ color: backChevronColor, fontWeight: "700", fontSize: 16 }}>Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        <PlanSummaryCard title={heroTitle} weeksRemaining={weeksRemaining} focus={focusSummary} isDark={isDark} />

        {hasOverview && (
          <View style={styles.overviewBlock}>
            <SectionHead label="Overview" isDark={isDark} />
            <Text style={[styles.overviewBody, { color: text }]}>{overview.trim()}</Text>
          </View>
        )}

        {hasWorkoutDays && (
          <View style={styles.trainSection}>
            <SectionHead label="Training days" isDark={isDark} />
            <View style={{ gap: 14 }}>
              {workoutDays.map((day, idx) => (
                <TrainingDayCard
                  key={`${day.short}-${idx}`}
                  day={day}
                  dayIndex={idx}
                  isDark={isDark}
                  onPress={() => {
                    setOpenDay(day);
                    setOpenDayIndex(idx);
                    setOpenRecoveryDay(null);
                    setOpenRecoveryIndex(null);
                    setRecoveryModalIndex(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {hasRecoveryDays && (
          <View style={styles.trainSection}>
            <SectionHead label="Recovery days" isDark={isDark} />
            <View style={{ gap: 14 }}>
              {restDays.map((day, idx) => (
                <RecoveryDayCard
                  key={`${day.short}-${idx}`}
                  day={day}
                  isDark={isDark}
                  grad={getDayRimGradient(day, idx)}
                  onPress={() => {
                    setOpenRecoveryDay(day);
                    setOpenRecoveryIndex(idx);
                    setOpenDay(null);
                    setExerciseModal(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Weekly plan: summary card, training days, recovery days, then day/exercise sheets.
 * @param {object} props
 * @param {object} [props.route]
 * @param {object} [props.navigation]
 * @param {Function} [props.onBack]
 */
export default function MyWorkoutPlanScreen({ route, navigation, onBack }) {
  const shellBottomPad = useShellBottomNavInset(SHELL_BOTTOM_INSET);
  const reserveShellBottomNav = route?.params?.reserveShellBottomNav === true;
  const modalScrollBottomPad = useModalScrollBottomPad(MODAL_SCROLL_PAD);
  const scrollBottomPad = reserveShellBottomNav ? shellBottomPad : modalScrollBottomPad;
  const colorScheme = useColorScheme();
  const systemIsDark = colorScheme === "dark";
  const isDarkOverride = route?.params?.isDarkOverride;
  const isDark = typeof isDarkOverride === "boolean" ? isDarkOverride : systemIsDark;

  const handleRootBack = useCallback(() => {
    // 1. Explicit onBack prop wins.
    if (typeof onBack === "function") {
      onBack();
      return;
    }
    // 2. Then the route param (stack screens pass it that way).
    if (typeof route?.params?.onBack === "function") {
      route.params.onBack();
      return;
    }
    // 3. Last, the navigator itself.
    if (navigation?.canGoBack?.()) navigation.goBack();
  }, [onBack, route?.params, navigation]);

  const subViewBackRef = route?.params?.subViewBackRef;
  const onSubViewActiveChange = route?.params?.onSubViewActiveChange;

  const workoutPlan = route?.params?.workoutPlan || [];
  const overview = route?.params?.overview ? String(route.params.overview) : "";
  const weeksRemaining = route?.params?.weeksRemaining ?? DEFAULT_WEEKS_REMAINING;
  const focusSummary =
    route?.params?.focusSummary != null ? String(route.params.focusSummary) : DEFAULT_FOCUS_SUMMARY;
  const heroTitle = route?.params?.planHeroTitle != null ? String(route.params.planHeroTitle) : DEFAULT_HERO_TITLE;

  const { workoutDays, restDays } = useMemo(
    () => ({
      workoutDays: workoutPlan.filter((d) => !d.rest),
      restDays: workoutPlan.filter((d) => d.rest),
    }),
    [workoutPlan],
  );

  const [openDay, setOpenDay] = useState(null);
  const [openDayIndex, setOpenDayIndex] = useState(0);
  const [exerciseModal, setExerciseModal] = useState(null);
  const [openRecoveryDay, setOpenRecoveryDay] = useState(null);
  const [openRecoveryIndex, setOpenRecoveryIndex] = useState(null);
  const [recoveryModalIndex, setRecoveryModalIndex] = useState(null);

  const recoveryGrad = useMemo(
    () => getDayRimGradient(openRecoveryDay, openRecoveryIndex ?? 0),
    [openRecoveryDay, openRecoveryIndex],
  );

  const recoveryItems = useMemo(() => {
    if (!openRecoveryDay) return [];
    return toRecoveryItems(openRecoveryDay);
  }, [openRecoveryDay]);

  const onBackFromDay = useCallback(() => {
    setOpenDay(null);
    setExerciseModal(null);
  }, []);

  const onBackFromRecovery = useCallback(() => {
    setOpenRecoveryDay(null);
    setOpenRecoveryIndex(null);
    setRecoveryModalIndex(null);
  }, []);

  const inSubView = !!(openDay || openRecoveryDay);

  useEffect(() => {
    onSubViewActiveChange?.(inSubView);
  }, [inSubView, onSubViewActiveChange]);

  useEffect(() => {
    if (!subViewBackRef) return undefined;
    subViewBackRef.current = () => {
      if (openDay) {
        onBackFromDay();
        return true;
      }
      if (openRecoveryDay) {
        onBackFromRecovery();
        return true;
      }
      return false;
    };
    return () => {
      subViewBackRef.current = null;
    };
  }, [openDay, openRecoveryDay, onBackFromDay, onBackFromRecovery, subViewBackRef]);

  return (
    <MyWorkoutPlanLayout
      isDark={isDark}
      openDay={openDay}
      openDayIndex={openDayIndex}
      onBackFromDay={onBackFromDay}
      setExerciseModal={setExerciseModal}
      exerciseModal={exerciseModal}
      openRecoveryDay={openRecoveryDay}
      recoveryItems={recoveryItems}
      onBackFromRecovery={onBackFromRecovery}
      setRecoveryModalIndex={setRecoveryModalIndex}
      recoveryGrad={recoveryGrad}
      recoveryModalIndex={recoveryModalIndex}
      handleRootBack={handleRootBack}
      scrollBottomPad={scrollBottomPad}
      heroTitle={heroTitle}
      weeksRemaining={weeksRemaining}
      focusSummary={focusSummary}
      overview={overview}
      workoutDays={workoutDays}
      setOpenDay={setOpenDay}
      setOpenDayIndex={setOpenDayIndex}
      setOpenRecoveryDay={setOpenRecoveryDay}
      setOpenRecoveryIndex={setOpenRecoveryIndex}
      restDays={restDays}
    />
  );
}


const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  topStripe: { height: 2, width: "100%", opacity: 0.92 },
  summaryInner: { padding: 18, paddingTop: 14 },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 16,
    letterSpacing: -0.4,
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  summaryBoxLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.4 },
  summaryBoxValue: {
    fontSize: 28,
    fontWeight: "900",
    marginTop: 6,
    letterSpacing: -0.5,
  },
  summaryBoxFocus: { fontSize: 13, marginTop: 6, lineHeight: 18, fontWeight: "600" },
  sectionHeadRow: { marginBottom: 12 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sectionLine: { height: 2, borderRadius: 1, width: 48 },
  overviewBlock: { marginTop: 22 },
  overviewBody: { fontSize: 15, lineHeight: 23, fontWeight: "500" },
  trainSection: { marginTop: 24 },
  dayCardInner: { padding: 16, paddingTop: 14 },
  trainHeaderRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  dayShortGrad: {
    minWidth: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  dayShortText: { fontSize: 11, fontWeight: "900", color: "#FFFFFF", letterSpacing: 0.6 },
  trainTitles: { flex: 1, minWidth: 0 },
  trainTitle: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
  trainSubtitle: { fontSize: 12, marginTop: 3, fontWeight: "600", lineHeight: 17 },
  trainPreview: { gap: 8 },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  previewTitle: { fontSize: 14, fontWeight: "700" },
  previewMeta: { fontSize: 11, marginTop: 2, fontWeight: "600" },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  indexBadgeText: { fontSize: 11, fontWeight: "900", color: "#FFFFFF" },
  trainMoreText: {
    fontSize: 11,
    letterSpacing: 0.2,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  subHeader: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  subBackPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingRight: 10,
    marginBottom: 12,
  },
  subBackText: { fontSize: 14, fontWeight: "700" },
  subTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  subTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.3 },
  subSubtitle: { fontSize: 13, marginTop: 3, fontWeight: "600", lineHeight: 18 },
  detailRoot: { flex: 1 },
  detailScroll: { paddingHorizontal: 16, paddingTop: 8 },
  detailCount: { fontSize: 22, fontWeight: "900", letterSpacing: -0.3 },
  detailHint: { fontSize: 13, marginTop: 6, fontWeight: "600" },
  listRowInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.72)" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  sheetStripe: { height: 3, width: "100%" },
  sheetHero: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  sheetTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sheetIconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  sheetCounterGrad: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  sheetCounterText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.6 },
  sheetKicker: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 6, textTransform: "uppercase" },
  sheetTitle: { fontSize: 24, fontWeight: "900", lineHeight: 30, letterSpacing: -0.4 },
  sheetBody: { paddingHorizontal: 20, paddingTop: 4, gap: 20 },
  statRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    alignItems: "center",
  },
  statLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: "900" },
  sectionBlock: { gap: 10 },
  sectionLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetPill: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  targetPillText: { fontSize: 12, fontWeight: "600" },
  tipRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tipBody: { flex: 1, fontSize: 14, lineHeight: 22, fontWeight: "500" },
  navRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  navBtnOutline: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navBtnText: { fontSize: 14, fontWeight: "700" },
  navBtnPrimary: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navBtnPrimaryText: { fontSize: 14, fontWeight: "800", color: "#FFFFFF" },
  recoveryModalBody: { fontSize: 15, lineHeight: 24, fontWeight: "500" },
  rcvEmptyGuidance: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rcvEmptyText: { fontSize: 14, fontWeight: "600", textAlign: "center", lineHeight: 20 },
});
