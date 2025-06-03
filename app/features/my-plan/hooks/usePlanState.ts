import { useState, useCallback } from 'react';
import {
  Plan,
  CycleProgress,
  CompletedWorkoutData,
  PausedWorkout,
  PausedWorkoutInfo,
  LockedWeekInfo,
  SelectedExercise,
} from '../types';

export const usePlanState = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userWorkoutDays, setUserWorkoutDays] = useState<number[]>([]);

  // Calendar state
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeDay, setActiveDay] = useState<number | null>(null);
  const [completedWorkoutDays, setCompletedWorkoutDays] = useState<string[]>([]);
  const [pausedWorkoutDays, setPausedWorkoutDays] = useState<string[]>([]);

  // Workout completion state
  const [isWorkoutCompleted, setIsWorkoutCompleted] = useState(false);
  const [completedWorkoutData, setCompletedWorkoutData] = useState<CompletedWorkoutData | null>(
    null,
  );

  // Paused workout state
  const [pausedWorkout, setPausedWorkout] = useState<PausedWorkout | null>(null);
  const [hasPausedWorkout, setHasPausedWorkout] = useState(false);

  // Modal states
  const [showPausedWorkoutModal, setShowPausedWorkoutModal] = useState(false);
  const [pausedWorkoutInfo, setPausedWorkoutInfo] = useState<PausedWorkoutInfo>({
    pausedDay: null,
    currentDay: null,
    mode: 'start',
  });

  // Cycle progress state
  const [cycleProgress, setCycleProgress] = useState<CycleProgress | null>(null);

  // Locked week state
  const [isViewingLockedWeek, setIsViewingLockedWeek] = useState(false);
  const [lockedWeekInfo, setLockedWeekInfo] = useState<LockedWeekInfo | null>(null);

  // Loading states
  const [isDateSelectionLoading, setIsDateSelectionLoading] = useState(false);
  const [isManualDateSelection, setIsManualDateSelection] = useState(false);
  const [hasAppliedCustomizations, setHasAppliedCustomizations] = useState(false);

  // Exercise modal state
  const [exerciseDetailsModalVisible, setExerciseDetailsModalVisible] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<SelectedExercise | null>(null);

  // Plan overview modal state
  const [planOverviewModalVisible, setPlanOverviewModalVisible] = useState(false);

  // Helper function to find workout day by number
  const getWorkoutDayByNumber = useCallback(
    (dayNumber: number | null) => {
      if (!plan || dayNumber === null) return null;
      return plan.workoutDays.find((workoutDay) => workoutDay.day === dayNumber) || null;
    },
    [plan],
  );

  return {
    // State
    isLoading,
    plan,
    error,
    userWorkoutDays,
    selectedDate,
    activeDay,
    completedWorkoutDays,
    pausedWorkoutDays,
    isWorkoutCompleted,
    completedWorkoutData,
    pausedWorkout,
    hasPausedWorkout,
    showPausedWorkoutModal,
    pausedWorkoutInfo,
    cycleProgress,
    isViewingLockedWeek,
    lockedWeekInfo,
    isDateSelectionLoading,
    isManualDateSelection,
    hasAppliedCustomizations,
    exerciseDetailsModalVisible,
    selectedExercise,
    planOverviewModalVisible,

    // Setters
    setIsLoading,
    setPlan,
    setError,
    setUserWorkoutDays,
    setSelectedDate,
    setActiveDay,
    setCompletedWorkoutDays,
    setPausedWorkoutDays,
    setIsWorkoutCompleted,
    setCompletedWorkoutData,
    setPausedWorkout,
    setHasPausedWorkout,
    setShowPausedWorkoutModal,
    setPausedWorkoutInfo,
    setCycleProgress,
    setIsViewingLockedWeek,
    setLockedWeekInfo,
    setIsDateSelectionLoading,
    setIsManualDateSelection,
    setHasAppliedCustomizations,
    setExerciseDetailsModalVisible,
    setSelectedExercise,
    setPlanOverviewModalVisible,

    // Helper functions
    getWorkoutDayByNumber,
  };
};
export default function disablewarn() {
  return null;
}
