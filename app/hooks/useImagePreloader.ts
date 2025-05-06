import { useState, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import { ImageSourcePropType } from 'react-native';
import { isImagePreloaded, preloadSingleImage } from '../utils/imagePreloader';


export interface PreloadingStatus {
  loaded: boolean;
  error: string | null;
  progress: number;
  completedCount: number;
  totalCount: number;
}

interface ImagePreloaderOptions {
  priority?: boolean;
  onProgress?: (progress: number) => void;
}

/**
 * Hook to preload multiple images at once
 * Returns the loading status, error, progress, and counts of the preloading
 */
export function useImagePreloader(
  imageSources: (string | ImageSourcePropType)[], 
  options: ImagePreloaderOptions = { priority: false }
): PreloadingStatus {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  // Calculate preloaded images and total count
  const calculateInitialStatus = useCallback(() => {
    if (!imageSources || imageSources.length === 0) {
      return { preloaded: 0, total: 0 };
    }

    // Count already preloaded images
    let preloadedCount = 0;
    imageSources.forEach(source => {
      if (typeof source !== 'string' || isImagePreloaded(source)) {
        preloadedCount++;
      }
    });

    return { preloaded: preloadedCount, total: imageSources.length };
  }, [imageSources]);

  useEffect(() => {
    let mounted = true;
    
    const preloadImages = async () => {
      // Calculate initial status
      const { preloaded, total } = calculateInitialStatus();
      
      // Update state with initial values
      if (mounted) {
        setTotalCount(total);
        setCompletedCount(preloaded);
        
        // If all images are already preloaded or no images to load
        if (preloaded === total) {
          setLoaded(true);
          setProgress(1);
          if (options.onProgress) options.onProgress(1);
          return;
        }
        
        // Set initial progress based on already preloaded images
        const initialProgress = total > 0 ? preloaded / total : 0;
        setProgress(initialProgress);
        if (options.onProgress) options.onProgress(initialProgress);
      }

      try {
        // Filter out already preloaded images
        const imagesToLoad = imageSources.filter(
          source => typeof source === 'string' && !isImagePreloaded(source)
        );
        
        // Create a function to update progress
        const updateProgress = (increment: number) => {
          if (mounted) {
            setCompletedCount(prev => {
              const newCount = prev + 1;
              setCompletedCount(newCount);
              
              const newProgress = total > 0 ? newCount / total : 1;
              setProgress(newProgress);
              if (options.onProgress) options.onProgress(newProgress);
              
              return newCount;
            });
          }
        };
        
        // High-priority images should load in parallel
        if (options.priority) {
          await Promise.all(
            imagesToLoad.map(async (source) => {
              try {
                if (typeof source === 'string') {
                  await preloadSingleImage(source);
                }
                updateProgress(1);
              } catch (err) {
                console.warn('Error preloading image:', source, err);
                updateProgress(1); // Still increment to avoid getting stuck
              }
            })
          );
        } else {
          // Regular priority: load images sequentially to reduce bandwidth usage
          for (const source of imagesToLoad) {
            try {
              if (typeof source === 'string') {
                await preloadSingleImage(source);
              }
              updateProgress(1);
            } catch (err) {
              console.warn('Error preloading image:', source, err);
              updateProgress(1); // Still increment to avoid getting stuck
            }
          }
        }

        if (mounted) {
          setLoaded(true);
          setProgress(1);
          if (options.onProgress) options.onProgress(1);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to preload images');
          // Still mark as loaded to avoid UI getting stuck
          setLoaded(true);
          setProgress(1);
          if (options.onProgress) options.onProgress(1);
        }
      }
    };

    preloadImages();

    return () => {
      mounted = false;
    };
  }, [imageSources, options.priority, options.onProgress, calculateInitialStatus]);

  return { loaded, error, progress, completedCount, totalCount };
}

export default useImagePreloader; 