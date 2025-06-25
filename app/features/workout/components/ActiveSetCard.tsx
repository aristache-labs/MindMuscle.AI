import React, { useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/theme';
import type { RecommendationData } from '../hooks/useExerciseSets';
import { ExerciseData, ExerciseSet } from '../types';
import type { styles as WorkoutExerciseSetRowStylesType } from './WorkoutExerciseSetRow';
import CardioTimer from './CardioTimer';

interface ActiveSetCardProps {
  set: ExerciseSet;
  setIndex: number;
  exercise: ExerciseData;
  focusedInputs: Record<string, boolean>;
  userEnteredValues: Record<string, boolean>;
  exerciseCustomized: Record<string, boolean>;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  currentRecommendation: RecommendationData | null;
  textInputRefreshKey: number;
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationMinutesChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationSecondsChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onSetComplete: (exerciseId: string, setIndex: number) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

// Helper function to determine if exercise is cardio
const isCardioExercise = (exercise: ExerciseData): boolean => {
  return exercise?.muscle_group === 'Cardio';
};

// Helper function to check if suggested label should be shown for weight
const shouldShowWeightSuggestedLabel = (
  exercise: ExerciseData,
  setIndex: number,
  userEnteredValues: Record<string, boolean>,
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null,
): boolean => {
  return !!(
    getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight') &&
    !userEnteredValues[`${exercise.id}-${setIndex}-weight`]
  );
};

// Helper function to check if suggested label should be shown for reps
const shouldShowRepsSuggestedLabel = (
  exercise: ExerciseData,
  setIndex: number,
  isCardio: boolean,
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null,
): boolean => {
  return !!(
    !isCardio &&
    exercise?.requires_weight === false &&
    getSuggestedValue(exercise.exercise_id, setIndex + 1, 'reps')
  );
};

// Helper function to check if last values should be shown
const shouldShowLastValues = (
  set: ExerciseSet,
  isCardio: boolean,
  exercise: ExerciseData,
  setIndex: number,
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>,
): boolean => {
  if (set.isCompleted || isCardio) return false;

  return !!(
    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight ||
    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps
  );
};

// Main ActiveSetCard Component (now simplified)
export default function ActiveSetCard({
  set,
  setIndex,
  exercise,
  focusedInputs,
  userEnteredValues,
  exerciseCustomized,
  lastExerciseValues,
  currentRecommendation,
  textInputRefreshKey,
  onWeightChange,
  onRepsChange,
  onDurationMinutesChange,
  onDurationSecondsChange,
  onSetComplete,
  onInputFocus,
  onInputBlur,
  getSuggestedValue,
  styles,
}: ActiveSetCardProps) {
  const isCardio = isCardioExercise(exercise);

  // Get the duration for cardio exercises from the exercise's reps_range
  const cardioDuration = useMemo((): number => {
    if (!isCardio || !exercise.reps_range) {
      return 15;
    }
    const range = exercise.reps_range.split('-');
    const duration = parseInt(range[0]) || 15;
    return duration;
  }, [isCardio, exercise.reps_range]);

  // Handle cardio timer completion
  const handleCardioComplete = useCallback(() => {
    // Mark this set as completed
    onSetComplete(exercise.id, setIndex);
  }, [onSetComplete, exercise.id, setIndex]);

  // For cardio exercises, show the timer interface
  if (isCardio) {
    return (
      <View style={styles.activeSetCardContainer}>
        <CardioTimer
          key={`cardio-timer-${exercise.id}-${setIndex}`}
          durationMinutes={cardioDuration}
          onComplete={handleCardioComplete}
          isActive={true}
        />
      </View>
    );
  }

  const getWeightPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-weight`;
    const isFocused = focusedInputs[inputId] || false;

    const recommendedWeight = currentRecommendation?.recommended_weight?.toString();
    const suggestedValue = getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight');
    const lastWeight = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;

    if (isFocused) {
      return '';
    }

    // Prioritize progressive overload recommendations over last workout values
    let placeholder = '--';
    if (recommendedWeight) {
      placeholder = recommendedWeight;
    } else if (suggestedValue) {
      placeholder = suggestedValue;
    } else if (lastWeight) {
      placeholder = lastWeight;
    }

    return placeholder;
  };

  const getRepsPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-reps`;
    const isFocused = focusedInputs[inputId] || false;

    const recommendedReps = currentRecommendation?.recommended_reps?.toString();
    const lastReps = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
    const exerciseRepsRange = exercise.reps_range;

    if (isFocused) {
      return '';
    }

    if (lastReps) {
      return lastReps;
    }

    let placeholder = '--';

    if (recommendedReps) {
      placeholder = recommendedReps;
    } else if (exerciseRepsRange) {
      placeholder = exerciseRepsRange;
    }

    return placeholder;
  };

  return (
    <View style={[styles.setCard, styles.activeSetCard]}>
      <View style={styles.setCardContent}>
        <View style={styles.activeSetCardContainer}>
          <View style={styles.tableLayout}>
            {/* Left Column: Weight/Duration and Reps stacked vertically */}
            <View style={styles.leftColumn}>
              {/* Weight/Duration and Reps Cell - both inputs in same cell */}
              <View style={styles.weightRepsCell}>
                <View style={styles.inputRow}>
                  {/* For cardio exercises, show duration inputs instead of weight */}
                  {isCardio ? (
                    <>
                      <View style={styles.inputContainer}>
                        <Text style={styles.suggestedLabelWeightActive}>Duration</Text>
                        <View style={styles.inputFieldContainer}>
                          <TextInput
                            key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-duration-minutes-${textInputRefreshKey}`}
                            style={styles.inputField}
                            value={set.duration_minutes || ''}
                            onChangeText={(value) =>
                              onDurationMinutesChange?.(exercise.id, setIndex, value)
                            }
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            selectTextOnFocus={true}
                            onFocus={(event) =>
                              onInputFocus(`${exercise.id}-${setIndex}-duration-minutes`, event)
                            }
                            onBlur={() =>
                              onInputBlur(`${exercise.id}-${setIndex}-duration-minutes`)
                            }
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          />
                          <Text style={styles.activeSetValueUnit}>min</Text>
                        </View>
                      </View>
                      <View style={styles.inputDivider} />
                      <View style={styles.inputContainer}>
                        <View style={styles.inputFieldContainer}>
                          <TextInput
                            key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-duration-seconds-${textInputRefreshKey}`}
                            style={styles.inputField}
                            value={set.duration_seconds || ''}
                            onChangeText={(value) =>
                              onDurationSecondsChange?.(exercise.id, setIndex, value)
                            }
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            selectTextOnFocus={true}
                            onFocus={(event) =>
                              onInputFocus(`${exercise.id}-${setIndex}-duration-seconds`, event)
                            }
                            onBlur={() =>
                              onInputBlur(`${exercise.id}-${setIndex}-duration-seconds`)
                            }
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          />
                          <Text style={styles.activeSetValueUnit}>sec</Text>
                        </View>
                      </View>
                    </>
                  ) : (
                    /* Only show weight input if exercise requires weight */
                    exercise?.requires_weight !== false && (
                      <>
                        <View style={styles.inputContainer}>
                          {/* Suggested label above weight input */}
                          {shouldShowWeightSuggestedLabel(
                            exercise,
                            setIndex,
                            userEnteredValues,
                            getSuggestedValue,
                          ) && <Text style={styles.suggestedLabelWeightActive}>Suggested</Text>}
                          <View style={styles.inputFieldContainer}>
                            <TextInput
                              key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-weight-${exercise.requires_weight}-${textInputRefreshKey}`}
                              style={styles.inputField}
                              value={set.weight}
                              onChangeText={(value) => onWeightChange(exercise.id, setIndex, value)}
                              keyboardType="decimal-pad"
                              placeholder={getWeightPlaceholder()}
                              placeholderTextColor="rgba(255,255,255,0.5)"
                              selectTextOnFocus={true}
                              onFocus={(event) =>
                                onInputFocus(`${exercise.id}-${setIndex}-weight`, event)
                              }
                              onBlur={() => onInputBlur(`${exercise.id}-${setIndex}-weight`)}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            />
                            <Text style={styles.activeSetValueUnit}>kg</Text>
                          </View>
                        </View>
                        <View style={styles.inputDivider} />
                      </>
                    )
                  )}

                  <View style={styles.inputContainer}>
                    {/* Suggested label above reps input for bodyweight exercises */}
                    {shouldShowRepsSuggestedLabel(
                      exercise,
                      setIndex,
                      isCardio,
                      getSuggestedValue,
                    ) && <Text style={styles.suggestedLabel}>Suggested</Text>}
                    <View style={styles.inputFieldContainer}>
                      <TextInput
                        key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-reps-${exercise.reps_range}-${exercise.requires_weight}-${exerciseCustomized[exercise.id] ? 'customized' : 'default'}-${textInputRefreshKey}`}
                        style={styles.inputField}
                        value={set.reps}
                        onChangeText={(value) => onRepsChange(exercise.id, setIndex, value)}
                        keyboardType="numeric"
                        placeholder={getRepsPlaceholder()}
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        selectTextOnFocus={true}
                        onFocus={(event) => onInputFocus(`${exercise.id}-${setIndex}-reps`, event)}
                        onBlur={() => onInputBlur(`${exercise.id}-${setIndex}-reps`)}
                      />
                      <Text style={styles.activeSetValueUnit}>{isCardio ? 'sets' : 'reps'}</Text>
                    </View>
                  </View>
                </View>

                {/* Last values row - split under each input - only show for incomplete sets */}
                {shouldShowLastValues(set, isCardio, exercise, setIndex, lastExerciseValues) && (
                  <View style={styles.lastValuesRowActive}>
                    {/* Only show weight last value if exercise requires weight */}
                    {exercise?.requires_weight !== false && (
                      <View style={styles.lastValueContainerActive}>
                        {lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight && (
                          <Text style={styles.activeSetSubValue}>
                            ( Last {lastExerciseValues[exercise.exercise_id][setIndex + 1]?.weight}{' '}
                            )
                          </Text>
                        )}
                      </View>
                    )}

                    {exercise?.requires_weight !== false && <View style={styles.lastValueSpacer} />}

                    <View style={styles.lastValueContainerActive}>
                      {lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps && (
                        <Text style={styles.activeSetSubValue}>
                          ( Last {lastExerciseValues[exercise.exercise_id][setIndex + 1]?.reps} )
                        </Text>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Right Column: Set number and Action button */}
            <View style={styles.rightColumn}>
              <Text style={styles.activeSetNumberText}>Set {set.setNumber}</Text>
              <TouchableOpacity
                style={styles.completeButton}
                onPress={() => onSetComplete(exercise.id, setIndex)}
              >
                <Ionicons name="checkmark-circle" size={36} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
