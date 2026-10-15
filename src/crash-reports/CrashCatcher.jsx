// Error boundary around a screen. A render crash shows a retry panel instead of a blank app.
// Flow: React reports the crash → we record it → the next render shows Try again → retry clears the flag.
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
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>Something went wrong</Text>
      <Text style={{ color: MUTED_ERROR_COLOR, marginBottom: 20, textAlign: 'center' }}>
        {visibleErrorMessage(error)}
      </Text>
      <TouchableOpacity
        onPress={onRetry}
        style={{ padding: 10, backgroundColor: RETRY_BUTTON_COLOR, borderRadius: 8 }}
      >
        <Text style={{ color: RETRY_TEXT_COLOR, fontWeight: 'bold' }}>Try again</Text>
      </TouchableOpacity>
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
