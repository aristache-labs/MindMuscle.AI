import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from './supabase';

// Key for the active plan in AsyncStorage
const ACTIVE_PLAN_KEY = 'mindmuscle_active_plan';

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
    
    console.log('Plan saved successfully:', plan.id);
  } catch (error) {
    console.error('Error saving active plan:', error);
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
    console.error('Error fetching active plan:', error);
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
    console.error('Error updating active plan day:', error);
    throw error;
  }
};

// Clear the active plan
export const clearActivePlan = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
  } catch (error) {
    console.error('Error clearing active plan:', error);
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
    console.error('Error fetching plan:', error);
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
    console.log('User workout days updated:', data);
  } catch (error) {
    console.error('Error updating workout days:', error);
    throw error;
  }
};

// Get user workout days
export const getUserWorkoutDays = async (userId: string): Promise<string[]> => {
  try {
    const { data, error } = await supabase
      .from('user_profile_details')
      .select('workout_days')
      .eq('user_id', userId)
      .single();
      
    if (error) throw error;
    
    if (data && Array.isArray(data.workout_days)) {
      return data.workout_days;
    }
    
    // Default to weekdays if no preference set
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  } catch (error) {
    console.error('Error fetching workout days:', error);
    // Default to weekdays if error
    return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
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
      console.error('Error fetching cycle week name:', weekError);
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
    console.error('Error fetching plan cycle week:', error);
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

export default {
  saveActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById,
  updateUserWorkoutDays,
  getUserWorkoutDays,
  getActivePlanWithCycleWeek
}; 