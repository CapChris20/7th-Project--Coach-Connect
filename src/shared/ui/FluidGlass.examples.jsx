/**
 * FluidGlass Usage Examples
 * 
 * This file shows how to convert existing UI components to use FluidGlass
 */

import React from 'react';
import {
  Image,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import FluidGlass from './FluidGlass';

// ====================================================
// EXAMPLE 1: Workout Card Conversion
// ====================================================

/**
 * BEFORE (Original):
 * 
 * <View style={styles.actionCard}>
 *   <Image source={require('./src/assets/icons/dumbbell.png')} style={styles.actionIconImage} />
 *   <View style={{ flex: 1 }}>
 *     <Text style={styles.actionTitle}>Today's Workout</Text>
 *     <Text style={styles.actionSubtitle}>Start training</Text>
 *   </View>
 * </View>
 */

/**
 * AFTER (With FluidGlass):
 */
export function WorkoutCardExample() {
  return (
    <TouchableOpacity onPress={() => {/* handle press */}}>
      <FluidGlass
        width="100%"
        transmission={0.85}
        roughness={0.15}
        tint="#5856D6"
        style={{ marginBottom: 12 }}
      >
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          padding: 16 
        }}>
          <Image 
            source={require('../../assets/icons/dumbbell.png')} 
            style={{ width: 28, height: 28, marginRight: 12 }} 
          />
          <View style={{ flex: 1 }}>
            <Text style={{ 
              fontSize: 16, 
              fontWeight: '700', 
              color: '#FFFFFF',
              marginBottom: 4 
            }}>
              Today's Workout
            </Text>
            <Text style={{ 
              fontSize: 12, 
              color: '#9CA3AF' 
            }}>
              Start training
            </Text>
          </View>
        </View>
      </FluidGlass>
    </TouchableOpacity>
  );
}

// ====================================================
// EXAMPLE 2: Modal Conversion
// ====================================================

 /**
 * AFTER (With FluidGlass):
 */export function ModalExample({ visible, onClose, workoutInput, setWorkoutInput, handleAddWorkout }) {
  if (!visible) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide">
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          justifyContent: 'flex-end',
        }}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          <FluidGlass
            width="100%"
            transmission={0.9}
            roughness={0.1}
            tint="#FFFFFF"
            style={{
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
            }}
          >
            <View style={{ padding: 24 }}>
              <View style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}>
                <Text style={{
                  fontSize: 20,
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}>
                  Add Today's Workout
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ fontSize: 24, color: '#FFFFFF' }}>×</Text>
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  padding: 16,
                  fontSize: 16,
                  color: '#FFFFFF',
                  borderWidth: 2,
                  borderColor: '#5856D6',
                  marginBottom: 16,
                }}
                placeholder="e.g., Push Day, Leg Day, Cardio..."
                placeholderTextColor="#9CA3AF"
                value={workoutInput}
                onChangeText={setWorkoutInput}
                autoFocus
                onSubmitEditing={handleAddWorkout}
              />
              
              <TouchableOpacity
                style={{
                  backgroundColor: '#5856D6',
                  padding: 16,
                  borderRadius: 12,
                  alignItems: 'center',
                  opacity: workoutInput.trim() ? 1 : 0.5,
                }}
                onPress={handleAddWorkout}
                disabled={!workoutInput.trim()}
              >
                <Text style={{
                  color: '#FFFFFF',
                  fontSize: 16,
                  fontWeight: '700',
                }}>
                  Add Workout
                </Text>
              </TouchableOpacity>
            </View>
          </FluidGlass>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ====================================================
// EXAMPLE 3: Nutrition Card Conversion
// ====================================================

/**
 * Usage in MealCard component:
 * 
 * Replace:
 * <View style={styles.card}>
 * 
 * With:
 * <FluidGlass transmission={0.88} roughness={0.2} tint="#111111">
 */
export function NutritionCardExample() {
  return (
    <FluidGlass
      transmission={0.88}
      roughness={0.2}
      tint="#111111"
      style={{ marginBottom: 16 }}
    >
      <View style={{ padding: 20 }}>
        <View style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <Text style={{
            fontSize: 18,
            fontWeight: '700',
            color: '#FFFFFF',
          }}>
            Breakfast
          </Text>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: '#9CA3AF',
          }}>
            450 kcal
          </Text>
        </View>
        {/* Card content */}
      </View>
    </FluidGlass>
  );
}












