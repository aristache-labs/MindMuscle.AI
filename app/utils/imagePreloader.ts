import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import { Image } from 'expo-image';
import { loggers } from './debugHelpers';

// Get the image preloader logger
const log = loggers.imagePreloader;

// Add a default export React component to satisfy Expo Router
export default function ImagePreloaderWrapper() {
  // This component is never actually rendered, it's just here to satisfy Expo Router
  return null;
}

// Debug flag - set to false to reduce logging
export const DEBUG_IMAGE_PRELOADER = false;

// Define types for global object extensions
interface GlobalWithPreloadedAssets {
  preloadedSvgAssets?: {
    bodyFront: number;
    bodyBack: number;
    timestamp: number;
  };
}

// Define proper types for FastImage
interface FastImageStatic {
  preload: (sources: Array<{ uri: string; priority?: string }>) => Promise<void>;
  clearDiskCache: () => Promise<void>;
  priority: {
    low: string;
    normal: string;
    high: string;
  };
}

// Safely handle FastImage - dynamically import to prevent crashes
let FastImage: FastImageStatic | null = null;
export let isFastImageAvailable = false;

// Helper function to safely get FastImage
const getFastImageModule = (): FastImageStatic | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fastImageModule = require('react-native-fast-image');
    return fastImageModule.default as FastImageStatic;
  } catch {
    return null;
  }
};

// Helper function to initialize FastImage
const initializeFastImage = (): void => {
  try {
    FastImage = getFastImageModule();

    // Comprehensive check to ensure FastImage is fully usable
    isFastImageAvailable =
      Platform.OS !== 'web' &&
      typeof FastImage !== 'undefined' &&
      FastImage !== null &&
      typeof FastImage.preload === 'function';

    log.debug(
      'Preloader service initialization',
      () =>
        `${isFastImageAvailable ? 'FastImage is available ✅' : 'FastImage is not available ❌'}`,
    );

    if (!isFastImageAvailable) {
      log.debug(
        'Fallback configuration',
        () =>
          `Using Asset API for preloading in ${Platform.OS === 'web' ? 'web' : 'Expo Go'} environment`,
      );
    }
  } catch {
    // FastImage is not available - this is expected in some environments
    FastImage = null;
    isFastImageAvailable = false;

    log.debug('FastImage import failed (falling back to Asset API)');
    log.debug('Running in Expo Go or unsupported environment');
  }
};

// Initialize FastImage
initializeFastImage();

// Track preloading statistics
let totalImagesPreloaded = 0;
let fastImagePreloadCount = 0;
let assetApiPreloadCount = 0;

// Log preloading statistics periodically if debugging is enabled
if (log.isDebugging()) {
  setInterval(() => {
    if (totalImagesPreloaded > 0) {
      log.debug('Preloading stats', () => ({
        total: totalImagesPreloaded,
        fastImage: {
          count: fastImagePreloadCount,
          percentage: Math.round((fastImagePreloadCount / totalImagesPreloaded) * 100),
        },
        assetApi: {
          count: assetApiPreloadCount,
          percentage: Math.round((assetApiPreloadCount / totalImagesPreloaded) * 100),
        },
      }));
    }
  }, 10000);
}

// Define priorities in a way that works even if FastImage is not available
export const ImagePriority = {
  LOW: 'low' as const,
  NORMAL: 'normal' as const,
  HIGH: 'high' as const,
};

// Helper function to get FastImage priority if available
const _getFastImagePriority = (priority: 'low' | 'normal' | 'high'): string => {
  if (isFastImageAvailable && FastImage?.priority) {
    switch (priority) {
      case 'low':
        return FastImage.priority.low;
      case 'normal':
        return FastImage.priority.normal;
      case 'high':
        return FastImage.priority.high;
      default:
        return FastImage.priority.normal;
    }
  }
  return priority;
};

// Define cache policies for expo-image
export const CachePolicy = {
  IMMUTABLE: 'immutable',
  WEB: 'web',
  CACHE_ONLY: 'cacheOnly',
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
  MAX_SIZE: 400, // Maximum number of images to keep in memory cache (increased from 200)
  VERSION: '1.0', // Cache version - increment when images change
  EXPIRY: 7 * 24 * 60 * 60000, // Cache expiry time in ms (7 days instead of 24 hours)
  MAX_DISK_SIZE: 200 * 1024 * 1024, // 200MB max disk cache size (increased from 100MB)
  ESTIMATED_IMAGE_SIZE: 150 * 1024, // 150KB average image size estimation
};

// Strategic preloading levels
export enum PreloadStrategy {
  CRITICAL = 'critical', // Must load immediately (current screen)
  ANTICIPATORY = 'anticipatory', // Likely to be needed soon (next screens)
  PREFETCH = 'prefetch', // Load during idle time (future screens)
}

// Add a set to track preloaded SVGs
export const preloadedSvgs = new Set<string>();

// Define SVG paths for muscle groups with static requires to prevent dynamic require errors
export const MUSCLE_SVG_ASSETS = {
  front: require('../../assets/exercises/body_front.svg'),
  back: require('../../assets/exercises/body_back.svg'),
  // Add other muscle SVGs if they exist in your assets
};

/**
 * Safely check if an asset exists and return it
 * This avoids the dynamic require issue by using static requires
 * @param assetType The type of asset to load ('front', 'back', etc.)
 * @returns The asset module or null if not found
 */
export const getSvgAsset = (assetType: 'front' | 'back'): number | null => {
  try {
    return MUSCLE_SVG_ASSETS[assetType] || null;
  } catch (e) {
    console.warn(`Could not get SVG asset: ${assetType}`, e);
    return null;
  }
};

// Helper function to format URL for display in logs
const formatUrlForLogs = (url: string): string => {
  if (!url) return 'unknown';

  return formatFirebaseUrl(url) || formatSupabaseUrl(url) || formatGenericUrl(url);
};

// Helper function to format Firebase URLs
const formatFirebaseUrl = (url: string): string | null => {
  if (!url.includes('firebasestorage.googleapis.com')) return null;

  const pathMatch = url.match(/\/o\/([^?]+)/);
  if (!pathMatch?.[1]) {
    return `FIREBASE - ${url.substring(url.lastIndexOf('/') + 1, url.indexOf('?') > 0 ? url.indexOf('?') : undefined)}`;
  }

  const decodedPath = decodeURIComponent(pathMatch[1]);
  const pathParts = decodedPath.split('/');
  const bucketName = pathParts[0] || 'firebase';
  const filename = pathParts.length > 1 ? pathParts[pathParts.length - 1] : decodedPath;

  if (pathParts.length >= 3) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const cleanedPathParts = pathParts.slice(1, -1).filter((part) => !uuidPattern.test(part));

    if (cleanedPathParts.length > 0) {
      return `FIREBASE - ${bucketName}/${cleanedPathParts.join('/')}/${filename}`;
    }
    return `FIREBASE - ${bucketName}/${filename}`;
  }

  return `FIREBASE - ${bucketName}/${filename}`;
};

// Helper function to format Supabase URLs
const formatSupabaseUrl = (url: string): string | null => {
  if (!url.includes('supabase.co')) return null;

  const urlParts = url.split('?')[0];
  const pathParts = urlParts.split('/');
  const filename = pathParts.pop() || '';

  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const cleanedPathParts = pathParts.filter((part) => !uuidPattern.test(part));
  const relevantPathParts = cleanedPathParts.slice(Math.max(0, cleanedPathParts.length - 2));

  let folderPath = relevantPathParts.join('/');
  if (folderPath) {
    if (!folderPath.startsWith('/')) folderPath = '/' + folderPath;
    if (!folderPath.endsWith('/')) folderPath += '/';
  }

  return `SUPABASE - ${folderPath}${filename}`;
};

// Helper function to format generic URLs
const formatGenericUrl = (url: string): string => {
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
  const entries = Array.from(preloadedImageCache.entries()).sort(
    ([, a], [, b]) => a.timestamp - b.timestamp,
  );

  // Calculate how many entries to remove
  const entriesToRemove = Math.ceil(preloadedImageCache.size * 0.2); // Remove oldest 20%

  // Remove oldest entries
  for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
    const [uri, entry] = entries[i];
    preloadedImageCache.delete(uri);
    estimatedCacheSize -= entry.size || CACHE_CONFIG.ESTIMATED_IMAGE_SIZE;
  }

  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`Cache pruned: removed ${entriesToRemove} oldest entries`);
  }
};

/**
 * Check if an image URI is in the cache and not expired
 * @param uri Image URI to check
 * @returns Promise that resolves to true if the image is cached and not expired
 */
export const isImageCached = async (uri: string): Promise<boolean> => {
  if (!uri) return Promise.resolve(false);

  const entry = preloadedImageCache.get(uri);

  // Not in cache
  if (!entry) {
    cacheMisses++;
    return Promise.resolve(false);
  }

  // Check if expired
  const now = Date.now();
  const isExpired = now - entry.timestamp > CACHE_CONFIG.EXPIRY;

  if (isExpired) {
    // Remove expired entry
    preloadedImageCache.delete(uri);
    estimatedCacheSize -= entry.size || CACHE_CONFIG.ESTIMATED_IMAGE_SIZE;
    cacheMisses++;
    return Promise.resolve(false);
  }

  // Valid cache hit
  cacheHits++;
  return Promise.resolve(true);
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
    if (now - entry.timestamp > maxAge) {
      preloadedImageCache.delete(uri);
      estimatedCacheSize -= entry.size || CACHE_CONFIG.ESTIMATED_IMAGE_SIZE;
      invalidatedCount++;
    }
  }

  return invalidatedCount;
};

// Define a proper type for placeholder image sources
interface PlaceholderImageSource {
  testUri?: string;
  uri?: string | null;
}

// Check if a source is a placeholder image with a stable reference
export const isPlaceholderImage = (source: unknown): source is PlaceholderImageSource => {
  return (
    typeof source === 'object' &&
    source !== null &&
    'testUri' in source &&
    Boolean((source as PlaceholderImageSource).testUri) &&
    (!(source as PlaceholderImageSource).uri || (source as PlaceholderImageSource).uri === null)
  );
};

// Helper function to process source for FastImage compatibility
const processSourceForFastImage = (source: Source | string): { uri: string } | null => {
  if (typeof source === 'string') {
    return { uri: source };
  }
  if (typeof source === 'object' && source !== null && 'uri' in source && source.uri) {
    return { uri: source.uri };
  }
  return null;
};

// Helper function to process sources for FastImage preloading
const prepareFastImageSources = (sources: (Source | string)[]): { uri: string }[] => {
  return sources
    .map(processSourceForFastImage)
    .filter((source): source is { uri: string } => source !== null);
};

// Helper function to extract URIs from sources
const extractUrisFromSources = (sources: (Source | string)[]): string[] => {
  return sources
    .map((source) => {
      if (typeof source === 'string') {
        return source;
      }
      return source?.uri || '';
    })
    .filter(Boolean);
};

// Helper function to preload with FastImage
const preloadWithFastImage = async (sources: (Source | string)[]): Promise<void> => {
  if (!isFastImageAvailable || !FastImage) {
    throw new Error('FastImage not available');
  }

  const processedSources = prepareFastImageSources(sources);
  if (processedSources.length === 0) {
    return;
  }

  if (DEBUG_IMAGE_PRELOADER) {
    const uris = processedSources.map((s) => formatUrlForLogs(s.uri));
    console.log(
      `🔄 [ImagePreloader] Preloading ${processedSources.length} images with FastImage: ${
        uris.length > 3
          ? uris.slice(0, 3).join(', ') + ` and ${uris.length - 3} more`
          : uris.join(', ')
      }`,
    );
  }

  totalImagesPreloaded += processedSources.length;
  fastImagePreloadCount += processedSources.length;

  return FastImage.preload(processedSources);
};

// Helper function to preload with Asset API
const preloadWithAssetApi = async (sources: (Source | string)[]): Promise<void> => {
  const uris = extractUrisFromSources(sources);
  if (uris.length === 0) {
    return;
  }

  if (DEBUG_IMAGE_PRELOADER) {
    const formattedUris = uris.map((uri) => formatUrlForLogs(uri));
    console.log(
      `🔄 [ImagePreloader] Preloading ${uris.length} images with Asset API: ${
        formattedUris.length > 3
          ? formattedUris.slice(0, 3).join(', ') + ` and ${formattedUris.length - 3} more`
          : formattedUris.join(', ')
      }`,
    );
  }

  totalImagesPreloaded += uris.length;
  assetApiPreloadCount += uris.length;

  const assets = uris.map((uri) => {
    if (typeof uri === 'number') {
      return Asset.fromModule(uri);
    }
    return Asset.fromURI(uri);
  });

  const downloadPromises = assets.map((asset) => asset.downloadAsync());
  await Promise.all(downloadPromises);
};

/**
 * Safely preload images with automatic fallback to Asset API
 * @param sources Array of image sources to preload
 * @returns Promise that resolves when preloading is complete
 */
export const safePreloadImages = async (sources: Source[] | string[]): Promise<void> => {
  if (!Array.isArray(sources) || sources.length === 0) {
    return;
  }

  try {
    const filteredSources = sources.filter((source) => !isPlaceholderImage(source));
    if (filteredSources.length === 0) {
      return;
    }

    // Try FastImage first if available
    if (isFastImageAvailable && Platform.OS !== 'web') {
      try {
        await preloadWithFastImage(filteredSources);
        return;
      } catch (fastImageError) {
        console.warn('FastImage preloading failed, falling back to Asset API:', fastImageError);
      }
    }

    // Fallback to Asset API
    await preloadWithAssetApi(filteredSources);
  } catch (error) {
    console.error('Error preloading images:', error);

    // Double-fallback to Asset API
    try {
      await preloadWithAssetApi(sources);
    } catch (secondError) {
      console.error('Double-fallback preloading also failed:', secondError);
    }
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
  onProgress?: (progress: number, completed?: number, total?: number) => void,
): Promise<void> => {
  if (!imageUrls || imageUrls.length === 0) {
    if (onProgress) onProgress(1, 0, 0);
    return;
  }

  const urlsToLoad = await filterCachedImages(imageUrls);
  if (urlsToLoad.length === 0) {
    if (onProgress) onProgress(1, imageUrls.length, imageUrls.length);
    return;
  }

  const { priority, actualBatchSize } = getStrategyConfig(strategy, batchSize);

  if (DEBUG_IMAGE_PRELOADER) {
    console.log(
      `🚀 Strategic preloading (${strategy}): ${urlsToLoad.length} images with priority ${priority}...`,
    );
  }

  await processBatchedPreloading(urlsToLoad, actualBatchSize, priority, onProgress);

  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`✅ Strategic preloading complete: ${urlsToLoad.length} images`);
  }
};

// Helper function to filter out cached images
const filterCachedImages = async (imageUrls: string[]): Promise<string[]> => {
  const filterPromises = imageUrls.map(async (url) => {
    const cached = await isImageCached(url);
    return cached ? null : url;
  });

  const results = await Promise.all(filterPromises);
  return results.filter((url): url is string => url !== null);
};

// Helper function to get strategy configuration
const getStrategyConfig = (
  strategy: PreloadStrategy,
  batchSize?: number,
): { priority: Priority; actualBatchSize: number } => {
  let priority: Priority;
  let defaultBatchSize: number;

  switch (strategy) {
    case PreloadStrategy.CRITICAL:
      priority = 'high';
      defaultBatchSize = 5;
      break;
    case PreloadStrategy.PREFETCH:
      priority = 'low';
      defaultBatchSize = 20;
      break;
    case PreloadStrategy.ANTICIPATORY:
    default:
      priority = 'normal';
      defaultBatchSize = 10;
  }

  return { priority, actualBatchSize: batchSize || defaultBatchSize };
};

// Helper function to process batched preloading
const processBatchedPreloading = async (
  urlsToLoad: string[],
  batchSize: number,
  priority: Priority,
  onProgress?: (progress: number, completed?: number, total?: number) => void,
): Promise<void> => {
  const batches: string[][] = [];
  for (let i = 0; i < urlsToLoad.length; i += batchSize) {
    batches.push(urlsToLoad.slice(i, i + batchSize));
  }

  let completedUrls = 0;

  for (const batch of batches) {
    const sources = batch.map((uri) => ({ uri, priority }));
    await safePreloadImages(sources);

    completedUrls += batch.length;
    const progress = Math.min(completedUrls / urlsToLoad.length, 1);

    if (onProgress) {
      onProgress(progress, completedUrls, urlsToLoad.length);
    }

    if (DEBUG_IMAGE_PRELOADER) {
      console.log(
        `⏱️ Batch completed: ${completedUrls}/${urlsToLoad.length} (${(progress * 100).toFixed(1)}%)`,
      );
    }
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
    memoryClearedCount = clearMemoryCache(olderThan);
  }

  // Clear disk cache if platform supports it
  if (!memoryOnly) {
    diskCleaned = await clearDiskCache();
  }

  if (DEBUG_IMAGE_PRELOADER) {
    console.log(
      `Image cache cleared: ${memoryClearedCount} memory entries, disk cache ${diskCleaned ? 'cleared' : 'unchanged'}`,
    );
  }

  return { memoryClearedCount, diskCleaned };
};

// Helper function to clear memory cache
const clearMemoryCache = (olderThan?: number): number => {
  let memoryClearedCount = 0;

  if (olderThan) {
    memoryClearedCount = invalidateOldCacheEntries(olderThan);
  } else {
    memoryClearedCount = preloadedImageCache.size;
    preloadedImageCache.clear();
    estimatedCacheSize = 0;
    cachedImportantImages.clear();
    cacheHits = 0;
    cacheMisses = 0;
  }

  return memoryClearedCount;
};

// Helper function to clear disk cache
const clearDiskCache = async (): Promise<boolean> => {
  if (!isFastImageAvailable || !FastImage || Platform.OS === 'web') {
    return false;
  }

  try {
    await FastImage.clearDiskCache();
    if (DEBUG_IMAGE_PRELOADER) {
      console.log('FastImage disk cache cleared successfully');
    }
    return true;
  } catch (error) {
    if (DEBUG_IMAGE_PRELOADER) {
      console.warn('Error clearing FastImage disk cache:', error);
    }
    return false;
  }
};

// Default timeout for image loading
const DEFAULT_TIMEOUT = 15000; // 15 seconds

// Types for image preloading
type ImageSource = number | string | { uri: string; headers?: Record<string, string> };

interface PreloadOptions {
  cachePolicy?: string;
  timeout?: number;
  _priority?: 'low' | 'normal' | 'high'; // Prefix with underscore to indicate unused
  batchSize?: number;
  onProgress?: (progress: PreloadProgress) => void;
  estimatedSizes?: Record<number, number>;
}

interface PreloadProgress {
  total: number;
  loaded: number;
  failed: number;
  skipped: number;
  progress: number;
}

interface PreloadResult {
  success: boolean;
  total: number;
  loaded: number;
  failed: number;
  skipped: number;
  error?: Error;
}

// Helper function to extract URI from ImageSource
const extractUriFromImageSource = (source: ImageSource): string | null => {
  if (typeof source === 'object' && source !== null && 'uri' in source && source.uri) {
    return source.uri;
  }
  if (typeof source === 'string') {
    return source;
  }
  return null;
};

// Process image source to a format that expo-image can use
const processImageSource = (source: ImageSource): ImageSource | null => {
  if (!source) return null;

  // If source is already a number (require statement) or a string, return as is
  if (typeof source === 'number' || typeof source === 'string') {
    return source;
  }

  // If source is an object with a uri, return it
  if (typeof source === 'object' && 'uri' in source) {
    return source;
  }

  // If we couldn't process it, return null
  return null;
};

// Helper function to handle preload success
const handlePreloadSuccess = (
  uri: string,
  index: number,
  estimatedSizes?: Record<number, number>,
): 'loaded' => {
  const size = estimatedSizes?.[index];
  addImageToCache(uri, size);

  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`✅ Preloaded: ${formatUrlForLogs(uri)}`);
  }

  return 'loaded';
};

// Helper function to handle preload error
const handlePreloadError = (source: ImageSource, error: unknown): 'failed' => {
  if (DEBUG_IMAGE_PRELOADER) {
    const uri =
      source !== null && typeof source === 'object' && 'uri' in source && source.uri
        ? source.uri
        : String(source);
    console.log(`❌ Failed to preload: ${formatUrlForLogs(uri)}`, error);
  }
  return 'failed';
};

// Helper function to check if image should be skipped
const shouldSkipImage = async (source: ImageSource, _index: number): Promise<boolean> => {
  if (!source || (typeof source === 'object' && !source.uri)) {
    return true;
  }

  const uri = typeof source === 'object' && source.uri ? source.uri : String(source);
  return await isImageCached(uri);
};

// Helper function to preload single image with expo-image
const preloadSingleImage = async (
  source: ImageSource,
  index: number,
  timeout: number,
  estimatedSizes?: Record<number, number>,
): Promise<'loaded' | 'failed' | 'skipped'> => {
  try {
    if (await shouldSkipImage(source, index)) {
      if (DEBUG_IMAGE_PRELOADER) {
        const uri = extractUriFromImageSource(source) || String(source);
        console.log(`⚡ Already cached: ${formatUrlForLogs(uri)}`);
      }
      return 'skipped';
    }

    const uri = extractUriFromImageSource(source);
    if (!uri) {
      return 'failed';
    }

    // Preload using expo-image with timeout
    await Promise.race([
      Image.prefetch(uri),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Preload timeout')), timeout)),
    ]);

    return handlePreloadSuccess(uri, index, estimatedSizes);
  } catch (error) {
    return handlePreloadError(source, error);
  }
};

// Helper function to process batch results
const processBatchResults = (
  results: ('loaded' | 'failed' | 'skipped')[],
  total: number,
  onProgress?: (progress: PreloadProgress) => void,
): { loaded: number; failed: number; skipped: number } => {
  const loaded = results.filter((r) => r === 'loaded').length;
  const failed = results.filter((r) => r === 'failed').length;
  const skipped = results.filter((r) => r === 'skipped').length;

  if (onProgress) {
    onProgress({
      total,
      loaded,
      failed,
      skipped,
      progress: (loaded + failed + skipped) / total,
    });
  }

  return { loaded, failed, skipped };
};

/**
 * Preload images using expo-image
 * @param sources Array of image sources to preload
 * @param options Optional configuration
 */
export const preloadImages = async (
  sources: ImageSource[],
  options: PreloadOptions = {},
): Promise<PreloadResult> => {
  if (!sources || sources.length === 0) {
    return { success: true, total: 0, loaded: 0, failed: 0, skipped: 0 };
  }

  const {
    cachePolicy = CachePolicy.IMMUTABLE,
    timeout = DEFAULT_TIMEOUT,
    batchSize = 5,
    onProgress,
    estimatedSizes,
  } = options;

  const processedSources = sources
    .filter((source) => source !== null && source !== undefined)
    .map((source) => processImageSource(source));

  const total = processedSources.length;

  if (DEBUG_IMAGE_PRELOADER) {
    console.log(`🔄 Preloading ${total} images with policy: ${cachePolicy}`);
  }

  try {
    const { loaded, failed, skipped } = await preloadInBatches(
      processedSources,
      batchSize,
      timeout,
      total,
      onProgress,
      estimatedSizes,
    );

    return { success: failed === 0, total, loaded, failed, skipped };
  } catch (error) {
    console.error('Error in image preloading:', error);
    return {
      success: false,
      total,
      loaded: 0,
      failed: total,
      skipped: 0,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
};

// Helper function to preload images in batches
const preloadInBatches = async (
  processedSources: (ImageSource | null)[],
  batchSize: number,
  timeout: number,
  total: number,
  onProgress?: (progress: PreloadProgress) => void,
  estimatedSizes?: Record<number, number>,
): Promise<{ loaded: number; failed: number; skipped: number }> => {
  const batches = [];
  for (let i = 0; i < processedSources.length; i += batchSize) {
    batches.push(processedSources.slice(i, i + batchSize));
  }

  let totalLoaded = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  await Promise.all(
    batches.map(async (batch, batchIndex) => {
      const batchResults = await Promise.all(
        batch.map(async (source, sourceIndex) => {
          const index = batchIndex * batchSize + sourceIndex;
          if (!source) {
            return 'skipped' as const;
          }
          return preloadSingleImage(source, index, timeout, estimatedSizes);
        }),
      );

      const { loaded, failed, skipped } = processBatchResults(batchResults, total, onProgress);
      totalLoaded += loaded;
      totalFailed += failed;
      totalSkipped += skipped;
    }),
  );

  return { loaded: totalLoaded, failed: totalFailed, skipped: totalSkipped };
};

/**
 * Preload all SVG assets used in the app
 * This should be called during app initialization
 */
export async function preloadAllSvgAssets() {
  try {
    if (DEBUG_IMAGE_PRELOADER) {
      console.log('🧩 Preloading all SVG assets...');
    }

    // Use static SVG assets directly - no dynamic requires
    const svgAssets = [MUSCLE_SVG_ASSETS.front, MUSCLE_SVG_ASSETS.back].filter(Boolean); // Filter out any null values

    if (svgAssets.length === 0) {
      console.warn('No SVG assets found to preload');
      return { success: false, error: new Error('No SVG assets found'), count: 0 };
    }

    // Use Asset API for preloading
    const startTime = Date.now();
    const loadPromises = svgAssets.map((asset) => {
      if (!asset) return Promise.resolve(); // Skip null assets

      const assetModule = Asset.fromModule(asset);

      // Mark as preloaded
      if (typeof asset === 'number') {
        preloadedSvgs.add(String(asset));
      }

      return assetModule.downloadAsync().catch((error) => {
        console.warn('Failed to download asset:', error);
        return Promise.resolve(); // Don't fail the whole batch for one asset
      });
    });

    // Wait for all SVGs to download
    await Promise.all(loadPromises);

    // Create global reference to preloaded SVGs
    const globalWithAssets = global as GlobalWithPreloadedAssets;
    if (!globalWithAssets.preloadedSvgAssets) {
      globalWithAssets.preloadedSvgAssets = {
        bodyFront: MUSCLE_SVG_ASSETS.front,
        bodyBack: MUSCLE_SVG_ASSETS.back,
        // Add others as needed
        timestamp: Date.now(),
      };
    }

    const duration = Date.now() - startTime;
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`✅ All SVG assets preloaded successfully in ${duration}ms`);
    }

    return { success: true, count: svgAssets.length, duration };
  } catch (error) {
    console.warn('Error preloading SVG assets:', error);
    return { success: false, error, count: 0 };
  }
}

/**
 * Check if an SVG asset has been preloaded
 * @param svgPath The path or module ID of the SVG
 */
export function isSvgPreloaded(svgPath: string | number): boolean {
  // Convert number to string for checking
  const key = String(svgPath);
  return preloadedSvgs.has(key);
}

/**
 * Preload critical modal assets (SVGs and common placeholder images)
 * This should be called during app initialization
 */
export async function preloadModalAssets() {
  try {
    const startTime = Date.now();
    if (DEBUG_IMAGE_PRELOADER) {
      console.log('🔄 Preloading modal assets (SVGs and placeholders)...');
    }

    // Create a list of assets to preload with static requires
    const assetsToPreload = [
      // SVG body diagrams - using the static MUSCLE_SVG_ASSETS
      MUSCLE_SVG_ASSETS.front,
      MUSCLE_SVG_ASSETS.back,

      // Common placeholder/fallback images
      require('../../assets/exercises/placeholder.jpg'),
      require('../../assets/exercises/pushup.jpg'),
      require('../../assets/exercises/squat.jpg'),
      require('../../assets/exercises/dumbbell.jpg'),
    ].filter(Boolean); // Filter out any null/undefined assets

    // First, preload SVGs specifically
    await preloadAllSvgAssets();

    // Then preload the placeholder images - only filter non-SVG assets
    const imageAssets = assetsToPreload.filter(
      (asset) =>
        // Only include non-SVG assets since SVGs are handled by preloadAllSvgAssets
        typeof asset === 'number' && !String(Asset.fromModule(asset).uri).endsWith('.svg'),
    );

    // Use Asset API for preloading
    const assetPromises = imageAssets.map((asset) => Asset.fromModule(asset).downloadAsync());

    // Wait for all assets to download
    await Promise.all(assetPromises);

    const duration = Date.now() - startTime;
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`✅ Modal assets preloaded successfully in ${duration}ms`);
    }

    // Return success
    return { success: true, duration };
  } catch (error) {
    console.warn('Error preloading modal assets:', error);
    return { success: false, error };
  }
}
