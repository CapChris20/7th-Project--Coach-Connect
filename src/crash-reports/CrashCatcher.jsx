// Error boundary around a screen. A render crash shows a retry panel instead of a blank app.
// Flow: React reports the crash → we record it → the next render shows "Try again" → retry clears the flag.
// Used by the client and trainer app shells so one broken screen does not take down the whole tree.

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import logger from '../for-both/online-connection/sendCrashReport';

// ===== NAMED CONSTANTS =====

const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const MUTED_ERROR_COLOR = '#666';
const RETRY_BUTTON_COLOR = '#007AFF';
const RETRY_TEXT_COLOR = 'white';

// ===== HELPER FUNCTIONS =====

/**
 * Some throws have no message. The panel still needs a sentence.
 * @param {Error|null|undefined} error
 * @returns {string}
 */
function visibleErrorMessage(error) {
  return error?.message || UNKNOWN_ERROR_MESSAGE;
}

/**
 * Dev builds also print the component stack. The logger call is best-effort so a logging failure
 * cannot replace this fallback with a second crash.
 * @param {Error} error
 * @param {{ componentStack?: string }} errorInfo
 */
function reportCrashToLogger(error, errorInfo) {
  if (__DEV__) {
    console.error('CrashCatcher caught:', error, errorInfo);
  }
  try {
    logger.error(error, {
      componentStack: errorInfo?.componentStack,
      boundary: true,
    });
  } catch {
    // Best-effort. The fallback screen still has to render.
  }
}

// ===== MAIN FUNCTION =====

/**
 * Catches render errors under this component and shows a retry button.
 * @param {object} props
 * @param {React.ReactNode} props.children
 */
export class CrashCatcher extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // vocab: getDerivedStateFromError = React calls this during the failed render, before componentDidCatch.
  // It must stay static and must not log. The state flip is what swaps the children for the fallback.
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    reportCrashToLogger(error, errorInfo);
  }

  // Arrow so `this` stays the boundary. A plain method would lose it when the button calls it.
  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Plain inline styles on purpose. A theme crash must not be able to take this panel down too.
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>
            Something went wrong
          </Text>
          <Text style={{ color: MUTED_ERROR_COLOR, marginBottom: 20, textAlign: 'center' }}>
            {visibleErrorMessage(this.state.error)}
          </Text>
          <TouchableOpacity
            onPress={this.handleRetry}
            style={{ padding: 10, backgroundColor: RETRY_BUTTON_COLOR, borderRadius: 8 }}
          >
            <Text style={{ color: RETRY_TEXT_COLOR, fontWeight: 'bold' }}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
