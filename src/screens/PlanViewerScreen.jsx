/**
 * Plan Viewer Screen
 *
 * Purpose: UI screen or component: Plan Viewer Screen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/screens
 * Key exports: PlanViewerScreen
 *
 * @file-header
 */
import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  Platform,
  Modal,
  Pressable,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const SERIF = Platform.select({ ios: "Georgia", android: "serif", default: "serif" });

const CTA_GRAD = ["#BE185D", "#C2410C"];

const TOKENS = {
  pink: "#FF6B9D",
  cyan: "#06B6D4",
  orange: "#F97316",
  bgDark: "#0A0A0F",
  bgLight: "#F2F2F7",
  cardDark: "rgba(255,255,255,0.045)",
  cardLight: "#FFFFFF",
  borderDark: "rgba(255,255,255,0.08)",
  borderLight: "rgba(10,10,15,0.07)",
  textDark: "#FFFFFF",
  textLight: "#0A0A0F",
  mutedDark: "rgba(255,255,255,0.62)",
  mutedLight: "rgba(10,10,15,0.58)",
  tertiaryDark: "rgba(255,255,255,0.42)",
  tertiaryLight: "rgba(10,10,15,0.42)",
};

const FOCUS_KEYS = {
  pink: { badge: "#FF6B9D", tint: "rgba(255,107,157,0.12)" },
  purple: { badge: "#FF6B9D", tint: "rgba(255,107,157,0.12)" },
  cyan: { badge: "#06B6D4", tint: "rgba(6,182,212,0.12)" },
  orange: { badge: "#F97316", tint: "rgba(249,115,22,0.12)" },
  green: { badge: "#10B981", tint: "rgba(16,185,129,0.12)" },
  gray: { badge: "#94A3B8", tint: "rgba(148,163,184,0.12)" },
};

/** Normalize API `focusColor` (hex or palette key) to accent tokens. */
function resolveAccent(focusColor) {
  if (focusColor && FOCUS_KEYS[focusColor]) return FOCUS_KEYS[focusColor];
  const u = String(focusColor || "").toUpperCase();
  if (u.includes("F97316")) return FOCUS_KEYS.orange;
  if (u.includes("64D2FF") || u.includes("06B6D4") || u.includes("22D3EE")) return FOCUS_KEYS.cyan;
  if (u.includes("FF6B9D")) return FOCUS_KEYS.pink;
  if (u.includes("10B981")) return FOCUS_KEYS.green;
  if (u.includes("C084FC")) return FOCUS_KEYS.purple;
  return FOCUS_KEYS.pink;
}

function sessionTitleLines(day) {
  const rawDay = String(day.day || "").trim();
  const focus = String(day.focus || "").trim();
  const sep = rawDay.includes("—") ? "—" : rawDay.includes("–") ? "–" : null;
  if (sep) {
    const parts = rawDay.split(sep).map((s) => s.trim()).filter(Boolean);
    return { title: parts[0] || rawDay, subtitle: parts.slice(1).join(" · ") || focus };
  }
  const bits = focus.split(/\s*·\s*/).map((s) => s.trim()).filter(Boolean);
  if (bits.length >= 2) {
    return { title: bits[0], subtitle: bits.slice(1).join(" · ") };
  }
  return { title: rawDay || "Training", subtitle: focus };
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
  let r = rest;
  if (!/s$/i.test(r) && !/min/i.test(r) && /^\d+(\.\d+)?$/.test(r)) r = `${r}s`;
  const tail = /\brest\b/i.test(r) ? r : `${r} rest`;
  return `${mid} · ${tail}`;
}

function splitTips(text) {
  const t = String(text || "").trim();
  if (!t) return [];
  const parts = t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

/** Legacy recovery note splitter for old plans without recoveryActivities. */
function splitLegacyNote(raw) {
  const lines = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const byArrow = raw.split(/\s*(?:→|➝|->)\s*/).map((s) => s.trim()).filter(Boolean);
  if (byArrow.length > 1) return byArrow;
  const sentences = splitTips(raw);
  return sentences.length ? sentences : [raw];
}

function toRecoveryItems(day) {
  if (Array.isArray(day?.recoveryActivities) && day.recoveryActivities.length > 0) {
    return day.recoveryActivities
      .filter((a) => a && typeof a === "object" && typeof a.label === "string" && a.label.trim())
      .map((a) => ({ label: extractShortLabel(a.label), detail: String(a.detail || "").trim() }));
  }
  const raw = String(day?.recoveryNote || day?.focus || "").trim();
  if (!raw) return [{ label: "Light movement & rest", detail: "" }];
  return splitLegacyNote(raw).map((seg) => ({
    label: extractShortLabel(seg),
    detail: seg.trim(),
  }));
}

function extractShortLabel(seg) {
  let s = String(seg || "").trim().replace(/\s+/g, " ");
  if (!s) return "Recovery focus";

  s = s.replace(/^[-–—•*]\s*/, "").replace(/\.\s*$/, "");

  s = s
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

  s = s.charAt(0).toUpperCase() + s.slice(1);

  const cutPoints = /\s+(?:—|--|to\s+(?:promote|reduce|help|improve|support|aid|maintain|prevent|enhance|avoid|ensure|allow|boost|keep|build|maximize|minimize|flush|speed|accelerate))\b|\s+(?:outdoors|indoors|especially|throughout|tonight|today|this\s+week|for\s+the\s+(?:next|rest|week|upcoming)|focus(?:ing)?\s+on|targeting|this\s+helps|which\s+helps|helps\s|if\s+you|and\s+dr)|\s*[;:]\s*/i;
  const beforeCut = s.split(cutPoints)[0].trim();
  if (beforeCut && beforeCut.length >= 8) s = beforeCut;

  const words = s.split(/\s+/);
  if (words.length > 6) s = words.slice(0, 6).join(" ");

  if (s.length > 44) s = s.slice(0, 41).replace(/\s+\S*$/, "");

  return s || "Recovery focus";
}

function recoveryDayDisplayName(day) {
  return String(day?.day || "")
    .replace(/^\?\s*/, "")
    .trim() || String(day?.short || "Rest");
}


/** Rotate accents for recovery days — pink / orange / cyan only. */
const RECOVERY_ACCENTS = [
  { badge: "#FF6B9D", tint: "rgba(255,107,157,0.12)" },
  { badge: "#F97316", tint: "rgba(249,115,22,0.12)" },
  { badge: "#06B6D4", tint: "rgba(6,182,212,0.12)" },
];

function getRecoveryAccent(index) {
  return RECOVERY_ACCENTS[Math.abs(Number(index) || 0) % RECOVERY_ACCENTS.length];
}

function muscleToTargets(muscle) {
  if (!muscle) return [];
  return String(muscle)
    .split(/[,/|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function PlanSummaryCard({ title, weeksRemaining, focus, isDark = true }) {
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const textPrimary = isDark ? TOKENS.textDark : TOKENS.textLight;
  const textMuted = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const textSecondary = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const boxBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";

  return (
    <View style={[styles.summaryPanel, { backgroundColor: cardBg, borderColor: borderC }]}>
      <Text style={[styles.summaryLabel, { color: textMuted }]}>Plan summary</Text>
      <Text style={[styles.summaryTitle, { color: textPrimary }]}>{title}</Text>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryBox, { backgroundColor: boxBg, borderColor: borderC }]}>
          <Text style={[styles.summaryBoxLabel, { color: textMuted }]}>Weeks left</Text>
          <Text style={[styles.summaryBoxValueSerif, { color: textPrimary }]}>{weeksRemaining}</Text>
        </View>
        <View style={[styles.summaryBox, { flex: 2, backgroundColor: boxBg, borderColor: borderC }]}>
          <Text style={[styles.summaryBoxLabel, { color: textMuted }]}>Focus</Text>
          <Text style={[styles.summaryBoxFocus, { color: textSecondary }]}>{focus}</Text>
        </View>
      </View>
    </View>
  );
}

function TrainingDayCard({ day, onPress, isDark }) {
  const accent = resolveAccent(day.focusColor);
  const { title, subtitle } = sessionTitleLines(day);
  const preview = (day.exercises || []).slice(0, 3);
  const remaining = (day.exercises || []).length - preview.length;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      style={[styles.dayCard, { backgroundColor: cardBg, borderColor: borderC }]}
    >
      <View style={styles.trainHeaderRow}>
        <View style={styles.trainHeaderLeft}>
          <View style={[styles.dayPill, { backgroundColor: accent.tint, borderColor: `${accent.badge}44` }]}>
            <Text style={[styles.dayPillText, { color: accent.badge }]}>{day.short}</Text>
          </View>
          <View style={styles.trainTitles}>
            <Text style={[styles.trainTitle, { color: text }]}>{title}</Text>
            {!!subtitle && (
              <Text style={[styles.trainSubtitle, { color: tertiary }]} numberOfLines={2}>
                {subtitle}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tertiary} />
      </View>

      <View style={styles.trainPreview}>
        {preview.map((ex, i) => (
          <View key={`${ex.name}-${i}`} style={styles.trainExRow}>
            <Text style={[styles.trainExIdx, { color: accent.badge }]}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trainExName, { color: text }]}>{ex.name}</Text>
              <Text style={[styles.trainExMeta, { color: tertiary }]}>{formatExerciseMeta(ex)}</Text>
            </View>
          </View>
        ))}
      </View>
      {remaining > 0 && (
        <View style={[styles.trainMoreRow, { borderTopColor: borderC }]}>
          <Text style={[styles.trainMoreText, { color: tertiary }]}>
            + {remaining} more {remaining === 1 ? "exercise" : "exercises"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function DayDetailScreen({ day, onBack, onOpenExercise, isDark }) {
  const accent = resolveAccent(day.focusColor);
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const headerSubtitle = [day.day, day.focus].filter(Boolean).join(" — ") || day.focus;

  return (
    <View style={[styles.detailRoot, { backgroundColor: isDark ? TOKENS.bgDark : TOKENS.bgLight }]}>
      <View style={[styles.detailHeader, { borderBottomColor: borderC }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconHit} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <View style={[styles.detailBadge, { backgroundColor: accent.tint, borderColor: `${accent.badge}44` }]}>
          <Text style={[styles.dayPillText, { color: accent.badge }]}>{day.short}</Text>
        </View>
        <Text style={[styles.detailHeaderTitle, { color: isDark ? TOKENS.mutedDark : TOKENS.mutedLight }]} numberOfLines={1}>
          {headerSubtitle}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.detailScroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.detailCount, { color: text }]}>
          {(day.exercises || []).length} exercises
        </Text>
        <Text style={[styles.detailHint, { color: tertiary }]}>Tap any exercise for full details.</Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          {(day.exercises || []).map((ex, i) => (
            <TouchableOpacity
              key={`${ex.name}-${i}`}
              activeOpacity={0.75}
              onPress={() => onOpenExercise(i)}
              style={[styles.detailExCard, { backgroundColor: cardBg, borderColor: borderC }]}
            >
              <Text style={[styles.trainExIdx, { color: tertiary, width: 22 }]}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trainExName, { color: text }]}>{ex.name}</Text>
                <Text style={[styles.trainExMeta, { color: tertiary }]}>{formatExerciseMeta(ex)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={tertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ExerciseDetailModal({ visible, day, exerciseIndex, onClose, onChangeIndex, isDark }) {
  const exercises = day?.exercises || [];
  const ex = exerciseIndex != null ? exercises[exerciseIndex] : null;
  const accent = resolveAccent(day?.focusColor);
  const { title: sessionName } = day ? sessionTitleLines(day) : { title: "" };
  const { sets, reps, rest } = ex ? parseSetsRepsRest(ex) : { sets: "—", reps: "—", rest: "—" };
  const tips = ex ? splitTips(ex.notes) : [];
  const targets = ex ? muscleToTargets(ex.muscle) : [];
  const hasPrev = exerciseIndex > 0;
  const hasNext = exerciseIndex < exercises.length - 1;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const muted = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
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
              maxHeight: Dimensions.get("window").height * 0.92,
            },
          ]}
        >
          <View style={[styles.sheetHero, { borderBottomColor: borderC }]}>
            <View style={styles.sheetTopRow}>
              <TouchableOpacity onPress={onClose} style={[styles.sheetBackBtn, { backgroundColor: cardBg }]}>
                <Ionicons name="arrow-back" size={20} color={text} />
              </TouchableOpacity>
              <View style={[styles.sheetCounter, { borderColor: `${accent.badge}44`, backgroundColor: accent.tint }]}>
                <Text style={[styles.sheetCounterText, { color: accent.badge }]}>
                  {String(exerciseIndex + 1).padStart(2, "0")} / {String(exercises.length).padStart(2, "0")}
                </Text>
              </View>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.sheetKicker, { color: tertiary }]}>
              {day.short} · {sessionName}
            </Text>
            <Text style={[styles.sheetTitle, { color: text }]}>{ex.name}</Text>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetBody}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.statRow}>
              <View style={[styles.statBox, { borderColor: isDark ? "rgba(255,255,255,0.08)" : borderC }]}>
                <Text style={[styles.statLabel, { color: tertiary }]}>SETS</Text>
                <Text style={[styles.statValue, { color: text }]}>{sets}</Text>
              </View>
              <View style={[styles.statBox, { borderColor: isDark ? "rgba(255,255,255,0.08)" : borderC }]}>
                <Text style={[styles.statLabel, { color: tertiary }]}>REPS</Text>
                <Text style={[styles.statValue, { color: text }]}>{reps}</Text>
              </View>
              <View style={[styles.statBox, { borderColor: isDark ? "rgba(255,255,255,0.08)" : borderC }]}>
                <Text style={[styles.statLabel, { color: tertiary }]}>REST</Text>
                <Text style={[styles.statValue, { color: text }]}>{rest}</Text>
              </View>
            </View>

            {targets.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: tertiary }]}>TARGETS</Text>
                <View style={styles.pillWrap}>
                  {targets.map((t) => (
                    <View
                      key={t}
                      style={[
                        styles.targetPill,
                        { borderColor: isDark ? "rgba(255,255,255,0.1)" : borderC, backgroundColor: cardBg },
                      ]}
                    >
                      <Text style={[styles.targetPillText, { color: muted }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {tips.length > 0 && (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: tertiary }]}>TIPS</Text>
                {tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={[styles.tipIdx, { color: accent.badge }]}>{String(i + 1).padStart(2, "0")}</Text>
                    <Text style={[styles.tipBody, { color: muted }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => hasPrev && onChangeIndex(exerciseIndex - 1)}
                disabled={!hasPrev}
                style={[
                  styles.navBtnOutline,
                  { borderColor: borderC, backgroundColor: cardBg, opacity: hasPrev ? 1 : 0.35 },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={muted} />
                <Text style={[styles.navBtnText, { color: muted }]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => hasNext && onChangeIndex(exerciseIndex + 1)}
                disabled={!hasNext}
                style={{ flex: 1, opacity: hasNext ? 1 : 0.35 }}
              >
                <LinearGradient
                  colors={CTA_GRAD}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.navBtnPrimary}
                >
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

function RecoveryDayCard({ day, onPress, isDark, accent }) {
  const items = toRecoveryItems(day);
  const preview = items.slice(0, 3);
  const remaining = items.length - preview.length;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const displayName = recoveryDayDisplayName(day);

  return (
    <TouchableOpacity
      activeOpacity={0.78}
      onPress={onPress}
      style={[styles.dayCard, { backgroundColor: cardBg, borderColor: borderC }]}
    >
      <View style={styles.trainHeaderRow}>
        <View style={styles.trainHeaderLeft}>
          <View style={[styles.dayPill, { backgroundColor: accent.tint, borderColor: `${accent.badge}44` }]}>
            <Text style={[styles.dayPillText, { color: accent.badge }]}>{day.short}</Text>
          </View>
          <View style={styles.trainTitles}>
            <Text style={[styles.trainTitle, { color: text }]}>Rest & Recovery</Text>
            <Text style={[styles.trainSubtitle, { color: tertiary }]} numberOfLines={2}>
              {displayName}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={16} color={tertiary} />
      </View>

      <View style={styles.trainPreview}>
        {preview.map((item, i) => (
          <View key={`${i}-${item.label.slice(0, 12)}`} style={styles.trainExRow}>
            <Text style={[styles.trainExIdx, { color: accent.badge }]}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trainExName, { color: text }]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
      {remaining > 0 && (
        <View style={[styles.trainMoreRow, { borderTopColor: borderC }]}>
          <Text style={[styles.trainMoreText, { color: tertiary }]}>
            + {remaining} more {remaining === 1 ? "focus" : "focus areas"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function RecoveryDayDetailScreen({ day, items, onBack, onOpenSegment, isDark, accent }) {
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const displayName = recoveryDayDisplayName(day);
  const headerSubtitle = ["Rest & Recovery", displayName].filter(Boolean).join(" — ");

  return (
    <View style={[styles.detailRoot, { backgroundColor: isDark ? TOKENS.bgDark : TOKENS.bgLight }]}>
      <View style={[styles.detailHeader, { borderBottomColor: borderC }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconHit} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={text} />
        </TouchableOpacity>
        <View style={[styles.detailBadge, { backgroundColor: accent.tint, borderColor: `${accent.badge}44` }]}>
          <Text style={[styles.dayPillText, { color: accent.badge }]}>{day.short}</Text>
        </View>
        <Text style={[styles.detailHeaderTitle, { color: isDark ? TOKENS.mutedDark : TOKENS.mutedLight }]} numberOfLines={1}>
          {headerSubtitle}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.detailCount, { color: text }]}>{items.length} recovery focus areas</Text>
        <Text style={[styles.detailHint, { color: tertiary }]}>Tap any item for full guidance.</Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          {items.map((item, i) => (
            <TouchableOpacity
              key={`${i}-${item.label.slice(0, 16)}`}
              activeOpacity={0.72}
              onPress={() => onOpenSegment(i)}
              style={[styles.detailExCard, { backgroundColor: cardBg, borderColor: borderC }]}
            >
              <Text style={[styles.trainExIdx, { color: accent.badge, width: 24 }]}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trainExName, { color: text }]} numberOfLines={1}>{item.label}</Text>
                {!!item.detail && (
                  <Text style={[styles.rcvDetailPreview, { color: tertiary }]} numberOfLines={1}>
                    {item.detail}
                  </Text>
                )}
              </View>
              <Ionicons name="chevron-forward" size={16} color={tertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function parseRecoveryMeta(label) {
  const l = String(label).toLowerCase();
  const durMatch = l.match(/(\d[\d–\-]*\s*(?:min(?:ute)?s?|hours?|hr))/i);
  const duration = durMatch ? durMatch[1] : null;
  let type = "Activity";
  if (/walk|cardio|jog|run|hike/i.test(l)) type = "Walking";
  else if (/yoga/i.test(l)) type = "Yoga";
  else if (/stretch|mobil|flex/i.test(l)) type = "Stretching";
  else if (/foam\s*roll/i.test(l)) type = "Foam Roll";
  else if (/sleep|rest|nap/i.test(l)) type = "Sleep";
  else if (/water|hydra|drink/i.test(l)) type = "Hydration";
  else if (/nutri|meal|eat|food|prep/i.test(l)) type = "Nutrition";
  else if (/breath|meditat|mindful/i.test(l)) type = "Mindfulness";
  let focus = "Recovery";
  if (/muscle|sore|blood\s*flow|circulation/i.test(l)) focus = "Muscle recovery";
  else if (/stress|mental|mind/i.test(l)) focus = "Mental health";
  else if (/sleep|energy/i.test(l)) focus = "Energy";
  else if (/mobil|flex/i.test(l)) focus = "Mobility";
  return { duration, type, focus };
}

function splitDetailIntoSteps(detail) {
  if (!detail) return [];
  const sentences = detail.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 8);
  return sentences;
}

function RecoveryFocusModal({ visible, day, items, segmentIndex, onClose, onChangeIndex, isDark, accent }) {
  const item = segmentIndex != null ? items[segmentIndex] : null;
  const hasPrev = segmentIndex > 0;
  const hasNext = segmentIndex < items.length - 1;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const muted = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
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
              maxHeight: Dimensions.get("window").height * 0.92,
            },
          ]}
        >
          <View style={[styles.sheetHero, { borderBottomColor: borderC }]}>
            <View style={styles.sheetTopRow}>
              <TouchableOpacity onPress={onClose} style={[styles.sheetBackBtn, { backgroundColor: cardBg }]}>
                <Ionicons name="arrow-back" size={20} color={text} />
              </TouchableOpacity>
              <View style={[styles.sheetCounter, { borderColor: `${accent.badge}44`, backgroundColor: accent.tint }]}>
                <Text style={[styles.sheetCounterText, { color: accent.badge }]}>
                  {String(segmentIndex + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
                </Text>
              </View>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.sheetKicker, { color: tertiary }]}>
              {day.short} · Rest · {displayName}
            </Text>
            <Text style={[styles.sheetTitle, { color: text }]}>{item.label}</Text>
          </View>

          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <View style={styles.statRow}>
              <View style={[styles.statBox, { borderColor: isDark ? "rgba(255,255,255,0.08)" : borderC }]}>
                <Text style={[styles.statLabel, { color: tertiary }]}>TYPE</Text>
                <Text style={[styles.statValue, { color: text, fontSize: 16 }]}>{meta.type}</Text>
              </View>
              {meta.duration && (
                <View style={[styles.statBox, { borderColor: isDark ? "rgba(255,255,255,0.08)" : borderC }]}>
                  <Text style={[styles.statLabel, { color: tertiary }]}>DURATION</Text>
                  <Text style={[styles.statValue, { color: text, fontSize: 16 }]}>{meta.duration}</Text>
                </View>
              )}
              <View style={[styles.statBox, { borderColor: isDark ? "rgba(255,255,255,0.08)" : borderC }]}>
                <Text style={[styles.statLabel, { color: tertiary }]}>FOCUS</Text>
                <Text style={[styles.statValue, { color: text, fontSize: 16 }]}>{meta.focus}</Text>
              </View>
            </View>

            {steps.length > 1 ? (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: tertiary }]}>GUIDANCE</Text>
                {steps.map((step, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={[styles.tipIdx, { color: accent.badge }]}>{String(i + 1).padStart(2, "0")}</Text>
                    <Text style={[styles.tipBody, { color: muted }]}>{step}</Text>
                  </View>
                ))}
              </View>
            ) : item.detail ? (
              <View style={styles.sectionBlock}>
                <Text style={[styles.sectionLabel, { color: tertiary }]}>GUIDANCE</Text>
                <Text style={[styles.recoveryModalBody, { color: muted }]}>{item.detail}</Text>
              </View>
            ) : (
              <View style={styles.sectionBlock}>
                <View style={[styles.rcvEmptyGuidance, { borderColor: borderC }]}>
                  <Text style={[styles.rcvEmptyText, { color: tertiary }]}>
                    Focus on {meta.type.toLowerCase()} and listen to your body.
                  </Text>
                </View>
              </View>
            )}

            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => hasPrev && onChangeIndex(segmentIndex - 1)}
                disabled={!hasPrev}
                style={[
                  styles.navBtnOutline,
                  { borderColor: borderC, backgroundColor: cardBg, opacity: hasPrev ? 1 : 0.35 },
                ]}
              >
                <Ionicons name="chevron-back" size={18} color={muted} />
                <Text style={[styles.navBtnText, { color: muted }]}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => hasNext && onChangeIndex(segmentIndex + 1)}
                disabled={!hasNext}
                style={{ flex: 1, opacity: hasNext ? 1 : 0.35 }}
              >
                <LinearGradient
                  colors={CTA_GRAD}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.navBtnPrimary}
                >
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

export default function PlanViewerScreen({ route }) {
  const colorScheme = useColorScheme();
  const systemIsDark = colorScheme === "dark";
  const isDarkOverride = route?.params?.isDarkOverride;
  const isDark = typeof isDarkOverride === "boolean" ? isDarkOverride : systemIsDark;

  const workoutPlan = route?.params?.workoutPlan || [];
  const overview = route?.params?.overview ? String(route.params.overview) : "";
  const weeksRemaining = route?.params?.weeksRemaining ?? 4;
  const focusSummary =
    route?.params?.focusSummary != null
      ? String(route.params.focusSummary)
      : "Complete muscle building program";
  const heroTitle = route?.params?.planHeroTitle != null ? String(route.params.planHeroTitle) : "Your Workout Plan";

  const { workoutDays, restDays } = useMemo(() => {
    return {
      workoutDays: workoutPlan.filter((d) => !d.rest),
      restDays: workoutPlan.filter((d) => d.rest),
    };
  }, [workoutPlan]);

  const [openDay, setOpenDay] = useState(null);
  const [exerciseModal, setExerciseModal] = useState(null);
  const [openRecoveryDay, setOpenRecoveryDay] = useState(null);
  const [openRecoveryIndex, setOpenRecoveryIndex] = useState(null);
  const [recoveryModalIndex, setRecoveryModalIndex] = useState(null);

  const recoveryAccent = useMemo(() => getRecoveryAccent(openRecoveryIndex ?? 0), [openRecoveryIndex]);

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

  const bg = isDark ? TOKENS.bgDark : TOKENS.bgLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;

  if (openDay) {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        <DayDetailScreen
          day={openDay}
          onBack={onBackFromDay}
          onOpenExercise={(idx) => setExerciseModal(idx)}
          isDark={isDark}
        />
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
      <View style={{ flex: 1, backgroundColor: bg }}>
        <RecoveryDayDetailScreen
          day={openRecoveryDay}
          items={recoveryItems}
          onBack={onBackFromRecovery}
          onOpenSegment={(idx) => setRecoveryModalIndex(idx)}
          isDark={isDark}
          accent={recoveryAccent}
        />
        <RecoveryFocusModal
          visible={recoveryModalIndex != null}
          day={openRecoveryDay}
          items={recoveryItems}
          segmentIndex={recoveryModalIndex}
          onClose={() => setRecoveryModalIndex(null)}
          onChangeIndex={setRecoveryModalIndex}
          isDark={isDark}
          accent={recoveryAccent}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <PlanSummaryCard title={heroTitle} weeksRemaining={weeksRemaining} focus={focusSummary} isDark={isDark} />

        {!!overview.trim() && (
          <View style={styles.overviewBlock}>
            <Text style={[styles.sectionHeading, { color: tertiary }]}>Overview</Text>
            <Text style={[styles.overviewBody, { color: text }]}>{overview.trim()}</Text>
          </View>
        )}

        {workoutDays.length > 0 && (
          <View style={styles.trainSection}>
            <Text style={[styles.sectionHeading, { color: tertiary }]}>Training days</Text>
            <View style={{ gap: 16 }}>
              {workoutDays.map((day, idx) => (
                <TrainingDayCard
                  key={`${day.short}-${idx}`}
                  day={day}
                  isDark={isDark}
                  onPress={() => {
                    setOpenDay(day);
                    setOpenRecoveryDay(null);
                    setOpenRecoveryIndex(null);
                    setRecoveryModalIndex(null);
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {restDays.length > 0 && (
          <View style={styles.trainSection}>
            <Text style={[styles.sectionHeading, { color: tertiary }]}>Recovery days</Text>
            <View style={{ gap: 16 }}>
              {restDays.map((day, idx) => (
                <RecoveryDayCard
                  key={`${day.short}-${idx}`}
                  day={day}
                  isDark={isDark}
                  accent={getRecoveryAccent(idx)}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 120, paddingHorizontal: 16, paddingTop: 8 },
  summaryPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  summaryTitle: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  summaryBoxLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  summaryBoxValueSerif: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: "700",
    marginTop: 6,
  },
  summaryBoxFocus: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  overviewBlock: { marginTop: 22 },
  overviewBody: {
    fontSize: 15,
    lineHeight: 23,
    marginTop: 8,
    fontWeight: "400",
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  trainSection: { marginTop: 24 },
  dayCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  trainHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  trainHeaderLeft: { flexDirection: "row", gap: 12, flex: 1 },
  dayPill: {
    minWidth: 44,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  trainTitles: { flex: 1, paddingTop: 2 },
  trainTitle: { fontSize: 16, fontWeight: "700", letterSpacing: -0.2 },
  trainSubtitle: { fontSize: 12, marginTop: 3, fontWeight: "500", lineHeight: 17 },
  trainPreview: { gap: 10 },
  trainExRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  trainExIdx: { fontSize: 12, fontWeight: "800", width: 24, paddingTop: 1 },
  trainExName: { fontSize: 14, fontWeight: "600" },
  trainExMeta: { fontSize: 11, marginTop: 2, fontWeight: "500" },
  trainMoreRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
  },
  trainMoreText: { fontSize: 11, letterSpacing: 0.2, fontWeight: "600" },
  detailRoot: { flex: 1 },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  detailBadge: {
    minWidth: 40,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderTitle: { flex: 1, fontSize: 14, fontWeight: "500" },
  detailScroll: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 },
  detailCount: { fontSize: 22, fontWeight: "700" },
  detailHint: { fontSize: 12, marginTop: 6 },
  detailExCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetHero: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sheetBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCounter: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sheetCounterText: { fontSize: 12, fontWeight: "700", letterSpacing: 1 },
  sheetKicker: { fontSize: 11, letterSpacing: 1, marginBottom: 6 },
  sheetTitle: {
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: "700",
    lineHeight: 32,
  },
  sheetBody: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8, gap: 24 },
  statRow: { flexDirection: "row", gap: 8 },
  statBox: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 12,
    alignItems: "center",
  },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 },
  statValue: { fontFamily: SERIF, fontSize: 20, fontWeight: "700" },
  sectionBlock: { gap: 12 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8 },
  pillWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  targetPill: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  targetPillText: { fontSize: 12, fontWeight: "500" },
  tipRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tipIdx: { fontSize: 14, fontWeight: "800", minWidth: 24 },
  tipBody: { flex: 1, fontSize: 14, lineHeight: 22 },
  navRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  navBtnOutline: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navBtnText: { fontSize: 14, fontWeight: "600" },
  navBtnPrimary: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  navBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  recoveryModalBody: { fontSize: 15, lineHeight: 24 },

  rcvDetailPreview: {
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  },

  rcvEmptyGuidance: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rcvEmptyText: {
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
});
