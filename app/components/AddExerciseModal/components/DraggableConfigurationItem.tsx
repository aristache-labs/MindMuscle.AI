import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import OptimizedImage from '../../OptimizedImage';
import { styles } from '../styles';
import { SelectedExercise } from '../types';

const ITEM_HEIGHT = 100;

// Custom hook for drag animations
function useDragAnimations(exerciseId: string, isBeingDragged: boolean) {
  // Use refs to persist shared values across re-renders
  const translateYRef = useRef(useSharedValue(0));
  const scaleRef = useRef(useSharedValue(1));
  const opacityRef = useRef(useSharedValue(1));
  const isAnimatingRef = useRef(useSharedValue(false));

  // Get the current shared values
  const translateY = translateYRef.current;
  const scale = scaleRef.current;
  const opacity = opacityRef.current;
  const isAnimating = isAnimatingRef.current;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const startDragAnimation = useCallback(() => {
    isAnimating.value = true;
    scale.value = withSpring(1.05, { damping: 20, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
  }, [scale, opacity, isAnimating]);

  const endDragAnimation = useCallback(() => {
    isAnimating.value = false;
    translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 200 });
  }, [translateY, scale, opacity, isAnimating]);

  const updateDragPosition = useCallback(
    (y: number) => {
      translateY.value = y;
    },
    [translateY],
  );

  const updateDisplacement = useCallback(
    (displacement: number) => {
      // Only update displacement if not currently being dragged
      if (!isBeingDragged && !isAnimating.value) {
        translateY.value = withSpring(displacement, { damping: 20, stiffness: 300 });
      }
    },
    [isBeingDragged, translateY, isAnimating],
  );

  return {
    animatedStyle,
    startDragAnimation,
    endDragAnimation,
    updateDragPosition,
    updateDisplacement,
  };
}

// Custom hook for drag displacement logic
function useDragDisplacement(
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

interface DraggableConfigurationItemProps {
  exercise: SelectedExercise;
  index: number;
  onConfigurationChange: (
    exerciseId: string,
    field: 'sets' | 'reps_range',
    value: string | number,
  ) => void;
  onRemoveExercise: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragUpdate: (draggedIndex: number, currentY: number) => void;
  isDragging: boolean;
  draggedIndex: number;
  dragTargetIndex: number;
  totalExercises: number;
}

export default function DraggableConfigurationItem({
  exercise,
  index,
  onConfigurationChange,
  onRemoveExercise,
  onDragStart,
  onDragEnd,
  onDragUpdate,
  isDragging,
  draggedIndex,
  dragTargetIndex,
  totalExercises,
}: DraggableConfigurationItemProps) {
  const isBeingDragged = isDragging && draggedIndex === index;

  const { shouldMoveUp, shouldMoveDown } = useDragDisplacement(
    index,
    isDragging,
    draggedIndex,
    dragTargetIndex,
    isBeingDragged,
  );

  const {
    animatedStyle,
    startDragAnimation,
    endDragAnimation,
    updateDragPosition,
    updateDisplacement,
  } = useDragAnimations(exercise.id, isBeingDragged);

  // Apply displacement animation
  useEffect(() => {
    // Only apply displacement animations if this item is NOT being dragged
    // and no dragging operation is happening at all
    if (isBeingDragged || isDragging) return;

    if (shouldMoveUp) {
      updateDisplacement(-ITEM_HEIGHT);
    } else if (shouldMoveDown) {
      updateDisplacement(ITEM_HEIGHT);
    } else {
      updateDisplacement(0);
    }
  }, [shouldMoveUp, shouldMoveDown, isBeingDragged, isDragging, updateDisplacement]);

  const handleRemove = useCallback(() => {
    if (!isDragging) {
      onRemoveExercise(index);
    }
  }, [isDragging, onRemoveExercise, index]);

  const safeHapticFeedback = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    try {
      Haptics.impactAsync(style);
    } catch {
      // Haptics might not be available on all devices
    }
  }, []);

  // Drag gesture - only for the drag handle
  const dragHandlePanGesture = useMemo(() => {
    return Gesture.Pan()
      .minDistance(5)
      .onStart(() => {
        'worklet';
        runOnJS(onDragStart)(index);
        runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(startDragAnimation)();
      })
      .onUpdate((event: any) => {
        'worklet';
        if (isBeingDragged) {
          runOnJS(updateDragPosition)(event.translationY);
          runOnJS(onDragUpdate)(index, event.translationY);
        }
      })
      .onEnd((event: any) => {
        'worklet';
        if (!isBeingDragged) return;

        const moveDistance = event.translationY;
        const itemsMoved = Math.round(moveDistance / ITEM_HEIGHT);
        const newIndex = Math.max(0, Math.min(index + itemsMoved, totalExercises - 1));

        runOnJS(endDragAnimation)();

        if (newIndex !== index) {
          runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Light);
        }

        runOnJS(onDragEnd)(index, newIndex);
      });
  }, [
    index,
    isBeingDragged,
    totalExercises,
    onDragStart,
    onDragEnd,
    onDragUpdate,
    safeHapticFeedback,
    startDragAnimation,
    endDragAnimation,
    updateDragPosition,
  ]);

  const itemStyle = [
    styles.configurationItem,
    isBeingDragged && styles.draggingConfigurationItem,
    {
      zIndex: isBeingDragged ? 1000 : 0,
      elevation: isBeingDragged ? 10 : 0,
    },
  ];

  return (
    <Animated.View style={animatedStyle}>
      <View style={itemStyle}>
        {/* Exercise image with drag overlay */}
        <View style={styles.exerciseImageContainer}>
          <OptimizedImage
            source={
              exercise.image_url
                ? { uri: exercise.image_url }
                : require('../../../../assets/exercises/placeholder.jpg')
            }
            style={styles.exerciseImage}
            fallback={require('../../../../assets/exercises/placeholder.jpg')}
            resizeMode="cover"
            cachePolicy="immutable"
            showLoader={false}
            priority="normal"
            debugLabel={`ConfigurationExercise-${exercise.name}`}
          />
          {/* Drag overlay on image */}
          <View style={styles.dragOverlay}>
            <GestureDetector gesture={dragHandlePanGesture}>
              <View style={styles.dragOverlayHandle}>
                <Ionicons name="reorder-three-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
              </View>
            </GestureDetector>
          </View>
        </View>

        {/* Main content area - exercise info and controls */}
        <View style={styles.exerciseMainContent}>
          {/* Exercise info */}
          <View style={styles.exerciseInfoSection}>
            <Text style={styles.exerciseName} numberOfLines={2}>
              {exercise.name}
            </Text>
            <Text style={styles.exerciseCurrentSet}>
              Current: {exercise.sets} sets × {exercise.reps_range} reps
            </Text>
          </View>

          {/* Configuration controls */}
          <View style={styles.exerciseControlsContainer}>
            {/* Sets Control */}
            <View style={styles.controlGroup}>
              <Text style={styles.controlLabel}>Sets</Text>
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() =>
                    onConfigurationChange(exercise.id, 'sets', Math.max(1, exercise.sets - 1))
                  }
                  disabled={isDragging}
                >
                  <Ionicons name="remove" size={12} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.controlValue}>
                  <Text style={styles.controlValueText}>{exercise.sets}</Text>
                </View>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => onConfigurationChange(exercise.id, 'sets', exercise.sets + 1)}
                  disabled={isDragging}
                >
                  <Ionicons name="add" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Reps Control */}
            <View style={styles.controlGroup}>
              <Text style={styles.controlLabel}>Reps</Text>
              <View style={styles.controlRow}>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => {
                    const currentReps = exercise.reps_range.includes('-')
                      ? exercise.reps_range
                      : parseInt(exercise.reps_range) || 8;
                    const newReps =
                      typeof currentReps === 'number' ? Math.max(1, currentReps - 1) : '8-10';
                    onConfigurationChange(exercise.id, 'reps_range', newReps.toString());
                  }}
                  disabled={isDragging}
                >
                  <Ionicons name="remove" size={12} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={styles.controlValue}>
                  <Text style={styles.controlValueText} numberOfLines={1}>
                    {exercise.reps_range}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.controlButton}
                  onPress={() => {
                    const currentReps = exercise.reps_range.includes('-')
                      ? exercise.reps_range
                      : parseInt(exercise.reps_range) || 8;
                    const newReps = typeof currentReps === 'number' ? currentReps + 1 : '8-10';
                    onConfigurationChange(exercise.id, 'reps_range', newReps.toString());
                  }}
                  disabled={isDragging}
                >
                  <Ionicons name="add" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleRemove}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          disabled={isDragging}
        >
          <Ionicons name="trash-outline" size={16} color="#FF4444" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
