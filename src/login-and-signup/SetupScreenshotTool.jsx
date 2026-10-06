// Dev tool that screenshots every onboarding step for the docs, with nobody tapping through.
// Flow: walk the capture list → render that wizard step → wait for it to settle → POST the Mac capture server → next.
// Triggered by the deep link coachconnect://onboarding-snapshots. Needs `npm run snapshot:onboarding` running on the Mac first.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import NewUserSetupScreen from './NewUserSetupScreen';
import manifest from './setupScreenshotList.json';

// ===== NAMED CONSTANTS =====

const ONBOARDING_SNAPSHOT_CAPTURES = manifest;
const ONBOARDING_SNAPSHOT_TOTAL = manifest.length;

// 127.0.0.1 works from the simulator because the simulator shares the Mac's network.
// A physical phone would need the Mac's LAN address instead.
// Manipulate here: port 9876 must match the port in the snapshot script.
const SNAPSHOT_SERVER_PORT = 9876;
const SNAP_SERVER = `http://127.0.0.1:${SNAPSHOT_SERVER_PORT}`;

// The wizard animates in. Capturing immediately saves a half-drawn screen.
// Manipulate here: raise if shots land mid-animation. Lower to make a full run faster.
const RENDER_WAIT_MS = 2800;
// Lets the screenshot finish writing before the next step animates over it.
const PAUSE_BETWEEN_CAPTURES_MS = 400;
// Holds the done status on screen long enough to read before the tool exits.
const DONE_HOLD_MS = 800;

const STATUS_STARTING = 'Starting…';
const STATUS_DONE = 'Done — check docs/onboarding-snapshots/';

// ===== HELPER FUNCTIONS =====

// vocab: a Promise that resolves after the wait. JavaScript has no built-in sleep, so the loop awaits this.
function sleep(waitMilliseconds) {
  return new Promise((resolve) => setTimeout(resolve, waitMilliseconds));
}

async function postScreenshotRequest(fileName) {
  // vocab: encodeURIComponent escapes spaces and slashes so the filename cannot break the query string.
  const snapUrl = `${SNAP_SERVER}/snap?file=${encodeURIComponent(fileName)}`;
  const response = await fetch(snapUrl, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Capture failed (${response.status})`);
  }
}

function captureServerFailureMessage(error) {
  const message = error?.message || String(error);
  // Manipulate here: this copy names the command to run. "fetch failed" alone does not say a Mac process is required.
  return `Could not reach capture server on :${SNAPSHOT_SERVER_PORT}. Run: npm run snapshot:onboarding\n\n${message}`;
}

// isRunCancelled is a function, not a boolean copied once. The loop lasts many seconds, and the
// cleanup flag flips while we are sitting in sleep(). Reading it fresh is the only way to notice.
async function captureAllSteps({
  isRunCancelled,
  setCurrentCapture,
  setProgress,
  setStatus,
  setError,
  onDone,
}) {
  for (let captureIndex = 0; captureIndex < ONBOARDING_SNAPSHOT_CAPTURES.length; captureIndex += 1) {
    if (isRunCancelled()) return;
    const captureStep = ONBOARDING_SNAPSHOT_CAPTURES[captureIndex];
    // Setting the capture re-renders the wizard. The sleep is what lets that paint finish.
    setCurrentCapture(captureStep);
    setProgress(captureIndex + 1);
    setStatus(`Rendering ${captureStep.role} step ${captureStep.step}…`);

    await sleep(RENDER_WAIT_MS);
    if (isRunCancelled()) return;

    try {
      await postScreenshotRequest(captureStep.file);
      setStatus(`Captured ${captureIndex + 1}/${ONBOARDING_SNAPSHOT_TOTAL}`);
    } catch (captureError) {
      // Stop on the first failure. If the server is down, every later shot fails too.
      setError(captureServerFailureMessage(captureError));
      return;
    }

    await sleep(PAUSE_BETWEEN_CAPTURES_MS);
  }

  setStatus(STATUS_DONE);
  await sleep(DONE_HOLD_MS);
  // vocab: onDone?.() calls the parent callback only when one was passed.
  onDone?.();
}

// ===== MAIN FUNCTION =====

/**
 * Renders each onboarding step and asks the local Mac server to screenshot it.
 * @param {{ onDone?: () => void }} props
 */
export default function SetupScreenshotTool({ onDone }) {
  const [currentCapture, setCurrentCapture] = useState(ONBOARDING_SNAPSHOT_CAPTURES[0]);
  // progress and status drive a debug readout that is intentionally not painted.
  // Painting it would bake a banner into every screenshot.
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(STATUS_STARTING);
  const [error, setError] = useState(null);

  // vocab: useEffect runs after the component is on screen. [onDone] means "start again only if onDone changes".
  useEffect(() => {
    let isCancelled = false;

    captureAllSteps({
      isRunCancelled: () => isCancelled,
      setCurrentCapture,
      setProgress,
      setStatus,
      setError,
      onDone,
    });

    // React runs this when the tool unmounts. The loop notices at its next checkpoint.
    return () => {
      isCancelled = true;
    };
  }, [onDone]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Snapshot capture failed</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  // No progress banner on purpose. Any overlay would be saved into the screenshot.
  return (
    <View style={styles.root}>
      <NewUserSetupScreen
        // Changing the key forces a remount, so the wizard actually jumps to this step
        // instead of keeping the step it was already on.
        key={`${currentCapture.role}-${currentCapture.step}`}
        role={currentCapture.role}
        previewMode
        previewInitialStep={currentCapture.step}
        onComplete={() => {}}
      />
    </View>
  );
}

// banner and bannerText are the unused debug chip. Leave them if you want that overlay later.
// The error-screen styles below are the ones this file actually paints.
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0A0A0F' },
  banner: {
    position: 'absolute',
    top: 54,
    left: 16,
    right: 16,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  bannerText: { color: '#fff', fontSize: 12, fontWeight: '600', flex: 1 },
  center: {
    flex: 1,
    backgroundColor: '#0A0A0F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { color: '#FF6B9D', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  errorBody: { color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
