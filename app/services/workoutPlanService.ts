import supabase from './supabase';

// Import all functions from modular services
import {
  saveActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById,
  updateUserWorkoutDays,
  getUserWorkoutDays,
  type SavedPlan,
  type WorkoutDay,
  type PlanExercise,
} from './workoutPlanCore';

import {
  savePausedWorkout as savePausedWorkoutSession,
  getPausedWorkout as getPausedWorkoutSession,
  clearPausedWorkout as clearPausedWorkoutSession,
  fetchExerciseDetails as fetchExerciseDetailsSession,
  fetchExerciseMaxWeightData as fetchExerciseMaxWeightDataSession,
  fetchExerciseAbsoluteMaxWeight as fetchExerciseAbsoluteMaxWeightSession,
  type ExerciseData,
  type ExerciseSet,
} from './workoutSessionService';

import {
  getCycleWeekInfo,
  getAllCycleWeeks,
  getExerciseRecommendations,
  calculateProgressiveWorkoutSchedule as calculateProgressiveWorkoutScheduleCycle,
  setupCalendarDatesProgressive as setupCalendarDatesProgressiveCycle,
  getCurrentCycleProgress as getCurrentCycleProgressCycle,
  checkWeekProgression as checkWeekProgressionCycle,
  type CycleWeekInfo,
  type ExerciseRecommendation,
} from './workoutCycleService';

import {
  fetchWorkoutData,
  fetchLastExerciseRecords,
  checkWorkoutCompletion,
  getLastCompletedWorkoutStructure,
  checkWorkoutCompletionForCycleWeek,
  completeWorkout,
  type CompletedWorkoutData,
} from './workoutDataService';

import {
  fetchActivePlan,
  setupCalendarDates,
  checkWorkoutCompletionForPlan,
  fetchPlanDetails,
  startPlan as startPlanManagement,
} from './workoutPlanManagementService';

// Re-export interfaces from modular services
export {
  ExerciseData,
  ExerciseSet,
  SavedPlan,
  WorkoutDay,
  PlanExercise,
  CycleWeekInfo,
  ExerciseRecommendation,
  CompletedWorkoutData,
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
      // Return default if we can't get the week name
      return {
        currentWeek: planData.current_week || 1,
        weekName: getDefaultWeekName(planData.current_week || 1),
        planId: planData.plan_id,
        workoutDay: planData.current_day || 0,
      };
    }

    return {
      currentWeek: planData.current_week || 1,
      weekName: weekData?.name || getDefaultWeekName(planData.current_week || 1),
      planId: planData.plan_id,
      workoutDay: planData.current_day || 0,
    };
  } catch {
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
  try {
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
  } catch (error) {
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
    await updateActivePlanDay(workoutDay + 1);

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
  // Core functions
  saveActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById,
  updateUserWorkoutDays,
  getUserWorkoutDays,

  // Session functions
  savePausedWorkoutSession as savePausedWorkout,
  getPausedWorkoutSession as getPausedWorkout,
  clearPausedWorkoutSession as clearPausedWorkout,
  fetchExerciseDetailsSession as fetchExerciseDetails,
  fetchExerciseMaxWeightDataSession as fetchExerciseMaxWeightData,
  fetchExerciseAbsoluteMaxWeightSession as fetchExerciseAbsoluteMaxWeight,

  // Cycle functions
  getCycleWeekInfo,
  getAllCycleWeeks,
  getExerciseRecommendations,
  calculateProgressiveWorkoutScheduleCycle as calculateProgressiveWorkoutSchedule,
  setupCalendarDatesProgressiveCycle as setupCalendarDatesProgressive,
  getCurrentCycleProgressCycle as getCurrentCycleProgress,
  checkWeekProgressionCycle as checkWeekProgression,

  // Data functions
  fetchWorkoutData,
  fetchLastExerciseRecords,
  checkWorkoutCompletion,
  getLastCompletedWorkoutStructure,
  checkWorkoutCompletionForCycleWeek,
  completeWorkout,

  // Management functions
  fetchActivePlan,
  setupCalendarDates,
  checkWorkoutCompletionForPlan,
  fetchPlanDetails,
  startPlanManagement as startPlan,
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
