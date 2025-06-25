import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  NativeSyntheticEvent,
  TextInputFocusEventData,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';
import type { RecommendationData } from '../hooks/useExerciseSets';
import { ExerciseData, ExerciseSet } from '../types';
import ActiveSetCard from './ActiveSetCard';
import InactiveOrCompletedSetCard from './InactiveOrCompletedSetCard';

// Define the styles type using React Native style types
type WorkoutExerciseSetRowStyles = {
  [key: string]: ViewStyle | TextStyle;
};

interface WorkoutExerciseSetRowProps {
  set: ExerciseSet;
  setIndex: number;
  exercise: ExerciseData;
  isActive: boolean;
  isCompleted: boolean;
  focusedInputs: Record<string, boolean>;
  userEnteredValues: Record<string, boolean>;
  exerciseCustomized: Record<string, boolean>;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  currentRecommendation: RecommendationData | null;
  textInputRefreshKey: number;

  // Event handlers
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationMinutesChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onDurationSecondsChange?: (exerciseId: string, setIndex: number, value: string) => void;
  onSetComplete: (exerciseId: string, setIndex: number) => void;
  onRedoSet: (exerciseId: string, setIndex: number) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;

  // Utility functions
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
}

// Helper component for placeholder logic
const usePlaceholderLogic = (
  exercise: ExerciseData,
  set: ExerciseSet,
  setIndex: number,
  state: {
    focusedInputs: Record<string, boolean>;
    lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
    exerciseCustomized: Record<string, boolean>;
  },
  currentRecommendation: RecommendationData | null,
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null,
) => {
  const getWeightPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-weight`;
    const isFocused = state.focusedInputs[inputId] || false;
    const hasCompletedSet = set.isCompleted || false;

    const recommendedWeight = currentRecommendation?.recommended_weight?.toString();
    const suggestedValue = getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight');
    const lastWeight = state.lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;

    if (isFocused || hasCompletedSet) {
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
    const isFocused = state.focusedInputs[inputId] || false;
    const hasCompletedSet = set.isCompleted || false;

    const recommendedReps = currentRecommendation?.recommended_reps?.toString();
    const lastReps = state.lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
    const exerciseRepsRange = exercise.reps_range;

    if (isFocused || hasCompletedSet) {
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

  return { getWeightPlaceholder, getRepsPlaceholder };
};

// Helper component for weight input
interface WeightInputProps {
  exercise: ExerciseData;
  set: ExerciseSet;
  setIndex: number;
  textInputRefreshKey: number;
  userEnteredValues: Record<string, boolean>;
  getWeightPlaceholder: () => string;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  styles: WorkoutExerciseSetRowStyles;
}

const WeightInput: React.FC<WeightInputProps> = ({
  exercise,
  set,
  setIndex,
  textInputRefreshKey,
  userEnteredValues,
  getWeightPlaceholder,
  getSuggestedValue,
  onWeightChange,
  onInputFocus,
  onInputBlur,
  styles,
}) => {
  if (exercise?.requires_weight === false) return null;

  return (
    <>
      <View style={styles.inputContainer}>
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
            onFocus={(event) => onInputFocus(`${exercise.id}-${setIndex}-weight`, event)}
            onBlur={() => onInputBlur(`${exercise.id}-${setIndex}-weight`)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          />
          <Text style={styles.activeSetValueUnit}>kg</Text>
        </View>
      </View>
      <View style={styles.inputDivider} />
    </>
  );
};

// Helper component for reps input
interface RepsInputProps {
  exercise: ExerciseData;
  set: ExerciseSet;
  setIndex: number;
  textInputRefreshKey: number;
  exerciseCustomized: Record<string, boolean>;
  getRepsPlaceholder: () => string;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  styles: WorkoutExerciseSetRowStyles;
}

const RepsInput: React.FC<RepsInputProps> = ({
  exercise,
  set,
  setIndex,
  textInputRefreshKey,
  exerciseCustomized,
  getRepsPlaceholder,
  getSuggestedValue,
  onRepsChange,
  onInputFocus,
  onInputBlur,
  styles,
}) => (
  <View style={styles.inputContainer}>
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
);

// Helper component for last values display
interface LastValuesRowProps {
  exercise: ExerciseData;
  set: ExerciseSet;
  setIndex: number;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  styles: WorkoutExerciseSetRowStyles;
  isActive?: boolean;
}

const LastValuesRow: React.FC<LastValuesRowProps> = ({
  exercise,
  set,
  setIndex,
  lastExerciseValues,
  styles,
  isActive = false,
}) => {
  if (set.isCompleted) return null;

  const hasLastValues =
    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight ||
    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;

  if (!hasLastValues) return null;

  const lastWeight = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;
  const lastReps = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
  const requiresWeight = exercise?.requires_weight !== false;

  const rowStyle = isActive ? styles.lastValuesRowActive : styles.lastValuesRowInactive;
  const containerStyle = isActive
    ? styles.lastValueContainerActive
    : styles.lastValueContainerInactive;

  return (
    <View style={rowStyle}>
      {requiresWeight && (
        <View style={containerStyle}>
          {lastWeight && <Text style={styles.activeSetSubValue}>( Last {lastWeight} )</Text>}
        </View>
      )}

      {requiresWeight && <View style={styles.lastValueSpacer} />}

      <View style={containerStyle}>
        {lastReps && <Text style={styles.activeSetSubValue}>( Last {lastReps} )</Text>}
      </View>
    </View>
  );
};

// Helper component for inactive weight input
interface InactiveWeightInputProps {
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
  styles: WorkoutExerciseSetRowStyles;
}

const InactiveWeightInput: React.FC<InactiveWeightInputProps> = ({
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
}) => {
  if (exercise?.requires_weight === false) return null;

  return (
    <>
      <View style={styles.inputContainer}>
        {getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight') && !set.isCompleted && (
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
};

// Helper component for inactive reps input
interface InactiveRepsInputProps {
  exercise: ExerciseData;
  set: ExerciseSet;
  setIndex: number;
  isCompleted: boolean;
  textInputRefreshKey: number;
  exerciseCustomized: Record<string, boolean>;
  getRepsPlaceholder: () => string;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  onInputFocus: (id: string, event?: NativeSyntheticEvent<TextInputFocusEventData>) => void;
  onInputBlur: (id: string) => void;
  styles: WorkoutExerciseSetRowStyles;
}

const InactiveRepsInput: React.FC<InactiveRepsInputProps> = ({
  exercise,
  set,
  setIndex,
  isCompleted,
  textInputRefreshKey,
  exerciseCustomized,
  getRepsPlaceholder,
  getSuggestedValue,
  onRepsChange,
  onInputFocus,
  onInputBlur,
  styles,
}) => (
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
);

// Main component with reduced complexity
export default function WorkoutExerciseSetRow({
  set,
  setIndex,
  exercise,
  isActive,
  isCompleted,
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
  onRedoSet,
  onInputFocus,
  onInputBlur,
  getSuggestedValue,
}: WorkoutExerciseSetRowProps) {
  const { getWeightPlaceholder, getRepsPlaceholder } = usePlaceholderLogic(
    exercise,
    set,
    setIndex,
    { focusedInputs, lastExerciseValues, exerciseCustomized },
    currentRecommendation,
    getSuggestedValue,
  );

  // Determine if this is a cardio exercise
  const isCardioExercise = exercise?.muscle_group === 'Cardio';

  // For cardio exercises, use specialized components that handle the CardioTimer
  if (isCardioExercise) {
    if (isActive && !isCompleted) {
      return (
        <ActiveSetCard
          set={set}
          setIndex={setIndex}
          exercise={exercise}
          focusedInputs={focusedInputs}
          userEnteredValues={userEnteredValues}
          exerciseCustomized={exerciseCustomized}
          lastExerciseValues={lastExerciseValues}
          currentRecommendation={currentRecommendation}
          textInputRefreshKey={textInputRefreshKey}
          onWeightChange={onWeightChange}
          onRepsChange={onRepsChange}
          onDurationMinutesChange={onDurationMinutesChange}
          onDurationSecondsChange={onDurationSecondsChange}
          onSetComplete={onSetComplete}
          onInputFocus={onInputFocus}
          onInputBlur={onInputBlur}
          getSuggestedValue={getSuggestedValue}
          styles={styles}
        />
      );
    } else {
      return (
        <InactiveOrCompletedSetCard
          set={set}
          setIndex={setIndex}
          exercise={exercise}
          isActive={isActive}
          isCompleted={isCompleted}
          focusedInputs={focusedInputs}
          exerciseCustomized={exerciseCustomized}
          lastExerciseValues={lastExerciseValues}
          currentRecommendation={currentRecommendation}
          textInputRefreshKey={textInputRefreshKey}
          onWeightChange={onWeightChange}
          onRepsChange={onRepsChange}
          onDurationMinutesChange={onDurationMinutesChange}
          onDurationSecondsChange={onDurationSecondsChange}
          onSetComplete={onSetComplete}
          onRedoSet={onRedoSet}
          onInputFocus={onInputFocus}
          onInputBlur={onInputBlur}
          getSuggestedValue={getSuggestedValue}
          styles={styles}
        />
      );
    }
  }

  // Render active set card
  if (isActive && !isCompleted) {
    return (
      <View style={[styles.setCard, styles.activeSetCard]}>
        <View style={styles.setCardContent}>
          <View style={styles.activeSetCardContainer}>
            <View style={styles.tableLayout}>
              <View style={styles.leftColumn}>
                <View style={styles.weightRepsCell}>
                  <View style={styles.inputRow}>
                    <WeightInput
                      exercise={exercise}
                      set={set}
                      setIndex={setIndex}
                      textInputRefreshKey={textInputRefreshKey}
                      userEnteredValues={userEnteredValues}
                      getWeightPlaceholder={getWeightPlaceholder}
                      getSuggestedValue={getSuggestedValue}
                      onWeightChange={onWeightChange}
                      onInputFocus={onInputFocus}
                      onInputBlur={onInputBlur}
                      styles={styles}
                    />

                    <RepsInput
                      exercise={exercise}
                      set={set}
                      setIndex={setIndex}
                      textInputRefreshKey={textInputRefreshKey}
                      exerciseCustomized={exerciseCustomized}
                      getRepsPlaceholder={getRepsPlaceholder}
                      getSuggestedValue={getSuggestedValue}
                      onRepsChange={onRepsChange}
                      onInputFocus={onInputFocus}
                      onInputBlur={onInputBlur}
                      styles={styles}
                    />
                  </View>

                  <LastValuesRow
                    exercise={exercise}
                    set={set}
                    setIndex={setIndex}
                    lastExerciseValues={lastExerciseValues}
                    styles={styles}
                    isActive={true}
                  />
                </View>

                <View style={styles.horizontalDivider} />

                <View style={styles.labelCell}>
                  <Text
                    style={[
                      styles.activeSetLabel,
                      exercise?.requires_weight === false && { marginLeft: -50 },
                    ]}
                  >
                    {exercise?.requires_weight !== false
                      ? 'Weight of bar + plates'
                      : 'Bodyweight exercise - reps only'}
                  </Text>
                </View>
              </View>

              <View style={styles.mainVerticalDivider} />

              <View style={styles.didItButtonCell}>
                <TouchableOpacity
                  style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}
                  onPress={() => onSetComplete(exercise.id, setIndex)}
                >
                  <Text style={styles.didItTextSet}>Did It</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Render inactive/completed set card
  return (
    <View style={[styles.setCard, styles.inactiveSetCard, isCompleted && styles.completedSetCard]}>
      <View style={styles.setCardContent}>
        <View style={styles.inactiveSetCardContent}>
          <View style={styles.inactiveLeftCell}>
            <View style={styles.inactiveInputRow}>
              <InactiveWeightInput
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

              <InactiveRepsInput
                exercise={exercise}
                set={set}
                setIndex={setIndex}
                isCompleted={isCompleted}
                textInputRefreshKey={textInputRefreshKey}
                exerciseCustomized={exerciseCustomized}
                getRepsPlaceholder={getRepsPlaceholder}
                getSuggestedValue={getSuggestedValue}
                onRepsChange={onRepsChange}
                onInputFocus={onInputFocus}
                onInputBlur={onInputBlur}
                styles={styles}
              />
            </View>

            <LastValuesRow
              exercise={exercise}
              set={set}
              setIndex={setIndex}
              lastExerciseValues={lastExerciseValues}
              styles={styles}
              isActive={false}
            />
          </View>

          <View style={styles.inactiveVerticalDivider} />

          <View style={styles.inactiveButtonCell}>
            <TouchableOpacity
              style={[styles.playButtonSet, isCompleted && styles.redoButtonSet]}
              onPress={() => {
                if (isCompleted) {
                  onRedoSet(exercise.id, setIndex);
                } else if (isActive) {
                  onSetComplete(exercise.id, setIndex);
                }
              }}
              disabled={!isCompleted && !isActive}
            >
              <Ionicons name={isCompleted ? 'reload' : 'play'} size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  setCard: {
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    minHeight: 70,
  },
  activeSetCard: {
    backgroundColor: COLORS.primary,
  },
  inactiveSetCard: {
    backgroundColor: COLORS.surface,
  },
  completedSetCard: {
    opacity: 0.5,
  },
  setCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  activeSetCardContainer: {
    width: '100%',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.primary,
  },
  tableLayout: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 160,
  },
  leftColumn: {
    flex: 1,
    flexDirection: 'column',
  },
  weightRepsCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  inputDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.md,
  },
  labelCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  horizontalDivider: {
    height: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.md,
  },
  mainVerticalDivider: {
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  didItButtonCell: {
    width: 80,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    minHeight: 44,
    columnGap: 0,
    flex: 1,
  },
  inputFieldContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputField: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 8,
    paddingRight: 0,
    height: 44,
    minHeight: 44,
    minWidth: 60,
  },
  inactiveInputField: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 8,
    paddingRight: 0,
    height: 40,
    minHeight: 40,
    minWidth: 60,
  },
  completedInputField: {
    opacity: 0.5,
  },
  activeSetValueUnit: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 10,
    marginLeft: 4,
    color: 'rgba(255, 255, 255, 0.52)',
    textAlign: 'center',
    alignSelf: 'center',
  },
  activeSetSubValue: {
    color: COLORS.text,
    fontSize: 12,
    opacity: 0.8,
    marginTop: -10,
    textAlign: 'center',
  },
  activeSetLabel: {
    color: COLORS.text,
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
    marginTop: 0,
    marginLeft: -125,
    paddingHorizontal: SPACING.sm,
  },
  didItTextSet: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  inactiveSetCardContent: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    height: 100,
    paddingLeft: 0,
    paddingRight: 0,
  },
  inactiveLeftCell: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  inactiveInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: -10,
    flex: 1,
  },
  inactiveInputDivider: {
    width: 1,
    height: 30,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginHorizontal: SPACING.lg,
  },
  inactiveVerticalDivider: {
    width: 0.5,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  inactiveButtonCell: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lastValuesRowActive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  lastValuesRowInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  lastValueContainerActive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastValueContainerInactive: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lastValueSpacer: {
    width: SPACING.xs,
  },
  playButtonSet: {
    backgroundColor: COLORS.primary,
    borderRadius: 18,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: SPACING.md,
  },
  redoButtonSet: {
    backgroundColor: COLORS.secondary,
  },
  suggestedLabel: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 0,
    marginBottom: 0,
  },
  suggestedLabelWeight: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 0,
    marginBottom: 0,
  },
  suggestedLabelWeightActive: {
    color: 'rgba(255, 255, 255, 0.61)',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginLeft: 0,
    marginBottom: 0,
  },
  rightColumn: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.sm,
  },
  activeSetNumberText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  completeButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Cardio-specific styles
  cardioDisplayText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 8,
    paddingRight: 0,
    height: 40,
    minHeight: 40,
    minWidth: 60,
  },
  completedLabel: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 4,
  },
  inactiveSetCardContainer: {
    width: '100%',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.surface,
  },
});

export { styles };
