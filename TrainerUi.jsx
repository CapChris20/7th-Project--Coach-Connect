import React, { useState, useMemo, createContext, useContext } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
} from "react-native";

// --- Icon Placeholder (replace with @expo/vector-icons or react-native-vector-icons) ---
const Icon = ({ name, size = 18, color = "#fff" }) => (
  <Text style={{ fontSize: size, color }}>{name.charAt(0)}</Text>
);

// --- Theme Context ---
const ThemeContext = createContext();
const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");
  const toggleTheme = () =>
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  const styles = theme === "dark" ? darkStyles : lightStyles;
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, styles }}>
      {children}
    </ThemeContext.Provider>
  );
};
const useTheme = () => useContext(ThemeContext);

// --- Main Index Content (all UI inlined, uses theme) ---
const IndexContent = () => {
  const { theme, toggleTheme, styles } = useTheme();
  const [activeTab, setActiveTab] = useState("Progress");
  const [notesFilesSubTab, setNotesFilesSubTab] = useState("Notes");

  const timeOfDay = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Morning";
    if (hour < 17) return "Afternoon";
    return "Evening";
  }, []);

  const clients = [];
  const tabs = ["Progress", "Nutrition", "Calendar", "Notes & Files"];
  const actions = [
    { label: "Messages", icon: "MessageSquare" },
    { label: "Photo Gallery", icon: "Image" },
    { label: "AI Workouts", icon: "Dumbbell" },
  ];
  const navItems = [
    { icon: "Home", label: "Home" },
    { icon: "Search", label: "Search" },
    { icon: "BarChart3", label: "Stats" },
    { icon: "User", label: "Profile" },
  ];

  const macros = [
    { label: "Carbs", icon: "Wheat", color: "#7c3aed" },
    { label: "Protein", icon: "Beef", color: "#a855f7" },
    { label: "Fat", icon: "Droplets", color: "#ec4899" },
  ];

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const monthName = new Date(year, month).toLocaleString("default", {
    month: "long",
  });
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const calendarCells = Array.from(
    { length: firstDay + daysInMonth },
    (_, i) => (i < firstDay ? null : i - firstDay + 1)
  );

  const renderTabContent = () => {
    if (activeTab === "Progress") {
      return (
        <View style={styles.tabContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weight</Text>
            <View style={styles.grid2Col}>
              <View style={[styles.glassCard, styles.inputCard]}>
                <Text style={styles.inputLabel}>Before</Text>
                <TextInput
                  placeholder="Enter weight..."
                  placeholderTextColor={styles.muted.color}
                  editable={false}
                  style={styles.input}
                />
              </View>
              <View style={[styles.glassCard, styles.inputCard]}>
                <Text style={styles.inputLabel}>Current</Text>
                <TextInput
                  placeholder="Enter weight..."
                  placeholderTextColor={styles.muted.color}
                  editable={false}
                  style={styles.input}
                />
              </View>
            </View>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Training Progress</Text>
            <View style={styles.grid2Col}>
              {["Before", "Current"].map((label) => (
                <View key={label} style={[styles.glassCard, styles.inputCard]}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <Text style={styles.swipeHint}>Swipe to see more days</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.glassCard, styles.emptyStateCard]}>
            <View style={[styles.glassCard, styles.iconCircle]}>
              <Icon name="Dumbbell" size={24} color={styles.muted.color} />
            </View>
            <Text style={styles.muted}>No training data yet</Text>
            <TouchableOpacity style={[styles.primaryButton, styles.gradientAccent]}>
              <Icon name="Dumbbell" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>Log Workout</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTab === "Nutrition") {
      return (
        <View style={styles.tabContent}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Macros For Today</Text>
            <View style={styles.grid3Col}>
              {macros.map(({ label, icon, color }) => (
                <View
                  key={label}
                  style={[styles.glassCard, styles.macroCard]}
                >
                  <View style={styles.macroCircle}>
                    <Icon name={icon} size={14} color={styles.muted.color} />
                  </View>
                  <Text style={styles.macroValue}>0g</Text>
                  <Text style={styles.macroLabel}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.glassCard, styles.microCard]}>
            <Icon name="Pill" size={20} color={styles.muted.color} />
            <Text style={styles.muted}>No micronutrient data</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Calories</Text>
            <View style={[styles.glassCard, styles.caloriesCard]}>
              <View style={styles.caloriesCircle}>
                <Icon name="Flame" size={20} color={styles.muted.color} />
              </View>
              <View>
                <Text style={styles.caloriesValue}>0</Text>
                <Text style={styles.muted}>kcal</Text>
              </View>
            </View>
          </View>
          <View style={[styles.glassCard, styles.emptyStateCard]}>
            <View style={[styles.glassCard, styles.iconCircle]}>
              <Icon name="Utensils" size={24} color={styles.muted.color} />
            </View>
            <Text style={styles.muted}>No meals logged today</Text>
            <TouchableOpacity style={[styles.primaryButton, styles.gradientAccent]}>
              <Icon name="Utensils" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>Log Meal</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTab === "Calendar") {
      return (
        <View style={styles.tabContent}>
          <View style={[styles.glassCard, styles.calendarCard]}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity>
                <Icon name="ChevronLeft" size={18} color={styles.muted.color} />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>
                {monthName} {year}
              </Text>
              <TouchableOpacity>
                <Icon name="ChevronRight" size={18} color={styles.muted.color} />
              </TouchableOpacity>
            </View>
            <View style={styles.weekdayRow}>
              {weekdays.map((d) => (
                <Text key={d} style={styles.weekdayLabel}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={styles.calendarGrid}>
              {calendarCells.map((day, i) => (
                <View
                  key={i}
                  style={[
                    styles.calendarCell,
                    day === now.getDate() && styles.calendarCellActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.calendarCellText,
                      day === now.getDate() && styles.calendarCellTextActive,
                    ]}
                  >
                    {day || ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
          <View style={[styles.glassCard, styles.emptyStateSmall]}>
            <Text style={styles.muted}>No sessions scheduled</Text>
          </View>
          <View style={[styles.glassCard, styles.emptyStateCard]}>
            <View style={[styles.glassCard, styles.iconCircle]}>
              <Icon name="CalendarPlus" size={24} color={styles.muted.color} />
            </View>
            <Text style={styles.muted}>No upcoming sessions</Text>
            <TouchableOpacity style={[styles.primaryButton, styles.gradientAccent]}>
              <Icon name="CalendarPlus" size={16} color="#fff" />
              <Text style={styles.primaryButtonText}>Schedule a Session</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    if (activeTab === "Notes & Files") {
      return (
        <View style={styles.tabContent}>
          <View style={[styles.glassCard, styles.subTabBar]}>
            {["Notes", "Files"].map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setNotesFilesSubTab(t)}
                style={[
                  styles.subTabButton,
                  notesFilesSubTab === t && styles.gradientAccent,
                ]}
              >
                <Text
                  style={[
                    styles.subTabText,
                    notesFilesSubTab === t && { color: "#fff" },
                  ]}
                >
                  {t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {notesFilesSubTab === "Notes" ? (
            <View style={[styles.glassCard, styles.emptyStateCard]}>
              <View style={[styles.glassCard, styles.iconCircle]}>
                <Icon name="NotebookPen" size={24} color={styles.muted.color} />
              </View>
              <Text style={styles.muted}>No notes yet</Text>
              <TouchableOpacity
                style={[styles.primaryButton, styles.gradientAccent]}
              >
                <Icon name="PenLine" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Add Note</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.glassCard, styles.emptyStateCard]}>
              <View style={[styles.glassCard, styles.iconCircle]}>
                <Icon name="FolderOpen" size={24} color={styles.muted.color} />
              </View>
              <Text style={styles.muted}>No files uploaded</Text>
              <TouchableOpacity
                style={[styles.primaryButton, styles.gradientAccent]}
              >
                <Icon name="Upload" size={16} color="#fff" />
                <Text style={styles.primaryButtonText}>Upload File</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
        <StatusBar
          barStyle={theme === "dark" ? "light-content" : "dark-content"}
        />
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>CoachConnect</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                onPress={toggleTheme}
                style={[styles.glassCard, styles.iconButton]}
                accessibilityLabel="Toggle theme"
              >
                {theme === "dark" ? (
                  <Icon name="Sun" size={18} color="#facc15" />
                ) : (
                  <Icon name="Moon" size={18} color="#7c3aed" />
                )}
              </TouchableOpacity>
              <View style={[styles.gradientAccent, styles.avatarCircle]}>
                <Icon name="User" size={16} color="#fff" />
              </View>
              <TouchableOpacity>
                <Icon name="Settings" size={18} color={styles.muted.color} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Greeting */}
          <View style={styles.greeting}>
            <Text style={styles.greetingTitle}>
              Good {timeOfDay}, <Text style={styles.gradientText}>Trainer</Text>
            </Text>
            <View style={styles.greetingRow}>
              <Text style={styles.muted}>Welcome to Your Fitness Dashboard</Text>
              <View style={[styles.glassCard, styles.lottiePlaceholder]}>
                <Text style={styles.lottieText}>Lottie{"\n"}Placeholder</Text>
              </View>
            </View>
          </View>

          {/* ClientSection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Clients</Text>
              <Icon name="ChevronDown" size={16} color={styles.muted.color} />
            </View>
            {clients.length === 0 && (
              <View style={[styles.glassCard, styles.emptyStateCard]}>
                <View style={[styles.glassCard, styles.iconCircle]}>
                  <Icon name="UserPlus" size={24} color={styles.muted.color} />
                </View>
                <Text style={styles.muted}>No clients added yet</Text>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.gradientAccent]}
                >
                  <Icon name="UserPlus" size={16} color="#fff" />
                  <Text style={styles.primaryButtonText}>Add Client</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* QuickActions */}
          <View style={styles.section}>
            <View style={styles.grid3Col}>
              {actions.map(({ label, icon }) => (
                <TouchableOpacity
                  key={label}
                  style={[styles.glassCard, styles.quickActionItem]}
                >
                  <View style={[styles.gradientAccent, styles.iconWrapperSmall]}>
                    <Icon name={icon} size={18} color="#fff" />
                  </View>
                  <Text style={styles.quickActionLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* ClientRequests */}
          <View style={styles.clientRequestsWrap}>
            <TouchableOpacity style={styles.clientRequestButton}>
              <Icon name="Inbox" size={16} color="#7c3aed" />
              <Text style={styles.clientRequestText}>Client Requests</Text>
            </TouchableOpacity>
          </View>

          {/* TabSwitcher */}
          <View style={styles.section}>
            <View style={[styles.glassCard, styles.tabBar]}>
              {tabs.map((tab) => (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setActiveTab(tab)}
                  style={[
                    styles.tabButton,
                    activeTab === tab && [
                      styles.gradientAccent,
                      styles.tabButtonActive,
                    ],
                  ]}
                >
                  <Text
                    style={[
                      styles.tabButtonText,
                      activeTab === tab && { color: "#fff" },
                    ]}
                  >
                    {tab}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Tab Content */}
          {renderTabContent()}

          {/* BottomNav - spacer for fixed nav */}
          <View style={{ height: 100 }} />
        </ScrollView>

        {/* BottomNav (fixed) */}
        <View style={styles.bottomNav}>
          <View style={[styles.glassCard, styles.bottomNavInner]}>
            <View style={styles.bottomNavRow}>
              {navItems.slice(0, 2).map(({ icon, label }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.navItem}
                >
                  <Icon name={icon} size={20} color={styles.muted.color} />
                  <Text style={styles.navLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.gradientAccent, styles.navPlusButton]}
              >
                <Icon name="Plus" size={24} color="#fff" />
              </TouchableOpacity>
              {navItems.slice(2).map(({ icon, label }) => (
                <TouchableOpacity
                  key={label}
                  style={styles.navItem}
                >
                  <Icon name={icon} size={20} color={styles.muted.color} />
                  <Text style={styles.navLabel}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </SafeAreaView>
  );
};

// --- Index (wraps with ThemeProvider) ---
const Index = () => (
  <ThemeProvider>
    <IndexContent />
  </ThemeProvider>
);

// --- Base Styles ---
const baseStyles = {
  safeArea: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingBottom: 20 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  logo: { fontSize: 20, fontWeight: "bold", color: "#7c3aed" },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  greeting: { paddingHorizontal: 20, paddingVertical: 16 },
  greetingTitle: { fontSize: 24, fontWeight: "bold" },
  gradientText: { color: "#7c3aed" },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  lottiePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  lottieText: { fontSize: 10, textAlign: "center" },
  section: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  grid2Col: { flexDirection: "row", gap: 12 },
  grid3Col: { flexDirection: "row", gap: 12 },
  glassCard: {
    borderRadius: 16,
    borderWidth: 1,
  },
  gradientAccent: { backgroundColor: "#7c3aed" },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "500" },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapperSmall: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionItem: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    gap: 10,
  },
  quickActionLabel: { fontSize: 12, fontWeight: "500" },
  clientRequestsWrap: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    alignItems: "center",
  },
  clientRequestButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  clientRequestText: { fontSize: 14, fontWeight: "500" },
  tabBar: {
    flexDirection: "row",
    padding: 6,
    gap: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  tabButtonActive: { shadowOpacity: 0.3, shadowRadius: 5, elevation: 4 },
  tabButtonText: { fontSize: 12, fontWeight: "600" },
  tabContent: { paddingHorizontal: 20, paddingVertical: 12, gap: 20 },
  inputCard: { flex: 1, padding: 16 },
  inputLabel: { fontSize: 12, marginBottom: 8 },
  input: { fontSize: 14 },
  swipeHint: {
    fontSize: 10,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 8,
  },
  emptyStateCard: {
    padding: 32,
    alignItems: "center",
    gap: 16,
  },
  emptyStateSmall: {
    padding: 24,
    alignItems: "center",
  },
  macroCard: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  macroCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  macroValue: { fontSize: 18, fontWeight: "bold" },
  macroLabel: { fontSize: 10 },
  microCard: {
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  caloriesCard: {
    padding: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
  },
  caloriesCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  caloriesValue: { fontSize: 30, fontWeight: "bold" },
  calendarCard: { padding: 16 },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  calendarTitle: { fontSize: 14, fontWeight: "600" },
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 10,
    fontWeight: "500",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  calendarCell: {
    width: "14.28%",
    paddingVertical: 8,
    alignItems: "center",
  },
  calendarCellActive: { borderRadius: 8, backgroundColor: "#7c3aed" },
  calendarCellText: { fontSize: 12 },
  calendarCellTextActive: { color: "#fff", fontWeight: "bold" },
  subTabBar: {
    flexDirection: "row",
    padding: 4,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  subTabText: { fontSize: 12, fontWeight: "600" },
  bottomNav: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  bottomNavInner: {
    width: "100%",
    maxWidth: 390,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopWidth: 1,
  },
  bottomNavRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  navItem: {
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
  navLabel: { fontSize: 10 },
  navPlusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -24,
  },
};

const lightStyles = StyleSheet.create({
  ...baseStyles,
  safeArea: { ...baseStyles.safeArea, backgroundColor: "#f0f0ff" },
  muted: { color: "#64748b" },
  glassCard: {
    ...baseStyles.glassCard,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    borderColor: "rgba(124, 58, 237, 0.2)",
  },
  greetingTitle: { ...baseStyles.greetingTitle, color: "#1e293b" },
  clientRequestButton: {
    ...baseStyles.clientRequestButton,
    borderColor: "rgba(124, 58, 237, 0.3)",
  },
  tabButtonText: { ...baseStyles.tabButtonText, color: "#64748b" },
  quickActionLabel: { ...baseStyles.quickActionLabel, color: "#1e293b" },
  sectionTitle: { ...baseStyles.sectionTitle, color: "#64748b" },
  inputLabel: { ...baseStyles.inputLabel, color: "#64748b" },
  macroLabel: { ...baseStyles.macroLabel, color: "#64748b" },
  weekdayLabel: { ...baseStyles.weekdayLabel, color: "#64748b" },
  subTabText: { ...baseStyles.subTabText, color: "#64748b" },
  navLabel: { ...baseStyles.navLabel, color: "#64748b" },
  bottomNavInner: {
    ...baseStyles.bottomNavInner,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
});

const darkStyles = StyleSheet.create({
  ...baseStyles,
  safeArea: { ...baseStyles.safeArea, backgroundColor: "#0a0a1a" },
  muted: { color: "#94a3b8" },
  glassCard: {
    ...baseStyles.glassCard,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  greetingTitle: { ...baseStyles.greetingTitle, color: "#f8fafc" },
  clientRequestButton: {
    ...baseStyles.clientRequestButton,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  tabButtonText: { ...baseStyles.tabButtonText, color: "#94a3b8" },
  quickActionLabel: { ...baseStyles.quickActionLabel, color: "#f8fafc" },
  sectionTitle: { ...baseStyles.sectionTitle, color: "#94a3b8" },
  inputLabel: { ...baseStyles.inputLabel, color: "#94a3b8" },
  macroLabel: { ...baseStyles.macroLabel, color: "#94a3b8" },
  weekdayLabel: { ...baseStyles.weekdayLabel, color: "#94a3b8" },
  subTabText: { ...baseStyles.subTabText, color: "#94a3b8" },
  navLabel: { ...baseStyles.navLabel, color: "#94a3b8" },
  bottomNavInner: {
    ...baseStyles.bottomNavInner,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
});

export default Index;
