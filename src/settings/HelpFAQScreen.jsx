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
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../look-and-feel/NbCard';
import { nb, gradients, spacing } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

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
    question: 'How do clients pay their trainer?',
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
      'Trainer profiles can show a listed monthly-style price in Find a Trainer, and search can sort or filter by price when that info exists. The app displays what the trainer entered; it doesn’t negotiate or charge for you.',
  },
  {
    question: 'How do clients find trainers in their area?',
    answer:
      'Use Find a Trainer: browse, search, and filter (specialty, session type, experience, price when listed). Location is what the trainer put on their profile, not automatic GPS matching.',
  },
  {
    question: 'What happens when I request a trainer?',
    answer:
      'Your request goes to their pending requests. They accept or decline. After you’re linked, messaging, shared files, and scheduling work the way your trainer uses the app.',
  },
  {
    question: 'What’s the difference between a real trainer and AI Coach?',
    answer:
      'Your trainer is a person: messages, sessions, files, photos they review. AI Coach is the in-app assistant for training and nutrition habits, with daily limits and a focused scope. Your trainer does not automatically see AI Coach chats.',
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

// Helpers removed - using NbCard directly

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

function FaqHero({ styles: cardStyles, colors }) {
  return (
    <NbCard style={cardStyles.heroCard}>
      <View style={[cardStyles.heroIcon, { backgroundColor: colors.nbSurfaceChip }]}>
        <Ionicons name="help-circle-outline" size={34} color={colors.nbInk} />
      </View>
      <Text style={cardStyles.heroTitle}>Frequently Asked Questions</Text>
      <Text style={cardStyles.heroSub}>Quick answers, no jargon.</Text>
    </NbCard>
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
    <NbCard key={key} style={cardStyles.faqCard}>
      <Pressable onPress={() => onToggle(key)} style={cardStyles.questionRow}>
        <Text style={cardStyles.qText}>{item.question}</Text>
        <Text style={cardStyles.chev}>{isOpen ? '⌄' : '›'}</Text>
      </Pressable>
      {isOpen ? <Text style={cardStyles.answerText}>{item.answer}</Text> : null}
    </NbCard>
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

function buildFaqStyles(scrollBottomPad, colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.nbBackground,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: scrollBottomPad,
    },
    heroCard: {
      alignItems: 'center',
      padding: spacing.lg,
      marginBottom: spacing.md,
    },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.sm,
    },
    heroTitle: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 32,
      color: colors.nbInk,
      textAlign: 'center',
      marginBottom: spacing.sm,
      letterSpacing: -0.3,
    },
    heroSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: colors.nbMuted,
      textAlign: 'center',
      lineHeight: 21,
    },
    sectionHeading: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 12,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.nbMuted,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
    },
    sectionHeaderRow: { marginTop: spacing.sm, marginBottom: spacing.sm },
    faqCard: {
      marginBottom: spacing.sm,
      padding: spacing.md,
    },
    questionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    qText: {
      flex: 1,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 14,
      color: colors.nbInk,
      lineHeight: 19,
      letterSpacing: -0.15,
    },
    chev: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 18,
      color: colors.nbMuted,
    },
    answerText: {
      marginTop: spacing.sm,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 22,
    },
    footer: {
      marginTop: spacing.md,
      padding: spacing.md,
    },
    footerText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: colors.nbMuted,
      lineHeight: 20,
    },
  });
}

// ===== MAIN FUNCTION =====

export default function HelpFAQScreen({ onClose, embedShellBottomNav = false }) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = faqScrollBottomPad(embedShellBottomNav, shellNavInset, insets.bottom);
  const supportEmail = getSupportEmail();
  const [openKey, setOpenKey] = useState(null);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(RISE_FROM)).current;
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(rise, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [fade, rise]);

  const rows = useMemo(() => FAQ_SECTIONS, []);
  const styles = buildFaqStyles(scrollBottomPad, colors);

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
          <FaqHero styles={styles} colors={colors} />

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
