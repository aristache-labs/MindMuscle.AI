import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useAuth } from '../../../store/AuthContext';
import supabase from '../../../services/supabase';
import workoutPlanService from '../../../services/workoutPlanService';
import { Plan, PausedWorkoutInfo } from '../types';

interface UseWorkoutActionsProps {
  plan: Plan | null;
  activeDay: number | null;
  selectedDate: Date;
  userWorkoutDays: number[];
  setShowPausedWorkoutModal: (show: boolean) => void;
  setPausedWorkoutInfo: (info: PausedWorkoutInfo) => void;
  setHasAppliedCustomizations: (applied: boolean) => void;
}

export const useWorkoutActions = ({
  plan,
  activeDay,
  selectedDate,
  userWorkoutDays,
  setShowPausedWorkoutModal,
  setPausedWorkoutInfo,
  setHasAppliedCustomizations,
}: UseWorkoutActionsProps) => {
  const router = useRouter();
  const { user } = useAuth();

  // Function to check for paused workouts for any day in the current plan
  const checkForAnyPausedWorkout = useCallback(async () => {
    if (!user?.id || !plan?.id) return { hasPaused: false, pausedWorkoutDay: null };

    try {
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .order('paused_at', { ascending: false });

      if (error) {
        console.error('Error checking for any paused workouts:', error);
        return { hasPaused: false, pausedWorkoutDay: null };
      }

      if (data && data.length > 0) {
        return {
          hasPaused: true,
          pausedWorkoutDay: data[0].workout_day,
          pausedWorkoutData: data[0],
        };
      }

      return { hasPaused: false, pausedWorkoutDay: null };
    } catch (error) {
      console.error('Error in checkForAnyPausedWorkout:', error);
      return { hasPaused: false, pausedWorkoutDay: null };
    }
  }, [user?.id, plan?.id]);

  // Handle starting a workout
  const handleStartWorkout = useCallback(async () => {
    if (!plan || activeDay === null || !user) return;

    try {
      // Check for any paused workouts in the plan
      const { hasPaused, pausedWorkoutDay } = await checkForAnyPausedWorkout();

      if (hasPaused && pausedWorkoutDay !== null) {
        setPausedWorkoutInfo({
          pausedDay: pausedWorkoutDay,
          currentDay: activeDay,
          mode: 'start',
        });
        setShowPausedWorkoutModal(true);
        return;
      }

      // Fetch the user's current cycle week from the database
      const { data: activePlanData, error: activePlanError } = await supabase
        .from('user_active_plans')
        .select('current_week, completed_workouts')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .eq('is_active', true)
        .single();

      if (activePlanError) {
        console.error('Error fetching active plan data:', activePlanError);
        Alert.alert('Error', 'Failed to fetch plan data');
        return;
      }

      const currentWeek = activePlanData?.current_week || 1;

      // Get the week name from the database
      const { data: weekData } = await supabase
        .from('workout_cycle_weeks')
        .select('name')
        .eq('week_number', currentWeek)
        .single();

      const weekName = weekData?.name || 'Adaptation';

      // Navigate to workout session
      router.push({
        pathname: '/(stack)/workout-session',
        params: {
          planId: plan.id,
          workoutDay: activeDay,
          cycleWeek: currentWeek,
          weekName: weekName,
        },
      });
    } catch {
      Alert.alert('Error', 'Failed to start workout');
    }
  }, [
    plan,
    activeDay,
    user,
    checkForAnyPausedWorkout,
    setPausedWorkoutInfo,
    setShowPausedWorkoutModal,
    router,
  ]);

  // Handle resuming a paused workout
  const handleResumeWorkout = useCallback(async () => {
    if (!user || !plan) {
      Alert.alert('Error', 'User or plan not available');
      return;
    }

    try {
      // Fetch the most recent paused workout directly from database to avoid UI state issues
      const { data, error } = await supabase
        .from('user_paused_workouts')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_id', plan.id)
        .order('paused_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error fetching paused workout:', error);
        Alert.alert('Error', 'Failed to fetch paused workout');
        return;
      }

      if (!data || data.length === 0) {
        Alert.alert('Error', 'No paused workout found');
        return;
      }

      const pausedWorkoutData = data[0];
      console.log('RESUME: Fetched paused workout data directly from database');
      setHasAppliedCustomizations(true);

      // Use the paused workout's cycle information directly
      const pausedCycleWeek = pausedWorkoutData.cycle_week || 1;
      const pausedWeekName = pausedWorkoutData.week_name || 'Adaptation';

      // Navigate to workout session with the paused workout's data
      router.push({
        pathname: '/(stack)/workout-session',
        params: {
          planId: plan.id,
          workoutDay: pausedWorkoutData.workout_day,
          cycleWeek: pausedCycleWeek,
          weekName: pausedWeekName,
          forceResume: 'true',
        },
      });
    } catch (error) {
      console.error('Error in handleResumeWorkout:', error);
      Alert.alert('Error', 'Failed to resume workout');
    }
  }, [user, plan, setHasAppliedCustomizations, router]);

  // Handle redoing a workout
  const handleRedoWorkout = useCallback(async () => {
    if (!plan || activeDay === null || !user) return;

    try {
      // Check for any paused workouts in the plan
      const { hasPaused, pausedWorkoutDay } = await checkForAnyPausedWorkout();

      if (hasPaused && pausedWorkoutDay !== null) {
        setPausedWorkoutInfo({
          pausedDay: pausedWorkoutDay,
          currentDay: activeDay,
          mode: 'redo',
        });
        setShowPausedWorkoutModal(true);
        return;
      }

      // Get the cycle week from the selected date
      const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
      const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
        plan.start_date,
        plan.workoutDays.length,
        userWorkoutDays,
        { primary: '#7B69EE' },
      );

      const selectedDateInfo = markedDatesObj[selectedDateStr];
      const selectedCycleWeek = selectedDateInfo?.cycleWeek || 1;
      const selectedWeekName = selectedDateInfo?.weekName || 'Adaptation';

      // Navigate to workout session with force start flag
      router.push({
        pathname: '/(stack)/workout-session',
        params: {
          planId: plan.id,
          workoutDay: activeDay,
          cycleWeek: selectedCycleWeek,
          weekName: selectedWeekName,
          forceStart: 'true',
        },
      });
    } catch {
      Alert.alert('Error', 'Failed to restart workout');
    }
  }, [
    plan,
    activeDay,
    user,
    checkForAnyPausedWorkout,
    setPausedWorkoutInfo,
    setShowPausedWorkoutModal,
    selectedDate,
    userWorkoutDays,
    router,
  ]);

  return {
    handleStartWorkout,
    handleResumeWorkout,
    handleRedoWorkout,
    checkForAnyPausedWorkout,
  };
};
export default function disablewarn() {
  return null;
}
