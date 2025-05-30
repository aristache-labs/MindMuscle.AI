import type { ExerciseData, ExerciseSet } from '../types';
import type { RecommendationData } from '../hooks/useExerciseSets';

export interface ResolveRepsParams {
  currentSet: ExerciseSet;
  setIndex: number;
  currentRecommendation?: RecommendationData | null;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  currentExercise?: ExerciseData;
  exerciseCustomized: Record<string, boolean>;
}

export interface ResolveWeightParams {
  currentSet: ExerciseSet;
  currentRecommendation?: RecommendationData | null;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  currentExercise?: ExerciseData;
  setIndex: number;
}

export interface CompletionCheckParams {
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  exerciseId: string;
  currentExerciseIndex: number;
}

export interface SetValuesForLogAllParams {
  set: ExerciseSet;
  index: number;
  requiresWeight: boolean;
  currentRecommendation?: RecommendationData | null;
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  currentExercise?: ExerciseData;
  exerciseCustomized: Record<string, boolean>;
}

export interface AutoFillValidationParams {
  exerciseId: string;
  currentSetIndex: number;
  weightValue: string;
  repsValue: string;
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
}

export interface CustomizationHelpers {
  clearUserEnteredFlags: (
    userEnteredValues: Record<string, boolean>,
    exerciseId: string,
    exerciseSets: Record<string, ExerciseSet[]>,
  ) => Record<string, boolean>;
  calculateVolumeFromSet: (
    set: ExerciseSet,
    currentExercise?: ExerciseData,
  ) => { volume: number; reps: number };
  updateSetsForCustomization: (
    currentSets: ExerciseSet[],
    newSetsCount: number,
    repsRange: string,
    exerciseId: string,
  ) => ExerciseSet[];
}

/**
 * Determines the fallback reps value when current set has no reps
 */
const determineFallbackReps = (params: {
  currentRecommendation?: RecommendationData | null;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  currentExercise?: ExerciseData;
  exerciseCustomized: Record<string, boolean>;
  setIndex: number;
}): string => {
  const {
    currentRecommendation,
    lastExerciseValues,
    currentExercise,
    exerciseCustomized,
    setIndex,
  } = params;

  const recommendedReps = currentRecommendation?.recommended_reps?.toString();
  if (recommendedReps) {
    return recommendedReps;
  }

  const lastReps = lastExerciseValues[currentExercise?.exercise_id || '']?.[setIndex + 1]?.reps;
  const exerciseRepsRange = currentExercise?.reps_range;
  const isCustomized = exerciseCustomized[currentExercise?.id || ''];

  if (!isCustomized && lastReps && lastReps !== '-' && lastReps !== '0') {
    return lastReps;
  }

  if (exerciseRepsRange) {
    return exerciseRepsRange;
  }

  return '1'; // Final fallback
};

/**
 * Converts reps range to calculation value (highest number in range)
 */
const convertRepsToCalculationValue = (reps: string): string => {
  if (reps && typeof reps === 'string' && reps.includes('-')) {
    const rangeParts = reps.split('-');
    const highestReps = parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 1;
    return highestReps.toString();
  }
  return reps;
};

/**
 * Resolves reps value for a set, handling ranges and fallbacks
 */
export const resolveRepsValues = (
  params: ResolveRepsParams,
): { original: string; calculation: string } => {
  const {
    currentSet,
    setIndex,
    currentRecommendation,
    lastExerciseValues,
    currentExercise,
    exerciseCustomized,
  } = params;

  let reps = currentSet.reps;

  if (!reps || reps === '') {
    reps = determineFallbackReps({
      currentRecommendation,
      lastExerciseValues,
      currentExercise,
      exerciseCustomized,
      setIndex,
    });
  }

  const originalReps = reps;
  const calculationReps = convertRepsToCalculationValue(reps);

  return { original: originalReps, calculation: String(calculationReps) };
};

/**
 * Resolves weight value for a set with fallbacks
 */
export const resolveWeightValue = (params: ResolveWeightParams): string => {
  const { currentSet, currentRecommendation, getSuggestedValue, currentExercise, setIndex } =
    params;

  let weight = currentSet.weight;

  if (!weight || weight === '' || weight === '-') {
    const recommendedWeight = currentRecommendation?.recommended_weight?.toString();
    const suggestedWeight = getSuggestedValue(
      currentExercise?.exercise_id || '',
      setIndex + 1,
      'weight',
    );

    if (recommendedWeight) {
      weight = recommendedWeight;
    } else if (suggestedWeight) {
      weight = suggestedWeight;
    } else {
      weight = currentExercise?.requires_weight !== false ? '0' : '0';
    }
  }

  return String(weight);
};

/**
 * Checks if workout or exercise is complete and returns completion status
 */
export const checkCompletionStatus = (params: CompletionCheckParams) => {
  const { exercises, exerciseSets, exerciseId, currentExerciseIndex } = params;

  const newExerciseSets = { ...exerciseSets };

  const allExercisesCompleted = exercises.every((exercise) => {
    const exerciseSetsList = newExerciseSets[exercise.id];
    return exerciseSetsList && exerciseSetsList.every((set) => set.isCompleted);
  });

  if (allExercisesCompleted) {
    return { isWorkoutComplete: true, isExerciseComplete: false };
  }

  const currentExerciseCompleted = newExerciseSets[exerciseId].every((set) => set.isCompleted);

  if (currentExerciseCompleted) {
    const isLastExercise = currentExerciseIndex === exercises.length - 1;
    return {
      isWorkoutComplete: isLastExercise,
      isExerciseComplete: true,
    };
  }

  return { isWorkoutComplete: false, isExerciseComplete: false };
};

/**
 * Resolves weight and reps values for a set during log all operation
 */
export const resolveSetValuesForLogAll = (
  params: SetValuesForLogAllParams,
): { weight: string; reps: string } => {
  const {
    set,
    index,
    requiresWeight,
    currentRecommendation,
    getSuggestedValue,
    lastExerciseValues,
    currentExercise,
    exerciseCustomized,
  } = params;

  let weightValue = set.weight;

  if (requiresWeight && (weightValue === '' || weightValue === '-')) {
    weightValue =
      currentRecommendation?.recommended_weight?.toString() ||
      getSuggestedValue(currentExercise?.exercise_id || '', index + 1, 'weight') ||
      '0';
  }

  let repsValue = set.reps;
  const repsContainsRange = repsValue && typeof repsValue === 'string' && repsValue.includes('-');

  if (repsValue === '' || repsValue === '-' || repsContainsRange) {
    if (repsContainsRange) {
      const rangeParts = repsValue.split('-');
      repsValue = (parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 0).toString();
    } else {
      repsValue = resolveRepsValueForLogAll({
        currentRecommendation,
        lastExerciseValues,
        currentExercise,
        exerciseCustomized,
        index,
      });
    }
  }

  return { weight: weightValue, reps: repsValue };
};

/**
 * Helper function to resolve reps value specifically for log all operation
 */
const resolveRepsValueForLogAll = (params: {
  currentRecommendation?: RecommendationData | null;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
  currentExercise?: ExerciseData;
  exerciseCustomized: Record<string, boolean>;
  index: number;
}): string => {
  const { currentRecommendation, lastExerciseValues, currentExercise, exerciseCustomized, index } =
    params;

  const recommendedReps = currentRecommendation?.recommended_reps?.toString();
  const lastReps = lastExerciseValues[currentExercise?.exercise_id || '']?.[index + 1]?.reps;
  const exerciseRepsRange = currentExercise?.reps_range;
  const isCustomized = exerciseCustomized[currentExercise?.id || ''];

  let repsValue =
    recommendedReps ||
    (isCustomized ? exerciseRepsRange : lastReps) ||
    (isCustomized ? lastReps : exerciseRepsRange) ||
    '1';

  if (repsValue && typeof repsValue === 'string' && repsValue.includes('-')) {
    const rangeParts = repsValue.split('-');
    repsValue = (parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 1).toString();
  }

  return repsValue;
};

/**
 * Validates if auto-fill should proceed for the next set
 */
export const validateAutoFillConditions = (params: AutoFillValidationParams): boolean => {
  const { exerciseId, currentSetIndex, weightValue, repsValue, exercises, exerciseSets } = params;

  // Only auto-fill if there's a next set
  if (!exerciseSets[exerciseId] || !exerciseSets[exerciseId][currentSetIndex + 1]) {
    return false;
  }

  const nextSet = exerciseSets[exerciseId][currentSetIndex + 1];
  const currentExercise = exercises.find((ex) => ex.id === exerciseId);

  if (!currentExercise) return false;

  // Don't auto-fill if the next set is already completed
  if (nextSet.isCompleted) {
    return false;
  }

  // Check if current set has valid values
  const hasValidWeight =
    currentExercise.requires_weight !== false && weightValue !== '' && weightValue !== '-';
  const hasValidReps = repsValue !== '' && repsValue !== '-';

  // Auto-fill if current set has values
  return (hasValidWeight || currentExercise.requires_weight === false) && hasValidReps;
};

/**
 * Determines auto-fill values for weight and reps
 */
export const determineAutoFillValues = (params: {
  weightValue: string;
  repsValue: string;
  exerciseId: string;
  currentSetIndex: number;
  exerciseCustomized: Record<string, boolean>;
  userEnteredValues: Record<string, boolean>;
  currentExercise?: ExerciseData;
}): { autoFillWeight: string; autoFillReps: string } => {
  const {
    weightValue,
    repsValue,
    exerciseId,
    currentSetIndex,
    exerciseCustomized,
    userEnteredValues,
    currentExercise,
  } = params;

  const autoFillWeight = weightValue;
  let autoFillReps = repsValue;

  // For customized exercises, only use the range if the current value IS the range and wasn't manually entered
  const isCustomized = exerciseCustomized[exerciseId];
  const currentSetInputKey = `${exerciseId}-${currentSetIndex}-reps`;
  const wasUserEntered = userEnteredValues[currentSetInputKey];

  // Only use customized range if the current value is still the range AND user hasn't manually entered it
  if (
    isCustomized &&
    currentExercise?.reps_range &&
    !wasUserEntered &&
    repsValue === currentExercise.reps_range
  ) {
    autoFillReps = currentExercise.reps_range;
  }

  return { autoFillWeight, autoFillReps };
};

/**
 * Clears user-entered flags for reps inputs of a specific exercise
 */
export const clearUserEnteredFlags = (
  userEnteredValues: Record<string, boolean>,
  exerciseId: string,
  exerciseSets: Record<string, ExerciseSet[]>,
): Record<string, boolean> => {
  const updated = { ...userEnteredValues };
  const currentSets = exerciseSets[exerciseId] || [];

  currentSets.forEach((_set, index) => {
    const repsInputKey = `${exerciseId}-${index}-reps`;
    if (updated[repsInputKey]) {
      delete updated[repsInputKey];
    }
  });

  return updated;
};

/**
 * Calculates volume and reps for a completed set
 */
export const calculateVolumeFromSet = (
  set: ExerciseSet,
  currentExercise?: ExerciseData,
): { volume: number; reps: number } => {
  const weight =
    currentExercise?.requires_weight !== false
      ? set.weight === '-' || set.weight === ''
        ? 0
        : parseFloat(set.weight)
      : 0;
  const reps = set.reps === '-' || set.reps === '' ? 0 : parseFloat(set.reps);
  const volume =
    currentExercise?.requires_weight !== false ? parseFloat((weight * reps).toFixed(1)) : 0;

  return { volume, reps };
};

/**
 * Updates exercise sets for customization (add/remove sets, update reps)
 */
export const updateSetsForCustomization = (
  currentSets: ExerciseSet[],
  newSetsCount: number,
  repsRange: string,
  exerciseId: string,
): ExerciseSet[] => {
  let updatedSets = [...currentSets];

  // Only update incomplete sets with the new range - leave completed sets unchanged
  updatedSets = updatedSets.map((set, _index) => {
    if (!set.isCompleted) {
      return {
        ...set,
        reps: repsRange,
      };
    }
    return set;
  });

  if (currentSets.length < newSetsCount) {
    // Add new sets with the customized reps range
    for (let i = currentSets.length; i < newSetsCount; i++) {
      updatedSets.push({
        id: `${exerciseId}-set-${i + 1}`,
        setNumber: i + 1,
        weight: '',
        reps: repsRange,
        isCompleted: false,
      });
    }
  } else if (currentSets.length > newSetsCount) {
    // Remove excess sets (handled by caller for volume calculations)
    updatedSets = updatedSets.slice(0, newSetsCount);
  }

  return updatedSets;
};

/**
 * Validates and processes reps input value
 */
export const processRepsInput = (value: string): string => {
  let processedValue = value;

  // Remove any decimal characters (. and ,) since reps must be whole numbers
  processedValue = processedValue.replace(/[.,]/g, '');

  // Keep '-' as is for ranges, but remove leading zeros from numbers
  if (processedValue !== '-' && processedValue !== '') {
    processedValue = processedValue.replace(/^0+(?=\d)/, '');
  }

  // Handle single numbers (limit to 999)
  if (processedValue !== '-' && processedValue !== '' && !processedValue.includes('-')) {
    const numValue = parseInt(processedValue);
    if (!isNaN(numValue) && numValue > 999) {
      return '999';
    }
  }

  // Handle ranges (like "1-99")
  if (processedValue.includes('-') && processedValue !== '-') {
    return processRepsRange(processedValue);
  }

  return processedValue;
};

/**
 * Processes reps range input (e.g., "8-12")
 */
export const processRepsRange = (value: string): string => {
  const parts = value.split('-');
  if (parts.length === 2) {
    const firstNum = parseInt(parts[0]);
    const secondNum = parseInt(parts[1]);

    // Limit each part of the range to 99
    const limitedFirst = !isNaN(firstNum) && firstNum > 99 ? 99 : firstNum;
    const limitedSecond = !isNaN(secondNum) && secondNum > 99 ? 99 : secondNum;

    // Reconstruct the range if both parts are valid numbers
    if (!isNaN(limitedFirst) && !isNaN(limitedSecond)) {
      return `${limitedFirst}-${limitedSecond}`;
    }
  }
  return value;
};
