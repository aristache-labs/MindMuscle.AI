import { useState, useEffect, useRef } from 'react';
import {
  ImagePriority,
  safePreloadImages,
  isFastImageAvailable,
  DEBUG_IMAGE_PRELOADER,
  isPlaceholderImage,
  type Source,
  type Priority,
} from '../utils/imagePreloader';
import { useSentryDataCollection } from './useSentryDataCollection';

// Cache for already preloaded images
const preloadedImagesCache = new Map<string, boolean>();

// Types for the hook options
export interface PreloadOptions {
  priority?: 'low' | 'normal' | 'high';
  batchSize?: number;
  debugLabel?: string;
  skipIfCached?: boolean;
  disableSvgLoading?: boolean; // New option to completely skip SVG loading
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
  options: PreloadOptions = {},
): PreloadingStatus {
  // Options with defaults
  const {
    priority = 'normal',
    batchSize = 15,
    debugLabel = 'useImagePreloader',
    skipIfCached = true,
    disableSvgLoading = true, // By default, completely skip SVG loading
  } = options;

  // Use a ref to track if preloading has started to prevent duplicate loading
  const preloadingStarted = useRef(false);

  // Sentry integration
  const sentry = useSentryDataCollection({
    componentName: 'useImagePreloader',
    autoSetUser: false,
  });

  // Convert priority string to appropriate priority
  const imagePriority = (() => {
    switch (priority) {
      case 'low':
        return ImagePriority.LOW;
      case 'high':
        return ImagePriority.HIGH;
      default:
        return ImagePriority.NORMAL;
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
      duration: null,
    },
  });

  // Effect to preload images when sources change
  useEffect(() => {
    // Skip if already started or no sources
    if (preloadingStarted.current || !Array.isArray(sources) || sources.length === 0) {
      if (!Array.isArray(sources) || sources.length === 0) {
        sentry.addBreadcrumb({
          message: 'Image preloader: No sources provided',
          category: 'image-preloader',
          level: 'debug',
          data: { debugLabel },
        });

        setStatus({
          loaded: true,
          error: null,
          progress: 1,
          completedCount: 0,
          totalCount: 0,
          timing: {
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
          },
        });
      }
      return;
    }

    // Mark as started to prevent duplicate loads
    preloadingStarted.current = true;

    // Filter out placeholder images
    const filteredSources = sources.filter((source) => !isPlaceholderImage(source));

    // Process sources into an array of URIs
    const uris = filteredSources
      .map((source) => (typeof source === 'string' ? source : source.uri || ''))
      .filter((uri) => uri && typeof uri === 'string');

    // Filter out SVGs if SVG loading is disabled
    const nonSvgUris = disableSvgLoading ? uris.filter((uri) => !uri.endsWith('.svg')) : uris;

    // Count skipped SVGs
    const skippedSvgCount = uris.length - nonSvgUris.length;

    // Filter out already preloaded images if skipIfCached is true
    const urisToLoad = skipIfCached
      ? nonSvgUris.filter((uri) => !preloadedImagesCache.has(uri))
      : nonSvgUris;

    // Track preloading initialization
    sentry.addBreadcrumb({
      message: 'Image preloader initialized',
      category: 'image-preloader',
      level: 'info',
      data: {
        debugLabel,
        totalSources: sources.length,
        filteredSources: filteredSources.length,
        uris: uris.length,
        nonSvgUris: nonSvgUris.length,
        skippedSvgCount,
        urisToLoad: urisToLoad.length,
        priority,
        batchSize,
        skipIfCached,
        disableSvgLoading,
      },
    });

    sentry.setContext('image_preloader', {
      debugLabel,
      totalSources: sources.length,
      urisToLoad: urisToLoad.length,
      priority,
      batchSize,
      fastImageAvailable: isFastImageAvailable,
    });

    // If all images are already preloaded, return early
    if (urisToLoad.length === 0) {
      const cacheHitDuration = Date.now();

      sentry.trackPerformance('image_preloader_cache_hit', 0, 'ms');

      sentry.addBreadcrumb({
        message: 'All images already cached',
        category: 'image-preloader',
        level: 'info',
        data: {
          debugLabel,
          totalImages: uris.length,
          skippedSvgCount,
        },
      });

      setStatus({
        loaded: true,
        error: null,
        progress: 1,
        // Include SVGs in completed count
        completedCount: uris.length,
        totalCount: uris.length,
        timing: {
          startTime: cacheHitDuration,
          endTime: cacheHitDuration,
          duration: 0,
        },
      });
      return;
    }

    // Start preloading
    const startTime = Date.now();
    setStatus((prev) => ({
      ...prev,
      loaded: false,
      error: null,
      progress: 0,
      completedCount: skippedSvgCount, // Start with SVGs counted as already loaded
      totalCount: uris.length, // Total includes SVGs
      timing: {
        startTime,
        endTime: null,
        duration: null,
      },
    }));

    if (DEBUG_IMAGE_PRELOADER) {
      console.log(
        `🚀 [${debugLabel}] Starting to preload ${urisToLoad.length} images with priority ${priority} (${skippedSvgCount} SVGs skipped)`,
      );
    }

    sentry.addBreadcrumb({
      message: 'Image preloading started',
      category: 'image-preloader',
      level: 'info',
      data: {
        debugLabel,
        imagesToLoad: urisToLoad.length,
        priority,
        skippedSvgCount,
      },
    });

    // Preload function
    const preloadImages = async () => {
      try {
        // Create batches of URIs
        const batches = [];
        for (let i = 0; i < urisToLoad.length; i += batchSize) {
          batches.push(urisToLoad.slice(i, i + batchSize));
        }

        let completedCount = skippedSvgCount; // Start with SVGs counted as completed

        sentry.addBreadcrumb({
          message: 'Processing image batches',
          category: 'image-preloader',
          level: 'debug',
          data: {
            debugLabel,
            batchCount: batches.length,
            batchSize,
          },
        });

        // Process each batch
        for (const [batchIndex, batch] of batches.entries()) {
          const batchStartTime = Date.now();

          try {
            // Convert to sources format
            const sources: Source[] = batch.map((uri) => ({
              uri,
              priority: imagePriority as Priority,
            }));

            // Use our safe preload function
            await safePreloadImages(sources);

            const batchDuration = Date.now() - batchStartTime;

            sentry.trackPerformance(`image_batch_${batchIndex}_duration`, batchDuration, 'ms');

            // Add to cache
            batch.forEach((uri) => {
              preloadedImagesCache.set(uri, true);
            });

            // Update progress
            completedCount += batch.length;
            const progress = Math.min(completedCount / uris.length, 1);

            setStatus((prev) => ({
              ...prev,
              progress,
              completedCount,
            }));

            sentry.addBreadcrumb({
              message: 'Image batch completed',
              category: 'image-preloader',
              level: 'debug',
              data: {
                debugLabel,
                batchIndex: batchIndex + 1,
                totalBatches: batches.length,
                batchSize: batch.length,
                completedCount,
                totalCount: uris.length,
                progress: (progress * 100).toFixed(1),
                batchDuration,
              },
            });

            if (DEBUG_IMAGE_PRELOADER) {
              console.log(
                `⏱️ [${debugLabel}] Batch completed: ${completedCount}/${uris.length} (${(progress * 100).toFixed(1)}%)`,
              );
            }
          } catch (batchError) {
            const batchDuration = Date.now() - batchStartTime;

            sentry.captureException(batchError as Error, {
              image_batch_failed: true,
              debugLabel,
              batchIndex,
              batchSize: batch.length,
              batchDuration,
            });

            // Continue with next batch instead of failing completely
            console.warn(`Batch ${batchIndex} failed, continuing with next batch:`, batchError);
          }
        }

        // All loaded successfully
        const endTime = Date.now();
        const duration = endTime - startTime;

        sentry.trackPerformance('image_preloader_total_duration', duration, 'ms');
        sentry.trackPerformance(
          'image_preloader_images_per_second',
          (urisToLoad.length / duration) * 1000,
          'images/sec',
        );

        setStatus((prev) => ({
          ...prev,
          loaded: true,
          progress: 1,
          completedCount: uris.length, // Total including SVGs
          timing: {
            ...prev.timing!,
            endTime,
            duration,
          },
        }));

        sentry.addBreadcrumb({
          message: 'Image preloading completed successfully',
          category: 'image-preloader',
          level: 'info',
          data: {
            debugLabel,
            totalImages: uris.length,
            loadedImages: urisToLoad.length,
            skippedSvgCount,
            duration,
            imagesPerSecond: ((urisToLoad.length / duration) * 1000).toFixed(2),
            fastImageUsed: isFastImageAvailable,
          },
        });

        sentry.setContext('image_preloader_result', {
          success: true,
          totalImages: uris.length,
          loadedImages: urisToLoad.length,
          duration,
          debugLabel,
        });

        if (DEBUG_IMAGE_PRELOADER) {
          console.log(
            `✅ [${debugLabel}] All images preloaded in ${duration}ms using ${isFastImageAvailable ? 'FastImage' : 'Asset'}`,
          );
        }
      } catch (err) {
        // Handle error
        const error = err instanceof Error ? err.message : 'Unknown preloading error';
        const endTime = Date.now();
        const duration = endTime - startTime;

        sentry.captureException(err as Error, {
          image_preloader_failed: true,
          debugLabel,
          totalImages: uris.length,
          imagesToLoad: urisToLoad.length,
          duration,
        });

        setStatus((prev) => ({
          ...prev,
          loaded: false,
          error,
          timing: {
            ...prev.timing!,
            endTime,
            duration,
          },
        }));

        sentry.addBreadcrumb({
          message: 'Image preloading failed',
          category: 'image-preloader',
          level: 'error',
          data: {
            debugLabel,
            error,
            duration,
            totalImages: uris.length,
            imagesToLoad: urisToLoad.length,
          },
        });

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
