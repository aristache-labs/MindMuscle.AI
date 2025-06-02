import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useMemo } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import type { ExerciseData } from '../features/workout/types';
import OptimizedImage from './OptimizedImage';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ITEM_HEIGHT = 88;

interface ExerciseListModalProps {
  visible: boolean;
  onClose: () => void;
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onExerciseDetailsPress?: (exercise: ExerciseData) => void;
  onReorderExercises?: (newOrder: ExerciseData[]) => void;
  onRemoveExercise?: (index: number) => void;
  isCustomizeMode?: boolean;
  onToggleCustomizeMode?: () => void;
  onAddExercise?: () => void;
  onAddSuperset?: () => void;
  onAddCardio?: () => void;
  onApplyChanges?: (exercises: ExerciseData[], removedIndices: number[]) => void;
}

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
  }, []);

  const endDragAnimation = useCallback(() => {
    translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    scale.value = withSpring(1, { damping: 20, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 200 });
  }, []);

  const updateDragPosition = useCallback((y: number) => {
    translateY.value = y;
  }, []);

  const updateDisplacement = useCallback((displacement: number) => {
    translateY.value = withSpring(displacement, { damping: 20, stiffness: 300 });
  }, []);

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

// Custom hook for customize mode animations
function useCustomizeModeAnimations(isCustomizeMode: boolean) {
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
  }, [isCustomizeMode]);

  return { customizeProgress, cardAnimations };
}

// Exercise image component with animations
function ExerciseImage({
  exercise,
  isCompleted,
  isCustomizeMode = false,
  customizeAnimation,
}: {
  exercise: ExerciseData;
  isCompleted: boolean;
  isCustomizeMode?: boolean;
  customizeAnimation?: Animated.SharedValue<number>;
}) {
  const overlayStyle = useAnimatedStyle(() => {
    if (!customizeAnimation) return {};

    return {
      opacity: customizeAnimation.value,
      transform: [
        {
          scale: interpolate(customizeAnimation.value, [0, 1], [0.8, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    if (!customizeAnimation) return {};

    return {
      transform: [
        {
          rotate: `${interpolate(
            customizeAnimation.value,
            [0, 1],
            [180, 0],
            Extrapolation.CLAMP,
          )}deg`,
        },
        {
          scale: interpolate(customizeAnimation.value, [0, 1], [0.5, 1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  return (
    <View style={styles.exerciseImageContainer}>
      {exercise.image_url ? (
        <OptimizedImage
          source={{ uri: exercise.image_url }}
          style={styles.exerciseImage}
          fallback={require('../../assets/exercises/placeholder.jpg')}
          resizeMode="cover"
          cachePolicy="immutable"
          showLoader={false}
          priority="normal"
          debugLabel={`ExerciseList-${exercise.name}`}
        />
      ) : (
        <View style={styles.exercisePlaceholder}>
          <Ionicons name="barbell-outline" size={24} color={COLORS.placeholder} />
        </View>
      )}
      {isCompleted && <View style={styles.imageOverlay} />}
      {isCustomizeMode && (
        <Animated.View style={[styles.customizeOverlay, overlayStyle]}>
          <Animated.View style={iconStyle}>
            <Ionicons name="reorder-three-outline" size={20} color="white" />
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
}

interface DraggableExerciseItemProps {
  exercise: ExerciseData;
  index: number;
  currentExerciseIndex: number;
  onExerciseSelect: (index: number) => void;
  onExerciseDetailsPress?: (exercise: ExerciseData) => void;
  onDragStart: (index: number) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
  onDragUpdate: (draggedIndex: number, currentY: number) => void;
  isDragging: boolean;
  draggedIndex: number;
  dragTargetIndex: number;
  totalExercises: number;
  isCustomizeMode?: boolean;
  onRemoveExercise?: (index: number) => void;
  showActiveLabel?: boolean;
  customizeAnimation?: Animated.SharedValue<number>;
}

function DraggableExerciseItem({
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
      opacity: withTiming(customizeAnimation.value, { duration: 300 }),
      transform: [
        {
          scale: withSpring(customizeAnimation.value, { damping: 20, stiffness: 400 }),
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

    if (shouldMoveUp) {
      updateDisplacement(-ITEM_HEIGHT);
    } else if (shouldMoveDown) {
      updateDisplacement(ITEM_HEIGHT);
    } else {
      updateDisplacement(0);
    }
  }, [shouldMoveUp, shouldMoveDown, isBeingDragged, updateDisplacement]);

  const handlePress = useCallback(() => {
    if (!isDragging) {
      if (isCustomizeMode) {
        // In customize mode, do nothing when pressing exercise cards
        return;
      } else {
        // In normal mode, show exercise details modal if available, otherwise select exercise
        if (onExerciseDetailsPress) {
          onExerciseDetailsPress(exercise);
        } else {
          onExerciseSelect(index);
        }
      }
    }
  }, [isDragging, isCustomizeMode, onExerciseDetailsPress, exercise, onExerciseSelect, index]);

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
      .onStart(() => {
        'worklet';
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
    isCustomizeMode,
  ]);

  const itemStyle = [
    styles.exerciseItem,
    isActive && styles.activeExerciseItem,
    isCompleted && styles.completedExerciseItem,
    isBeingDragged && styles.draggingItem,
    {
      zIndex: isBeingDragged ? 1000 : 0,
      elevation: isBeingDragged ? 10 : 0,
    },
  ];

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[animatedStyle, cardTransitionStyle]}>
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

export default function ExerciseListModal({
  visible,
  onClose,
  exercises,
  currentExerciseIndex,
  onExerciseSelect,
  onExerciseDetailsPress,
  onReorderExercises,
  onRemoveExercise,
  isCustomizeMode = false,
  onToggleCustomizeMode,
  onAddExercise,
  onAddSuperset,
  onAddCardio,
  onApplyChanges,
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [localExercises, setLocalExercises] = React.useState(exercises);
  const [originalExercises, setOriginalExercises] = React.useState(exercises);
  const [removedIndices, setRemovedIndices] = React.useState<number[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState(-1);
  const [dragTargetIndex, setDragTargetIndex] = React.useState(-1);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Modal animation
  const modalAnimation = useSharedValue(0);

  // Customize mode animations
  const { customizeProgress, cardAnimations } = useCustomizeModeAnimations(isCustomizeMode);

  // Bottom actions sliding animation
  const bottomActionsStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: interpolate(customizeProgress.value, [0, 1], [100, 0], Extrapolation.CLAMP),
        },
      ],
      opacity: customizeProgress.value,
    };
  });

  // Header button animation
  const headerButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(customizeProgress.value, [0, 1], [1, 1.1], Extrapolation.CLAMP),
        },
      ],
    };
  });

  // Update local exercises when prop changes and reset change tracking
  React.useEffect(() => {
    setLocalExercises(exercises);
    setOriginalExercises(exercises);
    setRemovedIndices([]);
    setHasChanges(false);
  }, [exercises]);

  // Check if there are any changes
  React.useEffect(() => {
    const exercisesChanged = JSON.stringify(localExercises) !== JSON.stringify(originalExercises);
    const hasRemovals = removedIndices.length > 0;
    setHasChanges(exercisesChanged || hasRemovals);
  }, [localExercises, originalExercises, removedIndices]);

  // Modal entrance animation
  React.useEffect(() => {
    if (visible) {
      modalAnimation.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      modalAnimation.value = withTiming(0, { duration: 300 });
    }
  }, [visible]);

  // Reset drag state when modal closes
  React.useEffect(() => {
    if (!visible) {
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);
    }
  }, [visible]);

  // Reset to original state when customize mode is turned off without applying changes
  React.useEffect(() => {
    if (!isCustomizeMode && hasChanges) {
      // Reset to original state if exiting customize mode without applying changes
      setLocalExercises(originalExercises);
      setRemovedIndices([]);
      setHasChanges(false);
    }
  }, [isCustomizeMode, hasChanges, originalExercises]);

  const handleClose = useCallback(() => {
    // Reset to original state when closing without applying changes
    if (hasChanges) {
      setLocalExercises(originalExercises);
      setRemovedIndices([]);
      setHasChanges(false);
    }
    onClose();
  }, [hasChanges, originalExercises, onClose]);

  const handleApplyChanges = useCallback(() => {
    if (hasChanges && onApplyChanges) {
      onApplyChanges(localExercises, removedIndices);
    }

    // Apply individual changes for backward compatibility
    if (
      onReorderExercises &&
      JSON.stringify(localExercises) !== JSON.stringify(originalExercises)
    ) {
      onReorderExercises(localExercises);
    }

    // Apply removals for backward compatibility
    if (onRemoveExercise && removedIndices.length > 0) {
      // Apply removals in reverse order to maintain correct indices
      [...removedIndices]
        .sort((a, b) => b - a)
        .forEach((index) => {
          onRemoveExercise(index);
        });
    }

    // Update original state and reset changes
    setOriginalExercises(localExercises);
    setRemovedIndices([]);
    setHasChanges(false);

    // Exit customize mode
    onToggleCustomizeMode?.();
  }, [
    hasChanges,
    localExercises,
    removedIndices,
    onApplyChanges,
    onReorderExercises,
    onRemoveExercise,
    originalExercises,
    onToggleCustomizeMode,
  ]);

  const handleDragStart = useCallback(
    (index: number) => {
      // Only allow drag in customize mode
      if (!isCustomizeMode) return;

      setIsDragging(true);
      setDraggedIndex(index);
      setDragTargetIndex(index);
    },
    [isCustomizeMode],
  );

  const handleDragUpdate = useCallback(
    (draggedIndex: number, currentY: number) => {
      // Only allow drag updates in customize mode
      if (!isCustomizeMode) return;

      // Simple calculation - determine target position based on drag distance
      const itemsMoved = Math.round(currentY / ITEM_HEIGHT);
      const newTargetIndex = Math.max(
        0,
        Math.min(draggedIndex + itemsMoved, localExercises.length - 1),
      );
      setDragTargetIndex(newTargetIndex);
    },
    [localExercises.length, isCustomizeMode],
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Only allow drag end in customize mode
      if (!isCustomizeMode) return;

      // Reset drag state
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      // Only reorder if position actually changed
      if (fromIndex !== toIndex && toIndex >= 0 && toIndex < localExercises.length) {
        const newExercises = [...localExercises];
        const [movedExercise] = newExercises.splice(fromIndex, 1);
        newExercises.splice(toIndex, 0, movedExercise);

        setLocalExercises(newExercises);
        // Don't call onReorderExercises immediately - wait for apply
      }
    },
    [localExercises, isCustomizeMode],
  );

  const handleRemoveExercise = useCallback(
    (index: number) => {
      // Only allow removal in customize mode
      if (!isCustomizeMode) return;

      // Track the original index for later removal
      const originalIndex = originalExercises.findIndex((ex) => ex.id === localExercises[index].id);
      if (originalIndex !== -1) {
        setRemovedIndices((prev) => [...prev, originalIndex]);
      }

      // Update local exercises by removing the exercise at the given index
      const newExercises = localExercises.filter((_, i) => i !== index);
      setLocalExercises(newExercises);
      // Don't call onRemoveExercise immediately - wait for apply
    },
    [localExercises, originalExercises, isCustomizeMode],
  );

  const modalStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [
        {
          translateY: interpolate(
            modalAnimation.value,
            [0, 1],
            [SCREEN_HEIGHT * 0.5, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(modalAnimation.value, [0, 1], [0.95, 1], Extrapolation.CLAMP),
        },
      ],
      opacity: modalAnimation.value,
    };
  });

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: modalAnimation.value * 0.6,
    };
  });

  // Separate active and upcoming exercises
  const currentExercise = localExercises[currentExerciseIndex];
  const upcomingExercises = localExercises.slice(currentExerciseIndex + 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.backdrop, backdropStyle]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View style={[styles.modalContainer, modalStyle]}>
          <View style={styles.container}>
            {/* Adding glowing corners */}
            <View style={styles.topGlowLeft} />
            <View style={styles.topGlowRight} />
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerSide}>
                <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                  <Ionicons name="close" size={20} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>
                  {isCustomizeMode ? 'Customize List' : 'Exercise List'}
                </Text>
              </View>

              <View style={styles.headerSide}>
                <Animated.View style={headerButtonStyle}>
                  <TouchableOpacity
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      } catch {
                        // Haptics might not be available
                      }
                      if (isCustomizeMode) {
                        handleApplyChanges();
                      } else {
                        onToggleCustomizeMode?.();
                      }
                    }}
                    style={[
                      styles.headerButton,
                      isCustomizeMode && hasChanges && styles.doneButton,
                    ]}
                  >
                    <Ionicons
                      name={isCustomizeMode ? 'checkmark' : 'settings-outline'}
                      size={20}
                      color={
                        isCustomizeMode ? (hasChanges ? '#FFFFFF' : COLORS.primary) : COLORS.text
                      }
                    />
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.contentContainer}
              scrollEnabled={!isDragging}
            >
              {isCustomizeMode ? (
                <>
                  {/* Customize Mode: All Exercises List with drag/drop */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>ALL EXERCISES ({localExercises.length})</Text>
                    {localExercises.map((exercise, index) => (
                      <DraggableExerciseItem
                        key={`exercise-${exercise.id}-${index}`}
                        exercise={exercise}
                        index={index}
                        currentExerciseIndex={currentExerciseIndex}
                        onExerciseSelect={onExerciseSelect}
                        onExerciseDetailsPress={onExerciseDetailsPress}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragUpdate={handleDragUpdate}
                        isDragging={isDragging}
                        draggedIndex={draggedIndex}
                        dragTargetIndex={dragTargetIndex}
                        totalExercises={localExercises.length}
                        isCustomizeMode={isCustomizeMode}
                        onRemoveExercise={handleRemoveExercise}
                        showActiveLabel={true}
                        customizeAnimation={cardAnimations}
                      />
                    ))}
                  </View>
                </>
              ) : (
                <>
                  {/* Normal Mode: Active Exercise Section */}
                  {currentExercise && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>ACTIVE EXERCISE</Text>
                      <DraggableExerciseItem
                        key={`active-${currentExercise.id}-${currentExerciseIndex}`}
                        exercise={currentExercise}
                        index={currentExerciseIndex}
                        currentExerciseIndex={currentExerciseIndex}
                        onExerciseSelect={onExerciseSelect}
                        onExerciseDetailsPress={onExerciseDetailsPress}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        onDragUpdate={handleDragUpdate}
                        isDragging={isDragging}
                        draggedIndex={draggedIndex}
                        dragTargetIndex={dragTargetIndex}
                        totalExercises={localExercises.length}
                        isCustomizeMode={isCustomizeMode}
                        onRemoveExercise={handleRemoveExercise}
                        showActiveLabel={false}
                        customizeAnimation={cardAnimations}
                      />
                    </View>
                  )}

                  {/* Normal Mode: Upcoming Exercises Section */}
                  {upcomingExercises.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        UPCOMING EXERCISES ({upcomingExercises.length})
                      </Text>
                      {upcomingExercises.map((exercise, upcomingIndex) => {
                        const actualIndex = currentExerciseIndex + 1 + upcomingIndex;
                        return (
                          <DraggableExerciseItem
                            key={`upcoming-${exercise.id}-${actualIndex}`}
                            exercise={exercise}
                            index={actualIndex}
                            currentExerciseIndex={currentExerciseIndex}
                            onExerciseSelect={onExerciseSelect}
                            onExerciseDetailsPress={onExerciseDetailsPress}
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                            onDragUpdate={handleDragUpdate}
                            isDragging={isDragging}
                            draggedIndex={draggedIndex}
                            dragTargetIndex={dragTargetIndex}
                            totalExercises={localExercises.length}
                            isCustomizeMode={isCustomizeMode}
                            onRemoveExercise={handleRemoveExercise}
                            showActiveLabel={false}
                            customizeAnimation={cardAnimations}
                          />
                        );
                      })}
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            {/* Bottom Action Buttons - Only show in customize mode */}
            {isCustomizeMode && (
              <Animated.View
                style={[styles.bottomActions, { paddingBottom: insets.bottom }, bottomActionsStyle]}
              >
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onAddExercise}
                  disabled={!onAddExercise}
                >
                  <Ionicons name="add-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Add Exercise</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onAddSuperset}
                  disabled={!onAddSuperset}
                >
                  <Ionicons name="layers-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Add Superset</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={onAddCardio}
                  disabled={!onAddCardio}
                >
                  <Ionicons name="heart-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.actionButtonText}>Add Cardio</Text>
                </TouchableOpacity>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
  },
  modalContainer: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    height: SCREEN_HEIGHT * 0.94,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
    borderWidth: 0,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
  },
  topGlowLeft: {
    position: 'absolute',
    top: -0.7,
    left: -0.2,
    width: 13,
    height: 13,
    borderTopLeftRadius: 12,
    backgroundColor: 'transparent',
    borderLeftWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    elevation: 15,
    zIndex: 1,
  },
  topGlowRight: {
    position: 'absolute',
    top: -0.7,
    right: -0.2,
    width: 13,
    height: 13,
    borderTopRightRadius: 12,
    backgroundColor: 'transparent',
    borderRightWidth: 0.9,
    borderTopWidth: 0.9,
    borderColor: COLORS.primary,
    elevation: 15,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 0.2,
    borderBottomColor: COLORS.primary,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  headerSide: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: SPACING.xs,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.sm,
    textTransform: 'uppercase',
    opacity: 0.9,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    minHeight: 84,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  activeExerciseItem: {
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderColor: COLORS.primary,
    borderWidth: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  completedExerciseItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    opacity: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  draggingItem: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.primary,
    borderWidth: 1,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
    transform: [{ scale: 1.02 }],
  },
  dragHandle: {
    paddingRight: SPACING.sm,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  exerciseImageContainer: {
    width: 68,
    height: 68,
    borderRadius: BORDER_RADIUS.sm,
    overflow: 'hidden',
    marginRight: SPACING.sm,
    position: 'relative',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  exercisePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  customizeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8, 8, 8, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
    paddingVertical: 2,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
    lineHeight: 18,
  },
  exerciseDetails: {
    color: COLORS.placeholder,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 16,
    opacity: 0.8,
  },
  completedText: {
    opacity: 0.5,
  },
  activeLabel: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  activeLabelText: {
    color: COLORS.background,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  customizeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    marginLeft: SPACING.xs,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.surfaceLight,
    borderWidth: 1,
    borderColor: COLORS.disabled,
    gap: SPACING.xs,
  },
  actionButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '500',
  },
});
