import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { useAuth } from '../store/AuthContext';
import * as Network from 'expo-network';
import supabase from '../services/supabase';
import firebaseProgressPhotoService from '../services/firebaseProgressPhotos';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { storage } from '../services/firebase';
import { Asset } from 'expo-asset';
import { LOADING_MESSAGES } from '../constants/loadingMessages';
import * as FileSystem from 'expo-file-system';
import { safePreloadImages, PreloadStrategy, strategicPreloadImages } from '../utils/imagePreloader';
import { markAsImportantImage as markImageAsImportant } from '../utils/imagePreloader';
import exerciseService from '../services/exerciseService';

// Define storage bucket constants for compatibility with previous code
export const STORAGE_BUCKETS = {
  PROGRESS_PHOTOS: 'progress-photos',
  PLANS: 'plans',
  EXERCISES: 'exercises'
};

// Define interfaces for file metadata
export interface StorageFile {
  name: string;
  id: string;
  metadata?: Record<string, any>;
}

// Define static images to preload (moved from imagePreloader.ts)
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
  },
  placeholders: {
    exercise: require('../../assets/exercises/placeholder.jpg')
  }
};

// Track important image URLs
const IMPORTANT_IMAGE_URLS = new Set<string>();

// Simple function to replace markAsImportantImage
const markAsImportantImage = (url: string) => {
  if (!url) return;
  IMPORTANT_IMAGE_URLS.add(url);
  console.log(`🔒 Image marked as important: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`);
};

// Debug flag to control logging
const DEBUG_SPLASH_SCREEN = true;

// Define resources to be preloaded, organized by priority
const PRELOAD_CONFIG = {
  EXERCISE_LIMIT: Infinity, // No limit - load all exercises
  PLAN_LIMIT: Infinity, // No limit - load all plans
  USER_DATA_LIMIT: 50, // Load recent user data (progress photos, workout history)
  FAVORITE_EXERCISES_LIMIT: Infinity, // Load all favorite exercises for the user

  SCREENS_CONTENT_LIMIT: 100, // Increased from 20
  TIMEOUT: {
    STATIC_ASSETS: 4000,
    REMOTE_IMAGES: 30000, // Increased from 15000 to allow more time for loading all images
    DATA: 20000, // Increased from 8000 for loading all data
    USER_SPECIFIC: 10000, // Timeout for user-specific data
    CONTENT: 15000, // Increased from 8000
    AVATAR: 5000, // Specific timeout for avatar preloading
    DISCOVER: 10000, // Timeout for discover screen image preloading
    PLANS: 10000, // Timeout for plans screen image preloading
    PROFILE: 5000, // Timeout for profile screen image preloading
    INSIGHTS: 8000,  // Timeout for insights screen image preloading
    EXERCISES: 15000 // Timeout for exercises data preloading
  },
  BATCH_SIZE: 15, // Number of images to load in parallel
  // Increase cache limits to prevent purging important images
  CACHE_SIZE: 400, // Increased from 200 to accommodate more images
  CACHE_EXPIRY: 7 * 24 * 60 * 60 * 1000 // 7 days instead of 1 day
};

// Safely attempt to prevent auto-hide with error handling
const safelyPreventAutoHide = async () => {
  try {
    if (Platform.OS !== 'web') {
      // Force preventAutoHideAsync to be available
      if (typeof SplashScreen.preventAutoHideAsync === 'function') {
        await SplashScreen.preventAutoHideAsync();
        console.log('SplashScreen: preventAutoHideAsync called successfully');
      } else {
        console.warn('SplashScreen.preventAutoHideAsync is not a function');
      }
    }
  } catch (error) {
    console.warn('Error with splash screen prevention:', error);
  }
};

// Safely attempt to hide with error handling
const safelyHideSplashScreen = async () => {
  try {
    if (Platform.OS !== 'web') {
      // Force hideAsync to be available
      if (typeof SplashScreen.hideAsync === 'function') {
        await SplashScreen.hideAsync();
        console.log('SplashScreen: hideAsync called successfully');
      } else {
        console.warn('SplashScreen.hideAsync is not a function');
      }
    }
  } catch (error) {
    console.warn('Error hiding splash screen:', error);
  }
};

// Utility to preload static images
const preloadStaticImages = async () => {
  console.log('Starting image preloading...');
  
  try {
    // Load static images (from our app bundle)
    const staticImages = [
      ...Object.values(STATIC_IMAGES.measurements),
      ...Object.values(STATIC_IMAGES.bodyModel),
      ...Object.values(STATIC_IMAGES.placeholders) // Add placeholder images
    ];
    
    // Add additional static images if they exist
    try {
      // Get SVG files if they exist
      if ('svg' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).svg === 'object') {
        Object.values((STATIC_IMAGES as any).svg).forEach(svg => staticImages.push(svg as number));
      }
      
      // Add muscle group SVGs if they exist
      if ('muscles' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).muscles === 'object') {
        Object.values((STATIC_IMAGES as any).muscles).forEach(muscle => staticImages.push(muscle as number));
      }
      
      // Check if there are any navigation images
      if ('navigation' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).navigation === 'object') {
        staticImages.push(...Object.values((STATIC_IMAGES as any).navigation));
      }
    } catch (e) {
      // Silently continue if additional images aren't available
    }
    
    await Asset.loadAsync(staticImages);
    console.log('Static images preloaded');

    // Mark placeholder images as important to prevent them from being purged from cache
    preloadAndCachePlaceholderImages();

    return true;
  } catch (error) {
    console.error('Image preloading error:', error);
    return false;
  }
};

// Utility to preload and cache placeholder images specifically
const preloadAndCachePlaceholderImages = () => {
  try {
    if (DEBUG_SPLASH_SCREEN) {
      console.log('🖼️ Preloading and caching exercise placeholder image...');
    }

    // Create a stable reference to the placeholder image that can be used throughout the app
    const PLACEHOLDER_IMAGE_OBJECT = { uri: null, testUri: '../../assets/exercises/placeholder.jpg' };

    // Load the placeholder image with Asset API for immediate availability
    const placeholderAsset = Asset.fromModule(require('../../assets/exercises/placeholder.jpg'));
    placeholderAsset.downloadAsync().then(() => {
      console.log('✅ Exercise placeholder image fully preloaded with Asset API');
    }).catch(error => {
      console.warn('Error preloading exercise placeholder image with Asset API:', error);
    });

    // Add placeholder image to global cache to ensure it's available everywhere
    if (!(global as any).placeholderImages) {
      (global as any).placeholderImages = {
        exercise: STATIC_IMAGES.placeholders.exercise,
        exerciseObject: PLACEHOLDER_IMAGE_OBJECT
      };
    }

    // Mark the exercise placeholder image as important to keep it in memory
    if (typeof STATIC_IMAGES.placeholders.exercise === 'number') {
      // For require() style images, we can't use markImageAsImportant directly
      // Instead, we'll ensure they stay loaded by keeping references in the global cache
      if (DEBUG_SPLASH_SCREEN) {
        console.log('🔒 Exercise placeholder image marked as important');
      }
    }

    // Create a cache entry for exercise images if it doesn't exist
    if (!(global as any).exercisesCache) {
      (global as any).exercisesCache = {
        all: [],
        byCategory: {},
        lastUpdated: Date.now()
      };
    }

    if (DEBUG_SPLASH_SCREEN) {
      console.log('✅ Exercise placeholder image preloaded and cached successfully');
    }
  } catch (error) {
    console.warn('Error preloading exercise placeholder image:', error);
  }
};

// Utility to preload batch of images with progress tracking
const batchPreloadImages = async (
  imageUrls: string[],
  batchSize = 15,
  onProgress?: (progress: number, completed?: number, total?: number) => void
) => {
  if (!imageUrls || imageUrls.length === 0) {
    if (onProgress) onProgress(1, 0, 0);
    return;
  }
  
  console.log(`Batch preloading ${imageUrls.length} images...`);
  
  try {
    // Process in smaller batches
    const batches = [];
    for (let i = 0; i < imageUrls.length; i += batchSize) {
      batches.push(imageUrls.slice(i, i + batchSize));
    }
    
    let completedCount = 0;
    
    for (const batch of batches) {
      // Convert to source objects for safePreloadImages
      const sources = batch.map(url => ({ uri: url }));
      
      // Use safePreloadImages which handles errors and fallbacks internally
      await safePreloadImages(sources);
      
      completedCount += batch.length;
      
      if (onProgress) {
        const progress = Math.min(completedCount / imageUrls.length, 1);
        onProgress(progress, completedCount, imageUrls.length);
      }
    }
    
    console.log(`Preloaded ${completedCount}/${imageUrls.length} images`);
  } catch (error) {
    console.warn('Error preloading image batch:', error);
  }
  
  if (onProgress) {
    onProgress(1, imageUrls.length, imageUrls.length);
  }
};

// Centralized function to retrieve data from Supabase with error handling
const fetchSupabaseData = async <T extends Record<string, any>>(
  table: string,
  query: any,
  errorMessage: string = `Error fetching ${table}`
): Promise<T[]> => {
  try {
    const { data, error } = await query;
    
    if (error) {
      console.warn(`${errorMessage}:`, error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.warn(`${errorMessage}:`, error);
    return [];
  }
};

// Firebase utility to list files
async function listFirebaseFiles(path: string): Promise<StorageFile[]> {
  try {
    const folderRef = ref(storage, path);
    const result = await listAll(folderRef);
    
    // Convert to StorageFile format for compatibility
    const files = await Promise.all(
      result.items.map(async (item) => {
        try {
          const url = await getDownloadURL(item);
          
          return {
            name: item.name,
            id: item.name, // Firebase doesn't have separate IDs, using name
            metadata: {
              path: item.fullPath,
              downloadUrl: url
            }
          };
        } catch (err) {
          return {
            name: item.name,
            id: item.name
          };
        }
      })
    );
    
    return files;
  } catch (error) {
    console.error(`Error listing files from Firebase path ${path}:`, error);
    return [];
  }
}

// Firebase utility to get public URL
function getFirebasePublicUrl(path: string): string {
  const storageBucket = process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET;
  const apiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY;
  return `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(path)}?alt=media&key=${apiKey}`;
}

// Preload discover screen images
const preloadDiscoverScreenImages = async (): Promise<string[]> => {
  try {
    console.log('🔍 Preloading Discover screen images during startup...');
    
    // Fetch workout subcategories for discover screen
    const { data: subcategoriesData, error: subcategoriesError } = await supabase
      .from('workout_subcategories')
      .select('*')
      .order('display_order', { ascending: true });

    if (subcategoriesError) {
      console.error('Error fetching subcategories:', subcategoriesError);
      return [];
    }

    // Extract image URLs
    const imageUrls: string[] = [];
    
    subcategoriesData.forEach((subcat: any) => {
      if (subcat.image_url) {
        // If it's a full URL, use it directly
        if (subcat.image_url.startsWith('http')) {
          imageUrls.push(subcat.image_url);
        }
        // Otherwise, assume it's in Supabase storage
        else {
          // Use the Supabase URL format for storage with cache control
          const cacheVersion = '1.0';
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const storageUrl = `${supabaseUrl}/storage/v1/object/public/plans/${subcat.image_url}?v=${cacheVersion}`;
          imageUrls.push(storageUrl);
        }
      }
    });
    
    console.log(`🔍 Found ${imageUrls.length} Discover screen images to preload`);
    
    // Preload images with high priority
    if (imageUrls.length > 0) {
      await strategicPreloadImages(imageUrls, PreloadStrategy.CRITICAL);
      
      // Mark these images as important
      imageUrls.forEach(url => {
        markImageAsImportant(url);
      });
    }
    
    return imageUrls;
  } catch (error) {
    console.warn('Error preloading Discover screen images:', error);
    return [];
  }
};

// Preload plan images
const preloadPlanImages = async (): Promise<string[]> => {
  try {
    console.log('🔍 Preloading Plan images during startup...');
    
    // Fetch workout plans
    const { data: plansData, error: plansError } = await supabase
      .from('workout_plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (plansError) {
      console.error('Error fetching plans:', plansError);
      return [];
    }

    // Extract image URLs
    const imageUrls: string[] = [];
    
    plansData.forEach((plan: any) => {
      if (plan.image_url) {
        // If it's a full URL, use it directly
        if (plan.image_url.startsWith('http')) {
          imageUrls.push(plan.image_url);
        }
        // Otherwise, assume it's in Supabase storage
        else {
          // Use the Supabase URL format for storage with cache control
          const cacheVersion = '1.0';
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const storageUrl = `${supabaseUrl}/storage/v1/object/public/plans/${plan.image_url}?v=${cacheVersion}`;
          imageUrls.push(storageUrl);
        }
      }
    });
    
    console.log(`🔍 Found ${imageUrls.length} Plan images to preload`);
    
    // Preload images with high priority
    if (imageUrls.length > 0) {
      await strategicPreloadImages(imageUrls, PreloadStrategy.CRITICAL);
      
      // Mark these images as important
      imageUrls.forEach(url => {
        markImageAsImportant(url);
      });
    }
    
    return imageUrls;
  } catch (error) {
    console.warn('Error preloading Plan images:', error);
    return [];
  }
};

// Preload exercise images and data
const preloadExerciseData = async (): Promise<string[]> => {
  try {
    console.log('🔍 Preloading Exercise data and images during startup...');
    
    // Fetch all exercises
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('exercises')
      .select('*')
      .order('name');

    if (exercisesError) {
      console.error('Error fetching exercises:', exercisesError);
      return [];
    }

    // Extract image URLs
    const imageUrls: string[] = [];
    
    // Store exercises in memory for immediate access
    const exercisesByCategory: Record<string, any[]> = {};
    
    // Create a map of all unique muscle groups
    const muscleGroups = new Set<string>();
    
    // Count exercises with and without images
    let exercisesWithImage = 0;
    let exercisesWithoutImage = 0;
    
    exercisesData.forEach((exercise: any) => {
      // Track all muscle groups
      if (exercise.muscle_group) {
        muscleGroups.add(exercise.muscle_group);
      }
      
      // Group exercises by muscle group for faster access later
      const category = exercise.muscle_group || 'Other';
      if (!exercisesByCategory[category]) {
        exercisesByCategory[category] = [];
      }
      
      // Ensure each exercise has an image reference
      if (!exercise.image_url) {
        exercisesWithoutImage++;
        // Set a flag to indicate this exercise needs a placeholder
        exercise.needsPlaceholder = true;
      } else {
        exercisesWithImage++;
        // Collect image URLs for preloading
        if (exercise.image_url.startsWith('http')) {
          imageUrls.push(exercise.image_url);
        } else {
          // Use the Supabase URL format for storage with cache control
          const cacheVersion = '1.0';
          const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
          const storageUrl = `${supabaseUrl}/storage/v1/object/public/exercises/${exercise.image_url}?v=${cacheVersion}`;
          imageUrls.push(storageUrl);
        }
      }
      
      exercisesByCategory[category].push(exercise);
    });
    
    console.log(`🔍 Found ${exercisesData.length} exercises (${exercisesWithImage} with images, ${exercisesWithoutImage} using placeholder) across ${muscleGroups.size} muscle groups`);
    
    // Store the exercises data in a global cache for immediate access
    (global as any).exercisesCache = {
      all: exercisesData,
      byCategory: exercisesByCategory,
      lastUpdated: Date.now()
    };
    
    // Preload all images with high priority
    if (imageUrls.length > 0) {
      await strategicPreloadImages(imageUrls, PreloadStrategy.CRITICAL);
      
      // Mark these images as important
      imageUrls.forEach(url => {
        markImageAsImportant(url);
      });
    }
    
    // Preload exercises by category to avoid UI glitches when switching between muscle groups
    console.log(`🔍 Caching exercises by muscle group to prevent UI glitches...`);
    
    // Pre-fetch each category separately to ensure they're cached
    for (const muscleGroup of muscleGroups) {
      try {
        // No need to make actual API calls since we already have all data
        // Just ensure the data is properly organized in the cache
        console.log(`🔍 Organizing cache for muscle group: ${muscleGroup}`);
      } catch (error) {
        console.warn(`Error caching exercises for muscle group ${muscleGroup}:`, error);
      }
    }
    
    return imageUrls;
  } catch (error) {
    console.warn('Error preloading Exercise data and images:', error);
    return [];
  }
};

// Execute once on module load
if (Platform.OS !== 'web') {
  safelyPreventAutoHide().catch(err => {
    console.warn('Initial splash screen setup failed:', err);
  });
}

export default function SplashScreenManager({ children }: { children: React.ReactNode }) {
  const [isAppReady, setIsAppReady] = useState(false);
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES.START);
  const [timingMetrics, setTimingMetrics] = useState<Record<string, number>>({
    start: Date.now(),
    staticAssets: 0,
    remoteImages: 0,
    userData: 0,
    allData: 0,
    total: 0
  });
  const { session } = useAuth();
  
  // Track whether SplashScreen module has been initialized
  const splashScreenInitialized = useRef(false);
  
  // Initialize SplashScreen correctly on mount
  useEffect(() => {
    if (Platform.OS !== 'web' && !splashScreenInitialized.current) {
      // Import and configure SplashScreen properly
      const initSplashScreen = async () => {
        try {
          // Keep splash screen visible
          await SplashScreen.preventAutoHideAsync();
          splashScreenInitialized.current = true;
          console.log('✅ SplashScreen initialized successfully');
        } catch (e) {
          console.warn('Failed to initialize SplashScreen:', e);
        }
      };
      
      initSplashScreen();
    }
  }, []);
  
  // Handle background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);
  
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active') {
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (networkState.isConnected && networkState.isInternetReachable) {
          // Refresh essential data in background when app comes to foreground
          await refreshEssentialData();
        }
      } catch (error) {
        console.warn('Failed to check network state:', error);
      }
    }
  };

  // Track loading progress with enhanced logging
  const updateProgress = (value: number, message?: string, source?: string) => {
    const timestamp = Date.now();
    
    setLoadingProgress((prev) => {
      const newProgress = Math.min(prev + value, 0.95);
      
      if (DEBUG_SPLASH_SCREEN) {
        const percentComplete = (newProgress * 100).toFixed(1);
        const elapsed = timestamp - timingMetrics.start;
        
        // Track operation-specific start time if this is a new operation
        if (source && !timingMetrics[`${source}Start`]) {
          setTimingMetrics(prev => ({
            ...prev,
            [`${source}Start`]: timestamp
          }));
        }
        
        // Calculate operation-specific duration if this is the end of an operation
        let operationDuration = 0;
        if (source && timingMetrics[`${source}Start`]) {
          operationDuration = timestamp - timingMetrics[`${source}Start`];
        }
        
        // Format the operation time in appropriate units (ms, seconds, or minutes)
        let formattedOperationTime = '';
        if (operationDuration >= 60000) {
          // Show in minutes and seconds if >= 1 minute
          const minutes = Math.floor(operationDuration / 60000);
          const seconds = Math.floor((operationDuration % 60000) / 1000);
          formattedOperationTime = `${minutes}m ${seconds}s (${operationDuration}ms)`;
        } else if (operationDuration >= 1000) {
          // Show in seconds if >= 1 second
          const seconds = (operationDuration / 1000).toFixed(2);
          formattedOperationTime = `${seconds}s (${operationDuration}ms)`;
        } else if (operationDuration > 0) {
          // Show in milliseconds only if < 1 second
          formattedOperationTime = `${operationDuration}ms`;
        }
        
        // Log with both total elapsed time and operation-specific time
        if (operationDuration > 0) {
          console.log(`⏱️ [SplashScreenManager] Progress update: ${percentComplete}% (added ${(value * 100).toFixed(1)}%)${source ? ` from ${source}` : ''} | Operation time: ${formattedOperationTime}`);
        } else {
          console.log(`⏱️ [SplashScreenManager] Progress update: ${percentComplete}% (added ${(value * 100).toFixed(1)}%)${source ? ` from ${source}` : ''}`);
        }
        
        // Record timing for this milestone
        if (source) {
          setTimingMetrics(prev => ({
            ...prev,
            [source]: elapsed,
            [`${source}Duration`]: operationDuration > 0 ? operationDuration : 0 // Use 0 instead of undefined
          }));
        }
      }
      
      return newProgress;
    });
    
    if (message) {
      setLoadingMessage(message);
      if (DEBUG_SPLASH_SCREEN) {
        console.log(`🔤 [SplashScreenManager] Message update: "${message}"`);
      }
    }
  };

  // Fetch all image URLs from database
  const fetchAllImageUrls = async () => {
    try {
      // Fetch exercises with images
      type Exercise = { id: string; image_url: string };
      const exercises = await fetchSupabaseData<Exercise>(
        'exercises',
        supabase
          .from('exercises')
          .select('id, image_url')
          .not('image_url', 'is', null),
        'Error fetching exercise images'
      );

      // Fetch workout plans with images
      type Plan = { id: string; image_url: string };
      const plans = await fetchSupabaseData<Plan>(
        'workout_plans',
        supabase
          .from('workout_plans')
          .select('id, image_url')
          .not('image_url', 'is', null),
        'Error fetching workout plan images'
      );

      // Collect all image URLs
      const imageUrls = [
        ...exercises.map(e => e.image_url),
        ...plans.map(p => p.image_url)
      ].filter(url => url && typeof url === 'string') as string[];

      return imageUrls;
    } catch (error) {
      console.warn('Error fetching image URLs:', error);
      return [];
    }
  };

  // Fetch user-specific images for preloading
  const fetchUserSpecificImages = async (userId: string): Promise<string[]> => {
    if (!userId) return [];
    
    try {
      const promises = [];
      let results: string[] = [];
      
      // First try to get avatar from user metadata
      try {
        // Import firebase avatar service
        const firebaseAvatarService = require('../services/firebaseAvatarService').default;
        
        // Use the dedicated preload function if available
        if (firebaseAvatarService && typeof firebaseAvatarService.preloadAvatar === 'function') {
          const success = await firebaseAvatarService.preloadAvatar(userId, PRELOAD_CONFIG.TIMEOUT.AVATAR);
          if (success) {
            console.log('Avatar preloaded successfully with dedicated function');
            
            // Get the avatar to add to results
            const userAvatar = await firebaseAvatarService.getUserAvatar(userId);
            if (userAvatar?.url) {
              results.push(userAvatar.url);
            }
          } else {
            // Fallback to traditional method
            await preloadAvatarTraditional(userId);
          }
        } else {
          // Fallback to traditional method
          await preloadAvatarTraditional(userId);
        }
      } catch (error) {
        console.warn('Failed to preload avatar:', error);
        // Fallback to traditional method
        await preloadAvatarTraditional(userId);
      }
      
      // Create arrays for different priority levels
      const highPriorityImages: string[] = [];
      const mediumPriorityImages: string[] = [];
      const lowPriorityImages: string[] = [];
        
      // 1. Get progress photos from Firebase storage (HIGH PRIORITY - immediately visible on profile)
      setLoadingMessage(LOADING_MESSAGES.PROGRESS_PHOTOS);
      try {
        // First try to get the latest before/after photos for quick display in insights
        const latestPhotos = await firebaseProgressPhotoService.getLatestPhotos(userId);
        
        // Add latest before/after photos to high priority and mark as important
        if (latestPhotos.before?.url) {
          highPriorityImages.push(latestPhotos.before.url);
          markImageAsImportant(latestPhotos.before.url);
          console.log('Latest before photo marked as important and added to high priority');
          
          // Aggressively preload with Asset API for immediate availability
          try {
            const beforeAsset = Asset.fromURI(latestPhotos.before.url);
            await Promise.race([
              beforeAsset.downloadAsync(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Before photo preload timeout')), PRELOAD_CONFIG.TIMEOUT.AVATAR)
              )
            ]);
            console.log('Before photo fully preloaded with Asset API');
          } catch (error) {
            console.warn('Before photo aggressive preload failed:', error);
          }
        }
        
        if (latestPhotos.after?.url) {
          highPriorityImages.push(latestPhotos.after.url);
          markImageAsImportant(latestPhotos.after.url);
          console.log('Latest after photo marked as important and added to high priority');
          
          // Aggressively preload with Asset API for immediate availability
          try {
            const afterAsset = Asset.fromURI(latestPhotos.after.url);
            await Promise.race([
              afterAsset.downloadAsync(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('After photo preload timeout')), PRELOAD_CONFIG.TIMEOUT.AVATAR)
              )
            ]);
            console.log('After photo fully preloaded with Asset API');
          } catch (error) {
            console.warn('After photo aggressive preload failed:', error);
          }
        }
        
        // Get all progress photos directly from Supabase table (these point to Firebase storage)
        const progressPhotos = await firebaseProgressPhotoService.getAllPhotos(userId);
        
        if (progressPhotos && progressPhotos.length > 0) {
          // Get URLs for all photos
          const photoUrls = progressPhotos.map(photo => photo.url);
          
          const filteredUrls = photoUrls.filter((url: string) => url && typeof url === 'string');
          
          if (filteredUrls.length > 0) {
            // Filter out the already added latest photos to avoid duplication
            const remainingPhotos = filteredUrls.filter(url => 
              (!latestPhotos.before?.url || url !== latestPhotos.before.url) && 
              (!latestPhotos.after?.url || url !== latestPhotos.after.url)
            );
            
            // Add remaining photos to medium priority
            if (remainingPhotos.length > 0) {
              mediumPriorityImages.push(...remainingPhotos);
            }
            
            console.log(`Found ${filteredUrls.length} progress photos to preload (${highPriorityImages.length} high priority, ${mediumPriorityImages.length} medium priority)`);
          }
        }
      } catch (error) {
        console.warn('Error fetching progress photos:', error);
      }
      
      // Add our avatar to high priority images
      highPriorityImages.push(...results);
      
      // Return combined images in priority order, with avatar included
      return [
        ...highPriorityImages, 
        ...mediumPriorityImages, 
        ...lowPriorityImages
      ].filter(url => url && typeof url === 'string');
    } catch (error) {
      console.warn('Error fetching user specific images:', error);
      return [];
    }
  };
  
  // Traditional method to preload avatar (used as fallback)
  const preloadAvatarTraditional = async (userId: string): Promise<string[]> => {
    const results: string[] = [];
    
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (!userError && userData?.user?.user_metadata?.avatar_url) {
        const avatarUrl = userData.user.user_metadata.avatar_url;
        // Mark user avatar as important and add to the results 
        if (avatarUrl) {
          // Aggressively preload avatar with Asset API for immediate availability
          try {
            const avatarAsset = Asset.fromURI(avatarUrl);
            await Promise.race([
              avatarAsset.downloadAsync(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Avatar preload timeout')), PRELOAD_CONFIG.TIMEOUT.AVATAR)
              )
            ]);
            console.log('Avatar preloaded successfully with Asset API');
          } catch (error) {
            console.warn('Avatar preload with Asset API failed, falling back to markAsImportant:', error);
          }
          
          // Mark as important regardless of Asset preload success
          markImageAsImportant(avatarUrl);
          results.push(avatarUrl);
        }
      } else {
        // If not in metadata, try to fetch from firebase
        try {
          // Import firebase avatar service if it exists
          const firebaseAvatarService = require('../services/firebaseAvatarService').default;
          if (firebaseAvatarService && typeof firebaseAvatarService.getUserAvatar === 'function') {
            const userAvatar = await firebaseAvatarService.getUserAvatar(userId);
            if (userAvatar?.url) {
              // Aggressively preload avatar with Asset API for immediate availability
              try {
                const avatarAsset = Asset.fromURI(userAvatar.url);
                await Promise.race([
                  avatarAsset.downloadAsync(),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Avatar preload timeout')), PRELOAD_CONFIG.TIMEOUT.AVATAR)
                  )
                ]);
                console.log('Avatar preloaded successfully with Asset API');
              } catch (error) {
                console.warn('Avatar preload with Asset API failed, falling back to markAsImportant:', error);
              }
              
              // Mark as important regardless of Asset preload success
              markImageAsImportant(userAvatar.url);
              results.push(userAvatar.url);
            }
          }
        } catch (e) {
          console.warn('Firebase avatar service not available:', e);
        }
      }
    } catch (error) {
      console.warn('Failed to fetch user avatar:', error);
    }
    
    return results;
  };

  // Load application data with proper caching
  const preloadApplicationData = async () => {
    try {
      setLoadingMessage(LOADING_MESSAGES.DATA);
      
      // SECTION 1: Load ALL exercises - no limits
      const allExercises = await fetchSupabaseData<{ id: string; name: string }>(
        'exercises',
        supabase.from('exercises').select('*'),
        'Error precaching all exercises'
      );
      
      if (allExercises.length > 0) {
        console.log(`📊 Preloaded ${allExercises.length} total exercises`);
      }
      
      // SECTION 2: Cache ALL workout plans - no limits
      const allPlans = await fetchSupabaseData<{ id: string; title: string }>(
        'workout_plans',
        supabase.from('workout_plans').select('*'),
        'Error precaching workout plans'
      );
      
      if (allPlans.length > 0) {
        console.log(`📊 Preloaded ${allPlans.length} workout plans`);
      }
      
      // SECTION 3: Cache user-specific data if logged in
      if (session?.user) {
        // User profile - this table definitely exists
        await fetchSupabaseData<{ id: string }>(
          'profiles',
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single(),
          'Error fetching user profile'
        );
        
        // Check available photos for user content
        try {
          // Get all progress photos directly from the service
          const userPhotos = await firebaseProgressPhotoService.getAllPhotos(session.user.id);
          
          if (userPhotos && userPhotos.length > 0) {
            console.log(`📊 Found ${userPhotos.length} progress photos`);
          }
        } catch (error) {
          console.warn('Error checking Firebase for progress photos:', error);
        }
        
        // Check if user_favorite_exercises table exists and fetch if it does
        try {
          const { count: favoritesTableExists } = await supabase
            .from('user_favorite_exercises')
            .select('*', { count: 'exact', head: true });
          
          if (favoritesTableExists !== null) {
            // User favorites table exists, fetch data
            await fetchSupabaseData<{ exercise_id: string }>(
              'user_favorite_exercises',
              supabase
                .from('user_favorite_exercises')
                .select('exercise_id')
                .eq('user_id', session.user.id),
              'Error fetching favorite exercises'
            );
          }
        } catch (error) {
          // Table doesn't exist yet
          console.log('user_favorite_exercises table not found');
        }
        
        // The following tables don't exist yet based on the logs
        // We'll check for their existence before querying

        // Tables to check
        const tablesToCheck = [
          'user_settings',
          'workouts',
          'user_achievements',
          'user_measurements'
        ];
        
        // Check each table once instead of multiple separate checks
        for (const table of tablesToCheck) {
          try {
            const { count: tableExists } = await supabase
              .from(table)
              .select('*', { count: 'exact', head: true });
            
            if (tableExists !== null) {
              // Table exists, fetch data
              await fetchSupabaseData(
                table,
                supabase
                  .from(table)
                  .select('*')
                  .eq('user_id', session.user.id),
                `Error fetching ${table}`
              );
            }
          } catch (error) {
            // Table doesn't exist, but that's expected
            // No need to log an error as we're just checking
          }
        }
      }
      
      updateProgress(0.1, LOADING_MESSAGES.DATA + ' ✓');
      return true;
    } catch (error) {
      console.warn('Error preloading data:', error);
      updateProgress(0.05, 'Continuing with limited data');
      return false;
    }
  };

  // Refresh essential data when app comes to foreground
  const refreshEssentialData = async () => {
    if (DEBUG_SPLASH_SCREEN) {
      console.log(`🔄 [SplashScreenManager] Refreshing essential data in background`);
    }
    
    try {
      // This runs silently in the background without UI updates
      await preloadApplicationData();
      
      if (DEBUG_SPLASH_SCREEN) {
        console.log(`✅ [SplashScreenManager] Refreshed essential data silently in background`);
      }
    } catch (error) {
      // Don't show errors to user for background refreshes
      console.log('Background data refresh error:', error);
    }
  };

  // Fully preload critical images (avatar, before/after photos)
  const preloadCriticalImages = async (userId: string): Promise<boolean> => {
    if (!userId) return false;
    
    try {
      console.log('Starting critical image preloading...');
      const criticalImages: string[] = [];
      let success = true;
      
      // 1. Avatar
      try {
        const firebaseAvatarService = require('../services/firebaseAvatarService').default;
        const avatar = await firebaseAvatarService.getUserAvatar(userId);
        
        if (avatar?.url) {
          criticalImages.push(avatar.url);
          
          // Aggressively preload avatar
          try {
            console.log(`Aggressively preloading avatar: ${avatar.url.substring(0, 40)}...`);
            const avatarAsset = Asset.fromURI(avatar.url);
            await avatarAsset.downloadAsync();
            console.log('Avatar fully preloaded and ready for display');
          } catch (error) {
            console.warn('Avatar aggressive preload failed:', error);
            success = false;
          }
        }
      } catch (error) {
        console.warn('Error preloading avatar:', error);
        success = false;
      }
      
      // 2. Before/After photos
      try {
        const latestPhotos = await firebaseProgressPhotoService.getLatestPhotos(userId);
        
        if (latestPhotos.before?.url) {
          criticalImages.push(latestPhotos.before.url);
          
          // Aggressively preload before photo
          try {
            console.log(`Aggressively preloading before photo: ${latestPhotos.before.url.substring(0, 40)}...`);
            const beforeAsset = Asset.fromURI(latestPhotos.before.url);
            await beforeAsset.downloadAsync();
            console.log('Before photo fully preloaded and ready for display');
          } catch (error) {
            console.warn('Before photo aggressive preload failed:', error);
            success = false;
          }
        }
        
        if (latestPhotos.after?.url) {
          criticalImages.push(latestPhotos.after.url);
          
          // Aggressively preload after photo
          try {
            console.log(`Aggressively preloading after photo: ${latestPhotos.after.url.substring(0, 40)}...`);
            const afterAsset = Asset.fromURI(latestPhotos.after.url);
            await afterAsset.downloadAsync();
            console.log('After photo fully preloaded and ready for display');
          } catch (error) {
            console.warn('After photo aggressive preload failed:', error);
            success = false;
          }
        }
      } catch (error) {
        console.warn('Error preloading before/after photos:', error);
        success = false;
      }
      
      // Mark all critical images as important
      criticalImages.forEach(url => {
        markImageAsImportant(url);
      });
      
      console.log(`Critical image preloading ${success ? 'completed successfully' : 'had some failures'}`);
      return success;
    } catch (error) {
      console.warn('Error in critical image preloading:', error);
      return false;
    }
  };

  // Prepare the app - load all assets and data
  useEffect(() => {
    async function prepare() {
      if (DEBUG_SPLASH_SCREEN) {
        console.log(`🚀 [SplashScreenManager] Starting app preparation at ${new Date().toISOString()}`);
        console.log(`📊 [SplashScreenManager] App config: batch size=${PRELOAD_CONFIG.BATCH_SIZE}, timeouts=${JSON.stringify(PRELOAD_CONFIG.TIMEOUT)}`);
      }
      
      try {
        // Start with a small delay to ensure splash screen is displayed
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Phase 1: Preload all static assets (bundled with the app)
        const staticAssetsStart = Date.now();
        setTimingMetrics(prev => ({ ...prev, staticAssetsStart }));
        
        try {
          // Handle static assets with a timeout to ensure we don't get stuck
          await Promise.race([
            preloadStaticImages(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Static assets timeout')), PRELOAD_CONFIG.TIMEOUT.STATIC_ASSETS)
            )
          ]);
          
          const staticAssetsDuration = Date.now() - staticAssetsStart;
          if (DEBUG_SPLASH_SCREEN) {
            console.log(`⏱️ [SplashScreenManager] Static assets loaded in ${staticAssetsDuration}ms`);
          }
          
          setTimingMetrics(prev => ({ 
            ...prev, 
            staticAssetsEnd: Date.now(),
            staticAssetsDuration
          }));
          
          updateProgress(0.1, LOADING_MESSAGES.REMOTE_ASSETS, 'staticAssets');
        } catch (err) {
          console.warn('Static assets preloading timed out, continuing with app load:', err);
          updateProgress(0.1, LOADING_MESSAGES.REMOTE_ASSETS, 'staticAssets');
        }
        
        // Phase 1.5: Preload Discover screen images (NEW)
        const discoverImagesStart = Date.now();
        setTimingMetrics(prev => ({ ...prev, discoverImagesStart }));
        
        try {
          // Try to preload Discover screen images with a timeout
          await Promise.race([
            preloadDiscoverScreenImages(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Discover images timeout')), PRELOAD_CONFIG.TIMEOUT.DISCOVER)
            )
          ]);
          
          const discoverImagesDuration = Date.now() - discoverImagesStart;
          if (DEBUG_SPLASH_SCREEN) {
            console.log(`⏱️ [SplashScreenManager] Discover images loaded in ${discoverImagesDuration}ms`);
          }
          
          setTimingMetrics(prev => ({ 
            ...prev, 
            discoverImagesEnd: Date.now(),
            discoverImagesDuration
          }));
          
          updateProgress(0.15, LOADING_MESSAGES.REMOTE_ASSETS, 'discoverImages');
        } catch (err) {
          console.warn('Discover images preloading timed out, continuing with app load:', err);
          updateProgress(0.1, LOADING_MESSAGES.REMOTE_ASSETS, 'discoverImagesFallback');
        }
        
        // Phase 1.6: Preload Plan images
        const planImagesStart = Date.now();
        setTimingMetrics(prev => ({ ...prev, planImagesStart }));
        
        try {
          // Try to preload Plan images with a timeout
          await Promise.race([
            preloadPlanImages(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Plan images timeout')), PRELOAD_CONFIG.TIMEOUT.PLANS)
            )
          ]);
          
          const planImagesDuration = Date.now() - planImagesStart;
          if (DEBUG_SPLASH_SCREEN) {
            console.log(`⏱️ [SplashScreenManager] Plan images loaded in ${planImagesDuration}ms`);
          }
          
          setTimingMetrics(prev => ({ 
            ...prev, 
            planImagesEnd: Date.now(),
            planImagesDuration
          }));
          
          updateProgress(0.1, LOADING_MESSAGES.REMOTE_ASSETS, 'planImages');
        } catch (err) {
          console.warn('Plan images preloading timed out, continuing with app load:', err);
          updateProgress(0.05, LOADING_MESSAGES.REMOTE_ASSETS, 'planImagesFallback');
        }
        
        // Phase 1.7: Preload Exercise data and images
        const exerciseDataStart = Date.now();
        setTimingMetrics(prev => ({ ...prev, exerciseDataStart }));
        
        try {
          // Try to preload Exercise data and images with a timeout
          await Promise.race([
            preloadExerciseData(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Exercise data timeout')), PRELOAD_CONFIG.TIMEOUT.EXERCISES)
            )
          ]);
          
          const exerciseDataDuration = Date.now() - exerciseDataStart;
          if (DEBUG_SPLASH_SCREEN) {
            console.log(`⏱️ [SplashScreenManager] Exercise data loaded in ${exerciseDataDuration}ms`);
          }
          
          setTimingMetrics(prev => ({ 
            ...prev, 
            exerciseDataEnd: Date.now(),
            exerciseDataDuration
          }));
          
          updateProgress(0.15, LOADING_MESSAGES.DATA, 'exerciseData');
        } catch (err) {
          console.warn('Exercise data preloading timed out, continuing with app load:', err);
          updateProgress(0.05, LOADING_MESSAGES.DATA, 'exerciseDataFallback');
        }
        
        // Phase 2: Load remote images and data
        const remoteImagesStart = Date.now();
        setTimingMetrics(prev => ({ ...prev, remoteImagesStart }));
        
        try {
          // Try to preload remote images with a timeout
          await Promise.race([
            (async () => {
              // Get all the image URLs to preload
              const urls = await fetchAllImageUrls();
              
              if (DEBUG_SPLASH_SCREEN) {
                console.log(`📊 [SplashScreenManager] Retrieved ${urls.length} image URLs to preload`);
              }
              
              // Batch preload them all
              await batchPreloadImages(
                urls, 
                PRELOAD_CONFIG.BATCH_SIZE,
                (progress, completed, total) => {
                  const normalizedProgress = progress * 0.3; // 30% of total progress
                  updateProgress(normalizedProgress, LOADING_MESSAGES.REMOTE_ASSETS, 'remoteAssetsBatch');
                  
                  if (DEBUG_SPLASH_SCREEN && completed && total) {
                    console.log(`📊 [SplashScreenManager] Remote images progress: ${completed}/${total} (${(progress * 100).toFixed(1)}%)`);
                  }
                }
              );
            })(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Remote images timeout')), PRELOAD_CONFIG.TIMEOUT.REMOTE_IMAGES)
            )
          ]);
          
          const remoteImagesDuration = Date.now() - remoteImagesStart;
          if (DEBUG_SPLASH_SCREEN) {
            console.log(`⏱️ [SplashScreenManager] Remote images loaded in ${remoteImagesDuration}ms`);
          }
          
          setTimingMetrics(prev => ({ 
            ...prev, 
            remoteImagesEnd: Date.now(),
            remoteImagesDuration
          }));
          
          updateProgress(0.3, LOADING_MESSAGES.CONTENT, 'remoteImages');
        } catch (err) {
          console.warn('Remote images preloading timed out, continuing with app load:', err);
          updateProgress(0.3, LOADING_MESSAGES.CONTENT, 'remoteImagesFallback');
        }
        
        // Phase 3: Preload data - this is handled internally in preloadApplicationData
        try {
          await Promise.race([
            preloadApplicationData(),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Data loading timeout')), PRELOAD_CONFIG.TIMEOUT.DATA)
            )
          ]);
        } catch (err) {
          console.warn('Data preloading timed out, continuing with app load:', err);
        }
        
        // Phase 4: Load user-specific content if signed in
        if (session?.user) {
          const userDataStart = Date.now();
          setTimingMetrics(prev => ({ ...prev, userDataStart }));
          
          try {
            // Try to preload user-specific content with a timeout
            await Promise.race([
              (async () => {
                // First preload critical images (avatar, before/after photos)
                await preloadCriticalImages(session.user.id);
                
                // Then fetch and preload all user-specific images
                const userImages = await fetchUserSpecificImages(session.user.id);
                
                if (DEBUG_SPLASH_SCREEN) {
                  console.log(`📊 [SplashScreenManager] Retrieved ${userImages.length} user-specific images to preload`);
                }
                
                // Preload with high priority
                if (userImages.length > 0) {
                  await batchPreloadImages(
                    userImages,
                    PRELOAD_CONFIG.BATCH_SIZE,
                    (progress, completed, total) => {
                      const normalizedProgress = progress * 0.1; // 10% of total
                      updateProgress(normalizedProgress, LOADING_MESSAGES.USER_CONTENT, 'userImages');
                      
                      if (DEBUG_SPLASH_SCREEN && completed && total) {
                        console.log(`📊 [SplashScreenManager] User images progress: ${completed}/${total} (${(progress * 100).toFixed(1)}%)`);
                      }
                    }
                  );
                }
              })(),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('User data timeout')), PRELOAD_CONFIG.TIMEOUT.USER_SPECIFIC)
              )
            ]);
            
            const userDataDuration = Date.now() - userDataStart;
            if (DEBUG_SPLASH_SCREEN) {
              console.log(`⏱️ [SplashScreenManager] User data loaded in ${userDataDuration}ms`);
            }
            
            setTimingMetrics(prev => ({
              ...prev,
              userDataEnd: Date.now(),
              userDataDuration
            }));
            
            updateProgress(0.1, LOADING_MESSAGES.AUTHENTICATED, 'userData');
          } catch (err) {
            console.warn('User-specific content preloading timed out, continuing with app load:', err);
            updateProgress(0.1, LOADING_MESSAGES.AUTHENTICATED, 'userDataFallback');
          }
        }
        
        // Final update to loading and timing status
        const totalDuration = Date.now() - timingMetrics.start;
        setTimingMetrics(prev => ({
          ...prev,
          end: Date.now(),
          totalDuration
        }));
        
        // Complete progress and set app as ready
        updateProgress(0.15, LOADING_MESSAGES.COMPLETE, 'finalization');
        
        if (DEBUG_SPLASH_SCREEN) {
          console.log(`🏁 [SplashScreenManager] App preparation completed in ${totalDuration}ms`);
          console.log(`📊 [SplashScreenManager] Timing summary:`, {
            staticAssets: `${timingMetrics.staticAssetsDuration || 0}ms`,
            remoteImages: `${timingMetrics.remoteImagesDuration || 0}ms`,
            userData: `${timingMetrics.userDataDuration || 0}ms`,
            total: `${totalDuration}ms`
          });
        }
        
        // Set as ready but add a small delay to ensure images are fully loaded and rendered
        setIsAppReady(true);
        
        // Add a small delay before hiding the splash screen to ensure images are fully loaded
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Finally hide the loading screen
        setTimeout(() => {
          setShowLoadingScreen(false);
          setTimeout(() => {
            safelyHideSplashScreen();
          }, 100);
        }, 500);
      } catch (e) {
        console.warn('Error preparing app:', e);
        // Still set app as ready even on error to prevent getting stuck
        setIsAppReady(true);
        setShowLoadingScreen(false);
        safelyHideSplashScreen();
      }
    }
    
    prepare();
  }, [session]);

  const onFinishLoading = () => {
    if (DEBUG_SPLASH_SCREEN) {
      console.log(`🏁 [SplashScreenManager] Loading finished, hiding splash screen`);
    }
    setShowLoadingScreen(false);
  };

  // Render the app with loading screen when needed
  if (!isAppReady || showLoadingScreen) {
    return (
      <InitialLoadingScreen 
        progressValue={loadingProgress} 
        message={loadingMessage}
        onFinish={onFinishLoading}
      />
    );
  }

  return <>{children}</>;
} 