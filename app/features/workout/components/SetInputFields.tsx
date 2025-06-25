import React from 'react';
import { View, Text, TextInput, NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import type { styles as WorkoutExerciseSetRowStylesType } from './WorkoutExerciseSetRow'; // Assuming this path is correct
import { ExerciseData, ExerciseSet } from '../types'; // Assuming types are in ../types

interface SetInputFieldsProps {
  set: ExerciseSet;
  setIndex: number;
  exercise: ExerciseData;
  isCompleted: boolean;
  textInputRefreshKey: number;
  exerciseCustomized: Record<string, boolean>;
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationMinutesChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationSecondsChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  getWeightPlaceholder: () => string;
  getRepsPlaceholder: () => string;
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

// Helper function to check if weight suggested label should be shown
const shouldShowWeightSuggestedLabel = (
  exercise: ExerciseData,
  setIndex: number,
  set: ExerciseSet,
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null,
): boolean => {
  return !!(getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight') && !set.isCompleted);
};

// Helper function to check if reps suggested label should be shown
const shouldShowRepsSuggestedLabel = (
  exercise: ExerciseData,
  setIndex: number,
  set: ExerciseSet,
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
    getSuggestedValue(exercise.exercise_id, setIndex + 1, 'reps') &&
    !set.isCompleted
  );
};

// Helper function to check if weight input should be shown
const shouldShowWeightInput = (exercise: ExerciseData, isCardio: boolean): boolean => {
  return !isCardio && exercise?.requires_weight !== false;
};

// Duration Input Component for Cardio Exercises
interface DurationInputsProps {
  exercise: ExerciseData;
  set: ExerciseSet;
  setIndex: number;
  isCompleted: boolean;
  textInputRefreshKey: number;
  onDurationMinutesChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationSecondsChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

const DurationInputs: React.FC<DurationInputsProps> = ({
  exercise,
  set,
  setIndex,
  isCompleted,
  textInputRefreshKey,
  onDurationMinutesChange,
  onDurationSecondsChange,
  onInputFocus,
  onInputBlur,
  styles,
}) => (
  <>
    <View style={styles.inputContainer}>
      <Text style={styles.suggestedLabelWeight}>Duration</Text>
      <View style={styles.inputFieldContainer}>
        <TextInput
          key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-duration-minutes-${textInputRefreshKey}`}
          style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
          value={set.duration_minutes || ''}
          onChangeText={(value) => onDurationMinutesChange?.(exercise.id, setIndex, value)}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="rgba(255,255,255,0.5)"
          selectTextOnFocus={true}
          onFocus={(event) => onInputFocus(`${exercise.id}-${setIndex}-duration-minutes`, event)}
          onBlur={() => onInputBlur(`${exercise.id}-${setIndex}-duration-minutes`)}
          editable={!isCompleted}
        />
        <Text style={styles.activeSetValueUnit}>min</Text>
      </View>
    </View>
    <View style={styles.inactiveInputDivider} />
    <View style={styles.inputContainer}>
      <View style={styles.inputFieldContainer}>
        <TextInput
          key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-duration-seconds-${textInputRefreshKey}`}
          style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
          value={set.duration_seconds || ''}
          onChangeText={(value) => onDurationSecondsChange?.(exercise.id, setIndex, value)}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="rgba(255,255,255,0.5)"
          selectTextOnFocus={true}
          onFocus={(event) => onInputFocus(`${exercise.id}-${setIndex}-duration-seconds`, event)}
          onBlur={() => onInputBlur(`${exercise.id}-${setIndex}-duration-seconds`)}
          editable={!isCompleted}
        />
        <Text style={styles.activeSetValueUnit}>sec</Text>
      </View>
    </View>
  </>
);

// Weight Input Component for Weight-based Exercises
interface WeightInputProps {
  exercise: ExerciseData;
  set: ExerciseSet;
  setIndex: number;
  isCompleted: boolean;
  textInputRefreshKey: number;
  getWeightPlaceholder: () => string;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  styles: typeof WorkoutExerciseSetRowStylesType;
}

const WeightInput: React.FC<WeightInputProps> = ({
  exercise,
  set,
  setIndex,
  isCompleted,
  textInputRefreshKey,
  getWeightPlaceholder,
  getSuggestedValue,
  onWeightChange,
  onInputFocus,
  onInputBlur,
  styles,
}) => (
  <>
    <View style={styles.inputContainer}>
      {shouldShowWeightSuggestedLabel(exercise, setIndex, set, getSuggestedValue) && (
        <Text style={styles.suggestedLabelWeight}>Suggested</Text>
      )}
      <View style={styles.inputFieldContainer}>
        <TextInput
          key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-weight-${exercise.requires_weight}-${textInputRefreshKey}`}
          style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
          value={set.weight}
          onChangeText={(value) => onWeightChange(exercise.id, setIndex, value)}
          keyboardType="decimal-pad"
          placeholder={getWeightPlaceholder()}
          placeholderTextColor="rgba(255,255,255,0.5)"
          selectTextOnFocus={true}
          onFocus={(event) => onInputFocus(`${exercise.id}-${setIndex}-weight`, event)}
          onBlur={() => onInputBlur(`${exercise.id}-${setIndex}-weight`)}
          editable={!isCompleted}
        />
        <Text style={styles.activeSetValueUnit}>kg</Text>
      </View>
    </View>
    <View style={styles.inactiveInputDivider} />
  </>
);

// Main SetInputFields Component (now simplified)
export default function SetInputFields({
  set,
  setIndex,
  exercise,
  isCompleted,
  textInputRefreshKey,
  exerciseCustomized,
  onWeightChange,
  onRepsChange,
  onDurationMinutesChange,
  onDurationSecondsChange,
  onInputFocus,
  onInputBlur,
  getWeightPlaceholder,
  getRepsPlaceholder,
  getSuggestedValue,
  styles,
}: SetInputFieldsProps) {
  const isCardio = isCardioExercise(exercise);

  return (
    <View style={styles.inactiveInputRow}>
      {/* For Cardio exercises, show duration instead of weight */}
      {isCardio ? (
        <DurationInputs
          exercise={exercise}
          set={set}
          setIndex={setIndex}
          isCompleted={isCompleted}
          textInputRefreshKey={textInputRefreshKey}
          onDurationMinutesChange={onDurationMinutesChange}
          onDurationSecondsChange={onDurationSecondsChange}
          onInputFocus={onInputFocus}
          onInputBlur={onInputBlur}
          styles={styles}
        />
      ) : (
        shouldShowWeightInput(exercise, isCardio) && (
          <WeightInput
            exercise={exercise}
            set={set}
            setIndex={setIndex}
            isCompleted={isCompleted}
            textInputRefreshKey={textInputRefreshKey}
            getWeightPlaceholder={getWeightPlaceholder}
            getSuggestedValue={getSuggestedValue}
            onWeightChange={onWeightChange}
            onInputFocus={onInputFocus}
            onInputBlur={onInputBlur}
            styles={styles}
          />
        )
      )}

      {/* For cardio exercises, reps becomes "sets" and is usually just counted */}
      <View style={styles.inputContainer}>
        {shouldShowRepsSuggestedLabel(exercise, setIndex, set, isCardio, getSuggestedValue) && (
          <Text style={styles.suggestedLabel}>Suggested</Text>
        )}
        <View style={styles.inputFieldContainer}>
          <TextInput
            key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-reps-${exercise.reps_range}-${exercise.requires_weight}-${exerciseCustomized[exercise.id] ? 'customized' : 'default'}-${textInputRefreshKey}`}
            style={[styles.inactiveInputField, isCompleted && styles.completedInputField]}
            value={set.reps}
            onChangeText={(value) => onRepsChange(exercise.id, setIndex, value)}
            keyboardType="numeric"
            placeholder={getRepsPlaceholder()}
            placeholderTextColor="rgba(255,255,255,0.5)"
            selectTextOnFocus={true}
            onFocus={(event) => onInputFocus(`${exercise.id}-${setIndex}-reps`, event)}
            onBlur={() => onInputBlur(`${exercise.id}-${setIndex}-reps`)}
            editable={!isCompleted}
          />
          <Text style={styles.activeSetValueUnit}>{isCardio ? 'sets' : 'reps'}</Text>
        </View>
      </View>
    </View>
  );
}
