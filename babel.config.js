module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            // Additional aliases for compatibility
            'src': './src',
          },
          extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
          // Resolve both relative and absolute paths
          resolvePath(sourcePath, currentFile) {
            // Handle @ alias
            if (sourcePath.startsWith('@/')) {
              return sourcePath.replace('@/', './src/');
            }
            // Handle src/ imports
            if (sourcePath.startsWith('src/')) {
              return './' + sourcePath;
            }
            // Default resolution
            return sourcePath;
          },
        },
      ],
    ],
  };
};
