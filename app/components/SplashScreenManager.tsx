import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { useAuth } from '@store/AuthContext';
import * as Network from 'expo-network';
import supabase from '@services/supabase';
import { Asset } from 'expo-asset';
import { LOADING_MESSAGES } from '@constants/loadingMessages';
import * as FileSystem from 'expo-file-system';

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
  }
};

// Track important image URLs
const IMPORTANT_IMAGE_URLS = new Set<string>();

// Simple function to replace markAsImportantImage
const markAsImportantImage = (url: string) => {
  if (!url) return;
  IMPORTANT_IMAGE_URLS.add(url);
  console.log(`🔒 Marked as important: ${url.substring(0, 40)}${url.length > 40 ? '...' : ''}`);
};

// Debug flag to control logging
const DEBUG_SPLASH_SCREEN = false;

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
    CONTENT: 15000 // Increased from 8000
  },
  BATCH_SIZE: 15 // Number of images to load in parallel
};

// Safely attempt to prevent auto-hide with error handling
const safelyPreventAutoHide = async () => {
  try {
    if (Platform.OS !== 'web' && typeof SplashScreen.preventAutoHideAsync === 'function') {
      await SplashScreen.preventAutoHideAsync();
    }
  } catch (error) {
    console.warn('Error with splash screen prevention:', error);
  }
};

// Safely attempt to hide with error handling
const safelyHideSplashScreen = async () => {
  try {
    if (Platform.OS !== 'web' && typeof SplashScreen.hideAsync === 'function') {
      await SplashScreen.hideAsync();
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
      ...Object.values(STATIC_IMAGES.bodyModel)
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
    return true;
  } catch (error) {
    console.error('Image preloading error:', error);
    return false;
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
      await Promise.allSettled(batch.map(url => Asset.fromURI(url).downloadAsync()));
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
        
        console.log(`⏱️ [SplashScreenManager] Progress update: ${percentComplete}% (+${(value * 100).toFixed(1)}%)${source ? ` from ${source}` : ''} | ${elapsed}ms`);
        
        // Record timing for this milestone
        if (source) {
          setTimingMetrics(prev => ({
            ...prev,
            [source]: elapsed
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
    try {
      // Create arrays for different priority levels
      const highPriorityImages: string[] = [];
      const mediumPriorityImages: string[] = [];
      const lowPriorityImages: string[] = [];
      
      // 1. Get progress photos (HIGH PRIORITY - immediately visible on profile)
      setLoadingMessage(LOADING_MESSAGES.PROGRESS_PHOTOS);
      type ProgressPhoto = { photo_url: string };
      const progressPhotos = await fetchSupabaseData<ProgressPhoto>(
        'progress_photos',
        supabase
          .from('progress_photos')
          .select('photo_url')
          .eq('user_id', userId)
          .order('taken_at', { ascending: false })
          .limit(PRELOAD_CONFIG.USER_DATA_LIMIT),
        'Error fetching progress photos'
      );
      
      const photoUrls = progressPhotos
        .map(photo => photo.photo_url)
        .filter(url => url && typeof url === 'string');
        
      if (photoUrls.length > 0) {
        // Most recent photos (first 2) get high priority
        highPriorityImages.push(...photoUrls.slice(0, 2));
        
        // Rest get medium priority
        if (photoUrls.length > 2) {
          mediumPriorityImages.push(...photoUrls.slice(2));
        }
        
        // Mark the most recent photo as important so it stays in memory
        if (photoUrls.length > 0) {
          markAsImportantImage(photoUrls[0]);
        }
        
        console.log(`Found ${photoUrls.length} progress photos to preload (${highPriorityImages.length} high priority)`);
      }
      
      // 2. Get favorite exercises (MEDIUM-HIGH PRIORITY - accessed from favorites tab)
      setLoadingMessage(LOADING_MESSAGES.FAVORITE_EXERCISES);
      type FavoriteExercise = { exercise_id: string };
      const favorites = await fetchSupabaseData<FavoriteExercise>(
        'user_favorite_exercises',
        supabase
          .from('user_favorite_exercises')
          .select('exercise_id')
          .eq('user_id', userId)
          .limit(PRELOAD_CONFIG.FAVORITE_EXERCISES_LIMIT),
        'Error fetching favorite exercises'
      );
      
      if (favorites.length > 0) {
        // Get details for favorite exercises
        const exerciseIds = favorites.map(fav => fav.exercise_id);
        
        type ExerciseDetail = { id: string; image_url: string; name: string };
        const favoriteExercises = await fetchSupabaseData<ExerciseDetail>(
          'exercises',
          supabase
            .from('exercises')
            .select('id, image_url, name')
            .in('id', exerciseIds),
          'Error fetching favorite exercise details'
        );
        
        const exerciseUrls = favoriteExercises
          .map(ex => ({ id: ex.id, url: ex.image_url, name: ex.name }))
          .filter(item => item.url && typeof item.url === 'string');
        
        // First 5 favorite exercises get high priority
        highPriorityImages.push(...exerciseUrls.slice(0, 5).map(item => item.url));
        
        // Next 10 get medium priority
        mediumPriorityImages.push(...exerciseUrls.slice(5, 15).map(item => item.url));
        
        // Rest get low priority
        lowPriorityImages.push(...exerciseUrls.slice(15).map(item => item.url));
        
        // Mark all favorite exercise images as important
        exerciseUrls.forEach(item => {
          if (item.url) {
            markAsImportantImage(item.url);
          }
        });
        
        console.log(`Found ${exerciseUrls.length} favorite exercise images to preload (${
          Math.min(exerciseUrls.length, 5)} high, ${
          Math.min(Math.max(exerciseUrls.length - 5, 0), 10)} medium, ${
          Math.max(exerciseUrls.length - 15, 0)} low priority)`);
      }
      
      // Set loading message back to general user content
      setLoadingMessage(LOADING_MESSAGES.USER_CONTENT);
      
      // Return combined images in priority order
      return [
        ...highPriorityImages, 
        ...mediumPriorityImages, 
        ...lowPriorityImages
      ].filter(url => url && typeof url === 'string');
    } catch (error) {
      console.warn('Error fetching user-specific images:', error);
      return [];
    }
  };

  // Load application data with proper caching
  const preloadApplicationData = async () => {
    try {
      setLoadingMessage(LOADING_MESSAGES.DATA);
      
      // SECTION 1: Load ALL exercises - no limits
      const allExercises = await fetchSupabaseData(
        'exercises',
        supabase.from('exercises').select('*'),
        'Error precaching all exercises'
      );
      
      if (allExercises.length > 0) {
        console.log(`📊 Preloaded ${allExercises.length} total exercises`);
      }
      
      // SECTION 2: Cache ALL workout plans - no limits
      const allPlans = await fetchSupabaseData(
        'workout_plans',
        supabase.from('workout_plans').select('*'),
        'Error precaching workout plans'
      );
      
      if (allPlans.length > 0) {
        console.log(`📊 Preloaded ${allPlans.length} workout plans`);
      }
      
      // SECTION 3: Cache user-specific data if logged in
      if (session?.user) {
        // User settings
        await fetchSupabaseData(
          'user_settings',
          supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .single(),
          'Error fetching user settings'
        );
        
        // User profile
        await fetchSupabaseData(
          'profiles',
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single(),
          'Error fetching user profile'
        );
        
        // User's workouts - get ALL, not just recent
        await fetchSupabaseData(
          'workouts',
          supabase
            .from('workouts')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
          'Error fetching user workouts'
        );
        
        // User achievements
        await fetchSupabaseData(
          'user_achievements',
          supabase
            .from('user_achievements')
            .select('*')
            .eq('user_id', session.user.id),
          'Error fetching user achievements'
        );
        
        // Favorite exercises
        await fetchSupabaseData(
          'user_favorite_exercises',
          supabase
            .from('user_favorite_exercises')
            .select('exercise_id')
            .eq('user_id', session.user.id),
          'Error fetching favorite exercises'
        );
        
        // Progress photos - get ALL, not just recent
        await fetchSupabaseData(
          'progress_photos',
          supabase
            .from('progress_photos')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
          'Error fetching progress photos'
        );
        
        // User measurements
        await fetchSupabaseData(
          'user_measurements',
          supabase
            .from('user_measurements')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false }),
          'Error fetching user measurements'
        );
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
                // Fetch user-specific images
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
        
        // Set as ready and hide loading screen
        setIsAppReady(true);
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