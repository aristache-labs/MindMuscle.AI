import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Sentry from '@sentry/react-native';
import { logger } from '../utils/logger';
import supabase from './supabase';
import { validationService } from './validationService';

// Key for the paused workout in AsyncStorage
const PAUSED_WORKOUT_KEY = 'mindmuscle_paused_workout';

// Interface for exercise data in workout session
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
  muscle_group?: string;
  isChangedExercise?: boolean;
}

// Interface for exercise set in workout session
export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

// Interface for paused workout data
export interface PausedWorkoutData {
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
  currentExerciseIndex: number;
  originalCycleWeek?: number | null;
  pausedAt?: string;
}

// Interface for save paused workout options
export interface SavePausedWorkoutOptions {
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
  currentExerciseIndex: number;
  originalCycleWeek?: number | null;
}

// Interface for database paused workout record
interface DatabasePausedWorkout {
  user_id: string;
  plan_id: string;
  workout_day: number;
  cycle_week: number;
  week_name: string;
  exercises: ExerciseData[];
  exercise_sets: Record<string, ExerciseSet[]>;
  workout_duration: number;
  total_volume: number;
  total_reps: number;
  current_exercise_index: number;
  original_cycle_week: number | null;
  paused_at: string;
}

// Interface for exercise details
interface ExerciseDetails {
  id: string;
  name: string;
  image_url?: string;
  primary_muscles: string[];
  secondary_muscles: string[];
}

// Interface for exercise weight data point
interface ExerciseWeightDataPoint {
  date: string;
  value: number;
  reps?: number;
}

// Interface for absolute max weight record
interface AbsoluteMaxWeightRecord {
  weight: number;
  reps: number;
  date: string;
}

// REMOVED: processSwitchedExercises - no longer needed with simplified approach

// Save the paused workout state
export const savePausedWorkout = async (options: SavePausedWorkoutOptions): Promise<boolean> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Saving paused workout',
      category: 'workout.session',
      data: {
        userId: options.userId,
        planId: options.planId,
        workoutDay: options.workoutDay,
        cycleWeek: options.cycleWeek,
        exerciseCount: options.exercises.length,
      },
      level: 'info',
    });

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
      currentExerciseIndex,
      originalCycleWeek = null,
    } = options;

    // Validate required parameters
    if (!userId || !planId || workoutDay === undefined) {
      const error = new Error('Missing required parameters for saving paused workout');
      Sentry.captureException(error, {
        tags: { operation: 'savePausedWorkout', step: 'validation' },
        extra: { userId, planId, workoutDay },
      });
      throw error;
    }

    console.log('SAVING PAUSED WORKOUT - User ID:', userId, 'Plan ID:', planId, 'Day:', workoutDay);

    // SIMPLIFIED: Just save the exercises exactly as they are - no processing needed
    // The exercises array already contains the current state with any customizations applied

    // Create a paused workout object with all necessary data
    const pausedWorkout: PausedWorkoutData = {
      userId,
      planId,
      workoutDay,
      cycleWeek,
      weekName,
      exercises, // Save exercises exactly as they are
      exerciseSets,
      workoutDuration,
      totalVolume,
      totalReps,
      currentExerciseIndex,
      originalCycleWeek,
      pausedAt: new Date().toISOString(),
    };

    // Validate the paused workout data before saving
    const validationResult = await validationService.validatePausedWorkoutData(pausedWorkout);

    if (!validationResult.success) {
      const errorMessage = `Invalid paused workout data: ${validationResult.errors.map((e) => e.message).join(', ')}`;

      Sentry.captureException(new Error(errorMessage), {
        tags: { operation: 'savePausedWorkout', step: 'data_validation' },
        extra: {
          pausedWorkout,
          validationErrors: validationResult.errors,
          userId,
          planId,
          workoutDay,
        },
      });

      logger.error('Cannot save invalid paused workout data', new Error(errorMessage), {
        context: { pausedWorkout, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    // Save to AsyncStorage
    Sentry.addBreadcrumb({
      message: 'Saving paused workout to AsyncStorage',
      category: 'workout.session',
      data: { userId, planId, workoutDay },
      level: 'debug',
    });

    await AsyncStorage.setItem(PAUSED_WORKOUT_KEY, JSON.stringify(validationResult.data));

    // Save to Supabase for cross-device sync
    if (userId) {
      Sentry.addBreadcrumb({
        message: 'Saving paused workout to Supabase',
        category: 'workout.session',
        data: { userId, planId, workoutDay },
        level: 'debug',
      });

      const { error } = await supabase.from('user_paused_workouts').upsert(
        {
          user_id: userId,
          plan_id: planId,
          workout_day: workoutDay,
          cycle_week: cycleWeek,
          week_name: weekName,
          exercises, // Save exercises exactly as they are
          exercise_sets: exerciseSets,
          workout_duration: workoutDuration,
          total_volume: totalVolume,
          total_reps: totalReps,
          current_exercise_index: currentExerciseIndex,
          original_cycle_week: originalCycleWeek,
          paused_at: new Date().toISOString(),
        },
        { onConflict: 'user_id, plan_id, workout_day' },
      );

      if (error) {
        Sentry.captureException(error, {
          tags: { operation: 'savePausedWorkout', step: 'supabase_save' },
          extra: { userId, planId, workoutDay },
        });
        console.error('Error saving paused workout to Supabase:', error);
        // Continue anyway since we saved locally
      }
    }

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: 'Successfully saved paused workout',
      category: 'workout.session',
      data: {
        userId,
        planId,
        workoutDay,
        exerciseCount: exercises.length,
        duration,
      },
      level: 'info',
    });

    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: { operation: 'savePausedWorkout' },
      extra: {
        userId: options.userId,
        planId: options.planId,
        workoutDay: options.workoutDay,
        duration,
      },
    });
    console.error('Error saving paused workout:', error);
    return false;
  }
};

// Helper function to get paused workout from AsyncStorage
const getPausedWorkoutFromStorage = async (): Promise<PausedWorkoutData | null> => {
  try {
    Sentry.addBreadcrumb({
      message: 'Getting paused workout from AsyncStorage',
      category: 'workout.session',
      level: 'debug',
    });

    const pausedWorkoutJson = await AsyncStorage.getItem(PAUSED_WORKOUT_KEY);
    if (!pausedWorkoutJson) {
      Sentry.addBreadcrumb({
        message: 'No paused workout found in AsyncStorage',
        category: 'workout.session',
        level: 'debug',
      });
      return null;
    }

    // Validate the parsed paused workout data using Zod
    const validationResult = await validationService.validatePausedWorkoutData(
      JSON.parse(pausedWorkoutJson),
    );

    if (validationResult.success) {
      Sentry.addBreadcrumb({
        message: 'Successfully retrieved and validated paused workout from AsyncStorage',
        category: 'workout.session',
        data: {
          planId: (validationResult.data as PausedWorkoutData).planId,
          workoutDay: (validationResult.data as PausedWorkoutData).workoutDay,
        },
        level: 'info',
      });
      return validationResult.data as PausedWorkoutData;
    } else {
      Sentry.addBreadcrumb({
        message: 'Invalid paused workout data found in AsyncStorage, clearing it',
        category: 'workout.session',
        data: { validationErrors: validationResult.errors },
        level: 'warning',
      });

      logger.warn('Invalid paused workout data found in storage, clearing it', {
        context: { errors: validationResult.errors },
      });
      // Clear invalid data
      await AsyncStorage.removeItem(PAUSED_WORKOUT_KEY);
      return null;
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'getPausedWorkoutFromStorage' },
    });
    return null;
  }
};

// Helper function to validate paused workout against requested parameters
const validatePausedWorkout = (
  pausedWorkout: PausedWorkoutData,
  planId?: string,
  workoutDay?: number,
): boolean => {
  try {
    Sentry.addBreadcrumb({
      message: 'Validating paused workout against requested parameters',
      category: 'workout.session',
      data: {
        pausedWorkoutPlanId: pausedWorkout.planId,
        pausedWorkoutDay: pausedWorkout.workoutDay,
        requestedPlanId: planId,
        requestedWorkoutDay: workoutDay,
      },
      level: 'debug',
    });

    if (planId && workoutDay !== undefined) {
      const isValid = pausedWorkout.planId === planId && pausedWorkout.workoutDay === workoutDay;

      Sentry.addBreadcrumb({
        message: 'Paused workout validation result',
        category: 'workout.session',
        data: { isValid, planId, workoutDay },
        level: 'debug',
      });

      return isValid;
    }
    return true;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'validatePausedWorkout' },
      extra: { planId, workoutDay },
    });
    return false;
  }
};

// Helper function to log switched exercises
const logSwitchedExercises = (
  exercises: ExerciseData[],
  exerciseSets: Record<string, ExerciseSet[]>,
  source: string,
): void => {
  try {
    const switchedExercises = exercises.filter((ex) => ex.isChangedExercise === true);

    if (switchedExercises.length > 0) {
      Sentry.addBreadcrumb({
        message: `Found switched exercises in ${source}`,
        category: 'workout.session',
        data: {
          source,
          switchedCount: switchedExercises.length,
          switchedExerciseIds: switchedExercises.map((ex) => ex.id),
        },
        level: 'info',
      });

      console.log(
        `GETTING PAUSED WORKOUT - Found switched exercises in ${source}:`,
        JSON.stringify(switchedExercises),
      );
      console.log(
        `GETTING PAUSED WORKOUT - Exercise sets for switched exercises from ${source}:`,
        JSON.stringify(
          switchedExercises.map((ex) => ({
            id: ex.id,
            sets: exerciseSets[ex.id],
          })),
        ),
      );
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { operation: 'logSwitchedExercises' },
      extra: { source, exerciseCount: exercises.length },
    });
  }
};

// Helper function to convert database record to app format
const convertDatabaseToAppFormat = (dbRecord: DatabasePausedWorkout): PausedWorkoutData => {
  return {
    userId: dbRecord.user_id,
    planId: dbRecord.plan_id,
    workoutDay: dbRecord.workout_day,
    cycleWeek: dbRecord.cycle_week,
    weekName: dbRecord.week_name,
    exercises: dbRecord.exercises,
    exerciseSets: dbRecord.exercise_sets,
    workoutDuration: dbRecord.workout_duration,
    totalVolume: dbRecord.total_volume,
    totalReps: dbRecord.total_reps,
    currentExerciseIndex: dbRecord.current_exercise_index,
    originalCycleWeek: dbRecord.original_cycle_week,
    pausedAt: dbRecord.paused_at,
  };
};

// Helper function to get paused workout from database
const getPausedWorkoutFromDatabase = async (
  userId: string,
  planId?: string,
  workoutDay?: number,
): Promise<PausedWorkoutData | null> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Getting paused workout from database',
      category: 'workout.session',
      data: { userId, planId, workoutDay },
      level: 'info',
    });

    let query = supabase.from('user_paused_workouts').select('*').eq('user_id', userId);

    // Add plan and day filters if provided
    if (planId) query = query.eq('plan_id', planId);
    if (workoutDay !== undefined) query = query.eq('workout_day', workoutDay);

    // Order by most recent
    query = query.order('paused_at', { ascending: false }).limit(1);

    const { data, error } = await query;

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'getPausedWorkoutFromDatabase', step: 'database_query' },
        extra: { userId, planId, workoutDay },
      });
      console.log('GETTING PAUSED WORKOUT - Error fetching from database:', error);
      return null;
    }

    if (!data || data.length === 0) {
      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'No paused workout found in database',
        category: 'workout.session',
        data: { userId, planId, workoutDay, duration },
        level: 'info',
      });
      return null;
    }

    console.log('GETTING PAUSED WORKOUT - Found paused workout in database');

    // Convert from database format to application format
    const pausedWorkout = convertDatabaseToAppFormat(data[0] as DatabasePausedWorkout);

    // Log switched exercises if any
    if (pausedWorkout.exercises) {
      logSwitchedExercises(pausedWorkout.exercises, pausedWorkout.exerciseSets, 'database');
    }

    // Save to AsyncStorage for offline access
    await AsyncStorage.setItem(PAUSED_WORKOUT_KEY, JSON.stringify(pausedWorkout));

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: 'Successfully retrieved paused workout from database',
      category: 'workout.session',
      data: {
        userId,
        planId: pausedWorkout.planId,
        workoutDay: pausedWorkout.workoutDay,
        duration,
      },
      level: 'info',
    });

    return pausedWorkout;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: { operation: 'getPausedWorkoutFromDatabase' },
      extra: { userId, planId, workoutDay, duration },
    });
    return null;
  }
};

// Check if there's a paused workout to resume
export const getPausedWorkout = async (
  userId?: string,
  planId?: string,
  workoutDay?: number,
): Promise<PausedWorkoutData | null> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Getting paused workout',
      category: 'workout.session',
      data: { userId, planId, workoutDay },
      level: 'info',
    });

    console.log(
      'GETTING PAUSED WORKOUT - User ID:',
      userId,
      'Plan ID:',
      planId,
      'Day:',
      workoutDay,
    );

    let pausedWorkout: PausedWorkoutData | null = null;

    // If we have a user ID, prioritize database to get the latest customization data
    if (userId) {
      pausedWorkout = await getPausedWorkoutFromDatabase(userId, planId, workoutDay);

      if (pausedWorkout) {
        console.log('GETTING PAUSED WORKOUT - Found paused workout in database');
        // Database data is authoritative, return it
        const duration = Date.now() - startTime;
        Sentry.addBreadcrumb({
          message: 'Successfully retrieved paused workout from database',
          category: 'workout.session',
          data: {
            userId,
            planId,
            workoutDay,
            found: true,
            duration,
          },
          level: 'info',
        });
        return pausedWorkout;
      }
    }

    // Fallback to AsyncStorage if no database result (works offline)
    pausedWorkout = await getPausedWorkoutFromStorage();

    if (pausedWorkout) {
      console.log('GETTING PAUSED WORKOUT - Found paused workout in AsyncStorage');

      // Log switched exercises if any
      if (pausedWorkout.exercises) {
        logSwitchedExercises(pausedWorkout.exercises, pausedWorkout.exerciseSets, 'AsyncStorage');
      }

      // Validate against requested parameters
      if (!validatePausedWorkout(pausedWorkout, planId, workoutDay)) {
        Sentry.addBreadcrumb({
          message: 'Paused workout does not match requested plan/day',
          category: 'workout.session',
          data: {
            pausedPlanId: pausedWorkout.planId,
            pausedWorkoutDay: pausedWorkout.workoutDay,
            requestedPlanId: planId,
            requestedWorkoutDay: workoutDay,
          },
          level: 'warning',
        });
        console.log('GETTING PAUSED WORKOUT - Paused workout does not match requested plan/day');
        pausedWorkout = null;
      }
    }

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: pausedWorkout ? 'Successfully retrieved paused workout' : 'No paused workout found',
      category: 'workout.session',
      data: {
        userId,
        planId,
        workoutDay,
        found: !!pausedWorkout,
        duration,
      },
      level: 'info',
    });

    return pausedWorkout;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: { operation: 'getPausedWorkout' },
      extra: { userId, planId, workoutDay, duration },
    });
    console.error('Error getting paused workout:', error);
    return null;
  }
};

// Clear the paused workout
export const clearPausedWorkout = async (
  userId?: string,
  planId?: string,
  workoutDay?: number,
): Promise<boolean> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Clearing paused workout',
      category: 'workout.session',
      data: { userId, planId, workoutDay },
      level: 'info',
    });

    // Clear from AsyncStorage
    await AsyncStorage.removeItem(PAUSED_WORKOUT_KEY);

    Sentry.addBreadcrumb({
      message: 'Cleared paused workout from AsyncStorage',
      category: 'workout.session',
      level: 'debug',
    });

    // If we have a user ID, clear from Supabase too
    if (userId && planId && workoutDay !== undefined) {
      const { error } = await supabase
        .from('user_paused_workouts')
        .delete()
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('workout_day', workoutDay);

      if (error) {
        Sentry.captureException(error, {
          tags: { operation: 'clearPausedWorkout', step: 'supabase_delete' },
          extra: { userId, planId, workoutDay },
        });
        console.error('Error clearing paused workout from Supabase:', error);
        // Continue anyway since we cleared locally
      } else {
        Sentry.addBreadcrumb({
          message: 'Cleared paused workout from Supabase',
          category: 'workout.session',
          data: { userId, planId, workoutDay },
          level: 'debug',
        });
      }
    }

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: 'Successfully cleared paused workout',
      category: 'workout.session',
      data: { userId, planId, workoutDay, duration },
      level: 'info',
    });

    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: { operation: 'clearPausedWorkout' },
      extra: { userId, planId, workoutDay, duration },
    });
    console.error('Error clearing paused workout:', error);
    return false;
  }
};

// Fetch detailed exercise information by exercise ID
export const fetchExerciseDetails = async (exerciseId: string): Promise<ExerciseDetails | null> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Fetching exercise details',
      category: 'workout.session',
      data: { exerciseId },
      level: 'info',
    });

    if (!exerciseId) {
      const error = new Error('Exercise ID is required');
      Sentry.captureException(error, {
        tags: { operation: 'fetchExerciseDetails', step: 'validation' },
        extra: { exerciseId },
      });
      throw error;
    }

    // Fetch complete exercise data from the exercises table
    const { data: exerciseData, error } = await supabase
      .from('exercises')
      .select('id, name, image_url, primary_muscles, secondary_muscles')
      .eq('id', exerciseId)
      .single();

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'fetchExerciseDetails', step: 'database_query' },
        extra: { exerciseId },
      });
      throw error;
    }

    if (exerciseData) {
      const result = {
        id: exerciseData.id,
        name: exerciseData.name,
        image_url: exerciseData.image_url,
        primary_muscles: Array.isArray(exerciseData.primary_muscles)
          ? exerciseData.primary_muscles
          : [],
        secondary_muscles: Array.isArray(exerciseData.secondary_muscles)
          ? exerciseData.secondary_muscles
          : [],
      };

      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Successfully fetched exercise details',
        category: 'workout.session',
        data: {
          exerciseId,
          exerciseName: result.name,
          primaryMusclesCount: result.primary_muscles.length,
          secondaryMusclesCount: result.secondary_muscles.length,
          duration,
        },
        level: 'info',
      });

      return result;
    }

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: 'No exercise data found',
      category: 'workout.session',
      data: { exerciseId, duration },
      level: 'warning',
    });

    return null;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: { operation: 'fetchExerciseDetails' },
      extra: { exerciseId, duration },
    });
    throw error;
  }
};

// Interface for exercise record from database
interface ExerciseRecord {
  weight: string;
  reps: string;
  created_at: string;
  workout_history_id: string;
  user_workout_history: {
    completed_at: string;
    user_id: string;
    id: string;
  }[];
}

// Fetch exercise history data for trending graph and max weight
export const fetchExerciseMaxWeightData = async (
  userId: string,
  exerciseId: string,
  limit: number = 10,
): Promise<ExerciseWeightDataPoint[]> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Fetching exercise max weight data',
      category: 'workout.session',
      data: { userId, exerciseId, limit },
      level: 'info',
    });

    if (!userId || !exerciseId) {
      Sentry.addBreadcrumb({
        message: 'Missing required parameters for exercise max weight data',
        category: 'workout.session',
        data: { userId, exerciseId },
        level: 'warning',
      });
      return [];
    }

    // Query to get all completed exercise records with proper date filtering
    const { data: exerciseRecords, error } = await supabase
      .from('user_exercise_records')
      .select(
        `
        weight,
        reps,
        created_at,
        workout_history_id,
        user_workout_history!inner(
          completed_at,
          user_id,
          id
        )
      `,
      )
      .eq('exercise_id', exerciseId)
      .eq('user_workout_history.user_id', userId)
      .eq('completed', true)
      .not('weight', 'is', null)
      .neq('weight', 0)
      .order('user_workout_history(completed_at)', { ascending: true }); // Order by date ascending for trend

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'fetchExerciseMaxWeightData', step: 'database_query' },
        extra: { userId, exerciseId, limit },
      });
      console.error('Error fetching exercise history data:', error);
      return [];
    }

    if (!exerciseRecords || exerciseRecords.length === 0) {
      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'No exercise records found',
        category: 'workout.session',
        data: { userId, exerciseId, duration },
        level: 'info',
      });
      return [];
    }

    Sentry.addBreadcrumb({
      message: 'Processing exercise records for max weight data',
      category: 'workout.session',
      data: {
        userId,
        exerciseId,
        recordCount: exerciseRecords.length,
      },
      level: 'debug',
    });

    // Group by workout session (date) and find max weight per session
    const sessionData = new Map<
      string,
      {
        date: string;
        maxWeight: number;
        reps: number;
        completedAt: Date;
      }
    >();

    (exerciseRecords as ExerciseRecord[]).forEach((record) => {
      const workoutHistoryId = record.workout_history_id;
      const weight = parseFloat(record.weight);
      const reps = parseInt(record.reps) || 0;
      const completedAt = new Date(record.user_workout_history[0]?.completed_at);

      if (workoutHistoryId && !isNaN(weight) && weight > 0) {
        const existing = sessionData.get(workoutHistoryId);
        if (!existing || weight > existing.maxWeight) {
          sessionData.set(workoutHistoryId, {
            date: completedAt.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
            }),
            maxWeight: weight,
            reps: reps,
            completedAt: completedAt,
          });
        }
      }
    });

    // Convert to array, sort by date, and take most recent sessions for trending
    const trendingData = Array.from(sessionData.values())
      .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
      .slice(-limit) // Take the most recent sessions
      .map((item) => ({
        date: item.date,
        value: item.maxWeight,
        reps: item.reps,
      }));

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: 'Successfully processed exercise max weight data',
      category: 'workout.session',
      data: {
        userId,
        exerciseId,
        rawRecordCount: exerciseRecords.length,
        sessionCount: sessionData.size,
        trendingDataPoints: trendingData.length,
        duration,
      },
      level: 'info',
    });

    return trendingData;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: { operation: 'fetchExerciseMaxWeightData' },
      extra: { userId, exerciseId, limit, duration },
    });
    console.error('Error in fetchExerciseMaxWeightData:', error);
    return [];
  }
};

// Interface for max weight record from database
interface MaxWeightRecord {
  weight: string;
  reps: string;
  user_workout_history:
    | {
        completed_at: string;
        user_id: string;
      }
    | {
        completed_at: string;
        user_id: string;
      }[];
}

// Fetch the absolute max weight ever lifted for an exercise
export const fetchExerciseAbsoluteMaxWeight = async (
  userId: string,
  exerciseId: string,
): Promise<AbsoluteMaxWeightRecord | null> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Fetching exercise absolute max weight',
      category: 'workout.session',
      data: { userId, exerciseId },
      level: 'info',
    });

    if (!userId || !exerciseId) {
      Sentry.addBreadcrumb({
        message: 'Missing required parameters for absolute max weight',
        category: 'workout.session',
        data: { userId, exerciseId },
        level: 'warning',
      });
      return null;
    }

    // Query to get the highest weight ever lifted for this exercise
    const { data: maxWeightRecords, error } = await supabase
      .from('user_exercise_records')
      .select(
        `
        weight,
        reps,
        user_workout_history!inner(
          completed_at,
          user_id
        )
      `,
      )
      .eq('exercise_id', exerciseId)
      .eq('user_workout_history.user_id', userId)
      .eq('completed', true)
      .not('weight', 'is', null)
      .neq('weight', 0)
      .order('weight', { ascending: false })
      .limit(1);

    if (error) {
      Sentry.captureException(error, {
        tags: { operation: 'fetchExerciseAbsoluteMaxWeight', step: 'database_query' },
        extra: { userId, exerciseId },
      });
      console.error('Error fetching absolute max weight:', error);
      return null;
    }

    if (!maxWeightRecords || maxWeightRecords.length === 0) {
      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'No max weight records found',
        category: 'workout.session',
        data: { userId, exerciseId, duration },
        level: 'info',
      });
      return null;
    }

    const maxWeightRecord = maxWeightRecords[0] as MaxWeightRecord;
    const weight = parseFloat(maxWeightRecord.weight);
    const reps = parseInt(maxWeightRecord.reps) || 0;
    const workoutHistory = Array.isArray(maxWeightRecord.user_workout_history)
      ? maxWeightRecord.user_workout_history[0]
      : maxWeightRecord.user_workout_history;
    const completedAt = new Date(workoutHistory?.completed_at);

    const result = {
      weight: weight,
      reps: reps,
      date: completedAt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    };

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: 'Successfully fetched absolute max weight',
      category: 'workout.session',
      data: {
        userId,
        exerciseId,
        maxWeight: result.weight,
        maxReps: result.reps,
        maxDate: result.date,
        duration,
      },
      level: 'info',
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: { operation: 'fetchExerciseAbsoluteMaxWeight' },
      extra: { userId, exerciseId, duration },
    });
    console.error('Error in fetchExerciseAbsoluteMaxWeight:', error);
    return null;
  }
};

export default function disablewarn() {
  return null;
}
