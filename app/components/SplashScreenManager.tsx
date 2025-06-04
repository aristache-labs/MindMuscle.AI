import * as Network from 'expo-network';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { LOADING_MESSAGES } from '../constants/loadingMessages';
import exerciseService from '../services/exerciseService';
import {
  addBreadcrumb,
  captureError,
  captureMessage,
  capturePerformanceError,
} from '../services/sentry/simpleErrorHandler';
import supabase from '../services/supabase';
import { useAuth } from '../store/AuthContext';
import { safeAsyncFireAndForget } from '../utils/asyncErrorHandler';
import logger from '../utils/logger';
import InitialLoadingScreen from './InitialLoadingScreen';

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
const DEBUG_SPLASH_SCREEN = process.env.NODE_ENV === 'development' && false;

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

// Track splash screen state to prevent multiple operations
const splashScreenState = {
  isShown: false,
  isHidden: false,
  preventAutoHideCalled: false,
};

// Safely attempt to prevent auto-hide with error handling
const safelyPreventAutoHide = async (): Promise<void> => {
  try {
    addBreadcrumb('Attempting to prevent splash screen auto-hide', 'splash.prevent', {
      platform: Platform.OS,
      alreadyCalled: splashScreenState.preventAutoHideCalled,
      timestamp: new Date().toISOString(),
    });

    // Skip splash screen management in web or if running in Expo Go
    if (Platform.OS === 'web') {
      logger.debugComponent('SPLASH_SCREEN', 'Skipping splash screen on web platform');
      addBreadcrumb('Skipped splash screen on web platform', 'splash.prevent');
      return;
    }

    // Check if already called
    if (splashScreenState.preventAutoHideCalled) {
      logger.debugComponent('SPLASH_SCREEN', 'preventAutoHideAsync already called, skipping');
      addBreadcrumb('preventAutoHideAsync already called', 'splash.prevent');
      return;
    }

    // Check if we're running in Expo Go (development)
    const isExpoGo = typeof SplashScreen?.preventAutoHideAsync !== 'function';

    if (isExpoGo) {
      logger.debugComponent(
        'SPLASH_SCREEN',
        'Running in Expo Go - splash screen management limited',
      );
      addBreadcrumb('Running in Expo Go - limited splash screen management', 'splash.prevent');
      return;
    }

    if (typeof SplashScreen.preventAutoHideAsync === 'function') {
      await SplashScreen.preventAutoHideAsync();
      splashScreenState.preventAutoHideCalled = true;
      splashScreenState.isShown = true;
      logger.debugComponent('SPLASH_SCREEN', 'preventAutoHideAsync called successfully');
      addBreadcrumb('Splash screen auto-hide prevented successfully', 'splash.prevent');
    } else {
      const errorMessage = 'SplashScreen.preventAutoHideAsync is not available';
      logger.warn(errorMessage);
      captureMessage(errorMessage, 'warning', {
        category: 'ui_error',
        component: 'SplashScreenManager',
        action: 'safelyPreventAutoHide',
      });
    }
  } catch (error) {
    logger.warn('Error with splash screen prevention:', { context: { error: String(error) } });
    captureError(error as Error, {
      category: 'ui_error',
      component: 'SplashScreenManager',
      action: 'safelyPreventAutoHide',
      platform: Platform.OS,
    });
  }
};

// Safely attempt to hide with error handling
const safelyHideSplashScreen = async (): Promise<void> => {
  try {
    addBreadcrumb('Attempting to hide splash screen', 'splash.hide', {
      platform: Platform.OS,
      isHidden: splashScreenState.isHidden,
      isShown: splashScreenState.isShown,
      timestamp: new Date().toISOString(),
    });

    // Skip splash screen management in web or if running in Expo Go
    if (Platform.OS === 'web') {
      logger.debugComponent('SPLASH_SCREEN', 'Skipping splash screen hide on web platform');
      addBreadcrumb('Skipped splash screen hide on web platform', 'splash.hide');
      return;
    }

    // Check if already hidden or never shown
    if (splashScreenState.isHidden || !splashScreenState.isShown) {
      logger.debugComponent(
        'SPLASH_SCREEN',
        'Splash screen already hidden or never shown, skipping',
      );
      addBreadcrumb('Splash screen already hidden or never shown', 'splash.hide');
      return;
    }

    // Check if we're running in Expo Go (development)
    const isExpoGo = typeof SplashScreen?.hideAsync !== 'function';

    if (isExpoGo) {
      logger.debugComponent('SPLASH_SCREEN', 'Running in Expo Go - splash screen hide limited');
      addBreadcrumb('Running in Expo Go - limited splash screen hide', 'splash.hide');
      return;
    }

    if (typeof SplashScreen.hideAsync === 'function') {
      await SplashScreen.hideAsync();
      splashScreenState.isHidden = true;
      logger.debugComponent('SPLASH_SCREEN', 'hideAsync called successfully');
      addBreadcrumb('Splash screen hidden successfully', 'splash.hide');
    } else {
      const errorMessage = 'SplashScreen.hideAsync is not available';
      logger.warn(errorMessage);
      captureMessage(errorMessage, 'warning', {
        category: 'ui_error',
        component: 'SplashScreenManager',
        action: 'safelyHideSplashScreen',
      });
    }
  } catch (error) {
    logger.warn('Error hiding splash screen:', { context: { error: String(error) } });
    captureError(error as Error, {
      category: 'ui_error',
      component: 'SplashScreenManager',
      action: 'safelyHideSplashScreen',
      platform: Platform.OS,
    });
  }
};

// Execute once on module load - only in production builds
if (Platform.OS !== 'web' && typeof SplashScreen?.preventAutoHideAsync === 'function') {
  // Add a small delay to ensure the native module is fully initialized
  setTimeout(() => {
    safeAsyncFireAndForget(() => safelyPreventAutoHide(), {
      errorPrefix: 'Initial splash screen setup failed',
      context: { location: 'module_load' },
    });
  }, 100);
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
    addBreadcrumb('SplashScreenManager component mounting', 'component.lifecycle', {
      hasUser: !!user,
      platform: Platform.OS,
      timestamp: new Date().toISOString(),
    });

    if (DEBUG_SPLASH_SCREEN)
      console.log('🚀 SplashScreenManager component mounting - initial render');

    // Prevent auto-hide on component mount with better error handling
    // Add a small delay to ensure proper initialization order
    setTimeout(() => {
      safeAsyncFireAndForget(() => safelyPreventAutoHide(), {
        errorPrefix: 'Component mount splash screen setup failed',
        context: { location: 'component_mount' },
      });
    }, 50);

    // Set up total timeout as a safety net
    totalTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) {
        console.warn('⚠️ SplashScreenManager: Total timeout reached, forcing app to load');
        capturePerformanceError(
          'SplashScreen total timeout reached',
          'load_time',
          PRELOAD_CONFIG.TIMEOUT.TOTAL,
        );
        addBreadcrumb('Total timeout reached, forcing app to load', 'splash.timeout');
        finishLoading();
      }
    }, PRELOAD_CONFIG.TIMEOUT.TOTAL);

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Initialize splash screen with comprehensive error handling
    const initSplashScreen = async () => {
      const startTime = Date.now();
      try {
        addBreadcrumb('Starting splash screen initialization', 'splash.init');
        await prepare();
        const loadTime = Date.now() - startTime;
        addBreadcrumb('Splash screen initialization completed', 'splash.init', {
          loadTimeMs: loadTime,
        });
      } catch (e) {
        const loadTime = Date.now() - startTime;
        console.error('Error in splash screen setup:', e);
        captureError(e instanceof Error ? e : new Error(String(e)), {
          category: 'ui_error',
          component: 'SplashScreenManager',
          action: 'initSplashScreen',
          loadTimeMs: loadTime,
        });

        // Log to Sentry if available, but don't let it crash the app
        try {
          if (typeof logger?.error === 'function') {
            logger.error(
              'SplashScreen initialization failed',
              e instanceof Error ? e : new Error(String(e)),
            );
          }
        } catch (logError) {
          console.warn('Failed to log splash screen error:', logError);
          captureError(logError as Error, {
            category: 'ui_error',
            component: 'SplashScreenManager',
            action: 'logger.error',
          });
        }
      } finally {
        // Regardless of errors, we need to finish loading
        if (isMounted.current) {
          finishLoading();
        }
      }
    };

    // Use safeAsyncFireAndForget to prevent unhandled promise rejections
    safeAsyncFireAndForget(() => initSplashScreen(), {
      errorPrefix: 'SplashScreen initialization failed',
      context: { location: 'useEffect_init' },
    });

    return () => {
      addBreadcrumb('SplashScreenManager component unmounting', 'component.lifecycle');
      isMounted.current = false;
      subscription.remove();
      if (totalTimeoutRef.current) {
        clearTimeout(totalTimeoutRef.current);
      }
    };
  }, []);

  // Handle background/foreground transitions
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    addBreadcrumb('App state changed', 'app.state', {
      newState: nextAppState,
      timestamp: new Date().toISOString(),
    });

    if (nextAppState === 'active') {
      try {
        const networkState = await Network.getNetworkStateAsync();
        addBreadcrumb('Network state checked', 'network.check', {
          isConnected: networkState.isConnected,
          isInternetReachable: networkState.isInternetReachable,
          type: networkState.type,
        });

        if (networkState.isConnected && networkState.isInternetReachable) {
          // Refresh essential data in background when app comes to foreground
          await refreshEssentialData();
        } else {
          addBreadcrumb('Skipping data refresh - no internet connection', 'data.refresh');
        }
      } catch (error) {
        console.warn('Failed to check network state:', error);
        captureError(error as Error, {
          category: 'network_error',
          component: 'SplashScreenManager',
          action: 'handleAppStateChange',
          appState: nextAppState,
        });
      }
    }
  };

  // Track loading progress with enhanced logging
  const updateProgress = (value: number, message?: string, source?: string) => {
    if (!isMounted.current) return;

    setProgress((prev) => {
      const newProgress = Math.min(prev + value, 0.95);

      addBreadcrumb('Loading progress updated', 'splash.progress', {
        previousProgress: prev,
        addedValue: value,
        newProgress,
        percentComplete: (newProgress * 100).toFixed(1),
        source: source || 'unknown',
        message: message || 'no message',
      });

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
    const startTime = Date.now();
    try {
      addBreadcrumb('Starting static images preload', 'assets.preload', {
        totalImages: Object.keys(STATIC_IMAGES).length,
      });

      updateProgress(0.1, LOADING_MESSAGES.STATIC_ASSETS, 'staticAssets');
      // Add any critical static assets here

      const loadTime = Date.now() - startTime;
      addBreadcrumb('Static images preloaded successfully', 'assets.preload', {
        loadTimeMs: loadTime,
        success: true,
      });
      return true;
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.warn('Error preloading static images:', error);
      captureError(error as Error, {
        category: 'performance_error',
        component: 'SplashScreenManager',
        action: 'preloadStaticImages',
        loadTimeMs: loadTime,
      });
      return false;
    }
  };

  // Simplified data loading
  const preloadApplicationData = async (): Promise<boolean> => {
    const startTime = Date.now();
    try {
      addBreadcrumb('Starting application data preload', 'data.preload', {
        timeout: PRELOAD_CONFIG.TIMEOUT.DATA,
      });

      updateProgress(0.2, LOADING_MESSAGES.CONTENT, 'data');

      // Load essential app data with timeout
      const exercisesPromise = exerciseService.getAllExercises().catch((err) => {
        console.warn('Failed to load exercises:', err);
        captureError(err as Error, {
          category: 'database_error',
          component: 'SplashScreenManager',
          action: 'getAllExercises',
        });
        return [];
      });

      const exercises = await Promise.race([
        exercisesPromise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Data loading timeout')), PRELOAD_CONFIG.TIMEOUT.DATA),
        ),
      ]);

      // Store in global cache for immediate access
      const exerciseCount = Array.isArray(exercises) ? exercises.length : 0;
      (global as GlobalCache).exercisesCache = {
        all: Array.isArray(exercises) ? exercises : [],
        lastUpdated: Date.now(),
      };

      const loadTime = Date.now() - startTime;
      addBreadcrumb('Application data preloaded successfully', 'data.preload', {
        exerciseCount,
        loadTimeMs: loadTime,
        success: true,
      });

      if (DEBUG_SPLASH_SCREEN) {
        console.log(`📊 Preloaded ${exerciseCount} total exercises`);
      }

      return true;
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.warn('Error in preloadApplicationData:', error);
      captureError(error as Error, {
        category: 'database_error',
        component: 'SplashScreenManager',
        action: 'preloadApplicationData',
        loadTimeMs: loadTime,
      });
      return false;
    }
  };

  // Simplified user data loading
  const preloadUserData = async (userId: string): Promise<boolean> => {
    const startTime = Date.now();
    try {
      addBreadcrumb('Starting user data preload', 'user.preload', {
        userId,
        timeout: PRELOAD_CONFIG.TIMEOUT.USER_DATA,
      });

      updateProgress(0.1, LOADING_MESSAGES.USER_CONTENT, 'userData');

      // Load user-specific data with timeout
      const userDataPromise = (async () => {
        try {
          const { data: favoriteExercises, error } = await supabase
            .from('user_favorite_exercises')
            .select('exercise_id')
            .eq('user_id', userId);

          if (error) {
            captureError(new Error(`Failed to load user favorites: ${error.message}`), {
              category: 'database_error',
              component: 'SplashScreenManager',
              action: 'loadUserFavorites',
              userId,
              errorCode: error.code,
            });
            return;
          }

          if (favoriteExercises) {
            const favoriteIds = favoriteExercises.map(
              (fav: { exercise_id: string }) => fav.exercise_id,
            );
            (global as GlobalCache).userFavoritesCache = {
              favoriteExerciseIds: favoriteIds,
              lastUpdated: Date.now(),
            };
            addBreadcrumb('User favorites loaded', 'user.preload', {
              userId,
              favoriteCount: favoriteIds.length,
            });
          }
        } catch (error) {
          console.warn('Error loading user favorites:', error);
          captureError(error as Error, {
            category: 'database_error',
            component: 'SplashScreenManager',
            action: 'loadUserFavorites',
            userId,
          });
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

      const loadTime = Date.now() - startTime;
      addBreadcrumb('User data preloaded successfully', 'user.preload', {
        userId,
        loadTimeMs: loadTime,
        success: true,
      });

      return true;
    } catch (error) {
      const loadTime = Date.now() - startTime;
      console.warn('Error preloading user data:', error);
      captureError(error as Error, {
        category: 'database_error',
        component: 'SplashScreenManager',
        action: 'preloadUserData',
        userId,
        loadTimeMs: loadTime,
      });
      return false;
    }
  };

  // Refresh essential data when app comes to foreground
  const refreshEssentialData = async (): Promise<void> => {
    const startTime = Date.now();
    addBreadcrumb('Starting background data refresh', 'data.refresh', {
      timestamp: new Date().toISOString(),
    });

    if (DEBUG_SPLASH_SCREEN) {
      console.log(`🔄 [SplashScreenManager] Refreshing essential data in background`);
    }
    try {
      // This runs silently in the background without UI updates
      await preloadApplicationData();
      const refreshTime = Date.now() - startTime;
      addBreadcrumb('Background data refresh completed', 'data.refresh', {
        refreshTimeMs: refreshTime,
        success: true,
      });
      if (DEBUG_SPLASH_SCREEN) {
        console.log(`✅ [SplashScreenManager] Refreshed essential data silently in background`);
      }
    } catch (error) {
      const refreshTime = Date.now() - startTime;
      // Don't show errors to user for background refreshes
      console.warn('Background refresh failed:', error);
      captureError(error as Error, {
        category: 'database_error',
        component: 'SplashScreenManager',
        action: 'refreshEssentialData',
        refreshTimeMs: refreshTime,
        isBackground: true,
      });
    }
  };

  // Phase 1: Preload static assets
  const executePhase1 = async (): Promise<void> => {
    const startTime = Date.now();
    addBreadcrumb('Starting Phase 1: Static assets preload', 'phase.1', {
      timeout: PRELOAD_CONFIG.TIMEOUT.STATIC_ASSETS,
    });

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
      const phaseTime = Date.now() - startTime;
      addBreadcrumb('Phase 1 completed successfully', 'phase.1', {
        phaseTimeMs: phaseTime,
        success: true,
      });
      if (DEBUG_SPLASH_SCREEN) {
        console.log('✅ [SplashScreenManager] Phase 1 completed');
      }
    } catch (err) {
      const phaseTime = Date.now() - startTime;
      console.warn('⚠️ [SplashScreenManager] Phase 1 timed out:', err);
      capturePerformanceError('Phase 1 timeout - static assets', 'phase_timeout', phaseTime);
      addBreadcrumb('Phase 1 timed out', 'phase.1', {
        phaseTimeMs: phaseTime,
        success: false,
        error: String(err),
      });
      updateProgress(0.1, LOADING_MESSAGES.CONTENT, 'staticAssetsFallback');
    }
  };

  // Phase 2: Preload data
  const executePhase2 = async (): Promise<void> => {
    const startTime = Date.now();
    addBreadcrumb('Starting Phase 2: Data preload', 'phase.2', {
      timeout: PRELOAD_CONFIG.TIMEOUT.DATA,
    });

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
      const phaseTime = Date.now() - startTime;
      addBreadcrumb('Phase 2 completed successfully', 'phase.2', {
        phaseTimeMs: phaseTime,
        success: true,
      });
      if (DEBUG_SPLASH_SCREEN) {
        console.log('✅ [SplashScreenManager] Phase 2 completed');
      }
    } catch (err) {
      const phaseTime = Date.now() - startTime;
      console.warn('⚠️ [SplashScreenManager] Phase 2 timed out:', err);
      capturePerformanceError('Phase 2 timeout - data loading', 'phase_timeout', phaseTime);
      addBreadcrumb('Phase 2 timed out', 'phase.2', {
        phaseTimeMs: phaseTime,
        success: false,
        error: String(err),
      });
      updateProgress(0.2, LOADING_MESSAGES.AUTHENTICATED, 'dataFallback');
    }
  };

  // Phase 3: Load user-specific content if signed in
  const executePhase3 = async (): Promise<void> => {
    if (user) {
      const startTime = Date.now();
      addBreadcrumb('Starting Phase 3: User data preload', 'phase.3', {
        userId: user.id,
        timeout: PRELOAD_CONFIG.TIMEOUT.USER_DATA,
      });

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
        const phaseTime = Date.now() - startTime;
        addBreadcrumb('Phase 3 completed successfully', 'phase.3', {
          userId: user.id,
          phaseTimeMs: phaseTime,
          success: true,
        });
        if (DEBUG_SPLASH_SCREEN) {
          console.log('✅ [SplashScreenManager] Phase 3 completed');
        }
      } catch (err) {
        const phaseTime = Date.now() - startTime;
        console.warn('⚠️ [SplashScreenManager] Phase 3 timed out:', err);
        capturePerformanceError('Phase 3 timeout - user data', 'phase_timeout', phaseTime);
        addBreadcrumb('Phase 3 timed out', 'phase.3', {
          userId: user.id,
          phaseTimeMs: phaseTime,
          success: false,
          error: String(err),
        });
        updateProgress(0.1, LOADING_MESSAGES.AUTHENTICATED, 'userDataFallback');
      }
    } else {
      addBreadcrumb('Skipping Phase 3 - no user authenticated', 'phase.3', {
        hasUser: false,
      });
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

      // Note: We don't hide the native splash screen here anymore
      // It will be hidden only when the app is fully ready in finishLoading()
      if (DEBUG_SPLASH_SCREEN) {
        console.log(
          '🎭 [SplashScreenManager] Keeping native splash screen visible during loading...',
        );
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
      addBreadcrumb('finishLoading called but component not mounted', 'splash.finish', {
        isMounted: false,
      });
      if (DEBUG_SPLASH_SCREEN) {
        console.log('🚫 [SplashScreenManager] finishLoading called but component not mounted');
      }
      return;
    }

    addBreadcrumb('Starting finish loading process', 'splash.finish', {
      isMounted: true,
      hasTimeout: !!totalTimeoutRef.current,
      timestamp: new Date().toISOString(),
    });

    if (DEBUG_SPLASH_SCREEN) {
      console.log('🏁 [SplashScreenManager] finishLoading called - starting finish process');
    }

    // Clear the total timeout
    if (totalTimeoutRef.current) {
      clearTimeout(totalTimeoutRef.current);
      totalTimeoutRef.current = null;
      addBreadcrumb('Total timeout cleared', 'splash.finish');
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
    addBreadcrumb('App ready state set to true', 'splash.finish');

    // Add a small delay to show completion, then hide splash
    setTimeout(() => {
      if (isMounted.current) {
        if (DEBUG_SPLASH_SCREEN) {
          console.log('🎭 [SplashScreenManager] Hiding splash screen');
        }
        setShowSplash(false);
        addBreadcrumb('Custom splash screen hidden', 'splash.finish');

        // Hide the native splash screen after our custom loading screen is hidden
        setTimeout(async () => {
          if (isMounted.current) {
            if (DEBUG_SPLASH_SCREEN) {
              console.log('🔚 [SplashScreenManager] Calling safelyHideSplashScreen');
            }
            await safelyHideSplashScreen();
            addBreadcrumb('Native splash screen hide completed', 'splash.finish');
          }
        }, 100);
      } else {
        addBreadcrumb('Component unmounted during finish sequence', 'splash.finish', {
          isMounted: false,
        });
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
