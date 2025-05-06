import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { storeInMemoryCache, getFromMemoryCache, markAsRemotePrefetched, isRemotePrefetched } from './imagePreloader';

// Constants
const CACHE_FOLDER = `${FileSystem.cacheDirectory}app-cache/`;
const IMAGE_CACHE_FOLDER = `${CACHE_FOLDER}images/`;
const DATA_CACHE_FOLDER = `${CACHE_FOLDER}data/`;
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Cache metadata for tracking expiration and validation
interface CacheMetadata {
  url: string;
  cachedAt: number;
  expires: number;
  etag?: string;
  contentType?: string;
  size?: number;
}

interface LoadingStatus {
  loaded: number;
  total: number;
}

/**
 * Cache manager for both image and data caching
 */
class CacheManager {
  private initialized = false;
  private metadataCache: Record<string, CacheMetadata> = {};
  
  /**
   * Initialize the cache system
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Create cache directories if they don't exist
      await this.ensureDirectoryExists(CACHE_FOLDER);
      await this.ensureDirectoryExists(IMAGE_CACHE_FOLDER);
      await this.ensureDirectoryExists(DATA_CACHE_FOLDER);
      
      // Load cache metadata from storage
      await this.loadMetadata();
      
      // Clean expired cache entries
      await this.cleanExpiredCache();
      
      this.initialized = true;
      console.log('🚀 Cache system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize cache system:', error);
      // Still mark as initialized to prevent multiple initialization attempts
      this.initialized = true;
    }
  }
  
  /**
   * Ensure that a directory exists
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(dirPath);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
    }
  }
  
  /**
   * Load cache metadata from persistent storage
   */
  private async loadMetadata(): Promise<void> {
    try {
      const metadataJson = await AsyncStorage.getItem('cache_metadata');
      if (metadataJson) {
        this.metadataCache = JSON.parse(metadataJson);
        console.log(`📋 Loaded metadata for ${Object.keys(this.metadataCache).length} cached items`);
      }
    } catch (error) {
      console.warn('Failed to load cache metadata:', error);
      // Reset metadata cache on error
      this.metadataCache = {};
    }
  }
  
  /**
   * Save cache metadata to persistent storage
   */
  private async saveMetadata(): Promise<void> {
    try {
      await AsyncStorage.setItem('cache_metadata', JSON.stringify(this.metadataCache));
    } catch (error) {
      console.warn('Failed to save cache metadata:', error);
    }
  }
  
  /**
   * Clean expired cache entries
   */
  private async cleanExpiredCache(): Promise<void> {
    const now = Date.now();
    const expiredKeys: string[] = [];
    
    // Find expired entries
    for (const [key, metadata] of Object.entries(this.metadataCache)) {
      if (metadata.expires < now) {
        expiredKeys.push(key);
      }
    }
    
    if (expiredKeys.length === 0) return;
    
    console.log(`🧹 Cleaning ${expiredKeys.length} expired cache entries`);
    
    // Delete expired files and metadata
    await Promise.all(expiredKeys.map(async (key) => {
      try {
        const metadata = this.metadataCache[key];
        const filePath = this.getFilePath(metadata.url);
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        delete this.metadataCache[key];
      } catch (error) {
        console.warn(`Failed to delete expired cache for: ${key}`, error);
      }
    }));
    
    // Save updated metadata
    await this.saveMetadata();
  }
  
  /**
   * Generate a hash for a URL to use as cache key
   */
  private async generateCacheKey(url: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      url
    );
    return hash.slice(0, 16); // Use first 16 chars of hash
  }
  
  /**
   * Get the file path for a URL
   */
  private getFilePath(url: string, isImage = true): string {
    const key = url.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const folder = isImage ? IMAGE_CACHE_FOLDER : DATA_CACHE_FOLDER;
    return `${folder}${key}`;
  }
  
  /**
   * Cache an image from a URL
   */
  public async cacheImage(url: string, options: { force?: boolean; ttl?: number } = {}): Promise<string> {
    if (!this.initialized) await this.initialize();
    
    if (!url.startsWith('http')) {
      return url; // Return as is if not a remote URL
    }
    
    try {
      const cacheKey = await this.generateCacheKey(url);
      const filePath = this.getFilePath(url, true);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      // Check if cache exists and is valid
      if (!options.force && fileInfo.exists && this.metadataCache[cacheKey]) {
        // Also store in memory cache for faster access during navigation
        storeInMemoryCache(url, { uri: filePath });
        return filePath;
      }
      
      // Ensure network connectivity before attempting download
      const networkState = await Network.getNetworkStateAsync();
      if (!networkState.isConnected || !networkState.isInternetReachable) {
        throw new Error('No internet connection available');
      }
      
      // Download and cache the image
      const downloadResult = await FileSystem.downloadAsync(url, filePath);
      
      // Store metadata
      this.metadataCache[cacheKey] = {
        url,
        cachedAt: Date.now(),
        expires: Date.now() + (options.ttl || CACHE_EXPIRY),
        contentType: downloadResult.headers['Content-Type'],
        size: parseInt(downloadResult.headers['Content-Length'] || '0', 10)
      };
      
      await this.saveMetadata();
      
      // Also store in memory cache for faster access during navigation
      storeInMemoryCache(url, { uri: filePath });
      
      return filePath;
    } catch (error) {
      console.warn(`Failed to cache image: ${url}`, error);
      return url; // Return original URL on error
    }
  }
  
  /**
   * Cache data from API response
   */
  public async cacheData<T>(key: string, data: T, ttl: number = CACHE_EXPIRY): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    try {
      const cacheKey = await this.generateCacheKey(key);
      const filePath = this.getFilePath(key, false);
      
      // Write data to file
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(data));
      
      // Store metadata
      this.metadataCache[cacheKey] = {
        url: key,
        cachedAt: Date.now(),
        expires: Date.now() + ttl
      };
      
      await this.saveMetadata();
    } catch (error) {
      console.warn(`Failed to cache data for key: ${key}`, error);
    }
  }
  
  /**
   * Get cached data
   */
  public async getCachedData<T>(key: string): Promise<T | null> {
    if (!this.initialized) await this.initialize();
    
    try {
      const cacheKey = await this.generateCacheKey(key);
      const filePath = this.getFilePath(key, false);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      // Check if cache exists and is valid
      if (!fileInfo.exists || !this.metadataCache[cacheKey]) {
        return null;
      }
      
      // Check if cache has expired
      const metadata = this.metadataCache[cacheKey];
      if (metadata.expires < Date.now()) {
        // Delete expired cache
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        delete this.metadataCache[cacheKey];
        await this.saveMetadata();
        return null;
      }
      
      // Read and parse cached data
      const jsonData = await FileSystem.readAsStringAsync(filePath);
      return JSON.parse(jsonData) as T;
    } catch (error) {
      console.warn(`Failed to get cached data for key: ${key}`, error);
      return null;
    }
  }
  
  /**
   * Check if data is cached and valid
   */
  public async isDataCached(key: string): Promise<boolean> {
    if (!this.initialized) await this.initialize();
    
    try {
      const cacheKey = await this.generateCacheKey(key);
      const filePath = this.getFilePath(key, false);
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      
      // Check if cache exists and is valid
      if (!fileInfo.exists || !this.metadataCache[cacheKey]) {
        return false;
      }
      
      // Check if cache has expired
      return this.metadataCache[cacheKey].expires >= Date.now();
    } catch (error) {
      return false;
    }
  }
  
  /**
   * Preload and cache a batch of images
   */
  public async preloadImages(urls: string[], progressCallback?: (progress: number) => void): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    if (!urls || urls.length === 0) return;
    
    let completed = 0;
    const total = urls.length;
    
    try {
      // Process images in batches of 5 to not overwhelm network
      const batchSize = 5;
      for (let i = 0; i < urls.length; i += batchSize) {
        const batch = urls.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (url) => {
            try {
              await this.cacheImage(url);
            } catch (err) {
              // Log but continue with other images
              console.warn(`Failed to preload image: ${url}`, err);
            } finally {
              completed++;
              if (progressCallback) {
                progressCallback(completed / total);
              }
            }
          })
        );
      }
    } catch (error) {
      console.error('Error during image preloading:', error);
    }
  }
  
  /**
   * Preload and cache static bundled assets
   */
  public async preloadAssets(assets: number[], progressCallback?: (progress: number) => void): Promise<void> {
    if (!assets || assets.length === 0) return;
    
    try {
      // Use the correct API for Asset.loadAsync
      await Asset.loadAsync(assets);
      
      // Manually track progress if callback is provided
      if (progressCallback) {
        progressCallback(1.0); // Signal completion
      }
    } catch (error) {
      console.error('Error preloading assets:', error);
    }
  }
  
  /**
   * Clear all cached data
   */
  public async clearAllCache(): Promise<void> {
    if (!this.initialized) await this.initialize();
    
    try {
      // Delete cache directories
      await FileSystem.deleteAsync(CACHE_FOLDER, { idempotent: true });
      
      // Recreate them
      await this.ensureDirectoryExists(CACHE_FOLDER);
      await this.ensureDirectoryExists(IMAGE_CACHE_FOLDER);
      await this.ensureDirectoryExists(DATA_CACHE_FOLDER);
      
      // Clear metadata
      this.metadataCache = {};
      await this.saveMetadata();
      
      console.log('🧹 All cache cleared successfully');
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  }
  
  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<{
    imageCount: number;
    dataCount: number;
    totalSize: number;
    oldestEntry: Date;
    newestEntry: Date;
  }> {
    if (!this.initialized) await this.initialize();
    
    let imageCount = 0;
    let dataCount = 0;
    let totalSize = 0;
    let oldestTimestamp = Date.now();
    let newestTimestamp = 0;
    
    for (const metadata of Object.values(this.metadataCache)) {
      const isImage = metadata.url.match(/\.(jpg|jpeg|png|gif|webp|bmp)/i);
      
      if (isImage) {
        imageCount++;
      } else {
        dataCount++;
      }
      
      if (metadata.size) {
        totalSize += metadata.size;
      }
      
      if (metadata.cachedAt < oldestTimestamp) {
        oldestTimestamp = metadata.cachedAt;
      }
      
      if (metadata.cachedAt > newestTimestamp) {
        newestTimestamp = metadata.cachedAt;
      }
    }
    
    return {
      imageCount,
      dataCount,
      totalSize,
      oldestEntry: new Date(oldestTimestamp),
      newestEntry: new Date(newestTimestamp)
    };
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();

// Helper functions
export async function preloadAndCacheImage(url: string): Promise<string> {
  return cacheManager.cacheImage(url);
}

export async function preloadAndCacheImages(urls: string[], onProgress?: (progress: number) => void): Promise<void> {
  return cacheManager.preloadImages(urls, onProgress);
}

/**
 * Get a cached image URI, downloading if needed
 */
export async function getCachedImageUri(url: string): Promise<string> {
  // Return early for non-HTTP URLs and null/undefined values
  if (!url || (typeof url === 'string' && !url.startsWith('http'))) {
    return url;
  }
  try {
    // Use the cache manager to get or download the image
    const cachedUri = await cacheManager.cacheImage(url);
    // If we successfully cached to disk, also mark as remotely prefetched
    // to avoid unnecessary prefetch operations
    if (!isRemotePrefetched(url)) {
      markAsRemotePrefetched(url);
    }
    return cachedUri;
  } catch (error) {
    console.error(`Failed to get cached image: ${url}`, error);
    return url; // Fallback to original URL
  }
}

export async function clearImageCache(): Promise<void> {
  return cacheManager.clearAllCache();
}

export default cacheManager; 