// FAQ screen — search field, accordion groups in NbCards, Contact support footer.
// Flow: fade in → type to filter → tap one question open → mailto from the footer.
// Used from Settings (client + trainer). FAQ_SECTIONS copy is what ships in the build.

import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  TextInput,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { getSupportEmail } from './supportContact';
import NbPageHeader from '../look-and-feel/NbPageHeader';
import { SHELL_SAFE_AREA_EDGES, FORM_SCROLL_PROPS, useShellBottomNavInset } from '../navigation/bottomMenuSpacing';
import { Ionicons } from '@expo/vector-icons';
import NbCard from '../look-and-feel/NbCard';
import NbButton from '../look-and-feel/NbButton';
import { nb, spacing } from '../look-and-feel/colorPalette';
import { openSupportMailto } from './emailSupport';

// ===== NAMED CONSTANTS =====

const SHELL_NAV_INSET = 24;
const EXTRA_SCROLL_PAD = 16;
// Manipulate here: entrance fade/rise duration (ms) — match other legal/settings screens
const FADE_MS = 350;
const RISE_FROM = 10;
const SUPPORT_MAIL_SUBJECT = 'Coach Connect support';
const SUPPORT_MAIL_BODY = 'What I was doing:\n\nWhat went wrong:\n\n';

// vocab: LayoutAnimation on Android needs this experimental flag once at module load.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Manipulate here: shipping FAQ copy — headings + Q/A rows (flat list; headings start groups)
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

function FaqSectionHeading({ title, cardStyles }) {
  return <Text style={cardStyles.sectionHeading}>{title}</Text>;
}

/**
 * One Q row: tap toggles open; chevron flips; answer shows under the question.
 */
function FaqAccordionRow({ item, openAccordionKey, onAccordionPress, cardStyles, colors, showDivider }) {
  const accordionKey = `${item.question}-${item.index}`;
  const isExpanded = openAccordionKey === accordionKey;

  let chevronName = 'chevron-forward';
  if (isExpanded) {
    chevronName = 'chevron-down';
  }

  return (
    <View>
      {showDivider ? <View style={[cardStyles.divider, { backgroundColor: colors.nbBorder }]} /> : null}
      <Pressable
        onPress={() => onAccordionPress(accordionKey)}
        style={cardStyles.questionRow}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <Text style={cardStyles.qText}>{item.question}</Text>
        <Ionicons name={chevronName} size={18} color={colors.nbMuted} />
      </Pressable>
      {isExpanded ? <Text style={cardStyles.answerText}>{item.answer}</Text> : null}
    </View>
  );
}

/**
 * Footer card under the list — opens the support mailto with a starter body.
 */
function FaqSupportFooter({ supportEmail, cardStyles, colors }) {
  let footerBody =
    'Tell us what you were doing. We can’t give medical advice; for health emergencies, contact local emergency services.';
  if (supportEmail) {
    footerBody = `Tell us what you were doing — email ${supportEmail}. We can’t give medical advice; for health emergencies, contact local emergency services.`;
  }

  const openSupportEmail = () => {
    openSupportMailto({
      subject: SUPPORT_MAIL_SUBJECT,
      body: SUPPORT_MAIL_BODY,
    });
  };

  return (
    <NbCard style={cardStyles.footerCard}>
      <Text style={[cardStyles.footerTitle, { color: colors.nbInk }]}>Still stuck?</Text>
      <Text style={cardStyles.footerText}>{footerBody}</Text>
      <View style={styles.footerButtonWrap}>
        <NbButton variant="fill" onPress={openSupportEmail}>
          Contact support
        </NbButton>
      </View>
    </NbCard>
  );
}

/**
 * One heading + NbCard of accordion rows for a filtered FAQ group.
 */
function FaqGroupBlock({ group, openAccordionKey, onAccordionPress, screenStyles, colors }) {
  return (
    <View>
      <FaqSectionHeading title={group.title} cardStyles={screenStyles} />
      <NbCard style={screenStyles.groupCard}>
        {group.items.map((item, rowIndex) => (
          <FaqAccordionRow
            key={`${item.question}-${item.index}`}
            item={item}
            openAccordionKey={openAccordionKey}
            onAccordionPress={onAccordionPress}
            cardStyles={screenStyles}
            colors={colors}
            showDivider={rowIndex > 0}
          />
        ))}
      </NbCard>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Help / FAQ screen with search + accordion groups.
 * @param {{ onClose?: Function, embedShellBottomNav?: boolean }} props
 */
export default function HelpFAQScreen({ onClose, embedShellBottomNav = false }) {
  // vocab: useTheme = Design Law tokens; isDark drives StatusBar content style
  const { colors, isDark } = useTheme();
  // vocab: useSafeAreaInsets = home-indicator / notch padding from the device
  const safeAreaInsets = useSafeAreaInsets();
  const shellNavInset = useShellBottomNavInset(SHELL_NAV_INSET);
  const scrollBottomPad = scrollBottomPaddingForFaq(
    embedShellBottomNav,
    shellNavInset,
    safeAreaInsets.bottom,
  );
  const supportEmail = getSupportEmail();

  const [openAccordionKey, setOpenAccordionKey] = useState(null);
  const [searchQueryText, setSearchQueryText] = useState('');

  // vocab: Animated.Value = drive opacity / translateY for the entrance motion
  const opacityAnimation = useRef(new Animated.Value(0)).current;
  const riseAnimation = useRef(new Animated.Value(RISE_FROM)).current;

  // 1. Fade and slide the list in once on mount (native driver — compositing only).
  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacityAnimation, { toValue: 1, duration: FADE_MS, useNativeDriver: true }),
      Animated.timing(riseAnimation, { toValue: 0, duration: FADE_MS, useNativeDriver: true }),
    ]).start();
  }, [opacityAnimation, riseAnimation]);

  // vocab: useMemo = rebuild filtered groups only when the search string changes
  const visibleFaqGroups = useMemo(
    () => buildFaqGroupsAfterSearch(searchQueryText, FAQ_SECTIONS),
    [searchQueryText],
  );

  const screenStyles = buildFaqStyles(scrollBottomPad, colors);

  /**
   * Open one accordion; tapping the open one closes it.
   * Flow: 1. animate layout  2. toggle key
   */
  const handleAccordionPress = (accordionKey) => {
    // 1. Smooth height change when the answer appears/disappears.
    // vocab: LayoutAnimation = RN animates the next layout pass
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    // 2. Same key again → null (closed); otherwise open that key.
    setOpenAccordionKey((previousKey) => {
      if (previousKey === accordionKey) {
        return null;
      }
      return accordionKey;
    });
  };

  let statusBarStyle = 'dark-content';
  if (isDark) {
    statusBarStyle = 'light-content';
  }

  const hasSearchResults = visibleFaqGroups.length > 0;
  const animatedListStyle = {
    opacity: opacityAnimation,
    transform: [{ translateY: riseAnimation }],
  };

  return (
    <SafeAreaView style={screenStyles.container} edges={SHELL_SAFE_AREA_EDGES}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={colors.nbBackground} />
      <NbPageHeader title="FAQ" onBack={onClose} />

      <ScrollView
        style={styles.flexOne}
        contentContainerStyle={screenStyles.scrollContent}
        {...FORM_SCROLL_PROPS}
        showsVerticalScrollIndicator
      >
        <Animated.View style={animatedListStyle}>
          <TextInput
            value={searchQueryText}
            onChangeText={setSearchQueryText}
            placeholder="Search questions"
            placeholderTextColor={colors.nbMuted}
            style={screenStyles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            clearButtonMode="while-editing"
            accessibilityLabel="Search FAQ questions"
          />

          {!hasSearchResults ? (
            <Text style={screenStyles.empty}>No questions match that search.</Text>
          ) : (
            visibleFaqGroups.map((group) => (
              <FaqGroupBlock
                key={group.title}
                group={group}
                openAccordionKey={openAccordionKey}
                onAccordionPress={handleAccordionPress}
                screenStyles={screenStyles}
                colors={colors}
              />
            ))
          )}

          <FaqSupportFooter supportEmail={supportEmail} cardStyles={screenStyles} colors={colors} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

/**
 * Bottom pad so the last card clears the shell tab bar or home indicator.
 */
function scrollBottomPaddingForFaq(embedShellBottomNav, shellNavInset, bottomSafeInset) {
  if (embedShellBottomNav) {
    return shellNavInset;
  }
  const safeBottom = Math.max(bottomSafeInset, EXTRA_SCROLL_PAD);
  return safeBottom + SHELL_NAV_INSET;
}

/**
 * Turn the flat FAQ_SECTIONS list into { title, items[] } chunks — one NbCard per chunk.
 */
function splitFaqSectionsIntoGroups(sectionRows) {
  const groupedSections = [];
  let currentGroup = null;

  sectionRows.forEach((row, rowIndex) => {
    if (row.type === 'heading') {
      currentGroup = { title: row.title, items: [] };
      groupedSections.push(currentGroup);
      return;
    }
    if (!currentGroup) {
      currentGroup = { title: 'FAQ', items: [] };
      groupedSections.push(currentGroup);
    }
    currentGroup.items.push({ ...row, index: rowIndex });
  });

  return groupedSections;
}

function faqRowMatchesSearchText(faqItem, normalizedQuery) {
  if (!normalizedQuery) {
    return true;
  }
  const questionText = faqItem.question || '';
  const answerText = faqItem.answer || '';
  const searchableText = `${questionText} ${answerText}`.toLowerCase();
  return searchableText.includes(normalizedQuery);
}

/**
 * Filter each group’s items by search; drop empty groups.
 */
function buildFaqGroupsAfterSearch(rawSearchText, allSectionRows) {
  const normalizedQuery = String(rawSearchText || '').trim().toLowerCase();
  const allGroups = splitFaqSectionsIntoGroups(allSectionRows);

  const groupsWithMatchingRows = allGroups.map((group) => {
    const matchingItems = group.items.filter((item) =>
      faqRowMatchesSearchText(item, normalizedQuery),
    );
    return { ...group, items: matchingItems };
  });

  return groupsWithMatchingRows.filter((group) => group.items.length > 0);
}

function buildFaqStyles(scrollBottomPad, colors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.nbBackground,
    },
    scrollContent: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm,
      paddingBottom: scrollBottomPad,
    },
    searchInput: {
      fontFamily: 'Inter_400Regular',
      height: 48,
      borderWidth: nb.borderWidth,
      borderColor: colors.nbBorder,
      borderRadius: 12,
      paddingHorizontal: spacing.md,
      color: colors.nbInk,
      backgroundColor: colors.nbSurface,
      marginBottom: spacing.md,
      // Manipulate here: Design Law search field hard shadow
      shadowColor: colors.nbShadow,
      shadowOffset: { width: nb.shadowOffsetSmall, height: nb.shadowOffsetSmall },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 3,
    },
    sectionHeading: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 11,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: colors.nbMuted,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    groupCard: {
      marginBottom: spacing.md,
      paddingVertical: spacing.xs,
      paddingHorizontal: 0,
    },
    divider: {
      height: nb.borderWidthDivider,
      marginHorizontal: spacing.md,
    },
    questionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      minHeight: nb.minTouchTarget,
    },
    qText: {
      flex: 1,
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 15,
      color: colors.nbInk,
      lineHeight: 20,
      letterSpacing: -0.15,
    },
    answerText: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: colors.nbMuted,
      lineHeight: 22,
    },
    footerCard: {
      marginTop: spacing.sm,
      marginBottom: spacing.lg,
      padding: spacing.md,
    },
    footerTitle: {
      fontFamily: 'SpaceGrotesk_700Bold',
      fontSize: 16,
      marginBottom: 6,
    },
    footerText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: colors.nbMuted,
      lineHeight: 20,
    },
    empty: {
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: colors.nbMuted,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
  });
}

const styles = StyleSheet.create({
  flexOne: { flex: 1 },
  footerButtonWrap: { marginTop: spacing.sm },
});
