// Design Law AI Coach home body — matches screens/ai-coach/01–02 structure 1:1.
// Flow: hero → “sees today” chips → one-tap 2×2 → photo/web rows → pick up → try asking.
// Trainer variant (missing-screens 17/18): “Who needs you today?” + trainer Do-it-for-me tools.
// Used by CoachHomeScreen IdleCoachHome. Data keys unchanged; taps open chats via onStartChat.

import React, { useMemo } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import * as Haptics from 'expo-haptics';
import { accentGradients, borderRadius, nb, spacing, lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const ONE_TAP = [
  {
    id: 'sleep',
    title: 'Log my sleep',
    subtitle: 'Hours and quality',
    icon: require('../../assets/icons/handoff/sleeping.png'),
    gradient: accentGradients[2],
    starter: 'Help me log my sleep for last night.',
  },
  {
    id: 'mood',
    title: 'Log my mood',
    subtitle: 'One tap, one note',
    icon: require('../../assets/icons/handoff/stress.png'),
    gradient: accentGradients[0],
    starter: 'Help me log my mood for today.',
  },
  {
    id: 'water',
    title: 'Log my water',
    subtitle: 'Cups for today',
    icon: require('../../assets/icons/handoff/hydration.png'),
    gradient: accentGradients[1],
    starter: 'Help me log my water for today.',
  },
  {
    id: 'data',
    title: 'Show my data',
    subtitle: 'What the coach sees',
    icon: require('../../assets/icons/handoff/progress.png'),
    gradient: accentGradients[3],
    starter: 'Show me my data and what you can see about today.',
  },
];

// Manipulate here: trainer Do-it-for-me starters (missing-screens 17/18)
const TRAINER_ONE_TAP = [
  {
    id: 'spot',
    title: 'Spot who has not logged',
    subtitle: 'This week',
    icon: require('../../assets/icons/handoff/supp.png'),
    gradient: accentGradients[1],
    starter: 'Help me spot clients who have not logged food or workouts this week.',
  },
  {
    id: 'notes',
    title: 'Draft weekly notes',
    subtitle: 'For every client',
    icon: require('../../assets/icons/handoff/schedule.png'),
    gradient: accentGradients[3],
    starter: 'Draft weekly notes for every client based on their logs.',
  },
  {
    id: 'plan',
    title: 'Build a plan',
    subtitle: 'From a client profile',
    icon: require('../../assets/icons/handoff/workout.png'),
    gradient: accentGradients[2],
    starter: 'Help me build a plan from a client profile.',
  },
  {
    id: 'group',
    title: 'Message a group',
    subtitle: 'With your wording',
    icon: require('../../assets/icons/handoff/people.png'),
    gradient: accentGradients[0],
    starter: 'Help me message a group of clients with my wording.',
  },
];

const TRAINER_SUGGESTIONS = [
  'Help me spot clients who have not logged food or workouts this week.',
  'Which clients should I check in on today?',
  'Summarize how my clients slept this week.',
];

const PHOTO_STARTER = 'Can you analyze a photo for me?';
const WEB_STARTER = 'Search the web: what does research say about this for lifters?';

const ROLE_TRAINER = 'trainer';
const DEFAULT_CONTINUE_TITLE = 'Continue chat';
const DEFAULT_SESSION_WHEN = 'today';
const OUNCES_PER_CUP = 8;
const MAX_ASK_CARDS = 4;
const ICON_CHIP_DEFAULT_SIZE = 40;
const ICON_CHIP_INNER_SCALE = 0.55;
const STAT_CHIP_ICON_SIZE = 28;
const PRESSED_OPACITY = 0.92;
const PRESSED_OFFSET = 2;
const HERO_LOTTIE_SIZE = 88;

const LABEL_SEES_TODAY = 'THE COACH SEES TODAY';
const LABEL_NOTHING_LOGGED = 'Nothing logged yet';
const LABEL_DO_IT_FOR_ME = 'DO IT FOR ME';
const LABEL_ONE_TAP = 'ONE TAP';
const LABEL_PHOTO_OR_WEB = 'SHOW IT A PHOTO OR ASK THE WEB';
const LABEL_PICK_UP = 'PICK UP WHERE YOU LEFT OFF';
const LABEL_TRY_ASKING = 'OR TRY ASKING';
const LABEL_CONTINUE = 'Continue';

const HERO_EYEBROW_CLIENT = 'FITNESS ONLY';
const HERO_EYEBROW_TRAINER = 'TRAINER COACH • FITNESS ONLY';
const HERO_TITLE_CLIENT = 'What should we work on?';
const HERO_TITLE_TRAINER = 'Who needs you today?';
const HERO_SUB_CLIENT_DEFAULT = 'I can see your logs, your plan and your goals.';
const HERO_SUB_CLIENT_EMPTY = 'Log something and I can start using it.';

const PHOTO_MODE_TITLE = 'Form check or physique feedback';
const PHOTO_MODE_SUB = 'Send a photo or a video frame';
const WEB_MODE_TITLE = 'Fitness web research';
const WEB_MODE_SUB = 'Answers come with sources';

// ===== HELPER FUNCTIONS =====

function viewerRoleIsTrainer(viewerRole) {
  const roleText = String(viewerRole || '').toLowerCase();
  return roleText === ROLE_TRAINER;
}

function safeClientCountFromProp(clientCount) {
  return Math.max(0, Number(clientCount) || 0);
}

function askSuggestionsForRole(isTrainer, suggestions) {
  if (isTrainer) {
    return TRAINER_SUGGESTIONS;
  }
  return suggestions;
}

function photoWebRowsOrNull(shouldShow, onStartChat, onPhotoPress, colors) {
  if (!shouldShow) {
    return null;
  }
  return (
    <PhotoWebRows onStartChat={onStartChat} onPhoto={onPhotoPress} colors={colors} />
  );
}

function pickUpCardOrNull(latestSession, onContinueSession, colors) {
  if (!latestSession) {
    return null;
  }
  return (
    <PickUpCard session={latestSession} onContinue={onContinueSession} colors={colors} />
  );
}

function paletteForDarkMode(isDark) {
  if (isDark) {
    return darkColors;
  }
  return lightColors;
}

function hapticThenRun(callback) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  if (!callback) return;
  callback();
}

function heroEyebrowForRole(isTrainer) {
  if (isTrainer) return HERO_EYEBROW_TRAINER;
  return HERO_EYEBROW_CLIENT;
}

function heroTitleForRole(isTrainer) {
  if (isTrainer) return HERO_TITLE_TRAINER;
  return HERO_TITLE_CLIENT;
}

function heroSubtitleForRole(isTrainer, clientCount, isEmpty) {
  if (isTrainer) {
    return `I see all ${clientCount} clients and their logs.`;
  }
  if (isEmpty) {
    return HERO_SUB_CLIENT_EMPTY;
  }
  return HERO_SUB_CLIENT_DEFAULT;
}

// Build “Sleep X h avg” chip when daily_metrics has sleepHours.
function formatSleepChip(metrics) {
  if (!metrics) return null;
  const hours = metrics.sleepHours;
  if (hours == null) return null;
  if (!Number.isFinite(Number(hours))) return null;
  // Design Law empty-vs-data PNG 08: “Sleep 5.8 h avg”
  return `Sleep ${Number(hours).toFixed(1)} h avg`;
}

// Protein eaten vs target from user profile goals.
function formatProteinChip(nutrition, userData) {
  const protein = nutrition ? nutrition.protein : undefined;
  const target = proteinTargetFromUserData(userData);

  if (protein == null && target == null) return null;
  if (target != null) {
    return `Protein ${Math.round(protein || 0)} / ${Math.round(target)} g`;
  }
  return `Protein ${Math.round(protein || 0)} g`;
}

function proteinTargetFromUserData(userData) {
  if (!userData) return null;
  if (userData.proteinTarget) return userData.proteinTarget;
  if (userData.macroGoals && userData.macroGoals.protein) return userData.macroGoals.protein;
  if (userData.nutritionGoals && userData.nutritionGoals.proteinTarget) {
    return userData.nutritionGoals.proteinTarget;
  }
  return null;
}

// Convert ounces logged to whole cups for display.
function formatWaterChip(metrics) {
  if (!metrics) return null;
  const ounces = metrics.waterIntake;
  if (ounces == null) return null;
  if (!Number.isFinite(Number(ounces))) return null;
  const cups = Math.round(Number(ounces) / OUNCES_PER_CUP);
  return `Water ${cups} cups`;
}

// Pass-through soreness label when present.
function formatSorenessChip(metrics) {
  if (!metrics) return null;
  const sorenessLevel = metrics.soreness;
  if (sorenessLevel == null) return null;
  if (sorenessLevel === '') return null;
  return `Soreness ${sorenessLevel}`;
}

/** empty-vs-data PNG 07: true when the coach has nothing logged to show. */
function hasAnyCoachMetric(dailyMetrics, nutritionToday, userData) {
  if (formatSleepChip(dailyMetrics) != null) return true;
  if (formatProteinChip(nutritionToday, userData) != null) return true;
  if (formatWaterChip(dailyMetrics) != null) return true;
  if (formatSorenessChip(dailyMetrics) != null) return true;
  return false;
}

function buildSeesTodayChips({ isTrainer, safeClientCount, dailyMetrics, nutritionToday, userData }) {
  if (isTrainer) {
    return trainerRosterChips(safeClientCount);
  }
  return clientMetricChips(dailyMetrics, nutritionToday, userData);
}

function trainerRosterChips(safeClientCount) {
  // Honest roster chip only — never invent a “quiet clients” count without real data
  if (safeClientCount <= 0) return [];

  let clientWord = 'clients';
  if (safeClientCount === 1) {
    clientWord = 'client';
  }

  return [
    {
      id: 'clients',
      label: `${safeClientCount} ${clientWord}`,
      icon: require('../../assets/icons/handoff/people.png'),
      gradient: accentGradients[0],
    },
  ];
}

function clientMetricChips(dailyMetrics, nutritionToday, userData) {
  const candidates = [
    {
      id: 'sleep',
      label: formatSleepChip(dailyMetrics),
      icon: require('../../assets/icons/handoff/sleeping.png'),
      gradient: accentGradients[2],
    },
    {
      id: 'protein',
      label: formatProteinChip(nutritionToday, userData),
      icon: require('../../assets/icons/handoff/protein.png'),
      gradient: accentGradients[0],
    },
    {
      id: 'water',
      label: formatWaterChip(dailyMetrics),
      icon: require('../../assets/icons/handoff/hydration.png'),
      gradient: accentGradients[1],
    },
    {
      id: 'soreness',
      label: formatSorenessChip(dailyMetrics),
      icon: require('../../assets/icons/handoff/injury.png'),
      gradient: accentGradients[4],
    },
  ];

  const chipsWithLabels = [];
  for (let index = 0; index < candidates.length; index += 1) {
    const chip = candidates[index];
    if (chip.label != null) chipsWithLabels.push(chip);
  }
  return chipsWithLabels;
}

function sessionTitle(session) {
  if (!session) return DEFAULT_CONTINUE_TITLE;
  if (session.title) return session.title;
  if (session.preview) return session.preview;
  if (session.lastMessagePreview) return session.lastMessagePreview;
  return DEFAULT_CONTINUE_TITLE;
}

function sessionMeta(session) {
  if (!session) return DEFAULT_SESSION_WHEN;

  let messageCount = session.messageCount;
  if (messageCount == null) messageCount = session.messagesCount;
  if (messageCount == null) messageCount = session.count;

  let whenLabel = session.updatedAtLabel;
  if (!whenLabel) whenLabel = session.relativeTime;
  if (!whenLabel) whenLabel = DEFAULT_SESSION_WHEN;

  if (messageCount != null) {
    return `${messageCount} messages · ${whenLabel}`;
  }
  return String(whenLabel);
}

function askCarouselItems(suggestions) {
  if (!suggestions) return [];
  const filled = [];
  for (let index = 0; index < suggestions.length; index += 1) {
    const text = suggestions[index];
    if (text) filled.push(text);
  }
  return filled.slice(0, MAX_ASK_CARDS);
}

function SectionLabel({ text, colors }) {
  const labelColor = { color: colors.nbMuted };
  return <Text style={[styles.sectionLabel, labelColor]}>{text}</Text>;
}

function HardCard({ children, colors, style, onPress, fill }) {
  // vocab: style must live on the outer Pressable — % width on an inner View
  // shrink-wraps to content (one-tap tiles became ~80px “thin as hell” columns).
  const surfaceFill = fill || colors.nbSurface;
  const cardStyle = [
    styles.hardCard,
    {
      borderColor: colors.nbBorder,
      backgroundColor: surfaceFill,
      shadowColor: colors.nbShadow,
    },
    style,
  ];

  if (!onPress) {
    return <View style={cardStyle}>{children}</View>;
  }

  function handlePress() {
    hapticThenRun(onPress);
  }

  function pressableStyle({ pressed }) {
    let opacity = 1;
    let offsetX = 0;
    let offsetY = 0;
    if (pressed) {
      opacity = PRESSED_OPACITY;
      offsetX = PRESSED_OFFSET;
      offsetY = PRESSED_OFFSET;
    }
    return [
      cardStyle,
      {
        opacity,
        transform: [{ translateX: offsetX }, { translateY: offsetY }],
      },
    ];
  }

  return (
    <Pressable onPress={handlePress} style={pressableStyle}>
      {children}
    </Pressable>
  );
}

function IconChip({ source, gradient, colors, size = ICON_CHIP_DEFAULT_SIZE }) {
  const chipSizeStyle = { width: size, height: size, borderColor: colors.nbBorder };
  const gradientColors = gradient || accentGradients[0];
  const iconPixelSize = size * ICON_CHIP_INNER_SCALE;
  const iconStyle = { width: iconPixelSize, height: iconPixelSize };

  let iconImage = null;
  if (source) {
    iconImage = <Image source={source} style={iconStyle} resizeMode="contain" />;
  }

  return (
    <View style={[styles.iconChip, chipSizeStyle]}>
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {iconImage}
    </View>
  );
}

function HeroBlock({ colors, onPress, isTrainer, clientCount, isEmpty }) {
  // Same nbFill hero chrome as client; trainer copy from missing-screens 17/18.
  const eyebrow = heroEyebrowForRole(isTrainer);
  const title = heroTitleForRole(isTrainer);
  const subtitle = heroSubtitleForRole(isTrainer, clientCount, isEmpty);

  const eyebrowColor = { color: colors.nbOnFill };
  const titleColor = { color: colors.nbOnFill };
  const subtitleColor = { color: colors.nbOnFill };
  const artChrome = { borderColor: colors.nbBorder, backgroundColor: colors.nbOnFill };
  const lottieStyle = { width: HERO_LOTTIE_SIZE, height: HERO_LOTTIE_SIZE };

  return (
    <HardCard colors={colors} fill={colors.nbFill} onPress={onPress} style={styles.hero}>
      <View style={styles.heroCopyColumn}>
        <Text style={[styles.heroEyebrow, eyebrowColor]}>{eyebrow}</Text>
        <Text style={[styles.heroTitle, titleColor]}>{title}</Text>
        <Text style={[styles.heroSub, subtitleColor]}>{subtitle}</Text>
      </View>
      <View style={[styles.heroArt, artChrome]}>
        <LottieView
          source={require('../../assets/animations/handoff/zcoach.json')}
          autoPlay
          loop
          style={lottieStyle}
        />
      </View>
    </HardCard>
  );
}

function SeesTodayRow({ chips, colors, isEmpty }) {
  const sectionPad = { marginTop: spacing.lg };
  const emptyPillChrome = {
    borderColor: colors.nbBorder,
    backgroundColor: colors.nbSurface,
    borderStyle: 'dashed',
  };
  const emptyTextColor = { color: colors.nbMuted };
  const scrollGap = { gap: 10 };

  if (isEmpty) {
    return (
      <View style={sectionPad}>
        <SectionLabel text={LABEL_SEES_TODAY} colors={colors} />
        <View style={[styles.emptySeesPill, emptyPillChrome]}>
          <Text style={[styles.statPillText, emptyTextColor]}>{LABEL_NOTHING_LOGGED}</Text>
        </View>
      </View>
    );
  }

  const chipViews = buildSeesTodayChipViews(chips, colors);

  return (
    <View style={sectionPad}>
      <SectionLabel text={LABEL_SEES_TODAY} colors={colors} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={scrollGap}>
        {chipViews}
      </ScrollView>
    </View>
  );
}

function buildSeesTodayChipViews(chips, colors) {
  const chipViews = [];
  for (let chipIndex = 0; chipIndex < chips.length; chipIndex += 1) {
    const chip = chips[chipIndex];
    const pillChrome = {
      borderColor: colors.nbBorder,
      backgroundColor: colors.nbSurface,
      shadowColor: colors.nbShadow,
    };
    const labelColor = { color: colors.nbInk };
    chipViews.push(
      <View key={chip.id} style={[styles.statPill, pillChrome]}>
        <IconChip source={chip.icon} gradient={chip.gradient} colors={colors} size={STAT_CHIP_ICON_SIZE} />
        <Text style={[styles.statPillText, labelColor]} numberOfLines={1}>
          {chip.label}
        </Text>
      </View>,
    );
  }
  return chipViews;
}

function OneTapGrid({ onStartChat, colors, isTrainer }) {
  let items = ONE_TAP;
  if (isTrainer) {
    items = TRAINER_ONE_TAP;
  }

  const sectionPad = { marginTop: spacing.lg };
  const headerRow = {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  };
  const headerLabelColor = { color: colors.nbMuted, marginBottom: 10 };

  let oneTapSideLabel = null;
  if (!isTrainer) {
    oneTapSideLabel = (
      <Text style={[styles.sectionLabel, headerLabelColor]}>{LABEL_ONE_TAP}</Text>
    );
  }

  const tileViews = buildOneTapTileViews(items, colors, onStartChat);

  return (
    <View style={sectionPad}>
      <View style={headerRow}>
        <Text style={[styles.sectionLabel, headerLabelColor]}>{LABEL_DO_IT_FOR_ME}</Text>
        {oneTapSideLabel}
      </View>
      <View style={styles.grid2}>{tileViews}</View>
    </View>
  );
}

function buildOneTapTileViews(items, colors, onStartChat) {
  const tileViews = [];
  for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
    const item = items[itemIndex];
    const titleColor = { color: colors.nbInk };
    const subtitleColor = { color: colors.nbMuted };
    const handleTilePress = () => {
      onStartChat(item.starter);
    };
    tileViews.push(
      <HardCard
        key={item.id}
        colors={colors}
        onPress={handleTilePress}
        style={styles.oneTapCard}
      >
        <IconChip source={item.icon} gradient={item.gradient} colors={colors} />
        <Text style={[styles.oneTapTitle, titleColor]}>{item.title}</Text>
        <Text style={[styles.oneTapSub, subtitleColor]}>{item.subtitle}</Text>
      </HardCard>,
    );
  }
  return tileViews;
}

function PhotoWebRows({ onStartChat, onPhoto, colors }) {
  const sectionPad = { marginTop: spacing.lg, gap: 10 };
  const copyColumn = { flex: 1, minWidth: 0 };
  const photoTitleColor = { color: colors.nbOnFill };
  const photoSubColor = { color: colors.nbOnFill, opacity: 0.8 };
  const webTitleColor = { color: colors.nbInk };
  const webSubColor = { color: colors.nbMuted };

  function handlePhotoPress() {
    if (onPhoto) {
      onPhoto();
      return;
    }
    onStartChat(PHOTO_STARTER);
  }

  function handleWebPress() {
    onStartChat(WEB_STARTER);
  }

  return (
    <View style={sectionPad}>
      <SectionLabel text={LABEL_PHOTO_OR_WEB} colors={colors} />
      <HardCard
        colors={colors}
        fill={colors.nbFill}
        onPress={handlePhotoPress}
        style={styles.modeRow}
      >
        <IconChip
          source={require('../../assets/icons/handoff/picture.png')}
          gradient={accentGradients[0]}
          colors={colors}
        />
        <View style={copyColumn}>
          <Text style={[styles.modeTitle, photoTitleColor]}>{PHOTO_MODE_TITLE}</Text>
          <Text style={[styles.modeSub, photoSubColor]}>{PHOTO_MODE_SUB}</Text>
        </View>
      </HardCard>
      <HardCard colors={colors} onPress={handleWebPress} style={styles.modeRow}>
        <IconChip
          source={require('../../assets/icons/handoff/journey.png')}
          gradient={accentGradients[1]}
          colors={colors}
        />
        <View style={copyColumn}>
          <Text style={[styles.modeTitle, webTitleColor]}>{WEB_MODE_TITLE}</Text>
          <Text style={[styles.modeSub, webSubColor]}>{WEB_MODE_SUB}</Text>
        </View>
      </HardCard>
    </View>
  );
}

function PickUpCard({ session, onContinue, colors }) {
  if (!session) return null;

  const sectionPad = { marginTop: spacing.lg };
  const copyColumn = { flex: 1, minWidth: 0 };
  const titleColor = { color: colors.nbInk };
  const metaColor = { color: colors.nbMuted };
  const continueBorder = { borderColor: colors.nbBorder };
  const continueTextColor = { color: colors.nbInk };
  const displayTitle = sessionTitle(session);
  const displayMeta = sessionMeta(session);

  function handleContinuePress() {
    hapticThenRun(() => {
      if (!onContinue) return;
      onContinue(session);
    });
  }

  return (
    <View style={sectionPad}>
      <SectionLabel text={LABEL_PICK_UP} colors={colors} />
      <HardCard colors={colors} style={styles.pickupRow}>
        <View style={copyColumn}>
          <Text style={[styles.pickupTitle, titleColor]} numberOfLines={1}>
            {displayTitle}
          </Text>
          <Text style={[styles.pickupMeta, metaColor]} numberOfLines={1}>
            {displayMeta}
          </Text>
        </View>
        <Pressable onPress={handleContinuePress} style={[styles.continuePill, continueBorder]}>
          <LinearGradient
            colors={accentGradients[2]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[styles.continuePillText, continueTextColor]}>{LABEL_CONTINUE}</Text>
        </Pressable>
      </HardCard>
    </View>
  );
}

function TryAskingCarousel({ suggestions, onStartChat, colors }) {
  const items = askCarouselItems(suggestions);
  if (!items.length) return null;

  const sectionPad = { marginTop: spacing.lg, marginBottom: spacing.md };
  const scrollGap = { gap: 10 };

  const cardViews = buildTryAskingCardViews(items, colors, onStartChat);

  return (
    <View style={sectionPad}>
      <SectionLabel text={LABEL_TRY_ASKING} colors={colors} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={scrollGap}>
        {cardViews}
      </ScrollView>
    </View>
  );
}

function buildTryAskingCardViews(items, colors, onStartChat) {
  const cardViews = [];
  for (let index = 0; index < items.length; index += 1) {
    const text = items[index];
    const textColor = { color: colors.nbInk };
    const chevronStyle = { marginTop: 10 };
    const handleAskPress = () => {
      onStartChat(text);
    };
    cardViews.push(
      <HardCard
        key={`ask-${index}`}
        colors={colors}
        onPress={handleAskPress}
        style={styles.askCard}
      >
        <Text style={[styles.askText, textColor]} numberOfLines={4}>
          {text}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} style={chevronStyle} />
      </HardCard>,
    );
  }
  return cardViews;
}

// ===== MAIN FUNCTION =====

/**
 * Full Design Law coach home scroll body (PNG 01 client / missing-screens 17 trainer).
 * Flow: 1. theme + role  2. empty vs data  3. chips  4. sections
 * @param {{ viewerRole?: 'client'|'trainer', clientCount?: number }} props
 * @returns {React.ReactElement}
 */
export default function CoachHomeBody({
  isDark,
  suggestions,
  dailyMetrics,
  nutritionToday,
  userData,
  latestSession,
  onStartChat,
  onContinueSession,
  onPhotoPress,
  viewerRole = 'client',
  clientCount = 0,
}) {
  // 1. Theme colors + trainer vs client role.
  const colors = paletteForDarkMode(isDark);
  // vocab: viewerRole = shell-passed role; trainers get roster tools, not personal log one-taps
  const isTrainer = viewerRoleIsTrainer(viewerRole);
  const safeClientCount = safeClientCountFromProp(clientCount);

  // 2. empty-vs-data PNG 07/08: SeesToday empty when no metrics (even if a past session exists).
  const hasMetrics = hasAnyCoachMetric(dailyMetrics, nutritionToday, userData);
  const isEmptySeesToday = !isTrainer && !hasMetrics;
  const isEmptyClientHome = !isTrainer && !hasMetrics && !latestSession;

  // 3. “Sees today” chips from logs — never invent quiet-client counts.
  // vocab: useMemo = recompute chips only when metrics / role / count change
  const chips = useMemo(() => {
    return buildSeesTodayChips({
      isTrainer,
      safeClientCount,
      dailyMetrics,
      nutritionToday,
      userData,
    });
  }, [dailyMetrics, nutritionToday, userData, isTrainer, safeClientCount]);

  // 4. Ask-carousel copy: trainer roster prompts vs client suggestions from the shell.
  const askSuggestions = askSuggestionsForRole(isTrainer, suggestions);

  // 5. Photo/web rows when metrics exist (PNG 08); trainers and empty-sees skip this block.
  const shouldShowPhotoWebRows = !isTrainer && !isEmptySeesToday;
  const photoWebRowsBlock = photoWebRowsOrNull(
    shouldShowPhotoWebRows,
    onStartChat,
    onPhotoPress,
    colors,
  );
  const pickUpBlock = pickUpCardOrNull(latestSession, onContinueSession, colors);

  function handleHeroPress() {
    if (!onStartChat) {
      return;
    }
    onStartChat({});
  }

  return (
    <View style={styles.bodyRoot}>
      <HeroBlock
        colors={colors}
        onPress={handleHeroPress}
        isTrainer={isTrainer}
        clientCount={safeClientCount}
        isEmpty={isEmptyClientHome}
      />
      <SeesTodayRow chips={chips} colors={colors} isEmpty={isEmptySeesToday} />
      <OneTapGrid onStartChat={onStartChat} colors={colors} isTrainer={isTrainer} />
      {photoWebRowsBlock}
      {pickUpBlock}
      <TryAskingCarousel suggestions={askSuggestions} onStartChat={onStartChat} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  bodyRoot: {
    width: '100%',
  },

  heroCopyColumn: {
    flex: 1,
    paddingRight: 10,
  },

  askCard: {
    width: 220,
    minHeight: 120,
    padding: 14,
    justifyContent: 'space-between',
  },

  askText: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 19,
  },

  continuePill: {
    overflow: 'hidden',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },

  continuePillText: {
    fontSize: 13,
    fontWeight: '900',
  },

  emptySeesPill: {
    alignSelf: 'flex-start',
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 40,
    justifyContent: 'center',
  },

  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Manipulate here: 10 = gutter between the four one-tap tiles
    gap: 10,
  },

  hardCard: {
    borderWidth: nb.borderWidth,
    borderRadius: borderRadius.nbCard,
    shadowOffset: { width: nb.shadowOffsetCard, height: nb.shadowOffsetCard },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },

  hero: {
    minHeight: 148,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.nbHero,
  },

  heroArt: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: nb.borderWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },

  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    opacity: 0.7,
  },

  heroSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    opacity: 0.85,
  },

  heroTitle: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },

  iconChip: {
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },

  modeSub: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  modeTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  oneTapCard: {
    // ~half row so two tiles fit with grid2.gap (10). Must sit on Pressable — see HardCard.
    // Manipulate here: drop toward 45 if a device still wraps to one column
    width: '47%',
    flexGrow: 0,
    flexShrink: 0,
    padding: 14,
    gap: 8,
    minHeight: 120,
  },

  oneTapSub: {
    fontSize: 12,
    fontWeight: '600',
  },

  oneTapTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  pickupMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },

  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },

  pickupTitle: {
    fontSize: 15,
    fontWeight: '900',
  },

  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 10,
  },

  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: nb.borderWidth,
    borderRadius: 999,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },

  statPillText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
