import { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import supabase from '../services/supabase';
import { SentryDataCollection, SentryLogger } from '../services/sentry';

interface WorkoutCompletionData {
  [date: string]: {
    marked: boolean;
    dotColor: string;
    completed: boolean;
  };
}

interface UseWorkoutCalendarDataReturn {
  workoutDates: WorkoutCompletionData;
  loading: boolean;
  error: string | null;
}

export const useWorkoutCalendarData = (
  calendarDate: Date,
  userId: string | undefined,
): UseWorkoutCalendarDataReturn => {
  const [workoutDates, setWorkoutDates] = useState<WorkoutCompletionData>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setWorkoutDates({});
      return;
    }

    const fetchWorkoutCompletions = async () => {
      try {
        setLoading(true);
        setError(null);

        // Track calendar data fetch start
        SentryDataCollection.addBreadcrumb({
          message: 'Fetching workout calendar data',
          category: 'data.load',
          level: 'info',
          data: {
            component: 'useWorkoutCalendarData',
            month: format(calendarDate, 'yyyy-MM'),
            user_id: userId,
          },
        });

        // Get the start and end of the current month
        const monthStart = startOfMonth(calendarDate);
        const monthEnd = endOfMonth(calendarDate);

        // Fetch workout completions for the current month
        const { data: workoutHistory, error: queryError } = await supabase
          .from('user_workout_history')
          .select('completed_at')
          .eq('user_id', userId)
          .gte('completed_at', monthStart.toISOString())
          .lte('completed_at', monthEnd.toISOString())
          .order('completed_at', { ascending: true });

        if (queryError) {
          throw new Error(`Database query error: ${queryError.message}`);
        }

        if (!workoutHistory) {
          setWorkoutDates({});
          return;
        }

        // Process workout completion data
        const completionData: WorkoutCompletionData = {};

        workoutHistory.forEach((workout) => {
          const workoutDate = format(new Date(workout.completed_at), 'yyyy-MM-dd');
          completionData[workoutDate] = {
            marked: true,
            dotColor: '#6c47ff', // COLORS.primary
            completed: true,
          };
        });

        setWorkoutDates(completionData);

        // Track successful data processing
        SentryDataCollection.addBreadcrumb({
          message: 'Workout calendar data processed successfully',
          category: 'data.process',
          level: 'info',
          data: {
            component: 'useWorkoutCalendarData',
            month: format(calendarDate, 'yyyy-MM'),
            user_id: userId,
            workout_days_found: Object.keys(completionData).length,
            workouts_total: workoutHistory.length,
          },
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch workout calendar data';
        setError(errorMessage);

        SentryDataCollection.captureException(err as Error, {
          component: 'useWorkoutCalendarData',
          action: 'fetch_workout_calendar_error',
          month: format(calendarDate, 'yyyy-MM'),
          user_id: userId,
        });

        SentryLogger.error('Error fetching workout calendar data', {
          error: err as Error,
          component: 'useWorkoutCalendarData',
          month: format(calendarDate, 'yyyy-MM'),
          user_id: userId,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutCompletions();
  }, [calendarDate, userId]);

  return {
    workoutDates,
    loading,
    error,
  };
};
