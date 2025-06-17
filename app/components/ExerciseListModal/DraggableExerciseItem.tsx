import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
} from 'react-native-reanimated';
import * as Sentry from '@sentry/react-native';
import { ExerciseImage } from './ExerciseImage';
import { useDragAnimations, useDragDisplacement } from './hooks';
import { styles } from './styles';
import { DraggableExerciseItemProps } from './types';

const ITEM_HEIGHT = 88;

export function DraggableExerciseItem({
  exercise,
  index,
  currentExerciseIndex,
  onExerciseSelect,
  onExerciseDetailsPress,
  onDragStart,
  onDragEnd,
  onDragUpdate,
  isDragging,
  draggedIndex,
  dragTargetIndex,
  totalExercises,
  isCustomizeMode,
  onRemoveExercise,
  showActiveLabel = false,
  customizeAnimation,
}: DraggableExerciseItemProps) {
  const isActive = index === currentExerciseIndex;
  const isCompleted = index < currentExerciseIndex;
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
  } = useDragAnimations();

  // Card transition animation for customize mode
  const cardTransitionStyle = useAnimatedStyle(() => {
    if (!customizeAnimation) return {};

    return {
      transform: [
        {
          scale: interpolate(customizeAnimation.value, [0, 1], [1, 0.98], Extrapolation.CLAMP),
        },
      ],
      opacity: interpolate(customizeAnimation.value, [0, 1], [1, 0.85], Extrapolation.CLAMP),
    };
  });

  // Remove button animation
  const removeButtonStyle = useAnimatedStyle(() => {
    if (!customizeAnimation) return { opacity: 0, transform: [{ scale: 0 }] };

    return {
      opacity: customizeAnimation.value,
      transform: [
        {
          scale: customizeAnimation.value,
        },
        {
          translateX: interpolate(customizeAnimation.value, [0, 1], [20, 0], Extrapolation.CLAMP),
        },
      ],
    };
  });

  // Apply displacement animation
  React.useEffect(() => {
    if (isBeingDragged) return;

    try {
      if (shouldMoveUp) {
        updateDisplacement(-ITEM_HEIGHT);
      } else if (shouldMoveDown) {
        updateDisplacement(ITEM_HEIGHT);
      } else {
        updateDisplacement(0);
      }
    } catch (error) {
      console.warn('Error updating displacement animation:', error);
    }
  }, [shouldMoveUp, shouldMoveDown, isBeingDragged, updateDisplacement]);

  // Cleanup animations on unmount
  React.useEffect(() => {
    return () => {
      try {
        // Reset any ongoing animations
        updateDisplacement(0);
      } catch (error) {
        console.warn('Error cleaning up drag animations on unmount:', error);
      }
    };
  }, [updateDisplacement]);

  const handlePress = useCallback(() => {
    if (!isDragging) {
      try {
        if (isCustomizeMode) {
          // In customize mode, do nothing when pressing exercise cards
          Sentry.addBreadcrumb({
            message: 'Exercise card pressed in customize mode',
            category: 'user.interaction',
            level: 'debug',
            data: {
              exerciseName: exercise.name,
              exerciseIndex: index,
            },
          });
          return;
        } else {
          // In normal mode, show exercise details modal if available, otherwise select exercise
          if (onExerciseDetailsPress) {
            Sentry.addBreadcrumb({
              message: 'Exercise details modal opened',
              category: 'user.interaction',
              level: 'info',
              data: {
                exerciseName: exercise.name,
                exerciseIndex: index,
                isActive: index === currentExerciseIndex,
                isCompleted: index < currentExerciseIndex,
              },
            });
            onExerciseDetailsPress(exercise);
          } else {
            Sentry.addBreadcrumb({
              message: 'Exercise selected from list',
              category: 'user.interaction',
              level: 'info',
              data: {
                exerciseName: exercise.name,
                exerciseIndex: index,
                previousIndex: currentExerciseIndex,
              },
            });
            onExerciseSelect(index);
          }
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'DraggableExerciseItem', action: 'press' },
          contexts: {
            exercise: {
              name: exercise.name,
              index,
              isCustomizeMode,
              isDragging,
            },
          },
        });
        // Still execute the action even if logging fails
        if (!isCustomizeMode) {
          if (onExerciseDetailsPress) {
            onExerciseDetailsPress(exercise);
          } else {
            onExerciseSelect(index);
          }
        }
      }
    }
  }, [
    isDragging,
    isCustomizeMode,
    onExerciseDetailsPress,
    exercise,
    onExerciseSelect,
    index,
    currentExerciseIndex,
  ]);

  const handleRemove = useCallback(() => {
    if (!isDragging && onRemoveExercise) {
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

  const panGesture = useMemo(() => {
    // Only enable drag gesture when in customize mode
    if (!isCustomizeMode) {
      return Gesture.Pan().enabled(false);
    }

    return Gesture.Pan()
      .minDistance(5)
      .enabled(isCustomizeMode)
      .onStart(() => {
        'worklet';
        if (onDragStart) {
          runOnJS(onDragStart)(index);
        }
        try {
          runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Medium);
        } catch {
          // Haptics might fail, ignore error
        }
        startDragAnimation();
      })
      .onUpdate((event) => {
        'worklet';
        if (isBeingDragged) {
          updateDragPosition(event.translationY);
          if (onDragUpdate) {
            runOnJS(onDragUpdate)(index, event.translationY);
          }
        }
      })
      .onEnd((event) => {
        'worklet';
        if (!isBeingDragged) return;

        const moveDistance = event.translationY;
        const itemsMoved = Math.round(moveDistance / ITEM_HEIGHT);
        const newIndex = Math.max(0, Math.min(index + itemsMoved, totalExercises - 1));

        endDragAnimation();

        if (newIndex !== index) {
          try {
            runOnJS(safeHapticFeedback)(Haptics.ImpactFeedbackStyle.Light);
          } catch {
            // Haptics might fail, ignore error
          }
        }

        if (onDragEnd) {
          runOnJS(onDragEnd)(index, newIndex);
        }
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
    isCustomizeMode,
  ]);

  const itemStyle = [
    styles.exerciseItem,
    isActive && styles.activeExerciseItem,
    isCompleted && styles.completedExerciseItem,
    isBeingDragged && styles.draggingItem,
  ];

  const containerStyle = [
    animatedStyle,
    cardTransitionStyle,
    {
      zIndex: isBeingDragged ? 1000 : 0,
      elevation: isBeingDragged ? 10 : 0,
    },
  ];

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={containerStyle}>
        <TouchableOpacity
          style={itemStyle}
          onPress={handlePress}
          activeOpacity={0.8}
          disabled={isDragging}
        >
          <ExerciseImage
            exercise={exercise}
            isCompleted={isCompleted}
            isCustomizeMode={isCustomizeMode}
            customizeAnimation={customizeAnimation}
          />

          <View style={styles.exerciseInfo}>
            <Text style={[styles.exerciseName, isCompleted && styles.completedText]}>
              {exercise.name}
            </Text>
            <Text style={[styles.exerciseDetails, isCompleted && styles.completedText]}>
              {exercise.sets || 0} sets × {exercise.reps_range} reps
            </Text>
          </View>

          {/* Active label for current exercise */}
          {showActiveLabel && isActive && (
            <View style={styles.activeLabel}>
              <Text style={styles.activeLabelText}>CURRENT</Text>
            </View>
          )}

          {/* Remove button (only in customize mode) */}
          {isCustomizeMode && onRemoveExercise && (
            <Animated.View style={removeButtonStyle}>
              <TouchableOpacity
                style={styles.customizeButton}
                onPress={handleRemove}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                disabled={isDragging}
              >
                <Ionicons name="trash-outline" size={18} color="#FF4444" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </GestureDetector>
  );
}
