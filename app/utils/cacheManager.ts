import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Network from 'expo-network';
import { Platform } from 'react-native';
import { 
  storeInMemoryCache as imageStoreInMemoryCache, 
  getFromMemoryCache as imageGetFromMemoryCache, 
  markAsRemotePrefetched, 
  isRemotePrefetched, 
  markAsImportantImage,
  isImportantImage, 
  preloadAllImages,
  preloadAndCacheImage as imageCachePreloadAndCacheImage,
  batchPreloadImages as imageCacheBatchPreloadImages
} from './imagePreloader';
import supabase from '../services/supabase';
import { manipulateAsync } from 'expo-image-manipulator';

// Constants
const CACHE_FOLDER = `${FileSystem.cacheDirectory}app-cache/`;
const IMAGE_CACHE_FOLDER = `${CACHE_FOLDER}images/`;
const DATA_CACHE_FOLDER = `${CACHE_FOLDER}data/`;
const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// Cache configuration
const MEMORY_CACHE_SIZE_MB = 50; // Increase size of memory cache
const DISK_CACHE_SIZE_MB = 200;  // Increase size of disk cache
const CACHE_VERSION = '1.0.0';   // Bump cache version when data structure changes

// Remove the external CacheManager dependency
// and just use our own implementation
const initCacheDirectories = async (): Promise<void> => {
  try {
    // Create cache directories if they don't exist
    await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
    await FileSystem.makeDirectoryAsync(IMAGE_CACHE_FOLDER, { intermediates: true });
    await FileSystem.makeDirectoryAsync(DATA_CACHE_FOLDER, { intermediates: true });
  } catch (error) {
    console.warn('Failed to create cache directories:', error);
  }
};

// Initialize cache directories
initCacheDirectories().catch(console.error);

// Cache storage keys
const CACHE_KEYS = {
  exercises: 'exercises_cache',
  exercisesByGroup: 'exercises_by_group_cache',
  workoutPlans: 'workout_plans_cache',
  userSettings: 'user_settings_cache',
  allExercises: 'all_exercises_cache',
};

// In-memory cache for faster access
const memoryCache = new Map<string, any>();
const memoryCacheTimestamps = new Map<string, number>();

// Memory cache tracking
const memoryCacheStats = {
  hits: 0,
  misses: 0,
  stores: 0,
  size: 0
};

// Configuration
const CACHE_TTL = {
  SHORT: 10 * 60 * 1000,         // 10 minutes
  MEDIUM: 60 * 60 * 1000,        // 1 hour
  LONG: 24 * 60 * 60 * 1000,     // 1 day
  PERMANENT: 30 * 24 * 60 * 60 * 1000  // 30 days
};

// Prioritized cache keys that should be kept longer in memory
const PRIORITY_CACHE_KEYS = [
  'all_exercises',
  'exercises_Chest',
  'exercises_Biceps',
  'exercises_Triceps',
  'exercises_Shoulders',
  'exercises_Abs',
  'exercises_Legs',
  'exercises_Back',
  'featured_workout_plans',
  'all_workout_plans'
];

// Cache helpers
const getMemoryCacheKey = (key: string): string => {
  return `${CACHE_VERSION}:${key}`;
};

const getDiskCacheKey = (key: string): string => {
  return `${CACHE_VERSION}:${key}`;
};

// Cache stats tracking
const logCacheStats = () => {
  console.log(`📊 CACHE STATS: ${memoryCache.size} items (${memoryCacheStats.hits} hits, ${memoryCacheStats.misses} misses, ${memoryCacheStats.stores} stores)`);
};

// Get data from memory cache
const getFromMemoryCache = <T>(key: string): T | null => {
  const cacheKey = getMemoryCacheKey(key);
  const value = memoryCache.get(cacheKey);
  
  if (value !== undefined) {
    // Update timestamp to mark as recently used
    memoryCacheTimestamps.set(cacheKey, Date.now());
    memoryCacheStats.hits++;
    return value as T;
  }
  
  memoryCacheStats.misses++;
  return null;
};

// Store data in memory cache
const storeInMemoryCache = (key: string, data: any): void => {
  const cacheKey = getMemoryCacheKey(key);
  memoryCache.set(cacheKey, data);
  memoryCacheTimestamps.set(cacheKey, Date.now());
  memoryCacheStats.stores++;
  memoryCacheStats.size = memoryCache.size;
  
  // Log memory cache update
  if (key.startsWith('http')) {
    console.log(`➕ CACHE STORE: ${key.substring(0, 50)}...`);
  } else {
    console.log(`➕ CACHE STORE: ${key}`);
  }
  
  // Clean up cache if it gets too large
  cleanupMemoryCache();
  
  // Log stats occasionally
  if (memoryCacheStats.stores % 5 === 0) {
    logCacheStats();
  }
};

// Clean up memory cache to prevent excessive memory usage
const cleanupMemoryCache = (): void => {
  // If cache is smaller than threshold, don't clean up
  if (memoryCache.size < 100) return;
  
  // Get all cache entries sorted by last access time (oldest first)
  const entries = Array.from(memoryCacheTimestamps.entries())
    .sort((a, b) => a[1] - b[1]);
  
  // Keep priority items and most recently used items
  const itemsToRemove = Math.floor(entries.length * 0.2); // Remove oldest 20%
  
  if (itemsToRemove <= 0) return;
  
  for (let i = 0; i < itemsToRemove; i++) {
    const [key, _] = entries[i];
    
    // Don't remove priority items
    const baseKey = key.split(':')[1];
    if (PRIORITY_CACHE_KEYS.some(pk => baseKey.includes(pk))) {
      continue;
    }
    
    // Otherwise remove this item
    memoryCache.delete(key);
    memoryCacheTimestamps.delete(key);
  }
  
  memoryCacheStats.size = memoryCache.size;
};

// Cache API
export const cacheData = async (key: string, data: any, ttl = CACHE_TTL.MEDIUM): Promise<void> => {
  try {
    // Store in memory for faster access
    storeInMemoryCache(key, data);
    
    // Also persist to disk
    const cacheItem = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    await AsyncStorage.setItem(
      getDiskCacheKey(key), 
      JSON.stringify(cacheItem)
    );
  } catch (error) {
    console.error(`Error caching data for key ${key}:`, error);
  }
};

export const getCachedData = async <T>(key: string, fallbackFn?: () => Promise<T>): Promise<T | null> => {
  try {
    // First try memory cache
    const memoryData = getFromMemoryCache<T>(key);
    if (memoryData !== null) {
      // Log that we're using cached data
      console.log(`Using cached data for ${key}`);
      return memoryData;
    }
    
    // Then try disk cache
    const cachedItemJson = await AsyncStorage.getItem(getDiskCacheKey(key));
    
    if (cachedItemJson) {
      const cachedItem = JSON.parse(cachedItemJson);
      const now = Date.now();
      
      // Check if cache is still valid
      if (now - cachedItem.timestamp < cachedItem.ttl) {
        // Cache hit, store in memory for future use
        storeInMemoryCache(key, cachedItem.data);
        console.log(`Using disk-cached data for ${key}`);
        return cachedItem.data as T;
      }
    }
    
    // Cache miss or expired, use fallback if provided
    if (fallbackFn) {
      const data = await fallbackFn();
      if (data) {
        await cacheData(key, data);
      }
      return data;
    }
    
    return null;
  } catch (error) {
    console.error(`Error retrieving cached data for key ${key}:`, error);
    
    // If there's an error and we have a fallback, use it
    if (fallbackFn) {
      try {
        const data = await fallbackFn();
        if (data) {
          await cacheData(key, data);
        }
        return data;
      } catch (fallbackError) {
        console.error(`Fallback error for key ${key}:`, fallbackError);
      }
    }
    
    return null;
  }
};

export const removeCachedData = async (key: string): Promise<void> => {
  try {
    // Remove from memory cache
    const cacheKey = getMemoryCacheKey(key);
    memoryCache.delete(cacheKey);
    memoryCacheTimestamps.delete(cacheKey);
    
    // Remove from disk cache
    await AsyncStorage.removeItem(getDiskCacheKey(key));
  } catch (error) {
    console.error(`Error removing cached data for key ${key}:`, error);
  }
};

export const clearAllCachedData = async (): Promise<void> => {
  try {
    // Clear memory cache
    memoryCache.clear();
    memoryCacheTimestamps.clear();
    
    // Clear disk cache
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(key => key.startsWith(CACHE_VERSION));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
    
    // Don't use CacheManager from external library
    // Just clear files from our cache directory
    try {
      await FileSystem.deleteAsync(CACHE_FOLDER, { idempotent: true });
      await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
      await FileSystem.makeDirectoryAsync(IMAGE_CACHE_FOLDER, { intermediates: true });
      await FileSystem.makeDirectoryAsync(DATA_CACHE_FOLDER, { intermediates: true });
    } catch (e) {
      console.log('Error clearing cache directories:', e);
    }
    
    console.log('All cache cleared successfully');
  } catch (error) {
    console.error('Error clearing all cached data:', error);
  }
};

export const preloadExercisesByMuscleGroup = async (muscleGroup: string): Promise<void> => {
  const cacheKey = `exercises_${muscleGroup}`;
  
  // Check if already cached
  const cached = getFromMemoryCache(cacheKey);
  if (cached) {
    console.log(`Already cached exercises for ${muscleGroup}`);
    return;
  }
  
  // Try to get all exercises first if they're cached
  const allExercises = getFromMemoryCache('all_exercises') as any[] | null;
  
  if (allExercises && Array.isArray(allExercises)) {
    // Filter by muscle group
    const exercises = allExercises.filter(ex => ex.muscle_group === muscleGroup);
    
    if (exercises && exercises.length > 0) {
      // Cache this filtered set
      await cacheData(cacheKey, exercises);
      
      // Also prefetch images for these exercises
      const imageUrls = exercises
        .filter(ex => ex.image_url)
        .map(ex => ex.image_url);
      
      if (imageUrls.length > 0) {
        batchPreloadImages(imageUrls).catch(err => {
          console.log(`Error prefetching ${muscleGroup} exercise images:`, err);
        });
      }
      
      return;
    }
  }
  
  // Otherwise fallback to specific queries
  try {
    const { data } = await getCachedData(cacheKey, async () => {
      const response = await fetch(`/api/exercises?muscle_group=${muscleGroup}`);
      if (!response.ok) throw new Error('Failed to fetch exercises');
      return response.json();
    });
    
    if (data) {
      console.log(`Preloaded ${data.length} exercises for ${muscleGroup}`);
    }
  } catch (error) {
    console.error(`Error preloading exercises for ${muscleGroup}:`, error);
  }
};

export const preloadImages = async (
  urls: string[], 
  progressCallback?: (progress: number) => void
): Promise<void> => {
  if (!urls || urls.length === 0) return;
  
  try {
    // Check which URLs are already cached
    const toLoad = urls.filter(url => {
      const fromCache = getFromMemoryCache<boolean>(`img_${url}`);
      if (fromCache) {
        console.log(`✅ PRELOAD SKIP: Already cached ${url.substring(0, 50)}...`);
        return false;
      }
      
      // Check if it's a remote or local URL
      const isRemote = url.startsWith('http') || url.startsWith('https');
      console.log(`✅ PRELOAD CHECK: ${url.substring(0, 50)}... [Remote:${isRemote}]`);
      return true;
    });
    
    if (toLoad.length > 0) {
      // Use our batched preloader
      await batchPreloadImages(toLoad, 10, progressCallback);
      
      // Mark as cached
      toLoad.forEach(url => {
        storeInMemoryCache(`img_${url}`, true);
      });
    }
  } catch (error) {
    console.error('Error preloading images:', error);
  }
};

// New method to mark an image as important so it stays in memory
export const markImageAsImportant = (imageUrl: string, debugLabel?: string): void => {
  if (!imageUrl) return;
  
  markAsImportantImage(imageUrl);
  
  // Also make sure it's in our cacheManager
  storeInMemoryCache(`img_${imageUrl}`, true);
};

// Helper to check if image is marked as important
export const isImageImportant = (imageUrl: string): boolean => {
  return isImportantImage(imageUrl);
};

/**
 * Preloads a single image and caches it
 * @param imageUrl URL of the image to preload
 * @returns Promise that resolves when the image is loaded
 */
export const preloadAndCacheImage = async (imageUrl: string): Promise<void> => {
  if (!imageUrl) return;
  
  try {
    // Check if it's already loaded
    const fromCache = getFromMemoryCache<boolean>(`img_${imageUrl}`);
    if (fromCache) return;
    
    // Use the imported function from imagePreloader
    await imageCachePreloadAndCacheImage(imageUrl);
    
    // Mark as cached
    storeInMemoryCache(`img_${imageUrl}`, true);
    
    console.log(`✅ PRELOAD SUCCESS: ${imageUrl.substring(0, 50)}...`);
  } catch (error) {
    console.warn('Error preloading single image:', error);
  }
};

/**
 * Batch preload images efficiently
 */
export const batchPreloadImages = async (
  urls: string[],
  batchSize = 10,
  progressCallback?: (progress: number) => void
): Promise<void> => {
  if (!urls || urls.length === 0) return;
  
  try {
    // Use the imported function
    await imageCacheBatchPreloadImages(urls, batchSize, progressCallback);
  } catch (error) {
    console.error('Error batch preloading images:', error);
  }
};

/**
 * Initialize the cache system
 */
export const initialize = async (): Promise<void> => {
  try {
    // Create cache directories
    await initCacheDirectories();
    
    // Load any cached data that should be in memory
    // into the memory cache for faster access
    await loadPriorityCacheItems();
    
    console.log('Cache system initialized');
  } catch (error) {
    console.error('Error initializing cache system:', error);
  }
};

/**
 * Load priority cache items into memory
 */
const loadPriorityCacheItems = async (): Promise<void> => {
  // Get all keys from AsyncStorage
  const keys = await AsyncStorage.getAllKeys();
  const cacheKeys = keys.filter(key => 
    key.startsWith(CACHE_VERSION) && 
    PRIORITY_CACHE_KEYS.some(pk => key.includes(pk))
  );
  
  // Load each priority item into memory
  await Promise.all(cacheKeys.map(async (key) => {
    try {
      const baseKey = key.split(':')[1]; // Remove version prefix
      // Just call getCachedData to load it into memory
      await getCachedData(baseKey);
    } catch (error) {
      console.warn(`Error loading priority cache item ${key}:`, error);
    }
  }));
};

/**
 * Prefetch exercise list data for faster navigation
 */
export const prefetchExerciseListData = async (options?: {
  includeImages?: boolean;
  categoryLimit?: number;
}): Promise<void> => {
  const { includeImages = true, categoryLimit = 20 } = options || {};
  
  try {
    // First try to get all exercises if not already cached
    const allExercises = getFromMemoryCache('all_exercises') as any[] | null;
    
    if (!allExercises) {
      // Fetch all exercises and cache them
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('id, name, muscle_group, image_url')
        .limit(300);
        
      if (!error && exercises) {
        // Cache all exercises
        await cacheData('all_exercises', exercises);
        
        // Group by muscle group
        const exercisesByGroup: Record<string, any[]> = {};
        exercises.forEach(exercise => {
          const group = exercise.muscle_group || 'Other';
          if (!exercisesByGroup[group]) {
            exercisesByGroup[group] = [];
          }
          exercisesByGroup[group].push(exercise);
        });
        
        // Cache each group separately
        for (const [group, groupExercises] of Object.entries(exercisesByGroup)) {
          await cacheData(`exercises_${group}`, groupExercises);
          
          // Preload images if requested
          if (includeImages) {
            const imageUrls = groupExercises
              .filter(ex => ex.image_url)
              .slice(0, categoryLimit)
              .map(ex => ex.image_url);
              
            if (imageUrls.length > 0) {
              // Don't await - let this run in background
              preloadImages(imageUrls).catch(err => {
                console.warn(`Error preloading ${group} images:`, err);
              });
            }
          }
        }
      }
    } else {
      // We already have all exercises, just make sure the muscle groups are cached
      const exercisesByGroup: Record<string, any[]> = {};
      allExercises.forEach(exercise => {
        const group = exercise.muscle_group || 'Other';
        if (!exercisesByGroup[group]) {
          exercisesByGroup[group] = [];
        }
        exercisesByGroup[group].push(exercise);
      });
      
      // Cache each group separately if not already cached
      for (const [group, groupExercises] of Object.entries(exercisesByGroup)) {
        if (!getFromMemoryCache(`exercises_${group}`)) {
          await cacheData(`exercises_${group}`, groupExercises);
          
          // Preload images if requested
          if (includeImages) {
            const imageUrls = groupExercises
              .filter(ex => ex.image_url)
              .slice(0, categoryLimit)
              .map(ex => ex.image_url);
              
            if (imageUrls.length > 0) {
              // Don't await - let this run in background
              preloadImages(imageUrls).catch(err => {
                console.warn(`Error preloading ${group} images:`, err);
              });
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('Error prefetching exercise list data:', error);
  }
};

const cacheManager = {
  initialize,
  cacheData,
  getCachedData,
  removeCachedData,
  clearAllCachedData,
  preloadImages,
  preloadExercisesByMuscleGroup,
  prefetchExerciseListData,
  markAsRemotePrefetched,
  isRemotePrefetched,
  markImageAsImportant,
  isImageImportant,
  preloadAndCacheImage,
  batchPreloadImages
};

export default cacheManager; 