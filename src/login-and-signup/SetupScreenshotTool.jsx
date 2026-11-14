// Dev tool that screenshots every onboarding step for the docs, with nobody tapping through.
// Flow: walk the capture list → render that wizard step → wait for it to settle → POST the Mac capture server → next.
// Triggered by the deep link coachconnect://onboarding-snapshots. Needs `npm run snapshot:onboarding` running on the Mac first.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NewUserSetupScreen from './NewUserSetupScreen';
import manifest from './setupScreenshotList.json';
import { useTheme } from '../look-and-feel/lightDarkMode';
import { gradients } from '../look-and-feel/colorPalette';

// ===== NAMED CONSTANTS =====

const ONBOARDING_SNAPSHOT_CAPTURES = manifest;
const ONBOARDING_SNAPSHOT_TOTAL = manifest.length;

// 127.0.0.1 works from the simulator because the simulator shares the Mac's network.
// A physical phone would need the Mac's LAN address instead.
// Manipulate here: port 9876 must match the port in the snapshot script.
const SNAPSHOT_SERVER_PORT = 9876;
const CAPTURE_SERVER_BASE_URL = `http://127.0.0.1:${SNAPSHOT_SERVER_PORT}`;

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
function waitMilliseconds(durationMs) {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function askMacServerToCaptureFile(fileName) {
  // vocab: encodeURIComponent escapes spaces and slashes so the filename cannot break the query string.
  const snapUrl = `${CAPTURE_SERVER_BASE_URL}/snap?file=${encodeURIComponent(fileName)}`;
  const response = await fetch(snapUrl, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Capture failed (${response.status})`);
  }
}

function messageWhenCaptureServerIsDown(error) {
  const errorMessage = error?.message || String(error);
  // Manipulate here: this copy names the command to run. "fetch failed" alone does not say a Mac process is required.
  return `Could not reach capture server on :${SNAPSHOT_SERVER_PORT}. Run: npm run snapshot:onboarding\n\n${errorMessage}`;
}

function statusWhileRenderingStep(captureStep) {
  return `Rendering ${captureStep.role} step ${captureStep.step}…`;
}

function statusAfterCaptureSaved(captureIndex) {
  const humanIndex = captureIndex + 1;
  return `Captured ${humanIndex}/${ONBOARDING_SNAPSHOT_TOTAL}`;
}

function remountKeyForWizardStep(captureStep) {
  return `${captureStep.role}-${captureStep.step}`;
}

// isRunCancelled is a function, not a boolean copied once — the loop can sit in sleep() while cleanup flips the flag.
async function captureOneOnboardingStep({
  captureStep,
  captureIndex,
  isRunCancelled,
  setCurrentCapture,
  setProgress,
  setStatus,
  setError,
}) {
  // Setting the capture re-renders the wizard. The wait is what lets that paint finish.
  setCurrentCapture(captureStep);
  setProgress(captureIndex + 1);
  setStatus(statusWhileRenderingStep(captureStep));

  await waitMilliseconds(RENDER_WAIT_MS);
  if (isRunCancelled()) {
    return false;
  }

  try {
    await askMacServerToCaptureFile(captureStep.file);
    setStatus(statusAfterCaptureSaved(captureIndex));
  } catch (captureError) {
    // Stop on the first failure. If the server is down, every later shot fails too.
    setError(messageWhenCaptureServerIsDown(captureError));
    return false;
  }

  await waitMilliseconds(PAUSE_BETWEEN_CAPTURES_MS);
  return true;
}

async function walkEntireCaptureList({
  isRunCancelled,
  setCurrentCapture,
  setProgress,
  setStatus,
  setError,
  onDone,
}) {
  for (let captureIndex = 0; captureIndex < ONBOARDING_SNAPSHOT_CAPTURES.length; captureIndex += 1) {
    if (isRunCancelled()) {
      return;
    }

    const captureStep = ONBOARDING_SNAPSHOT_CAPTURES[captureIndex];
    const keepGoing = await captureOneOnboardingStep({
      captureStep,
      captureIndex,
      isRunCancelled,
      setCurrentCapture,
      setProgress,
      setStatus,
      setError,
    });
    if (!keepGoing) {
      return;
    }
  }

  setStatus(STATUS_DONE);
  await waitMilliseconds(DONE_HOLD_MS);
  // vocab: only call the parent callback when one was passed.
  if (onDone) {
    onDone();
  }
}

function SnapshotErrorScreen({ error, colors }) {
  const errorTitleColor = gradients.brand.colors[0];
  return (
    <View style={[styles.center, { backgroundColor: colors.nbBackground }]}>
      <Text style={[styles.errorTitle, { color: errorTitleColor }]}>Snapshot capture failed</Text>
      <Text style={[styles.errorBody, { color: colors.nbMuted }]}>{error}</Text>
    </View>
  );
}

// ===== MAIN FUNCTION =====

/**
 * Renders each onboarding step and asks the local Mac server to screenshot it.
 * @param {{ onDone?: () => void }} props Optional callback after the last shot (or after DONE_HOLD_MS).
 */
export default function SetupScreenshotTool({ onDone }) {
  const { colors } = useTheme();
  const [currentCapture, setCurrentCapture] = useState(ONBOARDING_SNAPSHOT_CAPTURES[0]);
  // progress and status drive a debug readout that is intentionally not painted.
  // Painting it would bake a banner into every screenshot.
  const [, setProgress] = useState(0);
  const [, setStatus] = useState(STATUS_STARTING);
  const [error, setError] = useState(null);

  // vocab: useEffect runs after the component is on screen. [onDone] means "start again only if onDone changes".
  useEffect(() => {
    let isCancelled = false;

    walkEntireCaptureList({
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

  // 1. Hard-stop UI when the Mac capture server is unreachable.
  if (error) {
    return <SnapshotErrorScreen error={error} colors={colors} />;
  }

  // 2. Full-screen wizard only — any overlay would be saved into the PNG.
  const wizardRemountKey = remountKeyForWizardStep(currentCapture);

  return (
    <View style={[styles.root, { backgroundColor: colors.nbBackground }]}>
      <NewUserSetupScreen
        key={wizardRemountKey}
        role={currentCapture.role}
        previewMode
        previewInitialStep={currentCapture.step}
        onComplete={() => {}}
      />
    </View>
  );
}

// PLUMBING — skip unless debugging

// banner and bannerText are the unused debug chip. Leave them if you want that overlay later.
const styles = StyleSheet.create({
  root: { flex: 1 },
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
  errorBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
