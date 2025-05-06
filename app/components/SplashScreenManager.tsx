import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { STATIC_IMAGES, preloadAllImages, batchPreloadImages } from '@utils/imagePreloader';
import { useAuth } from '@store/AuthContext';
import * as Network from 'expo-network';
import supabase from '@services/supabase';
import { Asset } from 'expo-asset';
import { LOADING_MESSAGES } from '@constants/loadingMessages';
import * as FileSystem from 'expo-file-system';

// Define resources to be preloaded, organized by priority
const PRELOAD_CONFIG = {
  EXERCISE_LIMIT: Infinity, // No limit - load all exercises
  PLAN_LIMIT: Infinity, // No limit - load all plans

  SCREENS_CONTENT_LIMIT: 100, // Increased from 20
  TIMEOUT: {
    STATIC_ASSETS: 4000,
    REMOTE_IMAGES: 30000, // Increased from 15000 to allow more time for loading all images
    DATA: 20000, // Increased from 8000 for loading all data

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
      // Refresh exercise data
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('id, name, image_url, category')
        .limit(20);
        
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
                          // Collect all data
                          // const data = {
                          //   user: profileData,
                          //   settings: data,
                          //   workouts: workouts,
                          //   achievements: achievements,
                          //   favoriteExercises: favoriteExercises,
                          //   progressPhotos: progressPhotos,
                          //   userMeasurements: userMeasurements
                          // };
                          
                          // Set state with collected data
                          setLoadingProgress(0.95);
                          setLoadingMessage(LOADING_MESSAGES.AUTHENTICATED);
                          setIsAppReady(true);
                          await safelyHideSplashScreen();
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

  // Update the prepare function in useEffect
  useEffect(() => {
    async function prepare() {
      const startTime = Date.now();
      try {
        console.log('🚀 Preparing app resources...');
        
        setLoadingProgress(0.05);
        setLoadingMessage(LOADING_MESSAGES.START);
        
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
            // Cache ALL database tables up front
            setLoadingMessage('Caching all application data...');
            
            // Preload frequently used data
            await Promise.race([
              preloadFrequentlyUsedData(),
              new Promise(resolve => setTimeout(resolve, PRELOAD_CONFIG.TIMEOUT.DATA * 2))
            ]);
            
            // Fetch and preload ALL images
            setLoadingMessage('Preparing to load all images...');
            
            // Get all image URLs
            const allImageUrls = await fetchAllImageUrls();
            console.log(`🖼️ Found ${allImageUrls.length} total images to preload`);
            
            // Load SVG assets first
            const svgAssets: number[] = [];
            try {
              if ('svg' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).svg === 'object') {
                Object.values((STATIC_IMAGES as any).svg).forEach(svg => svgAssets.push(svg as number));
              }
              if ('muscles' in STATIC_IMAGES && typeof (STATIC_IMAGES as any).muscles === 'object') {
                Object.values((STATIC_IMAGES as any).muscles).forEach(muscle => svgAssets.push(muscle as number));
              }
              await Asset.loadAsync(svgAssets);
              console.log(`✅ Loaded ${svgAssets.length} SVG assets`);
            } catch (e) {
              console.warn('Error loading SVG assets:', e);
            }
            
            // Preload all remote images in batches
            setLoadingMessage('Loading all application images...');
            await batchPreloadImages(
              allImageUrls,
              PRELOAD_CONFIG.BATCH_SIZE,
              (progress) => {
                setLoadingProgress(0.4 + progress * 0.4); // 40-80% of total loading
                setLoadingMessage(`Loading images... (${Math.round(progress * 100)}%)`);
              }
            );
            
            setLoadingMessage('Image preloading complete');
            
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