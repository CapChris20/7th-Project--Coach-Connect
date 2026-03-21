import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import Svg, { Path, Circle, Line, Polyline, Rect } from 'react-native-svg';

/* ──────────────────────────────────
   COLORS & TOKENS
   ────────────────────────────────── */

const colors = {
  bg: '#000000',
  card: '#1C1C1E',
  cardLight: '#2C2C2E',
  primary: '#007AFF',
  primaryDim: 'rgba(0,122,255,0.2)',
  white: '#FFFFFF',
  gray: '#8E8E93',
  border: '#333333',
};

/* ──────────────────────────────────
   SVG ICONS (React Native SVG)
   ────────────────────────────────── */

const MessageIcon = ({ size = 20, color = colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2-2z" />
  </Svg>
);

const ImageIcon = ({ size = 20, color = colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <Circle cx="8.5" cy="8.5" r="1.5" />
    <Path d="M21 15l-5-5L5 21" />
  </Svg>
);

const DumbbellIcon = ({ size = 20, color = colors.primary }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M6.5 6.5h11M6.5 17.5h11M2 12h2M20 12h2M4 8v8M20 8v8M6 6v12M18 6v12" />
  </Svg>
);

const ChevronRight = () => (
  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={colors.gray} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Polyline points="9,18 15,12 9,6" />
  </Svg>
);

/* ──────────────────────────────────
   SHARED COMPONENTS
   ────────────────────────────────── */

const HeaderCard = () => (
  <View style={styles.headerCard}>
    <View style={styles.headerCardContent}>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle}>Good Morning, User</Text>
        <Text style={styles.headerSubtitle}>Welcome to your Fitness Dashboard!</Text>
      </View>
      <View style={styles.lottieContainer}>
        <DumbbellIcon size={32} color="rgba(255,255,255,0.8)" />
      </View>
    </View>
  </View>
);

const ClientCard = () => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>Client(s)</Text>
    <View style={styles.clientCard}>
      <View style={styles.profilePic}>
        <Text style={styles.profilePicText}>?</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.clientName}>Name</Text>
        <View style={styles.chipContainer}>
          <Text style={styles.chipText}>Onboarding Info</Text>
        </View>
      </View>
      <View style={styles.clientInfo}>
        <Text style={styles.clientInfoText}>Goal Age,{'\n'}Client Intake</Text>
      </View>
      <ChevronRight />
    </View>
  </View>
);

const QuickActions = () => {
  const items = [
    { icon: <MessageIcon />, label: 'Messages' },
    { icon: <ImageIcon />, label: 'Photo Gallery' },
    { icon: <DumbbellIcon />, label: 'All AI Workout Plans' },
  ];

  return (
    <View style={styles.quickActionsContainer}>
      {items.map((item, i) => (
        <TouchableOpacity key={i} style={styles.quickActionCard}>
          {item.icon}
          <Text style={styles.quickActionLabel}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const TabSwitcher = ({ active }) => {
  const tabs = ['Progress', 'Nutrition', 'Calendar', 'Notes & Files'];
  
  return (
    <View style={styles.tabSwitcher}>
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab}
          style={[
            styles.tab,
            tab === active && styles.tabActive
          ]}
        >
          <Text style={[
            styles.tabText,
            tab === active && styles.tabTextActive
          ]}>
            {tab}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

/* ──────────────────────────────────
   PROGRESS CONTENT
   ────────────────────────────────── */

const ProgressContent = () => (
  <>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Photos</Text>
      <View style={styles.photoRow}>
        {['Before', 'Current'].map((label) => (
          <View key={label} style={styles.photoCard}>
            <Text style={styles.photoLabel}>{label}</Text>
            <View style={styles.photoPlaceholder}>
              <ImageIcon size={32} color={colors.gray} />
            </View>
          </View>
        ))}
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Weight</Text>
      <View style={styles.photoRow}>
        {['Before', 'Current'].map((label) => (
          <View key={label} style={styles.weightCard}>
            <Text style={styles.photoLabel}>{label}</Text>
            <Text style={styles.weightValue}>—</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={styles.section}>
      <Text style={styles.sectionTitle}># of Reps or Amount of Weight</Text>
      <View style={styles.repsCard}>
        <View style={styles.repsColumn}>
          <Text style={styles.repsColumnTitle}>Before</Text>
          {[1, 2, 3].map((n) => (
            <Text key={n} style={styles.repsText}>
              {n}. Workout name — (Current method)
            </Text>
          ))}
        </View>
        <View style={styles.repsDivider} />
        <View style={styles.repsColumn}>
          <Text style={styles.repsColumnTitle}>Current</Text>
          {[1, 2, 3].map((n) => (
            <Text key={n} style={styles.repsText}>
              Workout name — (Current method)
            </Text>
          ))}
        </View>
      </View>
    </View>
  </>
);

/* ──────────────────────────────────
   NUTRITION CONTENT
   ────────────────────────────────── */

const NutritionContent = () => (
  <>
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Macros For Today</Text>
      <View style={styles.macrosRow}>
        {[
          { label: 'Carbs', emoji: '🍞' },
          { label: 'Protein', emoji: '🥩' },
          { label: 'Fats', emoji: '🥑' },
        ].map((m) => (
          <View key={m.label} style={styles.macroCard}>
            <Text style={styles.macroEmoji}>{m.emoji}</Text>
            <Text style={styles.macroLabel}>{m.label}</Text>
            <Text style={styles.macroValue}>—</Text>
          </View>
        ))}
      </View>
    </View>

    <View style={styles.section}>
      <View style={styles.microsCard}>
        <Text style={styles.microsText}>★ Same as Micros ★</Text>
      </View>
    </View>

    <View style={styles.section}>
      <View style={styles.caloriesCard}>
        <View>
          <Text style={styles.caloriesLabel}>Calories</Text>
          <Text style={styles.caloriesValue}>—</Text>
        </View>
        <View style={styles.repsDivider} />
        <View style={{ flex: 1 }}>
          <Text style={styles.caloriesLabel}>Food Ate Today</Text>
          <View style={styles.foodGrid}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <Text key={n} style={styles.foodItem}>Food {n}</Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  </>
);

/* ──────────────────────────────────
   PHONE FRAME
   ────────────────────────────────── */

const PhoneFrame = ({ title, children }) => (
  <View style={styles.phoneContainer}>
    <Text style={styles.phoneTitle}>{title}</Text>
    <View style={styles.phoneFrame}>
      {/* Notch */}
      <View style={styles.notch} />
      
      {/* Status bar */}
      <View style={styles.statusBar}>
        <Text style={styles.statusBarText}>9:41</Text>
        <View style={styles.battery} />
      </View>
      
      {/* Scrollable content */}
      <ScrollView 
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </View>
  </View>
);

/* ──────────────────────────────────
   MAIN COMPONENT — BOTH SCREENS SIDE BY SIDE
   ────────────────────────────────── */

const AnatroxDashboard = ({ activeTab = 'Progress', onTabChange }) => (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" />
    
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <HeaderCard />
      <ClientCard />
      <QuickActions />
      <TabSwitcher active={activeTab} />
      
      {activeTab === 'Progress' && <ProgressContent />}
      {activeTab === 'Nutrition' && <NutritionContent />}
      {activeTab === 'Calendar' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calendar Coming Soon</Text>
        </View>
      )}
      {activeTab === 'Notes & Files' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Files Coming Soon</Text>
        </View>
      )}
    </ScrollView>
  </View>
);

/* ──────────────────────────────────
   STYLES
   ────────────────────────────────── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  scrollContentContainer: {
    gap: 20,
    paddingTop: 8,
    paddingBottom: 96,
  },
  
  // HeaderCard
  headerCard: {
    marginHorizontal: 16,
  },
  headerCardContent: {
    borderRadius: 24,
    backgroundColor: colors.primary,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  lottieContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  
  // Section
  section: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
    marginBottom: 8,
  },
  
  // ClientCard
  clientCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  profilePic: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profilePicText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  clientName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  chipContainer: {
    backgroundColor: colors.cardLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  chipText: {
    fontSize: 12,
    color: colors.gray,
  },
  clientInfo: {
    alignItems: 'flex-end',
  },
  clientInfoText: {
    fontSize: 11,
    color: colors.gray,
    lineHeight: 14,
    textAlign: 'right',
  },
  
  // QuickActions
  quickActionsContainer: {
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  quickActionLabel: {
    fontSize: 10,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 13,
  },
  
  // TabSwitcher
  tabSwitcher: {
    marginHorizontal: 16,
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.cardLight,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray,
  },
  tabTextActive: {
    color: colors.white,
  },
  
  // Photos
  photoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  photoLabel: {
    fontSize: 12,
    color: colors.gray,
    marginBottom: 8,
  },
  photoPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 12,
    backgroundColor: colors.cardLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Weight
  weightCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  weightValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.white,
    marginTop: 4,
  },
  
  // Reps
  repsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  repsColumn: {
    flex: 1,
  },
  repsColumnTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 8,
  },
  repsText: {
    fontSize: 11,
    color: colors.gray,
    marginBottom: 6,
    lineHeight: 15,
  },
  repsDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  
  // Macros
  macrosRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 12,
    alignItems: 'center',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  macroEmoji: {
    fontSize: 24,
  },
  macroLabel: {
    fontSize: 11,
    color: colors.gray,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.white,
  },
  
  // Micros
  microsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  microsText: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
  },
  
  // Calories
  caloriesCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 6,
  },
  caloriesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  caloriesValue: { fd
    fontSize: 28,
    fontWeight: '700',
    color: colors.white,
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 8,
  },
  foodItem: {
    fontSize: 11,
    color: colors.gray,
    width: '45%',
  },
});

export default AnatroxDashboard;
