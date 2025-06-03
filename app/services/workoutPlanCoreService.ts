import supabase from './supabase';

// Import from modular services
import {
  saveActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById,
  updateUserWorkoutDays,
  getUserWorkoutDays,
  startPlan,
  type SavedPlan,
  type WorkoutDay,
  type PlanExercise,
} from './workoutPlanCore';

import {
  savePausedWorkout,
  getPausedWorkout,
  clearPausedWorkout,
  fetchExerciseDetails,
  fetchExerciseMaxWeightData,
  fetchExerciseAbsoluteMaxWeight,
  type ExerciseData,
  type ExerciseSet,
} from './workoutSessionService';

import {
  getCycleWeekInfo,
  getAllCycleWeeks,
  getExerciseRecommendations,
  calculateProgressiveWorkoutSchedule,
  setupCalendarDatesProgressive,
  getCurrentCycleProgress,
  checkWeekProgression,
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
  ExerciseData,
  ExerciseSet,
  SavedPlan,
  WorkoutDay,
  PlanExercise,
  CycleWeekInfo,
  ExerciseRecommendation,
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

// Helper function to get default week name based on week number
const getDefaultWeekName = (weekNumber: number): string => {
  const weekNames = ['Adaptation', 'Accumulation', 'Intensification', 'Realization', 'Recovery'];
  const index = (weekNumber - 1) % 5;
  return weekNames[index];
};

// Export all functions from modular services
export {
  // Core functions
  saveActivePlan,
  getActivePlan,
  updateActivePlanDay,
  clearActivePlan,
  getPlanById,
  updateUserWorkoutDays,
  getUserWorkoutDays,
  startPlan,

  // Session functions
  savePausedWorkout,
  getPausedWorkout,
  clearPausedWorkout,
  fetchExerciseDetails,
  fetchExerciseMaxWeightData,
  fetchExerciseAbsoluteMaxWeight,

  // Cycle functions
  getCycleWeekInfo,
  getAllCycleWeeks,
  getExerciseRecommendations,
  calculateProgressiveWorkoutSchedule,
  setupCalendarDatesProgressive,
  getCurrentCycleProgress,
  checkWeekProgression,
};

// Export a default service object for backward compatibility
const workoutPlanService = {
  saveActivePlan,
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
