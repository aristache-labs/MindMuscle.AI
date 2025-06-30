import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextInputFocusEventData,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/theme';
import type { RecommendationData } from '../hooks/useExerciseSets';
import { ExerciseData, ExerciseSet } from '../types';
import type { styles as WorkoutExerciseSetRowStylesType } from './WorkoutExerciseSetRow';

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

// Enhanced Cardio Timer Component for Active Sets with Edit Functionality
interface CardioTimerProps {
  durationMinutes: number;
  onComplete: () => void;
  onDurationChange?: (newDuration: number) => void;
  exercise: ExerciseData;
  setIndex: number;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

const CardioTimer = React.memo<CardioTimerProps>(function CardioTimer({
  durationMinutes,
  onComplete,
  onDurationChange,
  exercise,
  setIndex,
  lastExerciseValues,
  styles,
}) {
  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60); // Convert to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(durationMinutes.toString());
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [localDuration, setLocalDuration] = useState(durationMinutes); // Track local duration
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onDurationChangeRef = useRef(onDurationChange);
  const editInputRef = useRef<TextInput>(null);

  // Keep the callback refs updated - but don't re-run effects when they change
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    onDurationChangeRef.current = onDurationChange;
  }, [onDurationChange]);

  // Keyboard listeners - simplified dependencies
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener('keyboardDidShow', () => {
      setKeyboardVisible(true);
    });

    const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardVisible(false);
    });

    return () => {
      keyboardDidShowListener?.remove();
      keyboardDidHideListener?.remove();
    };
  }, []); // No dependencies needed for keyboard listeners

  // Format time as MM:SS
  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Get the historical duration for "Last" display from actual workout history
  const getLastTime = useCallback((): string | null => {
    // Check if there's actual historical data for this exercise and set
    const exerciseHistory = lastExerciseValues[exercise.exercise_id];
    const setHistory = exerciseHistory?.[setIndex + 1];

    if (!setHistory?.reps) {
      // No historical data available, don't show "Last" value
      return null;
    }

    // For cardio exercises, duration is stored in the reps field (in minutes)
    const lastDurationMinutes = parseInt(setHistory.reps);
    if (isNaN(lastDurationMinutes) || lastDurationMinutes <= 0) {
      return null;
    }

    // Convert minutes to MM:SS format for display
    const lastDurationSeconds = lastDurationMinutes * 60;
    return formatTime(lastDurationSeconds);
  }, [exercise.exercise_id, setIndex, lastExerciseValues, formatTime]);

  // Start/pause timer
  const toggleTimer = useCallback(() => {
    if (!hasStarted) {
      setHasStarted(true);
    }
    setIsRunning((prev) => !prev);
  }, [hasStarted]);

  // Complete the exercise early
  const handleDone = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);

    // Always save the current duration before completing
    // This ensures the duration is preserved for subsequent sets
    if (onDurationChangeRef.current) {
      onDurationChangeRef.current(localDuration);

      // Use a small timeout to ensure the duration change is processed
      setTimeout(() => {
        onCompleteRef.current();
      }, 100);
    } else {
      onCompleteRef.current();
    }
  }, [localDuration]);

  // Handle keyboard submit editing (Done button on keyboard)
  const handleSubmitEditing = useCallback(() => {
    // Force save with current editValue
    const newDuration = parseInt(editValue) || 1;
    setLocalDuration(newDuration);

    if (onDurationChangeRef.current) {
      onDurationChangeRef.current(newDuration);
    }

    // Update timeRemaining to reflect new duration if timer hasn't started
    if (!hasStarted) {
      setTimeRemaining(newDuration * 60);
    }

    setIsEditing(false);
  }, [editValue, hasStarted]);

  // Handle floating done button (when keyboard is visible)
  const handleFloatingDone = useCallback(() => {
    editInputRef.current?.blur();
    handleSubmitEditing();
  }, [handleSubmitEditing]);

  // Handle edit toggle (enter/exit edit mode without saving immediately)
  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // Cancel edit without saving
      setIsEditing(false);
      setEditValue(localDuration.toString()); // Reset to current value
    } else {
      // Enter edit mode
      setIsEditing(true);
      setEditValue(localDuration.toString());
      setTimeout(() => {
        editInputRef.current?.focus();
      }, 100);
    }
  }, [isEditing, localDuration]);

  // Reset timer when duration changes from parent
  useEffect(() => {
    // Only reset if we're not currently editing to prevent overriding user input
    if (!isEditing) {
      setTimeRemaining(durationMinutes * 60);
      setLocalDuration(durationMinutes);
      setEditValue(durationMinutes.toString());
      setIsRunning(false);
      setHasStarted(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
  }, [durationMinutes, isEditing]);

  // Handle edit value change - filter to numbers only
  const handleEditValueChange = useCallback((value: string) => {
    // Allow only numeric input and reasonable ranges
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue === '' || (parseInt(numericValue) >= 1 && parseInt(numericValue) <= 999)) {
      setEditValue(numericValue);
    }
  }, []);

  // Handle timer countdown - optimized to reduce re-renders
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setIsRunning(false);

            // Save the current duration before completing when timer expires naturally
            const currentDurationMinutes = Math.ceil(localDuration);

            if (onDurationChangeRef.current) {
              onDurationChangeRef.current(currentDurationMinutes);

              // Use timeout to ensure duration is saved before completing
              setTimeout(() => {
                onCompleteRef.current();
              }, 100);
            } else {
              onCompleteRef.current();
            }

            return 0;
          }
          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, localDuration]); // Add localDuration as dependency

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Memoize main timer display to prevent unnecessary recalculations
  const timerDisplay = useMemo(() => formatTime(timeRemaining), [timeRemaining, formatTime]);
  const lastTimeDisplay = useMemo(() => getLastTime(), [getLastTime]);

  return (
    <View style={[styles.setCard, styles.activeSetCard]}>
      <View style={styles.setCardContent}>
        <View style={styles.activeSetCardContainer}>
          <View style={styles.tableLayout}>
            {/* Left Column: Timer Display */}
            <View style={styles.leftColumn}>
              <View style={styles.timerCell}>
                {!isEditing ? (
                  // Timer Display Mode
                  <>
                    <View style={styles.timerDisplayContainer}>
                      <TouchableOpacity
                        onPress={handleEditToggle}
                        style={styles.timerDisplayContainer}
                      >
                        <Text style={styles.timerDisplay}>{timerDisplay}</Text>
                        <Text style={styles.cardioTimerUnit}>min</Text>
                      </TouchableOpacity>
                    </View>
                    {lastTimeDisplay && (
                      <Text style={styles.cardioLastTimeText}>(Last {lastTimeDisplay})</Text>
                    )}
                  </>
                ) : (
                  // Edit Mode
                  <View style={styles.timerDisplayContainer}>
                    <View style={styles.timerDisplayContainer}>
                      <TextInput
                        ref={editInputRef}
                        style={[styles.timerDisplay, { minWidth: 50 }]}
                        value={editValue}
                        onChangeText={handleEditValueChange}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        selectTextOnFocus={true}
                        maxLength={3}
                        placeholder="15"
                        placeholderTextColor="rgba(255,255,255,0.5)"
                        onSubmitEditing={handleSubmitEditing}
                        onBlur={handleSubmitEditing}
                      />
                      <Text style={styles.cardioTimerUnit}>min</Text>
                    </View>
                  </View>
                )}
              </View>
            </View>

            {/* Divider 1 */}
            <View style={styles.divider} />

            {/* Middle Column: Play/Pause Button */}
            <View style={styles.middleColumn}>
              <TouchableOpacity
                style={[styles.playButtonSet, isRunning && styles.pauseButtonSet]}
                onPress={toggleTimer}
              >
                <Ionicons
                  name={isRunning ? 'pause' : 'play'}
                  size={20}
                  color={COLORS.text}
                  style={!isRunning && styles.playIcon}
                />
              </TouchableOpacity>
            </View>

            {/* Divider 2 */}
            <View style={styles.divider} />

            {/* Right Column: Done Button */}
            <View style={styles.rightColumn}>
              <TouchableOpacity
                style={[styles.doneButton, styles.doneButtonActive]}
                onPress={handleDone}
              >
                <Text style={[styles.doneText, styles.doneTextActive]}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Floating Done Button for Edit Mode when Keyboard is Visible */}
        {isEditing && keyboardVisible && (
          <TouchableOpacity style={styles.floatingDoneButton} onPress={handleFloatingDone}>
            <Text style={styles.floatingDoneButtonText}>Done</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

// Memoized ActiveSetCard component to prevent unnecessary re-renders
const ActiveSetCard = React.memo<ActiveSetCardProps>(function ActiveSetCard({
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
}) {
  // Memoize cardio check to prevent recalculation
  const isCardio = useMemo(() => isCardioExercise(exercise), [exercise.muscle_group]);

  // Memoize cardioDuration calculation to prevent unnecessary re-renders
  const cardioDuration = useMemo(() => {
    if (!isCardio) return 15; // Default fallback

    // First check if set has duration_minutes
    if (set.duration_minutes) {
      const duration = parseInt(set.duration_minutes);
      if (!isNaN(duration) && duration > 0) {
        return duration;
      }
    }

    // Then check exercise reps_range (for cardio, this represents duration)
    if (exercise.reps_range) {
      const duration = parseInt(exercise.reps_range);
      if (!isNaN(duration) && duration > 0) {
        return duration;
      }
    }

    return 15;
  }, [isCardio, exercise.reps_range, set.duration_minutes]);

  // Stabilized callbacks using useCallback with proper dependencies
  const handleCardioComplete = useCallback(() => {
    // Mark this set as completed
    onSetComplete(exercise.id, setIndex);
  }, [onSetComplete, exercise.id, setIndex]);

  const handleCardioDurationChange = useCallback(
    (newDuration: number) => {
      if (onDurationMinutesChange) {
        // Update the set's duration_minutes with the new value
        onDurationMinutesChange(exercise.id, setIndex, newDuration.toString());
      }
    },
    [onDurationMinutesChange, exercise.id, setIndex, set.duration_minutes],
  );

  // Memoized placeholders to prevent recalculation on every render
  const getWeightPlaceholder = useCallback(() => {
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
  }, [
    exercise.id,
    exercise.exercise_id,
    setIndex,
    focusedInputs,
    currentRecommendation?.recommended_weight,
    getSuggestedValue,
    lastExerciseValues,
  ]);

  const getRepsPlaceholder = useCallback(() => {
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
  }, [
    exercise.id,
    exercise.exercise_id,
    exercise.reps_range,
    setIndex,
    focusedInputs,
    currentRecommendation?.recommended_reps,
    lastExerciseValues,
  ]);

  // For cardio exercises, show the timer interface
  if (isCardio) {
    return (
      <CardioTimer
        durationMinutes={cardioDuration}
        onComplete={handleCardioComplete}
        onDurationChange={handleCardioDurationChange}
        exercise={exercise}
        setIndex={setIndex}
        lastExerciseValues={lastExerciseValues}
        styles={styles}
      />
    );
  }

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
});

export default ActiveSetCard;
