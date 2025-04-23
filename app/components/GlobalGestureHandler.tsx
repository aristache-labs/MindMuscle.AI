import React, { useContext, createContext, ReactNode, useCallback, useMemo, useRef } from 'react';
import { BackHandler, Platform, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';

// Define context to provide custom back navigation handlers per route
type BackNavigationContext = {
  registerBackHandler: (route: string, handler: () => boolean) => void;
  unregisterBackHandler: (route: string) => void;
};

const BackNavigationContext = createContext<BackNavigationContext>({
  registerBackHandler: () => {},
  unregisterBackHandler: () => {},
});

export const useBackNavigation = () => useContext(BackNavigationContext);

interface GlobalGestureHandlerProps {
  children: ReactNode;
}

function GlobalGestureHandler({ children }: GlobalGestureHandlerProps) {
  const router = useRouter();
  const pathname = usePathname();
  
  // Store custom back handlers for different routes
  const [backHandlers, setBackHandlers] = React.useState<Record<string, () => boolean>>({});
  const backHandlersRef = useRef<Record<string, () => boolean>>({});

  console.log('GlobalGestureHandler mounted with pathname:', pathname);

  // Keep the ref in sync with the state
  useEffect(() => {
    backHandlersRef.current = backHandlers;
  }, [backHandlers]);

  // Register a custom back handler for a specific route
  const registerBackHandler = useCallback((route: string, handler: () => boolean) => {
    try {
      console.log('Registering back handler for route:', route);
      setBackHandlers(prev => ({
        ...prev,
        [route]: handler
      }));
    } catch (error) {
      console.error('Error registering back handler:', error);
    }
  }, []);

  // Unregister a custom back handler
  const unregisterBackHandler = useCallback((route: string) => {
    try {
      console.log('Unregistering back handler for route:', route);
      setBackHandlers(prev => {
        const newHandlers = { ...prev };
        delete newHandlers[route];
        return newHandlers;
      });
    } catch (error) {
      console.error('Error unregistering back handler:', error);
    }
  }, []);

  // Default back action used when no custom handler is registered
  const handleBack = useCallback(() => {
    try {
      const currentPath = pathname;
      const currentHandlers = backHandlersRef.current;
      
      console.log('Back navigation triggered', { 
        pathname: currentPath, 
        hasHandler: !!currentHandlers[currentPath], 
        handlers: Object.keys(currentHandlers) 
      });
      
      // Check if there's a custom handler for the current route
      if (currentHandlers[currentPath]) {
        console.log('Using custom handler for', currentPath);
        try {
          return currentHandlers[currentPath]();
        } catch (handlerError) {
          console.error('Error in custom back handler:', handlerError);
        }
      }
      
      // Default handling
      if (currentPath.includes('/(tabs)')) {
        console.log('Inside tabs, prevent exit');
        // Inside tabs, avoid exiting the app
        return true;
      }
      
      if (currentPath.includes('/(auth)/edit-profile')) {
        console.log('Edit profile specific handler');
        router.push('/(tabs)/profile');
        return true;
      }
      
      console.log('Default navigation: going back');
      router.back();
      return true;
    } catch (error) {
      console.error('Error in handleBack:', error);
      
      // Safe fallback
      try {
        router.back();
      } catch (routerError) {
        console.error('Error in fallback navigation:', routerError);
      }
      return true;
    }
  }, [pathname, router]);

  // Set up hardware back button handler for Android
  useEffect(() => {
    console.log('Setting up Android back handler');
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        console.log('Android hardware back pressed');
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

  // Log current handlers whenever they change
  useEffect(() => {
    console.log('Current back handlers:', Object.keys(backHandlers));
  }, [backHandlers]);

  const contextValue = useMemo(() => ({
    registerBackHandler,
    unregisterBackHandler
  }), [registerBackHandler, unregisterBackHandler]);

  return (
    <BackNavigationContext.Provider value={contextValue}>
      <GestureHandlerRootView style={styles.container}>
        {children}
      </GestureHandlerRootView>
    </BackNavigationContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  }
});

// Export both named and default export for compatibility
export { GlobalGestureHandler };
export default GlobalGestureHandler; 