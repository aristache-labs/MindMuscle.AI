import { useState, useCallback } from 'react';
import { ExerciseData } from '../types';
import { SentryDataCollection, SentryAutoInstrumentation } from '../../../services/sentry';

export interface UseWorkoutRestTimerReturn {
  // Rest timer state
  isRestTimerVisible: boolean;
  currentRestTime: number;
  currentExerciseName: string;
  isRestTimeEditModalVisible: boolean;

  // Rest timer controls
  startRestTimer: (exercise: ExerciseData) => void;
  startRestTimerWithNavigation: (exercise: ExerciseData) => void;
  skipRestTimer: () => void;
  completeRestTimer: () => void;
  editRestTime: () => void;
  saveRestTime: (newTime: number) => void;
  closeRestTimeEditModal: () => void;
}

export interface UseWorkoutRestTimerParams {
  // Callback to update exercise data persistently
  onExerciseUpdate?: (exerciseId: string, updates: Partial<ExerciseData>) => void;
  // Current exercises array to find and update the exercise
  exercises?: ExerciseData[];
  // Current exercise index for context and logging
  currentExerciseIndex?: number;
  // Navigation callbacks
  onMoveToNextExercise?: () => void;
  onCompleteWorkout?: () => void;
}

export const useWorkoutRestTimer = (
  params?: UseWorkoutRestTimerParams,
): UseWorkoutRestTimerReturn => {
  const { onExerciseUpdate, exercises, onMoveToNextExercise, onCompleteWorkout } = params || {};
  const { currentExerciseIndex } = params || {};

  // Rest timer state
  const [isRestTimerVisible, setIsRestTimerVisible] = useState(false);
  const [currentRestTime, setCurrentRestTime] = useState(60);
  const [currentExerciseName, setCurrentExerciseName] = useState('');
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [isRestTimeEditModalVisible, setIsRestTimeEditModalVisible] = useState(false);
  const [shouldNavigateOnComplete, setShouldNavigateOnComplete] = useState(false);

  // Helper function to determine next action after rest timer
  const handleRestTimerCompletion = useCallback(() => {
    try {
      // Check if we should navigate after rest timer completion
      if (shouldNavigateOnComplete) {
        /* console.log('🎯 REST TIMER COMPLETION WITH NAVIGATION'); */

        // Reset the navigation flag
        setShouldNavigateOnComplete(false);

        // Check if we have the necessary data to make smart decisions
        if (exercises && currentExerciseIndex !== undefined) {
          const currentExercise = exercises[currentExerciseIndex];

          if (currentExercise) {
            SentryAutoInstrumentation.trackUserInteraction(
              'rest_timer_completed_with_navigation',
              'rest_timer_action',
              'workout_timer',
              {
                exercise_name: currentExercise.name,
                exercise_index: currentExerciseIndex,
                action_type: 'navigate_to_next_exercise',
              },
            );

            // Check if this is the last exercise
            if (currentExerciseIndex === exercises.length - 1) {
              /* console.log('🏁 REST TIMER COMPLETING WORKOUT (last exercise)'); */
              // Last exercise, complete the workout
              onCompleteWorkout?.();
            } else {
              /* console.log('➡️ REST TIMER MOVING TO NEXT EXERCISE'); */
              // Move to next exercise
              onMoveToNextExercise?.();
            }
            return;
          }
        }
      }

      // No navigation needed - just dismiss timer
      /* console.log('✅ REST TIMER COMPLETION WITHOUT NAVIGATION'); */

      if (exercises && currentExerciseIndex !== undefined) {
        const currentExercise = exercises[currentExerciseIndex];
        if (currentExercise) {
          SentryAutoInstrumentation.trackUserInteraction(
            'rest_timer_dismissed_no_navigation',
            'rest_timer_action',
            'workout_timer',
            {
              exercise_name: currentExercise.name,
              exercise_index: currentExerciseIndex,
              action_type: 'timer_dismissed_continue_sets',
            },
          );
        }
      }

      // Fallback: if we don't have context, just hide the timer
      SentryAutoInstrumentation.trackUserInteraction(
        'rest_timer_fallback_dismiss',
        'rest_timer_completion',
        'workout_timer',
        {
          note: 'fallback_timer_dismiss_due_to_missing_context',
        },
      );
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useWorkoutRestTimer',
        action: 'handleRestTimerCompletion',
        exercise_index: currentExerciseIndex,
      });
    }
  }, [
    exercises,
    currentExerciseIndex,
    shouldNavigateOnComplete,
    onMoveToNextExercise,
    onCompleteWorkout,
  ]);

  const startRestTimer = useCallback((exercise: ExerciseData) => {
    try {
      const restTime = exercise.restTime || 60; // Default to 60 seconds if not specified

      /* console.log('🔥 REST TIMER STARTED (NO NAVIGATION):', {
        exerciseName: exercise.name,
        restTime,
        willNavigate: false,
      }); */

      setCurrentRestTime(restTime);
      setCurrentExerciseName(exercise.name);
      setCurrentExerciseId(exercise.id); // Store exercise ID for updates
      setIsRestTimerVisible(true);
      setShouldNavigateOnComplete(false); // Normal timer - no navigation

      SentryDataCollection.addBreadcrumb({
        message: 'Rest timer started for exercise',
        category: 'workout.rest_timer',
        level: 'info',
        data: {
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          rest_time_seconds: restTime,
        },
      });

      SentryAutoInstrumentation.trackUserInteraction(
        'start_rest_timer',
        'set_completion',
        'workout_timer',
        {
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          rest_time_seconds: restTime,
        },
      );
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useWorkoutRestTimer',
        action: 'startRestTimer',
        exercise_id: exercise.id,
      });
    }
  }, []);

  const startRestTimerWithNavigation = useCallback((exercise: ExerciseData) => {
    try {
      const restTime = exercise.restTime || 60; // Default to 60 seconds if not specified

      /* console.log('🚀 REST TIMER STARTED (WITH NAVIGATION):', {
        exerciseName: exercise.name,
        restTime,
        willNavigate: true,
      }); */

      setCurrentRestTime(restTime);
      setCurrentExerciseName(exercise.name);
      setCurrentExerciseId(exercise.id); // Store exercise ID for updates
      setIsRestTimerVisible(true);
      setShouldNavigateOnComplete(true); // This timer will navigate when complete

      SentryDataCollection.addBreadcrumb({
        message: 'Rest timer started for exercise with navigation',
        category: 'workout.rest_timer',
        level: 'info',
        data: {
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          rest_time_seconds: restTime,
          will_navigate: true,
        },
      });

      SentryAutoInstrumentation.trackUserInteraction(
        'start_rest_timer_with_navigation',
        'exercise_completion',
        'workout_timer',
        {
          exercise_id: exercise.id,
          exercise_name: exercise.name,
          rest_time_seconds: restTime,
          will_navigate: true,
        },
      );
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useWorkoutRestTimer',
        action: 'startRestTimerWithNavigation',
        exercise_id: exercise.id,
      });
    }
  }, []);

  const skipRestTimer = useCallback(() => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'skip_rest_timer',
        'user_action',
        'workout_timer',
        {
          exercise_name: currentExerciseName,
          rest_time_seconds: currentRestTime,
        },
      );

      setIsRestTimerVisible(false);

      // Navigate to next exercise or complete workout after skipping
      handleRestTimerCompletion();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useWorkoutRestTimer',
        action: 'skipRestTimer',
      });
      setIsRestTimerVisible(false); // Still hide timer even if tracking fails
      // Still try to navigate even if tracking fails
      handleRestTimerCompletion();
    }
  }, [currentExerciseName, currentRestTime, handleRestTimerCompletion]);

  const completeRestTimer = useCallback(() => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'complete_rest_timer',
        'timer_automatic',
        'workout_timer',
        {
          exercise_name: currentExerciseName,
          rest_time_seconds: currentRestTime,
        },
      );

      setIsRestTimerVisible(false);

      // Navigate to next exercise or complete workout after timer completes
      handleRestTimerCompletion();
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useWorkoutRestTimer',
        action: 'completeRestTimer',
      });
      setIsRestTimerVisible(false); // Still hide timer even if tracking fails
      // Still try to navigate even if tracking fails
      handleRestTimerCompletion();
    }
  }, [currentExerciseName, currentRestTime, handleRestTimerCompletion]);

  const editRestTime = useCallback(() => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'edit_rest_time_open',
        'edit_button',
        'workout_timer',
        {
          exercise_name: currentExerciseName,
          current_rest_time: currentRestTime,
        },
      );

      setIsRestTimeEditModalVisible(true);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useWorkoutRestTimer',
        action: 'editRestTime',
      });
      setIsRestTimeEditModalVisible(true); // Still show modal even if tracking fails
    }
  }, [currentExerciseName, currentRestTime]);

  const saveRestTime = useCallback(
    (newTime: number) => {
      try {
        SentryAutoInstrumentation.trackUserInteraction(
          'save_rest_time',
          'save_button',
          'workout_timer',
          {
            exercise_name: currentExerciseName,
            old_rest_time: currentRestTime,
            new_rest_time: newTime,
            time_difference: newTime - currentRestTime,
          },
        );

        // Update the local state immediately
        setCurrentRestTime(newTime);
        setIsRestTimeEditModalVisible(false);

        // Update the exercise data persistently if callback is provided
        if (onExerciseUpdate && currentExerciseId) {
          onExerciseUpdate(currentExerciseId, { restTime: newTime });

          SentryDataCollection.addBreadcrumb({
            message: 'Rest time saved persistently to exercise data',
            category: 'workout.rest_timer',
            level: 'info',
            data: {
              exercise_id: currentExerciseId,
              exercise_name: currentExerciseName,
              new_rest_time: newTime,
            },
          });
        }

        // Also update the exercises array directly if available (fallback method)
        if (exercises && currentExerciseId) {
          const exerciseIndex = exercises.findIndex((ex) => ex.id === currentExerciseId);
          if (exerciseIndex !== -1) {
            // This will be handled by the parent component through onExerciseUpdate
            /* console.log(
              `Rest time for exercise ${currentExerciseName} will be updated to ${newTime} seconds`,
            ); */
          }
        }

        // Restart the timer with the new time if it was already running
        if (isRestTimerVisible) {
          // Timer will restart automatically with the new time
        }
      } catch (error) {
        SentryDataCollection.captureException(error as Error, {
          component: 'useWorkoutRestTimer',
          action: 'saveRestTime',
          new_time: newTime,
        });
        // Still save the time even if tracking fails
        setCurrentRestTime(newTime);
        setIsRestTimeEditModalVisible(false);
      }
    },
    [
      currentExerciseName,
      currentRestTime,
      currentExerciseId,
      isRestTimerVisible,
      onExerciseUpdate,
      exercises,
    ],
  );

  const closeRestTimeEditModal = useCallback(() => {
    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'close_rest_time_edit',
        'close_action',
        'workout_timer',
        {
          exercise_name: currentExerciseName,
          rest_time_seconds: currentRestTime,
        },
      );

      setIsRestTimeEditModalVisible(false);
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useWorkoutRestTimer',
        action: 'closeRestTimeEditModal',
      });
      setIsRestTimeEditModalVisible(false); // Still close modal even if tracking fails
    }
  }, [currentExerciseName, currentRestTime]);

  return {
    // Rest timer state
    isRestTimerVisible,
    currentRestTime,
    currentExerciseName,
    isRestTimeEditModalVisible,

    // Rest timer controls
    startRestTimer,
    startRestTimerWithNavigation,
    skipRestTimer,
    completeRestTimer,
    editRestTime,
    saveRestTime,
    closeRestTimeEditModal,
  };
};

export default function disablewarn() {
  return null;
}
