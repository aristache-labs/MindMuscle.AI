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
  styles: typeof WorkoutExerciseSetRowStylesType;
}

const CardioTimer: React.FC<CardioTimerProps> = ({
  durationMinutes,
  onComplete,
  onDurationChange,
  styles,
}) => {
  const [timeRemaining, setTimeRemaining] = useState(durationMinutes * 60); // Convert to seconds
  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(durationMinutes.toString());
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const editInputRef = useRef<TextInput>(null);

  // Keep the callback ref updated
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // Keyboard listeners
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
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Get the original duration for "Last" display
  const getLastTime = (): string => {
    const originalSeconds = durationMinutes * 60;
    return formatTime(originalSeconds);
  };

  // Start/pause timer
  const toggleTimer = () => {
    if (!hasStarted) {
      setHasStarted(true);
    }
    setIsRunning((prev) => !prev);
  };

  // Complete the exercise early
  const handleDone = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    onCompleteRef.current();
  };

  // Handle edit mode toggle/save
  const handleEditSave = () => {
    if (isEditing) {
      // Save the new duration
      const newDuration = Math.max(1, Math.min(120, parseInt(editValue) || durationMinutes));
      setEditValue(newDuration.toString());
      if (onDurationChange && newDuration !== durationMinutes) {
        onDurationChange(newDuration);
      }
      setIsEditing(false);
      // Blur the input to dismiss keyboard
      if (editInputRef.current) {
        editInputRef.current.blur();
      }
    }
  };

  // Handle edit mode toggle
  const handleEditToggle = () => {
    if (hasStarted || isRunning) {
      return; // Don't allow editing if timer has started
    }

    if (isEditing) {
      handleEditSave();
    } else {
      // Enter edit mode
      setEditValue(durationMinutes.toString());
      setIsEditing(true);
      // Focus the input
      setTimeout(() => {
        if (editInputRef.current) {
          editInputRef.current.focus();
        }
      }, 100);
    }
  };

  // Handle input validation during editing
  const handleEditValueChange = (value: string) => {
    // Only allow numbers and limit to reasonable range
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue === '' || (parseInt(numericValue) >= 1 && parseInt(numericValue) <= 120)) {
      setEditValue(numericValue);
    }
  };

  // Handle timer countdown
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setIsRunning(false);
            onCompleteRef.current();
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
  }, [isRunning]);

  // Reset timer when duration changes
  useEffect(() => {
    setTimeRemaining(durationMinutes * 60);
    setIsRunning(false);
    setHasStarted(false);
    setIsEditing(false);
    setEditValue(durationMinutes.toString());
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [durationMinutes]);

  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return (
    <>
      <View style={[styles.setCard, styles.activeSetCard]}>
        <View style={styles.setCardContent}>
          <View style={styles.activeSetCardContainer}>
            <View style={styles.tableLayout}>
              {/* Left Column: Timer Display */}
              <View style={styles.leftColumn}>
                <View style={styles.timerCell}>
                  {isEditing && !hasStarted ? (
                    // Edit mode
                    <View style={styles.cardioEditContainer}>
                      <TextInput
                        ref={editInputRef}
                        style={styles.cardioEditInput}
                        value={editValue}
                        onChangeText={handleEditValueChange}
                        keyboardType="numeric"
                        selectTextOnFocus={true}
                        maxLength={3}
                        onSubmitEditing={handleEditSave}
                        returnKeyType="done"
                      />
                      <Text style={styles.cardioTimerUnit}>min</Text>
                    </View>
                  ) : (
                    // Display mode
                    <TouchableOpacity
                      style={styles.cardioTimerTouchable}
                      onPress={handleEditToggle}
                      disabled={hasStarted || isRunning}
                    >
                      <View style={styles.timerDisplayContainer}>
                        <Text style={styles.timerDisplay}>{formatTime(timeRemaining)}</Text>
                        <Text style={styles.cardioTimerUnit}>min</Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.cardioLastTimeText}>(Last {getLastTime()})</Text>
                </View>
              </View>

              {/* Divider 1 */}
              <View style={styles.divider} />

              {/* Middle Column: Play/Pause Button */}
              <View style={styles.middleColumn}>
                <TouchableOpacity
                  style={[styles.playButtonSet, isRunning && styles.pauseButtonSet]}
                  onPress={toggleTimer}
                  disabled={isEditing}
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
                  style={[styles.doneButton, hasStarted && styles.doneButtonActive]}
                  onPress={handleDone}
                  disabled={!hasStarted || isEditing}
                >
                  <Text style={[styles.doneText, hasStarted && styles.doneTextActive]}>Done</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Floating Done Button for Edit Mode */}
      {isEditing && keyboardVisible && (
        <View style={styles.floatingDoneButtonContainer}>
          <TouchableOpacity style={styles.floatingDoneButton} onPress={handleEditSave}>
            <Text style={styles.floatingDoneButtonText}>Done</Text>
            <Ionicons name="checkmark" size={20} color="#FFFFFF" style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      )}
    </>
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

  // Handle cardio duration change
  const handleCardioDurationChange = useCallback(
    (newDuration: number) => {
      if (onDurationMinutesChange) {
        onDurationMinutesChange(exercise.id, setIndex, newDuration.toString());
      }
    },
    [onDurationMinutesChange, exercise.id, setIndex],
  );

  // For cardio exercises, show the timer interface
  if (isCardio) {
    return (
      <CardioTimer
        durationMinutes={cardioDuration}
        onComplete={handleCardioComplete}
        onDurationChange={handleCardioDurationChange}
        styles={styles}
      />
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
