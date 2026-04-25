const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Metro only treats lowercase jpg/jpeg as assets by default; iPhone exports often use .JPG
if (Array.isArray(config.resolver?.assetExts)) {
  for (const ext of ['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP']) {
    if (!config.resolver.assetExts.includes(ext)) {
      config.resolver.assetExts.push(ext);
    }
  }
}

config.watchFolders = [
  path.resolve(__dirname, 'src'),
];

// Add polyfills for Node.js modules
config.resolver = {
  ...config.resolver,
  // Ensure Metro can pick the correct implementation for packages that ship
  // separate React Native / browser builds via package "exports" conditions.
  unstable_enablePackageExports: true,
  unstable_conditionNames: ['react-native', 'require', 'default'],
  resolverMainFields: ['react-native', 'main'],
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
    fs: path.resolve(__dirname, 'utils/fs-mock.js'),
    path: path.resolve(__dirname, 'utils/path-mock.js'),
  },
};

const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'fs' || moduleName === 'node:fs') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'utils/fs-mock.js'),
    };
  }

  if (moduleName === 'path' || moduleName === 'node:path') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'utils/path-mock.js'),
    };
  }

  if (typeof defaultResolveRequest === 'function') {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
