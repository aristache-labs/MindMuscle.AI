import { Asset } from 'expo-asset';
import { ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import supabase from '../services/supabase';

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

// Cache for storing preloaded URLs
let preloadedRemoteImages: Record<string, boolean> = {};

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
 * Preloads remote images from Supabase buckets
 */
export async function preloadRemoteImages(): Promise<void> {
  console.log('🌐 Starting to preload remote images...');
  
  try {
    // Preload workout plan images
    await preloadWorkoutPlanImages();
    
    // Preload exercise preview images
    await preloadExerciseImages();
    
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
      .limit(10); // Limit to first 10 plans for performance
    
    if (error) {
      throw error;
    }
    
    if (plans && plans.length > 0) {
      console.log(`📦 Found ${plans.length} workout plan images to preload`);
      
      await Promise.all(plans.map(async (plan, index) => {
        if (plan.image_url) {
          await Image.prefetch(plan.image_url);
          preloadedRemoteImages[plan.image_url] = true;
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
      .limit(20); // Limit to first 20 exercises for performance
    
    if (error) {
      throw error;
    }
    
    if (exercises && exercises.length > 0) {
      console.log(`📦 Found ${exercises.length} exercise images to preload`);
      
      await Promise.all(exercises.map(async (exercise, index) => {
        if (exercise.image_url) {
          await Image.prefetch(exercise.image_url);
          preloadedRemoteImages[exercise.image_url] = true;
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
  return !!preloadedRemoteImages[url];
}

/**
 * Preloads a single remote image on demand
 */
export async function preloadSingleImage(url: string): Promise<void> {
  if (!url || preloadedRemoteImages[url]) return;
  
  try {
    await Image.prefetch(url);
    preloadedRemoteImages[url] = true;
  } catch (error) {
    console.warn(`Failed to preload image: ${url}`, error);
  }
}

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

export default { 
  preloadStaticImages, 
  preloadRemoteImages,
  preloadAllImages,
  preloadSingleImage,
  isImagePreloaded,
  STATIC_IMAGES 
}; 