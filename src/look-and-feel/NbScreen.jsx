// Neobrutalist screen wrapper with safe area, scrollable body, and optional sticky CTA.
// Flow: theme background → scroll or static body → optional sticky footer.
// Where used: most app screens that want a standard shell + optional bottom button.
//
// vocab: SafeAreaView = insets for notch / home indicator; sticky footer = pinned below scroll
// Manipulate here: content/footer padding uses spacing.md / spacing.sm from colorPalette

import React from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView } from 'react-native';

import { spacing } from './colorPalette';
import { useTheme } from './lightDarkMode';

// ===== NAMED CONSTANTS =====
// (content/footer padding comes from colorPalette.spacing)

// ===== HELPER FUNCTIONS =====

/**
 * Scrollable body — hides the vertical indicator; content padding lives on the container.
 */
function buildScrollableBody(children, contentStyle, scrollStyle) {
  return (
    <ScrollView
      style={[styles.scroll, scrollStyle]}
      contentContainerStyle={[styles.content, contentStyle]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Static body for screens that already own their own ScrollView (nested scroll avoided).
 */
function buildStaticBody(children, contentStyle) {
  return <View style={[styles.content, contentStyle]}>{children}</View>;
}

/**
 * Pick scroll vs static. noScroll = true when the screen manages scrolling itself.
 */
function buildScreenBody(children, noScroll, contentStyle, scrollStyle) {
  if (noScroll) {
    return buildStaticBody(children, contentStyle);
  }
  return buildScrollableBody(children, contentStyle, scrollStyle);
}

// ===== SMALL UI PIECES =====

/**
 * Sticky bottom strip for a primary CTA (usually NbButton).
 * Matches shell background so it does not flash a different surface.
 */
function StickyFooter({ footerContent, backgroundColor }) {
  return (
    <View style={[styles.footer, { backgroundColor }]}>
      {footerContent}
    </View>
  );
}

// ===== MAIN FUNCTION =====

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
export default function NbScreen({
  children,
  footer,
  noScroll = false,
  contentStyle,
  scrollStyle,
  style,
}) {
  // vocab: useTheme = ThemeProvider hook → light/dark Design Law color bag
  const { colors: themeColors } = useTheme();

  // 1. Pick scroll vs static body — some screens own their own ScrollView.
  const body = buildScreenBody(children, noScroll, contentStyle, scrollStyle);

  // 2. Safe area shell paints nbBackground; footer pins to bottom when provided.
  const shellBackground = themeColors.nbBackground;
  const showFooter = Boolean(footer);
  const shellStyle = { backgroundColor: shellBackground };

  let footerNode = null;
  if (showFooter) {
    footerNode = (
      <StickyFooter footerContent={footer} backgroundColor={shellBackground} />
    );
  }

  return (
    <SafeAreaView style={[styles.container, shellStyle, style]}>
      {body}
      {footerNode}
    </SafeAreaView>
  );
}

// ===== PLUMBING — skip unless debugging =====

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
