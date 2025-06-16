import supabase from './supabase';
import * as Sentry from '@sentry/react-native';

// Import from modular services
import {
  clearActivePlan,
  getActivePlan,
  getPlanById,
  getUserWorkoutDays,
  setActivePlan,
  startPlan,
  updateActivePlanDay,
  updateUserWorkoutDays,
  type PlanExercise,
  type SavedPlan,
  type WorkoutDay,
} from './workoutPlanCore';

import {
  clearPausedWorkout,
  fetchExerciseAbsoluteMaxWeight,
  fetchExerciseDetails,
  fetchExerciseMaxWeightData,
  getPausedWorkout,
  savePausedWorkout,
  type ExerciseData,
  type ExerciseSet,
} from './workoutSessionService';

import {
  calculateProgressiveWorkoutSchedule,
  checkWeekProgression,
  getAllCycleWeeks,
  getCurrentCycleProgress,
  getCycleWeekInfo,
  getExerciseRecommendations,
  setupCalendarDatesProgressive,
  type CycleWeekInfo,
  type ExerciseRecommendation,
} from './workoutCycleService';

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

// Re-export all interfaces from modular services
export {
  CycleWeekInfo,
  ExerciseData,
  ExerciseRecommendation,
  ExerciseSet,
  PlanExercise,
  SavedPlan,
  WorkoutDay,
};

// Get the active plan with cycle week information
export const getActivePlanWithCycleWeek = async (
  userId: string,
  planId: string,
): Promise<{
  currentWeek: number;
  weekName: string;
  planId: string;
  workoutDay: number;
} | null> => {
  const startTime = Date.now();

  try {
    Sentry.addBreadcrumb({
      message: 'Getting active plan with cycle week information',
      category: 'workout.plan',
      data: { userId, planId },
      level: 'info',
    });

    // Get the active plan information
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, current_day, plan_id')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();

    if (planError) {
      Sentry.captureException(planError, {
        tags: {
          operation: 'getActivePlanWithCycleWeek',
          step: 'get_active_plan',
        },
        extra: { userId, planId },
      });
      throw planError;
    }

    if (!planData) {
      Sentry.addBreadcrumb({
        message: 'No active plan found',
        category: 'workout.plan',
        data: { userId, planId },
        level: 'warning',
      });
      return null;
    }

    // Get the week name
    const { data: weekData, error: weekError } = await supabase
      .from('workout_cycle_weeks')
      .select('name')
      .eq('week_number', planData.current_week)
      .single();

    if (weekError) {
      Sentry.addBreadcrumb({
        message: 'Failed to get week name, using default',
        category: 'workout.plan',
        data: { weekNumber: planData.current_week, error: weekError.message },
        level: 'warning',
      });

      // Return default if we can't get the week name
      const result = {
        currentWeek: planData.current_week || 1,
        weekName: getDefaultWeekName(planData.current_week || 1),
        planId: planData.plan_id,
        workoutDay: planData.current_day || 0,
      };

      const duration = Date.now() - startTime;
      Sentry.addBreadcrumb({
        message: 'Completed getActivePlanWithCycleWeek with default week name',
        category: 'performance',
        data: { duration, result },
        level: 'info',
      });

      return result;
    }

    const result = {
      currentWeek: planData.current_week || 1,
      weekName: weekData?.name || getDefaultWeekName(planData.current_week || 1),
      planId: planData.plan_id,
      workoutDay: planData.current_day || 0,
    };

    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      message: 'Successfully retrieved active plan with cycle week',
      category: 'workout.plan',
      data: { ...result, duration },
      level: 'info',
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    Sentry.captureException(error, {
      tags: {
        operation: 'getActivePlanWithCycleWeek',
        userId,
        planId,
      },
      extra: { userId, planId, duration },
    });

    return null;
  }
};

// Helper function to get default week name based on week number
const getDefaultWeekName = (weekNumber: number): string => {
  try {
    Sentry.addBreadcrumb({
      message: 'Getting default week name',
      category: 'workout.plan',
      data: { weekNumber },
      level: 'debug',
    });

    const weekNames = ['Adaptation', 'Accumulation', 'Intensification', 'Realization', 'Recovery'];
    const index = (weekNumber - 1) % 5;
    const weekName = weekNames[index];

    Sentry.addBreadcrumb({
      message: 'Generated default week name',
      category: 'workout.plan',
      data: { weekNumber, weekName, index },
      level: 'debug',
    });

    return weekName;
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        operation: 'getDefaultWeekName',
      },
      extra: { weekNumber },
    });
    return 'Week ' + weekNumber;
  }
};

// Export all functions from modular services
export {
  calculateProgressiveWorkoutSchedule,
  checkWeekProgression,
  clearActivePlan,
  clearPausedWorkout,
  fetchExerciseAbsoluteMaxWeight,
  fetchExerciseDetails,
  fetchExerciseMaxWeightData,
  getActivePlan,
  getAllCycleWeeks,
  getCurrentCycleProgress,
  // Cycle functions
  getCycleWeekInfo,
  getExerciseRecommendations,
  getPausedWorkout,
  getPlanById,
  getUserWorkoutDays,
  // Core functions
  setActivePlan as saveActivePlan,
  // Session functions
  savePausedWorkout,
  setupCalendarDatesProgressive,
  startPlan,
  updateActivePlanDay,
  updateUserWorkoutDays,
};

// Export a default service object for backward compatibility
const workoutPlanService = {
  saveActivePlan: setActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById,
  updateUserWorkoutDays,
  getUserWorkoutDays,
  startPlan,
  getActivePlanWithCycleWeek,
  savePausedWorkout,
  getPausedWorkout,
  clearPausedWorkout,
  fetchExerciseDetails,
  fetchExerciseMaxWeightData,
  fetchExerciseAbsoluteMaxWeight,
  getCycleWeekInfo,
  getAllCycleWeeks,
  getExerciseRecommendations,
  calculateProgressiveWorkoutSchedule,
  setupCalendarDatesProgressive,
  getCurrentCycleProgress,
  checkWeekProgression,
};

export default workoutPlanService;
