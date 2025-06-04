import { useState, useEffect, useRef } from 'react';
import { InteractionManager, AppState, AppStateStatus } from 'react-native';
import { strategicPreloadImages, PreloadStrategy, clearImageCache } from '../utils/imagePreloader';
import { useSentryDataCollection } from './useSentryDataCollection';

export interface IntelligentPreloaderOptions {
  /**
   * Current screen identifier - used to determine appropriate preloading strategy
   */
  screenId: string;

  /**
   * Enable predictive preloading for probable next screens
   */
  enablePredictiveLoading?: boolean;

  /**
   * Cache management strategy
   */
  cacheManagement?: 'aggressive' | 'balanced' | 'conservative';

  /**
   * Function to determine expected next screens based on current screen
   */
  getNextScreenPaths?: (currentScreen: string) => string[];

  /**
   * Debug mode
   */
  debug?: boolean;
}

export interface PreloadingInfo {
  /**
   * Screen ID this preloader is managing
   */
  screenId: string;

  /**
   * Total images in the preload queue
   */
  totalImages: number;

  /**
   * Number of critical images (current screen) that are loaded
   */
  criticalImagesLoaded: number;

  /**
   * Number of anticipatory images (next screens) that are loaded
   */
  anticipatoryImagesLoaded: number;

  /**
   * Number of prefetched images (future screens) that are loaded
   */
  prefetchImagesLoaded: number;

  /**
   * Overall loading progress between 0 and 1
   */
  progress: number;

  /**
   * Manually trigger predictive loading for a set of screens
   */
  predictiveLoadForScreens: (screenIds: string[]) => void;

  /**
   * Clear image cache (helpful for troubleshooting)
   */
  clearCache: () => Promise<void>;
}

// Helper to filter out SVGs from image URLs
const filterOutSvgs = (urls: string[]): string[] => {
  return urls.filter((url) => !url.endsWith('.svg'));
};

// Helper to count SVGs in an array of URLs
const countSvgsInUrls = (urls: string[]): number => {
  return urls.filter((url) => url.endsWith('.svg')).length;
};

// Navigation prediction model - map of screen ID to likely next screens
// This could be enhanced with machine learning or custom user behavior tracking
const PREDICTIVE_NAVIGATION: Record<string, string[]> = {
  // Main tabs
  home: ['discover', 'exercises', 'profile'],
  discover: ['plans', 'exercises-list'],
  exercises: ['exercise-details', 'plans'],
  insights: ['achievements', 'howtomeasuremodal'],
  plans: ['plan-details', 'exercises'],
  profile: ['settings'],

  // Nested screens
  'exercises-list': ['exercise-details'],
  'exercise-details': ['exercises-list', 'plans'],
  'plan-details': ['plans', 'exercises-list'],
  achievements: ['profile'],
  settings: ['profile'],
};

// Image path mapping based on screen IDs - to be expanded based on app structure
// This is a simplified version, should be expanded based on actual app needs
const SCREEN_TO_IMAGE_PATHS: Record<string, string[]> = {
  discover: [
    'assets/exercises/fullbody.jpg',
    'assets/exercises/dumbbell.jpg',
    'assets/exercises/pushup.jpg',
    'assets/exercises/squat.jpg',
    'assets/exercises/yoga.jpg',
  ],
  exercises: [
    'assets/exercises/chest.jpg',
    'assets/exercises/back.jpg',
    'assets/exercises/legs.jpg',
  ],
  plans: [
    // Removed non-existent assets
  ],
  profile: ['assets/profile/avatar-default.jpg', 'assets/icons/achievements.png'],
};

/**
 * Hook for intelligent image preloading based on current screen and predicted navigation
 */
export default function useIntelligentPreloader(
  images: string[],
  options: IntelligentPreloaderOptions,
): PreloadingInfo {
  const {
    screenId,
    enablePredictiveLoading = true,
    cacheManagement = 'balanced',
    getNextScreenPaths,
    debug = false,
  } = options;

  // Initialize Sentry monitoring
  const {
    setContext,
    addBreadcrumb,
    captureException,
    trackUserAction: _trackUserAction, // eslint-disable-line no-unused-vars
    setTag,
  } = useSentryDataCollection({
    componentName: 'useIntelligentPreloader',
  });

  // State tracking
  const [criticalImagesLoaded, setCriticalImagesLoaded] = useState(0);
  const [anticipatoryImagesLoaded, setAnticipatoryImagesLoaded] = useState(0);
  const [prefetchImagesLoaded, setPrefetchImagesLoaded] = useState(0);
  const [progress, setProgress] = useState(0);

  // Refs to avoid re-triggering effects
  const hasStarted = useRef(false);
  const currentScreen = useRef(screenId);
  const totalImagesRef = useRef(0);

  // Sentry monitoring refs
  const preloadStartTime = useRef<number>(Date.now());
  const predictionAccuracy = useRef<{ correct: number; total: number }>({ correct: 0, total: 0 });
  const cacheHitRate = useRef<{ hits: number; misses: number }>({ hits: 0, misses: 0 });

  // Set initial Sentry context
  useEffect(() => {
    setContext('intelligent_preloader', {
      screen_id: screenId,
      cache_management: cacheManagement,
      predictive_loading_enabled: enablePredictiveLoading,
      total_images: images.length,
    });

    setTag('preloader_screen', screenId);
    setTag('cache_strategy', cacheManagement);

    addBreadcrumb({
      message: 'Intelligent preloader initialized',
      category: 'preloader',
      level: 'info',
      data: {
        screen_id: screenId,
        image_count: images.length,
        cache_strategy: cacheManagement,
      },
    });

    preloadStartTime.current = Date.now();
  }, [screenId, cacheManagement, enablePredictiveLoading, images.length]);

  // Update current screen if it changes
  useEffect(() => {
    if (currentScreen.current !== screenId) {
      // Track screen transition prediction accuracy
      const previousScreen = currentScreen.current;
      const predictedScreens = PREDICTIVE_NAVIGATION[previousScreen] || [];
      const wasCorrectPrediction = predictedScreens.includes(screenId);

      predictionAccuracy.current.total += 1;
      if (wasCorrectPrediction) {
        predictionAccuracy.current.correct += 1;
      }

      // Log prediction accuracy
      const accuracy =
        predictionAccuracy.current.total > 0
          ? (predictionAccuracy.current.correct / predictionAccuracy.current.total) * 100
          : 0;

      addBreadcrumb({
        message: 'Screen transition tracked',
        category: 'navigation',
        level: 'info',
        data: {
          from_screen: previousScreen,
          to_screen: screenId,
          was_predicted: wasCorrectPrediction,
          prediction_accuracy: accuracy,
        },
      });

      setContext('prediction_accuracy', {
        correct_predictions: predictionAccuracy.current.correct,
        total_predictions: predictionAccuracy.current.total,
        accuracy_percentage: accuracy,
      });

      currentScreen.current = screenId;
    }
  }, [screenId]);

  // Monitor app state for background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      addBreadcrumb({
        message: `App state changed to ${nextAppState}`,
        category: 'app-lifecycle',
        level: 'info',
        data: {
          new_state: nextAppState,
          cache_strategy: cacheManagement,
        },
      });

      if (nextAppState === 'active' && cacheManagement === 'aggressive') {
        // Clear cache when returning to foreground in aggressive mode
        clearImageCache()
          .then(() => {
            addBreadcrumb({
              message: 'Cache cleared on app foreground',
              category: 'cache',
              level: 'info',
            });
          })
          .catch((err) => {
            captureException(new Error('Failed to clear image cache'), {
              cache_strategy: cacheManagement,
              app_state: nextAppState,
              original_error: err.message,
            });
          });
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [cacheManagement]);

  // Helper function to get predicted next screens
  const getPredictedScreens = (): string[] => {
    if (getNextScreenPaths) {
      return getNextScreenPaths(currentScreen.current);
    }
    return PREDICTIVE_NAVIGATION[currentScreen.current] || [];
  };

  // Helper function to collect images from screens
  const collectImagesFromScreens = (screenIds: string[]): string[] => {
    const images: string[] = [];
    screenIds.forEach((screenId) => {
      const screenImages = SCREEN_TO_IMAGE_PATHS[screenId] || [];
      images.push(...screenImages);
    });
    return images;
  };

  // Helper function to handle SVG-only images with monitoring
  const handleSvgOnlyImages = (
    svgCount: number,
    totalImages: number,
    setLoaded: (count: number) => void,
    progressWeight: number,
    debugMessage: string,
  ): boolean => {
    if (svgCount > 0) {
      addBreadcrumb({
        message: `SVG images detected: ${debugMessage}`,
        category: 'preloader',
        level: 'debug',
        data: {
          svg_count: svgCount,
          total_images: totalImages,
          progress_weight: progressWeight,
        },
      });

      if (debug) {
        console.log(`[IntelligentPreloader] ${debugMessage}: ${svgCount} SVGs detected`);
      }
      setLoaded(svgCount);
      return true;
    }
    return false;
  };

  // Helper function to preload anticipatory images
  const preloadAnticipatoryImages = async (nextScreens: string[]) => {
    const startTime = Date.now();
    const nextScreenImages = collectImagesFromScreens(nextScreens);

    addBreadcrumb({
      message: 'Starting anticipatory image preload',
      category: 'preloader',
      level: 'info',
      data: {
        predicted_screens: nextScreens.join(', '),
        image_count: nextScreenImages.length,
      },
    });

    if (nextScreenImages.length === 0) {
      addBreadcrumb({
        message: 'No images found for predicted screens',
        category: 'preloader',
        level: 'warning',
        data: { predicted_screens: nextScreens.join(', ') },
      });
      if (debug) {
        console.log('🔍 No images found for predicted screens');
      }
      return;
    }

    const svgCount = countSvgsInUrls(nextScreenImages);
    const imagesToLoad = filterOutSvgs(nextScreenImages);

    // Handle SVG-only case
    if (imagesToLoad.length === 0 && svgCount > 0) {
      handleSvgOnlyImages(
        svgCount,
        nextScreenImages.length,
        setAnticipatoryImagesLoaded,
        0.2,
        `🔍 All ${svgCount} anticipatory images are SVGs, already preloaded`,
      );
      return;
    }

    // Start with SVGs counted as already loaded
    if (svgCount > 0) {
      setAnticipatoryImagesLoaded(svgCount);
      const svgProgress = svgCount / nextScreenImages.length;
      setProgress((prev) => prev + svgProgress * 0.2);
    }

    try {
      // Preload the next screen images with medium priority
      await strategicPreloadImages(
        imagesToLoad,
        PreloadStrategy.ANTICIPATORY,
        undefined,
        (progress, completed) => {
          if (completed) {
            setAnticipatoryImagesLoaded(completed + svgCount);
            setProgress(
              0.7 +
                ((progress * nextScreenImages.length + svgCount) / nextScreenImages.length) * 0.2,
            );
          }
        },
      );

      const duration = Date.now() - startTime;
      addBreadcrumb({
        message: 'Anticipatory image preload completed',
        category: 'preloader',
        level: 'info',
        data: {
          duration_ms: duration,
          images_loaded: imagesToLoad.length,
          svg_count: svgCount,
          predicted_screens: nextScreens.join(', '),
        },
      });

      // Track cache hit rate
      cacheHitRate.current.hits += imagesToLoad.length;
      setContext('cache_performance', {
        hit_rate:
          cacheHitRate.current.hits / (cacheHitRate.current.hits + cacheHitRate.current.misses),
        total_hits: cacheHitRate.current.hits,
        total_misses: cacheHitRate.current.misses,
      });

      if (debug) {
        console.log(
          `✅ Loaded ${imagesToLoad.length} anticipatory images (+ ${svgCount} SVGs) for screens: ${nextScreens.join(', ')}`,
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      captureException(error as Error, {
        operation: 'anticipatory_preload',
        duration_ms: duration,
        image_count: imagesToLoad.length,
        predicted_screens: nextScreens.join(', '),
      });

      cacheHitRate.current.misses += imagesToLoad.length;
    }
  };

  // Helper function to preload prefetch images for aggressive mode
  const preloadPrefetchImages = async (nextScreens: string[]) => {
    const secondLevelScreens: string[] = [];
    nextScreens.forEach((screen) => {
      const furtherScreens = PREDICTIVE_NAVIGATION[screen] || [];
      furtherScreens.forEach((furtherScreen) => {
        if (
          !secondLevelScreens.includes(furtherScreen) &&
          !nextScreens.includes(furtherScreen) &&
          furtherScreen !== currentScreen.current
        ) {
          secondLevelScreens.push(furtherScreen);
        }
      });
    });

    if (secondLevelScreens.length > 0 && debug) {
      console.log(`🔍 Second-level predicted screens: ${secondLevelScreens.join(', ')}`);
    }

    const prefetchImages = collectImagesFromScreens(secondLevelScreens);

    if (prefetchImages.length === 0) return;

    const prefetchSvgCount = countSvgsInUrls(prefetchImages);
    const prefetchImagesToLoad = filterOutSvgs(prefetchImages);

    // Handle SVG-only case
    if (prefetchImagesToLoad.length === 0 && prefetchSvgCount > 0) {
      handleSvgOnlyImages(
        prefetchSvgCount,
        prefetchImages.length,
        setPrefetchImagesLoaded,
        0.1,
        `🔍 All ${prefetchSvgCount} prefetch images are SVGs, already preloaded`,
      );
      return;
    }

    // Count SVGs as already loaded
    if (prefetchSvgCount > 0) {
      setPrefetchImagesLoaded(prefetchSvgCount);
      const svgProgress = prefetchSvgCount / prefetchImages.length;
      setProgress((prev) => prev + svgProgress * 0.1);
    }

    // Preload with lowest priority
    await strategicPreloadImages(
      prefetchImagesToLoad,
      PreloadStrategy.PREFETCH,
      undefined,
      (progress, completed) => {
        if (completed) {
          setPrefetchImagesLoaded(completed + prefetchSvgCount);
          setProgress(
            0.9 +
              ((progress * prefetchImages.length + prefetchSvgCount) / prefetchImages.length) * 0.1,
          );
        }
      },
    );

    if (debug) {
      console.log(
        `✅ Prefetched ${prefetchImagesToLoad.length} images (+ ${prefetchSvgCount} SVGs) for second-level screens`,
      );
    }
  };

  // Main preloading logic
  useEffect(() => {
    if (hasStarted.current || !images || images.length === 0) {
      return;
    }

    hasStarted.current = true;

    // Count SVGs (they're considered already loaded)
    const svgCount = countSvgsInUrls(images);

    // Filter out SVGs for actual loading (they're already preloaded at app start)
    const imagesToLoad = filterOutSvgs(images);

    // Update total count to include SVGs (but we don't need to load them)
    totalImagesRef.current = images.length;

    // If we only have SVGs, mark as complete immediately
    if (imagesToLoad.length === 0 && svgCount > 0) {
      setCriticalImagesLoaded(svgCount);
      setProgress(1);
      if (debug) {
        console.log(`🔍 Intelligent preloader: All ${svgCount} images are SVGs, already preloaded`);
      }
      return;
    }

    // Split images into critical (current screen) and anticipatory (next screens)
    const preloadCurrentScreenImages = async () => {
      if (debug) {
        console.log(
          `🔍 Intelligent preloader: Loading ${imagesToLoad.length} images (+ ${svgCount} preloaded SVGs) for screen ${screenId}`,
        );
      }

      // Start with SVGs already counted as loaded
      setCriticalImagesLoaded(svgCount);
      // Initial progress based on preloaded SVGs
      if (svgCount > 0) {
        const svgProgress = svgCount / totalImagesRef.current;
        setProgress(svgProgress * 0.7); // SVGs contribute to 70% of initial progress
      }

      // Start with critical images for current screen
      await strategicPreloadImages(
        imagesToLoad,
        PreloadStrategy.CRITICAL,
        undefined,
        (progress, completed) => {
          if (completed) {
            // Add SVG count to completed images
            setCriticalImagesLoaded(completed + svgCount);
            // Overall progress is weighted 70% for critical images
            setProgress(progress * 0.7 + (svgCount / totalImagesRef.current) * 0.7);
          }
        },
      );

      // Then predict and preload next screen images if enabled
      if (enablePredictiveLoading) {
        loadPredictedScreens();
      }
    };

    // Run preloading after interactions are complete
    InteractionManager.runAfterInteractions(preloadCurrentScreenImages);

    return () => {
      hasStarted.current = false;
    };
  }, [images, screenId, enablePredictiveLoading]);

  // Function to predict and load next screen images (simplified)
  const loadPredictedScreens = async () => {
    const nextScreens = getPredictedScreens();

    if (nextScreens.length === 0) {
      if (debug) {
        console.log(`🔍 No predicted next screens for ${currentScreen.current}`);
      }
      return;
    }

    if (debug) {
      console.log(`🔍 Predicted next screens for ${currentScreen.current}:`, nextScreens);
    }

    // Preload anticipatory images
    await preloadAnticipatoryImages(nextScreens);

    // For aggressive prefetching, try to load even more distant screens
    if (cacheManagement === 'aggressive') {
      await preloadPrefetchImages(nextScreens);
    }
  };

  // Manually trigger predictive loading for specific screens
  const predictiveLoadForScreens = (screenIds: string[]) => {
    if (!screenIds || screenIds.length === 0) {
      return;
    }

    InteractionManager.runAfterInteractions(async () => {
      const imagesToLoad = collectImagesFromScreens(screenIds);

      if (imagesToLoad.length === 0) {
        return;
      }

      // Filter out SVGs as they're already preloaded
      const filteredImages = filterOutSvgs(imagesToLoad);
      const svgCount = imagesToLoad.length - filteredImages.length;

      if (filteredImages.length === 0) {
        if (debug) {
          console.log(
            `🔍 All ${svgCount} images for screens (${screenIds.join(', ')}) are SVGs, already preloaded`,
          );
        }
        return;
      }

      if (debug) {
        console.log(
          `🚀 Strategic preloading (${screenIds.join(', ')}): ${filteredImages.length} images (+ ${svgCount} SVGs) with priority high...`,
        );
      }

      // Use critical strategy for manual loading
      await strategicPreloadImages(filteredImages, PreloadStrategy.CRITICAL);

      if (debug) {
        console.log(
          `✅ Strategic preloading complete: ${filteredImages.length} images (+ ${svgCount} SVGs)`,
        );
      }
    });
  };

  // Clear cache helper
  const handleClearCache = async (): Promise<void> => {
    try {
      const result = await clearImageCache({
        olderThan: cacheManagement === 'aggressive' ? undefined : 24 * 60 * 60 * 1000, // 24 hours for non-aggressive mode
      });

      if (debug) {
        console.log(
          `🧹 Cache cleared: ${result.memoryClearedCount} entries, disk cache ${result.diskCleaned ? 'cleaned' : 'unchanged'}`,
        );
      }
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  };

  return {
    screenId: currentScreen.current,
    totalImages: totalImagesRef.current,
    criticalImagesLoaded,
    anticipatoryImagesLoaded,
    prefetchImagesLoaded,
    progress,
    predictiveLoadForScreens,
    clearCache: handleClearCache,
  };
}
