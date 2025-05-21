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

export default {
  saveActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById
}; 