import React, { useEffect, useCallback, useState } from 'react';
import { BackHandler, Platform, InteractionManager } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useBackNavigation } from './useBackNavigation';
import { SwipeBackHandler } from '../components/SwipeBackHandler';

type GestureDetectorProps = {
  children: React.ReactNode;
};

/**
 * Custom hook for managing back navigation with swipe gestures
 * This combines registration of back handlers with swipe gesture support
 * 
 * @param targetRoute Optional route to navigate to on back action
 * @param customHandler Optional custom handler function for back navigation
 * @returns Object containing the SwipeBackHandler component and navigation functions
 */
export function useSwipeNavigation(targetRoute?: string, customHandler?: () => boolean) {
  const router = useRouter();
  const pathname = usePathname();
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Create a back handler based on the parameters
  const handleBackNavigation = useCallback(() => {
    // Prevent multiple navigations being triggered simultaneously
    if (isNavigating) {
      console.log('Navigation already in progress, ignoring');
      return true;
    }
    
    try {
      console.log('useSwipeNavigation handler triggered');
      setIsNavigating(true);
      
      // If custom handler provided, use it first
      if (customHandler) {
        const result = customHandler();
        // Reset navigation lock after a delay
        setTimeout(() => setIsNavigating(false), 300);
        return result;
      }
      
      // If target route provided, navigate to it
      if (targetRoute) {
        // Use InteractionManager to ensure navigation happens after animations
        InteractionManager.runAfterInteractions(() => {
          router.push(targetRoute);
        });
        
        // Reset navigation lock after a delay
        setTimeout(() => setIsNavigating(false), 300);
        return true;
      }
      
      // Default to standard back navigation
      InteractionManager.runAfterInteractions(() => {
        router.back();
      });
      
      // Reset navigation lock after a delay
      setTimeout(() => setIsNavigating(false), 300);
      return true;
    } catch (error) {
      console.error('Error in swipe navigation handler:', error instanceof Error ? error.message : String(error));
      
      // Safe fallback with delay
      setTimeout(() => {
        try {
          if (targetRoute) {
            router.push(targetRoute);
          } else {
            router.back();
          }
        } catch (fallbackError) {
          console.error('Error in navigation fallback:', fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
        }
        setIsNavigating(false);
      }, 100);
      
      return true;
    }
  }, [router, targetRoute, customHandler, isNavigating]);
  
  // Register with the global back handler system
  useBackNavigation(handleBackNavigation);
  
  // Return components and handlers for use in the component
  return {
    // Component wrapped with swipe detection
    SwipeBackContainer: useCallback(({ children }: { children: React.ReactNode }) => (
      <SwipeBackHandler customHandler={handleBackNavigation}>
        {children}
      </SwipeBackHandler>
    ), [handleBackNavigation]),
    // Function to manually trigger navigation
    goBack: handleBackNavigation
  };
}

/**
 * Hook to enable swipe right for back navigation
 * @param onBack - Optional custom back handler
 * @returns Functions and components for swipe navigation
 */
export function useSwipeGesture(onBack?: () => void) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  // Default back action if no custom handler is provided
  const handleBack = useCallback(() => {
    // Prevent multiple navigations
    if (isNavigating) return true;
    
    try {
      setIsNavigating(true);
      
      if (onBack) {
        onBack();
        setTimeout(() => setIsNavigating(false), 300);
        return true;
      }
      
      InteractionManager.runAfterInteractions(() => {
        router.back();
        setTimeout(() => setIsNavigating(false), 300);
      });
      
      return true;
    } catch (error) {
      console.error('Error in swipe gesture handler:', error instanceof Error ? error.message : String(error));
      setTimeout(() => setIsNavigating(false), 300);
      return true;
    }
  }, [router, onBack, isNavigating]);

  // Set up hardware back button handler for Android
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        return handleBack();
      });

      return () => {
        try {
          backHandler.remove();
        } catch (error) {
          console.error('Error removing back handler:', error);
        }
      };
    }
  }, [handleBack]);

  // Create swipe right gesture for back navigation
  const swipeGesture = Gesture.Fling()
    .direction(1) // 1 = right direction
    .onEnd(() => {
      setTimeout(() => {
        try {
          handleBack();
        } catch (error) {
          console.error('Error in delayed swipe handler:', error);
        }
      }, 0);
    });

  // React component wrapper for gesture detection
  const SwipeGestureDetector = useCallback(({ children }: GestureDetectorProps) => (
    <GestureDetector gesture={swipeGesture}>
      {children}
    </GestureDetector>
  ), [swipeGesture]);

  return {
    gesture: swipeGesture,
    SwipeGestureDetector,
  };
}

// Create a default export that includes both hooks
const SwipeGestureHooks = {
  useSwipeNavigation,
  useSwipeGesture
};

export default SwipeGestureHooks; 