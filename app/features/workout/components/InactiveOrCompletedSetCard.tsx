import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../../constants/theme';
import { RecommendationData } from '../hooks/useExerciseSets';
import type { styles as WorkoutExerciseSetRowStylesType } from './WorkoutExerciseSetRow';
import SetInputFields from './SetInputFields';
import { ExerciseSet, ExerciseData } from '../types';

interface InactiveOrCompletedSetCardProps {
  set: ExerciseSet;
  setIndex: number;
  exercise: ExerciseData;
  isActive: boolean;
  isCompleted: boolean;
  focusedInputs: Record<string, boolean>;
  exerciseCustomized: Record<string, boolean>;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  currentRecommendation: RecommendationData | null;
  textInputRefreshKey: number;
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationMinutesChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationSecondsChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onSetComplete: (exerciseId: string, setIndex: number) => void;
  onRedoSet: (exerciseId: string, setIndex: number) => void;
  onInputFocus: (id: string) => void;
  onInputBlur: (id: string) => void;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

// Component for action button
interface ActionButtonProps {
  exercise: ExerciseData;
  setIndex: number;
  isActive: boolean;
  isCompleted: boolean;
  onSetComplete: (exerciseId: string, setIndex: number) => void;
  onRedoSet: (exerciseId: string, setIndex: number) => void;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

function ActionButton({
  exercise,
  setIndex,
  isActive,
  isCompleted,
  onSetComplete,
  onRedoSet,
  styles,
}: ActionButtonProps) {
  const handlePress = () => {
    if (isCompleted) {
      onRedoSet(exercise.id, setIndex);
    } else if (isActive) {
      onSetComplete(exercise.id, setIndex);
    }
  };

  const isDisabled = !isCompleted && !isActive;

  return (
    <TouchableOpacity
      style={[styles.playButtonSet, isCompleted && styles.redoButtonSet]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      <Ionicons name={isCompleted ? 'reload' : 'play'} size={20} color={COLORS.text} />
    </TouchableOpacity>
  );
}

// Helper function to determine if exercise is cardio
const isCardioExercise = (exercise: ExerciseData): boolean => {
  return exercise?.muscle_group === 'Cardio';
};

// Cardio Set Display Component
interface CardioSetDisplayProps {
  exercise: ExerciseData;
  isCompleted: boolean;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

function CardioSetDisplay({ exercise, isCompleted, styles }: CardioSetDisplayProps) {
  // Get the duration from the exercise's reps_range
  const getCardioDuration = (): number => {
    if (!exercise.reps_range) return 15;
    const range = exercise.reps_range.split('-');
    return parseInt(range[0]) || 15;
  };

  return (
    <View style={styles.inactiveInputRow}>
      <View style={styles.inputContainer}>
        <Text style={[styles.suggestedLabelWeight, isCompleted && styles.completedLabel]}>
          Duration
        </Text>
        <View style={styles.inputFieldContainer}>
          <Text
            style={[
              styles.inactiveInputField,
              styles.cardioDisplayText,
              isCompleted && styles.completedInputField,
            ]}
          >
            {getCardioDuration()}
          </Text>
          <Text style={styles.activeSetValueUnit}>min</Text>
        </View>
      </View>

      <View style={styles.inactiveInputDivider} />

      <View style={styles.inputContainer}>
        {isCompleted && (
          <Text style={[styles.suggestedLabel, styles.completedLabel]}>Completed</Text>
        )}
        <View style={styles.inputFieldContainer}>
          <Text
            style={[
              styles.inactiveInputField,
              styles.cardioDisplayText,
              isCompleted && styles.completedInputField,
            ]}
          >
            {isCompleted ? '1' : '1'}
          </Text>
          <Text style={styles.activeSetValueUnit}>set</Text>
        </View>
      </View>
    </View>
  );
}

export default function InactiveOrCompletedSetCard({
  set,
  setIndex,
  exercise,
  isActive,
  isCompleted,
  focusedInputs,
  exerciseCustomized,
  lastExerciseValues,
  currentRecommendation,
  textInputRefreshKey,
  onWeightChange,
  onRepsChange,
  onDurationMinutesChange,
  onDurationSecondsChange,
  onSetComplete,
  onRedoSet,
  onInputFocus,
  onInputBlur,
  getSuggestedValue,
  styles,
}: InactiveOrCompletedSetCardProps) {
  const isCardio = isCardioExercise(exercise);

  // Create wrapper functions that match the expected signature for SetInputFields
  const getWeightPlaceholderWrapper = () => {
    const inputId = `${exercise.id}-${setIndex}-weight`;
    const isFocused = focusedInputs[inputId] || false;

    if (isFocused || isCompleted) return '';

    const recommendedWeight = currentRecommendation?.recommended_weight?.toString();
    const suggestedValue = getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight');
    const lastWeight = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;

    return recommendedWeight || suggestedValue || lastWeight || '--';
  };

  const getRepsPlaceholderWrapper = () => {
    const inputId = `${exercise.id}-${setIndex}-reps`;
    const isFocused = focusedInputs[inputId] || false;

    if (isFocused || isCompleted) return '';

    const recommendedReps = currentRecommendation?.recommended_reps?.toString();
    const lastReps = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
    const exerciseRepsRange = exercise.reps_range;

    return lastReps || recommendedReps || exerciseRepsRange || '--';
  };

  return (
    <View style={[styles.setCard, isCompleted && styles.completedSetCard]}>
      <View style={styles.setCardContent}>
        <View style={styles.inactiveSetCardContainer}>
          <View style={styles.tableLayout}>
            {/* Left Column: Set inputs */}
            <View style={styles.leftColumn}>
              <View style={styles.weightRepsCell}>
                {isCardio ? (
                  <CardioSetDisplay exercise={exercise} isCompleted={isCompleted} styles={styles} />
                ) : (
                  <SetInputFields
                    set={set}
                    setIndex={setIndex}
                    exercise={exercise}
                    isCompleted={isCompleted}
                    textInputRefreshKey={textInputRefreshKey}
                    exerciseCustomized={exerciseCustomized}
                    onWeightChange={onWeightChange}
                    onRepsChange={onRepsChange}
                    onDurationMinutesChange={onDurationMinutesChange}
                    onDurationSecondsChange={onDurationSecondsChange}
                    onInputFocus={onInputFocus}
                    onInputBlur={onInputBlur}
                    getWeightPlaceholder={getWeightPlaceholderWrapper}
                    getRepsPlaceholder={getRepsPlaceholderWrapper}
                    getSuggestedValue={getSuggestedValue}
                    styles={styles}
                  />
                )}
              </View>
            </View>

            {/* Right Column: Action button */}
            <View style={styles.rightColumn}>
              <View style={styles.inactiveButtonCell}>
                <ActionButton
                  exercise={exercise}
                  setIndex={setIndex}
                  isActive={isActive}
                  isCompleted={isCompleted}
                  onSetComplete={onSetComplete}
                  onRedoSet={onRedoSet}
                  styles={styles}
                />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
