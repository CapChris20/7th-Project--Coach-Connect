// Client nutrition home: today's meals, macro bars, and the add-food / barcode popups.
// Flow: load profile + today's logs → paint calories/macros → add or delete food → refresh.
// Used as the Nutrition tab. Meal keys stay breakfast / lunch / dinner / snacks.

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useModalScrollBottomPad } from '../../navigation/bottomMenuSpacing';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../look-and-feel/lightDarkMode';
import { auth, db } from '../../app-start/cloudConnection';
import { doc, getDoc } from 'firebase/firestore';
import {
  getFoodLogsForDate,
  addFoodLog,
  deleteFoodLog,
} from '../../nutrition/daily-log/saveLoggedFood';
import FoodSearchScreen from '../../nutrition/food-search/FoodSearchScreen';
import { reportCrashAutomaticallySync } from '../../crash-reports/reportCrashAutomatically';
import Loader from '../../for-both/loading-and-header/BouncingDots';
import BarcodeScannerScreen from '../../nutrition/barcode/BarcodeScannerScreen';
import NutritionSettingsScreen from '../../nutrition/targets/NutritionSettingsScreen';
import MealCard from '../../nutrition/daily-log/MealCard';
import MacroBar from '../../nutrition/daily-log/MacroBar';
import GlassPanel from '../../look-and-feel/GlassPanel';
import BottomMenuBar from '../../navigation/BottomMenuBar';
import TopHeader from '../../for-both/loading-and-header/TopHeader';

const { width } = Dimensions.get('window');

// ===== NAMED CONSTANTS =====

const ACCENT = '#7C3AED';
const USERS_COLLECTION = 'users';
const DEFAULT_DISPLAY_NAME = 'User';
const DEFAULT_INITIAL = 'U';
const MEAL_BREAKFAST = 'breakfast';
const DAYS_IN_WEEK = 7;
const MORNING_ENDS_AT_HOUR = 12;
const AFTERNOON_ENDS_AT_HOUR = 18;
const FOOD_REFRESH_WAIT_MS = 800;
const FOOD_REFRESH_BACKUP_MS = 2000;
const DELETE_REFRESH_MS = 300;
const BAR_ANIMATION_MS = 800;
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FALLBACK_GOAL_CALORIES = 2200;

const meals = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snacks', label: 'Snacks' },
];

const EMPTY_TOTALS = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };

// ===== HELPER FUNCTIONS =====

/**
 * Overlay Firestore name/photo onto the auth defaults. Missing fields keep the auth values.
 * @param {object} userDoc
 * @param {Function} setUserData
 * @param {Function} setUserName
 * @param {Function} setUserPhoto
 */
function applyProfileFromUserDoc(userDoc, setUserData, setUserName, setUserPhoto) {
  if (!userDoc.exists()) return;
  const data = userDoc.data();
  setUserData(data);
  if (data.name) setUserName(data.name);
  if (data.photoURL) setUserPhoto(data.photoURL);
}

/**
 * @param {object} user
 * @param {Function} setUserData
 * @param {Function} setUserName
 * @param {Function} setUserPhoto
 */
async function overlayProfileFromFirestore(user, setUserData, setUserName, setUserPhoto) {
  if (!db) return;
  const userDoc = await getDoc(doc(db, USERS_COLLECTION, user.uid));
  applyProfileFromUserDoc(userDoc, setUserData, setUserName, setUserPhoto);
}

/**
 * Logs and goals in one trip so the spinner does not wait on two sequential reads.
 * @param {string} userId
 * @param {Date} selectedDate
 * @returns {Promise<[object[], object]>}
 */
async function fetchLogsAndGoals(userId, selectedDate) {
  return Promise.all([
    getFoodLogsForDate(userId, selectedDate),
    getDailyGoals(userId),
  ]);
}

function totalsFromCalculated(calculated) {
  return {
    calories: Number(calculated.calories) || 0,
    protein: Number(calculated.protein) || 0,
    carbs: Number(calculated.carbs) || 0,
    fat: Number(calculated.fat) || 0,
    fiber: Number(calculated.fiber) || 0,
    sugar: Number(calculated.sugar) || 0,
    sodium: Number(calculated.sodium) || 0,
  };
}

function animateMacroBars(proteinAnim, carbsAnim, fatAnim, userGoals, finalTotals) {
  Animated.parallel([
    Animated.timing(proteinAnim, {
      toValue: userGoals ? finalTotals.protein / userGoals.proteinTarget : 0,
      duration: BAR_ANIMATION_MS,
      useNativeDriver: false,
    }),
    Animated.timing(carbsAnim, {
      toValue: userGoals ? finalTotals.carbs / userGoals.carbsTarget : 0,
      duration: BAR_ANIMATION_MS,
      useNativeDriver: false,
    }),
    Animated.timing(fatAnim, {
      toValue: userGoals ? finalTotals.fat / userGoals.fatTarget : 0,
      duration: BAR_ANIMATION_MS,
      useNativeDriver: false,
    }),
  ]).start();
}

function greetingForHour(hour) {
  if (hour < MORNING_ENDS_AT_HOUR) return 'Good Morning';
  if (hour < AFTERNOON_ENDS_AT_HOUR) return 'Good Afternoon';
  return 'Good Evening';
}

function initialsFromName(name) {
  if (!name) return DEFAULT_INITIAL;
  const parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function foodIsMissingCalories(food) {
  return !food || (!food.calories && food.calories !== 0);
}

function foodIsFromFatSecret(food) {
  return food.source === 'fatsecret' || food.food_id;
}

function datesForSelectedWeek(selectedDate) {
  const dates = [];
  const selected = new Date(selectedDate);
  const startOfWeek = new Date(selected);
  startOfWeek.setDate(selected.getDate() - selected.getDay());
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }
  return dates;
}

function shiftDateByWeeks(date, direction) {
  const next = new Date(date);
  next.setDate(date.getDate() + (direction * DAYS_IN_WEEK));
  return next;
}

function formatDateShort(date) {
  return `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()}`;
}

function formatDateLong(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function totalsAfterDeletingItem(previous, item) {
  return {
    calories: Math.max(0, (previous.calories || 0) - (Number(item.calories) || 0)),
    protein: Math.max(0, (previous.protein || 0) - (Number(item.protein) || 0)),
    carbs: Math.max(0, (previous.carbs || 0) - (Number(item.carbs) || 0)),
    fat: Math.max(0, (previous.fat || 0) - (Number(item.fat) || 0)),
    fiber: Math.max(0, (previous.fiber || 0) - (Number(item.fiber) || 0)),
    sugar: Math.max(0, (previous.sugar || 0) - (Number(item.sugar) || 0)),
    sodium: Math.max(0, (previous.sodium || 0) - (Number(item.sodium) || 0)),
  };
}

function mealBodyTextColor(isDark, colors) {
  if (isDark) return colors.text;
  if (colors.gray && colors.gray[900]) return colors.gray[900];
  return colors.text;
}

function CalorieProgressBar({ totals, goalCalories, colors, styles }) {
  const caloriesEaten = Number(totals.calories) || 0;
  let ratio = 0;
  if (goalCalories > 0) ratio = caloriesEaten / goalCalories;
  const fillRatio = Math.max(0, Math.min(1, ratio));
  const fillPercent = Math.round(fillRatio * 100);
  const fillColor = calorieFillColor(ratio, colors);
  return (
    <View style={styles.calorieProgressTrack}>
      <View style={[styles.calorieProgressFill, { width: `${fillPercent}%`, backgroundColor: fillColor }]} />
    </View>
  );
}

function calorieFillColor(ratio, colors) {
  if (ratio > 1) return colors.error;
  if (ratio >= 0.8) return colors.success;
  if (ratio >= 0.5) return colors.info;
  return ACCENT;
}

function LogTodaysMealsLayout({
  goals,
  totals,
  loading,
  styles,
  isDark,
  onProfilePress,
  onSettingsPress,
  userPhoto,
  getInitials,
  userName,
  getGreeting,
  refreshData,
  setShowNutritionSettings,
  onClose,
  isConnected,
  scrollBottomPad,
  getWeekDates,
  selectedDate,
  setSelectedDate,
  colors,
  proteinAnim,
  carbsAnim,
  fatAnim,
  logsByMeal,
  setActiveMeal,
  setShowFoodSearch,
  setShowBarcodeScanner,
  handleDeleteFood,
  setShowNutritionFacts,
  showNutritionFacts,
  showNutritionSettings,
  showBarcodeScanner,
  handleBarcodeScanSuccess,
  activeMeal,
  showFoodSearch,
  handleAddFood,
  onNavigate,
}) {
  const remainingCalories = goals ? Math.max(goals.calories - totals.calories, 0) : 0;
  const burnedCalories = 0; // Requires integration with workout service
  const goalCalories = goals?.calories || FALLBACK_GOAL_CALORIES;
  const blurTint = isDark ? 'dark' : 'light';
  let glassTint = 'rgba(255, 255, 255, 0.8)';
  if (isDark) glassTint = 'rgba(255, 255, 255, 0.05)';
  const caloriesEatenLabel = `${Math.round(Number(totals.calories) || 0).toLocaleString()} Kcal`;
  const foodCaloriesLabel = `${Math.round(Number(totals.calories) || 0).toLocaleString()} kcal`;
  const goalCaloriesLabel = `${Math.round(goalCalories).toLocaleString()} kcal`;
  const caloriesLeftLabel = Math.round(remainingCalories).toLocaleString();
  const nutritionFactsIcon = showNutritionFacts ? '▼' : '▶';

  if (loading && !goals) {
    return (
      <View style={styles.loader}>
        <Loader />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <TopHeader
        title="Nutrition"
        isDark={isDark}
        skipTopSafeInset
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />
      {/* Header with User Greeting */}
      <View style={styles.header}>
        <View style={styles.userGreeting}>
          <View style={styles.profileContainer}>
            {userPhoto ? (
              <Image source={{ uri: userPhoto }} style={styles.profileImage} />
            ) : (
              <View style={styles.profilePlaceholder}>
                <Text style={styles.profileInitials} selectable={true}>{getInitials(userName)}</Text>
              </View>
            )}
          </View>
          <View style={styles.greetingText}>
            <Text style={styles.greeting} selectable={true}>{getGreeting()}</Text>
            <View style={styles.userNameRow}>
              <Text style={styles.userName} selectable={true}>{userName}</Text>
              {/* ICON GOES HERE — wave */}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity 
              style={styles.refreshButton}
              onPress={refreshData}
            >
              {/* ICON GOES HERE — refresh */}
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.settingsButton}
              onPress={() => setShowNutritionSettings(true)}
            >
              {/* ICON GOES HERE — settings */}
            </TouchableOpacity>
            {onClose && (
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={onClose}
              >
                <Text style={styles.closeIcon} selectable={true}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        {!isConnected && (
          <View style={styles.disconnectedBanner}>
            <Text style={styles.disconnectedText} selectable={true}>! Disconnected</Text>
          </View>
        )}
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        {...FORM_SCROLL_PROPS}
      >
        {/* Date Selector - Matching Image Style */}
        <View style={styles.dateSelectorContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.weekRow}
          >
            {getWeekDates().map((date, index) => {
              const isSelected = date.toDateString() === selectedDate.toDateString();
              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.weekDayCircle, isSelected && styles.weekDayCircleSelected]}
                  onPress={() => setSelectedDate(date)}
                >
                  <Text style={[styles.weekDayLabel, isSelected && styles.weekDayLabelSelected]} selectable={true}>
                    {formatDateShort(date).split(' ')[0]}
                  </Text>
                  <Text style={[styles.weekDayNumber, isSelected && styles.weekDayNumberSelected]} selectable={true}>
                    {date.getDate()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Main Calorie Card */}
        <View style={styles.calorieCardWrap}>
          <BlurView
            intensity={20}
            tint={blurTint}
            style={styles.calorieCardBlur}
          >
            <View style={styles.calorieCardInner}>
              <Text style={styles.calorieCardLabel} selectable={true}>Today Calories</Text>
              <Text style={styles.calorieCardValue} selectable={true}>
                {caloriesEatenLabel}
              </Text>

              <View style={styles.calorieLeftRow}>
                <Text style={styles.calorieLeftLabel} selectable={true}>Calories Left</Text>
                <Text style={styles.calorieLeftNumber} selectable={true}>
                  {caloriesLeftLabel}
                </Text>
              </View>

              <CalorieProgressBar
                totals={totals}
                goalCalories={goalCalories}
                colors={colors}
                styles={styles}
              />
            </View>
          </BlurView>
        </View>

        {/* Summary Cards - Goal, Food, Exercise */}
        <View style={styles.summaryCardsRow}>
          {/* Goal Card */}
          <View style={styles.summaryCardWrap}>
            <BlurView intensity={20} tint={blurTint} style={styles.summaryCardBlur}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel} selectable={true}>Goal</Text>
                {/* ICON GOES HERE — goal */}
                <View style={styles.summaryCardIconSpacer} />
                <Text style={styles.summaryCardValue} selectable={true}>
                  {goalCaloriesLabel}
                </Text>
              </View>
            </BlurView>
          </View>

          {/* Food Card */}
          <View style={styles.summaryCardWrap}>
            <BlurView intensity={20} tint={blurTint} style={styles.summaryCardBlur}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel} selectable={true}>Food</Text>
                {/* ICON GOES HERE — food */}
                <View style={styles.summaryCardIconSpacer} />
                <Text style={styles.summaryCardValue} selectable={true}>
                  {foodCaloriesLabel}
                </Text>
              </View>
            </BlurView>
          </View>

          {/* Exercise Card */}
          <View style={styles.summaryCardWrap}>
            <BlurView intensity={20} tint={blurTint} style={styles.summaryCardBlur}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryCardLabel} selectable={true}>Exercise</Text>
                {/* ICON GOES HERE — exercise */}
                <View style={styles.summaryCardIconSpacer} />
                <Text style={styles.summaryCardValue} selectable={true}>55 min</Text>
              </View>
            </BlurView>
          </View>
        </View>

        {/* Next Habit Section */}
        <View style={styles.nextHabitSection}>
          <Text style={styles.nextHabitTitle} selectable={true}>Next Habit</Text>
          <View style={styles.habitCardsRow}>
            {/* Steps Card */}
            <TouchableOpacity>
              <GlassPanel
                transmission={0.85}
                roughness={0.15}
                tint={glassTint}
                style={styles.habitCard}
              >
                <View style={styles.habitIconCircle}>
                  <Image 
                    source={require('../../assets/sneakers.gif')} 
                    style={styles.habitIconImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.habitCardTitle} selectable={true}>Steps</Text>
                <Text style={styles.habitCardSubtitle} selectable={true}>Connect To Track Your Steps</Text>
              </GlassPanel>
            </TouchableOpacity>

            {/* Exercise Card */}
            <TouchableOpacity>
              <GlassPanel
                transmission={0.85}
                roughness={0.15}
                tint={glassTint}
                style={styles.habitCard}
              >
                <View style={styles.habitIconCircle}>
                  <Image 
                    source={require('../../assets/icons/arm-muscle.gif')} 
                    style={styles.habitIconImage}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.habitCardTitle} selectable={true}>Exercise</Text>
                {/* ICON GOES HERE — calories burned */}
                <Text style={styles.habitCardSubtitle} selectable={true}>0 cal</Text>
                {/* ICON GOES HERE — duration */}
                <Text style={styles.habitCardSubtitle} selectable={true}>0:00 hr</Text>
              </GlassPanel>
            </TouchableOpacity>
          </View>
        </View>

        {/* Macro Section */}
        <View style={styles.macroCardWrap}>
          <BlurView intensity={20} tint={blurTint} style={styles.macroCardBlur}>
            <View style={styles.macroCard}>
              <View style={styles.nutrientsHeader}>
                <Text style={styles.sectionTitle} selectable={true}>Nutrients</Text>
                <TouchableOpacity>
                  <Text style={styles.dotsIcon} selectable={true}>⋯</Text>
                </TouchableOpacity>
              </View>
              <MacroBar
                label="Protein"
                current={totals.protein || 0}
                target={goals?.proteinTarget || 165}
                color={ACCENT}
                animatedValue={proteinAnim}
              />
              <MacroBar
                label="Carbs"
                current={totals.carbs || 0}
                target={goals?.carbsTarget || 220}
                color="#3B82F6"
                animatedValue={carbsAnim}
              />
              <MacroBar
                label="Fat"
                current={totals.fat || 0}
                target={goals?.fatTarget || 73.4}
                color="#F97316"
                animatedValue={fatAnim}
              />
            </View>
          </BlurView>
        </View>

        {/* Intake Section */}
        <View style={styles.intakeSection}>
          <View style={styles.intakeHeader}>
            <Text style={styles.sectionTitle} selectable={true}>Intake</Text>
            <TouchableOpacity>
              <Text style={[styles.intakeLink, { color: ACCENT }]} selectable={true}>Nutrition Analysis {'>'}</Text>
            </TouchableOpacity>
          </View>

          {meals.map((meal) => (
            <MealCard
              key={meal.key}
              mealType={meal.label}
              mealKey={meal.key}
              items={logsByMeal[meal.key] || []}
              onAddPress={() => {
                setActiveMeal(meal.key);
                setShowFoodSearch(true);
              }}
              onAddScanner={() => {
                setActiveMeal(meal.key);
                setShowBarcodeScanner(true);
              }}
              onDeleteItem={handleDeleteFood}
            />
          ))}
        </View>

        {/* Nutrition Facts Accordion */}
        <TouchableOpacity
          style={styles.nutritionFactsCard}
          onPress={() => setShowNutritionFacts(!showNutritionFacts)}
        >
          <View style={styles.nutritionFactsHeader}>
            <Text style={styles.nutritionFactsTitle} selectable={true}>Nutrition Facts</Text>
            <Text style={styles.nutritionFactsIcon} selectable={true}>{nutritionFactsIcon}</Text>
          </View>
          {showNutritionFacts && (
            <View style={styles.nutritionFactsContent}>
              <NutritionFactRow label="Total Carbohydrates" value={`${(totals.carbs || 0).toFixed(1)}g`} />
              <NutritionFactRow label="Dietary Fiber" value={`${(totals.fiber || 0).toFixed(1)}g`} />
              <NutritionFactRow label="Sugars" value={`${(totals.sugar || 0).toFixed(1)}g`} />
              <NutritionFactRow label="Cholesterol" value={`${0.0}mg`} />
              <NutritionFactRow label="Sodium" value={`${(totals.sodium || 0).toFixed(1)}mg`} />
              <NutritionFactRow label="Iron" value={`${0.0}mg`} />
              <NutritionFactRow label="Calcium" value={`${0.0}mg`} />
              <NutritionFactRow label="Potassium" value={`${0.0}mg`} />
              <NutritionFactRow label="Vitamin A" value={`${0.0}mg`} />
              <NutritionFactRow label="Vitamin C" value={`${0.0}mg`} />
              <NutritionFactRow label="Vitamin D" value={`${0.0}mcg`} />
              <NutritionFactRow label="Polyunsaturated Fat" value={`${0.0}g`} />
              <NutritionFactRow label="Monounsaturated Fat" value={`${0.0}g`} />
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setActiveMeal(MEAL_BREAKFAST);
          setShowFoodSearch(true);
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[ACCENT, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon} selectable={true}>+</Text>
        </LinearGradient>
      </TouchableOpacity>

      {/* Nutrition Settings Modal */}
      <Modal
        visible={showNutritionSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNutritionSettings(false)}
      >
        <NutritionSettingsScreen
          onClose={() => setShowNutritionSettings(false)}
          onGoalsUpdated={() => {
            refreshData();
          }}
        />
      </Modal>

      {/* Barcode Scanner Modal */}
      <Modal
        visible={showBarcodeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowBarcodeScanner(false)}
      >
        <BarcodeScannerScreen
          onClose={() => setShowBarcodeScanner(false)}
          onScanSuccess={handleBarcodeScanSuccess}
          mealType={activeMeal}
        />
      </Modal>

      {/* Food Search Modal */}
      <Modal
        visible={showFoodSearch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFoodSearch(false)}
      >
        <FoodSearchScreen
          onClose={() => setShowFoodSearch(false)}
          onSelectFood={(food, mealType) => handleAddFood(food, mealType || activeMeal)}
          defaultMeal={activeMeal}
          onProfilePress={onProfilePress}
          onSettingsPress={onSettingsPress}
        />
      </Modal>

      {/* Bottom Navigation Bar */}
      {onNavigate && (
        <BottomMenuBar
          onHomePress={() => onNavigate('home')}
          onProfilePress={() => onNavigate('profile')}
          onPlusPress={() => onNavigate('create')}
          onVoicePress={() => onNavigate('voice')}
          onWorkoutPress={() => onNavigate('workout')}
          onNutritionPress={() => {}} // Already on nutrition screen
        />
      )}
    </SafeAreaView>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Nutrition home: greeting, week strip, calorie card, meal cards, add-food popups.
 * @param {object} props
 * @param {Function} [props.onClose]
 * @param {Function} [props.onNavigate]
 * @param {Function} [props.onProfilePress]
 * @param {Function} [props.onSettingsPress]
 */
export default function LogTodaysMealsScreen({ onClose, onNavigate, onProfilePress, onSettingsPress }) {
  const scrollBottomPad = useModalScrollBottomPad(48);
  const { colors, spacing, isDark } = useTheme();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [logsByMeal, setLogsByMeal] = useState({});
  const [totals, setTotals] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [goals, setGoals] = useState(null);
  const [showFoodSearch, setShowFoodSearch] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showNutritionSettings, setShowNutritionSettings] = useState(false);
  const [activeMeal, setActiveMeal] = useState('breakfast');
  const [showNutritionFacts, setShowNutritionFacts] = useState(false);
  const [isConnected, setIsConnected] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [userData, setUserData] = useState(null);
  const [userName, setUserName] = useState('');
  const [userPhoto, setUserPhoto] = useState(null);
  const user = auth.currentUser;
  
  const proteinAnim = useRef(new Animated.Value(0)).current;
  const carbsAnim = useRef(new Animated.Value(0)).current;
  const fatAnim = useRef(new Animated.Value(0)).current;

  const styles = createStyles(spacing, colors, isDark);

  const refreshData = useCallback(async () => {
    // 1. No signed-in user → zero the bars and stop.
    if (!user) {
      setTotals({ ...EMPTY_TOTALS });
      return;
    }
    setLoading(true);
    try {
      // 2. Logs and goals together so one slow read cannot stall the other forever.
      const [logs, userGoals] = await fetchLogsAndGoals(user.uid, selectedDate);

      console.log('REFRESH DATA - Logs received:', logs.length);
      console.log('Log calories:', logs.map((logRow) => ({ name: logRow.food_name, cals: logRow.calories })));

      // 3. Split by meal, then turn the rows into the calorie/protein numbers on the card.
      setGoals(userGoals);
      const split = splitLogsByMeal(logs);
      setLogsByMeal(split);
      const calculated = calculateMacroTotals(logs);
      console.log('Calculated totals BEFORE setting:', calculated);
      const finalTotals = totalsFromCalculated(calculated);
      console.log('Setting totals to:', finalTotals);
      setTotals({ ...finalTotals });

      // 4. Grow the protein / carbs / fat bars to the new ratios.
      animateMacroBars(proteinAnim, carbsAnim, fatAnim, userGoals, finalTotals);
    } catch (error) {
      console.error('Failed to load food logs', error);
      reportCrashAutomaticallySync(error, 'LogTodaysMealsScreen - loadFoodLogs');
    }
  }, [selectedDate, user, proteinAnim, carbsAnim, fatAnim]);

  useEffect(() => {
    refreshData();
    loadUserProfile();
  }, [refreshData]);

  const loadUserProfile = async () => {
    // 1. Need a signed-in user before we touch auth or Firestore.
    if (!user) return;
    try {
      // 2. Auth name/photo first so the greeting is not blank while Firestore loads.
      const displayName = user.displayName || user.email?.split('@')[0] || DEFAULT_DISPLAY_NAME;
      setUserName(displayName);
      setUserPhoto(user.photoURL);
      // 3. Firestore name/photo overwrite when the user doc has them.
      await overlayProfileFromFirestore(user, setUserData, setUserName, setUserPhoto);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const getGreeting = () => greetingForHour(new Date().getHours());
  const getInitials = (name) => initialsFromName(name);

  const handleAddFood = async (food, mealType) => {
    // 1. Failures first: need a user, and the card must have a calorie number (0 is allowed).
    if (!user) return;
    if (foodIsMissingCalories(food)) {
      console.error('❌ Food object missing calories:', food);
      setErrorMessage('Food data is missing. Please try again.');
      return;
    }

    try {
      // 2. FatSecret cards keep food_id / source. Everything else uses the regular log write.
      if (foodIsFromFatSecret(food)) {
        await addFoodLogWithFatSecret(user.uid, {
          mealType: mealType || activeMeal,
          food,
          date: selectedDate,
          servingSize: food.servingSize || 1,
          foodId: food.food_id,
          source: 'fatsecret',
        });
      } else {
        await addFoodLog(user.uid, {
          mealType: mealType || activeMeal,
          food,
          date: selectedDate,
          servingSize: food.servingSize || 1,
        });
      }

      // 3. Close the pickers, then refresh twice so a slow Firestore write still lands.
      setShowFoodSearch(false);
      setShowBarcodeScanner(false);
      setErrorMessage(null);
      setTimeout(async () => {
        await refreshData();
      }, FOOD_REFRESH_WAIT_MS);
      setTimeout(async () => {
        await refreshData();
      }, FOOD_REFRESH_BACKUP_MS);
    } catch (error) {
      console.error('❌ Failed to add food', error);
      }
  };

  const handleBarcodeScanSuccess = (food, mealType) => {
    handleAddFood(food, mealType || activeMeal);
  };

  const handleDeleteFood = async (item) => {
    // 1. Need a signed-in user. Then delete, subtract locally, refresh from the server.
    if (!user) return;
    try {
      await deleteFoodLog(item.id);
      setTotals((previous) => totalsAfterDeletingItem(previous, item));
      setTimeout(() => refreshData(), DELETE_REFRESH_MS);
    } catch (error) {
      console.error('Failed to delete food', error);
      }
  };

  const getWeekDates = () => datesForSelectedWeek(selectedDate);

  const navigateWeek = (direction) => {
    setSelectedDate((previous) => shiftDateByWeeks(previous, direction));
  };

  return (
    <LogTodaysMealsLayout
      goals={goals}
      totals={totals}
      loading={loading}
      styles={styles}
      isDark={isDark}
      onProfilePress={onProfilePress}
      onSettingsPress={onSettingsPress}
      userPhoto={userPhoto}
      getInitials={getInitials}
      userName={userName}
      getGreeting={getGreeting}
      refreshData={refreshData}
      setShowNutritionSettings={setShowNutritionSettings}
      onClose={onClose}
      isConnected={isConnected}
      scrollBottomPad={scrollBottomPad}
      getWeekDates={getWeekDates}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      colors={colors}
      proteinAnim={proteinAnim}
      carbsAnim={carbsAnim}
      fatAnim={fatAnim}
      logsByMeal={logsByMeal}
      setActiveMeal={setActiveMeal}
      setShowFoodSearch={setShowFoodSearch}
      setShowBarcodeScanner={setShowBarcodeScanner}
      handleDeleteFood={handleDeleteFood}
      setShowNutritionFacts={setShowNutritionFacts}
      showNutritionFacts={showNutritionFacts}
      showNutritionSettings={showNutritionSettings}
      showBarcodeScanner={showBarcodeScanner}
      handleBarcodeScanSuccess={handleBarcodeScanSuccess}
      activeMeal={activeMeal}
      showFoodSearch={showFoodSearch}
      handleAddFood={handleAddFood}
      onNavigate={onNavigate}
    />
  );
}


function NutritionFactRow({ label, value }) {
  const { isDark } = useTheme();
  let labelColor = '#6B7280';
  let valueColor = '#111827';
  if (isDark) {
    labelColor = '#9CA3AF';
    valueColor = '#FFFFFF';
  }
  return (
    <View style={styles.nutritionFactRow}>
      <Text style={[styles.nutritionFactLabel, { color: labelColor }]} selectable={true}>
        {label}
      </Text>
      <Text style={[styles.nutritionFactValue, { color: valueColor }]} selectable={true}>
        {value}
      </Text>
    </View>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    loader: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 10,
    },
    userNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    userGreeting: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 10,
    },
    profileContainer: {
      marginRight: 12,
    },
    profileImage: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#E5E7EB',
    },
    profilePlaceholder: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: '#5856D6',
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileInitials: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    greetingText: {
      flex: 1,
    },
    greeting: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 2,
    },
    userName: {
      fontSize: 20,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    headerActions: {
      flexDirection: 'row',
      gap: 8,
    },
    refreshButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.15)' : 'rgba(88, 86, 214, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    refreshIcon: {
      fontSize: 18,
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.15)' : 'rgba(88, 86, 214, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingsIcon: {
      fontSize: 18,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(88, 86, 214, 0.15)' : 'rgba(88, 86, 214, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    closeIcon: {
      fontSize: 18,
      color: isDark ? '#FFFFFF' : '#111827',
      fontWeight: '600',
    },
    disconnectedBanner: {
      marginTop: 8,
      paddingVertical: 6,
      paddingHorizontal: 12,
      backgroundColor: '#FEE2E2',
      borderRadius: 8,
      alignSelf: 'flex-start',
    },
    disconnectedText: {
      fontSize: 12,
      color: '#EF4444',
      fontWeight: '600',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {},
    dateSelectorContainer: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    weekRow: {
      flexDirection: 'row',
      gap: 12,
    },
    weekDayCircle: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(88, 86, 214, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    weekDayCircleSelected: {
      backgroundColor: isDark ? '#5856D6' : '#5856D6',
      borderColor: isDark ? '#5856D6' : '#5856D6',
    },
    weekDayLabel: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontWeight: '600',
      marginBottom: 2,
    },
    weekDayLabelSelected: {
      color: '#FFFFFF',
    },
    weekDayNumber: {
      fontSize: 14,
      color: isDark ? '#FFFFFF' : '#111827',
      fontWeight: '700',
    },
    weekDayNumberSelected: {
      color: '#FFFFFF',
    },
    calorieCardWrap: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    calorieCardBlur: {
      borderRadius: 24,
      overflow: 'hidden',
    },
    calorieCardInner: {
      borderRadius: 24,
      padding: 20,
      minHeight: 160,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)',
      shadowColor: ACCENT,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.15,
      shadowRadius: 32,
      elevation: 10,
    },
    calorieCardLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,26,0.7)',
      letterSpacing: 0.6,
      marginBottom: 8,
    },
    calorieCardValue: {
      fontSize: 48,
      fontWeight: '800',
      color: mealBodyTextColor(isDark, colors),
      letterSpacing: -1,
      marginBottom: 14,
    },
    calorieLeftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    calorieLeftLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,26,0.65)',
    },
    calorieLeftNumber: {
      fontSize: 13,
      fontWeight: '800',
      color: mealBodyTextColor(isDark, colors),
    },
    calorieProgressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: isDark ? 'rgba(255,255,255,0.10)' : 'rgba(26,26,26,0.08)',
      overflow: 'hidden',
    },
    calorieProgressFill: {
      height: '100%',
      borderRadius: 4,
    },
    todayCaloriesSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    todayCaloriesLabel: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontWeight: '600',
      marginBottom: 8,
    },
    todayCaloriesValue: {
      fontSize: 48,
      fontWeight: '800',
      color: isDark ? '#FFFFFF' : '#111827',
      letterSpacing: -1,
    },
    caloriesLeftSection: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    caloriesLeftHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    caloriesLeftLabel: {
      fontSize: 14,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontWeight: '600',
    },
    caloriesLeftValue: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    flameIcon: {
      fontSize: 16,
    },
    caloriesLeftNumber: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
    },
    progressBarContainer: {
      height: 12,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(88, 86, 214, 0.1)',
      borderRadius: 6,
      overflow: 'visible',
      position: 'relative',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 6,
    },
    progressBarHandle: {
      position: 'absolute',
      top: -4,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: isDark ? '#FFFFFF' : '#111827',
      borderWidth: 2,
      borderColor: isDark ? '#5856D6' : '#5856D6',
      marginLeft: -10,
    },
    summaryCardsRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 24,
      gap: 12,
    },
    summaryCardWrap: {
      flex: 1,
    },
    summaryCardBlur: {
      borderRadius: 24,
      overflow: 'hidden',
    },
    summaryCard: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
      borderRadius: 24,
      padding: 16,
      minHeight: 120,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)',
    },
    summaryCardIconSpacer: {
      height: 24,
      marginBottom: 10,
    },
    summaryCardLabel: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      fontWeight: '600',
      marginBottom: 8,
    },
    summaryCardValue: {
      fontSize: 16,
      fontWeight: '800',
      color: mealBodyTextColor(isDark, colors),
    },
    nextHabitSection: {
      paddingHorizontal: 20,
      marginBottom: 24,
    },
    nextHabitTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
      marginBottom: 16,
    },
    habitCardsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    habitCard: {
      flex: 1,
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
      borderRadius: 24,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)',
    },
    habitIconCircle: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: 'transparent',
      overflow: 'hidden',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    habitIcon: {
      fontSize: 24,
    },
    habitIconImage: {
      width: 48,
      height: 48,
      backgroundColor: 'transparent',
    },
    habitCardIcon: {
      fontSize: 32,
      marginBottom: 8,
    },
    habitCardTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : '#111827',
      marginBottom: 4,
    },
    habitCardSubtitle: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : '#6B7280',
      marginBottom: 2,
    },
    cardsRow: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      marginBottom: 20,
      gap: 12,
    },
    statCard: {
      flex: 1,
      borderRadius: 16,
      padding: 16,
      minHeight: 120,
    },
    goalCard: {
      backgroundColor: '#065F46',
    },
    intakeCard: {
      backgroundColor: '#1E3A5F',
    },
    burnedCard: {
      backgroundColor: '#7C2D12',
    },
    statCardTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: '#9CA3AF',
      marginBottom: 8,
    },
    calorieRing: {
      width: 120,
      height: 120,
      borderRadius: 60,
      borderWidth: 8,
      borderColor: '#FF8A34',
      justifyContent: 'center',
      alignItems: 'center',
      alignSelf: 'center',
      marginTop: 8,
    },
    calorieRingText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
      textAlign: 'center',
      paddingHorizontal: 4,
    },
    statCardValue: {
      fontSize: 24,
      fontWeight: '700',
      color: '#FFFFFF',
      marginTop: 8,
    },
    statCardIcon: {
      fontSize: 24,
      position: 'absolute',
      top: 16,
      right: 16,
    },
    nutrientsSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    nutrientsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    dotsIcon: {
      fontSize: 20,
      color: '#9CA3AF',
    },
    intakeSection: {
      paddingHorizontal: 20,
      marginBottom: 20,
    },
    intakeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    intakeLink: {
      fontSize: 14,
      fontWeight: '600',
    },
    nutritionFactsCard: {
      backgroundColor: '#111111',
      borderRadius: 16,
      padding: 20,
      marginHorizontal: 20,
      marginBottom: 20,
    },
    nutritionFactsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    nutritionFactsTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    nutritionFactsIcon: {
      fontSize: 16,
      color: '#9CA3AF',
    },
    nutritionFactsContent: {
      marginTop: 16,
    },
    nutritionFactRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    nutritionFactLabel: {
      fontSize: 14,
      flex: 1,
    },
    nutritionFactValue: {
      fontSize: 14,
      fontWeight: '600',
    },
    fab: {
      position: 'absolute',
      bottom: 100,
      right: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
    },
    fabGradient: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 28,
    },
    fabIcon: {
      fontSize: 24,
      color: '#FFFFFF',
      fontWeight: '300',
    },
  });
