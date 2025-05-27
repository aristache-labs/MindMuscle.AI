import { useState, useCallback } from 'react';

// Types (matching the main component)
export interface ExerciseData {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  restTime?: number;
  order: number;
  workout_day: number;
  requires_weight?: boolean;
}

export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

export interface UseExerciseSetsParams {
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  recommendations: Record<string, any>;
  lastExerciseValues: Record<string, Record<number, { weight: string, reps: string }>>;
  totalVolume: number;
  totalReps: number;
  setTotalVolume: (value: number | ((prev: number) => number)) => void;
  setTotalReps: (value: number | ((prev: number) => number)) => void;
  onWorkoutComplete?: (volume: number, reps: number, sets: Record<string, ExerciseSet[]>) => void;
  onExerciseComplete?: () => void;
  onStartRestTimer?: (seconds: number) => void;
  // External state from main component for testing integration
  exerciseSets?: Record<string, ExerciseSet[]>;
  setExerciseSets?: React.Dispatch<React.SetStateAction<Record<string, ExerciseSet[]>>>;
  userEnteredValues?: Record<string, boolean>;
  setUserEnteredValues?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  exerciseCustomized?: Record<string, boolean>;
  setExerciseCustomized?: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export interface UseExerciseSetsReturn {
  // State
  exerciseSets: Record<string, ExerciseSet[]>;
  userEnteredValues: Record<string, boolean>;
  exerciseCustomized: Record<string, boolean>;
  textInputRefreshKey: number;
  
  // Set management
  handleSetComplete: (exerciseId: string, setIndex: number) => void;
  handleRedoSet: (exerciseId: string, setIndex: number) => void;
  handleLogAllSets: (exerciseId: string) => void;
  
  // Input handling
  handleWeightChange: (exerciseId: string, setIndex: number, value: string) => void;
  handleRepsChange: (exerciseId: string, setIndex: number, value: string) => void;
  
  // Auto-fill logic
  autoFillNextIncompleteSetWithValues: (exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => void;
  autoFillNextSetWithValues: (exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => void;
  autoFillNextSet: (exerciseId: string, currentSetIndex: number) => void;
  
  // Utility functions
  getSuggestedValue: (exerciseId: string, setNumber: number, type: 'weight' | 'reps') => string | null;
  getHighestRepsFromRange: (repsRange: string) => number;
  
  // Exercise customization
  handleCustomizeExerciseSave: (exerciseId: string, updatedExercise: { sets: number; reps_range: string }) => void;
  
  // State management
  setExerciseSets: React.Dispatch<React.SetStateAction<Record<string, ExerciseSet[]>>>;
  setUserEnteredValues: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExerciseCustomized: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setTextInputRefreshKey: React.Dispatch<React.SetStateAction<number>>;
}

export const useExerciseSets = (params: UseExerciseSetsParams): UseExerciseSetsReturn => {
  const {
    exercises,
    currentExerciseIndex,
    recommendations,
    lastExerciseValues,
    totalVolume,
    totalReps,
    setTotalVolume,
    setTotalReps,
    onWorkoutComplete,
    onExerciseComplete,
    onStartRestTimer,
    // External state for testing integration
    exerciseSets: externalExerciseSets,
    setExerciseSets: externalSetExerciseSets,
    userEnteredValues: externalUserEnteredValues,
    setUserEnteredValues: externalSetUserEnteredValues,
    exerciseCustomized: externalExerciseCustomized,
    setExerciseCustomized: externalSetExerciseCustomized,
  } = params;

  // Use external state if provided, otherwise use internal state
  const [internalExerciseSets, setInternalExerciseSets] = useState<Record<string, ExerciseSet[]>>({});
  const [internalUserEnteredValues, setInternalUserEnteredValues] = useState<Record<string, boolean>>({});
  const [internalExerciseCustomized, setInternalExerciseCustomized] = useState<Record<string, boolean>>({});
  const [textInputRefreshKey, setTextInputRefreshKey] = useState(0);

  // Use external state if provided for testing, otherwise use internal state
  const exerciseSets = externalExerciseSets || internalExerciseSets;
  const setExerciseSets = externalSetExerciseSets || setInternalExerciseSets;
  const userEnteredValues = externalUserEnteredValues || internalUserEnteredValues;
  const setUserEnteredValues = externalSetUserEnteredValues || setInternalUserEnteredValues;
  const exerciseCustomized = externalExerciseCustomized || internalExerciseCustomized;
  const setExerciseCustomized = externalSetExerciseCustomized || setInternalExerciseCustomized;

  // Get current exercise
  const currentExercise = exercises[currentExerciseIndex];

  // Utility function to get the highest value from a reps range
  const getHighestRepsFromRange = useCallback((repsRange: string): number => {
    if (repsRange.includes('-')) {
      // Range format like "12-15"
      const rangeParts = repsRange.split('-');
      return parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 0;
    } else {
      // Single value format like "12"
      return parseInt(repsRange) || 0;
    }
  }, []);

  // Function to get suggested values for a specific exercise and set
  const getSuggestedValue = useCallback((exerciseId: string, setNumber: number, type: 'weight' | 'reps'): string | null => {
    // Find the exercise by exerciseId to get the recommendation
    const exercise = exercises.find(ex => ex.exercise_id === exerciseId);
    if (!exercise) return null;
    
    const recommendation = recommendations[exercise.id];
    if (!recommendation) return null;
    
    // Return the recommended value based on type
    if (type === 'weight' && recommendation.recommended_weight) {
      return recommendation.recommended_weight.toString();
    }
    if (type === 'reps' && recommendation.recommended_reps) {
      return recommendation.recommended_reps.toString();
    }
    
    return null;
  }, [exercises, recommendations]);

  // This is where we'll add all the complex logic functions
  // For now, let's create placeholder functions that will be implemented
  
  const handleSetComplete = useCallback((exerciseId: string, setIndex: number) => {
    // TODO: Implement the complex set completion logic
    console.log('handleSetComplete called', exerciseId, setIndex);
  }, []);

  const handleRedoSet = useCallback((exerciseId: string, setIndex: number) => {
    // TODO: Implement the redo logic
    console.log('handleRedoSet called', exerciseId, setIndex);
  }, []);

  const handleLogAllSets = useCallback((exerciseId: string) => {
    // TODO: Implement the log all sets logic
    console.log('handleLogAllSets called', exerciseId);
  }, []);

  const handleWeightChange = useCallback((exerciseId: string, setIndex: number, value: string) => {
    // Validate and transform the input value
    // Allow decimal input with either dot or comma as separator
    let processedValue = value;
    
    // Replace comma with dot for decimal values
    if (value.includes(',')) {
      processedValue = value.replace(',', '.');
    }
    
    // Keep '-' as is but remove leading zeros
    if (processedValue !== '-') {
      // Handle decimal values correctly
      if (processedValue.includes('.')) {
        const [wholePart, decimalPart] = processedValue.split('.');
        
        // Limit whole part to 999 maximum
        let limitedWholePart = wholePart.replace(/^0+(?=\d)/, '');
        if (limitedWholePart !== '' && parseInt(limitedWholePart, 10) > 999) {
          limitedWholePart = '999';
        }
        
        // Limit decimal part to 1 digit
        const limitedDecimalPart = decimalPart.length > 0 ? decimalPart.substring(0, 1) : '';
        processedValue = `${limitedWholePart}.${limitedDecimalPart}`;
      } else {
        // For non-decimal values, limit to 999 maximum
        let limitedValue = processedValue.replace(/^0+(?=\d)/, '');
        if (limitedValue !== '' && parseInt(limitedValue, 10) > 999) {
          limitedValue = '999';
        }
        processedValue = limitedValue;
      }
    }
    
    // Mark this input as user-entered
    const inputKey = `${exerciseId}-${setIndex}-weight`;
    setUserEnteredValues(prev => ({
      ...prev,
      [inputKey]: true
    }));
    
    setExerciseSets(prev => {
      const updatedSets = { ...prev };
      if (updatedSets[exerciseId]) {
        updatedSets[exerciseId][setIndex].weight = processedValue;
      }
      return updatedSets;
    });
  }, []);

  const handleRepsChange = useCallback((exerciseId: string, setIndex: number, value: string) => {
    // Validate and transform the input value for reps (whole numbers only)
    let processedValue = value;
    
    // Remove any decimal characters (. and ,) since reps must be whole numbers
    processedValue = processedValue.replace(/[.,]/g, '');
    
    // Keep '-' as is for ranges, but remove leading zeros from numbers
    if (processedValue !== '-' && processedValue !== '') {
      // Remove leading zeros but preserve the value
      processedValue = processedValue.replace(/^0+(?=\d)/, '');
    }
    
    // Limit reps to a maximum of 999
    if (processedValue !== '-' && processedValue !== '' && !processedValue.includes('-')) {
      const numValue = parseInt(processedValue, 10);
      if (!isNaN(numValue) && numValue > 999) {
        processedValue = '999';
      }
    }
    
    // For ranges (like "1-99"), validate each part separately
    if (processedValue.includes('-') && processedValue !== '-') {
      const parts = processedValue.split('-');
      if (parts.length === 2) {
        const firstNum = parseInt(parts[0], 10);
        const secondNum = parseInt(parts[1], 10);
        
        // Limit each part of the range to 99
        const limitedFirst = !isNaN(firstNum) && firstNum > 99 ? 99 : firstNum;
        const limitedSecond = !isNaN(secondNum) && secondNum > 99 ? 99 : secondNum;
        
        // Reconstruct the range if both parts are valid numbers
        if (!isNaN(limitedFirst) && !isNaN(limitedSecond)) {
          processedValue = `${limitedFirst}-${limitedSecond}`;
        }
      }
    }
    
    // Mark this input as user-entered
    const inputKey = `${exerciseId}-${setIndex}-reps`;
    setUserEnteredValues(prev => ({
      ...prev,
      [inputKey]: true
    }));
    
    setExerciseSets(prev => {
      const updatedSets = { ...prev };
      if (updatedSets[exerciseId]) {
        updatedSets[exerciseId][setIndex].reps = processedValue;
      }
      return updatedSets;
    });
  }, []);

  const autoFillNextIncompleteSetWithValues = useCallback((exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => {
    setExerciseSets(prev => {
      const currentSets = prev[exerciseId];
      if (!currentSets) return prev;
      
      // Find the next incomplete set (not just the immediate next set)
      const nextIncompleteSetIndex = currentSets.findIndex((set, index) => 
        index > currentSetIndex && !set.isCompleted
      );
      
      // If no incomplete set found, try to find ANY incomplete set (for redo scenarios)
      const anyIncompleteSetIndex = nextIncompleteSetIndex !== -1 ? 
        nextIncompleteSetIndex : 
        currentSets.findIndex(set => !set.isCompleted);
      
      if (anyIncompleteSetIndex === -1) {
        return prev;
      }
      
      const currentExercise = exercises.find(ex => ex.id === exerciseId);
      if (!currentExercise) return prev;
      
      // Check if current set has valid values
      const hasValidWeight = currentExercise.requires_weight !== false && weightValue !== '' && weightValue !== '-';
      const hasValidReps = repsValue !== '' && repsValue !== '-';
      
      // Auto-fill if current set has values
      if ((hasValidWeight || currentExercise.requires_weight === false) && hasValidReps) {
        const updatedSets = { ...prev };
        updatedSets[exerciseId] = [...updatedSets[exerciseId]];
        
        // Determine what value to use for auto-fill
        let autoFillWeight = weightValue;
        let autoFillReps = repsValue;
        
        // For customized exercises, only use the range if the current value IS the range and wasn't manually entered
        const isCustomized = exerciseCustomized[exerciseId];
        const currentSetInputKey = `${exerciseId}-${currentSetIndex}-reps`;
        const wasUserEntered = userEnteredValues[currentSetInputKey];
        
        // Only use customized range if the current value is still the range AND user hasn't manually entered it
        if (isCustomized && currentExercise.reps_range && !wasUserEntered && repsValue === currentExercise.reps_range) {
          autoFillReps = currentExercise.reps_range;
        }
        // Otherwise, always use the actual current value (prioritize user input)
        
        updatedSets[exerciseId][anyIncompleteSetIndex] = {
          ...updatedSets[exerciseId][anyIncompleteSetIndex],
          weight: hasValidWeight ? autoFillWeight : updatedSets[exerciseId][anyIncompleteSetIndex].weight,
          reps: hasValidReps ? autoFillReps : updatedSets[exerciseId][anyIncompleteSetIndex].reps
        };
        return updatedSets;
      }
      
      return prev;
    });
  }, [exercises, exerciseCustomized, userEnteredValues]);

  const autoFillNextSetWithValues = useCallback((exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => {
    setExerciseSets(prev => {
      // Only auto-fill if there's a next set
      if (!prev[exerciseId] || !prev[exerciseId][currentSetIndex + 1]) {
        return prev;
      }
      
      const nextSet = prev[exerciseId][currentSetIndex + 1];
      const currentExercise = exercises.find(ex => ex.id === exerciseId);
      
      if (!currentExercise) return prev;
      
      // IMPORTANT: Don't auto-fill if the next set is already completed
      if (nextSet.isCompleted) {
        return prev;
      }
      
      // Check if current set has valid values
      const hasValidWeight = currentExercise.requires_weight !== false && weightValue !== '' && weightValue !== '-';
      const hasValidReps = repsValue !== '' && repsValue !== '-';
      
      // Auto-fill if current set has values
      if ((hasValidWeight || currentExercise.requires_weight === false) && hasValidReps) {
        const updatedSets = { ...prev };
        updatedSets[exerciseId] = [...updatedSets[exerciseId]];
        
        // Determine what value to use for auto-fill
        let autoFillWeight = weightValue;
        let autoFillReps = repsValue;
        
        // For customized exercises, only use the range if the current value IS the range and wasn't manually entered
        const isCustomized = exerciseCustomized[exerciseId];
        const currentSetInputKey = `${exerciseId}-${currentSetIndex}-reps`;
        const wasUserEntered = userEnteredValues[currentSetInputKey];
        
        // Only use customized range if the current value is still the range AND user hasn't manually entered it
        if (isCustomized && currentExercise.reps_range && !wasUserEntered && repsValue === currentExercise.reps_range) {
          autoFillReps = currentExercise.reps_range;
        }
        // Otherwise, always use the actual current value (prioritize user input)
        
        updatedSets[exerciseId][currentSetIndex + 1] = {
          ...updatedSets[exerciseId][currentSetIndex + 1],
          weight: hasValidWeight ? autoFillWeight : nextSet.weight,
          reps: hasValidReps ? autoFillReps : nextSet.reps
        };
        return updatedSets;
      }
      
      return prev;
    });
  }, [exercises, exerciseCustomized, userEnteredValues]);

  const autoFillNextSet = useCallback((exerciseId: string, currentSetIndex: number) => {
    // Only auto-fill if there's a next set
    setExerciseSets(prev => {
      if (prev[exerciseId] && prev[exerciseId][currentSetIndex + 1]) {
        const currentSet = prev[exerciseId][currentSetIndex];
        // Use the autoFillNextSetWithValues function
        autoFillNextSetWithValues(exerciseId, currentSetIndex, currentSet.weight, currentSet.reps);
      }
      return prev;
    });
  }, [autoFillNextSetWithValues]);

  const handleCustomizeExerciseSave = useCallback((exerciseId: string, updatedExercise: { sets: number; reps_range: string }) => {
    // TODO: Implement exercise customization logic
    console.log('handleCustomizeExerciseSave called', exerciseId, updatedExercise);
  }, []);

  return {
    // State
    exerciseSets,
    userEnteredValues,
    exerciseCustomized,
    textInputRefreshKey,
    
    // Set management
    handleSetComplete,
    handleRedoSet,
    handleLogAllSets,
    
    // Input handling
    handleWeightChange,
    handleRepsChange,
    
    // Auto-fill logic
    autoFillNextIncompleteSetWithValues,
    autoFillNextSetWithValues,
    autoFillNextSet,
    
    // Utility functions
    getSuggestedValue,
    getHighestRepsFromRange,
    
    // Exercise customization
    handleCustomizeExerciseSave,
    
    // State management
    setExerciseSets,
    setUserEnteredValues,
    setExerciseCustomized,
    setTextInputRefreshKey,
  };
}; 