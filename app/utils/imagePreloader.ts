import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

// Debug flag - Set to true to enable verbose logging
export const DEBUG_IMAGE_PRELOADER = true;

// Safely handle FastImage - dynamically import to prevent crashes
let FastImage: any = null;
export let isFastImageAvailable = false;

// Try to load FastImage dynamically
try {
  FastImage = require('react-native-fast-image').default;
  // Comprehensive check to ensure FastImage is fully usable
  isFastImageAvailable = (
    Platform.OS !== 'web' &&
    typeof FastImage !== 'undefined' && 
    FastImage !== null && 
    typeof FastImage.preload === 'function' &&
    !('bubblingEventTypes' in FastImage) // Check for common error indicator
  );
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`FastImage ${isFastImageAvailable ? 'is' : 'is not'} available for use`);
  }
} catch (e) {
  // FastImage is not available - this is expected in some environments
  FastImage = null;
  isFastImageAvailable = false;
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log('FastImage import failed (this is okay, using fallbacks)');
  }
}

// Define priorities in a way that works even if FastImage is not available
export const ImagePriority = {
  LOW: isFastImageAvailable ? FastImage.priority.low : 'low',
  NORMAL: isFastImageAvailable ? FastImage.priority.normal : 'normal',
  HIGH: isFastImageAvailable ? FastImage.priority.high : 'high'
};

// Define cache policies in a way that works even if FastImage is not available
export const CachePolicy = {
  IMMUTABLE: isFastImageAvailable ? FastImage.cacheControl.immutable : 'immutable',
  WEB: isFastImageAvailable ? FastImage.cacheControl.web : 'web',
  CACHE_ONLY: isFastImageAvailable ? FastImage.cacheControl.cacheOnly : 'cacheOnly'
};

// Type definitions for Source and Priority
export type Priority = 'low' | 'normal' | 'high';
export type Source = { uri: string; priority?: Priority; cache?: string };

// Keep track of already marked images to avoid duplicate processing
const cachedImportantImages = new Set<string>();

/**
 * Safely preload images with automatic fallback to Asset API
 * @param sources Array of image sources to preload
 * @returns Promise that resolves when preloading is complete
 */
export const safePreloadImages = async (
  sources: Source[] | string[]
): Promise<any> => {
  // Early return if sources array is invalid
  if (!sources || !Array.isArray(sources) || sources.length === 0) {
    return Promise.resolve([]);
  }
  
  // Process sources to ensure proper format
  const processedSources = sources.map(source => {
    if (typeof source === 'string') {
      return { uri: source };
    }
    return source;
  });
  
  // Always use Asset for web or when FastImage is unavailable
  if (!isFastImageAvailable) {
    // If FastImage is not available, use Asset
    return Promise.all(
      processedSources.map(source => {
        if (source && source.uri) {
          return Asset.fromURI(source.uri).downloadAsync()
            .catch(err => {
              // Silently continue on individual asset errors
              if (DEBUG_IMAGE_PRELOADER) {
                console.warn(`Asset preload error for ${source.uri}:`, err);
              }
              return null;
            });
        }
        return Promise.resolve(null);
      })
    );
  }
  
  try {
    // Use the native FastImage preloader if available
    return FastImage.preload(processedSources);
  } catch (error) {
    if (DEBUG_IMAGE_PRELOADER) {
      console.warn('Error using FastImage.preload, falling back to Asset:', error);
    }
    
    // Fallback to Asset on error
    return Promise.all(
      processedSources.map(source => {
        if (source && source.uri) {
          return Asset.fromURI(source.uri).downloadAsync()
            .catch(err => {
              // Silently continue on individual asset errors
              return null;
            });
        }
        return Promise.resolve(null);
      })
    );
  }
};

/**
 * Preload a batch of images with progress tracking
 * 
 * @param imageUrls Array of image URLs to preload
 * @param priority Priority level for preloading (default: NORMAL)
 * @param batchSize Number of images to load in parallel (default: 15)
 * @param onProgress Optional callback for tracking progress
 */
export const batchPreloadImages = async (
  imageUrls: string[],
  priority: Priority | any = ImagePriority.NORMAL,
  batchSize = 15,
  onProgress?: (progress: number, completed?: number, total?: number) => void
): Promise<void> => {
  // Early return for empty array
  if (!imageUrls || imageUrls.length === 0) {
    if (onProgress) onProgress(1, 0, 0);
    return;
  }
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`🚀 Batch preloading ${imageUrls.length} images with priority ${priority}...`);
  }
  
  try {
    // Process in smaller batches
    const batches = [];
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      batches.push(imageUrls.slice(i, i + batchSize));
    }
    
    let completedCount = 0;
    
    for (const batch of batches) {
      // Convert URLs to source objects
      const sources: Source[] = batch.map(url => ({ 
        uri: url,
        priority 
      }));
      
      // Use our safe preload function that handles availability and errors
      await safePreloadImages(sources);
      
      completedCount += batch.length;
      
      if (onProgress) {
        const progress = Math.min(completedCount / imageUrls.length, 1);
        onProgress(progress, completedCount, imageUrls.length);
      }
      
      if (DEBUG_IMAGE_PRELOADER) {
        console.log(`⏱️ Preloaded batch: ${completedCount}/${imageUrls.length} images`);
      }
    }
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`✅ Preloaded ${completedCount}/${imageUrls.length} images successfully`);
    }
  } catch (error) {
    console.warn('❌ Error preloading image batch:', error);
  }
  
  if (onProgress) {
    onProgress(1, imageUrls.length, imageUrls.length);
  }
};

/**
 * Utility function to mark important images that should remain in memory
 * @param uri Image URI to mark as important
 */
export const markAsImportantImage = (uri: string): void => {
  if (!uri) return;
  
  // Skip if already marked as important
  if (cachedImportantImages.has(uri)) {
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`⏭️ Already marked as important, skipping: ${uri.substring(0, 40)}${uri.length > 40 ? '...' : ''}`);
    }
    return;
  }
  
  // Add to cache
  cachedImportantImages.add(uri);
  
  // Always use Asset API as the primary method for marking images as important
  try {
    Asset.fromURI(uri).downloadAsync().catch(error => {
      if (DEBUG_IMAGE_PRELOADER) {
        console.warn('❌ Error with Asset preloading in markAsImportantImage:', error);
      }
    });
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`🔒 Marked as important with Asset: ${uri.substring(0, 40)}${uri.length > 40 ? '...' : ''}`);
    }
    
    // Only try FastImage as a secondary method if it's actually available
    if (isFastImageAvailable) {
      try {
        const sources: Source[] = [{
          uri,
          priority: ImagePriority.HIGH
        }];
        
        // Use the FastImage API directly since we already checked availability
        FastImage.preload(sources).catch((err: any) => {
          if (DEBUG_IMAGE_PRELOADER) {
            console.warn('❌ Failed to mark image as important with FastImage:', err);
          }
        });
        
        if (DEBUG_IMAGE_PRELOADER) {
          console.log(`🔒 Also marked as important with FastImage: ${uri.substring(0, 40)}${uri.length > 40 ? '...' : ''}`);
        }
      } catch (fastImageError) {
        // Silently continue if FastImage fails, we already used Asset
        if (DEBUG_IMAGE_PRELOADER) {
          console.warn('❌ FastImage error in markAsImportantImage (non-critical):', fastImageError);
        }
      }
    }
  } catch (error) {
    console.warn('❌ Error marking image as important:', error);
  }
};

/**
 * Clear the FastImage cache
 * Useful when experiencing image loading issues or memory pressure
 */
export const clearImageCache = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    // Web doesn't support direct cache clearing
    return;
  }
  
  if (isFastImageAvailable) {
    try {
      await FastImage.clearMemoryCache();
      await FastImage.clearDiskCache();
      
      if (DEBUG_IMAGE_PRELOADER) {
        console.log('🧹 Image cache cleared');
      }
    } catch (error) {
      console.warn('❌ Error clearing image cache:', error);
    }
  } else {
    if (DEBUG_IMAGE_PRELOADER) {
      console.log('⚠️ Cannot clear cache: FastImage is not available');
    }
  }
}; 