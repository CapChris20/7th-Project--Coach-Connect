import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function FoodItem({ food, onAdd, onDelete, showDelete = false }) {
  const { colors, spacing, isDark } = useTheme();
  const styles = createStyles(spacing, colors, isDark);

  const servingSize = food.servingSize || 1;
  // Calories from FatSecret are base calories per serving
  // For display, show total calories (base * servingSize)
  const baseCalories = Number(food.calories) || 0;
  const totalCalories = baseCalories * servingSize;
  
  const servingText = food.serving_description || 
    (servingSize > 1 
      ? `${servingSize.toFixed(2)} ${food.serving_unit || 'serving'}`
      : food.serving_unit || '1 serving');

  // Show brand name for FatSecret foods
  const brandText = food.brand_name || food.brand;

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {food.image ? (
          <Image source={{ uri: food.image }} style={styles.thumbnail} />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Image 
              source={require('../../assets/icons/burger.png')} 
              style={{ width: 24, height: 24 }}
              resizeMode="contain"
            />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1} selectable={true}>
            {food.name || food.food_name || 'Food Item'}
          </Text>
          <Text style={styles.serving} selectable={true}>
            {servingText} | {totalCalories.toFixed(1)} kcal
          </Text>
          {brandText && (
            <Text style={styles.brand} selectable={true}>{brandText}</Text>
          )}
          {food.food_type && food.food_type !== 'Generic' && (
            <Text style={styles.foodType} selectable={true}>{food.food_type}</Text>
          )}
        </View>
      </View>
      <View style={styles.rightSection}>
        {showDelete ? (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete && onDelete()}
          >
            <Text style={styles.deleteIcon} selectable={true}>×</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => onAdd && onAdd()}
          >
            <Text style={styles.addIcon} selectable={true}>+</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const createStyles = (spacing, colors, isDark) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: isDark ? 'rgba(17,17,17,0.55)' : 'rgba(255,255,255,0.62)',
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    leftSection: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    thumbnail: {
      width: 48,
      height: 48,
      borderRadius: 8,
      marginRight: 12,
    },
    thumbnailPlaceholder: {
      width: 48,
      height: 48,
      borderRadius: 8,
      backgroundColor: isDark ? '#1F2937' : 'rgba(15,23,42,0.06)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    thumbnailIcon: {
      fontSize: 24,
    },
    info: {
      flex: 1,
    },
    name: {
      fontSize: 16,
      fontWeight: '600',
      color: isDark ? '#FFFFFF' : (colors?.text ?? '#111827'),
      marginBottom: 4,
    },
    serving: {
      fontSize: 12,
      color: isDark ? '#9CA3AF' : (colors?.textSecondary ?? '#3C3C43'),
      marginBottom: 2,
    },
    brand: {
      fontSize: 11,
      color: isDark ? '#6B7280' : (colors?.textSecondary ?? '#3C3C43'),
    },
    foodType: {
      fontSize: 10,
      color: isDark ? '#9CA3AF' : (colors?.textSecondary ?? '#3C3C43'),
      fontStyle: 'italic',
    },
    rightSection: {
      marginLeft: 12,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#10B981',
      justifyContent: 'center',
      alignItems: 'center',
    },
    addIcon: {
      fontSize: 20,
      color: '#FFFFFF',
      fontWeight: '300',
    },
    deleteButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteIcon: {
      fontSize: 24,
      color: '#FFFFFF',
      fontWeight: '300',
    },
  });

