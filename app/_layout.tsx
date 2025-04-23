import { useEffect, useState, useCallback } from 'react';
import { useColorScheme, View } from 'react-native';
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
import { GlobalGestureHandler } from './components/GlobalGestureHandler';
import * as SplashScreen from 'expo-splash-screen';
import { preloadStaticImages } from './utils/imagePreloader';
import * as Sentry from '@sentry/react-native';
import { initializeSentry } from './services/sentry';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Handle splash screen errors in Expo Go
if (Constants.appOwnership === 'expo') {
  try {
    // Direct patching of the SplashModule that expo-router tries to access
    // This prevents the unhandled rejections in Expo Go
    const globalAny = global as any;
    
    // First try native module global path (used by expo-router)
    if (!globalAny.SplashModule) {
      globalAny.SplashModule = {
        internalPreventAutoHideAsync: () => Promise.resolve(true),
        internalMaybeHideAsync: () => Promise.resolve(true)
      };
    }

    // Also patch the NativeModules.SplashScreen path for older code
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      const ReactNative = require('react-native');
      if (!ReactNative.NativeModules.SplashScreen) {
        ReactNative.NativeModules.SplashScreen = {
          preventAutoHide: () => {},
          hide: () => {}
        };
      }
    }

    console.log('Splash screen modules patched for Expo Go');
  } catch (e) {
    console.warn('Failed to patch splash screen modules:', e);
  }
}

// Prevent the splash screen from auto-hiding until we're ready
SplashScreen.preventAutoHideAsync().catch(e => {
  console.warn('Error preventing splash screen auto-hide:', e);
});

// Initialize Sentry as early as possible
initializeSentry();

function RootLayout() {
  const colorScheme = useColorScheme();
  const [isImagesLoaded, setImagesLoaded] = useState(false);
  const [appIsReady, setAppIsReady] = useState(false);
  
  const [fontsLoaded] = useFonts({
    // Add any custom fonts here if needed
  });

  useEffect(() => {
    async function prepare() {
      try {
        // Load fonts and images in parallel
        await Promise.all([
          new Promise((resolve) => {
            // Monitor font loading
            if (fontsLoaded) resolve(true);
          }),
          (async () => {
            try {
              await preloadStaticImages();
              setImagesLoaded(true);
            } catch (e) {
              console.warn('Failed to preload images:', e);
              // We still continue if image loading fails
              setImagesLoaded(true);
            }
          })()
        ]);
      } catch (e) {
        console.warn('Error preparing app:', e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, [fontsLoaded]);

  useEffect(() => {
    if (appIsReady) {
      // Once everything is ready, hide the splash screen
      SplashScreen.hideAsync().catch(e => {
        console.warn('Error hiding splash screen:', e);
      });
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return <InitialLoadingScreen showProgress={false} message="Loading resources..." />;
  }

  return (
    <GlobalGestureHandler>
      <ThemeProvider>
        <AuthProvider>
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
        </AuthProvider>
      </ThemeProvider>
    </GlobalGestureHandler>
  );
}

// Export with Sentry.wrap
export default Sentry.wrap(RootLayout); 