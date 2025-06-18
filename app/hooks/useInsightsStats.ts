import { useState, useEffect } from 'react';
import { subDays, subMonths, subYears } from 'date-fns';
import supabase from '../services/supabase';
import { SentryDataCollection, SentryLogger } from '../services/sentry';

interface WorkoutStats {
  numberOfWorkouts: number;
  hoursAtGym: number;
  totalWeightLifted: number; // in kg
}

interface UseInsightsStatsReturn {
  stats: WorkoutStats;
  loading: boolean;
  error: string | null;
}

// Helper function to convert time filter to date range
const getDateRangeFromFilter = (filter: string): Date => {
  const now = new Date();

  switch (filter) {
    case '1w':
      return subDays(now, 7);
    case '1m':
      return subMonths(now, 1);
    case '3m':
      return subMonths(now, 3);
    case '6m':
      return subMonths(now, 6);
    case '1y':
      return subYears(now, 1);
    default:
      return subDays(now, 7); // Default to 1 week
  }
};

// Helper function to parse workout duration (HH:MM:SS) to hours
const parseDurationToHours = (duration: string): number => {
  try {
    const parts = duration.split(':');
    if (parts.length !== 3) return 0;

    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;

    return hours + minutes / 60 + seconds / 3600;
  } catch (error) {
    SentryLogger.warn('Failed to parse workout duration', {
      duration,
      error: error as Error,
    });
    return 0;
  }
};

// Helper function to format weight for display
const formatWeight = (weight: number): string => {
  if (weight >= 1000) {
    return `${(weight / 1000).toFixed(1)}K`;
  }
  return weight.toFixed(0);
};

export const useInsightsStats = (
  selectedFilter: string,
  userId: string | undefined,
): UseInsightsStatsReturn => {
  const [stats, setStats] = useState<WorkoutStats>({
    numberOfWorkouts: 0,
    hoursAtGym: 0,
    totalWeightLifted: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setStats({
        numberOfWorkouts: 0,
        hoursAtGym: 0,
        totalWeightLifted: 0,
      });
      return;
    }

    const fetchWorkoutStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Track stats fetch start
        SentryDataCollection.addBreadcrumb({
          message: 'Fetching workout stats',
          category: 'data.load',
          level: 'info',
          data: {
            component: 'useInsightsStats',
            filter: selectedFilter,
            user_id: userId,
          },
        });

        const fromDate = getDateRangeFromFilter(selectedFilter);

        // Fetch workout history from the database
        const { data: workoutHistory, error: queryError } = await supabase
          .from('user_workout_history')
          .select(
            `
            workout_duration,
            total_volume,
            total_reps,
            completed_at
          `,
          )
          .eq('user_id', userId)
          .gte('completed_at', fromDate.toISOString())
          .order('completed_at', { ascending: false });

        if (queryError) {
          throw new Error(`Database query error: ${queryError.message}`);
        }

        if (!workoutHistory) {
          setStats({
            numberOfWorkouts: 0,
            hoursAtGym: 0,
            totalWeightLifted: 0,
          });
          return;
        }

        // Calculate statistics
        const numberOfWorkouts = workoutHistory.length;

        const hoursAtGym = workoutHistory.reduce((total, workout) => {
          return total + parseDurationToHours(workout.workout_duration || '00:00:00');
        }, 0);

        const totalWeightLifted = workoutHistory.reduce((total, workout) => {
          return total + (workout.total_volume || 0);
        }, 0);

        const calculatedStats = {
          numberOfWorkouts,
          hoursAtGym: Math.round(hoursAtGym * 10) / 10, // Round to 1 decimal place
          totalWeightLifted,
        };

        setStats(calculatedStats);

        // Track successful stats calculation
        SentryDataCollection.addBreadcrumb({
          message: 'Workout stats calculated successfully',
          category: 'data.process',
          level: 'info',
          data: {
            component: 'useInsightsStats',
            filter: selectedFilter,
            user_id: userId,
            stats: calculatedStats,
            workouts_found: numberOfWorkouts,
          },
        });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch workout stats';
        setError(errorMessage);

        SentryDataCollection.captureException(err as Error, {
          component: 'useInsightsStats',
          action: 'fetch_workout_stats_error',
          filter: selectedFilter,
          user_id: userId,
        });

        SentryLogger.error('Error fetching workout stats', {
          error: err as Error,
          component: 'useInsightsStats',
          filter: selectedFilter,
          user_id: userId,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchWorkoutStats();
  }, [selectedFilter, userId]);

  return {
    stats,
    loading,
    error,
  };
};

// Export helper function for formatting weight display
export { formatWeight };
