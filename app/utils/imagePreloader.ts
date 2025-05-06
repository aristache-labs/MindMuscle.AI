import { Asset } from 'expo-asset';
import { ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import supabase from '../services/supabase';
import { Image as ReactNativeImage } from 'react-native';
import * as FileSystem from 'expo-file-system';

/**
 * IMAGE PRELOADER DEBUGGING
 * 
 * To enable detailed debugging across the image loading system, set the following flags:
 * 
 * - DEBUG_IMAGE_PRELOADER (this file): Controls logging for the core image preloading utilities
 * - DEBUG_OPTIMIZED_IMAGE (OptimizedImage.tsx): Controls logging for the OptimizedImage component
 * - DEBUG_PROGRESS_PHOTOS (ProgressPhotosContext.tsx and services/progressPhotos.ts): Controls logging for progress photos
 * - DEBUG_SPLASH_SCREEN (SplashScreenManager.tsx): Controls logging for the app initialization and loading screen
 * 
 * The logging system uses emoji prefixes for better visual scanning:
 * - 🚀 Starting operations
 * - ⏳ Loading/in progress
 * - ✅ Success
 * - ❌ Errors
 * - ⚠️ Warnings
 * - 📊 Stats/metrics
 * - ⏱️ Timing information
 * - 🏁 Completion of operations
 * 
 * Timing metrics are reported in milliseconds for all loading operations.
 */

// Debug configuration
const DEBUG_IMAGE_PRELOADER = true;

// Separate tracker for remote prefetched images 
// (tracks that Image.prefetch was called)
const REMOTE_PREFETCHED: Record<string, boolean> = {};

// Track important images that should always be kept in memory
const IMPORTANT_IMAGE_URLS = new Set<string>();

// A set to keep track of which images are currently being preloaded
const preloadingImages = new Set<string>();

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
 * Preloads remote images from Supabase buckets
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
 * Preloads workout plan images from Supabase
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
 * Preloads exercise images from Supabase
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
 * Preloads a batch of images with progress tracking and improved error handling
 * @param imageUrls Array of image URLs to preload
 * @param batchSize Number of images to load in parallel (default: 10)
 * @param onProgress Optional callback to track progress
 * @returns Promise that resolves when all images are preloaded
 */
export const batchPreloadImages = async (
  imageUrls: string[],
  batchSize = DEFAULT_BATCH_SIZE,
  onProgress?: (progress: number, completed?: number, total?: number) => void
): Promise<void> => {
  if (!imageUrls || imageUrls.length === 0) return;
  
  // Filter out invalid URLs and already preloaded images
  const validUrls = imageUrls.filter(url => url && typeof url === 'string' && !isImagePreloaded(url));
  
  if (validUrls.length === 0) {
    console.log('🎯 No new images to preload - all images already in cache');
    if (onProgress) onProgress(1, imageUrls.length, imageUrls.length);
    return;
  }
  
  console.log(`🔄 Batch preloading ${validUrls.length} images in batches of ${batchSize}`);
  
  // Track progress
  let completedBatches = 0;
  let completedInCurrentBatch = 0;
  let totalBatches = Math.ceil(validUrls.length / batchSize);
  let successfullyLoaded = 0;
  let failedToLoad = 0;
  
  // Report initial progress
  if (onProgress) {
    onProgress(0, 0, validUrls.length);
  }
  
  // Process in batches
  for (let i = 0; i < validUrls.length; i += batchSize) {
    const batch = validUrls.slice(i, i + batchSize);
    completedInCurrentBatch = 0;
    
    try {
      // Load each image in the batch
      const results = await Promise.allSettled(
        batch.map(async (url) => {
          try {
            await preloadSingleImage(url);
            completedInCurrentBatch++;
            successfullyLoaded++;
            
            // Report progress for each image
            const totalCompleted = completedBatches * batchSize + completedInCurrentBatch;
            const progress = totalCompleted / validUrls.length;
            if (onProgress) {
              onProgress(progress, totalCompleted, validUrls.length);
            }
            
            return true;
          } catch (error) {
            failedToLoad++;
            return false;
          }
        })
      );
      
      // Count successful loads in this batch
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value === true).length;
      console.log(`✅ Batch ${completedBatches + 1}/${totalBatches} completed: ${successCount}/${batch.length} images loaded`);
    } catch (error) {
      console.warn(`⚠️ Error loading batch ${completedBatches + 1}:`, error);
    }
    
    completedBatches++;
    
    // Report progress after each batch
    const progress = Math.min(completedBatches / totalBatches, 1);
    if (onProgress) {
      onProgress(progress, completedBatches * batchSize, validUrls.length);
    }
  }
  
  const totalImages = validUrls.length;
  const loadedImages = successfullyLoaded;
  
  console.log(`
    🎉 Image preloading complete:
    Total requested: ${imageUrls.length}
    Valid to load: ${validUrls.length}
    Successfully loaded: ${loadedImages}
    Failed: ${failedToLoad}
    Success Rate: ${((loadedImages / totalImages) * 100).toFixed(1)}%
  `);
  
  // Final progress callback
  if (onProgress) {
    onProgress(1, totalImages, totalImages);
  }
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

  // Prevent duplicate loading attempts
  if (preloadingImages.has(url)) {
    return true;
  }

  preloadingImages.add(url);

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
  } finally {
    preloadingImages.delete(url);
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
  if (DEBUG_IMAGE_PRELOADER) {
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