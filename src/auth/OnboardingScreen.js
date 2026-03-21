/**
 * OnboardingScreen - Combined onboarding flow for clients and trainers
 * 
 * Handles all 6 onboarding steps for both client and trainer roles
 * with Apple-style subtle gradients throughout.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Share,
  Switch,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../shared/ui/ThemeContext';
import { BlurView } from 'expo-blur';
import { doc, setDoc, getDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, db, functions } from '../app/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import OnboardingProgress from '../shared/components/onboarding/OnboardingProgress';
import LottieView from 'lottie-react-native';
import LiquidBackground from '../shared/ui/liquid/LiquidBackground';
import LiquidBackgroundLight from '../shared/ui/liquid/LiquidBackgroundLight';
import { getOnboardingIconSource } from '../shared/assets/onboardingIconRegistry';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SCREEN_PAD = 16;
const GRID_GUTTER = 16;
const TWO_COL_ITEM = (width - SCREEN_PAD * 2 - GRID_GUTTER) / 2;

// Liquid Glass accent tints (subtle, iOS-like)
const GLASS_TINTS = {
  cyan: '#64D2FF',
  violet: '#AF52DE',
  magenta: '#FF2D55',
  orange: '#FF9F0A',
};

const getClientStepTint = (step, section) => {
  // Keep backgrounds unchanged; tint only the glass surfaces.
  // section is optional and used for Step 1 (inputs vs gender).
  if (step === 1) return section === 'gender' ? GLASS_TINTS.violet : GLASS_TINTS.cyan;
  if (step === 2) return GLASS_TINTS.violet;
  if (step === 3) return GLASS_TINTS.magenta;
  if (step === 4) return GLASS_TINTS.cyan;
  if (step === 5) return GLASS_TINTS.violet;
  if (step === 6) return GLASS_TINTS.orange;
  if (step === 7) return GLASS_TINTS.magenta;
  if (step === 8) return GLASS_TINTS.cyan;
  return GLASS_TINTS.cyan;
};

// Design System Colors
const COLORS = {
  background: '#FAF8F5',
  textPrimary: '#2D3748',
  textSecondary: '#718096',
  border: '#E2E8F0',
  white: '#FFFFFF',
};

// Design System Gradients
const GRADIENTS = {
  bluePurple: ['#5B86E5', '#A855F7'],
  tealBlue: ['#14B8A6', '#3B82F6'],
  indigoPurple: ['#6366F1', '#8B5CF6'],
  greenBlue: ['#10B981', '#3B82F6'],
  orangeRed: ['#F97316', '#DC2626'],
  green: ['#10B981', '#059669'],
  purplePink: ['#A855F7', '#EC4899'],
  goldAmber: ['#F59E0B', '#D97706'],
  success: ['#10B981', '#059669'],
  disabled: ['#CBD5E0', '#E2E8F0'],
};

// Lottie Imports
import lottieClient1 from '../assets/lottie/personal-info.json';
import lottieClient2 from '../assets/lottie/fitness-experience.json';
import lottieClient3 from '../assets/lottie/fitness-goal.json';
import lottieClient4 from '../assets/lottie/equipment step.json';
import lottieClient5 from '../assets/lottie/training-frequency.json';
import lottieClient6 from '../assets/lottie/injuries.json';
import lottieClient7 from '../assets/lottie/trainer-code.json';
import lottieCompletion from '../assets/lottie/welcome-robot.json';
import lottieRoleSelection from '../assets/lottie/role-selection.json';

import lottieTrainer1 from '../assets/lottie/certifications.json';
import lottieTrainer2 from '../assets/lottie/experience-timeline.json';
import lottieTrainer3 from '../assets/lottie/specialties.json';
import lottieTrainer4 from '../assets/lottie/philosophy.json';
import lottieTrainer5 from '../assets/lottie/rates.json';
import lottieTrainer6 from '../assets/lottie/invite-code.json';

// Lottie Animation Mapping
const LOTTIE_ANIMATIONS = {
  // Client Steps
  'client-1': lottieClient1,
  'client-2': lottieClient2,
  'client-3': lottieClient3,
  'client-4': lottieClient4,
  'client-5': lottieClient5,
  'client-6': lottieClient6,
  'client-7': lottieClient7,
  'client-8': lottieTrainer4, // Using philosophy.json for step 8
  // Trainer Steps
  'trainer-1': lottieTrainer1,
  'trainer-2': lottieTrainer2,
  'trainer-3': lottieTrainer3,
  'trainer-4': lottieTrainer4,
  'trainer-5': lottieTrainer5,
  'trainer-6': lottieTrainer6,
};

// Used in renderClientStep (Equipment access step).
// IMPORTANT: this is a real component so hooks inside it don't break OnboardingScreen hook order.
const EquipmentBobbingIcon = ({ icon, delayMs = 0, cardBg }) => {
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -8, duration: 900, useNativeDriver: true, delay: delayMs }),
        Animated.timing(translateY, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [delayMs, translateY]);

  return (
    <Animated.View style={{ transform: [{ translateY }] }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: cardBg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={48} color="#FF6B9D" />
      </View>
    </Animated.View>
  );
};

  // Enhanced gradient text input component
  const GradientTextInput = ({ icon, iconSource, label, value, onChangeText, keyboardType, placeholder, unit, field, isDark = true, tintColor }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [iconFailed, setIconFailed] = useState(false);
    const animatedLabelY = useRef(new Animated.Value(value ? -10 : 18)).current;
    const animatedLabelScale = useRef(new Animated.Value(value ? 0.75 : 1)).current;
    const pressScale = useRef(new Animated.Value(1)).current;

    useEffect(() => {
      // If the icon source changes (or hot reload happens), retry loading the icon
      setIconFailed(false);
    }, [iconSource]);

    useEffect(() => {
      Animated.timing(animatedLabelY, {
        toValue: (isFocused || value) ? -10 : 18,
        duration: 200,
        useNativeDriver: false,
      }).start();
      
      Animated.timing(animatedLabelScale, {
        toValue: (isFocused || value) ? 0.75 : 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isFocused, value]);

    useEffect(() => {
      Animated.spring(pressScale, {
        toValue: isFocused ? 0.98 : 1,
        stiffness: 320,
        damping: 22,
        useNativeDriver: true,
      }).start();
    }, [isFocused]);

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const labelIdle = isDark ? 'rgba(255,255,255,0.72)' : 'rgba(30,41,59,0.65)';
    const labelActive = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)';
    const valueColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const unitColor = isDark ? 'rgba(255,255,255,0.62)' : 'rgba(51,65,85,0.65)';
    const chipBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)';
    const chipBorder = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)';

    return (
      <View style={styles.gradientInputContainer}>
        <Animated.View style={[styles.liquidFieldOuter, { transform: [{ scale: pressScale }] }]}>
          <LinearGradient
            colors={borderColors}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.liquidFieldBorder}
          >
            <BlurView intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidFieldBlur}>
              <View style={[styles.liquidFieldSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
          <View style={styles.gradientInputContent}>
                  <View style={styles.inputIconSlot}>
                    {iconSource !== undefined && iconSource !== null && !iconFailed ? (
                      <Image
                        source={iconSource}
                        style={styles.inputIconImage}
                        onError={(e) => {
                          setIconFailed(true);
                          console.warn('❌ Failed to load input icon:', { label, iconSource, nativeEvent: e?.nativeEvent });
                        }}
                      />
                    ) : (
                      <Text style={styles.inputIcon}>{icon || '•'}</Text>
                    )}
                  </View>
            <View style={styles.inputFieldContainer}>
              <Animated.Text
                style={[
                  styles.floatingLabel,
                  {
                    transform: [{ translateY: animatedLabelY }, { scale: animatedLabelScale }],
                          color: isFocused ? labelActive : labelIdle,
                  }
                ]}
              >
                      {String(label || '').toUpperCase()}
              </Animated.Text>
              <TextInput
                      style={[styles.gradientTextInput, { color: valueColor }]}
                placeholder=""
                      placeholderTextColor={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)'}
                keyboardType={keyboardType}
                value={value?.toString() || ''}
                onChangeText={onChangeText}
                onFocus={() => {
                  setIsFocused(true);
                  Haptics.selectionAsync?.();
                }}
                onBlur={() => setIsFocused(false)}
              />
            </View>
                  {unit && <Text style={[styles.unitLabel, { color: unitColor }]}>{String(unit || '').toUpperCase()}</Text>}
            {value && (
              <TouchableOpacity
                onPress={() => onChangeText('')}
                      style={[styles.clearButton, { backgroundColor: chipBg, borderColor: chipBorder }]}
              >
                      <Text style={[styles.clearButtonText, { color: isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.62)' }]}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
            </BlurView>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  };

  // Liquid Glass selection card (used across onboarding)
  const NeumorphicCard = ({ selected, onPress, icon, iconSource, title, subtitle, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, { toValue: 0.98, stiffness: 320, damping: 22, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, { toValue: 1, stiffness: 320, damping: 22, useNativeDriver: true }).start();
      onPress?.();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const titleColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const subColor = isDark ? 'rgba(255,255,255,0.66)' : 'rgba(51,65,85,0.72)';

    return (
      <TouchableOpacity onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} style={styles.liquidCardHit}>
        <Animated.View style={[styles.liquidCardOuter, { transform: [{ scale }] }, selected && styles.liquidCardOuterSelected]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.liquidCardBorder}>
            <BlurView intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidCardBlur}>
              <View style={[styles.liquidCardSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
                <View style={styles.liquidCardContent}>
                  {iconSource ? (
                    <Image
                      source={iconSource}
                      style={styles.liquidCardIcon}
                      onError={(e) => console.warn('❌ Failed to load card icon:', { title, iconSource, nativeEvent: e?.nativeEvent })}
                    />
                  ) : (
                    icon && <Text style={[styles.liquidCardEmoji, { color: titleColor }]}>{icon}</Text>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.liquidCardTitle, { color: titleColor }]}>{title}</Text>
                    {subtitle ? <Text style={[styles.liquidCardSubtitle, { color: subColor }]}>{subtitle}</Text> : null}
                  </View>
                  {selected ? (
                    <View style={[styles.liquidCardCheck, { borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.10)' }]}>
                      <Text style={[styles.liquidCardCheckText, { color: titleColor }]}>✓</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </BlurView>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Liquid Glass select card (used on Step 1: Gender)
  const LiquidGlassSelectCard = ({ selected, onPress, iconSource, ionicon, title, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);
    const tintOpacity = isDark ? 0.10 : 0.06;

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, {
        toValue: 0.98,
        stiffness: 320,
        damping: 22,
        useNativeDriver: true,
      }).start();
    };

    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 320,
        damping: 22,
        useNativeDriver: true,
      }).start();
      onPress?.();
    };

    return (
      <TouchableOpacity
        onPressIn={pressIn}
        onPressOut={pressOut}
        activeOpacity={1}
        style={styles.liquidSelectHit}
      >
        <Animated.View
          style={[
            styles.liquidSelectOuter,
            { transform: [{ scale }] },
            selected && styles.liquidSelectOuterSelected,
          ]}
        >
            <LinearGradient
            colors={
              isDark
                ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
                : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)']
            }
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.liquidSelectBorder}
          >
            <BlurView
              intensity={pressed || selected ? 42 : 30}
              tint={isDark ? 'dark' : 'light'}
              style={styles.liquidSelectBlur}
            >
              <View
                style={[
                  styles.liquidSelectSurface,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)' },
                ]}
              >
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
                {ionicon ? (
                  <Ionicons 
                    name={ionicon} 
                    size={32} 
                    color="rgba(255,255,255,0.50)"
                    style={styles.liquidSelectIcon}
                  />
                ) : (
                  <Image
                    source={iconSource}
                    style={styles.liquidSelectIcon}
                    onError={(e) => {
                      console.warn('❌ Failed to load liquid select icon:', { title, iconSource, nativeEvent: e?.nativeEvent });
                    }}
                  />
                )}
                <Text
                  style={[
                    styles.liquidSelectTitle,
                    { color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)' },
                  ]}
                >
                {title}
              </Text>
                {selected && (
                  <View style={styles.liquidSelectCheck}>
                    <Text
                      style={[
                        styles.liquidSelectCheckText,
                        { color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)' },
                      ]}
                    >
                      ✓
                </Text>
              </View>
            )}
          </View>
            </BlurView>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Liquid Glass pill option (used for goals + multi-select grids)
  const GradientPill = ({ icon, iconSource, label, selected, onPress, colors, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, { toValue: 0.98, stiffness: 320, damping: 22, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, { toValue: 1, stiffness: 320, damping: 22, useNativeDriver: true }).start();
      onPress?.();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const textColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.90)';

    return (
      <TouchableOpacity onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} style={styles.gradientPillContainer}>
        <Animated.View style={[styles.gradientPill, { transform: [{ scale }] }]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.gradientPillBorder}>
            <BlurView intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.gradientPillBlur}>
              <View style={[styles.gradientPillSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
          style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
                {selected ? (
          <LinearGradient
                    colors={colors || ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.00)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
                    style={styles.gradientPillSelectedOverlay}
                  />
                ) : null}
            <View style={styles.gradientPillContent}>
                  {iconSource ? (
                    <Image source={iconSource} style={styles.gradientPillIconImage} />
                  ) : (
                    icon && <Text style={[styles.gradientPillIcon, { color: textColor }]}>{icon}</Text>
                  )}
                  <Text style={[styles.gradientPillText, { color: textColor }]}>{label}</Text>
                  {selected ? <Text style={[styles.gradientPillCheckmark, { color: textColor }]}>✓</Text> : null}
            </View>
              </View>
            </BlurView>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const SelectablePill = ({ label, selected, onPress, colors }) => {
    const scale = useRef(new Animated.Value(1)).current;

    const pressIn = () => {
      Animated.spring(scale, { toValue: 0.97, stiffness: 300, damping: 20, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      Animated.spring(scale, { toValue: 1, stiffness: 300, damping: 20, useNativeDriver: true }).start();
      onPress();
    };

    return (
      <TouchableOpacity activeOpacity={1} onPressIn={pressIn} onPressOut={pressOut} style={styles.selectablePillHit}>
        <Animated.View style={{ transform: [{ scale }] }}>
          {selected ? (
            <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.selectablePillSelected}>
              <Text style={styles.selectablePillTextSelected}>{label}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.selectablePill}>
              <Text style={styles.selectablePillText}>{label}</Text>
            </View>
          )}
        </Animated.View>
      </TouchableOpacity>
    );
  };

  // Multi-select equipment tile (2-column grid) — Liquid Glass
  const EquipmentCard = ({ icon, iconSource, label, selected, onPress, colors, isDark = true, containerStyle, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, {
        toValue: 0.98,
        stiffness: 300,
        damping: 20,
        useNativeDriver: true,
      }).start();
    };

    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, {
        toValue: 1,
        stiffness: 300,
        damping: 20,
        useNativeDriver: true,
      }).start();
      onPress();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const labelColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.90)';

    return (
      <TouchableOpacity
        activeOpacity={1}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={[styles.equipmentCardHit, containerStyle]}
      >
        <Animated.View style={[styles.equipmentCardShell, { transform: [{ scale }] }, selected && styles.equipmentCardShellSelected]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.equipmentCardBorder}>
            <BlurView intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.equipmentCardBlur}>
              <View style={[styles.equipmentCardInner, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
          {selected ? (
                  <LinearGradient colors={colors || borderColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.equipmentSelectedOverlay} />
                ) : null}

                {iconSource ? (
                  <Image
                    source={iconSource}
                    style={styles.equipmentIconImage}
                    onError={(e) => console.warn('❌ Failed to load equipment icon:', { label, iconSource, nativeEvent: e?.nativeEvent })}
                  />
                ) : (
                  <Text style={[styles.equipmentIcon, { color: labelColor }]}>{icon}</Text>
                )}
                <Text style={[styles.equipmentLabel, { color: labelColor }]}>{label}</Text>

                {selected ? (
                  <View style={styles.equipmentCheckbox}>
                    <Text style={[styles.equipmentCheckboxText, { color: labelColor }]}>✓</Text>
              </View>
          ) : (
              <View style={styles.equipmentCheckboxOutline} />
          )}
              </View>
            </BlurView>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const DayCircle = ({ day, selected, onSelect, isDark = true, tintColor }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const [pressed, setPressed] = useState(false);

    const pressIn = () => {
      setPressed(true);
      Animated.spring(scale, { toValue: 0.98, stiffness: 320, damping: 22, useNativeDriver: true }).start();
    };
    const pressOut = () => {
      setPressed(false);
      Animated.spring(scale, { toValue: 1, stiffness: 320, damping: 22, useNativeDriver: true }).start();
      onSelect?.();
    };

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const textColor = isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.90)';

    return (
      <TouchableOpacity onPressIn={pressIn} onPressOut={pressOut} activeOpacity={1} style={styles.dayCircleHit}>
        <Animated.View style={[styles.dayCircleOuter, { transform: [{ scale }] }, selected && styles.dayCircleOuterSelected]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.dayCircleBorder}>
            <BlurView intensity={pressed || selected ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.dayCircleBlur}>
              <View style={[styles.dayCircleSurface, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
                ) : null}
          {selected ? (
                  <LinearGradient colors={GRADIENTS.purplePink} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.dayCircleSelectedOverlay} />
                ) : null}
                <Text style={[styles.dayCircleText, { color: textColor }]}>{day}</Text>
              </View>
            </BlurView>
            </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const MultiLineCounterInput = ({ label, value, onChangeText, placeholder, disabled, isDark = true, tintColor }) => {
    const [isFocused, setIsFocused] = useState(false);
    const count = value?.length || 0;
    const counterColor =
      count >= 500 ? '#EF4444' : count >= 450 ? '#F97316' : isFocused ? (isDark ? 'rgba(255,255,255,0.90)' : 'rgba(15,23,42,0.92)') : (isDark ? 'rgba(255,255,255,0.62)' : 'rgba(51,65,85,0.65)');

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;
    const labelColor = isDark ? 'rgba(255,255,255,0.76)' : 'rgba(30,41,59,0.70)';
    const textColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const placeholderColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)';

    return (
      <View style={styles.multiLineWrapper}>
        <Text style={[styles.multiLineLabel, { color: labelColor }]}>{String(label || '').toUpperCase()}</Text>
        <View style={[styles.multiLineShell, disabled && { opacity: 0.6 }]}>
          <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.multiLineBorder}>
            <BlurView intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.multiLineBlur}>
              <View style={[styles.multiLineInner, { backgroundColor: surfaceColor }]}>
                {tintColor ? (
                  <View
                    pointerEvents="none"
                    style={[
                      StyleSheet.absoluteFillObject,
                      { backgroundColor: tintColor, opacity: tintOpacity },
                    ]}
                  />
          ) : null}
            <TextInput
                  style={[styles.multiLineInput, { color: textColor }]}
              placeholder={placeholder}
                  placeholderTextColor={placeholderColor}
              value={value}
              onChangeText={(t) => onChangeText(t)}
              multiline
              numberOfLines={7}
              maxLength={500}
              editable={!disabled}
              textAlignVertical="top"
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
            />
            <Text style={[styles.multiLineCounter, { color: counterColor }]}>{count}/500</Text>
          </View>
            </BlurView>
          </LinearGradient>
        </View>
      </View>
    );
  };

  const RateInput = ({ label, value, onChangeText, placeholder }) => {
    const [focused, setFocused] = useState(false);
    return (
      <View style={styles.rateBlock}>
        <Text style={styles.rateLabel}>{label}</Text>
        <View style={styles.rateRow}>
          <Text style={styles.rateCurrency}>$</Text>
          <TextInput
            style={styles.rateInput}
            placeholder={placeholder}
            placeholderTextColor={COLORS.textSecondary}
            keyboardType="numeric"
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>
        <View style={styles.rateUnderline}>
          {focused ? (
            <LinearGradient colors={GRADIENTS.bluePurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rateUnderlineFill} />
          ) : (
            <View style={styles.rateUnderlineBase} />
          )}
        </View>
      </View>
    );
  };

  const DescribeSituationStep = ({
    lottie,
    heading,
    situationDescription,
    setSituationDescription,
    shakeAnimation,
    isDark,
    tintColor,
  }) => {
    const dynamicStyles = getStyles(isDark || true);
    const [isFocused, setIsFocused] = useState(false);
    const charCount = situationDescription.length;
    const minChars = 50;
    const maxChars = 1000;
    
    const getCharCountColor = () => {
      if (charCount < minChars) return isDark ? '#9CA3AF' : '#6B7280';
      if (charCount <= 800) return isDark ? '#9CA3AF' : '#6B7280';
      if (charCount <= 950) return '#F59E0B';
      return '#EF4444';
    };

    // User requested: no suggestion chips / tip card on this step.

    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const titleColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const subColor = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(51,65,85,0.72)';
    const placeholderColor = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)';
    const tintOpacity = isDark ? 0.10 : 0.06;

    return (
      <View style={styles.stepContainer}>
        {lottie && (
          <LottieView
            source={lottie}
            autoPlay
            loop
            style={{ width: 280, height: 168, marginBottom: 24, alignSelf: 'center' }} // Reduced height by 40%
          />
        )}
        <Text style={dynamicStyles.liquidHeading}>{heading}</Text>
        <Text style={dynamicStyles.liquidSubtitle}>Help us understand your fitness journey and goals</Text>

        <View style={{ position: 'relative', width: '100%', marginBottom: 16 }}>
          <View style={styles.liquidAreaOuter}>
            <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.liquidAreaBorder}>
              <BlurView intensity={isFocused ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.liquidAreaBlur}>
                <View style={[styles.liquidAreaSurface, { backgroundColor: surfaceColor }]}>
                  {tintColor ? (
                    <View
                      pointerEvents="none"
            style={[
                        StyleSheet.absoluteFillObject,
                        { backgroundColor: tintColor, opacity: tintOpacity },
                      ]}
                    />
                  ) : null}
          <TextInput
                    style={[styles.liquidAreaInput, { color: titleColor }]}
                    placeholder={`Tell us about yourself...

Examples:
• What's your current fitness routine?
• What challenges are you facing?
• What motivates you?
• What specific goals do you want to achieve?
• When do you want to see results?
• Any lifestyle factors we should know?`}
                    placeholderTextColor={placeholderColor}
            value={situationDescription}
            onChangeText={(text) => {
                      if (text.length <= maxChars) setSituationDescription(text);
            }}
            multiline
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
                    textAlignVertical="top"
            />
                  <View style={styles.liquidAreaCounter}>
                    <Text style={{ fontSize: 12, color: getCharCountColor() }}>{charCount}/{maxChars}</Text>
          </View>
        </View>
              </BlurView>
            </LinearGradient>
        </View>
        </View>

        {charCount > 0 && charCount < minChars && (
          <Text style={{ fontSize: 14, color: '#F59E0B', textAlign: 'center', marginBottom: 8 }}>
            Minimum {minChars} characters (currently: {charCount})
          </Text>
        )}
      </View>
    );
  };

  const TrainerCodeStep = ({
    lottie,
    heading,
    trainerCode,
    setTrainerCode,
    codeValid,
    setCodeValid,
    setCodeError,
    validateTrainerCode,
    shakeAnimation,
    isDark = true,
    tintColor,
  }) => {
    const dynamicStyles = getStyles(isDark || true);
    const [choice, setChoice] = useState(trainerCode ? 'yes' : 'no');
    const debounceTimer = useRef(null);
    const yesHeight = useRef(new Animated.Value(choice === 'yes' ? 160 : 80)).current;
    const inputOpacity = useRef(new Animated.Value(choice === 'yes' ? 1 : 0)).current;
    const inputTranslate = useRef(new Animated.Value(choice === 'yes' ? 0 : -8)).current;

    const setYes = () => {
      setChoice('yes');
      Animated.timing(yesHeight, { toValue: 160, duration: 300, useNativeDriver: false }).start();
      Animated.parallel([
        Animated.timing(inputOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(inputTranslate, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    };

    const setNo = () => {
      setChoice('no');
      setTrainerCode('');
      setCodeValid(null);
      setCodeError(null);
      Animated.timing(yesHeight, { toValue: 80, duration: 300, useNativeDriver: false }).start();
      Animated.parallel([
        Animated.timing(inputOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(inputTranslate, { toValue: -8, duration: 150, useNativeDriver: true }),
      ]).start();
    };

    const safeTrainerLottie = lottie;
    const borderColors = isDark
      ? ['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.00)']
      : ['rgba(0,0,0,0.12)', 'rgba(0,0,0,0.00)'];
    const surfaceColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
    const titleColor = isDark ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
    const subColor = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(51,65,85,0.72)';
    const tintOpacity = isDark ? 0.10 : 0.06;

    return (
      <View style={styles.stepContainer}>
        {safeTrainerLottie ? (
          <LottieView source={safeTrainerLottie} autoPlay loop style={styles.lottieAnimation} />
        ) : (
          <View style={styles.iconPlaceholder}>
            <Ionicons name="person-add-outline" size={90} color="rgba(255,255,255,0.70)" />
          </View>
        )}
        <Text style={dynamicStyles.liquidHeading}>{heading}</Text>

        <View style={styles.expandableCardsContainer}>
          <TouchableOpacity activeOpacity={1} onPress={setYes}>
            <Animated.View style={{ height: yesHeight }}>
              <View style={styles.expandableCardOuter}>
                <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.expandableCardBorder}>
                  <BlurView intensity={choice === 'yes' ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.expandableCardBlur}>
                    <View style={[styles.expandableCardSurface, { backgroundColor: surfaceColor }]}>
                      {tintColor ? (
                        <View
                          pointerEvents="none"
                          style={[
                            StyleSheet.absoluteFillObject,
                            { backgroundColor: tintColor, opacity: tintOpacity },
                          ]}
                        />
                      ) : null}
                      <Text style={[styles.expandableCardTitle, { color: titleColor }]}>Yes, I have a trainer code</Text>
              <Animated.View style={{ opacity: inputOpacity, transform: [{ translateY: inputTranslate }] }}>
                        <Text style={[styles.codeLabel, { color: subColor }]}>Enter trainer code</Text>
                <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
                  <TextInput
                            style={[styles.codeInput, { color: titleColor, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)', borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.10)' }]}
                    placeholder="TRAINER-XXXXXX"
                            placeholderTextColor={isDark ? 'rgba(255,255,255,0.55)' : 'rgba(15,23,42,0.45)'}
                    value={trainerCode}
                    onChangeText={(text) => {
                      const next = text.toUpperCase();
                      setTrainerCode(next);
                      setCodeValid(null);
                      setCodeError?.(null);
                      if (debounceTimer.current) clearTimeout(debounceTimer.current);
                      if (next.trim().length > 0) {
                        debounceTimer.current = setTimeout(() => {
                          validateTrainerCode(next);
                        }, 400);
                      }
                    }}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={24}
                  />
                </Animated.View>
                {codeValid === true && <Text style={styles.validationSuccess}>✓ Valid code</Text>}
                {codeValid === false && <Text style={styles.validationError}>✕ Invalid code</Text>}
              </Animated.View>
                    </View>
                  </BlurView>
                </LinearGradient>
              </View>
            </Animated.View>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={1} onPress={setNo}>
            <View style={styles.expandableCardOuter}>
              <LinearGradient colors={borderColors} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} style={styles.expandableCardBorder}>
                <BlurView intensity={choice === 'no' ? 42 : 30} tint={isDark ? 'dark' : 'light'} style={styles.expandableCardBlur}>
                  <View style={[styles.expandableCardSurface, { height: 80, backgroundColor: surfaceColor }]}>
                    {tintColor ? (
                      <View
                        pointerEvents="none"
                        style={[
                          StyleSheet.absoluteFillObject,
                          { backgroundColor: tintColor, opacity: tintOpacity },
                        ]}
                      />
                    ) : null}
                    <Text style={[styles.expandableCardTitle, { color: titleColor }]}>No, I'll train independently</Text>
                  </View>
                </BlurView>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

// ─────────────────────────────────────────────────────────────────────────────
// Stable input components (defined outside OnboardingScreen to avoid remount)
// ─────────────────────────────────────────────────────────────────────────────
function InputRow({ iconName, iconSource, label, value, onChangeText, placeholder, keyboardType = 'default', rightElement, t }) {
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: focused ? t.cardBg : t.inputBg,
        borderWidth: 1.5,
        borderColor: focused ? '#C084FC' : t.inputBorder,
        borderRadius: 14,
        paddingHorizontal: 14,
        height: 64,
        marginBottom: 10,
      }}
    >
      {iconSource ? (
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            backgroundColor: 'rgba(192,132,252,0.12)',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 12,
          }}
        >
          <Image source={iconSource} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
        </View>
      ) : iconName ? (
        <Ionicons name={iconName} size={20} color={t.textSecondary} style={{ marginRight: 12 }} />
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 10, fontWeight: '700', letterSpacing: 1, color: t.textLabel, marginBottom: 2 }}>
          {label}
        </Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.textLabel}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ fontSize: 15, color: t.textPrimary, padding: 0 }}
        />
      </View>
      {rightElement ? <View>{rightElement}</View> : null}
    </View>
  );
}

function TextAreaWithCounter({
  value,
  onChangeText,
  placeholder,
  maxLength = 500,
  numberOfLines = 5,
  t,
  disabled = false,
}) {
  const [focused, setFocused] = useState(false);
  const bg = disabled ? t.disabledBg : focused ? t.cardBg : t.inputBg;
  const borderColor = disabled ? t.inputBorder : focused ? '#C084FC' : t.inputBorder;
  const color = disabled ? t.disabledText : t.textPrimary;

  return (
    <View style={{ marginBottom: 4 }}>
      <TextInput
        value={value}
        onChangeText={(v) => onChangeText(v.slice(0, maxLength))}
        placeholder={placeholder}
        placeholderTextColor={t.textLabel}
        multiline
        numberOfLines={numberOfLines}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 14,
          color,
          textAlignVertical: 'top',
          minHeight: numberOfLines * 22 + 24,
        }}
      />
      <Text style={{ fontSize: 11, color: t.textLabel, textAlign: 'right', marginTop: 4 }}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

function ChipSelector({ items, selected, onToggle, t }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map((item) => {
        const isSelected = selected.includes(item);
        return (
          <TouchableOpacity
            key={item}
            onPress={() => onToggle(item)}
            activeOpacity={0.85}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 8,
              borderRadius: 50,
              backgroundColor: isSelected ? t.cardSelectedBg : t.cardBg,
              borderWidth: 1.5,
              borderColor: isSelected ? '#C084FC' : t.cardBorder,
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#C084FC' : t.textSecondary }}>
              {item}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function PlainInput({ value, onChangeText, placeholder, t }) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.textLabel}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: '100%',
        height: 52,
        borderRadius: 14,
        paddingHorizontal: 16,
        fontSize: 15,
        color: t.textPrimary,
        marginBottom: 10,
        backgroundColor: focused ? t.cardBg : t.inputBg,
        borderWidth: 1.5,
        borderColor: focused ? '#C084FC' : t.cardBorder,
      }}
    />
  );
}

export default function OnboardingScreen({ route, onComplete, role: roleProp }) {
  const { colors, typography, spacing, isDark: contextIsDark = true } = useTheme();
  const [isDark, setIsDark] = useState(contextIsDark);
  // Role is provided by AuthGate (from Firestore user doc) and/or route params.
  // We do not hardcode the role so trainer onboarding remains reachable.
  const [role] = useState(roleProp || route?.params?.role || 'client');
  
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    // Client fields - Basic Info
    weight: null, // in kg or lbs
    height: null, // in cm or inches
    // Unit preferences (used by some downstream screens)
    weightUnit: 'lbs',
    heightUnit: 'FT/IN',
    age: null,
    gender: null, // 'male', 'female', 'other', 'prefer_not_to_say'
    // Client fields - Fitness Info
    fitnessLevel: null,
    primaryGoal: null,
    goals: [],
    equipmentAccess: [],
    daysPerWeek: null,
    // Default to editable input; `null` is reserved to mean "no limitations"
    injuries: '',
    exercisesDislike: '', // recommended
    preferredWorkoutTime: null, // 'morning' | 'afternoon' | 'evening'
    trainingEnvironment: null, // 'home' | 'gym' | 'both'
    currentStressLevel: null, // 'low' | 'moderate' | 'high'
    sleepQuality: null, // 'poor' | 'fair' | 'good'
    energyLevels: null, // 'low' | 'moderate' | 'high'
    supplementsCurrentlyTaking: '',
    hydrationHabits: null, // 'less_than_4' | '4_8' | 'more_than_8'
    trainerId: null,
    situationDescription: '', // Step 8 - detailed situation/goals description
    // Trainer fields
    certifications: [],
    yearsExperience: null,
    location: '',
    specialties: [],
    trainingPhilosophy: '',
    sessionType: 'Both',
    offerFreeConsultation: false,
    flexiblePricingAvailable: false,
    pricing: { perSession: null, perMonth: null, initialConsult: null },
    inviteCode: null,
    certificationOther: '',
    name: '',
    bio: '',
    availability: null, // 'available' | 'waitlist'
  });

  useEffect(() => {
    // Load persisted theme mode for onboarding
    AsyncStorage.getItem('themeMode')
      .then((mode) => {
        if (mode === 'dark') setIsDark(true);
        if (mode === 'light') setIsDark(false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Persist theme choice
    AsyncStorage.setItem('themeMode', isDark ? 'dark' : 'light').catch(() => {});
  }, [isDark]);

  const theme = isDark
    ? {
        bg: '#0A0A0F',
        card: 'rgba(255,255,255,0.05)',
        cardBorder: 'rgba(255,255,255,0.08)',
        cardSelected: 'rgba(255,107,157,0.15)',
        cardSelectedBorder: '#FF6B9D',
        text: '#FFFFFF',
        subtext: 'rgba(255,255,255,0.55)',
        input: 'rgba(255,255,255,0.05)',
        inputBorder: 'rgba(255,255,255,0.08)',
        inputText: '#FFFFFF',
        placeholder: 'rgba(255,255,255,0.3)',
        progressBg: 'rgba(255,255,255,0.08)',
        backBtn: 'rgba(255,255,255,0.08)',
        backBtnText: 'rgba(255,255,255,0.6)',
        toggleIcon: 'sunny-outline',
      }
    : {
        bg: '#F2F2F7',
        card: '#FFFFFF',
        cardBorder: 'rgba(0,0,0,0.08)',
        cardSelected: 'rgba(255,107,157,0.1)',
        cardSelectedBorder: '#FF6B9D',
        text: '#0A0A0F',
        subtext: 'rgba(0,0,0,0.5)',
        input: '#FFFFFF',
        inputBorder: 'rgba(0,0,0,0.12)',
        inputText: '#0A0A0F',
        placeholder: 'rgba(0,0,0,0.3)',
        progressBg: 'rgba(0,0,0,0.08)',
        backBtn: 'rgba(0,0,0,0.06)',
        backBtnText: 'rgba(0,0,0,0.5)',
        toggleIcon: 'moon-outline',
      };

  // Trainer invite code generation state
  const [inviteCode, setInviteCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const inviteBorderRotation = useRef(new Animated.Value(0)).current;
  const inviteBorderPulse = useRef(new Animated.Value(0)).current;
  
  // Client trainer code validation state
  const [trainerCode, setTrainerCode] = useState('');
  const [validatingCode, setValidatingCode] = useState(false);
  const [codeValid, setCodeValid] = useState(null);
  const [codeError, setCodeError] = useState(null);
  const shakeAnimation = useRef(new Animated.Value(0)).current;
  const trainerCodeDebounceTimerRef = useRef(null);
  
  // Enhanced input animations
  const [focusedInputs, setFocusedInputs] = useState({});
  const [inputValues, setInputValues] = useState({});
  
  // Animation values for neumorphic cards
  const cardAnimations = useRef({}).current;

  // Generate unique invite code for trainers
  useEffect(() => {
    if (role === 'trainer' && currentStep === 6 && !inviteCode) {
      generateInviteCode();
    }
  }, [role, currentStep]);

  useEffect(() => {
    if (!(role === 'trainer' && currentStep === 6)) return;

    inviteBorderRotation.stopAnimation();
    inviteBorderPulse.stopAnimation();
    inviteBorderRotation.setValue(0);
    inviteBorderPulse.setValue(0);

    const rotateLoop = Animated.loop(
      Animated.timing(inviteBorderRotation, { toValue: 1, duration: 6000, useNativeDriver: true })
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(inviteBorderPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(inviteBorderPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );

    rotateLoop.start();
    pulseLoop.start();
    return () => {
      rotateLoop.stop();
      pulseLoop.stop();
    };
  }, [role, currentStep, inviteBorderRotation, inviteBorderPulse]);

  // Get total steps based on role
  const totalSteps = 7; // steps 1–7, step 8 is completion

  const getStepGradient = () => {
    if (role === 'client') {
      switch (currentStep) {
        case 1:
          return GRADIENTS.bluePurple;
        case 2:
          return GRADIENTS.tealBlue;
        case 3:
          return GRADIENTS.indigoPurple;
        case 4:
          return GRADIENTS.tealBlue;
        case 5:
          return GRADIENTS.bluePurple;
        case 6:
          return GRADIENTS.greenBlue;
        case 7:
          return GRADIENTS.indigoPurple;
        case 8:
          return GRADIENTS.purplePink;
        default:
          return GRADIENTS.bluePurple;
      }
    }

    // Trainer
    switch (currentStep) {
      case 1:
        return GRADIENTS.bluePurple;
      case 2:
        return GRADIENTS.tealBlue;
      case 3:
        return GRADIENTS.indigoPurple;
      case 4:
        return GRADIENTS.indigoPurple;
      case 5:
        return GRADIENTS.greenBlue;
      case 6:
        return GRADIENTS.success;
      default:
        return GRADIENTS.bluePurple;
    }
  };
  
  // Get current Lottie animation
  const getCurrentLottie = () => {
    // If role is null, we're in role selection - don't try to get step-specific animation
    if (!role) {
      return null;
    }
    
    const key = `${role}-${currentStep}`;
    const animation = LOTTIE_ANIMATIONS[key];
    
    // Return animation if found, otherwise return null (not fallback)
    return animation || null;
  };

  const getSafeLottie = () => {
    const src = getCurrentLottie();
    
    // If no source available, return null (will be handled by conditional render)
    if (!src) {
      return null;
    }

    // For require() statements that return numbers (asset refs)
    // NOTE: LottieView can accept the numeric asset ref directly; do NOT convert to { uri }.
    if (typeof src === 'number') {
      return src;
    }

    // For objects (already resolved JSON)
    if (typeof src === 'object' && src !== null) {
      return src;
    }
    
    // For strings (URI paths)
    if (typeof src === 'string') {
      return { uri: src };
    }
    
    return null;
  };

  const StepLottie = ({ style }) => {
    const src = getSafeLottie();
    if (!src) return null;
    return <LottieView source={src} autoPlay loop style={style || styles.lottieAnimation} />;
  };

  const generateInviteCode = async () => {
    setGeneratingCode(true);
    let code = '';
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      // Generate 6-character alphanumeric code
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const part1 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      const part2 = Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      code = `${part1}-${part2}`;

      // Check if code exists in Firebase
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('inviteCode', '==', code));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
          isUnique = true;
        }
      } catch (error) {
        console.error('Error checking invite code uniqueness:', error);
        // If error, assume unique and continue
        isUnique = true;
      }
      
      attempts++;
    }

    if (isUnique) {
      setInviteCode(code);
      setOnboardingData(prev => ({ ...prev, inviteCode: code }));
    } else {
      Alert.alert('Error', 'Could not generate unique invite code. Please try again.');
    }
    setGeneratingCode(false);
  };

  /** Normalize client input to match stored format (XXX-XXX). Returns null if invalid. */
  const normalizeInviteCodeForQuery = (raw) => {
    let s = String(raw || '').trim();
    if (!s) return null;
    // Strip TRAINER- prefix (case-insensitive)
    if (/^trainer/i.test(s)) s = s.replace(/^trainer[\-\s]*/i, '').trim();
    // Remove ALL non-alphanumeric characters, uppercase
    const cleaned = s.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // Must be exactly 6 alphanumeric chars for XXX-XXX format
    if (cleaned.length !== 6) return null;
    const result = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}`;
    return result.length === 7 ? result : null;
  };

  const validateTrainerCode = async (code) => {
    if (!code || code.trim().length === 0) {
      setCodeValid(null);
      return;
    }

    const normalized = normalizeInviteCodeForQuery(code);
    if (!normalized) {
      setCodeValid(false);
      setCodeError('Invalid code format.');
      triggerShake();
      return;
    }

    setValidatingCode(true);
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('inviteCode', '==', normalized));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const trainerDoc = querySnapshot.docs[0];
        const trainerData = trainerDoc.data();
        
        if (trainerData.role === 'trainer') {
          setCodeValid(true);
          setCodeError(null);
          setOnboardingData(prev => ({ ...prev, trainerId: trainerDoc.id }));
        } else {
          setCodeValid(false);
          setCodeError(null);
          triggerShake();
        }
      } else {
        setCodeValid(false);
        setCodeError(null);
        triggerShake();
      }
    } catch (error) {
      console.error('Error validating trainer code:', error);
      setCodeValid(false);
      setCodeError(null);
      triggerShake();
    } finally {
      setValidatingCode(false);
    }
  };

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnimation, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const copyToClipboard = async (text) => {
    try {
      const { default: Clipboard } = await import('@react-native-clipboard/clipboard');
      await Clipboard.setString(text);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    } catch (error) {
      // Fallback for Expo
      Alert.alert('Copied!', `Invite code: ${text}`);
    }
  };

  const shareInviteCode = async () => {
    try {
      await Share.share({
        message: `Join me on CoachConnect! Use my invite code: ${inviteCode}`,
        title: 'CoachConnect Invite Code',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleSelect = (field, value, isMultiSelect = false) => {
    if (isMultiSelect) {
      const current = onboardingData[field] || [];
      const newValue = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      setOnboardingData(prev => ({ ...prev, [field]: newValue }));
    } else {
      setOnboardingData(prev => ({ ...prev, [field]: value }));
    }
  };

  const validateStep = () => {
    // Steps 1–7 collect data; step 8 is completion. Validation differs by role.
    if (role === 'trainer') {
      switch (currentStep) {
        case 1:
          return Array.isArray(onboardingData.certifications) && onboardingData.certifications.length > 0;
        case 2:
          return Array.isArray(onboardingData.specialties) && onboardingData.specialties.length > 0;
        case 3:
          return !!onboardingData.yearsExperience;
        case 4: {
          const len = onboardingData.trainingPhilosophy?.length ?? 0;
          // New trainer UI: philosophy is required, max 500.
          return len > 0 && len <= 500;
        }
        case 5:
          return !!(onboardingData.pricing?.perSession || onboardingData.pricing?.perMonth) && !!onboardingData.availability && !!onboardingData.sessionType;
        case 6:
          return !!(onboardingData.name && onboardingData.location);
        case 7:
          return true;
        case totalSteps + 1:
          return true;
        default:
          return false;
      }
    }

    // Default: client flow
    switch (currentStep) {
      case 1:
        return (
          onboardingData.weight !== null &&
          onboardingData.height !== null &&
          onboardingData.age !== null &&
          onboardingData.gender !== null
        );
      case 2:
        return onboardingData.fitnessLevel !== null;
      case 3:
        return Array.isArray(onboardingData.goals) && onboardingData.goals.length > 0;
      case 4:
        return onboardingData.equipmentAccess.length > 0 && !!onboardingData.trainingEnvironment;
      case 5:
        return onboardingData.daysPerWeek !== null && !!onboardingData.preferredWorkoutTime;
      case 6:
        return true; // Optional
      case 7:
        return true; // Optional
      case totalSteps + 1:
        return true; // Completion screen
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep()) return;

    const completionStep = totalSteps + 1;
    if (currentStep < totalSteps) setCurrentStep(currentStep + 1);
    else setCurrentStep(completionStep); // completion screen (press "Start Your Journey" to save)
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out and return to the login screen?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
            } catch (error) {
              console.error('Error signing out:', error);
            }
          }
        },
      ]
    );
  };

  const handleSkip = () => {
    // Skip is only shown on steps 6–7; it should advance to the next step/screen, not save immediately.
    const completionStep = totalSteps + 1;
    if (currentStep < completionStep) setCurrentStep(currentStep + 1);
  };

  const handleFinish = async () => {
    if (!auth?.currentUser) {
      Alert.alert('Error', 'You must be logged in to save onboarding data.');
      if (onComplete) onComplete();
      return;
    }

    if (!db) {
      Alert.alert('Error', 'Database connection failed.');
      if (onComplete) onComplete();
      return;
    }

    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      const userRef = doc(db, 'users', userId);

      const finalRole = role || onboardingData.role || 'client';

      // Prepare update data
      const updateData = {
        ...onboardingData,
        role: finalRole,
        onboardingCompleted: true,
        onboardingCompletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Set startingWeight from onboarding weight so "Before" shows in trainer CRM (only if not already set)
      const existingSnap = await getDoc(userRef);
      const existing = existingSnap.exists() ? existingSnap.data() : {};
      if ((existing.startingWeight == null || existing.startingWeight === '') && (onboardingData.weight != null && onboardingData.weight !== '')) {
        updateData.startingWeight = onboardingData.weight;
      }

      // Merge with existing user data
      await setDoc(userRef, updateData, { merge: true });

      // When trainer completes onboarding, write to trainers collection for discovery
      if (finalRole === 'trainer') {
        try {
          const trainersRef = doc(db, 'trainers', userId);
          await setDoc(trainersRef, {
            uid: userId,
            name: updateData.name || 
                  updateData.firstName || 
                  auth.currentUser?.displayName || 'Trainer',
            location: updateData.location || '',
            specialties: updateData.specialties || [],
            bio: updateData.trainingPhilosophy || 
                 updateData.bio || null,
            certifications: updateData.certifications || [],
            rate: updateData.pricing?.perSession || null,
            pricing: updateData.pricing || {},
            yearsExperience: updateData.yearsExperience || null,
            experience: (() => {
              const map = {
                'less_than_1': 0,
                '1_2': 2,
                '3_5': 4,
                '6_10': 8,
                '10_plus': 10,
              };
              return map[updateData.yearsExperience] || 0;
            })(),
            available: true,
            // Normalize for marketplace cards + profile UI
            specialty: (updateData.specialties || [])[0] || (updateData.specializations || [])[0] || '',
            price: updateData.pricing?.perMonth ?? updateData.pricing?.perSession ?? null,
            reviewCount: 0,
            rating: 0,
            availability: 'Available',
            sessionType: updateData.sessionType || 'Both',
            isRemote: (updateData.sessionType || 'Both') === 'Remote',
            experienceRange: updateData.yearsExperience || null,
            tags: [],
            credentials: Array.isArray(updateData.certifications)
              ? updateData.certifications.join(', ')
              : updateData.certifications || null,
            clients: 0,
            sessions: 0,
            availableDays: [true, true, true, true, true, false, false],
            offerFreeConsultation: 
              updateData.offerFreeConsultation || false,
            flexiblePricingAvailable: 
              updateData.flexiblePricingAvailable || false,
            inviteCode: updateData.inviteCode || null,
            onboardingCompleted: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
          console.log('✅ Trainer profile written to trainers collection');
        } catch (trainerErr) {
          console.warn('⚠️ Could not write to trainers collection:', trainerErr?.message);
        }
      }

      // When client has trainer code, create trainer_clients link via Cloud Function (bypasses Firestore rules)
      if (finalRole === 'client' && updateData.trainerId) {
        try {
          if (functions) {
            const linkClient = httpsCallable(functions, 'linkClientWithTrainerCode');
            await linkClient({ clientId: userId, trainerId: updateData.trainerId });
            console.log('✅ Client linked to trainer in trainer_clients');
          }
        } catch (linkErr) {
          console.warn('⚠️ Could not link client to trainer (may already exist):', linkErr?.message);
        }
      }

      // Save to AsyncStorage for WorkoutPlanGeneratorScreen
      if (finalRole === 'client') {
        const onboardingKey = `onboarding_data_${userId}`;
        await AsyncStorage.setItem(onboardingKey, JSON.stringify(updateData));
        console.log('✅ Onboarding data saved to AsyncStorage');
      }

      console.log('✅ Onboarding completed for user:', userId);
      
      if (onComplete) {
        onComplete(finalRole, updateData);
      }
    } catch (error) {
      console.error('❌ Error saving onboarding data:', error);
      Alert.alert(
        'Save Failed',
        'Failed to save onboarding data. You can continue, but your preferences won\'t be saved.',
        [
          { text: 'Continue Anyway', onPress: () => onComplete && onComplete(role || onboardingData.role || 'client') },
          { text: 'Try Again', onPress: handleFinish },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const isOptionalStep = () => {
    // Skip rules differ by role.
    if (role === 'trainer') return false;
    // Client: skip is only shown on steps 6–7.
    return currentStep === 6 || currentStep === 7;
  };

  const getStepTitle = () => {
    if (role === 'client') {
      const titles = [
        "Tell us about yourself",
        "What's your fitness experience?",
        "What's your main goal?",
        "What equipment do you have access to?",
        "How many days per week can you train?",
        "Any injuries or limitations?",
        "Do you have a trainer?",
        "Describe Your Situation",
      ];
      return titles[currentStep - 1];
    } else {
      const titles = [
        "What certifications do you have?",
        "What are your specialties?",
        "How long have you been training clients?",
        "Describe your training philosophy",
        "What are your rates?",
        "Almost done!",
        "Your client invite code",
      ];
      return titles[currentStep - 1];
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Client-only onboarding UI (replaces role/trainer UI)
  // ─────────────────────────────────────────────────────────────────────────────
  const CLIENT_DARK = {
    bg: '#0A0A0F',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    cardSelectedBg: 'rgba(192,132,252,0.15)',
    cardSelectedBorder: '#C084FC',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.5)',
    textLabel: 'rgba(255,255,255,0.35)',
    inputBg: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.08)',
    toggleTrack: '#C084FC',
    dayBtnBg: 'rgba(255,255,255,0.06)',
    progressTrack: 'rgba(255,255,255,0.08)',
    backBtnBg: 'rgba(255,255,255,0.06)',
    disabledBg: 'rgba(255,255,255,0.08)',
    disabledText: 'rgba(255,255,255,0.25)',
  };

  const CLIENT_LIGHT = {
    bg: '#F5F5F7',
    cardBg: '#FFFFFF',
    cardBorder: '#E5E7EB',
    cardSelectedBg: 'rgba(192,132,252,0.12)',
    cardSelectedBorder: '#C084FC',
    textPrimary: '#0A0A0F',
    textSecondary: '#6B7280',
    textLabel: '#9CA3AF',
    inputBg: '#FFFFFF',
    inputBorder: '#E5E7EB',
    toggleTrack: '#C084FC',
    dayBtnBg: '#FFFFFF',
    progressTrack: '#E5E7EB',
    backBtnBg: 'rgba(0,0,0,0.05)',
    disabledBg: '#E5E7EB',
    disabledText: '#9CA3AF',
  };

  const CLIENT_GRAD = ['#C084FC', '#FF6B9D'];

  const CLIENT_LOTTIES = {
    personalInfo: lottieClient1,
    fitnessExperience: lottieClient2,
    fitnessGoal: lottieClient3,
    equipment: lottieClient4,
    trainingFrequency: lottieClient5,
    injuries: lottieClient6,
    trainerCode: lottieClient7,
    completion: lottieCompletion,
  };

  const TRAINER_GRAD = ['#C084FC', '#FF6B9D'];
  const TRAINER_DARK = {
    bg: '#0A0A0F',
    cardBg: 'rgba(255,255,255,0.04)',
    cardBorder: 'rgba(255,255,255,0.08)',
    cardSelectedBg: 'rgba(192,132,252,0.15)',
    cardSelectedBorder: '#C084FC',
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.5)',
    textLabel: 'rgba(255,255,255,0.35)',
    inputBg: 'rgba(255,255,255,0.05)',
    inputBorder: 'rgba(255,255,255,0.08)',
    progressTrack: 'rgba(255,255,255,0.08)',
    backBtnBg: 'rgba(255,255,255,0.06)',
    disabledBg: 'rgba(255,255,255,0.08)',
    disabledText: 'rgba(255,255,255,0.25)',
  };

  const TRAINER_LIGHT = {
    bg: '#F5F5F7',
    cardBg: '#FFFFFF',
    cardBorder: '#E5E7EB',
    cardSelectedBg: 'rgba(192,132,252,0.12)',
    cardSelectedBorder: '#C084FC',
    textPrimary: '#0A0A0F',
    textSecondary: '#6B7280',
    textLabel: '#9CA3AF',
    inputBg: '#FFFFFF',
    inputBorder: '#E5E7EB',
    progressTrack: '#E5E7EB',
    backBtnBg: 'rgba(0,0,0,0.05)',
    disabledBg: '#E5E7EB',
    disabledText: '#9CA3AF',
  };

  const TRAINER_LOTTIES = {
    certifications: lottieTrainer1,
    specialties: lottieTrainer3,
    experience: lottieTrainer2,
    philosophy: lottieTrainer4,
    rates: lottieTrainer5,
    personalInfo: lottieClient1, // reuse existing asset
    completion: lottieCompletion, // reuse existing asset
  };

  // Icon images (used by the consolidated onboarding assets zip)
  const ICON_IMAGES = {
    scales: require('../assets/onboarding-consolidated/scales.png'),
    height: require('../assets/onboarding-consolidated/height.png'),
    age: require('../assets/onboarding-consolidated/Age.png'),
    male: require('../assets/onboarding-consolidated/male.png'),
    female: require('../assets/onboarding-consolidated/female.png'),
    other: require('../assets/onboarding-consolidated/prefer not to say.png'),
    beginner: require('../assets/onboarding-consolidated/Beginner.png'),
    intermediate: require('../assets/onboarding-consolidated/Intermediate.png'),
    advanced: require('../assets/onboarding-consolidated/Advanced.png'),
    fullGym: require('../assets/onboarding-consolidated/Full Gym.png'),
    dumbbells: require('../assets/onboarding-consolidated/dumbbells.png'),
    resistanceBands: require('../assets/onboarding-consolidated/Resistance Bands.png'),
    pullUpBar: require('../assets/onboarding-consolidated/Pull Up Bar.png'),
    bodyweight: require('../assets/onboarding-consolidated/Bodyweight Only.png'),
  };

  function ProgressBar({ current, total, t }) {
    const pct = Math.min((current / total) * 100, 100);
    return (
      <View
        style={{
          flex: 1,
          height: 4,
          borderRadius: 2,
          backgroundColor: t.progressTrack,
          marginHorizontal: 12,
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={CLIENT_GRAD}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: `${pct}%`, height: 4, borderRadius: 2 }}
        />
      </View>
    );
  }

  function SelectionCard({ selected, onPress, iconName, iconSource, label, description, variant = 'full', t }) {
    const bg = selected ? t.cardSelectedBg : t.cardBg;
    const border = selected ? t.cardSelectedBorder : t.cardBorder;

    if (variant === 'grid') {
      return (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          style={{
            flex: 1,
            minHeight: 100,
            backgroundColor: bg,
            borderWidth: 1.5,
            borderColor: border,
            borderRadius: 14,
            padding: 14,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 10,
          }}
        >
          {iconSource ? (
            <Image source={iconSource} style={{ width: 34, height: 34, resizeMode: 'contain' }} />
          ) : iconName ? (
            <Ionicons name={iconName} size={24} color={selected ? '#C084FC' : t.textSecondary} />
          ) : null}
          <Text style={{ fontSize: 13, fontWeight: '600', color: t.textPrimary, textAlign: 'center' }}>
            {label}
          </Text>
          {selected && (
            <View style={{ position: 'absolute', top: 8, right: 8 }}>
              <Ionicons name="checkmark" size={14} color="#C084FC" />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    // Default full-width row
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: '100%',
          minHeight: 64,
          backgroundColor: bg,
          borderWidth: 1.5,
          borderColor: border,
          borderRadius: 14,
          paddingHorizontal: 14,
          marginBottom: 10,
        }}
      >
        {iconSource ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: 'rgba(192,132,252,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Image source={iconSource} style={{ width: 20, height: 20, resizeMode: 'contain' }} />
          </View>
        ) : iconName ? (
          <View
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: 'rgba(192,132,252,0.12)',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            <Ionicons name={iconName} size={20} color="#C084FC" />
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: t.textPrimary }}>{label}</Text>
          {description ? (
            <Text style={{ fontSize: 13, color: t.textSecondary, marginTop: 1 }}>{description}</Text>
          ) : null}
        </View>
        {selected ? <Ionicons name="checkmark" size={20} color="#C084FC" style={{ marginLeft: 8 }} /> : null}
      </TouchableOpacity>
    );
  }

  function ContinueButton({ disabled = false, onPress, label = 'Continue', t }) {
    if (disabled) {
      return (
        <View
          style={{
            width: '100%',
            height: 56,
            borderRadius: 16,
            backgroundColor: t.disabledBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '700', color: t.disabledText }}>{label}</Text>
        </View>
      );
    }

    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={{ width: '100%', borderRadius: 16, overflow: 'hidden' }}>
        <LinearGradient colors={CLIENT_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ height: 56, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF' }}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  const SectionLabel = ({ text, t }) => (
    <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 1.2, color: t.textLabel, marginBottom: 10, marginTop: 20 }}>
      {text}
    </Text>
  );

  const completionStep = totalSteps + 1;
  const renderClientOnlyStep = () => {
    const t = isDark ? CLIENT_DARK : CLIENT_LIGHT;
    const isCompletion = currentStep === completionStep;

    if (isCompletion) {
      if (role === 'trainer') {
        return (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
            <LottieView source={CLIENT_LOTTIES.completion} autoPlay={false} loop={false} style={{ width: 120, height: 120 }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 24, color: t.textPrimary }}>
              Your trainer profile is live!
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 0, marginBottom: 0, color: t.textSecondary }}>
              Start building your client roster
            </Text>
            <View style={{ flexDirection: 'row', gap: 24, marginTop: 36 }}>
              {[
                { icon: 'people-outline', label: 'Client CRM' },
                { icon: 'calendar-outline', label: 'Scheduling' },
                { icon: 'bar-chart-outline', label: 'Analytics' },
              ].map((f) => (
                <View key={f.label} style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(192,132,252,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={f.icon} size={24} color="#C084FC" />
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: t.textPrimary, textAlign: 'center' }}>{f.label}</Text>
                </View>
              ))}
            </View>
          </View>
        );
      }

      return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 }}>
          <LottieView source={CLIENT_LOTTIES.completion} autoPlay={false} loop={false} style={{ width: 280, height: 280 }} />
          <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 24, color: t.textPrimary }}>
            You're all set!
          </Text>
          <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginTop: 0, marginBottom: 0, color: t.textSecondary }}>
            Your personalized experience is ready
          </Text>
          <View style={{ flexDirection: 'row', gap: 24, marginTop: 36 }}>
            {[
              { icon: 'sparkles-outline', label: 'AI Workouts' },
              { icon: 'people-outline', label: 'Expert Trainers' },
              { icon: 'nutrition-outline', label: 'Nutrition Tracking' },
            ].map((f) => (
              <View key={f.label} style={{ alignItems: 'center', gap: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(192,132,252,0.12)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={f.icon} size={24} color="#C084FC" />
                </View>
                <Text style={{ fontSize: 12, fontWeight: '600', color: t.textPrimary, textAlign: 'center' }}>{f.label}</Text>
              </View>
            ))}
          </View>
        </View>
      );
    }

    switch (currentStep) {
      case 1: {
        const weightValue = onboardingData.weight ?? '';
        const heightValue = onboardingData.height ?? '';
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={CLIENT_LOTTIES.personalInfo} autoPlay loop style={{ width: 300, height: 300, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              Tell us about yourself
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              Helps us personalize your experience
            </Text>

            <InputRow
              t={t}
              iconSource={ICON_IMAGES.scales}
              label="WEIGHT"
              value={weightValue === '' ? '' : String(weightValue)}
              onChangeText={(txt) => {
                const num = String(txt).replace(/[^0-9.]/g, '');
                setOnboardingData((prev) => ({ ...prev, weight: num ? parseFloat(num) : null }));
              }}
              placeholder="Enter weight"
              keyboardType="numeric"
              rightElement={
                <TouchableOpacity
                  onPress={() =>
                    setOnboardingData((prev) => ({
                      ...prev,
                      weightUnit: prev.weightUnit === 'lbs' ? 'kg' : 'lbs',
                    }))
                  }
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#C084FC' }}>
                    {onboardingData.weightUnit === 'lbs' ? 'LBS' : 'KG'}
                  </Text>
                </TouchableOpacity>
              }
            />

            <InputRow
              t={t}
              iconSource={ICON_IMAGES.height}
              label="HEIGHT"
              value={heightValue === '' ? '' : String(heightValue)}
              onChangeText={(txt) => {
                const num = String(txt).replace(/[^0-9.]/g, '');
                setOnboardingData((prev) => ({ ...prev, height: num ? parseFloat(num) : null }));
              }}
              placeholder={onboardingData.heightUnit === 'FT/IN' ? 'e.g., 5\'11"' : 'e.g., 180'}
              keyboardType="numeric"
              rightElement={
                <TouchableOpacity
                  onPress={() =>
                    setOnboardingData((prev) => ({
                      ...prev,
                      heightUnit: prev.heightUnit === 'FT/IN' ? 'CM' : 'FT/IN',
                    }))
                  }
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#C084FC' }}>{onboardingData.heightUnit}</Text>
                </TouchableOpacity>
              }
            />

            <InputRow
              t={t}
              iconSource={ICON_IMAGES.age}
              label="AGE"
              value={onboardingData.age ?? ''}
              onChangeText={(txt) => {
                const num = String(txt).replace(/[^0-9]/g, '');
                setOnboardingData((prev) => ({ ...prev, age: num ? parseInt(num, 10) : null }));
              }}
              placeholder="Enter age"
              keyboardType="numeric"
              rightElement={<Text style={{ fontSize: 12, fontWeight: '700', color: t.textSecondary }}>YRS</Text>}
            />

            <SectionLabel text="GENDER" t={t} />
            {[
              { id: 'male', label: 'Male', iconSource: ICON_IMAGES.male },
              { id: 'female', label: 'Female', iconSource: ICON_IMAGES.female },
              { id: 'other', label: 'Other / Prefer not to say', iconSource: ICON_IMAGES.other },
            ].map((g) => (
              <SelectionCard
                key={g.id}
                t={t}
                selected={onboardingData.gender === g.id}
                onPress={() => setOnboardingData((prev) => ({ ...prev, gender: g.id }))}
                iconSource={g.iconSource}
                label={g.label}
              />
            ))}
          </View>
        );
      }

      case 2: {
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={CLIENT_LOTTIES.fitnessExperience} autoPlay loop style={{ width: 340, height: 340, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              What's your fitness experience?
            </Text>
            <View style={{ marginTop: 20 }}>
              {[
                { id: 'beginner', label: 'Beginner', desc: 'New to working out', iconSource: ICON_IMAGES.beginner },
                { id: 'intermediate', label: 'Intermediate', desc: 'Work out regularly', iconSource: ICON_IMAGES.intermediate },
                { id: 'advanced', label: 'Advanced', desc: 'Experienced athlete', iconSource: ICON_IMAGES.advanced },
              ].map((l) => (
                <SelectionCard
                  key={l.id}
                  t={t}
                  selected={onboardingData.fitnessLevel === l.id}
                  onPress={() => setOnboardingData((prev) => ({ ...prev, fitnessLevel: l.id }))}
                  iconSource={l.iconSource}
                  label={l.label}
                  description={l.desc}
                />
              ))}
            </View>
          </View>
        );
      }

      case 3: {
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={CLIENT_LOTTIES.fitnessGoal} autoPlay loop style={{ width: 340, height: 340, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              What's your main goal?
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              Select all that apply
            </Text>
            <View style={{ marginTop: 16 }}>
              {[
                { id: 'lose_fat', label: 'Lose Fat', icon: 'trending-down-outline' },
                { id: 'build_muscle', label: 'Build Muscle', icon: 'barbell-outline' },
                { id: 'maintain_health', label: 'Maintain Health', icon: 'heart-outline' },
                { id: 'athletic_performance', label: 'Athletic Performance', icon: 'flash-outline' },
                { id: 'improve_mental_health', label: 'Improve Mental Health', icon: 'sunny-outline' },
                { id: 'build_habits', label: 'Build Consistency & Habits', icon: 'calendar-outline' },
              ].map((g) => {
                const selected = Array.isArray(onboardingData.goals) && onboardingData.goals.includes(g.id);
                return (
                  <SelectionCard
                    key={g.id}
                    t={t}
                    selected={selected}
                    onPress={() => {
                      setOnboardingData((prev) => {
                        const current = Array.isArray(prev.goals) ? prev.goals : [];
                        const next = current.includes(g.id) ? current.filter((x) => x !== g.id) : [...current, g.id];
                        return { ...prev, goals: next, primaryGoal: next[0] || null };
                      });
                    }}
                    iconName={g.icon}
                    label={g.label}
                  />
                );
              })}
            </View>
          </View>
        );
      }

      case 4: {
        const equipment = Array.isArray(onboardingData.equipmentAccess) ? onboardingData.equipmentAccess : [];
        const train = onboardingData.trainingEnvironment;
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={CLIENT_LOTTIES.equipment} autoPlay loop style={{ width: 300, height: 300, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              What equipment do you have?
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              Select all that apply
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16, marginBottom: 6 }}>
              {[
                { id: 'full_gym', label: 'Full Gym', iconSource: ICON_IMAGES.fullGym },
                { id: 'dumbbells', label: 'Dumbbells', iconSource: ICON_IMAGES.dumbbells },
              ].map((e) => (
                <SelectionCard
                  key={e.id}
                  t={t}
                  variant="grid"
                  selected={equipment.includes(e.id)}
                  onPress={() => {
                    setOnboardingData((prev) => {
                      const current = Array.isArray(prev.equipmentAccess) ? prev.equipmentAccess : [];
                      const next = current.includes(e.id) ? current.filter((x) => x !== e.id) : [...current, e.id];
                      return { ...prev, equipmentAccess: next };
                    });
                  }}
                  iconSource={e.iconSource}
                  label={e.label}
                />
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
              {[
                { id: 'resistance_bands', label: 'Resistance Bands', iconSource: ICON_IMAGES.resistanceBands },
                { id: 'pull_up_bar', label: 'Pull-up Bar', iconSource: ICON_IMAGES.pullUpBar },
              ].map((e) => (
                <SelectionCard
                  key={e.id}
                  t={t}
                  variant="grid"
                  selected={equipment.includes(e.id)}
                  onPress={() => {
                    setOnboardingData((prev) => {
                      const current = Array.isArray(prev.equipmentAccess) ? prev.equipmentAccess : [];
                      const next = current.includes(e.id) ? current.filter((x) => x !== e.id) : [...current, e.id];
                      return { ...prev, equipmentAccess: next };
                    });
                  }}
                  iconSource={e.iconSource}
                  label={e.label}
                />
              ))}
            </View>

            <View style={{ marginBottom: 6 }}>
              <SelectionCard
                t={t}
                variant="grid"
                selected={equipment.includes('bodyweight')}
                onPress={() => {
                  setOnboardingData((prev) => {
                    const current = Array.isArray(prev.equipmentAccess) ? prev.equipmentAccess : [];
                    const next = current.includes('bodyweight') ? current.filter((x) => x !== 'bodyweight') : [...current, 'bodyweight'];
                    return { ...prev, equipmentAccess: next };
                  });
                }}
                iconSource={ICON_IMAGES.bodyweight}
                label="Bodyweight Only"
              />
            </View>

            <SectionLabel text="WHERE DO YOU PREFER TO TRAIN?" t={t} />
            {[
              { id: 'home', label: 'Home', desc: 'Work out from the comfort of your home', icon: 'home-outline' },
              { id: 'gym', label: 'Gym', desc: 'Access to a full range of gym equipment', icon: 'barbell-outline' },
              { id: 'both', label: 'Both', desc: 'Flexible, combining home and gym', icon: 'shuffle-outline' },
            ].map((l) => (
              <SelectionCard
                key={l.id}
                t={t}
                selected={train === l.id}
                onPress={() => setOnboardingData((prev) => ({ ...prev, trainingEnvironment: l.id }))}
                iconName={l.icon}
                label={l.label}
                description={l.desc}
              />
            ))}
          </View>
        );
      }

      case 5: {
        const days = onboardingData.daysPerWeek;
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={CLIENT_LOTTIES.trainingFrequency} autoPlay loop style={{ width: 300, height: 300, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              How many days per week can you train?
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20, marginBottom: 10 }}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <TouchableOpacity
                  key={n}
                  activeOpacity={0.85}
                  onPress={() => setOnboardingData((prev) => ({ ...prev, daysPerWeek: n }))}
                  style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}
                >
                  {days === n ? (
                    <LinearGradient colors={CLIENT_GRAD} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  ) : (
                    <View
                      style={{ ...StyleSheet.absoluteFillObject, backgroundColor: t.dayBtnBg, borderWidth: 1.5, borderColor: t.cardBorder, borderRadius: 20 }}
                    />
                  )}
                  <Text style={{ fontSize: 14, fontWeight: '700', color: days === n ? '#FFFFFF' : t.textPrimary }}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <SectionLabel text="PREFERRED WORKOUT TIME" t={t} />
            {[
              { id: 'morning', label: 'Morning', desc: '5am – 12pm', icon: 'sunny-outline' },
              { id: 'afternoon', label: 'Afternoon', desc: '12pm – 5pm', icon: 'partly-sunny-outline' },
              { id: 'evening', label: 'Evening', desc: '5pm – 10pm', icon: 'moon-outline' },
            ].map((opt) => (
              <SelectionCard
                key={opt.id}
                t={t}
                selected={onboardingData.preferredWorkoutTime === opt.id}
                onPress={() => setOnboardingData((prev) => ({ ...prev, preferredWorkoutTime: opt.id }))}
                iconName={opt.icon}
                label={opt.label}
                description={opt.desc}
              />
            ))}
          </View>
        );
      }

      case 6: {
        const noLimitations = onboardingData.injuries === null;
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={CLIENT_LOTTIES.injuries} autoPlay loop style={{ width: 300, height: 300, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              Any injuries or limitations?
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              We'll help you work around them safely
            </Text>

            <SectionLabel text="INJURIES OR PHYSICAL LIMITATIONS (RECOMMENDED)" t={t} />
            <TextAreaWithCounter
              t={t}
              value={noLimitations ? '' : onboardingData.injuries || ''}
              onChangeText={(v) => setOnboardingData((prev) => ({ ...prev, injuries: v }))}
              placeholder="e.g., lower back pain, knee issues, shoulder injury..."
              numberOfLines={5}
              disabled={noLimitations}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: t.textPrimary }}>I have no limitations</Text>
              <Switch
                value={noLimitations}
                onValueChange={(val) => setOnboardingData((prev) => ({ ...prev, injuries: val ? null : '' }))}
                trackColor={{ false: t.cardBorder, true: t.toggleTrack }}
                thumbColor="#FFFFFF"
              />
            </View>

            <SectionLabel text="EXERCISES YOU DISLIKE (RECOMMENDED)" t={t} />
            <TextAreaWithCounter
              t={t}
              value={onboardingData.exercisesDislike || ''}
              onChangeText={(v) => setOnboardingData((prev) => ({ ...prev, exercisesDislike: v }))}
              placeholder="e.g., burpees, running, leg press..."
              numberOfLines={4}
            />

            <SectionLabel text="SUPPLEMENTS CURRENTLY TAKING (OPTIONAL)" t={t} />
            <TextAreaWithCounter
              t={t}
              value={onboardingData.supplementsCurrentlyTaking || ''}
              onChangeText={(v) => setOnboardingData((prev) => ({ ...prev, supplementsCurrentlyTaking: v }))}
              placeholder="e.g., creatine, protein, multivitamin..."
              numberOfLines={3}
            />
          </View>
        );
      }

      case 7: {
        return (
          <View style={{ paddingTop: 8, alignItems: 'center' }}>
            <LottieView source={CLIENT_LOTTIES.trainerCode} autoPlay loop style={{ width: 300, height: 300, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              Do you have a trainer invite code?
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              Enter it here to connect instantly
            </Text>

            <TextInput
              value={trainerCode}
              onChangeText={(v) => {
                const next = String(v || '').toUpperCase();
                setTrainerCode(next);
                setCodeValid(null);
                setCodeError(null);

                // Persist normalized invite code to Firestore.
                const normalized = normalizeInviteCodeForQuery(next);
                // Clear trainerId on any change; validateTrainerCode will re-set it if the code is valid.
                setOnboardingData((prev) => ({ ...prev, inviteCode: normalized || null, trainerId: null }));

                if (trainerCodeDebounceTimerRef.current) clearTimeout(trainerCodeDebounceTimerRef.current);
                if (next.trim().length > 0) {
                  trainerCodeDebounceTimerRef.current = setTimeout(() => validateTrainerCode(next), 400);
                }
              }}
              placeholder="ENTER INVITE CODE"
              placeholderTextColor={t.textLabel}
              autoCapitalize="characters"
              style={{
                width: '100%',
                marginTop: 28,
                height: 56,
                borderRadius: 14,
                backgroundColor: t.inputBg,
                borderWidth: 1.5,
                borderColor: t.inputBorder,
                paddingHorizontal: 16,
                textAlign: 'center',
                fontSize: 18,
                fontWeight: '700',
                letterSpacing: 4,
                color: t.textPrimary,
              }}
            />

            {codeValid === true ? (
              <Text style={{ fontSize: 12, marginTop: 10, color: '#10B981' }}>✓ Valid code</Text>
            ) : codeValid === false ? (
              <Text style={{ fontSize: 12, marginTop: 10, color: '#EF4444' }}>✕ Invalid code</Text>
            ) : null}

            <Text style={{ fontSize: 12, color: t.textSecondary, marginTop: 10, textAlign: 'center' }}>
              Don't have a code? Browse trainers after signup
            </Text>
          </View>
        );
      }

      default:
        return null;
    }
  };

  const renderTrainerOnlyStep = () => {
    const t = isDark ? TRAINER_DARK : TRAINER_LIGHT;
    const isCompletion = currentStep === completionStep;

    const toggleStr = (arr, val) => {
      const next = Array.isArray(arr) ? arr.slice() : [];
      if (next.includes(val)) return next.filter((v) => v !== val);
      return [...next, val];
    };

    const setPrice = (field, raw) => {
      const num = String(raw || '').replace(/[^0-9]/g, '');
      setOnboardingData((p) => ({
        ...p,
        pricing: { ...p.pricing, [field]: num ? parseInt(num, 10) : null },
      }));
    };

    const experienceLabelToCode = (label) => {
      const map = {
        'Less than 1 year': 'less_than_1',
        '1–2 years': '1_2',
        '3–5 years': '3_5',
        '6–10 years': '6_10',
        '10+ years': '10_plus',
      };
      return map[label] || null;
    };

    if (isCompletion) {
      // Completion UI is handled inside renderClientOnlyStep() but keep a safe fallback here.
      return renderClientOnlyStep();
    }

    switch (currentStep) {
      case 1:
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={TRAINER_LOTTIES.certifications} autoPlay loop style={{ width: 140, height: 140, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              What certifications do you have?
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              Select all that apply
            </Text>
            <View style={{ marginTop: 16 }}>
              {[
                { id: 'NASM-CPT' },
                { id: 'ACE' },
                { id: 'ISSA' },
                { id: 'ACSM' },
                { id: 'NSCA-CPT' },
                { id: 'Other' },
                { id: 'No formal certification', desc: 'You have experience but no formal certification.' },
              ].map((c) => (
                <SelectionCard
                  key={c.id}
                  t={t}
                  selected={(onboardingData.certifications || []).includes(c.id)}
                  onPress={() =>
                    setOnboardingData((p) => ({
                      ...p,
                      certifications: toggleStr(p.certifications, c.id),
                    }))
                  }
                  iconName="ribbon-outline"
                  label={c.id}
                  description={c.desc}
                />
              ))}
            </View>
          </View>
        );

      case 2:
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={TRAINER_LOTTIES.specialties} autoPlay loop style={{ width: 140, height: 140, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              What are your specialties?
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              Select all that apply
            </Text>
            <View style={{ marginTop: 16 }}>
              <ChipSelector
                t={t}
                items={[
                  'Strength Training',
                  'Weight Loss',
                  'Bodybuilding',
                  'Athletic Performance',
                  'Rehabilitation',
                  'Powerlifting',
                  'CrossFit',
                  'Yoga & Flexibility',
                  'Senior Fitness',
                  'Youth Training',
                  'HIIT',
                  'Nutrition Coaching',
                ]}
                selected={onboardingData.specialties || []}
                onToggle={(v) =>
                  setOnboardingData((p) => ({
                    ...p,
                    specialties: toggleStr(p.specialties, v),
                  }))
                }
              />
            </View>
          </View>
        );

      case 3:
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={TRAINER_LOTTIES.experience} autoPlay loop style={{ width: 160, height: 160, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              How long have you been training clients?
            </Text>
            <View style={{ marginTop: 16 }}>
              {['Less than 1 year', '1–2 years', '3–5 years', '6–10 years', '10+ years'].map((l) => {
                const code = experienceLabelToCode(l);
                return (
                  <SelectionCard
                    key={l}
                    t={t}
                    selected={onboardingData.yearsExperience === code}
                    onPress={() => setOnboardingData((p) => ({ ...p, yearsExperience: code }))}
                    label={l}
                  />
                );
              })}
            </View>
          </View>
        );

      case 4:
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={TRAINER_LOTTIES.philosophy} autoPlay loop style={{ width: 160, height: 160, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              Describe your training philosophy
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              Help clients understand your approach
            </Text>
            <View style={{ marginTop: 20 }}>
              <TextAreaWithCounter
                t={t}
                value={onboardingData.trainingPhilosophy || ''}
                onChangeText={(v) => setOnboardingData((p) => ({ ...p, trainingPhilosophy: v }))}
                placeholder="e.g., I believe in progressive overload with strong form fundamentals..."
                numberOfLines={6}
                maxLength={500}
              />
            </View>
          </View>
        );

      case 5:
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={TRAINER_LOTTIES.rates} autoPlay loop style={{ width: 140, height: 140, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              What are your rates?
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              You can always update this later
            </Text>

            <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: t.textLabel, marginBottom: 8 }}>PER SESSION</Text>
                <TextInput
                  value={onboardingData.pricing?.perSession != null ? String(onboardingData.pricing.perSession) : ''}
                  onChangeText={(v) => setPrice('perSession', v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={t.textLabel}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    backgroundColor: t.inputBg,
                    borderWidth: 1.5,
                    borderColor: t.cardBorder,
                    color: t.textPrimary,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.8, color: t.textLabel, marginBottom: 8 }}>PER MONTH</Text>
                <TextInput
                  value={onboardingData.pricing?.perMonth != null ? String(onboardingData.pricing.perMonth) : ''}
                  onChangeText={(v) => setPrice('perMonth', v)}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={t.textLabel}
                  style={{
                    height: 52,
                    borderRadius: 14,
                    paddingHorizontal: 14,
                    backgroundColor: t.inputBg,
                    borderWidth: 1.5,
                    borderColor: t.cardBorder,
                    color: t.textPrimary,
                    fontSize: 16,
                    fontWeight: '600',
                  }}
                />
              </View>
            </View>

            <SectionLabel text="AVAILABILITY" t={t} />
            <SelectionCard
              t={t}
              selected={onboardingData.availability === 'available'}
              onPress={() => setOnboardingData((p) => ({ ...p, availability: 'available' }))}
              iconName="checkmark-circle-outline"
              label="Available Now"
              description="Accepting new clients"
            />
            <SelectionCard
              t={t}
              selected={onboardingData.availability === 'waitlist'}
              onPress={() => setOnboardingData((p) => ({ ...p, availability: 'waitlist' }))}
              iconName="time-outline"
              label="Waitlist"
              description="Currently full, adding to waitlist"
            />

            <SectionLabel text="SESSION TYPE" t={t} />
            <SelectionCard
              t={t}
              selected={onboardingData.sessionType === 'Remote'}
              onPress={() => setOnboardingData((p) => ({ ...p, sessionType: 'Remote' }))}
              iconName="videocam-outline"
              label="Remote"
              description="Online sessions only"
            />
            <SelectionCard
              t={t}
              selected={onboardingData.sessionType === 'In-person'}
              onPress={() => setOnboardingData((p) => ({ ...p, sessionType: 'In-person' }))}
              iconName="location-outline"
              label="In-Person"
              description="Local sessions"
            />
            <SelectionCard
              t={t}
              selected={onboardingData.sessionType === 'Both'}
              onPress={() => setOnboardingData((p) => ({ ...p, sessionType: 'Both' }))}
              iconName="shuffle-outline"
              label="Both"
              description="Flexible"
            />
          </View>
        );

      case 6:
        return (
          <View style={{ paddingTop: 8 }}>
            <LottieView source={TRAINER_LOTTIES.personalInfo} autoPlay loop style={{ width: 120, height: 120, alignSelf: 'center' }} />
            <Text style={{ fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32, marginTop: 16, marginBottom: 6, letterSpacing: -0.3, color: t.textPrimary }}>
              Almost done!
            </Text>
            <Text style={{ fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 4, color: t.textSecondary }}>
              A few last details for your profile
            </Text>
            <View style={{ marginTop: 20 }}>
              <PlainInput t={t} value={onboardingData.name || ''} onChangeText={(v) => setOnboardingData((p) => ({ ...p, name: v }))} placeholder="Full name" />
              <PlainInput t={t} value={onboardingData.location || ''} onChangeText={(v) => setOnboardingData((p) => ({ ...p, location: v }))} placeholder="City, State" />
              <TextAreaWithCounter
                t={t}
                value={onboardingData.bio || ''}
                onChangeText={(v) => setOnboardingData((p) => ({ ...p, bio: v }))}
                placeholder="Short bio..."
                numberOfLines={3}
                maxLength={250}
              />
            </View>
          </View>
        );

      case 7:
        // Keep the existing invite-code step behavior/UI intact.
        return renderTrainerStep();

      default:
        return null;
    }
  };

  // Enhanced gradient text input component

  const renderClientStep = () => {
    switch (currentStep) {
      case 1:
        // Basic Information with Lottie and enhanced inputs
        return (
          <View style={styles.stepContainer}>
            <StepLottie />
            <Text style={dynamicStyles.liquidHeading}>{getStepTitle()}</Text>
            <Text style={dynamicStyles.liquidSubtitle}>This helps us personalize your experience</Text>
            
            {/* Enhanced Input Grid */}
            <View style={styles.enhancedInputGrid}>
              <GradientTextInput
                iconSource={getOnboardingIconSource('weight')}
                label="Weight"
                value={onboardingData.weight}
                onChangeText={(text) => {
                  const num = text.replace(/[^0-9.]/g, '');
                  setOnboardingData(prev => ({ ...prev, weight: num ? parseFloat(num) : null }));
                }}
                keyboardType="numeric"
                unit="lbs"
                isDark={isDark}
                tintColor={getClientStepTint(1, 'inputs')}
              />
              
              <GradientTextInput
                iconSource={getOnboardingIconSource('height')}
                label="Height"
                value={onboardingData.height}
                onChangeText={(text) => {
                  const num = text.replace(/[^0-9.]/g, '');
                  setOnboardingData(prev => ({ ...prev, height: num ? parseFloat(num) : null }));
                }}
                keyboardType="numeric"
                unit="in"
                isDark={isDark}
                tintColor={getClientStepTint(1, 'inputs')}
              />
              
              <GradientTextInput
                iconSource={getOnboardingIconSource('age')}
                label="Age"
                value={onboardingData.age}
                onChangeText={(text) => {
                  const num = text.replace(/[^0-9]/g, '');
                  setOnboardingData(prev => ({ ...prev, age: num ? parseInt(num) : null }));
                }}
                keyboardType="numeric"
                unit="yrs"
                isDark={isDark}
                tintColor={getClientStepTint(1, 'inputs')}
              />
            </View>

            {/* Gender Selection */}
            <View style={styles.genderSection}>
              <Text style={dynamicStyles.liquidSectionTitle}>Gender</Text>
              <View style={styles.genderGridContainer}>
                <View style={styles.genderGrid}>
                  {[
                    { value: 'male', label: 'Male' },
                    { value: 'female', label: 'Female' },
                    { value: 'other', label: 'Other' },
                    { value: 'prefer_not_to_say', label: 'Prefer not to say', useIonicons: true, icon: 'remove-circle-outline' },
                  ].map((item) => (
                    <LiquidGlassSelectCard
                      key={item.value}
                      selected={onboardingData.gender === item.value}
                      onPress={() => handleSelect('gender', item.value)}
                      iconSource={item.useIonicons ? null : getOnboardingIconSource(item.value)}
                      ionicon={item.useIonicons ? item.icon : null}
                      title={item.label}
                      isDark={isDark}
                      tintColor={getClientStepTint(1, 'gender')}
                    />
                  ))}
                </View>
                <LinearGradient
                  colors={['transparent', isDark ? 'rgba(0,0,0,0.8)' : 'rgba(0,0,0,0.1)']}
                  style={styles.genderFadeGradient}
                  pointerEvents="none"
                />
              </View>
            </View>
          </View>
        );

      case 2:
        // Fitness Experience with Lottie and neumorphic cards
        return (
          <View style={styles.stepContainer}>
            <StepLottie />
            <Text style={dynamicStyles.liquidHeading}>{getStepTitle()}</Text>
            <View style={styles.neumorphicCardsContainer}>
              <NeumorphicCard
                selected={onboardingData.fitnessLevel === 'beginner'}
                onPress={() => handleSelect('fitnessLevel', 'beginner')}
                iconSource={getOnboardingIconSource('beginner')}
                title="Beginner"
                subtitle="New to working out"
                isDark={isDark}
                tintColor={getClientStepTint(2)}
              />

              <NeumorphicCard
                selected={onboardingData.fitnessLevel === 'intermediate'}
                onPress={() => handleSelect('fitnessLevel', 'intermediate')}
                iconSource={getOnboardingIconSource('intermediate')}
                title="Intermediate"
                subtitle="Work out regularly"
                isDark={isDark}
                tintColor={getClientStepTint(2)}
              />

              <NeumorphicCard
                selected={onboardingData.fitnessLevel === 'advanced'}
                onPress={() => handleSelect('fitnessLevel', 'advanced')}
                iconSource={getOnboardingIconSource('advanced')}
                title="Advanced"
                subtitle="Experienced athlete"
                isDark={isDark}
                tintColor={getClientStepTint(2)}
              />
            </View>
            <Text
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 8,
                lineHeight: 18,
              }}
            >
              Beginners (under 1 year of consistent training) make the fastest gains with just compound movements. No need to overcomplicate it.
            </Text>
          </View>
        );

      case 3:
        // Main goals step - multi-select cards
        return (
          <View style={styles.stepContainer}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: theme.text,
                marginTop: 28,
                marginBottom: 8,
              }}
            >
              {getStepTitle()}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: theme.subtext,
                lineHeight: 22,
                marginBottom: 28,
              }}
            >
              Select all that apply.
            </Text>

            <View style={{ gap: 10 }}>
              {[
                { value: 'lose_fat', label: 'Lose Fat', icon: 'trending-down-outline', accent: '#F97316' },
                { value: 'build_muscle', label: 'Build Muscle', icon: 'barbell-outline', accent: '#C084FC' },
                { value: 'maintain_health', label: 'Maintain Health', icon: 'heart-outline', accent: '#10B981' },
                { value: 'athletic_performance', label: 'Athletic Performance', icon: 'stopwatch-outline', accent: '#64D2FF' },
                { value: 'improve_mental_health', label: 'Improve Mental Health', icon: 'happy-outline', accent: '#C084FC' },
                { value: 'build_habits', label: 'Build Consistency & Habits', icon: 'calendar-outline', accent: '#FF6B9D' },
              ].map((item) => {
                const goalsArray = Array.isArray(onboardingData.goals)
                  ? onboardingData.goals
                  : [];
                const selected = goalsArray.includes(item.value);
                return (
                  <TouchableOpacity
                    key={item.value}
                    activeOpacity={0.85}
                    onPress={() => {
                      setOnboardingData((prev) => {
                        const current = Array.isArray(prev.goals) ? prev.goals : [];
                        const exists = current.includes(item.value);
                        const nextGoals = exists
                          ? current.filter((g) => g !== item.value)
                          : [...current, item.value];
                        return {
                          ...prev,
                          goals: nextGoals,
                          primaryGoal: nextGoals[0] || null,
                        };
                      });
                    }}
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? theme.cardSelectedBorder : theme.cardBorder,
                      backgroundColor: selected ? theme.cardSelected : theme.card,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: `${item.accent}20`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={item.accent}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: selected ? '#FF6B9D' : theme.text,
                        }}
                      >
                        {item.label}
                      </Text>
                    </View>

                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#FF6B9D"
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 4:
        // Equipment Access + Training environment
        return (
          <View style={styles.stepContainer}>
            <View style={{ height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                {[
                  { icon: 'barbell-outline', delay: 0 },
                  { icon: 'bicycle-outline', delay: 600 },
                  { icon: 'home-outline', delay: 1200 },
                ].map((item, index) => {
                  return (
                    <EquipmentBobbingIcon
                      key={index}
                      icon={item.icon}
                      delayMs={item.delay}
                      cardBg={theme.card}
                    />
                  );
                })}
              </View>
            </View>
            <Text style={dynamicStyles.liquidHeading}>{getStepTitle()}</Text>
            <Text style={dynamicStyles.liquidSubtitle}>Select all that apply</Text>
            <View style={styles.equipmentGridCards}>
              {[
                { value: 'full_gym', label: 'Full Gym', icon: 'barbell-outline' },
                { value: 'dumbbells', label: 'Dumbbells', icon: 'dumbbell-outline' },
                { value: 'resistance_bands', label: 'Resistance Bands', icon: 'extension-puzzle-outline' },
                { value: 'pull_up_bar', label: 'Pull-up Bar', icon: 'reorder-four-outline' },
                { value: 'bodyweight', label: 'Bodyweight Only', icon: 'body-outline' },
              ].map((item, idx, arr) => (
                <TouchableOpacity
                  key={item.value}
                  activeOpacity={0.85}
                  onPress={() => handleSelect('equipmentAccess', item.value, true)}
                  style={{
                    width: arr.length % 2 === 1 && idx === arr.length - 1 ? '100%' : '48%',
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: onboardingData.equipmentAccess.includes(item.value) ? 2 : 1,
                    borderColor: onboardingData.equipmentAccess.includes(item.value) ? theme.cardSelectedBorder : theme.cardBorder,
                    backgroundColor: onboardingData.equipmentAccess.includes(item.value) ? theme.cardSelected : theme.card,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 12,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: `${'#FF6B9D'}20`, // Using a consistent accent color
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: 8,
                    }}
                  >
                    <Ionicons name={item.icon} size={20} color={'#FF6B9D'} />
                  </View>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: onboardingData.equipmentAccess.includes(item.value) ? '#FF6B9D' : theme.text, textAlign: 'center' }}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {Array.isArray(onboardingData.equipmentAccess) &&
              onboardingData.equipmentAccess.includes('bodyweight') && (
                <Text
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.45)',
                    marginTop: 8,
                    lineHeight: 18,
                  }}
                >
                  Bodyweight training works, but limits progressive overload over time. Even a pair of dumbbells opens up significantly more options.
                </Text>
              )}
            <Text style={[dynamicStyles.liquidSectionTitle, { marginTop: 20 }]}>Where do you prefer to train?</Text>
            <View style={{ gap: 10 }}>
              {[
                { value: 'home', label: 'Home', icon: 'home-outline', subtitle: 'Work out from the comfort of your home' },
                { value: 'gym', label: 'Gym', icon: 'barbell-outline', subtitle: 'Access to a full range of gym equipment' },
                { value: 'both', label: 'Both', icon: 'git-merge-outline', subtitle: 'Flexible, combining home and gym workouts' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  activeOpacity={0.85}
                  onPress={() => setOnboardingData(prev => ({ ...prev, trainingEnvironment: item.value }))}
                  style={{
                    width: '100%',
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: onboardingData.trainingEnvironment === item.value ? 2 : 1,
                    borderColor: onboardingData.trainingEnvironment === item.value ? theme.cardSelectedBorder : theme.cardBorder,
                    backgroundColor: onboardingData.trainingEnvironment === item.value ? theme.cardSelected : theme.card,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: `${'#FF6B9D'}20`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={item.icon} size={20} color={'#FF6B9D'} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: onboardingData.trainingEnvironment === item.value ? '#FF6B9D' : theme.text,
                      }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.subtext,
                        marginTop: 2,
                      }}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                  {onboardingData.trainingEnvironment === item.value && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FF6B9D"
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 5:
        // Training Frequency + Preferred workout time
        return (
          <View style={styles.stepContainer}>
            <StepLottie />
            <Text style={dynamicStyles.liquidHeading}>{getStepTitle()}</Text>
            <View style={styles.circularDaySelector}>
              {[1, 2, 3, 4, 5, 6, 7].map((days) => (
                <DayCircle
                  key={days}
                  day={days}
                  selected={onboardingData.daysPerWeek === days}
                  onSelect={() => handleSelect('daysPerWeek', days)}
                  isDark={isDark}
                  tintColor={getClientStepTint(5)}
                />
              ))}
            </View>
            <Text
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 8,
                lineHeight: 18,
              }}
            >
              For real progress, each muscle group needs to be trained 2–3x per week. Most people see the best results at 4 days/week.
            </Text>
            <Text style={[dynamicStyles.liquidSectionTitle, { marginTop: 20 }]}>Preferred workout time</Text>
            <View style={{ gap: 10 }}>
              {[
                { value: 'morning', label: 'Morning', icon: 'sunny-outline', subtitle: '5am – 12pm', accent: 'rgba(249,115,22,0.12)' },
                { value: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline', subtitle: '12pm – 5pm', accent: 'rgba(100,210,255,0.12)' },
                { value: 'evening', label: 'Evening', icon: 'moon-outline', subtitle: '5pm – 10pm', accent: 'rgba(192,132,252,0.12)' },
                { value: 'no_preference', label: 'No Preference', icon: 'time-outline', subtitle: 'Anytime works for me', accent: 'rgba(255,255,255,0.08)' },
              ].map((item) => (
                <TouchableOpacity
                  key={item.value}
                  activeOpacity={0.85}
                  onPress={() => setOnboardingData(prev => ({ ...prev, preferredWorkoutTime: item.value }))}
                  style={{
                    width: '100%',
                    borderRadius: 14,
                    padding: 16,
                    borderWidth: onboardingData.preferredWorkoutTime === item.value ? 2 : 1,
                    borderColor: onboardingData.preferredWorkoutTime === item.value ? theme.cardSelectedBorder : theme.cardBorder,
                    backgroundColor: onboardingData.preferredWorkoutTime === item.value ? theme.cardSelected : theme.card,
                    flexDirection: 'row',
                    alignItems: 'center',
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: item.accent,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <Ionicons name={item.icon} size={20} color={onboardingData.preferredWorkoutTime === item.value ? '#FF6B9D' : theme.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '700',
                        color: onboardingData.preferredWorkoutTime === item.value ? '#FF6B9D' : theme.text,
                      }}
                    >
                      {item.label}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: theme.subtext,
                        marginTop: 2,
                      }}
                    >
                      {item.subtitle}
                    </Text>
                  </View>
                  {onboardingData.preferredWorkoutTime === item.value && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color="#FF6B9D"
                      style={{ marginLeft: 8 }}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 6:
        // Injuries/Limitations + Exercises dislike + Supplements (recommended / optional)
        const noLimitations = onboardingData.injuries === null;
        return (
          <View style={styles.stepContainer}>
            <StepLottie />
            <Text style={dynamicStyles.liquidHeading}>{getStepTitle()}</Text>
            <Text style={dynamicStyles.liquidSubtitle}>Recommended. We'll help you work around them safely</Text>
            <MultiLineCounterInput
              label="Injuries or physical limitations (recommended)"
              value={noLimitations ? '' : (onboardingData.injuries || '')}
              onChangeText={(text) => setOnboardingData(prev => ({ ...prev, injuries: text }))}
              placeholder="e.g., lower back pain, knee issues, shoulder injury..."
              disabled={noLimitations}
              isDark={isDark}
              tintColor={getClientStepTint(6)}
            />
            <Text
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 8,
                lineHeight: 18,
              }}
            >
              Be specific — say which area, what movements hurt, and whether it's chronic or recent. The more detail, the safer your plan.
            </Text>
            <View style={styles.switchContainer}>
              <Text
                style={[
                  styles.switchLabel,
                  { color: isDark ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.78)' },
                ]}
              >
                I have no limitations
              </Text>
              <Switch
                value={noLimitations}
                onValueChange={(value) => setOnboardingData(prev => ({ ...prev, injuries: value ? null : '' }))}
                trackColor={{ false: COLORS.border, true: '#10B981' }}
                thumbColor={COLORS.white}
              />
            </View>
            <MultiLineCounterInput
              label="Exercises you dislike (recommended)"
              value={onboardingData.exercisesDislike || ''}
              onChangeText={(text) => setOnboardingData(prev => ({ ...prev, exercisesDislike: text }))}
              placeholder="e.g., burpees, running, leg press..."
              isDark={isDark}
              tintColor={getClientStepTint(6)}
            />
            <MultiLineCounterInput
              label="Supplements currently taking (optional)"
              value={onboardingData.supplementsCurrentlyTaking || ''}
              onChangeText={(text) => setOnboardingData(prev => ({ ...prev, supplementsCurrentlyTaking: text }))}
              placeholder="e.g., creatine, protein, multivitamin..."
              isDark={isDark}
              tintColor={getClientStepTint(6)}
            />
          </View>
        );

      case 7:
        return (
          <TrainerCodeStep
            lottie={null} // Replace watch Lottie with icon below
            heading={getStepTitle()}
            trainerCode={trainerCode}
            setTrainerCode={setTrainerCode}
            codeValid={codeValid}
            setCodeValid={setCodeValid}
            setCodeError={setCodeError}
            validateTrainerCode={validateTrainerCode}
            shakeAnimation={shakeAnimation}
            isDark={isDark}
            tintColor={getClientStepTint(7)}
          />
        );

      case 8: {
        const opt = (field, options) =>
          options.map((o) => (
            <TouchableOpacity
              key={o.value}
              onPress={() => setOnboardingData(prev => ({ ...prev, [field]: o.value }))}
              style={[styles.genderCard, onboardingData[field] === o.value && styles.genderCardSelected]}
            >
              <Text style={[styles.genderCardText, { color: isDark ? '#fff' : '#2D3748' }]}>{o.label}</Text>
            </TouchableOpacity>
          ));
        return (
          <View style={styles.stepContainer}>
            <StepLottie />
            <Text style={dynamicStyles.liquidHeading}>{getStepTitle()}</Text>
            <Text style={[dynamicStyles.liquidSectionTitle, { marginTop: 8 }]}>Current stress level (optional)</Text>
            <View style={styles.genderGrid}>{opt('currentStressLevel', [{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }])}</View>
            <Text style={[dynamicStyles.liquidSectionTitle, { marginTop: 16 }]}>Sleep quality (optional)</Text>
            <View style={styles.genderGrid}>{opt('sleepQuality', [{ value: 'poor', label: 'Poor' }, { value: 'fair', label: 'Fair' }, { value: 'good', label: 'Good' }])}</View>
            <Text style={[dynamicStyles.liquidSectionTitle, { marginTop: 16 }]}>Energy levels (optional)</Text>
            <View style={styles.genderGrid}>{opt('energyLevels', [{ value: 'low', label: 'Low' }, { value: 'moderate', label: 'Moderate' }, { value: 'high', label: 'High' }])}</View>
            <Text style={[dynamicStyles.liquidSectionTitle, { marginTop: 16 }]}>Hydration habits (optional)</Text>
            <View style={styles.genderGrid}>{opt('hydrationHabits', [{ value: 'less_than_4', label: 'Less than 4 cups/day' }, { value: '4_8', label: '4–8 cups/day' }, { value: 'more_than_8', label: 'More than 8 cups/day' }])}</View>
            <DescribeSituationStep
              lottie={null}
              heading="Describe your situation"
              situationDescription={onboardingData.situationDescription || ''}
              setSituationDescription={(text) => setOnboardingData(prev => ({ ...prev, situationDescription: text }))}
              shakeAnimation={shakeAnimation}
              isDark={isDark}
              tintColor={getClientStepTint(8)}
            />
          </View>
        );
      }

      default:
        return null;
    }
  };

  // Render trainer step content with new design
  const renderTrainerStep = () => {
    switch (currentStep) {
      case 1:
        // Certifications step - multi-select themed cards
        return (
          <View style={styles.stepContainer}>
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: theme.text,
                marginTop: 28,
                marginBottom: 8,
              }}
            >
              {getStepTitle()}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: theme.subtext,
                lineHeight: 22,
                marginBottom: 28,
              }}
            >
              Select all that apply.
            </Text>

            <View style={{ gap: 12 }}>
              {[
                { value: 'NASM-CPT', label: 'NASM-CPT' },
                { value: 'ACE', label: 'ACE' },
                { value: 'ISSA', label: 'ISSA' },
                { value: 'ACSM', label: 'ACSM' },
                { value: 'NSCA-CPT', label: 'NSCA-CPT' },
                { value: 'Other', label: 'Other' },
                { value: 'None', label: 'No formal certification' },
              ].map((item) => {
                const selected = onboardingData.certifications.includes(item.value);
                return (
                  <TouchableOpacity
                    key={item.value}
                    activeOpacity={0.85}
                    onPress={() => {
                      handleSelect('certifications', item.value, true);
                      if (item.value !== 'Other' && onboardingData.certifications.includes('Other')) {
                        setOnboardingData((prev) => ({ ...prev, certificationOther: '' }));
                      }
                    }}
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? theme.cardSelectedBorder : theme.cardBorder,
                      backgroundColor: selected ? theme.cardSelected : theme.card,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: theme.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Ionicons
                        name="ribbon-outline"
                        size={20}
                        color={selected ? '#FF6B9D' : theme.subtext}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: selected ? '#FF6B9D' : theme.text,
                        }}
                      >
                        {item.label}
                      </Text>
                      {item.value === 'None' && (
                        <Text
                          style={{
                            fontSize: 13,
                            color: theme.subtext,
                            marginTop: 2,
                          }}
                        >
                          You have experience but no formal certification.
                        </Text>
                      )}
                    </View>

                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#FF6B9D"
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {onboardingData.certifications.includes('Other') && (
              <View style={{ marginTop: 20 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color: theme.text,
                    marginBottom: 8,
                  }}
                >
                  Specify certification
                </Text>
                <TextInput
                  value={onboardingData.certificationOther}
                  onChangeText={(text) =>
                    setOnboardingData((prev) => ({ ...prev, certificationOther: text }))
                  }
                  placeholder="e.g. Precision Nutrition Level 1"
                  placeholderTextColor={theme.placeholder}
                  style={{
                    backgroundColor: theme.input,
                    borderWidth: 1,
                    borderColor: theme.inputBorder,
                    borderRadius: 12,
                    padding: 14,
                    height: 50,
                    color: theme.inputText,
                    fontSize: 15,
                  }}
                />
              </View>
            )}
          </View>
        );

      case 2:
        // Experience Level with neumorphic cards
        return (
          <View style={styles.stepContainer}>
            {getSafeLottie() && (
              <LottieView
                source={getSafeLottie()}
                autoPlay
                loop
                style={[styles.lottieAnimation, { height: 260 }]}
              />
            )}
            <Text style={styles.heading}>{getStepTitle()}</Text>
            <View style={styles.neumorphicCardsContainer}>
              {[
                { value: 'less_than_1', label: 'Less than 1 year' },
                { value: '1_2', label: '1-3 years' },
                { value: '3_5', label: '3-5 years' },
                { value: '6_10', label: '5-10 years' },
                { value: '10_plus', label: '10+ years' },
              ].map((item) => (
                <NeumorphicCard
                  key={item.value}
                  selected={onboardingData.yearsExperience === item.value}
                  onPress={() => handleSelect('yearsExperience', item.value)}
                  title={item.label}
                  isDark={isDark}
                />
              ))}
            </View>
            
            <GradientTextInput
              icon="📍"
              label="City, State"
              value={onboardingData.location}
              onChangeText={(text) => setOnboardingData(prev => ({ ...prev, location: text }))}
              placeholder="e.g. Detroit, MI"
              keyboardType="default"
              isDark={isDark}
              tintColor={getClientStepTint(2)}
            />
          </View>
        );

      case 3:
        // Specialties step - multi-select option cards with Ionicons, no emojis
        return (
          <View style={styles.stepContainer}>
            {getSafeLottie() && (
              <LottieView
                source={getSafeLottie()}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
            )}
            <Text
              style={{
                fontSize: 26,
                fontWeight: '800',
                color: theme.text,
                marginTop: 28,
                marginBottom: 8,
              }}
            >
              {getStepTitle()}
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: theme.subtext,
                lineHeight: 22,
                marginBottom: 28,
              }}
            >
              Select all that apply.
            </Text>

            <View style={{ gap: 10 }}>
              {[
                { value: 'strength', label: 'Strength Training', icon: 'barbell-outline' },
                { value: 'weight_loss', label: 'Weight Loss', icon: 'trending-down-outline' },
                { value: 'bodybuilding', label: 'Bodybuilding', icon: 'body-outline' },
                { value: 'athletic', label: 'Athletic Performance', icon: 'stopwatch-outline' },
                { value: 'rehabilitation', label: 'Rehabilitation', icon: 'medkit-outline' },
                { value: 'powerlifting', label: 'Powerlifting', icon: 'barbell-outline' },
                { value: 'crossfit', label: 'CrossFit', icon: 'flash-outline' },
                { value: 'yoga', label: 'Yoga / Flexibility', icon: 'leaf-outline' },
                { value: 'senior', label: 'Senior Fitness', icon: 'heart-outline' },
                { value: 'youth', label: 'Youth Training', icon: 'people-outline' },
                { value: 'hiit', label: 'HIIT', icon: 'timer-outline' },
                { value: 'nutrition', label: 'Nutrition Coaching', icon: 'nutrition-outline' },
              ].map((item) => {
                const selected = onboardingData.specialties.includes(item.value);
                return (
                  <TouchableOpacity
                    key={item.value}
                    activeOpacity={0.85}
                    onPress={() => handleSelect('specialties', item.value, true)}
                    style={{
                      width: '100%',
                      borderRadius: 14,
                      padding: 16,
                      borderWidth: selected ? 2 : 1,
                      borderColor: selected ? theme.cardSelectedBorder : theme.cardBorder,
                      backgroundColor: selected ? theme.cardSelected : theme.card,
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: theme.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 12,
                      }}
                    >
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={selected ? '#FF6B9D' : theme.subtext}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: selected ? '#FF6B9D' : theme.text,
                        }}
                      >
                        {item.label}
                      </Text>
                    </View>

                    {selected && (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color="#FF6B9D"
                        style={{ marginLeft: 8 }}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );

      case 4:
        const philosophyLength = onboardingData.trainingPhilosophy.length;
        const isValidLength = philosophyLength >= 200 && philosophyLength <= 500;
        return (
          <View style={styles.stepContainer}>
            {getSafeLottie() && <LottieView source={getSafeLottie()} autoPlay loop style={styles.lottieAnimation} />}
            <Text style={styles.heading}>{getStepTitle()}</Text>
            <Text style={styles.subtitle}>What makes your approach unique?</Text>
            <MultiLineCounterInput
              label="Training philosophy (200–500 chars)"
              value={onboardingData.trainingPhilosophy}
              onChangeText={(text) => setOnboardingData(prev => ({ ...prev, trainingPhilosophy: text }))}
              placeholder="e.g., I believe in sustainable habits over quick fixes..."
              disabled={false}
            />
            <Text style={[styles.validationHint, isValidLength && styles.validationHintValid]}>
              {isValidLength ? '✓ Looks good' : `${Math.max(0, 200 - philosophyLength)} characters to go`}
            </Text>
          </View>
        );

      case 5:
        // Session type: Remote / In-person / Both
        return (
          <View style={styles.stepContainer}>
            {getSafeLottie() && (
              <LottieView
                source={getSafeLottie()}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
            )}
            <Text style={styles.heading}>{getStepTitle()}</Text>
            <Text style={styles.subtitle}>How do you coach your clients?</Text>
            <View style={styles.neumorphicCardsContainer}>
              <NeumorphicCard
                selected={onboardingData.sessionType === 'Remote'}
                onPress={() => setOnboardingData(prev => ({ ...prev, sessionType: 'Remote' }))}
                iconSource={getOnboardingIconSource('remote')}
                title="Remote"
                subtitle="Online sessions, video calls, app-based coaching"
                isDark={isDark}
              />
              <NeumorphicCard
                selected={onboardingData.sessionType === 'In-person'}
                onPress={() => setOnboardingData(prev => ({ ...prev, sessionType: 'In-person' }))}
                iconSource={getOnboardingIconSource('gym')}
                title="In-person"
                subtitle="Train clients at a gym or facility in person"
                isDark={isDark}
              />
              <NeumorphicCard
                selected={onboardingData.sessionType === 'Both'}
                onPress={() => setOnboardingData(prev => ({ ...prev, sessionType: 'Both' }))}
                iconSource={getOnboardingIconSource('both')}
                title="Both"
                subtitle="Flexible — you do both remote and in-person"
                isDark={isDark}
              />
            </View>
          </View>
        );

      case 6:
        // Pricing with rate inputs and toggles
        return (
          <View style={styles.stepContainer}>
            {getSafeLottie() && <LottieView source={getSafeLottie()} autoPlay loop style={styles.lottieAnimation} />}
            <Text style={styles.heading}>{getStepTitle()}</Text>
            <Text style={styles.subtitle}>Set your pricing structure (optional)</Text>

            <View style={styles.rateStack}>
              <RateInput
                label="Per Session Rate"
                placeholder="75"
                value={onboardingData.pricing.perSession?.toString() || ''}
                onChangeText={(text) => {
                  const num = text.replace(/[^0-9]/g, '');
                  setOnboardingData(prev => ({
                    ...prev,
                    pricing: { ...prev.pricing, perSession: num ? parseInt(num, 10) : null },
                  }));
                }}
              />

              <RateInput
                label="Monthly Package (4 sessions)"
                placeholder="280"
                value={onboardingData.pricing.perMonth?.toString() || ''}
                onChangeText={(text) => {
                  const num = text.replace(/[^0-9]/g, '');
                  setOnboardingData(prev => ({
                    ...prev,
                    pricing: { ...prev.pricing, perMonth: num ? parseInt(num, 10) : null },
                  }));
                }}
              />

              <RateInput
                label="Initial Consultation"
                placeholder="50"
                value={onboardingData.pricing.initialConsult?.toString() || ''}
                onChangeText={(text) => {
                  const num = text.replace(/[^0-9]/g, '');
                  setOnboardingData(prev => ({
                    ...prev,
                    pricing: { ...prev.pricing, initialConsult: num ? parseInt(num, 10) : null },
                  }));
                }}
              />
            </View>

            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Offer free consultation</Text>
              <Switch
                value={!!onboardingData.offerFreeConsultation}
                onValueChange={(v) => setOnboardingData(prev => ({ ...prev, offerFreeConsultation: v }))}
                trackColor={{ false: COLORS.border, true: '#10B981' }}
                thumbColor={COLORS.white}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Flexible pricing available</Text>
              <Switch
                value={!!onboardingData.flexiblePricingAvailable}
                onValueChange={(v) => setOnboardingData(prev => ({ ...prev, flexiblePricingAvailable: v }))}
                trackColor={{ false: COLORS.border, true: '#10B981' }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>
        );

      case 7:
        const rotate = inviteBorderRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        const pulseScale = inviteBorderPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
        const displayCode = inviteCode ? inviteCode.replace('-', '') : 'XXXXXX';
        return (
          <View style={styles.stepContainer}>
            {getSafeLottie() && <LottieView source={getSafeLottie()} autoPlay loop style={styles.lottieAnimation} />}
            <Text style={styles.heading}>{getStepTitle()}</Text>
            <Text style={styles.subtitle}>Share this with your clients to get started</Text>

            <View style={styles.codeCardOuter}>
              <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
                <View style={styles.codeCardFrame}>
                  <Animated.View style={[styles.codeCardBorderAnim, { transform: [{ rotate }] }]}>
                    <LinearGradient colors={GRADIENTS.bluePurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                  </Animated.View>
                  <View style={styles.codeCardInner}>
                    {generatingCode ? (
                      <ActivityIndicator size="large" color={COLORS.textPrimary} />
                    ) : (
                      <Text style={styles.codeCardText}>{`TRAINER-${displayCode}`}</Text>
                    )}
                  </View>
                </View>
              </Animated.View>
            </View>

            <View style={styles.inviteButtons}>
              <TouchableOpacity style={styles.halfButton} onPress={() => copyToClipboard(inviteCode)} disabled={!inviteCode}>
                <LinearGradient colors={GRADIENTS.bluePurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.halfButtonBorder}>
                  <View style={styles.halfButtonInner}>
                    <Text style={styles.halfButtonText}>Copy Code</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.halfButton} onPress={shareInviteCode} disabled={!inviteCode}>
                <LinearGradient colors={GRADIENTS.bluePurple} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.halfButtonFill}>
                  <Text style={styles.halfButtonTextFilled}>Share</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  const dynamicStyles = getStyles(isDark);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ flex: 1, backgroundColor: theme.bg }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <ScrollView
            style={{ flex: 1, backgroundColor: theme.bg }}
            contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 24, paddingBottom: 80 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header row: back, gradient progress, step counter */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}>
              {currentStep > 1 && currentStep !== completionStep ? (
                <TouchableOpacity
                  onPress={handleBack}
                  activeOpacity={0.8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    backgroundColor: (isDark ? CLIENT_DARK : CLIENT_LIGHT).backBtnBg,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons name="chevron-back" size={20} color={(isDark ? CLIENT_DARK : CLIENT_LIGHT).textPrimary} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 36 }} />
              )}

              {currentStep !== completionStep ? (
                <ProgressBar current={currentStep} total={totalSteps} t={isDark ? CLIENT_DARK : CLIENT_LIGHT} />
              ) : (
                <View style={{ flex: 1 }} />
              )}

              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: (isDark ? CLIENT_DARK : CLIENT_LIGHT).textSecondary,
                  minWidth: 36,
                  textAlign: 'right',
                }}
              >
                {currentStep !== completionStep ? `${currentStep}/${totalSteps}` : ''}
              </Text>
            </View>

            {currentStep === completionStep
              ? renderClientOnlyStep()
              : role === 'trainer'
                ? renderTrainerOnlyStep()
                : renderClientOnlyStep()}
          </ScrollView>

          {/* Bottom Navigation */}
          <View style={[dynamicStyles.navigationBar, { justifyContent: 'flex-start' }]}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={currentStep > 1 ? handleBack : handleLogout}
              disabled={loading}
            >
              <View style={dynamicStyles.backButtonCircle}>
                <Text style={dynamicStyles.backButtonIcon}>{currentStep > 1 ? '←' : '×'}</Text>
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'flex-end' }}>
              {isOptionalStep() && currentStep !== completionStep ? (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip} disabled={loading}>
                  <Text style={dynamicStyles.skipButtonText}>Skip</Text>
                </TouchableOpacity>
              ) : null}

              <View style={{ flex: 1 }}>
                {currentStep === completionStep ? (
                  <ContinueButton
                    t={isDark ? CLIENT_DARK : CLIENT_LIGHT}
                    disabled={loading}
                    label="Start Your Journey"
                    onPress={handleFinish}
                  />
                ) : (
                  <ContinueButton
                    t={isDark ? CLIENT_DARK : CLIENT_LIGHT}
                    disabled={!validateStep() || loading}
                    label="Continue"
                    onPress={handleNext}
                  />
                )}
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

// Get theme-aware styles
const getStyles = (isDark = true) => ({
  liquidHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: isDark ? 'rgba(255,255,255,0.96)' : 'rgba(15,23,42,0.96)',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: isDark ? 'rgba(255,255,255,0.70)' : 'rgba(51,65,85,0.72)',
    textAlign: 'center',
    marginBottom: 20,
  },
  liquidSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: isDark ? 'rgba(255,255,255,0.80)' : 'rgba(30,41,59,0.78)',
    letterSpacing: 0.9,
    marginBottom: 14,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 16,
    color: isDark ? '#9CA3AF' : '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: isDark ? '#F9FAFB' : '#1F2937',
    textAlign: 'center',
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  textInput: {
    fontSize: 16,
    color: isDark ? '#F9FAFB' : '#1F2937',
    minHeight: 120,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
  },
  pricingInput: {
    fontSize: 24,
    fontWeight: '700',
    color: isDark ? '#F9FAFB' : '#1F2937',
    textAlign: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
  },
  pricingLabel: {
    fontSize: 14,
    color: isDark ? '#D1D5DB' : '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  charCounterText: {
    fontSize: 14,
    color: isDark ? '#9CA3AF' : '#6B7280',
  },
  navigationBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 20,
    backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.8)',
    backdropFilter: 'blur(20px)',
    borderTopWidth: 1,
    borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: isDark ? '#3A3A3A' : '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    fontSize: 24,
    color: isDark ? '#F9FAFB' : '#1F2937',
  },
  skipButtonText: {
    fontSize: 16,
    color: isDark ? '#9CA3AF' : '#6B7280',
    fontWeight: '500',
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: isDark ? '#2A2A2A' : '#FFFFFF',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  inputError: {
    borderWidth: 2,
    borderColor: isDark ? '#F87171' : '#FCA5A5',
  },
  modernInputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: isDark ? '#D1D5DB' : '#6B7280',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modernNumberInput: {
    fontSize: 32,
    fontWeight: '700',
    color: isDark ? '#FFFFFF' : '#1F2937',
    textAlign: 'center',
    flex: 1,
    minWidth: 60,
  },
  modernUnitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: isDark ? '#D1D5DB' : '#6B7280',
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: isDark ? '#F9FAFB' : '#1F2937',
    marginBottom: 16,
    marginTop: 8,
  },
  modernGenderLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: isDark ? '#E5E7EB' : '#4B5563',
    marginTop: 8,
    textAlign: 'center',
  },
  modernGenderLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 40,
    paddingBottom: 120,
  },
  stepContainer: {
    marginTop: 24,
  },
  cardsContainer: {
    gap: 12,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  gridCard: {
    width: (width - 60) / 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    textAlign: 'center',
    marginTop: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  horizontalScroll: {
    marginHorizontal: -24,
    paddingHorizontal: 24,
  },
  frequencyCard: {
    width: 140,
    marginRight: 12,
  },
  frequencyNumber: {
    fontSize: 48,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
  },
  frequencyLabel: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
  },
  inputCard: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  inputGradient: {
    padding: 20,
    borderRadius: 16,
  },
  inputError: {
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  textInput: {
    fontSize: 16,
    color: '#1F2937',
    minHeight: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  codeInput: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    padding: 16,
  },
  codeIndicator: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -10,
  },
  checkmark: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -12,
    fontSize: 24,
    color: '#10B981',
    fontWeight: 'bold',
  },
  errorMark: {
    position: 'absolute',
    right: 16,
    top: '50%',
    marginTop: -12,
    fontSize: 24,
    color: '#EF4444',
    fontWeight: 'bold',
  },
  charCounter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  charCounterText: {
    fontSize: 14,
    color: '#6B7280',
  },
  charCounterValid: {
    color: '#10B981',
    fontWeight: '600',
  },
  pricingContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  neumorphicCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  pricingGradient: {
    padding: 20,
    borderRadius: 16,
  },
  pricingCard: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  pricingLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
    textAlign: 'center',
  },
  pricingInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
  },
  inviteCardContainer: {
    marginBottom: 24,
  },
  inviteCard: {
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  inviteCode: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  inviteButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  primaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  navigationBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: 'rgba(250, 250, 250, 0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  backButton: {
    width: 44,
    height: 44,
  },
  backButtonCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonIcon: {
    fontSize: 24,
    color: '#1F2937',
  },
  skipButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  nextButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    marginLeft: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  nextButtonDisabledContainer: {
    shadowOpacity: 0,
    elevation: 0,
  },
  nextButtonGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.8,
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  nextButtonTextDisabled: {
    color: '#94A3B8',
  },
  // Modern input styles
  modernInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  modernInputCard: {
    flex: 1,
    minWidth: (width - 60) / 3 - 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  modernInputCardDark: {
    backgroundColor: '#2D2D2D',
    borderColor: 'rgba(139, 92, 246, 0.6)',
    borderWidth: 2,
  },
  modernInputIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  modernInputIconText: {
    fontSize: 28,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  numberInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    flex: 1,
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  modernInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    width: '100%',
  },
  // Modern gender selection styles
  modernGenderSection: {
    marginTop: 8,
  },
  modernGenderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  modernGenderCard: {
    flex: 1,
    minWidth: (width - 60) / 2 - 6,
    height: 100,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modernGenderCardSelected: {
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    transform: [{ scale: 1.02 }],
  },
  modernGenderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
  },
  modernGenderEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  modernGenderCheckmark: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  modernGenderCheckmarkText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },

  // Trainer pricing + invite code (spec-aligned)
  rateStack: {
    gap: 16,
    marginTop: 8,
  },
  rateCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  rateLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    marginBottom: 10,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    paddingHorizontal: 4,
  },
  rateCurrency: {
    fontSize: 20,
    color: COLORS.textSecondary,
    width: 24,
    textAlign: 'center',
  },
  rateInput: {
    flex: 1,
    fontSize: 20,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
  },
  codeCardOuter: {
    marginTop: 8,
    marginBottom: 16,
  },
  codeCardFrame: {
    borderRadius: 20,
    padding: 3,
    overflow: 'hidden',
  },
  codeCardBorderAnim: {
    ...StyleSheet.absoluteFillObject,
  },
  codeCardInner: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  codeCardText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 2,
    color: COLORS.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  halfButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  halfButtonBorder: {
    flex: 1,
    padding: 2,
    borderRadius: 28,
  },
  halfButtonInner: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#5B86E5',
  },
  halfButtonFill: {
    flex: 1,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halfButtonTextFilled: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
  },

  heading: {
    fontSize: 28,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Equipment cards (2-column grid)
  equipmentGridCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  equipmentCardHit: {
    width: TWO_COL_ITEM,
    marginBottom: 16,
  },
  equipmentCardShell: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  equipmentCardShellSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  equipmentCardBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  equipmentCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  equipmentCardInner: {
    borderRadius: 24,
    height: 120,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  equipmentSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
  },
  equipmentIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  equipmentIconImage: {
    width: 44,
    height: 44,
    marginBottom: 10,
    resizeMode: 'contain',
  },
  equipmentLabel: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  equipmentCheckboxOutline: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'transparent',
  },
  equipmentCheckbox: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#C084FC',
    borderColor: '#C084FC',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipmentCheckboxText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Day selector
  dayCircleHit: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  dayCircleOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  dayCircleOuterSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  dayCircleBorder: {
    borderRadius: 26,
    padding: 0.5,
    overflow: 'hidden',
    flex: 1,
  },
  dayCircleBlur: {
    borderRadius: 26,
    overflow: 'hidden',
    flex: 1,
  },
  dayCircleSurface: {
    flex: 1,
    width: '100%',
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayCircleSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
  },
  dayCircleText: {
    fontSize: 18,
    fontWeight: '900',
  },

  // Multi-line input w/ counter
  multiLineWrapper: {
    marginTop: 8,
  },
  multiLineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 10,
  },
  multiLineShell: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  multiLineBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  multiLineBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  multiLineInner: {
    padding: 16,
    minHeight: 180,
    borderRadius: 24,
  },
  multiLineInput: {
    fontSize: 16,
    color: COLORS.textPrimary,
    minHeight: 120,
  },
  multiLineCounter: {
    position: 'absolute',
    right: 14,
    bottom: 12,
    fontSize: 12,
    fontWeight: '700',
  },

  validationHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 10,
    textAlign: 'center',
  },
  validationHintValid: {
    color: '#10B981',
    fontWeight: '700',
  },

  // Trainer code cards
  codeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 10,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Rate underline
  rateUnderline: {
    height: 2,
    marginTop: 10,
    borderRadius: 2,
    overflow: 'hidden',
  },
  rateUnderlineFill: {
    flex: 1,
    borderRadius: 2,
  },
  rateUnderlineBase: {
    flex: 1,
    backgroundColor: COLORS.border,
  },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: 4,
  },

  otherCertContainer: {
    marginTop: 16,
  },

  // Core onboarding layout + components (spec-aligned)
  lottieAnimation: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 20,
  },
  iconPlaceholder: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },

  // Gradient floating-label input
  enhancedInputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
    marginBottom: 16,
  },
  gradientInputContainer: {
    width: '100%',
  },
  gradientInputWrapper: {
    height: 56,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    overflow: 'hidden',
  },
  gradientInputBorder: {
    position: 'absolute',
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 18,
  },
  gradientInputContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  inputIconSlot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  inputIcon: {
    fontSize: 26,
    color: 'rgba(255,255,255,0.90)',
    width: 40,
    textAlign: 'center',
  },
  inputIconImage: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  inputFieldContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  floatingLabel: {
    position: 'absolute',
    left: 0,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  gradientTextInput: {
    height: 64,
    fontSize: 22,
    color: 'rgba(255,255,255,0.92)',
    paddingTop: 24,
    paddingBottom: 0,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  unitLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.62)',
    marginBottom: 6,
  },
  clearButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.72)',
  },

  // Gender selection
  genderSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  liquidHeading: {
    fontSize: 28,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.96)',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.2,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  // Gender selection
  genderSection: {
    marginTop: 16,
  },
  genderGridContainer: {
    position: 'relative',
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  genderCard: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    minWidth: 90,
  },
  genderCardSelected: {
    backgroundColor: 'rgba(100,210,255,0.2)',
    borderColor: '#64D2FF',
  },
  genderCardText: {
    fontSize: 14,
    fontWeight: '600',
  },
  genderFadeGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 14,
    textTransform: 'uppercase',
  },

  // Neumorphic cards (Modernized)
  neumorphicCardsContainer: {
    gap: 16,
  },
  neumorphicCardContainer: {
    borderRadius: 20,
    width: '100%',
  },
  neumorphicCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Liquid Glass field + select cards (Step 1)
  liquidFieldOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  liquidFieldBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidFieldBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidFieldSurface: {
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  liquidSelectHit: {
    width: '100%',
  },
  liquidSelectOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  liquidSelectOuterSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  liquidSelectBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidSelectBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidSelectSurface: {
    height: 92,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
  },
  liquidSelectIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  liquidSelectTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.92)',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidSelectCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidSelectCheckText: {
    fontSize: 14,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
  },

  // Liquid Glass row card (replaces old neumorphic card visuals)
  liquidCardHit: {
    width: '100%',
  },
  liquidCardOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
  },
  liquidCardOuterSelected: {
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  liquidCardBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidCardSurface: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 24,
  },
  liquidCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  liquidCardIcon: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  liquidCardEmoji: {
    fontSize: 26,
    width: 30,
    textAlign: 'center',
  },
  liquidCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidCardSubtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
  },
  liquidCardCheck: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liquidCardCheckText: {
    fontSize: 14,
    fontWeight: '900',
  },

  // Liquid Glass textarea + tip (Step 8)
  liquidAreaOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  liquidAreaBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidAreaBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidAreaSurface: {
    minHeight: 220,
    padding: 16,
    borderRadius: 24,
  },
  liquidAreaInput: {
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
    minHeight: 180,
    fontFamily: Platform.OS === 'ios' ? 'SF Pro Rounded' : undefined,
  },
  liquidAreaCounter: {
    position: 'absolute',
    bottom: 12,
    right: 16,
  },
  liquidTipOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  liquidTipBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  liquidTipBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  liquidTipSurface: {
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  neumorphicCardSelected: {
    borderWidth: 2,
  },
  neumorphicCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
  },
  neumorphicCardContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  neumorphicCardIcon: {
    fontSize: 32,
  },
  neumorphicCardIconImage: {
    width: 34,
    height: 34,
    resizeMode: 'contain',
  },
  neumorphicCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  neumorphicCardTitleSelected: {
    color: '#7C3AED',
  },
  neumorphicCardSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  neumorphicCardSubtitleSelected: {
    color: '#64748B',
  },
  neumorphicCardCheckmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5B86E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  neumorphicCardCheckmarkText: {
    fontSize: 14,
    fontWeight: '900',
    color: COLORS.white,
  },

  // Gradient pill grid
  gradientPillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  gradientPillContainer: {
    width: TWO_COL_ITEM,
    marginBottom: 16,
  },
  gradientPill: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
  },
  gradientPillBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  gradientPillBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  gradientPillSurface: {
    height: 76,
    borderRadius: 24,
    paddingHorizontal: 16,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gradientPillSelectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.14,
  },
  gradientPillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  gradientPillIcon: {
    fontSize: 18,
  },
  gradientPillIconImage: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },
  gradientPillText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  gradientPillCheckmark: {
    fontSize: 16,
    fontWeight: '900',
  },

  // Day selector container
  circularDaySelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 16,
  },
  helperText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // Switch row (client injuries)
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  switchLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  // Client trainer code cards
  expandableCardsContainer: {
    gap: 16,
    marginTop: 16,
  },
  expandableCardOuter: {
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 6,
    overflow: 'hidden',
  },
  expandableCardBorder: {
    borderRadius: 24,
    padding: 0.5,
    overflow: 'hidden',
  },
  expandableCardBlur: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  expandableCardSurface: {
    borderRadius: 24,
    padding: 18,
    justifyContent: 'center',
  },
  expandableCardTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  codeInput: {
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  validationSuccess: {
    marginTop: 10,
    color: '#10B981',
    fontWeight: '800',
  },
  validationError: {
    marginTop: 10,
    color: '#EF4444',
    fontWeight: '800',
  },

  // Certifications wrap
  certificationPillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },

  selectablePillHit: {
    marginRight: 8,
    marginBottom: 8,
  },
  selectablePill: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectablePillSelected: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  selectablePillText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  selectablePillTextSelected: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.white,
  },

  inviteButtons: {
    flexDirection: 'row',
    gap: 8,
  },
});

