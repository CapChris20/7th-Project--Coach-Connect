// Neobrutalist screen wrapper with safe area, scrollable body, and optional sticky CTA
// Flow: provides consistent screen layout with background, scroll area, and bottom button
// Where used: all screens that need standard layout with optional sticky bottom action
//
// vocab: screen wrapper = reusable layout container with safe area and sticky footer

import React from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { useColorScheme } from 'react-native';
import { lightColors, darkColors, spacing } from './colorPalette';

/**
 * Standard screen layout with safe area, scroll body, and sticky CTA.
 * 
 * @param {object} props
 * @param {React.ReactNode} props.children - scrollable content
 * @param {React.ReactNode} [props.footer] - sticky footer content (typically NbButton)
 * @param {boolean} [props.noScroll] - disable scroll (for screens with their own ScrollView)
 * @param {object} [props.contentStyle] - additional content container styles
 * @param {object} [props.scrollStyle] - additional ScrollView styles
 * @param {object} [props.style] - additional outer container styles
 */
export default function NbScreen({ children, footer, noScroll = false, contentStyle, scrollStyle, style }) {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? darkColors : lightColors;
  
  const content = noScroll ? (
    <View style={[styles.content, contentStyle]}>
      {children}
    </View>
  ) : (
    <ScrollView
      style={[styles.scroll, scrollStyle]}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
  
  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.nbBackground },
        style,
      ]}
    >
      {content}
      
      {footer && (
        <View
          style={[
            styles.footer,
            { backgroundColor: colors.nbBackground },
          ]}
        >
          {footer}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
});
