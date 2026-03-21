// Mock path module for React Native
// This prevents Metro from trying to bundle the real path module
module.exports = {
  join: (...args) => args.join('/'),
  dirname: (p) => p.split('/').slice(0, -1).join('/'),
};









