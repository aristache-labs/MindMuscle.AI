import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { 
  ImagePriority, 
  safePreloadImages, 
  isFastImageAvailable, 
  DEBUG_IMAGE_PRELOADER,
  isPlaceholderImage,
  type Source,
  type Priority
} from '../utils/imagePreloader';

// Cache for already preloaded images
const preloadedImagesCache = new Map<string, boolean>();

// Types for the hook options
export interface PreloadOptions {
  priority?: 'low' | 'normal' | 'high'; 
  batchSize?: number;
  debugLabel?: string;
  skipIfCached?: boolean;
}

// Type for the hook's return value
export interface PreloadingStatus {
  loaded: boolean;
  error: string | null;
  progress: number;
  completedCount: number;
  totalCount: number;
  timing?: {
    startTime: number;
    endTime: number | null;
    duration: number | null;
  };
}

/**
 * Hook for preloading a batch of images
 * 
 * @param sources Array of image URIs to preload
 * @param options Configuration options
 * @returns Status of the preloading process
 */
export default function useImagePreloader(
  sources: (string | { uri: string })[] | null | undefined,
  options: PreloadOptions = {}
): PreloadingStatus {
  // Options with defaults
  const {
    priority = 'normal',
    batchSize = 15,
    debugLabel = 'useImagePreloader',
    skipIfCached = true
  } = options;

  // Use a ref to track if preloading has started to prevent duplicate loading
  const preloadingStarted = useRef(false);

  // Convert priority string to appropriate priority
  const imagePriority = (() => {
    switch (priority) {
      case 'low': return ImagePriority.LOW;
      case 'high': return ImagePriority.HIGH;
      default: return ImagePriority.NORMAL;
    }
  })();

  // State
  const [status, setStatus] = useState<PreloadingStatus>({
    loaded: false,
    error: null,
    progress: 0,
    completedCount: 0,
    totalCount: 0,
    timing: {
      startTime: 0,
      endTime: null,
      duration: null
    }
  });

  // Effect to preload images when sources change
  useEffect(() => {
    // Skip if already started or no sources
    if (preloadingStarted.current || !Array.isArray(sources) || sources.length === 0) {
      if (!Array.isArray(sources) || sources.length === 0) {
        setStatus({
          loaded: true,
          error: null,
          progress: 1,
          completedCount: 0,
          totalCount: 0,
          timing: {
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0
          }
        });
      }
      return;
    }

    // Mark as started to prevent duplicate loads
    preloadingStarted.current = true;

    // Filter out placeholder images
    const filteredSources = sources.filter(source => !isPlaceholderImage(source));

    // Process sources into an array of URIs
    const uris = filteredSources.map(source => 
      typeof source === 'string' ? source : (source.uri || '')
    ).filter(uri => uri && typeof uri === 'string');
    
    // Filter out already preloaded images if skipIfCached is true
    const urisToLoad = skipIfCached 
      ? uris.filter(uri => !preloadedImagesCache.has(uri)) 
      : uris;
    
    // If all images are already preloaded, return early
    if (urisToLoad.length === 0) {
      setStatus({
        loaded: true,
        error: null,
        progress: 1,
        completedCount: uris.length,
        totalCount: uris.length,
        timing: {
          startTime: Date.now(),
          endTime: Date.now(),
          duration: 0
        }
      });
      return;
    }

    // Start preloading
    const startTime = Date.now();
    setStatus(prev => ({
      ...prev,
      loaded: false,
      error: null,
      progress: 0,
      completedCount: 0,
      totalCount: urisToLoad.length,
      timing: {
        startTime,
        endTime: null,
        duration: null
      }
    }));

    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`🚀 [${debugLabel}] Starting to preload ${urisToLoad.length} images with priority ${priority}`);
    }

    // Preload function
    const preloadImages = async () => {
      try {
        // Create batches of URIs
        const batches = [];
        for (let i = 0; i < urisToLoad.length; i += batchSize) {
          batches.push(urisToLoad.slice(i, i + batchSize));
        }

        let completedCount = 0;

        // Process each batch
        for (const batch of batches) {
          // Convert to sources format
          const sources: Source[] = batch.map(uri => ({
            uri,
            priority: imagePriority as Priority
          }));
          
          // Use our safe preload function
          await safePreloadImages(sources);

          // Add to cache
          batch.forEach(uri => {
            preloadedImagesCache.set(uri, true);
          });

          // Update progress
          completedCount += batch.length;
          const progress = Math.min(completedCount / urisToLoad.length, 1);
          
          setStatus(prev => ({
            ...prev,
            progress,
            completedCount
          }));

          if (DEBUG_IMAGE_PRELOADER) {
            console.log(`⏱️ [${debugLabel}] Batch completed: ${completedCount}/${urisToLoad.length} (${(progress * 100).toFixed(1)}%)`);
          }
        }

        // All loaded successfully
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        setStatus(prev => ({
          ...prev,
          loaded: true,
          progress: 1,
          completedCount: urisToLoad.length,
          timing: {
            ...prev.timing!,
            endTime,
            duration
          }
        }));

        if (DEBUG_IMAGE_PRELOADER) {
          console.log(`✅ [${debugLabel}] All images preloaded in ${duration}ms using ${isFastImageAvailable ? 'FastImage' : 'Asset'}`);
        }
      } catch (err) {
        // Handle error
        const error = err instanceof Error ? err.message : 'Unknown preloading error';
        
        setStatus(prev => ({
          ...prev,
          loaded: false,
          error,
          timing: {
            ...prev.timing!,
            endTime: Date.now(),
            duration: Date.now() - startTime
          }
        }));

        if (DEBUG_IMAGE_PRELOADER) {
          console.log(`❌ [${debugLabel}] Error preloading images:`, error);
        }
      }
    };

    // Start preloading
    preloadImages();
    
    // Reset the preloading flag when sources change
    return () => {
      preloadingStarted.current = false;
    };
  }, [sources ? JSON.stringify(sources) : '']); // Stringify sources to prevent infinite loops

  return status;
} 