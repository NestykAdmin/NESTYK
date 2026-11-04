const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Ensure single instance of React and React Native
config.resolver.extraNodeModules = {
  react: path.resolve(monorepoRoot, 'node_modules/react'),
  'react-native': path.resolve(monorepoRoot, 'node_modules/react-native'),
  '@nestyk/ui': path.resolve(monorepoRoot, 'packages/ui'),
  '@nestyk/types': path.resolve(monorepoRoot, 'packages/types'),
  '@nestyk/config': path.resolve(monorepoRoot, 'packages/config'),
  '@nestyk/i18n': path.resolve(monorepoRoot, 'packages/i18n'),
  '@nestyk/feature-search': path.resolve(monorepoRoot, 'packages/feature-search'),
  '@nestyk/feature-services': path.resolve(monorepoRoot, 'packages/feature-services'),
  '@nestyk/feature-listing': path.resolve(monorepoRoot, 'packages/feature-listing'),
  'react-native-maps': path.resolve(monorepoRoot, 'node_modules/react-native-maps'),
  '@react-native-async-storage/async-storage': path.resolve(
    monorepoRoot,
    'node_modules/@react-native-async-storage/async-storage',
  ),
};

// 4. Dev web: "/api/..." on :8081 goes to the API on this machine (scripts/dev-api-proxy.cjs).
const { withDevApiProxy } = require('./scripts/dev-api-proxy.cjs');

module.exports = withDevApiProxy(config);
