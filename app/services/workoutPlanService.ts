import { SentryLogger } from './sentry';
import supabase from './supabase';

// Import all functions from modular services
import {
  clearActivePlan,
  getActivePlan,
  getPlanById,
  getUserWorkoutDays,
  setActivePlan as saveActivePlan,
  updateActivePlanDay,
  updateUserWorkoutDays,
  type PlanExercise,
  type SavedPlan,
  type WorkoutDay,
} from './workoutPlanCore';

import {
  clearPausedWorkout as clearPausedWorkoutSession,
  fetchExerciseAbsoluteMaxWeight as fetchExerciseAbsoluteMaxWeightSession,
  fetchExerciseDetails as fetchExerciseDetailsSession,
  fetchExerciseMaxWeightData as fetchExerciseMaxWeightDataSession,
  getPausedWorkout as getPausedWorkoutSession,
  savePausedWorkout as savePausedWorkoutSession,
  type ExerciseData,
  type ExerciseSet,
} from './workoutSessionService';

import {
  calculateProgressiveWorkoutSchedule as calculateProgressiveWorkoutScheduleCycle,
  checkWeekProgression as checkWeekProgressionCycle,
  getAllCycleWeeks,
  getCurrentCycleProgress as getCurrentCycleProgressCycle,
  getCycleWeekInfo,
  getExerciseRecommendations,
  setupCalendarDatesProgressive as setupCalendarDatesProgressiveCycle,
  type CycleWeekInfo,
  type ExerciseRecommendation,
} from './workoutCycleService';

import {
  checkWorkoutCompletion,
  checkWorkoutCompletionForCycleWeek,
  completeWorkout,
  fetchLastExerciseRecords,
  fetchWorkoutData,
  getLastCompletedWorkoutStructure,
  type CompletedWorkoutData,
} from './workoutDataService';

import {
  checkWorkoutCompletionForPlan,
  fetchActivePlan,
  fetchPlanDetails,
  setupCalendarDates,
  startPlan as startPlanManagement,
} from './workoutPlanManagementService';

// Re-export interfaces from modular services
export {
  CompletedWorkoutData,
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
    SentryLogger.database.query('user_active_plans', 'select', {
      user_id: userId,
      plan_id: planId,
      operation: 'get_active_plan_with_cycle_week',
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
      SentryLogger.database.error('user_active_plans', 'select', planError.message);
      throw planError;
    }

    if (!planData) {
      SentryLogger.info(
        'No active plan found',
        {
          user_id: userId,
          plan_id: planId,
          operation: 'get_active_plan_with_cycle_week',
        },
        { feature: 'workout_plan', action: 'not_found' },
      );
      return null;
    }

    // Get the week name
    const { data: weekData, error: weekError } = await supabase
      .from('workout_cycle_weeks')
      .select('name')
      .eq('week_number', planData.current_week)
      .single();

    if (weekError) {
      SentryLogger.warn(
        'Could not fetch week name, using default',
        {
          week_number: planData.current_week,
          error: weekError.message,
          operation: 'get_active_plan_with_cycle_week',
        },
        { feature: 'workout_plan', action: 'fallback' },
      );

      // Return default if we can't get the week name
      return {
        currentWeek: planData.current_week || 1,
        weekName: getDefaultWeekName(planData.current_week || 1),
        planId: planData.plan_id,
        workoutDay: planData.current_day || 0,
      };
    }

    const result = {
      currentWeek: planData.current_week || 1,
      weekName: weekData?.name || getDefaultWeekName(planData.current_week || 1),
      planId: planData.plan_id,
      workoutDay: planData.current_day || 0,
    };

    const duration = Date.now() - startTime;
    SentryLogger.info(
      'Active plan with cycle week retrieved successfully',
      {
        user_id: userId,
        plan_id: planId,
        current_week: result.currentWeek,
        week_name: result.weekName,
        workout_day: result.workoutDay,
        duration_ms: duration,
        operation: 'get_active_plan_with_cycle_week',
      },
      { feature: 'workout_plan', action: 'success' },
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    SentryLogger.error(
      'Failed to get active plan with cycle week',
      {
        user_id: userId,
        plan_id: planId,
        error_message: error instanceof Error ? error.message : String(error),
        duration_ms: duration,
        operation: 'get_active_plan_with_cycle_week',
      },
      { feature: 'workout_plan', action: 'error' },
    );
    return null;
  }
};

// Save completed workout data
export const saveCompletedWorkout = async (workoutData: {
  userId: string;
  planId: string;
  workoutDay: number;
  cycleWeek: number;
  weekName: string;
  exercises: ExerciseData[];
  exerciseSets: Record<string, ExerciseSet[]>;
  totalVolume: number;
  totalReps: number;
  duration: number;
  completedAt: string;
}): Promise<void> => {
  const startTime = Date.now();

  try {
    SentryLogger.workout.completed(
      `${workoutData.planId}_day_${workoutData.workoutDay}`,
      workoutData.duration,
      workoutData.exercises.length,
    );

    SentryLogger.info(
      'Saving completed workout',
      {
        user_id: workoutData.userId,
        plan_id: workoutData.planId,
        workout_day: workoutData.workoutDay,
        cycle_week: workoutData.cycleWeek,
        week_name: workoutData.weekName,
        exercise_count: workoutData.exercises.length,
        total_volume: workoutData.totalVolume,
        total_reps: workoutData.totalReps,
        duration_seconds: workoutData.duration,
        operation: 'save_completed_workout',
      },
      { feature: 'workout_completion', action: 'start' },
    );

    // Use the existing completeWorkout function with proper options object
    await completeWorkout({
      userId: workoutData.userId,
      planId: workoutData.planId,
      workoutDay: workoutData.workoutDay,
      cycleWeek: workoutData.cycleWeek,
      weekName: workoutData.weekName,
      exercises: workoutData.exercises,
      exerciseSets: workoutData.exerciseSets,
      workoutDuration: workoutData.duration,
      totalVolume: workoutData.totalVolume,
      totalReps: workoutData.totalReps,
    });

    const saveDuration = Date.now() - startTime;
    SentryLogger.info(
      'Completed workout saved successfully',
      {
        user_id: workoutData.userId,
        plan_id: workoutData.planId,
        workout_day: workoutData.workoutDay,
        save_duration_ms: saveDuration,
        operation: 'save_completed_workout',
      },
      { feature: 'workout_completion', action: 'success' },
    );
  } catch (error) {
    const saveDuration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.workout.error(
      `${workoutData.planId}_day_${workoutData.workoutDay}`,
      errorMessage,
      {
        user_id: workoutData.userId,
        save_duration_ms: saveDuration,
        operation: 'save_completed_workout',
      },
    );

    console.error('Error saving completed workout:', error);
    throw error;
  }
};

// Update plan progress
export const updatePlanProgress = async (
  userId: string,
  planId: string,
  workoutDay: number,
  cycleWeek: number,
): Promise<void> => {
  try {
    // Update the active plan's current day (just pass the day index)
    await updateActivePlanDay(userId, planId, workoutDay + 1);

    // Check if we need to progress to the next week
    const weekProgression = await checkWeekProgressionCycle(userId, planId);
    if (weekProgression) {
      // Update the current week in the active plan
      const { error } = await supabase
        .from('user_active_plans')
        .update({ current_week: cycleWeek + 1 })
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('is_active', true);

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error updating plan progress:', error);
    throw error;
  }
};

// Helper function to get default week name based on week number
const getDefaultWeekName = (weekNumber: number): string => {
  const weekNames = ['Adaptation', 'Accumulation', 'Intensification', 'Realization', 'Recovery'];
  const index = (weekNumber - 1) % 5;
  return weekNames[index];
};

// Re-export functions from modular services with consistent naming
export {
  calculateProgressiveWorkoutScheduleCycle as calculateProgressiveWorkoutSchedule,
  checkWeekProgressionCycle as checkWeekProgression,
  checkWorkoutCompletion,
  checkWorkoutCompletionForCycleWeek,
  checkWorkoutCompletionForPlan,
  clearActivePlan,
  clearPausedWorkoutSession as clearPausedWorkout,
  completeWorkout,

  // Management functions
  fetchActivePlan,
  fetchExerciseAbsoluteMaxWeightSession as fetchExerciseAbsoluteMaxWeight,
  fetchExerciseDetailsSession as fetchExerciseDetails,
  fetchExerciseMaxWeightDataSession as fetchExerciseMaxWeightData,
  fetchLastExerciseRecords,
  fetchPlanDetails,
  // Data functions
  fetchWorkoutData,
  getActivePlan,
  getAllCycleWeeks,
  getCurrentCycleProgressCycle as getCurrentCycleProgress,
  // Cycle functions
  getCycleWeekInfo,
  getExerciseRecommendations,
  getLastCompletedWorkoutStructure,
  getPausedWorkoutSession as getPausedWorkout,
  getPlanById,
  getUserWorkoutDays,
  // Core functions
  saveActivePlan,
  // Session functions
  savePausedWorkoutSession as savePausedWorkout,
  setupCalendarDates,
  setupCalendarDatesProgressiveCycle as setupCalendarDatesProgressive,
  startPlanManagement as startPlan,
  updateActivePlanDay,
  updateUserWorkoutDays,
};

// Export all functions as a default object for backward compatibility
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
  checkWorkoutCompletionForCycleWeek,
  getLastCompletedWorkoutStructure,
  completeWorkout,
  fetchActivePlan,
  setupCalendarDates,
  checkWorkoutCompletionForPlan,
  fetchPlanDetails,
  startPlan: startPlanManagement,
  fetchExerciseDetails: fetchExerciseDetailsSession,
  fetchExerciseMaxWeightData: fetchExerciseMaxWeightDataSession,
  fetchExerciseAbsoluteMaxWeight: fetchExerciseAbsoluteMaxWeightSession,
  savePausedWorkout: savePausedWorkoutSession,
  getPausedWorkout: getPausedWorkoutSession,
  clearPausedWorkout: clearPausedWorkoutSession,
  getCycleWeekInfo,
  getAllCycleWeeks,
  getExerciseRecommendations,
  calculateProgressiveWorkoutSchedule: calculateProgressiveWorkoutScheduleCycle,
  setupCalendarDatesProgressive: setupCalendarDatesProgressiveCycle,
  getCurrentCycleProgress: getCurrentCycleProgressCycle,
  checkWeekProgression: checkWeekProgressionCycle,
  saveCompletedWorkout,
  updatePlanProgress,
};

export default workoutPlanService;
