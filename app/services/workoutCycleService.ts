import supabase from './supabase';
import { SentryLogger } from './sentry';
import {
  addBreadcrumb,
  captureDatabaseError,
  capturePerformanceError,
} from './sentry/simpleErrorHandler';

// Interface for cycle week information
export interface CycleWeekInfo {
  weekNumber: number;
  weekName: string;
  description: string;
  recommendationTemplate: string;
  weightAdjustmentPercentage: number;
  repsAdjustmentPercentage: number;
}

// Interface for exercise recommendations
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

// Interface for calendar marked dates
interface CalendarMarkedDate {
  selected: boolean;
  selectedColor: string;
  marked: boolean;
  dotColor: string;
  workoutDayIndex: number;
  cycleWeek: number;
  weekName: string;
  dayName: string;
  userDayNumber: number;
}

// Interface for colors configuration
interface ColorsConfig {
  primary: string;
}

// Get cycle week information from database
export const getCycleWeekInfo = async (weekNumber: number): Promise<CycleWeekInfo | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Getting cycle week info', 'workout_cycle', { week_number: weekNumber });

    SentryLogger.database.query('workout_cycle_weeks', 'select', {
      week_number: weekNumber,
      operation: 'get_cycle_week_info',
    });

    const { data, error } = await supabase
      .from('workout_cycle_weeks')
      .select('*')
      .eq('week_number', weekNumber)
      .single();

    if (error) {
      SentryLogger.database.error('workout_cycle_weeks', 'select', error.message);
      throw error;
    }

    if (!data) {
      SentryLogger.info(
        'No cycle week data found',
        {
          week_number: weekNumber,
          operation: 'get_cycle_week_info',
        },
        { feature: 'workout_cycle', action: 'not_found' },
      );
      return null;
    }

    const result = {
      weekNumber: data.week_number,
      weekName: data.name,
      description: data.description,
      recommendationTemplate: data.recommendation_template,
      weightAdjustmentPercentage: data.weight_adjustment_percentage,
      repsAdjustmentPercentage: data.reps_adjustment_percentage,
    };

    const duration = Date.now() - startTime;

    // Monitor for slow database queries
    if (duration > 1000) {
      capturePerformanceError(
        'Slow cycle week info query detected',
        'database_query_duration',
        duration,
      );
    }

    SentryLogger.info(
      'Cycle week info retrieved successfully',
      {
        week_number: weekNumber,
        week_name: result.weekName,
        duration_ms: duration,
        operation: 'get_cycle_week_info',
      },
      { feature: 'workout_cycle', action: 'success' },
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'workout_cycle_weeks',
      'select',
    );

    SentryLogger.error(
      'Failed to get cycle week info',
      {
        week_number: weekNumber,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'get_cycle_week_info',
      },
      { feature: 'workout_cycle', action: 'error' },
    );

    return null;
  }
};

// Get all cycle weeks information
export const getAllCycleWeeks = async (): Promise<CycleWeekInfo[]> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Getting all cycle weeks', 'workout_cycle', {});

    SentryLogger.database.query('workout_cycle_weeks', 'select', {
      operation: 'get_all_cycle_weeks',
    });

    const { data, error } = await supabase
      .from('workout_cycle_weeks')
      .select('*')
      .order('week_number', { ascending: true });

    if (error) {
      SentryLogger.database.error('workout_cycle_weeks', 'select', error.message);
      throw error;
    }

    const result = data.map((week) => ({
      weekNumber: week.week_number,
      weekName: week.name,
      description: week.description,
      recommendationTemplate: week.recommendation_template,
      weightAdjustmentPercentage: week.weight_adjustment_percentage,
      repsAdjustmentPercentage: week.reps_adjustment_percentage,
    }));

    const duration = Date.now() - startTime;

    // Monitor for slow database queries
    if (duration > 1500) {
      capturePerformanceError(
        'Slow all cycle weeks query detected',
        'database_query_duration',
        duration,
      );
    }

    SentryLogger.info(
      'All cycle weeks retrieved successfully',
      {
        weeks_count: result.length,
        duration_ms: duration,
        operation: 'get_all_cycle_weeks',
      },
      { feature: 'workout_cycle', action: 'success' },
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'workout_cycle_weeks',
      'select',
    );

    SentryLogger.error(
      'Failed to get all cycle weeks',
      {
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'get_all_cycle_weeks',
      },
      { feature: 'workout_cycle', action: 'error' },
    );

    return [];
  }
};

// Enhanced function to get exercise recommendations with smart cycle progression
export const getExerciseRecommendations = async (
  userId: string,
  exerciseId: string,
  cycleWeek: number,
): Promise<ExerciseRecommendation | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Getting exercise recommendations', 'workout_cycle', {
      user_id: userId,
      exercise_id: exerciseId,
      cycle_week: cycleWeek,
    });

    SentryLogger.database.query('get_smart_exercise_recommendations', 'rpc', {
      user_id: userId,
      exercise_id: exerciseId,
      cycle_week: cycleWeek,
      operation: 'get_exercise_recommendations',
    });

    const { data, error } = await supabase.rpc('get_smart_exercise_recommendations', {
      p_cycle_week: cycleWeek,
      p_exercise_id: exerciseId,
      p_user_id: userId,
    });

    if (error) {
      SentryLogger.database.error('get_smart_exercise_recommendations', 'rpc', error.message);
      throw error;
    }

    if (!data || data.length === 0) {
      SentryLogger.info(
        'No exercise recommendations found',
        {
          user_id: userId,
          exercise_id: exerciseId,
          cycle_week: cycleWeek,
          operation: 'get_exercise_recommendations',
        },
        { feature: 'workout_cycle', action: 'not_found' },
      );
      return null;
    }

    const recommendation = data[0];

    // Get cycle week info for additional context
    const cycleInfo = await getCycleWeekInfo(cycleWeek);

    const result = {
      previousWeight: recommendation.previous_weight,
      previousReps: recommendation.previous_reps,
      recommendedWeight: recommendation.recommended_weight,
      recommendedReps: recommendation.recommended_reps,
      recommendationText: recommendation.recommendation_text,
      weekAdjustmentPercentage: cycleInfo?.weightAdjustmentPercentage || 0,
      repsAdjustmentPercentage: cycleInfo?.repsAdjustmentPercentage || 0,
      weekName: cycleInfo?.weekName || 'Unknown',
    };

    const duration = Date.now() - startTime;

    // Monitor for slow RPC calls
    if (duration > 2000) {
      capturePerformanceError(
        'Slow exercise recommendations RPC detected',
        'rpc_call_duration',
        duration,
      );
    }

    SentryLogger.info(
      'Exercise recommendations retrieved successfully',
      {
        user_id: userId,
        exercise_id: exerciseId,
        cycle_week: cycleWeek,
        week_name: result.weekName,
        recommended_weight: result.recommendedWeight,
        recommended_reps: result.recommendedReps,
        duration_ms: duration,
        operation: 'get_exercise_recommendations',
      },
      { feature: 'workout_cycle', action: 'success' },
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'get_smart_exercise_recommendations',
      'rpc',
    );

    SentryLogger.error(
      'Failed to get exercise recommendations',
      {
        user_id: userId,
        exercise_id: exerciseId,
        cycle_week: cycleWeek,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'get_exercise_recommendations',
      },
      { feature: 'workout_cycle', action: 'error' },
    );

    return null;
  }
};

// Enhanced function to calculate progressive workout schedule
export const calculateProgressiveWorkoutSchedule = (
  startDate: string,
  userWorkoutDays: number[],
  planWorkoutFrequency: number = 3,
  totalWeeks: number = 5,
): {
  schedule: Array<{
    date: string;
    workoutDayIndex: number;
    cycleWeek: number;
    weekName: string;
    dayOfWeek: number;
  }>;
  markedDates: Record<string, CalendarMarkedDate>;
} => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Calculating progressive workout schedule', 'workout_cycle', {
      start_date: startDate,
      workout_days_count: userWorkoutDays.length,
      plan_frequency: planWorkoutFrequency,
      total_weeks: totalWeeks,
    });

    const schedule: Array<{
      date: string;
      workoutDayIndex: number;
      cycleWeek: number;
      weekName: string;
      dayOfWeek: number;
    }> = [];

    const markedDates: Record<string, CalendarMarkedDate> = {};

    // Week names for the 5-week cycle
    const weekNames = ['Adaptation', 'Accumulation', 'Intensification', 'Realization', 'Recovery'];

    // Sort user workout days to ensure consistent ordering
    const sortedUserDays = [...userWorkoutDays].sort((a, b) => a - b);

    if (sortedUserDays.length === 0) {
      const errorMessage = 'No user workout days provided';
      SentryLogger.error(
        errorMessage,
        {
          start_date: startDate,
          user_workout_days: userWorkoutDays,
          plan_frequency: planWorkoutFrequency,
          total_weeks: totalWeeks,
          operation: 'calculate_progressive_workout_schedule',
        },
        { feature: 'workout_cycle', action: 'validation_error' },
      );
      return { schedule, markedDates };
    }

    const start = new Date(startDate);
    const currentDate = new Date(start);
    let workoutCount = 0;
    let currentWeek = 1;

    // Calculate total workouts needed (planWorkoutFrequency per week * totalWeeks)
    const totalWorkouts = planWorkoutFrequency * totalWeeks;

    while (workoutCount < totalWorkouts && currentWeek <= totalWeeks) {
      const currentDayOfWeek = currentDate.getDay(); // Keep in 0-6 format (0=Sunday, 6=Saturday)

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
            dayOfWeek: currentDayOfWeek,
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
            dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][
              currentDayOfWeek
            ],
            userDayNumber: currentDayOfWeek,
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
        SentryLogger.warn(
          'Workout schedule calculation exceeded 1 year, breaking loop',
          {
            start_date: startDate,
            current_date: currentDate.toISOString(),
            workout_count: workoutCount,
            total_workouts: totalWorkouts,
            operation: 'calculate_progressive_workout_schedule',
          },
          { feature: 'workout_cycle', action: 'safety_break' },
        );
        break;
      }
    }

    const duration = Date.now() - startTime;

    // Monitor for slow schedule calculations
    if (duration > 3000) {
      capturePerformanceError(
        'Slow progressive workout schedule calculation detected',
        'calculation_duration',
        duration,
      );
    }

    SentryLogger.info(
      'Progressive workout schedule calculated successfully',
      {
        start_date: startDate,
        schedule_length: schedule.length,
        marked_dates_count: Object.keys(markedDates).length,
        workout_days_count: sortedUserDays.length,
        plan_frequency: planWorkoutFrequency,
        total_weeks: totalWeeks,
        duration_ms: duration,
        operation: 'calculate_progressive_workout_schedule',
      },
      { feature: 'workout_cycle', action: 'success' },
    );

    return { schedule, markedDates };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to calculate progressive workout schedule',
      {
        start_date: startDate,
        user_workout_days: userWorkoutDays,
        plan_frequency: planWorkoutFrequency,
        total_weeks: totalWeeks,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'calculate_progressive_workout_schedule',
      },
      { feature: 'workout_cycle', action: 'error' },
    );

    // Return empty schedule on error
    return { schedule: [], markedDates: {} };
  }
};

// Enhanced setup calendar dates function with progressive cycle support
export const setupCalendarDatesProgressive = (
  startDate: string,
  totalDays: number,
  userWorkoutDays: number[],
  colors: ColorsConfig = { primary: '#7B69EE' },
) => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Setting up progressive calendar dates', 'workout_cycle', {
      start_date: startDate,
      total_days: totalDays,
      workout_days_count: userWorkoutDays.length,
      primary_color: colors.primary,
    });

    if (!userWorkoutDays || userWorkoutDays.length === 0) {
      const errorMessage = 'No valid workout days provided';
      SentryLogger.error(
        errorMessage,
        {
          start_date: startDate,
          total_days: totalDays,
          user_workout_days: userWorkoutDays,
          operation: 'setup_calendar_dates_progressive',
        },
        { feature: 'workout_cycle', action: 'validation_error' },
      );
      return {};
    }

    // Use the enhanced progressive schedule calculation
    const { markedDates } = calculateProgressiveWorkoutSchedule(
      startDate,
      userWorkoutDays,
      totalDays, // This represents the workout frequency per week
      5, // 5-week cycle
    );

    // Update colors to match the provided theme
    Object.keys(markedDates).forEach((dateStr) => {
      markedDates[dateStr].selectedColor = colors.primary;
      markedDates[dateStr].dotColor = colors.primary;
    });

    const duration = Date.now() - startTime;
    SentryLogger.info(
      'Progressive calendar dates setup successfully',
      {
        start_date: startDate,
        total_days: totalDays,
        marked_dates_count: Object.keys(markedDates).length,
        workout_days_count: userWorkoutDays.length,
        primary_color: colors.primary,
        duration_ms: duration,
        operation: 'setup_calendar_dates_progressive',
      },
      { feature: 'workout_cycle', action: 'success' },
    );

    return markedDates;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to setup progressive calendar dates',
      {
        start_date: startDate,
        total_days: totalDays,
        user_workout_days: userWorkoutDays,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'setup_calendar_dates_progressive',
      },
      { feature: 'workout_cycle', action: 'error' },
    );

    return {};
  }
};

// Enhanced function to get current cycle week and progress
export const getCurrentCycleProgress = async (
  userId: string,
  planId: string,
): Promise<{
  currentWeek: number;
  weekName: string;
  completedWorkouts: number;
  totalWorkoutsInCycle: number;
  progressPercentage: number;
  weekDescription: string;
  recommendationTemplate: string;
} | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Getting current cycle progress', 'workout_cycle', {
      user_id: userId,
      plan_id: planId,
    });

    SentryLogger.database.query('user_active_plans', 'select', {
      user_id: userId,
      plan_id: planId,
      operation: 'get_current_cycle_progress',
    });

    // First, recalculate and fix week progression if needed
    const recalculationResult = await recalculateWeekProgression(userId, planId);

    // Get the active plan information (potentially updated by recalculation)
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, completed_workouts, workout_plans!inner(workout_frequency)')
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
        'No active plan data found',
        {
          user_id: userId,
          plan_id: planId,
          operation: 'get_current_cycle_progress',
        },
        { feature: 'workout_cycle', action: 'not_found' },
      );
      return null;
    }

    const currentWeek = planData.current_week || 1;
    const completedWorkouts = planData.completed_workouts || 0;
    const workoutFrequency =
      (planData.workout_plans as unknown as { workout_frequency: number })?.workout_frequency || 3;

    // Log if recalculation was performed
    if (recalculationResult?.wasUpdated) {
      SentryLogger.info(
        'Week progression was automatically corrected during getCurrentCycleProgress',
        {
          user_id: userId,
          plan_id: planId,
          corrected_week: recalculationResult.correctedWeek,
          actual_completed: recalculationResult.actualCompletedWorkouts,
          operation: 'get_current_cycle_progress',
        },
        { feature: 'workout_cycle', action: 'auto_correction' },
      );
    }

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
        recommendationTemplate: 'Focus on proper form and technique.',
      };
    }

    const result = {
      currentWeek,
      weekName: cycleInfo.weekName,
      completedWorkouts,
      totalWorkoutsInCycle: workoutFrequency * 5, // 5 weeks total
      progressPercentage: (completedWorkouts / (workoutFrequency * 5)) * 100,
      weekDescription: cycleInfo.description,
      recommendationTemplate: cycleInfo.recommendationTemplate,
    };

    const duration = Date.now() - startTime;
    SentryLogger.info(
      'Current cycle progress retrieved successfully',
      {
        user_id: userId,
        plan_id: planId,
        current_week: result.currentWeek,
        week_name: result.weekName,
        completed_workouts: result.completedWorkouts,
        total_workouts: result.totalWorkoutsInCycle,
        progress_percentage: result.progressPercentage,
        duration_ms: duration,
        operation: 'get_current_cycle_progress',
      },
      { feature: 'workout_cycle', action: 'success' },
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'user_active_plans',
      'select',
    );

    SentryLogger.error(
      'Failed to get current cycle progress',
      {
        user_id: userId,
        plan_id: planId,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'get_current_cycle_progress',
      },
      { feature: 'workout_cycle', action: 'error' },
    );

    return null;
  }
};

// Enhanced function to check if user should advance to next week
export const checkWeekProgression = async (
  userId: string,
  planId: string,
): Promise<{
  shouldAdvance: boolean;
  newWeek: number;
  completedWorkoutsInCurrentWeek: number;
  requiredWorkoutsPerWeek: number;
} | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Checking week progression', 'workout_cycle', {
      user_id: userId,
      plan_id: planId,
    });

    SentryLogger.database.query('user_active_plans', 'select', {
      user_id: userId,
      plan_id: planId,
      operation: 'check_week_progression',
    });

    // Get the active plan information
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, completed_workouts, workout_plans!inner(workout_frequency)')
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
        'No active plan data found for week progression check',
        {
          user_id: userId,
          plan_id: planId,
          operation: 'check_week_progression',
        },
        { feature: 'workout_cycle', action: 'not_found' },
      );
      return null;
    }

    const currentWeek = planData.current_week || 1;
    const totalCompletedWorkouts = planData.completed_workouts || 0;
    const workoutFrequency =
      (planData.workout_plans as unknown as { workout_frequency: number })?.workout_frequency || 3;

    // Calculate how many workouts should be completed for the current week
    const expectedWorkoutsForCurrentWeek = currentWeek * workoutFrequency;

    // Check if user has completed enough workouts to advance to next week
    const shouldAdvance =
      totalCompletedWorkouts >= expectedWorkoutsForCurrentWeek && currentWeek < 5;

    // Calculate workouts completed in current week
    const workoutsInPreviousWeeks = (currentWeek - 1) * workoutFrequency;
    const completedWorkoutsInCurrentWeek = totalCompletedWorkouts - workoutsInPreviousWeeks;

    const result = {
      shouldAdvance,
      newWeek: shouldAdvance ? currentWeek + 1 : currentWeek,
      completedWorkoutsInCurrentWeek,
      requiredWorkoutsPerWeek: workoutFrequency,
    };

    const duration = Date.now() - startTime;
    SentryLogger.info(
      'Week progression check completed successfully',
      {
        user_id: userId,
        plan_id: planId,
        current_week: currentWeek,
        should_advance: result.shouldAdvance,
        new_week: result.newWeek,
        completed_workouts_current_week: result.completedWorkoutsInCurrentWeek,
        required_workouts_per_week: result.requiredWorkoutsPerWeek,
        total_completed_workouts: totalCompletedWorkouts,
        duration_ms: duration,
        operation: 'check_week_progression',
      },
      { feature: 'workout_cycle', action: 'success' },
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    captureDatabaseError(
      error instanceof Error ? error : new Error(errorMessage),
      'user_active_plans',
      'select',
    );

    SentryLogger.error(
      'Failed to check week progression',
      {
        user_id: userId,
        plan_id: planId,
        error_message: errorMessage,
        duration_ms: duration,
        operation: 'check_week_progression',
      },
      { feature: 'workout_cycle', action: 'error' },
    );

    return null;
  }
};

// Function to recalculate and fix week progression based on actual workout history
export const recalculateWeekProgression = async (
  userId: string,
  planId: string,
): Promise<{
  correctedWeek: number;
  actualCompletedWorkouts: number;
  wasUpdated: boolean;
} | null> => {
  const startTime = Date.now();

  try {
    addBreadcrumb('Recalculating week progression', 'workout_cycle', {
      user_id: userId,
      plan_id: planId,
    });

    // Get current state from active plan
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, completed_workouts, workout_plans!inner(workout_frequency)')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();

    if (planError || !planData) {
      SentryLogger.error(
        'Failed to get active plan for week progression recalculation',
        {
          user_id: userId,
          plan_id: planId,
          error: planError?.message,
        },
        { feature: 'workout_cycle', action: 'recalculate_error' },
      );
      return null;
    }

    const currentWeek = planData.current_week || 1;
    const storedCompletedWorkouts = planData.completed_workouts || 0;
    const workoutFrequency =
      (planData.workout_plans as unknown as { workout_frequency: number })?.workout_frequency || 3;

    // Count actual completed workouts from history (excluding redo workouts)
    const { data: historyData, error: historyError } = await supabase
      .from('user_workout_history')
      .select('workout_day, cycle_week')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_redo_workout', false); // Only count non-redo workouts for plan progression

    if (historyError) {
      SentryLogger.error(
        'Failed to get workout history for week progression recalculation',
        {
          user_id: userId,
          plan_id: planId,
          error: historyError.message,
        },
        { feature: 'workout_cycle', action: 'recalculate_error' },
      );
      return null;
    }

    const actualCompletedWorkouts = historyData?.length || 0;

    // Calculate what the current week should be based on completed workouts
    const expectedWeek = Math.min(Math.floor(actualCompletedWorkouts / workoutFrequency) + 1, 5);

    // Check if we need to update
    const needsUpdate =
      currentWeek !== expectedWeek || storedCompletedWorkouts !== actualCompletedWorkouts;

    if (needsUpdate) {
      // Update the active plan with correct values
      const { error: updateError } = await supabase
        .from('user_active_plans')
        .update({
          current_week: expectedWeek,
          completed_workouts: actualCompletedWorkouts,
        })
        .eq('user_id', userId)
        .eq('plan_id', planId)
        .eq('is_active', true);

      if (updateError) {
        SentryLogger.error(
          'Failed to update week progression',
          {
            user_id: userId,
            plan_id: planId,
            old_week: currentWeek,
            new_week: expectedWeek,
            old_completed: storedCompletedWorkouts,
            new_completed: actualCompletedWorkouts,
            error: updateError.message,
          },
          { feature: 'workout_cycle', action: 'update_error' },
        );
        return null;
      }

      SentryLogger.info(
        'Week progression corrected successfully',
        {
          user_id: userId,
          plan_id: planId,
          old_week: currentWeek,
          new_week: expectedWeek,
          old_completed: storedCompletedWorkouts,
          new_completed: actualCompletedWorkouts,
          duration_ms: Date.now() - startTime,
        },
        { feature: 'workout_cycle', action: 'recalculate_success' },
      );
    }

    return {
      correctedWeek: expectedWeek,
      actualCompletedWorkouts,
      wasUpdated: needsUpdate,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    SentryLogger.error(
      'Failed to recalculate week progression',
      {
        user_id: userId,
        plan_id: planId,
        error_message: errorMessage,
        duration_ms: duration,
      },
      { feature: 'workout_cycle', action: 'recalculate_error' },
    );

    return null;
  }
};

export default function disablewarn() {
  return null;
}
