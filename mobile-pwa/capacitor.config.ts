import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.checkshappy.app',
  appName: 'Checks Happy',
  webDir: '../mobile',
  // iOS-specific settings
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#f5f4f2',
  },
  // Android-specific settings
  android: {
    backgroundColor: '#f5f4f2',
  },
  // Server settings for development
  server: {
    // Enable CORS for API requests
    androidScheme: 'https',
  },
  // Plugin configurations
  plugins: {
    // Splash screen config
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#f5f4f2',
      showSpinner: false,
    },
    // Status bar config
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#f5f4f2',
    },
  },
};

export default config;
