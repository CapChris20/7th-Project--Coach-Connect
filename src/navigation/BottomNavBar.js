import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../shared/ui/ThemeContext';
import FluidGlass from '../shared/ui/FluidGlass';
import { useMergedNavigation } from './AppNavigationContext';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

const GradientIcon = ({ name, size = 24, colors }) => (
  <MaskedView
    maskElement={
      <Ionicons name={name} size={size} color="#000" />
    }
  >
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

const GradientImageIcon = ({ source, size = 24, colors }) => (
  <MaskedView
    maskElement={
      <Image
        source={source}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    }
  >
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ width: size, height: size }}
    />
  </MaskedView>
);

// ─── Plus icon size: change these to make the icon bigger/smaller without affecting spacing ───
const PLUS_ICON_WIDTH = 120;
const PLUS_ICON_HEIGHT = 120;

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

  const NAV_TINT = isDark ? colors.black : colors.white;
  const NAV_BORDER = isDark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.08)';
  const NAV_LABEL = isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.8)';
  const INACTIVE_ICON_COLOR = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)';
  // Match the logo: deep purple -> violet -> hot pink.
  const LOGO_GRADIENT_COLORS = ['#7C3AED', '#C084FC', '#FF4FD8'];

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
      width: 64,  // layout footprint — keep at 64 so spacing between nav items stays even
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
    plusIcon: {
      fontSize: 30,
      color: '#FFFFFF',
      fontWeight: '300',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
  });

  const ContainerComponent = isDark ? View : FluidGlass;

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
          <GradientIcon
            name="home"
            size={32}
            colors={LOGO_GRADIENT_COLORS}
          />
        </View>
        <Text style={styles.navLabel} selectable={true}>Home</Text>
      </TouchableOpacity>

      {/* Workout */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={onWorkoutPress || (() => {})}
      >
        <View style={styles.navIcon}>
          <GradientIcon
            name="barbell"
            size={32}
            colors={LOGO_GRADIENT_COLORS}
          />
        </View>
        <Text style={styles.navLabel} selectable={true}>Workout</Text>
      </TouchableOpacity>

      {/* Spacer — keep at 64 so gap next to plus matches other icons */}
      <View style={{ width: 64, flexShrink: 0 }} />

      {/* Right Side - 3 items */}
      {/* Voice AI */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={onVoicePress || (() => {})}
      >
        <View style={styles.navIcon}>
          <GradientImageIcon
            source={require('../assets/lottie/icons8-gemini-ai-16.png')}
            size={32}
            colors={LOGO_GRADIENT_COLORS}
          />
        </View>
        <Text style={styles.navLabel} selectable={true}>AI Coach</Text>
      </TouchableOpacity>

      {/* Nutrition */}
      <TouchableOpacity
        style={styles.navItem}
        onPress={onNutritionPress || (() => {})}
      >
        <View style={styles.navIcon}>
          <GradientIcon
            name="restaurant"
            size={32}
            colors={LOGO_GRADIENT_COLORS}
          />
        </View>
        <Text style={styles.navLabel} selectable={true}>Nutrition</Text>
      </TouchableOpacity>


      {/* Plus Button — small layout footprint, icon drawn larger so it overflows and looks big */}
      <TouchableOpacity
        style={styles.plusButton}
        onPress={onPlusPress}
        activeOpacity={0.8}
      >
        <Image
            source={require('../assets/icons/Gemini_Generated_Image_6lz96c6lz96c6lz9-removebg-preview.png')}
            style={{ width: PLUS_ICON_WIDTH, height: PLUS_ICON_HEIGHT }}
            resizeMode="contain"
          />
      </TouchableOpacity>
    </ContainerComponent>
  );
}

