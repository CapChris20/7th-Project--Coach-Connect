import React from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';

/**
 * Inline edit bodies for workout plan builder rows — logic copied from WorkoutPlanGeneratorScreen.
 */
export default function WorkoutPlanBuilderFieldEditBody({
  fieldKey,
  onboardingData,
  setOnboardingData,
  validationErrors,
  setValidationErrors,
  isDark,
  styles,
}) {
  // Lovable modal palette (dark). Keep logic identical; only affects UI colors.
  const BG_INPUT = '#1a1520';
  const BG_OPTION_UNSELECTED = 'rgba(255,255,255,0.05)';
  const BG_OPTION_SELECTED = '#FF4D8D'; // darker / premium pink than #FF6B9D
  const BORDER_DEFAULT = 'rgba(255,255,255,0.12)';
  const TEXT = '#FFFFFF';
  const MUTED = 'rgba(255,255,255,0.55)';

  switch (fieldKey) {
    case 'personalInfo':
      return (
        <View style={styles.editFields}>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: TEXT }]}>Weight (lbs)</Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  color: TEXT,
                  backgroundColor: BG_INPUT,
                  borderColor: validationErrors.weight ? '#EF4444' : BORDER_DEFAULT,
                },
              ]}
              value={onboardingData.weight?.toString() || ''}
              onChangeText={(text) => {
                const num = parseFloat(text);
                setOnboardingData((prev) => ({ ...prev, weight: Number.isNaN(num) ? null : num }));
                if (validationErrors.weight) {
                  setValidationErrors((prev) => ({ ...prev, weight: null }));
                }
              }}
              keyboardType="numeric"
              placeholder="180"
              placeholderTextColor={MUTED}
            />
          </View>
          <View style={styles.editFieldRow}>
            <View style={[styles.editField, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.editLabel, { color: TEXT }]}>Feet</Text>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    color: TEXT,
                    backgroundColor: BG_INPUT,
                    borderColor: validationErrors.height ? '#EF4444' : BORDER_DEFAULT,
                  },
                ]}
                value={onboardingData.height?.feet?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  setOnboardingData((prev) => ({
                    ...prev,
                    height: { ...prev.height, feet: Number.isNaN(num) ? null : num, inches: prev.height?.inches || 0 },
                  }));
                  if (validationErrors.height) {
                    setValidationErrors((prev) => ({ ...prev, height: null }));
                  }
                }}
                keyboardType="numeric"
                placeholder="6"
                placeholderTextColor={MUTED}
              />
            </View>
            <View style={[styles.editField, { flex: 1, marginLeft: 8 }]}>
              <Text style={[styles.editLabel, { color: TEXT }]}>Inches</Text>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    color: TEXT,
                    backgroundColor: BG_INPUT,
                    borderColor: validationErrors.height ? '#EF4444' : BORDER_DEFAULT,
                  },
                ]}
                value={onboardingData.height?.inches?.toString() || ''}
                onChangeText={(text) => {
                  const num = parseInt(text, 10);
                  setOnboardingData((prev) => ({
                    ...prev,
                    height: { ...prev.height, feet: prev.height?.feet || 0, inches: Number.isNaN(num) ? null : num },
                  }));
                  if (validationErrors.height) {
                    setValidationErrors((prev) => ({ ...prev, height: null }));
                  }
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={MUTED}
              />
            </View>
          </View>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: TEXT }]}>Age</Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  color: TEXT,
                  backgroundColor: BG_INPUT,
                  borderColor: validationErrors.age ? '#EF4444' : BORDER_DEFAULT,
                },
              ]}
              value={onboardingData.age?.toString() || ''}
              onChangeText={(text) => {
                const num = parseInt(text, 10);
                setOnboardingData((prev) => ({ ...prev, age: Number.isNaN(num) ? null : num }));
                if (validationErrors.age) {
                  setValidationErrors((prev) => ({ ...prev, age: null }));
                }
              }}
              keyboardType="numeric"
              placeholder="28"
              placeholderTextColor={MUTED}
            />
          </View>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: TEXT }]}>Gender</Text>
            <View style={styles.optionRow}>
              {['Male', 'Female', 'Other', 'Prefer not to say'].map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => {
                    setOnboardingData((prev) => ({ ...prev, gender: option }));
                    if (validationErrors.gender) {
                      setValidationErrors((prev) => ({ ...prev, gender: null }));
                    }
                  }}
                  style={[
                    styles.optionButton,
                    {
                      backgroundColor: onboardingData.gender === option ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                      borderColor: onboardingData.gender === option ? '#FF6B9D' : BORDER_DEFAULT,
                    },
                  ]}
                >
                  <Text style={[styles.optionButtonText, { color: TEXT }]}>
                    {option}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      );
    case 'fitnessLevel':
      return (
        <View style={styles.editFields}>
          {['beginner', 'intermediate', 'advanced'].map((level) => (
            <TouchableOpacity
              key={level}
              onPress={() => {
                setOnboardingData((prev) => ({ ...prev, fitnessLevel: level }));
                if (validationErrors.fitnessLevel) {
                  setValidationErrors((prev) => ({ ...prev, fitnessLevel: null }));
                }
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.fitnessLevel === level ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.fitnessLevel === level ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {level.charAt(0).toUpperCase() + level.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'goal':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'lose_fat', label: 'Lose Fat' },
            { value: 'build_muscle', label: 'Build Muscle' },
            { value: 'maintain_health', label: 'Maintain Health' },
            { value: 'athletic_performance', label: 'Athletic Performance' },
          ].map((goal) => (
            <TouchableOpacity
              key={goal.value}
              onPress={() => {
                setOnboardingData((prev) => ({ ...prev, primaryGoal: goal.value }));
                if (validationErrors.goal) {
                  setValidationErrors((prev) => ({ ...prev, goal: null }));
                }
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.primaryGoal === goal.value ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.primaryGoal === goal.value ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {goal.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'equipment':
      return (
        <View style={styles.editFields}>
          {['gym', 'dumbbells', 'bands', 'pullup_bar', 'bodyweight'].map((equip) => {
            const isSelected = onboardingData.equipmentAccess?.includes(equip);
            return (
              <TouchableOpacity
                key={equip}
                onPress={() => {
                  const current = onboardingData.equipmentAccess || [];
                  const updated = isSelected ? current.filter((e) => e !== equip) : [...current, equip];
                  setOnboardingData((prev) => ({ ...prev, equipmentAccess: updated }));
                  if (validationErrors.equipment) {
                    setValidationErrors((prev) => ({ ...prev, equipment: null }));
                  }
                }}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                    borderColor: isSelected ? '#FF6B9D' : BORDER_DEFAULT,
                  },
                ]}
              >
                <Text style={[styles.optionCardText, { color: TEXT }]}>
                  {equip.charAt(0).toUpperCase() + equip.slice(1).replace('_', ' ')}
                  {isSelected && ' ✓'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    case 'frequency':
      return (
        <View style={styles.editFields}>
          {[1, 2, 3, 4, 5, 6, 7].map((days) => (
            <TouchableOpacity
              key={days}
              onPress={() => {
                setOnboardingData((prev) => ({ ...prev, daysPerWeek: days }));
                if (validationErrors.frequency) {
                  setValidationErrors((prev) => ({ ...prev, frequency: null }));
                }
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.daysPerWeek === days ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.daysPerWeek === days ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {days === 1 ? '1 day/week' : `${days} days/week`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'injuries':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[styles.editTextArea, { color: TEXT, backgroundColor: BG_INPUT, borderColor: BORDER_DEFAULT }]}
            value={onboardingData.injuries || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, injuries: text }))}
            placeholder="Describe any injuries or limitations..."
            placeholderTextColor={MUTED}
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    case 'trainingEnvironment':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'home', label: 'Home' },
            { value: 'gym', label: 'Gym' },
            { value: 'both', label: 'Both' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setOnboardingData((prev) => ({ ...prev, trainingEnvironment: opt.value }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.trainingEnvironment === opt.value ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.trainingEnvironment === opt.value ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'preferredWorkoutTime':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'morning', label: 'Morning' },
            { value: 'afternoon', label: 'Afternoon' },
            { value: 'evening', label: 'Evening' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setOnboardingData((prev) => ({ ...prev, preferredWorkoutTime: opt.value }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.preferredWorkoutTime === opt.value ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.preferredWorkoutTime === opt.value ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'exercisesDislike':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[styles.editTextArea, { color: TEXT, backgroundColor: BG_INPUT, borderColor: BORDER_DEFAULT }]}
            value={onboardingData.exercisesDislike || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, exercisesDislike: text }))}
            placeholder="e.g. burpees, running..."
            placeholderTextColor={MUTED}
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    case 'supplementsCurrentlyTaking':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[styles.editTextArea, { color: TEXT, backgroundColor: BG_INPUT, borderColor: BORDER_DEFAULT }]}
            value={onboardingData.supplementsCurrentlyTaking || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, supplementsCurrentlyTaking: text }))}
            placeholder="List any supplements you take..."
            placeholderTextColor={MUTED}
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    case 'currentStressLevel':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'low', label: 'Low' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'high', label: 'High' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setOnboardingData((prev) => ({ ...prev, currentStressLevel: opt.value }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.currentStressLevel === opt.value ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.currentStressLevel === opt.value ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'sleepQuality':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'poor', label: 'Poor' },
            { value: 'fair', label: 'Fair' },
            { value: 'good', label: 'Good' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setOnboardingData((prev) => ({ ...prev, sleepQuality: opt.value }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.sleepQuality === opt.value ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.sleepQuality === opt.value ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'energyLevels':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'low', label: 'Low' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'high', label: 'High' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setOnboardingData((prev) => ({ ...prev, energyLevels: opt.value }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.energyLevels === opt.value ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.energyLevels === opt.value ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'hydrationHabits':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'less_than_4', label: 'Less than 4 cups/day' },
            { value: '4_8', label: '4–8 cups/day' },
            { value: 'more_than_8', label: 'More than 8 cups/day' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.value}
              onPress={() => setOnboardingData((prev) => ({ ...prev, hydrationHabits: opt.value }))}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.hydrationHabits === opt.value ? BG_OPTION_SELECTED : BG_OPTION_UNSELECTED,
                  borderColor: onboardingData.hydrationHabits === opt.value ? '#FF6B9D' : BORDER_DEFAULT,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: TEXT }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'situationDescription':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[
              styles.editTextArea,
              {
                color: TEXT,
                backgroundColor: BG_INPUT,
                borderColor: validationErrors.situationDescription ? '#EF4444' : BORDER_DEFAULT,
              },
            ]}
            value={onboardingData.situationDescription || ''}
            onChangeText={(text) => {
              if (text.length <= 1000) {
                setOnboardingData((prev) => ({ ...prev, situationDescription: text }));
                if (validationErrors.situationDescription) {
                  setValidationErrors((prev) => ({ ...prev, situationDescription: null }));
                }
              }
            }}
            placeholder="Tell us about your fitness journey and goals..."
            placeholderTextColor={MUTED}
            multiline
            textAlignVertical="top"
            minHeight={200}
          />
          <Text
            style={[
              styles.charCount,
              {
                color: (onboardingData.situationDescription?.length || 0) < 50 ? '#F59E0B' : 'rgba(255,255,255,0.60)',
              },
            ]}
          >
            {onboardingData.situationDescription?.length || 0}/1000 (min 50)
          </Text>
        </View>
      );
    default:
      return null;
  }
}
