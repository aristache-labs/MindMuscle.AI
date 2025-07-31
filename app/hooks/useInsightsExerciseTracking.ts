import { useState } from 'react';
import { Alert } from 'react-native';
import { format } from 'date-fns';
import exerciseService, { Exercise } from '../services/exerciseService';
import supabase from '../services/supabase';
import { SentryDataCollection, SentryLogger, SentryAutoInstrumentation } from '../services/sentry';
import { ExerciseData } from '../components/ExerciseGraphs';

interface UserExerciseRecord {
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  created_at: string;
  user_workout_history:
    | {
        completed_at: string;
      }
    | Array<{
        completed_at: string;
      }>;
}

export const useInsightsExerciseTracking = (userId: string | undefined) => {
  const [exercises, setExercises] = useState<ExerciseData[]>([]);
  const [trackedExerciseIds, setTrackedExerciseIds] = useState<string[]>([]);
  const [showExerciseSelectionModal, setShowExerciseSelectionModal] = useState(false);

  const loadExerciseData = async () => {
    if (!userId) {
      SentryLogger.warn('Attempted to load exercise data without user ID', {
        component: 'useInsightsExerciseTracking',
        action: 'load_exercise_data_no_user',
      });
      return;
    }

    try {
      // Track exercise data loading start
      SentryDataCollection.addBreadcrumb({
        message: 'Loading tracked exercise data for InsightsScreen',
        category: 'data.load',
        level: 'info',
        data: {
          component: 'useInsightsExerciseTracking',
          action: 'load_tracked_exercise_data_start',
          user_id: userId,
        },
      });

      // First, get user's tracked exercises
      const { data: trackedExercises, error: trackedError } = await supabase
        .from('user_tracked_exercises')
        .select('exercise_id')
        .eq('user_id', userId);

      if (trackedError) {
        SentryDataCollection.captureException(
          new Error('Supabase query error for tracked exercises'),
          {
            component: 'useInsightsExerciseTracking',
            supabase_error: trackedError,
          },
        );
        setExercises([]);
        setTrackedExerciseIds([]);
        return;
      }

      const trackedExerciseIdList = trackedExercises?.map((te) => te.exercise_id) || [];
      setTrackedExerciseIds(trackedExerciseIdList);

      if (trackedExerciseIdList.length === 0) {
        setExercises([]);
        return;
      }

      // Get exercise records for tracked exercises only
      const { data: exerciseRecords, error: recordsError } = await supabase
        .from('user_exercise_records')
        .select(
          `
          exercise_id,
          weight,
          reps,
          created_at,
          user_workout_history!inner(
            completed_at
          )
        `,
        )
        .eq('user_workout_history.user_id', userId)
        .eq('completed', true)
        .not('weight', 'is', null)
        .neq('weight', 0)
        .in('exercise_id', trackedExerciseIdList)
        .order('user_workout_history(completed_at)', { ascending: true });

      if (recordsError) {
        SentryDataCollection.captureException(
          new Error('Supabase query error for exercise records'),
          {
            component: 'useInsightsExerciseTracking',
            supabase_error: recordsError,
          },
        );
      }

      // Get exercise details
      const allExercises = await exerciseService.getAllExercises();
      const exerciseMap = new Map(allExercises.map((ex) => [ex.id, ex.name]));

      // Create exercise data for all tracked exercises (with or without data)
      const exerciseDataMap = new Map<string, ExerciseData>();

      // Initialize all tracked exercises
      trackedExerciseIdList.forEach((exerciseId) => {
        const exerciseName = exerciseMap.get(exerciseId) || 'Unknown Exercise';
        exerciseDataMap.set(exerciseId, {
          id: exerciseId,
          name: exerciseName,
          unit: 'kg',
          data: [],
        });
      });

      // Add actual workout data if available
      if (exerciseRecords && exerciseRecords.length > 0) {
        exerciseRecords.forEach((record: UserExerciseRecord) => {
          const exerciseId = record.exercise_id;
          const exerciseData = exerciseDataMap.get(exerciseId);

          if (exerciseData) {
            const workoutHistory = Array.isArray(record.user_workout_history)
              ? record.user_workout_history[0]
              : record.user_workout_history;

            exerciseData.data.push({
              date: format(new Date(workoutHistory.completed_at), 'dd.MM'),
              value: record.weight || 0,
            });
          }
        });
      }

      // Convert map to array
      const exerciseDataArray = Array.from(exerciseDataMap.values());
      setExercises(exerciseDataArray);

      SentryDataCollection.addBreadcrumb({
        message: 'Successfully loaded tracked exercise data',
        category: 'data.load',
        level: 'info',
        data: {
          component: 'useInsightsExerciseTracking',
          trackedCount: trackedExerciseIdList.length,
          withDataCount: exerciseDataArray.filter((ex) => ex.data.length > 0).length,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useInsightsExerciseTracking',
        action: 'load_tracked_exercise_data_error',
      });
      setExercises([]);
      setTrackedExerciseIds([]);
    }
  };

  const handleAddExercise = () => {
    // Track add exercise interaction
    SentryAutoInstrumentation.trackUserInteraction(
      'add_exercise_to_track_press',
      'button_press',
      'insights_screen',
      {
        component: 'useInsightsExerciseTracking',
        action: 'add_exercise_to_track',
        user_id: userId,
        currentTrackedCount: trackedExerciseIds.length,
      },
    );

    SentryDataCollection.addBreadcrumb({
      message: 'Add exercise to track button pressed',
      category: 'ui.interaction',
      level: 'info',
      data: {
        component: 'useInsightsExerciseTracking',
        action: 'add_exercise_to_track_press',
        user_id: userId,
        currentTrackedCount: trackedExerciseIds.length,
      },
    });

    setShowExerciseSelectionModal(true);
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!userId) {
      SentryLogger.warn('Attempted to delete tracked exercise without user ID', {
        component: 'useInsightsExerciseTracking',
        exerciseId,
      });
      return;
    }

    try {
      SentryAutoInstrumentation.trackUserInteraction(
        'delete_tracked_exercise',
        'button_press',
        'insights_screen',
        {
          exercise_id: exerciseId,
          user_id: userId,
        },
      );

      SentryDataCollection.addBreadcrumb({
        message: 'Removing exercise from tracking',
        category: 'data.delete',
        level: 'info',
        data: {
          component: 'useInsightsExerciseTracking',
          exerciseId,
          userId,
        },
      });

      // Remove from database
      const { error } = await supabase
        .from('user_tracked_exercises')
        .delete()
        .eq('user_id', userId)
        .eq('exercise_id', exerciseId);

      if (error) {
        throw error;
      }

      // Update local state
      setExercises((prev) => prev.filter((e) => e.id !== exerciseId));
      setTrackedExerciseIds((prev) => prev.filter((id) => id !== exerciseId));

      SentryDataCollection.addBreadcrumb({
        message: 'Successfully removed exercise from tracking',
        category: 'data.delete',
        level: 'info',
        data: {
          component: 'useInsightsExerciseTracking',
          exerciseId,
          userId,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useInsightsExerciseTracking',
        action: 'delete_tracked_exercise_error',
        exerciseId,
        userId,
      });
      SentryLogger.error('Error removing exercise from tracking', {
        error: error as Error,
        component: 'useInsightsExerciseTracking',
        exerciseId,
        userId,
      });
      Alert.alert('Error', 'Failed to remove exercise from tracking. Please try again.');
    }
  };

  const handleExercisesSelected = async (selectedExercises: Exercise[]) => {
    if (!userId) {
      SentryLogger.warn('Attempted to add tracked exercises without user ID', {
        component: 'useInsightsExerciseTracking',
      });
      return;
    }

    try {
      SentryDataCollection.addBreadcrumb({
        message: 'Adding new exercises to tracking',
        category: 'data.save',
        level: 'info',
        data: {
          component: 'useInsightsExerciseTracking',
          selectedCount: selectedExercises.length,
          exerciseNames: selectedExercises.map((ex) => ex.name).slice(0, 5),
          userId,
        },
      });

      // Add new exercises to the current exercises list
      const newExerciseData: ExerciseData[] = selectedExercises.map((exercise) => ({
        id: exercise.id,
        name: exercise.name,
        unit: 'kg',
        data: [], // Start with empty data - will be populated as user works out
      }));

      setExercises((prev) => [...prev, ...newExerciseData]);
      setTrackedExerciseIds((prev) => [...prev, ...selectedExercises.map((ex) => ex.id)]);

      // Reload exercise data to get any existing workout history for newly added exercises
      await loadExerciseData();

      SentryDataCollection.addBreadcrumb({
        message: 'Successfully added exercises to tracking',
        category: 'data.save',
        level: 'info',
        data: {
          component: 'useInsightsExerciseTracking',
          addedCount: selectedExercises.length,
          totalTrackedCount: trackedExerciseIds.length + selectedExercises.length,
          userId,
        },
      });
    } catch (error) {
      SentryDataCollection.captureException(error as Error, {
        component: 'useInsightsExerciseTracking',
        action: 'add_tracked_exercises_error',
        userId,
        selectedCount: selectedExercises.length,
      });
      SentryLogger.error('Error adding exercises to tracking', {
        error: error as Error,
        component: 'useInsightsExerciseTracking',
        userId,
      });
      Alert.alert('Error', 'Failed to add exercises to tracking. Please try again.');
    }
  };

  const handleSetGoal = (exerciseId: string) => {
    SentryAutoInstrumentation.trackUserInteraction(
      'set_exercise_goal',
      'button_press',
      'insights_screen',
      {
        exercise_id: exerciseId,
      },
    );
    // TODO: Implement goal setting functionality
    console.log('Set goal for exercise:', exerciseId);
  };

  return {
    exercises,
    trackedExerciseIds,
    showExerciseSelectionModal,
    setShowExerciseSelectionModal,
    loadExerciseData,
    handleAddExercise,
    handleDeleteExercise,
    handleExercisesSelected,
    handleSetGoal,
  };
};