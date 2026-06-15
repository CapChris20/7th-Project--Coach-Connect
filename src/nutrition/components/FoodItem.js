/**
 * Food Item
 *
 * Purpose: Food Item — Feature module for Coach Connect.
 * Why it matters: Keeps feature logic out of screens so auth, nutrition, and trainer rules stay consistent.
 * Area: src/nutrition
 * Key exports: FoodItem
 *
 * @file-header
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function FoodItem({ food, onAdd, onDelete, showDelete = false }) {
  const { isDark } = useTheme();

  const servingSize = food.servingSize || 1;
  const baseCalories = Number(food.calories) || 0;
  const totalCalories = baseCalories * servingSize;

  const servingText =
    food.serving_description ||
    (servingSize > 1
      ? `${servingSize.toFixed(2)} ${food.serving_unit || 'serving'}`
      : food.serving_unit || '1 serving');

  const brandText = food.brand_name || food.brand;
  const displayName = food.name || food.food_name || 'Food Item';

  const text = isDark ? '#FFFFFF' : '#0A0A0F';
  const textMuted = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(10,10,15,0.55)';
  const cardBg = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.92)';
  const borderC = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(10,10,15,0.07)';

  return (
    <View style={[s.container, { backgroundColor: cardBg, borderColor: borderC }]}>
      <View style={s.leftSection}>
        <LinearGradient
          colors={isDark ? ['rgba(255,107,157,0.18)', 'rgba(192,132,252,0.14)'] : ['rgba(255,107,157,0.12)', 'rgba(192,132,252,0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.iconBox}
        >
          <Ionicons name="restaurant-outline" size={20} color={isDark ? '#FF6B9D' : '#BE185D'} />
        </LinearGradient>

        <View style={s.info}>
          <Text style={[s.name, { color: text }]} numberOfLines={1} selectable={true}>
            {displayName}
          </Text>
          <Text style={[s.serving, { color: textMuted }]} selectable={true}>
            {servingText}
            {brandText ? ` · ${brandText}` : ''}
          </Text>
        </View>
      </View>

      <View style={s.rightSection}>
        <View style={s.calBlock}>
          <Text style={[s.calNum, { color: text }]} selectable={true}>
            {Math.round(totalCalories)}
          </Text>
          <Text style={[s.calLabel, { color: textMuted }]}>cal</Text>
        </View>

        {showDelete ? (
          <TouchableOpacity style={s.deleteBtn} onPress={() => onDelete && onDelete()}>
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[s.addBtn, { borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(10,10,15,0.15)' }]} onPress={() => onAdd && onAdd()}>
            <Ionicons name="add" size={18} color={isDark ? '#FF6B9D' : '#BE185D'} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 3,
  },
  serving: {
    fontSize: 12,
    fontWeight: '500',
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: 8,
  },
  calBlock: {
    alignItems: 'flex-end',
  },
  calNum: {
    fontSize: 17,
    fontWeight: '800',
    lineHeight: 20,
  },
  calLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  addBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
