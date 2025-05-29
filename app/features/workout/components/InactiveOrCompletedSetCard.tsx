import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextInputFocusEventData,
} from 'react-native';
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
  onSetComplete: (exerciseId: string, setIndex: number) => void;
  onRedoSet: (exerciseId: string, setIndex: number) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

interface PlaceholderHookParams {
  exercise: ExerciseData;
  setIndex: number;
  focusedInputs: Record<string, boolean>;
  isCompleted: boolean;
  currentRecommendation: RecommendationData | null;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
}

// Custom hook to handle placeholder logic
function usePlaceholders({
  exercise,
  setIndex,
  focusedInputs,
  isCompleted,
  currentRecommendation,
  lastExerciseValues,
  getSuggestedValue,
}: PlaceholderHookParams) {
  const getWeightPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-weight`;
    const isFocused = focusedInputs[inputId] || false;

    if (isFocused || isCompleted) return '';

    const recommendedWeight = currentRecommendation?.recommended_weight?.toString();
    const suggestedValue = getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight');
    const lastWeight = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;

    return lastWeight || recommendedWeight || suggestedValue || '--';
  };

  const getRepsPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-reps`;
    const isFocused = focusedInputs[inputId] || false;

    if (isFocused || isCompleted) return '';

    const recommendedReps = currentRecommendation?.recommended_reps?.toString();
    const lastReps = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
    const exerciseRepsRange = exercise.reps_range;

    return lastReps || recommendedReps || exerciseRepsRange || '--';
  };

  return { getWeightPlaceholder, getRepsPlaceholder };
}

// Component for last values display
interface LastValuesRowProps {
  exercise: ExerciseData;
  setIndex: number;
  set: ExerciseSet;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

function LastValuesRow({
  exercise,
  setIndex,
  set,
  lastExerciseValues,
  styles,
}: LastValuesRowProps) {
  const hasLastValues =
    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight ||
    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;

  if (set.isCompleted || !hasLastValues) {
    return null;
  }

  const lastWeight = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;
  const lastReps = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
  const requiresWeight = exercise?.requires_weight !== false;

  return (
    <View style={styles.lastValuesRowInactive}>
      {requiresWeight && (
        <View style={styles.lastValueContainerInactive}>
          {lastWeight && <Text style={styles.activeSetSubValue}>( Last {lastWeight} )</Text>}
        </View>
      )}

      {requiresWeight && <View style={styles.lastValueSpacer} />}

      <View style={styles.lastValueContainerInactive}>
        {lastReps && <Text style={styles.activeSetSubValue}>( Last {lastReps} )</Text>}
      </View>
    </View>
  );
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
  onSetComplete,
  onRedoSet,
  onInputFocus,
  onInputBlur,
  getSuggestedValue,
  styles,
}: InactiveOrCompletedSetCardProps) {
  const { getWeightPlaceholder, getRepsPlaceholder } = usePlaceholders({
    exercise,
    setIndex,
    focusedInputs,
    isCompleted,
    currentRecommendation,
    lastExerciseValues,
    getSuggestedValue,
  });

  return (
    <View style={[styles.setCard, styles.inactiveSetCard, isCompleted && styles.completedSetCard]}>
      <View style={styles.setCardContent}>
        <View style={styles.inactiveSetCardContent}>
          <View style={styles.inactiveLeftCell}>
            <SetInputFields
              set={set}
              setIndex={setIndex}
              exercise={exercise}
              isCompleted={isCompleted}
              textInputRefreshKey={textInputRefreshKey}
              exerciseCustomized={exerciseCustomized}
              onWeightChange={onWeightChange}
              onRepsChange={onRepsChange}
              onInputFocus={onInputFocus}
              onInputBlur={onInputBlur}
              getWeightPlaceholder={getWeightPlaceholder}
              getRepsPlaceholder={getRepsPlaceholder}
              getSuggestedValue={getSuggestedValue}
              styles={styles}
            />

            <LastValuesRow
              exercise={exercise}
              setIndex={setIndex}
              set={set}
              lastExerciseValues={lastExerciseValues}
              styles={styles}
            />
          </View>

          <View style={styles.inactiveVerticalDivider} />

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
  );
}
