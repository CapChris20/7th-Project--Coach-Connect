import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../context/ThemeContext';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from '../../services/firebase/config';

export default function OnboardingScreen({ onComplete }) {
  const { colors, typography, spacing, isDark } = useTheme();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [answers, setAnswers] = useState({
    fitnessGoal: null,
    experienceLevel: null,
    workoutFrequency: null,
    preferredWorkoutTypes: [],
    availableTime: null,
    equipment: [],
    injuries: null,
    injuriesDetails: '',
  });

  const questions = [
    {
      id: 'fitnessGoal',
      question: "What's your main fitness goal?",
      type: 'single',
      options: [
        { value: 'weight_loss', label: '💪 Weight Loss', emoji: '💪' },
        { value: 'muscle_gain', label: '🏋️ Muscle Gain', emoji: '🏋️' },
        { value: 'endurance', label: '🏃 Endurance', emoji: '🏃' },
        { value: 'flexibility', label: '🧘 Flexibility', emoji: '🧘' },
        { value: 'general_fitness', label: '✨ General Fitness', emoji: '✨' },
        { value: 'athletic_performance', label: '⚡ Athletic Performance', emoji: '⚡' },
      ],
    },
    {
      id: 'experienceLevel',
      question: 'What\'s your fitness experience level?',
      type: 'single',
      options: [
        { value: 'beginner', label: '🌱 Beginner', emoji: '🌱', description: 'New to fitness' },
        { value: 'intermediate', label: '📈 Intermediate', emoji: '📈', description: 'Some experience' },
        { value: 'advanced', label: '🔥 Advanced', emoji: '🔥', description: 'Very experienced' },
      ],
    },
    {
      id: 'workoutFrequency',
      question: 'How often do you want to work out?',
      type: 'single',
      options: [
        { value: '2-3', label: '2-3 times/week', emoji: '📅' },
        { value: '4-5', label: '4-5 times/week', emoji: '📅' },
        { value: '6-7', label: '6-7 times/week', emoji: '📅' },
        { value: 'daily', label: 'Daily', emoji: '🔥' },
      ],
    },
    {
      id: 'preferredWorkoutTypes',
      question: 'What types of workouts do you enjoy? (Select all that apply)',
      type: 'multiple',
      options: [
        { value: 'strength', label: '💪 Strength Training', emoji: '💪' },
        { value: 'cardio', label: '❤️ Cardio', emoji: '❤️' },
        { value: 'yoga', label: '🧘 Yoga', emoji: '🧘' },
        { value: 'pilates', label: '🤸 Pilates', emoji: '🤸' },
        { value: 'hiit', label: '⚡ HIIT', emoji: '⚡' },
        { value: 'running', label: '🏃 Running', emoji: '🏃' },
        { value: 'cycling', label: '🚴 Cycling', emoji: '🚴' },
        { value: 'swimming', label: '🏊 Swimming', emoji: '🏊' },
      ],
    },
    {
      id: 'availableTime',
      question: 'How much time can you dedicate per workout?',
      type: 'single',
      options: [
        { value: '15-30', label: '15-30 minutes', emoji: '⏱️' },
        { value: '30-45', label: '30-45 minutes', emoji: '⏱️' },
        { value: '45-60', label: '45-60 minutes', emoji: '⏱️' },
        { value: '60+', label: '60+ minutes', emoji: '⏱️' },
      ],
    },
    {
      id: 'equipment',
      question: 'What equipment do you have access to? (Select all that apply)',
      type: 'multiple',
      options: [
        { value: 'none', label: '🏠 No Equipment', emoji: '🏠' },
        { value: 'dumbbells', label: '🏋️ Dumbbells', emoji: '🏋️' },
        { value: 'barbell', label: '📊 Barbell', emoji: '📊' },
        { value: 'resistance_bands', label: '🎯 Resistance Bands', emoji: '🎯' },
        { value: 'kettlebells', label: '⚖️ Kettlebells', emoji: '⚖️' },
        { value: 'pull_up_bar', label: '📏 Pull-up Bar', emoji: '📏' },
        { value: 'gym_access', label: '🏋️‍♂️ Gym Access', emoji: '🏋️‍♂️' },
      ],
    },
    {
      id: 'injuries',
      question: 'Do you have any injuries or physical limitations?',
      type: 'single',
      options: [
        { value: 'none', label: '✅ No injuries', emoji: '✅' },
        { value: 'minor', label: '⚠️ Minor limitations', emoji: '⚠️' },
        { value: 'significant', label: '🏥 Significant limitations', emoji: '🏥' },
      ],
    },
  ];

  const currentQuestion = questions[currentStep];
  const isLastStep = currentStep === questions.length - 1;
  const progress = ((currentStep + 1) / questions.length) * 100;

  const handleOptionSelect = (value) => {
    if (currentQuestion.type === 'multiple') {
      const current = answers[currentQuestion.id] || [];
      const newValue = current.includes(value)
        ? current.filter(v => v !== value)
        : [...current, value];
      setAnswers({ ...answers, [currentQuestion.id]: newValue });
    } else {
      setAnswers({ ...answers, [currentQuestion.id]: value });
    }
  };

  const handleNext = () => {
    if (currentQuestion.type === 'single' && !answers[currentQuestion.id]) {
      return; // Can't proceed without selection
    }
    if (currentQuestion.type === 'multiple' && (!answers[currentQuestion.id] || answers[currentQuestion.id].length === 0)) {
      return; // Can't proceed without at least one selection
    }
    
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    if (!auth?.currentUser) {
      console.warn('No authenticated user - skipping onboarding save');
      Alert.alert('Error', 'You must be logged in to save onboarding data. Please sign in and try again.');
      onComplete();
      return;
    }

    if (!db) {
      console.warn('Firebase database not initialized - skipping onboarding save');
      Alert.alert('Error', 'Database connection failed. Please check your internet connection and try again.');
      onComplete();
      return;
    }

    setLoading(true);
    try {
      const userId = auth.currentUser.uid;
      const userRef = doc(db, 'users', userId);
      
      console.log('Saving onboarding data for user:', userId);
      
      // Check if user document exists
      let userDoc;
      try {
        userDoc = await getDoc(userRef);
      } catch (readError) {
        console.error('Error reading user document:', readError);
        throw new Error(`Failed to read user data: ${readError.message}`);
      }
      
      // Prepare onboarding data
      const onboardingData = {
        onboarding: {
          ...answers,
          completedAt: new Date().toISOString(),
        },
        onboardingCompleted: true,
        updatedAt: new Date().toISOString(),
      };

      if (userDoc.exists()) {
        // Document exists - merge the onboarding data
        console.log('User document exists, merging onboarding data...');
        await setDoc(userRef, onboardingData, { merge: true });
        console.log('✅ Onboarding data updated successfully for user:', userId);
      } else {
        // Document doesn't exist - create it with basic user info + onboarding
        console.log('User document does not exist, creating new document...');
        const newUserData = {
          uid: userId,
          email: auth.currentUser.email || '',
          name: auth.currentUser.displayName || '',
          createdAt: new Date().toISOString(),
          ...onboardingData,
        };
        await setDoc(userRef, newUserData);
        console.log('✅ User document created with onboarding data for:', userId);
      }

      onComplete();
    } catch (error) {
      console.error('❌ Error saving onboarding data:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      let errorMessage = 'Failed to save onboarding data. ';
      
      // Provide specific error messages
      if (error.code === 'permission-denied') {
        errorMessage += 'Permission denied. Please check your Firebase security rules.';
      } else if (error.code === 'unavailable') {
        errorMessage += 'Database is unavailable. Please check your internet connection.';
      } else if (error.code === 'unauthenticated') {
        errorMessage += 'You are not authenticated. Please sign in and try again.';
      } else {
        errorMessage += error.message || 'Please try again.';
      }
      
      Alert.alert(
        'Save Failed',
        errorMessage + '\n\nYou can still continue, but your preferences won\'t be saved.',
        [
          {
            text: 'Continue Anyway',
            onPress: onComplete,
          },
          {
            text: 'Try Again',
            onPress: handleComplete,
            style: 'default',
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A0618' : '#F5F3FF',
    },
    progressBar: {
      height: 4,
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.1)',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      borderRadius: 2,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 2,
    },
    content: {
      flex: 1,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xl,
    },
    questionContainer: {
      flex: 1,
      justifyContent: 'center',
    },
    stepIndicator: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: spacing.md,
      fontWeight: '600',
      textAlign: 'center',
    },
    question: {
      fontSize: 28,
      fontWeight: '800',
      color: colors.text,
      marginBottom: spacing.xl,
      textAlign: 'center',
      letterSpacing: 0.5,
      lineHeight: 36,
    },
    optionsContainer: {
      gap: spacing.md,
    },
    optionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md + 4,
      borderRadius: 20,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.5)' 
        : 'rgba(255, 255, 255, 0.6)',
      borderWidth: 2,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.2)' 
        : 'rgba(139, 92, 246, 0.15)',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    optionButtonSelected: {
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.3)' 
        : 'rgba(139, 92, 246, 0.2)',
      borderColor: colors.primary,
      shadowColor: colors.primary,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      elevation: 6,
    },
    optionEmoji: {
      fontSize: 28,
      marginRight: spacing.md,
    },
    optionContent: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.xs / 2,
    },
    optionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    navigationContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.7)' 
        : 'rgba(255, 255, 255, 0.7)',
      borderTopWidth: 1,
      borderTopColor: isDark 
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(139, 92, 246, 0.1)',
    },
    backButton: {
      padding: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: 16,
      backgroundColor: isDark 
        ? 'rgba(139, 92, 246, 0.15)' 
        : 'rgba(139, 92, 246, 0.1)',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.3)' 
        : 'rgba(139, 92, 246, 0.2)',
    },
    backButtonText: {
      fontSize: 16,
      color: colors.primary,
      fontWeight: '700',
    },
    nextButton: {
      flex: 1,
      marginLeft: spacing.md,
      padding: spacing.md,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(255, 255, 255, 0.2)' 
        : 'rgba(255, 255, 255, 0.3)',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 12,
      elevation: 8,
    },
    nextButtonText: {
      fontSize: 16,
      color: colors.white,
      fontWeight: '700',
    },
    nextButtonDisabled: {
      opacity: 0.5,
    },
    textInputContainer: {
      marginTop: spacing.lg,
    },
    textInputLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    textInput: {
      borderWidth: 1,
      borderColor: isDark 
        ? 'rgba(139, 92, 246, 0.3)' 
        : 'rgba(139, 92, 246, 0.2)',
      borderRadius: 16,
      padding: spacing.md,
      color: colors.text,
      backgroundColor: isDark 
        ? 'rgba(30, 27, 46, 0.5)' 
        : 'rgba(255, 255, 255, 0.6)',
      fontSize: 15,
      minHeight: 100,
      textAlignVertical: 'top',
    },
  });

  const isOptionSelected = (value) => {
    if (currentQuestion.type === 'multiple') {
      return (answers[currentQuestion.id] || []).includes(value);
    }
    return answers[currentQuestion.id] === value;
  };

  const canProceed = () => {
    if (currentQuestion.type === 'single') {
      return answers[currentQuestion.id] !== null;
    }
    return answers[currentQuestion.id] && answers[currentQuestion.id].length > 0;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.questionContainer}>
          <Text style={styles.stepIndicator}>
            Question {currentStep + 1} of {questions.length}
          </Text>
          
          <Text style={styles.question}>
            {currentQuestion.question}
          </Text>

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option) => {
              const selected = isOptionSelected(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    selected && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleOptionSelect(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionEmoji}>{option.emoji}</Text>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    {option.description && (
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    )}
                  </View>
                  {selected && (
                    <Text style={{ fontSize: 20, color: colors.primary }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Show text input for injuries if significant limitations selected */}
          {currentQuestion.id === 'injuries' && answers.injuries === 'significant' && (
            <View style={styles.textInputContainer}>
              <Text style={styles.textInputLabel}>
                Please describe your injuries or limitations:
              </Text>
              <TextInput
                style={styles.textInput}
                placeholder="e.g., Lower back pain, knee injury, etc."
                placeholderTextColor={colors.textSecondary}
                value={answers.injuriesDetails}
                onChangeText={(text) => setAnswers({ ...answers, injuriesDetails: text })}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Navigation */}
      <View style={styles.navigationContainer}>
        {currentStep > 0 && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            disabled={loading}
          >
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextButton,
            !canProceed() && styles.nextButtonDisabled,
            currentStep === 0 && { marginLeft: 0 },
          ]}
          onPress={handleNext}
          disabled={!canProceed() || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>
              {isLastStep ? 'Complete' : 'Next →'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

