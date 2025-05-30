import { useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../store/AuthContext';
import workoutPlanService from '../../../services/workoutPlanService';
import { Plan, CycleProgress } from '../types';

interface UsePlanDataProps {
  userWorkoutDays: number[];
  setPlan: (plan: Plan | null) => void;
  setCycleProgress: (progress: CycleProgress | null) => void;
  setActiveDay: (day: number | null) => void;
  setSelectedDate: (date: Date) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const usePlanData = ({
  userWorkoutDays,
  setPlan,
  setCycleProgress,
  setActiveDay,
  setIsLoading,
  setError,
}: UsePlanDataProps) => {
  const { user } = useAuth();

  // Fetch user's preferred workout days
  const fetchUserWorkoutDays = useCallback(async () => {
    if (!user?.id) return [];

    try {
      const workoutDays = await workoutPlanService.getUserWorkoutDays(user.id);
      return workoutDays;
    } catch (err) {
      console.error('Error fetching user workout days:', err);
      return [];
    }
  }, [user?.id]);

  // Fetch cycle progress information
  const fetchCycleProgress = useCallback(
    async (planId: string) => {
      if (!user?.id) return null;

      try {
        const progress = await workoutPlanService.getCurrentCycleProgress(user.id, planId);
        return progress;
      } catch (error) {
        console.error('Error fetching cycle progress:', error);
        return null;
      }
    },
    [user?.id],
  );

  // Fetch the user's active plan
  const fetchActivePlan = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    setError(null);

    try {
      // Get the current workout days to pass to the service
      const currentWorkoutDays = [...userWorkoutDays];

      // Use the service function to fetch the active plan
      const { plan: formattedPlan } = await workoutPlanService.fetchActivePlan(
        user.id,
        currentWorkoutDays,
      );

      if (!formattedPlan) {
        setPlan(null);
        setCycleProgress(null);
        setIsLoading(false);
        return;
      }

      setPlan(formattedPlan);

      // Fetch cycle progress information
      const progress = await workoutPlanService.getCurrentCycleProgress(user.id, formattedPlan.id);
      setCycleProgress(progress);

      // Setup initial active day based on today's date and whether it's a workout day
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // IMPORTANT: Only setup calendar after we have user workout days
      if (currentWorkoutDays.length > 0) {
        // Use the progressive calendar setup
        const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
          formattedPlan.start_date,
          formattedPlan.workoutDays.length,
          currentWorkoutDays,
          { primary: '#7B69EE' },
        );

        // Check if today is a workout day
        const todayMarkedInfo = markedDatesObj[todayStr];
        if (todayMarkedInfo && todayMarkedInfo.marked && todayMarkedInfo.workoutDayIndex) {
          // Today is a workout day - set it as the active day
          setActiveDay(todayMarkedInfo.workoutDayIndex);
        } else {
          // Today is not a workout day - don't set an active day (will show rest day)
          setActiveDay(null);
        }
      } else {
        // No user workout days available, calendar setup delayed
        // Don't set an active day until we have proper workout days
        setActiveDay(null);
      }
    } catch (err: unknown) {
      // Error fetching active plan
      setError('Failed to load your plan.');
      console.error('Error fetching active plan:', err);
      setCycleProgress(null);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, userWorkoutDays, setPlan, setCycleProgress, setActiveDay, setIsLoading, setError]);

  return {
    fetchUserWorkoutDays,
    fetchCycleProgress,
    fetchActivePlan,
  };
};
export default function UsePlanDataProps() {
  return null;
}
