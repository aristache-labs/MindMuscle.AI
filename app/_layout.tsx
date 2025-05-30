// Initialize polyfills first
import './utils/polyfills';

import React from 'react';
import { useColorScheme, Platform } from 'react-native';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { ThemeProvider } from './constants/theme';
import { AuthProvider } from './store/AuthContext';
import { ProfileProvider } from './store/ProfileContext';
import AuthGuard from './components/AuthGuard';
import * as Sentry from '@sentry/react-native';
import { initializeSentry } from './services/sentry';
import { MeasurementsProvider } from './store/MeasurementsContext';
import SplashScreenManager from './components/SplashScreenManager';
import { QueryProvider } from './components/QueryProvider';
import { SafeAreaProvider } from 'react-native-safe-area-context';


// Initialize Sentry as early as possible
initializeSentry();

// Root component wrapped in SafeAreaProvider
const RootApp = () => {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  // Wait for fonts to load
  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryProvider>
        <ThemeProvider>
          <AuthProvider>
            <MeasurementsProvider>
              <ProfileProvider>
                    <SplashScreenManager>
                      <AuthGuard>
                        <Slot />
                      </AuthGuard>
                    </SplashScreenManager>
              </ProfileProvider>
            </MeasurementsProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </SafeAreaProvider>
  );
};

// Use React.memo for the layout component to ensure consistent static flags
const RootLayout = React.memo(RootApp);

export default Sentry.wrap(RootLayout); 