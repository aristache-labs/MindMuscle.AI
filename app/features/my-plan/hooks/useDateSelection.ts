import { useCallback } from 'react';
import { format } from 'date-fns';
import { useAuth } from '../../../store/AuthContext';
import supabase from '../../../services/supabase';
import workoutPlanService from '../../../services/workoutPlanService';
import { Plan, CycleProgress, CompletedWorkoutData, PausedWorkout, LockedWeekInfo } from '../types';

interface WorkoutHistoryRecord {
  completed_exercises: number;
  workout_duration: string;
  calories_burned: number;
  total_volume: number;
  total_reps: number;
  completed_at: string;
  week_name: string;
  cycle_week: number;
  workout_day: number;
}

interface UseDateSelectionProps {
  plan: Plan | null;
  userWorkoutDays: number[];
  cycleProgress: CycleProgress | null;
  setSelectedDate: (date: Date) => void;
  setActiveDay: (day: number | null) => void;
  setIsWorkoutCompleted: (completed: boolean) => void;
  setCompletedWorkoutData: (data: CompletedWorkoutData | null) => void;
  setHasPausedWorkout: (has: boolean) => void;
  setPausedWorkout: (workout: PausedWorkout | null) => void;
  setIsViewingLockedWeek: (viewing: boolean) => void;
  setLockedWeekInfo: (info: LockedWeekInfo | null) => void;
  setIsDateSelectionLoading: (loading: boolean) => void;
  setIsManualDateSelection: (manual: boolean) => void;
}

export const useDateSelection = ({
  plan,
  userWorkoutDays,
  cycleProgress,
  setSelectedDate,
  setActiveDay,
  setIsWorkoutCompleted,
  setCompletedWorkoutData,
  setHasPausedWorkout,
  setPausedWorkout,
  setIsViewingLockedWeek,
  setLockedWeekInfo,
  setIsDateSelectionLoading,
  setIsManualDateSelection,
}: UseDateSelectionProps) => {
  const { user } = useAuth();

  // Helper function to check if week is locked
  const checkLockedWeek = useCallback(
    (selectedCycleWeek: number | undefined, selectedWeekName: string | undefined) => {
      if (cycleProgress && selectedCycleWeek && selectedCycleWeek > cycleProgress.currentWeek) {
        setIsViewingLockedWeek(true);
        setLockedWeekInfo({
          selectedWeek: selectedCycleWeek,
          selectedWeekName: selectedWeekName || 'Unknown',
          currentWeek: cycleProgress.currentWeek,
          currentWeekName: cycleProgress.weekName,
        });
        return true;
      }
      setIsViewingLockedWeek(false);
      setLockedWeekInfo(null);
      return false;
    },
    [cycleProgress, setIsViewingLockedWeek, setLockedWeekInfo],
  );

  // Helper function to check workout completion
  const checkWorkoutCompletion = useCallback(
    async (
      workoutDayIndex: number,
      selectedDateStr: string,
      cycleWeek: number | undefined,
    ): Promise<{ isCompleted: boolean; data: CompletedWorkoutData | null }> => {
      if (!user?.id || !plan?.id) {
        return { isCompleted: false, data: null };
      }

      try {
        const { data: completedWorkouts, error: completedError } = await supabase
          .from('user_workout_history')
          .select('*')
          .eq('user_id', user.id)
          .eq('plan_id', plan.id)
          .eq('workout_day', workoutDayIndex);

        if (completedError) {
          console.error('Error fetching completed workouts:', completedError);
          return { isCompleted: false, data: null };
        }

        if (completedWorkouts && completedWorkouts.length > 0) {
          const matchingCompletion = completedWorkouts.find((w: WorkoutHistoryRecord) => {
            const completionDate = new Date(w.completed_at);
            const completionDateStr = format(completionDate, 'yyyy-MM-dd');

            return (
              completionDateStr === selectedDateStr ||
              (w.cycle_week === cycleWeek && w.workout_day === workoutDayIndex)
            );
          });

          if (matchingCompletion) {
            const completedWorkoutData = {
              completedExercises: matchingCompletion.completed_exercises || 0,
              duration: matchingCompletion.workout_duration || '00:00:00',
              caloriesBurned: matchingCompletion.calories_burned || 0,
              totalVolume: matchingCompletion.total_volume || 0,
              totalReps: matchingCompletion.total_reps || 0,
              completedAt: matchingCompletion.completed_at,
              weekName: matchingCompletion.week_name || '',
              cycleWeek: matchingCompletion.cycle_week || 1,
            };
            return { isCompleted: true, data: completedWorkoutData };
          }
        }

        return { isCompleted: false, data: null };
      } catch (error) {
        console.error('Error checking workout completion:', error);
        return { isCompleted: false, data: null };
      }
    },
    [user?.id, plan?.id],
  );

  // Helper function to check for paused workout (specific workout day)
  const checkForPausedWorkout = useCallback(
    async (workoutDay?: number): Promise<boolean> => {
      const dayToCheck = workoutDay;
      if (!user?.id || !plan?.id || dayToCheck === null || dayToCheck === undefined) {
        return false;
      }

      try {
        const { data, error } = await supabase
          .from('user_paused_workouts')
          .select('*')
          .eq('user_id', user.id)
          .eq('plan_id', plan.id)
          .eq('workout_day', dayToCheck)
          .limit(1);

        if (error) {
          console.error('Error checking for paused workout:', error);
          return false;
        }

        return data && data.length > 0;
      } catch (error) {
        console.error('Error checking for paused workout:', error);
        return false;
      }
    },
    [user?.id, plan?.id],
  );

  // Helper function to check paused workout
  const getPausedWorkoutData = useCallback(
    async (workoutDayIndex: number): Promise<PausedWorkout | null> => {
      if (!user?.id || !plan?.id) {
        return null;
      }

      try {
        const { data, error } = await supabase
          .from('user_paused_workouts')
          .select('*')
          .eq('user_id', user.id)
          .eq('plan_id', plan.id)
          .eq('workout_day', workoutDayIndex)
          .limit(1);

        if (!error && data && data.length > 0) {
          return {
            userId: data[0].user_id,
            planId: data[0].plan_id,
            workoutDay: data[0].workout_day,
            cycleWeek: data[0].cycle_week,
            weekName: data[0].week_name,
            exercises: data[0].exercises,
            exerciseSets: data[0].exercise_sets,
            workoutDuration: data[0].workout_duration,
            totalVolume: data[0].total_volume,
            totalReps: data[0].total_reps,
            currentExerciseIndex: data[0].current_exercise_index,
            originalCycleWeek: data[0].original_cycle_week,
            pausedAt: data[0].paused_at,
          };
        }

        return null;
      } catch (error) {
        console.error('Error checking for paused workout:', error);
        return null;
      }
    },
    [user?.id, plan?.id],
  );

  // Helper function to reset workout states
  const resetWorkoutStates = useCallback(() => {
    setActiveDay(null);
    setIsWorkoutCompleted(false);
    setCompletedWorkoutData(null);
    setHasPausedWorkout(false);
    setPausedWorkout(null);
    setIsViewingLockedWeek(false);
    setLockedWeekInfo(null);
    setIsDateSelectionLoading(false);
  }, [
    setActiveDay,
    setIsWorkoutCompleted,
    setCompletedWorkoutData,
    setHasPausedWorkout,
    setPausedWorkout,
    setIsViewingLockedWeek,
    setLockedWeekInfo,
    setIsDateSelectionLoading,
  ]);

  // Main date selection handler
  const handleCalendarDateSelect = useCallback(
    async (date: Date, workoutDayIndex: number | null, isWorkoutDay: boolean) => {
      setSelectedDate(date);
      setIsManualDateSelection(true);
      setHasPausedWorkout(false);
      setPausedWorkout(null);

      if (isWorkoutDay && workoutDayIndex !== null && user?.id && plan?.id) {
        setIsDateSelectionLoading(true);
        setIsWorkoutCompleted(false);
        setCompletedWorkoutData(null);
        setActiveDay(null);

        try {
          const selectedDateStr = format(date, 'yyyy-MM-dd');
          const markedDatesObj = workoutPlanService.setupCalendarDatesProgressive(
            plan.start_date,
            plan.workoutDays.length,
            userWorkoutDays,
            { primary: '#7B69EE' },
          );

          const selectedDateInfo = markedDatesObj[selectedDateStr];
          const selectedCycleWeek = selectedDateInfo?.cycleWeek;
          const selectedWeekName = selectedDateInfo?.weekName;

          // Check if week is locked
          const isLocked = checkLockedWeek(selectedCycleWeek, selectedWeekName);
          if (isLocked) {
            setIsWorkoutCompleted(false);
            setCompletedWorkoutData(null);
            setHasPausedWorkout(false);
            setPausedWorkout(null);
            setTimeout(() => setIsManualDateSelection(false), 500);
            setIsDateSelectionLoading(false);
            return;
          }

          const cycleWeek = selectedDateInfo?.cycleWeek;

          // Check workout completion
          const { isCompleted, data: completedData } = await checkWorkoutCompletion(
            workoutDayIndex,
            selectedDateStr,
            cycleWeek,
          );

          setIsWorkoutCompleted(isCompleted);
          if (isCompleted && completedData) {
            setCompletedWorkoutData(completedData);
            setHasPausedWorkout(false);
            setPausedWorkout(null);
          } else {
            setCompletedWorkoutData(null);
            // Check for paused workout
            const pausedData = await getPausedWorkoutData(workoutDayIndex);
            if (pausedData) {
              setPausedWorkout(pausedData);
              setHasPausedWorkout(true);
            } else {
              setPausedWorkout(null);
              setHasPausedWorkout(false);
            }
          }

          setActiveDay(workoutDayIndex);
        } catch (error) {
          console.error('Error checking workout completion for selected date:', error);
          setIsWorkoutCompleted(false);
          setCompletedWorkoutData(null);
          setHasPausedWorkout(false);
          setPausedWorkout(null);
        } finally {
          setIsDateSelectionLoading(false);
        }
      } else {
        resetWorkoutStates();
      }

      setTimeout(() => setIsManualDateSelection(false), 500);
    },
    [
      user?.id,
      plan?.id,
      userWorkoutDays,
      plan?.start_date,
      plan?.workoutDays?.length,
      setSelectedDate,
      setIsManualDateSelection,
      setHasPausedWorkout,
      setPausedWorkout,
      setIsDateSelectionLoading,
      setIsWorkoutCompleted,
      setCompletedWorkoutData,
      setActiveDay,
      checkLockedWeek,
      checkWorkoutCompletion,
      getPausedWorkoutData,
      resetWorkoutStates,
    ],
  );

  return {
    handleCalendarDateSelect,
    checkForPausedWorkout,
    checkWorkoutCompletion,
    getPausedWorkoutData,
  };
};
export default function WorkoutHistoryRecord() {
  return null;
}
