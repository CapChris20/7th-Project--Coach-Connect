const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const fs = require('fs');

const config = getDefaultConfig(__dirname);

config.watchFolders = [
  path.resolve(__dirname, 'src'),
];

// Add polyfills for Node.js modules
config.resolver = {
  ...config.resolver,
  // Ensure Metro can pick the correct implementation for packages that ship
  // separate React Native / browser builds via package "exports" conditions.
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'browser', 'require', 'default'],
  resolverMainFields: ['react-native', 'browser', 'main'],
  extraNodeModules: {
    ...config.resolver.extraNodeModules,
    // Force axios to use the browser/XHR build (Node build requires 'crypto')
    axios: require.resolve('axios/dist/browser/axios.cjs'),

    crypto: require.resolve('react-native-crypto'),
    stream: require.resolve('stream-browserify'),
    http: require.resolve('@tradle/react-native-http'),
    https: require.resolve('https-browserify'),
    url: require.resolve('url'),
    zlib: require.resolve('browserify-zlib'),
    assert: require.resolve('assert'),
    buffer: require.resolve('buffer'),
  },
};

module.exports = config;
