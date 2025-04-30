import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import Constants from 'expo-constants';

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
        // Check if we're in Expo Go
        const isExpoGo = Constants.appOwnership === 'expo';
        
        if (isExpoGo) {
          console.log('Running in Expo Go - using simplified splash screen handling');
          return;
        }
        
        // Try to prevent auto-hide with a safe guard
        try {
          await SplashScreen.preventAutoHideAsync();
        } catch (err) {
          console.warn('Could not prevent splash screen auto hide:', err);
          // Continue execution - this is not critical
        }
      } catch (error) {
        console.warn('Error in splash screen preparation:', error);
      }
    };
    
    prepare();
    
    // Clean up function to hide splash screen if needed
    return () => {
      const hideSplash = async () => {
        try {
          // Only attempt to hide if app is ready
          if (isAppReady) {
            try {
              await SplashScreen.hideAsync();
            } catch (err) {
              console.warn('Could not hide splash screen during cleanup:', err);
              // Not critical, continue
            }
          }
        } catch (error) {
          console.warn('Error in splash screen cleanup:', error);
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
        
        // Check if we're in Expo Go
        const isExpoGo = Constants.appOwnership === 'expo';
        
        if (!isExpoGo) {
          // Try to hide the splash screen
          try {
            await SplashScreen.hideAsync();
          } catch (err) {
            console.warn('Could not hide splash screen after layout:', err);
            // Not critical, continue
          }
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