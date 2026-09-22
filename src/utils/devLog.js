// Console wrappers that go silent in production builds.
// Flow: call devLog/devWarn/devError like console.* → the __DEV__ guard drops them in release bundles.
// Use these instead of raw console.* so shipped apps don't leak debug noise or slow the JS thread.

// vocab: __DEV__ = a global React Native injects — true in Metro/dev builds, false in release
// The `typeof ... !== 'undefined'` half matters because this file also gets imported in
// plain Node contexts (scripts, tests) where __DEV__ was never defined and reading it would throw.
// Manipulate here: force these true to keep logs in a release build while chasing a prod-only bug
export const devLog = (...args) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // vocab/symbol: ...args = "however many arguments were passed", forwarded through untouched
    console.log(...args);
  }
};

export const devWarn = (...args) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.warn(...args);
  }
};

export const devError = (...args) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.error(...args);
  }
};
