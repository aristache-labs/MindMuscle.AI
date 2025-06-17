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
}: ExerciseListModalProps) {
  const insets = useSafeAreaInsets();
  const [localExercises, setLocalExercises] = React.useState(exercises);
  const [originalExercises, setOriginalExercises] = React.useState(exercises);
  const [removedIndices, setRemovedIndices] = React.useState<number[]>([]);
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
  } = useCustomizeModeAnimations(isCustomizeMode);

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
  }, [visible, modalAnimation]);

  // Cleanup animations on unmount and modal close
  React.useEffect(() => {
    if (!visible) {
      // Reset all state when modal closes
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      // Cleanup animations when modal closes
      try {
        cleanupCustomizeAnimations();
      } catch (error) {
        console.warn('Error cleaning up customize animations:', error);
      }
    }

    return () => {
      // Cleanup all animations when component unmounts
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
      setHasChanges(false);
    }
  }, [isCustomizeMode, hasChanges, originalExercises]);

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
      // Only allow drag in customize mode
      if (!isCustomizeMode) return;

      // Safety check for valid index
      if (index < 0 || index >= localExercises.length) {
        console.warn('Invalid drag start index:', index);
        return;
      }

      try {
        Sentry.addBreadcrumb({
          message: 'Exercise drag operation started',
          category: 'user.interaction',
          level: 'info',
          data: {
            draggedIndex: index,
            exerciseName: localExercises[index]?.name,
            exerciseCount: localExercises.length,
          },
        });
      } catch (error) {
        console.warn('Failed to log drag start:', error);
      }

      setIsDragging(true);
      setDraggedIndex(index);
      setDragTargetIndex(index);
    },
    [isCustomizeMode, localExercises],
  );

  const handleDragUpdate = useCallback(
    (draggedIndex: number, currentY: number) => {
      // Only allow drag updates in customize mode
      if (!isCustomizeMode) return;

      // Safety checks
      if (draggedIndex < 0 || draggedIndex >= localExercises.length) {
        console.warn('Invalid drag update index:', draggedIndex);
        return;
      }

      if (!isDragging) {
        console.warn('Drag update called but not dragging');
        return;
      }

      try {
        // Simple calculation - determine target position based on drag distance
        const itemsMoved = Math.round(currentY / 88); // ITEM_HEIGHT
        const newTargetIndex = Math.max(
          0,
          Math.min(draggedIndex + itemsMoved, localExercises.length - 1),
        );
        setDragTargetIndex(newTargetIndex);
      } catch (error) {
        console.warn('Error in drag update:', error);
      }
    },
    [localExercises.length, isCustomizeMode, isDragging],
  );

  const handleDragEnd = useCallback(
    (fromIndex: number, toIndex: number) => {
      // Only allow drag end in customize mode
      if (!isCustomizeMode) return;

      // Always reset drag state first, regardless of what happens
      setIsDragging(false);
      setDraggedIndex(-1);
      setDragTargetIndex(-1);

      // Safety checks
      if (fromIndex < 0 || fromIndex >= localExercises.length) {
        console.warn('Invalid drag end fromIndex:', fromIndex);
        return;
      }

      if (toIndex < 0 || toIndex >= localExercises.length) {
        console.warn('Invalid drag end toIndex:', toIndex);
        return;
      }

      try {
        const didReorder = fromIndex !== toIndex;

        Sentry.addBreadcrumb({
          message: 'Exercise drag operation ended',
          category: 'user.interaction',
          level: 'info',
          data: {
            fromIndex,
            toIndex,
            exerciseName: localExercises[fromIndex]?.name,
            didReorder,
            exerciseCount: localExercises.length,
          },
        });

        // Only reorder if position actually changed
        if (didReorder) {
          const newExercises = [...localExercises];
          const [movedExercise] = newExercises.splice(fromIndex, 1);
          newExercises.splice(toIndex, 0, movedExercise);

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
              exerciseCount: localExercises.length,
            },
          },
        });
        console.warn('Error in drag end:', error);
      }
    },
    [localExercises, isCustomizeMode],
  );

  const handleRemoveExercise = useCallback(
    (index: number) => {
      // Only allow removal in customize mode
      if (!isCustomizeMode) return;

      try {
        const exerciseToRemove = localExercises[index];

        Sentry.addBreadcrumb({
          message: 'Exercise removed from list',
          category: 'user.interaction',
          level: 'info',
          data: {
            removedIndex: index,
            exerciseName: exerciseToRemove?.name,
            exerciseId: exerciseToRemove?.id,
            remainingCount: localExercises.length - 1,
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
              exerciseCount: localExercises.length,
              exerciseName: localExercises[index]?.name,
            },
          },
        });
        // Re-throw to handle the error appropriately
        throw error;
      }
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
  }, [modalAnimation]);

  const backdropStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: modalAnimation.value * 0.6,
    };
  }, [modalAnimation]);

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
