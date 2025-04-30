import { useEffect, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import { Slot } from 'expo-router';
import { useFonts } from 'expo-font';
import { ThemeProvider } from './constants/theme';
import { AuthProvider } from './store/AuthContext';
import { ProfileProvider } from './store/ProfileContext';
import { ProgressProvider } from './store/ProgressContext';
import { GamificationProvider } from './store/GamificationContext';
import { ProgressPhotosProvider } from './store/ProgressPhotosContext';
import InitialLoadingScreen from './components/InitialLoadingScreen';
import AuthGuard from './components/AuthGuard';
import * as SplashScreen from 'expo-splash-screen';
import { preloadStaticImages } from './utils/imagePreloader';
import * as Sentry from '@sentry/react-native';
import { initializeSentry } from './services/sentry';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { MeasurementsProvider } from './store/MeasurementsContext';

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

// Prevent the splash screen from auto-hiding until we're ready
try {
  SplashScreen.preventAutoHideAsync().catch(e => {
    console.warn('Error preventing splash screen auto-hide:', e);
    // Proceed normally even if this fails
  });
} catch (e) {
  console.warn('Failed to call preventAutoHideAsync:', e);
}

// Initialize Sentry as early as possible
initializeSentry();

function RootLayout() {
  const colorScheme = useColorScheme();
  const [isImagesLoaded, setImagesLoaded] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);
  const [showInitialLoading, setShowInitialLoading] = useState(true);
  
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  useEffect(() => {
    async function prepare() {
      try {
        await Promise.all([
          new Promise((resolve) => {
            if (fontsLoaded) {
              resolve(true);
            }
          }),
          (async () => {
            try {
              await preloadStaticImages();
              setImagesLoaded(true);
            } catch (e) {
              console.warn('Failed to preload images:', e);
              setImagesLoaded(true);
            }
          })()
        ]);
      } catch (e) {
        console.warn('Error preparing app:', e);
        Sentry.captureException(e);
      } finally {
        setAppIsReady(true);
        
        // Safely hide splash screen
        try {
          await SplashScreen.hideAsync();
        } catch (e) {
          console.warn('Error hiding splash screen:', e);
          // Proceed even if hiding fails
        }
      }
    }

    prepare();
  }, [fontsLoaded]);

  const onInitialLoadingFinish = useCallback(() => {
    setShowInitialLoading(false);
  }, []);

  if (!appIsReady || showInitialLoading) {
    return (
      <InitialLoadingScreen
        onFinish={onInitialLoadingFinish}
        duration={3000}
        showProgress={true}
      />
    );
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <MeasurementsProvider>
          <ProfileProvider>
            <ProgressProvider>
              <GamificationProvider>
                <ProgressPhotosProvider>
                  <AuthGuard>
                    <Slot />
                  </AuthGuard>
                </ProgressPhotosProvider>
              </GamificationProvider>
            </ProgressProvider>
          </ProfileProvider>
        </MeasurementsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default Sentry.wrap(RootLayout); 