import supabase from './supabase';

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
  try {
    const { data, error } = await supabase
      .from('workout_cycle_weeks')
      .select('*')
      .eq('week_number', weekNumber)
      .single();

    if (error) throw error;

    if (!data) return null;

    return {
      weekNumber: data.week_number,
      weekName: data.name,
      description: data.description,
      recommendationTemplate: data.recommendation_template,
      weightAdjustmentPercentage: data.weight_adjustment_percentage,
      repsAdjustmentPercentage: data.reps_adjustment_percentage,
    };
  } catch (error) {
    console.error('Error fetching cycle week info:', error);
    return null;
  }
};

// Get all cycle weeks information
export const getAllCycleWeeks = async (): Promise<CycleWeekInfo[]> => {
  try {
    const { data, error } = await supabase
      .from('workout_cycle_weeks')
      .select('*')
      .order('week_number', { ascending: true });

    if (error) throw error;

    return data.map((week) => ({
      weekNumber: week.week_number,
      weekName: week.name,
      description: week.description,
      recommendationTemplate: week.recommendation_template,
      weightAdjustmentPercentage: week.weight_adjustment_percentage,
      repsAdjustmentPercentage: week.reps_adjustment_percentage,
    }));
  } catch (error) {
    console.error('Error fetching all cycle weeks:', error);
    return [];
  }
};

// Enhanced function to get exercise recommendations with smart cycle progression
export const getExerciseRecommendations = async (
  userId: string,
  exerciseId: string,
  cycleWeek: number,
): Promise<ExerciseRecommendation | null> => {
  try {
    const { data, error } = await supabase.rpc('get_smart_exercise_recommendations', {
      p_cycle_week: cycleWeek,
      p_exercise_id: exerciseId,
      p_user_id: userId,
    });

    if (error) throw error;

    if (!data || data.length === 0) return null;

    const recommendation = data[0];

    // Get cycle week info for additional context
    const cycleInfo = await getCycleWeekInfo(cycleWeek);

    return {
      previousWeight: recommendation.previous_weight,
      previousReps: recommendation.previous_reps,
      recommendedWeight: recommendation.recommended_weight,
      recommendedReps: recommendation.recommended_reps,
      recommendationText: recommendation.recommendation_text,
      weekAdjustmentPercentage: cycleInfo?.weightAdjustmentPercentage || 0,
      repsAdjustmentPercentage: cycleInfo?.repsAdjustmentPercentage || 0,
      weekName: cycleInfo?.weekName || 'Unknown',
    };
  } catch (error) {
    console.error('Error getting smart exercise recommendations:', error);
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
    console.error('No user workout days provided');
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
      console.warn('Workout schedule calculation exceeded 1 year, breaking loop');
      break;
    }
  }

  return { schedule, markedDates };
};

// Enhanced setup calendar dates function with progressive cycle support
export const setupCalendarDatesProgressive = (
  startDate: string,
  totalDays: number,
  userWorkoutDays: number[],
  colors: ColorsConfig = { primary: '#7B69EE' },
) => {
  try {
    if (!userWorkoutDays || userWorkoutDays.length === 0) {
      console.error('No valid workout days provided');
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

    return markedDates;
  } catch (error) {
    console.error('Error setting up calendar dates:', error);
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
  try {
    // Get the active plan information
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, completed_workouts, workout_plans!inner(workout_frequency)')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();

    if (planError) throw planError;

    if (!planData) return null;

    const currentWeek = planData.current_week || 1;
    const completedWorkouts = planData.completed_workouts || 0;
    const workoutFrequency =
      (planData.workout_plans as unknown as { workout_frequency: number })?.workout_frequency || 3;

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

    return {
      currentWeek,
      weekName: cycleInfo.weekName,
      completedWorkouts,
      totalWorkoutsInCycle: workoutFrequency * 5, // 5 weeks total
      progressPercentage: (completedWorkouts / (workoutFrequency * 5)) * 100,
      weekDescription: cycleInfo.description,
      recommendationTemplate: cycleInfo.recommendationTemplate,
    };
  } catch (error) {
    console.error('Error getting current cycle progress:', error);
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
  try {
    // Get the active plan information
    const { data: planData, error: planError } = await supabase
      .from('user_active_plans')
      .select('current_week, completed_workouts, workout_plans!inner(workout_frequency)')
      .eq('user_id', userId)
      .eq('plan_id', planId)
      .eq('is_active', true)
      .single();

    if (planError) throw planError;

    if (!planData) return null;

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

    return {
      shouldAdvance,
      newWeek: shouldAdvance ? currentWeek + 1 : currentWeek,
      completedWorkoutsInCurrentWeek,
      requiredWorkoutsPerWeek: workoutFrequency,
    };
  } catch (error) {
    console.error('Error checking week progression:', error);
    return null;
  }
};
export default function disablewarn() {
  return null;
}
