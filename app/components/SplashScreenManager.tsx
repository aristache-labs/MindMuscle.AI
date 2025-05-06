import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { STATIC_IMAGES } from '@utils/imagePreloader';
import { useAuth } from '@store/AuthContext';
import * as Network from 'expo-network';
import cacheManager from '../utils/cacheManager';
import supabase from '@services/supabase';
import { Asset } from 'expo-asset';
import { LOADING_MESSAGES } from '@constants/loadingMessages';
import * as FileSystem from 'expo-file-system';

// Define resources to be preloaded, organized by priority
const PRELOAD_CONFIG = {
  EXERCISE_LIMIT: Infinity, // No limit - load all exercises
  PLAN_LIMIT: Infinity, // No limit - load all plans
  VIDEO_LIMIT: Infinity, // No limit - load all videos
  SCREENS_CONTENT_LIMIT: 100, // Increased from 20
  TIMEOUT: {
    STATIC_ASSETS: 4000,
    REMOTE_IMAGES: 30000, // Increased from 15000 to allow more time for loading all images
    DATA: 20000, // Increased from 8000 for loading all data
    VIDEOS: 20000, // Increased to match data timeout
    CONTENT: 15000 // Increased from 8000
  }
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

  // Track loading progress
  const updateProgress = (value: number, message?: string) => {
    setLoadingProgress((prev) => {
      const newProgress = Math.min(prev + value, 0.95);
      return newProgress;
    });
    
    if (message) {
      setLoadingMessage(message);
    }
  };

  // Refresh essential data in background while using the app
  const refreshEssentialData = async () => {
    try {
      // This runs silently in the background without UI updates
      // Refresh recently used content
      await cacheManager.initialize();
      
      // Refresh exercise data
      try {
        const { data: exercises, error } = await supabase
          .from('exercises')
          .select('id, name, image_url, category')
          .limit(20);
          
        if (!error && exercises) {
          await cacheManager.cacheData('exercises_recent', exercises);
        }
      } catch (err) {
        console.log('Silent background refresh - exercise data error:', err);
      }

      // Refresh user data if logged in
      if (session?.user) {
        try {
          const { data: userData, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (!error && userData) {
            await cacheManager.cacheData(`profile_${session.user.id}`, userData);
          }
        } catch (err) {
          console.log('Silent background refresh - user data error:', err);
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
      
      // Cache the exercise and plan data
      if (exercises) {
        await cacheManager.cacheData('exercises', exercises);
        
        // Also cache exercises by muscle group for faster access
        const exercisesByGroup: Record<string, any[]> = {};
        exercises.forEach(exercise => {
          const group = exercise.muscle_group || 'Other';
          if (!exercisesByGroup[group]) {
            exercisesByGroup[group] = [];
          }
          exercisesByGroup[group].push(exercise);
        });
        
        // Cache each muscle group separately
        for (const [group, groupExercises] of Object.entries(exercisesByGroup)) {
          await cacheManager.cacheData(`exercises_${group}`, groupExercises);
        }
      }
      
      if (plans) {
        await cacheManager.cacheData('workout_plans', plans);
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
      await cacheManager.preloadImages(
        criticalImages,
        (progress: number) => {
          setLoadingProgress(0.1 + progress * 0.1); // 10-20%
        }
      );
      
      // Preload high priority images next (important but can be skipped if slow)
      try {
        await Promise.race([
          cacheManager.preloadImages(highPriorityImages, (progress: number) => {
            const scaledProgress = 0.25 + (progress * 0.15);
            setLoadingProgress(scaledProgress);
          }),
          new Promise(resolve => setTimeout(resolve, 5000))
        ]);
      } catch (e) {
        console.log('High priority images timeout - continuing');
      }
      
      // Start loading normal priority images (can be skipped entirely if slow)
      // Don't await this - it will continue in background
      try {
        const preloadPromise = Promise.race([
          cacheManager.preloadImages(normalPriorityImages),
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
  
  // Preload video content
  const preloadVideoContent = async () => {
    try {
      setLoadingMessage('Preparing video content...');
      
      // Get video URLs from exercise videos or tutorials
      const { data: videos, error } = await supabase
        .from('exercise_videos')
        .select('id, video_url, thumbnail_url, exercise_id')
        .limit(PRELOAD_CONFIG.VIDEO_LIMIT);
      
      if (error) {
        console.log('No exercise_videos table found, skipping video preload');
        return true;
      }
      
      if (!videos || videos.length === 0) {
        return true;
      }
      
      // Cache video metadata
      await cacheManager.cacheData('exercise_videos', videos);
      
      // Preload video thumbnails (not the actual videos)
      const thumbnails = videos
        .filter(video => video.thumbnail_url)
        .map(video => video.thumbnail_url);
      
      if (thumbnails.length > 0) {
        await cacheManager.preloadImages(thumbnails, (progress: number) => {
          const scaledProgress = 0.4 + (progress * 0.1);
          setLoadingProgress(scaledProgress);
        });
      }
      
      updateProgress(0.05, 'Video thumbnails loaded');
      return true;
    } catch (error) {
      console.warn('Error preloading video content:', error);
      updateProgress(0.03, 'Continuing without video cache');
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
          // Cache all exercises
          await cacheManager.cacheData('exercises', allExercises);
          await cacheManager.cacheData('all_exercises', allExercises);
          console.log(`📊 Preloaded ${allExercises.length} total exercises`);
          
          // Also group exercises by muscle group for faster access
          const exercisesByGroup: Record<string, any[]> = {};
          allExercises.forEach(exercise => {
            const group = exercise.muscle_group || 'Other';
            if (!exercisesByGroup[group]) {
              exercisesByGroup[group] = [];
            }
            exercisesByGroup[group].push(exercise);
          });
          
          // Cache each muscle group separately
          for (const [group, groupExercises] of Object.entries(exercisesByGroup)) {
            await cacheManager.cacheData(`exercises_${group}`, groupExercises);
            console.log(`📊 Cached ${groupExercises.length} exercises for ${group}`);
          }
          
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
          await cacheManager.cacheData('all_workout_plans', allPlans);
          await cacheManager.cacheData('workout_plans', allPlans);
          console.log(`📊 Preloaded ${allPlans.length} workout plans`);
          
          // Group plans by subcategory for faster access
          const plansBySubcategory: Record<string, any[]> = {};
          allPlans.forEach(plan => {
            const subcategory = plan.subcategory_identifier || 'default';
            if (!plansBySubcategory[subcategory]) {
              plansBySubcategory[subcategory] = [];
            }
            plansBySubcategory[subcategory].push(plan);
          });
          
          // Cache each subcategory separately
          for (const [subcategory, subcategoryPlans] of Object.entries(plansBySubcategory)) {
            await cacheManager.cacheData(`workout_plans_${subcategory}`, subcategoryPlans);
          }
          
          fetchPromises.push(Promise.resolve(true));
        }
      } catch (err) {
        console.log('Error precaching workout plans:', err);
      }
      
      // SECTION 3: Cache ALL exercise_videos - no limits
      try {
        const { data: allVideos, error } = await supabase
          .from('exercise_videos')
          .select('*'); // Get everything
        
        if (!error && allVideos) {
          await cacheManager.cacheData('exercise_videos', allVideos);
          console.log(`📊 Preloaded ${allVideos.length} exercise videos`);
          
          // Group videos by exercise_id for faster access
          const videosByExercise: Record<string, any[]> = {};
          allVideos.forEach(video => {
            const exerciseId = video.exercise_id || 'default';
            if (!videosByExercise[exerciseId]) {
              videosByExercise[exerciseId] = [];
            }
            videosByExercise[exerciseId].push(video);
          });
          
          // Cache each exercise's videos separately
          for (const [exerciseId, exerciseVideos] of Object.entries(videosByExercise)) {
            await cacheManager.cacheData(`exercise_videos_${exerciseId}`, exerciseVideos);
          }
          
          fetchPromises.push(Promise.resolve(true));
        }
      } catch (err) {
        console.log('Error precaching exercise videos:', err);
      }
      
      // SECTION 4: Cache ALL categories and subcategories
      try {
        // Load workout categories
        const { data: categories, error } = await supabase
          .from('workout_plan_categories')
          .select('*');
        
        if (!error && categories) {
          await cacheManager.cacheData('workout_plan_categories', categories);
          fetchPromises.push(Promise.resolve(true));
        }
        
        // Load workout subcategories
        const { data: subcategories, error: subcatError } = await supabase
          .from('workout_plan_subcategories')
          .select('*');
        
        if (!subcatError && subcategories) {
          await cacheManager.cacheData('workout_plan_subcategories', subcategories);
          fetchPromises.push(Promise.resolve(true));
        }
        
        // Load exercise categories
        const { data: exCategories, error: exCatError } = await supabase
          .from('exercise_categories')
          .select('*');
        
        if (!exCatError && exCategories) {
          await cacheManager.cacheData('exercise_categories', exCategories);
          fetchPromises.push(Promise.resolve(true));
        }
      } catch (err) {
        console.log('Error precaching categories/subcategories:', err);
      }
      
      // SECTION 5: Cache featured workout plans
      try {
        const { data, error } = await supabase
          .from('workout_plans')
          .select('*')
          .eq('featured', true);
        
        if (!error && data) {
          await cacheManager.cacheData('featured_workout_plans', data);
          fetchPromises.push(Promise.resolve(true));
        }
      } catch (err) {
        console.log('Error fetching featured workout plans:', err);
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
            await cacheManager.cacheData(`user_settings_${session.user.id}`, data);
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
            await cacheManager.cacheData(`profile_${session.user.id}`, data);
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
            await cacheManager.cacheData(`workouts_${session.user.id}`, data);
            await cacheManager.cacheData(`recent_workouts_${session.user.id}`, data.slice(0, 10));
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
            await cacheManager.cacheData(`achievements_${session.user.id}`, data);
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
            await cacheManager.cacheData(`favorite_exercises_${session.user.id}`, data);
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
            await cacheManager.cacheData(`progress_photos_${session.user.id}`, data);
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
            await cacheManager.cacheData(`user_measurements_${session.user.id}`, data);
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

  // Preload app resources on initial load
  useEffect(() => {
    async function prepare() {
      const startTime = Date.now();
      try {
        console.log('🚀 Preparing app resources...');
        
        // Start with some initial progress
        setLoadingProgress(0.05);
        setLoadingMessage(LOADING_MESSAGES.START);
        
        // Initialize cache system
        await cacheManager.initialize();
        
        // Check network connectivity
        let isConnected = false;
        try {
          const networkState = await Network.getNetworkStateAsync();
          isConnected = !!networkState.isConnected && !!networkState.isInternetReachable;
        } catch (error) {
          console.warn('Failed to check network state:', error);
          isConnected = true; // Assume connected if check fails
        }
        
        // Always preload static assets first (even offline)
        await Promise.race([
          preloadStaticAssets(),
          new Promise(resolve => setTimeout(resolve, PRELOAD_CONFIG.TIMEOUT.STATIC_ASSETS))
        ]);
        
        // Only preload remote resources if connected
        if (isConnected) {
          try {
            // Cache ALL database tables up front with extended timeouts
            setLoadingMessage('Caching all application data...');
            
            // Preload frequently used data with increased limits and timeouts
            await Promise.race([
              preloadFrequentlyUsedData(),
              new Promise(resolve => setTimeout(resolve, PRELOAD_CONFIG.TIMEOUT.DATA * 2)) // Double the timeout
            ]);
            
            // Preload ALL exercise and plan images in one go
            setLoadingMessage('Preloading all images...');
            try {
              // Get all exercise images from the cache
              const allExercises = await cacheManager.getCachedData<any[]>('all_exercises') || [];
              const allPlans = await cacheManager.getCachedData<any[]>('all_workout_plans') || [];
              const exerciseVideos = await cacheManager.getCachedData<any[]>('exercise_videos') || [];

              // Collect all image URLs
              const exerciseImageUrls = allExercises
                .filter((ex) => ex.image_url).map((ex) => ex.image_url);
              
              const planImageUrls = allPlans
                .filter((p) => p.image_url).map((p) => p.image_url);
                
              const videoThumbnailUrls = exerciseVideos
                .filter((v) => v.thumbnail_url).map((v) => v.thumbnail_url);
              
              // Include any SVGs or muscle diagrams
              const svgAssets: number[] = [];
              try {
                // Get SVG files if they exist in STATIC_IMAGES
                if ('svg' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).svg === 'object') {
                  Object.values((STATIC_IMAGES as any).svg).forEach(svg => svgAssets.push(svg as number));
                }
                
                // Add muscle group SVGs if they exist
                if ('muscles' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).muscles === 'object') {
                  Object.values((STATIC_IMAGES as any).muscles).forEach(muscle => svgAssets.push(muscle as number));
                }
              } catch (e) {
                console.log('No SVG files defined in STATIC_IMAGES');
              }
              
              const totalImages = exerciseImageUrls.length + planImageUrls.length + videoThumbnailUrls.length;
              console.log(`🖼️ Preloading ${totalImages} total images and ${svgAssets.length} SVG assets`);
              
              // Load SVG assets first
              await Asset.loadAsync(svgAssets);
              
              // Then load all remote images in batches to avoid overwhelming the network
              const BATCH_SIZE = 15;
              
              // Function to load a batch of images with progress reporting
              const loadBatch = async (urls: string[], startProgress: number, endProgress: number) => {
                for (let i = 0; i < urls.length; i += BATCH_SIZE) {
                  const batch = urls.slice(i, i + BATCH_SIZE);
                  const batchProgress = i / urls.length;
                  const progressRange = endProgress - startProgress;
                  
                  setLoadingProgress(startProgress + batchProgress * progressRange);
                  setLoadingMessage(`Loading images... (${i + batch.length}/${urls.length})`);
                  
                  await Promise.race([
                    cacheManager.preloadImages(batch, (progress: number) => {
                      const scaledProgress = startProgress + 
                        (batchProgress * progressRange) + 
                        (progress * progressRange / Math.ceil(urls.length / BATCH_SIZE));
                      setLoadingProgress(scaledProgress);
                    }),
                    new Promise(resolve => setTimeout(resolve, 4000)) // 4s timeout per batch
                  ]);
                }
              };
              
              // Load exercise images (0.40 - 0.60)
              await loadBatch(exerciseImageUrls, 0.40, 0.60);
              
              // Load plan images (0.60 - 0.75)
              await loadBatch(planImageUrls, 0.60, 0.75);
              
              // Load video thumbnails (0.75 - 0.85)
              await loadBatch(videoThumbnailUrls, 0.75, 0.85);
              
              setLoadingMessage('Image preloading complete');
              
            } catch (e) {
              console.warn('Complete image preloading error:', e);
              updateProgress(0.1, 'Continuing with limited image cache');
            }
            
            // Explicitly prefetch all exercise data for faster navigation
            setLoadingMessage('Optimizing for navigation...');
            try {
              await Promise.race([
                cacheManager.prefetchExerciseListData({
                  includeImages: true, 
                  categoryLimit: 1000 // Set high limit to include all exercises
                }),
                new Promise(resolve => setTimeout(resolve, 5000))
              ]);
              updateProgress(0.05, 'Exercise data ready');
            } catch (e) {
              console.warn('Exercise list prefetch error:', e);
            }
          } catch (e) {
            console.warn('Remote resource preloading error:', e);
            updateProgress(0.3, 'Continuing with limited cache'); 
          }
        } else {
          updateProgress(0.3, LOADING_MESSAGES.OFFLINE);
        }
        
        // Finalize loading
        setLoadingProgress(0.95);
        setLoadingMessage(LOADING_MESSAGES.ALMOST_READY);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setLoadingProgress(1);
        setLoadingMessage(LOADING_MESSAGES.READY);
        
        const endTime = Date.now();
        const loadTime = ((endTime - startTime) / 1000).toFixed(2);
        console.log(`✅ App resources preloaded in ${loadTime}s - Ready to start the app`);
      } catch (e) {
        console.warn('Error preloading resources:', e);
        setLoadingProgress(1);
        setLoadingMessage(LOADING_MESSAGES.LIMITED);
      } finally {
        setIsAppReady(true);
        await safelyHideSplashScreen();
      }
    }

    prepare();
  }, []);

  // Hide the loading screen when app is ready
  const onFinishLoading = () => {
    setShowLoadingScreen(false);
  };

  if (!isAppReady) {
    return null;
  }

  return (
    <>
      {showLoadingScreen ? (
        <InitialLoadingScreen 
          onFinish={onFinishLoading}
          message={loadingMessage || (session ? LOADING_MESSAGES.AUTHENTICATED : LOADING_MESSAGES.DEFAULT)}
          duration={4000}
          progressValue={loadingProgress}
        />
      ) : (
        children
      )}
    </>
  );
} 