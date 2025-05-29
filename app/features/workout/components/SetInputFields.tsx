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

export default function SetInputFields({
  set,
  setIndex,
  exercise,
  isCompleted,
  textInputRefreshKey,
  exerciseCustomized,
  onWeightChange,
  onRepsChange,
  onInputFocus,
  onInputBlur,
  getWeightPlaceholder,
  getRepsPlaceholder,
  getSuggestedValue,
  styles,
}: SetInputFieldsProps) {
  return (
    <View style={styles.inactiveInputRow}>
      {exercise?.requires_weight !== false && (
        <>
          <View style={styles.inputContainer}>
            {getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight') &&
              !set.isCompleted && <Text style={styles.suggestedLabelWeight}>Suggested</Text>}
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
      )}
      <View style={styles.inputContainer}>
        {exercise?.requires_weight === false &&
          getSuggestedValue(exercise.exercise_id, setIndex + 1, 'reps') &&
          !set.isCompleted && <Text style={styles.suggestedLabel}>Suggested</Text>}
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
          <Text style={styles.activeSetValueUnit}>reps</Text>
        </View>
      </View>
    </View>
  );
}
