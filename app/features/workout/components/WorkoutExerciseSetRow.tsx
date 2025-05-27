import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, BORDER_RADIUS } from '../../../constants/theme';

interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

interface ExerciseData {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  requires_weight?: boolean;
}

interface WorkoutExerciseSetRowProps {
  set: ExerciseSet;
  setIndex: number;
  exercise: ExerciseData;
  isActive: boolean;
  isCompleted: boolean;
  focusedInputs: Record<string, boolean>;
  userEnteredValues: Record<string, boolean>;
  exerciseCustomized: Record<string, boolean>;
  lastExerciseValues: Record<string, Record<number, { weight: string, reps: string }>>;
  currentRecommendation: any;
  textInputRefreshKey: number;
  
  // Event handlers
  onWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  onRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  onSetComplete: (exerciseId: string, setIndex: number) => void;
  onRedoSet: (exerciseId: string, setIndex: number) => void;
  onInputFocus: (id: string, event?: any) => void;
  onInputBlur: (id: string) => void;
  
  // Utility functions
  getSuggestedValue: (exerciseId: string, setNumber: number, type: 'weight' | 'reps') => string | null;
}

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
  onSetComplete,
  onRedoSet,
  onInputFocus,
  onInputBlur,
  getSuggestedValue,
}: WorkoutExerciseSetRowProps) {
  

  
  // Helper function to get placeholder text for weight input
  const getWeightPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-weight`;
    const isFocused = focusedInputs[inputId] || false;
    const hasCompletedSet = set.isCompleted || false;
    const hasValue = set.weight && set.weight !== '' && set.weight !== '-';
    
    const recommendedWeight = currentRecommendation?.recommended_weight?.toString();
    const suggestedValue = getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight');
    const lastWeight = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight;
    
    // Only return empty if the input is focused OR the set is completed
    if (isFocused || hasCompletedSet) {
      return '';
    }
    
    // CRITICAL CHANGE: Always show the lastWeight as a placeholder, even if the field has a value
    // This way users can always see their previous weight
    if (lastWeight) {
      return lastWeight;
    }
    
    // Fall back to other options
    let placeholder = '--';
    if (recommendedWeight) {
      placeholder = recommendedWeight;
    } else if (suggestedValue) {
      placeholder = suggestedValue;
    }
    
    return placeholder;
  };

  // Helper function to get placeholder text for reps input
  const getRepsPlaceholder = () => {
    const inputId = `${exercise.id}-${setIndex}-reps`;
    const isFocused = focusedInputs[inputId] || false;
    const hasCompletedSet = set.isCompleted || false;
    const hasValue = set.reps && set.reps !== '' && set.reps !== '-';
    
    const recommendedReps = currentRecommendation?.recommended_reps?.toString();
    const lastReps = lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps;
    const exerciseRepsRange = exercise.reps_range;
    const isCustomized = exerciseCustomized[exercise.id];
    
    // Only return empty if the input is focused OR the set is completed
    if (isFocused || hasCompletedSet) {
      return '';
    }
    
    // CRITICAL CHANGE: Always show the lastReps as a placeholder, even if the field has a value
    // This way users can always see their previous reps
    if (lastReps) {
      return lastReps;
    }
    
    // Fall back to other options if no last reps found
    let placeholder = '--';
    
    if (recommendedReps) {
      placeholder = recommendedReps;
    } else if (exerciseRepsRange) {
      placeholder = exerciseRepsRange;
    }
    
    return placeholder;
  };

  // Render active set card
  if (isActive && !isCompleted) {
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
                            <Text style={styles.suggestedLabelWeightActive}>
                              Suggested
                            </Text>
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
                    )}
                    
                    <View style={styles.inputContainer}>
                      {/* Suggested label above reps input for bodyweight exercises */}
                      {exercise?.requires_weight === false && getSuggestedValue(exercise.exercise_id, setIndex + 1, 'reps') && (
                        <Text style={styles.suggestedLabel}>
                          Suggested
                        </Text>
                      )}
                      <View style={styles.inputFieldContainer}>
                        <TextInput
                          key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-reps-${exercise.reps_range}-${exerciseCustomized[exercise.id] ? 'customized' : 'default'}-${textInputRefreshKey}`}
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
                  {!set.isCompleted && (lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight || 
                    lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps) && (
                    <View style={styles.lastValuesRowActive}>
                      {/* Only show weight last value if exercise requires weight */}
                      {exercise?.requires_weight !== false && (
                        <View style={styles.lastValueContainerActive}>
                          {lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight && (
                            <Text style={styles.activeSetSubValue}>
                              ( Last {lastExerciseValues[exercise.exercise_id][setIndex + 1]?.weight} )
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

                {/* Horizontal Divider */}
                <View style={styles.horizontalDivider} />

                {/* Label Cell */}
                <View style={styles.labelCell}>
                  <Text style={[
                    styles.activeSetLabel,
                    exercise?.requires_weight === false && { marginLeft: -50 }
                  ]}>
                    {exercise?.requires_weight !== false 
                      ? "Weight of bar + plates" 
                      : "Bodyweight exercise - reps only"}
                  </Text>
                </View>
              </View>

              {/* Vertical Divider */}
              <View style={styles.mainVerticalDivider} />

              {/* Button Cell - spans full height */}
              <View style={styles.didItButtonCell}>
                <TouchableOpacity 
                  style={{flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center'}}
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
    <View style={[
      styles.setCard,
      styles.inactiveSetCard,
      isCompleted && styles.completedSetCard
    ]}>
      <View style={styles.setCardContent}>
        <View style={styles.inactiveSetCardContent}>
          {/* Left Cell: Weight and Reps inputs */}
          <View style={styles.inactiveLeftCell}>
            <View style={styles.inactiveInputRow}>
              {/* Only show weight input if exercise requires weight */}
              {exercise?.requires_weight !== false && (
                <>
                  <View style={styles.inputContainer}>
                    {/* Suggested label above weight input - hide for completed sets */}
                    {getSuggestedValue(exercise.exercise_id, setIndex + 1, 'weight') && !set.isCompleted && (
                      <Text style={styles.suggestedLabelWeight}>
                        Suggested
                      </Text>
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
              )}
              
              <View style={styles.inputContainer}>
                {/* Suggested label above reps input for bodyweight exercises - hide for completed sets */}
                {exercise?.requires_weight === false && getSuggestedValue(exercise.exercise_id, setIndex + 1, 'reps') && !set.isCompleted && (
                  <Text style={styles.suggestedLabel}>
                    Suggested
                  </Text>
                )}
                <View style={styles.inputFieldContainer}>
                  <TextInput
                    key={`${exercise.exercise_id}-${exercise.id}-${setIndex}-reps-${exercise.reps_range}-${exerciseCustomized[exercise.id] ? 'customized' : 'default'}-${textInputRefreshKey}`}
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
            
            {/* Last values row for inactive cards - only show for incomplete sets */}
            {!set.isCompleted && (lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight || 
              lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps) && (
              <View style={styles.lastValuesRowInactive}>
                {/* Only show weight last value if exercise requires weight */}
                {exercise?.requires_weight !== false && (
                  <View style={styles.lastValueContainerInactive}>
                    {lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.weight && (
                      <Text style={styles.activeSetSubValue}>
                        ( Last {lastExerciseValues[exercise.exercise_id][setIndex + 1]?.weight} )
                      </Text>
                    )}
                  </View>
                )}
                
                {exercise?.requires_weight !== false && (
                  <View style={styles.lastValueSpacer} />
                )}
                
                <View style={styles.lastValueContainerInactive}>
                  {lastExerciseValues[exercise.exercise_id]?.[setIndex + 1]?.reps && (
                    <Text style={styles.activeSetSubValue}>
                      ( Last {lastExerciseValues[exercise.exercise_id][setIndex + 1]?.reps} )
                    </Text>
                  )}
                </View>
              </View>
            )}
          </View>
          
          {/* Vertical Divider */}
          <View style={styles.inactiveVerticalDivider} />
          
          {/* Right Cell: Button */}
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
              <Ionicons 
                name={isCompleted ? "reload" : "play"} 
                size={20} 
                color={COLORS.text} 
              />
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
}); 