import React, { useEffect, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import InitialLoadingScreen from './InitialLoadingScreen';
import { STATIC_IMAGES } from '@utils/imagePreloader';
import { useAuth } from '@store/AuthContext';
import * as Network from 'expo-network';
import { cacheManager } from '@utils/cacheManager';
import supabase from '@services/supabase';
import { Asset } from 'expo-asset';
import { LOADING_MESSAGES } from '@constants/loadingMessages';

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
          await preloadFrequentlyUsedData();
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

  // Preload static assets (bundled with the app)
  const preloadStaticAssets = async () => {
    try {
      setLoadingMessage(LOADING_MESSAGES.STATIC_ASSETS);
      
      const staticImagesArray = [
        ...Object.values(STATIC_IMAGES.measurements),
        ...Object.values(STATIC_IMAGES.bodyModel)
      ];
      
      await Asset.loadAsync(staticImagesArray);
      
      updateProgress(0.2, LOADING_MESSAGES.STATIC_ASSETS + ' ✓');
      return true;
    } catch (error) {
      console.warn('Error preloading static assets:', error);
      updateProgress(0.1, 'Continuing with limited assets');
      return false;
    }
  };
  
  // Improve preloading of remote images and adding workout plans to memory cache
  const preloadRemoteImages = async () => {
    try {
      setLoadingMessage(LOADING_MESSAGES.IMAGES);
      
      // Get exercise images
      const { data: exercises, error } = await supabase
        .from('exercises')
        .select('id, image_url')
        .limit(40);
      
      if (error) throw error;
      
      // Get workout plan images
      const { data: plans, error: plansError } = await supabase
        .from('workout_plans')
        .select('id, image_url, title')
        .limit(30);
      
      if (plansError) throw plansError;
      
      // Collect all image URLs
      const highPriorityImages: string[] = [];
      const normalPriorityImages: string[] = [];
      
      plans?.forEach(plan => {
        if (plan.image_url) highPriorityImages.push(plan.image_url);
      });
      
      exercises?.forEach(exercise => {
        if (exercise.image_url) normalPriorityImages.push(exercise.image_url);
      });
      
      // Preload high priority images first
      await cacheManager.preloadImages(highPriorityImages, (progress) => {
        const scaledProgress = 0.2 + (progress * 0.2);
        setLoadingProgress(scaledProgress);
      });
      
      // Then preload normal priority images
      await cacheManager.preloadImages(normalPriorityImages, (progress) => {
        const scaledProgress = 0.4 + (progress * 0.2);
        setLoadingProgress(scaledProgress);
      });
      
      updateProgress(0.2, LOADING_MESSAGES.IMAGES + ' ✓');
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
      
      // Cache exercise categories if available
      try {
        const { data: categories, error } = await supabase
          .from('exercise_categories')
          .select('*');
        
        if (!error && categories) {
          await cacheManager.cacheData('exercise_categories', categories);
        }
      } catch (categoryError) {
        console.log('Note: exercise_categories table may not exist yet');
      }
      
      // Cache exercises data if available
      try {
        const { data: exercises, error } = await supabase
          .from('exercises')
          .select('id, name, image_url, category')
          .limit(50);
          
        if (!error && exercises) {
          await cacheManager.cacheData('exercises', exercises);
        }
      } catch (exercisesError) {
        console.log('Note: could not cache exercises data');
      }
      
      // Cache user settings if logged in
      if (session?.user) {
        try {
          const { data: settings, error: settingsError } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', session.user.id)
            .single();
          
          if (!settingsError && settings) {
            await cacheManager.cacheData(`user_settings_${session.user.id}`, settings);
          }
        } catch (userSettingsError) {
          console.log('Note: user_settings table may not exist yet');
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

  // Preload app resources on initial load
  useEffect(() => {
    async function prepare() {
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
        
        // Always preload static assets first
        await preloadStaticAssets();
        
        // Preload remote data if connected
        if (isConnected) {
          try {
            // Use timeouts to prevent getting stuck
            await Promise.race([
              preloadRemoteImages(),
              new Promise(resolve => setTimeout(resolve, 6000))
            ]);
            
            await Promise.race([
              preloadFrequentlyUsedData(),
              new Promise(resolve => setTimeout(resolve, 3000))
            ]);
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