import { useState, useCallback, useRef } from 'react';
import { ExerciseData } from '../types';
import { SentryDataCollection, SentryAutoInstrumentation } from '../../../services/sentry';
import ExerciseRestPreferencesService, {
  UserRestTimePreferences,
} from '../../../services/exerciseRestPreferencesService';

export interface UseWorkoutRestTimerReturn {
  // Rest timer state
  isRestTimerVisible: boolean;
  currentRestTime: number;
  currentExerciseName: string;
  isRestTimeEditModalVisible: boolean;

  // Rest timer controls
  startRestTimer: (exercise: ExerciseData) => Promise<void>;
  startRestTimerWithNavigation: (exercise: ExerciseData) => Promise<void>;
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
  // User ID for saving rest time preferences
  userId?: string;
}

export const useWorkoutRestTimer = (
  params?: UseWorkoutRestTimerParams,
): UseWorkoutRestTimerReturn => {
  const { onExerciseUpdate, exercises, onMoveToNextExercise, onCompleteWorkout, userId } =
    params || {};
  const { currentExerciseIndex } = params || {};

  // Rest timer state
  const [isRestTimerVisible, setIsRestTimerVisible] = useState(false);
  const [currentRestTime, setCurrentRestTime] = useState(60);
  const [currentExerciseName, setCurrentExerciseName] = useState('');
  const [currentExerciseId, setCurrentExerciseId] = useState<string | null>(null);
  const [isRestTimeEditModalVisible, setIsRestTimeEditModalVisible] = useState(false);
  const [shouldNavigateOnComplete, setShouldNavigateOnComplete] = useState(false);

  // Cache for user rest preferences to avoid repeated database calls
  const userPreferencesCache = useRef<{
    preferences: UserRestTimePreferences | null;
    userId: string | null;
    lastFetched: number;
    isLoading: boolean; // Add loading flag to prevent concurrent requests
  }>({
    preferences: null,
    userId: null,
    lastFetched: 0,
    isLoading: false,
  });

  // Cache timeout: 2 minutes (reduced from 5 minutes for better responsiveness)
  const CACHE_TIMEOUT_MS = 2 * 60 * 1000;

  // Helper function to determine intelligent default rest times based on exercise characteristics
  const getIntelligentDefaultRestTime = useCallback((exercise: ExerciseData): number => {
    const muscleGroup = exercise.muscle_group;
    const primaryMuscles = exercise.primary_muscles || [];

    // Cardio exercises get shorter rest
    if (muscleGroup === 'Cardio') {
      return 30;
    }

    // Check primary muscles for specific rest time recommendations
    const hasCompoundMuscles = primaryMuscles.some((muscle) =>
      ['Quads', 'Hamstrings', 'Glutes', 'Chest', 'Back', 'Shoulders'].includes(muscle),
    );

    const hasSmallMuscles = primaryMuscles.some((muscle) =>
      ['Biceps', 'Triceps', 'Calves', 'Forearms', 'Abs'].includes(muscle),
    );

    // Compound/large muscle exercises need more rest
    if (hasCompoundMuscles) {
      return 90; // 1.5 minutes for compound movements
    }

    // Small muscle exercises need less rest
    if (hasSmallMuscles) {
      return 45; // 45 seconds for isolation exercises
    }

    // Default fallback for unknown/mixed muscle groups
    return 60; // 1 minute standard rest
  }, []);

  // Helper function to get cached or fetch user preferences
  const getCachedUserPreferences = useCallback(
    async (targetUserId: string): Promise<UserRestTimePreferences> => {
      const now = Date.now();
      const cache = userPreferencesCache.current;

      // Check if cache is valid
      if (
        cache.preferences !== null &&
        cache.userId === targetUserId &&
        now - cache.lastFetched < CACHE_TIMEOUT_MS
      ) {
        /* console.log('🎯 Using cached user preferences:', {
        userId: targetUserId,
        exerciseCount: Object.keys(cache.preferences).length,
        cacheAge: now - cache.lastFetched,
      }); */
        return cache.preferences;
      }

      // Check if already loading to prevent concurrent requests
      if (cache.isLoading && cache.userId === targetUserId) {
        /* console.log('⏳ Already loading preferences for user, using cache fallback:', {
          userId: targetUserId,
        }); */
        return cache.preferences || {};
      }

      // Set loading flag
      userPreferencesCache.current.isLoading = true;

      // Fetch fresh preferences
      /* console.log('🔄 Fetching fresh user preferences:', {
      userId: targetUserId,
      cacheExpired: cache.userId === targetUserId ? (now - cache.lastFetched) >= CACHE_TIMEOUT_MS : false,
      userChanged: cache.userId !== targetUserId,
    }); */

      try {
        const preferences =
          await ExerciseRestPreferencesService.getUserRestPreferences(targetUserId);

        // Update cache and reset loading flag
        userPreferencesCache.current = {
          preferences,
          userId: targetUserId,
          lastFetched: now,
          isLoading: false,
        };

        /* console.log('✅ Cached fresh user preferences:', {
        userId: targetUserId,
        exerciseCount: Object.keys(preferences).length,
      }); */

        return preferences;
      } catch (error) {
        console.error('❌ Error fetching user preferences for cache:', {
          userId: targetUserId,
          error,
        });
        // Reset loading flag on error
        userPreferencesCache.current.isLoading = false;
        // Return empty preferences if fetch fails
        return {};
      }
    },
    [],
  );

  // Helper function to get effective rest time (ALWAYS from user preferences first)
  const getEffectiveRestTime = useCallback(
    async (exercise: ExerciseData): Promise<number> => {
      console.log('🔍 getEffectiveRestTime called:', {
        exerciseName: exercise.name,
        exerciseId: exercise.exercise_id,
        hasUserId: !!userId,
        strategy: 'user_preferences_only',
      });

      if (userId && exercise.exercise_id) {
        try {
          console.log('🔍 Fetching user preference for:', {
            userId,
            exerciseId: exercise.exercise_id,
            exerciseName: exercise.name,
          });

          // Use cached preferences instead of individual API call
          const userPreferences = await getCachedUserPreferences(userId);
          const userPreference = userPreferences[exercise.exercise_id] || null;

          console.log('🔍 User preference result:', {
            exerciseName: exercise.name,
            exerciseId: exercise.exercise_id,
            userPreference,
            willUsePreference: userPreference !== null,
          });

          if (userPreference !== null) {
            console.log('✅ Using user preference:', {
              exerciseName: exercise.name,
              userPreference,
            });
            return userPreference;
          } else {
            console.log('⚠️ No user preference found, using intelligent default:', {
              exerciseName: exercise.name,
            });
          }
        } catch (error) {
          console.error('❌ Error fetching user preference:', {
            exerciseName: exercise.name,
            exerciseId: exercise.exercise_id,
            error,
          });
          SentryDataCollection.captureException(error as Error, {
            component: 'useWorkoutRestTimer',
            action: 'getEffectiveRestTime',
            exercise_id: exercise.exercise_id,
            user_id: userId,
          });
          // Fall through to use intelligent default
        }
      } else {
        console.log('⚠️ Missing userId or exercise_id:', {
          exerciseName: exercise.name,
          hasUserId: !!userId,
          hasExerciseId: !!exercise.exercise_id,
          userId,
          exerciseId: exercise.exercise_id,
        });
      }

      // Use intelligent defaults based on muscle group instead of database rest_time
      const defaultTime = getIntelligentDefaultRestTime(exercise);
      console.log('📋 Using intelligent default rest time:', {
        exerciseName: exercise.name,
        defaultTime,
        muscleGroup: exercise.muscle_group,
        primaryMuscles: exercise.primary_muscles,
      });
      return defaultTime;
    },
    [userId, getCachedUserPreferences, getIntelligentDefaultRestTime],
  );

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

  const startRestTimer = useCallback(
    async (exercise: ExerciseData) => {
      console.log('🔥 startRestTimer called:', {
        exerciseName: exercise.name,
        exerciseId: exercise.exercise_id,
        defaultRestTime: exercise.restTime,
        userId,
      });

      try {
        const restTime = await getEffectiveRestTime(exercise);

        console.log('🔥 REST TIMER STARTED (NO NAVIGATION):', {
          exerciseName: exercise.name,
          restTime,
          willNavigate: false,
          userPreferenceUsed: userId && exercise.exercise_id ? 'checked' : 'not_checked',
        });

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
            user_preference_checked: !!(userId && exercise.exercise_id),
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
        console.error('❌ Error in startRestTimer:', {
          exerciseName: exercise.name,
          error,
        });
        SentryDataCollection.captureException(error as Error, {
          component: 'useWorkoutRestTimer',
          action: 'startRestTimer',
          exercise_id: exercise.id,
        });
      }
    },
    [getEffectiveRestTime, userId],
  );

  const startRestTimerWithNavigation = useCallback(
    async (exercise: ExerciseData) => {
      console.log('🚀 startRestTimerWithNavigation called:', {
        exerciseName: exercise.name,
        exerciseId: exercise.exercise_id,
        defaultRestTime: exercise.restTime,
        userId,
      });

      try {
        const restTime = await getEffectiveRestTime(exercise);

        console.log('🚀 REST TIMER STARTED (WITH NAVIGATION):', {
          exerciseName: exercise.name,
          restTime,
          willNavigate: true,
          userPreferenceUsed: userId && exercise.exercise_id ? 'checked' : 'not_checked',
        });

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
            user_preference_checked: !!(userId && exercise.exercise_id),
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
        console.error('❌ Error in startRestTimerWithNavigation:', {
          exerciseName: exercise.name,
          error,
        });
        SentryDataCollection.captureException(error as Error, {
          component: 'useWorkoutRestTimer',
          action: 'startRestTimerWithNavigation',
          exercise_id: exercise.id,
        });
      }
    },
    [getEffectiveRestTime, userId],
  );

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
    async (newTime: number) => {
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

        // Save to database permanently if we have exercise and user info
        if (currentExerciseId && exercises && userId) {
          const currentExercise = exercises.find((ex) => ex.id === currentExerciseId);
          if (currentExercise?.exercise_id) {
            const success = await ExerciseRestPreferencesService.saveExerciseRestPreference(
              userId,
              currentExercise.exercise_id,
              newTime,
            );

            if (success) {
              // Invalidate cache since we just saved a new preference
              userPreferencesCache.current = {
                preferences: null,
                userId: null,
                lastFetched: 0,
                isLoading: false,
              };

              SentryDataCollection.addBreadcrumb({
                message: 'Rest time preference saved permanently via modal',
                category: 'workout.rest_timer',
                level: 'info',
                data: {
                  exercise_id: currentExercise.exercise_id,
                  exercise_name: currentExerciseName,
                  new_rest_time: newTime,
                  user_id: userId,
                },
              });
            }
          }
        }

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
      userId,
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
