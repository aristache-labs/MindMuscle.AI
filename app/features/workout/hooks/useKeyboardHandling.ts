import { useState, useEffect, useRef } from 'react';
import {
  Keyboard,
  Platform,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';

// Define an interface for the event target that includes measureInWindow
interface MeasurableNode {
  measureInWindow: (
    callback: (x: number, y: number, width: number, height: number) => void,
  ) => void;
}

export interface UseKeyboardHandlingReturn {
  keyboardHeight: number;
  activeInputPosition: number;
  scrollViewRef: React.RefObject<ScrollView | null>;
  handleInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  handleInputBlur: (id: string) => void;
  focusedInputs: Record<string, boolean>;
  setFocusedInputs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export const useKeyboardHandling = (): UseKeyboardHandlingReturn => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeInputPosition, setActiveInputPosition] = useState(0);
  const [focusedInputs, setFocusedInputs] = useState<Record<string, boolean>>({});
  const scrollViewRef = useRef<ScrollView | null>(null);

  const handleInputFocus = (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setFocusedInputs((prev) => ({
      ...prev,
      [id]: true,
    }));

    // Measure the position of the focused input with a delay to ensure layout is complete
    if (event?.target) {
      // Store the target reference before the timeout
      const targetRef = event.target as unknown as MeasurableNode; // Cast to our interface

      setTimeout(() => {
        if (targetRef) {
          targetRef.measureInWindow((x: number, y: number, width: number, height: number) => {
            // Store the input center position for better calculation
            const inputCenterPosition = y + height / 2;
            setActiveInputPosition(inputCenterPosition);

            // If keyboard is already visible, trigger immediate scroll with improved calculation
            if (keyboardHeight > 0 && scrollViewRef.current) {
              const screenHeight = Dimensions.get('window').height;
              const statusBarHeight = Platform.OS === 'ios' ? 44 : 24;
              const headerHeight = 60;
              const tabBarHeight = 0;

              // Calculate the visible area above keyboard
              const visibleHeight =
                screenHeight - keyboardHeight - statusBarHeight - headerHeight - tabBarHeight;

              // Dynamic positioning based on input location - lower inputs get positioned higher up
              const currentInputPosition = inputCenterPosition - statusBarHeight - headerHeight;
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
          });
        }
      }, 50); // Reduced delay for faster response
    }
  };

  const handleInputBlur = (id: string) => {
    setFocusedInputs((prev) => ({
      ...prev,
      [id]: false,
    }));
    setActiveInputPosition(0);
  };

  // Keyboard handling effect
  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        const keyboardHeight = event.endCoordinates.height;
        setKeyboardHeight(keyboardHeight);

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
        setKeyboardHeight(0);
      },
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, [activeInputPosition]);

  return {
    keyboardHeight,
    activeInputPosition,
    scrollViewRef,
    handleInputFocus,
    handleInputBlur,
    focusedInputs,
    setFocusedInputs,
  };
};
export default function disablewarn() {
  return null;
}
