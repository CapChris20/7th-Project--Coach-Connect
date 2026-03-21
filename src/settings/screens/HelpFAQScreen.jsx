import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../shared/ui/ThemeContext';

export default function HelpFAQScreen({ onClose }) {
  const { colors, spacing, isDark } = useTheme();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md + 8,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? 'rgba(88, 86, 214, 0.2)' : colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.text,
    },
    backButton: {
      padding: spacing.sm,
    },
    backButtonText: {
      fontSize: 18,
      color: colors.primary,
      fontWeight: '600',
    },
    scrollContent: {
      padding: spacing.lg,
    },
    faqItem: {
      marginBottom: spacing.xl,
    },
    question: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      marginBottom: spacing.sm,
    },
    answer: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
  });

  const faqs = [
    {
      question: 'How do I track my workouts?',
      answer: 'Navigate to the Workout section and start a new workout. You can log exercises, sets, and reps as you complete them. Your progress is automatically saved.',
    },
    {
      question: 'Can I customize my nutrition goals?',
      answer: 'Yes! Go to Settings > Nutrition Goals to set your daily calorie, protein, carb, and fat targets based on your fitness goals.',
    },
    {
      question: 'How do I connect with a trainer?',
      answer: 'Use the Trainer Search feature to find certified trainers. You can message them directly and schedule sessions through the app.',
    },
    {
      question: 'Is my data secure?',
      answer: 'Yes, we use industry-standard encryption to protect your personal information and workout data. Your privacy is our priority.',
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to Settings > Change Password to update your password. If you\'ve forgotten your password, use the "Forgot Password" option on the login screen.',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={colors.background} />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {faqs.map((faq, index) => (
          <View key={index} style={styles.faqItem}>
            <Text style={styles.question}>{faq.question}</Text>
            <Text style={styles.answer}>{faq.answer}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}











