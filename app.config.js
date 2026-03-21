export default {
  expo: {
    name: 'CoachConnect',
    slug: 'anatrox-app',
    scheme: 'coachconnect',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: 'com.chrisshina.coachconnect',
      buildNumber: '1',
      supportsTablet: false,
      usesAppleSignIn: true,
      infoPlist: {
        NSCameraUsageDescription: 'CoachConnect uses your camera to upload progress photos.',
        NSPhotoLibraryUsageDescription: 'CoachConnect accesses your photo library to upload progress photos and profile pictures.',
        NSMicrophoneUsageDescription: 'CoachConnect uses your microphone for voice features.',
        NSUserNotificationsUsageDescription: 'CoachConnect sends you workout reminders and updates from your trainer.',
      },
    },
    android: {
      package: 'com.chrisshina.coachconnect',
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#0A0A0F',
      },
      permissions: [
        'CAMERA',
        'READ_MEDIA_IMAGES',
        'READ_MEDIA_VIDEO',
        'RECORD_AUDIO',
        'NOTIFICATIONS',
      ],
    },
    extra: {
      eas: {
        projectId: '79b8563c-1e15-49e0-8a8b-76f5d1f316b6',
      },
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:4000',
    },
    plugins: [
      'expo-camera',
      'expo-image-picker',
      'expo-document-picker',
      'expo-notifications',
      'expo-apple-authentication',
    ],
    updates: {
      fallbackToCacheTimeout: 0,
    },
    assetBundlePatterns: ['**/*'],
  },
};
