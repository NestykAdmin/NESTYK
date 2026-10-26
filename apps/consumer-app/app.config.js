const path = require('path');
const fs = require('fs');

// Load monorepo root `.env` (frontend) so EXPO_PUBLIC_* are available
const rootEnv = path.join(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  require('dotenv').config({ path: rootEnv });
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = {
  name: 'NESTYK',
  slug: 'nestyk-consumer-app',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'nestyk',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.nestyk.consumer',
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F8B615',
    },
    package: 'com.nestyk.consumer',
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      },
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-router', 'expo-localization', 'expo-document-picker', ['expo-image-picker', { photosPermission: 'Allow NESTYK to select room photos for your listing.', cameraPermission: false, microphonePermission: false }]],
  extra: {
    webGoogleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    apiUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1',
    baseUrl: process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:3000',
    defaultRole: process.env.EXPO_PUBLIC_DEFAULT_ROLE || 'guest',
  },
};
