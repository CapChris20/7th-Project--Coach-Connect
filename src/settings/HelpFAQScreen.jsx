// Help / FAQ: accordion answers for billing, workouts, trainers, and AI Coach.
// Flow: fade the page in → tap a question to expand one answer → email in the footer.
// Used from Settings for both client and trainer. Copy in FAQ_SECTIONS is what ships.

import React, { useMemo, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet, ScrollView, StatusBar, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import TopHeader from '../for-both/loading-and-header/TopHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

// ===== NAMED CONSTANTS =====

const PURPLE = '#C084FC';
const PINK = '#FF6B9D';
const BORDER_PAD = 0.35;
const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
const FADE_MS = 350;
const RISE_FROM = 10;

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

// ===== HELPER FUNCTIONS =====

/**
 * @param {boolean} isDark
 * @returns {object}
 */
function getCardTokens(isDark) {
  if (isDark) {
    return {
      cardBackground: '#141419',
      border: 'rgba(255,255,255,0.08)',
      text2: 'rgba(255,255,255,0.92)',
      text3: 'rgba(255,255,255,0.72)',
      chev: 'rgba(255,255,255,0.65)',
    };
  }
  return {
    cardBackground: '#FFFFFF',
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

/**
 * Extra room above the shell tab bar, or the home-indicator when this screen owns the stack.
 * @param {boolean} embedShellBottomNav
 * @param {number} shellNavInset
 * @param {number} bottomInset
 * @returns {number}
 */
function faqScrollBottomPad(embedShellBottomNav, shellNavInset, bottomInset) {
  if (embedShellBottomNav) return shellNavInset;
  return Math.max(bottomInset, EXTRA_SCROLL_PAD) + SHELL_NAV_INSET;
}

function FaqHero({ styles: cardStyles }) {
  return (
    <GradientCard borderColors={[PURPLE, PINK]} style={cardStyles.heroOuter} innerStyle={cardStyles.heroInner}>
      <GradientCard borderColors={[PURPLE, PINK]} style={cardStyles.heroIconOuter} innerStyle={cardStyles.heroIconInner}>
        <Ionicons name="help-circle-outline" size={34} color="#FFFFFF" />
      </GradientCard>
      <Text style={cardStyles.heroTitle}>Frequently Asked Questions</Text>
      <Text style={cardStyles.heroSub}>Quick answers, no jargon.</Text>
    </GradientCard>
  );
}

function FaqHeading({ title, styles: cardStyles }) {
  return (
    <View style={cardStyles.sectionHeaderRow}>
      <Text style={cardStyles.sectionHeading}>{title}</Text>
      <View style={cardStyles.sectionUnderline} />
    </View>
  );
}

function FaqQuestionCard({ item, index, openKey, onToggle, styles: cardStyles }) {
  const key = `${item.question}-${index}`;
  const isOpen = openKey === key;
  return (
    <View key={key} style={cardStyles.faqCard}>
      <View style={cardStyles.faqCardBody}>
        <Pressable onPress={() => onToggle(key)} style={cardStyles.questionRow}>
          <Text style={cardStyles.qText}>{item.question}</Text>
          <Text style={cardStyles.chev}>{isOpen ? '⌄' : '›'}</Text>
        </Pressable>
        {isOpen ? <Text style={cardStyles.answerText}>{item.answer}</Text> : null}
      </View>
      <LinearGradient
        colors={[PURPLE, PINK]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={cardStyles.faqBottomAccent}
      />
    </View>
  );
}

function FaqFooter({ supportEmail, styles: cardStyles }) {
  const footerCopy = supportEmail
    ? `Questions? Email ${supportEmail}. We can’t give medical advice; for health emergencies, contact local emergency services.`
    : 'We can’t give medical advice; for health emergencies, contact local emergency services.';
  return (
    <View style={cardStyles.footer}>
      <Text style={cardStyles.footerText}>{footerCopy}</Text>
    </View>
  );
}

function buildFaqStyles(isDark, cardTokens, scrollBottomPad, colors, spacing) {
  return StyleSheet.create({
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
      backgroundColor: cardTokens.cardBackground,
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
    heroSub: { fontSize: 15, fontWeight: '600', color: cardTokens.text2, textAlign: 'center', lineHeight: 21 },
    introTitle: { fontSize: 26, fontWeight: '900', color: colors.text, marginBottom: 8 },
    introSub: { fontSize: 14, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.lg },
    sectionHeading: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: cardTokens.text3,
      marginTop: 24,
      marginBottom: 12,
    },
    sectionUnderline: { width: 22, height: 1.5, backgroundColor: PURPLE, marginTop: 8, borderRadius: 999 },
    sectionHeaderRow: { marginTop: 8, marginBottom: 12 },
    faqCard: {
      backgroundColor: cardTokens.cardBackground,
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
    chev: { fontSize: 18, fontWeight: '900', color: cardTokens.chev },
    answerText: { marginTop: 10, fontSize: 14, fontWeight: '600', color: cardTokens.text2, lineHeight: 22 },
    footer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: cardTokens.cardBackground,
      borderRadius: 12,
      borderWidth: 0,
    },
    footerText: { fontSize: 13, fontWeight: '600', color: cardTokens.text2, lineHeight: 20 },
  });
}

// ===== MAIN FUNCTION =====

export default function HelpFAQScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = faqScrollBottomPad(embedShellBottomNav, shellNavInset, insets.bottom);
  const supportEmail = getSupportEmail();
  const [openKey, setOpenKey] = useState(null);
  const cardTokens = getCardTokens(isDark);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_FROM)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const rows = useMemo(() => FAQ_SECTIONS, []);
  const styles = buildFaqStyles(isDark, cardTokens, scrollBottomPad, colors, spacing);

  const toggle = (key) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenKey((previousKey) => (previousKey === key ? null : key));
  };

  return (
    <SafeAreaView style={styles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <TopHeader title="FAQ" skipTopSafeInset onBack={onClose} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
          <FaqHero styles={styles} />

          {rows.map((item, index) => {
            if (item.type === 'heading') {
              return <FaqHeading key={`h-${item.title}`} title={item.title} styles={styles} />;
            }
            return (
              <FaqQuestionCard
                key={`${item.question}-${index}`}
                item={item}
                index={index}
                openKey={openKey}
                onToggle={toggle}
                styles={styles}
              />
            );
          })}

          <FaqFooter supportEmail={supportEmail} styles={styles} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}
