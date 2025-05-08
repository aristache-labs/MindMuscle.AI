import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import React from 'react';

// Add a default export React component to satisfy Expo Router
export default function ImagePreloaderWrapper() {
  // This component is never actually rendered, it's just here to satisfy Expo Router
  return null;
}

// Debug flag - set to false to reduce logging
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
    console.log(`📱 [ImagePreloader] Preloader service: ${isFastImageAvailable ? 'FastImage is available ✅' : 'FastImage is not available ❌'}`);
    if (!isFastImageAvailable) {
      console.log(`📱 [ImagePreloader] Fallback: Using Asset API for preloading in ${Platform.OS === 'web' ? 'web' : 'Expo Go'} environment`);
    }
  }
} catch (e) {
  // FastImage is not available - this is expected in some environments
  FastImage = null;
  isFastImageAvailable = false;
  
  if (DEBUG_IMAGE_PRELOADER) {
    console.log('📱 [ImagePreloader] FastImage import failed (falling back to Asset API)');
    console.log(`📱 [ImagePreloader] Running in Expo Go or unsupported environment`);
  }
}

// Track preloading statistics
let totalImagesPreloaded = 0;
let fastImagePreloadCount = 0;
let assetApiPreloadCount = 0;

// Log preloading statistics periodically if debugging is enabled
if (DEBUG_IMAGE_PRELOADER) {
  setInterval(() => {
    if (totalImagesPreloaded > 0) {
      console.log(`📊 [ImagePreloader] Preloading stats - Total: ${totalImagesPreloaded}, FastImage: ${fastImagePreloadCount} (${Math.round(fastImagePreloadCount/totalImagesPreloaded*100)}%), Asset API: ${assetApiPreloadCount} (${Math.round(assetApiPreloadCount/totalImagesPreloaded*100)}%)`);
    }
  }, 10000);
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
  MAX_SIZE: 400,           // Maximum number of images to keep in memory cache (increased from 200)
  VERSION: '1.0',          // Cache version - increment when images change
  EXPIRY: 7 * 24 * 60 * 60000, // Cache expiry time in ms (7 days instead of 24 hours)
  MAX_DISK_SIZE: 200 * 1024 * 1024, // 200MB max disk cache size (increased from 100MB)
  ESTIMATED_IMAGE_SIZE: 150 * 1024, // 150KB average image size estimation
};

// Strategic preloading levels
export enum PreloadStrategy {
  CRITICAL = 'critical',   // Must load immediately (current screen)
  ANTICIPATORY = 'anticipatory', // Likely to be needed soon (next screens)
  PREFETCH = 'prefetch'    // Load during idle time (future screens)
}

/**
 * Format a URL for display in logs, making it more readable
 * @param url The URL to format
 * @returns A formatted, readable version of the URL
 */
const formatUrlForLogs = (url: string): string => {
  if (!url) return 'unknown';
  
  // Handle Firebase Storage URLs
  if (url.includes('firebasestorage.googleapis.com')) {
    // Extract information from Firebase storage URL
    const pathMatch = url.match(/\/o\/([^?]+)/);
    if (pathMatch && pathMatch[1]) {
      // Decode the URI component to get the actual path
      const decodedPath = decodeURIComponent(pathMatch[1]);
      
      // Split by slashes to get path components
      const pathParts = decodedPath.split('/');
      
      // Extract bucket name, folder path and filename
      const bucketName = pathParts[0] || 'firebase';
      const filename = pathParts.length > 1 ? pathParts[pathParts.length - 1] : decodedPath;
      
      // Check if the path follows a pattern with a user ID
      // Common patterns: bucket-name/folder/user-id/filename or bucket-name/user-id/filename
      if (pathParts.length >= 3) {
        // Skip user ID by checking for UUID pattern in path components
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        
        // Find components that look like UUIDs and filter them out
        const cleanedPathParts = pathParts.slice(1, -1).filter(part => !uuidPattern.test(part));
        
        // Build a cleaner path without user IDs
        if (cleanedPathParts.length > 0) {
          return `FIREBASE - ${bucketName}/${cleanedPathParts.join('/')}/${filename}`;
        }
        
        // If we filtered out everything, just show bucket and filename
        return `FIREBASE - ${bucketName}/${filename}`;
      }
      
      // Simple case - just bucket and filename
      if (pathParts.length === 2) {
        return `FIREBASE - ${bucketName}/${filename}`;
      }
      
      // Fallback to original format
      return `FIREBASE - ${bucketName}/${filename}`;
    }
    
    // Fallback if we can't parse the URL
    return `FIREBASE - ${url.substring(url.lastIndexOf('/') + 1, url.indexOf('?') > 0 ? url.indexOf('?') : undefined)}`;
  }
  
  // Handle Supabase URLs
  if (url.includes('supabase.co')) {
    // Extract the path and filename without query parameters
    const urlParts = url.split('?')[0]; // Remove query parameters
    
    // Extract path components
    const pathParts = urlParts.split('/');
    const filename = pathParts.pop() || ''; // Get the last part (filename)
    
    // Filter out components that look like UUIDs
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cleanedPathParts = pathParts.filter(part => !uuidPattern.test(part));
    
    // Get the last 1-2 relevant path segments
    const relevantPathParts = cleanedPathParts.slice(Math.max(0, cleanedPathParts.length - 2));
    let folderPath = relevantPathParts.join('/');
    
    // Format the folder path nicely
    if (folderPath) {
      if (!folderPath.startsWith('/')) {
        folderPath = '/' + folderPath;
      }
      if (!folderPath.endsWith('/')) {
        folderPath += '/';
      }
    }
    
    return `SUPABASE - ${folderPath}${filename}`;
  }
  
  // For other URLs, just show a truncated version
  return url.length > 40 ? url.substring(0, 40) + '...' : url;
};

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
  if (!Array.isArray(sources) || sources.length === 0) {
    return Promise.resolve();
  }
  
  try {
    // Handle the case when FastImage is available and sources are in the right format
    if (isFastImageAvailable && Platform.OS !== 'web') {
      const validSources = sources.filter(source => {
        // Convert string sources to FastImage-compatible objects
        if (typeof source === 'string') {
          return true;
        }
        // Filter out non-objects and objects without uri
        return typeof source === 'object' && source !== null && 'uri' in source;
      });
      
      // Process sources to ensure they have the right format for FastImage
      const processedSources = validSources.map(source => {
        if (typeof source === 'string') {
          return { uri: source };
        }
        return source;
      });
      
      // Actually call FastImage.preload
      if (processedSources.length > 0) {
        if (DEBUG_IMAGE_PRELOADER) {
          const uris = processedSources.map(s => typeof s === 'object' && s.uri ? formatUrlForLogs(s.uri) : 'unknown');
          console.log(`🔄 [ImagePreloader] Preloading ${processedSources.length} images with FastImage: ${uris.length > 3 ? uris.slice(0, 3).join(', ') + ` and ${uris.length - 3} more` : uris.join(', ')}`);
        }
        
        // Update statistics
        totalImagesPreloaded += processedSources.length;
        fastImagePreloadCount += processedSources.length;
        
        return FastImage.preload(processedSources);
      }
    }
    
    // Fallback to Asset API
    const uris = sources.map(source => {
      if (typeof source === 'string') {
        return source;
      }
      return source.uri || '';
    }).filter(Boolean);
    
    // Use Asset API for preloading
    if (uris.length > 0) {
      if (DEBUG_IMAGE_PRELOADER) {
        const formattedUris = uris.map(uri => formatUrlForLogs(uri));
        console.log(`🔄 [ImagePreloader] Preloading ${uris.length} images with Asset API: ${uris.length > 3 ? formattedUris.slice(0, 3).join(', ') + ` and ${uris.length - 3} more` : formattedUris.join(', ')}`);
      }
      
      // Update statistics
      totalImagesPreloaded += uris.length;
      assetApiPreloadCount += uris.length;
      
      const assets = uris.map(uri => {
        // Handle require() style images
        if (typeof uri === 'number') {
          return Asset.fromModule(uri);
        }
        
        // Handle remote URLs
        return Asset.fromURI(uri);
      });
      
      // Preload all assets in parallel
      const downloadPromises = assets.map(asset => asset.downloadAsync());
      return Promise.all(downloadPromises);
    }
    
    return Promise.resolve();
  } catch (error) {
    console.error('Error preloading images:', error);
    // Still try to preload using Asset API as a double-fallback
    try {
      const uris = sources.map(source => {
        if (typeof source === 'string') {
          return source;
        }
        return source.uri || '';
      }).filter(Boolean);
      
      if (uris.length > 0) {
        if (DEBUG_IMAGE_PRELOADER) {
          const formattedUris = uris.map(uri => formatUrlForLogs(uri));
          console.log(`⚠️ [ImagePreloader] Fallback preloading ${uris.length} images with Asset API after error: ${uris.length > 3 ? formattedUris.slice(0, 3).join(', ') + ` and ${uris.length - 3} more` : formattedUris.join(', ')}`);
        }
        
        // Update statistics
        totalImagesPreloaded += uris.length;
        assetApiPreloadCount += uris.length;
        
        const assets = uris.map(uri => Asset.fromURI(uri));
        const downloadPromises = assets.map(asset => asset.downloadAsync());
        return Promise.all(downloadPromises);
      }
    } catch (secondError) {
      console.error('Double-fallback preloading also failed:', secondError);
    }
    
    return Promise.resolve();
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
    console.log(`🔒 Image marked as important: ${formatUrlForLogs(uri)}`);
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