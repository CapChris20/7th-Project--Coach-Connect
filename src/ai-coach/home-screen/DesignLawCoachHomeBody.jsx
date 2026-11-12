// Design Law AI Coach home body — matches screens/ai-coach/01–02 structure 1:1.
// Flow: hero → “sees today” chips → one-tap 2×2 → photo/web rows → pick up → try asking.
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

const PHOTO_STARTER = 'Can you analyze a photo for me?';
const WEB_STARTER = 'Search the web: what does research say about this for lifters?';

// ===== HELPERS =====

function themeColors(isDark) {
  return isDark ? darkColors : lightColors;
}

function tap(fn) {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  fn?.();
}

function formatSleepChip(metrics) {
  const hours = metrics?.sleepHours;
  if (hours == null || !Number.isFinite(Number(hours))) return 'Sleep —';
  return `Sleep ${Number(hours).toFixed(1)} h`;
}

function formatProteinChip(nutrition, userData) {
  const protein = nutrition?.protein;
  const target =
    userData?.proteinTarget ||
    userData?.macroGoals?.protein ||
    userData?.nutritionGoals?.proteinTarget ||
    null;
  if (protein == null && target == null) return 'Protein —';
  if (target != null) return `Protein ${Math.round(protein || 0)} / ${Math.round(target)} g`;
  return `Protein ${Math.round(protein || 0)} g`;
}

function formatWaterChip(metrics) {
  const oz = metrics?.waterIntake;
  if (oz == null || !Number.isFinite(Number(oz))) return 'Water —';
  const cups = Math.round(Number(oz) / 8);
  return `Water ${cups} cups`;
}

function formatSorenessChip(metrics) {
  const s = metrics?.soreness;
  if (s == null || s === '') return 'Soreness —';
  return `Soreness ${s}`;
}

function sessionTitle(session) {
  return (
    session?.title ||
    session?.preview ||
    session?.lastMessagePreview ||
    'Continue chat'
  );
}

function sessionMeta(session) {
  const count = session?.messageCount ?? session?.messagesCount ?? session?.count;
  const when = session?.updatedAtLabel || session?.relativeTime || 'today';
  if (count != null) return `${count} messages · ${when}`;
  return String(when);
}

// ===== UI PIECES =====

function SectionLabel({ text, colors }) {
  return (
    <Text style={[styles.sectionLabel, { color: colors.nbMuted }]}>{text}</Text>
  );
}

function HardCard({ children, colors, style, onPress, fill }) {
  // vocab: style must live on the outer Pressable — % width on an inner View
  // shrink-wraps to content (one-tap tiles became ~80px “thin as hell” columns).
  const cardStyle = [
    styles.hardCard,
    {
      borderColor: colors.nbBorder,
      backgroundColor: fill || colors.nbSurface,
      shadowColor: colors.nbShadow,
    },
    style,
  ];
  if (!onPress) {
    return <View style={cardStyle}>{children}</View>;
  }
  return (
    <Pressable
      onPress={() => tap(onPress)}
      style={({ pressed }) => [
        cardStyle,
        {
          opacity: pressed ? 0.92 : 1,
          transform: [{ translateX: pressed ? 2 : 0 }, { translateY: pressed ? 2 : 0 }],
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

function IconChip({ source, gradient, colors, size = 40 }) {
  return (
    <View style={[styles.iconChip, { width: size, height: size, borderColor: colors.nbBorder }]}>
      <LinearGradient
        colors={gradient || accentGradients[0]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {source ? (
        <Image source={source} style={{ width: size * 0.55, height: size * 0.55 }} resizeMode="contain" />
      ) : null}
    </View>
  );
}

function HeroBlock({ colors, onPress }) {
  return (
    <HardCard colors={colors} fill={colors.nbFill} onPress={onPress} style={styles.hero}>
      <View style={{ flex: 1, paddingRight: 10 }}>
        <Text style={[styles.heroEyebrow, { color: colors.nbOnFill }]}>FITNESS ONLY</Text>
        <Text style={[styles.heroTitle, { color: colors.nbOnFill }]}>What should we work on?</Text>
        <Text style={[styles.heroSub, { color: colors.nbOnFill }]}>
          I can see your logs, your plan and your goals.
        </Text>
      </View>
      <View style={[styles.heroArt, { borderColor: colors.nbBorder, backgroundColor: colors.nbOnFill }]}>
        <LottieView
          source={require('../../assets/animations/handoff/zcoach.json')}
          autoPlay
          loop
          style={{ width: 88, height: 88 }}
        />
      </View>
    </HardCard>
  );
}

function SeesTodayRow({ chips, colors }) {
  if (!chips.length) return null;
  return (
    <View style={{ marginTop: spacing.lg }}>
      <SectionLabel text="THE COACH SEES TODAY" colors={colors} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {chips.map((chip) => (
          <View
            key={chip.id}
            style={[
              styles.statPill,
              {
                borderColor: colors.nbBorder,
                backgroundColor: colors.nbSurface,
                shadowColor: colors.nbShadow,
              },
            ]}
          >
            <IconChip source={chip.icon} gradient={chip.gradient} colors={colors} size={28} />
            <Text style={[styles.statPillText, { color: colors.nbInk }]} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function OneTapGrid({ onStartChat, colors }) {
  return (
    <View style={{ marginTop: spacing.lg }}>
      <SectionLabel text="DO IT FOR ME / ONE TAP" colors={colors} />
      <View style={styles.grid2}>
        {ONE_TAP.map((item) => (
          <HardCard
            key={item.id}
            colors={colors}
            onPress={() => onStartChat(item.starter)}
            style={styles.oneTapCard}
          >
            <IconChip source={item.icon} gradient={item.gradient} colors={colors} />
            <Text style={[styles.oneTapTitle, { color: colors.nbInk }]}>{item.title}</Text>
            <Text style={[styles.oneTapSub, { color: colors.nbMuted }]}>{item.subtitle}</Text>
          </HardCard>
        ))}
      </View>
    </View>
  );
}

function PhotoWebRows({ onStartChat, onPhoto, colors }) {
  return (
    <View style={{ marginTop: spacing.lg, gap: 10 }}>
      <SectionLabel text="SHOW IT A PHOTO OR ASK THE WEB" colors={colors} />
      <HardCard
        colors={colors}
        fill={colors.nbFill}
        onPress={() => (onPhoto ? onPhoto() : onStartChat(PHOTO_STARTER))}
        style={styles.modeRow}
      >
        <IconChip
          source={require('../../assets/icons/handoff/picture.png')}
          gradient={accentGradients[0]}
          colors={colors}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.modeTitle, { color: colors.nbOnFill }]}>
            Form check or physique feedback
          </Text>
          <Text style={[styles.modeSub, { color: colors.nbOnFill, opacity: 0.8 }]}>
            Send a photo or a video frame
          </Text>
        </View>
      </HardCard>
      <HardCard colors={colors} onPress={() => onStartChat(WEB_STARTER)} style={styles.modeRow}>
        <IconChip
          source={require('../../assets/icons/handoff/journey.png')}
          gradient={accentGradients[1]}
          colors={colors}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.modeTitle, { color: colors.nbInk }]}>Fitness web research</Text>
          <Text style={[styles.modeSub, { color: colors.nbMuted }]}>Answers come with sources</Text>
        </View>
      </HardCard>
    </View>
  );
}

function PickUpCard({ session, onContinue, colors }) {
  if (!session) return null;
  return (
    <View style={{ marginTop: spacing.lg }}>
      <SectionLabel text="PICK UP WHERE YOU LEFT OFF" colors={colors} />
      <HardCard colors={colors} style={styles.pickupRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.pickupTitle, { color: colors.nbInk }]} numberOfLines={1}>
            {sessionTitle(session)}
          </Text>
          <Text style={[styles.pickupMeta, { color: colors.nbMuted }]} numberOfLines={1}>
            {sessionMeta(session)}
          </Text>
        </View>
        <Pressable
          onPress={() => tap(() => onContinue?.(session))}
          style={[styles.continuePill, { borderColor: colors.nbBorder }]}
        >
          <LinearGradient
            colors={accentGradients[2]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Text style={[styles.continuePillText, { color: colors.nbInk }]}>Continue</Text>
        </Pressable>
      </HardCard>
    </View>
  );
}

function TryAskingCarousel({ suggestions, onStartChat, colors }) {
  const items = (suggestions || []).filter(Boolean).slice(0, 4);
  if (!items.length) return null;
  return (
    <View style={{ marginTop: spacing.lg, marginBottom: spacing.md }}>
      <SectionLabel text="OR TRY ASKING" colors={colors} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {items.map((text, index) => (
          <HardCard
            key={`ask-${index}`}
            colors={colors}
            onPress={() => onStartChat(text)}
            style={styles.askCard}
          >
            <Text style={[styles.askText, { color: colors.nbInk }]} numberOfLines={4}>
              {text}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.nbMuted} style={{ marginTop: 10 }} />
          </HardCard>
        ))}
      </ScrollView>
    </View>
  );
}

// ===== MAIN =====

/**
 * Full Design Law coach home scroll body (PNG 01).
 */
export default function DesignLawCoachHomeBody({
  isDark,
  suggestions,
  dailyMetrics,
  nutritionToday,
  userData,
  latestSession,
  onStartChat,
  onContinueSession,
  onPhotoPress,
}) {
  const colors = themeColors(isDark);

  const chips = useMemo(() => {
    const list = [
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
    return list;
  }, [dailyMetrics, nutritionToday, userData]);

  return (
    <View style={{ width: '100%' }}>
      <HeroBlock colors={colors} onPress={() => onStartChat?.({})} />
      <SeesTodayRow chips={chips} colors={colors} />
      <OneTapGrid onStartChat={onStartChat} colors={colors} />
      <PhotoWebRows onStartChat={onStartChat} onPhoto={onPhotoPress} colors={colors} />
      <PickUpCard session={latestSession} onContinue={onContinueSession} colors={colors} />
      <TryAskingCarousel suggestions={suggestions} onStartChat={onStartChat} colors={colors} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 10,
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
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    opacity: 0.7,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    opacity: 0.85,
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
  iconChip: {
    borderRadius: 10,
    borderWidth: nb.borderWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Manipulate here: 10 = gutter between the four one-tap tiles
    gap: 10,
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
  oneTapTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  oneTapSub: {
    fontSize: 12,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '900',
  },
  modeSub: {
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
  pickupMeta: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
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
});
