import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { STATIC_IMAGES, preloadAllImages, batchPreloadImages, markAsImportantImage } from '@utils/imagePreloader';
import { useAuth } from '@store/AuthContext';
import * as Network from 'expo-network';
import supabase from '@services/supabase';
import { Asset } from 'expo-asset';
import { LOADING_MESSAGES } from '@constants/loadingMessages';
import * as FileSystem from 'expo-file-system';

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

  // Refresh essential data in background while using the app
  const refreshEssentialData = async () => {
    if (DEBUG_SPLASH_SCREEN) {
      console.log(`🔄 [SplashScreenManager] Refreshing essential data in background`);
    }
    
    try {
      // This runs silently in the background without UI updates
      // Refresh recently used content
      // Refresh exercise data
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('id, name, image_url, category')
        .limit(20);
      
      if (DEBUG_SPLASH_SCREEN) {
        if (error) {
          console.error(`❌ [SplashScreenManager] Failed to refresh exercise data:`, error);
        } else {
          console.log(`✅ [SplashScreenManager] Refreshed exercise data: ${exercises?.length || 0} items`);
        }
      }
        
      if (!error && exercises) {
        // Refresh user data if logged in
        if (session?.user) {
          const { data: userData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (!error && userData) {
            // User settings
            const { data, error } = await supabase
              .from('user_settings')
              .select('*')
              .eq('user_id', session.user.id)
              .single();
            
            if (!error && data) {
              // User profile
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();
              
              if (!error && profileData) {
                // User's workouts - get ALL, not just recent
                const { data: workouts, error } = await supabase
                  .from('workouts')
                  .select('*')
                  .eq('user_id', session.user.id)
                  .order('created_at', { ascending: false });
                
                if (!error && workouts) {
                  // User achievements
                  const { data: achievements, error } = await supabase
                    .from('user_achievements')
                    .select('*')
                    .eq('user_id', session.user.id);
                  
                  if (!error && achievements) {
                    // Favorite exercises
                    const { data: favoriteExercises, error } = await supabase
                      .from('user_favorite_exercises')
                      .select('exercise_id')
                      .eq('user_id', session.user.id);
                    
                    if (!error && favoriteExercises) {
                      // Progress photos - get ALL, not just recent
                      const { data: progressPhotos, error } = await supabase
                        .from('progress_photos')
                        .select('*')
                        .eq('user_id', session.user.id)
                        .order('created_at', { ascending: false });
                      
                      if (!error && progressPhotos) {
                        // User measurements
                        const { data: userMeasurements, error } = await supabase
                          .from('user_measurements')
                          .select('*')
                          .eq('user_id', session.user.id)
                          .order('created_at', { ascending: false });
                        
                        if (!error && userMeasurements) {
                          if (DEBUG_SPLASH_SCREEN) {
                            console.log(`✅ [SplashScreenManager] Refreshed user data silently in background`);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    } catch (error) {
      // Don't show errors to user for background refreshes
      console.log('Background data refresh error:', error);
    }
  };

  // Preload static assets (bundled with the app)
  const preloadStaticAssets = async () => {
    try {
      setLoadingMessage(LOADING_MESSAGES.STATIC_ASSETS);
      
      // Create an array of all the static images we need to preload
      const measurementImages = Object.values(STATIC_IMAGES.measurements);
      const bodyModelImages = Object.values(STATIC_IMAGES.bodyModel);
      
      // Add SVG files if they exist
      const svgFiles: number[] = [];
      try {
        // Get SVG files if they exist in STATIC_IMAGES
        if ('svg' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).svg === 'object') {
          Object.values((STATIC_IMAGES as any).svg).forEach(svg => svgFiles.push(svg as number));
        }
        
        // Add muscle group SVGs if they exist
        if ('muscles' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).muscles === 'object') {
          Object.values((STATIC_IMAGES as any).muscles).forEach(muscle => svgFiles.push(muscle as number));
        }
      } catch (e) {
        console.log('No SVG files defined in STATIC_IMAGES');
      }
      
      // Combine all static images
      const staticImagesArray = [
        ...measurementImages,
        ...bodyModelImages,
        ...svgFiles
      ];
      
      // Also check if there are any navigation images we could include
      try {
        // @ts-ignore - We're doing this safely with runtime checks
        if (STATIC_IMAGES.navigation && typeof STATIC_IMAGES.navigation === 'object') {
          // @ts-ignore - We're doing this safely with runtime checks
          const navigationImages = Object.values(STATIC_IMAGES.navigation);
          staticImagesArray.push(...navigationImages);
        }
      } catch (e) {
        // Silently continue if navigation images aren't available
      }
      
      console.log(`Preloading ${staticImagesArray.length} static assets...`);
      await Asset.loadAsync(staticImagesArray);
      
      updateProgress(0.15, LOADING_MESSAGES.STATIC_ASSETS + ' ✓');
      return true;
    } catch (error) {
      console.warn('Error preloading static assets:', error);
      updateProgress(0.1, 'Continuing with limited assets');
      return false;
    }
  };
  
  // Preload remote images (exercises, workout plans)
  const preloadRemoteImages = async () => {
    try {
      setLoadingMessage(LOADING_MESSAGES.IMAGES);
      
      // Get exercise images
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('id, image_url, name, muscle_group')
        .limit(PRELOAD_CONFIG.EXERCISE_LIMIT);
      
      if (error) {
        console.warn('Error fetching exercises:', error);
        // Continue without exercises
      }
      
      // Get workout plan images
      const { data: plans, error: plansError } = await supabase
        .from('workout_plans')
        .select('id, image_url, title')
        .limit(PRELOAD_CONFIG.PLAN_LIMIT);
      
      if (plansError) {
        console.warn('Error fetching workout plans:', plansError);
        // Continue without plans
      }
      
      // Collect all image URLs
      const criticalImages: string[] = []; // Must be loaded for app to function
      const highPriorityImages: string[] = []; // Important for initial screens
      const normalPriorityImages: string[] = []; // Can be loaded later
      
      // Sort plans and exercises by priority
      plans?.forEach(plan => {
        if (plan.image_url) {
          if (plan.title?.toLowerCase().includes('featured')) {
            criticalImages.push(plan.image_url);
          } else {
            highPriorityImages.push(plan.image_url);
          }
        }
      });
      
      exercises?.forEach(exercise => {
        if (exercise.image_url) {
          // Group exercises by common categories instead of using missing 'category' field
          if (exercise.muscle_group === 'Chest' || exercise.muscle_group === 'Abs' || 
              exercise.muscle_group === 'Biceps' || exercise.muscle_group === 'Cardio') {
            highPriorityImages.push(exercise.image_url);
          } else {
            normalPriorityImages.push(exercise.image_url);
          }
        }
      });
      
      // Preload critical images first (must finish)
      await Promise.race([
        Asset.loadAsync(criticalImages),
        new Promise(resolve => setTimeout(resolve, 5000))
      ]);
      
      // Preload high priority images next (important but can be skipped if slow)
      try {
        await Promise.race([
          Asset.loadAsync(highPriorityImages),
          new Promise(resolve => setTimeout(resolve, 5000))
        ]);
      } catch (e) {
        console.log('High priority images timeout - continuing');
      }
      
      // Start loading normal priority images (can be skipped entirely if slow)
      // Don't await this - it will continue in background
      try {
        const preloadPromise = Promise.race([
          Asset.loadAsync(normalPriorityImages),
          new Promise<void>((resolve) => setTimeout(() => resolve(), 3000))
        ]);
        
        // Use .then() instead of await to avoid blocking
        preloadPromise.then(() => {
          console.log('Normal priority images preloaded successfully');
        }).catch(error => {
          console.log('Normal priority images timeout - continuing in background', error);
        });
      } catch (error) {
        // Ignore any errors from background loading
      }
      
      updateProgress(0.15, LOADING_MESSAGES.IMAGES + ' ✓');
      return true;
    } catch (error) {
      console.warn('Error preloading remote images:', error);
      updateProgress(0.1, 'Continuing with limited image cache');
      return false;
    }
  };
  
  
  // Preload frequently used data
  const preloadFrequentlyUsedData = async () => {
    try {
      setLoadingMessage(LOADING_MESSAGES.DATA);
      
      // Create an array of data fetching promises
      const fetchPromises = [];
      
      // SECTION 1: Load ALL exercises - no limits
      try {
        const { data: allExercises, error } = await supabase
          .from('exercises')
          .select('*'); // Get everything with no limit
        
        if (!error && allExercises) {
          console.log(`📊 Preloaded ${allExercises.length} total exercises`);
          
          fetchPromises.push(Promise.resolve(true));
        }
      } catch (err) {
        console.log('Error precaching all exercises:', err);
      }
      
      // SECTION 2: Cache ALL workout plans - no limits
      try {
        const { data: allPlans, error } = await supabase
          .from('workout_plans')
          .select('*'); // Get everything
        
        if (!error && allPlans) {
          console.log(`📊 Preloaded ${allPlans.length} workout plans`);
          
          fetchPromises.push(Promise.resolve(true));
        }
      } catch (err) {
        console.log('Error precaching workout plans:', err);
      }
      
      // SECTION 6: Cache user-specific data if logged in
      if (session?.user) {
        // User settings
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
          
          if (!error && data) {
            fetchPromises.push(Promise.resolve(true));
          }
        } catch (err) {
          console.log('Error fetching user settings:', err);
        }
        
        // User profile
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (!error && data) {
            fetchPromises.push(Promise.resolve(true));
          }
        } catch (err) {
          console.log('Error fetching user profile:', err);
        }
        
        // User's workouts - get ALL, not just recent
        try {
          const { data, error } = await supabase
            .from('workouts')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
          
          if (!error && data) {
            fetchPromises.push(Promise.resolve(true));
          }
        } catch (err) {
          console.log('Error fetching user workouts:', err);
        }
        
        // User achievements
        try {
          const { data, error } = await supabase
            .from('user_achievements')
            .select('*')
            .eq('user_id', session.user.id);
          
          if (!error && data) {
            fetchPromises.push(Promise.resolve(true));
          }
        } catch (err) {
          console.log('Error fetching user achievements:', err);
        }
        
        // Favorite exercises
        try {
          const { data, error } = await supabase
            .from('user_favorite_exercises')
            .select('exercise_id')
            .eq('user_id', session.user.id);
            
          if (!error && data) {
            fetchPromises.push(Promise.resolve(true));
          }
        } catch (err) {
          console.log('Error fetching favorite exercises:', err);
        }
        
        // Progress photos - get ALL, not just recent
        try {
          const { data, error } = await supabase
            .from('progress_photos')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
            
          if (!error && data) {
            fetchPromises.push(Promise.resolve(true));
          }
        } catch (err) {
          console.log('Error fetching progress photos:', err);
        }
        
        // User measurements
        try {
          const { data, error } = await supabase
            .from('user_measurements')
            .select('*')
            .eq('user_id', session.user.id)
            .order('created_at', { ascending: false });
            
          if (!error && data) {
            fetchPromises.push(Promise.resolve(true));
          }
        } catch (err) {
          console.log('Error fetching user measurements:', err);
        }
      }
      
      // If no promises were added, add a resolved promise to avoid issues
      if (fetchPromises.length === 0) {
        fetchPromises.push(Promise.resolve(true));
      }
      
      // Execute all data fetching promises with a timeout
      await Promise.race([
        Promise.allSettled(fetchPromises),
        new Promise(resolve => setTimeout(resolve, PRELOAD_CONFIG.TIMEOUT.DATA * 2)) // Double the timeout
      ]);
      
      updateProgress(0.1, LOADING_MESSAGES.DATA + ' ✓');
      return true;
    } catch (error) {
      console.warn('Error preloading data:', error);
      updateProgress(0.05, 'Continuing with limited data');
      return false;
    }
  };

  // Add new function to fetch all image URLs
  const fetchAllImageUrls = async () => {
    try {
      // Fetch exercises with images
      const { data: exercises, error: exercisesError } = await supabase
        .from('exercises')
        .select('id, image_url')
        .not('image_url', 'is', null);
      
      if (exercisesError) throw exercisesError;

      // Fetch workout plans with images
      const { data: plans, error: plansError } = await supabase
        .from('workout_plans')
        .select('id, image_url')
        .not('image_url', 'is', null);
      
      if (plansError) throw plansError;

      // Collect all image URLs
      const imageUrls: string[] = [
        ...exercises?.map(e => e.image_url) || [],
        ...plans?.map(p => p.image_url) || []
      ].filter(url => url && typeof url === 'string') as string[];

      return imageUrls;
    } catch (error) {
      console.warn('Error fetching image URLs:', error);
      return [];
    }
  };

  // Add new function to fetch user-specific image URLs
  const fetchUserSpecificImages = async (userId: string): Promise<string[]> => {
    try {
      // Create arrays for different priority levels
      const highPriorityImages: string[] = [];
      const mediumPriorityImages: string[] = [];
      const lowPriorityImages: string[] = [];
      
      // 1. Get progress photos (HIGH PRIORITY - immediately visible on profile)
      setLoadingMessage(LOADING_MESSAGES.PROGRESS_PHOTOS);
      const { data: progressPhotos, error: progressError } = await supabase
        .from('progress_photos')
        .select('photo_url')
        .eq('user_id', userId)
        .order('taken_at', { ascending: false })
        .limit(PRELOAD_CONFIG.USER_DATA_LIMIT);
      
      if (!progressError && progressPhotos) {
        const photoUrls = progressPhotos
          .map(photo => photo.photo_url)
          .filter(url => url && typeof url === 'string');
          
        // Add to high priority (most recent photos) and medium priority (older photos)
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
      }
      
      // 2. Get favorite exercises (MEDIUM-HIGH PRIORITY - accessed from favorites tab)
      setLoadingMessage(LOADING_MESSAGES.FAVORITE_EXERCISES);
      const { data: favorites, error: favoritesError } = await supabase
        .from('user_favorite_exercises')
        .select('exercise_id')
        .eq('user_id', userId)
        .limit(PRELOAD_CONFIG.FAVORITE_EXERCISES_LIMIT);
      
      if (!favoritesError && favorites && favorites.length > 0) {
        // Get details for favorite exercises
        const exerciseIds = favorites.map(fav => fav.exercise_id);
        
        const { data: favoriteExercises, error: exercisesError } = await supabase
          .from('exercises')
          .select('id, image_url, name')
          .in('id', exerciseIds);
        
        if (!exercisesError && favoriteExercises) {
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
      }
      
      // 3. Get recent workout images
      setLoadingMessage(LOADING_MESSAGES.WORKOUT_HISTORY);
      const { data: workouts, error: workoutsError } = await supabase
        .from('workouts')
        .select('id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(PRELOAD_CONFIG.USER_DATA_LIMIT);
      
      if (!workoutsError && workouts && workouts.length > 0) {
        // If there are any workout-related images, fetch them here
        // This is a placeholder for any future workout images
        console.log(`Found ${workouts.length} workouts (placeholder for any workout images)`);
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
            preloadAllImages(),
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
        
        // Phase 3: Preload data - this is handled internally in preloadFrequentlyUsedData
        try {
          await Promise.race([
            preloadFrequentlyUsedData(),
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