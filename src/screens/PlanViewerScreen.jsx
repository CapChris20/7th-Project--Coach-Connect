import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import LottieView from "lottie-react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "").trim();
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// Color mapping
const FOCUS_COLORS = {
  pink: { badge: "#FF6B9D", gradient: ["#FF6B9D", "#FF8FB5"] },
  purple: { badge: "#C084FC", gradient: ["#C084FC", "#D4A5FF"] },
  cyan: { badge: "#64D2FF", gradient: ["#64D2FF", "#8FE1FF"] },
  orange: { badge: "#F97316", gradient: ["#F97316", "#FBA04A"] },
  green: { badge: "#10B981", gradient: ["#10B981", "#4ACD9B"] },
  gray: { badge: "#9CA3AF", gradient: ["#9CA3AF", "#C5CBD3"] },
};

const COLORS = {
  bgDark: "#0A0A0F",
  bgLight: "#F5F5F5",
  surfaceDark: "#13131A",
  surfaceLight: "#FFFFFF",
  textDark: "#FFFFFF",
  textLight: "#0A0A0F",
  mutedDark: "rgba(255,255,255,0.55)",
  mutedLight: "rgba(10,10,15,0.58)",
  borderDark: "rgba(255,255,255,0.08)",
  borderLight: "rgba(10,10,15,0.08)",
};

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Hero Section Component
const HeroSection = ({
  title,
  weeksRemaining,
  subtitle,
  brainLottie,
  sparklesLottie,
}) => {
  return (
    <View style={styles.heroContainer}>
      <LinearGradient
        colors={["#FF6B9D", "#C084FC"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroGradient}
      >
        <View style={styles.heroInner}>
          <View style={styles.lottieContainer}>
            <LottieView source={brainLottie} autoPlay loop style={styles.lottie} />
          </View>

          <View style={styles.heroText}>
            <Text style={styles.heroLabel}>Plan Summary</Text>
            <Text style={styles.heroTitle}>{title}</Text>

            <View style={styles.weeksBadge}>
              <View style={styles.weeksDot} />
              <Text style={styles.weeksText}>Weeks Remaining: {weeksRemaining}</Text>
            </View>

            <Text style={styles.heroSubtitle}>{subtitle}</Text>
          </View>

          <View style={styles.lottieContainer}>
            <LottieView source={sparklesLottie} autoPlay loop style={styles.lottie} />
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

// Day Card Component
const DayCard = ({ day, isDark, onExpandChange }) => {
  const [expanded, setExpanded] = useState(false);
  const [completed, setCompleted] = useState(false);

  const handlePress = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
    onExpandChange?.(!expanded);
  };

  const colors = FOCUS_COLORS[day.focusColor] || FOCUS_COLORS.pink;
  const bgColor = isDark ? COLORS.surfaceDark : COLORS.surfaceLight;
  const textColor = isDark ? COLORS.textDark : COLORS.textLight;
  const mutedColor = isDark ? COLORS.mutedDark : COLORS.mutedLight;
  const borderColor = isDark ? COLORS.borderDark : COLORS.borderLight;

  return (
    <View style={[styles.cardContainer, { marginBottom: 16 }]}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardBorder, { borderRadius: 16, padding: 2 }]}
      >
        <View
          style={[
            styles.cardInner,
            {
              backgroundColor: bgColor,
              borderRadius: 14,
              overflow: "hidden",
            },
          ]}
        >
          <TouchableOpacity onPress={handlePress} style={styles.cardHeader} activeOpacity={0.6}>
            <View style={[styles.badge, { backgroundColor: colors.badge }]}>
              <Text style={styles.badgeText}>{day.short}</Text>
            </View>

            <View style={styles.dayInfo}>
              <Text style={[styles.dayName, { color: textColor }]}>{day.day}</Text>
              <Text style={[styles.dayFocus, { color: mutedColor }]}>{day.focus}</Text>
            </View>

            <MaterialCommunityIcons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={mutedColor}
            />
          </TouchableOpacity>

          {expanded && (
            <View style={[styles.cardContent, { borderTopColor: borderColor }]}>
              {(day.estimatedDuration || day.warmup) && (
                <View style={styles.pillRow}>
                  {day.estimatedDuration && (
                    <View style={[styles.pill, { borderColor }]}>
                      <Ionicons name="time-outline" size={12} color={mutedColor} />
                      <Text style={[styles.pillText, { color: mutedColor }]}>{day.estimatedDuration}</Text>
                    </View>
                  )}
                  {day.warmup && (
                    <View style={[styles.pill, { borderColor }]}>
                      <MaterialCommunityIcons name="fire" size={12} color={mutedColor} />
                      <Text style={[styles.pillText, { color: mutedColor }]}>Warm-up</Text>
                    </View>
                  )}
                </View>
              )}

              {day.warmup && <Text style={[styles.warmupText, { color: mutedColor }]}>{day.warmup}</Text>}

              {(day.exercises || []).map((ex, idx) => (
                <View key={`${ex.name}-${idx}`} style={styles.exerciseBlock}>
                  <Text style={[styles.exerciseName, { color: textColor }]}>{String(ex.name || "").toUpperCase()}</Text>

                  <View style={styles.exerciseMetaRow}>
                    <View style={[styles.statBadge, { borderColor: colors.badge, backgroundColor: hexToRgba(colors.badge, isDark ? 0.14 : 0.08) }]}>
                      <Text
                        style={[
                          styles.exerciseMeta,
                          {
                            color: colors.badge,
                            fontFamily: Platform.select({ ios: "Courier New", android: "monospace" }),
                          },
                        ]}
                      >
                        {ex.sets} × {ex.reps}
                      </Text>
                    </View>
                    {!!ex.rest && (
                      <View style={[styles.metaPill, { borderColor }]}>
                        <Text style={[styles.metaPillText, { color: mutedColor }]}>{ex.rest}</Text>
                      </View>
                    )}
                    {!!ex.tempo && (
                      <View style={[styles.metaPill, { borderColor }]}>
                        <Text style={[styles.metaPillText, { color: mutedColor }]}>tempo {ex.tempo}</Text>
                      </View>
                    )}
                  </View>

                  {!!ex.muscle && (
                    <View style={[styles.musclePill, { backgroundColor: colors.badge }]}>
                      <Text style={styles.musclePillText}>{ex.muscle}</Text>
                    </View>
                  )}

                  {ex.notes && (
                    <Text
                      style={[
                        styles.exerciseNotes,
                        {
                          color: textColor,
                          borderLeftColor: colors.badge,
                          backgroundColor: hexToRgba(colors.badge, isDark ? 0.08 : 0.05),
                        },
                      ]}
                    >
                      {ex.notes}
                    </Text>
                  )}

                  {Array.isArray(ex.tips) && ex.tips.length > 0 && (
                    <View style={styles.tipsList}>
                      {ex.tips.slice(0, 3).map((tip, i) => (
                        <View
                          key={i}
                          style={[
                            styles.tipRow,
                            {
                              borderLeftColor: colors.badge,
                              backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
                              borderColor,
                            },
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="lightbulb-outline"
                            size={14}
                            style={styles.tipIcon}
                            color={colors.badge}
                          />
                          <Text style={[styles.tipText, { color: textColor }]}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {idx < (day.exercises || []).length - 1 && (
                    <LinearGradient
                      colors={[hexToRgba(colors.badge, 0), hexToRgba(colors.badge, isDark ? 0.55 : 0.35), hexToRgba(colors.badge, 0)]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.exerciseDivider}
                    />
                  )}
                </View>
              ))}

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: completed ? colors.badge : "transparent",
                      borderColor: completed ? colors.badge : borderColor,
                    },
                  ]}
                  onPress={() => setCompleted(!completed)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={completed ? "check-circle" : "check-circle-outline"}
                    size={16}
                    color={completed ? "#FFFFFF" : textColor}
                  />
                  <Text style={[styles.buttonText, { color: completed ? "#FFFFFF" : textColor }]}>
                    {completed ? "Completed" : "Mark Complete"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.button, { borderColor }]} activeOpacity={0.7}>
                  <MaterialCommunityIcons name="file-document-outline" size={16} color={mutedColor} />
                  <Text style={[styles.buttonText, { color: mutedColor }]}>Log...</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

// Rest Day Pill Component
const RestDayPill = ({ day, isDark }) => {
  const colors = FOCUS_COLORS[day.focusColor] || FOCUS_COLORS.gray;
  const bgColor = isDark ? COLORS.surfaceDark : COLORS.surfaceLight;
  const textColor = isDark ? COLORS.textDark : COLORS.textLight;
  const mutedColor = isDark ? 'rgba(255,255,255,0.72)' : COLORS.mutedLight;
  const noteColor = isDark ? 'rgba(255,255,255,0.62)' : COLORS.mutedLight;
  const displayDay = String(day.day || '')
    .replace(/^\?\s*/, '')
    .trim();

  return (
    <View style={styles.pillCardContainer}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cardBorder, { borderRadius: 14, padding: 2 }]}
      >
        <View style={[styles.pillCardInner, { backgroundColor: bgColor, borderRadius: 12 }]}>
          <View style={styles.pillContent}>
            <View style={styles.pillHeader}>
                <Text style={[styles.pillDayName, { color: textColor }]}>{displayDay}</Text>
            </View>
            <Text style={[styles.pillLabel, { color: mutedColor }]}>Rest & Recovery</Text>
            {day.recoveryNote && (
              <Text style={[styles.pillNote, { color: noteColor }]}>{day.recoveryNote}</Text>
            )}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

export default function PlanViewerScreen({ route, navigation, brainLottie, sparklesLottie }) {
  const colorScheme = useColorScheme();
  const systemIsDark = colorScheme === "dark";
  const isDarkOverride = route?.params?.isDarkOverride;
  const isDark = typeof isDarkOverride === "boolean" ? isDarkOverride : systemIsDark;

  const fallbackBrain = require("../assets/Lotties for Anatrox/Ai  brain board.json");
  const fallbackSparkles = require("../assets/Lotties for Anatrox/Sparkles Loop Loader ai.json");

  const workoutPlan = route?.params?.workoutPlan || [];
  const overview = route?.params?.overview ? String(route.params.overview) : "";

  const { workoutDays, restDays } = useMemo(() => {
    return {
      workoutDays: workoutPlan.filter((d) => !d.rest),
      restDays: workoutPlan.filter((d) => d.rest),
    };
  }, [workoutPlan]);

  const bgColor = isDark ? COLORS.bgDark : COLORS.bgLight;

  return (
    <View style={[styles.container, { backgroundColor: bgColor }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <HeroSection
          title="Your Workout Plan"
          weeksRemaining={4}
          subtitle="Focus: Complete muscle building program"
          brainLottie={brainLottie || fallbackBrain}
          sparklesLottie={sparklesLottie || fallbackSparkles}
        />

        {!!overview.trim() && (
          <View style={styles.overviewWrap}>
            <LinearGradient
              colors={["rgba(255,107,157,0.55)", "rgba(192,132,252,0.45)"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.overviewBorder}
            >
              <View
                style={[
                  styles.overviewInner,
                  {
                    backgroundColor: isDark ? COLORS.surfaceDark : COLORS.surfaceLight,
                    borderColor: isDark ? COLORS.borderDark : COLORS.borderLight,
                  },
                ]}
              >
                <Text style={[styles.overviewLabel, { color: isDark ? COLORS.mutedDark : COLORS.mutedLight }]}>
                  OVERVIEW
                </Text>
                <Text style={[styles.overviewText, { color: isDark ? COLORS.textDark : COLORS.textLight }]}>
                  {overview.trim()}
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {workoutDays.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? COLORS.textDark : COLORS.textLight }]}>
              Training Days
            </Text>
            <View style={styles.gridContainer}>
              {workoutDays.map((day) => (
                <View key={day.short} style={styles.gridItem}>
                  <DayCard day={day} isDark={isDark} />
                </View>
              ))}
            </View>
          </View>
        )}

        {restDays.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: isDark ? COLORS.textDark : COLORS.textLight }]}>
              Recovery Days
            </Text>
            <View style={styles.pillGrid}>
              {restDays.map((day, idx) => {
                const isLast = idx === restDays.length - 1;
                const isOddLastSingle = restDays.length % 2 === 1 && isLast;
                if (!isOddLastSingle) {
                  return (
                    <View key={day.short} style={styles.pillGridItem}>
                      <RestDayPill day={day} isDark={isDark} />
                    </View>
                  );
                }
                // If we have an odd number of cards, center the last one.
                return (
                  <View key={day.short} style={styles.pillGridItemCenteredOuter}>
                    <View style={styles.pillGridItemCenteredInner}>
                      <RestDayPill day={day} isDark={isDark} />
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  heroContainer: { marginHorizontal: 16, marginTop: 24, borderRadius: 24, overflow: "hidden" },
  heroGradient: { minHeight: 240, justifyContent: "center" },
  heroInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 12,
  },
  lottieContainer: { width: 100, height: 100, justifyContent: "center", alignItems: "center" },
  lottie: { width: 100, height: 100 },
  heroText: { flex: 1, alignItems: "center" },
  heroLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.8)",
    textTransform: "uppercase",
  },
  heroTitle: { fontSize: 24, fontWeight: "700", color: "#FFFFFF", marginTop: 8, textAlign: "center" },
  weeksBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 12,
  },
  weeksDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  weeksText: { fontSize: 11, fontWeight: "600", color: "#FFFFFF" },
  heroSubtitle: { fontSize: 14, fontWeight: "500", color: "rgba(255,255,255,0.85)", marginTop: 12, textAlign: "center" },
  overviewWrap: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, overflow: "hidden" },
  overviewBorder: { borderRadius: 18, padding: 2 },
  overviewInner: { borderRadius: 16, padding: 14, borderWidth: 1 },
  overviewLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.8, textTransform: "uppercase" },
  overviewText: { marginTop: 8, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  section: { paddingHorizontal: 16, marginTop: 32 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  gridContainer: { flexDirection: "column" },
  gridItem: { marginBottom: 16 },
  cardContainer: { overflow: "hidden" },
  cardBorder: { justifyContent: "center" },
  cardInner: { overflow: "hidden" },
  cardHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  badge: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999 },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  dayInfo: { flex: 1 },
  dayName: { fontSize: 14, fontWeight: "700" },
  dayFocus: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  cardContent: { borderTopWidth: 1, paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  pillRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10 },
  pillText: { fontSize: 10, fontWeight: "600" },
  warmupText: { fontSize: 12, fontStyle: "italic" },
  exerciseBlock: { gap: 8 },
  exerciseName: { fontSize: 15, fontWeight: "800", letterSpacing: 0.3, marginTop: 2 },
  exerciseMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  statBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  exerciseMeta: { fontSize: 12, fontWeight: "700", lineHeight: 16 },
  metaPill: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  metaPillText: { fontSize: 11, fontWeight: "600" },
  musclePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 2,
  },
  musclePillText: { fontSize: 11, fontWeight: "800", color: "#FFFFFF", letterSpacing: 0.4 },
  exerciseNotes: {
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "500",
    borderLeftWidth: 3,
    paddingLeft: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tipsList: { gap: 8, marginTop: 2 },
  tipRow: {
    flexDirection: "row",
    gap: 10,
    borderLeftWidth: 3,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  tipIcon: { marginTop: 1 },
  tipText: { fontSize: 11, fontWeight: "600", lineHeight: 15, flex: 1 },
  exerciseDivider: { height: 1.5, marginVertical: 12, borderRadius: 999 },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  button: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, borderWidth: 1, paddingVertical: 10 },
  buttonText: { fontSize: 12, fontWeight: "600" },
  pillCardContainer: { overflow: "hidden" },
  pillCardInner: { overflow: "hidden" },
  pillContent: { padding: 14, gap: 6, alignItems: 'center' },
  pillHeader: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: 'center', width: '100%' },
  pillDayName: { fontSize: 14, fontWeight: "800", textAlign: 'center' },
  pillLabel: { fontSize: 11, fontWeight: "700", textAlign: 'center', letterSpacing: 0.3 },
  pillNote: { fontSize: 11, fontWeight: '600', fontStyle: "italic", marginTop: 6, textAlign: 'center', lineHeight: 16 },
  pillGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  pillGridItem: { width: "48%" },
  pillGridItemCenteredOuter: { width: "100%", alignItems: "center" },
  pillGridItemCenteredInner: { width: "48%" },
});

