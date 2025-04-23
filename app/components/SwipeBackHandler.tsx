import React, { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useBackNavigation } from '../hooks/useBackNavigation';
import { usePathname } from 'expo-router';

interface SwipeBackHandlerProps {
  children: React.ReactNode;
  customHandler?: () => boolean;
}

/**
 * Component that adds swipe-right gesture detection for back navigation
 * Designed to be used on screens that have back navigation
 * 
 * Usage:
 * <SwipeBackHandler>
 *   <YourScreenContent />
 * </SwipeBackHandler>
 */
function SwipeBackHandler({ children, customHandler }: SwipeBackHandlerProps) {
  const pathname = usePathname();
  
  // If a custom handler is provided, use it, otherwise rely on the registered handler
  const handleBack = useCallback(() => {
    try {
      console.log('SwipeBackHandler - back navigation triggered');
      
      if (customHandler) {
        return customHandler();
      }
      
      // Return false to let the default handler take over
      return false;
    } catch (error) {
      console.error('Error in SwipeBackHandler:', error);
      return false;
    }
  }, [customHandler]);
  
  // Use a combination of Pan and Fling gestures for more reliable detection
  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15]) // Only activate if moved horizontally
    .failOffsetY([-15, 15])   // Fail if moved vertically first
    .onStart(() => {
      console.log('Pan gesture started');
    })
    .onEnd((e) => {
      // Wrap in try/catch with enhanced error logging
      try {
        // Log detailed information for debugging
        console.log('Pan gesture ended', {
          translationX: e.translationX,
          translationY: e.translationY,
          velocityX: e.velocityX,
          velocityY: e.velocityY
        });
        
        // Only trigger back navigation if:
        // 1. Gesture moved right (positive x translation)
        // 2. Moved at least 50 pixels horizontally
        // 3. Horizontal movement is greater than vertical movement (to avoid triggering on scrolls)
        if (
          e.translationX > 50 && 
          Math.abs(e.translationX) > Math.abs(e.translationY) * 2
        ) {
          console.log('Pan gesture triggered back navigation');
          // Use setTimeout to avoid potential race conditions with gesture processing
          setTimeout(() => {
            try {
              handleBack();
            } catch (backError) {
              console.error('Error in delayed back handler:', backError);
            }
          }, 0);
        }
      } catch (error) {
        console.error('Error in pan gesture handler:', error instanceof Error ? error.message : String(error));
      }
    })
    .withTestId('back-navigation-pan')
    .hitSlop({ left: 50, width: 100 });

  // Create swipe right gesture for back navigation (with fling gesture)
  const flingGesture = Gesture.Fling()
    .direction(1) // 1 = right direction
    .onBegin(() => {
      console.log('Fling gesture began');
    })
    .onEnd(() => {
      try {
        console.log('Fling gesture ended, triggering back navigation');
        // Use setTimeout to avoid potential race conditions with gesture processing
        setTimeout(() => {
          try {
            handleBack();
          } catch (backError) {
            console.error('Error in delayed fling back handler:', backError);
          }
        }, 0);
      } catch (error) {
        console.error('Error in fling gesture handler:', error instanceof Error ? error.message : String(error));
      }
    })
    .withTestId('back-navigation-fling')
    .hitSlop({ left: 50, width: 100 });

  // Combine both gestures for better detection
  const combinedGesture = useMemo(() => {
    console.log('Creating combined gesture');
    return Gesture.Race(panGesture, flingGesture);
  }, [panGesture, flingGesture]);

  // Wrap in a root view to ensure proper gesture handling
  return (
    <View style={styles.container}>
      <GestureHandlerRootView style={styles.gestureRootView}>
        <GestureDetector gesture={combinedGesture}>
          <View style={styles.gestureDetectorView}>
            {children}
          </View>
        </GestureDetector>
      </GestureHandlerRootView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gestureRootView: {
    flex: 1,
  },
  gestureDetectorView: {
    flex: 1,
  }
});

// Export both the named and default export for compatibility
export { SwipeBackHandler };
export default SwipeBackHandler; 