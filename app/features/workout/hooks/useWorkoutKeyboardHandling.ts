import { useEffect } from 'react';
import { Keyboard, Platform, Dimensions } from 'react-native';
import { useKeyboardHandling } from './useKeyboardHandling';

export const useWorkoutKeyboardHandling = () => {
  const { keyboardHeight, activeInputPosition, scrollViewRef, handleInputFocus, handleInputBlur } =
    useKeyboardHandling();

  // Keyboard handling effect
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const keyboardHeight = event.endCoordinates.height;

        // Scroll to active input after a short delay
        setTimeout(
          () => {
            if (scrollViewRef.current && activeInputPosition > 0) {
              const screenHeight = Dimensions.get('window').height;
              const statusBarHeight = Platform.OS === 'ios' ? 44 : 24; // Status bar height
              const headerHeight = 60; // Approximate header height
              const tabBarHeight = 0; // No tab bar in this screen

              // Calculate the visible area above keyboard
              const visibleHeight =
                screenHeight - keyboardHeight - statusBarHeight - headerHeight - tabBarHeight;

              // Dynamic positioning based on input location - lower inputs get positioned higher up
              const currentInputPosition = activeInputPosition - statusBarHeight - headerHeight;
              const contentHeight = screenHeight - statusBarHeight - headerHeight; // Total scrollable content area
              const inputRelativePosition = currentInputPosition / contentHeight; // 0 = top, 1 = bottom

              // For inputs in lower half of content, position them higher up (50-60% of visible area)
              // For inputs in upper half, position them lower (70-80% of visible area)
              let targetPositionRatio;
              if (inputRelativePosition > 0.6) {
                // Lower content - position at 50% of visible area (more aggressive scroll up)
                targetPositionRatio = 0.5;
              } else if (inputRelativePosition > 0.3) {
                // Middle content - position at 60% of visible area
                targetPositionRatio = 0.6;
              } else {
                // Upper content - position at 70% of visible area (less aggressive)
                targetPositionRatio = 0.7;
              }

              const targetInputPosition = visibleHeight * targetPositionRatio;

              // Calculate how much we need to scroll
              const scrollOffset = currentInputPosition - targetInputPosition;

              // Ensure we don't scroll to negative values
              const targetScrollY = Math.max(0, scrollOffset);

              scrollViewRef.current.scrollTo({
                y: targetScrollY,
                animated: true,
              });
            }
          },
          Platform.OS === 'ios' ? 100 : 200,
        );
      },
    );

    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        // Reset the active input position which will hide the keyboard
        handleInputBlur('keyboard-hide-event');
      },
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [activeInputPosition, handleInputBlur]);

  return {
    keyboardHeight,
    activeInputPosition,
    scrollViewRef,
    handleInputFocus,
    handleInputBlur,
  };
};
