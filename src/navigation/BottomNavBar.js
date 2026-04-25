import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../shared/ui/ThemeContext';
import FluidGlass from '../shared/ui/FluidGlass';
import { useMergedNavigation } from './AppNavigationContext';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import GradientChatBubblesIcon from '../shared/components/GradientChatBubblesIcon';
import { useAI } from '../contexts/AIContext';
import {
  BRAND_NAV_ICON_GRADIENT,
  BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  BRAND_ICON_GRADIENT_START,
  BRAND_ICON_GRADIENT_END,
} from '../shared/ui/brandGradients';

/** Logo-aligned vertical gradient for all tab icons (pink → purple → indigo). */
const BrandGradientIcon = ({
  name,
  size = 36,
  colors = BRAND_NAV_ICON_GRADIENT,
  locations = BRAND_NAV_ICON_GRADIENT_LOCATIONS,
  start = BRAND_ICON_GRADIENT_START,
  end = BRAND_ICON_GRADIENT_END,
}) => (
  <MaskedView
    style={{ width: size, height: size }}
    maskElement={
      <View
        style={{
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'transparent',
        }}
      >
        <Ionicons name={name} size={size} color="#000" />
      </View>
    }
  >
    <LinearGradient
      colors={colors}
      locations={locations}
      start={start}
      end={end}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

export default function BottomNavBar({
  onPlusPress: onPlusPressProp,
  onVoicePress: onVoicePressProp,
  onNutritionPress: onNutritionPressProp,
  onProfilePress: onProfilePressProp,
  onWorkoutPress: onWorkoutPressProp,
  onHomePress: onHomePressProp,
  onMessagesPress: onMessagesPressProp,
}) {
  // Use props directly if provided, otherwise fall back to context
  const directProps = {
    onHomePress: onHomePressProp,
    onPlusPress: onPlusPressProp,
    onVoicePress: onVoicePressProp,
    onNutritionPress: onNutritionPressProp,
    onWorkoutPress: onWorkoutPressProp,
    onProfilePress: onProfilePressProp,
    onMessagesPress: onMessagesPressProp,
  };
  
  // If all required props are provided, use them directly (no context lookup)
  const hasAllProps = Object.values(directProps).every(prop => prop && typeof prop === 'function');
  
  const {
    onHomePress,
    onPlusPress,
    onVoicePress,
    onNutritionPress,
    onWorkoutPress,
    onMessagesPress,
  } = hasAllProps ? directProps : useMergedNavigation(directProps);
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { aiEnabled } = useAI();
  const aiOn = aiEnabled === true;

  const NAV_TINT = isDark ? colors.black : colors.white;
  const NAV_BORDER = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const NAV_LABEL = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
  const INACTIVE_ICON_COLOR = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: NAV_BORDER,
      backgroundColor: NAV_TINT,
      paddingBottom: insets.bottom,
      paddingTop: spacing.sm,
      minHeight: 80 + insets.bottom,
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      paddingHorizontal: 0,
      position: 'relative',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 12,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    },
    navItem: {
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      borderRadius: 16,
      paddingHorizontal: 0,
      flex: 1,
      maxWidth: '18%',
    },
    navIcon: {
      marginBottom: spacing.xs / 2,
      marginTop: 0,
    },
    navLabel: {
      fontSize: 10,
      color: NAV_LABEL,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    plusButton: {
      width: 64,
      height: 64,
      marginBottom: spacing.md,
      position: 'absolute',
      left: '50%',
      marginLeft: -32,
      zIndex: 10,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
    plusFab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
  });

  const ContainerComponent = isDark ? View : FluidGlass;

  // Non‑AI users: simple 4-tab bar (no floating center button)
  if (!aiOn) {
    return (
      <ContainerComponent
        {...(!isDark && {
          transmission: 0.92,
          roughness: 0.1,
          tint: NAV_TINT,
        })}
        style={styles.container}
      >
        <TouchableOpacity style={[styles.navItem, { maxWidth: '25%' }]} onPress={onHomePress || (() => {})}>
          <View style={styles.navIcon}>
            <BrandGradientIcon name="home" size={36} />
          </View>
          <Text style={styles.navLabel} selectable={true}>Home</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, { maxWidth: '25%' }]} onPress={onWorkoutPress || (() => {})}>
          <View style={styles.navIcon}>
            <BrandGradientIcon name="barbell" size={36} />
          </View>
          <Text style={styles.navLabel} selectable={true}>Workout</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, { maxWidth: '25%' }]} onPress={onPlusPress || (() => {})}>
          <View style={styles.navIcon}>
            <BrandGradientIcon name="document-text" size={36} />
          </View>
          <Text style={styles.navLabel} selectable={true}>Files</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.navItem, { maxWidth: '25%' }]} onPress={onNutritionPress || (() => {})}>
          <View style={styles.navIcon}>
            <BrandGradientIcon name="restaurant" size={36} />
          </View>
          <Text style={styles.navLabel} selectable={true}>Nutrition</Text>
        </TouchableOpacity>
      </ContainerComponent>
    );
  }

  return (
    <ContainerComponent
      {...(!isDark && {
        transmission: 0.92,
        roughness: 0.1,
        tint: NAV_TINT,
      })}
      style={styles.container}
    >
      {/* Left Side - 3 items */}
      {/* Home */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={onHomePress || (() => {})}
      >
        <View style={styles.navIcon}>
          <BrandGradientIcon name="home" size={36} />
        </View>
        <Text style={styles.navLabel} selectable={true}>Home</Text>
      </TouchableOpacity>

      {/* Workout */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={onWorkoutPress || (() => {})}
      >
        <View style={styles.navIcon}>
          <BrandGradientIcon name="barbell" size={36} />
        </View>
        <Text style={styles.navLabel} selectable={true}>Workout</Text>
      </TouchableOpacity>

      {/* Spacer — keep at 64 so gap next to plus matches other icons */}
      <View style={{ width: 64, flexShrink: 0 }} />

      {/* Right Side - 3 items */}
      {/* AI Coach */}
      <TouchableOpacity style={styles.navItem} onPress={onVoicePress || (() => {})}>
        <View style={styles.navIcon}>
          <GradientChatBubblesIcon size={36} />
        </View>
        <Text style={styles.navLabel} selectable={true}>AI Coach</Text>
      </TouchableOpacity>

      {/* Nutrition */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={onNutritionPress || (() => {})}
      >
        <View style={styles.navIcon}>
          <BrandGradientIcon name="restaurant" size={36} />
        </View>
        <Text style={styles.navLabel} selectable={true}>Nutrition</Text>
      </TouchableOpacity>

      {/* Center primary action — plus (no logo image in tab bar) */}
      <TouchableOpacity
        style={styles.plusButton}
        onPress={onPlusPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['#E94EAD', '#A348D0', '#6B3AD9']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.plusFab}
        >
          <Ionicons name="add" size={38} color="#FFFFFF" />
        </LinearGradient>
      </TouchableOpacity>
    </ContainerComponent>
  );
}
