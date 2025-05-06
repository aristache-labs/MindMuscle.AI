import { Asset } from 'expo-asset';
import { ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import supabase from '../services/supabase';
import { Image as ReactNativeImage } from 'react-native';
import * as FileSystem from 'expo-file-system';

// Debug configuration
const DEBUG_IMAGE_PRELOADER = true;
const DEBUG_MEMORY_CACHE = true;

// Expanded memory cache to improve navigation performance
const IMAGE_MEMORY_CACHE: Record<string, any> = {};

// Separate tracker for remote prefetched images 
// (tracks that Image.prefetch was called but doesn't overwrite file URIs)
const REMOTE_PREFETCHED: Record<string, boolean> = {};

// Create a counter to track cache operations
let memCacheHits = 0;
let memCacheMisses = 0;
let memCacheStores = 0;

// Track important images that should always be kept in memory
const IMPORTANT_IMAGE_URLS = new Set<string>();

// A set to keep track of which images are currently being preloaded
const preloadingImages = new Set<string>();

// A map of important image URIs that should always stay in memory
const importantImages = new Map<string, boolean>();

// A cache for image dimensions to avoid re-requesting
const imageDimensionsCache = new Map<string, { width: number; height: number }>();

// Batch loading settings
const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_BATCH_DELAY = 100; // ms

export const STATIC_IMAGES = {
  measurements: {
    weight: require('../../assets/measurements/instructions/weight-instruction.png'),
    biceps: require('../../assets/measurements/instructions/biceps-instruction.png'),
    chest: require('../../assets/measurements/instructions/chest-instruction.png'),
    waist: require('../../assets/measurements/instructions/waist-instruction.png'),
    abs: require('../../assets/measurements/instructions/abs-instruction.png'),
    shoulders: require('../../assets/measurements/instructions/shoulders-instruction.png'),
    thigh: require('../../assets/measurements/instructions/thigh-instruction.png'),
    calf: require('../../assets/measurements/instructions/calf-instruction.png'),
  },
  bodyModel: {
    front: require('../../assets/body-model_front.png'),
    back: require('../../assets/body-model_back.png')
  }
};

// Paths for exercise images in assets folder
export const EXERCISE_IMAGES_PATH = '../../assets/exercises/';

// Cache for storing preloaded URLs - keep for backward compatibility
let preloadedRemoteImages: Record<string, boolean> = {};

/**
 * Stores a prefetched image in memory cache with its data
 */
export function storeInMemoryCache(url: string, imageData: any): void {
  // Don't cache undefined or null data
  if (!url || !imageData) {
    if (DEBUG_MEMORY_CACHE) console.log(`🚫 CACHE SKIP: Invalid URL or data for ${url?.substring(0, 40)}`);
    return;
  }
  
  // Check if we already have this in cache
  const alreadyInCache = !!IMAGE_MEMORY_CACHE[url];
  
  // Store in memory cache
  IMAGE_MEMORY_CACHE[url] = imageData;
  memCacheStores++;
  
  if (DEBUG_MEMORY_CACHE) {
    if (alreadyInCache) {
      console.log(`🔄 CACHE UPDATE: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`);
    } else {
      console.log(`➕ CACHE STORE: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`);
    }
    console.log(`📊 CACHE STATS: ${Object.keys(IMAGE_MEMORY_CACHE).length} items (${memCacheHits} hits, ${memCacheMisses} misses, ${memCacheStores} stores)`);
  }
}

/**
 * Gets an image from memory cache if available
 */
export function getFromMemoryCache(url: string): any {
  if (!url) return null;
  
  const cachedData = IMAGE_MEMORY_CACHE[url] || null;
  
  if (cachedData) {
    memCacheHits++;
    if (DEBUG_MEMORY_CACHE) {
      console.log(`✅ CACHE HIT: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`);
    }
  } else {
    memCacheMisses++;
    if (DEBUG_MEMORY_CACHE) {
      console.log(`❓ CACHE MISS: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`);
    }
  }
  
  return cachedData;
}

/**
 * Preloads all static images bundled with the app
 */
export async function preloadStaticImages(): Promise<void> {
  console.log('🎯 Starting to preload static images...');
  
  try {
    const measurementImages = Object.values(STATIC_IMAGES.measurements);
    const bodyModelImages = Object.values(STATIC_IMAGES.bodyModel);
    const allImages = [...measurementImages, ...bodyModelImages];
    
    console.log(`📦 Found ${allImages.length} images to preload:`, {
      measurements: measurementImages.length,
      bodyModel: bodyModelImages.length
    });

    await Promise.all(allImages.map(async (image, index) => {
      await Asset.loadAsync(image);
      console.log(`✅ Loaded static image ${index + 1}/${allImages.length}`);
    }));

    console.log('🎉 Successfully preloaded all static images');
  } catch (error) {
    console.error('❌ Failed to preload static images:', error);
    throw error;
  }
}

/**
 * Preloads exercise category images and other frequently accessed images
 */
export async function preloadCategories(): Promise<void> {
  console.log('🔄 Preloading exercise images...');
  
  try {
    // First try to get the schema of the exercises table to see what columns are available
    const { data: exercisesData, error } = await supabase
      .from('exercises')
      .select('*')
      .limit(1);
      
    if (error) {
      throw error;
    }
    
    // Determine which fields to query based on the schema
    let query = '*';
    if (exercisesData && exercisesData.length > 0) {
      const sampleExercise = exercisesData[0];
      const availableColumns = Object.keys(sampleExercise);
      console.log('📊 Available columns in exercises table:', availableColumns);
      
      // Select only what we need to minimize data transfer
      const desiredColumns = ['id'];
      if (availableColumns.includes('image_url')) {
        desiredColumns.push('image_url');
      } else if (availableColumns.includes('imageUrl')) {
        desiredColumns.push('imageUrl');
      }
      
      // Check for category fields with different possible names
      const categoryColumns = ['category', 'muscle_group', 'type', 'exerciseType'];
      for (const col of categoryColumns) {
        if (availableColumns.includes(col)) {
          desiredColumns.push(col);
          break;
        }
      }
      
      query = desiredColumns.join(', ');
    }
    
    // Now get the actual exercises data with the appropriate columns
    const { data: exercises, error: fetchError } = await supabase
      .from('exercises')
      .select(query)
      .limit(20);
      
    if (fetchError) {
      throw fetchError;
    }
    
    if (exercises && exercises.length > 0) {
      console.log(`📦 Found ${exercises.length} exercises to preload`);
      
      // Preload exercise images with whatever image field is available
      let imagesPreloaded = 0;
      
      await Promise.all(exercises.map(async (exercise: Record<string, any>, index) => {
        const imageUrl = exercise.image_url || exercise.imageUrl;
        if (imageUrl && typeof imageUrl === 'string') {
          try {
            await Image.prefetch(imageUrl);
            REMOTE_PREFETCHED[imageUrl] = true;
            imagesPreloaded++;
            console.log(`✅ Loaded exercise image ${index + 1}/${exercises.length}`);
          } catch (err) {
            console.warn(`Failed to preload image for exercise ${exercise.id || index}:`, err);
          }
        }
      }));
      
      console.log(`🎉 Successfully preloaded ${imagesPreloaded} exercise images`);
    } else {
      console.log('⚠️ No exercises found to preload');
    }
  } catch (error) {
    console.error('❌ Failed to preload exercise images:', error);
    // Don't throw to prevent app initialization issues
  }
}

/**
 * Preloads remote images from Supabase buckets with memory caching
 */
export async function preloadRemoteImages(): Promise<void> {
  console.log('🌐 Starting to preload remote images...');
  
  try {
    // Preload workout plan images
    await preloadWorkoutPlanImages();
    
    // Preload exercise preview images
    await preloadExerciseImages();
    
    // Preload category images
    await preloadCategories();
    
    console.log('🎉 Successfully preloaded all remote images');
  } catch (error) {
    console.error('❌ Failed to preload remote images:', error);
    // Don't throw error here to prevent app from failing to load
    // Just log it and continue
  }
}

/**
 * Preloads workout plan images from Supabase with memory caching
 */
async function preloadWorkoutPlanImages(): Promise<void> {
  try {
    const { data: plans, error } = await supabase
      .from('workout_plans')
      .select('id, image_url')
      .limit(20); // Increased from 10 to 20 for better coverage
    
    if (error) {
      throw error;
    }
    
    if (plans && plans.length > 0) {
      console.log(`📦 Found ${plans.length} workout plan images to preload`);
      
      await Promise.all(plans.map(async (plan, index) => {
        if (plan.image_url) {
          await preloadSingleImage(plan.image_url);
          console.log(`✅ Loaded workout plan image ${index + 1}/${plans.length}`);
        }
      }));
    }
  } catch (error) {
    console.error('❌ Failed to preload workout plan images:', error);
  }
}

/**
 * Preloads exercise images from Supabase with memory caching
 */
async function preloadExerciseImages(): Promise<void> {
  try {
    const { data: exercises, error } = await supabase
      .from('exercises')
      .select('id, image_url')
      .limit(30); // Increased from 20 to 30 for better coverage
    
    if (error) {
      throw error;
    }
    
    if (exercises && exercises.length > 0) {
      console.log(`📦 Found ${exercises.length} exercise images to preload`);
      
      await Promise.all(exercises.map(async (exercise, index) => {
        if (exercise.image_url) {
          await preloadSingleImage(exercise.image_url);
          console.log(`✅ Loaded exercise image ${index + 1}/${exercises.length}`);
        }
      }));
    }
  } catch (error) {
    console.error('❌ Failed to preload exercise images:', error);
  }
}

/**
 * Checks if a remote image URL has been preloaded
 */
export function isImagePreloaded(url: string): boolean {
  const inRemoteCache = !!REMOTE_PREFETCHED[url];
  if (DEBUG_IMAGE_PRELOADER && inRemoteCache) {
    console.log(`✅ PRELOAD CHECK: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''} [Remote:${inRemoteCache}]`);
  }
  return inRemoteCache;
}

/**
 * Preloads a batch of images with progress tracking and improved error handling
 * @param imageUrls Array of image URLs to preload
 * @param batchSize Number of images to load in parallel (default: 10)
 * @param onProgress Optional callback to track progress
 * @returns Promise that resolves when all images are preloaded
 */
export const batchPreloadImages = async (
  imageUrls: string[],
  batchSize = DEFAULT_BATCH_SIZE,
  onProgress?: (progress: number) => void
): Promise<void> => {
  if (!imageUrls || imageUrls.length === 0) return;

  const validUrls = imageUrls.filter(url => typeof url === 'string' && url.length > 0);
  const totalImages = validUrls.length;
  let loadedImages = 0;
  let failedImages = 0;

  console.log(`🚀 Starting batch preload of ${totalImages} images...`);

  // Process images in batches
  for (let i = 0; i < totalImages; i += batchSize) {
    const batch = validUrls.slice(i, i + batchSize);
    
    // Process this batch in parallel with individual timeouts
    await Promise.all(
      batch.map(async (url) => {
        try {
          // Skip if already preloaded
          if (isImagePreloaded(url)) {
            loadedImages++;
            if (onProgress) {
              onProgress(loadedImages / totalImages);
            }
            return;
          }

          // Prevent duplicate loading attempts
          if (preloadingImages.has(url)) {
            return;
          }

          preloadingImages.add(url);

          try {
            // Set a timeout for each image
            await Promise.race([
              preloadSingleImage(url),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Image load timeout')), 10000)
              )
            ]);

            // Try to get dimensions for better layout calculations
            if (url.startsWith('http')) {
              try {
                await getImageDimensions(url);
              } catch (e) {
                // Non-critical error, continue without dimensions
                console.warn(`Could not get dimensions for ${url}`);
              }
            }

            loadedImages++;
          } finally {
            preloadingImages.delete(url);
          }
        } catch (err) {
          console.warn(`Failed to preload image: ${url}`, err);
          failedImages++;
        } finally {
          if (onProgress) {
            onProgress((loadedImages + failedImages) / totalImages);
          }
        }
      })
    );
    
    // Small delay between batches to prevent overwhelming the network
    if (i + batchSize < totalImages) {
      await new Promise(resolve => setTimeout(resolve, DEFAULT_BATCH_DELAY));
    }

    // Log progress every few batches
    if ((i + batchSize) % (batchSize * 5) === 0 || i + batchSize >= totalImages) {
      console.log(`📊 Preload progress:
        Processed: ${Math.min(i + batchSize, totalImages)}/${totalImages}
        Loaded: ${loadedImages}
        Failed: ${failedImages}
      `);
    }
  }

  // Log completion stats
  console.log(`✅ Image preloading complete:
    Total: ${totalImages}
    Successfully Loaded: ${loadedImages}
    Failed: ${failedImages}
    Success Rate: ${((loadedImages / totalImages) * 100).toFixed(1)}%
  `);
};

/**
 * Preloads a single image with improved error handling
 */
export const preloadSingleImage = async (url: string): Promise<boolean> => {
  if (!url) {
    console.warn('Invalid URL provided to preloadSingleImage');
    return false;
  }

  // Skip if already preloaded
  if (REMOTE_PREFETCHED[url]) {
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`✅ Already preloaded: ${url.substring(0, 40)}...`);
    }
    return true;
  }

  try {
    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`🔄 Preloading: ${url.substring(0, 40)}...`);
    }

    // For remote URLs, use Image.prefetch
    if (url.startsWith('http')) {
      await Image.prefetch(url);
      REMOTE_PREFETCHED[url] = true;
      
      // Try to get dimensions for better layout calculations
      try {
        await getImageDimensions(url);
      } catch (e) {
        // Non-critical error, continue without dimensions
        console.warn(`Could not get dimensions for ${url}`);
      }
    } 
    // For local files, verify they exist
    else if (url.startsWith('file') || url.startsWith('content')) {
      const fileInfo = await FileSystem.getInfoAsync(url);
      if (!fileInfo.exists) {
        throw new Error(`Local file does not exist: ${url}`);
      }
      REMOTE_PREFETCHED[url] = true;
    }
    // For asset numbers, use Asset.loadAsync
    else if (!isNaN(Number(url))) {
      await Asset.loadAsync(Number(url));
      REMOTE_PREFETCHED[url] = true;
    }

    if (DEBUG_IMAGE_PRELOADER) {
      console.log(`✅ Successfully preloaded: ${url.substring(0, 40)}...`);
    }
    return true;
  } catch (error) {
    console.warn(`❌ Failed to preload image: ${url}`, error);
    return false;
  }
};

/**
 * Main preload function that handles both static and remote images
 */
export async function preloadAllImages(): Promise<void> {
  console.log('🚀 Starting comprehensive image preloading...');
  
  try {
    // Preload static images first
    await preloadStaticImages();
    
    // Then preload remote images in parallel
    // We use a separate try/catch here to ensure app loads even if remote preloading fails
    try {
      await preloadRemoteImages();
    } catch (e) {
      console.warn('Remote image preloading failed, but app will continue loading:', e);
    }
    
    console.log('✨ All image preloading complete');
  } catch (error) {
    console.error('⚠️ Image preloading encountered errors:', error);
    // We still want the app to load, so just log the error
  }
}

/**
 * Mark an image URL as important for navigation - it will be kept in memory
 */
export function markAsImportantImage(url: string): void {
  if (!url) return;
  IMPORTANT_IMAGE_URLS.add(url);
  if (DEBUG_MEMORY_CACHE) {
    console.log(`🔒 MARKED IMPORTANT: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`);
    console.log(`📊 IMPORTANT IMAGES: ${IMPORTANT_IMAGE_URLS.size} total`);
  }
  if (!REMOTE_PREFETCHED[url]) {
    preloadSingleImage(url).catch(err => {
      console.warn(`Failed to preload important image: ${url}`, err);
    });
  }
}

/**
 * Check if an image is marked as important
 */
export function isImportantImage(url: string): boolean {
  return IMPORTANT_IMAGE_URLS.has(url);
}

/**
 * Check if an image has been prefetched via Expo Image.prefetch
 */
export function isRemotePrefetched(url: string): boolean {
  return !!REMOTE_PREFETCHED[url];
}

/**
 * Mark an image as prefetched without downloading
 */
export function markAsRemotePrefetched(url: string): void {
  if (!url) return;
  REMOTE_PREFETCHED[url] = true;
}

/**
 * Get image dimensions and cache them
 * @param imageUrl URL of the image
 * @returns Promise with image dimensions
 */
export const getImageDimensions = (imageUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    if (imageDimensionsCache.has(imageUrl)) {
      resolve(imageDimensionsCache.get(imageUrl)!);
      return;
    }

    ReactNativeImage.getSize(
      imageUrl,
      (width, height) => {
        const dimensions = { width, height };
        imageDimensionsCache.set(imageUrl, dimensions);
        resolve(dimensions);
      },
      (error) => {
        console.warn('Error getting image dimensions:', error);
        resolve({ width: 0, height: 0 });
      }
    );
  });
};

// Create an ImagePreloader object to export as default
const ImagePreloader = {
  STATIC_IMAGES,
  preloadStaticImages,
  preloadCategories,
  preloadRemoteImages,
  preloadAllImages,
  isImagePreloaded,
  preloadSingleImage,
  markAsImportantImage,
  isImportantImage,
  isRemotePrefetched,
  markAsRemotePrefetched,
  batchPreloadImages,
  getImageDimensions
};

console.log('🧩 imagePreloader loaded');
export default ImagePreloader; 