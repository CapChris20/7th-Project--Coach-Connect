// Inline edit bodies for one workout-plan builder row (days, injuries, situation).
// Flow: look at fieldKey → show that field’s inputs → write back into onboardingData.
// Used by CreateWorkoutPlanScreen and the manual plan builder.

import React from 'react';
import { View, Text, TextInput, TouchableOpacity, useColorScheme } from 'react-native';
import DislikedExercisesPicker from '../exercise-videos/DislikedExercisesPicker';
import { lightColors, darkColors } from '../../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

// Manipulate here: max days the frequency chips offer (1…7)
const MAX_TRAINING_DAYS_PER_WEEK = 7;
const DAYS_PER_WEEK_CHOICES = [1, 2, 3, 4, 5, 6, MAX_TRAINING_DAYS_PER_WEEK];

// Manipulate here: situation textarea hard cap; UI also shows “min 50”
const SITUATION_MAX_CHARS = 1000;
const SITUATION_MIN_CHARS_FOR_NEUTRAL_COUNT = 50;

// Manipulate here: red border when a required field fails validation
const VALIDATION_ERROR_BORDER = '#EF4444';
// Manipulate here: amber count when situation is still under the soft minimum
const SITUATION_COUNT_WARNING = '#F59E0B';

const GENDER_CHOICES = ['Male', 'Female', 'Other', 'Prefer not to say'];

const FITNESS_LEVEL_CHOICES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
];

const PRIMARY_GOAL_CHOICES = [
  { value: 'lose_fat', label: 'Lose Fat' },
  { value: 'build_muscle', label: 'Build Muscle' },
  { value: 'maintain_health', label: 'Maintain Health' },
  { value: 'athletic_performance', label: 'Athletic Performance' },
];

const EQUIPMENT_CHOICES = [
  { value: 'gym', label: 'Full gym' },
  { value: 'dumbbells', label: 'Dumbbells' },
  { value: 'bands', label: 'Resistance bands' },
  { value: 'pullup_bar', label: 'Pull-up bar' },
  { value: 'bodyweight', label: 'Bodyweight only' },
];

const TRAINING_ENVIRONMENT_CHOICES = [
  { value: 'home', label: 'Home' },
  { value: 'gym', label: 'Gym' },
  { value: 'both', label: 'Both' },
];

const PREFERRED_WORKOUT_TIME_CHOICES = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
];

const STRESS_LEVEL_CHOICES = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

const SLEEP_QUALITY_CHOICES = [
  { value: 'poor', label: 'Poor' },
  { value: 'fair', label: 'Fair' },
  { value: 'good', label: 'Good' },
];

const ENERGY_LEVEL_CHOICES = [
  { value: 'low', label: 'Low' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'high', label: 'High' },
];

const HYDRATION_HABIT_CHOICES = [
  { value: 'less_than_4', label: 'Less than 4 cups/day' },
  { value: '4_8', label: '4–8 cups/day' },
  { value: 'more_than_8', label: 'More than 8 cups/day' },
];

// ===== HELPER FUNCTIONS =====

function buildPlanFieldEditTheme(colorScheme) {
  let colors = lightColors;
  if (colorScheme === 'dark') {
    colors = darkColors;
  }
  return {
    inputBg: colors.nbSurfaceChip,
    optionBg: colors.nbSurface,
    optionSelectedBg: colors.nbInk,
    border: colors.nbBorder,
    text: colors.nbInk,
    muted: colors.nbMuted,
    textOnSelectedOption(isSelected) {
      return isSelected ? colors.nbSurface : colors.nbInk;
    },
  };
}

// Clear one validation key so the red border goes away after the user edits.
function clearValidationIfPresent(validationErrors, setValidationErrors, fieldName) {
  if (!validationErrors[fieldName]) {
    return;
  }
  // vocab/symbol: ...spread = copy previous error map, then overwrite this field
  setValidationErrors((previousErrors) => ({ ...previousErrors, [fieldName]: null }));
}

function borderColorForField(hasError, theme) {
  if (hasError) {
    return VALIDATION_ERROR_BORDER;
  }
  return theme.border;
}

function optionCardColors(isSelected, theme) {
  let backgroundColor = theme.optionBg;
  let borderColor = theme.border;
  if (isSelected) {
    backgroundColor = theme.optionSelectedBg;
    borderColor = lightColors.nbInk;
  }
  return { backgroundColor, borderColor };
}

function daysPerWeekLabel(dayCount) {
  if (dayCount === 1) {
    return '1 day per week';
  }
  return `${dayCount} days per week`;
}

function situationCharCountColor(characterCount, isDarkScheme) {
  if (characterCount < SITUATION_MIN_CHARS_FOR_NEUTRAL_COUNT) {
    return SITUATION_COUNT_WARNING;
  }
  if (isDarkScheme) {
    return 'rgba(255,255,255,0.60)';
  }
  return 'rgba(15,23,42,0.50)';
}

// One selectable card in a single-pick list (fitness level, goal, stress, …).
function SinglePickOptionCard({
  label,
  isSelected,
  onPress,
  styles,
  theme,
}) {
  const cardColors = optionCardColors(isSelected, theme);
  const labelColor = theme.textOnSelectedOption(isSelected);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.optionCard,
        {
          backgroundColor: cardColors.backgroundColor,
          borderColor: cardColors.borderColor,
        },
      ]}
    >
      <Text style={[styles.optionCardText, { color: labelColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// Compact chip used for gender (horizontal optionRow).
function GenderOptionChip({
  optionLabel,
  isSelected,
  onPress,
  styles,
  theme,
}) {
  const chipColors = optionCardColors(isSelected, theme);
  const labelColor = theme.textOnSelectedOption(isSelected);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.optionButton,
        {
          backgroundColor: chipColors.backgroundColor,
          borderColor: chipColors.borderColor,
        },
      ]}
    >
      <Text style={[styles.optionButtonText, { color: labelColor }]}>{optionLabel}</Text>
    </TouchableOpacity>
  );
}

// Shared single-select list: write one onboardingData key and clear its validation error.
function SingleSelectChoiceList({
  choices,
  selectedValue,
  onboardingKey,
  validationKey,
  setOnboardingData,
  validationErrors,
  setValidationErrors,
  styles,
  theme,
}) {
  return (
    <View style={styles.editFields}>
      {choices.map((choice) => {
        const isSelected = selectedValue === choice.value;

        const pickThisChoice = () => {
          setOnboardingData((previousData) => ({
            ...previousData,
            [onboardingKey]: choice.value,
          }));
          if (validationKey) {
            clearValidationIfPresent(validationErrors, setValidationErrors, validationKey);
          }
        };

        return (
          <SinglePickOptionCard
            key={choice.value}
            label={choice.label}
            isSelected={isSelected}
            onPress={pickThisChoice}
            styles={styles}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

// Multi-select equipment cards (toggle id in / out of equipmentAccess array).
function EquipmentMultiSelectList({
  onboardingData,
  setOnboardingData,
  validationErrors,
  setValidationErrors,
  styles,
  theme,
}) {
  const selectedEquipmentIds = onboardingData.equipmentAccess || [];

  return (
    <View style={styles.editFields}>
      {EQUIPMENT_CHOICES.map((equipmentChoice) => {
        const isSelected = selectedEquipmentIds.includes(equipmentChoice.value);

        let cardLabel = equipmentChoice.label;
        if (isSelected) {
          cardLabel = `✓ ${equipmentChoice.label}`;
        }

        const toggleEquipment = () => {
          const currentIds = onboardingData.equipmentAccess || [];
          let updatedIds;
          if (isSelected) {
            updatedIds = currentIds.filter((equipmentId) => equipmentId !== equipmentChoice.value);
          } else {
            updatedIds = [...currentIds, equipmentChoice.value];
          }
          setOnboardingData((previousData) => ({
            ...previousData,
            equipmentAccess: updatedIds,
          }));
          clearValidationIfPresent(validationErrors, setValidationErrors, 'equipment');
        };

        const cardColors = optionCardColors(isSelected, theme);
        const labelColor = theme.textOnSelectedOption(isSelected);

        return (
          <TouchableOpacity
            key={equipmentChoice.value}
            onPress={toggleEquipment}
            style={[
              styles.optionCard,
              {
                backgroundColor: cardColors.backgroundColor,
                borderColor: cardColors.borderColor,
              },
            ]}
          >
            <Text style={[styles.optionCardText, { color: labelColor }]}>{cardLabel}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Days-per-week chips (value is a number, not a {value,label} pair).
function FrequencyChoiceList({
  onboardingData,
  setOnboardingData,
  validationErrors,
  setValidationErrors,
  styles,
  theme,
}) {
  return (
    <View style={styles.editFields}>
      {DAYS_PER_WEEK_CHOICES.map((dayCount) => {
        const isSelected = onboardingData.daysPerWeek === dayCount;

        const pickDayCount = () => {
          setOnboardingData((previousData) => ({ ...previousData, daysPerWeek: dayCount }));
          clearValidationIfPresent(validationErrors, setValidationErrors, 'frequency');
        };

        return (
          <SinglePickOptionCard
            key={dayCount}
            label={daysPerWeekLabel(dayCount)}
            isSelected={isSelected}
            onPress={pickDayCount}
            styles={styles}
            theme={theme}
          />
        );
      })}
    </View>
  );
}

// Weight / height / age / gender block for fieldKey === 'personalInfo'.
function PersonalInfoEditFields({
  onboardingData,
  setOnboardingData,
  validationErrors,
  setValidationErrors,
  styles,
  theme,
}) {
  let weightText = '';
  if (onboardingData.weight != null) {
    weightText = onboardingData.weight.toString();
  }

  const heightObject = onboardingData.height || {};
  let feetText = '';
  if (heightObject.feet != null) {
    feetText = heightObject.feet.toString();
  }
  let inchesText = '';
  if (heightObject.inches != null) {
    inchesText = heightObject.inches.toString();
  }

  let ageText = '';
  if (onboardingData.age != null) {
    ageText = onboardingData.age.toString();
  }

  const weightBorderColor = borderColorForField(Boolean(validationErrors.weight), theme);
  const heightBorderColor = borderColorForField(Boolean(validationErrors.height), theme);
  const ageBorderColor = borderColorForField(Boolean(validationErrors.age), theme);

  const updateWeightFromText = (typedText) => {
    const parsedWeight = parseFloat(typedText);
    const nextWeight = Number.isNaN(parsedWeight) ? null : parsedWeight;
    setOnboardingData((previousData) => ({ ...previousData, weight: nextWeight }));
    clearValidationIfPresent(validationErrors, setValidationErrors, 'weight');
  };

  const updateFeetFromText = (typedText) => {
    const parsedFeet = parseInt(typedText, 10);
    let nextFeet = null;
    if (!Number.isNaN(parsedFeet)) {
      nextFeet = parsedFeet;
    }
    setOnboardingData((previousData) => {
      const previousHeight = previousData.height || {};
      let inchesValue = 0;
      if (previousHeight.inches) {
        inchesValue = previousHeight.inches;
      }
      return {
        ...previousData,
        height: {
          ...previousHeight,
          feet: nextFeet,
          inches: inchesValue,
        },
      };
    });
    clearValidationIfPresent(validationErrors, setValidationErrors, 'height');
  };

  const updateInchesFromText = (typedText) => {
    const parsedInches = parseInt(typedText, 10);
    let nextInches = null;
    if (!Number.isNaN(parsedInches)) {
      nextInches = parsedInches;
    }
    setOnboardingData((previousData) => {
      const previousHeight = previousData.height || {};
      let feetValue = 0;
      if (previousHeight.feet) {
        feetValue = previousHeight.feet;
      }
      return {
        ...previousData,
        height: {
          ...previousHeight,
          feet: feetValue,
          inches: nextInches,
        },
      };
    });
    clearValidationIfPresent(validationErrors, setValidationErrors, 'height');
  };

  const updateAgeFromText = (typedText) => {
    const parsedAge = parseInt(typedText, 10);
    const nextAge = Number.isNaN(parsedAge) ? null : parsedAge;
    setOnboardingData((previousData) => ({ ...previousData, age: nextAge }));
    clearValidationIfPresent(validationErrors, setValidationErrors, 'age');
  };

  return (
    <View style={styles.editFields}>
      <View style={styles.editField}>
        <Text style={[styles.editLabel, { color: theme.text }]}>Weight (lbs)</Text>
        <TextInput
          style={[
            styles.editInput,
            {
              color: theme.text,
              backgroundColor: theme.inputBg,
              borderColor: weightBorderColor,
            },
          ]}
          value={weightText}
          onChangeText={updateWeightFromText}
          keyboardType="numeric"
          placeholder="180"
          placeholderTextColor={theme.muted}
        />
      </View>

      <View style={styles.editFieldRow}>
        <View style={[styles.editField, { flex: 1, marginRight: 8 }]}>
          <Text style={[styles.editLabel, { color: theme.text }]}>Feet</Text>
          <TextInput
            style={[
              styles.editInput,
              {
                color: theme.text,
                backgroundColor: theme.inputBg,
                borderColor: heightBorderColor,
              },
            ]}
            value={feetText}
            onChangeText={updateFeetFromText}
            keyboardType="numeric"
            placeholder="5"
            placeholderTextColor={theme.muted}
          />
        </View>
        <View style={[styles.editField, { flex: 1, marginLeft: 8 }]}>
          <Text style={[styles.editLabel, { color: theme.text }]}>Inches</Text>
          <TextInput
            style={[
              styles.editInput,
              {
                color: theme.text,
                backgroundColor: theme.inputBg,
                borderColor: heightBorderColor,
              },
            ]}
            value={inchesText}
            onChangeText={updateInchesFromText}
            keyboardType="numeric"
            placeholder="8"
            placeholderTextColor={theme.muted}
          />
        </View>
      </View>

      <View style={styles.editField}>
        <Text style={[styles.editLabel, { color: theme.text }]}>Age</Text>
        <TextInput
          style={[
            styles.editInput,
            {
              color: theme.text,
              backgroundColor: theme.inputBg,
              borderColor: ageBorderColor,
            },
          ]}
          value={ageText}
          onChangeText={updateAgeFromText}
          keyboardType="numeric"
          placeholder="28"
          placeholderTextColor={theme.muted}
        />
      </View>

      <View style={styles.editField}>
        <Text style={[styles.editLabel, { color: theme.text }]}>Gender</Text>
        <View style={styles.optionRow}>
          {GENDER_CHOICES.map((genderLabel) => {
            const isSelected = onboardingData.gender === genderLabel;
            const pickGender = () => {
              setOnboardingData((previousData) => ({ ...previousData, gender: genderLabel }));
              clearValidationIfPresent(validationErrors, setValidationErrors, 'gender');
            };
            return (
              <GenderOptionChip
                key={genderLabel}
                optionLabel={genderLabel}
                isSelected={isSelected}
                onPress={pickGender}
                styles={styles}
                theme={theme}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}

function MultilineOnboardingTextArea({
  value,
  onChangeText,
  placeholder,
  styles,
  theme,
  borderColor,
  minHeight,
}) {
  const areaBorderColor = borderColor || theme.border;
  const areaStyle = [
    styles.editTextArea,
    {
      color: theme.text,
      backgroundColor: theme.inputBg,
      borderColor: areaBorderColor,
    },
  ];
  if (minHeight) {
    areaStyle.push({ minHeight });
  }

  return (
    <TextInput
      style={areaStyle}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={theme.muted}
      multiline
      textAlignVertical="top"
    />
  );
}

function SituationDescriptionEditor({
  onboardingData,
  setOnboardingData,
  validationErrors,
  setValidationErrors,
  styles,
  theme,
  isDarkScheme,
}) {
  const situationText = onboardingData.situationDescription || '';
  const situationCharCount = situationText.length;
  const countColor = situationCharCountColor(situationCharCount, isDarkScheme);
  const situationBorderColor = borderColorForField(
    Boolean(validationErrors.situationDescription),
    theme,
  );

  const updateSituationText = (typedText) => {
    if (typedText.length > SITUATION_MAX_CHARS) {
      return;
    }
    setOnboardingData((previousData) => ({
      ...previousData,
      situationDescription: typedText,
    }));
    clearValidationIfPresent(validationErrors, setValidationErrors, 'situationDescription');
  };

  return (
    <View style={styles.editFields}>
      <MultilineOnboardingTextArea
        value={situationText}
        onChangeText={updateSituationText}
        placeholder="Tell us about your fitness journey and goals..."
        styles={styles}
        theme={theme}
        borderColor={situationBorderColor}
        minHeight={200}
      />
      <Text style={[styles.charCount, { color: countColor }]}>
        {situationCharCount}/{SITUATION_MAX_CHARS} (min 50)
      </Text>
    </View>
  );
}

function ExercisesDislikeEditor({ onboardingData, setOnboardingData, styles, theme }) {
  // Legacy DislikedExercisesPicker still accepts `t` with old theme key names.
  const pickerThemeBridge = {
    cardBg: theme.inputBg,
    cardBorder: theme.border,
    cardSelectedBg: theme.optionSelectedBg,
    cardSelectedBorder: theme.optionSelectedBg,
    textPrimary: theme.text,
    textSecondary: theme.muted,
  };

  const updateExercisesDislike = (nextSerializedValue) => {
    setOnboardingData((previousData) => ({
      ...previousData,
      exercisesDislike: nextSerializedValue,
    }));
  };

  return (
    <View style={styles.editFields}>
      <DislikedExercisesPicker
        t={pickerThemeBridge}
        intent="prefer"
        value={onboardingData.exercisesDislike || ''}
        onChange={updateExercisesDislike}
        animatePills
      />
    </View>
  );
}

/**
 * One fieldKey → one inline editor body.
 * Pulled out of CreateWorkoutPlanScreen so the screen stays thin.
 * @param {string} fieldKey
 * @param {object} shared
 * @returns {React.ReactNode}
 */
function renderPlanFieldEditBody(fieldKey, shared) {
  const {
    onboardingData,
    setOnboardingData,
    validationErrors,
    setValidationErrors,
    styles,
    theme,
    isDarkScheme,
  } = shared;

  const singleSelectProps = {
    setOnboardingData,
    validationErrors,
    setValidationErrors,
    styles,
    theme,
  };

  // Route by frozen fieldKey strings — callers pass these exact letters.
  if (fieldKey === 'personalInfo') {
    return (
      <PersonalInfoEditFields
        onboardingData={onboardingData}
        setOnboardingData={setOnboardingData}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        styles={styles}
        theme={theme}
      />
    );
  }

  if (fieldKey === 'fitnessLevel') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={FITNESS_LEVEL_CHOICES}
        selectedValue={onboardingData.fitnessLevel}
        onboardingKey="fitnessLevel"
        validationKey="fitnessLevel"
      />
    );
  }

  if (fieldKey === 'goal') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={PRIMARY_GOAL_CHOICES}
        selectedValue={onboardingData.primaryGoal}
        onboardingKey="primaryGoal"
        validationKey="goal"
      />
    );
  }

  if (fieldKey === 'equipment') {
    return (
      <EquipmentMultiSelectList
        onboardingData={onboardingData}
        setOnboardingData={setOnboardingData}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        styles={styles}
        theme={theme}
      />
    );
  }

  if (fieldKey === 'frequency') {
    return (
      <FrequencyChoiceList
        onboardingData={onboardingData}
        setOnboardingData={setOnboardingData}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        styles={styles}
        theme={theme}
      />
    );
  }

  if (fieldKey === 'injuries') {
    return (
      <View style={styles.editFields}>
        <MultilineOnboardingTextArea
          value={onboardingData.injuries || ''}
          onChangeText={(typedText) =>
            setOnboardingData((previousData) => ({ ...previousData, injuries: typedText }))
          }
          placeholder="Describe any injuries or limitations..."
          styles={styles}
          theme={theme}
        />
      </View>
    );
  }

  if (fieldKey === 'trainingEnvironment') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={TRAINING_ENVIRONMENT_CHOICES}
        selectedValue={onboardingData.trainingEnvironment}
        onboardingKey="trainingEnvironment"
        validationKey={null}
      />
    );
  }

  if (fieldKey === 'preferredWorkoutTime') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={PREFERRED_WORKOUT_TIME_CHOICES}
        selectedValue={onboardingData.preferredWorkoutTime}
        onboardingKey="preferredWorkoutTime"
        validationKey={null}
      />
    );
  }

  if (fieldKey === 'exercisesDislike') {
    return (
      <ExercisesDislikeEditor
        onboardingData={onboardingData}
        setOnboardingData={setOnboardingData}
        styles={styles}
        theme={theme}
      />
    );
  }

  if (fieldKey === 'supplementsCurrentlyTaking') {
    return (
      <View style={styles.editFields}>
        <MultilineOnboardingTextArea
          value={onboardingData.supplementsCurrentlyTaking || ''}
          onChangeText={(typedText) =>
            setOnboardingData((previousData) => ({
              ...previousData,
              supplementsCurrentlyTaking: typedText,
            }))
          }
          placeholder="List any supplements you take..."
          styles={styles}
          theme={theme}
        />
      </View>
    );
  }

  if (fieldKey === 'currentStressLevel') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={STRESS_LEVEL_CHOICES}
        selectedValue={onboardingData.currentStressLevel}
        onboardingKey="currentStressLevel"
        validationKey={null}
      />
    );
  }

  if (fieldKey === 'sleepQuality') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={SLEEP_QUALITY_CHOICES}
        selectedValue={onboardingData.sleepQuality}
        onboardingKey="sleepQuality"
        validationKey={null}
      />
    );
  }

  if (fieldKey === 'energyLevels') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={ENERGY_LEVEL_CHOICES}
        selectedValue={onboardingData.energyLevels}
        onboardingKey="energyLevels"
        validationKey={null}
      />
    );
  }

  if (fieldKey === 'hydrationHabits') {
    return (
      <SingleSelectChoiceList
        {...singleSelectProps}
        choices={HYDRATION_HABIT_CHOICES}
        selectedValue={onboardingData.hydrationHabits}
        onboardingKey="hydrationHabits"
        validationKey={null}
      />
    );
  }

  if (fieldKey === 'situationDescription') {
    return (
      <SituationDescriptionEditor
        onboardingData={onboardingData}
        setOnboardingData={setOnboardingData}
        validationErrors={validationErrors}
        setValidationErrors={setValidationErrors}
        styles={styles}
        theme={theme}
        isDarkScheme={isDarkScheme}
      />
    );
  }

  return null;
}

// ===== MAIN FUNCTION =====

/**
 * Theme-aware wrapper that picks the inline editor for one plan-builder field.
 * @param {object} props
 * @param {string} props.fieldKey
 * @param {object} props.onboardingData
 * @param {Function} props.setOnboardingData
 * @param {object} props.validationErrors
 * @param {Function} props.setValidationErrors
 * @param {object} props.styles
 */
export default function WorkoutPlanBuilderFieldEditBody({
  fieldKey,
  onboardingData,
  setOnboardingData,
  validationErrors,
  setValidationErrors,
  styles,
}) {
  // vocab: useColorScheme = RN hook; 'dark' | 'light' | null from the OS
  // Note: legacy `isDark` prop is ignored — theme always comes from the OS scheme.
  const colorScheme = useColorScheme();
  const theme = buildPlanFieldEditTheme(colorScheme);
  const isDarkScheme = colorScheme === 'dark';

  const sharedEditProps = {
    onboardingData,
    setOnboardingData,
    validationErrors,
    setValidationErrors,
    styles,
    theme,
    isDarkScheme,
  };

  // 1. Build theme from OS scheme.
  // 2. Render the body for this fieldKey.
  return renderPlanFieldEditBody(fieldKey, sharedEditProps);
}
