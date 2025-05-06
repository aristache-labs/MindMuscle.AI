import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { preloadAllImages, preloadCategories } from '../utils/imagePreloader';
import { useAuth } from '../store/AuthContext';
import useImagePreloader from '../hooks/useImagePreloader';

// Safely attempt to prevent auto-hide with error handling
const safelyPreventAutoHide = async () => {
  try {
    // Only attempt this on real devices, not in Expo Go
    if (Platform.OS !== 'web') {
      // Use a try-catch with direct method check to avoid undefined errors
      if (typeof SplashScreen.preventAutoHideAsync === 'function') {
        await SplashScreen.preventAutoHideAsync();
      } else {
        console.warn('SplashScreen.preventAutoHideAsync is not a function');
      }
    }
  } catch (error) {
    console.warn('Error with splash screen prevention:', error);
    // Continue execution regardless of error
  }
};

// Safely attempt to hide with error handling
const safelyHideSplashScreen = async () => {
  try {
    // Only attempt this on real devices, not in Expo Go
    if (Platform.OS !== 'web') {
      // Use a try-catch with direct method check to avoid undefined errors
      if (typeof SplashScreen.hideAsync === 'function') {
        await SplashScreen.hideAsync();
      } else {
        console.warn('SplashScreen.hideAsync is not a function');
      }
    }
  } catch (error) {
    console.warn('Error hiding splash screen:', error);
    // Continue execution regardless of error
  }
};

// Execute once on module load
if (Platform.OS !== 'web') {
  safelyPreventAutoHide().catch(err => {
    console.warn('Initial splash screen setup failed:', err);
  });
}

export default function SplashScreenManager({ children }: { children: React.ReactNode }) {
  const [isAppReady, setIsAppReady] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const { session } = useAuth();
  
  // Handle background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
  
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      // Refresh image cache when coming back to the foreground
      preloadCategories().catch(console.error);
    }
  };

  // Track loading progress
  const updateProgress = (value: number) => {
    setLoadingProgress((prev) => {
      // Add small increments, but ensure total progress never exceeds 1
      const newProgress = Math.min(prev + value, 0.95);
      return newProgress;
    });
  };

  // Preload app resources on initial load
  useEffect(() => {
    async function prepare() {
      try {
        console.log('🚀 Preparing app resources...');
        
        // Start with some initial progress
        setLoadingProgress(0.05);
        
        // Preload static images first (40% of progress)
        try {
          await Promise.race([
            new Promise((_, reject) => setTimeout(() => reject(new Error('Static image preloading timeout')), 5000)),
            (async () => {
              await preloadAllImages();
              updateProgress(0.4);
            })()
          ]);
        } catch (e) {
          console.warn('Static image preloading timed out, continuing anyway:', e);
          updateProgress(0.4); // Still increment progress even on timeout
        }
        
        // Mark loading as almost complete
        setLoadingProgress(0.95);
        
        // Small delay to ensure UI is responsive
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Mark loading as complete after small delay
        setLoadingProgress(1);
      } catch (e) {
        console.warn('Error preloading resources:', e);
        setLoadingProgress(1); // Go to 100% on error so we don't get stuck
      } finally {
        // Mark the app as ready
        setIsAppReady(true);
        
        // Safely hide the native splash screen
        await safelyHideSplashScreen();
      }
    }

    prepare();
  }, []);

  // Hide the loading screen when app is ready
  const onFinishLoading = () => {
    setShowLoadingScreen(false);
  };

  if (!isAppReady) {
    return null;
  }

  return (
    <>
      {showLoadingScreen ? (
        <InitialLoadingScreen 
          onFinish={onFinishLoading}
          message={session ? "Preparing your workout experience..." : "Welcome to MindMuscle.AI"}
          duration={5000} // Shorter duration since we've already preloaded assets
          progressValue={loadingProgress}
        />
      ) : (
        children
      )}
    </>
  );
} 