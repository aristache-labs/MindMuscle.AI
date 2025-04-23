import { useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'expo-router';
import { useBackNavigation as useGlobalBackNavigation } from '../components/GlobalGestureHandler';

/**
 * Hook to register a custom back navigation handler for the current screen
 * This allows screens to define their own back navigation behavior without modifying their entire structure
 * 
 * @param handler Function to handle back navigation, return true to prevent default behavior
 */
export function useBackNavigation(handler: () => boolean) {
  const { registerBackHandler, unregisterBackHandler } = useGlobalBackNavigation();
  const pathname = usePathname();
  const handlerRef = useRef(handler);
  
  console.log('useBackNavigation called for path:', pathname);
  
  // Update the handler reference whenever it changes
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  
  // Wrap the handler in a try/catch to prevent crashes
  const safeHandler = useCallback(() => {
    try {
      return handlerRef.current();
    } catch (error) {
      console.error('Error in back navigation handler:', error);
      return false;
    }
  }, []);
  
  useEffect(() => {
    console.log('useBackNavigation effect running for path:', pathname);
    try {
      // Register the handler when the component mounts
      registerBackHandler(pathname, safeHandler);
      
      // Unregister when the component unmounts
      return () => {
        console.log('useBackNavigation cleanup for path:', pathname);
        try {
          unregisterBackHandler(pathname);
        } catch (error) {
          console.error('Error unregistering back handler:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up back navigation:', error);
    }
  }, [pathname, safeHandler, registerBackHandler, unregisterBackHandler]);
}

/**
 * Hook to register a custom route to navigate back to
 * Simplified usage for common case of just wanting to navigate to a specific route
 * 
 * @param route Route to navigate to on back action
 */
export function useBackRoute(route: string) {
  const { registerBackHandler, unregisterBackHandler } = useGlobalBackNavigation();
  const router = useRouter();
  const pathname = usePathname();
  
  console.log('useBackRoute called for path:', pathname, 'to route:', route);
  
  const backHandler = useCallback(() => {
    try {
      console.log('useBackRoute handler executing, navigating to:', route);
      // Actually navigate to the route
      router.push(route);
      // We return true to prevent the default implementation
      return true;
    } catch (error) {
      console.error('Error in back route handler:', error);
      return false;
    }
  }, [router, route]);
  
  useEffect(() => {
    console.log('useBackRoute effect running for path:', pathname);
    try {
      // Register a handler that pushes to the specified route
      registerBackHandler(pathname, backHandler);
      
      // Unregister when the component unmounts
      return () => {
        console.log('useBackRoute cleanup for path:', pathname);
        try {
          unregisterBackHandler(pathname);
        } catch (error) {
          console.error('Error unregistering back route handler:', error);
        }
      };
    } catch (error) {
      console.error('Error setting up back route:', error);
    }
  }, [pathname, backHandler, registerBackHandler, unregisterBackHandler]);
}

// Default export for Expo Router compatibility
const BackNavigationHooks = {
  useBackNavigation,
  useBackRoute
};

export default BackNavigationHooks; 