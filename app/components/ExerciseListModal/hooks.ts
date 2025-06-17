import { useCallback, useMemo } from 'react';
import { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import React from 'react';

// Custom hook for drag animations
export function useDragAnimations() {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(
    () => ({
      transform: [{ translateY: translateY.value }, { scale: scale.value }],
      opacity: opacity.value,
    }),
    [translateY, scale, opacity],
  );

  const startDragAnimation = useCallback(() => {
    'worklet';
    scale.value = withSpring(1.05, { damping: 20, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
  }, [scale, opacity]);

  const endDragAnimation = useCallback(() => {
    'worklet';
    translateY.value = withTiming(0, { duration: 200 });
    scale.value = withTiming(1, { duration: 200 });
    opacity.value = withTiming(1, { duration: 200 });
  }, [translateY, scale, opacity]);

  const updateDragPosition = useCallback(
    (y: number) => {
      'worklet';
      translateY.value = y;
    },
    [translateY],
  );

  const updateDisplacement = useCallback(
    (displacement: number) => {
      'worklet';
      translateY.value = withTiming(displacement, { duration: 200 });
    },
    [translateY],
  );

  // Cleanup function - NOT a worklet, just regular JS
  const cleanup = useCallback(() => {
    translateY.value = 0;
    scale.value = 1;
    opacity.value = 1;
  }, [translateY, scale, opacity]);

  return {
    animatedStyle,
    startDragAnimation,
    endDragAnimation,
    updateDragPosition,
    updateDisplacement,
    cleanup,
  };
}

// Custom hook for drag displacement logic
export function useDragDisplacement(
  index: number,
  isDragging: boolean,
  draggedIndex: number,
  dragTargetIndex: number,
  isBeingDragged: boolean,
) {
  const shouldMoveUp = useMemo(() => {
    return (
      isDragging &&
      !isBeingDragged &&
      draggedIndex < index &&
      index <= dragTargetIndex &&
      dragTargetIndex > draggedIndex
    );
  }, [isDragging, isBeingDragged, draggedIndex, index, dragTargetIndex]);

  const shouldMoveDown = useMemo(() => {
    return (
      isDragging &&
      !isBeingDragged &&
      draggedIndex > index &&
      index >= dragTargetIndex &&
      dragTargetIndex < draggedIndex
    );
  }, [isDragging, isBeingDragged, draggedIndex, index, dragTargetIndex]);

  return { shouldMoveUp, shouldMoveDown };
}

// Custom hook for customize mode animations
export function useCustomizeModeAnimations(isCustomizeMode: boolean, visible: boolean) {
  const customizeProgress = useSharedValue(0);
  const cardAnimations = useSharedValue(0);

  // Track if this is the initial mount
  const isInitialMount = React.useRef(true);

  React.useEffect(() => {
    // Only trigger animations when modal is visible
    if (!visible) {
      return;
    }

    if (isCustomizeMode) {
      // If this is the initial mount and customize mode is already true,
      // set values immediately instead of animating (for add exercise flow)
      if (isInitialMount.current) {
        customizeProgress.value = 1;
        cardAnimations.value = 1;
      } else {
        // Normal animation when toggling customize mode
        customizeProgress.value = withSpring(1, { damping: 25, stiffness: 300 });
        cardAnimations.value = withTiming(1, { duration: 350 });
      }
    } else {
      // Always animate when turning off customize mode
      customizeProgress.value = withSpring(0, { damping: 25, stiffness: 400 });
      cardAnimations.value = withTiming(0, { duration: 200 });
    }

    // After the first effect run, no longer initial mount
    isInitialMount.current = false;
  }, [isCustomizeMode, visible, customizeProgress, cardAnimations]);

  // Cleanup function - NOT a worklet, just regular JS
  const cleanup = useCallback(() => {
    customizeProgress.value = 0;
    cardAnimations.value = 0;
    // Reset initial mount flag since cleanup means component is unmounting
    isInitialMount.current = true;
  }, [customizeProgress, cardAnimations]);

  return { customizeProgress, cardAnimations, cleanup };
}
