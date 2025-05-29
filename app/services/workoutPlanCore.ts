import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from './supabase';

// Key for the active plan in AsyncStorage
const ACTIVE_PLAN_KEY = 'mindmuscle_active_plan';

// Interface for plan workout day
export interface WorkoutDay {
  day: number;
  exercises: PlanExercise[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
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

// Save a plan as the active plan
export const saveActivePlan = async (plan: SavedPlan): Promise<void> => {
  // Set the started date
  plan.started_at = new Date().toISOString();

  // Default to day 1 (index 0)
  plan.activeDay = 0;

  // Save the plan to AsyncStorage
  await AsyncStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(plan));

  // Optionally, also save to the server/database
  // await uploadActivePlanToServer(plan);
};

// Get the active plan
export const getActivePlan = async (): Promise<SavedPlan | null> => {
  try {
    const planJson = await AsyncStorage.getItem(ACTIVE_PLAN_KEY);
    if (!planJson) return null;

    return JSON.parse(planJson) as SavedPlan;
  } catch {
    // Error fetching active plan
    return null;
  }
};

// Update the active day of the current plan
export const updateActivePlanDay = async (dayIndex: number): Promise<void> => {
  const plan = await getActivePlan();
  if (!plan) throw new Error('No active plan found');

  plan.activeDay = dayIndex;
  await AsyncStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(plan));
};

// Clear the active plan
export const clearActivePlan = async (): Promise<void> => {
  await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
};

// Get plan details by ID from Supabase
export const getPlanById = async (planId: string): Promise<unknown> => {
  const { data, error } = await supabase
    .from('workout_plans')
    .select(
      '*, workout_subcategories!workout_plans_subcategory_id_fkey(title, category_identifier, subtitle)',
    )
    .eq('id', planId)
    .single();

  if (error) throw error;
  return data;
};

// Update user workout days
export const updateUserWorkoutDays = async (
  userId: string,
  workoutDays: string[],
): Promise<void> => {
  const { error } = await supabase.rpc('update_user_workout_days', {
    p_user_id: userId,
    p_workout_days: workoutDays,
  });

  if (error) throw error;
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
      const { data: convertedData, error: conversionError } = await supabase.rpc(
        'convert_workout_days_to_numeric',
        {
          input_days: data.workout_days,
        },
      );

      if (conversionError) {
        console.error('Error converting workout days:', conversionError);
        // Fallback to manual conversion
        if (Array.isArray(data.workout_days) && data.workout_days.length > 0) {
          if (typeof data.workout_days[0] === 'string') {
            // Legacy format - convert to numeric
            const dayNameToNumber: { [key: string]: number } = {
              Sunday: 1,
              '1': 1,
              Monday: 2,
              '2': 2,
              Tuesday: 3,
              '3': 3,
              Wednesday: 4,
              '4': 4,
              Thursday: 5,
              '5': 5,
              Friday: 6,
              '6': 6,
              Saturday: 7,
              '7': 7,
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
  } catch {
    // Error fetching workout days
    // Default to Tuesday, Thursday, Sunday if error
    return [3, 5, 1]; // Tuesday, Thursday, Sunday
  }
};

// Start a new workout plan for the user
export const startPlan = async (userId: string, planId: string): Promise<boolean> => {
  if (!userId || !planId) {
    throw new Error('User ID and Plan ID are required');
  }

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
  const { error: insertError } = await supabase.from('user_active_plans').insert({
    user_id: userId,
    plan_id: planId,
    is_active: true,
    current_day: 1, // Always start with day 1 (using 1-indexed workout days)
    start_date: startDate,
    // Store user's workout days preference to ensure consistency
    workout_days_preference: userWorkoutDays,
  });

  if (insertError) throw insertError;

  return true;
};
