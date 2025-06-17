import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect } from 'react';
import {
  Dimensions,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import { COLORS } from '../../constants/theme';
import { ExerciseData } from '../../features/workout/types';
import { DraggableExerciseItem } from './DraggableExerciseItem';
import { useCustomizeModeAnimations } from './hooks';
import { styles } from './styles';
import { ExerciseListModalProps } from './types';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

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
  pendingAddedExercises = [],
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [localExercises, setLocalExercises] = React.useState(exercises);
  const [originalExercises, setOriginalExercises] = React.useState(exercises);
  const [removedIndices, setRemovedIndices] = React.useState<number[]>([]);
  const [addedExercises, setAddedExercises] = React.useState<ExerciseData[]>([]);
  const [isDragging, setIsDragging] = React.useState(false);
  const [draggedIndex, setDraggedIndex] = React.useState(-1);
  const [dragTargetIndex, setDragTargetIndex] = React.useState(-1);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Track component lifecycle with Sentry
  useEffect(() => {
    if (visible) {
      try {
        Sentry.addBreadcrumb({
          message: 'ExerciseListModal opened',
          category: 'component',
          level: 'info',
          data: {
            exerciseCount: exercises.length,
            currentExerciseIndex,
            isCustomizeMode,
            hasReorderCallback: !!onReorderExercises,
            hasRemoveCallback: !!onRemoveExercise,
            hasApplyChangesCallback: !!onApplyChanges,
          },
        });
      } catch (error) {
        console.warn('Failed to log Sentry breadcrumb for ExerciseListModal open:', error);
      }
    }

    return () => {
      if (visible) {
        try {
          Sentry.addBreadcrumb({
            message: 'ExerciseListModal closed',
            category: 'component',
            level: 'info',
            data: {
              exerciseCount: exercises.length,
              hadChanges: hasChanges,
              wasInCustomizeMode: isCustomizeMode,
            },
          });
        } catch (error) {
          console.warn('Failed to log Sentry breadcrumb for ExerciseListModal close:', error);
        }
      }
    };
  }, [visible, exercises.length, currentExerciseIndex, isCustomizeMode, hasChanges]);

  // Track customize mode changes
  useEffect(() => {
    try {
      if (isCustomizeMode) {
        Sentry.addBreadcrumb({
          message: 'Exercise list customize mode enabled',
          category: 'user.interaction',
          level: 'info',
          data: {
            exerciseCount: localExercises.length,
            currentExerciseIndex,
          },
        });
      } else {
        Sentry.addBreadcrumb({
          message: 'Exercise list customize mode disabled',
          category: 'user.interaction',
          level: 'info',
          data: {
            hadChanges: hasChanges,
            exerciseCount: localExercises.length,
          },
        });
      }
    } catch (error) {
      console.warn('Failed to log customize mode change:', error);
    }
  }, [isCustomizeMode, localExercises.length, currentExerciseIndex, hasChanges]);

  // Modal animation
  const modalAnimation = useSharedValue(0);

  // Customize mode animations
  const {
    customizeProgress,
    cardAnimations,
    cleanup: cleanupCustomizeAnimations,
  } = useCustomizeModeAnimations(isCustomizeMode, visible);

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
  }, [customizeProgress]);

  // Header button animation
  const headerButtonStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(customizeProgress.value, [0, 1], [1, 1.1], Extrapolation.CLAMP),
        },
      ],
    };
  }, [customizeProgress]);

  // Update local exercises when prop changes and reset change tracking
  React.useEffect(() => {
    // In customize mode, include pending added exercises in local exercises
    const exercisesWithPending = isCustomizeMode
      ? [...exercises, ...pendingAddedExercises]
      : exercises;

    setLocalExercises(exercisesWithPending);
    setOriginalExercises(exercises);
    setRemovedIndices([]);
    setAddedExercises(pendingAddedExercises);
    setHasChanges(false);
  }, [exercises, pendingAddedExercises, isCustomizeMode]);

  // Check if there are any changes
  React.useEffect(() => {
    const exercisesChanged = JSON.stringify(localExercises) !== JSON.stringify(originalExercises);
    const hasRemovals = removedIndices.length > 0;
    const hasAdditions = addedExercises.length > 0;
    setHasChanges(exercisesChanged || hasRemovals || hasAdditions);
  }, [localExercises, originalExercises, removedIndices, addedExercises]);

  // Modal entrance animation
  React.useEffect(() => {
    if (visible) {
      modalAnimation.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      modalAnimation.value = withTiming(0, { duration: 300 });
    }
  }, [visible, modalAnimation, isCustomizeMode]);

  // Cleanup animations on unmount and modal close
  React.useEffect(() => {
    if (!visible) {
      // Reset all state when modal closes
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      // Don't cleanup customize animations immediately when modal closes
      // Let them persist for quick reopens (like add exercise flow)
    }

    return () => {
      // Only cleanup all animations when component actually unmounts
      try {
        modalAnimation.value = 0;
        cleanupCustomizeAnimations();
      } catch (error) {
        console.warn('Error cleaning up animations on unmount:', error);
      }
    };
  }, [visible, modalAnimation, cleanupCustomizeAnimations]);

  // Reset to original state when customize mode is turned off without applying changes
  React.useEffect(() => {
    if (!isCustomizeMode && hasChanges) {
      // Reset to original state if exiting customize mode without applying changes
      setLocalExercises(originalExercises);
      setRemovedIndices([]);
      setAddedExercises([]);
      setHasChanges(false);
    }
  }, [isCustomizeMode, hasChanges, originalExercises]);

  // Separate exercises into completed and remaining based on currentExerciseIndex
  const completedExercises = React.useMemo(() => {
    return localExercises.slice(0, currentExerciseIndex);
  }, [localExercises, currentExerciseIndex]);

  const remainingExercises = React.useMemo(() => {
    return localExercises.slice(currentExerciseIndex);
  }, [localExercises, currentExerciseIndex]);

  const handleClose = useCallback(() => {
    try {
      // Track close action with Sentry
      Sentry.addBreadcrumb({
        message: 'Exercise list modal close requested',
        category: 'user.interaction',
        level: 'info',
        data: {
          hadChanges: hasChanges,
          removedCount: removedIndices.length,
          isCustomizeMode,
          exerciseCount: localExercises.length,
        },
      });

      // Reset to original state when closing without applying changes
      if (hasChanges) {
        setLocalExercises(originalExercises);
        setRemovedIndices([]);
        setAddedExercises([]);
        setHasChanges(false);
      }
      onClose();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'ExerciseListModal', action: 'close' },
        contexts: {
          modal: {
            hasChanges,
            exerciseCount: localExercises.length,
            isCustomizeMode,
          },
        },
      });
      // Still close the modal even if logging fails
      onClose();
    }
  }, [
    hasChanges,
    originalExercises,
    onClose,
    removedIndices.length,
    isCustomizeMode,
    localExercises.length,
  ]);

  const handleApplyChanges = useCallback(() => {
    try {
      // Track apply changes action with Sentry
      Sentry.addBreadcrumb({
        message: 'Exercise list changes applied',
        category: 'user.interaction',
        level: 'info',
        data: {
          hasChanges,
          exerciseCount: localExercises.length,
          originalCount: originalExercises.length,
          removedCount: removedIndices.length,
          hasReorderChanges: JSON.stringify(localExercises) !== JSON.stringify(originalExercises),
        },
      });

      if (hasChanges && onApplyChanges) {
        onApplyChanges(localExercises, removedIndices, addedExercises);
      }

      // Apply individual changes for backward compatibility (only for reordering, not removals)
      if (
        onReorderExercises &&
        JSON.stringify(localExercises) !== JSON.stringify(originalExercises) &&
        !onApplyChanges // Only if onApplyChanges is not available
      ) {
        onReorderExercises(localExercises);
      }

      // Note: Removals are now handled exclusively through onApplyChanges to avoid index conflicts
      // The individual onRemoveExercise calls were causing issues with multiple deletions
      // because indices become invalid after the first removal

      // Update original state and reset changes
      setOriginalExercises(localExercises);
      setRemovedIndices([]);
      setAddedExercises([]);
      setHasChanges(false);

      // Exit customize mode
      onToggleCustomizeMode?.();
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: 'ExerciseListModal', action: 'applyChanges' },
        contexts: {
          changes: {
            hasChanges,
            exerciseCount: localExercises.length,
            originalCount: originalExercises.length,
            removedCount: removedIndices.length,
          },
        },
      });
      // Re-throw to handle the error appropriately
      throw error;
    }
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
      // Only allow drag in customize mode and only for remaining exercises
      if (!isCustomizeMode) return;

      // Convert global index to remaining exercises index
      const remainingIndex = index - currentExerciseIndex;

      // Safety check for valid index within remaining exercises
      if (remainingIndex < 0 || remainingIndex >= remainingExercises.length) {
        console.warn('Invalid drag start index for remaining exercises:', remainingIndex);
        return;
      }

      try {
        Sentry.addBreadcrumb({
          message: 'Exercise drag operation started',
          category: 'user.interaction',
          level: 'info',
          data: {
            draggedIndex: index,
            remainingIndex,
            exerciseName: remainingExercises[remainingIndex]?.name,
            exerciseCount: remainingExercises.length,
          },
        });
      } catch (error) {
        console.warn('Failed to log drag start:', error);
      }

      setIsDragging(true);
      setDraggedIndex(index);
      setDragTargetIndex(index);
    },
    [isCustomizeMode, remainingExercises, currentExerciseIndex],
  );

  const handleDragUpdate = useCallback(
    (draggedIndex: number, currentY: number) => {
      // Only allow drag updates in customize mode and for remaining exercises
      if (!isCustomizeMode) return;

      const remainingIndex = draggedIndex - currentExerciseIndex;

      // Safety checks
      if (remainingIndex < 0 || remainingIndex >= remainingExercises.length) {
        console.warn('Invalid drag update index for remaining exercises:', remainingIndex);
        return;
      }

      if (!isDragging) {
        console.warn('Drag update called but not dragging');
        return;
      }

      try {
        // Calculate target position within remaining exercises only
        const itemsMoved = Math.round(currentY / 88); // ITEM_HEIGHT
        const newRemainingTargetIndex = Math.max(
          0,
          Math.min(remainingIndex + itemsMoved, remainingExercises.length - 1),
        );
        // Convert back to global index
        const newTargetIndex = newRemainingTargetIndex + currentExerciseIndex;
        setDragTargetIndex(newTargetIndex);
      } catch (error) {
        console.warn('Error in drag update:', error);
      }
    },
    [remainingExercises.length, isCustomizeMode, isDragging, currentExerciseIndex],
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Only allow drag end in customize mode and for remaining exercises
      if (!isCustomizeMode) return;

      // Always reset drag state first, regardless of what happens
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      const fromRemainingIndex = fromIndex - currentExerciseIndex;
      const toRemainingIndex = toIndex - currentExerciseIndex;

      // Safety checks for remaining exercises only
      if (fromRemainingIndex < 0 || fromRemainingIndex >= remainingExercises.length) {
        console.warn('Invalid drag end fromIndex for remaining exercises:', fromRemainingIndex);
        return;
      }

      if (toRemainingIndex < 0 || toRemainingIndex >= remainingExercises.length) {
        console.warn('Invalid drag end toIndex for remaining exercises:', toRemainingIndex);
        return;
      }

      try {
        const didReorder = fromRemainingIndex !== toRemainingIndex;

        Sentry.addBreadcrumb({
          message: 'Exercise drag operation ended',
          category: 'user.interaction',
          level: 'info',
          data: {
            fromIndex,
            toIndex,
            fromRemainingIndex,
            toRemainingIndex,
            exerciseName: remainingExercises[fromRemainingIndex]?.name,
            didReorder,
            exerciseCount: remainingExercises.length,
          },
        });

        // Only reorder if position actually changed within remaining exercises
        if (didReorder) {
          // Create new remaining exercises array with reordered items
          const newRemainingExercises = [...remainingExercises];
          const [movedExercise] = newRemainingExercises.splice(fromRemainingIndex, 1);
          newRemainingExercises.splice(toRemainingIndex, 0, movedExercise);

          // Reconstruct the full exercises array: completed + reordered remaining
          const newExercises = [...completedExercises, ...newRemainingExercises];
          setLocalExercises(newExercises);
          // Don't call onReorderExercises immediately - wait for apply
        }
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'ExerciseListModal', action: 'dragEnd' },
          contexts: {
            drag: {
              fromIndex,
              toIndex,
              fromRemainingIndex,
              toRemainingIndex,
              exerciseCount: remainingExercises.length,
            },
          },
        });
        console.warn('Error in drag end:', error);
      }
    },
    [remainingExercises, completedExercises, isCustomizeMode, currentExerciseIndex],
  );

  const handleRemoveExercise = useCallback(
    (index: number) => {
      // Only allow removal in customize mode and only for remaining exercises
      if (!isCustomizeMode) return;

      const remainingIndex = index - currentExerciseIndex;

      // Safety check for remaining exercises only
      if (remainingIndex < 0 || remainingIndex >= remainingExercises.length) {
        console.warn('Cannot remove completed exercise at index:', index);
        return;
      }

      try {
        const exerciseToRemove = localExercises[index];

        Sentry.addBreadcrumb({
          message: 'Exercise removed from list (remaining only)',
          category: 'user.interaction',
          level: 'info',
          data: {
            removedIndex: index,
            remainingIndex,
            exerciseName: exerciseToRemove?.name,
            exerciseId: exerciseToRemove?.id,
            remainingCount: remainingExercises.length - 1,
          },
        });

        // Track the original index for later removal
        const originalIndex = originalExercises.findIndex(
          (ex) => ex.id === localExercises[index].id,
        );
        if (originalIndex !== -1) {
          setRemovedIndices((prev) => [...prev, originalIndex]);
        }

        // Update local exercises by removing the exercise at the given index
        const newExercises = localExercises.filter((_, i) => i !== index);
        setLocalExercises(newExercises);
        // Don't call onRemoveExercise immediately - wait for apply
      } catch (error) {
        Sentry.captureException(error, {
          tags: { component: 'ExerciseListModal', action: 'removeExercise' },
          contexts: {
            removal: {
              index,
              remainingIndex,
              exerciseCount: localExercises.length,
              exerciseName: localExercises[index]?.name,
            },
          },
        });
        // Re-throw to handle the error appropriately
        throw error;
      }
    },
    [
      localExercises,
      originalExercises,
      isCustomizeMode,
      currentExerciseIndex,
      remainingExercises.length,
    ],
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
  }, [modalAnimation]);

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: modalAnimation.value * 0.6,
    };
  }, [modalAnimation]);

  // Separate active and upcoming exercises for normal mode
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

                      try {
                        if (isCustomizeMode) {
                          Sentry.addBreadcrumb({
                            message: 'Exercise list changes done button pressed',
                            category: 'user.interaction',
                            level: 'info',
                            data: {
                              hasChanges,
                              exerciseCount: localExercises.length,
                              removedCount: removedIndices.length,
                            },
                          });
                          handleApplyChanges();
                        } else {
                          Sentry.addBreadcrumb({
                            message: 'Exercise list customize mode activated',
                            category: 'user.interaction',
                            level: 'info',
                            data: {
                              exerciseCount: localExercises.length,
                            },
                          });
                          onToggleCustomizeMode?.();
                        }
                      } catch (error) {
                        Sentry.captureException(error, {
                          tags: { component: 'ExerciseListModal', action: 'headerButton' },
                          contexts: {
                            button: {
                              isCustomizeMode,
                              hasChanges,
                              exerciseCount: localExercises.length,
                            },
                          },
                        });
                        // Still execute the action even if logging fails
                        if (isCustomizeMode) {
                          handleApplyChanges();
                        } else {
                          onToggleCustomizeMode?.();
                        }
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
                  {/* Customize Mode: Completed Exercises Section (Non-draggable) */}
                  {completedExercises.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        COMPLETED EXERCISES ({completedExercises.length})
                      </Text>
                      <View style={styles.completedExercisesNote}>
                        <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                        <Text style={styles.completedExercisesNoteText}>
                          Completed exercises cannot be reordered or removed
                        </Text>
                      </View>
                      {completedExercises.map((exercise, index) => (
                        <DraggableExerciseItem
                          key={`completed-${exercise.id}-${index}`}
                          exercise={exercise}
                          index={index}
                          currentExerciseIndex={currentExerciseIndex}
                          onExerciseSelect={onExerciseSelect}
                          onExerciseDetailsPress={onExerciseDetailsPress}
                          onDragStart={() => {}} // No drag for completed exercises
                          onDragEnd={() => {}} // No drag for completed exercises
                          onDragUpdate={() => {}} // No drag for completed exercises
                          isDragging={false}
                          draggedIndex={-1}
                          dragTargetIndex={-1}
                          totalExercises={localExercises.length}
                          isCustomizeMode={false} // Treat as non-customizable
                          onRemoveExercise={undefined} // No removal for completed exercises
                          showActiveLabel={false}
                          customizeAnimation={cardAnimations}
                        />
                      ))}
                    </View>
                  )}

                  {/* Customize Mode: Remaining Exercises Section (Draggable) */}
                  {remainingExercises.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>
                        REMAINING EXERCISES ({remainingExercises.length})
                      </Text>
                      {remainingExercises.map((exercise, remainingIndex) => {
                        const actualIndex = currentExerciseIndex + remainingIndex;
                        return (
                          <DraggableExerciseItem
                            key={`remaining-${exercise.id}-${actualIndex}`}
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
                            totalExercises={remainingExercises.length}
                            isCustomizeMode={isCustomizeMode}
                            onRemoveExercise={handleRemoveExercise}
                            showActiveLabel={actualIndex === currentExerciseIndex}
                            customizeAnimation={cardAnimations}
                          />
                        );
                      })}
                    </View>
                  )}
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
                style={[
                  styles.bottomActionsContainer,
                  { paddingBottom: insets.bottom },
                  bottomActionsStyle,
                ]}
              >
                <View style={styles.pillContainer}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {
                        // Haptics might not be available
                      }

                      try {
                        Sentry.addBreadcrumb({
                          message: 'Add exercise button pressed',
                          category: 'user.interaction',
                          level: 'info',
                          data: {
                            currentExerciseCount: localExercises.length,
                          },
                        });
                        onAddExercise?.();
                      } catch (error) {
                        Sentry.captureException(error, {
                          tags: { component: 'ExerciseListModal', action: 'addExercise' },
                        });
                        // Still execute the action even if logging fails
                        onAddExercise?.();
                      }
                    }}
                    disabled={!onAddExercise}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add-circle-outline" size={22} color="white" />
                    <Text style={styles.actionButtonText}>Add Exercise</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {
                        // Haptics might not be available
                      }

                      try {
                        Sentry.addBreadcrumb({
                          message: 'Add superset button pressed',
                          category: 'user.interaction',
                          level: 'info',
                          data: {
                            currentExerciseCount: localExercises.length,
                          },
                        });
                        onAddSuperset?.();
                      } catch (error) {
                        Sentry.captureException(error, {
                          tags: { component: 'ExerciseListModal', action: 'addSuperset' },
                        });
                        // Still execute the action even if logging fails
                        onAddSuperset?.();
                      }
                    }}
                    disabled={!onAddSuperset}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="layers-outline" size={22} color="white" />
                    <Text style={styles.actionButtonText}>Add Superset</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {
                        // Haptics might not be available
                      }

                      try {
                        Sentry.addBreadcrumb({
                          message: 'Add cardio button pressed',
                          category: 'user.interaction',
                          level: 'info',
                          data: {
                            currentExerciseCount: localExercises.length,
                          },
                        });
                        onAddCardio?.();
                      } catch (error) {
                        Sentry.captureException(error, {
                          tags: { component: 'ExerciseListModal', action: 'addCardio' },
                        });
                        // Still execute the action even if logging fails
                        onAddCardio?.();
                      }
                    }}
                    disabled={!onAddCardio}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="heart-outline" size={22} color="white" />
                    <Text style={styles.actionButtonText}>Add Cardio</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
