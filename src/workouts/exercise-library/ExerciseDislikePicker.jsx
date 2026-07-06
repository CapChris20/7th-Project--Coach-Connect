/**
 * Multi-select exercise preference picker with lottery-cage style drifting pill animation.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  EXERCISE_DISLIKE_CATEGORIES,
  EXERCISE_DISLIKE_CATALOG,
  searchExerciseDislikeCatalog,
} from './exerciseDislikeCatalog';
import { parseExerciseDislikes, serializeExerciseDislikes } from './exerciseDislikeHelpers';

function LotteryDriftPill({ index, label, selected, onPress, t, animate }) {
  const driftX = useRef(new Animated.Value(0)).current;
  const driftY = useRef(new Animated.Value(0)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(0)).current;
  const selectPop = useRef(new Animated.Value(1)).current;

  const ampX = 2.5 + (index % 4) * 0.8;
  const ampY = 2 + (index % 5) * 0.7;
  const rotDeg = 1.2 + (index % 3) * 0.4;

  useEffect(() => {
    if (!animate) {
      enter.setValue(1);
      return undefined;
    }

    const delay = (index % 9) * 55;
    Animated.sequence([
      Animated.delay(delay),
      Animated.spring(enter, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
    ]).start();

    const durX = 1600 + (index % 6) * 240;
    const durY = 1900 + (index % 5) * 200;
    const durR = 2400 + (index % 7) * 160;

    const loopX = Animated.loop(
      Animated.sequence([
        Animated.timing(driftX, { toValue: 1, duration: durX, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftX, { toValue: -1, duration: durX, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const loopY = Animated.loop(
      Animated.sequence([
        Animated.timing(driftY, { toValue: 1, duration: durY, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(driftY, { toValue: -1, duration: durY, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    const loopR = Animated.loop(
      Animated.sequence([
        Animated.timing(rot, { toValue: 1, duration: durR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(rot, { toValue: -1, duration: durR, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );

    loopX.start();
    loopY.start();
    loopR.start();

    return () => {
      loopX.stop();
      loopY.stop();
      loopR.stop();
    };
  }, [animate, index, driftX, driftY, rot, enter]);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(selectPop, { toValue: 1.08, friction: 4, tension: 200, useNativeDriver: true }),
      Animated.spring(selectPop, { toValue: 1, friction: 6, tension: 160, useNativeDriver: true }),
    ]).start();
  }, [selected, selectPop]);

  const idleDrift = selected ? 0.35 : 1;

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale: Animated.multiply(
              enter.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }),
              selectPop,
            ),
          },
          {
            translateX: driftX.interpolate({
              inputRange: [-1, 1],
              outputRange: [-ampX * idleDrift, ampX * idleDrift],
            }),
          },
          {
            translateY: driftY.interpolate({
              inputRange: [-1, 1],
              outputRange: [-ampY * idleDrift, ampY * idleDrift],
            }),
          },
          {
            rotate: rot.interpolate({
              inputRange: [-1, 1],
              outputRange: [`-${rotDeg * idleDrift}deg`, `${rotDeg * idleDrift}deg`],
            }),
          },
        ],
        opacity: enter,
      }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 50,
          marginRight: 8,
          marginBottom: 8,
          borderWidth: 1.5,
          borderColor: selected ? t.cardSelectedBorder : t.cardBorder,
          backgroundColor: selected ? t.cardSelectedBg : t.cardBg,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '600', color: t.textPrimary }}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ExerciseDislikePicker({
  value = '',
  onChange,
  t,
  animatePills = true,
  showOtherField = true,
  /** Stored field is still `exercisesDislike`; selected items = exercises to prioritize */
  intent = 'prefer',
}) {
  const { selectedIds, customText } = useMemo(() => parseExerciseDislikes(value), [value]);
  const [search, setSearch] = useState('');
  const shuffleKey = useRef(0);

  const filtered = useMemo(() => searchExerciseDislikeCatalog(search), [search]);

  const grouped = useMemo(() => {
    const byCat = {};
    for (const cat of EXERCISE_DISLIKE_CATEGORIES) {
      byCat[cat.id] = [];
    }
    for (const ex of filtered) {
      if (byCat[ex.category]) byCat[ex.category].push(ex);
    }
    return EXERCISE_DISLIKE_CATEGORIES
      .map((cat) => ({ ...cat, exercises: byCat[cat.id] || [] }))
      .filter((cat) => cat.exercises.length > 0);
  }, [filtered]);

  const toggleId = (id) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    onChange?.(serializeExerciseDislikes(next, customText));
  };

  const handleCustomChange = (text) => {
    onChange?.(serializeExerciseDislikes(selectedIds, text));
  };

  const handleSearchChange = (text) => {
    setSearch(text);
    shuffleKey.current += 1;
  };

  const selectedCount = selectedIds.length;
  const isPrefer = intent !== 'dislike';
  const hintText = isPrefer
    ? `Tap exercises you would prefer in your plan. Skip any you don't care about.${
        selectedCount > 0 ? ` (${selectedCount} selected)` : ''
      }`
    : `Tap exercises you never want in your plan. Selected = avoided.${
        selectedCount > 0 ? ` (${selectedCount} selected)` : ''
      }`;

  return (
    <View style={styles.root}>
      <Text style={[styles.hint, { color: t.textSecondary }]}>{hintText}</Text>

      <TextInput
        value={search}
        onChangeText={handleSearchChange}
        placeholder="Search exercises..."
        placeholderTextColor={t.textSecondary}
        style={[
          styles.search,
          {
            color: t.textPrimary,
            backgroundColor: t.cardBg,
            borderColor: t.cardBorder,
          },
        ]}
      />

      {grouped.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>{section.label}</Text>
          <View style={styles.pillRow}>
            {section.exercises.map((ex, idx) => (
              <LotteryDriftPill
                key={`${ex.id}-${shuffleKey.current}`}
                index={idx + section.id.length * 3}
                label={ex.name}
                selected={selectedIds.includes(ex.id)}
                onPress={() => toggleId(ex.id)}
                t={t}
                animate={animatePills}
              />
            ))}
          </View>
        </View>
      ))}

      {!grouped.length ? (
        <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 8 }}>
          No matches — add a custom exercise below.
        </Text>
      ) : null}

      {showOtherField ? (
        <View style={{ marginTop: 12 }}>
          <Text style={[styles.sectionLabel, { color: t.textSecondary }]}>
            {isPrefer ? 'Other exercises you prefer' : 'Other (not listed)'}
          </Text>
          <TextInput
            value={customText}
            onChangeText={handleCustomChange}
            placeholder="e.g. sled drags, specific machine at your gym..."
            placeholderTextColor={t.textSecondary}
            multiline
            style={[
              styles.otherInput,
              {
                color: t.textPrimary,
                backgroundColor: t.cardBg,
                borderColor: t.cardBorder,
              },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  search: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  section: {
    marginTop: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  otherInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
});
