import { Asset } from 'expo-asset';
import FastImage, { Source, Priority } from 'react-native-fast-image';
import { Platform } from 'react-native';

// Debug flag - Set to true to enable verbose logging
export const DEBUG_IMAGE_PRELOADER = true;

// Get a safe reference to the original preload function if available
const isFastImagePreloadAvailable = (): boolean => {
  return (
    typeof FastImage !== 'undefined' && 
    FastImage !== null && 
    typeof FastImage.preload === 'function'
  );
};

// Safely preload images with fallback to Asset API
export const safePreloadImages = (sources: Source[]): Promise<any> => {
  // Use Asset API as fallback for web or when FastImage is unavailable
  if (Platform.OS === 'web' || !isFastImagePreloadAvailable()) {
    if (DEBUG_IMAGE_PRELOADER && !isFastImagePreloadAvailable()) {
      console.warn('FastImage is not available, falling back to Asset for preloading');
    }
    
    if (sources && Array.isArray(sources)) {
      return Promise.all(
        sources.map(source => {
          if (source && source.uri) {
            return Asset.fromURI(source.uri).downloadAsync();
          }
          // Return a resolved promise for undefined URIs
          return Promise.resolve(new Asset({} as any));
        })
      );
    }
    
    // Return a resolved promise if sources are invalid
    return Promise.resolve([]);
  }
  
  try {
    // Call the original preload function
    const result = FastImage.preload(sources);
    
    // Since FastImage.preload may return void or a Promise, we handle both cases
    // We always return a Promise regardless
    return Promise.resolve();
  } catch (error) {
    console.warn('Error using FastImage.preload, falling back to Asset:', error);
    
    // Fallback to Asset on error
    if (sources && Array.isArray(sources)) {
      return Promise.all(
        sources.map(source => {
          if (source && source.uri) {
            return Asset.fromURI(source.uri).downloadAsync();
          }
          return Promise.resolve(new Asset({} as any));
        })
      );
    }
    return Promise.resolve([]);
  }
};

/**
 * Cache priority configuration
 */
export const ImagePriority = {
  LOW: 'low' as Priority,
  NORMAL: 'normal' as Priority,
  HIGH: 'high' as Priority
};

/**
 * Cache configuration for different image types
 */
export const CachePolicy = {
  // Use immutable for static assets that won't change
  IMMUTABLE: FastImage?.cacheControl?.immutable || 'immutable',
  // Use web for dynamic content that updates frequently
  WEB: FastImage?.cacheControl?.web || 'web',
  // Use cacheOnly when offline
  CACHE_ONLY: FastImage?.cacheControl?.cacheOnly || 'cacheOnly'
};

/**
 * Preload a batch of images with priority
 * 
 * @param imageUrls Array of image URLs to preload
 * @param priority Priority level for preloading
 * @param batchSize Number of images to load in parallel
 * @param onProgress Progress callback
 */
export const batchPreloadImages = async (
  imageUrls: string[],
  priority: Priority = ImagePriority.NORMAL,
  batchSize = 15,
  onProgress?: (progress: number, completed?: number, total?: number) => void
): Promise<void> => {
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
      // Convert URLs to FastImage preload format
      const sources: Source[] = batch.map(url => ({ 
        uri: url,
        priority 
      }));
      
      // Check if FastImage is available
      if (!FastImage || typeof FastImage.preload !== 'function') {
        // Use Asset as fallback
        await Promise.all(
          sources.map(source => {
            if (source && source.uri) {
              return Asset.fromURI(source.uri).downloadAsync();
            }
            return Promise.resolve();
          })
        );
      } else {
        await FastImage.preload(sources);
      }
      
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
  
  // Always use Asset API as the primary method for marking images as important
  try {
    Asset.fromURI(uri).downloadAsync().catch(error => {
      console.warn('❌ Error with Asset preloading in markAsImportantImage:', error);
    });
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`🔒 Marked as important with Asset: ${uri.substring(0, 40)}${uri.length > 40 ? '...' : ''}`);
    }
    
    // Only try FastImage as a secondary method if it's safe to do so
    if (Platform.OS !== 'web' && isFastImagePreloadAvailable()) {
      try {
        const sources: Source[] = [{
          uri,
          priority: ImagePriority.HIGH
        }];
        
        // Use our safe preload function that handles errors internally
        safePreloadImages(sources).catch(err => {
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
  
  try {
    if (!FastImage) {
      console.warn('FastImage is not available, cannot clear cache');
      return;
    }
    
    await FastImage.clearMemoryCache();
    await FastImage.clearDiskCache();
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log('🧹 Image cache cleared successfully');
    }
  } catch (error) {
    console.warn('❌ Error clearing image cache:', error);
  }
}; 