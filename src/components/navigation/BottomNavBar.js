import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import NavIcon from '../common/NavIcon';

export default function BottomNavBar({ onPlusPress, onMessagesPress, onVoicePress, onNutritionPress, onProfilePress, unreadMessageCount = 0 }) {
  const { colors, spacing, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = StyleSheet.create({
    container: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.15)',
      paddingBottom: insets.bottom,
      paddingTop: spacing.sm,
      minHeight: 90 + insets.bottom,
      alignItems: 'flex-start',
      justifyContent: 'space-around',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 12,
    },
    navItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'flex-start',
      paddingTop: spacing.xs,
      paddingBottom: spacing.xs,
      borderRadius: 16,
      marginHorizontal: spacing.xs,
      paddingHorizontal: spacing.xs,
    },
    navIcon: {
      marginBottom: spacing.xs / 2,
      marginTop: 0,
    },
    navLabel: {
      fontSize: 9,
      color: isDark ? colors.textSecondary : colors.primary,
      fontWeight: '600',
      letterSpacing: 0.3,
    },
    plusButton: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      borderWidth: 2,
      borderColor: isDark 
        ? 'rgba(255, 255, 255, 0.3)' 
        : 'rgba(255, 255, 255, 0.4)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
      elevation: 14,
    },
    plusIcon: {
      fontSize: 32,
      color: '#FFFFFF',
      fontWeight: '300',
      textShadowColor: 'rgba(0, 0, 0, 0.3)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
    },
    badge: {
      position: 'absolute',
      top: -4,
      right: -8,
      backgroundColor: '#F87171',
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      borderWidth: 2,
      borderColor: isDark ? 'rgba(30, 27, 46, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
    },
  });

  return (
    <View style={[styles.container, { backgroundColor: isDark ? 'rgba(30, 27, 46, 0.9)' : 'rgba(255, 255, 255, 0.9)' }]}>
      {/* Home */}
      <TouchableOpacity style={styles.navItem} onPress={() => {}}>
        <NavIcon name="home" size={28} style={styles.navIcon} />
        <Text style={styles.navLabel}>Home</Text>
      </TouchableOpacity>

      {/* Messages */}
      <TouchableOpacity style={styles.navItem} onPress={onMessagesPress}>
        <View style={{ position: 'relative' }}>
          <NavIcon name="messages" size={28} style={styles.navIcon} />
          {unreadMessageCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadMessageCount > 9 ? '9+' : unreadMessageCount}</Text>
            </View>
          )}
        </View>
        <Text style={styles.navLabel}>Messages</Text>
      </TouchableOpacity>

      {/* Plus Button (Center) */}
      <TouchableOpacity style={styles.plusButton} onPress={onPlusPress}>
        <Text style={styles.plusIcon}>+</Text>
      </TouchableOpacity>

      {/* Nutrition */}
      <TouchableOpacity style={styles.navItem} onPress={onNutritionPress}>
        <NavIcon name="nutrition" size={28} style={styles.navIcon} />
        <Text style={styles.navLabel}>Nutrition</Text>
      </TouchableOpacity>

      {/* Profile */}
      <TouchableOpacity style={styles.navItem} onPress={onProfilePress}>
        <NavIcon name="profile" size={28} style={styles.navIcon} />
        <Text style={styles.navLabel}>Profile</Text>
      </TouchableOpacity>
    </View>
  );
}

