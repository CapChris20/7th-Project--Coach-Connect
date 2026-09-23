// Dev tool that screenshots every onboarding step for the docs, unattended.
// Flow: walk the capture list → render that step of the real wizard → wait for it to settle → POST the local Mac capture server → next.
// Triggered by the deep link coachconnect://onboarding-snapshots. Needs `npm run snapshot:onboarding` running on the Mac first.

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import NewUserSetupScreen from './NewUserSetupScreen';
import {
  ONBOARDING_SNAPSHOT_CAPTURES,
  ONBOARDING_SNAPSHOT_TOTAL,
} from './setupScreenshotList.json';

// The little HTTP server started by `npm run snapshot:onboarding`; it's what actually runs the
// screenshot command on the Mac. 127.0.0.1 works from the simulator because the simulator shares the
// Mac's network stack — on a physical device you'd need the Mac's LAN IP instead.
// Manipulate here: port 9876 must match the port in the snapshot script.
const SNAP_SERVER = 'http://127.0.0.1:9876';

// How long to let a step finish rendering before capturing it. The wizard has entrance animations
// and async content, so capturing immediately catches half-drawn screens.
// Manipulate here: raise if screenshots come out mid-animation; lower to make a full run faster.
const RENDER_WAIT_MS = 2800;

// vocab: a Promise that resolves after `ms` — lets us `await sleep(...)` to pause a loop, since
// there's no built-in "wait" in JS.
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function SetupScreenshotTool({ onDone }) {
  // `current` is the capture being rendered right now — it drives which wizard step is on screen.
  const [current, setCurrent] = useState(ONBOARDING_SNAPSHOT_CAPTURES[0]);
  // progress/status exist for the on-screen readout; they don't affect the capture itself.
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Starting…');
  const [error, setError] = useState(null);

  // vocab: useEffect = run this after the component is on screen. The [onDone] dependency list means
  // "re-run only if onDone changes" — effectively once, since the whole run happens inside.
  useEffect(() => {
    // Guard flag for unmounting mid-run. The loop below spans many seconds of awaits, and setting
    // state after the component is gone is both useless and a React warning — so every await is
    // followed by a cancelled check.
    let cancelled = false;

    // vocab/symbol: (async () => { ... })() = define an async function and immediately call it.
    // Needed because useEffect itself cannot be async (React expects it to return a cleanup function).
    (async () => {
      for (let i = 0; i < ONBOARDING_SNAPSHOT_CAPTURES.length; i += 1) {
        if (cancelled) return;
        const cap = ONBOARDING_SNAPSHOT_CAPTURES[i];
        // Setting `current` re-renders the wizard at this step; the sleep right after is what gives
        // that render time to actually appear before we ask the Mac to screenshot it.
        setCurrent(cap);
        setProgress(i + 1);
        setStatus(`Rendering ${cap.role} step ${cap.step}…`);

        await sleep(RENDER_WAIT_MS);
        if (cancelled) return;

        try {
          // The filename comes from the manifest so screenshots land with predictable names.
          // vocab: encodeURIComponent = escape characters that would otherwise break the query
          // string (spaces, slashes, &). Always wrap user/data values placed into a URL.
          const res = await fetch(
            `${SNAP_SERVER}/snap?file=${encodeURIComponent(cap.file)}`,
            { method: 'POST' },
          );
          if (!res.ok) throw new Error(`Capture failed (${res.status})`);
          setStatus(`Captured ${i + 1}/${ONBOARDING_SNAPSHOT_TOTAL}`);
        } catch (e) {
          // Abort the entire run on the first failure rather than continuing: if the server isn't
          // reachable, every remaining capture will fail too, and you'd wait minutes to find out.
          const msg = e?.message || String(e);
          // Manipulate here: this copy names the exact command to run, because "fetch failed" on its
          // own gives no hint that a separate Mac process is required.
          setError(
            `Could not reach capture server on :9876. Run: npm run snapshot:onboarding\n\n${msg}`,
          );
          return;
        }

        // Manipulate here: small breather so the screenshot finishes writing to disk before the
        // next step starts animating in and changes what's on screen.
        await sleep(400);
      }

      setStatus('Done — check docs/onboarding-snapshots/');
      // Manipulate here: hold the "Done" message on screen briefly so it's readable before we exit.
      await sleep(800);
      // vocab/symbol: onDone?.() = call it only if the parent passed one.
      onDone?.();
    })();

    // useEffect cleanup — React runs this when the component unmounts. Flipping the flag is what
    // stops the in-flight loop above at its next checkpoint.
    return () => {
      cancelled = true;
    };
  }, [onDone]);

  // Error state takes over the whole screen: there's nothing useful to capture once the server is
  // unreachable, and the instructions need to be readable.
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Snapshot capture failed</Text>
        <Text style={styles.errorBody}>{error}</Text>
      </View>
    );
  }

  // Normal state: nothing but the wizard. No progress banner is rendered over it on purpose —
  // any overlay would end up baked into every screenshot.
  return (
    <View style={styles.root}>
      <NewUserSetupScreen
        // Same trick as the preview screen: changing the key forces a full remount so the wizard
        // actually jumps to previewInitialStep instead of keeping its own internal step state.
        key={`${current.role}-${current.step}`}
        role={current.role}
        // previewMode keeps this off real auth and stops it writing onboarding data.
        previewMode
        previewInitialStep={current.step}
        onComplete={() => {}}
      />
    </View>
  );
}

// Manipulate here: `banner`/`bannerText` style an on-screen progress chip that is currently not
// rendered (it would appear in the screenshots). Keep them if you want a debug overlay while
// watching a run; the error screen styles below are the ones actually in use.
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
