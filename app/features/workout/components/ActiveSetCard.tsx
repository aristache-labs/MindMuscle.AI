import React from 'react';
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
import { RecommendationData } from '../hooks/useExerciseSets';
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
  onSetComplete,
  onInputFocus,
  onInputBlur,
  getSuggestedValue,
  styles,
}: ActiveSetCardProps) {
  const getWeightPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-weight`;
    const isFocused = focusedInputs[inputId] || false;
    // const hasCompletedSet = set.isCompleted || false; // Not needed in active card
    const _hasValue = set.weight && set.weight !== '' && set.weight !== '-';

    const recommendedWeight = currentRecommendation?.recommended_weight?.toString();
    const suggestedValue = getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight');
    const lastWeight = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;

    if (isFocused) {
      return '';
    }

    if (lastWeight) {
      return lastWeight;
    }

    let placeholder = '--';
    if (recommendedWeight) {
      placeholder = recommendedWeight;
    } else if (suggestedValue) {
      placeholder = suggestedValue;
    }

    return placeholder;
  };

  const getRepsPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-reps`;
    const isFocused = focusedInputs[inputId] || false;
    // const hasCompletedSet = set.isCompleted || false; // Not needed in active card
    const _hasValue = set.reps && set.reps !== '' && set.reps !== '-';

    const recommendedReps = currentRecommendation?.recommended_reps?.toString();
    const lastReps = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
    const exerciseRepsRange = exercise.reps_range;
    const _isCustomized = exerciseCustomized[exercise.id];

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
            {/* Left Column: Weight and Reps stacked vertically */}
            <View style={styles.leftColumn}>
              {/* Weight and Reps Cell - both inputs in same cell */}
              <View style={styles.weightRepsCell}>
                <View style={styles.inputRow}>
                  {/* Only show weight input if exercise requires weight */}
                  {exercise?.requires_weight !== false && (
                    <>
                      <View style={styles.inputContainer}>
                        {/* Suggested label above weight input */}
                        {getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight') &&
                          !userEnteredValues[`${exercise.id}-${setIndex}-weight`] && (
                            <Text style={styles.suggestedLabelWeightActive}>Suggested</Text>
                          )}
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
                  )}

                  <View style={styles.inputContainer}>
                    {/* Suggested label above reps input for bodyweight exercises */}
                    {exercise?.requires_weight === false &&
                      getSuggestedValue(exercise.exercise_id, setIndex + 1, 'reps') && (
                        <Text style={styles.suggestedLabel}>Suggested</Text>
                      )}
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
                      <Text style={styles.activeSetValueUnit}>reps</Text>
                    </View>
                  </View>
                </View>

                {/* Last values row - split under each input - only show for incomplete sets */}
                {!set.isCompleted &&
                  (lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight ||
                    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps) && (
                    <View style={styles.lastValuesRowActive}>
                      {/* Only show weight last value if exercise requires weight */}
                      {exercise?.requires_weight !== false && (
                        <View style={styles.lastValueContainerActive}>
                          {lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight && (
                            <Text style={styles.activeSetSubValue}>
                              ( Last{' '}
                              {lastExerciseValues[exercise.exercise_id][setIndex + 1]?.weight} )
                            </Text>
                          )}
                        </View>
                      )}

                      {exercise?.requires_weight !== false && (
                        <View style={styles.lastValueSpacer} />
                      )}

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
