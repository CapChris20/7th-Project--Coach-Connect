/** Jest global setup — keep RN/Expo mocks minimal for unit tests. */
global.__DEV__ = true;

if (typeof global.fetch !== 'function') {
  global.fetch = jest.fn();
}

jest.setTimeout(15000);
