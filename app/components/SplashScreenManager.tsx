import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';

interface SplashScreenManagerProps {
  isAppReady: boolean;
  onLayoutRootView: () => Promise<void>;
  children: React.ReactNode;
}

/**
 * Component to manage the splash screen lifecycle
 * This handles the splash screen gracefully with proper error handling
 */
export default function SplashScreenManager({ 
  isAppReady, 
  onLayoutRootView,
  children 
}: SplashScreenManagerProps) {
  
  // Keep splash screen visible while app loads
  useEffect(() => {
    const prepare = async () => {
      try {
        // Safely access preventAutoHideAsync method
        if (SplashScreen.preventAutoHideAsync) {
          await SplashScreen.preventAutoHideAsync();
        } else {
          console.warn('SplashScreen.preventAutoHideAsync is not available');
        }
      } catch (error) {
        console.warn('Error keeping splash screen visible:', error);
      }
    };
    
    prepare();
    
    // Clean up function to hide splash screen if needed
    return () => {
      const hideSplash = async () => {
        try {
          if (isAppReady && SplashScreen.hideAsync) {
            await SplashScreen.hideAsync();
          }
        } catch (error) {
          console.warn('Error hiding splash screen on unmount:', error);
        }
      };
      
      hideSplash();
    };
  }, [isAppReady]);
  
  // Hide splash screen once the app is ready
  const handleLayoutView = useCallback(async () => {
    if (isAppReady) {
      try {
        // Call the onLayoutRootView first
        await onLayoutRootView();
        
        // Then try to hide splash screen if the method exists
        if (SplashScreen.hideAsync) {
          await SplashScreen.hideAsync();
        }
      } catch (error) {
        console.warn('Error in layout handler:', error);
      }
    }
  }, [isAppReady, onLayoutRootView]);
  
  if (!isAppReady) {
    return null;
  }
  
  return (
    <View style={{ flex: 1 }} onLayout={handleLayoutView}>
      {children}
    </View>
  );
} 