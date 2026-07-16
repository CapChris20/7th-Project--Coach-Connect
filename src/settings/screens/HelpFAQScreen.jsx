/**
 * Help FAQScreen
 *
 * Purpose: UI screen or component: Help FAQScreen. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/settings
 * Key exports: HelpFAQScreen
 *
 * @file-header
 */
import React, { useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../shared-ui/ThemeContext';
import { getSupportEmail } from '../supportConfig';
import CoachConnectHeader from '../../shared/components/shell/CoachConnectHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../../navigation/bottomNavMetrics';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const PURPLE = '#C084FC';
const PINK = '#FF6B9D';
const BORDER_PAD = 0.35;

function getCardTokens(isDark) {
  return isDark
    ? {
        bg: '#141419',
        border: 'rgba(255,255,255,0.08)',
        text2: 'rgba(255,255,255,0.92)',
        text3: 'rgba(255,255,255,0.72)',
        chev: 'rgba(255,255,255,0.65)',
      }
    : {
        bg: '#FFFFFF',
        border: 'rgba(10,10,15,0.06)',
        text2: 'rgba(10,10,15,0.86)',
        text3: 'rgba(10,10,15,0.68)',
        chev: 'rgba(10,10,15,0.65)',
      };
}

function GradientCard({ borderColors, style, innerStyle, children }) {
  return (
    <LinearGradient colors={borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
      <View style={innerStyle}>{children}</View>
    </LinearGradient>
  );
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQ_SECTIONS = [
  {
    type: 'heading',
    title: 'Payments & billing',
  },
  {
    question: 'How much do trainers earn and when?',
    answer:
      'For in-app client payments, you receive 90% of each charge. Coach Connect keeps a 10% platform fee. Stripe sends payouts to your linked bank account, typically within 2–5 business days. See Earnings & payouts in Settings or the Payments tab for history.',
  },
  {
    question: 'Why not just use Venmo?',
    answer:
      'You can arrange Venmo outside the app, but Coach Connect payments give you automatic bank deposits, a permanent dashboard history (great for taxes), professional records, and less chasing clients for payment.',
  },
  {
    question: 'Do I have to use Coach Connect payments?',
    answer:
      'No, but you lose automatic payouts and clear records that make running a coaching business easier.',
  },
  {
    question: 'Is a client payment the same as Coach Connect Pro?',
    answer:
      'No. Client coaching payments are one-time charges from clients to you. Coach Connect Pro is a separate monthly trainer subscription for platform features.',
  },
  {
    question: 'How do clients pay their coach?',
    answer:
      'Linked clients tap Pay on the dashboard or use Settings → Billing → Add payment method. Payments are processed securely by Stripe and saved in payment history.',
  },
  {
    type: 'heading',
    title: 'Using the app',
  },
  {
    question: 'What is the dashboard and what does it show?',
    answer:
      'The dashboard is your full picture for the week: workouts, check-ins like energy and soreness, and tracking you keep up (like sleep, water, and calories when you log them). Home is the snapshot; “Your Complete Dashboard” is the deeper hub for workouts, progress, and history.',
  },
  {
    question: 'How do I generate a workout?',
    answer:
      'Open the workout planner from your training area. Answer the setup questions, then generate a new weekly-style plan. You can view it, edit it, export it, or run an active workout from it.',
  },
  {
    question: 'Can I regenerate a workout if I don’t like it?',
    answer:
      'Yes, if you still have full plan generations left this month. There’s a monthly limit on brand-new full plans (the banner shows what’s left and when it resets). If you’re out, you can still edit the plan, use AI Coach for tweaks, or wait for the reset.',
  },
  {
    question: 'What’s in the exercise library and how do I use it?',
    answer:
      'The Exercise Library tab is next to your plans. It’s built around searchable exercise videos for demos and technique. Search, watch, and save favorites for later.',
  },
  {
    question: 'How do I filter exercises in the library?',
    answer:
      'Use the search bar (muscles, equipment, goals, names). Use the chips and level/equipment hints to narrow results. It’s search plus smart narrowing, not a rigid spreadsheet.',
  },
  {
    question: 'Can I watch exercise videos without internet?',
    answer:
      'Usually no—videos stream online. Your written plan still works offline; the video library needs a connection.',
  },
  {
    question: 'How do trainers create workout plans for their clients?',
    answer:
      'Trainers use the client workout plans area: plans are stored on that client in the app. Trainers review and manage those plans there. Clients can also generate plans in their own planner.',
  },
  {
    question: 'How do trainers manage multiple clients?',
    answer:
      'Through the trainer tools: client list, messaging, scheduling, requests, and per-client areas like notes, nutrition views, progress, and workout plans.',
  },
  {
    question: 'Can trainers set their own prices?',
    answer:
      'Trainer profiles can show a listed monthly-style price in Find trainers, and search can sort or filter by price when that info exists. The app displays what the trainer entered; it doesn’t negotiate or charge for you.',
  },
  {
    question: 'How do athletes find trainers in their area?',
    answer:
      'Use Find trainers: browse, search, and filter (specialty, session type, experience, price when listed). Location is what the trainer put on their profile, not automatic GPS matching.',
  },
  {
    question: 'What happens when I request a trainer?',
    answer:
      'Your request goes to their pending requests. They accept or decline. After you’re linked, messaging, shared files, and scheduling work the way your coach uses the app.',
  },
  {
    question: 'What’s the difference between a real trainer and AI Coach?',
    answer:
      'Your trainer is a person: messages, sessions, files, photos they review. AI Coach is the in-app assistant for training and nutrition habits, with daily limits and a focused scope. Your coach does not automatically see AI Coach chats.',
  },
  {
    question: 'How does progress tracking actually work?',
    answer:
      'From completed workouts (including active sessions you finish), daily check-ins on the dashboard, nutrition logs, and optional progress photos in the trainer flow. There is no Apple Health / Google Fit sync in the current app—what you log is what the history uses.',
  },
  {
    type: 'heading',
    title: 'More common questions',
  },
  {
    question: 'Why are my “Nutrition Today” rings empty on home?',
    answer: 'Log food in Nutrition; the home card pulls from that.',
  },
  {
    question: 'Why did AI Coach say I hit a daily limit?',
    answer:
      'There’s a per-day cap on AI Coach messages so the service stays reliable. Try again tomorrow.',
  },
  {
    question: 'Why won’t AI Coach answer my non-fitness questions?',
    answer: 'It stays in fitness, nutrition, and healthy habits on purpose.',
  },
  {
    question: 'What is the “Time to workout!” notification?',
    answer:
      'If you see a workout reminder notification, it’s coming from your device notifications. The wording is set by the app.',
  },
  {
    question: 'How do I delete my account?',
    answer: 'Settings → Delete account. Treat it as permanent; save anything important first.',
  },
  {
    question: 'Is this medical advice?',
    answer: 'No. For medical concerns, talk to a licensed professional.',
  },
];

export default function HelpFAQScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(24);
  const scrollBottomPad = embedShellBottomNav ? shellNavInset : Math.max(insets.bottom, 16) + 24;
  const supportEmail = getSupportEmail();
  const [openKey, setOpenKey] = useState(null);
  const t = getCardTokens(isDark);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(10)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const rows = useMemo(() => FAQ_SECTIONS, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0A0F' : '#FFFFFF',
    },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: scrollBottomPad,
    },
    heroOuter: { borderRadius: 16, padding: BORDER_PAD, marginBottom: 16 },
    heroInner: {
      borderRadius: 14,
      padding: 24,
      backgroundColor: t.bg,
      alignItems: 'center',
      borderWidth: 0,
    },
    heroIconOuter: { width: 64, height: 64, borderRadius: 32, padding: BORDER_PAD, marginBottom: 14 },
    heroIconInner: {
      flex: 1,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderWidth: 0,
    },
    heroTitle: { fontSize: 32, fontWeight: '900', color: isDark ? '#FFFFFF' : '#1A1A2E', textAlign: 'center', marginBottom: 8, letterSpacing: -0.3 },
    heroSub: { fontSize: 15, fontWeight: '600', color: t.text2, textAlign: 'center', lineHeight: 21 },

    introTitle: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 8 },
    introSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
    sectionHeading: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: getCardTokens(isDark).text3,
      marginTop: 24,
      marginBottom: 12,
    },
    sectionUnderline: { width: 22, height: 1.5, backgroundColor: PURPLE, marginTop: 8, borderRadius: 999 },
    sectionHeaderRow: { marginTop: 8, marginBottom: 12 },
    faqCard: {
      backgroundColor: getCardTokens(isDark).bg,
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    faqCardBody: {
      paddingVertical: 14,
      paddingHorizontal: 16,
      minHeight: 56,
    },
    faqBottomAccent: {
      height: 1,
      width: '100%',
    },
    questionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
    qText: { flex: 1, fontSize: 14, fontWeight: '900', color: isDark ? '#FFFFFF' : '#0A0A0F', lineHeight: 19, letterSpacing: -0.15 },
    chev: { fontSize: 18, fontWeight: '900', color: getCardTokens(isDark).chev },
    answerText: { marginTop: 10, fontSize: 14, fontWeight: '600', color: getCardTokens(isDark).text2, lineHeight: 22 },
    footer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: getCardTokens(isDark).bg,
      borderRadius: 12,
      borderWidth: 0,
    },
    footerText: { fontSize: 13, fontWeight: '600', color: getCardTokens(isDark).text2, lineHeight: 20 },
  });

  const toggle = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey((prev) => (prev === key ? null : key));
  };

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <CoachConnectHeader title="FAQ" skipTopSafeInset onBack={onClose} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <GradientCard borderColors={[PURPLE, PINK]} style={styles.heroOuter} innerStyle={styles.heroInner}>
            <GradientCard borderColors={[PURPLE, PINK]} style={styles.heroIconOuter} innerStyle={styles.heroIconInner}>
              <Ionicons name="help-circle-outline" size={34} color="#FFFFFF" />
            </GradientCard>
            <Text style={styles.heroTitle}>Frequently Asked Questions</Text>
            <Text style={styles.heroSub}>Quick answers, no jargon.</Text>
          </GradientCard>

          {rows.map((item, index) => {
          if (item.type === 'heading') {
            return (
              <View key={`h-${item.title}`} style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>{item.title}</Text>
                <View style={styles.sectionUnderline} />
              </View>
            );
          }
          const key = `${item.question}-${index}`;
          const isOpen = openKey === key;
          return (
            <View key={key} style={styles.faqCard}>
              <View style={styles.faqCardBody}>
                <Pressable onPress={() => toggle(key)} style={styles.questionRow}>
                  <Text style={styles.qText}>{item.question}</Text>
                  <Text style={styles.chev}>{isOpen ? '⌄' : '›'}</Text>
                </Pressable>
                {isOpen ? <Text style={styles.answerText}>{item.answer}</Text> : null}
              </View>
              <LinearGradient
                colors={[PURPLE, PINK]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.faqBottomAccent}
              />
            </View>
          );
          })}

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {supportEmail
                ? `Questions? Email ${supportEmail}. We can’t give medical advice; for health emergencies, contact local emergency services.`
                : 'We can’t give medical advice; for health emergencies, contact local emergency services.'}
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
