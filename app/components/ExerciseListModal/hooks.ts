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
export function useCustomizeModeAnimations(isCustomizeMode: boolean) {
  const customizeProgress = useSharedValue(0);
  const cardAnimations = useSharedValue(0);

  React.useEffect(() => {
    if (isCustomizeMode) {
      // Start overall customize progress immediately
      customizeProgress.value = withSpring(1, { damping: 25, stiffness: 300 });
      // Start card animations with a slight delay for a polished effect
      cardAnimations.value = withTiming(1, { duration: 350 });
    } else {
      // Reverse the animation quickly
      customizeProgress.value = withSpring(0, { damping: 25, stiffness: 400 });
      cardAnimations.value = withTiming(0, { duration: 200 });
    }
  }, [isCustomizeMode, customizeProgress, cardAnimations]);

  // Cleanup function - NOT a worklet, just regular JS
  const cleanup = useCallback(() => {
    customizeProgress.value = 0;
    cardAnimations.value = 0;
  }, [customizeProgress, cardAnimations]);

  return { customizeProgress, cardAnimations, cleanup };
}
