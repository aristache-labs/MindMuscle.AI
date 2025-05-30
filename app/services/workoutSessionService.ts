import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from './supabase';

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

// Helper function to process switched exercises
const processSwitchedExercises = (exercises: ExerciseData[]): ExerciseData[] => {
  const switchedExercises = exercises.filter((ex) => ex.isChangedExercise === true);

  if (switchedExercises.length > 0) {
    console.log(
      'SAVING PAUSED WORKOUT - Found switched exercises:',
      JSON.stringify(switchedExercises),
    );

    // Make sure the isChangedExercise flag is properly set for all switched exercises
    return exercises.map((ex) => {
      if (switchedExercises.some((switched) => switched.id === ex.id)) {
        return {
          ...ex,
          isChangedExercise: true,
        };
      }
      return ex;
    });
  }

  return exercises;
};

// Save the paused workout state
export const savePausedWorkout = async (options: SavePausedWorkoutOptions): Promise<boolean> => {
  try {
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

    console.log('SAVING PAUSED WORKOUT - User ID:', userId, 'Plan ID:', planId, 'Day:', workoutDay);

    // Process switched exercises
    const processedExercises = processSwitchedExercises(exercises);

    // Create a paused workout object with all necessary data
    const pausedWorkout: PausedWorkoutData = {
      userId,
      planId,
      workoutDay,
      cycleWeek,
      weekName,
      exercises: processedExercises,
      exerciseSets,
      workoutDuration,
      totalVolume,
      totalReps,
      currentExerciseIndex,
      originalCycleWeek,
      pausedAt: new Date().toISOString(),
    };

    // Save to AsyncStorage
    await AsyncStorage.setItem(PAUSED_WORKOUT_KEY, JSON.stringify(pausedWorkout));

    // Save to Supabase for cross-device sync
    if (userId) {
      const { error } = await supabase.from('user_paused_workouts').upsert(
        {
          user_id: userId,
          plan_id: planId,
          workout_day: workoutDay,
          cycle_week: cycleWeek,
          week_name: weekName,
          exercises: processedExercises,
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
        console.error('Error saving paused workout to Supabase:', error);
        // Continue anyway since we saved locally
      }
    }

    return true;
  } catch (error) {
    console.error('Error saving paused workout:', error);
    return false;
  }
};

// Helper function to get paused workout from AsyncStorage
const getPausedWorkoutFromStorage = async (): Promise<PausedWorkoutData | null> => {
  const pausedWorkoutJson = await AsyncStorage.getItem(PAUSED_WORKOUT_KEY);
  return pausedWorkoutJson ? JSON.parse(pausedWorkoutJson) : null;
};

// Helper function to validate paused workout against requested parameters
const validatePausedWorkout = (
  pausedWorkout: PausedWorkoutData,
  planId?: string,
  workoutDay?: number,
): boolean => {
  if (planId && workoutDay !== undefined) {
    return pausedWorkout.planId === planId && pausedWorkout.workoutDay === workoutDay;
  }
  return true;
};

// Helper function to log switched exercises
const logSwitchedExercises = (
  exercises: ExerciseData[],
  exerciseSets: Record<string, ExerciseSet[]>,
  source: string,
): void => {
  const switchedExercises = exercises.filter((ex) => ex.isChangedExercise === true);
  if (switchedExercises.length > 0) {
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
};

// Helper function to convert database record to application format
const convertDatabaseToAppFormat = (dbRecord: DatabasePausedWorkout): PausedWorkoutData => {
  const pausedWorkout: PausedWorkoutData = {
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

  // Ensure the isChangedExercise flag is properly set for all exercises
  if (pausedWorkout.exercises && Array.isArray(pausedWorkout.exercises)) {
    pausedWorkout.exercises = pausedWorkout.exercises.map((ex) => {
      // Make sure the isChangedExercise property is a boolean
      if (ex.isChangedExercise === true) {
        return {
          ...ex,
          isChangedExercise: true,
        };
      }
      return ex;
    });
  }

  return pausedWorkout;
};

// Helper function to get paused workout from database
const getPausedWorkoutFromDatabase = async (
  userId: string,
  planId?: string,
  workoutDay?: number,
): Promise<PausedWorkoutData | null> => {
  let query = supabase.from('user_paused_workouts').select('*').eq('user_id', userId);

  // Add plan and day filters if provided
  if (planId) query = query.eq('plan_id', planId);
  if (workoutDay !== undefined) query = query.eq('workout_day', workoutDay);

  // Order by most recent
  query = query.order('paused_at', { ascending: false }).limit(1);

  const { data, error } = await query;

  if (error) {
    console.log('GETTING PAUSED WORKOUT - Error fetching from database:', error);
    return null;
  }

  if (!data || data.length === 0) {
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

  return pausedWorkout;
};

// Check if there's a paused workout to resume
export const getPausedWorkout = async (
  userId?: string,
  planId?: string,
  workoutDay?: number,
): Promise<PausedWorkoutData | null> => {
  try {
    console.log(
      'GETTING PAUSED WORKOUT - User ID:',
      userId,
      'Plan ID:',
      planId,
      'Day:',
      workoutDay,
    );

    // First try to get from AsyncStorage (works offline)
    let pausedWorkout = await getPausedWorkoutFromStorage();

    if (pausedWorkout) {
      console.log('GETTING PAUSED WORKOUT - Found paused workout in AsyncStorage');

      // Log switched exercises if any
      if (pausedWorkout.exercises) {
        logSwitchedExercises(pausedWorkout.exercises, pausedWorkout.exerciseSets, 'AsyncStorage');
      }

      // Validate against requested parameters
      if (!validatePausedWorkout(pausedWorkout, planId, workoutDay)) {
        console.log('GETTING PAUSED WORKOUT - Paused workout does not match requested plan/day');
        pausedWorkout = null;
      }
    }

    // If we have a user ID but no local paused workout, try to get from Supabase
    if (!pausedWorkout && userId) {
      pausedWorkout = await getPausedWorkoutFromDatabase(userId, planId, workoutDay);
    }

    return pausedWorkout;
  } catch (error) {
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
  try {
    // Clear from AsyncStorage
    await AsyncStorage.removeItem(PAUSED_WORKOUT_KEY);

    // If we have a user ID, clear from Supabase too
    if (userId && planId && workoutDay !== undefined) {
      const { error } = await supabase
        .from('user_paused_workouts')
        .delete()
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('workout_day', workoutDay);

      if (error) {
        console.error('Error clearing paused workout from Supabase:', error);
        // Continue anyway since we cleared locally
      }
    }

    return true;
  } catch (error) {
    console.error('Error clearing paused workout:', error);
    return false;
  }
};

// Fetch detailed exercise information by exercise ID
export const fetchExerciseDetails = async (exerciseId: string): Promise<ExerciseDetails | null> => {
  if (!exerciseId) {
    throw new Error('Exercise ID is required');
  }

  // Fetch complete exercise data from the exercises table
  const { data: exerciseData, error } = await supabase
    .from('exercises')
    .select('id, name, image_url, primary_muscles, secondary_muscles')
    .eq('id', exerciseId)
    .single();

  if (error) {
    throw error;
  }

  if (exerciseData) {
    return {
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
  }

  return null;
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
  if (!userId || !exerciseId) {
    return [];
  }

  try {
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
      console.error('Error fetching exercise history data:', error);
      return [];
    }

    if (!exerciseRecords || exerciseRecords.length === 0) {
      return [];
    }

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

    return trendingData;
  } catch (error) {
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
  if (!userId || !exerciseId) {
    return null;
  }

  try {
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
      console.error('Error fetching absolute max weight:', error);
      return null;
    }

    if (!maxWeightRecords || maxWeightRecords.length === 0) {
      return null;
    }

    const maxWeightRecord = maxWeightRecords[0] as MaxWeightRecord;
    const weight = parseFloat(maxWeightRecord.weight);
    const reps = parseInt(maxWeightRecord.reps) || 0;
    const workoutHistory = Array.isArray(maxWeightRecord.user_workout_history)
      ? maxWeightRecord.user_workout_history[0]
      : maxWeightRecord.user_workout_history;
    const completedAt = new Date(workoutHistory?.completed_at);

    return {
      weight: weight,
      reps: reps,
      date: completedAt.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }),
    };
  } catch (error) {
    console.error('Error in fetchExerciseAbsoluteMaxWeight:', error);
    return null;
  }
};
