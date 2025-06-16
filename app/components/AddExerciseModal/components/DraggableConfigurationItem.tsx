import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo } from 'react';
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
import { captureUIError } from '../../../services/sentry';
import * as Sentry from '@sentry/react-native';

const ITEM_HEIGHT = 100;

// Predefined rep ranges
const REP_RANGES = [
  '1-3',
  '3-5',
  '4-6',
  '6-8',
  '8-10',
  '10-12',
  '12-15',
  '15-20',
  '20-25',
  '25-30',
];

// Helper functions for rep range cycling
const getCurrentRepRangeIndex = (currentRange: string): number => {
  const index = REP_RANGES.indexOf(currentRange);
  return index !== -1 ? index : REP_RANGES.indexOf('8-10'); // Default to '8-10'
};

const getNextRepRange = (currentRange: string): string => {
  const currentIndex = getCurrentRepRangeIndex(currentRange);
  const nextIndex = (currentIndex + 1) % REP_RANGES.length;
  return REP_RANGES[nextIndex];
};

const getPreviousRepRange = (currentRange: string): string => {
  const currentIndex = getCurrentRepRangeIndex(currentRange);
  const prevIndex = currentIndex === 0 ? REP_RANGES.length - 1 : currentIndex - 1;
  return REP_RANGES[prevIndex];
};

// Custom hook for drag animations
function useDragAnimations() {
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const startDragAnimation = useCallback(() => {
    scale.value = withSpring(1.05, { damping: 20, stiffness: 400 });
    opacity.value = withTiming(0.9, { duration: 100 });
  }, [scale, opacity]);

  const endDragAnimation = useCallback(
    (immediate = false) => {
      if (immediate) {
        translateY.value = 0;
        scale.value = 1;
        opacity.value = 1;
      } else {
        translateY.value = withTiming(0, { duration: 200 });
        scale.value = withTiming(1, { duration: 200 });
        opacity.value = withTiming(1, { duration: 200 });
      }
    },
    [translateY, scale, opacity],
  );

  const updateDragPosition = useCallback(
    (y: number) => {
      translateY.value = y;
    },
    [translateY],
  );

  const updateDisplacement = useCallback(
    (displacement: number, immediate = false) => {
      if (immediate) {
        translateY.value = displacement;
      } else {
        translateY.value = withTiming(displacement, { duration: 200 });
      }
    },
    [translateY],
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

  // Track component lifecycle
  useEffect(() => {
    Sentry.addBreadcrumb({
      message: 'Draggable Configuration Item Rendered',
      category: 'ui.render',
      level: 'info',
      data: {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        index,
        sets: exercise.sets,
        reps: exercise.reps_range,
      },
    });
  }, [exercise.id, exercise.name, index, exercise.sets, exercise.reps_range]);

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
  } = useDragAnimations();

  // Apply displacement animation
  useEffect(() => {
    // Only apply displacement animations if this item is NOT being dragged
    if (isBeingDragged) return;

    // If a drag operation is active globally (isDragging is true),
    // other items should snap to their displaced positions.
    const snapDuringActiveDrag = isDragging;

    if (shouldMoveUp) {
      updateDisplacement(-ITEM_HEIGHT, snapDuringActiveDrag);
    } else if (shouldMoveDown) {
      updateDisplacement(ITEM_HEIGHT, snapDuringActiveDrag);
    } else {
      // If not moving up or down (e.g., drag ended for all items, or this item is not displaced)
      // Snap to zero immediately.
      updateDisplacement(0, true);
    }
  }, [shouldMoveUp, shouldMoveDown, isBeingDragged, updateDisplacement, isDragging]);

  const handleRemove = useCallback(() => {
    try {
      if (!isDragging) {
        // Track exercise removal
        Sentry.addBreadcrumb({
          message: 'Exercise Removed from Configuration',
          category: 'user.interaction',
          level: 'info',
          data: {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            index,
            sets: exercise.sets,
            reps: exercise.reps_range,
          },
        });

        onRemoveExercise(index);
      }
    } catch (error) {
      captureUIError(
        error as Error,
        'DraggableConfigurationItem.handleRemove',
        'add-exercise-modal',
      );
    }
  }, [isDragging, onRemoveExercise, index, exercise]);

  const safeHapticFeedback = useCallback((style: Haptics.ImpactFeedbackStyle) => {
    try {
      Haptics.impactAsync(style);
    } catch {
      // Haptics might not be available on all devices
    }
  }, []);

  // Track drag operations
  const trackDragStart = useCallback(() => {
    try {
      Sentry.addBreadcrumb({
        message: 'Exercise Drag Started',
        category: 'user.interaction',
        level: 'info',
        data: {
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          fromIndex: index,
          totalExercises,
        },
      });
    } catch (error) {
      captureUIError(
        error as Error,
        'DraggableConfigurationItem.trackDragStart',
        'add-exercise-modal',
      );
    }
  }, [exercise.id, exercise.name, index, totalExercises]);

  const trackDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      try {
        Sentry.addBreadcrumb({
          message: 'Exercise Drag Completed',
          category: 'user.interaction',
          level: 'info',
          data: {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            fromIndex,
            toIndex,
            positionChanged: fromIndex !== toIndex,
            totalExercises,
          },
        });
      } catch (error) {
        captureUIError(
          error as Error,
          'DraggableConfigurationItem.trackDragEnd',
          'add-exercise-modal',
        );
      }
    },
    [exercise.id, exercise.name, totalExercises],
  );

  // Drag gesture - only for the drag handle
  const dragHandlePanGesture = useMemo(() => {
    return Gesture.Pan()
      .minDistance(5)
      .onStart(() => {
        'worklet';
        runOnJS(trackDragStart)();
        runOnJS(onDragStart)(index);
        runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Medium);
        runOnJS(startDragAnimation)();
      })
      .onUpdate((event) => {
        'worklet';
        if (isBeingDragged) {
          runOnJS(updateDragPosition)(event.translationY);
          runOnJS(onDragUpdate)(index, event.translationY);
        }
      })
      .onEnd((event) => {
        'worklet';
        if (!isBeingDragged) return;

        const moveDistance = event.translationY;
        const itemsMoved = Math.round(moveDistance / ITEM_HEIGHT);
        const newIndex = Math.max(0, Math.min(index + itemsMoved, totalExercises - 1));

        runOnJS(endDragAnimation)(false); // Use false to animate smoothly instead of snapping

        if (newIndex !== index) {
          runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Light);
        }

        runOnJS(trackDragEnd)(index, newIndex);
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
    trackDragStart,
    trackDragEnd,
  ]);

  const itemStyle = [styles.configurationItem, isBeingDragged && styles.draggingConfigurationItem];

  const containerStyle = [
    animatedStyle,
    {
      zIndex: isBeingDragged ? 1000 : 0,
      elevation: isBeingDragged ? 10 : 0,
    },
  ];

  return (
    <GestureDetector gesture={dragHandlePanGesture}>
      <Animated.View style={containerStyle}>
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
              <View style={styles.dragOverlayHandle}>
                <Ionicons name="reorder-three-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
              </View>
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
                    onPress={() => {
                      try {
                        const newSets = Math.max(1, exercise.sets - 1);
                        Sentry.addBreadcrumb({
                          message: 'Exercise Sets Decreased',
                          category: 'user.interaction',
                          level: 'info',
                          data: {
                            exerciseId: exercise.id,
                            exerciseName: exercise.name,
                            oldSets: exercise.sets,
                            newSets,
                          },
                        });
                        onConfigurationChange(exercise.id, 'sets', newSets);
                      } catch (error) {
                        captureUIError(
                          error as Error,
                          'DraggableConfigurationItem.decreaseSets',
                          'add-exercise-modal',
                        );
                      }
                    }}
                    disabled={isDragging}
                  >
                    <Ionicons name="remove" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                  <View style={styles.controlValue}>
                    <Text style={styles.controlValueText}>{exercise.sets}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => {
                      try {
                        const newSets = exercise.sets + 1;
                        Sentry.addBreadcrumb({
                          message: 'Exercise Sets Increased',
                          category: 'user.interaction',
                          level: 'info',
                          data: {
                            exerciseId: exercise.id,
                            exerciseName: exercise.name,
                            oldSets: exercise.sets,
                            newSets,
                          },
                        });
                        onConfigurationChange(exercise.id, 'sets', newSets);
                      } catch (error) {
                        captureUIError(
                          error as Error,
                          'DraggableConfigurationItem.increaseSets',
                          'add-exercise-modal',
                        );
                      }
                    }}
                    disabled={isDragging}
                  >
                    <Ionicons name="add" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Reps Control - Cycles through predefined ranges */}
              <View style={styles.controlGroup}>
                <Text style={styles.controlLabel}>Reps</Text>
                <View style={styles.controlRow}>
                  <TouchableOpacity
                    style={styles.controlButton}
                    onPress={() => {
                      try {
                        const newReps = getPreviousRepRange(exercise.reps_range);
                        Sentry.addBreadcrumb({
                          message: 'Exercise Reps Range Decreased',
                          category: 'user.interaction',
                          level: 'info',
                          data: {
                            exerciseId: exercise.id,
                            exerciseName: exercise.name,
                            oldReps: exercise.reps_range,
                            newReps,
                          },
                        });
                        onConfigurationChange(exercise.id, 'reps_range', newReps);
                      } catch (error) {
                        captureUIError(
                          error as Error,
                          'DraggableConfigurationItem.decreaseReps',
                          'add-exercise-modal',
                        );
                      }
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
                      try {
                        const newReps = getNextRepRange(exercise.reps_range);
                        Sentry.addBreadcrumb({
                          message: 'Exercise Reps Range Increased',
                          category: 'user.interaction',
                          level: 'info',
                          data: {
                            exerciseId: exercise.id,
                            exerciseName: exercise.name,
                            oldReps: exercise.reps_range,
                            newReps,
                          },
                        });
                        onConfigurationChange(exercise.id, 'reps_range', newReps);
                      } catch (error) {
                        captureUIError(
                          error as Error,
                          'DraggableConfigurationItem.increaseReps',
                          'add-exercise-modal',
                        );
                      }
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
    </GestureDetector>
  );
}
