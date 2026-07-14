export const devLog = (...args) => {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
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
