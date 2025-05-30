import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { useAuth } from '../store/AuthContext';
import * as Network from 'expo-network';
import supabase from '../services/supabase';
import { LOADING_MESSAGES } from '../constants/loadingMessages';
import exerciseService from '../services/exerciseService';
import logger from '../utils/logger';

// Define storage bucket constants for compatibility with previous code
export const STORAGE_BUCKETS = {
  PROGRESS_PHOTOS: 'progress-photos',
  PLANS: 'plans',
  EXERCISES: 'exercises',
};

// Define interfaces for file metadata
export interface StorageFile {
  name: string;
  id: string;
  metadata?: Record<string, unknown>;
}

// Define static images to preload (moved from imagePreloader.ts)
export const STATIC_IMAGES = {
  measurements: {
    weight: require('../../assets/measurements/instructions/weight-instruction.png'),
    biceps: require('../../assets/measurements/instructions/biceps-instruction.png'),
    chest: require('../../assets/measurements/instructions/chest-instruction.png'),
    waist: require('../../assets/measurements/instructions/waist-instruction.png'),
    abs: require('../../assets/measurements/instructions/abs-instruction.png'),
    shoulders: require('../../assets/measurements/instructions/shoulders-instruction.png'),
    thigh: require('../../assets/measurements/instructions/thigh-instruction.png'),
    calf: require('../../assets/measurements/instructions/calf-instruction.png'),
  },
  bodyModel: {
    front: require('../../assets/body-model_front.png'),
    back: require('../../assets/body-model_back.png'),
  },
  placeholders: {
    exercise: require('../../assets/exercises/placeholder.jpg'),
  },
};

// Debug flag to control logging
const DEBUG_SPLASH_SCREEN = __DEV__ && false;

// Define resources to be preloaded, organized by priority
const PRELOAD_CONFIG = {
  BATCH_SIZE: 5,
  TIMEOUT: {
    STATIC_ASSETS: 3000, // 3 seconds max for static assets
    REMOTE_IMAGES: 5000, // 5 seconds max for remote images
    DATA: 3000, // 3 seconds max for data loading
    USER_DATA: 3000, // 3 seconds max for user data
    TOTAL: 15000, // 15 seconds total maximum
  },
};

// Define types for global cache
interface ExercisesCache {
  all: unknown[];
  lastUpdated: number;
}

interface UserFavoritesCache {
  favoriteExerciseIds: string[];
  lastUpdated: number;
}

interface GlobalCache {
  exercisesCache?: ExercisesCache;
  userFavoritesCache?: UserFavoritesCache;
}

// Safely attempt to prevent auto-hide with error handling
const safelyPreventAutoHide = async (): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      if (typeof SplashScreen.preventAutoHideAsync === 'function') {
        await SplashScreen.preventAutoHideAsync();
        logger.debugComponent('SPLASH_SCREEN', 'preventAutoHideAsync called successfully');
      } else {
        logger.warn('SplashScreen.preventAutoHideAsync is not a function');
      }
    }
  } catch (error) {
    logger.warn('Error with splash screen prevention:', { context: { error: String(error) } });
  }
};

// Safely attempt to hide with error handling
const safelyHideSplashScreen = async (): Promise<void> => {
  try {
    if (Platform.OS !== 'web') {
      if (typeof SplashScreen.hideAsync === 'function') {
        await SplashScreen.hideAsync();
        logger.debugComponent('SPLASH_SCREEN', 'hideAsync called successfully');
      } else {
        logger.warn('SplashScreen.hideAsync is not a function');
      }
    }
  } catch (error) {
    logger.warn('Error hiding splash screen:', { context: { error: String(error) } });
  }
};

// Execute once on module load
if (Platform.OS !== 'web') {
  safelyPreventAutoHide().catch((err) => {
    console.warn('Initial splash screen setup failed:', err);
  });
}

export default function SplashScreenManager({ children }: { children: React.ReactNode }) {
  const [appReady, setAppReady] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES.START);
  const isMounted = useRef(true);
  const { user } = useAuth();
  const totalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (DEBUG_SPLASH_SCREEN)
      console.log('🚀 SplashScreenManager component mounting - initial render');

    // Prevent auto-hide on component mount
    safelyPreventAutoHide();

    // Set up total timeout as a safety net
    totalTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        console.warn('⚠️ SplashScreenManager: Total timeout reached, forcing app to load');
        finishLoading();
      }
    }, PRELOAD_CONFIG.TIMEOUT.TOTAL);

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    const initSplashScreen = async () => {
      try {
        await prepare();
      } catch (e) {
        console.error('Error in splash screen setup:', e);
      } finally {
        // Regardless of errors, we need to finish loading
        if (isMounted.current) {
          finishLoading();
        }
      }
    };

    initSplashScreen();

    return () => {
      isMounted.current = false;
      subscription.remove();
      if (totalTimeoutRef.current) {
        clearTimeout(totalTimeoutRef.current);
      }
    };
  }, []);

  // Handle background/foreground transitions
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (networkState.isConnected && networkState.isInternetReachable) {
          // Refresh essential data in background when app comes to foreground
          await refreshEssentialData();
        }
      } catch (error) {
        console.warn('Failed to check network state:', error);
      }
    }
  };

  // Track loading progress with enhanced logging
  const updateProgress = (value: number, message?: string, source?: string) => {
    if (!isMounted.current) return;

    setProgress((prev) => {
      const newProgress = Math.min(prev + value, 0.95);

      if (DEBUG_SPLASH_SCREEN) {
        const percentComplete = (newProgress * 100).toFixed(1);
        console.log(
          `⏱️ [SplashScreenManager] Progress update: ${percentComplete}% (added ${(value * 100).toFixed(1)}%)${source ? ` from ${source}` : ''}`,
        );
      }
      return newProgress;
    });

    if (message) {
      setLoadingMessage(message);
      if (DEBUG_SPLASH_SCREEN) {
        console.log(`🔤 [SplashScreenManager] Message update: "${message}"`);
      }
    }
  };

  // Simplified static image preloading
  const preloadStaticImages = async (): Promise<boolean> => {
    try {
      updateProgress(0.1, LOADING_MESSAGES.STATIC_ASSETS, 'staticAssets');
      // Add any critical static assets here
      return true;
    } catch (error) {
      console.warn('Error preloading static images:', error);
      return false;
    }
  };

  // Simplified data loading
  const preloadApplicationData = async (): Promise<boolean> => {
    try {
      updateProgress(0.2, LOADING_MESSAGES.CONTENT, 'data');

      // Load essential app data with timeout
      const exercisesPromise = exerciseService.getAllExercises().catch((err) => {
        console.warn('Failed to load exercises:', err);
        return [];
      });

      const exercises = await Promise.race([
        exercisesPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Data loading timeout')), PRELOAD_CONFIG.TIMEOUT.DATA),
        ),
      ]);

      // Store in global cache for immediate access
      (global as GlobalCache).exercisesCache = {
        all: Array.isArray(exercises) ? exercises : [],
        lastUpdated: Date.now(),
      };

      if (DEBUG_SPLASH_SCREEN) {
        console.log(
          `📊 Preloaded ${Array.isArray(exercises) ? exercises.length : 0} total exercises`,
        );
      }

      return true;
    } catch (error) {
      console.warn('Error in preloadApplicationData:', error);
      return false;
    }
  };

  // Simplified user data loading
  const preloadUserData = async (userId: string): Promise<boolean> => {
    try {
      updateProgress(0.1, LOADING_MESSAGES.USER_CONTENT, 'userData');

      // Load user-specific data with timeout
      const userDataPromise = (async () => {
        try {
          const { data: favoriteExercises } = await supabase
            .from('user_favorite_exercises')
            .select('exercise_id')
            .eq('user_id', userId);

          if (favoriteExercises) {
            (global as GlobalCache).userFavoritesCache = {
              favoriteExerciseIds: favoriteExercises.map(
                (fav: { exercise_id: string }) => fav.exercise_id,
              ),
              lastUpdated: Date.now(),
            };
          }
        } catch (error) {
          console.warn('Error loading user favorites:', error);
        }
      })();

      await Promise.race([
        userDataPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('User data timeout')),
            PRELOAD_CONFIG.TIMEOUT.USER_DATA,
          ),
        ),
      ]);

      return true;
    } catch (error) {
      console.warn('Error preloading user data:', error);
      return false;
    }
  };

  // Refresh essential data when app comes to foreground
  const refreshEssentialData = async (): Promise<void> => {
    if (DEBUG_SPLASH_SCREEN) {
      console.log(`🔄 [SplashScreenManager] Refreshing essential data in background`);
    }
    try {
      // This runs silently in the background without UI updates
      await preloadApplicationData();
      if (DEBUG_SPLASH_SCREEN) {
        console.log(`✅ [SplashScreenManager] Refreshed essential data silently in background`);
      }
    } catch (error) {
      // Don't show errors to user for background refreshes
      console.warn('Background refresh failed:', error);
    }
  };

  // Phase 1: Preload static assets
  const executePhase1 = async (): Promise<void> => {
    if (DEBUG_SPLASH_SCREEN) {
      console.log('📦 [SplashScreenManager] Phase 1: Preloading static assets...');
    }
    try {
      await Promise.race([
        preloadStaticImages(),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('Static assets timeout')),
            PRELOAD_CONFIG.TIMEOUT.STATIC_ASSETS,
          ),
        ),
      ]);
      if (DEBUG_SPLASH_SCREEN) {
        console.log('✅ [SplashScreenManager] Phase 1 completed');
      }
    } catch (err) {
      console.warn('⚠️ [SplashScreenManager] Phase 1 timed out:', err);
      updateProgress(0.1, LOADING_MESSAGES.CONTENT, 'staticAssetsFallback');
    }
  };

  // Phase 2: Preload data
  const executePhase2 = async (): Promise<void> => {
    if (DEBUG_SPLASH_SCREEN) {
      console.log('📊 [SplashScreenManager] Phase 2: Preloading data...');
    }
    try {
      await Promise.race([
        preloadApplicationData(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Data loading timeout')), PRELOAD_CONFIG.TIMEOUT.DATA),
        ),
      ]);
      if (DEBUG_SPLASH_SCREEN) {
        console.log('✅ [SplashScreenManager] Phase 2 completed');
      }
    } catch (err) {
      console.warn('⚠️ [SplashScreenManager] Phase 2 timed out:', err);
      updateProgress(0.2, LOADING_MESSAGES.AUTHENTICATED, 'dataFallback');
    }
  };

  // Phase 3: Load user-specific content if signed in
  const executePhase3 = async (): Promise<void> => {
    if (user) {
      if (DEBUG_SPLASH_SCREEN) {
        console.log('👤 [SplashScreenManager] Phase 3: Preloading user data...');
      }
      try {
        await Promise.race([
          preloadUserData(user.id),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('User data timeout')),
              PRELOAD_CONFIG.TIMEOUT.USER_DATA,
            ),
          ),
        ]);
        if (DEBUG_SPLASH_SCREEN) {
          console.log('✅ [SplashScreenManager] Phase 3 completed');
        }
      } catch (err) {
        console.warn('⚠️ [SplashScreenManager] Phase 3 timed out:', err);
        updateProgress(0.1, LOADING_MESSAGES.AUTHENTICATED, 'userDataFallback');
      }
    } else {
      if (DEBUG_SPLASH_SCREEN) {
        console.log('👤 [SplashScreenManager] No user, skipping Phase 3');
      }
    }
  };

  // Simplified prepare function with reduced complexity
  const prepare = async (): Promise<void> => {
    try {
      if (DEBUG_SPLASH_SCREEN) {
        console.log(
          '🚀 [SplashScreenManager] Starting app preparation at',
          new Date().toISOString(),
        );
      }

      // Give a small delay to ensure splash screen is displayed
      if (DEBUG_SPLASH_SCREEN) {
        console.log('⏳ [SplashScreenManager] Initial delay...');
      }
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Try to hide the native splash screen to show our custom loading screen
      if (Platform.OS !== 'web') {
        try {
          if (typeof SplashScreen.hideAsync === 'function') {
            if (DEBUG_SPLASH_SCREEN) {
              console.log('🎭 [SplashScreenManager] Hiding native splash screen...');
            }
            await SplashScreen.hideAsync();
            if (DEBUG_SPLASH_SCREEN) {
              console.log('✅ [SplashScreenManager] Native splash screen hidden');
            }
          }
        } catch (splashError) {
          console.warn('❌ [SplashScreenManager] Error hiding native splash screen:', splashError);
        }
      }

      // Execute phases sequentially
      await executePhase1();
      await executePhase2();
      await executePhase3();

      // Complete progress
      if (DEBUG_SPLASH_SCREEN) {
        console.log('🎯 [SplashScreenManager] Completing progress...');
      }
      updateProgress(0.6, LOADING_MESSAGES.COMPLETE, 'finalization');

      if (DEBUG_SPLASH_SCREEN) {
        console.log('🏁 [SplashScreenManager] App preparation completed successfully');
      }
    } catch (e) {
      console.error('❌ [SplashScreenManager] Error preparing app:', e);
    }
  };

  const finishLoading = () => {
    if (!isMounted.current) {
      if (DEBUG_SPLASH_SCREEN) {
        console.log('🚫 [SplashScreenManager] finishLoading called but component not mounted');
      }
      return;
    }

    if (DEBUG_SPLASH_SCREEN) {
      console.log('🏁 [SplashScreenManager] finishLoading called - starting finish process');
    }

    // Clear the total timeout
    if (totalTimeoutRef.current) {
      clearTimeout(totalTimeoutRef.current);
      totalTimeoutRef.current = null;
      if (DEBUG_SPLASH_SCREEN) {
        console.log('⏰ [SplashScreenManager] Total timeout cleared');
      }
    }

    // Set as ready and hide splash screen
    if (DEBUG_SPLASH_SCREEN) {
      console.log('✅ [SplashScreenManager] Setting appReady to true');
    }
    setAppReady(true);
    setProgress(1);

    // Add a small delay to show completion, then hide splash
    setTimeout(() => {
      if (isMounted.current) {
        if (DEBUG_SPLASH_SCREEN) {
          console.log('🎭 [SplashScreenManager] Hiding splash screen');
        }
        setShowSplash(false);
        setTimeout(() => {
          if (DEBUG_SPLASH_SCREEN) {
            console.log('🔚 [SplashScreenManager] Calling safelyHideSplashScreen');
          }
          safelyHideSplashScreen();
        }, 100);
      } else {
        if (DEBUG_SPLASH_SCREEN) {
          console.log('🚫 [SplashScreenManager] Component unmounted during finish sequence');
        }
      }
    }, 500);
  };

  const onFinishLoading = () => {
    if (DEBUG_SPLASH_SCREEN) {
      console.log(`🏁 [SplashScreenManager] Loading finished, hiding splash screen`);
    }
    setShowSplash(false);
  };

  // Render the app with loading screen when needed
  if (!appReady || showSplash) {
    if (DEBUG_SPLASH_SCREEN) {
      console.log(
        'Rendering InitialLoadingScreen with progress:',
        progress,
        'and message:',
        loadingMessage,
      );
    }
    return (
      <InitialLoadingScreen
        progressValue={progress}
        message={loadingMessage}
        onFinish={onFinishLoading}
        showProgress={true}
      />
    );
  }

  return <>{children}</>;
}
