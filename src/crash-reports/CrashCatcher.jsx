// Design Law crash screen — black card + Try again when a child screen throws.
// Flow: React reports the crash → we record it → show the card → retry clears the flag.
// Used by the client and trainer app shells so one broken screen does not take down the whole tree.
// Exception (CODING_STYLE): CrashCatcher may remain a class — hooks cannot implement componentDidCatch.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { lightColors, nb, borderRadius } from '../look-and-feel/colorPalette';
import NbButton from '../look-and-feel/NbButton';
import HardShadow from '../look-and-feel/HardShadow';
import logger from '../for-both/online-connection/sendCrashReport';

// ===== NAMED CONSTANTS =====

const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const CRASH_EYEBROW = 'Something went wrong';
const CRASH_TITLE = 'This screen crashed';
const RETRY_LABEL = 'Try again';

// ===== HELPER FUNCTIONS =====

function messageToShowOnCrashScreen(crashError) {
  if (crashError && crashError.message) return crashError.message;
  return UNKNOWN_ERROR_MESSAGE;
}

function componentStackFromReactInfo(reactErrorInfo) {
  if (!reactErrorInfo) return undefined;
  return reactErrorInfo.componentStack;
}

function printCrashInDevConsole(crashError, reactErrorInfo) {
  if (!__DEV__) return;
  console.error('CrashCatcher caught:', crashError, reactErrorInfo);
}

function sendCrashToRemoteLogger(crashError, reactErrorInfo) {
  // 1. Dev builds still get a loud console line for local debugging.
  printCrashInDevConsole(crashError, reactErrorInfo);

  // 2. Best-effort remote log — if logging throws, the fallback UI must still render.
  try {
    const componentStack = componentStackFromReactInfo(reactErrorInfo);
    logger.error(crashError, {
      componentStack,
      boundary: true,
    });
  } catch {
    // Swallow: user only needs Try again on screen.
  }
}

function CrashRetryPanel({ error, onRetry }) {
  const crashMessage = messageToShowOnCrashScreen(error);

  return (
    <View style={crashPanelStyles.root}>
      <HardShadow offset={nb.shadowOffsetCard} radius={borderRadius.nbCard}>
        <View style={crashPanelStyles.card}>
          <Text style={crashPanelStyles.eyebrow}>{CRASH_EYEBROW}</Text>
          <Text style={crashPanelStyles.title}>{CRASH_TITLE}</Text>
          <Text style={crashPanelStyles.body}>{crashMessage}</Text>
          <NbButton variant="ghost" onPress={onRetry} style={crashPanelStyles.retry}>
            {RETRY_LABEL}
          </NbButton>
        </View>
      </HardShadow>
    </View>
  );
}

function clearCrashState() {
  return { hasError: false, error: null };
}

// ===== MAIN FUNCTION =====

/**
 * React error boundary for client + trainer shells.
 * Class is required: getDerivedStateFromError / componentDidCatch have no hook form.
 */
export class CrashCatcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(crashError) {
    return { hasError: true, error: crashError };
  }

  componentDidCatch(crashError, reactErrorInfo) {
    sendCrashToRemoteLogger(crashError, reactErrorInfo);
  }

  handleRetry = () => {
    this.setState(clearCrashState());
  };

  render() {
    const screenCrashed = this.state.hasError;
    if (screenCrashed) {
      return (
        <CrashRetryPanel error={this.state.error} onRetry={this.handleRetry} />
      );
    }
    return this.props.children;
  }
}

// ===== PLUMBING — skip unless debugging =====

// Fixed light-ink tokens so the message stays readable when theme providers failed above.
const crashPanelStyles = StyleSheet.create({
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
