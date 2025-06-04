import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { WorkoutPlanListResponseSchema, type WorkoutPlanApi } from '../validation/apiSchemas';
import { SavedPlanSchema, WorkoutDaySchema } from '../validation/schemas';
import { apiClient } from './apiClient';
import supabase from './supabase';
import { validationService } from './validationService';

// Key for the active plan in AsyncStorage
const ACTIVE_PLAN_KEY = 'mindmuscle_active_plan';

// Define types using z.infer
export type WorkoutDay = z.infer<typeof WorkoutDaySchema>;
export type SavedPlan = z.infer<typeof SavedPlanSchema>;

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

// Save a plan as the active plan
export const setActivePlan = async (plan: SavedPlan): Promise<void> => {
  try {
    const planToSave = {
      id: plan.id,
      title: plan.title,
      difficulty_level: plan.difficulty_level,
      subtitle: plan.subtitle,
      category_name: plan.category_name,
      workoutDays: plan.workoutDays,
      created_at: plan.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    // Validate before saving
    const validationResult = await validationService.validateSavedPlan(planToSave);
    if (!validationResult.success) {
      const errorMessage = `Invalid active plan data: ${validationResult.errors.map((e) => e.message).join(', ')}`;
      logger.error('Cannot set active plan with invalid data', new Error(errorMessage), {
        context: { planToSave, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    await AsyncStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(validationResult.data));
  } catch (error) {
    logger.error('Error setting active plan:', error as Error, { context: { plan } });
    throw error;
  }
};

// Get the active plan
export const getActivePlan = async (): Promise<SavedPlan | null> => {
  try {
    const planJson = await AsyncStorage.getItem(ACTIVE_PLAN_KEY);
    if (planJson) {
      const validationResult = await validationService.validateSavedPlan(JSON.parse(planJson));
      if (validationResult.success) {
        const validatedPlan = validationResult.data;
        return {
          ...validatedPlan,
          created_at: validatedPlan.created_at || new Date(0).toISOString(),
          updated_at: validatedPlan.updated_at || new Date().toISOString(),
        };
      } else {
        logger.warn('Invalid active plan data found in storage, clearing it', {
          context: { errors: validationResult.errors },
        });
        await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
        return null;
      }
    }
    return null;
  } catch (error) {
    logger.error('Error getting active plan:', error as Error);
    await AsyncStorage.removeItem(ACTIVE_PLAN_KEY).catch(() => {});
    return null;
  }
};

// Update the current day of the active plan
export const updateActivePlanDay = async (
  userId: string,
  planId: string,
  newDay: number,
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_active_plans')
      .update({ current_day: newDay })
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true);

    if (error) {
      logger.error('Error updating active plan day:', error, {
        context: { userId, planId, newDay },
      });
      throw error;
    }

    logger.info('Active plan day updated successfully', {
      context: { userId, planId, newDay },
    });
  } catch (error) {
    logger.error('Error updating active plan day:', error as Error, {
      context: { userId, planId, newDay },
    });
    throw error;
  }
};

// Clear the active plan
export const clearActivePlan = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
  } catch (error) {
    logger.error('Error clearing active plan:', error as Error);
    throw error;
  }
};

// Get plan details by ID with API schema validation
export const getPlanById = async (planId: string): Promise<WorkoutPlanApi | null> => {
  try {
    // Try API client with schema validation first
    try {
      const response = await apiClient.requestWithValidation(
        {
          url: `/rest/v1/workout_plans?id=eq.${planId}&select=*,workout_subcategories!workout_plans_subcategory_id_fkey(title,category_identifier,subtitle)`,
          method: 'GET',
        },
        WorkoutPlanListResponseSchema,
        {
          cache: { enabled: true, ttl: 300000 }, // 5 minutes cache
          auth: { required: true },
        },
      );

      const apiResponse = response.data as {
        success: true;
        data: Array<{
          id: string;
          name: string;
          description: string;
          difficulty: 'beginner' | 'intermediate' | 'advanced';
          duration: number;
          frequency: number;
          exercises: Array<{
            exerciseId: string;
            sets: number;
            reps: string;
            weight?: number;
            restTime: number;
            notes?: string;
          }>;
          tags: string[];
          isPublic: boolean;
          createdBy: string;
          createdAt: string;
          updatedAt: string;
        }>;
      };

      // Check if plan was found
      if (!apiResponse.data || apiResponse.data.length === 0) {
        logger.info('Workout plan not found via API client', { context: { planId } });
        return null;
      }

      const plan = apiResponse.data[0];

      logger.info('Workout plan fetched and validated successfully via API client', {
        context: {
          planId,
          planName: plan.name,
          fromCache: response.fromCache,
          validationPassed: response.processed,
        },
      });

      return plan;
    } catch (apiError) {
      logger.warn('API client failed for workout plan, falling back to direct Supabase call', {
        context: { planId, error: (apiError as Error).message },
      });

      // Fallback to direct Supabase call
      const { data, error } = await supabase
        .from('workout_plans')
        .select(
          '*, workout_subcategories!workout_plans_subcategory_id_fkey(title, category_identifier, subtitle)',
        )
        .eq('id', planId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned
          logger.info('Workout plan not found', { context: { planId } });
          return null;
        }
        logger.error('Error fetching workout plan from database', error, {
          context: { planId },
        });
        throw error;
      }

      logger.info('Workout plan fetched successfully via fallback', {
        context: { planId, planName: data?.name },
      });

      return data as WorkoutPlanApi;
    }
  } catch (error) {
    logger.error('Failed to fetch workout plan by ID', error as Error, {
      context: { planId },
    });
    throw error;
  }
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

const SAVED_PLAN_KEY = 'savedCustomPlan';

export const saveCustomPlan = async (plan: SavedPlan): Promise<void> => {
  try {
    const validationResult = await validationService.validateSavedPlan(plan);
    if (!validationResult.success) {
      const errorMessage = `Invalid plan data: ${validationResult.errors.map((e) => e.message).join(', ')}`;
      logger.error('Cannot save invalid plan', new Error(errorMessage), {
        context: { plan, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }
    await AsyncStorage.setItem(SAVED_PLAN_KEY, JSON.stringify(validationResult.data));
  } catch (error) {
    logger.error('Error saving custom plan:', error as Error, { context: { plan } });
    throw error;
  }
};

export const loadCustomPlan = async (): Promise<SavedPlan | null> => {
  try {
    const planJson = await AsyncStorage.getItem(SAVED_PLAN_KEY);
    if (planJson) {
      const validationResult = await validationService.validateSavedPlan(JSON.parse(planJson));
      if (validationResult.success) {
        return validationResult.data;
      } else {
        logger.warn('Invalid saved plan data found in storage, clearing it', {
          context: { errors: validationResult.errors },
        });
        await AsyncStorage.removeItem(SAVED_PLAN_KEY);
        return null;
      }
    }
    return null;
  } catch (error) {
    logger.error('Error loading custom plan:', error as Error);
    await AsyncStorage.removeItem(SAVED_PLAN_KEY).catch(() => {});
    return null;
  }
};

export const deleteCustomPlan = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(SAVED_PLAN_KEY);
  } catch (error) {
    logger.error('Error deleting custom plan:', error as Error);
    throw error;
  }
};

// Check if there is an active plan
export const hasActivePlan = async (): Promise<boolean> => {
  const plan = await getActivePlan();
  return !!plan;
};

export default function disablewarn() {
  return null;
}
