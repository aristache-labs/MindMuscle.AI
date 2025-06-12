import { useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../store/AuthContext';
import supabase from '../../../services/supabase';
import workoutPlanService from '../../../services/workoutPlanService';
import { Plan } from '../types';

interface UseCalendarDataProps {
  plan: Plan | null;
  userWorkoutDays: number[];
  setCompletedWorkoutDays: (days: string[]) => void;
  setPausedWorkoutDays: (days: string[]) => void;
}

interface MarkedDateInfo {
  marked: boolean;
  workoutDayIndex: number;
  cycleWeek: number;
  weekName: string;
  color?: string;
}

interface CompletedWorkoutRecord {
  workout_day: number;
  completed_at: string;
  cycle_week: number;
  week_name: string;
}

interface PausedWorkoutRecord {
  workout_day: number;
  cycle_week: number;
  week_name: string;
}

export const useCalendarData = ({
  plan,
  userWorkoutDays,
  setCompletedWorkoutDays,
  setPausedWorkoutDays,
}: UseCalendarDataProps) => {
  const { user } = useAuth();

  // Helper function to update paused workout days for the calendar
  const updatePausedWorkoutDays = useCallback(async () => {
    if (!user?.id || !plan?.id) return;

    try {
      // Get all paused workouts for this plan
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('workout_day, cycle_week, week_name')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);

      if (error) {
        console.error('Error fetching paused workouts:', error);
        return;
      }

      if (!data || data.length === 0) {
        setPausedWorkoutDays([]);
        return;
      }
    } catch (error) {
      console.error('Error updating paused workout days:', error);
      // Note: This was commented out in original to prevent overriding correct data from updateCalendarWorkoutStatus
      // setPausedWorkoutDays([]);
    }
  }, [user?.id, plan?.id, setPausedWorkoutDays]);

  // Update calendar workout status (completed and paused workouts)
  const updateCalendarWorkoutStatus = useCallback(async () => {
    if (!user?.id || !plan?.id || !plan?.start_date || userWorkoutDays.length === 0) {
      setCompletedWorkoutDays([]);
      setPausedWorkoutDays([]);
      return;
    }

    try {
      // Get the marked dates (workout days mapped to calendar dates) - USE PROGRESSIVE METHOD
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        plan.start_date,
        plan.workoutDays.length,
        userWorkoutDays,
        { primary: '#7B69EE' },
      );

      // Get all completed workouts for this plan with completion dates
      const { data: completedWorkouts, error: completedError } = await supabase
        .from('user_workout_history')
        .select('workout_day, completed_at, cycle_week, week_name')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);

      // Get all paused workouts for this plan
      const { data: pausedWorkouts, error: pausedError } = await supabase
        .from('user_paused_workouts')
        .select('workout_day, cycle_week, week_name')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id);

      if (completedError) {
        console.error('Error fetching completed workouts:', completedError);
      }

      if (pausedError) {
        console.error('Error fetching paused workouts:', pausedError);
      }

      // Map workout days to calendar dates
      const completedDates: string[] = [];
      const pausedDates: string[] = [];

      // FIXED LOGIC: Match completions by actual date, not just workout day index
      Object.entries(markedDatesObj).forEach(([dateStr, dateInfo]: [string, MarkedDateInfo]) => {
        if (
          dateInfo &&
          dateInfo.workoutDayIndex !== undefined &&
          dateInfo.cycleWeek !== undefined
        ) {
          const workoutDayIndex = dateInfo.workoutDayIndex;
          const cycleWeek = dateInfo.cycleWeek;

          // Check if this specific date has a completed workout
          const hasCompletedWorkout =
            completedWorkouts &&
            completedWorkouts.length > 0 &&
            completedWorkouts.some((w: CompletedWorkoutRecord) => {
              if (w.workout_day !== workoutDayIndex) return false;

              // Parse the completion date
              const completionDate = new Date(w.completed_at);
              const completionDateStr = format(completionDate, 'yyyy-MM-dd');

              // Check if the completion date matches this calendar date
              // OR if it's the same workout day in the same cycle week
              return (
                completionDateStr === dateStr ||
                (w.workout_day === workoutDayIndex && w.cycle_week === cycleWeek)
              );
            });

          if (hasCompletedWorkout) {
            completedDates.push(dateStr);
          }

          // Check if this workout day is paused - match both workout day AND cycle week
          if (
            pausedWorkouts &&
            pausedWorkouts.length > 0 &&
            pausedWorkouts.some(
              (w: PausedWorkoutRecord) =>
                w.workout_day === workoutDayIndex && w.cycle_week === cycleWeek,
            )
          ) {
            pausedDates.push(dateStr);
          }
        }
      });

      setCompletedWorkoutDays(completedDates);
      setPausedWorkoutDays(pausedDates);
    } catch (error) {
      console.error('Error updating calendar workout status:', error);
      setCompletedWorkoutDays([]);
      setPausedWorkoutDays([]);
    }
  }, [
    user?.id,
    plan?.id,
    plan?.start_date,
    userWorkoutDays.length,
    plan?.workoutDays?.length,
    setCompletedWorkoutDays,
    setPausedWorkoutDays,
  ]);

  return {
    updateCalendarWorkoutStatus,
    updatePausedWorkoutDays,
  };
};
export default function UseCalendarDataProps() {
  return null;
}
