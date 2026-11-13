// Design Law crash screen (loading-and-errors PNG 19/20).
// Flow: React reports the crash → we record it → black card + Try again → retry clears the flag.
// Used by the client and trainer app shells so one broken screen does not take down the whole tree.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, nb, borderRadius } from '../look-and-feel/colorPalette';
import NbButton from '../look-and-feel/NbButton';
import HardShadow from '../look-and-feel/HardShadow';
import logger from '../for-both/online-connection/sendCrashReport';

// ===== NAMED CONSTANTS =====

const UNKNOWN_ERROR_MESSAGE = 'Unknown error';

// ===== HELPER FUNCTIONS =====

function visibleErrorMessage(error) {
  if (error && error.message) return error.message;
  return UNKNOWN_ERROR_MESSAGE;
}

function reportCrashToLogger(error, errorInfo) {
  if (__DEV__) {
    console.error('CrashCatcher caught:', error, errorInfo);
  }
  try {
    const componentStack = errorInfo ? errorInfo.componentStack : undefined;
    logger.error(error, {
      componentStack,
      boundary: true,
    });
  } catch (ignoredError) {
    // Best-effort. The fallback screen still has to render.
  }
}

function CrashRetryPanel({ error, onRetry }) {
  // Crash panel stays on light ink card so it is readable even if theme providers blew up
  return (
    <View style={styles.root}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Something went wrong</Text>
          <Text style={styles.title}>This screen crashed</Text>
          <Text style={styles.body}>{visibleErrorMessage(error)}</Text>
          <NbButton variant="ghost" onPress={onRetry} style={styles.retry}>
            Try again
          </NbButton>
        </View>
      </HardShadow>
    </View>
  );
}

// ===== MAIN FUNCTION =====

export class CrashCatcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    reportCrashToLogger(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <CrashRetryPanel error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: lightColors.nbBackground,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderWidth: nb.borderWidth,
    borderColor: lightColors.nbBorder,
    borderRadius: borderRadius.nbCard,
    backgroundColor: lightColors.nbFill,
    padding: 20,
    gap: 10,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: lightColors.nbOnFill,
    opacity: 0.7,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: lightColors.nbOnFill,
  },
  body: {
    fontSize: 14,
    fontWeight: '600',
    color: lightColors.nbOnFill,
    opacity: 0.85,
    lineHeight: 20,
  },
  retry: {
    marginTop: 8,
    backgroundColor: lightColors.nbSurface,
  },
});
