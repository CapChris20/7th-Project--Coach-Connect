/**
 * Meal Card
 *
 * Purpose: UI screen or component: Meal Card. Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: MealCard
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';
import FoodItem from './FoodItem';
import FluidGlass from '../../shared/ui/FluidGlass';

const ACCENT = '#7C3AED';

export default function MealCard({ mealType, mealKey, items = [], onAddPress, onDeleteItem, onAddScanner }) {
  const { colors, spacing, isDark } = useTheme();
  const styles = createStyles(spacing, colors, isDark);

  const mealTotal = items.reduce((sum, item) => sum + (item.calories || 0), 0);

  return (
    <FluidGlass
      transmission={0.88}
      roughness={0.2}
      tint={isDark ? '#111111' : '#FFFFFF'}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.mealTitle} selectable={true}>{mealType}</Text>
        {items.length > 0 && (
          <Text style={styles.mealTotal} selectable={true}>{Math.round(mealTotal)} kcal</Text>
        )}
      </View>

      {items.length > 0 ? (
        <View style={styles.itemsList}>
          {items.map((item, index) => (
            <FoodItem
              key={item.id || index}
              food={{
                name: item.food_name || item.metadata?.name,
                calories: Number(item.calories) || Number(item.metadata?.calories) || 0,
                protein: Number(item.protein) || Number(item.metadata?.protein) || 0,
                carbs: Number(item.carbs) || Number(item.metadata?.carbs) || 0,
                fat: Number(item.fat) || Number(item.metadata?.fat) || 0,
                servingSize: Number(item.serving_size) || 1,
                ...item.metadata,
              }}
              onDelete={() => onDeleteItem(item)}
              showDelete
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText} selectable={true}>No items logged</Text>
        </View>
      )}

      <View style={styles.buttonRow}>
        {onAddScanner && (
          <TouchableOpacity
            style={[styles.actionButton, styles.scanButton]}
            onPress={() => onAddScanner(mealKey)}
            activeOpacity={0.7}
          >
            {/* ICON GOES HERE — scan */}
            <Text style={styles.scanButtonText} selectable={true}>Scan</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => onAddPress(mealKey)}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={[ACCENT, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logButtonGradient}
          >
            {/* ICON GOES HERE — log */}
            <Text style={styles.logButtonText} selectable={true}>Log</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </FluidGlass>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    card: {
      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.6)',
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.8)',
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    mealTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: isDark ? '#FFFFFF' : (colors?.text ?? '#111827'),
    },
    mealTotal: {
      fontSize: 14,
      fontWeight: '600',
      color: isDark ? '#9CA3AF' : (colors?.textSecondary ?? '#3C3C43'),
    },
    itemsList: {
      marginBottom: 12,
    },
    emptyState: {
      paddingVertical: 20,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(26,26,26,0.6)',
      fontWeight: '600',
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      height: 44,
      overflow: 'hidden',
    },
    scanButton: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: ACCENT,
    },
    scanButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: ACCENT,
      letterSpacing: 0.2,
    },
    logButtonText: {
      fontSize: 13,
      fontWeight: '800',
      color: '#FFFFFF',
      letterSpacing: 0.2,
    },
    logButtonGradient: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
    },
  });

