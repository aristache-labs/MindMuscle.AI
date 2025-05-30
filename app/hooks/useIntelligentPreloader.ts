import { useState, useEffect, useRef } from 'react';
import { InteractionManager, AppState, AppStateStatus } from 'react-native';
import { 
  strategicPreloadImages, 
  PreloadStrategy,
  clearImageCache,
  markAsImportantImage,
  isSvgPreloaded
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

// Helper to filter out SVGs from image URLs
const filterOutSvgs = (urls: string[]): string[] => {
  return urls.filter(url => !url.endsWith('.svg'));
};

// Helper to count SVGs in an array of URLs
const countSvgsInUrls = (urls: string[]): number => {
  return urls.filter(url => url.endsWith('.svg')).length;
};

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
        console.log(`🔍 Intelligent preloader: Loading ${imagesToLoad.length} images (+ ${svgCount} preloaded SVGs) for screen ${screenId}`);
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
        (progress, completed, total) => {
          if (completed) {
            // Add SVG count to completed images
            setCriticalImagesLoaded(completed + svgCount);
            // Overall progress is weighted 70% for critical images
            setProgress((progress * 0.7) + (svgCount / totalImagesRef.current * 0.7));
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
    
    // Filter out SVGs as they should already be loaded
    const svgCount = countSvgsInUrls(nextScreenImages);
    const imagesToLoad = filterOutSvgs(nextScreenImages);
    
    // If we only have SVGs, count them as loaded and skip
    if (imagesToLoad.length === 0 && svgCount > 0) {
      setAnticipatoryImagesLoaded(svgCount);
      // Update progress
      setProgress(prev => prev + 0.2); // Add 20% for anticipatory SVGs
      if (debug) {
        console.log(`🔍 All ${svgCount} anticipatory images are SVGs, already preloaded`);
      }
      return;
    }
    
    // Start with SVGs counted as already loaded
    if (svgCount > 0) {
      setAnticipatoryImagesLoaded(svgCount);
      // Update progress for preloaded SVGs (part of the 20% for anticipatory)
      const svgProgress = svgCount / nextScreenImages.length;
      setProgress(prev => prev + (svgProgress * 0.2));
    }
    
    // Preload the next screen images with medium priority
    await strategicPreloadImages(
      imagesToLoad,
      PreloadStrategy.ANTICIPATORY,
      undefined,
      (progress, completed, total) => {
        if (completed) {
          // Add SVG count to completed images
          setAnticipatoryImagesLoaded(completed + svgCount);
          // Overall progress is weighted 20% for anticipatory images
          // Combined with critical (70%), leaves 10% for prefetch
          setProgress(0.7 + ((progress * nextScreenImages.length + svgCount) / nextScreenImages.length * 0.2));
        }
      }
    );
    
    if (debug) {
      console.log(`✅ Loaded ${imagesToLoad.length} anticipatory images (+ ${svgCount} SVGs) for screens: ${nextScreens.join(', ')}`);
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
        // Filter out SVGs
        const prefetchSvgCount = countSvgsInUrls(prefetchImages);
        const prefetchImagesToLoad = filterOutSvgs(prefetchImages);
        
        // If we only have SVGs, count them as loaded and skip
        if (prefetchImagesToLoad.length === 0 && prefetchSvgCount > 0) {
          setPrefetchImagesLoaded(prefetchSvgCount);
          // Update progress for final 10%
          setProgress(0.9 + 0.1); // Complete the progress
          if (debug) {
            console.log(`🔍 All ${prefetchSvgCount} prefetch images are SVGs, already preloaded`);
          }
          return;
        }
        
        // Count SVGs as already loaded
        if (prefetchSvgCount > 0) {
          setPrefetchImagesLoaded(prefetchSvgCount);
          // Update progress for SVGs (part of the final 10%)
          const svgProgress = prefetchSvgCount / prefetchImages.length;
          setProgress(prev => prev + (svgProgress * 0.1));
        }
        
        // Preload with lowest priority
        await strategicPreloadImages(
          prefetchImagesToLoad,
          PreloadStrategy.PREFETCH,
          undefined,
          (progress, completed, total) => {
            if (completed) {
              // Add SVG count to completed
              setPrefetchImagesLoaded(completed + prefetchSvgCount);
              // Final 10% of progress
              setProgress(0.9 + ((progress * prefetchImages.length + prefetchSvgCount) / prefetchImages.length * 0.1));
            }
          }
        );
        
        if (debug) {
          console.log(`✅ Prefetched ${prefetchImagesToLoad.length} images (+ ${prefetchSvgCount} SVGs) for second-level screens`);
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
      
      // Filter out SVGs as they're already preloaded
      const filteredImages = filterOutSvgs(imagesToLoad);
      const svgCount = imagesToLoad.length - filteredImages.length;
      
      if (filteredImages.length === 0) {
        if (debug) {
          console.log(`🔍 All ${svgCount} images for screens (${screenIds.join(', ')}) are SVGs, already preloaded`);
        }
        return;
      }
      
      if (debug) {
        console.log(`🚀 Strategic preloading (${screenIds.join(', ')}): ${filteredImages.length} images (+ ${svgCount} SVGs) with priority high...`);
      }
      
      // Use critical strategy for manual loading
      await strategicPreloadImages(filteredImages, PreloadStrategy.CRITICAL);
      
      if (debug) {
        console.log(`✅ Strategic preloading complete: ${filteredImages.length} images (+ ${svgCount} SVGs)`);
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