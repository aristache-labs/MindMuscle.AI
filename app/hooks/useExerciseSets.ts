import { useState, useCallback } from 'react';
import { Alert } from 'react-native';

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
  // Additional callbacks for complex functions
  onCompleteWorkoutWithStateSync?: (volume: number, reps: number, sets: Record<string, ExerciseSet[]>) => void;
  onMoveToNextExercise?: () => void;
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
    // Additional callbacks
    onCompleteWorkoutWithStateSync,
    onMoveToNextExercise,
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

  // Get current exercise and recommendation
  const currentExercise = exercises[currentExerciseIndex];
  const currentRecommendation = currentExercise ? recommendations[currentExercise.id] : null;

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

    // Auto-fill functions need to be defined before handleSetComplete
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
  }, [exercises, exerciseCustomized, userEnteredValues, setExerciseSets]);

  // Complex set management functions
  const handleSetComplete = useCallback((exerciseId: string, setIndex: number) => {
    // Get current weight and reps values from the inputs
    const currentSet = exerciseSets[exerciseId][setIndex];
    
    // Handle weight value - if empty, use placeholder value or fallback
    let weightValue = currentSet.weight;
    if (!weightValue || weightValue === '') {
      if (currentExercise?.requires_weight === false) {
        weightValue = "";
      } else {
        // Use recommended weight from database if available, otherwise fall back to suggested value or "0"
        weightValue = currentRecommendation?.recommended_weight?.toString() || 
          getSuggestedValue(currentExercise?.exercise_id || '', setIndex + 1, 'weight') || "0";
        
      }
    }
    
    // Handle reps value - if empty, use placeholder value or fallback
    let repsValue = currentSet.reps;
    if (!repsValue || repsValue === '') {
      // Priority: 1. Recommended reps from database, 2. Last workout values (if not customized), 3. Exercise reps range (if customized)
      const recommendedReps = currentRecommendation?.recommended_reps?.toString();
      const lastReps = lastExerciseValues[currentExercise?.exercise_id || '']?.[setIndex + 1]?.reps;
      const exerciseRepsRange = currentExercise?.reps_range;
      const isCustomized = exerciseCustomized[currentExercise?.id || ''];
      
      // If exercise was customized, prioritize the reps_range over last values
      repsValue = recommendedReps || 
        (isCustomized ? exerciseRepsRange : lastReps) || 
        (isCustomized ? lastReps : exerciseRepsRange) || "1";
    }
    
    // Store the original reps value for auto-fill logic (before conversion)
    const originalRepsValue = repsValue;
    
    // For CALCULATION purposes, convert ranges to highest value
    let calculationRepsValue = repsValue;
    if (repsValue && typeof repsValue === 'string' && repsValue.includes('-')) {
      const rangeParts = repsValue.split('-');
      const highestReps = parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 1;
      calculationRepsValue = highestReps.toString();
    }
    
    // FORCE ALL VALUES TO BE STRINGS for TextInput compatibility
    weightValue = String(weightValue);
    
    // For COMPLETED sets, always show the calculated value (what was actually counted)
    // For auto-fill, use the original format to preserve user intent
    const finalDisplayReps = String(calculationRepsValue); // Show calculated value in completed set
    const finalCalculationReps = String(calculationRepsValue);

    // ATOMIC UPDATE: Calculate all state changes before applying any
    const newExerciseSets = { ...exerciseSets };
    
    // Update the specific set with the processed reps value - ENSURE VALUES ARE ACTUALLY STORED
    newExerciseSets[exerciseId] = newExerciseSets[exerciseId].map((set, index) => 
      index === setIndex 
        ? { 
            ...set, 
            weight: weightValue,        // This now contains the resolved value (not empty)
            reps: finalDisplayReps,     // This preserves the original format for display
            isCompleted: true 
          }
        : set
    );
    
    // IMMEDIATELY update the exerciseSets state to show the actual values in the UI
    setExerciseSets(newExerciseSets);

    // Calculate totals based on the new state
    let newTotalVolume = totalVolume;
    let newTotalReps = totalReps;
    
    const parsedWeight = parseFloat(weightValue) || 0;
    const parsedReps = parseInt(finalCalculationReps) || 0; // Use calculation value for totals
    const setVolume = parsedWeight * parsedReps;
    
    newTotalVolume += setVolume;
    newTotalReps += parsedReps;

    // Check if all exercises will be completed after this update
    const allExercisesCompleted = exercises.every(exercise => {
      const exerciseSetsList = newExerciseSets[exercise.id];
      return exerciseSetsList && exerciseSetsList.every(set => set.isCompleted);
    });

    // ATOMIC STATE APPLICATION: Apply remaining state changes
    setTotalVolume(newTotalVolume);
    setTotalReps(newTotalReps);

    // Check completion with the new state
    if (allExercisesCompleted) {
      // Complete workout with the already calculated values
      setTimeout(() => {
        onCompleteWorkoutWithStateSync?.(newTotalVolume, newTotalReps, newExerciseSets);
      }, 100);
      return;
    }

    // Check if current exercise is fully completed to move to next exercise
    const currentExerciseCompleted = newExerciseSets[exerciseId].every(set => set.isCompleted);
    
    if (currentExerciseCompleted) {
      // Check if this is the last exercise
      if (currentExerciseIndex === exercises.length - 1) {
        // This case should be handled by allExercisesCompleted above, but just in case
        setTimeout(() => {
          onCompleteWorkoutWithStateSync?.(newTotalVolume, newTotalReps, newExerciseSets);
        }, 100);
      } else {
        // Move to next exercise with a delay to allow state to settle
        setTimeout(() => {
          onMoveToNextExercise?.();
        }, 500);
      }
      return;
    }

    // Auto-fill next incomplete set in current exercise
    // Use original reps value for auto-fill (preserves ranges)
    const nextIncompleteSetIndex = newExerciseSets[exerciseId].findIndex(set => !set.isCompleted);
    if (nextIncompleteSetIndex !== -1) {
      autoFillNextIncompleteSetWithValues(exerciseId, setIndex, weightValue, originalRepsValue);
    }

    // Start rest timer if applicable
    if (currentExercise && currentExercise.restTime && currentExercise.restTime > 0) {
      onStartRestTimer?.(currentExercise.restTime);
    }
  }, [
    exerciseSets, 
    currentExercise, 
    currentRecommendation, 
    getSuggestedValue, 
    lastExerciseValues, 
    exerciseCustomized, 
    setExerciseSets, 
    totalVolume, 
    totalReps, 
    setTotalVolume, 
    setTotalReps, 
    exercises, 
    currentExerciseIndex, 
    onCompleteWorkoutWithStateSync, 
    onMoveToNextExercise, 
    autoFillNextIncompleteSetWithValues, 
    onStartRestTimer
  ]);

  const handleRedoSet = useCallback((exerciseId: string, setIndex: number) => {
    // Mark the set as not completed and update volume/reps totals
    setExerciseSets(prev => {
      const updatedSets = [...prev[exerciseId]];
      const currentSet = updatedSets[setIndex];
      
      // Get the current exercise to check if it requires weight
      const currentExercise = exercises.find(ex => ex.id === exerciseId);
      const requiresWeight = currentExercise?.requires_weight !== false; // Default to true if not specified
      
      // If the set was completed, subtract its EXACT volume and reps from totals
      if (currentSet.isCompleted) {
        // Use the exact values that are currently stored in the set (these are what were used when it was completed)
        const weight = requiresWeight ? (currentSet.weight === '-' || currentSet.weight === '' ? 0 : parseFloat(currentSet.weight)) : 0;
        const reps = currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);
        
        const setVolume = requiresWeight ? parseFloat((weight * reps).toFixed(1)) : 0;
        
        if (requiresWeight) {
          setTotalVolume(prev => Math.max(0, parseFloat((prev - setVolume).toFixed(1))));
        }
        setTotalReps(prev => Math.max(0, prev - reps));
      }
      
      updatedSets[setIndex] = {
        ...currentSet,
        isCompleted: false
        // Keep both weight and reps values - don't clear them on redo
      };
      
      return { ...prev, [exerciseId]: updatedSets };
    });
    
    // Reset user-entered flags for this set when redoing (AFTER calculating subtraction)
    const weightInputKey = `${exerciseId}-${setIndex}-weight`;
    const repsInputKey = `${exerciseId}-${setIndex}-reps`;
    setUserEnteredValues(prev => {
      const updated = { ...prev };
      delete updated[weightInputKey];
      delete updated[repsInputKey];
      return updated;
    });
  }, [exercises, setExerciseSets, setTotalVolume, setTotalReps, setUserEnteredValues]);

  const handleLogAllSets = useCallback((exerciseId: string) => {
    // Get the current sets for this exercise
    const sets = exerciseSets[exerciseId];
    if (!sets || sets.length === 0) return;
    
    // Get the current exercise to check if it requires weight
    const currentExercise = exercises.find(ex => ex.id === exerciseId);
    const requiresWeight = currentExercise?.requires_weight !== false; // Default to true if not specified
    
    // Find all incomplete sets
    const incompleteSets = sets.filter(set => !set.isCompleted);
    
    if (incompleteSets.length === 0) {
      // All sets are already completed
      Alert.alert(
        'Sets Completed',
        'All sets for this exercise are already logged.',
        [{ text: 'OK' }]
      );
      // Move to next exercise since all sets are already completed
      onMoveToNextExercise?.();
      return;
    }
    
    // Calculate total volume and reps that will be added
    let totalVolumeToAdd = 0;
    let totalRepsToAdd = 0;
    
    // Prepare the updated sets with resolved values
    const updatedSetsData = sets.map((set, index) => {
      if (set.isCompleted) {
        return set; // Keep completed sets as they are
      }
      
      // Resolve weight value
      let weightValue = set.weight;
      if (requiresWeight && (weightValue === '' || weightValue === '-')) {
        // Use recommended weight from database if available, otherwise fall back to suggested value or "0"
        weightValue = currentRecommendation?.recommended_weight?.toString() || 
          getSuggestedValue(currentExercise?.exercise_id || '', index + 1, 'weight') || "0";
      }
      
      // Resolve reps value
      let repsValue = set.reps;
      const repsContainsRange = repsValue && typeof repsValue === 'string' && repsValue.includes('-');
      
      if (repsValue === '' || repsValue === '-' || repsContainsRange) {
        if (repsContainsRange) {
          // If it's a range, use the highest value from that range
          const rangeParts = repsValue.split('-');
          repsValue = (parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 0).toString();
        } else {
          // Priority: 1. Recommended reps from database, 2. Last workout values (if not customized), 3. Exercise reps range (if customized)
          const recommendedReps = currentRecommendation?.recommended_reps?.toString();
          const lastReps = lastExerciseValues[currentExercise?.exercise_id || '']?.[index + 1]?.reps;
          const exerciseRepsRange = currentExercise?.reps_range;
          const isCustomized = exerciseCustomized[currentExercise?.id || ''];
          
          // If exercise was customized, prioritize the reps_range over last values
          repsValue = recommendedReps || 
            (isCustomized ? exerciseRepsRange : lastReps) || 
            (isCustomized ? lastReps : exerciseRepsRange) || "1";
          
          // If it's still a range after getting the value, extract the highest number
          if (repsValue && typeof repsValue === 'string' && repsValue.includes('-')) {
            const rangeParts = repsValue.split('-');
            repsValue = (parseInt(rangeParts[1]) || parseInt(rangeParts[0]) || 1).toString();
          }
        }
      }
      
      // Calculate volume and reps for this set
      const weight = requiresWeight ? (parseFloat(weightValue) || 0) : 0;
      const reps = parseInt(repsValue) || 0;
      const setVolume = requiresWeight ? parseFloat((weight * reps).toFixed(1)) : 0;
      
      // Add to totals
      if (requiresWeight) {
        totalVolumeToAdd += setVolume;
      }
      totalRepsToAdd += reps;
      
      return {
        ...set,
        weight: weightValue,
        reps: repsValue,
        isCompleted: true
      };
    });
    
    // Update all sets at once and update totals atomically
    setExerciseSets(prev => ({
      ...prev,
      [exerciseId]: updatedSetsData
    }));
    
    // Update totals atomically
    if (requiresWeight) {
      setTotalVolume(prev => parseFloat((prev + totalVolumeToAdd).toFixed(1)));
    }
    setTotalReps(prev => prev + totalRepsToAdd);
    
    // Start rest timer
    if (currentExercise && currentExercise.restTime) {
      onStartRestTimer?.(currentExercise.restTime);
    } else {
      onStartRestTimer?.(60);
    }
    
    // Check if this was the last exercise
    if (currentExerciseIndex === exercises.length - 1) {
      // Check if all exercises have all their sets completed after this update
      const allExercisesCompleted = exercises.every(ex => {
        // For the current exercise, we know all sets are now completed
        if (ex.id === exerciseId) return true;
        
        // For other exercises, check their sets
        const exSets = exerciseSets[ex.id] || [];
        return exSets.length > 0 && exSets.every(s => s.isCompleted);
      });
      
      if (allExercisesCompleted) {
        // All exercises are completed, save workout data immediately with calculated values
        // Calculate final totals including the sets we just completed
        const finalVolume = totalVolume + totalVolumeToAdd;
        const finalReps = totalReps + totalRepsToAdd;
        
        // Create the final exercise sets state including our updates
        const finalExerciseSets = {
          ...exerciseSets,
          [exerciseId]: updatedSetsData
        };
        
        // Use the state sync version to ensure data is saved properly
        setTimeout(() => {
          onCompleteWorkoutWithStateSync?.(finalVolume, finalReps, finalExerciseSets);
        }, 100);
      } else {
        // Not all exercises are completed, just move to next exercise
        setTimeout(() => {
          onMoveToNextExercise?.();
        }, 100);
      }
    } else {
      // Not the last exercise, just move to next
      setTimeout(() => {
        onMoveToNextExercise?.();
      }, 100);
    }
  }, [
    exerciseSets,
    exercises,
    currentRecommendation,
    getSuggestedValue,
    lastExerciseValues,
    exerciseCustomized,
    setExerciseSets,
    setTotalVolume,
    setTotalReps,
    onStartRestTimer,
    currentExerciseIndex,
    totalVolume,
    totalReps,
    onCompleteWorkoutWithStateSync,
    onMoveToNextExercise
  ]);

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

  // Auto-fill functions for legacy support
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
  }, [exercises, exerciseCustomized, userEnteredValues, setExerciseSets]);

  const autoFillNextSet = useCallback((exerciseId: string, currentSetIndex: number) => {
    // Only auto-fill if there's a next set
    if (exerciseSets[exerciseId] && exerciseSets[exerciseId][currentSetIndex + 1]) {
      const currentSet = exerciseSets[exerciseId][currentSetIndex];
      autoFillNextSetWithValues(exerciseId, currentSetIndex, currentSet.weight, currentSet.reps);
    }
  }, [exerciseSets, autoFillNextSetWithValues]);

  const handleCustomizeExerciseSave = useCallback((exerciseId: string, updatedExercise: { sets: number; reps_range: string }) => {
    // This function is intended to be used when the hook is connected to exercise management state
    // For now, it just logs the action since exercise customization needs to be handled at the parent component level
    // The parent component should handle updating the exercises array and related state
    console.log('Exercise customization requested:', exerciseId, updatedExercise);
    
    // Mark this exercise as customized
    setExerciseCustomized(prev => ({
      ...prev,
      [exerciseId]: true
    }));
    
    // Clear user-entered flags for all reps inputs of this exercise because customization is the latest user action
    setUserEnteredValues(prev => {
      const updated = { ...prev };
      const currentSets = exerciseSets[exerciseId] || [];
      
      currentSets.forEach((set, index) => {
        const repsInputKey = `${exerciseId}-${index}-reps`;
        if (updated[repsInputKey]) {
          delete updated[repsInputKey];
        }
      });
      
      return updated;
    });
    
    // Update exercise sets to match the new number of sets and update only incomplete sets
    setExerciseSets(prev => {
      const currentSets = prev[exerciseId] || [];
      const newSetsCount = updatedExercise.sets;
      
      let updatedSets = [...currentSets];
      
      // Only update incomplete sets with the new range - leave completed sets unchanged
      updatedSets = updatedSets.map((set, index) => {
        if (!set.isCompleted) {
          // Set reps to the new range for incomplete sets only
          return {
            ...set,
            reps: updatedExercise.reps_range // Use the new reps range as the value
          };
        }
        // Keep completed sets exactly as they are
        return set;
      });
      
      if (currentSets.length < newSetsCount) {
        // Add new sets with the customized reps range
        for (let i = currentSets.length; i < newSetsCount; i++) {
          updatedSets.push({
            id: `${exerciseId}-set-${i + 1}`,
            setNumber: i + 1,
            weight: '',
            reps: updatedExercise.reps_range, // Use the new reps range for new sets
            isCompleted: false
          });
        }
      } else if (currentSets.length > newSetsCount) {
        // Remove excess sets and update totals
        const setsToRemove = updatedSets.slice(newSetsCount);
        
        setsToRemove.forEach((set, idx) => {
          if (set.isCompleted) {
            // Get the current exercise to check if it requires weight
            const currentExercise = exercises.find(ex => ex.id === exerciseId);
            const weight = currentExercise?.requires_weight !== false ? 
              (set.weight === '-' || set.weight === '' ? 0 : parseFloat(set.weight)) : 0;
            const reps = set.reps === '-' || set.reps === '' ? 0 : parseFloat(set.reps);
            const setVolume = currentExercise?.requires_weight !== false ? 
              parseFloat((weight * reps).toFixed(1)) : 0;
            
            if (currentExercise?.requires_weight !== false) {
              setTotalVolume(prev => Math.max(0, parseFloat((prev - setVolume).toFixed(1))));
            }
            setTotalReps(prev => Math.max(0, prev - reps));
          }
        });
        
        updatedSets = updatedSets.slice(0, newSetsCount);
      }
      
      return {
        ...prev,
        [exerciseId]: updatedSets
      };
    });
    
    // Force TextInput re-render by updating refresh key
    setTextInputRefreshKey(prev => prev + 1);
  }, [exerciseSets, exercises, setExerciseCustomized, setUserEnteredValues, setExerciseSets, setTotalVolume, setTotalReps, setTextInputRefreshKey]);

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