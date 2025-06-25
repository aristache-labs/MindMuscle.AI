import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BORDER_RADIUS, COLORS, SPACING } from '../constants/theme';
import { validationService } from '../services/validationService';
import { simpleErrorHandler } from '../services/sentry/simpleErrorHandler';
import { logger } from '../utils/logger';
import ChangeExerciseModal from './ChangeExerciseModal';
import OptimizedImage from './OptimizedImage';

interface Exercise {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  muscle_group?: string;
  order: number;
  workout_day: number;
  requires_weight?: boolean;
  isChangedExercise?: boolean;
}

interface ExerciseAlternative {
  id: string;
  exercise_id?: string;
  name: string;
  primary_muscles: string[];
  secondary_muscles: string[];
  difficulty: string;
  equipment: string;
  requires_weight: boolean;
  muscle_group: string;
  image_url?: string;
  sets: number;
  reps_range: string;
  rest_time: number;
  order: number;
  workout_day: number;
  recommendation_type: 'recommended' | 'other';
  similarity_score: number;
  isChangedExercise?: boolean;
}

interface CustomizeExerciseModalProps {
  visible: boolean;
  onClose: () => void;
  exercise: Exercise | null;
  onSave: (updatedExercise: { sets: number; reps_range: string }) => void;
  availableExercises?: Exercise[];
  onExerciseChange?: (newExercise: Exercise) => void;
}

export default function CustomizeExerciseModal({
  visible,
  onClose,
  exercise,
  onSave,
  availableExercises = [],
  onExerciseChange,
}: CustomizeExerciseModalProps) {
  const insets = useSafeAreaInsets();

  // Helper function to determine the image source safely
  const getImageSource = (exerciseData: Exercise | null) => {
    // Check if we have a valid image URL
    const trimmedImageUrl = exerciseData?.image_url?.trim();
    const hasValidImageUrl =
      trimmedImageUrl &&
      trimmedImageUrl !== '' &&
      trimmedImageUrl !== 'null' &&
      trimmedImageUrl !== 'undefined';

    if (hasValidImageUrl) {
      return { uri: trimmedImageUrl };
    } else {
      // Use placeholder directly for local assets to prevent any loading attempts
      return require('../../assets/exercises/placeholder.jpg');
    }
  };

  const [sets, setSets] = useState(exercise?.sets || 4);
  const [repsMin, setRepsMin] = useState(() => {
    if (!exercise?.reps_range) return 8;
    const range = exercise.reps_range.split('-');
    return parseInt(range[0]) || 8;
  });
  const [repsMax, setRepsMax] = useState(() => {
    if (!exercise?.reps_range) return 10;
    const range = exercise.reps_range.split('-');
    return parseInt(range[1]) || parseInt(range[0]) || 10;
  });
  const [cardioMinutes, setCardioMinutes] = useState(() => {
    if (!exercise?.reps_range) return 15;
    const range = exercise.reps_range.split('-');
    return parseInt(range[0]) || 15;
  });
  const [showChangeExerciseModal, setShowChangeExerciseModal] = useState(false);
  const [validationError, setValidationError] = useState<string>('');

  // Helper function to determine if exercise is cardio
  const isCardioExercise = (exerciseData: Exercise | null): boolean => {
    return exerciseData?.muscle_group === 'Cardio';
  };

  // Track component lifecycle
  React.useEffect(() => {
    if (visible) {
      simpleErrorHandler.addBreadcrumb('CustomizeExerciseModal opened', 'ui', {
        exerciseId: exercise?.exercise_id || exercise?.id,
        exerciseName: exercise?.name,
        availableAlternativesCount: availableExercises.length,
        hasExerciseChangeCallback: !!onExerciseChange,
      });
    }
  }, [visible, exercise]);

  // Reset values when exercise changes
  React.useEffect(() => {
    if (exercise) {
      simpleErrorHandler.addBreadcrumb('Exercise data loaded in CustomizeExerciseModal', 'data', {
        exerciseId: exercise?.exercise_id || exercise?.id,
        exerciseName: exercise?.name,
        originalSets: exercise.sets,
        originalRepsRange: exercise.reps_range,
      });

      setSets(exercise.sets);

      if (isCardioExercise(exercise)) {
        const range = exercise.reps_range.split('-');
        setCardioMinutes(parseInt(range[0]) || 15);
      } else {
        const range = exercise.reps_range.split('-');
        setRepsMin(parseInt(range[0]) || 8);
        setRepsMax(parseInt(range[1]) || parseInt(range[0]) || 10);
      }
      setValidationError(''); // Clear validation error when exercise changes
    }
  }, [exercise]);

  const validateForm = () => {
    if (!exercise) {
      simpleErrorHandler.addBreadcrumb('Validation failed: No exercise selected', 'warning');
      setValidationError('No exercise selected');
      return false;
    }

    let reps_range: string;
    if (isCardioExercise(exercise)) {
      reps_range = cardioMinutes.toString();
    } else {
      reps_range = repsMin === repsMax ? repsMin.toString() : `${repsMin}-${repsMax}`;
    }

    const formData = {
      exerciseId: exercise.id,
      sets,
      repsRange: reps_range,
      restTime: 60, // Default rest time
    };

    simpleErrorHandler.addBreadcrumb('Validating exercise customization form', 'validation', {
      exerciseId: exercise.id,
      sets,
      repsRange: reps_range,
      isCardio: isCardioExercise(exercise),
    });

    const validationResult = validationService.validateCustomizeExerciseForm(formData);

    if (!validationResult.success) {
      const errorMessage = validationResult.errors.map((e) => e.message).join(', ');

      simpleErrorHandler.addBreadcrumb('Exercise customization validation failed', 'validation', {
        errors: validationResult.errors.map((e) => e.message),
        exerciseId: exercise.id,
        formData,
      });

      setValidationError(errorMessage);
      logger.warn('Exercise customization validation failed', {
        context: { formData, errors: validationResult.errors },
      });
      return false;
    }

    simpleErrorHandler.addBreadcrumb('Exercise customization validation successful', 'validation', {
      exerciseId: exercise.id,
      sets,
      repsRange: reps_range,
      isCardio: isCardioExercise(exercise),
    });

    setValidationError('');
    return true;
  };

  const handleDiscard = () => {
    simpleErrorHandler.addBreadcrumb('User discarded exercise customization', 'user_interaction', {
      exerciseId: exercise?.exercise_id || exercise?.id,
      exerciseName: exercise?.name,
      hadChanges: exercise
        ? sets !== exercise.sets ||
          (isCardioExercise(exercise)
            ? cardioMinutes !== parseInt(exercise.reps_range.split('-')[0])
            : repsMin !== parseInt(exercise.reps_range.split('-')[0]) ||
              repsMax !==
                parseInt(exercise.reps_range.split('-')[1] || exercise.reps_range.split('-')[0]))
        : false,
    });

    // Reset to original values
    if (exercise) {
      setSets(exercise.sets);
      if (isCardioExercise(exercise)) {
        const range = exercise.reps_range.split('-');
        setCardioMinutes(parseInt(range[0]) || 15);
      } else {
        const range = exercise.reps_range.split('-');
        setRepsMin(parseInt(range[0]) || 8);
        setRepsMax(parseInt(range[1]) || parseInt(range[0]) || 10);
      }
    }
    setValidationError('');
    onClose();
  };

  const handleSave = () => {
    if (!validateForm()) return;

    let reps_range: string;
    if (isCardioExercise(exercise)) {
      reps_range = cardioMinutes.toString();
    } else {
      reps_range = repsMin === repsMax ? repsMin.toString() : `${repsMin}-${repsMax}`;
    }

    simpleErrorHandler.addBreadcrumb('User saved exercise customization', 'user_interaction', {
      exerciseId: exercise?.exercise_id || exercise?.id,
      exerciseName: exercise?.name,
      newSets: sets,
      newRepsRange: reps_range,
      isCardio: isCardioExercise(exercise),
    });

    onSave({ sets, reps_range });
    onClose();
  };

  const handleChangeExercise = () => {
    simpleErrorHandler.addBreadcrumb('User opened change exercise modal', 'user_interaction', {
      currentExerciseId: exercise?.exercise_id || exercise?.id,
      currentExerciseName: exercise?.name,
      availableAlternativesCount: availableExercises.length,
    });
    setShowChangeExerciseModal(true);
  };

  const handleExerciseSelect = (selectedExercise: ExerciseAlternative) => {
    simpleErrorHandler.addBreadcrumb('User selected new exercise', 'user_interaction', {
      oldExerciseId: exercise?.exercise_id || exercise?.id,
      oldExerciseName: exercise?.name,
      newExerciseId: selectedExercise.id,
      newExerciseName: selectedExercise.name,
      recommendationType: selectedExercise.recommendation_type,
      similarityScore: selectedExercise.similarity_score,
    });

    logger.info('Exercise selection received', {
      context: {
        selectedExerciseId: selectedExercise.id,
        selectedExerciseName: selectedExercise.name,
      },
    });

    if (onExerciseChange) {
      try {
        // Convert ExerciseAlternative to Exercise format
        const newExercise: Exercise = {
          id: selectedExercise.id,
          exercise_id: selectedExercise.exercise_id || selectedExercise.id, // Use exercise_id if available, fallback to id
          name: selectedExercise.name,
          sets: selectedExercise.sets,
          reps_range: selectedExercise.reps_range,
          image_url: selectedExercise.image_url,
          primary_muscles: selectedExercise.primary_muscles,
          order: selectedExercise.order,
          workout_day: selectedExercise.workout_day,
          requires_weight: selectedExercise.requires_weight,
          // Pass along the isChangedExercise flag if it exists
          isChangedExercise: selectedExercise.isChangedExercise || false,
        };

        simpleErrorHandler.addBreadcrumb(
          'Successfully converted and applying exercise change',
          'data',
          {
            newExerciseId: newExercise.id,
            newExerciseName: newExercise.name,
            newSets: newExercise.sets,
            newRepsRange: newExercise.reps_range,
          },
        );

        logger.info('Calling onExerciseChange with converted exercise', {
          context: { newExerciseId: newExercise.id, newExerciseName: newExercise.name },
        });
        onExerciseChange(newExercise);

        simpleErrorHandler.addBreadcrumb('Exercise change completed successfully', 'data', {
          newExerciseId: newExercise.id,
          newExerciseName: newExercise.name,
        });

        // Close modals after successful exercise change
        setTimeout(() => {
          setShowChangeExerciseModal(false);
          onClose();
        }, 100); // Small delay to ensure state updates complete
      } catch (error) {
        simpleErrorHandler.captureException(error as Error, {
          component: 'CustomizeExerciseModal',
          category: 'ui_error',
        });

        logger.error('Error in handleExerciseSelect', error as Error, {
          context: { selectedExerciseId: selectedExercise.id },
        });
        setValidationError('Failed to change exercise. Please try again.');
        // Still close modals even if there's an error
        setShowChangeExerciseModal(false);
        onClose();
      }
    } else {
      // Close modals if no onExerciseChange callback
      setShowChangeExerciseModal(false);
      onClose();
    }
  };

  const adjustSets = (increment: boolean) => {
    setSets((prev) => {
      const newValue = increment ? prev + 1 : prev - 1;

      // Clamp between 1 and 10 sets
      const clampedValue = Math.max(1, Math.min(10, newValue));

      // Clear validation error when making valid changes
      if (clampedValue !== prev) {
        setValidationError('');
      }

      return clampedValue;
    });
  };

  // Predefined rep ranges
  const repRanges = [
    { min: 1, max: 3 },
    { min: 3, max: 5 },
    { min: 4, max: 6 },
    { min: 6, max: 8 },
    { min: 8, max: 10 },
    { min: 10, max: 12 },
    { min: 12, max: 15 },
    { min: 15, max: 20 },
    { min: 20, max: 25 },
    { min: 25, max: 30 },
  ];

  const adjustReps = (increment: boolean) => {
    const currentRangeIndex = repRanges.findIndex(
      (range) => range.min === repsMin && range.max === repsMax,
    );

    if (currentRangeIndex !== -1) {
      // Current values match a predefined range
      if (increment && currentRangeIndex < repRanges.length - 1) {
        const nextRange = repRanges[currentRangeIndex + 1];
        setRepsMin(nextRange.min);
        setRepsMax(nextRange.max);
      } else if (!increment && currentRangeIndex > 0) {
        const prevRange = repRanges[currentRangeIndex - 1];
        setRepsMin(prevRange.min);
        setRepsMax(prevRange.max);
      }
    } else {
      // Current values don't match a predefined range, find closest
      const currentAvg = (Number(repsMin) + Number(repsMax)) / 2;
      let closestIndex = 0;
      let closestDiff = Math.abs((repRanges[0].min + repRanges[0].max) / 2 - currentAvg);

      for (let i = 1; i < repRanges.length; i++) {
        const rangeAvg = (repRanges[i].min + repRanges[i].max) / 2;
        const diff = Math.abs(rangeAvg - currentAvg);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestIndex = i;
        }
      }

      // Move to next or previous range from closest match
      if (increment && closestIndex < repRanges.length - 1) {
        const nextRange = repRanges[closestIndex + 1];
        setRepsMin(nextRange.min);
        setRepsMax(nextRange.max);
      } else if (!increment && closestIndex > 0) {
        const prevRange = repRanges[closestIndex - 1];
        setRepsMin(prevRange.min);
        setRepsMax(prevRange.max);
      } else {
        // Use the closest range
        const closestRange = repRanges[closestIndex];
        setRepsMin(closestRange.min);
        setRepsMax(closestRange.max);
      }
    }
  };

  // Adjust cardio minutes (5 to 60 in increments of 5)
  const adjustCardioMinutes = (increment: boolean) => {
    setCardioMinutes((prev) => {
      const newValue = increment ? prev + 5 : prev - 5;
      // Clamp between 5 and 60 minutes
      const clampedValue = Math.max(5, Math.min(60, newValue));

      // Clear validation error when making valid changes
      if (clampedValue !== prev) {
        setValidationError('');
      }

      return clampedValue;
    });
  };

  if (!exercise) return null;

  return (
    <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, { paddingTop: insets.top }]}>
          <LinearGradient
            colors={['#121418', '#0A0C10']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalGradient}
          >
            {/* Adding glowing corners */}
            <View style={styles.topGlowLeft} />
            <View style={styles.topGlowRight} />
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerSide}>
                <TouchableOpacity onPress={handleDiscard} style={styles.headerButton}>
                  <Ionicons name="close" size={26} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>CUSTOMIZE EXERCISE</Text>
              </View>

              <View style={styles.headerSide}>
                <TouchableOpacity onPress={handleSave} style={styles.headerButton}>
                  <View style={{ position: 'relative', width: 26, height: 26 }}>
                    {/* Background circle */}
                    <Ionicons
                      name="ellipse"
                      size={28}
                      color={COLORS.primary}
                      style={{
                        position: 'absolute',
                        transform: [{ scale: 1 }],
                        opacity: 1,
                      }}
                    />
                    {/* White checkmark on top */}
                    <Ionicons
                      name="checkmark"
                      size={18}
                      color="#FFFFFF"
                      style={{
                        position: 'absolute',
                        top: 5,
                        left: 5,
                        transform: [{ scale: 1 }],
                        fontWeight: 'bold',
                      }}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </View>

            {/* Exercise Info */}
            <View style={styles.exerciseSection}>
              <View style={styles.exerciseCard}>
                <View style={styles.exerciseImageContainer}>
                  <OptimizedImage
                    source={getImageSource(exercise)}
                    style={styles.exerciseImage}
                    fallback={require('../../assets/exercises/placeholder.jpg')}
                    resizeMode="cover"
                    cachePolicy="immutable"
                  />
                </View>

                <View style={styles.exerciseInfo}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  {exercise.primary_muscles && exercise.primary_muscles.length > 0 && (
                    <Text style={styles.exerciseMuscle}>{exercise.primary_muscles[0]}</Text>
                  )}
                </View>

                {/* Change Exercise Button */}
                {availableExercises.length > 0 && onExerciseChange && (
                  <TouchableOpacity
                    style={styles.changeExerciseButton}
                    onPress={handleChangeExercise}
                  >
                    <Ionicons name="swap-horizontal" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Validation Error Display */}
            {validationError ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{validationError}</Text>
              </View>
            ) : null}

            {/* Customization Controls */}
            <View style={styles.controlsSection}>
              {/* Controls Row - Sets and Reps/Minutes side by side */}
              <View style={styles.controlsRow}>
                {/* Sets Control */}
                <View style={styles.controlColumn}>
                  <View style={styles.controlContainer}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() => adjustSets(false)}
                    >
                      <Text style={styles.controlButtonText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.valueContainer}>
                      <Text style={styles.valueText}>{sets}</Text>
                    </View>

                    <TouchableOpacity style={styles.controlButton} onPress={() => adjustSets(true)}>
                      <Text style={styles.controlButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.controlLabel}>sets</Text>
                </View>

                {/* Reps/Minutes Control */}
                <View style={styles.controlColumn}>
                  <View style={styles.controlContainer}>
                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() =>
                        isCardioExercise(exercise) ? adjustCardioMinutes(false) : adjustReps(false)
                      }
                    >
                      <Text style={styles.controlButtonText}>−</Text>
                    </TouchableOpacity>

                    <View style={styles.valueContainer}>
                      <Text style={styles.valueText}>
                        {isCardioExercise(exercise)
                          ? cardioMinutes
                          : repsMin === repsMax
                            ? repsMin
                            : `${repsMin}-${repsMax}`}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.controlButton}
                      onPress={() =>
                        isCardioExercise(exercise) ? adjustCardioMinutes(true) : adjustReps(true)
                      }
                    >
                      <Text style={styles.controlButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.controlLabel}>
                    {isCardioExercise(exercise) ? 'minutes' : 'reps'}
                  </Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* Change Exercise Modal */}
      <ChangeExerciseModal
        visible={showChangeExerciseModal}
        onClose={() => setShowChangeExerciseModal(false)}
        currentExercise={exercise}
        availableExercises={availableExercises}
        onExerciseSelect={handleExerciseSelect}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    height: '50%',
    backgroundColor: 'transparent',
  },
  modalGradient: {
    flex: 1,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  exerciseSection: {
    padding: SPACING.lg,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
  },
  exerciseImageContainer: {
    width: 60,
    height: 60,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: SPACING.xs,
  },
  exerciseMuscle: {
    color: COLORS.text,
    fontSize: 14,
    opacity: 0.7,
  },
  changeExerciseButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.md,
  },
  controlsSection: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  controlColumn: {
    alignItems: 'center',
    flex: 1,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.xl,
  },
  controlLabel: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '600',
    marginTop: SPACING.md,
    textAlign: 'center',
  },
  controlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.xs,
  },
  controlButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  valueContainer: {
    minWidth: 80,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  valueText: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 0, 0, 0.3)',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
