import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import React from 'react';

// Add a default export React component to satisfy Expo Router
export default function ImagePreloaderWrapper() {
  // This component is never actually rendered, it's just here to satisfy Expo Router
  return null;
}

// Debug flag - set to false to reduce logging
export const DEBUG_IMAGE_PRELOADER = false;

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
export type Source = { 
  uri: string; 
  priority?: Priority; 
  cache?: string;
  headers?: Record<string, string>;
};

// Keep track of already marked images to avoid duplicate processing
const cachedImportantImages = new Set<string>();

// Cache for preloaded images with timestamps
interface CacheEntry {
  timestamp: number;
  size?: number;
}

// More sophisticated cache
const preloadedImageCache = new Map<string, CacheEntry>();

// Cache statistics
export interface CacheStats {
  totalEntries: number;
  estimatedSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
  hitCount: number;
  missCount: number;
}

// Cache metrics tracking
let cacheHits = 0;
let cacheMisses = 0;
let estimatedCacheSize = 0;

// Cache control parameters
const CACHE_CONFIG = {
  MAX_SIZE: 200,           // Maximum number of images to keep in memory cache
  VERSION: '1.0',          // Cache version - increment when images change
  EXPIRY: 24 * 60 * 60000, // Cache expiry time in ms (24 hours)
  MAX_DISK_SIZE: 100 * 1024 * 1024, // 100MB max disk cache size
  ESTIMATED_IMAGE_SIZE: 150 * 1024, // 150KB average image size estimation
};

// Strategic preloading levels
export enum PreloadStrategy {
  CRITICAL = 'critical',   // Must load immediately (current screen)
  ANTICIPATORY = 'anticipatory', // Likely to be needed soon (next screens)
  PREFETCH = 'prefetch'    // Load during idle time (future screens)
}

/**
 * Add an image to the preload cache with timestamp and size estimation
 * @param uri Image URI to cache
 * @param size Optional estimated size in bytes
 */
export const addImageToCache = (uri: string, size?: number): void => {
  if (!uri) return;
  
  // Don't add duplicates
  if (preloadedImageCache.has(uri)) return;
  
  const estimatedSize = size || CACHE_CONFIG.ESTIMATED_IMAGE_SIZE;
  
  // Add to cache with timestamp
  preloadedImageCache.set(uri, {
    timestamp: Date.now(),
    size: estimatedSize,
  });
  
  // Update estimated total cache size
  estimatedCacheSize += estimatedSize;
  
  // Apply cache size limits
  enforceMemoryCacheLimit();
};

/**
 * Remove old entries if the cache exceeds the maximum size
 */
const enforceMemoryCacheLimit = (): void => {
  // If cache is under the limit, no action needed
  if (preloadedImageCache.size <= CACHE_CONFIG.MAX_SIZE) return;
  
  // Get entries sorted by age (oldest first)
  const entries = Array.from(preloadedImageCache.entries())
    .sort(([, a], [, b]) => a.timestamp - b.timestamp);
  
  // Calculate how many entries to remove
  const entriesToRemove = Math.ceil(preloadedImageCache.size * 0.2); // Remove oldest 20%
  
  // Remove oldest entries
  for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
    const [uri, entry] = entries[i];
    preloadedImageCache.delete(uri);
    estimatedCacheSize -= (entry.size || CACHE_CONFIG.ESTIMATED_IMAGE_SIZE);
  }
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`Cache pruned: removed ${entriesToRemove} oldest entries`);
  }
};

/**
 * Check if an image URI is in the cache and not expired
 * @param uri Image URI to check
 * @returns True if the image is cached and not expired
 */
export const isImageCached = (uri: string): boolean => {
  if (!uri) return false;
  
  const entry = preloadedImageCache.get(uri);
  
  // Not in cache
  if (!entry) {
    cacheMisses++;
    return false;
  }
  
  // Check if expired
  const now = Date.now();
  const isExpired = (now - entry.timestamp) > CACHE_CONFIG.EXPIRY;
  
  if (isExpired) {
    // Remove expired entry
    preloadedImageCache.delete(uri);
    estimatedCacheSize -= (entry.size || CACHE_CONFIG.ESTIMATED_IMAGE_SIZE);
    cacheMisses++;
    return false;
  }
  
  // Valid cache hit
  cacheHits++;
  return true;
};

/**
 * Get current cache statistics
 * @returns Cache statistics object
 */
export const getCacheStats = (): CacheStats => {
  // Find oldest and newest entries
  let oldestTimestamp: number | null = null;
  let newestTimestamp: number | null = null;
  
  for (const entry of preloadedImageCache.values()) {
    if (oldestTimestamp === null || entry.timestamp < oldestTimestamp) {
      oldestTimestamp = entry.timestamp;
    }
    if (newestTimestamp === null || entry.timestamp > newestTimestamp) {
      newestTimestamp = entry.timestamp;
    }
  }
  
  return {
    totalEntries: preloadedImageCache.size,
    estimatedSize: estimatedCacheSize,
    oldestEntry: oldestTimestamp,
    newestEntry: newestTimestamp,
    hitCount: cacheHits,
    missCount: cacheMisses,
  };
};

/**
 * Invalidate cache entries older than a specified time
 * @param maxAge Maximum age in milliseconds
 * @returns Number of entries invalidated
 */
export const invalidateOldCacheEntries = (maxAge: number = CACHE_CONFIG.EXPIRY): number => {
  const now = Date.now();
  let invalidatedCount = 0;
  
  for (const [uri, entry] of preloadedImageCache.entries()) {
    if ((now - entry.timestamp) > maxAge) {
      preloadedImageCache.delete(uri);
      estimatedCacheSize -= (entry.size || CACHE_CONFIG.ESTIMATED_IMAGE_SIZE);
      invalidatedCount++;
    }
  }
  
  return invalidatedCount;
};

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
  
  // Filter out already preloaded images
  const sourcesToLoad = processedSources.filter(source => {
    if (!source || !source.uri) return false;
    
    // Skip if already preloaded and not expired
    if (isImageCached(source.uri)) {
      return false;
    }
    
    // Will be marked as cached after successful loading
    return true;
  });
  
  // Skip if all images are already preloaded
  if (sourcesToLoad.length === 0) {
    return Promise.resolve([]);
  }
  
  // Always use Asset for web or when FastImage is unavailable
  if (!isFastImageAvailable) {
    // If FastImage is not available, use Asset
    const results = await Promise.all(
      sourcesToLoad.map(source => {
        if (source && source.uri) {
          return Asset.fromURI(source.uri).downloadAsync()
            .then(asset => {
              // Add to cache after successful loading
              addImageToCache(source.uri);
              return asset;
            })
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
    
    return results;
  }
  
  try {
    // Add cache headers and version control parameters to each source
    const sourcesWithCacheControl = sourcesToLoad.map(source => {
      if (source && source.uri) {
        // Add cache control headers for network requests
        const uri = source.uri.includes('?') 
          ? `${source.uri}&v=${CACHE_CONFIG.VERSION}` 
          : `${source.uri}?v=${CACHE_CONFIG.VERSION}`;
        
        return {
          ...source, 
          uri,
          headers: {
            ...source.headers,
            'Cache-Control': 'max-age=31536000', // 1 year
            'Pragma': 'cache'
          }
        };
      }
      return source;
    });
    
    // Use the native FastImage preloader if available
    const result = await FastImage.preload(sourcesWithCacheControl);
    
    // Add all successfully loaded images to cache
    sourcesToLoad.forEach(source => {
      if (source && source.uri) {
        addImageToCache(source.uri);
      }
    });
    
    return result;
  } catch (error) {
    if (DEBUG_IMAGE_PRELOADER) {
      console.warn('Error using FastImage.preload, falling back to Asset:', error);
    }
    
    // Fallback to Asset on error
    const results = await Promise.all(
      sourcesToLoad.map(source => {
        if (source && source.uri) {
          return Asset.fromURI(source.uri).downloadAsync()
            .then(asset => {
              // Add to cache after successful loading
              addImageToCache(source.uri);
              return asset;
            })
            .catch(err => {
              // Silently continue on individual asset errors
              return null;
            });
        }
        return Promise.resolve(null);
      })
    );
    
    return results;
  }
};

/**
 * Preload a batch of images with progress tracking and strategic priority
 * 
 * @param imageUrls Array of image URLs to preload
 * @param strategy Preload strategy determining priority and batch size
 * @param batchSize Number of images to load in parallel (default: based on strategy)
 * @param onProgress Optional callback for tracking progress
 */
export const strategicPreloadImages = async (
  imageUrls: string[],
  strategy: PreloadStrategy = PreloadStrategy.ANTICIPATORY,
  batchSize?: number,
  onProgress?: (progress: number, completed?: number, total?: number) => void
): Promise<void> => {
  // Early return for empty array
  if (!imageUrls || imageUrls.length === 0) {
    if (onProgress) onProgress(1, 0, 0);
    return;
  }
  
  // Filter out already preloaded images that aren't expired
  const urlsToLoad = imageUrls.filter(url => !isImageCached(url));
  
  // Skip if all images are already preloaded
  if (urlsToLoad.length === 0) {
    if (onProgress) onProgress(1, imageUrls.length, imageUrls.length);
    return;
  }
  
  // Set priority and batch size based on strategy
  let priority: Priority;
  let defaultBatchSize: number;
  
  switch (strategy) {
    case PreloadStrategy.CRITICAL:
      priority = 'high';
      defaultBatchSize = 5; // Smaller batches for critical images
      break;
    case PreloadStrategy.PREFETCH:
      priority = 'low';
      defaultBatchSize = 20; // Larger batches for background prefetching
      break;
    case PreloadStrategy.ANTICIPATORY:
    default:
      priority = 'normal';
      defaultBatchSize = 10;
  }
  
  // Use provided batch size or default based on strategy
  const actualBatchSize = batchSize || defaultBatchSize;
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`🚀 Strategic preloading (${strategy}): ${urlsToLoad.length} images with priority ${priority}...`);
  }
  
  // Create batches of URLs to load
  const batches: string[][] = [];
  for (let i = 0; i < urlsToLoad.length; i += actualBatchSize) {
    batches.push(urlsToLoad.slice(i, i + actualBatchSize));
  }
  
  let completedUrls = 0;
  
  // Process batches sequentially to avoid overwhelming the device
  for (const batch of batches) {
    // Create Source objects for preloading
    const sources = batch.map(uri => ({
      uri,
      priority: priority as Priority
    }));
    
    // Use our safe preload function
    await safePreloadImages(sources);
    
    // Update progress
    completedUrls += batch.length;
    const progress = Math.min(completedUrls / urlsToLoad.length, 1);
    
    if (onProgress) {
      onProgress(progress, completedUrls, urlsToLoad.length);
    }
    
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`⏱️ Batch completed: ${completedUrls}/${urlsToLoad.length} (${(progress * 100).toFixed(1)}%)`);
    }
  }
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`✅ Strategic preloading complete: ${completedUrls} images`);
  }
};

// Keep batchPreloadImages for backward compatibility
export const batchPreloadImages = strategicPreloadImages;

/**
 * Mark an image URL as important to ensure it stays in cache longer
 * @param uri The image URI to mark as important
 */
export const markAsImportantImage = (uri: string): void => {
  if (!uri) return;
  
  // Prevent duplicate processing
  if (cachedImportantImages.has(uri)) {
    return;
  }
  
  // Add to important images set
  cachedImportantImages.add(uri);
  
  // Make sure it's in the cache with a fresh timestamp (to prevent expiry)
  // and a zero size (indicating it should not be purged during cache cleanup)
  if (!preloadedImageCache.has(uri)) {
    addImageToCache(uri, 0); // Zero size means "do not purge"
  }
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`🔒 Image marked as important: ${uri}`);
  }
};

/**
 * Clear all image caches (memory and disk)
 * @param options Options for cache clearing
 * @returns Promise that resolves when clearing is complete
 */
export const clearImageCache = async (options?: {
  memoryOnly?: boolean;
  diskOnly?: boolean;
  olderThan?: number;
}): Promise<{ memoryClearedCount: number; diskCleaned: boolean }> => {
  const { memoryOnly = false, diskOnly = false, olderThan } = options || {};
  let memoryClearedCount = 0;
  let diskCleaned = false;
  
  // Clear memory cache
  if (!diskOnly) {
    if (olderThan) {
      // Only clear items older than specified time
      memoryClearedCount = invalidateOldCacheEntries(olderThan);
    } else {
      // Clear entire memory cache
      memoryClearedCount = preloadedImageCache.size;
      preloadedImageCache.clear();
      estimatedCacheSize = 0;
      cachedImportantImages.clear();
    }
    
    // Reset cache metrics
    if (!olderThan) {
      cacheHits = 0;
      cacheMisses = 0;
    }
  }
  
  // Clear disk cache if platform supports it
  if (!memoryOnly && isFastImageAvailable && Platform.OS !== 'web') {
    try {
      // Clear FastImage disk cache
      await FastImage.clearDiskCache();
      diskCleaned = true;
      
      if (DEBUG_IMAGE_PRELOADER) {
        console.log('FastImage disk cache cleared successfully');
      }
    } catch (error) {
      if (DEBUG_IMAGE_PRELOADER) {
        console.warn('Error clearing FastImage disk cache:', error);
      }
    }
    
    // Also clear Expo Asset cache if available
    try {
      // Asset.clearCache() doesn't exist in all versions
      // We need to use a different approach for clearing Expo Asset cache
      // This will vary based on Expo version, and we may need app restart
      if (DEBUG_IMAGE_PRELOADER) {
        console.log('Note: Expo Asset cache cannot be programmatically cleared in all versions');
      }
    } catch (error) {
      if (DEBUG_IMAGE_PRELOADER) {
        console.warn('Error handling Expo Asset cache:', error);
      }
    }
  }
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`Image cache cleared: ${memoryClearedCount} memory entries, disk cache ${diskCleaned ? 'cleared' : 'unchanged'}`);
  }
  
  return { memoryClearedCount, diskCleaned };
}; 