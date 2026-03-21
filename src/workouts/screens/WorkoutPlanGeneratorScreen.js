/**
 * Workout Plan Generator Screen
 * Review onboarding data, allow edits, and generate personalized workout plan using Anthropic Claude API
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  StatusBar,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Constants from 'expo-constants';
import { useTheme } from '../../shared/ui/ThemeContext';
import { auth, db } from '../../app/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Liquid } from '../../shared/ui/liquid/liquidTokens';
import BottomNavBar from '../../navigation/BottomNavBar';
import CoachConnectHeader from '../../shared/components/CoachConnectHeader';
import { saveGeneratedPlanToCollection, getCurrentWorkoutPlan, setCurrentWorkoutPlan } from '../services/workoutService';
import Markdown from 'react-native-markdown-display';
import {
  parsePlanForPdf,
  generateAndSavePlanPdf,
  getWorkoutPlans,
  stripMarkdown,
  stripEmojis,
} from '../services/workoutPlanPdfService';
import WorkoutPlanPdfViewerModal from '../components/WorkoutPlanPdfViewerModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PADDING = 20;
const GRID_GAP = 12;
const GRID_COL_WIDTH = (SCREEN_WIDTH - (Liquid.spacing.gutter * 2) - GRID_GAP) / 2;

const MARKDOWN_STYLES = {
  body: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 22 },
  heading1: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 12, marginTop: 8 },
  heading2: { color: '#ffffff', fontSize: 16, fontWeight: '700', marginBottom: 8, marginTop: 16 },
  strong: { color: '#ffffff', fontWeight: '700' },
  hr: { backgroundColor: 'rgba(255,255,255,0.1)', height: 1, marginVertical: 16 },
  paragraph: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22, marginBottom: 8 },
  bullet_list: { marginBottom: 8 },
  list_item: { color: 'rgba(255,255,255,0.8)', fontSize: 14, lineHeight: 22 },
};

/** Strip ALL markdown symbols before rendering. No raw markdown ever visible. */
function cleanText(str) {
  if (str == null || typeof str !== 'string') return '';
  return String(str)
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .replace(/__([^_]*)__/g, '$1')
    .replace(/_([^_]*)_/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^[-*•]\s*/gm, '')
    .replace(/^\d+\.\s*/gm, '')
    .replace(/^---+\s*$/gm, '')
    .replace(/\|[-:\s|]+\|/g, '')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Robustly extract a JSON object from an API response that may contain
 * prose, markdown fences, or other noise around the JSON.
 */
function extractJSON(str) {
  if (!str || typeof str !== 'string') return '';
  // Strip outer backtick fences first
  let s = str.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  // Find the outermost { ... } block
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    s = s.slice(first, last + 1);
  }
  return s;
}

function tryParsePlanJson(str) {
  // Accept either:
  // - JSON object: {...}
  // - JSON array: [...]
  // The viewer can normalize arrays into { days: [...] }.
  try {
    const cleaned = String(str || '').trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/, '')
      .trim();

    if (!cleaned) return null;

    const firstBrace = cleaned.indexOf('{');
    const firstBracket = cleaned.indexOf('[');

    let start = -1;
    let end = -1;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace;
      end = cleaned.lastIndexOf('}');
    } else if (firstBracket !== -1) {
      start = firstBracket;
      end = cleaned.lastIndexOf(']');
    }

    if (start === -1 || end === -1 || end <= start) return null;

    const raw = cleaned.slice(start, end + 1);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Ensure markdown headings (## or #) start on a new line so they render as headings, not raw text. */
function normalizePlanMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  let out = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  out = out.replace(/([^\n])\s*(#{1,6}\s)/g, '$1\n\n$2');
  return out;
}

const WP = {
  sectionLabel: '#C084FC',
  exerciseName: '#FFFFFF',
  setsReps: '#64D2FF',
  startWeight: '#F97316',
  formCueLabel: 'rgba(255,255,255,0.4)',
  formCueText: 'rgba(255,255,255,0.75)',
  dayTitle: '#FFFFFF',
  dayMeta: 'rgba(255,255,255,0.5)',
  duration: 'rgba(255,255,255,0.4)',
  restDay: 'rgba(255,255,255,0.35)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.08)',
};

const TYPE_COLORS = { Push: WP.sectionLabel, Pull: '#AF52DE', Legs: WP.startWeight, 'Full Body': '#10B981', Rest: '#555' };

function inferType(label) {
  const lower = (label || '').toLowerCase();
  if (/push/.test(lower)) return 'Push';
  if (/pull/.test(lower)) return 'Pull';
  if (/legs?|lower/.test(lower)) return 'Legs';
  if (/full\s*body|upper\s*lower/.test(lower)) return 'Full Body';
  return 'Full Body';
}

/** Parse a table row like "| Leg swings | 30 sec | front to back |" into { name, duration, notes }. */
function parseTableRow(line) {
  const parts = line.split(/\|/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { name: cleanText(parts[0]), duration: cleanText(parts[1]), notes: parts[2] ? cleanText(parts[2]) : '' };
  if (parts.length === 1) return { name: cleanText(parts[0]), duration: '', notes: '' };
  return null;
}

/**
 * Parse raw AI plan into { overview, days: [{ label, type, isRest, warmUp, exercises, coolDown }], notes }.
 * Exercises: "A1 — Bench Press - Sets x Reps: 4 x 8-10 - Rest: 90 seconds - Form Cues: - cue1 - cue2"
 * Warm-up/cool-down: table format "| Exercise | Duration | Notes |"
 */
function parsePlan(rawText) {
  const result = { overview: '', days: [], notes: '' };
  if (!rawText || typeof rawText !== 'string') return result;
  const normalized = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/([^\n])\s*(#{1,6}\s)/g, '$1\n\n$2');
  const sections = normalized.split(/\n\s*#{2,3}\s*/).map((s) => s.trim()).filter(Boolean);
  let firstOverview = '';
  for (let i = 0; i < sections.length; i++) {
    const block = sections[i];
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const firstLine = lines[0] || '';
    const lowerFirst = firstLine.toLowerCase();
    if (i === 0 && (lowerFirst.includes('overview') || lowerFirst.includes('personalized') || /^1\./.test(firstLine) || block.length > 200)) {
      firstOverview = block;
      continue;
    }
    if (/important\s*notes|notes\s*$/i.test(firstLine) || /^7\./.test(firstLine)) {
      result.notes = lines.slice(1).join('\n').trim() || firstLine;
      continue;
    }
    const label = cleanText(firstLine.replace(/^[\d.]+\s*/, '').trim()) || `Day ${result.days.length + 1}`;
    const isRest = /\b(rest|off)\b/i.test(label);
    const type = isRest ? 'Rest' : inferType(label);
    const warmUp = [];
    const exercises = [];
    const coolDown = [];
    let inWarmUp = false;
    let inCoolDown = false;
    let inExercises = false;
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      const lower = line.toLowerCase();
      if (/warm[- ]?up|warmup/.test(lower) && line.length < 30) {
        inWarmUp = true;
        inCoolDown = false;
        inExercises = false;
        continue;
      }
      if (/cool[- ]?down|cooldown/.test(lower) && line.length < 30) {
        inCoolDown = true;
        inWarmUp = false;
        inExercises = false;
        continue;
      }
      if (/exercise|main\s*work|workout\s*a|workout\s*b/i.test(lower) && line.length < 40 && !inWarmUp && !inCoolDown) {
        inExercises = true;
        continue;
      }
      if (/^\|/.test(line) || (/\|/.test(line) && line.length < 200)) {
        const row = parseTableRow(line);
        if (row && row.name && !/^[-—|]+$/.test(row.name)) {
          if (inCoolDown) coolDown.push({ name: row.name, duration: row.duration, notes: row.notes });
          else if (inWarmUp) warmUp.push({ name: row.name, duration: row.duration });
        }
        continue;
      }
      const bulletMatch = line.match(/^[\s•\d.*\-]+(.+)$/);
      if (bulletMatch) {
        const content = bulletMatch[1].trim();
        if (!content || content.length < 2) continue;
        const formCuesMatch = content.match(/Form\s*Cues?:\s*(.+)$/i);
        const parts = content.split(/\s+-\s+/);
        const firstPart = (parts[0] || '').trim();
        let name = firstPart.replace(/^[A-Z]\d+\s*[—\-]\s*/, '').trim();
        let sets = '';
        let reps = '';
        let rest = '';
        let startingWeight = '';
        const formCues = [];
        if (formCuesMatch) {
          formCuesMatch[1].split(/\s+-\s+/).forEach((c) => {
            const cue = cleanText(c.trim());
            if (cue) formCues.push(cue);
          });
        }
        for (let k = 1; k < parts.length; k++) {
          const p = parts[k];
          if (/Form\s*Cues?/i.test(p)) continue;
          const colonIdx = p.indexOf(':');
          if (colonIdx >= 0) {
            const key = p.slice(0, colonIdx).trim().toLowerCase();
            const val = cleanText(p.slice(colonIdx + 1).trim());
            if (/sets?\s*x\s*reps?|reps?/i.test(key)) {
              const xMatch = val.match(/(\d+)\s*x\s*([\d\-]+)/i) || val.match(/(\d+)\s*sets?\s*[x×]\s*([\d\-]+)/i);
              if (xMatch) {
                sets = xMatch[1];
                reps = xMatch[2];
              }
            } else if (/rest/i.test(key)) rest = val;
            else if (/starting\s*weight|weight/i.test(key)) startingWeight = val;
          }
        }
        if (!sets && !reps && content.includes(':')) {
          const colonMatch = content.match(/^(.+?):\s*(.+)$/);
          if (colonMatch) {
            name = colonMatch[1].replace(/^[A-Z]\d+\s*[—\-]\s*/, '').trim();
            const restPart = colonMatch[2];
            const setMatch = restPart.match(/(\d+)\s*sets?\s*[x×]\s*([\d\-]+)\s*reps?/i) || restPart.match(/(\d+)\s*x\s*([\d\-]+)/i);
            if (setMatch) {
              sets = setMatch[1];
              reps = setMatch[2];
            }
            const restMatch = restPart.match(/(\d+)\s*s\s*rest|(\d+)\s*sec|rest\s*(\d+)\s*s/i);
            if (restMatch) rest = (restMatch[1] || restMatch[2] || restMatch[3] || '') + 's';
          }
        }
        if (name && (sets || reps || formCues.length > 0 || name.length > 3)) {
          exercises.push({
            name: cleanText(name),
            sets: sets || '',
            reps: reps || '',
            rest: rest || '',
            startingWeight: startingWeight || '',
            formCues,
          });
        }
      }
    }
    result.days.push({ label, type, isRest, warmUp, exercises, coolDown });
  }
  result.overview = firstOverview || result.overview;
  return result;
}

export default function WorkoutPlanGeneratorScreen({
  userId,
  onBack,
  onPlanGenerated,
  onNavigate,
  onProfilePress,
  onSettingsPress,
  plan: propPlan,
  readOnly = false,
  hideBottomNav = false,
}) {
  const theme = useTheme();
  const { colors, isDark } = theme;

  const iconMetaByKey = {
    personalInfo: { src: require('../../assets/icons/people.png'), glow: Liquid.colors.magenta },
    fitnessLevel: { src: require('../../assets/icons/barbell.png'), glow: Liquid.colors.lightOrange },
    goal: { src: require('../../assets/icons/achievement.png'), glow: Liquid.colors.hotPink },
    equipment: { src: require('../../assets/icons/leg-curl.png'), glow: Liquid.colors.cyan },
    frequency: { src: require('../../assets/icons/electrocardiogram.png'), glow: Liquid.colors.magenta },
    injuries: { src: require('../../assets/icons/patient.png'), glow: Liquid.colors.hotPink },
    trainingEnvironment: { src: require('../../assets/icons/home.png'), glow: Liquid.colors.cyan },
    preferredWorkoutTime: { src: require('../../assets/icons/Schedule.png'), glow: Liquid.colors.magenta },
    exercisesDislike: { src: require('../../assets/icons/exercise.png'), glow: Liquid.colors.lightOrange },
    supplementsCurrentlyTaking: { src: require('../../assets/icons/food.png'), glow: Liquid.colors.hotPink },
    currentStressLevel: { src: require('../../assets/icons/patient.png'), glow: Liquid.colors.hotPink },
    sleepQuality: { src: require('../../assets/icons/bedroom.png'), glow: Liquid.colors.magenta },
    energyLevels: { src: require('../../assets/icons/flames.png'), glow: Liquid.colors.lightOrange },
    hydrationHabits: { src: require('../../assets/icons/water-bottle.png'), glow: Liquid.colors.cyan },
    situationDescription: { src: require('../../assets/icons/destination.png'), glow: Liquid.colors.lightOrange },
  };

  const LiquidIcon = ({ iconKey }) => {
    const meta = iconMetaByKey[iconKey];
    if (!meta) return null;

    return (
      <View style={[styles.iconOuter, { shadowColor: meta.glow }]}>
        <LinearGradient
          colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.00)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.iconBorder}
        >
          <BlurView intensity={20} tint="dark" style={styles.iconBlur}>
            <View style={styles.iconSurface}>
              <Image source={meta.src} style={styles.iconImage} />
            </View>
          </BlurView>
        </LinearGradient>
      </View>
    );
  };

  // State
  const [onboardingData, setOnboardingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const [expandedCard, setExpandedCard] = useState(null);
  const [validationErrors, setValidationErrors] = useState({});
  const [generatedPlan, setGeneratedPlan] = useState(propPlan || null);
  const [addedToCollection, setAddedToCollection] = useState(false);
  const [savingToCollection, setSavingToCollection] = useState(false);
  const [showFullPlan, setShowFullPlan] = useState(!!readOnly);
  const [generatingMessageIndex, setGeneratingMessageIndex] = useState(0);
  const [showEditPlanModal, setShowEditPlanModal] = useState(false);
  const [editPlanText, setEditPlanText] = useState('');
  const [showAllSessions, setShowAllSessions] = useState(false);
  const [pdfLocalUri, setPdfLocalUri] = useState(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState(null);
  const [planTitleForPdf, setPlanTitleForPdf] = useState('');
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [showRawPlanFallback, setShowRawPlanFallback] = useState(false);
  const [pdfGenerationError, setPdfGenerationError] = useState(null);
  const [savedPlansList, setSavedPlansList] = useState([]);
  const [collectionViewingPlan, setCollectionViewingPlan] = useState(null);
  const [planOverviewExpanded, setPlanOverviewExpanded] = useState(false);
  const [expandedDayIndices, setExpandedDayIndices] = useState({});
  const [expandedExerciseIndices, setExpandedExerciseIndices] = useState({});

  // If a pre-loaded plan was passed in (viewer mode), set minimal state and stop loading.
  useEffect(() => {
    if (!propPlan) return;
    const normalizedPlan = {
      ...propPlan,
      planText: propPlan?.planText || propPlan?.rawPlan || propPlan?.text || propPlan?.content || '',
    };
    setGeneratedPlan(normalizedPlan);
    setLoading(false);
    setIsGenerating(false);
    setGenerationError(null);
    if (propPlan.userData && !onboardingData) {
      setOnboardingData(propPlan.userData);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propPlan]);

  const scrollViewRef = useRef(null);
  const shakeAnimations = useRef({});
  const auraAnim = useRef(new Animated.Value(0)).current;

  const GENERATING_MESSAGES = [
    'Analyzing your goals & profile…',
    'Structuring your weekly split…',
    'Balancing volume & recovery…',
    'Selecting exercises for your equipment…',
    'Tuning intensity & progression…',
    'Finalizing your program…',
  ];

  useEffect(() => {
    if (!isGenerating) return;
    const t = setInterval(() => {
      setGeneratingMessageIndex((i) => (i + 1) % GENERATING_MESSAGES.length);
    }, 2200);
    return () => clearInterval(t);
  }, [isGenerating]);

  const resolveClaudeConfig = () => {
    const isRealSecret = (v) => {
      if (typeof v !== 'string') return false;
      const s = v.trim();
      if (!s) return false;
      if (s.startsWith('process.env')) return false;
      if (s.includes('your_key_here') || s.includes('YOUR_') || s.includes('your_claude_key')) return false;
      if (s.length < 20) return false;
      return true;
    };

    const apiKeyCandidate =
      Constants.expoConfig?.extra?.claudeApiKey ||
      Constants.expoConfig?.extra?.anthropicApiKey ||
      process.env.EXPO_PUBLIC_CLAUDE_API_KEY ||
      process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

    const proxyCandidate =
      Constants.expoConfig?.extra?.apiCladeUrl ||
      process.env.EXPO_PUBLIC_API_CLADE_URL;

    const apiKey = isRealSecret(apiKeyCandidate) ? apiKeyCandidate.trim() : null;
    const proxyUrl = (typeof proxyCandidate === 'string' && proxyCandidate.trim().startsWith('http'))
      ? proxyCandidate.trim()
      : null;

    const apiUrl = proxyUrl || 'https://api.anthropic.com/v1/messages';

    return {
      apiUrl,
      apiKey,
      hasAnyConfig: !!(proxyUrl || apiKey),
      usingProxy: !!proxyUrl,
    };
  };

  // Load onboarding data
  useEffect(() => {
    loadOnboardingData();
  }, []);

  // Aura pulse (processing state)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(auraAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(auraAnim, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [auraAnim]);

  const loadOnboardingData = async () => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert('Error', 'User not found');
        if (onBack) onBack();
        return;
      }

      const key = `onboarding_data_${userId}`;
      let loadedData = null;
      if (db) {
        const userSnap = await getDoc(doc(db, 'users', userId));
        if (userSnap.exists()) {
          loadedData = userSnap.data();
          await AsyncStorage.setItem(key, JSON.stringify(loadedData));
          setOnboardingData(loadedData);
        }
      }
      if (!loadedData) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          loadedData = JSON.parse(data);
          setOnboardingData(loadedData);
        } else {
          Alert.alert('Error', 'Onboarding data not found');
          if (onBack) onBack();
        }
      }
      if (userId) {
        const firestorePlan = await getCurrentWorkoutPlan(userId);
        if (firestorePlan?.rawPlan) {
          let structuredPlan = null;
          let planParseError = false;
          try {
            const raw = extractJSON(String(firestorePlan.rawPlan));
            structuredPlan = JSON.parse(raw);
          } catch (e) {
            console.warn('Stored plan JSON parse failed on load:', e);
            // Fallback: legacy text plan -> structured shape
            try {
              const legacy = parsePlan(String(firestorePlan.rawPlan));
              if (legacy && (legacy.overview || (legacy.days && legacy.days.length))) {
                structuredPlan = {
                  overview: legacy.overview || '',
                  weeklySchedule: (legacy.days || []).map(d => ({
                    day: d.label || '',
                    focus: d.type || '',
                  })),
                  days: legacy.days || [],
                  nutritionNotes: '',
                  generalNotes: legacy.notes || '',
                };
                planParseError = false;
              } else {
                planParseError = true;
              }
            } catch (fallbackErr) {
              console.warn('Legacy text parse failed on load:', fallbackErr);
              planParseError = true;
            }
          }
          const saved = {
            id: `plan_${firestorePlan.generatedAt?.toMillis?.() ?? Date.now()}`,
            generatedAt: firestorePlan.generatedAt?.toMillis?.() ?? Date.now(),
            userData: loadedData,
            planText: firestorePlan.rawPlan,
            structuredPlan,
            planParseError,
          };
          setGeneratedPlan(saved);
        } else {
          const planJson = await AsyncStorage.getItem('@workout_plan') || await AsyncStorage.getItem(`workout_plan_${userId}`);
          if (planJson) {
            const saved = JSON.parse(planJson);
            if (saved && (saved.planText || saved.structuredPlan)) {
              if (!saved.structuredPlan && saved.planText) {
                try {
                  const raw = extractJSON(String(saved.planText));
                  saved.structuredPlan = JSON.parse(raw);
                  saved.planParseError = false;
                } catch (e) {
                    console.warn('Stored plan JSON parse failed from AsyncStorage:', e);
                    // Fallback: legacy text -> structured
                    try {
                      const legacy = parsePlan(String(saved.planText));
                      if (legacy && (legacy.overview || (legacy.days && legacy.days.length))) {
                        saved.structuredPlan = {
                          overview: legacy.overview || '',
                          weeklySchedule: (legacy.days || []).map(d => ({
                            day: d.label || '',
                            focus: d.type || '',
                          })),
                          days: legacy.days || [],
                          nutritionNotes: '',
                          generalNotes: legacy.notes || '',
                        };
                        saved.planParseError = false;
                      } else {
                        saved.structuredPlan = null;
                        saved.planParseError = true;
                      }
                    } catch (fallbackErr) {
                      console.warn('Legacy text parse failed from AsyncStorage:', fallbackErr);
                      saved.structuredPlan = null;
                      saved.planParseError = true;
                    }
                }
              }
              setGeneratedPlan(saved);
            }
          }
        }
        const plans = await getWorkoutPlans(userId);
        setSavedPlansList(plans || []);
      }
    } catch (error) {
      console.error('Error loading onboarding data:', error);
      Alert.alert('Error', 'Failed to load onboarding data');
      if (onBack) onBack();
    } finally {
      setLoading(false);
    }
  };

  const saveData = async (updatedData) => {
    try {
      const userId = auth.currentUser?.uid;
      if (!userId) return;
      const key = `onboarding_data_${userId}`;
      await AsyncStorage.setItem(key, JSON.stringify(updatedData));
      setOnboardingData(updatedData);
      if (db) {
        await setDoc(doc(db, 'users', userId), { ...updatedData, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Validate all required fields
  const validateData = () => {
    const errors = {};
    
    if (!onboardingData.weight || onboardingData.weight <= 0) {
      errors.weight = 'Weight is required';
    }
    if (!onboardingData.height || (!onboardingData.height.feet && !onboardingData.height.inches)) {
      errors.height = 'Height is required';
    }
    if (!onboardingData.age || onboardingData.age < 13 || onboardingData.age > 100) {
      errors.age = 'Age must be between 13 and 100';
    }
    if (!onboardingData.gender) {
      errors.gender = 'Gender is required';
    }
    if (!onboardingData.fitnessLevel) {
      errors.fitnessLevel = 'Fitness level is required';
    }
    if (!onboardingData.primaryGoal) {
      errors.goal = 'Primary goal is required';
    }
    if (!onboardingData.equipmentAccess || onboardingData.equipmentAccess.length === 0) {
      errors.equipment = 'At least one equipment option is required';
    }
    if (!onboardingData.daysPerWeek || onboardingData.daysPerWeek < 1 || onboardingData.daysPerWeek > 7) {
      errors.frequency = 'Training frequency is required (1-7 days)';
    }
    if (onboardingData.situationDescription && onboardingData.situationDescription.length > 1000) {
      errors.situationDescription = 'Situation description must be 1000 characters or less';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Trigger shake animation
  const triggerShake = (cardKey) => {
    if (!shakeAnimations.current[cardKey]) {
      shakeAnimations.current[cardKey] = new Animated.Value(0);
    }
    const anim = shakeAnimations.current[cardKey];
    
    Animated.sequence([
      Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  // Generate workout plan
  const generateWorkoutPlan = async () => {
    if (!validateData()) {
      // Scroll to first error and shake
      const firstErrorKey = Object.keys(validationErrors)[0];
      if (firstErrorKey) {
        setExpandedCard(firstErrorKey);
        triggerShake(firstErrorKey);
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({ y: 0, animated: true });
        }, 100);
      }
      Alert.alert('Validation Error', 'Please complete all required information');
      return;
    }

    const { apiUrl, apiKey, hasAnyConfig, usingProxy } = resolveClaudeConfig();

    if (!hasAnyConfig) {
      Alert.alert(
        'Configuration Error',
        "Claude/Anthropic API is not configured.\n\nSet one of these in .env and restart Expo:\n- EXPO_PUBLIC_CLAUDE_API_KEY=sk-ant-...\n- EXPO_PUBLIC_ANTHROPIC_API_KEY=sk-ant-...\n- EXPO_PUBLIC_API_CLADE_URL=https://your-proxy/messages\n\nThen run: npx expo start --clear",
        [{ text: 'OK' }]
      );
      return;
    }
    if (!usingProxy && !apiKey) {
      Alert.alert(
        'Configuration Error',
        'API key is required for direct Anthropic API. Set EXPO_PUBLIC_CLAUDE_API_KEY or EXPO_PUBLIC_ANTHROPIC_API_KEY in .env and restart with: npx expo start --clear',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsGenerating(true);
    setGenerationError(null);

    try {
      console.log('🧠 Workout plan generation config:', {
        hasApiKey: !!apiKey,
        usingProxy,
        apiUrl: apiUrl ? apiUrl.replace(/\/\/([^/]+).*/, '//***') : null,
      });

      const systemPrompt = `You are an expert certified personal trainer and sports scientist. Generate structured, evidence-based workout plans. Follow every rule below with no exceptions.

SCIENTIFIC RULES — NON-NEGOTIABLE:
- Every muscle group must be trained 2–3x per week minimum
- Use these splits based on frequency:
    2–3 days/week → Full Body (compound movements only)
    4 days/week → Upper/Lower split
    5–6 days/week → Push/Pull/Legs
- Never program the same muscle group on consecutive days
- Beginners (0–1 yr experience): compound lifts only — no isolation work
- Intermediate/Advanced: compound base + targeted isolation allowed
- Progressive overload is mandatory — every exercise must have a specific starting weight and rep range
- Rest between sets must be specific: strength = 90–120s, hypertrophy = 60–90s, endurance = 30–45s
- Warm-up is mandatory every session (5–10 min, movement-specific)
- Cool-down is mandatory every session (5 min, static stretching)
- Estimated session time must be realistic: most sessions 45–65 min
- Never exceed 6 exercises per session for beginners
- If the user reports an injury, remove ALL movements that load that structure — no exceptions
- Never place more than 2 consecutive rest days

GOAL-SPECIFIC RULES:
- Fat loss: higher rep ranges (12–15), shorter rest, maintain compound lifts to preserve muscle
- Muscle gain: moderate reps (8–12), longer rest, progressive overload every week
- Strength: lower reps (3–6), heavy load, 2–3 min rest
- Recomposition: treat as muscle gain protocol — note plainly in generalNotes that recomp is slow (12–16 weeks minimum)
- Endurance: circuit-style, minimal rest, bodyweight and light load

EQUIPMENT RULES:
- Bodyweight only: no barbell or dumbbell exercises whatsoever
- Dumbbells only: no barbell movements
- Full gym: barbells as primary compound tool, dumbbells for accessories
- Resistance bands: band-specific alternatives only

HONESTY RULES:
- If frequency is too low for the user's goal, state this plainly in generalNotes
- If equipment limits the plan significantly, say so
- Do not overpromise results

Use web search to verify evidence-based recommendations before generating.

Return ONLY raw JSON. No markdown. No explanation. No backticks.
First character must be { and last character must be }.`;

      const userPrompt = buildUserPrompt(onboardingData);

      const headers = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };
      if (apiKey) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-api-key'] = apiKey;
      }

      const modelNames = [
        'claude-sonnet-4-6',
        'claude-3-5-sonnet-20240620',
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
      ];

      let data = null;
      let lastErr = null;

      for (const model of modelNames) {
        try {
          console.log('🤖 Trying model:', model);
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              model,
              max_tokens: 4000,
              temperature: 0.7,
              system: systemPrompt,
              tools: [{ type: 'web_search_20250305', name: 'web_search' }],
              messages: [
                {
                  role: 'user',
                  content: [{ type: 'text', text: userPrompt }],
                },
                {
                  role: 'assistant',
                  content: [{ type: 'text', text: '{' }],
                },
              ],
            }),
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage =
              errorData?.error?.message ||
              errorData?.error?.type ||
              errorData?.message ||
              `Request failed: ${response.status} ${response.statusText}`;
            console.warn('Claude API error:', response.status, errorData);
            throw new Error(errorMessage);
          }

          data = await response.json();
          console.log('RAW CLAUDE RESPONSE:', JSON.stringify(data.content?.[0]?.text?.substring(0, 1000)));
          if (data?.content?.[0]?.text) break;
          throw new Error('Empty response content');
        } catch (e) {
          lastErr = e;
          continue;
        }
      }

      if (!data?.content?.[0]?.text) {
        throw lastErr || new Error('Failed to generate a plan. Please try again.');
      }

      let planText = data.content[0].text;
      if (!planText || typeof planText !== 'string') {
        throw new Error('Empty response from Claude. Please try again.');
      }
      planText = extractJSON(planText);
      let structuredPlan = null;
      let planParseError = false;
      try {
        structuredPlan = JSON.parse(planText);
      } catch (parseErr) {
        console.warn('Workout plan JSON parse failed:', parseErr);
        // Fallback: try to parse legacy markdown/text plan into a structured shape
        try {
          const legacy = parsePlan(planText);
          if (legacy && (legacy.overview || (legacy.days && legacy.days.length))) {
            structuredPlan = {
              overview: legacy.overview || '',
              weeklySchedule: (legacy.days || []).map(d => ({
                day: d.label || '',
                focus: d.type || '',
              })),
              days: legacy.days || [],
              nutritionNotes: '',
              generalNotes: legacy.notes || '',
            };
            planParseError = false;
          } else {
            planParseError = true;
          }
        } catch (fallbackErr) {
          console.warn('Legacy text parse for workout plan failed:', fallbackErr);
          planParseError = true;
        }
        if (planParseError) {
          setGenerationError('Failed to parse — please regenerate.');
          setGeneratedPlan({
            id: `plan_${Date.now()}`,
            generatedAt: Date.now(),
            userData: onboardingData,
            planText: planText,
            structuredPlan: null,
            planParseError: true,
          });
          return;
        }
      }

      const authedUid = auth.currentUser?.uid;
      const targetUid = userId;
      const planData = {
        id: `plan_${Date.now()}`,
        generatedAt: Date.now(),
        userData: onboardingData,
        planText: planText,
        structuredPlan: structuredPlan,
        planParseError: false,
      };

      // Cache locally for the currently signed-in user (device UX),
      // but write plan artifacts (PDF/Firestore) to the target userId.
      await AsyncStorage.setItem(`workout_plan_${authedUid || 'unknown'}`, JSON.stringify(planData));
      await AsyncStorage.setItem('@workout_plan', JSON.stringify(planData));
      setGeneratedPlan(planData);
      if (targetUid) {
        await setCurrentWorkoutPlan(targetUid, { rawPlan: planText });
      }

      setPdfGenerationError(null);
      setShowRawPlanFallback(false);
      setPdfLocalUri(null);
      setPdfDownloadUrl(null);

      const parsedForPdf = parsePlanForPdf(planText);
      const clientName = onboardingData?.name || onboardingData?.firstName || auth.currentUser?.displayName || 'Client';
      if (parsedForPdf && targetUid) {
        try {
          const { pdfLocalUri: localUri, pdfDownloadUrl: downloadUrl } = await generateAndSavePlanPdf(targetUid, parsedForPdf, clientName);
          setPdfLocalUri(localUri);
          setPdfDownloadUrl(downloadUrl);
          setPlanTitleForPdf(parsedForPdf.title || 'Workout Plan');
          const updated = await getWorkoutPlans(targetUid);
          setSavedPlansList(updated || []);
        } catch (pdfErr) {
          console.warn('PDF generation failed:', pdfErr);
          setShowRawPlanFallback(true);
        }
      } else {
        setShowRawPlanFallback(true);
      }
    } catch (error) {
      console.error('Error generating workout plan:', error);
      setGenerationError(error.message || 'Failed to generate workout plan');
      Alert.alert(
        'Generation Failed',
        error.message || 'We couldn\'t generate your workout plan. Please try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => generateWorkoutPlan() },
        ]
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddToCollection = async () => {
    const targetUid = userId;
    if (!generatedPlan || !targetUid || addedToCollection || savingToCollection) return;
    setSavingToCollection(true);
    try {
      const result = await saveGeneratedPlanToCollection(targetUid, generatedPlan);
      if (result.success) {
        setAddedToCollection(true);
      } else {
        Alert.alert('Could not save', result.error || 'Failed to add plan to collection.');
      }
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save plan.');
    } finally {
      setSavingToCollection(false);
    }
  };

  const handleRegeneratePlan = () => {
    Alert.alert(
      'Regenerate plan?',
      'This will replace your current plan with a new one based on your profile.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Regenerate', onPress: () => generateWorkoutPlan() },
      ]
    );
  };

  const handleOpenEditPlan = () => {
    const raw = generatedPlan?.planText || '';
    setEditPlanText(raw);
    setShowEditPlanModal(true);
  };

  const handleViewPdf = async () => {
    const uid = userId;
    const clientName = onboardingData?.name || onboardingData?.firstName || auth.currentUser?.displayName || 'Client';
    if (pdfDownloadUrl || pdfLocalUri) {
      setShowPdfViewer(true);
      return;
    }
    if (!generatedPlan?.planText || !uid) return;
    const parsed = parsePlanForPdf(generatedPlan.planText);
    if (parsed) {
      try {
        const { pdfLocalUri: localUri, pdfDownloadUrl: downloadUrl } = await generateAndSavePlanPdf(uid, parsed, clientName);
        setPdfLocalUri(localUri);
        setPdfDownloadUrl(downloadUrl);
        setPlanTitleForPdf(parsed.title || 'Workout Plan');
        setShowPdfViewer(true);
      } catch (e) {
        Alert.alert('PDF unavailable', e.message || 'Could not generate PDF.');
      }
    } else {
      setShowPdfViewer(false);
      Alert.alert('PDF unavailable', 'Plan could not be parsed for PDF. Use Edit to view or modify the plan.');
    }
  };

  const handleSaveEditedPlan = async () => {
    let text = (editPlanText || '').trim();
    if (!text) return;
    text = extractJSON(text);
    let structuredPlan = null;
    let planParseError = false;
    try {
      structuredPlan = JSON.parse(text);
    } catch (e) {
      console.warn('Edited plan JSON parse failed:', e);
      // Fallback: legacy text plan -> structured shape
      try {
        const legacy = parsePlan(text);
        if (legacy && (legacy.overview || (legacy.days && legacy.days.length))) {
          structuredPlan = {
            overview: legacy.overview || '',
            weeklySchedule: (legacy.days || []).map(d => ({
              day: d.label || '',
              focus: d.type || '',
            })),
            days: legacy.days || [],
            nutritionNotes: '',
            generalNotes: legacy.notes || '',
          };
          planParseError = false;
        } else {
          planParseError = true;
        }
      } catch (fallbackErr) {
        console.warn('Legacy text parse failed for edited plan:', fallbackErr);
        planParseError = true;
      }
    }
    const planData = {
      id: generatedPlan?.id || `plan_${Date.now()}`,
      generatedAt: generatedPlan?.generatedAt || Date.now(),
      userData: generatedPlan?.userData || onboardingData,
      planText: text,
      structuredPlan,
      planParseError,
    };
    setGeneratedPlan(planData);
    const uid = auth.currentUser?.uid;
    if (uid) {
      await AsyncStorage.setItem(`workout_plan_${uid}`, JSON.stringify(planData));
      await AsyncStorage.setItem('@workout_plan', JSON.stringify(planData));
      await setCurrentWorkoutPlan(uid, { rawPlan: text });
    }
    setShowEditPlanModal(false);
    setPdfGenerationError(null);
    setShowRawPlanFallback(false);
    const parsed = parsePlanForPdf(text);
    const clientName = onboardingData?.name || onboardingData?.firstName || auth.currentUser?.displayName || 'Client';
    if (parsed && uid) {
      try {
        const { pdfLocalUri: localUri, pdfDownloadUrl: downloadUrl } = await generateAndSavePlanPdf(uid, parsed, clientName);
        setPdfLocalUri(localUri);
        setPdfDownloadUrl(downloadUrl);
        setPlanTitleForPdf(parsed.title || 'Workout Plan');
      } catch (_) {
        setShowRawPlanFallback(true);
      }
    } else {
      setShowRawPlanFallback(true);
      setPdfLocalUri(null);
      setPdfDownloadUrl(null);
    }
  };

  // Build user prompt from onboarding data
  const buildUserPrompt = (data) => {
    const heightInches = (data.height?.feet || 0) * 12 + (data.height?.inches || 0);
    const equipmentList = data.equipmentAccess?.join(', ') || 'None';
    const injuries = data.injuries || 'None reported';

    return `Create a comprehensive ${data.daysPerWeek}-day per week workout plan for a client with this profile:

PERSONAL INFO:
- Age: ${data.age} years old
- Gender: ${data.gender}
- Weight: ${data.weight} lbs
- Height: ${heightInches} inches
- Fitness Level: ${data.fitnessLevel}

FITNESS GOALS:
- Primary Goal: ${data.primaryGoal}
- Detailed Situation: "${data.situationDescription || 'Not provided'}"

TRAINING PARAMETERS:
- Available Equipment: ${equipmentList}
- Training Frequency: ${data.daysPerWeek} days per week
- Training Environment: ${data.trainingEnvironment || 'Not specified'}
- Preferred Workout Time: ${data.preferredWorkoutTime || 'Not specified'}
- Injuries/Limitations: ${injuries}
- Exercises to avoid: ${data.exercisesDislike || 'None'}
- Supplements: ${data.supplementsCurrentlyTaking || 'None'}

LIFESTYLE (for recovery and intensity guidance):
- Current stress level: ${data.currentStressLevel || 'Not specified'}
- Sleep quality: ${data.sleepQuality || 'Not specified'}
- Energy levels: ${data.energyLevels || 'Not specified'}
- Hydration: ${data.hydrationHabits === 'less_than_4' ? 'Less than 4 cups/day' : data.hydrationHabits === '4_8' ? '4–8 cups/day' : data.hydrationHabits === 'more_than_8' ? 'More than 8 cups/day' : 'Not specified'}

REQUIRED OUTPUT:

1. PLAN OVERVIEW (2-3 sentences summarizing the approach)

2. WEEKLY SCHEDULE
   - Specify which days to train (e.g., Monday, Wednesday, Friday)
   - Include rest days
   - Note any active recovery recommendations

3. DETAILED WORKOUTS
   For each training day, provide:
   - Workout focus (e.g., Upper Body, Lower Body, Full Body)
   - Warm-up routine (5-10 minutes)
   - Main exercises with:
     * Exercise name
     * Sets x Reps (or time)
     * Rest period between sets
     * Form cues or safety notes
   - Cool-down/stretching (5-10 minutes)

4. PROGRESSIVE OVERLOAD STRATEGY
   - How to increase difficulty over 4-8 weeks
   - Progression timeline

5. NUTRITION GUIDANCE (brief)
   - Calorie range recommendation
   - Protein target
   - Meal timing suggestions

6. EXPECTED TIMELINE
   - When to expect initial results
   - Long-term goal achievement estimate

7. IMPORTANT NOTES
   - Any specific precautions based on injuries/limitations
   - Signs to watch for (overtraining, pain vs. soreness)
   - Modification options

Format the response in clear sections with headers. Be specific with exercise names, sets, reps, and rest times.`;
  };

  // Parse plan response into structured data
  const parsePlanResponse = (planText) => {
    const extractSection = (text, sectionName) => {
      const regex = new RegExp(`${sectionName}[\\s\\S]*?(?=\\d+\\.|$)`, 'i');
      const match = text.match(regex);
      return match ? match[0].replace(sectionName, '').trim() : '';
    };

    return {
      overview: extractSection(planText, 'PLAN OVERVIEW') || extractSection(planText, '1\\. PLAN OVERVIEW'),
      schedule: extractSection(planText, 'WEEKLY SCHEDULE') || extractSection(planText, '2\\. WEEKLY SCHEDULE'),
      workouts: extractWorkouts(planText),
      progression: extractSection(planText, 'PROGRESSIVE OVERLOAD') || extractSection(planText, '4\\. PROGRESSIVE OVERLOAD'),
      nutrition: extractSection(planText, 'NUTRITION GUIDANCE') || extractSection(planText, '5\\. NUTRITION GUIDANCE'),
      timeline: extractSection(planText, 'EXPECTED TIMELINE') || extractSection(planText, '6\\. EXPECTED TIMELINE'),
      notes: extractSection(planText, 'IMPORTANT NOTES') || extractSection(planText, '7\\. IMPORTANT NOTES'),
      rawText: planText,
    };
  };

  const cleanSessionName = (name = '') =>
    name.replace(/^\s*\|\s*/, '').replace(/\s*\|\s*$/, '').trim();

  // Extract workouts from text
  const extractWorkouts = (text) => {
    // Simple extraction - look for workout sections
    const workouts = [];
    const workoutRegex = /(?:Workout|Day)\s*\d+[:\-]?\s*([^\n]+)/gi;
    let match;
    
    while ((match = workoutRegex.exec(text)) !== null) {
      workouts.push({
        day: match[1] || 'Day',
        content: text.substring(match.index, match.index + 500), // First 500 chars
      });
    }

    return workouts.length > 0 ? workouts : [{ day: 'Full Body', content: text.substring(0, 1000) }];
  };

  // Format display value: show "Tap to complete" for empty/placeholder values
  const formatDisplayValue = (raw) => {
    if (raw == null || raw === undefined || raw === '') return null;
    const s = String(raw).trim();
    if (!s) return null;
    if (s === 'Not set' || s === 'None selected' || s === 'None reported' || s === 'Not provided') return null;
    if (s === 'undefined' || s.toLowerCase() === 'undefined') return null;
    if (/^N\/A,\s*N\/Ayrs,\s*N\/Albs,\s*0'0"$/i.test(s)) return null;
    if (/^0\s*days\s*per\s*week$/i.test(s)) return null;
    return s;
  };

  const ionIconByKey = {
    personalInfo: 'person',
    fitnessLevel: 'barbell',
    goal: 'trophy',
    equipment: 'fitness',
    frequency: 'calendar',
    injuries: 'medkit',
    trainingEnvironment: 'home',
    preferredWorkoutTime: 'time',
    exercisesDislike: 'fitness',
    supplementsCurrentlyTaking: 'nutrition',
    currentStressLevel: 'pulse',
    sleepQuality: 'bed',
    energyLevels: 'flash',
    hydrationHabits: 'water',
    situationDescription: 'sparkles',
  };

  // Render editable card
  const renderEditableCard = (key, title, content, renderEditContent) => {
    const isExpanded = expandedCard === key;
    const hasError = validationErrors[key];
    const shakeAnim = shakeAnimations.current[key] || new Animated.Value(0);
    const displayValue = formatDisplayValue(content);
    const showTapToComplete = !displayValue;

    const meta = iconMetaByKey[key];

    const cardStyle = [
      styles.card,
      hasError && { borderColor: '#EF4444' },
      !isDark && { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(0,0,0,0.08)' },
      { transform: [{ translateX: shakeAnim }] },
    ];

    return (
      <Animated.View style={cardStyle}>
        <TouchableOpacity
          onPress={() => setExpandedCard(isExpanded ? null : key)}
          style={styles.cardHeader}
          activeOpacity={0.85}
        >
          {meta && (
            <Image
              source={meta.src}
              style={styles.cardIconImage}
              resizeMode="contain"
            />
          )}
          <View style={styles.cardTextWrap}>
            <Text style={[styles.cardTitle, { color: isDark ? '#FFFFFF' : '#1a0a2e' }]}>{title}</Text>
            {!isExpanded && (
              <Text style={[styles.cardValue, showTapToComplete && styles.cardValuePlaceholder, { color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.6)' }, showTapToComplete && { color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(26,10,46,0.5)' }]}>
                {showTapToComplete ? 'Tap to complete' : displayValue}
              </Text>
            )}
          </View>
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-forward'}
            size={20}
            color={isDark ? 'rgba(255,255,255,0.45)' : 'rgba(26,10,46,0.5)'}
          />
        </TouchableOpacity>

        {isExpanded && (
          <View style={[styles.cardEditContent, !isDark && { borderTopColor: 'rgba(0,0,0,0.08)' }]}>
            {renderEditContent()}
            <TouchableOpacity
              onPress={() => {
                setExpandedCard(null);
                saveData(onboardingData);
              }}
              style={[styles.doneButton, { backgroundColor: '#6C5CE7' }]}
            >
              <Text style={styles.doneButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
        <ActivityIndicator size="large" color="#6C5CE7" />
      </View>
    );
  }

  if (!onboardingData && !propPlan) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0A0618' : '#F5F3FF' }]}>
        <Text style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>No data found</Text>
      </View>
    );
  }

  const rootBg = isDark ? ['#0a0a1a', '#1a0a2e', '#0d1117'] : ['#F5F3FF', '#EDE9FE', '#E9E5FF'];
  const textPrimary = isDark ? '#FFFFFF' : '#1a0a2e';
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(26,10,46,0.6)';

  // Full-screen viewer mode (no editor UI).
  if (generatedPlan && (readOnly || showFullPlan)) {
    let structured = generatedPlan?.structuredPlan || tryParsePlanJson(generatedPlan?.planText);
    if (Array.isArray(structured)) {
      structured = { days: structured };
    }
    return (
      <View style={styles.root}>
        <LinearGradient colors={rootBg} style={StyleSheet.absoluteFill} />
        <SafeAreaView style={styles.container} edges={['top']}>
          <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

          <CoachConnectHeader
            title="Workout Plan"
            isDark={isDark}
            onBack={() => {
              if (readOnly) {
                onBack?.();
              } else {
                setShowFullPlan(false);
              }
            }}
            onProfilePress={onProfilePress}
            onSettingsPress={onSettingsPress}
          />

          {!readOnly ? (
            <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowFullPlan(false)}
                style={{
                  flex: 1,
                  height: 40,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255,107,157,0.14)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,107,157,0.35)',
                }}
              >
                <Text style={{ color: '#FF6B9D', fontWeight: '800' }}>Back to Builder</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
            {structured && (structured.days || structured.weeklySchedule) ? (
              <View style={{ paddingTop: 8 }}>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 }}>
                  Personalized Workout Plan
                </Text>
                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>
                  {generatedPlan?.generatedAt
                    ? new Date(generatedPlan.generatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'Generated'}
                </Text>

                {!!structured.overview && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#C084FC', padding: 14, marginBottom: 24 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: '#C084FC', marginBottom: 8 }}>OVERVIEW</Text>
                    <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 22 }}>{String(structured.overview)}</Text>
                  </View>
                )}

                {(structured.weeklySchedule || []).length > 0 && (
                  <>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#FFFFFF', marginBottom: 12, letterSpacing: 0.2 }}>Weekly Schedule</Text>
                    <View style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' }}>
                      <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', paddingVertical: 8, paddingHorizontal: 14 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, width: 108 }}>DAY</Text>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)', letterSpacing: 1, flex: 1 }}>FOCUS</Text>
                      </View>
                      {(structured.weeklySchedule || []).map((item, i) => (
                        <View key={i} style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#FFFFFF', width: 108 }}>{String(item.day || '')}</Text>
                          <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', flex: 1, lineHeight: 19 }}>{String(item.focus || '')}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                )}

                {(structured.days || []).map((day, di) => {
                  if (day?.isRest === true) {
                    return (
                      <View key={di} style={{ marginBottom: 16, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)', backgroundColor: 'rgba(255,255,255,0.02)', padding: 14 }}>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>{String(day.label || `Day ${di + 1}`)}</Text>
                        {day.restGuidance ? <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 20 }}>{String(day.restGuidance)}</Text> : null}
                      </View>
                    );
                  }

                  const accent = TYPE_COLORS[day?.type] || '#64D2FF';
                  return (
                    <View key={di} style={{ marginBottom: 28 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 10 }}>
                        <View style={{ width: 4, height: 24, borderRadius: 2, backgroundColor: accent }} />
                        <Text style={{ fontSize: 22, fontWeight: '800', color: WP.dayTitle, flex: 1 }}>
                          {String(day?.label || `Day ${di + 1}`)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, paddingLeft: 14 }}>
                        {(day?.primaryMuscles || []).length > 0 && (
                          <Text style={{ fontSize: 13, color: WP.dayMeta }}>
                            {day.primaryMuscles.join(' · ')}
                          </Text>
                        )}
                        {day?.estimatedTime ? (
                          <Text style={{ fontSize: 12, color: WP.duration }}>
                            {'  '}
                            {String(day.estimatedTime)}
                          </Text>
                        ) : null}
                      </View>

                      {(day?.warmUp || []).length > 0 && (
                        <View style={{ marginBottom: 16 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: WP.sectionLabel, marginBottom: 10, marginTop: 6, paddingLeft: 14 }}>
                            WARM-UP
                          </Text>
                          <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: '#141414', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 }}>
                            {day.warmUp.map((item, wi) => (
                              <View key={wi} style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: wi === day.warmUp.length - 1 ? 0 : 1, borderBottomColor: 'rgba(255,255,255,0.06)', gap: 12 }}>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#FFFFFF', lineHeight: 20 }}>
                                    {String(item.name || '')}
                                  </Text>
                                  {item.description ? (
                                    <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3, lineHeight: 17 }}>
                                      {String(item.description)}
                                    </Text>
                                  ) : null}
                                </View>
                                <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', flexShrink: 0, textAlign: 'right', minWidth: 70 }}>
                                  {String(item.duration || '')}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      )}

                      {(day?.exercises || []).length > 0 && (
                        <View style={{ marginBottom: 16 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: '#C084FC', letterSpacing: 1.5, marginBottom: 10, marginTop: 6, paddingLeft: 14 }}>
                            EXERCISES
                          </Text>
                          {day.exercises.map((ex, ei) => (
                            <View key={ei} style={{ backgroundColor: '#141414', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 18, padding: 18, marginBottom: 14 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                                <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: '#FFFFFF', lineHeight: 23, flexShrink: 1 }} numberOfLines={3}>
                                  {String(ex.name || '')}
                                </Text>
                                <View style={{ alignItems: 'flex-end', flexShrink: 0, minWidth: 80 }}>
                                  {ex.sets || ex.reps ? (
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#64D2FF' }}>
                                      {ex.sets && ex.reps
                                        ? `${String(ex.sets)} × ${String(ex.reps)}`
                                        : ex.sets
                                          ? `${String(ex.sets)} sets`
                                          : `${String(ex.reps)} reps`}
                                    </Text>
                                  ) : null}
                                  {ex.rest ? (
                                    <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                      {String(ex.rest)} rest
                                    </Text>
                                  ) : null}
                                </View>
                              </View>

                              {ex.startingWeight ? (
                                <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 8 }}>
                                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#F97316', letterSpacing: 1, flexShrink: 0, paddingTop: 1 }}>
                                    START WEIGHT
                                  </Text>
                                  <Text style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 20 }}>
                                    {String(ex.startingWeight)}
                                  </Text>
                                </View>
                              ) : null}

                              {(ex.formCues || []).length > 0 && (
                                <View style={{ paddingTop: 4, marginTop: 4 }}>
                                  <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>
                                    FORM CUES
                                  </Text>
                                  {ex.formCues.map((cue, ci) => (
                                    <View key={ci} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 4 }}>
                                      <Text style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', lineHeight: 20 }}>·</Text>
                                      <Text style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 21 }}>
                                        {String(cue)}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={{ borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', backgroundColor: 'rgba(255,255,255,0.04)', padding: 14 }}>
                <Markdown style={MARKDOWN_STYLES}>
                  {normalizePlanMarkdown(stripEmojis(generatedPlan?.planText || ''))}
                </Markdown>
              </View>
            )}
          </ScrollView>

          <WorkoutPlanPdfViewerModal
            visible={showPdfViewer}
            pdfLocalUri={pdfLocalUri}
            pdfDownloadUrl={collectionViewingPlan ? collectionViewingPlan.url : pdfDownloadUrl}
            planTitle={collectionViewingPlan ? collectionViewingPlan.planTitle : planTitleForPdf}
            isDark={isDark}
            onClose={() => {
              setShowPdfViewer(false);
              setCollectionViewingPlan(null);
            }}
          />
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
    <LinearGradient
      colors={rootBg}
      style={StyleSheet.absoluteFill}
    />
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <CoachConnectHeader
        title="Build Your Plan"
        isDark={isDark}
        onBack={onBack}
        onProfilePress={onProfilePress}
        onSettingsPress={onSettingsPress}
      />

      {/* Generating overlay */}
      {isGenerating && (
        <View style={styles.generatingOverlay} pointerEvents="box-none">
          <View style={styles.generatingBackdrop} />
          <View style={styles.generatingCard}>
            <LinearGradient
              colors={['rgba(124,58,237,0.35)', 'rgba(168,85,247,0.2)', 'rgba(236,72,153,0.2)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.generatingIconRing}
            >
              <View style={styles.generatingIconInner}>
                <Ionicons name="barbell" size={32} color="rgba(255,255,255,0.95)" />
              </View>
            </LinearGradient>
            <Text style={[styles.generatingTitle, { color: textPrimary }]}>Building your plan</Text>
            <Text style={[styles.generatingMessage, { color: textSecondary }]}>
              {GENERATING_MESSAGES[generatingMessageIndex]}
            </Text>
            <View style={styles.generatingDots}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.generatingDot,
                  ]}
                />
              ))}
            </View>
            <Text style={[styles.generatingHint, { color: textSecondary }]}>Usually 10–20 seconds</Text>
          </View>
        </View>
      )}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* My plans collection — persisted from Firestore, stays when navigating away */}
        {savedPlansList.length > 0 && (
          <View style={styles.collectionSection}>
            <Text style={[styles.collectionTitle, { color: textPrimary }]}>My plans</Text>
            <Text style={[styles.collectionSubtitle, { color: textSecondary }]}>
              Saved plans stay here. Tap to view PDF.
            </Text>
            {savedPlansList.map((plan) => {
              const dateStr = plan.generatedAt?.toDate?.()
                ? new Date(plan.generatedAt.toDate()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : plan.generatedAt?.seconds
                  ? new Date(plan.generatedAt.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'Saved';
              return (
                <TouchableOpacity
                  key={plan.id}
                  activeOpacity={0.85}
                  onPress={() => {
                    if (plan.url) {
                      setCollectionViewingPlan({ url: plan.url, planTitle: plan.planTitle || 'Workout Plan' });
                      setShowPdfViewer(true);
                    }
                  }}
                  style={[styles.collectionCard, !isDark && { backgroundColor: 'rgba(255,255,255,0.9)', borderColor: 'rgba(0,0,0,0.08)' }]}
                >
                  <View style={styles.collectionCardLeft}>
                    <View style={[styles.collectionCardIcon, !isDark && { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                      <Ionicons name="document-text" size={22} color={isDark ? '#a78bfa' : '#7c3aed'} />
                    </View>
                    <View style={styles.collectionCardText}>
                      <Text style={[styles.collectionCardTitle, { color: textPrimary }]} numberOfLines={1}>
                        {plan.planTitle || 'Workout Plan'}
                      </Text>
                      <Text style={[styles.collectionCardDate, { color: textSecondary }]}>{dateStr}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={textSecondary} />
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Plan result summary + CTA (full viewer is separate) */}
        {generatedPlan && !readOnly && !showFullPlan && (
          <View style={styles.planResultWrap}>
            <View style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 }}>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: '800',
                  color: isDark ? '#fff' : textPrimary,
                  marginBottom: 4,
                }}
              >
                Personalized Workout Plan
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: isDark ? 'rgba(255,255,255,0.5)' : textSecondary,
                  marginBottom: 12,
                }}
              >
                {generatedPlan?.generatedAt
                  ? new Date(generatedPlan.generatedAt).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })
                  : 'Generated'}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: isDark ? 'rgba(255,255,255,0.65)' : textSecondary,
                  marginBottom: 16,
                }}
                numberOfLines={3}
              >
                Your full workout plan is ready. Tap below to open the detailed viewer.
              </Text>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => setShowFullPlan(true)}
                style={{
                  height: 44,
                  borderRadius: 12,
                  overflow: 'hidden',
                }}
              >
                <LinearGradient
                  colors={['#FF6B9D', '#C084FC']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'row',
                    gap: 8,
                  }}
                >
                  <Ionicons name="document-text-outline" size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                    View full plan
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {generatedPlan && !readOnly && !showFullPlan && (
          <View style={styles.planResultActions}>
            <TouchableOpacity
              onPress={handleAddToCollection}
              disabled={addedToCollection || savingToCollection}
              activeOpacity={0.85}
              style={[styles.addToCollectionBtn, (addedToCollection || savingToCollection) && styles.addToCollectionBtnDisabled]}
            >
              <LinearGradient
                colors={addedToCollection ? ['#22c55e', '#16a34a'] : ['#22c55e', '#16a34a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addToCollectionGrad}
              >
                {savingToCollection ? <ActivityIndicator size="small" color="#fff" /> : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.addToCollectionBtnText}>{addedToCollection ? 'Added to collection' : 'Add to collection'}</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowFullPlan(true)}
              style={styles.openPlanBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="document-text-outline" size={18} color={Liquid.colors.cyan} />
              <Text style={styles.openPlanBtnText}>View full plan</Text>
              <Ionicons name="chevron-forward" size={18} color={Liquid.colors.cyan} />
            </TouchableOpacity>

            <View style={styles.planResultSecondaryActions}>
              <TouchableOpacity onPress={handleOpenEditPlan} style={styles.planResultSecondaryBtnEdit} activeOpacity={0.8}>
                <Ionicons name="create-outline" size={18} color="#fff" />
                <Text style={styles.planResultSecondaryBtnText}>Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleRegeneratePlan} style={styles.planResultSecondaryBtnRegen} activeOpacity={0.8} disabled={isGenerating}>
                <Ionicons name="refresh-outline" size={18} color="#fff" />
                <Text style={styles.planResultSecondaryBtnText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Review Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textPrimary }]}>Review your profile</Text>
          <Text style={[styles.sectionSubtitle, { color: textSecondary }]}>Tap any card to edit.</Text>
        </View>

        {/* Personal Info Card */}
        {renderEditableCard(
          'personalInfo',
          'Personal Info',
          `${onboardingData.gender || 'N/A'}, ${onboardingData.age || 'N/A'}yrs, ${onboardingData.weight || 'N/A'}lbs, ${onboardingData.height?.feet || 0}'${onboardingData.height?.inches || 0}"`,
          () => (
            <View style={styles.editFields}>
              <View style={styles.editField}>
                <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Weight (lbs)</Text>
                <TextInput
                  style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.weight ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
                  value={onboardingData.weight?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseFloat(text);
                    setOnboardingData(prev => ({ ...prev, weight: isNaN(num) ? null : num }));
                    if (validationErrors.weight) {
                      setValidationErrors(prev => ({ ...prev, weight: null }));
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="180"
                />
              </View>
              <View style={styles.editFieldRow}>
                <View style={[styles.editField, { flex: 1, marginRight: 8 }]}>
                  <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Feet</Text>
                  <TextInput
                    style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.height ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
                    value={onboardingData.height?.feet?.toString() || ''}
                    onChangeText={(text) => {
                      const num = parseInt(text);
                      setOnboardingData(prev => ({
                        ...prev,
                        height: { ...prev.height, feet: isNaN(num) ? null : num, inches: prev.height?.inches || 0 },
                      }));
                      if (validationErrors.height) {
                        setValidationErrors(prev => ({ ...prev, height: null }));
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="6"
                  />
                </View>
                <View style={[styles.editField, { flex: 1, marginLeft: 8 }]}>
                  <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Inches</Text>
                  <TextInput
                    style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.height ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
                    value={onboardingData.height?.inches?.toString() || ''}
                    onChangeText={(text) => {
                      const num = parseInt(text);
                      setOnboardingData(prev => ({
                        ...prev,
                        height: { ...prev.height, feet: prev.height?.feet || 0, inches: isNaN(num) ? null : num },
                      }));
                      if (validationErrors.height) {
                        setValidationErrors(prev => ({ ...prev, height: null }));
                      }
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                  />
                </View>
              </View>
              <View style={styles.editField}>
                <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Age</Text>
                <TextInput
                  style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.age ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
                  value={onboardingData.age?.toString() || ''}
                  onChangeText={(text) => {
                    const num = parseInt(text);
                    setOnboardingData(prev => ({ ...prev, age: isNaN(num) ? null : num }));
                    if (validationErrors.age) {
                      setValidationErrors(prev => ({ ...prev, age: null }));
                    }
                  }}
                  keyboardType="numeric"
                  placeholder="28"
                />
              </View>
              <View style={styles.editField}>
                <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Gender</Text>
                <View style={styles.optionRow}>
                  {['Male', 'Female', 'Other', 'Prefer not to say'].map((option) => (
                    <TouchableOpacity
                      key={option}
                      onPress={() => {
                        setOnboardingData(prev => ({ ...prev, gender: option }));
                        if (validationErrors.gender) {
                          setValidationErrors(prev => ({ ...prev, gender: null }));
                        }
                      }}
                      style={[
                        styles.optionButton,
                        {
                          backgroundColor: onboardingData.gender === option ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                        },
                      ]}
                    >
                      <Text style={[styles.optionButtonText, { color: onboardingData.gender === option ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ),
        )}

        {/* Fitness Level Card */}
        {renderEditableCard(
          'fitnessLevel',
          'Fitness Experience',
          onboardingData.fitnessLevel ? onboardingData.fitnessLevel.charAt(0).toUpperCase() + onboardingData.fitnessLevel.slice(1) : 'Not set',
          () => (
            <View style={styles.editFields}>
              {['beginner', 'intermediate', 'advanced'].map((level) => (
                <TouchableOpacity
                  key={level}
                  onPress={() => {
                    setOnboardingData(prev => ({ ...prev, fitnessLevel: level }));
                    if (validationErrors.fitnessLevel) {
                      setValidationErrors(prev => ({ ...prev, fitnessLevel: null }));
                    }
                  }}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: onboardingData.fitnessLevel === level ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                    },
                  ]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.fitnessLevel === level ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Primary Goal Card */}
        {renderEditableCard(
          'goal',
          'Primary Goal',
          onboardingData.primaryGoal ? onboardingData.primaryGoal.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'Not set',
          () => (
            <View style={styles.editFields}>
              {[
                { value: 'lose_fat', label: 'Lose Fat' },
                { value: 'build_muscle', label: 'Build Muscle' },
                { value: 'maintain_health', label: 'Maintain Health' },
                { value: 'athletic_performance', label: 'Athletic Performance' },
              ].map((goal) => (
                <TouchableOpacity
                  key={goal.value}
                  onPress={() => {
                    setOnboardingData(prev => ({ ...prev, primaryGoal: goal.value }));
                    if (validationErrors.goal) {
                      setValidationErrors(prev => ({ ...prev, goal: null }));
                    }
                  }}
                  style={[
                    styles.optionCard,
                    {
                      backgroundColor: onboardingData.primaryGoal === goal.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                    },
                  ]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.primaryGoal === goal.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {goal.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Equipment Card */}
        {renderEditableCard(
          'equipment',
          'Equipment Access',
          onboardingData.equipmentAccess?.join(', ') || 'None selected',
          () => (
            <View style={styles.editFields}>
              {['gym', 'dumbbells', 'bands', 'pullup_bar', 'bodyweight'].map((equip) => {
                const isSelected = onboardingData.equipmentAccess?.includes(equip);
                return (
                  <TouchableOpacity
                    key={equip}
                    onPress={() => {
                      const current = onboardingData.equipmentAccess || [];
                      const updated = isSelected
                        ? current.filter(e => e !== equip)
                        : [...current, equip];
                      setOnboardingData(prev => ({ ...prev, equipmentAccess: updated }));
                      if (validationErrors.equipment) {
                        setValidationErrors(prev => ({ ...prev, equipment: null }));
                      }
                    }}
                    style={[
                      styles.optionCard,
                      {
                        backgroundColor: isSelected ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                      },
                    ]}
                  >
                    <Text style={[styles.optionCardText, { color: isSelected ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                      {equip.charAt(0).toUpperCase() + equip.slice(1).replace('_', ' ')}
                      {isSelected && ' ✓'}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ),
        )}

        {/* Training Frequency Card */}
        {renderEditableCard(
          'frequency',
          'Training Frequency',
          `${onboardingData.daysPerWeek || 0} days per week`,
          () => (
            <View style={styles.editFields}>
              <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>
                Days per week: {onboardingData.daysPerWeek || 0}
              </Text>
              <View style={styles.frequencySelector}>
                {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                  <TouchableOpacity
                    key={days}
                    onPress={() => {
                      setOnboardingData(prev => ({ ...prev, daysPerWeek: days }));
                      if (validationErrors.frequency) {
                        setValidationErrors(prev => ({ ...prev, frequency: null }));
                      }
                    }}
                    style={[
                      styles.frequencyButton,
                      {
                        backgroundColor: onboardingData.daysPerWeek === days ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                      },
                    ]}
                  >
                    <Text style={[styles.frequencyButtonText, { color: onboardingData.daysPerWeek === days ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                      {days}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ),
        )}

        {/* Injuries Card */}
        {renderEditableCard(
          'injuries',
          'Injuries & Limitations',
          onboardingData.injuries || 'None reported',
          () => (
            <View style={styles.editFields}>
              <TextInput
                style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }]}
                value={onboardingData.injuries || ''}
                onChangeText={(text) => setOnboardingData(prev => ({ ...prev, injuries: text }))}
                placeholder="Describe any injuries or limitations..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                multiline
                textAlignVertical="top"
              />
            </View>
          ),
        )}

        {/* Training Environment Card */}
        {renderEditableCard(
          'trainingEnvironment',
          'Training Environment',
          onboardingData.trainingEnvironment ? onboardingData.trainingEnvironment.charAt(0).toUpperCase() + onboardingData.trainingEnvironment.slice(1) : 'Not set',
          () => (
            <View style={styles.editFields}>
              {[
                { value: 'home', label: 'Home' },
                { value: 'gym', label: 'Gym' },
                { value: 'both', label: 'Both' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setOnboardingData(prev => ({ ...prev, trainingEnvironment: opt.value }))}
                  style={[styles.optionCard, { backgroundColor: onboardingData.trainingEnvironment === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.trainingEnvironment === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Preferred Workout Time Card */}
        {renderEditableCard(
          'preferredWorkoutTime',
          'Preferred Workout Time',
          onboardingData.preferredWorkoutTime ? onboardingData.preferredWorkoutTime.charAt(0).toUpperCase() + onboardingData.preferredWorkoutTime.slice(1) : 'Not set',
          () => (
            <View style={styles.editFields}>
              {[
                { value: 'morning', label: 'Morning' },
                { value: 'afternoon', label: 'Afternoon' },
                { value: 'evening', label: 'Evening' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setOnboardingData(prev => ({ ...prev, preferredWorkoutTime: opt.value }))}
                  style={[styles.optionCard, { backgroundColor: onboardingData.preferredWorkoutTime === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.preferredWorkoutTime === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Exercises You Dislike Card */}
        {renderEditableCard(
          'exercisesDislike',
          'Exercises You Dislike',
          onboardingData.exercisesDislike || 'None',
          () => (
            <View style={styles.editFields}>
              <TextInput
                style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }]}
                value={onboardingData.exercisesDislike || ''}
                onChangeText={(text) => setOnboardingData(prev => ({ ...prev, exercisesDislike: text }))}
                placeholder="e.g. burpees, running..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                multiline
                textAlignVertical="top"
              />
            </View>
          ),
        )}

        {/* Supplements Card */}
        {renderEditableCard(
          'supplementsCurrentlyTaking',
          'Supplements',
          onboardingData.supplementsCurrentlyTaking || 'None',
          () => (
            <View style={styles.editFields}>
              <TextInput
                style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }]}
                value={onboardingData.supplementsCurrentlyTaking || ''}
                onChangeText={(text) => setOnboardingData(prev => ({ ...prev, supplementsCurrentlyTaking: text }))}
                placeholder="List any supplements you take..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                multiline
                textAlignVertical="top"
              />
            </View>
          ),
        )}

        {/* Current Stress Level Card */}
        {renderEditableCard(
          'currentStressLevel',
          'Current Stress Level',
          onboardingData.currentStressLevel ? onboardingData.currentStressLevel.charAt(0).toUpperCase() + onboardingData.currentStressLevel.slice(1) : 'Not set',
          () => (
            <View style={styles.editFields}>
              {[
                { value: 'low', label: 'Low' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'high', label: 'High' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setOnboardingData(prev => ({ ...prev, currentStressLevel: opt.value }))}
                  style={[styles.optionCard, { backgroundColor: onboardingData.currentStressLevel === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.currentStressLevel === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Sleep Quality Card */}
        {renderEditableCard(
          'sleepQuality',
          'Sleep Quality',
          onboardingData.sleepQuality ? onboardingData.sleepQuality.charAt(0).toUpperCase() + onboardingData.sleepQuality.slice(1) : 'Not set',
          () => (
            <View style={styles.editFields}>
              {[
                { value: 'poor', label: 'Poor' },
                { value: 'fair', label: 'Fair' },
                { value: 'good', label: 'Good' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setOnboardingData(prev => ({ ...prev, sleepQuality: opt.value }))}
                  style={[styles.optionCard, { backgroundColor: onboardingData.sleepQuality === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.sleepQuality === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Energy Levels Card */}
        {renderEditableCard(
          'energyLevels',
          'Energy Levels',
          onboardingData.energyLevels ? onboardingData.energyLevels.charAt(0).toUpperCase() + onboardingData.energyLevels.slice(1) : 'Not set',
          () => (
            <View style={styles.editFields}>
              {[
                { value: 'low', label: 'Low' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'high', label: 'High' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setOnboardingData(prev => ({ ...prev, energyLevels: opt.value }))}
                  style={[styles.optionCard, { backgroundColor: onboardingData.energyLevels === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.energyLevels === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Hydration Habits Card */}
        {renderEditableCard(
          'hydrationHabits',
          'Hydration Habits',
          onboardingData.hydrationHabits === 'less_than_4' ? 'Less than 4 cups/day' : onboardingData.hydrationHabits === '4_8' ? '4–8 cups/day' : onboardingData.hydrationHabits === 'more_than_8' ? 'More than 8 cups/day' : 'Not set',
          () => (
            <View style={styles.editFields}>
              {[
                { value: 'less_than_4', label: 'Less than 4 cups/day' },
                { value: '4_8', label: '4–8 cups/day' },
                { value: 'more_than_8', label: 'More than 8 cups/day' },
              ].map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  onPress={() => setOnboardingData(prev => ({ ...prev, hydrationHabits: opt.value }))}
                  style={[styles.optionCard, { backgroundColor: onboardingData.hydrationHabits === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
                >
                  <Text style={[styles.optionCardText, { color: onboardingData.hydrationHabits === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ),
        )}

        {/* Situation Description Card */}
        {renderEditableCard(
          'situationDescription',
          'Your Fitness Journey',
          onboardingData.situationDescription?.substring(0, 100) + (onboardingData.situationDescription?.length > 100 ? '...' : '') || 'Not provided',
          () => (
            <View style={styles.editFields}>
              <TextInput
                style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.situationDescription ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
                value={onboardingData.situationDescription || ''}
                onChangeText={(text) => {
                  if (text.length <= 1000) {
                    setOnboardingData(prev => ({ ...prev, situationDescription: text }));
                    if (validationErrors.situationDescription) {
                      setValidationErrors(prev => ({ ...prev, situationDescription: null }));
                    }
                  }
                }}
                placeholder="Tell us about your fitness journey and goals..."
                placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
                multiline
                textAlignVertical="top"
                minHeight={200}
              />
              <Text style={[styles.charCount, { color: (onboardingData.situationDescription?.length || 0) < 50 ? '#F59E0B' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)') }]}>
                {onboardingData.situationDescription?.length || 0}/1000 (min 50)
              </Text>
            </View>
          ),
        )}

        {/* Generation Section */}
        <View style={styles.generationSection}>
          {generationError && (
            <View style={styles.generationErrorBanner}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styles.generationErrorText}>{generationError}</Text>
              <TouchableOpacity onPress={() => { setGenerationError(null); generateWorkoutPlan(); }} style={styles.generationErrorRetry}>
                <Text style={styles.generationErrorRetryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={styles.generationCard}>
          <Text style={styles.generationTitle}>Generate Your Plan</Text>
          <Text style={styles.generationSubtitle}>
            We’ll tailor split, volume, and progression using your profile.
          </Text>

          <TouchableOpacity
            onPress={generateWorkoutPlan}
            disabled={isGenerating}
            activeOpacity={0.85}
            style={styles.generateBtnTouch}
          >
            <LinearGradient
              colors={['#7c3aed', '#a855f7', '#ec4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.generateBtnGrad}
            >
              <Text style={styles.generateBtnText}>
                {isGenerating ? 'Generating…' : 'Generate Workout Plan'}
              </Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <WorkoutPlanPdfViewerModal
        visible={showPdfViewer}
        pdfLocalUri={collectionViewingPlan ? null : pdfLocalUri}
        pdfDownloadUrl={collectionViewingPlan ? collectionViewingPlan.url : pdfDownloadUrl}
        planTitle={collectionViewingPlan ? collectionViewingPlan.planTitle : (planTitleForPdf || 'Workout Plan')}
        clientName={onboardingData?.name || onboardingData?.firstName || auth.currentUser?.displayName}
        isDark={isDark}
        onClose={() => {
          setShowPdfViewer(false);
          setCollectionViewingPlan(null);
        }}
      />

      {/* Edit Plan Modal */}
      <Modal visible={showEditPlanModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editPlanModalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.editPlanModalBackdrop}
            onPress={() => setShowEditPlanModal(false)}
          />
          <View style={styles.editPlanModalContent}>
            <View style={styles.editPlanModalHeader}>
              <Text style={styles.editPlanModalTitle}>Edit plan</Text>
              <TouchableOpacity
                onPress={() => setShowEditPlanModal(false)}
                style={styles.editPlanModalClose}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Markdown preview */}
            <View style={styles.markdownPreviewCard}>
              <Text style={styles.markdownPreviewLabel}>Preview</Text>
              <ScrollView
                style={styles.markdownPreviewScroll}
                contentContainerStyle={styles.markdownPreviewContent}
                showsVerticalScrollIndicator={false}
              >
                <Markdown style={MARKDOWN_STYLES}>
                  {normalizePlanMarkdown(stripEmojis(editPlanText || generatedPlan?.planText || ''))}
                </Markdown>
              </ScrollView>
            </View>

            {/* Raw markdown editor */}
            <Text style={styles.rawEditorLabel}>Raw markdown</Text>
            <TextInput
              style={styles.editPlanModalInput}
              value={editPlanText}
              onChangeText={setEditPlanText}
              placeholder="Paste or edit your workout plan text..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              multiline
              textAlignVertical="top"
            />

            <View style={styles.editPlanModalActions}>
              <TouchableOpacity
                onPress={() => setShowEditPlanModal(false)}
                style={styles.editPlanModalCancelBtn}
              >
                <Text style={styles.editPlanModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSaveEditedPlan}
                style={styles.editPlanModalSaveBtn}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={['#7c3aed', '#a855f7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.editPlanModalSaveGrad}
                >
                  <Text style={styles.editPlanModalSaveText}>Save</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {!hideBottomNav && (
        <BottomNavBar
          onHomePress={() => (onNavigate ? onNavigate('home') : onBack?.())}
          onProfilePress={() => onNavigate && onNavigate('profile')}
          onPlusPress={() => onNavigate && onNavigate('create')}
          onVoicePress={() => onNavigate && onNavigate('voice')}
          onWorkoutPress={() => onNavigate && onNavigate('workout')}
          onNutritionPress={() => onNavigate && onNavigate('nutrition')}
        />
      )}
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerWrap: {
    paddingHorizontal: Liquid.spacing.gutter,
    paddingTop: 6,
    paddingBottom: 10,
  },
  pageTitle: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'System',
  },
  pageSeparator: {
    marginTop: 10,
    height: 1,
    width: '100%',
  },
  headerCard: {},
  headerCardInner: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: Liquid.colors.textPrimary,
    fontFamily: 'System',
  },
  headerRight: {
    width: 40,
  },
  chevronText: {
    fontSize: 18,
    fontWeight: '800',
    marginLeft: 10,
  },
  backArrow: {
    fontSize: 22,
    color: Liquid.colors.textPrimary,
    fontWeight: '800',
  },
  forwardArrow: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '800',
  },
  openChevron: {
    fontSize: 18,
    color: Liquid.colors.cyan,
    fontWeight: '800',
    marginLeft: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Liquid.spacing.gutter,
    paddingBottom: 24,
  },
  content: {
    flex: 1,
    paddingHorizontal: Liquid.spacing.gutter,
    paddingTop: 10,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 6,
    fontFamily: 'System',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'System',
  },
  profileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 12,
    marginBottom: 12,
  },
  profileCardHalf: {
    width: GRID_COL_WIDTH,
  },
  profileCardFull: {
    width: '100%',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    padding: 20,
    paddingVertical: 22,
    minHeight: 76,
    marginBottom: 16,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#7c3aed',
      shadowRadius: 12,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
    } : {
      backgroundColor: 'rgba(255,255,255,0.05)',
    }),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 52,
  },
  cardTextWrap: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  cardIconImage: {
    width: 44,
    height: 44,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'left',
    marginBottom: 2,
    fontFamily: 'System',
  },
  cardValue: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'left',
    fontFamily: 'System',
  },
  cardValuePlaceholder: {
    color: 'rgba(255,255,255,0.45)',
    fontStyle: 'italic',
  },
  cardEditContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  editFields: {
    gap: 16,
  },
  editField: {
    marginBottom: 16,
  },
  editFieldRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    fontFamily: 'System',
  },
  editInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    fontFamily: 'System',
  },
  editTextArea: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 200,
    fontFamily: 'System',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'right',
    fontFamily: 'System',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'System',
  },
  optionCard: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionCardText: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'System',
  },
  frequencySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  frequencyButton: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frequencyButtonText: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  doneButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  doneButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'System',
  },
  generationSection: {
    marginTop: 32,
    alignItems: 'stretch',
  },
  generationErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  generationErrorText: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    lineHeight: 20,
  },
  generationErrorRetry: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(245,158,11,0.35)',
    borderRadius: 10,
  },
  generationErrorRetryText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  generationCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#7c3aed',
      shadowRadius: 12,
      shadowOpacity: 0.25,
      shadowOffset: { width: 0, height: 4 },
    } : {}),
  },
  generationTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'System',
  },
  generationSubtitle: {
    fontSize: 14,
    marginBottom: 16,
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'System',
  },
  generateBtnTouch: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#a855f7',
      shadowRadius: 20,
      shadowOpacity: 0.5,
      shadowOffset: { width: 0, height: 8 },
    } : {}),
  },
  generateBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  generateBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    fontFamily: 'System',
  },
  planResultWrap: {
    marginTop: 0,
    marginBottom: 24,
    position: 'relative',
    borderRadius: 24,
    overflow: 'hidden',
  },
  planResultGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 24,
  },
  collectionSection: {
    marginBottom: 24,
  },
  collectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  collectionSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  collectionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  collectionCardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  collectionCardText: {
    flex: 1,
  },
  collectionCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  collectionCardDate: {
    fontSize: 12,
  },
  rawPlanFallbackWrap: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    padding: 16,
  },
  rawPlanFallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  rawPlanFallbackScroll: {
    maxHeight: 320,
    borderRadius: 8,
  },
  rawPlanFallbackContent: {
    paddingRight: 8,
    paddingVertical: 12,
  },
  rawPlanMarkdownWrap: {
    backgroundColor: 'transparent',
  },
  rawPlanFallbackText: {
    fontSize: 14,
    lineHeight: 22,
    opacity: 0.9,
  },
  rawPlanEditBtn: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  rawPlanEditBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  parsedOverviewCard: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  parsedOverviewTitle: {
    fontSize: 13,
    color: '#8A8A8A',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  parsedOverviewBody: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 20.8,
  },
  parsedReadMore: {
    fontSize: 13,
    color: '#C084FC',
    marginTop: 8,
  },
  parsedRestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  parsedRestLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  parsedRestPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  parsedRestPillText: {
    fontSize: 11,
    color: '#555',
  },
  parsedWorkoutCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  parsedWorkoutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  parsedWorkoutDayLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
  },
  parsedWorkoutTypeLabel: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 2,
  },
  parsedTypePill: {
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  parsedTypePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  parsedExerciseList: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  parsedExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  parsedExerciseRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  parsedExerciseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 12,
  },
  parsedExerciseName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  parsedExerciseMeta: {
    fontSize: 12,
    color: '#8A8A8A',
    marginTop: 2,
  },
  parsedNotesPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  parsedNotesPillText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  planResultBadgePlain: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  planResultBadgeTextPlain: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  planResultCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 20,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#7c3aed',
      shadowRadius: 20,
      shadowOpacity: 0.35,
      shadowOffset: { width: 0, height: 8 },
    } : {}),
  },
  planResultHeader: {
    marginBottom: 14,
  },
  planResultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  planResultBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  planResultTitle: {
    color: Liquid.colors.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  planOverviewBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderLeftWidth: 3,
    borderLeftColor: '#C084FC',
  },
  planOverviewLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  planOverviewText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    lineHeight: 22,
  },
  planExpandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  planExpandText: {
    color: '#C084FC',
    fontSize: 13,
    fontWeight: '600',
  },
  planResultSubtitle: {
    color: Liquid.colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  planSessionsWrap: {
    marginBottom: 16,
  },
  planSessionsLabel: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  planSessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  planSessionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planSessionText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  planSessionMore: {
    color: 'rgba(156,163,175,0.9)',
    fontSize: 12,
    marginTop: 4,
  },
  planResultActions: {
    gap: 10,
  },
  addToCollectionBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#7c3aed',
      shadowRadius: 12,
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 4 },
    } : {}),
  },
  addToCollectionBtnDisabled: {
    opacity: 0.9,
  },
  addToCollectionGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  addToCollectionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  openPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    marginTop: 12,
  },
  openPlanBtnText: {
    color: '#C084FC',
    fontSize: 14,
    fontWeight: '700',
  },
  planResultSecondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  planResultSecondaryBtnEdit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'rgba(15,23,42,0.9)',
    borderTopColor: '#FF6B9D',
    borderLeftColor: '#FF6B9D',
    borderRightColor: '#C084FC',
    borderBottomColor: '#C084FC',
  },
  planResultSecondaryBtnRegen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  planResultSecondaryBtnText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '600',
  },
  editPlanModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  editPlanModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  editPlanModalContent: {
    backgroundColor: '#1a1520',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  editPlanModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editPlanModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  editPlanModalClose: {
    padding: 8,
  },
  editPlanModalInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 14,
    color: '#fff',
    fontSize: 15,
    minHeight: 280,
    maxHeight: 400,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  editPlanModalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
  editPlanModalCancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  editPlanModalCancelText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '600',
  },
  editPlanModalSaveBtn: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  editPlanModalSaveGrad: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  editPlanModalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  markdownPreviewCard: {
    backgroundColor: 'rgba(15,23,42,0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.6)',
    marginBottom: 14,
    maxHeight: 220,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  markdownPreviewLabel: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  markdownPreviewScroll: {
    flex: 1,
  },
  markdownPreviewContent: {
    paddingRight: 6,
  },
  rawEditorLabel: {
    color: 'rgba(148,163,184,0.95)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 4,
  },
  resultCard: {
    marginTop: 6,
  },
  resultInner: {
    padding: 14,
  },
  resultTitle: {
    color: Liquid.colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  resultSubtitle: {
    color: Liquid.colors.textSecondary,
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  resultRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultMeta: {
    color: Liquid.colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.2,
  },
  resultLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  resultLinkText: {
    color: Liquid.colors.cyan,
    fontWeight: '800',
  },
  generateButton: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 12,
  },
  generateButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonIcon: {
    fontSize: 20,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    width: '100%',
  },
  infoIcon: {
    fontSize: 20,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
    fontFamily: 'System',
  },
  generatingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: 28,
  },
  generatingBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  generatingCard: {
    backgroundColor: 'rgba(20,15,35,0.92)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    minWidth: 280,
    maxWidth: 340,
    ...(Platform.OS === 'ios' ? {
      shadowColor: '#7c3aed',
      shadowRadius: 24,
      shadowOpacity: 0.4,
      shadowOffset: { width: 0, height: 8 },
    } : {}),
  },
  generatingIconRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  generatingIconInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatingTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  generatingMessage: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    minHeight: 44,
  },
  generatingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  generatingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(168,85,247,0.8)',
  },
  generatingHint: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    fontWeight: '500',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    paddingHorizontal: Liquid.spacing.gutter,
  },
  aura: {
    ...StyleSheet.absoluteFillObject,
  },
  processingCard: {
    width: '100%',
    maxWidth: 420,
  },
  processingInner: {
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  processingTitle: {
    color: Liquid.colors.textPrimary,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginTop: 2,
  },
  processingSubtitle: {
    color: Liquid.colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  loadingContent: {
    padding: 32,
    borderRadius: 20,
    alignItems: 'center',
    minWidth: 280,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'System',
  },
  loadingSubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
    fontFamily: 'System',
  },
});
