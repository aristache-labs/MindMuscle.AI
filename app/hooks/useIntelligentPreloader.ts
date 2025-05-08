import { useState, useEffect, useRef } from 'react';
import { InteractionManager, AppState, AppStateStatus } from 'react-native';
import { 
  strategicPreloadImages, 
  PreloadStrategy,
  clearImageCache,
  markAsImportantImage 
} from '../utils/imagePreloader';

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

// Navigation prediction model - map of screen ID to likely next screens
// This could be enhanced with machine learning or custom user behavior tracking
const PREDICTIVE_NAVIGATION: Record<string, string[]> = {
  // Main tabs
  'home': ['discover', 'exercises', 'profile'],
  'discover': ['plans', 'exercises-list'],
  'exercises': ['exercise-details', 'plans'],
  'insights': ['achievements', 'howtomeasuremodal'],
  'plans': ['plan-details', 'exercises'],
  'profile': ['settings'],
  
  // Nested screens
  'exercises-list': ['exercise-details'],
  'exercise-details': ['exercises-list', 'plans'],
  'plan-details': ['plans', 'exercises-list'],
  'achievements': ['profile'],
  'settings': ['profile']
};

// Image path mapping based on screen IDs - to be expanded based on app structure
// This is a simplified version, should be expanded based on actual app needs
const SCREEN_TO_IMAGE_PATHS: Record<string, string[]> = {
  'discover': [
    'assets/exercises/fullbody.jpg',
    'assets/exercises/dumbbell.jpg',
    'assets/exercises/pushup.jpg',
    'assets/exercises/squat.jpg',
    'assets/exercises/yoga.jpg'
  ],
  'exercises': [
    'assets/exercises/chest.jpg',
    'assets/exercises/back.jpg',
    'assets/exercises/legs.jpg'
  ],
  'plans': [
    // Removed non-existent assets
  ],
  'profile': [
    'assets/profile/avatar-default.jpg',
    'assets/icons/achievements.png'
  ]
};

/**
 * Hook for intelligent image preloading based on current screen and predicted navigation
 */
export default function useIntelligentPreloader(
  images: string[],
  options: IntelligentPreloaderOptions
): PreloadingInfo {
  const { 
    screenId,
    enablePredictiveLoading = true,
    cacheManagement = 'balanced',
    getNextScreenPaths,
    debug = false
  } = options;
  
  // State tracking
  const [criticalImagesLoaded, setCriticalImagesLoaded] = useState(0);
  const [anticipatoryImagesLoaded, setAnticipatoryImagesLoaded] = useState(0);
  const [prefetchImagesLoaded, setPrefetchImagesLoaded] = useState(0);
  const [progress, setProgress] = useState(0);
  
  // Refs to avoid re-triggering effects
  const hasStarted = useRef(false);
  const currentScreen = useRef(screenId);
  const totalImagesRef = useRef(0);
  
  // Update current screen if it changes
  useEffect(() => {
    currentScreen.current = screenId;
  }, [screenId]);
  
  // Monitor app state for background/foreground transitions
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && cacheManagement === 'aggressive') {
        // Clear cache when returning to foreground in aggressive mode
        clearImageCache().catch(err => {
          console.warn('Failed to clear image cache:', err);
        });
      }
    };
    
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, [cacheManagement]);
  
  // Main preloading logic
  useEffect(() => {
    if (hasStarted.current || !images || images.length === 0) {
      return;
    }
    
    hasStarted.current = true;
    totalImagesRef.current = images.length;
    
    // Split images into critical (current screen) and anticipatory (next screens)
    const preloadCurrentScreenImages = async () => {
      if (debug) {
        console.log(`🔍 Intelligent preloader: Loading ${images.length} images for screen ${screenId}`);
      }
      
      // Start with critical images for current screen
      await strategicPreloadImages(
        images,
        PreloadStrategy.CRITICAL,
        undefined,
        (progress, completed, total) => {
          if (completed) {
            setCriticalImagesLoaded(completed);
            // Overall progress is weighted 70% for critical images
            setProgress(progress * 0.7);
          }
        }
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
  
  // Function to predict and load next screen images
  const loadPredictedScreens = async () => {
    // Get predicted next screens
    let nextScreens: string[] = [];
    
    if (getNextScreenPaths) {
      // Use custom prediction function if provided
      nextScreens = getNextScreenPaths(currentScreen.current);
    } else {
      // Use built-in prediction model
      nextScreens = PREDICTIVE_NAVIGATION[currentScreen.current] || [];
    }
    
    if (nextScreens.length === 0) {
      if (debug) {
        console.log(`🔍 No predicted next screens for ${currentScreen.current}`);
      }
      return;
    }
    
    if (debug) {
      console.log(`🔍 Predicted next screens for ${currentScreen.current}:`, nextScreens);
    }
    
    // Collect images from predicted next screens
    const nextScreenImages: string[] = [];
    nextScreens.forEach(screenId => {
      const screenImages = SCREEN_TO_IMAGE_PATHS[screenId] || [];
      nextScreenImages.push(...screenImages);
    });
    
    if (nextScreenImages.length === 0) {
      if (debug) {
        console.log('🔍 No images found for predicted screens');
      }
      return;
    }
    
    // Preload the next screen images with medium priority
    await strategicPreloadImages(
      nextScreenImages,
      PreloadStrategy.ANTICIPATORY,
      undefined,
      (progress, completed, total) => {
        if (completed) {
          setAnticipatoryImagesLoaded(completed);
          // Overall progress is weighted 20% for anticipatory images
          // Combined with critical (70%), leaves 10% for prefetch
          setProgress(0.7 + (progress * 0.2));
        }
      }
    );
    
    if (debug) {
      console.log(`✅ Loaded ${nextScreenImages.length} anticipatory images for screens: ${nextScreens.join(', ')}`);
    }
    
    // For aggressive prefetching, try to load even more distant screens
    if (cacheManagement === 'aggressive') {
      const secondLevelScreens: string[] = [];
      nextScreens.forEach(screen => {
        const furtherScreens = PREDICTIVE_NAVIGATION[screen] || [];
        furtherScreens.forEach(furtherScreen => {
          // Avoid duplicates and already loaded screens
          if (!secondLevelScreens.includes(furtherScreen) && 
              !nextScreens.includes(furtherScreen) &&
              furtherScreen !== currentScreen.current) {
            secondLevelScreens.push(furtherScreen);
          }
        });
      });
      
      if (secondLevelScreens.length > 0 && debug) {
        console.log(`🔍 Second-level predicted screens: ${secondLevelScreens.join(', ')}`);
      }
      
      // Collect images for second-level screens
      const prefetchImages: string[] = [];
      secondLevelScreens.forEach(screenId => {
        const screenImages = SCREEN_TO_IMAGE_PATHS[screenId] || [];
        prefetchImages.push(...screenImages);
      });
      
      if (prefetchImages.length > 0) {
        // Preload with lowest priority
        await strategicPreloadImages(
          prefetchImages,
          PreloadStrategy.PREFETCH,
          undefined,
          (progress, completed, total) => {
            if (completed) {
              setPrefetchImagesLoaded(completed);
              // Final 10% of progress
              setProgress(0.9 + (progress * 0.1));
            }
          }
        );
        
        if (debug) {
          console.log(`✅ Prefetched ${prefetchImages.length} images for second-level screens`);
        }
      }
    }
  };
  
  // Manually trigger predictive loading for specific screens
  const predictiveLoadForScreens = (screenIds: string[]) => {
    if (!screenIds || screenIds.length === 0) {
      return;
    }
    
    InteractionManager.runAfterInteractions(async () => {
      const imagesToLoad: string[] = [];
      
      // Collect images for requested screens
      screenIds.forEach(screenId => {
        const screenImages = SCREEN_TO_IMAGE_PATHS[screenId] || [];
        imagesToLoad.push(...screenImages);
      });
      
      if (imagesToLoad.length === 0) {
        return;
      }
      
      if (debug) {
        console.log(`🚀 Strategic preloading (${screenIds.join(', ')}): ${imagesToLoad.length} images with priority high...`);
      }
      
      // Use critical strategy for manual loading
      await strategicPreloadImages(imagesToLoad, PreloadStrategy.CRITICAL);
      
      if (debug) {
        console.log(`✅ Strategic preloading complete: ${imagesToLoad.length} images`);
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
        console.log(`🧹 Cache cleared: ${result.memoryClearedCount} entries, disk cache ${result.diskCleaned ? 'cleaned' : 'unchanged'}`);
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
    clearCache: handleClearCache
  };
} 