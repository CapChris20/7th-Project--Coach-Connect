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

const TOKENS = {
  pink: "#FF6B9D",
  cyan: "#06B6D4",
  orange: "#F97316",
  bgDark: "#0A0A0F",
  bgLight: "#F5F5F5",
  cardDark: "rgba(255,255,255,0.04)",
  cardLight: "rgba(0,0,0,0.03)",
  borderDark: "rgba(255,255,255,0.08)",
  borderLight: "rgba(10,10,15,0.08)",
  textDark: "#FFFFFF",
  textLight: "#0A0A0F",
  mutedDark: "rgba(255,255,255,0.6)",
  mutedLight: "rgba(10,10,15,0.58)",
  tertiaryDark: "rgba(255,255,255,0.4)",
  tertiaryLight: "rgba(10,10,15,0.45)",
};

const FOCUS_KEYS = {
  pink: { badge: "#FF6B9D", gradient: ["#FF6B9D", "#C084FC"], rgb: "255, 107, 157" },
  purple: { badge: "#C084FC", gradient: ["#C084FC", "#D4A5FF"], rgb: "192, 132, 252" },
  cyan: { badge: "#06B6D4", gradient: ["#06B6D4", "#22D3EE"], rgb: "6, 182, 212" },
  orange: { badge: "#F97316", gradient: ["#F97316", "#FB923C"], rgb: "249, 115, 22" },
  green: { badge: "#10B981", gradient: ["#10B981", "#34D399"], rgb: "16, 185, 129" },
  gray: { badge: "#9CA3AF", gradient: ["#9CA3AF", "#C5CBD3"], rgb: "156, 163, 175" },
};

function hexToRgbTriple(hex) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return "255, 107, 157";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

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

/** Recovery copy → list items (like “exercises”) for preview + detail + modal. */
function splitRecoverySegments(note) {
  const raw = String(note || "").trim();
  if (!raw) return ["Light movement, hydration, and quality sleep."];
  const lines = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;
  const byArrow = raw.split(/\s*(?:→|➝|->)\s*/).map((s) => s.trim()).filter(Boolean);
  if (byArrow.length > 1) return byArrow;
  const sentences = splitTips(raw);
  return sentences.length ? sentences : [raw];
}

function recoveryDayDisplayName(day) {
  return String(day?.day || "")
    .replace(/^\?\s*/, "")
    .trim() || String(day?.short || "Rest");
}

/** Title line for a recovery segment (card row / modal header). */
function segmentHeadline(seg) {
  const s = String(seg || "").trim().replace(/\s+/g, " ");
  if (!s) return "Recovery focus";
  const beforeArrow = s.split(/\s*(?:→|➝|->)\s*/)[0].trim();
  if (beforeArrow && beforeArrow.length <= 88) return beforeArrow;
  const firstSentence = splitTips(s)[0];
  if (firstSentence && firstSentence.length <= 100) return firstSentence;
  return s.length > 88 ? `${s.slice(0, 85)}…` : s;
}

/** Subline under headline in list rows (optional). */
function segmentSubline(seg) {
  const s = String(seg || "").trim();
  const head = segmentHeadline(seg).replace(/…$/, "");
  if (!s || s.length <= head.length + 8) return "";
  let rest = s.slice(head.length).replace(/^[.\s—\-]+/, "").trim();
  if (!rest) return "";
  return rest.length > 96 ? `${rest.slice(0, 93)}…` : rest;
}

/** Rotate brand accents so recovery days feel as premium as training days (not flat grey). */
const RECOVERY_ACCENTS = [
  { badge: "#FF6B9D", rgb: "255, 107, 157" },
  { badge: "#06B6D4", rgb: "6, 182, 212" },
  { badge: "#F97316", rgb: "249, 115, 22" },
  { badge: "#C084FC", rgb: "192, 132, 252" },
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

function PlanSummaryCard({ title, weeksRemaining, focus }) {
  return (
    <LinearGradient
      colors={["#FF6B9D", "#C084FC"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.summaryGradient}
    >
      <View style={styles.summaryGlow} />
      <Text style={styles.summarySparkle}>✦</Text>
      <Text style={styles.summaryLabel}>PLAN SUMMARY</Text>
      <Text style={styles.summaryTitle}>{title}</Text>
      <View style={styles.summaryRow}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryBoxLabel}>WEEKS LEFT</Text>
          <Text style={styles.summaryBoxValueSerif}>{weeksRemaining}</Text>
        </View>
        <View style={[styles.summaryBox, { flex: 2 }]}>
          <Text style={styles.summaryBoxLabel}>FOCUS</Text>
          <Text style={styles.summaryBoxFocus}>{focus}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function TrainingDayCard({ day, onPress, isDark }) {
  const accent = resolveAccent(day.focusColor);
  const { title, subtitle } = sessionTitleLines(day);
  const preview = (day.exercises || []).slice(0, 3);
  const remaining = (day.exercises || []).length - preview.length;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const muted = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.trainCard, { backgroundColor: cardBg, borderColor: borderC }]}
    >
      <View style={[styles.trainAccent, { backgroundColor: accent.badge }]} />
      <View style={styles.trainHeaderRow}>
        <View style={styles.trainHeaderLeft}>
          <View style={[styles.trainBadge, { backgroundColor: accent.badge }]}>
            <Text style={styles.trainBadgeText}>{day.short}</Text>
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
        <Ionicons name="chevron-down" size={16} color={tertiary} />
      </View>
      <View style={styles.trainPreview}>
        {preview.map((ex, i) => (
          <View key={`${ex.name}-${i}`} style={styles.trainExRow}>
            <Text style={[styles.trainExIdx, { color: tertiary }]}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trainExName, { color: text }]}>{ex.name}</Text>
              <Text style={[styles.trainExMeta, { color: tertiary }]}>{formatExerciseMeta(ex)}</Text>
            </View>
          </View>
        ))}
      </View>
      {remaining > 0 && (
        <View style={[styles.trainMoreRow, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
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
        <View style={[styles.detailBadge, { backgroundColor: accent.badge }]}>
          <Text style={styles.trainBadgeText}>{day.short}</Text>
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
  const rgb = hexToRgbTriple(accent.badge);
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
          <LinearGradient
            colors={[`rgba(${rgb}, 0.22)`, `rgba(${rgb}, 0)`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.65 }}
            style={styles.sheetHero}
          >
            <View style={styles.sheetTopRow}>
              <TouchableOpacity onPress={onClose} style={styles.sheetBackBtn}>
                <Ionicons name="arrow-back" size={20} color={text} />
              </TouchableOpacity>
              <View style={styles.sheetCounter}>
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
          </LinearGradient>

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
                style={[styles.navBtnPrimary, { backgroundColor: accent.badge, opacity: hasNext ? 1 : 0.35 }]}
              >
                <Text style={styles.navBtnPrimaryText}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color="#0A0A0F" />
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** Same shell as a training day card — accent + badge + preview rows + chevron. */
function RecoveryDayCard({ day, onPress, isDark, accent }) {
  const note = day.recoveryNote || day.focus || "Recovery and light movement.";
  const segments = splitRecoverySegments(note);
  const preview = segments.slice(0, 3);
  const remaining = segments.length - preview.length;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const displayName = recoveryDayDisplayName(day);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      style={[styles.trainCard, { backgroundColor: cardBg, borderColor: borderC }]}
    >
      <View style={[styles.trainAccent, { backgroundColor: accent.badge }]} />
      <View style={styles.trainHeaderRow}>
        <View style={styles.trainHeaderLeft}>
          <View style={[styles.trainBadge, { backgroundColor: accent.badge }]}>
            <Text style={styles.trainBadgeText}>{day.short}</Text>
          </View>
          <View style={styles.trainTitles}>
            <Text style={[styles.trainTitle, { color: text }]}>Rest & Recovery</Text>
            <Text style={[styles.trainSubtitle, { color: tertiary }]} numberOfLines={2}>
              {displayName}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-down" size={16} color={tertiary} />
      </View>
      <View style={styles.trainPreview}>
        {preview.map((seg, i) => (
          <View key={`${i}-${seg.slice(0, 12)}`} style={styles.trainExRow}>
            <Text style={[styles.trainExIdx, { color: tertiary }]}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.trainExName, { color: text }]} numberOfLines={2}>
                {segmentHeadline(seg)}
              </Text>
              {!!segmentSubline(seg) && (
                <Text style={[styles.trainExMeta, { color: tertiary }]} numberOfLines={2}>
                  {segmentSubline(seg)}
                </Text>
              )}
            </View>
          </View>
        ))}
      </View>
      {remaining > 0 && (
        <View style={[styles.trainMoreRow, { borderTopColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }]}>
          <Text style={[styles.trainMoreText, { color: tertiary }]}>
            + {remaining} more {remaining === 1 ? "focus" : "focus areas"}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function RecoveryDayDetailScreen({ day, segments, onBack, onOpenSegment, isDark, accent }) {
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
        <View style={[styles.detailBadge, { backgroundColor: accent.badge }]}>
          <Text style={styles.trainBadgeText}>{day.short}</Text>
        </View>
        <Text style={[styles.detailHeaderTitle, { color: isDark ? TOKENS.mutedDark : TOKENS.mutedLight }]} numberOfLines={1}>
          {headerSubtitle}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.detailScroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.detailCount, { color: text }]}>{segments.length} recovery focus areas</Text>
        <Text style={[styles.detailHint, { color: tertiary }]}>Tap any item for full guidance.</Text>
        <View style={{ gap: 10, marginTop: 16 }}>
          {segments.map((seg, i) => (
            <TouchableOpacity
              key={`${i}-${seg.slice(0, 16)}`}
              activeOpacity={0.75}
              onPress={() => onOpenSegment(i)}
              style={[styles.detailExCard, { backgroundColor: cardBg, borderColor: borderC }]}
            >
              <Text style={[styles.trainExIdx, { color: tertiary, width: 22 }]}>{String(i + 1).padStart(2, "0")}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.trainExName, { color: text }]} numberOfLines={3}>
                  {segmentHeadline(seg)}
                </Text>
                {!!segmentSubline(seg) && (
                  <Text style={[styles.trainExMeta, { color: tertiary }]} numberOfLines={2}>
                    {segmentSubline(seg)}
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

function RecoveryFocusModal({ visible, day, segments, segmentIndex, onClose, onChangeIndex, isDark, accent }) {
  const seg = segmentIndex != null ? segments[segmentIndex] : null;
  const hasPrev = segmentIndex > 0;
  const hasNext = segmentIndex < segments.length - 1;
  const text = isDark ? TOKENS.textDark : TOKENS.textLight;
  const tertiary = isDark ? TOKENS.tertiaryDark : TOKENS.tertiaryLight;
  const muted = isDark ? TOKENS.mutedDark : TOKENS.mutedLight;
  const cardBg = isDark ? TOKENS.cardDark : TOKENS.cardLight;
  const borderC = isDark ? TOKENS.borderDark : TOKENS.borderLight;
  const tips = seg ? splitTips(seg) : [];
  const displayName = day ? recoveryDayDisplayName(day) : "";

  if (!visible || seg == null || !day) return null;

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
          <LinearGradient
            colors={[`rgba(${accent.rgb}, 0.22)`, `rgba(${accent.rgb}, 0)`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.65 }}
            style={styles.sheetHero}
          >
            <View style={styles.sheetTopRow}>
              <TouchableOpacity onPress={onClose} style={styles.sheetBackBtn}>
                <Ionicons name="arrow-back" size={20} color={text} />
              </TouchableOpacity>
              <View style={styles.sheetCounter}>
                <Text style={[styles.sheetCounterText, { color: accent.badge }]}>
                  {String(segmentIndex + 1).padStart(2, "0")} / {String(segments.length).padStart(2, "0")}
                </Text>
              </View>
              <View style={{ width: 36 }} />
            </View>
            <Text style={[styles.sheetKicker, { color: tertiary }]}>
              {day.short} · REST · {displayName}
            </Text>
            <Text style={[styles.sheetTitle, { color: text }]}>{segmentHeadline(seg)}</Text>
          </LinearGradient>

          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <View style={styles.sectionBlock}>
              <Text style={[styles.sectionLabel, { color: tertiary }]}>GUIDANCE</Text>
              {tips.length > 1 ? (
                tips.map((tip, i) => (
                  <View key={i} style={styles.tipRow}>
                    <Text style={[styles.tipIdx, { color: accent.badge }]}>{String(i + 1).padStart(2, "0")}</Text>
                    <Text style={[styles.tipBody, { color: muted }]}>{tip}</Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.recoveryModalBody, { color: muted }]}>{seg}</Text>
              )}
            </View>

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
                style={[
                  styles.navBtnPrimary,
                  { backgroundColor: accent.badge, opacity: hasNext ? 1 : 0.35 },
                ]}
              >
                <Text style={styles.navBtnPrimaryText}>Next</Text>
                <Ionicons name="chevron-forward" size={18} color="#0A0A0F" />
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

  const recoverySegments = useMemo(() => {
    if (!openRecoveryDay) return [];
    return splitRecoverySegments(
      openRecoveryDay.recoveryNote || openRecoveryDay.focus || ""
    );
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
          segments={recoverySegments}
          onBack={onBackFromRecovery}
          onOpenSegment={(idx) => setRecoveryModalIndex(idx)}
          isDark={isDark}
          accent={recoveryAccent}
        />
        <RecoveryFocusModal
          visible={recoveryModalIndex != null}
          day={openRecoveryDay}
          segments={recoverySegments}
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
        <PlanSummaryCard title={heroTitle} weeksRemaining={weeksRemaining} focus={focusSummary} />

        {!!overview.trim() && (
          <View style={styles.overviewBlock}>
            <Text style={[styles.sectionHeading, { color: tertiary }]}>OVERVIEW</Text>
            <Text style={[styles.overviewSerif, { color: text }]}>{overview.trim()}</Text>
          </View>
        )}

        {workoutDays.length > 0 && (
          <View style={styles.trainSection}>
            <Text style={[styles.sectionHeading, { color: tertiary }]}>TRAINING DAYS</Text>
            <View style={{ gap: 12 }}>
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
            <Text style={[styles.sectionHeading, { color: tertiary }]}>RECOVERY DAYS</Text>
            <View style={{ gap: 12 }}>
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
  scrollContent: { paddingBottom: 40, paddingHorizontal: 16, paddingTop: 8 },
  summaryGradient: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 8,
    overflow: "hidden",
  },
  summaryGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 180,
    backgroundColor: "rgba(255,255,255,0.2)",
    opacity: 0.5,
  },
  summarySparkle: {
    position: "absolute",
    top: 14,
    right: 14,
    fontSize: 14,
    color: "rgba(255,255,255,0.5)",
  },
  summaryLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 12,
  },
  summaryTitle: {
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
  },
  summaryRow: { flexDirection: "row", gap: 8 },
  summaryBox: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    padding: 12,
  },
  summaryBoxLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.7)",
  },
  summaryBoxValueSerif: {
    fontFamily: SERIF,
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 8,
  },
  summaryBoxFocus: {
    fontSize: 13,
    color: "#FFFFFF",
    marginTop: 8,
    lineHeight: 18,
  },
  overviewBlock: { marginTop: 24 },
  overviewSerif: {
    fontFamily: SERIF,
    fontSize: 15,
    lineHeight: 24,
    marginTop: 8,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
    marginBottom: 12,
  },
  trainSection: { marginTop: 28 },
  trainCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    paddingLeft: 16 + 6,
    overflow: "hidden",
    position: "relative",
  },
  trainAccent: {
    position: "absolute",
    left: 0,
    top: 12,
    bottom: 12,
    width: 4,
    borderRadius: 2,
  },
  trainHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  trainHeaderLeft: { flexDirection: "row", gap: 12, flex: 1 },
  trainBadge: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  trainBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  trainTitles: { flex: 1 },
  trainTitle: { fontSize: 15, fontWeight: "700" },
  trainSubtitle: { fontSize: 12, marginTop: 2 },
  trainPreview: { gap: 8 },
  trainExRow: { flexDirection: "row", gap: 12 },
  trainExIdx: { fontSize: 11, width: 22 },
  trainExName: { fontSize: 14, fontWeight: "600" },
  trainExMeta: { fontSize: 11, marginTop: 2 },
  trainMoreRow: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    alignItems: "center",
  },
  trainMoreText: { fontSize: 11, letterSpacing: 0.4 },
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
    minWidth: 36,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 10,
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
  sheetHero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 },
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
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 20,
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
  navBtnPrimaryText: { fontSize: 14, fontWeight: "700", color: "#0A0A0F" },
  recoveryModalBody: { fontSize: 15, lineHeight: 24 },
});
