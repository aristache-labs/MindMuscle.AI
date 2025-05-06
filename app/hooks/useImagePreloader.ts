import { useState, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import { ImageSourcePropType } from 'react-native';
import { isImagePreloaded, preloadSingleImage } from '../utils/imagePreloader';

// Enable/disable detailed logging
const DEBUG_IMAGE_PRELOADER = true;

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

interface ImagePreloaderOptions {
  priority?: boolean;
  onProgress?: (progress: number) => void;
  debugLabel?: string; // Add a label for tracking specific preloaders
}

/**
 * Hook to preload multiple images at once
 * Returns the loading status, error, progress, and counts of the preloading
 */
export function useImagePreloader(
  imageSources: (string | ImageSourcePropType)[], 
  options: ImagePreloaderOptions = { priority: false, debugLabel: 'unlabeled' }
): PreloadingStatus {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [timing, setTiming] = useState<{
    startTime: number;
    endTime: number | null;
    duration: number | null;
  }>({
    startTime: Date.now(),
    endTime: null,
    duration: null
  });

  // Calculate preloaded images and total count
  const calculateInitialStatus = useCallback(() => {
    if (!imageSources || imageSources.length === 0) {
      if (DEBUG_IMAGE_PRELOADER) {
        console.log(`🔍 [${options.debugLabel}] No images to preload.`);
      }
      return { preloaded: 0, total: 0 };
    }

    // Count already preloaded images
    let preloadedCount = 0;
    imageSources.forEach((source, index) => {
      if (typeof source === 'string') {
        const isPreloaded = isImagePreloaded(source);
        if (isPreloaded && DEBUG_IMAGE_PRELOADER) {
          console.log(`✅ [${options.debugLabel}] Image already preloaded (${index + 1}/${imageSources.length}): ${source.substring(0, 50)}${source.length > 50 ? '...' : ''}`);
        }
        if (isPreloaded) preloadedCount++;
      } else {
        // Non-string sources (require statements) are considered preloaded
        preloadedCount++;
        if (DEBUG_IMAGE_PRELOADER) {
          console.log(`✅ [${options.debugLabel}] Local image already available (${index + 1}/${imageSources.length})`);
        }
      }
    });

    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`📊 [${options.debugLabel}] Initial status: ${preloadedCount}/${imageSources.length} images already preloaded`);
    }

    return { preloaded: preloadedCount, total: imageSources.length };
  }, [imageSources, options.debugLabel]);

  useEffect(() => {
    let mounted = true;
    const startTime = Date.now();
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`🚀 [${options.debugLabel}] Starting image preloading (${imageSources.length} images, priority: ${options.priority ? 'high' : 'normal'})`);
    }

    setTiming({
      startTime,
      endTime: null,
      duration: null
    });
    
    const preloadImages = async () => {
      // Calculate initial status
      const { preloaded, total } = calculateInitialStatus();
      
      // Update state with initial values
      if (mounted) {
        setTotalCount(total);
        setCompletedCount(preloaded);
        
        // If all images are already preloaded or no images to load
        if (preloaded === total) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          if (DEBUG_IMAGE_PRELOADER) {
            console.log(`🏁 [${options.debugLabel}] All images already preloaded (${total} images, 0ms)`);
          }
          
          setLoaded(true);
          setProgress(1);
          setTiming({
            startTime,
            endTime,
            duration
          });
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
        
        if (DEBUG_IMAGE_PRELOADER) {
          console.log(`🔄 [${options.debugLabel}] Preloading ${imagesToLoad.length} images (${preloaded} already preloaded)`);
        }
        
        // Create a function to update progress
        const updateProgress = (increment: number, imageIndex: number, imageUrl: string) => {
          if (mounted) {
            setCompletedCount(prev => {
              const newCount = prev + 1;
              
              if (DEBUG_IMAGE_PRELOADER) {
                const timeElapsed = Date.now() - startTime;
                console.log(`✅ [${options.debugLabel}] Image ${newCount}/${total} loaded (${timeElapsed}ms): ${imageUrl.substring(0, 50)}${imageUrl.length > 50 ? '...' : ''}`);
              }
              
              const newProgress = total > 0 ? newCount / total : 1;
              setProgress(newProgress);
              if (options.onProgress) options.onProgress(newProgress);
              
              // Check if all images are now loaded
              if (newCount === total) {
                const endTime = Date.now();
                const duration = endTime - startTime;
                
                if (DEBUG_IMAGE_PRELOADER) {
                  console.log(`🏁 [${options.debugLabel}] All images preloaded (${total} images, ${duration}ms)`);
                }
                
                setLoaded(true);
                setTiming({
                  startTime,
                  endTime,
                  duration
                });
              }
              
              return newCount;
            });
          }
        };
        
        // High-priority images should load in parallel
        if (options.priority) {
          if (DEBUG_IMAGE_PRELOADER) {
            console.log(`⚡ [${options.debugLabel}] Using parallel loading for ${imagesToLoad.length} high-priority images`);
          }
          
          await Promise.all(
            imagesToLoad.map(async (source, index) => {
              try {
                if (typeof source === 'string') {
                  const startImageTime = Date.now();
                  await preloadSingleImage(source);
                  const imageLoadTime = Date.now() - startImageTime;
                  
                  if (DEBUG_IMAGE_PRELOADER) {
                    console.log(`⏱️ [${options.debugLabel}] Image loaded in ${imageLoadTime}ms`);
                  }
                }
                updateProgress(1, index, typeof source === 'string' ? source : 'local-image');
              } catch (err) {
                console.warn(`❌ [${options.debugLabel}] Error preloading image:`, source, err);
                updateProgress(1, index, typeof source === 'string' ? source : 'local-image'); // Still increment to avoid getting stuck
              }
            })
          );
        } else {
          // Regular priority: load images sequentially to reduce bandwidth usage
          if (DEBUG_IMAGE_PRELOADER) {
            console.log(`🔄 [${options.debugLabel}] Using sequential loading for ${imagesToLoad.length} normal-priority images`);
          }
          
          for (let i = 0; i < imagesToLoad.length; i++) {
            const source = imagesToLoad[i];
            try {
              if (typeof source === 'string') {
                const startImageTime = Date.now();
                await preloadSingleImage(source);
                const imageLoadTime = Date.now() - startImageTime;
                
                if (DEBUG_IMAGE_PRELOADER) {
                  console.log(`⏱️ [${options.debugLabel}] Image ${i + 1}/${imagesToLoad.length} loaded in ${imageLoadTime}ms`);
                }
              }
              updateProgress(1, i, typeof source === 'string' ? source : 'local-image');
            } catch (err) {
              console.warn(`❌ [${options.debugLabel}] Error preloading image:`, source, err);
              updateProgress(1, i, typeof source === 'string' ? source : 'local-image'); // Still increment to avoid getting stuck
            }
          }
        }

        if (mounted) {
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          setLoaded(true);
          setProgress(1);
          setTiming({
            startTime,
            endTime,
            duration
          });
          
          if (DEBUG_IMAGE_PRELOADER) {
            console.log(`🏁 [${options.debugLabel}] Preloading completed in ${duration}ms`);
          }
          
          if (options.onProgress) options.onProgress(1);
        }
      } catch (err) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to preload images');
          
          if (DEBUG_IMAGE_PRELOADER) {
            console.error(`❌ [${options.debugLabel}] Preloading failed after ${duration}ms:`, err);
          }
          
          // Still mark as loaded to avoid UI getting stuck
          setLoaded(true);
          setProgress(1);
          setTiming({
            startTime,
            endTime,
            duration
          });
          if (options.onProgress) options.onProgress(1);
        }
      }
    };

    preloadImages();

    return () => {
      mounted = false;
      
      if (DEBUG_IMAGE_PRELOADER) {
        console.log(`🛑 [${options.debugLabel}] Preloader unmounted after ${Date.now() - startTime}ms`);
      }
    };
  }, [imageSources, options.priority, options.onProgress, options.debugLabel, calculateInitialStatus]);

  return { loaded, error, progress, completedCount, totalCount, timing };
}

export default useImagePreloader; 