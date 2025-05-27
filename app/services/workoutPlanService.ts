import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from './supabase';
import { format } from 'date-fns';

// Key for the active plan in AsyncStorage
const ACTIVE_PLAN_KEY = 'mindmuscle_active_plan';
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
}

// Interface for exercise set in workout session
export interface ExerciseSet {
  id: string;
  setNumber: number;
  weight: string;
  reps: string;
  isCompleted: boolean;
}

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

// Interface for workout plan exercise
export interface PlanExercise {
  id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  exercise_id?: string;
  workout_day: number;
}

// Interface for plan workout day
export interface WorkoutDay {
  day: number;
  exercises: PlanExercise[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
}

// Interface for a saved workout plan
export interface SavedPlan {
  id: string;
  title: string;
  difficulty_level?: string;
  category_name?: string;
  subtitle?: string;
  workout_frequency?: number;
  workoutDays: WorkoutDay[];
  activeDay?: number;
  started_at: string;
}

// Enhanced interface for cycle week information
export interface CycleWeekInfo {
  weekNumber: number;
  weekName: string;
  description: string;
  recommendationTemplate: string;
  weightAdjustmentPercentage: number;
  repsAdjustmentPercentage: number;
}

// Enhanced interface for exercise recommendations
export interface ExerciseRecommendation {
  previousWeight: number | null;
  previousReps: number | null;
  recommendedWeight: number | null;
  recommendedReps: number | null;
  recommendationText: string;
  weekAdjustmentPercentage: number;
  repsAdjustmentPercentage: number;
  weekName: string;
}

// Save a plan as the active plan
export const saveActivePlan = async (plan: SavedPlan): Promise<void> => {
  try {
    // Set the started date
    plan.started_at = new Date().toISOString();
    
    // Default to day 1 (index 0)
    plan.activeDay = 0;
    
    // Save the plan to AsyncStorage
    await AsyncStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(plan));
    
    // Optionally, also save to the server/database
    // await uploadActivePlanToServer(plan);
    

  } catch (error) {
    // Error saving active plan
    throw error;
  }
};

// Get the active plan
export const getActivePlan = async (): Promise<SavedPlan | null> => {
  try {
    const planJson = await AsyncStorage.getItem(ACTIVE_PLAN_KEY);
    if (!planJson) return null;
    
    return JSON.parse(planJson) as SavedPlan;
  } catch (error) {
    // Error fetching active plan
    return null;
  }
};

// Update the active day of the current plan
export const updateActivePlanDay = async (dayIndex: number): Promise<void> => {
  try {
    const plan = await getActivePlan();
    if (!plan) throw new Error('No active plan found');
    
    plan.activeDay = dayIndex;
    await AsyncStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(plan));
  } catch (error) {
    // Error updating active plan day
    throw error;
  }
};

// Clear the active plan
export const clearActivePlan = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
  } catch (error) {
    // Error clearing active plan
    throw error;
  }
};

// Get plan details by ID from Supabase
export const getPlanById = async (planId: string): Promise<any> => {
  try {
    const { data, error } = await supabase
      .from('workout_plans')
      .select('*, workout_subcategories!workout_plans_subcategory_id_fkey(title, category_identifier, subtitle)')
      .eq('id', planId)
      .single();
      
    if (error) throw error;
    return data;
  } catch (error) {
    // Error fetching plan
    throw error;
  }
};

// Update user workout days
export const updateUserWorkoutDays = async (userId: string, workoutDays: string[]): Promise<void> => {
  try {
    const { data, error } = await supabase
      .rpc('update_user_workout_days', {
        p_user_id: userId,
        p_workout_days: workoutDays
      });
      
    if (error) throw error;

  } catch (error) {
    // Error updating workout days
    throw error;
  }
};

// Get user workout days
export const getUserWorkoutDays = async (userId: string): Promise<number[]> => {
  try {
    const { data, error } = await supabase
      .from('user_profile_details')
      .select('workout_days')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      console.error('Error fetching user workout days:', error);
      // Default to Tuesday, Thursday, Sunday if error
      return [3, 5, 1];
    }
    
    if (data && data.workout_days) {
      // Use the database function to convert workout days to numeric format
      const { data: convertedData, error: conversionError } = await supabase
        .rpc('convert_workout_days_to_numeric', {
          input_days: data.workout_days
        });
        
      if (conversionError) {
        console.error('Error converting workout days:', conversionError);
        // Fallback to manual conversion
        if (Array.isArray(data.workout_days) && data.workout_days.length > 0) {
          if (typeof data.workout_days[0] === 'string') {
            // Legacy format - convert to numeric
            const dayNameToNumber: { [key: string]: number } = {
              'Sunday': 1, '1': 1,
              'Monday': 2, '2': 2,
              'Tuesday': 3, '3': 3,
              'Wednesday': 4, '4': 4,
              'Thursday': 5, '5': 5,
              'Friday': 6, '6': 6,
              'Saturday': 7, '7': 7
            };
            
            const numericDays = data.workout_days
              .map((day: string) => dayNameToNumber[day])
              .filter((dayNum: number) => dayNum !== undefined)
              .sort((a: number, b: number) => a - b);
              
            return numericDays.length > 0 ? numericDays : [3, 5, 1]; // Default: Tuesday, Thursday, Sunday
          } else {
            // Already numeric format
            return data.workout_days.sort((a: number, b: number) => a - b);
          }
        }
      } else {
        // Successfully converted using database function
        return convertedData || [3, 5, 1]; // Default: Tuesday, Thursday, Sunday
      }
    }
    
    // Default to Tuesday, Thursday, Sunday if no preference set
    return [3, 5, 1]; // Tuesday, Thursday, Sunday
  } catch (error) {
    // Error fetching workout days
    // Default to Tuesday, Thursday, Sunday if error
    return [3, 5, 1]; // Tuesday, Thursday, Sunday
  }
};

// Get the active plan with cycle week information
export const getActivePlanWithCycleWeek = async (userId: string, planId: string): Promise<{
  currentWeek: number;
  weekName: string;
  planId: string;
  workoutDay: number;
} | null> => {
  try {
    // Get the active plan information
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, current_day, plan_id')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();
      
    if (planError) throw planError;
    
    if (!planData) return null;
    
    // Get the week name
    const { data: weekData, error: weekError } = await supabase
      .from('workout_cycle_weeks')
      .select('name')
      .eq('week_number', planData.current_week)
      .single();
      
    if (weekError) {
      // Error fetching cycle week name
      // Return default if we can't get the week name
      return {
        currentWeek: planData.current_week || 1,
        weekName: getDefaultWeekName(planData.current_week || 1),
        planId: planData.plan_id,
        workoutDay: planData.current_day || 0
      };
    }
    
    return {
      currentWeek: planData.current_week || 1,
      weekName: weekData?.name || getDefaultWeekName(planData.current_week || 1),
      planId: planData.plan_id,
      workoutDay: planData.current_day || 0
    };
  } catch (error) {
    // Error fetching plan cycle week
    return null;
  }
};

// Helper function to get default week name based on week number
const getDefaultWeekName = (weekNumber: number): string => {
  const weekNames = [
    'Adaptation',
    'Accumulation',
    'Intensification',
    'Realization',
    'Recovery'
  ];
  
  // Adjust for 0-based index, ensuring we stay within bounds
  const index = (weekNumber - 1) % 5;
  return weekNames[index];
};

// Fetch workout data for a workout session
export const fetchWorkoutData = async (
  planId: string,
  workoutDay: number,
  userId: string,
  cycleWeek: number
): Promise<{
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  recommendations: Record<string, any>;
}> => {
  try {
    // Debug logging disabled
    // console.log(`Fetching workout data for planId: ${planId}, workoutDay: ${workoutDay}, userId: ${userId}, cycleWeek: ${cycleWeek}`);
    
    // Validate workout day
    if (isNaN(workoutDay) || workoutDay < 1) {
      console.error(`Invalid workout day: ${workoutDay}. Must be a number >= 1`);
      throw new Error('Invalid workout day');
    }
    
    // Double-check that the planId is valid
    if (!planId || planId.trim() === '') {
      console.error('Invalid plan ID');
      throw new Error('Invalid plan ID');
    }
    
    // Debug logging disabled
    // console.log(`SQL Query: SELECT * FROM workout_plan_exercises WHERE plan_id = '${planId}' AND workout_day = ${workoutDay}`);
    
    // Fetch exercises for this workout
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('workout_plan_exercises')
      .select(`
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
      `)
      .eq('plan_id', planId)
      .eq('workout_day', workoutDay)
      .order('order', { ascending: true });
      
    if (exercisesError) {
      console.error(`Error fetching exercises: ${exercisesError.message}`);
      console.error(`Full error object:`, exercisesError);
      throw exercisesError;
    }
    
    // Debug logging disabled
    // console.log(`Found ${exercisesData?.length || 0} exercises for workout day ${workoutDay}`);
    // console.log(`Raw exercises data:`, exercisesData);
    
    // If no exercises found, try to fetch all exercises for this plan to debug
    if (!exercisesData || exercisesData.length === 0) {
      // Debug logging disabled
      // console.log(`Trying to fetch all exercises for plan ${planId} to debug...`);
      const { data: allPlanExercises, error: allExercisesError } = await supabase
        .from('workout_plan_exercises')
        .select('id, workout_day, exercise_name, plan_id')
        .eq('plan_id', planId);
        
      if (!allExercisesError && allPlanExercises) {
        // console.log(`Plan ${planId} has ${allPlanExercises.length} total exercises:`);
        const workoutDays = [...new Set(allPlanExercises.map(ex => ex.workout_day))];
        // console.log(`Available workout days: ${workoutDays.join(', ')}`);
        // allPlanExercises.forEach((ex, i) => {
        //   console.log(`Exercise ${i+1}: ${ex.exercise_name} (Day ${ex.workout_day}) - Plan: ${ex.plan_id}`);
        // });
        
        // Also try to fetch without the workout_day filter to see if there are any exercises at all
        // console.log(`\nTrying to fetch ANY exercises for plan ${planId}...`);
        const { data: anyExercises, error: anyError } = await supabase
          .from('workout_plan_exercises')
          .select('*')
          .eq('plan_id', planId)
          .limit(5);
          
        if (!anyError && anyExercises) {
          // console.log(`Found ${anyExercises.length} exercises without workout_day filter:`);
          // anyExercises.forEach((ex, i) => {
          //   console.log(`Exercise ${i+1}:`, JSON.stringify(ex, null, 2));
          // });
        } else {
          // console.log(`Error fetching any exercises:`, anyError);
        }
      } else {
        // console.log(`Error fetching all plan exercises:`, allExercisesError);
      }
      
      console.error(`No exercises found for planId: ${planId}, workoutDay: ${workoutDay}`);
      throw new Error(`No exercises found for this workout (Day ${workoutDay})`);
    }
    
    // Debug logging disabled
    // exercisesData.slice(0, 3).forEach((ex, i) => {
    //   console.log(`Exercise ${i+1}: ${ex.exercise_name} (workout_day=${ex.workout_day})`);
    // });
    
    // Format exercise data with proper typing
    const formattedExercises: ExerciseData[] = exercisesData.map((item: any) => ({
      id: item.id,
      exercise_id: item.exercise_id,
      name: item.exercise_name || (item.exercises ? item.exercises.name : undefined) || 'Unknown Exercise',
      sets: item.sets || 3,
      reps_range: item.reps_range || '-',
      image_url: item.exercises ? item.exercises.image_url : undefined,
      primary_muscles: item.exercises ? item.exercises.primary_muscles : undefined,
      restTime: item.rest_time,
      order: item.order,
      workout_day: item.workout_day,
      requires_weight: item.exercises ? item.exercises.requires_weight : true // Default to true if not specified
    }));
    
    // Initialize exercise sets
    const initialSets: Record<string, ExerciseSet[]> = {};
    const recommendations: Record<string, any> = {};
    
    // Process each exercise
    for (const exercise of formattedExercises) {
      const exerciseSets: ExerciseSet[] = [];
      
      for (let i = 1; i <= exercise.sets; i++) {
        exerciseSets.push({
          id: `${exercise.id}-set-${i}`,
          setNumber: i,
          weight: '',
          reps: '',
          isCompleted: false
        });
      }
      
      initialSets[exercise.id] = exerciseSets;
      
      // Fetch recommendations for this exercise using the new smart recommendations function
      if (userId && exercise.exercise_id) {
        // console.log(`Fetching smart recommendations for exercise ${exercise.exercise_id} with cycle week ${cycleWeek}`);
        
        try {
          const { data: recommendationData, error: recError } = await supabase.rpc(
            'get_smart_exercise_recommendations',
            {
              p_user_id: userId,
              p_exercise_id: exercise.exercise_id,
              p_cycle_week: cycleWeek
            }
          );
          
          if (recError) {
            console.error(`Error fetching smart recommendations for exercise ${exercise.exercise_id}:`, recError);
            // Fallback: create basic recommendation based on cycle week
            recommendations[exercise.id] = {
              previous_weight: null,
              previous_reps: null,
              recommended_weight: null,
              recommendation_text: `Week ${cycleWeek} - Focus on proper form and progressive overload`,
              cycle_week: cycleWeek
            };
          } else {
            // console.log(`Smart recommendations for exercise ${exercise.exercise_id}:`, recommendationData);
            if (recommendationData && recommendationData.length > 0) {
              recommendations[exercise.id] = recommendationData[0];
            } else {
              // Fallback: create basic recommendation based on cycle week
              recommendations[exercise.id] = {
                previous_weight: null,
                previous_reps: null,
                recommended_weight: null,
                recommendation_text: `Week ${cycleWeek} - Focus on proper form and progressive overload`,
                cycle_week: cycleWeek
              };
            }
          }
        } catch (error) {
          console.error(`Exception fetching smart recommendations for exercise ${exercise.exercise_id}:`, error);
          // Fallback: create basic recommendation based on cycle week
          recommendations[exercise.id] = {
            previous_weight: null,
            previous_reps: null,
            recommended_weight: null,
            recommendation_text: `Week ${cycleWeek} - Focus on proper form and progressive overload`,
            cycle_week: cycleWeek
          };
        }
      }
    }
    
    return {
      exercises: formattedExercises,
      exerciseSets: initialSets,
      recommendations
    };
  } catch (error) {
    // Error fetching workout data
    throw error;
  }
};

// Fetch last exercise records for all exercises
export const fetchLastExerciseRecords = async (
  userId: string,
  exercises: ExerciseData[]
): Promise<Record<string, Record<number, { weight: string, reps: string }>>> => {
  if (!userId || exercises.length === 0) {
    return {};
  }
  
  try {
    // Create an object to store the last values for each exercise and set
    const lastValues: Record<string, Record<number, { weight: string, reps: string }>> = {};
    
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
        // Error fetching last exercise records
        continue;
      }
      
      if (records && records.length > 0) {
        // Group records by set_number
        const setRecords: Record<number, { weight: string, reps: string }> = {};
        
        // Process records to get the last value for each set number
        records.forEach((record: any) => {
          const setNumber = record.set_number;
          
          // Only store the first (most recent) record for each set number
          if (!setRecords[setNumber]) {
            setRecords[setNumber] = {
              weight: record.weight,
              reps: record.reps
            };
          }
        });
        
        lastValues[exercise.exercise_id] = setRecords;
      }
    }
    
    return lastValues;
  } catch (error) {
    // Error in fetchLastExerciseRecords
    return {};
  }
};

// Check if workout is already completed
export const checkWorkoutCompletion = async (
  userId: string,
  planId: string,
  workoutDay: number
): Promise<{
  isCompleted: boolean;
  completedWorkoutData?: CompletedWorkoutData;
}> => {
  if (!userId || !planId) {
    return { isCompleted: false };
  }
  
  try {
    // Check if there's a completed workout for this day
    const { data, error } = await supabase
      .from('user_workout_history')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('workout_day', workoutDay);
    
    if (error) {
      // Error checking workout completion
      throw error;
    }
    
    if (data && data.length > 0) {
      // Workout is already completed, get the most recent one
      const mostRecentWorkout = data.sort((a: any, b: any) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      )[0];
      
      // Get the count of exercises from the user_exercise_records table
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('user_exercise_records')
        .select('exercise_id')
        .eq('workout_history_id', mostRecentWorkout.id)
        .limit(1000);
      
      // Set completed workout data
      const completedWorkoutData: CompletedWorkoutData = {
        completedExercises: exerciseData ? new Set(exerciseData.map((item: any) => item.exercise_id)).size : 0,
        duration: mostRecentWorkout.workout_duration || '00:00:00',
        caloriesBurned: mostRecentWorkout.calories_burned || 0,
        totalVolume: mostRecentWorkout.total_volume || 0,
        totalReps: mostRecentWorkout.total_reps || 0,
        completedAt: mostRecentWorkout.completed_at,
        weekName: mostRecentWorkout.week_name,
        cycleWeek: mostRecentWorkout.cycle_week
      };
      
      return {
        isCompleted: true,
        completedWorkoutData
      };
    } else {
      // Workout is not completed
      return { isCompleted: false };
    }
  } catch (error) {
    // Error in checkWorkoutCompletion
    return { isCompleted: false };
  }
};

// Check if workout is already completed for a specific cycle week
export const checkWorkoutCompletionForCycleWeek = async (
  userId: string,
  planId: string,
  workoutDay: number,
  cycleWeek: number
): Promise<{
  isCompleted: boolean;
  completedWorkoutData?: CompletedWorkoutData;
}> => {
  if (!userId || !planId) {
    return { isCompleted: false };
  }
  
  try {
    // console.log(`Checking workout completion for cycle week ${cycleWeek}, workout day ${workoutDay}`);
    
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
    
    // console.log(`Found ${data?.length || 0} completed workouts for cycle week ${cycleWeek}, workout day ${workoutDay}`);
    
    if (data && data.length > 0) {
      // Workout is already completed for this specific cycle week, get the most recent one
      const mostRecentWorkout = data.sort((a: any, b: any) => 
        new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime()
      )[0];
      
      // console.log(`Most recent workout for cycle week ${cycleWeek}:`, mostRecentWorkout);
      
      // Get the count of exercises from the user_exercise_records table
      const { data: exerciseData, error: exerciseError } = await supabase
        .from('user_exercise_records')
        .select('exercise_id')
        .eq('workout_history_id', mostRecentWorkout.id)
        .limit(1000);
      
      // Set completed workout data
      const completedWorkoutData: CompletedWorkoutData = {
        completedExercises: exerciseData ? new Set(exerciseData.map((item: any) => item.exercise_id)).size : 0,
        duration: mostRecentWorkout.workout_duration || '00:00:00',
        caloriesBurned: mostRecentWorkout.calories_burned || 0,
        totalVolume: mostRecentWorkout.total_volume || 0,
        totalReps: mostRecentWorkout.total_reps || 0,
        completedAt: mostRecentWorkout.completed_at,
        weekName: mostRecentWorkout.week_name,
        cycleWeek: mostRecentWorkout.cycle_week
      };
      
      return {
        isCompleted: true,
        completedWorkoutData
      };
    } else {
      // Workout is not completed for this specific cycle week
      // console.log(`No completed workout found for cycle week ${cycleWeek}, workout day ${workoutDay}`);
      return { isCompleted: false };
    }
  } catch (error) {
    console.error('Error in checkWorkoutCompletionForCycleWeek:', error);
    return { isCompleted: false };
  }
};

// Complete a workout and save all data
export const completeWorkout = async (
  userId: string,
  planId: string,
  workoutDay: number,
  cycleWeek: number,
  weekName: string,
  exercises: ExerciseData[],
  exerciseSets: Record<string, ExerciseSet[]>,
  workoutDuration: number,
  totalVolume: number,
  totalReps: number,
  isRedoWorkout: boolean = false,
  originalCycleWeek: number | null = null
): Promise<boolean> => {
  try {
    // Calculate workout duration
    const workoutDurationMinutes = Math.round(workoutDuration / 60);
    
    // Format workout duration in hh:mm:ss format
    const hours = Math.floor(workoutDuration / 3600);
    const minutes = Math.floor((workoutDuration % 3600) / 60);
    const seconds = workoutDuration % 60;
    const formattedDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    // For redo workouts, we need to determine the original cycle week and week name
    let workoutCycleWeek = cycleWeek;
    let workoutWeekName = weekName;
    
    if (isRedoWorkout) {
      // If this is a redo workout, we should use the original cycle week and week name
      try {
        // Query the database to find the original cycle week and week name
        const { data: historyData } = await supabase
          .from('user_workout_history')
          .select('cycle_week, week_name')
          .eq('user_id', userId)
          .eq('plan_id', planId)
          .eq('workout_day', workoutDay)
          .order('completed_at', { ascending: false })
          .limit(1);
          
        if (historyData && historyData.length > 0) {
          // Use the cycle week and week name from the most recent workout for this day
          workoutCycleWeek = historyData[0].cycle_week;
          workoutWeekName = historyData[0].week_name;
        } else if (originalCycleWeek !== null) {
          // Fall back to the stored original cycle week if available
          workoutCycleWeek = originalCycleWeek;
          // Map cycle week to week name
          const weekNames: Record<number, string> = {
            1: 'Adaptation',
            2: 'Accumulation',
            3: 'Intensification',
            4: 'Peak',
            5: 'Deload'
          };
          workoutWeekName = weekNames[workoutCycleWeek] || 'Adaptation';
        }
      } catch (err) {
        // Error fetching original workout data
      }
    }
    
    // 1. Insert workout history entry with total volume and reps
    const { data: workoutData, error: workoutError } = await supabase
      .from('user_workout_history')
      .insert({
        user_id: userId,
        plan_id: planId,
        workout_day: workoutDay,
        cycle_week: workoutCycleWeek,
        week_name: workoutWeekName,
        workout_duration: formattedDuration, // Save formatted duration in hh:mm:ss format
        calories_burned: Math.round(workoutDurationMinutes * 8.5), // 8.5 calories per minute
        total_volume: totalVolume, // Add total volume (kg)
        total_reps: totalReps, // Add total reps
        completed_at: new Date().toISOString(), // Add completion timestamp
        exercises_count: exercises.length // Store the actual number of exercises
      })
      .select('id')
      .single();
      
    if (workoutError) {
      // Error creating workout history
      throw workoutError;
    }
    
    if (!workoutData) throw new Error('Failed to create workout history record');
    
    const workoutHistoryId = workoutData.id;
    
    // 2. Insert exercise records
    const exerciseRecords = [];
    
    console.log('=== WORKOUT COMPLETION LOGGING ===');
    console.log('Total exercises in workout:', exercises.length);
    console.log('Exercise sets data:', JSON.stringify(exerciseSets, null, 2));
    
    // DETAILED ANALYSIS: Check for incomplete sets before processing
    console.log('\n🔍 PRE-PROCESSING ANALYSIS:');
    let hasIncompleteExercises = false;
    exercises.forEach((exercise, idx) => {
      const sets = exerciseSets[exercise.id] || [];
      const completedSets = sets.filter(s => s.isCompleted);
      const isExerciseComplete = sets.length > 0 && sets.every(s => s.isCompleted);
      
      console.log(`${idx + 1}. ${exercise.name}: ${completedSets.length}/${sets.length} sets completed - Complete: ${isExerciseComplete}`);
      
      if (!isExerciseComplete) {
        hasIncompleteExercises = true;
        console.log(`  ⚠️  INCOMPLETE EXERCISE DETECTED: ${exercise.name}`);
        sets.forEach((set, setIdx) => {
          if (!set.isCompleted) {
            console.log(`    ❌ Set ${setIdx + 1}: completed=${set.isCompleted}, weight="${set.weight}", reps="${set.reps}"`);
          }
        });
      }
    });
    
    if (hasIncompleteExercises) {
      console.log('⚠️  WARNING: Workout has incomplete exercises but completion was triggered!');
    }
    
    for (const exercise of exercises) {
      const sets = exerciseSets[exercise.id] || [];
      console.log(`\n--- Exercise: ${exercise.name} (ID: ${exercise.id}) ---`);
      console.log(`Exercise sets for ${exercise.name}:`, sets);
      console.log(`Number of sets for ${exercise.name}:`, sets.length);
      
      let completedSetsCount = 0;
      for (const set of sets) {
        console.log(`Set ${set.setNumber}: completed=${set.isCompleted}, weight=${set.weight}, reps=${set.reps}`);
        
        if (set.isCompleted) { // Only save completed sets
          completedSetsCount++;
          // Transform '-' to '0' when saving to database
          const weight = set.weight === '-' || set.weight === '' ? '0' : set.weight;
          const reps = set.reps === '-' || set.reps === '' ? '0' : set.reps;
          
          const record = {
            workout_history_id: workoutHistoryId,
            exercise_id: exercise.exercise_id,
            workout_plan_exercise_id: exercise.id,
            set_number: set.setNumber,
            weight: weight ? parseFloat(weight) : 0,
            reps: reps ? parseInt(reps, 10) : 0,
            completed: set.isCompleted
          };
          
          console.log(`Adding record for ${exercise.name} set ${set.setNumber}:`, record);
          exerciseRecords.push(record);
        } else {
          console.log(`❌ SKIPPING incomplete set ${set.setNumber} for ${exercise.name}`);
        }
      }
      
      console.log(`Total completed sets for ${exercise.name}: ${completedSetsCount}/${sets.length}`);
    }
    
    console.log('\n=== FINAL EXERCISE RECORDS TO INSERT ===');
    console.log('Total records to insert:', exerciseRecords.length);
    console.log('Records:', JSON.stringify(exerciseRecords, null, 2));
    
    if (exerciseRecords.length > 0) {
      const { error: recordsError } = await supabase
        .from('user_exercise_records')
        .insert(exerciseRecords);
        
      if (recordsError) {
        console.error('Error saving exercise records:', recordsError);
        throw recordsError;
      } else {
        console.log('✅ Successfully inserted', exerciseRecords.length, 'exercise records');
      }
    } else {
      console.log('⚠️ No exercise records to insert - no completed sets found!');
    }
    
    // 3. Update user active plan
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('completed_workouts, current_week, current_day')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();
      
    if (planError) {
      // Error fetching active plan
      throw planError;
    }
    
    if (planData) {
      const { completed_workouts, current_week, current_day } = planData;
      let updatedWeek = current_week;
      let updatedCompleted = false;
      let updatedDay = current_day;
      
      // Only increment completed workouts count if this is NOT a redone workout
      let newCompletedWorkouts = completed_workouts || 0;
      if (!isRedoWorkout) {
        newCompletedWorkouts += 1;
        
        // Check if we should advance to the next week
        const workoutsPerWeek = 3; // 3 workouts per week based on requirements
        
        if (newCompletedWorkouts % workoutsPerWeek === 0) {
          // We've completed a full week
          if (current_week < 5) {
            // Advance to next week
            updatedWeek = current_week + 1;
          } else if (current_week === 5) {
            // We've completed the full 5-week cycle
            updatedCompleted = true;
          }
        }
        
        // Only update the current day if this is not a redone workout
        updatedDay = (current_day + 1) % workoutsPerWeek; // Cycle through 0, 1, 2
      }
      
      // For redo workouts, we need to be careful about what we update
      // We should only update the last_workout_date and not change any progression values
      const updateData = isRedoWorkout ? {
        // For redo workouts, only update the last workout date
        last_workout_date: new Date().toISOString()
      } : {
        // For normal workouts, update all progression values
        completed_workouts: newCompletedWorkouts,
        current_week: updatedWeek,
        current_day: updatedDay,
        last_workout_date: new Date().toISOString(),
        completed: updatedCompleted
      };
      
      // Update the active plan
      const { error: updateError } = await supabase
        .from('user_active_plans')
        .update(updateData)
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('is_active', true);
        
      if (updateError) {
        // Error updating active plan
        throw updateError;
      }
    }
    
    return true;
  } catch (error) {
    // Error completing workout
    return false;
  }
};

// Type definition for the formattedPlan object
type FormattedPlan = {
  id: string;
  title: string;
  difficulty_level: string;
  subtitle: string;
  category_name: string;
  workoutDays: any[];
  current_day: number;
  start_date: string;
};

// Fetch the user's active plan with all related data
export const fetchActivePlan = async (userId: string, userWorkoutDays: number[]): Promise<any> => {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  try {
    // Create a deep copy of userWorkoutDays to prevent reference issues
    const workoutDaysCopy = [...(userWorkoutDays || [])];
    
    // Fetch the active plan data
    const { data: activePlanData, error: activePlanError } = await supabase
      .from('user_active_plans')
      .select(`
        id,
        plan_id,
        user_id,
        is_active,
        current_day,
        start_date,
        workout_days_preference,
        workout_plans:plan_id (
          id,
          title,
          difficulty_level,
          estimated_duration,
          workout_subcategories:subcategory_id (
            title,
            subtitle,
            category_identifier
          )
        )
      `)
      .eq('user_id', userId)
      .eq('is_active', true)
      .single();
      
    if (activePlanError) {
      if (activePlanError.code === 'PGRST116') {
        // No active plan found
        return { plan: null, markedDates: {} };
      }
      throw activePlanError;
    }
    
    if (!activePlanData || !activePlanData.workout_plans) {
      // No active plan or plan data found
      return { plan: null, markedDates: {} };
    }
    
    // Fetch the exercises for this plan
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('workout_plan_exercises')
      .select(`
        id,
        sets,
        reps_range,
        exercise_id,
        workout_day,
        exercise_name,
        exercises:exercise_id (
          id,
          name,
          image_url,
          primary_muscles
        )
      `)
      .eq('plan_id', activePlanData.plan_id)
      .order('workout_day', { ascending: true })
      .order('order', { ascending: true });
      
    if (exercisesError) throw exercisesError;
    
    // Group exercises by workout day
    const exercisesByDay: { [key: number]: any[] } = {};
    exercisesData.forEach((item: any) => {
      const day = item.workout_day || 0;
      if (!exercisesByDay[day]) {
        exercisesByDay[day] = [];
      }
      
      exercisesByDay[day].push({
        id: item.id,
        name: item.exercise_name || item.exercises?.name,
        sets: item.sets,
        reps_range: item.reps_range,
        image_url: item.exercises?.image_url,
        primary_muscles: item.exercises?.primary_muscles,
        workout_day: day,
        exercise_id: item.exercises?.id
      });
    });
    
    // Convert to array of workout days with per-day statistics
    const workoutDays = Object.keys(exercisesByDay).map(dayKey => {
      const dayNum = parseInt(dayKey, 10);
      const dayExercises = exercisesByDay[dayNum];
      
      // Calculate per-day statistics based on actual exercise data
      const exerciseCount = dayExercises.length;
      
      // Calculate estimated duration based on sets, reps, and rest time
      let totalDuration = 0;
      dayExercises.forEach(exercise => {
        const sets = exercise.sets || 3;
        const repRange = exercise.reps_range || '-';
        
        // Parse rep range to get average reps (e.g., "8-12" -> 10)
        let avgReps = 10; // Default
        if (repRange.includes('-')) {
          const [min, max] = repRange.split('-').map((num: string) => parseInt(num, 10));
          if (!isNaN(min) && !isNaN(max)) {
            avgReps = Math.floor((min + max) / 2);
          }
        } else if (!isNaN(parseInt(repRange, 10))) {
          avgReps = parseInt(repRange, 10);
        }
        
        // Estimate time per rep at ~2-3 seconds
        const timePerSet = avgReps * 2.5; // seconds
        
        // Rest time between sets (typically 60-90 seconds)
        const restTime = 75; // seconds
        
        // Total time for this exercise (all sets + rest between sets)
        const exerciseTime = (sets * timePerSet) + (restTime * (sets - 1));
        
        // Add to total duration (convert to minutes)
        totalDuration += exerciseTime / 60;
      });
      
      // Round up to nearest minute
      const estimatedDuration = Math.ceil(totalDuration);
      
      // Calculate calories based on duration with a more realistic formula
      // Moderate exercise burns approximately 7-10 calories per minute depending on intensity
      const calorieRate = 8.5; // calories per minute for moderate-high intensity workout
      const estimatedCalories = Math.round(estimatedDuration * calorieRate);
      
      return {
        day: dayNum,
        exercises: dayExercises,
        total_exercises: exerciseCount,
        estimated_duration: estimatedDuration,
        total_calories: estimatedCalories
      };
    }).sort((a, b) => a.day - b.day);
    
    // Format the data
    const formattedPlan: FormattedPlan = {
      id: activePlanData.plan_id,
      title: (activePlanData.workout_plans as any)?.title || 'Unknown',
      difficulty_level: (activePlanData.workout_plans as any)?.difficulty_level || 'Unknown',
      subtitle: (activePlanData.workout_plans as any)?.workout_subcategories?.subtitle || "Unknown",
      category_name: (activePlanData.workout_plans as any)?.workout_subcategories?.title || 'Unknown',
      workoutDays: workoutDays,
      current_day: activePlanData.current_day,
      start_date: activePlanData.start_date
    };
    
    // Setup calendar dates if user workout days are provided
    let markedDates = {};
    if (userWorkoutDays && userWorkoutDays.length > 0) {
      markedDates = setupCalendarDates(activePlanData.start_date, workoutDays.length, userWorkoutDays);
    }
    
    return {
      plan: formattedPlan,
      markedDates
    };
  } catch (error) {
    throw error;
  }
};

// Setup calendar marked dates based on workout frequency and user preferences
export const setupCalendarDates = (startDate: string, totalDays: number, userWorkoutDays: number[], colors: any = { primary: '#007BFF' }) => {
  try {
    if (!userWorkoutDays || userWorkoutDays.length === 0) {
      console.error('No valid workout days provided');
      return {};
    }
    
    // Sort user workout days to ensure consistent ordering
    const sortedUserDays = [...userWorkoutDays].sort((a, b) => a - b);
    
    // Create a mapping of workout days to calendar dates
    const markedDates: Record<string, any> = {};
    
    // Get today's date and day of week (1-7, where 1=Sunday)
    const today = new Date();
    const todayDayNumber = today.getDay() + 1; // Convert from 0-6 to 1-7
    
    // Mark today on the calendar
    const todayStr = today.toISOString().split('T')[0];
    markedDates[todayStr] = {
      selected: true,
      selectedColor: colors.primary
    };
    
    // Helper function to get the next occurrence of a specific day number
    const getNextDateForDay = (dayNumber: number, fromDate: Date): Date => {
      const fromDayNumber = fromDate.getDay() + 1; // Convert from 0-6 to 1-7
      let daysToAdd = dayNumber - fromDayNumber;
      if (daysToAdd <= 0) daysToAdd += 7; // Wrap to next week if needed
      
      const nextDate = new Date(fromDate);
      nextDate.setDate(fromDate.getDate() + daysToAdd);
      return nextDate;
    };
    
    // Generate dates for each workout day for several weeks
    const weeksToShow = 8; // Show 8 weeks of workouts
    
    // Start from today for the first occurrence
    let currentDate = new Date(today);
    
    // For each week
    for (let week = 0; week < weeksToShow; week++) {
      // For each workout day in the plan (1, 2, 3, etc.)
      for (let workoutDay = 1; workoutDay <= totalDays; workoutDay++) {
        // Map workout day to user's preferred day using cycling
        const userDayIndex = (workoutDay - 1) % sortedUserDays.length;
        const userDayNumber = sortedUserDays[userDayIndex];
        
        let workoutDate: Date;
        
        if (week === 0) {
          // For the first week, find the next occurrence of this day
          workoutDate = getNextDateForDay(userDayNumber, currentDate);
          
          // For subsequent workout days in the same week, ensure proper spacing
          if (workoutDay > 1) {
            const prevWorkoutDay = workoutDay - 1;
            const prevUserDayIndex = (prevWorkoutDay - 1) % sortedUserDays.length;
            const prevUserDayNumber = sortedUserDays[prevUserDayIndex];
            
            // Find the previous workout date
            const prevDateKey = Object.keys(markedDates).find(dateStr => {
              const dateInfo = markedDates[dateStr];
              return dateInfo.workoutDayIndex === prevWorkoutDay && dateInfo.marked === true;
            });
            
            if (prevDateKey) {
              const prevDate = new Date(prevDateKey);
              workoutDate = getNextDateForDay(userDayNumber, prevDate);
            }
          }
        } else {
          // For subsequent weeks, add 7 days to the same workout day from the previous week
          const prevWeekDateKey = Object.keys(markedDates).find(dateStr => {
            const dateInfo = markedDates[dateStr];
            return dateInfo.workoutDayIndex === workoutDay && 
                   dateInfo.marked === true &&
                   dateInfo.week === week - 1;
          });
          
          if (prevWeekDateKey) {
            workoutDate = new Date(prevWeekDateKey);
            workoutDate.setDate(workoutDate.getDate() + 7);
          } else {
            // Fallback: calculate from first week
            const firstWeekDateKey = Object.keys(markedDates).find(dateStr => {
              const dateInfo = markedDates[dateStr];
              return dateInfo.workoutDayIndex === workoutDay && 
                     dateInfo.marked === true &&
                     dateInfo.week === 0;
            });
            
            if (firstWeekDateKey) {
              workoutDate = new Date(firstWeekDateKey);
              workoutDate.setDate(workoutDate.getDate() + (7 * week));
            } else {
              // Last resort: calculate from today
              workoutDate = getNextDateForDay(userDayNumber, today);
              workoutDate.setDate(workoutDate.getDate() + (7 * week));
            }
          }
        }
        
        // Format the date as YYYY-MM-DD
        const dateStr = workoutDate.toISOString().split('T')[0];
        
        // Day names for reference
        const dayNames = ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Mark this date on the calendar with the workout day (1, 2, 3)
        markedDates[dateStr] = {
          selected: true,
          selectedColor: colors.primary,
          marked: true,
          dotColor: colors.primary,
          workoutDayIndex: workoutDay, // This is the 1-indexed workout day (1, 2, 3)
          dayName: dayNames[userDayNumber], // Store the day name for reference
          week: week, // Store week for reference
          userDayNumber: userDayNumber // Store the numeric day for reference
        };
      }
    }
    
    return markedDates;
  } catch (error) {
    console.error('Error setting up calendar dates:', error);
    return {};
  }
};

// Helper function to add days to a date
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Check if workout is already completed for the selected day in my-plan.tsx
export const checkWorkoutCompletionForPlan = async (
  userId: string,
  planId: string,
  workoutDayIndex: number,
  markedDates: any
): Promise<{
  isCompleted: boolean;
  completedWorkoutData?: any;
  completedDates?: string[];
}> => {
  if (!userId || !planId || workoutDayIndex === null) {
    return { isCompleted: false };
  }

  try {
    // Fetch all completed workouts for this plan with completion dates and cycle info
    const { data: allCompletedWorkouts, error: allCompletedError } = await supabase
      .from('user_workout_history')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId);

    let completedDates: string[] = [];

    if (!allCompletedError && allCompletedWorkouts && allCompletedWorkouts.length > 0) {
      // Get today's date
      const today = new Date();
      
      // Find the most recent completed workout for this specific workout day
      let todayCompletedWorkout: any = null;
      
      // IMPROVED LOGIC: Match completions by date and cycle week, not just workout day
      allCompletedWorkouts.forEach((workout: any) => {
        // If this workout matches the workout day we're checking
        if (workout.workout_day === workoutDayIndex) {
          // Parse the completion date
          const completedDate = new Date(workout.completed_at);
          
          // If this workout was completed today, mark it as completed
          if (completedDate.toDateString() === today.toDateString()) {
            todayCompletedWorkout = workout;
          }
        }
      });
      
      // If we found a workout completed today, return it
      if (todayCompletedWorkout) {
        return {
          isCompleted: true,
          completedWorkoutData: {
            completedExercises: todayCompletedWorkout.completed_exercises || 0,
            duration: todayCompletedWorkout.workout_duration || '00:00:00',
            caloriesBurned: todayCompletedWorkout.calories_burned || 0,
            totalVolume: todayCompletedWorkout.total_volume || 0,
            totalReps: todayCompletedWorkout.total_reps || 0,
            completedAt: todayCompletedWorkout.completed_at,
            weekName: todayCompletedWorkout.week_name || '',
            cycleWeek: todayCompletedWorkout.cycle_week || 1
          },
          completedDates
        };
      }

      // IMPROVED LOGIC: Build completed dates by matching actual completion dates
      // Get the progressive calendar schedule to map dates to workout days and cycle weeks
      if (markedDates && Object.keys(markedDates).length > 0) {
        Object.entries(markedDates).forEach(([dateStr, dateInfo]: [string, any]) => {
          if (dateInfo && dateInfo.workoutDayIndex !== undefined && dateInfo.cycleWeek !== undefined) {
            const workoutDayIndex = dateInfo.workoutDayIndex;
            const cycleWeek = dateInfo.cycleWeek;
            
            // Check if this specific date has a completed workout
            const hasCompletedWorkout = allCompletedWorkouts.some((w: any) => {
              if (w.workout_day !== workoutDayIndex) return false;
              
              // Parse the completion date
              const completionDate = new Date(w.completed_at);
              const completionDateStr = format(completionDate, 'yyyy-MM-dd');
              
              // Check if the completion date matches this calendar date
              // OR if it's the same workout day in the same cycle week
              return completionDateStr === dateStr || 
                     (w.workout_day === workoutDayIndex && w.cycle_week === cycleWeek);
            });
            
            if (hasCompletedWorkout) {
              completedDates.push(dateStr);
            }
          }
        });
      }
    }

    // Return the completion status and completed dates
    return { 
      isCompleted: false,
      completedDates 
    };
  } catch (error) {
    console.error('Error in checkWorkoutCompletionForPlan:', error);
    return { isCompleted: false };
  }
};

// Fetch plan details for the plan details screen
export const fetchPlanDetails = async (planId: string): Promise<any> => {
  if (!planId) {
    throw new Error('Plan ID is required');
  }
  
  try {
    // Fetch the plan data
    const { data: planData, error: planError } = await supabase
      .from('workout_plans')
      .select('*, workout_subcategories!workout_plans_subcategory_id_fkey(title, category_identifier, subtitle)')
      .eq('id', planId)
      .single();
      
    if (planError) throw planError;
    
    // Fetch the category name
    let categoryName = '';
    if (planData?.workout_subcategories?.category_identifier) {
      const { data: categoryData, error: categoryError } = await supabase
        .from('workout_categories')
        .select('name')
        .eq('identifier', planData.workout_subcategories.category_identifier)
        .single();
        
      if (!categoryError && categoryData) {
        categoryName = categoryData.name;
      }
    }
    
    // Fetch the exercises for this plan
    const { data: exercisesData, error: exercisesError } = await supabase
      .from('workout_plan_exercises')
      .select(`
        id,
        sets,
        reps_range,
        exercise_id,
        workout_day,
        exercise_name,
        exercises:exercise_id (
          id,
          name,
          image_url,
          primary_muscles
        )
      `)
      .eq('plan_id', planId)
      .order('workout_day', { ascending: true })
      .order('order', { ascending: true });
      
    if (exercisesError) throw exercisesError;
    
    // Group exercises by workout day
    const exercisesByDay: { [key: number]: any[] } = {};
    exercisesData.forEach((item: any) => {
      const day = item.workout_day || 0;
      if (!exercisesByDay[day]) {
        exercisesByDay[day] = [];
      }
      
      exercisesByDay[day].push({
        id: item.id,
        name: item.exercise_name || item.exercises?.name,
        sets: item.sets,
        reps_range: item.reps_range,
        image_url: item.exercises?.image_url,
        primary_muscles: item.exercises?.primary_muscles,
        workout_day: day,
        exercise_id: item.exercises?.id
      });
    });
    
    // Convert to array of workout days with per-day statistics
    const workoutDays = Object.keys(exercisesByDay).map(dayKey => {
      const dayNum = parseInt(dayKey, 10);
      const dayExercises = exercisesByDay[dayNum];
      
      // Calculate per-day statistics based on actual exercise data
      const exerciseCount = dayExercises.length;
      
      // Calculate estimated duration based on sets, reps, and rest time
      let totalDuration = 0;
      dayExercises.forEach(exercise => {
        const sets = exercise.sets || 3;
        const repRange = exercise.reps_range || '-';
        
        // Parse rep range to get average reps (e.g., "8-12" -> 10)
        let avgReps = 10; // Default
        if (repRange.includes('-')) {
          const [min, max] = repRange.split('-').map((num: string) => parseInt(num, 10));
          if (!isNaN(min) && !isNaN(max)) {
            avgReps = Math.floor((min + max) / 2);
          }
        } else if (!isNaN(parseInt(repRange, 10))) {
          avgReps = parseInt(repRange, 10);
        }
        
        // Estimate time per rep at ~2-3 seconds
        const timePerSet = avgReps * 2.5; // seconds
        
        // Rest time between sets (typically 60-90 seconds)
        const restTime = 75; // seconds
        
        // Total time for this exercise (all sets + rest between sets)
        const exerciseTime = (sets * timePerSet) + (restTime * (sets - 1));
        
        // Add to total duration (convert to minutes)
        totalDuration += exerciseTime / 60;
      });
      
      // Round up to nearest minute
      const estimatedDuration = Math.ceil(totalDuration);
      
      // Calculate calories based on duration with a more realistic formula
      // Moderate exercise burns approximately 7-10 calories per minute depending on intensity
      const calorieRate = 8.5; // calories per minute for moderate-high intensity workout
      const estimatedCalories = Math.round(estimatedDuration * calorieRate);
      
      return {
        day: dayNum,
        exercises: dayExercises,
        total_exercises: exerciseCount,
        estimated_duration: estimatedDuration,
        total_calories: estimatedCalories
      };
    }).sort((a, b) => a.day - b.day);
    
    // Format the data
    const formattedPlan = {
      id: planData.id,
      title: planData.title,
      difficulty_level: planData.difficulty_level,
      estimated_duration: planData.estimated_duration,
      workoutDays: workoutDays,
      category_name: categoryName || 'Unknown',
      subtitle: planData.workout_subcategories?.subtitle,
      workout_frequency: planData.workout_frequency || workoutDays.length
    };
    
    return formattedPlan;
  } catch (error) {
    throw error;
  }
};

// Start a new workout plan for the user
export const startPlan = async (userId: string, planId: string): Promise<boolean> => {
  if (!userId || !planId) {
    throw new Error('User ID and Plan ID are required');
  }
  
  try {
    // Fetch user's preferred workout days first
    const userWorkoutDays = await getUserWorkoutDays(userId);
    
    // Check if user already has an active plan
    const { data: existingPlans, error: fetchError } = await supabase
      .from('user_active_plans')
      .select('id, plan_id')
      .eq('user_id', userId)
      .eq('is_active', true);
      
    if (fetchError) throw fetchError;
    
    if (existingPlans && existingPlans.length > 0) {
      // Set all existing plans to inactive
      const { error: updateError } = await supabase
        .from('user_active_plans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);
        
      if (updateError) throw updateError;
    }
    
    // Get today's date for the start date
    const startDate = new Date().toISOString().split('T')[0];
    
    // Insert the new plan as the active plan
    const { error: insertError } = await supabase
      .from('user_active_plans')
      .insert({
        user_id: userId,
        plan_id: planId,
        is_active: true,
        current_day: 1, // Always start with day 1 (using 1-indexed workout days)
        start_date: startDate,
        // Store user's workout days preference to ensure consistency
        workout_days_preference: userWorkoutDays
      });
      
    if (insertError) throw insertError;
    
    return true;
  } catch (error) {
    throw error;
  }
};

// Fetch detailed exercise information by exercise ID
export const fetchExerciseDetails = async (exerciseId: string): Promise<any> => {
  if (!exerciseId) {
    throw new Error('Exercise ID is required');
  }
  
  try {
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
          : []
      };
    }
    
    return null;
  } catch (error) {
    throw error;
  }
};

// Fetch exercise history data for trending graph and max weight
export const fetchExerciseMaxWeightData = async (
  userId: string,
  exerciseId: string,
  limit: number = 10
): Promise<{ date: string, value: number, reps?: number }[]> => {
  if (!userId || !exerciseId) {
    return [];
  }
  
  try {
    // Query to get all completed exercise records with proper date filtering
    const { data: exerciseRecords, error } = await supabase
      .from('user_exercise_records')
      .select(`
        weight,
        reps,
        created_at,
        workout_history_id,
        user_workout_history!inner(
          completed_at,
          user_id,
          id
        )
      `)
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
    const sessionData = new Map<string, { 
      date: string, 
      maxWeight: number, 
      reps: number,
      completedAt: Date 
    }>();
    
    exerciseRecords.forEach((record: any) => {
      const workoutHistoryId = record.workout_history_id;
      const weight = parseFloat(record.weight);
      const reps = parseInt(record.reps) || 0;
      const completedAt = new Date(record.user_workout_history?.completed_at);
      
      if (workoutHistoryId && !isNaN(weight) && weight > 0) {
        const existing = sessionData.get(workoutHistoryId);
        if (!existing || weight > existing.maxWeight) {
          sessionData.set(workoutHistoryId, {
            date: completedAt.toLocaleDateString('en-GB', { 
              day: '2-digit', 
              month: '2-digit' 
            }),
            maxWeight: weight,
            reps: reps,
            completedAt: completedAt
          });
        }
      }
    });
    
    // Convert to array, sort by date, and take most recent sessions for trending
    const trendingData = Array.from(sessionData.values())
      .sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
      .slice(-limit) // Take the most recent sessions
      .map(item => ({
        date: item.date,
        value: item.maxWeight,
        reps: item.reps
      }));
    
    return trendingData;
  } catch (error) {
    console.error('Error in fetchExerciseMaxWeightData:', error);
    return [];
  }
};

// Fetch the absolute max weight ever lifted for an exercise
export const fetchExerciseAbsoluteMaxWeight = async (
  userId: string,
  exerciseId: string
): Promise<{ weight: number, reps: number, date: string } | null> => {
  if (!userId || !exerciseId) {
    return null;
  }
  
  try {
    // Query to get the highest weight ever lifted for this exercise
    const { data: maxWeightRecords, error } = await supabase
      .from('user_exercise_records')
      .select(`
        weight,
        reps,
        user_workout_history!inner(
          completed_at,
          user_id
        )
      `)
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
    
    const maxWeightRecord = maxWeightRecords[0];
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
        year: 'numeric'
      })
    };
  } catch (error) {
    console.error('Error in fetchExerciseAbsoluteMaxWeight:', error);
    return null;
  }
};

// Save the paused workout state
export const savePausedWorkout = async (
  userId: string,
  planId: string,
  workoutDay: number,
  cycleWeek: number,
  weekName: string,
  exercises: ExerciseData[],
  exerciseSets: Record<string, ExerciseSet[]>,
  workoutDuration: number,
  totalVolume: number,
  totalReps: number,
  currentExerciseIndex: number,
  originalCycleWeek: number | null = null
): Promise<boolean> => {
  try {
    // Create a paused workout object with all necessary data
    const pausedWorkout = {
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
      originalCycleWeek,
      pausedAt: new Date().toISOString()
    };
    
    // Save to AsyncStorage
    await AsyncStorage.setItem(PAUSED_WORKOUT_KEY, JSON.stringify(pausedWorkout));
    
    // Save to Supabase for cross-device sync
    if (userId) {
      const { error } = await supabase
        .from('user_paused_workouts')
        .upsert({
          user_id: userId,
          plan_id: planId,
          workout_day: workoutDay,
          cycle_week: cycleWeek,
          week_name: weekName,
          exercises: exercises,
          exercise_sets: exerciseSets,
          workout_duration: workoutDuration,
          total_volume: totalVolume,
          total_reps: totalReps,
          current_exercise_index: currentExerciseIndex,
          original_cycle_week: originalCycleWeek,
          paused_at: new Date().toISOString()
        }, { onConflict: 'user_id, plan_id, workout_day' });
        
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

// Check if there's a paused workout to resume
export const getPausedWorkout = async (
  userId?: string, 
  planId?: string, 
  workoutDay?: number
): Promise<any | null> => {
  try {
    // First try to get from AsyncStorage (works offline)
    const pausedWorkoutJson = await AsyncStorage.getItem(PAUSED_WORKOUT_KEY);
    let pausedWorkout = pausedWorkoutJson ? JSON.parse(pausedWorkoutJson) : null;
    
    // If we have a specific workout to check for
    if (pausedWorkout && planId && workoutDay !== undefined) {
      // Check if the paused workout matches the requested plan and day
      if (pausedWorkout.planId !== planId || pausedWorkout.workoutDay !== workoutDay) {
        pausedWorkout = null;
      }
    }
    
    // If we have a user ID but no local paused workout, try to get from Supabase
    if (!pausedWorkout && userId) {
      let query = supabase
        .from('user_paused_workouts')
        .select('*')
        .eq('user_id', userId);
        
      // Add plan and day filters if provided
      if (planId) query = query.eq('plan_id', planId);
      if (workoutDay !== undefined) query = query.eq('workout_day', workoutDay);
      
      // Order by most recent
      query = query.order('paused_at', { ascending: false }).limit(1);
      
      const { data, error } = await query;
      
      if (!error && data && data.length > 0) {
        // Convert from database format to application format
        pausedWorkout = {
          userId: data[0].user_id,
          planId: data[0].plan_id,
          workoutDay: data[0].workout_day,
          cycleWeek: data[0].cycle_week,
          weekName: data[0].week_name,
          exercises: data[0].exercises,
          exerciseSets: data[0].exercise_sets,
          workoutDuration: data[0].workout_duration,
          totalVolume: data[0].total_volume,
          totalReps: data[0].total_reps,
          currentExerciseIndex: data[0].current_exercise_index,
          originalCycleWeek: data[0].original_cycle_week,
          pausedAt: data[0].paused_at
        };
        
        // Save to AsyncStorage for offline access
        await AsyncStorage.setItem(PAUSED_WORKOUT_KEY, JSON.stringify(pausedWorkout));
      }
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
  workoutDay?: number
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

// Get cycle week information from database
export const getCycleWeekInfo = async (weekNumber: number): Promise<CycleWeekInfo | null> => {
  try {
    const { data, error } = await supabase
      .from('workout_cycle_weeks')
      .select('*')
      .eq('week_number', weekNumber)
      .single();
      
    if (error) throw error;
    
    if (!data) return null;
    
    return {
      weekNumber: data.week_number,
      weekName: data.name,
      description: data.description,
      recommendationTemplate: data.recommendation_template,
      weightAdjustmentPercentage: data.weight_adjustment_percentage,
      repsAdjustmentPercentage: data.reps_adjustment_percentage
    };
  } catch (error) {
    console.error('Error fetching cycle week info:', error);
    return null;
  }
};

// Get all cycle weeks information
export const getAllCycleWeeks = async (): Promise<CycleWeekInfo[]> => {
  try {
    const { data, error } = await supabase
      .from('workout_cycle_weeks')
      .select('*')
      .order('week_number', { ascending: true });
      
    if (error) throw error;
    
    return data.map(week => ({
      weekNumber: week.week_number,
      weekName: week.name,
      description: week.description,
      recommendationTemplate: week.recommendation_template,
      weightAdjustmentPercentage: week.weight_adjustment_percentage,
      repsAdjustmentPercentage: week.reps_adjustment_percentage
    }));
  } catch (error) {
    console.error('Error fetching all cycle weeks:', error);
    return [];
  }
};

// Enhanced function to get exercise recommendations with smart cycle progression
export const getExerciseRecommendations = async (
  userId: string,
  exerciseId: string,
  cycleWeek: number
): Promise<ExerciseRecommendation | null> => {
  try {
    const { data, error } = await supabase.rpc(
      'get_smart_exercise_recommendations',
      {
        p_user_id: userId,
        p_exercise_id: exerciseId,
        p_cycle_week: cycleWeek
      }
    );
    
    if (error) throw error;
    
    if (!data || data.length === 0) return null;
    
    const recommendation = data[0];
    
    // Get cycle week info for additional context
    const cycleInfo = await getCycleWeekInfo(cycleWeek);
    
    return {
      previousWeight: recommendation.previous_weight,
      previousReps: recommendation.previous_reps,
      recommendedWeight: recommendation.recommended_weight,
      recommendedReps: recommendation.recommended_reps,
      recommendationText: recommendation.recommendation_text,
      weekAdjustmentPercentage: cycleInfo?.weightAdjustmentPercentage || 0,
      repsAdjustmentPercentage: cycleInfo?.repsAdjustmentPercentage || 0,
      weekName: cycleInfo?.weekName || 'Unknown'
    };
  } catch (error) {
    console.error('Error getting smart exercise recommendations:', error);
    return null;
  }
};

// Enhanced function to calculate progressive workout schedule
export const calculateProgressiveWorkoutSchedule = (
  startDate: string,
  userWorkoutDays: number[],
  planWorkoutFrequency: number = 3,
  totalWeeks: number = 5
): {
  schedule: Array<{
    date: string;
    workoutDayIndex: number;
    cycleWeek: number;
    weekName: string;
    dayOfWeek: number;
  }>;
  markedDates: Record<string, any>;
} => {
  const schedule: Array<{
    date: string;
    workoutDayIndex: number;
    cycleWeek: number;
    weekName: string;
    dayOfWeek: number;
  }> = [];
  
  const markedDates: Record<string, any> = {};
  
  // Week names for the 5-week cycle
  const weekNames = ['Adaptation', 'Accumulation', 'Intensification', 'Realization', 'Recovery'];
  
  // Sort user workout days to ensure consistent ordering
  const sortedUserDays = [...userWorkoutDays].sort((a, b) => a - b);
  
  if (sortedUserDays.length === 0) {
    console.error('No user workout days provided');
    return { schedule, markedDates };
  }
  

  
  const start = new Date(startDate);
  let currentDate = new Date(start);
  let workoutCount = 0;
  let currentWeek = 1;
  
  // Calculate total workouts needed (planWorkoutFrequency per week * totalWeeks)
  const totalWorkouts = planWorkoutFrequency * totalWeeks;
  
  while (workoutCount < totalWorkouts && currentWeek <= totalWeeks) {
    const currentDayOfWeek = currentDate.getDay() + 1; // Convert to 1-7 format
    
    // Check if current day is a user's preferred workout day
    if (sortedUserDays.includes(currentDayOfWeek)) {
      // Calculate which workout day this is (1, 2, 3, etc.)
      const workoutDayIndex = (workoutCount % planWorkoutFrequency) + 1;
      
      // Calculate which cycle week we're in
      const cycleWeek = Math.floor(workoutCount / planWorkoutFrequency) + 1;
      
      if (cycleWeek <= totalWeeks) {
        const dateStr = currentDate.toISOString().split('T')[0];
        const weekName = weekNames[cycleWeek - 1] || 'Unknown';
        

        
        // Add to schedule
        schedule.push({
          date: dateStr,
          workoutDayIndex,
          cycleWeek,
          weekName,
          dayOfWeek: currentDayOfWeek
        });
        
        // Add to marked dates for calendar
        markedDates[dateStr] = {
          selected: true,
          selectedColor: '#7B69EE',
          marked: true,
          dotColor: '#7B69EE',
          workoutDayIndex,
          cycleWeek,
          weekName,
          dayName: ['', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][currentDayOfWeek],
          userDayNumber: currentDayOfWeek
        };
        
        workoutCount++;
        
        // Update current week when we complete a week's worth of workouts
        if (workoutCount % planWorkoutFrequency === 0) {
          currentWeek++;
        }
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Safety check to prevent infinite loop
    if (currentDate.getTime() - start.getTime() > 365 * 24 * 60 * 60 * 1000) {
      console.warn('Workout schedule calculation exceeded 1 year, breaking loop');
      break;
    }
  }
  

  
  return { schedule, markedDates };
};

// Enhanced setup calendar dates function with progressive cycle support
export const setupCalendarDatesProgressive = (
  startDate: string, 
  totalDays: number, 
  userWorkoutDays: number[], 
  colors: any = { primary: '#7B69EE' }
) => {
  try {
    if (!userWorkoutDays || userWorkoutDays.length === 0) {
      console.error('No valid workout days provided');
      return {};
    }
    
    // Use the enhanced progressive schedule calculation
    const { markedDates } = calculateProgressiveWorkoutSchedule(
      startDate,
      userWorkoutDays,
      totalDays, // This represents the workout frequency per week
      5 // 5-week cycle
    );
    
    // Update colors to match the provided theme
    Object.keys(markedDates).forEach(dateStr => {
      markedDates[dateStr].selectedColor = colors.primary;
      markedDates[dateStr].dotColor = colors.primary;
    });
    
    return markedDates;
  } catch (error) {
    console.error('Error setting up calendar dates:', error);
    return {};
  }
};

// Enhanced function to get current cycle week and progress
export const getCurrentCycleProgress = async (
  userId: string,
  planId: string
): Promise<{
  currentWeek: number;
  weekName: string;
  completedWorkouts: number;
  totalWorkoutsInCycle: number;
  progressPercentage: number;
  weekDescription: string;
  recommendationTemplate: string;
} | null> => {
  try {
    // Get the active plan information
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, completed_workouts, workout_plans!inner(workout_frequency)')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();
      
    if (planError) throw planError;
    
    if (!planData) return null;
    
    const currentWeek = planData.current_week || 1;
    const completedWorkouts = planData.completed_workouts || 0;
    const workoutFrequency = (planData.workout_plans as any)?.workout_frequency || 3;
    
    // Get cycle week information
    const cycleInfo = await getCycleWeekInfo(currentWeek);
    
    if (!cycleInfo) {
      return {
        currentWeek,
        weekName: 'Unknown',
        completedWorkouts,
        totalWorkoutsInCycle: workoutFrequency * 5, // 5 weeks
        progressPercentage: (completedWorkouts / (workoutFrequency * 5)) * 100,
        weekDescription: 'Week information not available',
        recommendationTemplate: 'Focus on proper form and technique.'
      };
    }
    
    return {
      currentWeek,
      weekName: cycleInfo.weekName,
      completedWorkouts,
      totalWorkoutsInCycle: workoutFrequency * 5, // 5 weeks total
      progressPercentage: (completedWorkouts / (workoutFrequency * 5)) * 100,
      weekDescription: cycleInfo.description,
      recommendationTemplate: cycleInfo.recommendationTemplate
    };
  } catch (error) {
    console.error('Error getting current cycle progress:', error);
    return null;
  }
};

// Enhanced function to check if user should advance to next week
export const checkWeekProgression = async (
  userId: string,
  planId: string
): Promise<{
  shouldAdvance: boolean;
  newWeek: number;
  completedWorkoutsInCurrentWeek: number;
  requiredWorkoutsPerWeek: number;
} | null> => {
  try {
    // Get the active plan information
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, completed_workouts, workout_plans!inner(workout_frequency)')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();
      
    if (planError) throw planError;
    
    if (!planData) return null;
    
    const currentWeek = planData.current_week || 1;
    const totalCompletedWorkouts = planData.completed_workouts || 0;
    const workoutFrequency = (planData.workout_plans as any)?.workout_frequency || 3;
    
    // Calculate how many workouts should be completed for the current week
    const expectedWorkoutsForCurrentWeek = currentWeek * workoutFrequency;
    
    // Check if user has completed enough workouts to advance to next week
    const shouldAdvance = totalCompletedWorkouts >= expectedWorkoutsForCurrentWeek && currentWeek < 5;
    
    // Calculate workouts completed in current week
    const workoutsInPreviousWeeks = (currentWeek - 1) * workoutFrequency;
    const completedWorkoutsInCurrentWeek = totalCompletedWorkouts - workoutsInPreviousWeeks;
    
    return {
      shouldAdvance,
      newWeek: shouldAdvance ? currentWeek + 1 : currentWeek,
      completedWorkoutsInCurrentWeek,
      requiredWorkoutsPerWeek: workoutFrequency
    };
  } catch (error) {
    console.error('Error checking week progression:', error);
    return null;
  }
};

// Export all functions as a default object
const workoutPlanService = {
  saveActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById,
  updateUserWorkoutDays,
  getUserWorkoutDays,
  getActivePlanWithCycleWeek,
  fetchWorkoutData,
  fetchLastExerciseRecords,
  checkWorkoutCompletion,
  checkWorkoutCompletionForCycleWeek, // Add the new function
  completeWorkout,
  fetchActivePlan,
  setupCalendarDates,
  checkWorkoutCompletionForPlan,
  fetchPlanDetails,
  startPlan,
  fetchExerciseDetails,
  fetchExerciseMaxWeightData,
  fetchExerciseAbsoluteMaxWeight,
  savePausedWorkout,
  getPausedWorkout,
  clearPausedWorkout,
  // New progressive cycle functions
  getCycleWeekInfo,
  getAllCycleWeeks,
  getExerciseRecommendations,
  calculateProgressiveWorkoutSchedule,
  setupCalendarDatesProgressive,
  getCurrentCycleProgress,
  checkWeekProgression
};

export default workoutPlanService;