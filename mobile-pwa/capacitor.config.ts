import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.checkshappy.app',
  appName: 'Checks Happy',
  webDir: '../mobile',
  // iOS-specific settings
  ios: {
    contentInset: 'automatic',
    backgroundColor: '#F5EFE0',
  },
  // Android-specific settings
  android: {
    backgroundColor: '#F5EFE0',
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
      backgroundColor: '#F5EFE0',
      showSpinner: false,
    },
    // Status bar config
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#F5EFE0',
    },
  },
};

export default config;
