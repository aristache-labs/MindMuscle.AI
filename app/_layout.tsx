import { useEffect, useState } from 'react';
import { useColorScheme, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { ThemeProvider } from './constants/theme';
import { AuthProvider } from './store/AuthContext';
import { ProfileProvider } from './store/ProfileContext';
import { ProgressProvider } from './store/ProgressContext';
import { GamificationProvider } from './store/GamificationContext';
import AuthGuard from './components/AuthGuard';
import * as Sentry from '@sentry/react-native';
import { initializeSentry } from './services/sentry';
import Constants from 'expo-constants';
import { MeasurementsProvider } from './store/MeasurementsContext';
import SplashScreenManager from './components/SplashScreenManager';
import * as SplashScreen from 'expo-splash-screen';
import { QueryProvider } from './components/QueryProvider';

// Initialize SplashScreen as early as possible
try {
  // Only try to initialize on real devices
  if (Platform.OS !== 'web' && Constants.appOwnership !== 'expo') {
    SplashScreen.preventAutoHideAsync().catch(err => {
      console.log('SplashScreen initialization error (non-critical):', err);
    });
  }
} catch (error) {
  console.warn('SplashScreen API not available:', error);
}

// Handle splash screen errors in Expo Go
if (Constants.appOwnership === 'expo') {
  try {
    // Don't try to modify NativeModules directly as it can cause conflicts
    // Instead, we'll handle errors from SplashScreen methods when they occur
    console.log('Running in Expo Go environment');
  } catch (e) {
    console.warn('Error in Expo Go environment setup:', e);
  }
}

// Initialize Sentry as early as possible
initializeSentry();

function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  // Wait for fonts to load
  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryProvider>
      <ThemeProvider>
        <AuthProvider>
          <MeasurementsProvider>
            <ProfileProvider>
              <ProgressProvider>
                <GamificationProvider>
                    <SplashScreenManager>
                      <AuthGuard>
                        <Slot />
                      </AuthGuard>
                    </SplashScreenManager>
                </GamificationProvider>
              </ProgressProvider>
            </ProfileProvider>
          </MeasurementsProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryProvider>
  );
}

export default Sentry.wrap(RootLayout); 