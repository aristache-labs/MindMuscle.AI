import { Asset } from 'expo-asset';
import FastImage, { Source, Priority } from 'react-native-fast-image';
import { Platform } from 'react-native';

// Debug flag - Set to true to enable verbose logging
export const DEBUG_IMAGE_PRELOADER = true;

// Configure FastImage global defaults for web compatibility
const originalPreload = FastImage.preload;
FastImage.preload = function(sources: Source[]): void | Promise<Asset[]> {
  if (Platform.OS === 'web') {
    // FastImage is not available on web, use Asset instead
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
  
  return originalPreload(sources);
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
  IMMUTABLE: FastImage.cacheControl.immutable,
  // Use web for dynamic content that updates frequently
  WEB: FastImage.cacheControl.web,
  // Use cacheOnly when offline
  CACHE_ONLY: FastImage.cacheControl.cacheOnly
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
      
      await FastImage.preload(sources);
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
  
  if (Platform.OS === 'web') {
    // Web doesn't support priority caching in the same way
    Asset.fromURI(uri).downloadAsync();
    return;
  }
  
  try {
    // Note: FastImage.priority is causing type issues, so we're preloading with high priority instead
    // which achieves a similar result of keeping the image in memory
    const sources: Source[] = [{
      uri,
      priority: ImagePriority.HIGH
    }];
    
    FastImage.preload(sources);
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`🔒 Marked as important: ${uri.substring(0, 40)}${uri.length > 40 ? '...' : ''}`);
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
    await FastImage.clearMemoryCache();
    await FastImage.clearDiskCache();
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log('🧹 Image cache cleared successfully');
    }
  } catch (error) {
    console.warn('❌ Error clearing image cache:', error);
  }
}; 