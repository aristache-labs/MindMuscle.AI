import React, { SetStateAction, useCallback, useState } from 'react';
import workoutPlanService from '../../../services/workoutPlanService';
import type { ExerciseData, ExerciseSet } from '../types';

export interface UseExerciseSelectionParams {
  exercises: ExerciseData[];
  setExercises: React.Dispatch<React.SetStateAction<ExerciseData[]>>;
  currentExerciseIndex: number;
  setCurrentExerciseIndex: React.Dispatch<React.SetStateAction<number>>;
  exerciseSets: Record<string, ExerciseSet[]>;
  setExerciseSets: React.Dispatch<React.SetStateAction<Record<string, ExerciseSet[]>>>;
  setLastExerciseValues: React.Dispatch<
    React.SetStateAction<Record<string, Record<number, { weight: string; reps: string }>>>
  >;
  setExerciseCustomized: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setUserEnteredValues: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setFocusedInputs: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setTextInputRefreshKey: React.Dispatch<SetStateAction<number>>;
  userId?: string;
  // Add callbacks for completion logic
  onMoveToNextExercise?: () => void;
  onCompleteWorkout?: () => void;
}

export const useExerciseSelection = ({
  exercises,
  setExercises,
  currentExerciseIndex,
  setCurrentExerciseIndex,
  exerciseSets,
  setExerciseSets,
  setLastExerciseValues,
  setExerciseCustomized,
  setUserEnteredValues,
  setFocusedInputs,
  setTextInputRefreshKey,
  userId,
  onMoveToNextExercise,
  onCompleteWorkout,
}: UseExerciseSelectionParams) => {
  // Modal states
  const [showExerciseDetailsModal, setShowExerciseDetailsModal] = useState(false);
  const [showExerciseListModal, setShowExerciseListModal] = useState(false);
  const [showCustomizeExerciseModal, setShowCustomizeExerciseModal] = useState(false);
  const [showAddExerciseModal, setShowAddExerciseModal] = useState(false);
  const [initialSelectedExercise, setInitialSelectedExercise] = useState<number | null>(null);
  const [isCustomizeMode, setIsCustomizeMode] = useState(false);
  const [isInAddExerciseFlow, setIsInAddExerciseFlow] = useState(false);

  // Handle exercise details modal
  const handleExerciseNamePress = useCallback(() => {
    setShowExerciseDetailsModal(true);
  }, []);

  const handleExerciseDetailsModalClose = useCallback(() => {
    setShowExerciseDetailsModal(false);
  }, []);

  // Handle exercise list modal
  const handleExerciseListPress = useCallback(() => {
    setInitialSelectedExercise(null);
    setShowExerciseListModal(true);
  }, []);

  const handleExerciseListModalClose = useCallback(() => {
    setShowExerciseListModal(false);
    setInitialSelectedExercise(null);
    // Only reset customize mode if we're not in an add exercise flow
    if (!isInAddExerciseFlow) {
      setIsCustomizeMode(false);
    }
  }, [isInAddExerciseFlow]);

  const handleNextExercisePress = useCallback(() => {
    if (currentExerciseIndex < exercises.length - 1) {
      setInitialSelectedExercise(currentExerciseIndex + 1);
      setShowExerciseListModal(true);
    }
  }, [currentExerciseIndex, exercises.length]);

  // Handle exercise selection
  const handleExerciseSelect = useCallback(
    (index: number) => {
      // If user selects a different exercise (not the current one), move current to end
      if (index !== currentExerciseIndex) {
        // Logic for moveCurrentExerciseToEnd is now handled by useWorkoutNavigation
        // Here we just update the current exercise index
        setCurrentExerciseIndex(index);
      }

      setShowExerciseListModal(false);
    },
    [currentExerciseIndex, setCurrentExerciseIndex],
  );

  // Handle customize exercise modal
  const handleCustomizeExercisePress = useCallback(() => {
    setShowCustomizeExerciseModal(true);
  }, []);

  const handleCustomizeExerciseModalClose = useCallback(() => {
    setShowCustomizeExerciseModal(false);
  }, []);

  // Handle customize mode toggle
  const handleToggleCustomizeMode = useCallback(() => {
    setIsCustomizeMode(!isCustomizeMode);
  }, [isCustomizeMode]);

  // Handle add exercise modal
  const handleAddExercisePress = useCallback(() => {
    console.log('AddExercise: Starting add exercise flow');
    // Set flag to indicate we're in an add exercise flow
    setIsInAddExerciseFlow(true);
    // Close the exercise list modal first to avoid modal stacking issues
    setShowExerciseListModal(false);
    // Small delay to ensure the first modal is closed before opening the second
    setTimeout(() => {
      console.log('AddExercise: Opening AddExerciseModal');
      setShowAddExerciseModal(true);
    }, 100);
  }, []);

  const handleAddExerciseModalClose = useCallback(() => {
    console.log('AddExercise: Closing AddExerciseModal');
    setShowAddExerciseModal(false);
    // Clear the add exercise flow flag
    setIsInAddExerciseFlow(false);
    // Reopen the exercise list modal after closing the add exercise modal
    setTimeout(() => {
      console.log('AddExercise: Reopening ExerciseListModal');
      setShowExerciseListModal(true);
    }, 100);
  }, []);

  const handleAddExercises = useCallback(
    (
      exerciseConfigurations: {
        exerciseId: string;
        name: string;
        sets: number;
        reps_range: string;
        image_url?: string;
        muscle_group: string;
        primary_muscles?: string[];
        requires_weight?: boolean;
      }[],
    ) => {
      // Convert exercise configurations to ExerciseData format
      const newExercises: ExerciseData[] = exerciseConfigurations.map((config, _index) => ({
        id: config.exerciseId,
        exercise_id: config.exerciseId, // Add required exercise_id field
        name: config.name,
        sets: config.sets,
        reps_range: config.reps_range,
        image_url: config.image_url,
        muscle_group: config.muscle_group,
        primary_muscles: config.primary_muscles || [],
        requires_weight: config.requires_weight || false,
        instructions: [], // Default empty instructions
        equipment: '', // Default empty equipment
        difficulty: '', // Default empty difficulty
        order: exercises.length + _index, // Add required order field
        workout_day: 1, // Add required workout_day field (default to 1)
      }));

      // Add new exercises to the current exercise list
      setExercises((prev) => [...prev, ...newExercises]);

      // Initialize exercise sets for each new exercise
      setExerciseSets((prev) => {
        const newSets = { ...prev };
        newExercises.forEach((exercise) => {
          if (!newSets[exercise.id]) {
            newSets[exercise.id] = Array.from({ length: exercise.sets }, (_, index) => ({
              id: `${exercise.id}-set-${index + 1}`,
              setNumber: index + 1,
              weight: '',
              reps: exercise.reps_range,
              isCompleted: false,
            }));
          }
        });
        return newSets;
      });

      // Close the add exercise modal
      setShowAddExerciseModal(false);

      // Clear the add exercise flow flag
      setIsInAddExerciseFlow(false);

      // Reopen the exercise list modal to show the updated list
      setTimeout(() => {
        console.log('AddExercise: Exercises added successfully, reopening ExerciseListModal');
        setShowExerciseListModal(true);
      }, 100);
    },
    [exercises, setExercises, setExerciseSets],
  );

  // Handle action buttons (legacy for compatibility)
  const handleAddExercise = useCallback(() => {
    handleAddExercisePress();
  }, [handleAddExercisePress]);

  const handleAddSuperset = useCallback(() => {
    // TODO: Implement add superset functionality
    console.log('Add Superset pressed');
  }, []);

  const handleAddCardio = useCallback(() => {
    // TODO: Implement add cardio functionality
    console.log('Add Cardio pressed');
  }, []);

  const handleCustomizeExerciseSave = useCallback(
    (updatedExercise: { sets: number; reps_range: string }) => {
      // Get the exercise that's currently being customized
      const exerciseToUpdate = exercises[currentExerciseIndex];
      if (!exerciseToUpdate) {
        return;
      }

      // Clear reps recommendations when customizing exercise, keep weight recommendations
      setUserEnteredValues((prev) => {
        const updated = { ...prev };
        const currentSets = exerciseSets[exerciseToUpdate.id] || [];

        currentSets.forEach((_, index) => {
          const repsInputKey = `${exerciseToUpdate.id}-${index}-reps`;
          if (updated[repsInputKey]) {
            delete updated[repsInputKey];
          }
        });

        return updated;
      });

      // Update the exercise with new sets and reps range
      setExercises((prev) => {
        const updatedExercises = [...prev];
        const exerciseIndex = updatedExercises.findIndex((ex) => ex.id === exerciseToUpdate.id);

        if (exerciseIndex !== -1) {
          updatedExercises[exerciseIndex] = {
            ...updatedExercises[exerciseIndex],
            sets: updatedExercise.sets,
            reps_range: updatedExercise.reps_range,
          };
        }
        return updatedExercises;
      });

      // Update exercise sets to match the new number of sets
      setExerciseSets((prev) => {
        const currentSets = prev[exerciseToUpdate.id] || [];
        const newSetsCount = updatedExercise.sets;

        let updatedSets = [...currentSets];

        // Update incomplete sets with the new range - leave completed sets unchanged
        updatedSets = updatedSets.map((set) => {
          if (!set.isCompleted) {
            return {
              ...set,
              reps: updatedExercise.reps_range,
            };
          }
          return set;
        });

        if (currentSets.length < newSetsCount) {
          // Add new sets with the customized reps range
          for (let i = currentSets.length; i < newSetsCount; i++) {
            updatedSets.push({
              id: `${exerciseToUpdate.id}-set-${i + 1}`,
              setNumber: i + 1,
              weight: '',
              reps: updatedExercise.reps_range,
              isCompleted: false,
            });
          }
        } else if (currentSets.length > newSetsCount) {
          // Remove excess sets
          updatedSets = updatedSets.slice(0, newSetsCount);
        }

        // Check if exercise is complete after customization
        setTimeout(() => {
          const customizedSets = updatedSets.slice(0, newSetsCount);
          const isExerciseComplete = customizedSets.every((set) => set.isCompleted);

          if (isExerciseComplete) {
            console.log('Exercise completed after customization, moving to next exercise');
            // Check if it's the last exercise
            if (currentExerciseIndex === exercises.length - 1) {
              // Check if all exercises are complete for workout completion
              setExerciseSets((currentState) => {
                const allExercisesCompleted = exercises.every((exercise) => {
                  if (exercise.id === exerciseToUpdate.id) return true; // Current exercise is now complete
                  const exSets = currentState[exercise.id] || [];
                  return exSets.length > 0 && exSets.every((s) => s.isCompleted);
                });

                if (allExercisesCompleted && onCompleteWorkout) {
                  setTimeout(() => {
                    onCompleteWorkout();
                  }, 100);
                }
                return currentState; // Don't actually update state
              });
            } else {
              if (onMoveToNextExercise) {
                setTimeout(() => {
                  onMoveToNextExercise();
                }, 100);
              }
            }
          }
        }, 100);

        return {
          ...prev,
          [exerciseToUpdate.id]: updatedSets,
        };
      });

      // Mark this exercise as customized
      setExerciseCustomized((prev) => ({
        ...prev,
        [exerciseToUpdate.id]: true,
      }));

      // Force TextInput re-render
      setTextInputRefreshKey((prev) => prev + 1);

      // Close the modal
      setShowCustomizeExerciseModal(false);
    },
    [
      exercises,
      currentExerciseIndex,
      exerciseSets,
      setExercises,
      setExerciseSets,
      setExerciseCustomized,
      setUserEnteredValues,
      setTextInputRefreshKey,
      onMoveToNextExercise,
      onCompleteWorkout,
    ],
  );

  // Handle exercise change
  const handleExerciseChange = useCallback(
    (newExercise: ExerciseData) => {
      try {
        const currentExercise = exercises[currentExerciseIndex];
        if (!currentExercise) {
          console.error('No current exercise found at index:', currentExerciseIndex);
          return;
        }

        // Clear focused inputs
        setFocusedInputs({});

        // Force TextInput re-render
        setTextInputRefreshKey((prev) => prev + 1);

        // Clear user entered values for this exercise
        setUserEnteredValues((prev) => {
          const updated = { ...prev };
          Object.keys(updated).forEach((key) => {
            if (key.startsWith(currentExercise.id)) {
              delete updated[key];
            }
          });
          return updated;
        });

        // Clear customization flags for this exercise
        setExerciseCustomized((prev) => {
          const updated = { ...prev };
          delete updated[currentExercise.id];
          return updated;
        });

        // Clear last exercise values for the old exercise
        setLastExerciseValues((prev) => {
          const updated = { ...prev };
          delete updated[currentExercise.exercise_id];
          return updated;
        });

        // Check if this is a changed exercise
        const isChangedExercise = newExercise.isChangedExercise === true;

        // Update the current exercise in the exercises array
        setExercises((prev) =>
          prev.map((exercise, index) => {
            if (index === currentExerciseIndex) {
              return {
                ...exercise,
                exercise_id: newExercise.exercise_id || newExercise.id,
                name: newExercise.name,
                sets: newExercise.sets,
                reps_range: newExercise.reps_range,
                image_url: newExercise.image_url,
                primary_muscles: newExercise.primary_muscles,
                requires_weight: newExercise.requires_weight,
                isChangedExercise: isChangedExercise,
                id: exercise.id,
                order: exercise.order,
                workout_day: exercise.workout_day,
              };
            }
            return exercise;
          }),
        );

        // Reset the exercise sets for the new exercise
        setTimeout(() => {
          setExerciseSets((prev) => {
            const newSets = Array.from({ length: newExercise.sets }, (_, index) => {
              const baseSet = {
                id: `${currentExercise.id}-set-${index + 1}`,
                setNumber: index + 1,
                reps: isChangedExercise ? '-' : '',
                isCompleted: false,
              };

              return {
                ...baseSet,
                weight: newExercise.requires_weight !== false ? (isChangedExercise ? '-' : '') : '',
              };
            });

            return {
              ...prev,
              [currentExercise.id]: newSets,
            };
          });

          // Force TextInput re-render
          setTextInputRefreshKey((prev) => prev + 1);

          // Fetch last exercise values for the new exercise
          if (userId) {
            setTimeout(async () => {
              try {
                const lastValues = await workoutPlanService.fetchLastExerciseRecords(userId, [
                  {
                    ...currentExercise,
                    exercise_id: newExercise.exercise_id || newExercise.id,
                    name: newExercise.name,
                    sets: newExercise.sets,
                    reps_range: newExercise.reps_range,
                    primary_muscles: newExercise.primary_muscles,
                    requires_weight: newExercise.requires_weight,
                  },
                ]);

                if (Object.keys(lastValues).length > 0) {
                  // Update last exercise values
                  setLastExerciseValues((prev) => ({
                    ...prev,
                    ...lastValues,
                  }));

                  // Fill sets with history data if this is a changed exercise
                  if (isChangedExercise) {
                    const exerciseId = newExercise.exercise_id || newExercise.id;
                    const historyData = lastValues[exerciseId];

                    if (historyData && Object.keys(historyData).length > 0) {
                      setExerciseSets((prev) => {
                        const currentSets = prev[currentExercise.id] || [];
                        const updatedSets = currentSets.map((set, index) => {
                          const setNumber = index + 1;
                          const historySet = historyData[setNumber];

                          if (historySet) {
                            const updatedSet = {
                              ...set,
                              reps: historySet.reps || '-',
                              weight:
                                newExercise.requires_weight !== false
                                  ? historySet.weight || '-'
                                  : '',
                            };

                            return updatedSet;
                          }
                          return set;
                        });

                        return {
                          ...prev,
                          [currentExercise.id]: updatedSets,
                        };
                      });
                    }
                  }
                } else if (!isChangedExercise) {
                  // Clear last values if no history data and not a changed exercise
                  setLastExerciseValues((prev) => {
                    const updated = { ...prev };
                    delete updated[newExercise.exercise_id || newExercise.id];
                    return updated;
                  });
                }
              } catch (error) {
                console.error('Error fetching last exercise values:', error);
                setLastExerciseValues((prev) => {
                  const updated = { ...prev };
                  delete updated[newExercise.exercise_id || newExercise.id];
                  return updated;
                });
              }
            }, 100);
          }
        }, 50);
      } catch (error) {
        console.error('Error in handleExerciseChange:', error);
      }
    },
    [
      exercises,
      currentExerciseIndex,
      setExercises,
      setExerciseSets,
      setLastExerciseValues,
      setUserEnteredValues,
      setExerciseCustomized,
      setFocusedInputs,
      setTextInputRefreshKey,
      userId,
    ],
  );

  return {
    // Modal states
    showExerciseDetailsModal,
    setShowExerciseDetailsModal,
    showExerciseListModal,
    setShowExerciseListModal,
    showCustomizeExerciseModal,
    setShowCustomizeExerciseModal,
    showAddExerciseModal,
    setShowAddExerciseModal,
    initialSelectedExercise,
    setInitialSelectedExercise,
    isCustomizeMode,
    setIsCustomizeMode,
    isInAddExerciseFlow,
    setIsInAddExerciseFlow,

    // Modal handlers
    handleExerciseNamePress,
    handleExerciseDetailsModalClose,
    handleExerciseListPress,
    handleExerciseListModalClose,
    handleNextExercisePress,
    handleExerciseSelect,
    handleCustomizeExercisePress,
    handleCustomizeExerciseModalClose,
    handleToggleCustomizeMode,
    handleAddExercisePress,
    handleAddExerciseModalClose,
    handleAddExercises,

    // Exercise customization
    handleCustomizeExerciseSave,
    handleExerciseChange,

    // Action handlers
    handleAddExercise,
    handleAddSuperset,
    handleAddCardio,
  };
};
export default function disablewarn() {
  return null;
}
