import { z } from 'zod';
import { logger } from '../utils/logger';
import supabase from './supabase';
import { SentryLogger } from './sentry';
import {
  addBreadcrumb,
  captureDatabaseError,
  capturePerformanceError,
} from './sentry/simpleErrorHandler';
import { validationService } from './validationService';
import { getCycleWeekInfo } from './workoutCycleService';
import { ExerciseData, ExerciseSet } from './workoutSessionService';

// Interface for completed workout data
export interface CompletedWorkoutData {
  completedExercises: number;
  duration: string;
  caloriesBurned: number;
  totalVolume: number;
  totalReps: number;
  completedAt: string;
  weekName: string;
  cycleWeek: number;
}

// Interface for workout history record from Supabase
interface WorkoutHistoryRecord {
  id: string;
  user_id: string;
  plan_id: string;
  workout_day: number;
  cycle_week: number;
  week_name: string;
  workout_duration: string;
  calories_burned: number;
  total_volume: number;
  total_reps: number;
  completed_at: string;
  exercises_count: number;
  exercise_structure?: string;
}

// Interface for saved exercise structure
interface SavedExerciseStructure {
  id: string;
  exercise_id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  requires_weight: boolean;
  workout_day: number;
  order: number;
  restTime: number;
  isChangedExercise?: boolean;
}

// Interface for complete workout options
interface CompleteWorkoutOptions {
  userId: string;
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  workoutDuration: number;
  totalVolume: number;
  totalReps: number;
  isRedoWorkout?: boolean;
  originalCycleWeek?: number | null;
}

// Helper function to validate workout parameters
const validateWorkoutParameters = (planId: string, workoutDay: number): void => {
  if (Number.isNaN(workoutDay) || workoutDay < 1) {
    console.error(`Invalid workout day: ${workoutDay}. Must be a number >= 1`);
    throw new Error('Invalid workout day');
  }

  if (!planId || planId.trim() === '') {
    console.error('Invalid plan ID');
    throw new Error('Invalid plan ID');
  }
};

// Helper function to handle redo workout logic
const handleRedoWorkout = async (
  userId: string,
  planId: string,
  workoutDay: number,
  cycleWeek: number,
): Promise<{
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  recommendations: Record<string, unknown>;
} | null> => {
  const savedExercises = await getLastCompletedWorkoutStructure(
    userId,
    planId,
    workoutDay,
    cycleWeek,
  );

  if (!savedExercises || savedExercises.length === 0) {
    return null;
  }

  const lastExerciseValues = await fetchLastExerciseRecords(userId, savedExercises);
  const exerciseSets = createExerciseSetsFromSaved(savedExercises, lastExerciseValues);
  const recommendations = await getRecommendationsForExercises(savedExercises, userId, cycleWeek);

  return {
    exercises: savedExercises,
    exerciseSets,
    recommendations,
  };
};

// Helper function to create exercise sets from saved structure
const createExerciseSetsFromSaved = (
  savedExercises: ExerciseData[],
  lastExerciseValues: Record<string, Record<number, { weight: string; reps: string }>>,
): Record<string, ExerciseSet[]> => {
  const exerciseSets: Record<string, ExerciseSet[]> = {};

  savedExercises.forEach((exercise) => {
    const exerciseLastValues = lastExerciseValues[exercise.exercise_id] || {};

    exerciseSets[exercise.id] = Array.from({ length: exercise.sets }, (_, index) => {
      const setNumber = index + 1;
      const lastWeight = exerciseLastValues[setNumber]?.weight || '';
      const lastReps = exerciseLastValues[setNumber]?.reps || '';

      return {
        id: `${exercise.id}-set-${index + 1}`,
        setNumber: setNumber,
        weight: lastWeight,
        reps: lastReps,
        isCompleted: false,
      };
    });
  });

  return exerciseSets;
};

// Helper function to get recommendations for exercises
const getRecommendationsForExercises = async (
  exercises: ExerciseData[],
  userId: string,
  cycleWeek: number,
): Promise<Record<string, unknown>> => {
  const recommendations: Record<string, unknown> = {};

  for (const exercise of exercises) {
    try {
      const recommendation = await getExerciseRecommendations(
        userId,
        exercise.exercise_id,
        cycleWeek,
      );
      if (recommendation) {
        recommendations[exercise.id] = recommendation;
      }
    } catch (error) {
      console.error(`Error getting recommendations for exercise ${exercise.exercise_id}:`, error);
    }
  }

  return recommendations;
};

// Helper function to fetch exercises from database
const fetchExercisesFromDatabase = async (
  planId: string,
  workoutDay: number,
): Promise<ExerciseData[]> => {
  const { data: exercisesData, error: exercisesError } = await supabase
    .from('workout_plan_exercises')
    .select(
      `
      id,
      sets,
      reps_range,
      exercise_id,
      workout_day,
      exercise_name,
      rest_time,
      "order",
      exercises:exercise_id (
        id,
        name,
        image_url,
        primary_muscles,
        requires_weight
      )
    `,
    )
    .eq('plan_id', planId)
    .eq('workout_day', workoutDay)
    .order('order', { ascending: true });

  if (exercisesError) {
    console.error(`Error fetching exercises: ${exercisesError.message}`);
    throw exercisesError;
  }

  if (!exercisesData || exercisesData.length === 0) {
    await debugNoExercisesFound(planId, workoutDay);
    throw new Error(`No exercises found for this workout (Day ${workoutDay})`);
  }

  return formatExerciseData(exercisesData);
};

// Helper function to debug when no exercises are found
const debugNoExercisesFound = async (planId: string, workoutDay: number): Promise<void> => {
  const { data: allPlanExercises, error: allExercisesError } = await supabase
    .from('workout_plan_exercises')
    .select('id, workout_day, exercise_name, plan_id')
    .eq('plan_id', planId);

  if (!allExercisesError && allPlanExercises) {
    // Get unique workout days for debugging
    void [...new Set(allPlanExercises.map((ex) => ex.workout_day))];

    // Check if any exercises exist for this plan
    void (await supabase.from('workout_plan_exercises').select('*').eq('plan_id', planId).limit(5));
  }

  console.error(`No exercises found for planId: ${planId}, workoutDay: ${workoutDay}`);
};

// Helper function to format exercise data
const formatExerciseData = (exercisesData: unknown[]): ExerciseData[] => {
  return exercisesData.map((item: unknown) => {
    const exercise = item as Record<string, unknown>;
    const exerciseDetails = exercise.exercises as Record<string, unknown> | null;

    return {
      id: exercise.id as string,
      exercise_id: exercise.exercise_id as string,
      name:
        (exercise.exercise_name as string) ||
        (exerciseDetails ? (exerciseDetails.name as string) : undefined) ||
        'Unknown Exercise',
      sets: (exercise.sets as number) || 3,
      reps_range: (exercise.reps_range as string) || '-',
      image_url: exerciseDetails ? (exerciseDetails.image_url as string) : undefined,
      primary_muscles: exerciseDetails ? (exerciseDetails.primary_muscles as string[]) : undefined,
      restTime: exercise.rest_time as number,
      order: exercise.order as number,
      workout_day: exercise.workout_day as number,
      requires_weight: exerciseDetails ? (exerciseDetails.requires_weight as boolean) : true,
    };
  });
};

// Helper function to initialize exercise sets and get recommendations
const initializeExerciseSetsAndRecommendations = async (
  exercises: ExerciseData[],
  userId: string,
  cycleWeek: number,
): Promise<{
  exerciseSets: Record<string, ExerciseSet[]>;
  recommendations: Record<string, unknown>;
}> => {
  const exerciseSets: Record<string, ExerciseSet[]> = {};
  const recommendations: Record<string, unknown> = {};

  for (const exercise of exercises) {
    // Initialize sets
    const sets: ExerciseSet[] = [];
    for (let i = 1; i <= exercise.sets; i++) {
      sets.push({
        id: `${exercise.id}-set-${i}`,
        setNumber: i,
        weight: '',
        reps: '',
        isCompleted: false,
      });
    }
    exerciseSets[exercise.id] = sets;

    // Get recommendations
    if (userId && exercise.exercise_id) {
      try {
        const recommendation = await getSmartRecommendation(
          exercise.exercise_id,
          userId,
          cycleWeek,
        );
        recommendations[exercise.id] = recommendation;
      } catch (error) {
        console.error(
          `Exception fetching smart recommendations for exercise ${exercise.exercise_id}:`,
          error,
        );
        recommendations[exercise.id] = createFallbackRecommendation(cycleWeek);
      }
    }
  }

  return { exerciseSets, recommendations };
};

// Helper function to get smart recommendation
const getSmartRecommendation = async (
  exerciseId: string,
  userId: string,
  cycleWeek: number,
): Promise<unknown> => {
  const { data: recommendationData, error: recError } = await supabase.rpc(
    'get_smart_exercise_recommendations',
    {
      p_cycle_week: cycleWeek,
      p_exercise_id: exerciseId,
      p_user_id: userId,
    },
  );

  if (recError) {
    console.error(`Error fetching smart recommendations for exercise ${exerciseId}:`, recError);
    return createFallbackRecommendation(cycleWeek);
  }

  if (recommendationData && recommendationData.length > 0) {
    return recommendationData[0];
  }

  return createFallbackRecommendation(cycleWeek);
};

// Helper function to create fallback recommendation
const createFallbackRecommendation = (cycleWeek: number): unknown => {
  return {
    previous_weight: null,
    previous_reps: null,
    recommended_weight: null,
    recommendation_text: `Week ${cycleWeek} - Focus on proper form and progressive overload`,
    cycle_week: cycleWeek,
  };
};

// Fetch workout data for a workout session
export const fetchWorkoutData = async (
  planId: string,
  workoutDay: number,
  userId: string,
  cycleWeek: number,
  isRedoWorkout: boolean = false,
): Promise<{
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  recommendations: Record<string, unknown>;
}> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Fetching workout data', 'workout_data', {
      plan_id: planId,
      workout_day: workoutDay,
      user_id: userId,
      cycle_week: cycleWeek,
      is_redo_workout: isRedoWorkout,
    });

    // Validate input parameters
    const validationData = { planId, workoutDay, userId, cycleWeek, isRedoWorkout };
    const validationResult = await validationService.validateFetchWorkoutData(validationData);

    if (!validationResult.success) {
      const errorMessage = `Fetch workout data validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

      SentryLogger.error(
        'Fetch workout data validation failed',
        {
          plan_id: planId,
          workout_day: workoutDay,
          user_id: userId,
          cycle_week: cycleWeek,
          is_redo_workout: isRedoWorkout,
          validation_errors: validationResult.errors,
          operation: 'fetch_workout_data',
        },
        { feature: 'workout_data', action: 'validation_error' },
      );

      logger.error('Fetch workout data validation failed', new Error(errorMessage), {
        context: { validationData, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    validateWorkoutParameters(planId, workoutDay);

    if (isRedoWorkout) {
      const redoResult = await handleRedoWorkout(userId, planId, workoutDay, cycleWeek);
      if (redoResult) {
        return redoResult;
      }
    }

    const exercises = await fetchExercisesFromDatabase(planId, workoutDay);
    const { exerciseSets, recommendations } = await initializeExerciseSetsAndRecommendations(
      exercises,
      userId,
      cycleWeek,
    );

    const duration = Date.now() - startTime;

    // Monitor for slow workout data fetching
    if (duration > 3000) {
      capturePerformanceError('Slow workout data fetch detected', 'fetch_duration', duration);
    }

    SentryLogger.info(
      'Workout data fetched successfully',
      {
        plan_id: planId,
        workout_day: workoutDay,
        user_id: userId,
        cycle_week: cycleWeek,
        is_redo_workout: isRedoWorkout,
        exercises_count: exercises.length,
        recommendations_count: Object.keys(recommendations).length,
        duration_ms: duration,
        operation: 'fetch_workout_data',
      },
      { feature: 'workout_data', action: 'success' },
    );

    return {
      exercises,
      exerciseSets,
      recommendations,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'workout_plan_exercises',
      'select',
    );

    SentryLogger.error(
      'Failed to fetch workout data',
      {
        plan_id: planId,
        workout_day: workoutDay,
        user_id: userId,
        cycle_week: cycleWeek,
        is_redo_workout: isRedoWorkout,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'fetch_workout_data',
      },
      { feature: 'workout_data', action: 'error' },
    );

    throw error;
  }
};

// Fetch last exercise records for all exercises
export const fetchLastExerciseRecords = async (
  userId: string,
  exercises: ExerciseData[],
): Promise<Record<string, Record<number, { weight: string; reps: string }>>> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Fetching last exercise records', 'workout_data', {
      user_id: userId,
      exercises_count: exercises.length,
    });

    // Validate input parameters
    const validationData = { userId, exercises };
    const validationResult =
      await validationService.validateFetchLastExerciseRecords(validationData);

    if (!validationResult.success) {
      const errorMessage = `Fetch last exercise records validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

      SentryLogger.error(
        'Fetch last exercise records validation failed',
        {
          user_id: userId,
          exercises_count: exercises.length,
          validation_errors: validationResult.errors,
          operation: 'fetch_last_exercise_records',
        },
        { feature: 'workout_data', action: 'validation_error' },
      );

      logger.error('Fetch last exercise records validation failed', new Error(errorMessage), {
        context: { validationData, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    if (!userId || exercises.length === 0) {
      SentryLogger.info(
        'No user ID or exercises provided for last records fetch',
        {
          user_id: userId,
          exercises_count: exercises.length,
          operation: 'fetch_last_exercise_records',
        },
        { feature: 'workout_data', action: 'early_return' },
      );
      return {};
    }
    // Create an object to store the last values for each exercise and set
    const lastValues: Record<string, Record<number, { weight: string; reps: string }>> = {};

    // For each exercise, fetch the last records
    for (const exercise of exercises) {
      if (!exercise.exercise_id) {
        continue;
      }

      const { data: records, error } = await supabase
        .from('user_exercise_records')
        .select('*')
        .eq('exercise_id', exercise.exercise_id)
        .eq('completed', true)
        .order('created_at', { ascending: false });

      if (error) {
        continue;
      }

      if (records && records.length > 0) {
        // Group records by set_number
        const setRecords: Record<number, { weight: string; reps: string }> = {};

        // Process records to get the last value for each set number
        records.forEach((record: unknown) => {
          const rec = record as Record<string, unknown>;
          const setNumber = rec.set_number as number;

          // Only store the first (most recent) record for each set number
          if (!setRecords[setNumber]) {
            setRecords[setNumber] = {
              weight: String(rec.weight || ''),
              reps: String(rec.reps || ''),
            };
          }
        });

        lastValues[exercise.exercise_id] = setRecords;
      }
    }

    const duration = Date.now() - startTime;

    // Monitor for slow exercise records fetching
    if (duration > 2000) {
      capturePerformanceError(
        'Slow last exercise records fetch detected',
        'fetch_duration',
        duration,
      );
    }

    SentryLogger.info(
      'Last exercise records fetched successfully',
      {
        user_id: userId,
        exercises_count: exercises.length,
        records_found: Object.keys(lastValues).length,
        duration_ms: duration,
        operation: 'fetch_last_exercise_records',
      },
      { feature: 'workout_data', action: 'success' },
    );

    return lastValues;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'user_exercise_records',
      'select',
    );

    SentryLogger.error(
      'Failed to fetch last exercise records',
      {
        user_id: userId,
        exercises_count: exercises.length,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'fetch_last_exercise_records',
      },
      { feature: 'workout_data', action: 'error' },
    );

    return {};
  }
};

// Check if workout is already completed
export const checkWorkoutCompletion = async (
  userId: string,
  planId: string,
  workoutDay: number,
): Promise<{
  isCompleted: boolean;
  completedWorkoutData?: CompletedWorkoutData;
}> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Checking workout completion', 'workout_data', {
      user_id: userId,
      plan_id: planId,
      workout_day: workoutDay,
    });

    // Validate input parameters
    const validationData = { userId, planId, workoutDay };
    const validationResult = await validationService.validateCheckWorkoutCompletion(validationData);

    if (!validationResult.success) {
      const errorMessage = `Check workout completion validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;

      SentryLogger.error(
        'Check workout completion validation failed',
        {
          user_id: userId,
          plan_id: planId,
          workout_day: workoutDay,
          validation_errors: validationResult.errors,
          operation: 'check_workout_completion',
        },
        { feature: 'workout_data', action: 'validation_error' },
      );

      logger.error('Check workout completion validation failed', new Error(errorMessage), {
        context: { validationData, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    if (!userId || !planId) {
      SentryLogger.info(
        'Missing user ID or plan ID for workout completion check',
        {
          user_id: userId,
          plan_id: planId,
          workout_day: workoutDay,
          operation: 'check_workout_completion',
        },
        { feature: 'workout_data', action: 'early_return' },
      );
      return { isCompleted: false };
    }
    // Check if there's a completed workout for this day
    const { data, error } = await supabase
      .from('user_workout_history')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('workout_day', workoutDay);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      // Workout is already completed, get the most recent one
      const mostRecentWorkout = (data as WorkoutHistoryRecord[]).sort(
        (a: WorkoutHistoryRecord, b: WorkoutHistoryRecord) =>
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
      )[0];

      // Get the count of exercises from the user_exercise_records table
      const { data: exerciseData } = await supabase
        .from('user_exercise_records')
        .select('exercise_id')
        .eq('workout_history_id', mostRecentWorkout.id)
        .limit(1000);

      // Set completed workout data
      const completedWorkoutData: CompletedWorkoutData = {
        completedExercises: exerciseData
          ? new Set(
              exerciseData.map((item: unknown) => {
                const record = item as Record<string, unknown>;
                return record.exercise_id;
              }),
            ).size
          : 0,
        duration: mostRecentWorkout.workout_duration || '00:00:00',
        caloriesBurned: mostRecentWorkout.calories_burned || 0,
        totalVolume: mostRecentWorkout.total_volume || 0,
        totalReps: mostRecentWorkout.total_reps || 0,
        completedAt: mostRecentWorkout.completed_at,
        weekName: mostRecentWorkout.week_name,
        cycleWeek: mostRecentWorkout.cycle_week,
      };

      return {
        isCompleted: true,
        completedWorkoutData,
      };
    } else {
      // Workout is not completed
      const duration = Date.now() - startTime;
      SentryLogger.info(
        'Workout not completed',
        {
          user_id: userId,
          plan_id: planId,
          workout_day: workoutDay,
          duration_ms: duration,
          operation: 'check_workout_completion',
        },
        { feature: 'workout_data', action: 'not_completed' },
      );
      return { isCompleted: false };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'user_workout_history',
      'select',
    );

    SentryLogger.error(
      'Failed to check workout completion',
      {
        user_id: userId,
        plan_id: planId,
        workout_day: workoutDay,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'check_workout_completion',
      },
      { feature: 'workout_data', action: 'error' },
    );

    return { isCompleted: false };
  }
};

// Get the exercise structure from the most recent completed workout for redo functionality
export const getLastCompletedWorkoutStructure = async (
  userId: string,
  planId: string,
  workoutDay: number,
  cycleWeek: number,
): Promise<ExerciseData[] | null> => {
  // Validate input parameters
  const validationData = { userId, planId, workoutDay, cycleWeek };
  const validationResult =
    await validationService.validateGetLastCompletedWorkoutStructure(validationData);

  if (!validationResult.success) {
    const errorMessage = `Get last completed workout structure validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
    logger.error(
      'Get last completed workout structure validation failed',
      new Error(errorMessage),
      {
        context: { validationData, errors: validationResult.errors },
      },
    );
    throw new Error(errorMessage);
  }

  try {
    const { data, error } = await supabase
      .from('user_workout_history')
      .select('exercise_structure')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('workout_day', workoutDay)
      .eq('cycle_week', cycleWeek)
      .order('completed_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data?.exercise_structure) {
      if (error) {
        logger.error('Error fetching last workout structure from DB', error, {
          context: validationData,
        });
      }
      return null;
    }

    const { SavedExerciseStructureSchema } = await import('../validation/schemas');
    const exerciseStructureArray = validationService.safeParseJson(
      data.exercise_structure,
      z.array(SavedExerciseStructureSchema), // Validate as an array of SavedExerciseStructure
      'saved_exercise_structure',
      [], // Fallback to an empty array
    );

    if (!exerciseStructureArray || exerciseStructureArray.length === 0) {
      logger.warn('Failed to parse or validate exercise_structure, or it was empty', {
        context: validationData,
      });
      return null;
    }

    // Convert back to ExerciseData format
    // Ensure that the mapping correctly aligns with ExerciseData fields
    const exercises: ExerciseData[] = exerciseStructureArray.map((ex) => ({
      id: ex.id,
      exercise_id: ex.exercise_id,
      name: ex.name,
      sets: ex.sets,
      reps_range: ex.reps_range,
      image_url: ex.image_url,
      primary_muscles: ex.primary_muscles,
      requires_weight: ex.requires_weight,
      workout_day: ex.workout_day, // Ensure this field is present in SavedExerciseStructureSchema or handled if optional
      order: ex.order, // Ensure this field is present
      restTime: ex.restTime, // Ensure this field is present
      isChangedExercise: ex.isChangedExercise, // Ensure this field is present
      // Add any other fields required by ExerciseData, ensuring they exist on ex (SavedExerciseStructure)
    }));

    return exercises;
  } catch (error) {
    logger.error('Error processing last completed workout structure', error as Error, {
      context: validationData,
    });
    return null;
  }
};

// Check if workout is already completed for a specific cycle week
export const checkWorkoutCompletionForCycleWeek = async (
  userId: string,
  planId: string,
  workoutDay: number,
  cycleWeek: number,
): Promise<{
  isCompleted: boolean;
  completedWorkoutData?: CompletedWorkoutData;
}> => {
  // Validate input parameters
  const validationData = { userId, planId, workoutDay, cycleWeek };
  const validationResult =
    await validationService.validateCheckWorkoutCompletionForCycleWeek(validationData);

  if (!validationResult.success) {
    const errorMessage = `Check workout completion for cycle week validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
    logger.error(
      'Check workout completion for cycle week validation failed',
      new Error(errorMessage),
      {
        context: { validationData, errors: validationResult.errors },
      },
    );
    throw new Error(errorMessage);
  }

  if (!userId || !planId) {
    return { isCompleted: false };
  }

  try {
    // Check if there's a completed workout for this specific day AND cycle week
    const { data, error } = await supabase
      .from('user_workout_history')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('workout_day', workoutDay)
      .eq('cycle_week', cycleWeek); // This is the key difference - check for specific cycle week

    if (error) {
      console.error('Error checking workout completion for cycle week:', error);
      throw error;
    }

    if (data && data.length > 0) {
      // Workout is already completed for this specific cycle week, get the most recent one
      const mostRecentWorkout = (data as WorkoutHistoryRecord[]).sort(
        (a: WorkoutHistoryRecord, b: WorkoutHistoryRecord) =>
          new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
      )[0];

      // Get the count of exercises from the user_exercise_records table
      const { data: exerciseData } = await supabase
        .from('user_exercise_records')
        .select('exercise_id')
        .eq('workout_history_id', mostRecentWorkout.id)
        .limit(1000);

      // Set completed workout data
      const completedWorkoutData: CompletedWorkoutData = {
        completedExercises: exerciseData
          ? new Set(
              exerciseData.map((item: unknown) => {
                const record = item as Record<string, unknown>;
                return record.exercise_id;
              }),
            ).size
          : 0,
        duration: mostRecentWorkout.workout_duration || '00:00:00',
        caloriesBurned: mostRecentWorkout.calories_burned || 0,
        totalVolume: mostRecentWorkout.total_volume || 0,
        totalReps: mostRecentWorkout.total_reps || 0,
        completedAt: mostRecentWorkout.completed_at,
        weekName: mostRecentWorkout.week_name,
        cycleWeek: mostRecentWorkout.cycle_week,
      };

      return {
        isCompleted: true,
        completedWorkoutData,
      };
    } else {
      // Workout is not completed for this specific cycle week
      return { isCompleted: false };
    }
  } catch (error) {
    console.error('Error in checkWorkoutCompletionForCycleWeek:', error);
    return { isCompleted: false };
  }
};

// Helper function to get exercise recommendations (imported from cycle service)
const getExerciseRecommendations = async (
  userId: string,
  exerciseId: string,
  cycleWeek: number,
) => {
  try {
    const { data, error } = await supabase.rpc('get_smart_exercise_recommendations', {
      p_cycle_week: cycleWeek,
      p_exercise_id: exerciseId,
      p_user_id: userId,
    });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const recommendation = data[0];
    const cycleInfo = await getCycleWeekInfo(cycleWeek);

    return {
      previousWeight: recommendation.previous_weight,
      previousReps: recommendation.previous_reps,
      recommendedWeight: recommendation.recommended_weight,
      recommendedReps: recommendation.recommended_reps,
      recommendationText: recommendation.recommendation_text,
      weekAdjustmentPercentage: cycleInfo?.weightAdjustmentPercentage || 0,
      repsAdjustmentPercentage: cycleInfo?.repsAdjustmentPercentage || 0,
      weekName: cycleInfo?.weekName || 'Unknown',
    };
  } catch (error) {
    console.error('Error getting smart exercise recommendations:', error);
    return null;
  }
};

// Helper function to format workout duration
const formatWorkoutDuration = (workoutDuration: number): string => {
  const hours = Math.floor(workoutDuration / 3600);
  const minutes = Math.floor((workoutDuration % 3600) / 60);
  const seconds = workoutDuration % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Helper function to determine cycle week and week name for redo workouts
const determineRedoWorkoutWeek = async (
  userId: string,
  planId: string,
  workoutDay: number,
  originalCycleWeek: number | null,
): Promise<{ cycleWeek: number; weekName: string }> => {
  try {
    const { data: historyData } = await supabase
      .from('user_workout_history')
      .select('cycle_week, week_name')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('workout_day', workoutDay)
      .order('completed_at', { ascending: false })
      .limit(1);

    if (historyData && historyData.length > 0) {
      return {
        cycleWeek: historyData[0].cycle_week,
        weekName: historyData[0].week_name,
      };
    }

    if (originalCycleWeek !== null) {
      const weekNames: Record<number, string> = {
        1: 'Adaptation',
        2: 'Accumulation',
        3: 'Intensification',
        4: 'Peak',
        5: 'Deload',
      };
      return {
        cycleWeek: originalCycleWeek,
        weekName: weekNames[originalCycleWeek] || 'Adaptation',
      };
    }
  } catch {
    // Error fetching original workout data
  }

  // Fallback
  return { cycleWeek: 1, weekName: 'Adaptation' };
};

// Helper function to create exercise structure for saving
const createExerciseStructure = (exercises: ExerciseData[]): SavedExerciseStructure[] => {
  return exercises.map((exercise) => ({
    id: exercise.id,
    exercise_id: exercise.exercise_id,
    name: exercise.name,
    sets: exercise.sets,
    reps_range: exercise.reps_range,
    image_url: exercise.image_url,
    primary_muscles: exercise.primary_muscles,
    requires_weight: exercise.requires_weight ?? true,
    workout_day: exercise.workout_day,
    order: exercise.order,
    restTime: exercise.restTime ?? 60,
    isChangedExercise:
      (exercise as ExerciseData & { isChangedExercise?: boolean }).isChangedExercise || false,
  }));
};

// Helper function to insert workout history
const insertWorkoutHistory = async (options: {
  userId: string;
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
  formattedDuration: string;
  workoutDuration: number;
  totalVolume: number;
  totalReps: number;
  exercises: ExerciseData[];
  exerciseStructure: SavedExerciseStructure[];
}): Promise<string> => {
  const {
    userId,
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    formattedDuration,
    workoutDuration,
    totalVolume,
    totalReps,
    exercises,
    exerciseStructure,
  } = options;

  const workoutDurationMinutes = Math.round(workoutDuration / 60);

  // Prepare workout history data for validation
  const workoutHistoryData = {
    user_id: userId,
    plan_id: planId,
    workout_day: workoutDay,
    cycle_week: cycleWeek,
    week_name: weekName,
    workout_duration: formattedDuration,
    calories_burned: Math.round(workoutDurationMinutes * 8.5),
    total_volume: totalVolume,
    total_reps: totalReps,
    completed_at: new Date().toISOString(),
    exercises_count: exercises.length,
    exercise_structure: JSON.stringify(exerciseStructure),
  };

  // Validate workout history data
  try {
    const validationResult =
      await validationService.validateWorkoutHistoryRecord(workoutHistoryData);

    if (!validationResult.success) {
      const errorMessage = `Workout history validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
      console.error(errorMessage, { workoutHistoryData, errors: validationResult.errors });
      throw new Error(errorMessage);
    }
  } catch (validationError) {
    console.error('Validation error in insertWorkoutHistory:', validationError);
    throw validationError;
  }

  const { data: workoutData, error: workoutError } = await supabase
    .from('user_workout_history')
    .insert({
      user_id: userId,
      plan_id: planId,
      workout_day: workoutDay,
      cycle_week: cycleWeek,
      week_name: weekName,
      workout_duration: formattedDuration,
      calories_burned: Math.round(workoutDurationMinutes * 8.5),
      total_volume: totalVolume,
      total_reps: totalReps,
      completed_at: new Date().toISOString(),
      exercises_count: exercises.length,
      exercise_structure: JSON.stringify(exerciseStructure),
    })
    .select('id')
    .single();

  if (workoutError) {
    throw workoutError;
  }

  if (!workoutData) {
    throw new Error('Failed to create workout history record');
  }

  return workoutData.id;
};

// Helper function to create exercise records
const createExerciseRecords = (
  exercises: ExerciseData[],
  exerciseSets: Record<string, ExerciseSet[]>,
  workoutHistoryId: string,
): Array<{
  workout_history_id: string;
  exercise_id: string;
  workout_plan_exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  completed: boolean;
}> => {
  const exerciseRecords = [];

  for (const exercise of exercises) {
    const sets = exerciseSets[exercise.id] || [];

    for (const set of sets) {
      if (set.isCompleted) {
        const weight = set.weight === '-' || set.weight === '' ? '0' : set.weight;
        const reps = set.reps === '-' || set.reps === '' ? '0' : set.reps;

        const record = {
          workout_history_id: workoutHistoryId,
          exercise_id: exercise.exercise_id,
          workout_plan_exercise_id: exercise.id,
          set_number: set.setNumber,
          weight: weight ? parseFloat(weight) : 0,
          reps: reps ? parseInt(reps) : 0,
          completed: set.isCompleted,
        };

        exerciseRecords.push(record);
      }
    }
  }

  return exerciseRecords;
};

// Helper function to insert exercise records
const insertExerciseRecords = async (exerciseRecords: unknown[]): Promise<void> => {
  if (exerciseRecords.length > 0) {
    // Validate exercise records before insertion
    try {
      const validationResult = await validationService.validateExerciseRecords(exerciseRecords);

      if (!validationResult.success) {
        const errorMessage = `Exercise records validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
        console.error(errorMessage, { exerciseRecords, errors: validationResult.errors });
        throw new Error(errorMessage);
      }
    } catch (validationError) {
      console.error('Validation error in insertExerciseRecords:', validationError);
      throw validationError;
    }

    const { error: recordsError } = await supabase
      .from('user_exercise_records')
      .insert(exerciseRecords);

    if (recordsError) {
      console.error('Error saving exercise records:', recordsError);
      throw recordsError;
    }
  }
};

// Helper function to calculate plan progression
const calculatePlanProgression = (
  completedWorkouts: number,
  currentWeek: number,
  currentDay: number,
  isRedoWorkout: boolean,
): {
  newCompletedWorkouts: number;
  updatedWeek: number;
  updatedDay: number;
  updatedCompleted: boolean;
} => {
  let newCompletedWorkouts = completedWorkouts || 0;
  let updatedWeek = currentWeek;
  let updatedDay = currentDay;
  let updatedCompleted = false;

  if (!isRedoWorkout) {
    newCompletedWorkouts += 1;
    const workoutsPerWeek = 3;

    if (newCompletedWorkouts % workoutsPerWeek === 0) {
      if (currentWeek < 5) {
        updatedWeek = currentWeek + 1;
      } else if (currentWeek === 5) {
        updatedCompleted = true;
      }
    }

    updatedDay = (currentDay + 1) % workoutsPerWeek;
  }

  return {
    newCompletedWorkouts,
    updatedWeek,
    updatedDay,
    updatedCompleted,
  };
};

// Helper function to update active plan
const updateActivePlan = async (
  userId: string,
  planId: string,
  isRedoWorkout: boolean,
  progression: {
    newCompletedWorkouts: number;
    updatedWeek: number;
    updatedDay: number;
    updatedCompleted: boolean;
  },
): Promise<void> => {
  const updateData = isRedoWorkout
    ? {
        last_workout_date: new Date().toISOString(),
      }
    : {
        completed_workouts: progression.newCompletedWorkouts,
        current_week: progression.updatedWeek,
        current_day: progression.updatedDay,
        last_workout_date: new Date().toISOString(),
        completed: progression.updatedCompleted,
      };

  const { error: updateError } = await supabase
    .from('user_active_plans')
    .update(updateData)
    .eq('user_id', userId)
    .eq('plan_id', planId)
    .eq('is_active', true);

  if (updateError) {
    throw updateError;
  }
};

// Complete a workout and save all data
export const completeWorkout = async (options: CompleteWorkoutOptions): Promise<boolean> => {
  // Validate input data
  try {
    const validationResult = await validationService.validateCompleteWorkoutOptions(options);

    if (!validationResult.success) {
      const errorMessage = `Workout completion validation failed: ${validationResult.errors.map((e) => e.message).join(', ')}`;
      logger.error('Workout completion validation failed', new Error(errorMessage), {
        context: { options, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }
  } catch (validationError) {
    console.error('Validation error in completeWorkout:', validationError);
    return false;
  }

  const {
    userId,
    planId,
    workoutDay,
    cycleWeek,
    weekName,
    exercises,
    exerciseSets,
    workoutDuration,
    totalVolume,
    totalReps,
    isRedoWorkout = false,
    originalCycleWeek = null,
  } = options;

  try {
    const formattedDuration = formatWorkoutDuration(workoutDuration);

    // Determine cycle week and week name for redo workouts
    let workoutCycleWeek = cycleWeek;
    let workoutWeekName = weekName;

    if (isRedoWorkout) {
      const redoWeekInfo = await determineRedoWorkoutWeek(
        userId,
        planId,
        workoutDay,
        originalCycleWeek,
      );
      workoutCycleWeek = redoWeekInfo.cycleWeek;
      workoutWeekName = redoWeekInfo.weekName;
    }

    // Create exercise structure for saving
    const exerciseStructure = createExerciseStructure(exercises);

    // Insert workout history
    const workoutHistoryId = await insertWorkoutHistory({
      userId,
      planId,
      workoutDay,
      cycleWeek: workoutCycleWeek,
      weekName: workoutWeekName,
      formattedDuration,
      workoutDuration,
      totalVolume,
      totalReps,
      exercises,
      exerciseStructure,
    });

    // Create and insert exercise records
    const exerciseRecords = createExerciseRecords(exercises, exerciseSets, workoutHistoryId);
    await insertExerciseRecords(exerciseRecords);

    // Update user active plan
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('completed_workouts, current_week, current_day')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();

    if (planError) {
      throw planError;
    }

    if (planData) {
      const { completed_workouts, current_week, current_day } = planData;
      const progression = calculatePlanProgression(
        completed_workouts,
        current_week,
        current_day,
        isRedoWorkout,
      );

      await updateActivePlan(userId, planId, isRedoWorkout, progression);
    }

    return true;
  } catch {
    return false;
  }
};
export default function disablewarn() {
  return null;
}
