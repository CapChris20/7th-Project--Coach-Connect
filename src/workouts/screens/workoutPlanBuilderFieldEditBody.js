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
  const ui = isDark
    ? {
        inputBg: '#1a1520',
        optionBg: 'rgba(255,255,255,0.05)',
        optionSelectedBg: '#FF4D8D',
        border: 'rgba(255,255,255,0.12)',
        text: '#FFFFFF',
        muted: 'rgba(255,255,255,0.55)',
      }
    : {
        inputBg: '#F1F5F9',
        optionBg: '#FFFFFF',
        optionSelectedBg: '#DB2777',
        border: 'rgba(15,23,42,0.14)',
        text: '#0F172A',
        muted: 'rgba(15,23,42,0.45)',
      };
  const txtOnSelected = '#FFFFFF';
  const onSel = (selected) => (selected ? txtOnSelected : ui.text);

  switch (fieldKey) {
    case 'personalInfo':
      return (
        <View style={styles.editFields}>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: ui.text }]}>Weight (lbs)</Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  color: ui.text,
                  backgroundColor: ui.inputBg,
                  borderColor: validationErrors.weight ? '#EF4444' : ui.border,
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
              placeholderTextColor={ui.muted}
            />
          </View>
          <View style={styles.editFieldRow}>
            <View style={[styles.editField, { flex: 1, marginRight: 8 }]}>
              <Text style={[styles.editLabel, { color: ui.text }]}>Feet</Text>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    color: ui.text,
                    backgroundColor: ui.inputBg,
                    borderColor: validationErrors.height ? '#EF4444' : ui.border,
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
                placeholder="5"
                placeholderTextColor={ui.muted}
              />
            </View>
            <View style={[styles.editField, { flex: 1, marginLeft: 8 }]}>
              <Text style={[styles.editLabel, { color: ui.text }]}>Inches</Text>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    color: ui.text,
                    backgroundColor: ui.inputBg,
                    borderColor: validationErrors.height ? '#EF4444' : ui.border,
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
                placeholder="8"
                placeholderTextColor={ui.muted}
              />
            </View>
          </View>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: ui.text }]}>Age</Text>
            <TextInput
              style={[
                styles.editInput,
                {
                  color: ui.text,
                  backgroundColor: ui.inputBg,
                  borderColor: validationErrors.age ? '#EF4444' : ui.border,
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
              placeholderTextColor={ui.muted}
            />
          </View>
          <View style={styles.editField}>
            <Text style={[styles.editLabel, { color: ui.text }]}>Gender</Text>
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
                      backgroundColor: onboardingData.gender === option ? ui.optionSelectedBg : ui.optionBg,
                      borderColor: onboardingData.gender === option ? '#FF6B9D' : ui.border,
                    },
                  ]}
                >
                  <Text style={[styles.optionButtonText, { color: onSel(onboardingData.gender === option) }]}>
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
          {[
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
          ].map((level) => (
            <TouchableOpacity
              key={level.value}
              onPress={() => {
                setOnboardingData((prev) => ({ ...prev, fitnessLevel: level.value }));
                if (validationErrors.fitnessLevel) {
                  setValidationErrors((prev) => ({ ...prev, fitnessLevel: null }));
                }
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor: onboardingData.fitnessLevel === level.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.fitnessLevel === level.value ? '#BE185D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.fitnessLevel === level.value) }]}>
                {level.label}
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
                  backgroundColor: onboardingData.primaryGoal === goal.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.primaryGoal === goal.value ? '#BE185D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.primaryGoal === goal.value) }]}>
                {goal.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'equipment':
      return (
        <View style={styles.editFields}>
          {[
            { value: 'gym', label: 'Full gym' },
            { value: 'dumbbells', label: 'Dumbbells' },
            { value: 'bands', label: 'Resistance bands' },
            { value: 'pullup_bar', label: 'Pull-up bar' },
            { value: 'bodyweight', label: 'Bodyweight only' },
          ].map((equip) => {
            const isSelected = onboardingData.equipmentAccess?.includes(equip.value);
            return (
              <TouchableOpacity
                key={equip.value}
                onPress={() => {
                  const current = onboardingData.equipmentAccess || [];
                  const updated = isSelected
                    ? current.filter((e) => e !== equip.value)
                    : [...current, equip.value];
                  setOnboardingData((prev) => ({ ...prev, equipmentAccess: updated }));
                  if (validationErrors.equipment) {
                    setValidationErrors((prev) => ({ ...prev, equipment: null }));
                  }
                }}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: isSelected ? ui.optionSelectedBg : ui.optionBg,
                    borderColor: isSelected ? '#BE185D' : ui.border,
                  },
                ]}
              >
                <Text style={[styles.optionCardText, { color: onSel(isSelected) }]}>
                  {isSelected ? `✓ ${equip.label}` : equip.label}
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
                  backgroundColor: onboardingData.daysPerWeek === days ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.daysPerWeek === days ? '#BE185D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.daysPerWeek === days) }]}>
                {days} {days === 1 ? 'day' : 'days'} per week
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    case 'injuries':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[styles.editTextArea, { color: ui.text, backgroundColor: ui.inputBg, borderColor: ui.border }]}
            value={onboardingData.injuries || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, injuries: text }))}
            placeholder="Describe any injuries or limitations..."
            placeholderTextColor={ui.muted}
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
                  backgroundColor: onboardingData.trainingEnvironment === opt.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.trainingEnvironment === opt.value ? '#FF6B9D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.trainingEnvironment === opt.value) }]}>
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
                  backgroundColor: onboardingData.preferredWorkoutTime === opt.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.preferredWorkoutTime === opt.value ? '#FF6B9D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.preferredWorkoutTime === opt.value) }]}>
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
            style={[styles.editTextArea, { color: ui.text, backgroundColor: ui.inputBg, borderColor: ui.border }]}
            value={onboardingData.exercisesDislike || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, exercisesDislike: text }))}
            placeholder="e.g. burpees, running..."
            placeholderTextColor={ui.muted}
            multiline
            textAlignVertical="top"
          />
        </View>
      );
    case 'supplementsCurrentlyTaking':
      return (
        <View style={styles.editFields}>
          <TextInput
            style={[styles.editTextArea, { color: ui.text, backgroundColor: ui.inputBg, borderColor: ui.border }]}
            value={onboardingData.supplementsCurrentlyTaking || ''}
            onChangeText={(text) => setOnboardingData((prev) => ({ ...prev, supplementsCurrentlyTaking: text }))}
            placeholder="List any supplements you take..."
            placeholderTextColor={ui.muted}
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
                  backgroundColor: onboardingData.currentStressLevel === opt.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.currentStressLevel === opt.value ? '#FF6B9D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.currentStressLevel === opt.value) }]}>
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
                  backgroundColor: onboardingData.sleepQuality === opt.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.sleepQuality === opt.value ? '#FF6B9D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.sleepQuality === opt.value) }]}>
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
                  backgroundColor: onboardingData.energyLevels === opt.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.energyLevels === opt.value ? '#FF6B9D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.energyLevels === opt.value) }]}>
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
                  backgroundColor: onboardingData.hydrationHabits === opt.value ? ui.optionSelectedBg : ui.optionBg,
                  borderColor: onboardingData.hydrationHabits === opt.value ? '#FF6B9D' : ui.border,
                },
              ]}
            >
              <Text style={[styles.optionCardText, { color: onSel(onboardingData.hydrationHabits === opt.value) }]}>
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
                color: ui.text,
                backgroundColor: ui.inputBg,
                borderColor: validationErrors.situationDescription ? '#EF4444' : ui.border,
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
            placeholderTextColor={ui.muted}
            multiline
            textAlignVertical="top"
            minHeight={200}
          />
          <Text
            style={[
              styles.charCount,
              {
                color: (onboardingData.situationDescription?.length || 0) < 50 ? '#F59E0B' : (isDark ? 'rgba(255,255,255,0.60)' : 'rgba(15,23,42,0.50)'),
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
