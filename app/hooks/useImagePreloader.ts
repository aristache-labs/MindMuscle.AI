import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import FastImage, { Source, Priority } from 'react-native-fast-image';
import { Asset } from 'expo-asset';
import { ImagePriority, DEBUG_IMAGE_PRELOADER } from '../utils/imagePreloader';

// Types for the hook options
export interface PreloadOptions {
  priority?: 'low' | 'normal' | 'high';
  batchSize?: number;
  debugLabel?: string;
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
    debugLabel = 'useImagePreloader'
  } = options;

  // Convert priority string to FastImage priority
  const fastImagePriority = (() => {
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
    // Skip if no sources
    if (!sources || sources.length === 0) {
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
      totalCount: sources.length,
      timing: {
        startTime,
        endTime: null,
        duration: null
      }
    }));

    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`🚀 [${debugLabel}] Starting to preload ${sources.length} images with priority ${priority}`);
    }

    // Process sources into an array of URIs
    const uris = sources.map(source => 
      typeof source === 'string' ? source : source.uri
    ).filter(uri => uri && typeof uri === 'string');

    // Preload function
    const preloadImages = async () => {
      try {
        // Create batches of URIs
        const batches = [];
        for (let i = 0; i < uris.length; i += batchSize) {
          batches.push(uris.slice(i, i + batchSize));
        }

        let completedCount = 0;

        // Process each batch
        for (const batch of batches) {
          if (Platform.OS === 'web') {
            // For web, use Asset
            await Promise.allSettled(
              batch.map(uri => Asset.fromURI(uri).downloadAsync())
            );
          } else {
            // For native, use FastImage
            const sources: Source[] = batch.map(uri => ({
              uri,
              priority: fastImagePriority
            }));
            await FastImage.preload(sources);
          }

          // Update progress
          completedCount += batch.length;
          const progress = Math.min(completedCount / uris.length, 1);
          
          setStatus(prev => ({
            ...prev,
            progress,
            completedCount
          }));

          if (DEBUG_IMAGE_PRELOADER) {
            console.log(`⏱️ [${debugLabel}] Batch completed: ${completedCount}/${uris.length} (${(progress * 100).toFixed(1)}%)`);
          }
        }

        // All loaded successfully
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        setStatus(prev => ({
          ...prev,
          loaded: true,
          progress: 1,
          completedCount: uris.length,
          timing: {
            ...prev.timing!,
            endTime,
            duration
          }
        }));

        if (DEBUG_IMAGE_PRELOADER) {
          console.log(`✅ [${debugLabel}] All images preloaded in ${duration}ms`);
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
    
    // No cleanup needed
  }, [sources, priority, batchSize, debugLabel, fastImagePriority]);

  return status;
} 