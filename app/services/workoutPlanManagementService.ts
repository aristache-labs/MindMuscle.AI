import supabase from './supabase';
import { format } from 'date-fns';
import { getUserWorkoutDays } from './workoutPlanCore';

// Type definitions for better type safety
interface CalendarColors {
  primary: string;
}

interface MarkedDate {
  selected?: boolean;
  selectedColor?: string;
  marked?: boolean;
  dotColor?: string;
  workoutDayIndex?: number;
  dayName?: string;
  week?: number;
  userDayNumber?: number;
  cycleWeek?: number;
}

interface MarkedDates {
  [date: string]: MarkedDate;
}

interface WorkoutHistoryRecord {
  workout_day: number;
  completed_at: string;
  completed_exercises?: number;
  workout_duration?: string;
  calories_burned?: number;
  total_volume?: number;
  total_reps?: number;
  week_name?: string;
  cycle_week?: number;
  [key: string]: unknown; // Allow additional properties from Supabase
}

interface CompletedWorkoutData {
  completedExercises: number;
  duration: string;
  caloriesBurned: number;
  totalVolume: number;
  totalReps: number;
  completedAt: string;
  weekName: string;
  cycleWeek: number;
}

interface WorkoutCompletionResult {
  isCompleted: boolean;
  completedWorkoutData?: CompletedWorkoutData;
  completedDates?: string[];
}

interface ExerciseData {
  id: string;
  name: string;
  sets: number;
  reps_range: string;
  image_url?: string;
  primary_muscles?: string[];
  workout_day: number;
  exercise_id: string;
}

interface WorkoutDay {
  day: number;
  exercises: ExerciseData[];
  total_exercises: number;
  estimated_duration: number;
  total_calories: number;
}

interface PlanDetails {
  id: string;
  title: string;
  difficulty_level: string;
  estimated_duration: number;
  workoutDays: WorkoutDay[];
  category_name: string;
  subtitle: string;
  workout_frequency: number;
}

interface ExercisesByDay {
  [key: number]: ExerciseData[];
}

// Type definition for the formattedPlan object
type FormattedPlan = {
  id: string;
  title: string;
  difficulty_level: string;
  subtitle: string;
  category_name: string;
  workoutDays: WorkoutDay[];
  current_day: number;
  start_date: string;
};

// Fetch the user's active plan with all related data
export const fetchActivePlan = async (
  userId: string,
  userWorkoutDays: number[],
): Promise<{ plan: FormattedPlan | null; markedDates: MarkedDates }> => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  // Fetch the active plan data
  const { data: activePlanData, error: activePlanError } = await supabase
    .from('user_active_plans')
    .select(
      `
        id,
        plan_id,
        user_id,
        is_active,
        current_day,
        start_date,
        workout_days_preference,
        workout_plans:plan_id (
          id,
          title,
          difficulty_level,
          estimated_duration,
          workout_subcategories:subcategory_id (
            title,
            subtitle,
            category_identifier
          )
        )
      `,
    )
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  if (activePlanError) {
    if (activePlanError.code === 'PGRST116') {
      // No active plan found
      return { plan: null, markedDates: {} };
    }
    throw activePlanError;
  }

  if (!activePlanData || !activePlanData.workout_plans) {
    // No active plan or plan data found
    return { plan: null, markedDates: {} };
  }

  // Fetch the exercises for this plan
  const { data: exercisesData, error: exercisesError } = await supabase
    .from('workout_plan_exercises')
    .select(
      `
        id,
        sets,
        reps_range,
        exercise_id,
        workout_day,
        exercise_name,
        exercises:exercise_id (
          id,
          name,
          image_url,
          primary_muscles
        )
      `,
    )
    .eq('plan_id', activePlanData.plan_id)
    .order('workout_day', { ascending: true })
    .order('order', { ascending: true });

  if (exercisesError) throw exercisesError;

  // Group exercises by workout day
  const exercisesByDay: { [key: number]: ExerciseData[] } = {};
  exercisesData.forEach((item: unknown) => {
    const exercise = item as Record<string, unknown>;
    const day = (exercise.workout_day as number) || 0;
    if (!exercisesByDay[day]) {
      exercisesByDay[day] = [];
    }

    exercisesByDay[day].push({
      id: exercise.id,
      name: exercise.exercise_name || (exercise.exercises as Record<string, unknown>)?.name,
      sets: exercise.sets,
      reps_range: exercise.reps_range,
      image_url: (exercise.exercises as Record<string, unknown>)?.image_url,
      primary_muscles: (exercise.exercises as Record<string, unknown>)?.primary_muscles,
      workout_day: day,
      exercise_id: (exercise.exercises as Record<string, unknown>)?.id,
    } as ExerciseData);
  });

  // Convert to array of workout days with per-day statistics
  const workoutDays = Object.keys(exercisesByDay)
    .map((dayKey) => {
      const dayNum = parseInt(dayKey);
      const dayExercises = exercisesByDay[dayNum];

      // Calculate per-day statistics based on actual exercise data
      const exerciseCount = dayExercises.length;

      // Calculate estimated duration based on sets, reps, and rest time
      let totalDuration = 0;
      dayExercises.forEach((exercise) => {
        const sets = exercise.sets || 3;
        const repRange = exercise.reps_range || '-';

        // Parse rep range to get average reps (e.g., "8-12" -> 10)
        let avgReps = 10; // Default
        if (repRange.includes('-')) {
          const [min, max] = repRange.split('-').map((num: string) => parseInt(num));
          if (!isNaN(min) && !isNaN(max)) {
            avgReps = Math.floor((min + max) / 2);
          }
        } else if (!isNaN(parseInt(repRange))) {
          avgReps = parseInt(repRange);
        }

        // Estimate time per rep at ~2-3 seconds
        const timePerSet = avgReps * 2.5; // seconds

        // Rest time between sets (typically 60-90 seconds)
        const restTime = 75; // seconds

        // Total time for this exercise (all sets + rest between sets)
        const exerciseTime = sets * timePerSet + restTime * (sets - 1);

        // Add to total duration (convert to minutes)
        totalDuration += exerciseTime / 60;
      });

      // Round up to nearest minute
      const estimatedDuration = Math.ceil(totalDuration);

      // Calculate calories based on duration with a more realistic formula
      // Moderate exercise burns approximately 7-10 calories per minute depending on intensity
      const calorieRate = 8.5; // calories per minute for moderate-high intensity workout
      const estimatedCalories = Math.round(estimatedDuration * calorieRate);

      return {
        day: dayNum,
        exercises: dayExercises,
        total_exercises: exerciseCount,
        estimated_duration: estimatedDuration,
        total_calories: estimatedCalories,
      };
    })
    .sort((a, b) => a.day - b.day);

  // Type-safe access to nested Supabase data
  const workoutPlans = activePlanData.workout_plans as unknown;
  const planData = workoutPlans as Record<string, unknown>;
  const subcategories = planData?.workout_subcategories as Record<string, unknown>;

  // Format the data
  const formattedPlan: FormattedPlan = {
    id: activePlanData.plan_id,
    title: (planData?.title as string) || 'Unknown',
    difficulty_level: (planData?.difficulty_level as string) || 'Unknown',
    subtitle: (subcategories?.subtitle as string) || 'Unknown',
    category_name: (subcategories?.title as string) || 'Unknown',
    workoutDays: workoutDays,
    current_day: activePlanData.current_day,
    start_date: activePlanData.start_date,
  };

  // Setup calendar dates if user workout days are provided
  let markedDates = {};
  if (userWorkoutDays && userWorkoutDays.length > 0) {
    markedDates = setupCalendarDates(
      activePlanData.start_date,
      workoutDays.length,
      userWorkoutDays,
    );
  }

  return {
    plan: formattedPlan,
    markedDates,
  };
};

// Setup calendar marked dates based on workout frequency and user preferences
export const setupCalendarDates = (
  startDate: string,
  totalDays: number,
  userWorkoutDays: number[],
  colors: CalendarColors = { primary: '#007BFF' },
): MarkedDates => {
  try {
    if (!userWorkoutDays || userWorkoutDays.length === 0) {
      console.error('No valid workout days provided');
      return {};
    }

    // Sort user workout days to ensure consistent ordering
    const sortedUserDays = [...userWorkoutDays].sort((a, b) => a - b);

    // Create a mapping of workout days to calendar dates
    const markedDates: MarkedDates = {};

    // Get today's date and day of week (1-7, where 1=Sunday)
    const today = new Date();

    // Mark today on the calendar
    const todayStr = today.toISOString().split('T')[0];
    markedDates[todayStr] = {
      selected: true,
      selectedColor: colors.primary,
    };

    // Helper function to get the next occurrence of a specific day number
    const getNextDateForDay = (dayNumber: number, fromDate: Date): Date => {
      const fromDayNumber = fromDate.getDay() + 1; // Convert from 0-6 to 1-7
      let daysToAdd = dayNumber - fromDayNumber;
      if (daysToAdd <= 0) daysToAdd += 7; // Wrap to next week if needed

      const nextDate = new Date(fromDate);
      nextDate.setDate(fromDate.getDate() + daysToAdd);
      return nextDate;
    };

    // Generate dates for each workout day for several weeks
    const weeksToShow = 8; // Show 8 weeks of workouts

    // Start from today for the first occurrence
    const currentDate = new Date(today);

    // For each week
    for (let week = 0; week < weeksToShow; week++) {
      // For each workout day in the plan (1, 2, 3, etc.)
      for (let workoutDay = 1; workoutDay <= totalDays; workoutDay++) {
        // Map workout day to user's preferred day using cycling
        const userDayIndex = (workoutDay - 1) % sortedUserDays.length;
        const userDayNumber = sortedUserDays[userDayIndex];

        let workoutDate: Date;

        if (week === 0) {
          // For the first week, find the next occurrence of this day
          workoutDate = getNextDateForDay(userDayNumber, currentDate);

          // For subsequent workout days in the same week, ensure proper spacing
          if (workoutDay > 1) {
            const prevWorkoutDay = workoutDay - 1;
            const _prevUserDayIndex = (prevWorkoutDay - 1) % sortedUserDays.length;

            // Find the previous workout date
            const prevDateKey = Object.keys(markedDates).find((dateStr) => {
              const dateInfo = markedDates[dateStr];
              return dateInfo.workoutDayIndex === prevWorkoutDay && dateInfo.marked === true;
            });

            if (prevDateKey) {
              const prevDate = new Date(prevDateKey);
              workoutDate = getNextDateForDay(userDayNumber, prevDate);
            }
          }
        } else {
          // For subsequent weeks, add 7 days to the same workout day from the previous week
          const prevWeekDateKey = Object.keys(markedDates).find((dateStr) => {
            const dateInfo = markedDates[dateStr];
            return (
              dateInfo.workoutDayIndex === workoutDay &&
              dateInfo.marked === true &&
              dateInfo.week === week - 1
            );
          });

          if (prevWeekDateKey) {
            workoutDate = new Date(prevWeekDateKey);
            workoutDate.setDate(workoutDate.getDate() + 7);
          } else {
            // Fallback: calculate from first week
            const firstWeekDateKey = Object.keys(markedDates).find((dateStr) => {
              const dateInfo = markedDates[dateStr];
              return (
                dateInfo.workoutDayIndex === workoutDay &&
                dateInfo.marked === true &&
                dateInfo.week === 0
              );
            });

            if (firstWeekDateKey) {
              workoutDate = new Date(firstWeekDateKey);
              workoutDate.setDate(workoutDate.getDate() + 7 * week);
            } else {
              // Last resort: calculate from today
              workoutDate = getNextDateForDay(userDayNumber, today);
              workoutDate.setDate(workoutDate.getDate() + 7 * week);
            }
          }
        }

        // Format the date as YYYY-MM-DD
        const dateStr = workoutDate.toISOString().split('T')[0];

        // Day names for reference
        const dayNames = [
          '',
          'Sunday',
          'Monday',
          'Tuesday',
          'Wednesday',
          'Thursday',
          'Friday',
          'Saturday',
        ];

        // Mark this date on the calendar with the workout day (1, 2, 3)
        markedDates[dateStr] = {
          selected: true,
          selectedColor: colors.primary,
          marked: true,
          dotColor: colors.primary,
          workoutDayIndex: workoutDay, // This is the 1-indexed workout day (1, 2, 3)
          dayName: dayNames[userDayNumber], // Store the day name for reference
          week: week, // Store week for reference
          userDayNumber: userDayNumber, // Store the numeric day for reference
        };
      }
    }

    return markedDates;
  } catch (error) {
    console.error('Error setting up calendar dates:', error);
    return {};
  }
};

// Helper function to find today's completed workout
const findTodayCompletedWorkout = (
  allCompletedWorkouts: WorkoutHistoryRecord[],
  workoutDayIndex: number,
  today: Date,
): WorkoutHistoryRecord | null => {
  let todayCompletedWorkout: WorkoutHistoryRecord | null = null;

  allCompletedWorkouts.forEach((workout) => {
    if (workout.workout_day === workoutDayIndex) {
      const completedDate = new Date(workout.completed_at);
      if (completedDate.toDateString() === today.toDateString()) {
        todayCompletedWorkout = workout as WorkoutHistoryRecord;
      }
    }
  });

  return todayCompletedWorkout;
};

// Helper function to build completed workout data
const buildCompletedWorkoutData = (
  completedWorkout: WorkoutHistoryRecord,
  completedDates: string[],
): WorkoutCompletionResult => {
  return {
    isCompleted: true,
    completedWorkoutData: {
      completedExercises: completedWorkout.completed_exercises || 0,
      duration: completedWorkout.workout_duration || '00:00:00',
      caloriesBurned: completedWorkout.calories_burned || 0,
      totalVolume: completedWorkout.total_volume || 0,
      totalReps: completedWorkout.total_reps || 0,
      completedAt: completedWorkout.completed_at,
      weekName: completedWorkout.week_name || '',
      cycleWeek: completedWorkout.cycle_week || 1,
    },
    completedDates,
  };
};

// Helper function to build completed dates from marked dates
const buildCompletedDatesFromMarkedDates = (
  markedDates: MarkedDates,
  allCompletedWorkouts: WorkoutHistoryRecord[],
): string[] => {
  const completedDates: string[] = [];

  if (markedDates && Object.keys(markedDates).length > 0) {
    Object.entries(markedDates).forEach(([dateStr, dateInfo]: [string, MarkedDate]) => {
      if (dateInfo && dateInfo.workoutDayIndex !== undefined && dateInfo.cycleWeek !== undefined) {
        const workoutDayIndex = dateInfo.workoutDayIndex;
        const cycleWeek = dateInfo.cycleWeek;

        const hasCompletedWorkout = allCompletedWorkouts.some((w: WorkoutHistoryRecord) => {
          if (w.workout_day !== workoutDayIndex) return false;

          const completionDate = new Date(w.completed_at);
          const completionDateStr = format(completionDate, 'yyyy-MM-dd');

          return (
            completionDateStr === dateStr ||
            (w.workout_day === workoutDayIndex && w.cycle_week === cycleWeek)
          );
        });

        if (hasCompletedWorkout) {
          completedDates.push(dateStr);
        }
      }
    });
  }

  return completedDates;
};

// Check if workout is already completed for the selected day in my-plan.tsx
export const checkWorkoutCompletionForPlan = async (
  userId: string,
  planId: string,
  workoutDayIndex: number,
  markedDates: MarkedDates,
): Promise<WorkoutCompletionResult> => {
  if (!userId || !planId || workoutDayIndex === null) {
    return { isCompleted: false };
  }

  try {
    // Fetch all completed workouts for this plan with completion dates and cycle info
    const { data: allCompletedWorkouts, error: allCompletedError } = await supabase
      .from('user_workout_history')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_id', planId);

    if (allCompletedError || !allCompletedWorkouts || allCompletedWorkouts.length === 0) {
      return { isCompleted: false };
    }

    const today = new Date();
    const completedWorkouts = allCompletedWorkouts as WorkoutHistoryRecord[];

    // Find today's completed workout
    const todayCompletedWorkout = findTodayCompletedWorkout(
      completedWorkouts,
      workoutDayIndex,
      today,
    );

    // Build completed dates from marked dates
    const completedDates = buildCompletedDatesFromMarkedDates(markedDates, completedWorkouts);

    // If we found a workout completed today, return it
    if (todayCompletedWorkout) {
      return buildCompletedWorkoutData(todayCompletedWorkout, completedDates);
    }

    // Return the completion status and completed dates
    return {
      isCompleted: false,
      completedDates,
    };
  } catch (error) {
    console.error('Error in checkWorkoutCompletionForPlan:', error);
    return { isCompleted: false };
  }
};

// Fetch plan details for the plan details screen
export const fetchPlanDetails = async (planId: string): Promise<PlanDetails> => {
  if (!planId) {
    throw new Error('Plan ID is required');
  }

  // Fetch the plan data
  const { data: planData, error: planError } = await supabase
    .from('workout_plans')
    .select(
      '*, workout_subcategories!workout_plans_subcategory_id_fkey(title, category_identifier, subtitle)',
    )
    .eq('id', planId)
    .single();

  if (planError) throw planError;

  // Fetch the category name
  let categoryName = '';
  if (planData?.workout_subcategories?.category_identifier) {
    const { data: categoryData, error: categoryError } = await supabase
      .from('workout_categories')
      .select('name')
      .eq('identifier', planData.workout_subcategories.category_identifier)
      .single();

    if (!categoryError && categoryData) {
      categoryName = categoryData.name;
    }
  }

  // Fetch the exercises for this plan
  const { data: exercisesData, error: exercisesError } = await supabase
    .from('workout_plan_exercises')
    .select(
      `
        id,
        sets,
        reps_range,
        exercise_id,
        workout_day,
        exercise_name,
        exercises:exercise_id (
          id,
          name,
          image_url,
          primary_muscles
        )
      `,
    )
    .eq('plan_id', planId)
    .order('workout_day', { ascending: true })
    .order('order', { ascending: true });

  if (exercisesError) throw exercisesError;

  // Group exercises by workout day
  const exercisesByDay: ExercisesByDay = {};
  (exercisesData as unknown[]).forEach((item) => {
    const exercise = item as Record<string, unknown>;
    const day = (exercise.workout_day as number) || 0;
    if (!exercisesByDay[day]) {
      exercisesByDay[day] = [];
    }

    const exerciseInfo = exercise.exercises as Record<string, unknown>;
    exercisesByDay[day].push({
      id: exercise.id as string,
      name: (exercise.exercise_name as string) || (exerciseInfo?.name as string),
      sets: exercise.sets as number,
      reps_range: exercise.reps_range as string,
      image_url: exerciseInfo?.image_url as string,
      primary_muscles: exerciseInfo?.primary_muscles as string[],
      workout_day: day,
      exercise_id: exerciseInfo?.id as string,
    } as ExerciseData);
  });

  // Convert to array of workout days with per-day statistics
  const workoutDays = Object.keys(exercisesByDay)
    .map((dayKey) => {
      const dayNum = parseInt(dayKey);
      const dayExercises = exercisesByDay[dayNum];

      // Calculate per-day statistics based on actual exercise data
      const exerciseCount = dayExercises.length;

      // Calculate estimated duration based on sets, reps, and rest time
      let totalDuration = 0;
      dayExercises.forEach((exercise) => {
        const sets = exercise.sets || 3;
        const repRange = exercise.reps_range || '-';

        // Parse rep range to get average reps (e.g., "8-12" -> 10)
        let avgReps = 10; // Default
        if (repRange.includes('-')) {
          const [min, max] = repRange.split('-').map((num: string) => parseInt(num));
          if (!isNaN(min) && !isNaN(max)) {
            avgReps = Math.floor((min + max) / 2);
          }
        } else if (!isNaN(parseInt(repRange))) {
          avgReps = parseInt(repRange);
        }

        // Estimate time per rep at ~2-3 seconds
        const timePerSet = avgReps * 2.5; // seconds

        // Rest time between sets (typically 60-90 seconds)
        const restTime = 75; // seconds

        // Total time for this exercise (all sets + rest between sets)
        const exerciseTime = sets * timePerSet + restTime * (sets - 1);

        // Add to total duration (convert to minutes)
        totalDuration += exerciseTime / 60;
      });

      // Round up to nearest minute
      const estimatedDuration = Math.ceil(totalDuration);

      // Calculate calories based on duration with a more realistic formula
      // Moderate exercise burns approximately 7-10 calories per minute depending on intensity
      const calorieRate = 8.5; // calories per minute for moderate-high intensity workout
      const estimatedCalories = Math.round(estimatedDuration * calorieRate);

      return {
        day: dayNum,
        exercises: dayExercises,
        total_exercises: exerciseCount,
        estimated_duration: estimatedDuration,
        total_calories: estimatedCalories,
      };
    })
    .sort((a, b) => a.day - b.day);

  // Format the data
  const formattedPlan = {
    id: planData.id,
    title: planData.title,
    difficulty_level: planData.difficulty_level,
    estimated_duration: planData.estimated_duration,
    workoutDays: workoutDays,
    category_name: categoryName || 'Unknown',
    subtitle: planData.workout_subcategories?.subtitle,
    workout_frequency: planData.workout_frequency || workoutDays.length,
  };

  return formattedPlan;
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
