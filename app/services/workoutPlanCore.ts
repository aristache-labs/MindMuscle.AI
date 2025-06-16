import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { WorkoutPlanListResponseSchema, type WorkoutPlanApi } from '../validation/apiSchemas';
import { SavedPlanSchema, WorkoutDaySchema } from '../validation/schemas';
import { apiClient } from './apiClient';
import { SentryLogger } from './sentry';
import { addBreadcrumb, captureDatabaseError } from './sentry/simpleErrorHandler';
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
  const startTime = Date.now();

  try {
    addBreadcrumb('Setting active plan', 'workout_plan', {
      plan_id: plan.id,
      plan_title: plan.title,
      difficulty_level: plan.difficulty_level,
    });

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

      SentryLogger.error(
        'Set active plan validation failed',
        {
          plan_id: plan.id,
          plan_title: plan.title,
          validation_errors: validationResult.errors,
          operation: 'set_active_plan',
        },
        { feature: 'workout_plan', action: 'validation_error' },
      );

      logger.error('Cannot set active plan with invalid data', new Error(errorMessage), {
        context: { planToSave, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    await AsyncStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(validationResult.data));

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'Active plan set successfully',
      {
        plan_id: plan.id,
        plan_title: plan.title,
        difficulty_level: plan.difficulty_level,
        workout_days_count: plan.workoutDays?.length || 0,
        duration_ms: duration,
        operation: 'set_active_plan',
      },
      { feature: 'workout_plan', action: 'success' },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to set active plan',
      {
        plan_id: plan.id,
        plan_title: plan.title,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'set_active_plan',
      },
      { feature: 'workout_plan', action: 'error' },
    );

    logger.error('Error setting active plan:', error as Error, { context: { plan } });
    throw error;
  }
};

// Get the active plan
export const getActivePlan = async (): Promise<SavedPlan | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Getting active plan', 'workout_plan', {});

    const planJson = await AsyncStorage.getItem(ACTIVE_PLAN_KEY);
    if (planJson) {
      const validationResult = await validationService.validateSavedPlan(JSON.parse(planJson));
      if (validationResult.success) {
        const validatedPlan = validationResult.data as SavedPlan;
        const result = {
          ...validatedPlan,
          created_at: validatedPlan.created_at || new Date(0).toISOString(),
          updated_at: validatedPlan.updated_at || new Date().toISOString(),
        };

        const duration = Date.now() - startTime;

        SentryLogger.info(
          'Active plan retrieved successfully',
          {
            plan_id: result.id,
            plan_title: result.title,
            difficulty_level: result.difficulty_level,
            workout_days_count: result.workoutDays?.length || 0,
            duration_ms: duration,
            operation: 'get_active_plan',
          },
          { feature: 'workout_plan', action: 'success' },
        );

        return result;
      } else {
        SentryLogger.warn(
          'Invalid active plan data found in storage',
          {
            validation_errors: validationResult.errors,
            operation: 'get_active_plan',
          },
          { feature: 'workout_plan', action: 'validation_error' },
        );

        logger.warn('Invalid active plan data found in storage, clearing it', {
          context: { errors: validationResult.errors },
        });
        await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);
        return null;
      }
    }

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'No active plan found in storage',
      {
        duration_ms: duration,
        operation: 'get_active_plan',
      },
      { feature: 'workout_plan', action: 'not_found' },
    );

    return null;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to get active plan',
      {
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'get_active_plan',
      },
      { feature: 'workout_plan', action: 'error' },
    );

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
  const startTime = Date.now();

  try {
    addBreadcrumb('Updating active plan day', 'workout_plan', {
      user_id: userId,
      plan_id: planId,
      new_day: newDay,
    });

    const { error } = await supabase
      .from('user_active_plans')
      .update({ current_day: newDay })
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true);

    if (error) {
      captureDatabaseError(error, 'user_active_plans', 'update');

      logger.error('Error updating active plan day:', error, {
        context: { userId, planId, newDay },
      });
      throw error;
    }

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'Active plan day updated successfully',
      {
        user_id: userId,
        plan_id: planId,
        new_day: newDay,
        duration_ms: duration,
        operation: 'update_active_plan_day',
      },
      { feature: 'workout_plan', action: 'success' },
    );

    logger.info('Active plan day updated successfully', {
      context: { userId, planId, newDay },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to update active plan day',
      {
        user_id: userId,
        plan_id: planId,
        new_day: newDay,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'update_active_plan_day',
      },
      { feature: 'workout_plan', action: 'error' },
    );

    logger.error('Error updating active plan day:', error as Error, {
      context: { userId, planId, newDay },
    });
    throw error;
  }
};

// Clear the active plan
export const clearActivePlan = async (): Promise<void> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Clearing active plan', 'workout_plan', {});

    await AsyncStorage.removeItem(ACTIVE_PLAN_KEY);

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'Active plan cleared successfully',
      {
        duration_ms: duration,
        operation: 'clear_active_plan',
      },
      { feature: 'workout_plan', action: 'success' },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to clear active plan',
      {
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'clear_active_plan',
      },
      { feature: 'workout_plan', action: 'error' },
    );

    logger.error('Error clearing active plan:', error as Error);
    throw error;
  }
};

// Get plan details by ID with API schema validation
export const getPlanById = async (planId: string): Promise<WorkoutPlanApi | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Getting plan by ID', 'workout_plan', {
      plan_id: planId,
    });

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
        const duration = Date.now() - startTime;

        SentryLogger.info(
          'Workout plan not found via API client',
          {
            plan_id: planId,
            duration_ms: duration,
            operation: 'get_plan_by_id',
          },
          { feature: 'workout_plan', action: 'not_found' },
        );

        logger.info('Workout plan not found via API client', { context: { planId } });
        return null;
      }

      const plan = apiResponse.data[0];
      const duration = Date.now() - startTime;

      SentryLogger.info(
        'Workout plan fetched successfully via API client',
        {
          plan_id: planId,
          plan_name: plan.name,
          from_cache: response.fromCache,
          validation_passed: response.processed,
          duration_ms: duration,
          operation: 'get_plan_by_id',
        },
        { feature: 'workout_plan', action: 'success' },
      );

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
          const duration = Date.now() - startTime;

          SentryLogger.info(
            'Workout plan not found via fallback',
            {
              plan_id: planId,
              duration_ms: duration,
              operation: 'get_plan_by_id',
            },
            { feature: 'workout_plan', action: 'not_found' },
          );

          logger.info('Workout plan not found', { context: { planId } });
          return null;
        }

        captureDatabaseError(error, 'workout_plans', 'select');

        logger.error('Error fetching workout plan from database', error, {
          context: { planId },
        });
        throw error;
      }

      const duration = Date.now() - startTime;

      SentryLogger.info(
        'Workout plan fetched successfully via fallback',
        {
          plan_id: planId,
          plan_name: data?.name,
          duration_ms: duration,
          operation: 'get_plan_by_id',
        },
        { feature: 'workout_plan', action: 'success' },
      );

      logger.info('Workout plan fetched successfully via fallback', {
        context: { planId, planName: data?.name },
      });

      return data as WorkoutPlanApi;
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to fetch workout plan by ID',
      {
        plan_id: planId,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'get_plan_by_id',
      },
      { feature: 'workout_plan', action: 'error' },
    );

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
  const startTime = Date.now();

  try {
    addBreadcrumb('Updating user workout days', 'workout_plan', {
      user_id: userId,
      workout_days_count: workoutDays.length,
    });

    const { error } = await supabase.rpc('update_user_workout_days', {
      p_user_id: userId,
      p_workout_days: workoutDays,
    });

    if (error) {
      captureDatabaseError(error, 'user_profile_details', 'rpc_call');
      throw error;
    }

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'User workout days updated successfully',
      {
        user_id: userId,
        workout_days: workoutDays,
        workout_days_count: workoutDays.length,
        duration_ms: duration,
        operation: 'update_user_workout_days',
      },
      { feature: 'workout_plan', action: 'success' },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to update user workout days',
      {
        user_id: userId,
        workout_days: workoutDays,
        workout_days_count: workoutDays.length,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'update_user_workout_days',
      },
      { feature: 'workout_plan', action: 'error' },
    );

    throw error;
  }
};

// Get user workout days
export const getUserWorkoutDays = async (userId: string): Promise<number[]> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Getting user workout days', 'workout_plan', {
      user_id: userId,
    });

    const { data, error } = await supabase
      .from('user_profile_details')
      .select('workout_days')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      captureDatabaseError(error, 'user_profile_details', 'select');

      console.error('Error fetching user workout days:', error);

      const duration = Date.now() - startTime;

      SentryLogger.warn(
        'Failed to fetch user workout days, using defaults',
        {
          user_id: userId,
          error_message: error.message,
          default_days: [0, 2, 4],
          duration_ms: duration,
          operation: 'get_user_workout_days',
        },
        { feature: 'workout_plan', action: 'fallback' },
      );

      // Default to Tuesday, Thursday, Sunday in 0-6 format (2, 4, 0)
      return [0, 2, 4];
    }

    if (
      data &&
      data.workout_days &&
      Array.isArray(data.workout_days) &&
      data.workout_days.length > 0
    ) {
      if (typeof data.workout_days[0] === 'string') {
        // Legacy string format - convert to 0-6 numeric format
        const dayNameToNumber: { [key: string]: number } = {
          Sunday: 0,
          '1': 0, // Legacy 1 = Sunday = 0
          Monday: 1,
          '2': 1, // Legacy 2 = Monday = 1
          Tuesday: 2,
          '3': 2, // Legacy 3 = Tuesday = 2
          Wednesday: 3,
          '4': 3, // Legacy 4 = Wednesday = 3
          Thursday: 4,
          '5': 4, // Legacy 5 = Thursday = 4
          Friday: 5,
          '6': 5, // Legacy 6 = Friday = 5
          Saturday: 6,
          '7': 6, // Legacy 7 = Saturday = 6
        };

        const numericDays = data.workout_days
          .map((day: string) => dayNameToNumber[day])
          .filter((dayNum: number) => dayNum !== undefined)
          .sort((a: number, b: number) => a - b);

        const result = numericDays.length > 0 ? numericDays : [0, 2, 4];
        const duration = Date.now() - startTime;

        SentryLogger.info(
          'User workout days retrieved successfully (legacy string format)',
          {
            user_id: userId,
            workout_days: result,
            original_format: 'string',
            duration_ms: duration,
            operation: 'get_user_workout_days',
          },
          { feature: 'workout_plan', action: 'success' },
        );

        return result; // Default: Sunday, Tuesday, Thursday
      } else {
        // Numeric format - ensure it's in 0-6 range
        const numericDays = data.workout_days
          .map((day: number) => {
            // Convert from 1-7 to 0-6 if needed (only if 7 is present, indicating old format)
            if (data.workout_days.includes(7) && day >= 1 && day <= 7) {
              return day - 1;
            }
            return day;
          })
          .filter((day: number) => day >= 0 && day <= 6)
          .sort((a: number, b: number) => a - b);

        const result = numericDays.length > 0 ? numericDays : [0, 2, 4];
        const duration = Date.now() - startTime;

        SentryLogger.info(
          'User workout days retrieved successfully (numeric format)',
          {
            user_id: userId,
            workout_days: result,
            original_format: 'numeric',
            duration_ms: duration,
            operation: 'get_user_workout_days',
          },
          { feature: 'workout_plan', action: 'success' },
        );

        return result; // Default: Sunday, Tuesday, Thursday
      }
    }

    const duration = Date.now() - startTime;
    const defaultDays = [0, 2, 4];

    SentryLogger.info(
      'User workout days retrieved (using defaults)',
      {
        user_id: userId,
        workout_days: defaultDays,
        duration_ms: duration,
        operation: 'get_user_workout_days',
      },
      { feature: 'workout_plan', action: 'default_used' },
    );

    // Default to Sunday, Tuesday, Thursday in 0-6 format if no preference set
    return defaultDays;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const defaultDays = [0, 2, 4];

    SentryLogger.error(
      'Error fetching user workout days, using defaults',
      {
        user_id: userId,
        error_message: errorMessage,
        default_days: defaultDays,
        duration_ms: duration,
        operation: 'get_user_workout_days',
      },
      { feature: 'workout_plan', action: 'error_fallback' },
    );

    // Error fetching workout days
    // Default to Sunday, Tuesday, Thursday in 0-6 format if error
    return defaultDays;
  }
};

// Start a new workout plan for the user
export const startPlan = async (userId: string, planId: string): Promise<boolean> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Starting workout plan', 'workout_plan', {
      user_id: userId,
      plan_id: planId,
    });

    if (!userId || !planId) {
      const errorMessage = 'User ID and Plan ID are required';

      SentryLogger.error(
        'Start plan validation failed',
        {
          user_id: userId,
          plan_id: planId,
          error_message: errorMessage,
          operation: 'start_plan',
        },
        { feature: 'workout_plan', action: 'validation_error' },
      );

      throw new Error(errorMessage);
    }

    // Fetch user's preferred workout days first
    const userWorkoutDays = await getUserWorkoutDays(userId);

    // Check if user already has an active plan
    const { data: existingPlans, error: fetchError } = await supabase
      .from('user_active_plans')
      .select('id, plan_id')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (fetchError) {
      captureDatabaseError(fetchError, 'user_active_plans', 'select');
      throw fetchError;
    }

    if (existingPlans && existingPlans.length > 0) {
      // Set all existing plans to inactive
      const { error: updateError } = await supabase
        .from('user_active_plans')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true);

      if (updateError) {
        captureDatabaseError(updateError, 'user_active_plans', 'update');
        throw updateError;
      }
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

    if (insertError) {
      captureDatabaseError(insertError, 'user_active_plans', 'insert');
      throw insertError;
    }

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'Workout plan started successfully',
      {
        user_id: userId,
        plan_id: planId,
        start_date: startDate,
        workout_days_count: userWorkoutDays.length,
        existing_plans_deactivated: existingPlans?.length || 0,
        duration_ms: duration,
        operation: 'start_plan',
      },
      { feature: 'workout_plan', action: 'success' },
    );

    return true;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to start workout plan',
      {
        user_id: userId,
        plan_id: planId,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'start_plan',
      },
      { feature: 'workout_plan', action: 'error' },
    );

    throw error;
  }
};

const SAVED_PLAN_KEY = 'savedCustomPlan';

export const saveCustomPlan = async (plan: SavedPlan): Promise<void> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Saving custom plan', 'workout_plan', {
      plan_id: plan.id,
      plan_title: plan.title,
    });

    const validationResult = await validationService.validateSavedPlan(plan);
    if (!validationResult.success) {
      const errorMessage = `Invalid plan data: ${validationResult.errors.map((e) => e.message).join(', ')}`;

      SentryLogger.error(
        'Save custom plan validation failed',
        {
          plan_id: plan.id,
          plan_title: plan.title,
          validation_errors: validationResult.errors,
          operation: 'save_custom_plan',
        },
        { feature: 'workout_plan', action: 'validation_error' },
      );

      logger.error('Cannot save invalid plan', new Error(errorMessage), {
        context: { plan, errors: validationResult.errors },
      });
      throw new Error(errorMessage);
    }

    await AsyncStorage.setItem(SAVED_PLAN_KEY, JSON.stringify(validationResult.data));

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'Custom plan saved successfully',
      {
        plan_id: plan.id,
        plan_title: plan.title,
        difficulty_level: plan.difficulty_level,
        workout_days_count: plan.workoutDays?.length || 0,
        duration_ms: duration,
        operation: 'save_custom_plan',
      },
      { feature: 'workout_plan', action: 'success' },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to save custom plan',
      {
        plan_id: plan.id,
        plan_title: plan.title,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'save_custom_plan',
      },
      { feature: 'workout_plan', action: 'error' },
    );

    logger.error('Error saving custom plan:', error as Error, { context: { plan } });
    throw error;
  }
};

export const loadCustomPlan = async (): Promise<SavedPlan | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Loading custom plan', 'workout_plan', {});

    const planJson = await AsyncStorage.getItem(SAVED_PLAN_KEY);
    if (planJson) {
      const validationResult = await validationService.validateSavedPlan(JSON.parse(planJson));
      if (validationResult.success) {
        const plan = validationResult.data as SavedPlan;
        const duration = Date.now() - startTime;

        SentryLogger.info(
          'Custom plan loaded successfully',
          {
            plan_id: plan.id,
            plan_title: plan.title,
            difficulty_level: plan.difficulty_level,
            workout_days_count: plan.workoutDays?.length || 0,
            duration_ms: duration,
            operation: 'load_custom_plan',
          },
          { feature: 'workout_plan', action: 'success' },
        );

        return plan;
      } else {
        SentryLogger.warn(
          'Invalid saved plan data found in storage',
          {
            validation_errors: validationResult.errors,
            operation: 'load_custom_plan',
          },
          { feature: 'workout_plan', action: 'validation_error' },
        );

        logger.warn('Invalid saved plan data found in storage, clearing it', {
          context: { errors: validationResult.errors },
        });
        await AsyncStorage.removeItem(SAVED_PLAN_KEY);
        return null;
      }
    }

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'No custom plan found in storage',
      {
        duration_ms: duration,
        operation: 'load_custom_plan',
      },
      { feature: 'workout_plan', action: 'not_found' },
    );

    return null;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to load custom plan',
      {
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'load_custom_plan',
      },
      { feature: 'workout_plan', action: 'error' },
    );

    logger.error('Error loading custom plan:', error as Error);
    await AsyncStorage.removeItem(SAVED_PLAN_KEY).catch(() => {});
    return null;
  }
};

export const deleteCustomPlan = async (): Promise<void> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Deleting custom plan', 'workout_plan', {});

    await AsyncStorage.removeItem(SAVED_PLAN_KEY);

    const duration = Date.now() - startTime;

    SentryLogger.info(
      'Custom plan deleted successfully',
      {
        duration_ms: duration,
        operation: 'delete_custom_plan',
      },
      { feature: 'workout_plan', action: 'success' },
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to delete custom plan',
      {
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'delete_custom_plan',
      },
      { feature: 'workout_plan', action: 'error' },
    );

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
