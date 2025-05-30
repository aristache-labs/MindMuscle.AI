import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useAuth } from '../../../store/AuthContext';
import supabase from '../../../services/supabase';
import workoutPlanService from '../../../services/workoutPlanService';
import { Plan, PausedWorkout, PausedWorkoutInfo } from '../types';

interface UseWorkoutActionsProps {
  plan: Plan | null;
  activeDay: number | null;
  selectedDate: Date;
  userWorkoutDays: number[];
  pausedWorkout: PausedWorkout | null;
  hasPausedWorkout: boolean;
  setIsLoading: (loading: boolean) => void;
  setPausedWorkout: (workout: PausedWorkout | null) => void;
  setHasPausedWorkout: (has: boolean) => void;
  setShowPausedWorkoutModal: (show: boolean) => void;
  setPausedWorkoutInfo: (info: PausedWorkoutInfo) => void;
  setHasAppliedCustomizations: (applied: boolean) => void;
  updatePausedWorkoutWithCustomizations: (
    pausedWorkoutData: PausedWorkout,
  ) => Promise<PausedWorkout>;
}

export const useWorkoutActions = ({
  plan,
  activeDay,
  selectedDate,
  userWorkoutDays,
  pausedWorkout,
  hasPausedWorkout,
  setIsLoading: _setIsLoading,
  setPausedWorkout,
  setHasPausedWorkout: _setHasPausedWorkout,
  setShowPausedWorkoutModal,
  setPausedWorkoutInfo,
  setHasAppliedCustomizations,
  updatePausedWorkoutWithCustomizations,
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
      const { data: weekData, error: _weekError } = await supabase
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
    if (!user || !plan || !hasPausedWorkout || !pausedWorkout || activeDay === null) {
      Alert.alert('Error', 'No paused workout found for this day');
      return;
    }

    try {
      // Update paused workout with any exercise customizations
      const updatedPausedWorkout = await updatePausedWorkoutWithCustomizations(pausedWorkout);
      setHasAppliedCustomizations(true);

      // Save the updated paused workout back to the database
      if (updatedPausedWorkout !== pausedWorkout) {
        // Convert Exercise[] to ExerciseData[] by adding the required 'order' property
        // and ensuring exercise_id is a string
        const exercisesWithOrder = updatedPausedWorkout.exercises.map((exercise, index) => ({
          id: exercise.id,
          exercise_id: exercise.exercise_id || exercise.id, // Ensure exercise_id is always a string
          name: exercise.name,
          sets: exercise.sets,
          reps_range: exercise.reps_range,
          image_url: exercise.image_url,
          primary_muscles: exercise.primary_muscles,
          workout_day: exercise.workout_day,
          order: index + 1,
        }));

        // Convert ExerciseSet format from my-plan types to workoutPlanService types
        const convertedExerciseSets: Record<
          string,
          Array<{
            id: string;
            setNumber: number;
            weight: string;
            reps: string;
            isCompleted: boolean;
          }>
        > = {};

        Object.entries(updatedPausedWorkout.exerciseSets).forEach(([exerciseId, sets]) => {
          convertedExerciseSets[exerciseId] = sets.map((set, index) => ({
            id: `${exerciseId}-set-${index + 1}`,
            setNumber: index + 1,
            weight: set.weight?.toString() || '0',
            reps: set.reps?.toString() || '0',
            isCompleted: set.isCompleted,
          }));
        });

        await workoutPlanService.savePausedWorkout({
          userId: user.id,
          planId: plan.id,
          workoutDay: updatedPausedWorkout.workoutDay,
          cycleWeek: updatedPausedWorkout.cycleWeek,
          weekName: updatedPausedWorkout.weekName,
          exercises: exercisesWithOrder,
          exerciseSets: convertedExerciseSets,
          workoutDuration: updatedPausedWorkout.workoutDuration,
          totalVolume: updatedPausedWorkout.totalVolume,
          totalReps: updatedPausedWorkout.totalReps,
          currentExerciseIndex: updatedPausedWorkout.currentExerciseIndex,
          originalCycleWeek: updatedPausedWorkout.originalCycleWeek,
        });

        setPausedWorkout(updatedPausedWorkout);
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

      // Navigate to workout session
      router.push({
        pathname: '/(stack)/workout-session',
        params: {
          planId: plan.id,
          workoutDay: updatedPausedWorkout.workoutDay || activeDay,
          cycleWeek: selectedCycleWeek,
          weekName: selectedWeekName,
          forceResume: 'true',
        },
      });
    } catch {
      Alert.alert('Error', 'Failed to resume workout');
    }
  }, [
    user,
    plan,
    hasPausedWorkout,
    pausedWorkout,
    activeDay,
    updatePausedWorkoutWithCustomizations,
    setHasAppliedCustomizations,
    setPausedWorkout,
    selectedDate,
    userWorkoutDays,
    router,
  ]);

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
