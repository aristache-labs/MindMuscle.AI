import React, { SetStateAction, useCallback, useState } from 'react';
import { Alert } from 'react-native';
import type { ExerciseData, ExerciseSet } from '../types';
import {
  calculateVolumeFromSet,
  checkCompletionStatus,
  clearUserEnteredFlags,
  determineAutoFillValues,
  processRepsInput,
  resolveRepsValues,
  resolveSetValuesForLogAll,
  resolveWeightValue,
  updateSetsForCustomization,
  validateAutoFillConditions,
} from '../utils';

export interface RecommendationData {
  recommended_weight?: number | string; // Can be number or string like "bodyweight"
  recommended_reps?: number | string; // Can be number or string like a range "8-12"
  // Add other potential recommendation fields if known
}

export interface UseExerciseSetsParams {
  exercises: ExerciseData[];
  currentExerciseIndex: number;
  recommendations: Record<string, RecommendationData>;
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>;
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
  onCompleteWorkoutWithStateSync?: (
    volume: number,
    reps: number,
    sets: Record<string, ExerciseSet[]>,
  ) => void;
  onMoveToNextExercise?: () => void;
  textInputRefreshKey: number;
  setTextInputRefreshKey: React.Dispatch<SetStateAction<number>>;
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
  autoFillNextIncompleteSetWithValues: (
    exerciseId: string,
    currentSetIndex: number,
    weightValue: string,
    repsValue: string,
  ) => void;
  autoFillNextSetWithValues: (
    exerciseId: string,
    currentSetIndex: number,
    weightValue: string,
    repsValue: string,
  ) => void;
  autoFillNextSet: (exerciseId: string, currentSetIndex: number) => void;

  // Utility functions
  getSuggestedValue: (
    exerciseId: string,
    setNumber: number,
    type: 'weight' | 'reps',
  ) => string | null;
  getHighestRepsFromRange: (repsRange: string) => number;

  // Exercise customization
  handleCustomizeExerciseSave: (
    exerciseId: string,
    updatedExercise: { sets: number; reps_range: string },
  ) => void;

  // State management
  setExerciseSets: React.Dispatch<React.SetStateAction<Record<string, ExerciseSet[]>>>;
  setUserEnteredValues: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setExerciseCustomized: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setTextInputRefreshKey: React.Dispatch<SetStateAction<number>>;
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
    onWorkoutComplete: _onWorkoutComplete, // eslint-disable-line no-unused-vars
    onExerciseComplete: _onExerciseComplete, // eslint-disable-line no-unused-vars
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
    textInputRefreshKey,
    setTextInputRefreshKey,
  } = params;

  // Use external state if provided, otherwise use internal state
  const [internalExerciseSets, setInternalExerciseSets] = useState<Record<string, ExerciseSet[]>>(
    {},
  );
  const [internalUserEnteredValues, setInternalUserEnteredValues] = useState<
    Record<string, boolean>
  >({});
  const [internalExerciseCustomized, setInternalExerciseCustomized] = useState<
    Record<string, boolean>
  >({});

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
  const getSuggestedValue = useCallback(
    (exerciseId: string, setNumber: number, type: 'weight' | 'reps'): string | null => {
      // Find the exercise by exerciseId to get the recommendation
      const exercise = exercises.find((ex) => ex.exercise_id === exerciseId);
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
    },
    [exercises, recommendations],
  );

  // Auto-fill functions need to be defined before handleSetComplete
  const autoFillNextIncompleteSetWithValues = useCallback(
    (exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => {
      setExerciseSets((prev) => {
        const currentSets = prev[exerciseId];
        if (!currentSets) return prev;

        // Helper to find the target set index for auto-filling
        const findTargetAutoFillSetIndex = (): number => {
          const nextIncompleteIdx = currentSets.findIndex(
            (set, index) => index > currentSetIndex && !set.isCompleted,
          );
          return nextIncompleteIdx !== -1
            ? nextIncompleteIdx
            : currentSets.findIndex((set) => !set.isCompleted);
        };

        const targetSetIndex = findTargetAutoFillSetIndex();
        if (targetSetIndex === -1) {
          return prev;
        }

        const currentExercise = exercises.find((ex) => ex.id === exerciseId);
        if (!currentExercise) return prev;

        const hasValidWeight =
          currentExercise.requires_weight !== false && weightValue !== '' && weightValue !== '-';
        const hasValidReps = repsValue !== '' && repsValue !== '-';

        if (!((hasValidWeight || currentExercise.requires_weight === false) && hasValidReps)) {
          return prev;
        }

        // Helper to determine the reps value for auto-filling
        const determineAutoFillReps = (): string => {
          const isCustomized = exerciseCustomized[exerciseId];
          const currentSetInputKey = `${exerciseId}-${currentSetIndex}-reps`;
          const wasUserEntered = userEnteredValues[currentSetInputKey];

          if (
            isCustomized &&
            currentExercise.reps_range &&
            !wasUserEntered &&
            repsValue === currentExercise.reps_range
          ) {
            return currentExercise.reps_range;
          }
          return repsValue;
        };

        const autoFillWeight = weightValue;
        const autoFillReps = determineAutoFillReps();

        const updatedSets = { ...prev };
        updatedSets[exerciseId] = [...updatedSets[exerciseId]];
        updatedSets[exerciseId][targetSetIndex] = {
          ...updatedSets[exerciseId][targetSetIndex],
          weight: hasValidWeight ? autoFillWeight : updatedSets[exerciseId][targetSetIndex].weight,
          reps: hasValidReps ? autoFillReps : updatedSets[exerciseId][targetSetIndex].reps,
        };
        return updatedSets;
      });
    },
    [exercises, exerciseCustomized, userEnteredValues, setExerciseSets],
  );

  // Complex set management functions
  const handleSetComplete = useCallback(
    (exerciseId: string, setIndex: number) => {
      // Get current weight and reps values from the inputs
      const currentSet = exerciseSets[exerciseId][setIndex];

      // Helper to resolve weight value
      const resolveWeightValueHelper = (): string => {
        return resolveWeightValue({
          currentSet,
          currentRecommendation,
          getSuggestedValue,
          currentExercise,
          setIndex,
        });
      };

      const weightValue = resolveWeightValueHelper();

      // Helper to resolve reps value (original and for calculation)
      const resolveRepsValueHelper = (): { original: string; calculation: string } => {
        return resolveRepsValues({
          currentSet,
          setIndex,
          currentRecommendation,
          lastExerciseValues,
          currentExercise,
          exerciseCustomized,
        });
      };

      const { original: originalRepsValue, calculation: finalCalculationReps } =
        resolveRepsValueHelper();
      const finalDisplayReps = String(finalCalculationReps);

      // ATOMIC UPDATE: Calculate all state changes before applying any
      const newExerciseSets = { ...exerciseSets };

      // Update the specific set with the processed reps value - ENSURE VALUES ARE ACTUALLY STORED
      newExerciseSets[exerciseId] = newExerciseSets[exerciseId].map((set, index) =>
        index === setIndex
          ? {
              ...set,
              weight: weightValue, // This now contains the resolved value (not empty)
              reps: finalDisplayReps, // This preserves the original format for display
              isCompleted: true,
            }
          : set,
      );

      // IMMEDIATELY update the exerciseSets state to show the actual values in the UI
      setExerciseSets(newExerciseSets);

      // Helper to update total volume and reps
      const updateTotals = (): { updatedVolume: number; updatedReps: number } => {
        const parsedWeight = parseFloat(weightValue) || 0;
        const parsedReps = parseInt(finalCalculationReps) || 0;
        const requiresWeight = currentExercise?.requires_weight !== false; // Default to true if not specified
        const setVolume = requiresWeight ? parseFloat((parsedWeight * parsedReps).toFixed(1)) : 0;
        const updatedVolume = requiresWeight ? totalVolume + setVolume : totalVolume;
        const updatedReps = totalReps + parsedReps;

        if (requiresWeight) {
          setTotalVolume(updatedVolume);
        }
        setTotalReps(updatedReps);
        return { updatedVolume, updatedReps };
      };

      const { updatedVolume, updatedReps } = updateTotals();

      // Helper to handle exercise/workout completion and navigation
      const handleCompletionAndNavigation = () => {
        const { isWorkoutComplete, isExerciseComplete } = checkCompletionStatus({
          exercises,
          exerciseSets: newExerciseSets,
          exerciseId,
          currentExerciseIndex,
        });

        if (isWorkoutComplete) {
          setTimeout(() => {
            onCompleteWorkoutWithStateSync?.(updatedVolume, updatedReps, newExerciseSets);
          }, 100);
          return true;
        }

        if (isExerciseComplete) {
          if (currentExerciseIndex === exercises.length - 1) {
            setTimeout(() => {
              onCompleteWorkoutWithStateSync?.(updatedVolume, updatedReps, newExerciseSets);
            }, 100);
          } else {
            setTimeout(() => {
              onMoveToNextExercise?.();
            }, 500);
          }
          return true;
        }

        return false;
      };

      if (handleCompletionAndNavigation()) {
        return; // Exit if workout or exercise was completed and navigation handled
      }

      // Auto-fill next incomplete set in current exercise
      const nextIncompleteSetIndex = newExerciseSets[exerciseId].findIndex(
        (set) => !set.isCompleted,
      );
      if (nextIncompleteSetIndex !== -1) {
        autoFillNextIncompleteSetWithValues(exerciseId, setIndex, weightValue, originalRepsValue);
      }

      // Start rest timer if applicable
      if (currentExercise && currentExercise.restTime && currentExercise.restTime > 0) {
        onStartRestTimer?.(currentExercise.restTime);
      }
    },
    [
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
      onStartRestTimer,
    ],
  );

  const handleRedoSet = useCallback(
    (exerciseId: string, setIndex: number) => {
      // Mark the set as not completed and update volume/reps totals
      setExerciseSets((prev) => {
        const updatedSets = [...prev[exerciseId]];
        const currentSet = updatedSets[setIndex];

        // Get the current exercise to check if it requires weight
        const currentExercise = exercises.find((ex) => ex.id === exerciseId);
        const requiresWeight = currentExercise?.requires_weight !== false; // Default to true if not specified

        // If the set was completed, subtract its EXACT volume and reps from totals
        if (currentSet.isCompleted) {
          // Use the exact values that are currently stored in the set (these are what were used when it was completed)
          const weight = requiresWeight
            ? currentSet.weight === '-' || currentSet.weight === ''
              ? 0
              : parseFloat(currentSet.weight)
            : 0;
          const reps =
            currentSet.reps === '-' || currentSet.reps === '' ? 0 : parseFloat(currentSet.reps);

          const setVolume = requiresWeight ? parseFloat((weight * reps).toFixed(1)) : 0;

          if (requiresWeight) {
            setTotalVolume((prev) => Math.max(0, parseFloat((prev - setVolume).toFixed(1))));
          }
          setTotalReps((prev) => Math.max(0, prev - reps));
        }

        updatedSets[setIndex] = {
          ...currentSet,
          isCompleted: false,
          // Keep both weight and reps values - don't clear them on redo
        };

        return { ...prev, [exerciseId]: updatedSets };
      });

      // Reset user-entered flags for this set when redoing (AFTER calculating subtraction)
      const weightInputKey = `${exerciseId}-${setIndex}-weight`;
      const repsInputKey = `${exerciseId}-${setIndex}-reps`;
      setUserEnteredValues((prev) => {
        const updated = { ...prev };
        delete updated[weightInputKey];
        delete updated[repsInputKey];
        return updated;
      });
    },
    [exercises, setExerciseSets, setTotalVolume, setTotalReps, setUserEnteredValues],
  );

  const handleLogAllSets = useCallback(
    (exerciseId: string) => {
      const sets = exerciseSets[exerciseId];
      if (!sets || sets.length === 0) return;

      const currentExercise = exercises.find((ex) => ex.id === exerciseId);
      const requiresWeight = currentExercise?.requires_weight !== false;

      const incompleteSets = sets.filter((set) => !set.isCompleted);
      if (incompleteSets.length === 0) {
        Alert.alert('Sets Completed', 'All sets for this exercise are already logged.', [
          { text: 'OK' },
        ]);
        onMoveToNextExercise?.();
        return;
      }

      // Helper to resolve weight and reps for a given set during log all
      const resolveSetValuesForLogAllHelper = (
        set: ExerciseSet,
        index: number,
      ): { weight: string; reps: string } => {
        return resolveSetValuesForLogAll({
          set,
          index,
          requiresWeight,
          currentRecommendation,
          getSuggestedValue,
          lastExerciseValues,
          currentExercise,
          exerciseCustomized,
        });
      };

      let totalVolumeToAdd = 0;
      let totalRepsToAdd = 0;

      const updatedSetsData = sets.map((set, index) => {
        if (set.isCompleted) {
          return set;
        }
        const { weight: resolvedWeight, reps: resolvedReps } = resolveSetValuesForLogAllHelper(
          set,
          index,
        );

        const weight = requiresWeight ? parseFloat(resolvedWeight) || 0 : 0;
        const reps = parseInt(resolvedReps) || 0;
        const setVolume = requiresWeight ? parseFloat((weight * reps).toFixed(1)) : 0;

        if (requiresWeight) {
          totalVolumeToAdd += setVolume;
        }
        totalRepsToAdd += reps;

        return {
          ...set,
          weight: resolvedWeight,
          reps: resolvedReps,
          isCompleted: true,
        };
      });

      // Helper to update exercise sets and totals atomically
      const updateSetsAndTotals = () => {
        setExerciseSets((prev) => ({
          ...prev,
          [exerciseId]: updatedSetsData,
        }));
        if (requiresWeight) {
          setTotalVolume((prev) => parseFloat((prev + totalVolumeToAdd).toFixed(1)));
        }
        setTotalReps((prev) => prev + totalRepsToAdd);
      };

      updateSetsAndTotals();

      // Start rest timer
      if (currentExercise && currentExercise.restTime) {
        onStartRestTimer?.(currentExercise.restTime);
      } else {
        onStartRestTimer?.(60); // Default rest time if not specified
      }

      // Helper to handle completion and navigation after logging all sets
      const handleCompletionAndNavigationAfterLogAll = () => {
        if (currentExerciseIndex === exercises.length - 1) {
          const allExercisesCompleted = exercises.every((ex) => {
            if (ex.id === exerciseId) return true; // Current exercise is now complete
            const exSets = exerciseSets[ex.id] || [];
            return exSets.length > 0 && exSets.every((s) => s.isCompleted);
          });

          if (allExercisesCompleted) {
            const finalVolume = totalVolume + totalVolumeToAdd;
            const finalReps = totalReps + totalRepsToAdd;
            const finalExerciseSets = {
              ...exerciseSets,
              [exerciseId]: updatedSetsData,
            };
            setTimeout(() => {
              onCompleteWorkoutWithStateSync?.(finalVolume, finalReps, finalExerciseSets);
            }, 100);
          } else {
            setTimeout(() => {
              onMoveToNextExercise?.();
            }, 100);
          }
        } else {
          setTimeout(() => {
            onMoveToNextExercise?.();
          }, 100);
        }
      };

      handleCompletionAndNavigationAfterLogAll();
    },
    [
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
      onMoveToNextExercise,
    ],
  );

  const handleWeightChange = useCallback((exerciseId: string, setIndex: number, value: string) => {
    // Validate and transform the input value
    // Allow decimal input with either dot or comma as separator
    let processedValue = value;

    // Replace comma with dot for decimal values
    if (value.includes(',')) {
      processedValue = value.replace(/,/g, '.');
    }

    // Keep '-' as is but remove leading zeros
    if (processedValue !== '-') {
      // Handle decimal values correctly
      if (processedValue.includes('.')) {
        const [wholePart, decimalPart] = processedValue.split('.');

        // Limit whole part to 999 maximum
        let limitedWholePart = wholePart.replace(/^0+(?=\d)/, '');
        if (limitedWholePart !== '' && parseInt(limitedWholePart) > 999) {
          limitedWholePart = '999';
        }

        // Limit decimal part to 1 digit
        const limitedDecimalPart = decimalPart.length > 0 ? decimalPart.substring(0, 1) : '';
        processedValue = `${limitedWholePart}.${limitedDecimalPart}`;
      } else {
        // For non-decimal values, limit to 999 maximum
        let limitedValue = processedValue.replace(/^0+(?=\d)/, '');
        if (limitedValue !== '' && parseInt(limitedValue) > 999) {
          limitedValue = '999';
        }
        processedValue = limitedValue;
      }
    }

    // Mark this input as user-entered
    const inputKey = `${exerciseId}-${setIndex}-weight`;
    setUserEnteredValues((prev) => ({
      ...prev,
      [inputKey]: true,
    }));

    setExerciseSets((prev) => {
      const updatedSets = { ...prev };
      if (updatedSets[exerciseId]) {
        updatedSets[exerciseId][setIndex].weight = processedValue;
      }
      return updatedSets;
    });
  }, []);

  const handleRepsChange = useCallback((exerciseId: string, setIndex: number, value: string) => {
    const processedValue = processRepsInput(value);

    // Mark this input as user-entered
    const inputKey = `${exerciseId}-${setIndex}-reps`;
    setUserEnteredValues((prev) => ({
      ...prev,
      [inputKey]: true,
    }));

    setExerciseSets((prev) => {
      const updatedSets = { ...prev };
      if (updatedSets[exerciseId]) {
        updatedSets[exerciseId][setIndex].reps = processedValue;
      }
      return updatedSets;
    });
  }, []);

  // Auto-fill functions for legacy support
  const autoFillNextSetWithValues = useCallback(
    (exerciseId: string, currentSetIndex: number, weightValue: string, repsValue: string) => {
      setExerciseSets((prev) => {
        const isValidForAutoFill = validateAutoFillConditions({
          exerciseId,
          currentSetIndex,
          weightValue,
          repsValue,
          exercises,
          exerciseSets: prev,
        });

        if (!isValidForAutoFill) {
          return prev;
        }

        const currentExercise = exercises.find((ex) => ex.id === exerciseId);
        if (!currentExercise) return prev;

        const nextSet = prev[exerciseId][currentSetIndex + 1];
        const hasValidWeight =
          currentExercise.requires_weight !== false && weightValue !== '' && weightValue !== '-';
        const hasValidReps = repsValue !== '' && repsValue !== '-';

        if ((hasValidWeight || currentExercise.requires_weight === false) && hasValidReps) {
          const updatedSets = { ...prev };
          updatedSets[exerciseId] = [...updatedSets[exerciseId]];

          const { autoFillWeight, autoFillReps } = determineAutoFillValues({
            weightValue,
            repsValue,
            exerciseId,
            currentSetIndex,
            exerciseCustomized,
            userEnteredValues,
            currentExercise,
          });

          updatedSets[exerciseId][currentSetIndex + 1] = {
            ...updatedSets[exerciseId][currentSetIndex + 1],
            weight: hasValidWeight ? autoFillWeight : nextSet.weight,
            reps: hasValidReps ? autoFillReps : nextSet.reps,
          };
          return updatedSets;
        }

        return prev;
      });
    },
    [exercises, exerciseCustomized, userEnteredValues, setExerciseSets],
  );

  const autoFillNextSet = useCallback(
    (exerciseId: string, currentSetIndex: number) => {
      // Only auto-fill if there's a next set
      if (exerciseSets[exerciseId] && exerciseSets[exerciseId][currentSetIndex + 1]) {
        const currentSet = exerciseSets[exerciseId][currentSetIndex];
        autoFillNextSetWithValues(exerciseId, currentSetIndex, currentSet.weight, currentSet.reps);
      }
    },
    [exerciseSets, autoFillNextSetWithValues],
  );

  const handleCustomizeExerciseSave = useCallback(
    (exerciseId: string, updatedExercise: { sets: number; reps_range: string }) => {
      console.log('Exercise customization requested:', exerciseId, updatedExercise);

      // Mark this exercise as customized
      setExerciseCustomized((prev) => ({
        ...prev,
        [exerciseId]: true,
      }));

      // Clear user-entered flags for all reps inputs of this exercise
      setUserEnteredValues((prev) => {
        return clearUserEnteredFlags(prev, exerciseId, exerciseSets);
      });

      // Update exercise sets to match the new number of sets and update only incomplete sets
      setExerciseSets((prev) => {
        const currentSets = prev[exerciseId] || [];
        const newSetsCount = updatedExercise.sets;

        // Handle set removal and volume calculations
        if (currentSets.length > newSetsCount) {
          const setsToRemove = currentSets.slice(newSetsCount);

          setsToRemove.forEach((set) => {
            if (set.isCompleted) {
              const currentExercise = exercises.find((ex) => ex.id === exerciseId);
              const { volume, reps } = calculateVolumeFromSet(set, currentExercise);

              if (currentExercise?.requires_weight !== false) {
                setTotalVolume((prev) => Math.max(0, parseFloat((prev - volume).toFixed(1))));
              }
              setTotalReps((prev) => Math.max(0, prev - reps));
            }
          });
        }

        const updatedSets = updateSetsForCustomization(
          currentSets,
          newSetsCount,
          updatedExercise.reps_range,
          exerciseId,
        );

        // Check if exercise is now complete after customization and trigger completion logic
        setTimeout(() => {
          const customizedSets = updatedSets.slice(0, updatedExercise.sets);
          const isExerciseComplete = customizedSets.every((set) => set.isCompleted);

          if (isExerciseComplete) {
            console.log('Exercise completed after customization, moving to next exercise');
            // Check if it's the last exercise
            if (currentExerciseIndex === exercises.length - 1) {
              // Check if all exercises are complete for workout completion
              // We need to get the current state for other exercises
              setExerciseSets((currentState) => {
                const allExercisesCompleted = exercises.every((exercise) => {
                  if (exercise.id === exerciseId) return true; // Current exercise is now complete
                  const exSets = currentState[exercise.id] || [];
                  return exSets.length > 0 && exSets.every((s) => s.isCompleted);
                });

                if (allExercisesCompleted) {
                  setTimeout(() => {
                    onCompleteWorkoutWithStateSync?.(totalVolume, totalReps, currentState);
                  }, 100);
                }
                return currentState; // Don't actually update state
              });
            } else {
              setTimeout(() => {
                onMoveToNextExercise?.();
              }, 100);
            }
          }
        }, 100);

        return {
          ...prev,
          [exerciseId]: updatedSets,
        };
      });

      // Force TextInput re-render by updating refresh key
      setTextInputRefreshKey((prev) => prev + 1);
    },
    [
      exerciseSets,
      exercises,
      currentExerciseIndex,
      totalVolume,
      totalReps,
      setExerciseCustomized,
      setUserEnteredValues,
      setExerciseSets,
      setTotalVolume,
      setTotalReps,
      setTextInputRefreshKey,
      onMoveToNextExercise,
      onCompleteWorkoutWithStateSync,
    ],
  );

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
export default function disablewarn() {
  return null;
}
