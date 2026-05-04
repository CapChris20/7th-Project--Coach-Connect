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
  switch (fieldKey) {
    case 'personalInfo':
      return (
        <View style={styles.editFields}>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Weight (lbs)</Text>
            <TextInput
              style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.weight ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
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
            />
          </View>
          <View style={styles.editFieldRow}>
            <View style={[styles.editField, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Feet</Text>
              <TextInput
                style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.height ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
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
              />
            </View>
            <View style={[styles.editField, { flex: 1, marginLeft: 8 }]}>
              <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Inches</Text>
              <TextInput
                style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.height ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
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
              />
            </View>
          </View>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Age</Text>
            <TextInput
              style={[styles.editInput, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.age ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
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
            />
          </View>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>Gender</Text>
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
                      backgroundColor: onboardingData.gender === option ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                    },
                  ]}
                >
                  <Text style={[styles.optionButtonText, { color: onboardingData.gender === option ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
                  backgroundColor: onboardingData.fitnessLevel === level ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.fitnessLevel === level ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
                  backgroundColor: onboardingData.primaryGoal === goal.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.primaryGoal === goal.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
                    backgroundColor: isSelected ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                  },
                ]}
              >
                <Text style={[styles.optionCardText, { color: isSelected ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
          <Text style={[styles.editLabel, { color: isDark ? '#FFFFFF' : '#1F2937' }]}>
            Days per week: {onboardingData.daysPerWeek || 0}
          </Text>
          <View style={styles.frequencySelector}>
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
                  styles.frequencyButton,
                  {
                    backgroundColor: onboardingData.daysPerWeek === days ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
                  },
                ]}
              >
                <Text style={[styles.frequencyButtonText, { color: onboardingData.daysPerWeek === days ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
                  {days}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    case 'injuries':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }]}
            value={onboardingData.injuries || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, injuries: text }))}
            placeholder="Describe any injuries or limitations..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
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
              style={[styles.optionCard, { backgroundColor: onboardingData.trainingEnvironment === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.trainingEnvironment === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
              style={[styles.optionCard, { backgroundColor: onboardingData.preferredWorkoutTime === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.preferredWorkoutTime === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
            style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }]}
            value={onboardingData.exercisesDislike || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, exercisesDislike: text }))}
            placeholder="e.g. burpees, running..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    case 'supplementsCurrentlyTaking':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }]}
            value={onboardingData.supplementsCurrentlyTaking || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, supplementsCurrentlyTaking: text }))}
            placeholder="List any supplements you take..."
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
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
              style={[styles.optionCard, { backgroundColor: onboardingData.currentStressLevel === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.currentStressLevel === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
              style={[styles.optionCard, { backgroundColor: onboardingData.sleepQuality === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.sleepQuality === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
              style={[styles.optionCard, { backgroundColor: onboardingData.energyLevels === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.energyLevels === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
              style={[styles.optionCard, { backgroundColor: onboardingData.hydrationHabits === opt.value ? '#6C5CE7' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)') }]}
            >
              <Text style={[styles.optionCardText, { color: onboardingData.hydrationHabits === opt.value ? '#FFFFFF' : (isDark ? '#FFFFFF' : '#1F2937') }]}>
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
            style={[styles.editTextArea, { color: isDark ? '#FFFFFF' : '#1F2937', borderColor: validationErrors.situationDescription ? '#EF4444' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') }]}
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
            placeholderTextColor={isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'}
            multiline
            textAlignVertical="top"
            minHeight={200}
          />
          <Text style={[styles.charCount, { color: (onboardingData.situationDescription?.length || 0) < 50 ? '#F59E0B' : (isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)') }]}>
            {onboardingData.situationDescription?.length || 0}/1000 (min 50)
          </Text>
        </View>
      );
    default:
      return null;
  }
}
